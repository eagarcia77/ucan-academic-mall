const fs = require('fs');
const path = require('path');

const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const pkg = JSON.parse(read('package.json'));
const docker = read('Dockerfile');
const v329 = read('auth-compat-v329-vr-innovation.js');
const v325 = read('auth-compat-v325-render-stability.js');
const server = read('server.js');
const v329Overlay = read('public/js/ucan_v329_vr_innovation_overlay.js');
const v330Guard = read('public/js/ucan_v330_xr_stability_guard.js');
const v328 = read('public/js/ucan_v328_xr_final_authority.js');
const main = read('public/js/ucan_babylon_mall_v265_accounts_avatars.js');

const checks = {
  node24Runtime: /^FROM node:24-bookworm-slim/m.test(docker),
  dockerUsesNpmStart: /CMD \["npm", "start"\]/.test(docker),
  packageLoadsBrowserPanel: String(pkg.scripts?.start || '').includes('auth-compat-v323-browser-panel.js'),
  packageLoadsRenderStability: String(pkg.scripts?.start || '').includes('auth-compat-v325-render-stability.js'),
  packageLoadsV329: String(pkg.scripts?.start || '').includes('auth-compat-v329-vr-innovation.js'),
  v329InjectsOverlay: /ucan_v329_vr_innovation_overlay\.js/.test(v329),
  v330CacheBuild: /V330-20261002-XR-IMMERSIVE-STABILITY-R39/.test(v329),
  v330ActiveReleaseR39: /global\.__UCAN_ACTIVE_RELEASE__/.test(v329) && /revision: 'R39'/.test(v329),
  v330OverlayR39: /const REVISION = 'R39'/.test(v329Overlay) && /immersiveHardwareScalingLocked:true/.test(v329Overlay),
  v325UsesActiveRelease: /const active = global\.__UCAN_ACTIVE_RELEASE__ \|\| \{\}/.test(v325) && /activeReleaseVersion:publicVersion/.test(v325),
  v329PatchesStreamAndStat: /fs\.createReadStream/.test(v329) && /fs\.promises\.stat/.test(v329),
  v330GuardInjected: /ucan_v330_xr_stability_guard\.js/.test(v329) && /__UCAN_XR_STABILITY_V330__/.test(v330Guard),
  v330PoseAfterInXR: /value===X\.ENTERING_XR\) captureVisual\(\)/.test(v328) && /value===X\.IN_XR\) enterXR\(\)/.test(v328),
  v330LandingSettlement: /settleExactLanding/.test(v328) && /v330-landing-settle/.test(v328),
  v330StereoTransparency: /needDepthPrePass = false/.test(main) && /disableDepthWrite = true/.test(main),
  v328TransformsHtmlAndJson: /function transformHtml/.test(v325) && /function transformJson/.test(v325),
  v328DisablesLegacyVerticalLayers: /legacyV326RuntimeLoaded:false/.test(v325) && /legacyV327RuntimeLoaded:false/.test(v325),
  serverBindsRenderPort: /process\.env\.PORT \|\| 3000/.test(server) && /0\.0\.0\.0/.test(server),
  dataDirPersistentContract: /ENV DATA_DIR=\/app\/data/.test(docker) && /VOLUME \["\/app\/data"\]/.test(docker),
  testRunsV326: String(pkg.scripts?.test || '').includes('audit:v326'),
  testRunsV327: String(pkg.scripts?.test || '').includes('audit:v327'),
  testRunsV328: String(pkg.scripts?.test || '').includes('audit:v328'),
  testRunsV329: String(pkg.scripts?.test || '').includes('audit:v329'),
  testRunsV330: String(pkg.scripts?.test || '').includes('audit:v330'),
  testRunsProductionIntegrity: String(pkg.scripts?.test || '').includes('audit:production')
};

const failures = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version: 'V330',
  audit: 'production-integrity',
  ok: failures.length === 0,
  checks,
  failures: failures.map(([name, value]) => ({ name, value }))
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
