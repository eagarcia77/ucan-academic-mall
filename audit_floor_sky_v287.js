'use strict';

const fs = require('fs');
const { VERSION, BUILD, patchMainScene } = require('./lib/floor-state-machine-v287');

const mainSource = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const skySource = fs.readFileSync('public/js/ucan_v287_rooftop_sky.js', 'utf8');
const compatSource = fs.readFileSync('auth-compat-v287.js', 'utf8');
const layeredCompatSource = fs.readFileSync('auth-compat-v293.js', 'utf8');
const visibilityCompatSource = fs.readFileSync('auth-compat-v305.js', 'utf8');
const exteriorCompatSource = fs.readFileSync('auth-compat-v306.js', 'utf8');
const dockerfileSource = fs.readFileSync('Dockerfile', 'utf8');
const codespaceStartSource = fs.readFileSync('.devcontainer/start-codespace.sh', 'utf8');
const devcontainer = JSON.parse(fs.readFileSync('.devcontainer/devcontainer.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let mainSyntaxValid = false;
let skySyntaxValid = false;
let patchError = null;
let result = { code:'', patched:false, checks:null };

try {
  result = patchMainScene(mainSource);
  new Function(result.code);
  mainSyntaxValid = true;
} catch (error) {
  patchError = error.message;
}

try {
  new Function(skySource);
  skySyntaxValid = true;
} catch (error) {
  patchError = patchError || error.message;
}

const v293PreservesV287 = /require\('\.\/auth-compat-v287\.js'\)/.test(layeredCompatSource);
const v305PreservesV293 = /require\('\.\/auth-compat-v293\.js'\)/.test(visibilityCompatSource);
const v306PreservesV305 = /require\('\.\/auth-compat-v305\.js'\)/.test(exteriorCompatSource);
const startsDirectV287 = pkg.scripts?.start === 'node -r ./auth-compat-v287.js server.js';
const startsLayeredV293 = pkg.scripts?.start === 'node -r ./auth-compat-v293.js server.js' && v293PreservesV287;
const startsLayeredV305 = pkg.scripts?.start === 'node -r ./auth-compat-v305.js server.js' && v305PreservesV293 && v293PreservesV287;
const startsLayeredV306 = pkg.scripts?.start === 'node -r ./auth-compat-v306.js server.js' && v306PreservesV305 && v305PreservesV293 && v293PreservesV287;
const dockerDirectV287 = /CMD \["node", "-r", "\.\/auth-compat-v287\.js", "server\.js"\]/.test(dockerfileSource);
const dockerLayeredV293 = /CMD \["node", "-r", "\.\/auth-compat-v293\.js", "server\.js"\]/.test(dockerfileSource) && v293PreservesV287;
const dockerLayeredV305 = /CMD \["node", "-r", "\.\/auth-compat-v305\.js", "server\.js"\]/.test(dockerfileSource) && v305PreservesV293 && v293PreservesV287;
const dockerLayeredV306 = /CMD \["node", "-r", "\.\/auth-compat-v306\.js", "server\.js"\]/.test(dockerfileSource) && v306PreservesV305 && v305PreservesV293 && v293PreservesV287;

const checks = {
  version:VERSION === 'V287',
  build:BUILD === 'V287-20260720-FLOOR-STATE-SKY-OPT',
  patchApplied:result.patched === true,
  transformChecksPassed:result.checks?.all === true,
  mainSyntaxValid,
  explicitFloorMarker:result.code.includes('__UCAN_FLOOR_STATE_V287__'),
  explicitStateVariable:result.code.includes('let ucanStableFloorV287 = LEVEL.one;'),
  noTransientFloorInference:result.code.includes('inferredFromTransientHeight:false') && !result.code.includes('const floors=[LEVEL.one+PLAYER_HEIGHT,LEVEL.two+PLAYER_HEIGHT,LEVEL.three+PLAYER_HEIGHT,LEVEL.rooftop+PLAYER_HEIGHT]'),
  hardFloorLock:result.code.includes('camera.position.y = expectedY;'),
  theaterRequiresExplicitFloorThree:result.code.includes('ucanStableFloorV287 === LEVEL.three && (inCenterAisle || inSideAisle)'),
  routeUpdatesState:result.code.includes('setStableFloorFromEyeYV287(camera.position.y, `route:${zone.id}`)'),
  navigationUpdatesState:result.code.includes('setStableFloorFromEyeYV287(destinationPosition.y, `navigate:${key}`)'),
  resetUpdatesState:result.code.includes("setStableFloorFromEyeYV287(safe.y, 'reset-safe-point')"),
  apiNavigationUpdatesState:result.code.includes('setStableFloorFromEyeYV287(destinationPosition.y, `api:${key}`)'),
  xrSynchronization:result.code.includes("setStableFloorBaseV287(Number(xrState?.floor), 'xr-exit')"),
  jumpPreservedByObserverOrder:mainSource.indexOf('scene.onBeforeRenderObservable.add(() => clampCameraHeight(camera));') >= 0,
  skySyntaxValid,
  skyVersion:/const VERSION = 'V287'/.test(skySource),
  skyTerraceOnly:/function onTerrace\(\)/.test(skySource) && /state\.root\?\.setEnabled\(terrace\)/.test(skySource),
  skyDomeOptimized:/segments:20/.test(skySource),
  skyTextureOptimized:/width:1024, height:512/.test(skySource),
  skyStarBudget:/const STAR_BUDGET = 14/.test(skySource),
  skyLabelBudget:/const LABELLED_STAR_BUDGET = 5/.test(skySource),
  skyLowGeometry:/segments:entry\.kind === 'star' \? 6 : 12/.test(skySource),
  skyNoAlwaysActive:/alwaysSelectAsActiveMesh = false/.test(skySource) && !/alwaysSelectAsActiveMesh = true/.test(skySource),
  skyFrameThrottled:/const FRAME_THROTTLE_MS = 250/.test(skySource),
  skyRefreshReduced:/const REFRESH_MS = 600000/.test(skySource),
  skyReconcilesInPlace:/function reconcile\(\)/.test(skySource) && /state\.objects\.get\(entry\.id\) \|\| createObject\(entry\)/.test(skySource),
  serverInterceptsMain:/pathname === MAIN_PATH/.test(compatSource) && /sendPatchedMainScene/.test(compatSource),
  serverUsesNewSky:/ucan_v287_rooftop_sky\.js/.test(compatSource),
  oldSkyRefreshRemoved:/ucan_v276_sky_refresh/.test(compatSource) && /skyRefreshScript = null/.test(compatSource),
  noCacheMain:/X-UCAN-Floor-State/.test(compatSource) && /no-store, no-cache/.test(compatSource),
  packageStartsV287Base:startsDirectV287 || startsLayeredV293 || startsLayeredV305 || startsLayeredV306,
  layeredPreloaderPreservesV287:startsDirectV287 || v293PreservesV287,
  v305PreloaderPreservesV287:!startsLayeredV305 || (v305PreservesV293 && v293PreservesV287),
  v306PreloaderPreservesV287:!startsLayeredV306 || (v306PreservesV305 && v305PreservesV293 && v293PreservesV287),
  packageAudit:pkg.scripts?.['audit:floor-sky'] === 'node audit_floor_sky_v287.js',
  dockerStartsV287Base:dockerDirectV287 || dockerLayeredV293 || dockerLayeredV305 || dockerLayeredV306,
  codespacesUsesNpmStart:/nohup npm start/.test(codespaceStartSource),
  codespacesRejectsOldVersion:/v\.version==='V287'/.test(codespaceStartSource),
  codespacesBuildIsV287:devcontainer?.remoteEnv?.UCAN_BUILD === BUILD,
  codespacesNameIsV287:/V287/.test(devcontainer?.name || '')
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({
  ok,
  version:VERSION,
  build:BUILD,
  checks,
  preloaderChain:{
    startsDirectV287,
    startsLayeredV293,
    startsLayeredV305,
    startsLayeredV306,
    v306PreservesV305,
    v305PreservesV293,
    v293PreservesV287
  },
  patchError,
  transformChecks:result.checks || null
}, null, 2));
if (!ok) process.exit(1);
