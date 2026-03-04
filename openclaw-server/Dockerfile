FROM node:22-slim

# Instalar openclaw globalmente
RUN npm install -g openclaw@latest

# Crear directorio de configuración de openclaw
RUN mkdir -p /data/.openclaw

WORKDIR /app

# Copiar configuración y workspaces
COPY openclaw.json /data/.openclaw/openclaw.json
COPY workspaces/ /data/.openclaw/workspaces/

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV OPENCLAW_HOME=/data/.openclaw
ENV NODE_ENV=production

EXPOSE 18789

CMD ["/app/entrypoint.sh"]
