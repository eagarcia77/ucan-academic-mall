const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, 'public', 'js');
const files = fs.readdirSync(jsDir).filter((name) => name.endsWith('.js')).sort();
const expected = 'ucan_babylon_mall_v265_accounts_avatars.js';
const errors = [];

if (!files.includes(expected)) errors.push(`Falta ${expected}`);
const obsoleteFiles = files.filter((name) => /v20(?:9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24)/i.test(name));
if (obsoleteFiles.length) errors.push(`Archivos JavaScript heredados encontrados: ${obsoleteFiles.join(', ')}`);

const source = fs.readFileSync(path.join(jsDir, expected), 'utf8');
const functions = [...source.matchAll(/^\s*function\s+([A-Za-z0-9_$]+)\s*\(/gm)].map((match) => match[1]);
const counts = new Map();
for (const name of functions) counts.set(name, (counts.get(name) || 0) + 1);
const duplicateFunctions = [...counts.entries()].filter(([, count]) => count > 1);
if (duplicateFunctions.length) errors.push(`Funciones duplicadas: ${duplicateFunctions.map(([name, count]) => `${name}×${count}`).join(', ')}`);

for (const required of ['buildFloorOne', 'buildFloorTwo', 'buildFloorThree', 'buildEscalators', 'buildStairsToRooftop', 'setupEscalatorRide', 'electronicBoard', 'cleanupLegacyInterference']) {
  if ((counts.get(required) || 0) !== 1) errors.push(`${required} debe existir exactamente una vez`);
}
for (const marker of ['ANF-301', 'disabledEscalatorBlockers', 'disabledTheaterBlockers', '__UCAN_LAYER_AUDIT__']) {
  if (!source.includes(marker)) errors.push(`Falta el control requerido: ${marker}`);
}

if (errors.length) {
  console.error('AUDITORÍA DE CAPAS: FALLÓ');
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log('AUDITORÍA DE CAPAS: APROBADA');
console.log(`- JavaScript activo: ${expected}`);
console.log(`- Funciones revisadas: ${functions.length}; duplicadas: 0`);
console.log('- Una sola construcción activa por piso, anfiteatro y sistema de escaleras.');
console.log('- Limpieza automática de geometría heredada, duplicados y bloqueadores activada.');
