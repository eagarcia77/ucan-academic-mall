# UCAN Academic Mall V265

Campus virtual tridimensional con tres pisos, terraza astronómica, salas académicas, pizarras electrónicas, audio por sala, cuentas de usuario, administración institucional y avatares personalizables.

## Novedades de V265

- Registro e inicio de sesión.
- Roles `admin` y `user`.
- Administración de cuentas: activar, desactivar, cambiar rol y generar contraseña temporal.
- Contraseñas derivadas con `scrypt` y sesiones mediante cookie segura.
- Avatar procedural personalizable:
  - tono de piel;
  - estilo y color de cabello;
  - ropa superior e inferior;
  - color y tipo de zapatos;
  - hasta tres accesorios.
- Vista en primera o tercera persona.
- Presencia compartida: los usuarios conectados pueden ver los avatares de otros participantes.
- Persistencia en `data/users.json` y en el volumen Docker `./data:/app/data`.

## Ejecutar con Docker

1. Copie `.env.example` como `.env`.
2. Cambie obligatoriamente `ADMIN_INITIAL_PASSWORD`.
3. Ejecute:

```bash
docker compose up --build -d
```

Abra:

```text
http://localhost:3011/login
```

La cuenta administrativa inicial utiliza el usuario definido en `ADMIN_INITIAL_USERNAME`. La contraseña inicial debe cambiarse al entrar.

## Ejecutar en GitHub Codespaces

Esta edición sigue el mismo enfoque de publicación de UCAN Reality Lab:

1. Cree un repositorio nuevo en GitHub.
2. Suba todos los archivos de esta carpeta.
3. Seleccione **Code → Codespaces → Create codespace on main**.
4. El puerto `3000` se iniciará y abrirá automáticamente.
5. En **Settings → Codespaces → Secrets**, configure:

```text
ADMIN_INITIAL_USERNAME
ADMIN_INITIAL_PASSWORD
ADMIN_INITIAL_EMAIL
```

Para audio externo también puede configurar:

```text
VOICE_TURN_URL
VOICE_TURN_USERNAME
VOICE_TURN_CREDENTIAL
```

No incluya contraseñas ni secretos en el repositorio.

## Publicar imagen en GitHub Container Registry

El flujo `.github/workflows/publish-ghcr.yml` publica una imagen al crear una etiqueta:

```bash
git tag v2.6.5
git push origin v2.6.5
```

La imagen quedará en:

```text
ghcr.io/USUARIO/REPOSITORIO:latest
```

Para una instalación pública permanente, despliegue esa imagen en un servicio compatible con contenedores y monte un disco persistente en `/app/data`.

## Endpoints principales

```text
/login
/campus
/admin
/version
/health
/api/auth/options
/api/auth/me
/api/admin/users
/api/presence
```

## Verificación

```bash
npm test
```

En Windows puede ejecutar `ACTUALIZAR_V265.bat` y luego `VERIFICAR_V265.ps1`.
