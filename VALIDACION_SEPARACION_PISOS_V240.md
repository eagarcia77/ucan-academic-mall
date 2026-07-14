# Validación V264 — separación visual entre pisos

## Correcciones

- Se eliminó el hueco obsoleto ubicado en coordenadas positivas del piso 2.
- El hueco del piso 2 quedó limitado al núcleo actual de escaleras entre los pisos 1 y 2.
- El hueco del piso 3 quedó alineado con el núcleo actual de escaleras situado a la izquierda.
- Se añadieron plafones opacos entre los niveles.
- Se añadieron faldones laterales de privacidad alrededor de los huecos de escaleras.
- Se conserva el búfer de profundidad entre los grupos de renderizado para impedir que logos, pantallas o rótulos del nivel inferior aparezcan sobre la losa superior.

## Resultado esperado

Desde los pisos 2 y 3 no deben verse los objetos del piso inferior. Solamente debe visualizarse el recorrido de las escaleras a través de sus huecos necesarios.

## Diagnóstico

En la consola del navegador puede consultarse:

```javascript
window.__UCAN_FLOOR_SEPARATION__
```

El campo `lowerFloorsOccluded` debe aparecer como `true`.
