'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v304_seasonal_natural_ecosystem.js', 'utf8');
const auth = fs.readFileSync('auth-compat-v293.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try { new Function(runtime); syntaxValid = true; }
catch (error) { syntaxError = error.message; }

const checks = {
  syntaxValid,
  version:/const VERSION = 'V304'/.test(runtime),
  build:/V304-20260723-SEASONAL-NATURAL-ECOSYSTEM-PR/.test(runtime),
  puertoRicoTimezone:/America\/Puerto_Rico/.test(runtime),
  fourSeasons:/Primavera/.test(runtime) && /Verano/.test(runtime) && /Otoño/.test(runtime) && /Invierno/.test(runtime),
  astronomicalBoundaries:/md >= 320/.test(runtime) && /md >= 621/.test(runtime) && /md >= 922/.test(runtime),
  puertoRicoEvents:/Día de la Bandera, Himno y Escudo de Puerto Rico/.test(runtime) && /Día de la Constitución de Puerto Rico/.test(runtime) && /Natalicio de José Celso Barbosa/.test(runtime),
  ecosystemGeometry:/function createTree/.test(runtime) && /function createPalm/.test(runtime) && /function createBush/.test(runtime) && /function createRock/.test(runtime),
  tropicalWildlife:/function createButterfly/.test(runtime) && /flor flamboyán/.test(runtime),
  lighting:/function createGardenLight/.test(runtime),
  puertoRicoFlags:/function createPuertoRicoFlag/.test(runtime) && /puertoRicoFlagsDateAware:true/.test(runtime),
  pickableBoards:/livePanel:true/.test(runtime) && /readableSign:true/.test(runtime) && /seasonalSignsPickable:true/.test(runtime),
  universalWindow:/openPanelByMesh/.test(runtime) && /universalWindowIntegration:true/.test(runtime),
  questOptimization:/questOptimized:state\.questMode/.test(runtime) && /state\.questMode \? 2 : 6/.test(runtime),
  dailyRefresh:/setInterval/.test(runtime) && /60000/.test(runtime) && /dailyAutomaticRefresh:true/.test(runtime),
  audit:/__UCAN_SEASONAL_ECOSYSTEM_V304__/.test(runtime),
  authV304:/ENVIRONMENT_VERSION = 'V304'/.test(auth) && /ucan_v304_seasonal_natural_ecosystem\.js/.test(auth),
  authAfterMain:/mainTag, `\$\{mainTag\}\\n  \$\{ecosystemTag\}`/.test(auth),
  authHeaders:/X-UCAN-Environment/.test(auth) && /X-UCAN-Seasons/.test(auth) && /X-UCAN-Celebrations-PR/.test(auth),
  authVersionFlags:/seasonalEcosystemEnabled = true/.test(auth) && /seasonalPuertoRicoCelebrationCalendar = true/.test(auth),
  packageCheck:pkg.scripts?.check?.includes('ucan_v304_seasonal_natural_ecosystem.js'),
  packageAudit:pkg.scripts?.['audit:seasonal-ecosystem'] === 'node verify_seasonal_ecosystem_v304.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V304', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
