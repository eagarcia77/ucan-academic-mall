# UCAN Academic V310 — Validación visual browser ↔ WebXR

## Propósito

La validación V310 comprueba que el campus presentado en el navegador y el campus presentado dentro de Meta Quest utilicen la misma geometría, materiales, iluminación, ambiente, anuncios, salas, terraza y patio exterior. La cámara y los controles WebXR son las únicas diferencias permitidas.

## Áreas verificadas

La prueba captura 18 vistas canónicas:

1. Piso 1 — Áreas comunes
2. Cafetería
3. Biblioteca
4. Piso 2 — Galería
5. SV-201
6. SV-202
7. SV-203
8. SV-204
9. SV-205
10. Piso 3 — Anfiteatro
11. Terraza — Vista general
12. Terraza — Estado del tiempo
13. Terraza — Mapa celeste
14. Terraza — Calendario astronómico
15. Patio exterior — Norte
16. Patio exterior — Este
17. Patio exterior — Sur
18. Patio exterior — Oeste

## Procedimiento

1. Inicie sesión en UCAN Academic desde Meta Quest Browser.
2. Permanezca fuera de la sesión VR.
3. Abra **Validación visual** en el panel de controles.
4. Seleccione **1. Capturar browser**.
5. Espere hasta que las 18 áreas indiquen que la referencia está lista.
6. Cierre el panel y seleccione **Entrar en VR**.
7. La captura WebXR comenzará automáticamente cuando Babylon confirme el estado `IN_XR`.
8. No cierre la pestaña ni salga de VR mientras aparece el progreso en el estado del campus.
9. Al concluir, salga de VR. El panel de resultados se abrirá automáticamente.
10. Revise cada área con el botón **Comparar**.

## Criterios

- **Correcto:** diferencia de píxeles de 0 % a 3 %, firma estructural igual y variación de mallas menor de 1.5 %.
- **Advertencia:** diferencia de píxeles mayor de 3 % y hasta 7 %, o variación menor de geometría que requiere revisión.
- **Fallo:** diferencia mayor de 7 %, firma estructural distinta, cambio de materiales, geometría ausente o variación de mallas mayor de 4 %.

Las animaciones ambientales, el movimiento de avatares y el contenido que cambia con la hora pueden producir variaciones pequeñas. Una firma estructural distinta debe investigarse aunque la captura se vea parecida.

## Comprobaciones adicionales

El reporte también verifica:

- anuncios visibles sin escalas o texturas invertidas;
- cuatro caras corregidas para los dos anuncios institucionales del piso 1;
- patio tropical ubicado fuera de la huella del edificio;
- paridad estricta V309 activa y sin desviaciones actuales;
- presencia compartida entre browser y Meta Quest;
- interacción cruzada V308;
- puente de audio V306.

## Reportes

Los resultados se guardan en el disco persistente de Render dentro de `data/visual-validation-v310`. Cada reporte incluye:

- resumen general;
- resultados de las 18 áreas;
- imágenes browser y WebXR;
- diferencia porcentual;
- cantidad de mallas visibles;
- firmas estructurales;
- diagnóstico de anuncios, patio, avatares, interacción y audio.

Rutas disponibles:

```text
GET  /api/visual-validation-v310/config
POST /api/visual-validation-v310/report
GET  /api/visual-validation-v310/reports
GET  /api/visual-validation-v310/report/{id}
GET  /api/visual-validation-v310/image/{id}/{archivo.png}
```

Los reportes y sus capturas requieren una sesión autenticada. Un usuario regular solamente puede abrir sus propios reportes; un administrador puede revisar todos.

## Diagnóstico en consola

```javascript
window.__UCAN_VISUAL_VALIDATION_V310__.getState()
```

Resultado esperado después de completar ambas fases:

```javascript
{
  installed: true,
  inXR: false,
  running: false,
  browserBaselineReady: true,
  vrComparisonReady: true,
  areas: 18,
  captures: 36,
  summary: {
    overallStatus: "pass",
    totalAreas: 18,
    pass: 18,
    warning: 0,
    fail: 0
  },
  lastError: null
}
```

Protección de rendimiento:

```javascript
window.__UCAN_VISUAL_VALIDATION_GUARD_V310__.getState()
```

Debe indicar `manualRenderOnly: true`. El render auxiliar no debe permanecer en `scene.customRenderTargets` ni ejecutarse durante cada cuadro normal del campus.

## Auditoría del repositorio

```bash
node verify_visual_validation_v310.js
```

La acción de GitHub **Visual Validation V310** ejecuta automáticamente comprobaciones de sintaxis y enlace cuando se modifican los archivos de esta función.
