'use strict';

const fs = require('fs');
const path = require('path');
const root = __dirname;
const files = {
  panel:path.join(root, 'public/js/ucan_v323_browser_panel.js'),
  visual:path.join(root, 'public/js/ucan_v323_visual_comfort.js'),
  loader:path.join(root, 'public/js/ucan_v323_social_loader.js'),
  preloader:path.join(root, 'auth-compat-v323-browser-panel.js'),
  campus:path.join(root, 'public/campus.html'),
  locomotion:path.join(root, 'public/js/ucan_v316_complete_browser_vr_audit.js'),
  authority:path.join(root, 'public/js/ucan_v322_stair_authority.js'),
  parity:path.join(root, 'public/js/ucan_v314_render_parity.js'),
  docker:path.join(root, 'Dockerfile'),
  package:path.join(root, 'package.json')
};

const text = Object.fromEntries(Object.entries(files).map(([key,file]) => [key, fs.readFileSync(file, 'utf8')]));
const pkg = JSON.parse(text.package);
const fixedIds = [
  'hudToggle','destinationSelect','destinationGo','boardsBtn','xrBtn','mrBtn','resetBtn',
  'comfortBtn','qualityBtn','autoQualityBtn','motionBtn','contrastBtn','textSizeBtn','seasonSelect'
];
const dynamicIds = [
  'ucanV316SpeedBtn','ucanV316TurnBtn','ucanV316DirectionBtn','ucanV316TeleportBtn',
  'visualComfortV323Btn','panelAuditV323Btn'
];
const destinationKeys = [
  'foodcourt','cafeteria','library','floor2','class201','class202','class203','class204','class205',
  'theater','rooftop','rooftopWeather','rooftopAgenda','rooftopMoon','rooftopSky','rooftopCalendar'
];
const cameraWrite = /(?:camera|xr|desktop)\.position(?:\.[xyz])?\s*=(?!=)|(?:camera|xr|desktop)\.position\.(?:set|copyFrom|addInPlace)\s*\(/;

const checks = {
  allFilesExist:Object.values(files).every(fs.existsSync),
  panelSyntax:true,
  visualSyntax:true,
  loaderSyntax:true,
  preloaderSyntax:true,
  allFixedControlsInCampus:fixedIds.every(id => text.campus.includes(`id="${id}"`)),
  allFixedControlsMapped:fixedIds.filter(id => !['destinationSelect','seasonSelect'].includes(id)).every(id => text.panel.includes(`${id}:`)),
  allDynamicControlsMapped:dynamicIds.every(id => text.panel.includes(id)),
  allDestinationsMapped:destinationKeys.every(key => text.panel.includes(`${key}:`) && text.campus.includes(`value="${key}"`)),
  navigationButtonsCovered:/document\.querySelectorAll\('\[data-go\]'\)/.test(text.panel) && /const go = target\.getAttribute\('data-go'\)/.test(text.panel),
  onePanelClickListener:(text.panel.match(/document\.addEventListener\('click', handleClick, true\)/g) || []).length === 1,
  onePanelChangeListener:(text.panel.match(/document\.addEventListener\('change', handleChange, true\)/g) || []).length === 1,
  onePanelKeyListener:(text.panel.match(/document\.addEventListener\('keydown', handleKeydown, true\)/g) || []).length === 1,
  selfTestAvailable:/function runSelfTest\(/.test(text.panel) && /panelAuditV323Btn/.test(text.panel),
  perControlDiagnostics:/failedControls/.test(text.panel) && /details/.test(text.panel) && /controlsReady/.test(text.panel),
  xrSupportExplained:/isSessionSupported\('immersive-vr'\)/.test(text.panel) && /VR no disponible/.test(text.panel) && /MR no disponible/.test(text.panel),
  qualityActuallyIntegrated:/__UCAN_APPLY_PANEL_QUALITY_V323__/.test(text.panel) && /ucanV323AutoQuality/.test(text.panel) && /ucanV323QualityMode/.test(text.panel),
  accessibilityControlsIntegrated:/setReducedMotion/.test(text.panel) && /setHighContrast/.test(text.panel) && /setLargeText/.test(text.panel),
  seasonControlIntegrated:/function setSeason\(/.test(text.panel) && /api\(\)\?\.setSeason/.test(text.panel),
  destinationStateIntegrated:/setActiveBoardId/.test(text.panel) && /currentLocation/.test(text.panel) && /active-destination/.test(text.panel),
  legacyBaseHudDisabled:text.preloader.includes("setupHUD(scene, camera);") && text.preloader.includes('__UCAN_LEGACY_BASE_HUD_DISABLED_V323__'),
  legacyEnvironmentPanelDisabled:text.preloader.includes("setupEnvironmentControls(scene, camera);") && text.preloader.includes('__UCAN_LEGACY_ENVIRONMENT_PANEL_DISABLED_V323__'),
  legacyV316PanelDisabled:/installPanelController/.test(text.preloader) && /__UCAN_LEGACY_PANEL_CONTROLLER_DISABLED_V323__/.test(text.preloader),
  locomotionBridgeInjected:/__UCAN_LOCOMOTION_CONTROLS_V323__/.test(text.preloader) && /applyComfort/.test(text.preloader) && /syncAfterNavigation/.test(text.preloader),
  v316ScalingNoLongerHardcoded:text.preloader.includes('__UCAN_APPLY_PANEL_QUALITY_V323__?.(state.scene.getEngine?.())'),
  v314ScalingPanelAware:text.preloader.includes('panelScale=window.__UCAN_APPLY_PANEL_QUALITY_V323__'),
  performanceAutoQualityPanelAware:text.preloader.includes('window.__UCAN_PANEL_STATE_V323__?.autoQuality'),
  visualIsCameraIndependent:/movesCamera:false/.test(text.visual) && !cameraWrite.test(text.visual),
  visualSupportsHighContrast:/setHighContrast/.test(text.visual) && /Math\.max\(1\.28/.test(text.visual),
  panelInjectedByPreloader:!text.loader.includes('/js/ucan_v323_browser_panel.js') && text.preloader.includes('/js/ucan_v323_browser_panel.js'),
  loaderNoLegacyStairLayers:!text.loader.includes('/js/ucan_v318_stairs_all_environments.js') && !text.loader.includes('/js/ucan_v319_vr_accessibility.js') && !text.loader.includes('/js/ucan_v321_stair_authority.js'),
  pureStairAuthorityPreserved:/pureGroundProvider:true/.test(text.authority) && !/onBeforeRenderObservable\.add/.test(text.authority),
  panelInjectedBeforeParity:text.preloader.includes('html.replace(renderParityPattern, `${combinedTags}\\n  $1`)'),
  versionFlags:/singlePanelController:true/.test(text.preloader) && /everyLeftPanelControlMapped:true/.test(text.preloader) && /panelSelfTestAvailable:true/.test(text.preloader),
  dockerStartsV323:text.docker.includes('auth-compat-v323-browser-panel.js'),
  packageStartsV323:String(pkg.scripts?.start || '').includes('auth-compat-v323-browser-panel.js'),
  packageChecksV323:String(pkg.scripts?.check || '').includes('ucan_v323_browser_panel.js') && String(pkg.scripts?.check || '').includes('ucan_v323_visual_comfort.js') && String(pkg.scripts?.check || '').includes('auth-compat-v323-browser-panel.js'),
  packageRunsV323:String(pkg.scripts?.test || '').includes('audit:v323')
};

for (const key of ['panel','visual','loader','preloader']) {
  try { new Function(text[key]); }
  catch (error) { checks[`${key}Syntax`] = false; checks[`${key}SyntaxError`] = error.message; }
}

const failures = Object.entries(checks).filter(([,value]) => value !== true);
const report = {
  version:'V323',
  revision:'R27',
  build:'V323-20260730-SINGLE-BROWSER-PANEL-CONTROLLER-R27',
  feature:'Auditoría y controlador único de cada opción del panel izquierdo en browser',
  ok:failures.length === 0,
  controls:{ fixed:fixedIds, dynamic:dynamicIds, destinations:destinationKeys },
  checks,
  failures:failures.map(([name,value]) => ({ name,value }))
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;