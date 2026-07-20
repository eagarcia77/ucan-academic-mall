FROM node:20-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-impress libreoffice-core libreoffice-common poppler-utils fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/data /app/generated /tmp/ucan-home \
    && chown -R node:node /app /tmp/ucan-home
COPY --chown=node:node . .
USER node
ENV HOME=/tmp/ucan-home
EXPOSE 3000
CMD ["node", "-r", "./auth-compat-v287.js", "server.js"]
