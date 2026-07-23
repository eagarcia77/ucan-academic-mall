'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v305_ecosystem_visibility_fix.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v305.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const docker = fs.readFileSync('Dockerfile', 'utf8');

let syntaxValid = false;
let syntaxError = null;
try { new Function(runtime); syntaxValid = true; }
catch (error) { syntaxError = error.message; }

const checks = {
  syntaxValid,
  version:/const VERSION = 'V305'/.test(runtime),
  build:/V305-20260723-ECOSYSTEM-VISIBILITY-ENTRY-GARDEN/.test(runtime),
  waitsForBase:/__UCAN_SEASONAL_ECOSYSTEM_V304__\?\.installed === true/.test(runtime),
  baseRootForced:/Ecosistema natural estacional UCAN V304/.test(runtime) && /forceBaseEcosystemVisible/.test(runtime),
  visibleFromLobby:/visibleFromInitialLobby:true/.test(runtime),
  entranceGarden:/function buildEntranceGarden/.test(runtime) && /Plaza natural visible UCAN V305/.test(runtime),
  gardenIslands:/isla jardín visible V305/.test(runtime),
  visibleTrees:/createTree\(-45, 31\.5/.test(runtime) && /createTree\(45, 31\.5/.test(runtime),
  visibleShrubs:/function createShrub/.test(runtime),
  visibleLights:/function createGardenLight/.test(runtime),
  entranceTitle:/Rótulo ecosistema visible desde vestíbulo V305/.test(runtime),
  boardsRelocated:/Cartel estación actual V304/.test(runtime) && /Cartel celebración Puerto Rico V304/.test(runtime),
  boardsUpright:/BILLBOARDMODE_NONE/.test(runtime) && /seasonalBoardsUpright:true/.test(runtime),
  clearOfEscalator:/entranceGardenClearOfCentralEscalator:true/.test(runtime),
  browserAndQuest:/browserAndQuest:true/.test(runtime) && /questDetected/.test(runtime),
  audit:/__UCAN_ECOSYSTEM_VISIBILITY_V305__/.test(runtime),
  compatInjects:/ucan_v305_ecosystem_visibility_fix\.js/.test(compat) && /ucan_v304_seasonal_natural_ecosystem/.test(compat),
  compatVersion:/ecosystemVisibilityVersion = VERSION/.test(compat),
  packageStart:pkg.scripts?.start === 'node -r ./auth-compat-v305.js server.js',
  packageCheck:pkg.scripts?.check?.includes('auth-compat-v305.js') && pkg.scripts?.check?.includes('ucan_v305_ecosystem_visibility_fix.js'),
  packageAudit:pkg.scripts?.['audit:ecosystem-visibility'] === 'node verify_ecosystem_visibility_v305.js',
  dockerPreloader:docker.includes('./auth-compat-v305.js')
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V305', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
