# Generador DOCX — Servidor HTTP para N8N / Agentes IA

Servidor FastAPI que genera documentos `.docx` profesionales a partir de JSON.
Expuesto como HTTP para consumirse desde **N8N**, Make, o cualquier agente IA.

---

## Instalación (una sola vez)

```bash
# 1. Entrar a la carpeta
cd docx-server

# 2. Instalar dependencias Python
pip install -r requirements.txt

# 3. Verificar que Node.js está instalado (>=18)
node --version
npm install -g docx   # si no lo tienes ya
```

---

## Arrancar el servidor

```bash
python docx_server.py
```

O con uvicorn directamente (para producción):
```bash
uvicorn docx_server:app --host 0.0.0.0 --port 8100
```

El servidor arranca en: **http://localhost:8100**

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`  | `/health` | Healthcheck |
| `GET`  | `/docs` | Swagger UI interactivo |
| `GET`  | `/esquema` | JSON de referencia para construir documentos |
| `POST` | `/generar` | **Genera un `.docx`** |
| `GET`  | `/descargar/{nombre}` | Descarga directa del archivo |
| `GET`  | `/documentos` | Lista documentos generados |
| `DELETE` | `/documentos/{nombre}` | Elimina un documento |

---

## Uso desde N8N

### Nodo HTTP Request — Generar documento

```
Método:      POST
URL:         http://localhost:8100/generar
Body Type:   JSON
```

**Body de ejemplo:**
```json
{
  "especificacion": {
    "titulo": "Informe Automático",
    "empresa": "Mi Empresa S.L.",
    "portada": {
      "titulo": "Informe de Estado",
      "subtitulo": "Generado por el agente IA",
      "autor": "N8N Workflow",
      "version": "1.0"
    },
    "tabla_contenidos": true,
    "secciones": [
      {
        "titulo": "Resumen",
        "bloques": [
          { "tipo": "parrafo", "texto": "Este informe fue generado automáticamente." },
          { "tipo": "alerta", "nivel": "info", "texto": "Todos los sistemas operan con normalidad." }
        ]
      },
      {
        "titulo": "Datos",
        "bloques": [
          {
            "tipo": "tabla",
            "columnas": ["Campo", "Valor"],
            "filas": [
              ["Fecha", "20/03/2026"],
              ["Estado", "OK"]
            ]
          }
        ]
      }
    ]
  },
  "nombre_archivo": "informe_estado",
  "incluir_base64": true,
  "incluir_url": true
}
```

**Respuesta:**
```json
{
  "success": true,
  "id": "a3f9b2c1",
  "nombre": "informe_estado_20260320_143022_a3f9b2c1.docx",
  "url_descarga": "http://localhost:8100/descargar/informe_estado_20260320_143022_a3f9b2c1.docx",
  "base64": "UEsDBBQABgAIAAAAIQB...",
  "tamaño_kb": 14.2,
  "timestamp": "20260320_143022"
}
```

### Nodo HTTP Request — Descargar archivo (binario)

```
Método:         GET
URL:            {{ $json.url_descarga }}
Response Type:  File
```

---

## Tipos de bloque disponibles

| Tipo | Campos extra | Descripción |
|------|-------------|-------------|
| `titulo1` | `texto` | Título grande con línea inferior |
| `titulo2` | `texto` | Subtítulo azul medio |
| `titulo3` | `texto` | Subtítulo pequeño gris |
| `parrafo` | `texto`, `negrita`, `cursiva`, `alineacion`, `color` | Párrafo normal |
| `parrafo_rich` | `segmentos:[{texto,negrita,cursiva,color,enlace}]` | Párrafo con formato mixto y links |
| `lista_bullets` | `items:[]`, `nivel` | Lista con viñetas |
| `lista_numerada` | `items:[]` | Lista numerada |
| `tabla` | `columnas:[]`, `filas:[[]]` | Tabla con cabecera coloreada y filas alternas |
| `alerta` | `texto`, `nivel: info\|exito\|aviso\|error` | Bloque de alerta con color |
| `separador` | — | Línea horizontal |
| `salto_pagina` | — | Salto de página |
| `espacio` | `altura` | Espacio vertical en DXA |

---

## Personalizar colores del tema

En la `especificacion` puedes añadir (sin el `#`):

```json
{
  "color_primario":    "1B3A6B",
  "color_secundario":  "2E75B6",
  "color_acento":      "00B0F0",
  "color_cabecera_bg": "1B3A6B",
  "color_fila_par":    "EAF2FB"
}
```

---

## Como servicio (systemd — Linux)

```ini
# /etc/systemd/system/docx-server.service
[Unit]
Description=Generador DOCX HTTP Server
After=network.target

[Service]
Type=simple
User=tu_usuario
WorkingDirectory=/ruta/a/docx-server
ExecStart=/usr/bin/python3 docx_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable docx-server
sudo systemctl start docx-server
sudo systemctl status docx-server
```

---

## Variables de entorno (.env)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DOCX_HOST` | `0.0.0.0` | IP donde escucha el servidor |
| `DOCX_PORT` | `8100` | Puerto |
| `DOCX_BASE_URL` | `http://localhost:8100` | URL base para las URLs de descarga |
| `DOCX_OUTPUT_DIR` | `./output/documentos` | Carpeta donde se guardan los .docx |
| `DOCX_SCRIPT_JS` | `./scripts/generar_docx.js` | Ruta al script generador |
| `NODE_BIN` | `node` | Binario de Node.js |
