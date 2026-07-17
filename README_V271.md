# UCAN Academic Mall V271

Corrección específica para Meta Quest y navegación multinivel.

- El entorno WebXR conserva la misma escena, iluminación, niebla, cielo, objetos visibles, luces, capas de cámara y distancia de recorte que la vista de computadora.
- La captura visual se realiza antes de que WebXR sustituya la cámara de escritorio.
- La configuración se replica en las cámaras estereoscópicas izquierda y derecha.
- El corredor central del anfiteatro solo modifica la altura cuando el usuario ya está en el piso 3.
- Los cambios de piso únicamente se completan dentro de una escalera compatible con el piso de origen.
- Se eliminó la inferencia de piso basada en fluctuaciones de altura del visor.
