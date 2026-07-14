const fs = require('fs');
const path = require('path');

const root = __dirname;
const jsPath = path.join(root, 'public/js/ucan_babylon_mall_v265_accounts_avatars.js');
const htmlPath = path.join(root, 'public/campus.html');
const js = fs.readFileSync(jsPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

const checks = [
  ['JavaScript principal activo', html.includes('/js/ucan_babylon_mall_v265_accounts_avatars.js')],
  ['Hueco correcto entre pisos 1 y 2', js.includes("id:'escaleras-p1-p2', x1:-24.8, x2:-3.2")],
  ['Hueco correcto entre pisos 2 y 3', js.includes("id:'escaleras-p2-p3', x1:-39.8, x2:-20.2")],
  ['Hueco obsoleto positivo eliminado', !js.includes('x1: 5.0, x2: 35.5') && !js.includes('x1:5.0, x2:35.5')],
  ['Plafones opacos activos', js.includes('plafón opaco') && js.includes('buildPartitionedSurface')],
  ['Faldones de privacidad activos', js.includes('addOpeningPrivacyFascia')],
  ['Profundidad conservada entre grupos', js.includes('setRenderingAutoClearDepthStencil')],
  ['Auditoría de separación disponible', js.includes('__UCAN_FLOOR_SEPARATION__')]
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK' : 'ERROR'} - ${label}`);
  if (!ok) failed++;
}
if (failed) {
  console.error(`AUDITORÍA DE SEPARACIÓN: ${failed} error(es).`);
  process.exit(1);
}
console.log('AUDITORÍA DE SEPARACIÓN: APROBADA');
