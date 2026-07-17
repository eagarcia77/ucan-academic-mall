const fs = require('fs');
const vm = require('vm');

const source = fs.readFileSync('public/js/ucan_v275_xr_stair_blockers.js', 'utf8');
const store = new Map();
const sandbox = {
  console,
  performance: { now: () => 0 },
  localStorage: {
    getItem: key => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value))
  },
  document: { getElementById: () => null, querySelector: () => null },
  window: {}
};
sandbox.window = sandbox;
sandbox.BABYLON = {
  Scene: function Scene() {},
  WebXRState: { NOT_IN_XR: 0, ENTERING_XR: 1, IN_XR: 2, EXITING_XR: 3 }
};
sandbox.window.BABYLON = sandbox.BABYLON;
sandbox.BABYLON.Scene.prototype = { createDefaultXRExperienceAsync: async () => ({}) };

vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const boot = sandbox.__UCAN_QUEST_XR_BOOT__ || {};
const checks = {
  version: boot.version === 'V275',
  blockers: boot.underStairBlockers === true,
  gatedEntry: boot.gatedStairEntry === true,
  terrace: boot.terraceTransitionFixed === true,
  run: boot.runEnabled === true,
  jump: boot.jumpEnabled === true,
  speed: boot.defaultSpeed === 5
};
const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, checks }, null, 2));
if (!ok) process.exit(1);
