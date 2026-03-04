# mem0 + Qdrant en Railway — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Desplegar mem0 (servidor de memoria semántica) y Qdrant (vector DB) como servicios Railway en el mismo proyecto que OmniMission-Control, usando private networking para latencia sub-ms.

**Architecture:** El repo OmniMission-Control contendrá un subdirectorio `mem0-server/` con el servidor FastAPI de mem0 adaptado para usar Qdrant en lugar de pgvector. Railway desplegará 3 servicios en el mismo proyecto: `omni-mc` (Next.js app), `omni-mem0` (FastAPI), `omni-qdrant` (vector DB). Los servicios se comunican via `*.railway.internal` sin salir a internet.

**Tech Stack:** Python 3.12, FastAPI, mem0ai, qdrant-client, Qdrant Docker image, Railway private networking

**Contexto previo:**
- OmniMission-Control ya está deployado en Railway como `omni-mc`
- El servidor mem0 actualmente usa pgvector + Supabase — queremos reemplazarlo con Qdrant local
- La tabla `memories` en Supabase tiene **0 filas** — no hay nada que migrar
- Source original en: `C:\Users\doc_r\Desktop\RIVAIB-ERP\mem0\server\`
- mem0.ts en OmniMission-Control ya consume la API REST de mem0 (no hay que tocarlo)

---

### Task 1: Copiar server de mem0 al repo OmniMission-Control

**Files:**
- Create: `mem0-server/main.py`
- Create: `mem0-server/requirements.txt`
- Create: `mem0-server/Dockerfile`

**Step 1: Crear el directorio mem0-server**

```bash
mkdir -p mem0-server
```

**Step 2: Copiar archivos del servidor original**

Copiar de `C:\Users\doc_r\Desktop\RIVAIB-ERP\mem0\server\` a `mem0-server\`:
- `main.py`
- `requirements.txt`
- `Dockerfile`

**Step 3: Verificar que los archivos están correctos**

```bash
ls mem0-server/
# Expected: Dockerfile  main.py  requirements.txt
```

**Step 4: Commit inicial**

```bash
git add mem0-server/
git commit -m "feat(mem0): add mem0 server directory (pre-qdrant adaptation)"
```

---

### Task 2: Adaptar main.py para usar Qdrant (sin Neo4j, sin pgvector)

**Files:**
- Modify: `mem0-server/main.py` (toda la sección de configuración)

**Step 1: Entender la configuración actual**

El `DEFAULT_CONFIG` actual en `main.py` tiene:
- `vector_store.provider = "pgvector"` → cambiar a `"qdrant"`
- `graph_store.provider = "neo4j"` → **eliminar** (no lo usamos)
- `llm.provider = "openai"` → mantener
- `embedder.provider = "openai"` → mantener

**Step 2: Reemplazar la sección de vars de entorno al inicio del archivo**

Reemplazar desde `POSTGRES_HOST = ...` hasta `DEFAULT_CONFIG = {...}` con:

```python
QDRANT_HOST = os.environ.get("QDRANT_HOST", "localhost")
QDRANT_PORT = os.environ.get("QDRANT_PORT", "6333")
QDRANT_COLLECTION_NAME = os.environ.get("QDRANT_COLLECTION_NAME", "memories")

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
HISTORY_DB_PATH = os.environ.get("HISTORY_DB_PATH", "/app/history/history.db")

DEFAULT_CONFIG = {
    "version": "v1.1",
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "host": QDRANT_HOST,
            "port": int(QDRANT_PORT),
            "collection_name": QDRANT_COLLECTION_NAME,
        },
    },
    "llm": {
        "provider": "openai",
        "config": {
            "api_key": OPENAI_API_KEY,
            "temperature": 0.2,
            "model": "gpt-4.1-nano-2025-04-14",
        },
    },
    "embedder": {
        "provider": "openai",
        "config": {
            "api_key": OPENAI_API_KEY,
            "model": "text-embedding-3-small",
        },
    },
    "history_db_path": HISTORY_DB_PATH,
}
```

**Step 3: Agregar endpoint /health al final del archivo (antes del `@app.get("/")`)**

```python
@app.get("/health", summary="Health check", include_in_schema=False)
def health():
    """Liveness probe para Railway."""
    return {"status": "ok"}
```

**Step 4: Verificar que no quedan referencias a POSTGRES ni NEO4J en main.py**

```bash
grep -n "POSTGRES\|NEO4J\|MEMGRAPH\|neo4j\|postgres" mem0-server/main.py
# Expected: no output
```

**Step 5: Commit**

```bash
git add mem0-server/main.py
git commit -m "feat(mem0): switch vector store from pgvector to qdrant, remove neo4j"
```

---

### Task 3: Actualizar requirements.txt y Dockerfile

**Files:**
- Modify: `mem0-server/requirements.txt`
- Modify: `mem0-server/Dockerfile`

**Step 1: Actualizar requirements.txt**

Reemplazar el contenido completo con:

```
fastapi==0.115.8
uvicorn==0.34.0
pydantic==2.10.4
mem0ai>=0.1.48
python-dotenv==1.0.1
qdrant-client>=1.7.0
```

> **Por qué**: Eliminamos `psycopg` (era para pgvector/postgres). Agregamos `qdrant-client` para el backend Qdrant.

**Step 2: Actualizar Dockerfile**

Reemplazar el contenido completo con:

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Crear directorio para history.db
RUN mkdir -p /app/history

ENV PYTHONUNBUFFERED=1

# Railway asigna $PORT dinámicamente; usamos 8000 como fallback.
# Fijamos PORT=8000 como env var en Railway para private networking estable.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

> **Por qué se cambia el CMD**: El Dockerfile original usaba `--reload` (modo desarrollo) y hardcodeaba el puerto. Railway asigna `$PORT` dinámicamente. Fijamos `PORT=8000` en las env vars de Railway para que `http://omni-mem0.railway.internal:8000` siempre funcione.

**Step 3: Verificar sintaxis del Dockerfile**

```bash
cat mem0-server/Dockerfile
# Expected: el contenido exacto de arriba, sin errores evidentes
```

**Step 4: Commit**

```bash
git add mem0-server/requirements.txt mem0-server/Dockerfile
git commit -m "feat(mem0): update requirements for qdrant, fix Dockerfile CMD for Railway"
```

---

### Task 4: Push a GitHub

**Files:**
- No changes — solo git operations

**Step 1: Verificar el estado del repo**

```bash
git status
git log --oneline -5
```

**Step 2: Push a main**

```bash
git push origin main
```

**Step 3: Confirmar que los archivos están en GitHub**

Verificar en `https://github.com/RIVAIB/OmniMission-Control` que el directorio `mem0-server/` existe con los 3 archivos.

---

### Task 5: Desplegar Qdrant en Railway

> **Nota**: Este task es 100% operacional — no hay código. Se hace en el Railway dashboard.

**Step 1: Abrir el proyecto Railway de OmniMission-Control**

Ir a https://railway.app → abrir el proyecto donde está `omni-mc`.

**Step 2: Agregar nuevo servicio Qdrant**

- Click "+ New" → "Docker Image"
- Imagen: `qdrant/qdrant:latest`
- Nombre del servicio: `omni-qdrant`

**Step 3: Configurar volume persistente para Qdrant**

En el servicio `omni-qdrant`:
- Ir a "Volumes" tab
- Add Volume
- Mount Path: `/qdrant/storage`
- Esto persiste los vectores entre deploys

**Step 4: Configurar variables de entorno para Qdrant**

En el servicio `omni-qdrant`, Settings → Variables:
```
QDRANT__SERVICE__HTTP_PORT=6333
```

Qdrant expone el HTTP API en puerto 6333 por defecto — esta var lo confirma explícitamente.

**Step 5: Deploy Qdrant**

Railway auto-deploya cuando guardas la configuración. Esperar a que el servicio esté verde.

**Step 6: Verificar que Qdrant está corriendo**

```bash
# Verificar desde la URL pública temporal de Qdrant (Railway asigna una)
curl https://<qdrant-public-url>.railway.app/healthz
# Expected: {"title":"qdrant - vector search engine","version":"..."}
```

> **Nota sobre el hostname interno**: El hostname de private networking será `omni-qdrant.railway.internal`. Este nombre viene del nombre del servicio en Railway dashboard — por eso es crítico llamarlo exactamente `omni-qdrant`.

---

### Task 6: Desplegar mem0-server en Railway

> **Nota**: Este task también es mayormente operacional.

**Step 1: Agregar nuevo servicio mem0 en Railway**

En el mismo proyecto Railway:
- Click "+ New" → "GitHub Repo"
- Seleccionar `RIVAIB/OmniMission-Control`
- **Root Directory**: `mem0-server` (¡crítico! Railway solo buildeará ese subdirectorio)
- Nombre del servicio: `omni-mem0`

**Step 2: Configurar variables de entorno para mem0**

En el servicio `omni-mem0`, Settings → Variables:
```
OPENAI_API_KEY=<tu-openai-key>
QDRANT_HOST=omni-qdrant.railway.internal
QDRANT_PORT=6333
QDRANT_COLLECTION_NAME=memories
HISTORY_DB_PATH=/app/history/history.db
PORT=8000
```

> **Por qué PORT=8000**: Fijamos el puerto para que `http://omni-mem0.railway.internal:8000` sea una URL estable que OmniMission-Control pueda usar sin depender del `$PORT` dinámico de Railway.

**Step 3: Configurar volume para history.db**

En el servicio `omni-mem0`:
- Ir a "Volumes" tab
- Mount Path: `/app/history`

Esto persiste el SQLite de historial de mem0 entre deploys.

**Step 4: Hacer el primer deploy**

Railway usará el Dockerfile en `mem0-server/`. Esperar a que el build termine y el servicio esté verde.

**Step 5: Verificar health del servicio**

```bash
curl https://<mem0-public-url>.railway.app/health
# Expected: {"status":"ok"}

curl https://<mem0-public-url>.railway.app/docs
# Expected: página Swagger con los endpoints de mem0
```

**Step 6: Test rápido de creación de memoria**

```bash
curl -X POST https://<mem0-public-url>.railway.app/memories \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Mi nombre es Carlos"},
      {"role": "assistant", "content": "Hola Carlos, ¿en qué puedo ayudarte?"}
    ],
    "user_id": "test-user",
    "agent_id": "JESSY"
  }'
# Expected: {"results":[...], "relations":[...]}
```

**Step 7: Test de búsqueda**

```bash
curl -X POST https://<mem0-public-url>.railway.app/search \
  -H "Content-Type: application/json" \
  -d '{"query": "cómo se llama el usuario", "user_id": "test-user"}'
# Expected: {"results":[{"id":"...","memory":"El usuario se llama Carlos",...}]}
```

---

### Task 7: Actualizar MEM0_BASE_URL en OmniMission-Control

**Files:**
- No code changes — solo env vars en Railway

**Step 1: Abrir el servicio omni-mc en Railway**

En el proyecto Railway → servicio `omni-mc` → Settings → Variables.

**Step 2: Actualizar MEM0_BASE_URL**

```
MEM0_BASE_URL=http://omni-mem0.railway.internal:8000
```

Esto reemplaza la URL antigua de Vercel/Railway público por la URL de private networking.

**Step 3: Redeploy omni-mc**

Railway auto-redeploya cuando cambias variables. Esperar a que el servicio esté verde.

**Step 4: Verificar la integración end-to-end**

Probar desde el War Room o Telegram que los agentes aún responden correctamente. La memoria debería funcionar igual que antes pero más rápido.

```bash
# Opcional: verificar que el ERP bridge status incluye la nueva URL de mem0
curl https://<omni-mc-url>.railway.app/api/erp-bridge/status \
  -H "Authorization: Bearer <admin-token>"
# Expected: mem0.url = "http://omni-mem0.railway.internal:8000"
```

---

### Task 8: Retirar el servicio mem0 anterior de Railway

> **Nota**: Hacer este task SOLO después de verificar que el nuevo mem0 funciona correctamente.

**Step 1: Identificar el servicio viejo**

El servicio anterior de mem0 era `omnisentinelao-suite-production` en Railway.
URL pública anterior: `https://omnisentinelao-suite-production.up.railway.app`

**Step 2: Verificar que nada apunta al servicio viejo**

Buscar en el código referencias a la URL anterior:
```bash
grep -r "omnisentinelao-suite-production" src/ --include="*.ts"
# Expected: no output (ya fue reemplazado en Task 7)
```

Verificar también en OmniSentinelAO-Suite si aún usa el servicio viejo para logs o debug:
```bash
grep -r "omnisentinelao-suite-production" /c/Users/doc_r/Desktop/RIVAIB-ERP/OmniSentinelAO-Suite/src/ --include="*.ts"
```

**Step 3: Eliminar el servicio viejo en Railway**

En el dashboard de Railway → encontrar el proyecto `OmniSentinelAO-Suite` o donde vive el servicio anterior:
- Ir al servicio `omnisentinelao-suite-production`
- Settings → Danger Zone → Delete Service
- Confirmar la eliminación

**Step 4: Confirmar que nada se rompe**

Esperar 5 minutos y verificar que:
- El War Room sigue funcionando
- Los agentes de Telegram siguen respondiendo
- Los logs de `omni-mem0` en Railway muestran tráfico normal (requests desde `omni-mc`)

---

## Resumen de servicios Railway después de completar el plan

| Servicio | Tipo | URL interna | Puerto |
|----------|------|-------------|--------|
| `omni-mc` | Next.js app | `http://omni-mc.railway.internal:3000` | 3000 |
| `omni-mem0` | FastAPI (mem0) | `http://omni-mem0.railway.internal:8000` | 8000 |
| `omni-qdrant` | Qdrant vector DB | `http://omni-qdrant.railway.internal:6333` | 6333 |

## Variables de entorno por servicio

**omni-mc** (agregar/actualizar):
```
MEM0_BASE_URL=http://omni-mem0.railway.internal:8000
```

**omni-mem0** (nuevas):
```
OPENAI_API_KEY=<key>
QDRANT_HOST=omni-qdrant.railway.internal
QDRANT_PORT=6333
QDRANT_COLLECTION_NAME=memories
HISTORY_DB_PATH=/app/history/history.db
PORT=8000
```

**omni-qdrant** (nueva):
```
QDRANT__SERVICE__HTTP_PORT=6333
```
