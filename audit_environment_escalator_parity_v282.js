const fs = require('fs');

const main = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const xr = fs.readFileSync('public/js/ucan_v277_xr_navigation_recovery.js', 'utf8');
const rooftop = fs.readFileSync('public/js/ucan_v281_quest_visual_rooftop_parity.js', 'utf8');
const parity = fs.readFileSync('public/js/ucan_v282_environment_escalator_parity.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v271.js', 'utf8');

const checks = {
  version: /const VERSION = 'V282'/.test(parity),
  build: /V282-20260720-QUEST-BROWSER-ONE-WAY-ESCALATOR-PARITY/.test(parity) && /V282-20260720-QUEST-BROWSER-ONE-WAY-ESCALATOR-PARITY/.test(compat),
  fourElectricEscalators: /id:'up12'/.test(parity) && /id:'down21'/.test(parity) && /id:'up23'/.test(parity) && /id:'down32'/.test(parity),
  oneWayDirections: /direction:'up'/.test(parity) && /direction:'down'/.test(parity) && /oneWayElectricEscalators:true/.test(parity),
  downCannotAscend: /down21CannotAscend/.test(parity) && /down32CannotAscend/.test(parity) && /downEscalatorsCannotAscend:true/.test(compat),
  upCannotDescend: /up12CannotDescend/.test(parity) && /up23CannotDescend/.test(parity) && /upEscalatorsCannotDescend:true/.test(compat),
  dynamicCollisionGates: /oneWayEscalatorGate:true/.test(parity) && /setGateEnabled/.test(parity) && /checkCollisions = enabled/.test(parity),
  directPositionGuard: /guardWrongWayEntry/.test(parity) && /safeZ\(blocked\)/.test(parity),
  rooftopStairsBidirectional: /rooftopStairsRemainBidirectional:true/.test(parity) && /rooftopStairsBidirectional:true/.test(compat),
  desktopDirectionsExist: /id:'up12'/.test(main) && /id:'down21'/.test(main) && /id:'up23'/.test(main) && /id:'down32'/.test(main),
  sharedNaturalSpeed: /natural:5/.test(xr) && /natural:5\.0/.test(rooftop) && /sharedNaturalSpeed:5\.0/.test(compat),
  sharedComfortSpeed: /comfort:3\.4/.test(xr) && /comfort:3\.4/.test(rooftop) && /sharedComfortSpeed:3\.4/.test(compat),
  sharedSmoothTurn: /right\.x\*1\.9\*dt/.test(xr) && /sharedSmoothTurnSpeed:1\.9/.test(compat),
  runtimeSelfTest: /function runSelfTest\(\)/.test(parity) && /passed:Object\.values\(results\)\.every\(Boolean\)/.test(parity),
  loadedByCampus: /UCAN_ENVIRONMENT_PARITY_SCRIPT/.test(compat) && /ucan_v282_environment_escalator_parity\.js/.test(compat)
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V282', checks }, null, 2));
if (!ok) process.exit(1);
