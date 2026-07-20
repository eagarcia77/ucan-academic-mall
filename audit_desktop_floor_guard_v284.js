const fs = require('fs');

const guard = fs.readFileSync('public/js/ucan_v284_desktop_floor_guard.js', 'utf8');
const main = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v284.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const checks = {
  version:/const VERSION = 'V284'/.test(guard),
  build:/V284-20260720-DESKTOP-FLOOR-GUARD/.test(guard),
  originalBugIdentified:/const inCenterAisle = camera\.position\.x/.test(main) && /camera\.position\.y = LEVEL\.three \+ PLAYER_HEIGHT \+ rise \* t/.test(main),
  centerAndSideDetection:/function inTheaterAisle/.test(guard) && /position\.x > -4\.8/.test(guard) && /position\.x > 18\.2/.test(guard),
  requiresStableLowerFloor:/state\.stableFloor < LEVEL\.three - 0\.1/.test(guard),
  restoresCorrectHeight:/position\.y = state\.stableFloor \+ PLAYER_HEIGHT/.test(guard),
  floorOneProtected:/floorOneCenterProtected:true/.test(guard),
  floorTwoProtected:/floorTwoCenterProtected:true/.test(guard),
  ridePreserved:/rideActive\(\)/.test(guard) && /if \(xrActive\(\) \|\| rideActive\(\)\) return/.test(guard),
  xrPreserved:/xrControllerPreserved:'V283'/.test(guard),
  runtimeAudit:/__UCAN_DESKTOP_FLOOR_GUARD_AUDIT__/.test(guard),
  loadedAfterMain:/FLOOR_GUARD_SCRIPT/.test(compat) && /ucan_v284_desktop_floor_guard\.js/.test(compat) && /ucan_v276_interactive_sky\.js/.test(compat),
  serverV284:/V284-20260720-DESKTOP-FLOOR-GUARD/.test(compat),
  cacheBustsV283:/replaceAll\(PREVIOUS_BUILD, BUILD\)/.test(compat),
  serverFlags:/theaterHeightRequiresFloorThree/.test(compat) && /accidentalFloorThreeLiftFixed/.test(compat),
  packageStart:pkg.scripts?.start === 'node -r ./auth-compat-v284.js server.js',
  packageAudit:pkg.scripts?.['audit:desktop-floor-guard'] === 'node audit_desktop_floor_guard_v284.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V284', checks }, null, 2));
if (!ok) process.exit(1);
