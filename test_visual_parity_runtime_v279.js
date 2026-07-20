const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('public/js/ucan_v279_xr_visual_parity.js', 'utf8');
const sandbox = {
  console,
  performance: { now: () => 0 },
  setTimeout: () => 0,
  window: {},
  document: {},
};
sandbox.window = sandbox;
sandbox.BABYLON = {
  Scene: function Scene() {},
  Material: { MATERIAL_ALPHABLEND: 2 },
  Engine: { ALPHA_COMBINE: 2 },
};
sandbox.BABYLON.Scene.prototype.createDefaultXRExperienceAsync = async function original() { return {}; };
sandbox.window.BABYLON = sandbox.BABYLON;

vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const boot = sandbox.__UCAN_XR_VISUAL_PARITY_BOOT__ || {};
const checks = {
  version: boot.version === 'V279',
  patched: boot.patched === true,
  independentOfLocomotion: boot.independentOfLocomotion === true,
  protectsTransparentMaterials: boot.protectsTransparentMaterials === true,
  locksDesktopVisualState: boot.locksDesktopVisualState === true,
  prototypePatched: sandbox.BABYLON.Scene.prototype.createDefaultXRExperienceAsync.__ucanV279VisualParityPatched === true
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);
