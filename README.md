# UCAN Academic Mall V304 R6

Campus virtual tridimensional desarrollado para UCAN, con tres niveles académicos, terraza astronómica, salas interactivas, pizarras electrónicas, experiencias WebXR, administración institucional, cuentas de usuario y avatares personalizables.

**Aplicación publicada:** https://ucan-academic-mall.onrender.com

## Estado de la versión

La revisión **V304 R6** incorpora la corrección final de orientación de carteles y la interacción con los elementos informativos de la terraza en navegador, dispositivos móviles y Meta Quest.

### Cambios principales de V304 R6

- Carteles legibles y verticales en escritorio, móvil, VR y MR.
- Dos caras frontales independientes por cartel para evitar texto reflejado o invertido.
- Desactivación de las caras heredadas que podían ser reactivadas por R4 o R5.
- Guardia de mantenimiento para impedir que las versiones visuales anteriores vuelvan a mostrar carteles incorrectos.
- Selección de carteles, planetas, estrellas y otros objetos celestes mediante:
  - gatillo del control;
  - botón **A** o **X**;
  - presión del joystick;
  - rayo del control;
  - mirada como mecanismo alterno.
- Panel informativo propio dentro de la experiencia XR.
- Botones **B** o **Y** para cerrar la información en Meta Quest.
- Conservación de las mejoras de cristales, barandas, escaleras, pisos y navegación implementadas en revisiones anteriores.

## Funciones principales

- Registro e inicio de sesión.
- Roles `admin` y `user`.
- Administración de cuentas: activar, desactivar, cambiar rol y generar contraseña temporal.
- Contraseñas derivadas con `scrypt` y sesiones mediante cookies seguras.
- Avatar procedural personalizable:
  - tono de piel;
  - estilo y color de cabello;
  - ropa superior e inferior;
  - color y tipo de zapatos;
  - hasta tres accesorios.
- Vista en primera o tercera persona.
- Presencia compartida entre participantes conectados.
- Navegación por tres pisos y terraza.
- Salas académicas, pantallas, recursos institucionales y contenido multimedia.
- Terraza astronómica con objetos celestes seleccionables.
- Compatibilidad con escritorio, navegador móvil y Meta Quest.
- Carga y análisis básico de documentos.
- Conversión de presentaciones a PDF e imágenes mediante LibreOffice y Poppler.
- Persistencia de usuarios, catálogo, colaboración y archivos mediante `/app/data`.

## Tecnologías

- Node.js 20
- Babylon.js
- WebXR
- Docker
- Render
- HTML, CSS y JavaScript
- LibreOffice en modo `headless`
- Poppler

## Ejecución local con Docker

1. Clone el repositorio.
2. Copie `.env.example` como `.env`.
3. Cambie obligatoriamente `ADMIN_INITIAL_PASSWORD`.
4. Ejecute:

```bash
docker compose up --build -d
```

Abra:

```text
http://localhost:3011/login
```

Para detener el servicio:

```bash
docker compose down
```

Para reconstruirlo después de una actualización:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Variables de entorno

Configuración mínima recomendada:

```env
REGISTRATION_ENABLED=true
ADMIN_INITIAL_USERNAME=admin
ADMIN_INITIAL_PASSWORD=CAMBIE_ESTA_CONTRASEÑA
ADMIN_INITIAL_EMAIL=correo@dominio.com
LEGACY_ADMIN_PIN_ENABLED=false
APP_BASE_URL=https://su-servicio.onrender.com
```

Configuración opcional para WebRTC:

```env
VOICE_ROOM_LIMIT=12
VOICE_STUN_URL=stun:stun.cloudflare.com:3478
VOICE_TURN_URL=
VOICE_TURN_USERNAME=
VOICE_TURN_CREDENTIAL=
```

No incluya contraseñas, credenciales TURN ni claves privadas en el repositorio.

## Despliegue en Render

Cree o configure un **Web Service** con estos valores:

| Campo | Valor |
|---|---|
| Repository | `eagarcia77/ucan-academic-mall` |
| Branch | `main` |
| Runtime | `Docker` |
| Root Directory | vacío |
| Dockerfile Path | `./Dockerfile` |
| Docker Build Context | `.` |
| Docker Command | vacío |
| Health Check Path | `/healthz` |

El `Dockerfile` inicia la aplicación con:

```text
node -r ./auth-compat-v304-r6.js server.js
```

No añada un **Build Command** ni un **Start Command** manual cuando el servicio utiliza Docker.

### Disco persistente recomendado

En un plan de Render compatible con discos persistentes, configure:

```text
Mount Path: /app/data
Size: 1 GB o más
```

Sin un disco persistente, las cuentas, archivos y configuraciones guardadas localmente pueden perderse durante una reconstrucción o sustitución de la instancia.

### Publicar una actualización

Después de subir cambios a `main`:

1. Entre al servicio en Render.
2. Presione **Manual Deploy**.
3. Seleccione **Clear build cache & deploy**.
4. Espere hasta que el estado cambie a **Live**.
5. Verifique `https://ucan-academic-mall.onrender.com/healthz`.

Un despliegue marcado como **Canceled** no llegó a producción. En ese caso, inicie otro despliegue manual y permita que termine completamente.

## Meta Quest y WebXR

La navegación VR utiliza:

- joystick izquierdo para caminar;
- joystick derecho para girar;
- gatillo para seleccionar;
- botones **A/X** para seleccionar;
- presión del joystick como selección adicional;
- botones **B/Y** para cerrar paneles informativos.

En la terraza, apunte el rayo del control hacia un cartel, planeta, estrella o etiqueta astronómica y active uno de los controles de selección. Si el rayo no intercepta directamente el objeto, la revisión R6 utiliza la mirada como alternativa.

Después de un nuevo despliegue:

1. Cierre completamente la pestaña anterior en Meta Quest Browser.
2. Vuelva a abrir el servicio.
3. Inicie sesión.
4. Entre a `/campus`.
5. Active VR y pruebe los carteles y objetos de la terraza.

## Rutas principales

```text
/login
/register
/campus
/admin
/version
/health
/healthz
/api/auth/options
/api/auth/me
/api/admin/users
/api/presence
/api/catalog
/api/collaboration
/api/upload
/api/render-pptx
/api/astronomy/comets
```

## Verificación y auditorías

Validación completa:

```bash
npm test
```

Validación de sintaxis:

```bash
npm run check
```

Validación específica de carteles e interacción R6:

```bash
npm run audit:visual-interaction-v304-r6
```

Otras auditorías importantes:

```bash
npm run audit:quest-v304-r4
npm run audit:global-v304-r5
npm run audit:quest-xr
npm run audit:universal-signs
npm run audit:floor-sky
npm run audit:celestial-window
```

## Diagnóstico en el navegador

La revisión R6 publica información de auditoría en:

```javascript
window.__UCAN_VISUAL_INTERACTION_V304_R6__
```

Para inspeccionar su estado desde la consola:

```javascript
window.__UCAN_VISUAL_INTERACTION_V304_R6__?.getState?.()
```

También están disponibles, según el subsistema cargado:

```javascript
window.__UCAN_INTERACTIVE_SKY__
window.__UCAN_SKY_AUDIT__
window.__UCAN_QUEST_XR_AUDIT__
window.__UCAN_UNIFIED_XR_AUDIT__
window.__UCAN_UNIVERSAL_SIGN_WINDOW__
```

## Solución de problemas

### Render muestra `Canceled`

El despliegue no terminó. Ejecute **Manual Deploy → Clear build cache & deploy** y espere hasta **Live**.

### Render continúa mostrando una versión anterior

- Confirme que el servicio utiliza la rama `main`.
- Ejecute un despliegue limpiando la caché.
- Revise que el `Dockerfile` utilice `auth-compat-v304-r6.js`.
- Compruebe `/healthz` y `/version`.

### Los carteles continúan invertidos

- Cierre y vuelva a abrir el navegador.
- En Meta Quest, cierre completamente la pestaña anterior.
- Confirme que el despliegue más reciente esté en estado **Live**.
- Desde la consola, revise:

```javascript
window.__UCAN_VISUAL_INTERACTION_V304_R6__?.getState?.()
```

### No abre la información de un planeta en VR

- Apunte directamente al planeta o a su etiqueta.
- Pruebe el gatillo, **A/X** o la presión del joystick.
- Acérquese o ajuste ligeramente la dirección del control.
- Confirme que la auditoría R6 muestre controles conectados y candidatos interactivos.

### Se pierden usuarios o archivos después de desplegar

Configure un disco persistente montado en:

```text
/app/data
```

## Seguridad

- Cambie la contraseña administrativa inicial antes de publicar.
- Mantenga `LEGACY_ADMIN_PIN_ENABLED=false`, salvo que exista una necesidad institucional documentada.
- Use HTTPS en producción.
- No almacene secretos en GitHub.
- Limite el acceso administrativo a personal autorizado.

## Licencia y uso institucional

Proyecto desarrollado para fines académicos, demostrativos e institucionales de UCAN. Antes de reutilizar recursos, marcas, emblemas, documentos o contenido de terceros, verifique los permisos y las políticas institucionales correspondientes.
