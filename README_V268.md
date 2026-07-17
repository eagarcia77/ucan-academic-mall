# UCAN Academic Mall V268 — Meta Quest

## Controles en Meta Quest
- Joystick izquierdo: caminar y desplazarse lateralmente.
- Joystick derecho: girar.
- Las escaleras entre pisos y hacia la terraza ajustan la altura automáticamente.
- Los pasillos inclinados del anfiteatro también ajustan la altura.

## Verificación
Abra la consola del navegador o la depuración remota y consulte:

```javascript
window.__UCAN_QUEST_XR_AUDIT__
```

Debe indicar `installed: true`, `movementFeatureEnabled: true` y `smoothStairHeight: true`.
