# Validación V264 — menús de la cafetería

- Tres carteles de menú.
- Dos caras físicas por cartel: seis caras en total.
- Cada cara usa `BABYLON.Mesh.FRONTSIDE`.
- `backFaceCulling` está activado.
- No se utiliza `DOUBLESIDE` para los menús.
- Auditoría en `window.__UCAN_CAFETERIA_MENU_AUDIT__`.
- Resultado esperado: `frontAndBackReadable: true` y `mirroredFaces: 0`.
