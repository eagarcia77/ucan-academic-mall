'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v290_quest_controls_interaction.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v287.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(runtime);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const unifiedIndex = compat.indexOf('ucan_v290_quest_controls_interaction.js');
const questIndex = compat.indexOf('ucan_v289_quest_xr_compat.js');
const mainIndex = compat.indexOf('ucan_babylon_mall_v265_accounts_avatars.js');

const checks = {
  syntaxValid,
  version:/const VERSION = 'V290'/.test(runtime),
  build:/V290-20260720-QUEST-CONTROLS-STAIRS-INFO/.test(runtime),
  nativeThumbstickComponents:/getComponentOfType\?\.\('thumbstick'\)/.test(runtime) || /findComponent\(motionController, 'thumbstick'/.test(runtime),
  triggerComponents:/findComponent\(motionController, 'trigger'/.test(runtime),
  gamepadFallback:/gamepad-\$\{offset\}-\$\{offset \+ 1\}/.test(runtime),
  leftStickMovement:/const left = handRecord\(state, 'left'\)/.test(runtime) && /MOVE_SPEED/.test(runtime),
  rightStickSnapTurn:/const right = handRecord\(state, 'right'\)/.test(runtime) && /SNAP_ANGLE = Math\.PI \/ 6/.test(runtime),
  collisionSliding:/function moveWithSlide/.test(runtime) && /xStep/.test(runtime) && /zStep/.test(runtime),
  triggerRaySelection:/function selectFromController/.test(runtime) && /pickWithRay/.test(runtime),
  visibleControllerRays:/CreateLines\(`rayo control/.test(runtime),
  celestialInformation:/function celestialInfo/.test(runtime) && /__UCAN_INTERACTIVE_SKY__/.test(runtime),
  readableSigns:/function readableSignInfo/.test(runtime) && /readableSign/.test(runtime),
  compactXrInfo:/Ventana información XR V290/.test(runtime) && /ucanInfoCloseV290/.test(runtime),
  rooftopUpRoute:/id:'up34'[\s\S]*radiusX:7\.2[\s\S]*radiusZ:8\.0/.test(runtime),
  rooftopDownRoute:/id:'down43'[\s\S]*radiusX:7\.2[\s\S]*radiusZ:8\.0/.test(runtime),
  routeMarkers:/function createRouteMarker/.test(runtime) && /Gatillo para activar/.test(runtime),
  routeUpdatesFloor:/setStableFloor\(route\.toFloor, `xr-route:\$\{route\.id\}`\)/.test(runtime),
  automaticRoutes:/function routeEntry/.test(runtime) && /beginRoute\(state, route, 'zona-ampliada'\)/.test(runtime),
  oldRuntimeNotServed:!(/const UNIFIED_XR_SCRIPT = `\/js\/ucan_v283_unified_xr_runtime/.test(compat)),
  v290Served:/UNIFIED_XR_SCRIPT = `\/js\/ucan_v290_quest_controls_interaction/.test(compat),
  v290BeforeV289:unifiedIndex >= 0 && questIndex > unifiedIndex,
  bothBeforeMain:mainIndex >= 0,
  endpointFlags:/questControlsVersion = 'V290'/.test(compat) && /questLeftStickMovement = true/.test(compat) && /questTriggerRaySelection = true/.test(compat),
  packageChecksRuntime:pkg.scripts?.check?.includes('public/js/ucan_v290_quest_controls_interaction.js'),
  packageUnifiedAudit:pkg.scripts?.['audit:unified-xr'] === 'node audit_unified_xr_v290.js',
  packageStairAudit:pkg.scripts?.['audit:xr-floor-stairs'] === 'node audit_unified_xr_v290.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V290', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
