'use strict';

const fs = require('fs');

const source = fs.readFileSync('public/js/ucan_v294_quest_terrace_stability.js', 'utf8');
const preloader = fs.readFileSync('auth-compat-v293.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(source);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const checks = {
  syntaxValid,
  version:/const VERSION = 'V294'/.test(source),
  build:/V294-20260721-QUEST-TERRACE-LIGHT-SIGNS/.test(source),
  questDetection:/OculusBrowser\|Meta Quest\|Quest 2\|Quest 3\|Quest Pro/.test(source),
  questOnly:/if \(!state\.questBrowser \|\| !state\.inXR/.test(source) && /questOnly:true/.test(source),
  exposure:/const QUEST_EXPOSURE = 0\.72/.test(source) && /image\.exposure = QUEST_EXPOSURE/.test(source),
  contrast:/const QUEST_CONTRAST = 1\.08/.test(source),
  environmentIntensity:/const QUEST_ENVIRONMENT_INTENSITY = 0\.65/.test(source),
  lightScale:/const QUEST_LIGHT_SCALE = 0\.82/.test(source),
  lightingRestored:/function restoreLighting/.test(source) && /light\.intensity = original/.test(source),
  terraceLock:/function stabilizeTerraceFloor/.test(source) && /quest-v294-terrace-lock/.test(source),
  floorCorrection:/position\.y = minimumY/.test(source),
  readableDetection:/function isTerraceReadable/.test(source) && /celestialId/.test(source) && /livePanel/.test(source),
  distantLabelsAlwaysActive:/alwaysSelectAsActiveMesh = true/.test(source),
  labelScale:/original\.scale\(1\.65\)/.test(source),
  rootForce:/Cielo optimizado terraza V287/.test(source) && /root\.setEnabled\(true\)/.test(source),
  materialsRestored:/function restoreReadableMeshes/.test(source),
  auditObject:/__UCAN_QUEST_TERRACE_V294__/.test(source),
  preloaderPath:/ucan_v294_quest_terrace_stability\.js/.test(preloader),
  preloaderInsertion:/function insertQuestTerraceScript/.test(preloader),
  preloaderVersion:/questTerraceVersion = QUEST_TERRACE_VERSION/.test(preloader),
  desktopUnchanged:/desktopVisualsUnchanged = true/.test(preloader),
  packageCheck:pkg.scripts?.check?.includes('public/js/ucan_v294_quest_terrace_stability.js') === true,
  packageAudit:pkg.scripts?.['audit:quest-terrace'] === 'node verify_quest_terrace_v294.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V294', build:'V294-20260721-QUEST-TERRACE-LIGHT-SIGNS', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
