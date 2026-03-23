# docx_generator

Servidor HTTP para generar documentos `.docx` profesionales a partir de un JSON.  
Pensado para integrarse con **N8N**, agentes IA, o cualquier sistema que haga peticiones HTTP.

**Stack:** Python · FastAPI · Node.js · [docx](https://docx.js.org/)

---

## Estructura

```
docx_generator/
├── scripts/
│   └── generar_docx.js      # Motor de generación (Node.js + librería docx)
├── docx_server.py           # Servidor FastAPI
├── requirements.txt         # Dependencias Python
├── .env.example             # Plantilla de variables de entorno
└── README.md
```

---

## Requisitos

- Python 3.10+
- Node.js 18+
- npm

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/frannjrr/docx_generator.git
cd docx_generator

# 2. Instalar dependencias Python
pip install -r requirements.txt

# 3. Instalar librería Node.js para generar .docx
npm install -g docx

# 4. Configurar variables de entorno
cp .env.example .env
# Edita .env si necesitas cambiar puerto o rutas
```

---

## Arrancar el servidor

```bash
python docx_server.py
```

El servidor arranca en `http://localhost:8100`

| URL | Descripción |
|-----|-------------|
| `http://localhost:8100/docs` | Swagger UI — prueba los endpoints aquí |
| `http://localhost:8100/health` | Healthcheck |
| `http://localhost:8100/esquema` | JSON de referencia para construir documentos |

---

## Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/generar` | Genera un `.docx` |
| `GET` | `/descargar/{nombre}` | Descarga directa del archivo |
| `GET` | `/documentos` | Lista documentos generados |
| `DELETE` | `/documentos/{nombre}` | Elimina un documento |
| `GET` | `/health` | Estado del servidor |
| `GET` | `/esquema` | Esquema JSON de referencia |

---

## Ejemplo de uso

```bash
curl -X POST http://localhost:8100/generar \
  -H "Content-Type: application/json" \
  -d '{
    "especificacion": {
      "titulo": "Informe de Prueba",
      "empresa": "Mi Empresa S.L.",
      "portada": {
        "titulo": "Informe de Estado",
        "subtitulo": "Generado automáticamente",
        "autor": "Agente IA",
        "version": "1.0"
      },
      "tabla_contenidos": true,
      "secciones": [
        {
          "titulo": "Resumen",
          "bloques": [
            { "tipo": "parrafo", "texto": "Todo operando con normalidad." },
            { "tipo": "alerta", "nivel": "exito", "texto": "✅ Sistema OK" }
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
                ["Estado", "Activo"]
              ]
            }
          ]
        }
      ]
    },
    "nombre_archivo": "informe_prueba",
    "incluir_base64": true,
    "incluir_url": true
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "id": "a3f9b2c1",
  "nombre": "informe_prueba_20260320_143022_a3f9b2c1.docx",
  "url_descarga": "http://localhost:8100/descargar/informe_prueba_20260320_143022_a3f9b2c1.docx",
  "base64": "UEsDBBQABgAIAAAAIQB...",
  "tamaño_kb": 14.2,
  "timestamp": "20260320_143022"
}
```

---

## Bloques disponibles

| Tipo | Descripción |
|------|-------------|
| `titulo1` / `titulo2` / `titulo3` | Títulos con jerarquía |
| `parrafo` | Texto normal (soporta `negrita`, `cursiva`, `color`, `alineacion`) |
| `parrafo_rich` | Texto con segmentos de formato mixto y enlaces |
| `lista_bullets` | Lista con viñetas |
| `lista_numerada` | Lista numerada |
| `tabla` | Tabla con cabecera coloreada y filas alternas |
| `alerta` | Bloque destacado: `info`, `exito`, `aviso`, `error` |
| `separador` | Línea horizontal |
| `salto_pagina` | Salto de página |
| `espacio` | Espacio vertical |

---

## Integración con N8N

Nodo **HTTP Request**:
```
Método:  POST
URL:     http://localhost:8100/generar
Body:    JSON con la especificación del documento
```

Para descargar el archivo resultante, usa un segundo nodo HTTP Request con:
```
Método:          GET
URL:             {{ $json.url_descarga }}
Response Format: File
```

---

## Variables de entorno

Copia `.env.example` a `.env` y ajusta si necesitas:

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DOCX_HOST` | `0.0.0.0` | IP donde escucha el servidor |
| `DOCX_PORT` | `8100` | Puerto |
| `DOCX_BASE_URL` | `http://localhost:8100` | URL base para links de descarga |
| `DOCX_OUTPUT_DIR` | `./output/documentos` | Carpeta de salida |
| `DOCX_SCRIPT_JS` | `./scripts/generar_docx.js` | Ruta al script Node.js |
| `NODE_BIN` | `node` | Binario de Node.js |

---

## Como servicio permanente (Linux)

```bash
# /etc/systemd/system/docx-generator.service
[Unit]
Description=docx_generator HTTP Server
After=network.target

[Service]
Type=simple
User=tu_usuario
WorkingDirectory=/ruta/a/docx_generator
ExecStart=/usr/bin/python3 docx_server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable docx-generator
sudo systemctl start docx-generator
```

---

## .gitignore recomendado

```gitignore
.env
__pycache__/
*.pyc
venv/
output/
*.docx
node_modules/
.idea/
.vscode/
```

---

## Autor

[frannjrr](https://github.com/frannjrr)
