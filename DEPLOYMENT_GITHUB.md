# Publicación de UCAN Academic Mall V265

## 1. Crear el repositorio

Cree en GitHub un repositorio nuevo llamado, por ejemplo, `ucan-academic-mall`. No añada archivos iniciales desde GitHub para evitar conflictos.

## 2. Publicar los archivos

Ejecute `PUBLICAR_GITHUB.bat` y pegue la dirección HTTPS del repositorio nuevo.

## 3. Configurar Codespaces

En GitHub seleccione **Code → Codespaces → Create codespace on main**. El puerto 3000 se abrirá automáticamente.

Configure en **Settings → Codespaces → Secrets**:

```text
ADMIN_INITIAL_USERNAME
ADMIN_INITIAL_PASSWORD
ADMIN_INITIAL_EMAIL
```

## 4. Publicar la imagen Docker

Cree una etiqueta:

```bash
git tag v2.6.5
git push origin v2.6.5
```

GitHub Actions publicará la imagen en GHCR.

## 5. Instalación pública permanente

Despliegue la imagen GHCR en un servicio compatible con Docker. Configure HTTPS y monte almacenamiento persistente en `/app/data`. Para audio entre redes diferentes, añada credenciales TURN.

## Protección de datos

`data/users.json`, `.env`, archivos subidos y contenido generado están excluidos de Git. No publique información de usuarios ni contraseñas.
