'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const files = {
  runtime:path.join(root, 'public/js/ucan_v310_visual_validation.js'),
  backend:path.join(root, 'lib/visual-validation-v310.js'),
  preloader:path.join(root, 'auth-compat-v309-parity.js'),
  parity:path.join(root, 'public/js/ucan_v309_strict_visual_parity.js'),
  docker:path.join(root, 'Dockerfile')
};

const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const checks = {
  runtimeSyntax:true,
  backendSyntax:true,
  preloaderSyntax:true,
  versionV310:source.runtime.includes("const VERSION = 'V310'") && source.backend.includes("const VERSION = 'V310'"),
  revisionR14:source.runtime.includes("const REVISION = 'R14'") && source.backend.includes("const REVISION = 'R14'"),
  eighteenCanonicalAreas:(source.runtime.match(/\{ id:'/g) || []).length >= 18,
  canonicalCamera:source.runtime.includes('Cámara canónica de validación visual V310') && source.runtime.includes('sameCameraForBrowserAndVr:true'),
  renderTargetCapture:source.runtime.includes('new B.RenderTargetTexture') && source.runtime.includes('target.readPixels()'),
  browserBaseline:source.runtime.includes('async function captureBrowserBaseline()') && source.runtime.includes('browserBaselineReady'),
  webxrComparison:source.runtime.includes('async function captureVrComparison()') && source.runtime.includes('onStateChangedObservable'),
  pixelFingerprint:source.runtime.includes('function pixelFingerprint') && source.runtime.includes('function differenceBetween'),
  structuralComparison:source.runtime.includes('function frustumSnapshot') && source.runtime.includes('structuralMatch'),
  screenshots:source.runtime.includes("toDataURL('image/png')") && source.backend.includes('decodePngDataUrl'),
  persistentReports:source.runtime.includes("fetch(`${API}/report`") && source.backend.includes("writeJsonAtomic(path.join(directory, 'report.json')"),
  authenticatedReports:source.backend.includes("if (!user) return sendJson(res, 401") && source.backend.includes('authorizeReport'),
  reportImagesProtected:source.backend.includes('/image/') && source.backend.includes('No tiene autorización para abrir esta captura'),
  versionEndpointV310:source.backend.includes("if (pathname === '/version')") && source.backend.includes('visualValidationRevision'),
  runtimeInjected:source.preloader.includes('/js/ucan_v310_visual_validation.js') && source.preloader.includes('injectRuntime'),
  htmlNoCache:source.preloader.includes('no-store, no-cache, must-revalidate'),
  backendInstalledBeforeServer:source.preloader.includes('installVisualValidationSystem'),
  v309Required:source.runtime.includes('__UCAN_STRICT_VISUAL_PARITY_V309__') && source.parity.includes('browserSceneIsAuthoritative:true'),
  semanticSignCheck:source.runtime.includes('noVisibleInvertedSigns') && source.runtime.includes('floor1BrandFacesPresent'),
  patioCheck:source.runtime.includes('patioOutsideBuilding'),
  presenceAndVoiceCheck:source.runtime.includes('browserVrPresence') && source.runtime.includes('voiceBridge'),
  dockerStillStartsTopPreloader:source.docker.includes('auth-compat-v309-parity.js')
};

for (const name of ['runtime','backend','preloader']) {
  try { new Function(source[name]); }
  catch (error) {
    checks[`${name}Syntax`] = false;
    checks[`${name}SyntaxError`] = error.message;
  }
}

const failed = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version:'V310',
  revision:'R14',
  build:'V310-20260728-BROWSER-WEBXR-VISUAL-VALIDATION-R14',
  ok:failed.length === 0,
  checks,
  failed:failed.map(([name, value]) => ({ name, value }))
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
