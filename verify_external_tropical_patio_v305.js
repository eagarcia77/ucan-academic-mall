'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const runtimePath = path.join(ROOT, 'public/js/ucan_v305_external_tropical_patio_fix.js');
const loaderPath = path.join(ROOT, 'public/js/ucan_v266_keyboard_jump.js');
const packagePath = path.join(ROOT, 'package.json');

const failures = [];
const checks = [];

function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) failures.push(name);
}

function read(file) {
  return fs.readFileSync(file, 'utf8');
}

for (const file of [runtimePath, loaderPath, packagePath]) {
  check(`Existe ${path.relative(ROOT, file)}`, fs.existsSync(file));
}

if (!failures.length) {
  const runtime = read(runtimePath);
  const loader = read(loaderPath);
  const pkg = JSON.parse(read(packagePath));

  check('Sintaxis del runtime V305', (() => {
    try { new Function(runtime); return true; } catch (_) { return false; }
  })());
  check('Huella protegida del edificio', /BUILDING\s*=\s*Object\.freeze\(\{\s*halfX:\s*76,\s*halfZ:\s*60\s*\}\)/.test(runtime));
  check('Anillo exterior seguro', /SAFE_RING\s*=\s*Object\.freeze\(\{\s*halfX:\s*84,\s*halfZ:\s*70\s*\}\)/.test(runtime));
  check('Desplazamiento exterior preserva componentes', /BASE_SHIFT\s*=\s*Object\.freeze\(\{\s*x:\s*18,\s*z:\s*18\s*\}\)/.test(runtime));
  check('Reubica vegetación estacional', /metadata\.ecosystemV304\s*===\s*true/.test(runtime));
  check('Reubica caras corregidas R6', /metadata\.correctedBoardFaceV304R6\s*===\s*true/.test(runtime));
  check('Mantiene mariposas animadas mediante wrapper', /Desplazamiento exterior mariposa V305/.test(runtime) && /pivot\.parent\s*=\s*wrapper/.test(runtime));
  check('Audita invasiones interiores', /remainingViolations/.test(runtime) && /patioOutsideBuilding/.test(runtime));
  check('Expone API V305', /window\.__UCAN_TROPICAL_PATIO_V305__/.test(runtime));
  check('Loader incluye runtime V305', /ucan_v305_external_tropical_patio_fix\.js/.test(loader));
  check('V305 carga después de la guardia R6', /runtime\.addEventListener\('load',\s*loadExternalPatioV305\)/.test(loader));
  check('Package valida runtime V305', String(pkg.scripts?.check || '').includes('node --check public/js/ucan_v305_external_tropical_patio_fix.js'));
  check('Package expone auditoría V305', pkg.scripts?.['audit:external-patio-v305'] === 'node verify_external_tropical_patio_v305.js');
}

for (const item of checks) {
  console.log(`${item.ok ? '✓' : '✗'} ${item.name}`);
}

if (failures.length) {
  console.error(`\nFallaron ${failures.length} verificaciones de V305.`);
  process.exit(1);
}

console.log('\nPatio tropical V305 validado fuera de la huella del edificio.');
