# Validación de logos V264

- Los logos se cargan mediante `BABYLON.DynamicTexture`.
- La imagen se dibuja en un lienzo con orientación vertical explícita.
- No se utiliza `invertY`, `vScale=-1` ni rotación en Z.
- Cada exhibidor tiene un plano frontal y otro posterior independientes.
- La auditoría de ejecución está disponible en `window.__UCAN_BRAND_AUDIT__`.
- El valor `upright` debe ser `true`.
