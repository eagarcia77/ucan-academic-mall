# Validación física V328 en Meta Quest

Este protocolo es la autoridad final para aprobar el recorrido entre pisos en un dispositivo Meta Quest. Las pruebas automáticas validan el código y el despliegue, pero no sustituyen esta comprobación física.

## Preparación

- Aplicación: <https://ucan-academic-mall.onrender.com>
- Versión requerida: `V328`
- Revisión requerida: `R38`
- Dispositivo: Meta Quest con Meta Quest Browser actualizado
- Seguridad: complete la prueba sentado o dentro de un límite Guardian despejado

Antes de entrar en VR, abra `/version` y confirme:

- `version: V328`
- `revision: R38`
- `singleFinalVerticalAuthority: true`
- `automaticStairsWithoutJoystick: true`
- `exactFloorLanding: true`
- `desktopEyeHeightParity: true`

Después, cierre completamente cualquier pestaña anterior, abra nuevamente la aplicación, inicie sesión y entre al campus.

## Prueba prioritaria P1 → P2

1. Active VR y permanezca inmóvil durante tres segundos para completar la calibración de altura.
2. Ubíquese en P1 frente a la escalera de subida `up12`.
3. Verifique que estar cerca sin entrar en la ruta no active el transporte.
4. Avance hasta la entrada de la escalera y suelte el joystick.
5. Confirme que el transporte continúa automáticamente hasta P2.
6. Durante el recorrido, confirme que la cámara no salta, tiembla ni atraviesa la escalera.
7. Al llegar, confirme que queda completamente sobre el descanso de P2 y puede caminar inmediatamente.
8. Permanezca diez segundos en P2 y confirme que no baja, flota ni queda entre pisos.

Si resulta difícil alinearse con la entrada, use **Subir piso (asistido)** o **Bajar piso (asistido)**. Estos controles colocan al usuario en la ruta correcta y completan el mismo transporte automático.

Resultado esperado: un solo recorrido automático, aterrizaje exacto en P2, altura visual estable y libertad inmediata para continuar caminando.

## Recorrido inverso P2 → P1

Repita el procedimiento en la escalera `down21`. La escalera de bajada debe transportar únicamente hacia P1 y dejar al usuario completamente sobre su descanso.

## Rutas restantes

Tras aprobar P1 ↔ P2, pruebe en este orden:

- `up23`: P2 → P3
- `down32`: P3 → P2
- `up34`: P3 → terraza
- `down34`: terraza → P3

Cada ruta debe iniciar una sola vez, moverse sin joystick vertical, aterrizar exactamente y permitir continuar caminando.

## Registro del resultado

| Comprobación | Aprobó | Falló | Observación |
|---|:---:|:---:|---|
| `/version` muestra V328/R38 | ☐ | ☐ | |
| Día y noche coinciden en browser y Meta Quest | ☐ | ☐ | |
| Altura inicial coincide con desktop | ☐ | ☐ | |
| `up12` inicia solo al entrar | ☐ | ☐ | |
| P1 → P2 continúa sin joystick | ☐ | ☐ | |
| Aterrizaje completo y estable en P2 | ☐ | ☐ | |
| P2 permanece estable por 10 segundos | ☐ | ☐ | |
| P2 → P1 funciona en `down21` | ☐ | ☐ | |
| P2 ↔ P3 funciona | ☐ | ☐ | |
| P3 ↔ terraza funciona | ☐ | ☐ | |
| No hay saltos, vibración ni posiciones entre pisos | ☐ | ☐ | |

Anote también el modelo de Quest, la versión de Meta Quest Browser, la fecha y cualquier ruta que falle.

## Criterio de aprobación

V328 aprueba físicamente solamente si todas las filas quedan marcadas en **Aprobó**. Una falla en P1 → P2, aterrizaje, altura o estabilidad mantiene la validación física en estado **pendiente/fallida**, aunque GitHub Actions esté en verde.

Si el nivel queda incorrecto, utilice **Reparar nivel XR**. Si la altura visual no coincide con desktop, utilice **Calibrar altura VR** y repita la ruta afectada; documente que fue necesaria la corrección.
