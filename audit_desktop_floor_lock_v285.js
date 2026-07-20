const fs = require('fs');

const lock = fs.readFileSync('public/js/ucan_v285_desktop_floor_lock.js', 'utf8');
const main = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v285.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = {
  version:/const VERSION = 'V285'/.test(lock),
  build:/V285-20260720-DESKTOP-FLOOR-LOCK/.test(lock),
  originalCauseStillRecognized:/function clampCameraHeight/.test(main) && /camera\.position\.y = LEVEL\.three \+ PLAYER_HEIGHT \+ rise \* t/.test(main),
  finalRenderPhase:/onBeforeCameraRenderObservable\.add/.test(lock) && /phase:'onBeforeCameraRender'/.test(lock),
  runsAfterLegacyAdjustment:/runsAfterSceneHeightAdjustments:true/.test(lock),
  stableFloorNotUpdatedInsideAisle:/if \(!aisle\)/.test(lock) && /state\.stableFloor = candidate/.test(lock),
  lowerFloorLock:/state\.stableFloor < LEVEL\.three - 0\.1/.test(lock) && /position\.y = expectedY/.test(lock),
  floorOneProtected:/floorOneCenterProtected:true/.test(lock),
  floorTwoProtected:/floorTwoCenterProtected:true/.test(lock),
  sideAisleProtected:/sideAisleProtected:true/.test(lock),
  legitimateRidePreserved:/xrActive\(\) \|\| rideActive\(\)/.test(lock),
  runtimeAudit:/__UCAN_DESKTOP_FLOOR_LOCK_AUDIT__/.test(lock),
  serverV285:/const VERSION = 'V285'/.test(compat) && /FLOOR_LOCK_SCRIPT/.test(compat),
  cacheBusting:/ucan_v285_desktop_floor_lock\.js\?build=/.test(compat),
  endpointFlags:/floorCorrectionPhase = 'onBeforeCameraRender'/.test(compat) && /runsAfterSceneHeightAdjustments = true/.test(compat),
  packageStartsV285:pkg.scripts?.start === 'node -r ./auth-compat-v285.js server.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V285', checks }, null, 2));
if (!ok) process.exit(1);
