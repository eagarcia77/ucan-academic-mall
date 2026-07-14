# Seguridad de UCAN Academic Mall

- Las contraseñas se derivan mediante `crypto.scrypt` con una sal individual por cuenta.
- La sesión usa una cookie `HttpOnly`, `SameSite=Lax` y `Secure` cuando el servicio se ejecuta mediante HTTPS.
- El administrador inicial debe cambiar su contraseña en el primer acceso.
- Antes de publicar, copie `.env.example` como `.env` y cambie `ADMIN_INITIAL_PASSWORD`.
- Nunca suba `.env`, contraseñas, credenciales TURN ni secretos institucionales a GitHub.
- El volumen `/app/data` debe ser persistente para conservar usuarios, perfiles, avatares y contenido.
- Para un despliegue público, utilice HTTPS y configure un servidor TURN para el audio WebRTC.
