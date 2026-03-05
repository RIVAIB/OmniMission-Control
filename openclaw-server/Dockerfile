FROM node:22-slim

# git es requerido por npm para instalar paquetes con dependencias git
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates && rm -rf /var/lib/apt/lists/*

# Redirigir SSH→HTTPS: escribir en /etc/gitconfig Y /root/.gitconfig para máxima cobertura
RUN printf '[url "https://github.com/"]\n\tinsteadOf = ssh://git@github.com/\n\tinsteadOf = git@github.com:\n' \
    | tee /etc/gitconfig /root/.gitconfig && cat /etc/gitconfig

# Instalar openclaw globalmente.
# GIT_CONFIG_COUNT/KEY/VALUE: pasa la config directamente como env vars al subproceso git
# que npm invoca — funciona independientemente de HOME o archivos de config.
RUN GIT_CONFIG_COUNT=2 \
    GIT_CONFIG_KEY_0="url.https://github.com/.insteadOf" \
    GIT_CONFIG_VALUE_0="ssh://git@github.com/" \
    GIT_CONFIG_KEY_1="url.https://github.com/.insteadOf" \
    GIT_CONFIG_VALUE_1="git@github.com:" \
    HOME=/root npm install -g openclaw@latest

WORKDIR /app

# Copiar config a /app/config — el volume en /data/.openclaw sobreescribiría /data/
# entrypoint.sh los copia al volume en el primer arranque
COPY openclaw.json /app/config/openclaw.json
COPY workspaces/ /app/config/workspaces/

COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

ENV OPENCLAW_HOME=/data/.openclaw
ENV NODE_ENV=production

EXPOSE 18789

CMD ["/app/entrypoint.sh"]
