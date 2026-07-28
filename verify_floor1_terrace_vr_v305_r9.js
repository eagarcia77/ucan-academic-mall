'use strict';

const fs = require('fs');
const path = require('path');

const root = __dirname;
const runtimePath = path.join(root, 'public/js/ucan_v305_floor1_terrace_vr_r9.js');
const loaderPath = path.join(root, 'public/js/ucan_v266_keyboard_jump.js');
const preloaderPath = path.join(root, 'auth-compat-v304-r6.js');
const packagePath = path.join(root, 'package.json');

const runtime = fs.readFileSync(runtimePath, 'utf8');
const loader = fs.readFileSync(loaderPath, 'utf8');
const preloader = fs.readFileSync(preloaderPath, 'utf8');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const checks = {
  runtimeExists: fs.existsSync(runtimePath),
  runtimeSyntax: true,
  xrStateDeclared: /const XR_STATE\s*=\s*B\.WebXRState/.test(runtime),
  xrStateUsedSafely: /XR_STATE\.IN_XR/.test(runtime),
  dynamicTextureUsesNoInvertY: /record\.texture\.update\(false\)/.test(runtime),
  infoTextureUsesNoInvertY: /state\.infoTexture\.update\(false\)/.test(runtime),
  supportsImageTextures: /sourceTexture\?\.clone\?\./.test(runtime),
  twoFrontFaces: /sideOrientation:B\.Mesh\.FRONTSIDE/.test(runtime) && /Math\.PI/.test(runtime),
  billboardDisabled: /BILLBOARDMODE_NONE/.test(runtime),
  joystickComponentEvents: /onButtonStateChangedObservable/.test(runtime),
  joystickComponentIndex: /gamepadIndices\?\.button/.test(runtime),
  joystickIndex3Fallback: /action === 'joystick' \? \[3\]/.test(runtime),
  planetsSelectable: /celestialId/.test(runtime) && /__UCAN_INTERACTIVE_SKY__/.test(runtime),
  terraceSignsSelectable: /correctedBoardFaceV305R7/.test(runtime) && /livePanelKey/.test(runtime),
  controllerRay: /getWorldPointerRayToRef/.test(runtime),
  gazeFallback: /function gazeRay/.test(runtime),
  loaderUsesR9: loader.includes('/js/ucan_v305_floor1_terrace_vr_r9.js?build=V305-20260728-FLOOR1-ADS-TERRACE-XR-R9'),
  loaderDoesNotUseR8: !loader.includes('ucan_v305_floor1_terrace_vr_r8.js'),
  preloaderUsesUniqueLoaderBuild: preloader.includes('V305-20260728-R9-NO-CACHE-LOADER'),
  preloaderDisablesHtmlJsCache: preloader.includes('no-store, no-cache, must-revalidate'),
  preloaderStopsForcedSeasonalInvert: preloader.includes("board.texture.update(false);") && !preloader.includes("return value.replace('board.texture.update(false);', 'board.texture.update(true);')"),
  preloaderStopsForcedUniversalInvert: preloader.includes("state.texture.update(false);"),
  preloaderStopsForcedSkyInvert: preloader.includes("state.infoTexture.update(false);"),
  packageIncludesRuntimeCheck: String(pkg.scripts?.check || '').includes('ucan_v305_floor1_terrace_vr_r9.js'),
  packageIncludesR9Audit: String(pkg.scripts?.test || '').includes('audit:floor1-terrace-v305-r9')
};

try {
  new Function(runtime);
} catch (error) {
  checks.runtimeSyntax = false;
  checks.runtimeSyntaxError = error.message;
}

const failed = Object.entries(checks).filter(([, value]) => value !== true);
const report = {
  version: 'V305',
  revision: 'R9',
  build: 'V305-20260728-FLOOR1-ADS-TERRACE-XR-R9',
  ok: failed.length === 0,
  checks,
  failed: failed.map(([name, value]) => ({ name, value }))
};

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
