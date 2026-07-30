'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  preloader:path.join(root, 'auth-compat-v319-vr-comfort.js'),
  loader:path.join(root, 'public/js/ucan_v319_social_loader.js'),
  controller:path.join(root, 'public/js/ucan_v319_floor_route_controller.js'),
  accessibility:path.join(root, 'public/js/ucan_v319_vr_accessibility.js'),
  locomotion:path.join(root, 'public/js/ucan_v316_complete_browser_vr_audit.js'),
  renderParity:path.join(root, 'public/js/ucan_v314_render_parity.js'),
  stairs:path.join(root, 'public/js/ucan_v318_stairs_all_environments.js'),
  persistence:path.join(root, 'lib/persistent-identity-v311.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};

const text = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);

const checks = {
  filesExist:Object.values(files).every(fs.existsSync),
  preloaderSyntax:true,
  loaderSyntax:true,
  controllerSyntax:true,
  accessibilitySyntax:true,
  version:/const VERSION = 'V319'/.test(text.preloader) && /const REVISION = 'R23'/.test(text.preloader),
  cleanParallelBase:text.preloader.includes("require('./auth-compat-v313-parallel.js')"),
  singleGroundDelegation:/__UCAN_FLOOR_ROUTE_CONTROLLER_V319__\?\.resolveGround/.test(text.preloader),
  controllerExposesGround:/resolveGround/.test(text.controller) && /singleGroundAuthority:true/.test(text.controller),
  activeRoutePersists:/state\.activeRoute = route\.id/.test(text.controller) && /routeContains\(route, position\)/.test(text.controller),
  physicalEntryRequired:/entryRequiredAtPhysicalLanding:true/.test(text.controller) && /Math\.abs\(position\.z - route\.fromZ\)/.test(text.controller),
  safeLandingAssist:/safeLandingExitAssist:true/.test(text.controller) && /EXIT_DURATION_MS = 720/.test(text.controller) && /targetZ:route\.exitZ/.test(text.controller),
  floorTwoStops:/floor1ToFloor2StopsAtFloor2:true/.test(text.controller) && /automaticFloor1ToFloor3:false/.test(text.controller),
  exitCorridor:/EXIT_ZONE/.test(text.accessibility) && /collisionClearedAtUp12LandingV319:true/.test(text.accessibility),
  safeLandingPad:/up12SafeLandingV319:true/.test(text.accessibility) && /depth:11\.0/.test(text.accessibility),
  visualModes:/comfort:'Brillo: cómodo'/.test(text.accessibility) && /dim:'Brillo: tenue'/.test(text.accessibility) && /normal:'Brillo: normal'/.test(text.accessibility),
  visualComfortInjected:/comfortV319/.test(text.preloader) && /__UCAN_APPLY_VISUAL_COMFORT_V319__/.test(text.preloader),
  comfortableDefaults:/exposure:\.72/.test(text.preloader) && /environment:\.65/.test(text.preloader) && /light:\.74/.test(text.preloader),
  renderParityReappliesComfort:/z\+=rs\(\);z\+=comfortV319\(\);/.test(text.preloader),
  sameBrowserVr:/visualComfortSameBrowserVr:true/.test(text.accessibility),
  panelControl:/visualComfortV319Btn/.test(text.accessibility),
  loaderOrder:text.loader.indexOf('chain(loadFloorController') >= 0 && text.loader.indexOf('chain(loadAccessibility') > text.loader.indexOf('chain(loadFloorController') && text.loader.indexOf('chain(loadVoiceBridge') > text.loader.indexOf('chain(loadAccessibility'),
  legacyControllerRemoved:text.preloader.includes("'ucan_v318_floor_route_controller.js'") && !text.loader.includes('/js/ucan_v318_floor_route_controller.js?'),
  persistencePreserved:/MAX_BACKUPS = 60/.test(text.persistence),
  dockerStartsV319:text.docker.includes('./auth-compat-v319-vr-comfort.js'),
  packageStartsV319:String(pkg.scripts?.start || '').includes('auth-compat-v319-vr-comfort.js'),
  packageChecksV319:String(pkg.scripts?.check || '').includes('ucan_v319_floor_route_controller.js') && String(pkg.scripts?.check || '').includes('ucan_v319_vr_accessibility.js'),
  packageRunsV319:String(pkg.scripts?.test || '').includes('audit:v319')
};

for (const key of ['preloader','loader','controller','accessibility']) {
  try { new Function(text[key]); }
  catch (error) {
    checks[`${key}Syntax`] = false;
    checks[`${key}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version:'V319',
  revision:'R23',
  build:'V319-20260730-SAFE-VR-LANDING-VISUAL-COMFORT-R23',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name, value]) => ({ name, value })),
  physicalValidationRequired:[
    'Subir por up12 en Meta Quest y confirmar que el sistema coloca al usuario en el descanso del Piso 2.',
    'Caminar libremente fuera de la salida sin quedar retenido por colisiones.',
    'Confirmar exposición cómoda en browser y VR.',
    'Probar los tres modos del botón Brillo en el panel izquierdo.'
  ]
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
