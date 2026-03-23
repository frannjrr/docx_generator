"""
docx_server.py — Servidor HTTP standalone para generación de documentos .docx
Pensado para ser consumido desde N8N, Make, o cualquier agente vía HTTP/MCP.

Endpoints:
  POST /generar          → genera docx, devuelve base64 + URL de descarga
  GET  /descargar/{id}   → descarga el archivo directamente
  GET  /documentos       → lista documentos generados
  DELETE /documentos/{id}→ elimina un documento
  GET  /health           → healthcheck
  GET  /esquema          → devuelve el esquema JSON de referencia

Arrancar:
  pip install fastapi uvicorn python-dotenv
  python docx_server.py

  O con uvicorn directamente:
  uvicorn docx_server:app --host 0.0.0.0 --port 8100 --reload
"""

import base64
import json
import os
import subprocess
import tempfile
import uuid
from datetime import datetime
from pathlib import Path

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

load_dotenv()

# ─── Config ─────────────────────────────────────────────────────────────────
HOST        = os.getenv("DOCX_HOST",       "0.0.0.0")
PORT        = int(os.getenv("DOCX_PORT",   "8100"))
OUTPUT_DIR  = Path(os.getenv("DOCX_OUTPUT_DIR", "./output/documentos"))
SCRIPT_JS   = Path(os.getenv("DOCX_SCRIPT_JS",  "./scripts/generar_docx.js"))
NODE_BIN    = os.getenv("NODE_BIN", "node")
BASE_URL    = os.getenv("DOCX_BASE_URL", f"http://localhost:{PORT}")

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Generador de Documentos DOCX",
    description="API para generar documentos Word profesionales desde JSON. Úsala desde N8N, Make o cualquier agente IA.",
    version="1.0.0",
)

# ─── Modelos ─────────────────────────────────────────────────────────────────
class SolicitudDocumento(BaseModel):
    especificacion: dict
    nombre_archivo: str = ""
    incluir_base64: bool = True
    incluir_url:    bool = True

class RespuestaDocumento(BaseModel):
    success:      bool
    id:           str = ""
    nombre:       str = ""
    url_descarga: str = ""
    base64:       str = ""
    tamaño_kb:    float = 0
    timestamp:    str = ""
    error:        str = ""

# ─── Helpers ─────────────────────────────────────────────────────────────────
def _nombre_limpio(spec: dict, nombre: str) -> str:
    if nombre:
        return "".join(c if c.isalnum() or c in "-_ " else "_" for c in nombre)[:60]
    titulo = (
        spec.get("portada", {}).get("titulo")
        or spec.get("titulo")
        or "documento"
    )
    return "".join(c if c.isalnum() or c in "-_ " else "_" for c in titulo)[:50]


def _ejecutar_generador(spec: dict, output_path: Path) -> tuple[bool, str]:
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".json", delete=False, encoding="utf-8"
    ) as tmp:
        json.dump(spec, tmp, ensure_ascii=False, indent=2)
        tmp_path = tmp.name
    try:
        result = subprocess.run(
            [NODE_BIN, str(SCRIPT_JS), "--input", tmp_path, "--output", str(output_path)],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return False, result.stderr or result.stdout or "Error desconocido"
        return True, result.stdout.strip()
    except subprocess.TimeoutExpired:
        return False, "Timeout: el generador tardó más de 30 segundos"
    except FileNotFoundError:
        return False, f"Node.js no encontrado: {NODE_BIN}"
    finally:
        os.unlink(tmp_path)

# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Healthcheck — N8N puede usar este endpoint para verificar que el servidor está activo."""
    return {
        "status":    "ok",
        "timestamp": datetime.now().isoformat(),
        "version":   "1.0.0",
        "node":      NODE_BIN,
        "script":    str(SCRIPT_JS),
        "output_dir": str(OUTPUT_DIR),
    }


@app.get("/esquema")
def esquema():
    """Devuelve el esquema JSON de referencia para construir documentos."""
    esquema_path = SCRIPT_JS.parent / "esquema_documento.json"
    if not esquema_path.exists():
        raise HTTPException(status_code=404, detail="Esquema no encontrado")
    with open(esquema_path, encoding="utf-8") as f:
        return json.load(f)


@app.post("/generar", response_model=RespuestaDocumento)
def generar(solicitud: SolicitudDocumento):
    """
    Genera un documento .docx profesional desde un JSON de especificación.

    El body debe contener:
    - **especificacion**: dict con la estructura del documento (ver /esquema)
    - **nombre_archivo**: nombre del archivo sin extensión (opcional)
    - **incluir_base64**: si devolver el archivo en base64 (default: true)
    - **incluir_url**: si devolver URL de descarga (default: true)

    Ejemplo de body mínimo:
    ```json
    {
      "especificacion": {
        "titulo": "Mi Informe",
        "portada": { "titulo": "Mi Informe", "autor": "Agente IA" },
        "secciones": [{
          "titulo": "Resumen",
          "bloques": [{ "tipo": "parrafo", "texto": "Contenido del informe." }]
        }]
      }
    }
    ```
    """
    doc_id    = str(uuid.uuid4())[:8]
    ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
    nombre    = _nombre_limpio(solicitud.especificacion, solicitud.nombre_archivo)
    filename  = f"{nombre}_{ts}_{doc_id}.docx"
    filepath  = OUTPUT_DIR / filename

    ok, msg = _ejecutar_generador(solicitud.especificacion, filepath)

    if not ok:
        return RespuestaDocumento(success=False, error=msg)

    file_size = filepath.stat().st_size
    respuesta = RespuestaDocumento(
        success=    True,
        id=         doc_id,
        nombre=     filename,
        tamaño_kb=  round(file_size / 1024, 1),
        timestamp=  ts,
    )

    if solicitud.incluir_url:
        respuesta.url_descarga = f"{BASE_URL}/descargar/{filename}"

    if solicitud.incluir_base64:
        respuesta.base64 = base64.b64encode(filepath.read_bytes()).decode("utf-8")

    return respuesta


@app.get("/descargar/{nombre_archivo}")
def descargar(nombre_archivo: str):
    """Descarga directa del archivo .docx generado."""
    # Sanitizar para evitar path traversal
    nombre_archivo = Path(nombre_archivo).name
    filepath = OUTPUT_DIR / nombre_archivo

    if not filepath.exists() or filepath.suffix != ".docx":
        raise HTTPException(status_code=404, detail=f"Archivo no encontrado: {nombre_archivo}")

    return FileResponse(
        path=filepath,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=nombre_archivo,
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )


@app.get("/documentos")
def listar_documentos():
    """Lista todos los documentos generados, ordenados por fecha descendente."""
    docs = []
    for f in sorted(OUTPUT_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.suffix == ".docx":
            stat = f.stat()
            docs.append({
                "nombre":        f.name,
                "tamaño_kb":     round(stat.st_size / 1024, 1),
                "creado":        datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y %H:%M:%S"),
                "url_descarga":  f"{BASE_URL}/descargar/{f.name}",
            })
    return {"total": len(docs), "documentos": docs}


@app.delete("/documentos/{nombre_archivo}")
def eliminar_documento(nombre_archivo: str):
    """Elimina un documento generado por su nombre."""
    nombre_archivo = Path(nombre_archivo).name
    filepath = OUTPUT_DIR / nombre_archivo

    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    filepath.unlink()
    return {"success": True, "eliminado": nombre_archivo}


# ─── Main ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"""
╔══════════════════════════════════════════════╗
║   🗂️  Generador DOCX — Servidor HTTP          ║
╠══════════════════════════════════════════════╣
║  URL base:    {BASE_URL:<30} ║
║  Docs API:    {BASE_URL}/docs              ║
║  Healthcheck: {BASE_URL}/health           ║
║  Esquema:     {BASE_URL}/esquema          ║
╚══════════════════════════════════════════════╝
""")
    uvicorn.run("docx_server:app", host=HOST, port=PORT, reload=False)
