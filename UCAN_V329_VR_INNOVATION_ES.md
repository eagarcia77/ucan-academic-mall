# UCAN Academic Mall V329 — Virtual Reality Innovation

## Propósito

V329 añade una capa de innovación VR sobre la versión estable V328 sin reescribir la escena principal. El objetivo es mejorar la experiencia en Meta Quest, reducir fricción de navegación y añadir puntos interactivos de orientación para clases virtuales.

## Cambios incorporados

- Preload `auth-compat-v329-vr-innovation.js` que inyecta el overlay en `public/campus.html` sin romper la fuente principal.
- Overlay `public/js/ucan_v329_vr_innovation_overlay.js` con panel de innovación VR.
- Seis puntos interactivos VR:
  - Entrada VR.
  - Ruta a Piso 2.
  - Ruta a Piso 3.
  - Terraza VR.
  - Salas virtuales.
  - Anfiteatro.
- Atajos de Meta Quest y teclado:
  - B/Y o Escape cierran paneles.
  - A/X avanza al siguiente punto interactivo.
- Modo confort VR.
- Calidad adaptativa para proteger rendimiento cuando baja el FPS.
- Recentrado rápido al punto VR activo.
- Auditoría `verify_v329_vr_innovation.js`.

## Validación esperada

Ejecutar:

```bash
npm run check
npm run audit:v329
npm test
```

## Prueba manual en Meta Quest

1. Abrir la aplicación desplegada en Render.
2. Entrar a `/campus.html`.
3. Presionar `Limpiar cache` del navegador si aparece una versión anterior.
4. Entrar en VR.
5. Confirmar que aparece el panel `Innovación VR`.
6. Probar `Siguiente punto`.
7. Probar B/Y para cerrar paneles.
8. Verificar que las rutas a escaleras, terraza y salas virtuales no afecten el comportamiento V328.

## Nota operacional

Esta mejora es incremental y conserva la autoridad vertical V328. No cambia el modelo base ni elimina las rutas existentes; añade una capa de asistencia, confort y orientación para Meta Quest.
