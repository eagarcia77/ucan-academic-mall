'use strict';

const fs = require('fs');

const patch = fs.readFileSync('public/js/ucan_v302_remove_stair_glass.js', 'utf8');
const runtime = fs.readFileSync('public/js/ucan_v301_quest_rails_selection_comfort.js', 'utf8');
const auth = fs.readFileSync('auth-compat-v293.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try { new Function(patch); syntaxValid = true; }
catch (error) { syntaxError = error.message; }

const checks = {
  syntaxValid,
  version:/const VERSION = 'V302'/.test(patch),
  build:/V302-20260723-REMOVE-QUEST-STAIR-GLASS/.test(patch),
  questOnly:/questOnly:true/.test(patch) && /questDetected/.test(patch) && /xrActive/.test(patch),
  stairBounds:/STAIR_BOUNDS/.test(patch) && /insideStairArea/.test(patch),
  detectsV301Panes:/metadata\.stairGlassPanel === true/.test(patch) && /cristal baranda escalera Quest V301/.test(patch),
  detectsOriginalRails:/baranda hueco escalera terraza/.test(patch),
  detectsMaterialGlass:/cristal\|glass\|vidrio/.test(patch) && /materialName/.test(patch),
  preservesMetal:/isMetalStairPart/.test(patch) && /stairRailPost/.test(patch) && /stairTopRail/.test(patch) && /stairLowerRail/.test(patch),
  disablesMeshes:/mesh\.setEnabled\?\.\(false\)/.test(patch) && /mesh\.isVisible = false/.test(patch) && /mesh\.visibility = 0/.test(patch),
  disablesCollision:/mesh\.checkCollisions = false/.test(patch),
  disablesPickability:/mesh\.isPickable = false/.test(patch),
  rescans:/SCAN_INTERVAL_MS = 250/.test(patch) && /scanAndRemove/.test(patch),
  restoresDesktop:/desktopStairUnchanged:true/.test(patch) && /restoreMeshes/.test(patch),
  noGlassCreation:!patch.includes('MeshBuilder.CreateBox') && /noNewStairGlassCreated:true/.test(patch),
  auditApi:/__UCAN_QUEST_V302__/.test(patch) && /__UCAN_STAIR_GLASS_V302__/.test(patch),
  baseRuntimeStillProvidesMetal:/poste baranda escalera Quest V301/.test(runtime) && /pasamanos superior escalera Quest V301/.test(runtime),
  authInjectsPatch:/ucan_v302_remove_stair_glass\.js/.test(auth) && /QUEST_STAIR_GLASS_VERSION = 'V302'/.test(auth),
  authAfterV301:/const questTags = `\$\{runtimeTag\}\\n  \$\{stairGlassTag\}`/.test(auth),
  authStripsDuplicates:/ucan_v302_remove_stair_glass/.test(auth) && /stripLegacyQuestLayers/.test(auth),
  endpointFlags:/questStairGlassRemoved = true/.test(auth) && /questStairMetalOnly = true/.test(auth) && /questNoNewStairGlassCreated = true/.test(auth),
  header:/X-UCAN-XR-Stair-Glass/.test(auth),
  packageCheck:pkg.scripts?.check?.includes('ucan_v302_remove_stair_glass.js'),
  packageAudit:pkg.scripts?.['audit:quest-stair-glass'] === 'node verify_quest_stair_glass_v302.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V302', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
