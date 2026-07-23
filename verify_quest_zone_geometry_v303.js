'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v303_quest_zone_geometry_cleanup.js', 'utf8');
const auth = fs.readFileSync('auth-compat-v293.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try { new Function(runtime); syntaxValid = true; }
catch (error) { syntaxError = error.message; }

const checks = {
  syntaxValid,
  version:/const VERSION = 'V303'/.test(runtime),
  build:/V303-20260723-QUEST-ZONE-GLASS-REAR-RAILS/.test(runtime),
  boundingBoxes:/function worldBounds/.test(runtime) && /minimumWorld/.test(runtime) && /maximumWorld/.test(runtime),
  zones:/floor2EscalatorFront/.test(runtime) && /floor3RearBottom/.test(runtime) && /rooftopRearTop/.test(runtime),
  parentDetection:/function metadataChain/.test(runtime) && /function nameChain/.test(runtime),
  darkGlass:/function isDarkGlass/.test(runtime) && /darkGlassRemovedGlobally:true/.test(runtime),
  floor2Glass:/floor2EscalatorFrontGlassRemoved:true/.test(runtime) && /floor2-escalator-front-glass/.test(runtime),
  rooftopGlass:/rooftopStairGlassRemoved:true/.test(runtime) && /rooftop-stair-glass/.test(runtime),
  rearRails:/function isCrossRearRailing/.test(runtime) && /floor3RearRailingsRemoved:true/.test(runtime),
  preservesSideRails:/function isSideRailing/.test(runtime) && /rooftopSideRailingsPreserved:true/.test(runtime),
  disablesCollision:/mesh\.checkCollisions = false/.test(runtime),
  disablesPicking:/mesh\.isPickable = false/.test(runtime),
  questOnly:/questOnly:true/.test(runtime) && /desktopGeometryUnchanged:true/.test(runtime),
  restoresDesktop:/function restoreMeshes/.test(runtime),
  periodicScan:/SCAN_INTERVAL_MS = 180/.test(runtime) && /scanAndClean\(false\)/.test(runtime),
  authV303:/QUEST_GEOMETRY_VERSION = 'V303'/.test(auth) && /ucan_v303_quest_zone_geometry_cleanup\.js/.test(auth),
  authStripsV302:/ucan_v302_remove_stair_glass/.test(auth) && /stripLegacyQuestLayers/.test(auth),
  authVersionFlags:/questFloor2EscalatorFrontGlassRemoved = true/.test(auth) && /questFloor3RearRailingsRemoved = true/.test(auth),
  packageCheck:pkg.scripts?.check?.includes('ucan_v303_quest_zone_geometry_cleanup.js'),
  packageAudit:pkg.scripts?.['audit:quest-geometry'] === 'node verify_quest_zone_geometry_v303.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V303', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
