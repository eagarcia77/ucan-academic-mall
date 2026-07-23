'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v303_quest_zone_geometry_cleanup_r2.js', 'utf8');
const auth = fs.readFileSync('auth-compat-v293.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try { new Function(runtime); syntaxValid = true; }
catch (error) { syntaxError = error.message; }

const checks = {
  syntaxValid,
  version:/const VERSION = 'V303'/.test(runtime),
  revision:/const REVISION = 'R2'/.test(runtime),
  build:/V303-20260723-QUEST-ZONE-GLASS-REAR-RAILS-R2/.test(runtime),
  boundingBoxes:/function worldBounds/.test(runtime) && /minimumWorld/.test(runtime) && /maximumWorld/.test(runtime),
  expandedFloor2Zone:/minX:-43\.0/.test(runtime) && /maxX:2\.0/.test(runtime) && /minZ:4\.5/.test(runtime) && /maxZ:43\.5/.test(runtime),
  allEscalatorRoutes:/FLOOR2_ESCALATOR_ROUTE_X = Object\.freeze\(\[-34, -26, -20, -8\]\)/.test(runtime) && /floor2EscalatorAllRoutesCovered/.test(runtime),
  zones:/floor2EscalatorFront/.test(runtime) && /floor3RearBottom/.test(runtime) && /rooftopRearTop/.test(runtime),
  parentDetection:/function metadataChain/.test(runtime) && /function nameChain/.test(runtime),
  darkGlass:/function isDarkGlass/.test(runtime) && /darkGlassRemovedGlobally:true/.test(runtime),
  floor2Glass:/floor2EscalatorFrontGlassRemoved:true/.test(runtime) && /floor2-escalator-front-glass/.test(runtime),
  rooftopGlass:/rooftopStairGlassRemoved:true/.test(runtime) && /rooftop-stair-glass/.test(runtime),
  rearRails:/function rearRailingZone/.test(runtime) && /rearRailingsRemovedWithoutOrientationDependency:true/.test(runtime) && /floor3RearRailingsRemoved:true/.test(runtime),
  preservesCorrectedMetal:/function isProtectedCorrectedMetal/.test(runtime) && /correctedMetalSideRailingsPreserved:true/.test(runtime),
  disablesCollision:/mesh\.checkCollisions = false/.test(runtime),
  disablesPicking:/mesh\.isPickable = false/.test(runtime),
  questOnly:/questOnly:true/.test(runtime) && /desktopGeometryUnchanged:true/.test(runtime),
  restoresDesktop:/function restoreMeshes/.test(runtime),
  periodicScan:/SCAN_INTERVAL_MS = 120/.test(runtime) && /scanAndClean\(false\)/.test(runtime),
  authV303R2:/QUEST_GEOMETRY_VERSION = 'V303'/.test(auth) && /QUEST_GEOMETRY_REVISION = 'R2'/.test(auth) && /ucan_v303_quest_zone_geometry_cleanup_r2\.js/.test(auth),
  authStripsOldLayers:/ucan_v302_remove_stair_glass/.test(auth) && /ucan_v303_quest_zone_geometry_cleanup/.test(auth) && /stripLegacyQuestLayers/.test(auth),
  authVersionFlags:/questFloor2EscalatorAllRoutesCovered = true/.test(auth) && /questRearRailingsRemovedWithoutOrientationDependency = true/.test(auth),
  packageCheck:pkg.scripts?.check?.includes('ucan_v303_quest_zone_geometry_cleanup_r2.js'),
  packageAudit:pkg.scripts?.['audit:quest-geometry'] === 'node verify_quest_zone_geometry_v303.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V303', revision:'R2', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
