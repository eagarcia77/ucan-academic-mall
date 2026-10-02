const fs = require('fs');
const path = require('path');

const checks = [
  ['auth-compat-v329-vr-innovation.js', 'ucan_v329_vr_innovation_overlay.js'],
  ['auth-compat-v329-vr-innovation.js', 'fs.promises.stat'],
  ['auth-compat-v329-vr-innovation.js', 'fs.createReadStream'],
  ['public/js/ucan_v329_vr_innovation_overlay.js', 'UCAN_VR_INNOVATION_V329'],
  ['public/js/ucan_v329_vr_innovation_overlay.js', 'QUEST_POINTS'],
  ['public/js/ucan_v329_vr_innovation_overlay.js', 'adaptiveQualityTick'],
  ['public/js/ucan_v329_vr_innovation_overlay.js', 'immersiveHardwareScalingLocked:true'],
  ['public/js/ucan_v329_vr_innovation_overlay.js', 'directXrCameraMovesDisabled:true'],
  ['public/js/ucan_v329_vr_innovation_overlay.js', "authority.teleportTo(point.area,'v329-safe-wayfinding')"],
  ['public/js/ucan_v329_vr_innovation_overlay.js', 'authority?.recalibrate'],
  ['public/js/ucan_v329_vr_innovation_overlay.js', 'state.xrScaleLocked=true'],
  ['public/js/ucan_v329_vr_innovation_overlay.js', 'B/Y/Escape'],
  ['public/js/ucan_v329_vr_innovation_overlay.js', 'Modo confort']
];

const failures = [];
for (const [file, token] of checks) {
  const full = path.join(__dirname, file);
  if (!fs.existsSync(full)) { failures.push(`${file} no existe`); continue; }
  const text = fs.readFileSync(full, 'utf8');
  if (!text.includes(token)) failures.push(`${file} no contiene ${token}`);
  try { if (file.endsWith('.js')) new Function(text); } catch (error) { failures.push(`${file} sintaxis: ${error.message}`); }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const docker = fs.readFileSync(path.join(__dirname, 'Dockerfile'), 'utf8');
if (!packageJson.scripts.start.includes('auth-compat-v329-vr-innovation.js')) failures.push('start no precarga V329');
if (!packageJson.scripts.check.includes('ucan_v329_vr_innovation_overlay.js')) failures.push('check no valida overlay V329');
if (!packageJson.scripts.check.includes('auth-compat-v329-vr-innovation.js')) failures.push('check no valida preload V329');
if (!/CMD \["npm", "start"\]/.test(docker)) failures.push('Docker no usa npm start');
if (!/^FROM node:24-bookworm-slim/m.test(docker)) failures.push('Docker no usa Node 24');

if (failures.length) {
  console.error('UCAN V329 VR innovation audit failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('UCAN V330 VR innovation compatibility audit passed.');
