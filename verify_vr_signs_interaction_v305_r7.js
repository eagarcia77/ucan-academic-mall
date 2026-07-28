'use strict';

const fs = require('fs');

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Falta ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function requirePattern(text, pattern, message) {
  if (!pattern.test(text)) throw new Error(message);
}

const runtimePath = 'public/js/ucan_v305_vr_signs_interaction_r7.js';
const loaderPath = 'public/js/ucan_v266_keyboard_jump.js';
const packagePath = 'package.json';

const runtime = read(runtimePath);
const loader = read(loaderPath);
const pkg = JSON.parse(read(packagePath));

requirePattern(runtime, /const REVISION = 'R7'/, 'R7 no declara su revisión.');
requirePattern(runtime, /sideOrientation:B\.Mesh\.FRONTSIDE/, 'R7 debe usar FRONTSIDE.');
requirePattern(runtime, /record\.faces\.push\(createFace[\s\S]*record\.faces\.push\(createFace/, 'R7 debe crear dos caras independientes.');
requirePattern(runtime, /record\.texture\.update\(false\)/, 'R7 debe subir la textura del cartel sin inversión Y.');
requirePattern(runtime, /state\.infoTexture\.update\(false\)/, 'R7 debe subir el panel informativo sin inversión Y.');
requirePattern(runtime, /BILLBOARDMODE_NONE/, 'R7 debe desactivar billboard.');
requirePattern(runtime, /mesh\.dispose\?\.\(false, true\)/, 'R7 debe retirar las caras heredadas.');
requirePattern(runtime, /scene\.pickWithRay\(ray, isR7Face/, 'R7 debe seleccionar mediante rayo XR.');
requirePattern(runtime, /\['xr-standard-trigger', 'trigger'\]/, 'R7 debe admitir el gatillo XR.');
requirePattern(runtime, /\['a-button'\].*\['x-button'\]/, 'R7 debe admitir A y X.');
requirePattern(runtime, /\['xr-standard-thumbstick', 'thumbstick'\]/, 'R7 debe admitir presión del joystick.');
requirePattern(runtime, /headGazeRay/, 'R7 debe incluir mirada de respaldo.');
requirePattern(runtime, /\['b-button'\].*\['y-button'\]/, 'R7 debe admitir B y Y para cerrar.');
requirePattern(runtime, /onPointerObservable/, 'R7 debe admitir clic o toque.');
requirePattern(runtime, /__UCAN_VR_SIGNS_V305_R7__/, 'R7 debe exponer auditoría global.');

requirePattern(loader, /ucan_v305_vr_signs_interaction_r7\.js\?build=V305-20260728-VR-UPRIGHT-SIGNS-INTERACTION-R7/, 'El cargador no incluye R7.');
requirePattern(loader, /loadExternalPatioV305[\s\S]*loadVrSignsR7|loadVrSignsR7[\s\S]*loadExternalPatioV305/, 'El cargador no encadena V305 y R7.');

if (!String(pkg.scripts?.check || '').includes(runtimePath)) throw new Error('package.json check no valida R7.');
if (!String(pkg.scripts?.['audit:vr-signs-v305-r7'] || '').includes('verify_vr_signs_interaction_v305_r7.js')) {
  throw new Error('package.json no incluye la auditoría R7.');
}
if (!String(pkg.scripts?.test || '').includes('audit:vr-signs-v305-r7')) throw new Error('npm test no ejecuta la auditoría R7.');

console.log('OK: UCAN V305 R7 corrige orientación e interacción de carteles VR.');
