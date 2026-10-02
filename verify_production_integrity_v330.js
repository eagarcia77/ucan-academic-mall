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

const checks = {
  node24Runtime: /^FROM node:24-bookworm-slim/m.test(docker),
  dockerUsesNpmStart: /CMD \["npm", "start"\]/.test(docker),
  packageLoadsBrowserPanel: String(pkg.scripts?.start || '').includes('auth-compat-v323-browser-panel.js'),
  packageLoadsRenderStability: String(pkg.scripts?.start || '').includes('auth-compat-v325-render-stability.js'),
  packageLoadsV329: String(pkg.scripts?.start || '').includes('auth-compat-v329-vr-innovation.js'),
  v329InjectsOverlay: /ucan_v329_vr_innovation_overlay\.js/.test(v329),
  v329CacheBuildR2: /V329-20261002-VR-INNOVATION-PARITY-GUARD-R2/.test(v329),
  v329ActiveReleaseR2: /global\.__UCAN_ACTIVE_RELEASE__/.test(v329) && /revision: 'R2'/.test(v329),
  v329OverlayR2: /const REVISION = 'R2'/.test(v329Overlay) && /immersiveHardwareScalingLocked:true/.test(v329Overlay),
  v325UsesActiveRelease: /const active = global\.__UCAN_ACTIVE_RELEASE__ \|\| \{\}/.test(v325) && /activeReleaseVersion:publicVersion/.test(v325),
  v329PatchesStreamAndStat: /fs\.createReadStream/.test(v329) && /fs\.promises\.stat/.test(v329),
  v328TransformsHtmlAndJson: /function transformHtml/.test(v325) && /function transformJson/.test(v325),
  v328DisablesLegacyVerticalLayers: /legacyV326RuntimeLoaded:false/.test(v325) && /legacyV327RuntimeLoaded:false/.test(v325),
  serverBindsRenderPort: /process\.env\.PORT \|\| 3000/.test(server) && /0\.0\.0\.0/.test(server),
  dataDirPersistentContract: /ENV DATA_DIR=\/app\/data/.test(docker) && /VOLUME \["\/app\/data"\]/.test(docker),
  testRunsV326: String(pkg.scripts?.test || '').includes('audit:v326'),
  testRunsV327: String(pkg.scripts?.test || '').includes('audit:v327'),
  testRunsV328: String(pkg.scripts?.test || '').includes('audit:v328'),
  testRunsV329: String(pkg.scripts?.test || '').includes('audit:v329'),
  testRunsProductionIntegrity: String(pkg.scripts?.test || '').includes('audit:production')
};

const failures = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version: 'V329',
  audit: 'production-integrity',
  ok: failures.length === 0,
  checks,
  failures: failures.map(([name, value]) => ({ name, value }))
};
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
