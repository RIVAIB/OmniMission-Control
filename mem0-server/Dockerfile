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
