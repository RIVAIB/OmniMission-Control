FROM node:22-slim

# git es requerido por npm para instalar paquetes con dependencias git
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

# Redirigir SSH de GitHub a HTTPS (necesario para deps como libsignal-node de Baileys)
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
 && git config --global url."https://github.com/".insteadOf "git@github.com:"

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
