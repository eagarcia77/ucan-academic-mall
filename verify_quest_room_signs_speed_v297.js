'use strict';

const fs = require('fs');

const runtime = fs.readFileSync('public/js/ucan_v297_quest_room_signs_speed.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v293.js', 'utf8');
const main = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

let syntaxValid = false;
let syntaxError = null;
try {
  new Function(runtime);
  syntaxValid = true;
} catch (error) {
  syntaxError = error.message;
}

const checks = {
  syntaxValid,
  version:/const VERSION = 'V297'/.test(runtime),
  build:/V297-20260722-QUEST-ROOM-SIGNS-DESKTOP-SPEED/.test(runtime),
  questOnly:/questOnly:true/.test(runtime) && /detectQuestDevice/.test(runtime),
  screenshotCauseRecorded:/V296 cloned the existing front\/back signs/.test(runtime),
  removesV296Copies:/function disposeMirroredCopies/.test(runtime) && /ucanQuestRoomSignBackV296/.test(runtime),
  hidesOldSigns:/function hideOriginal/.test(runtime) && /restoreOriginals/.test(runtime),
  generatedFrontTexture:/function createSignMaterial/.test(runtime) && /SALA VIRTUAL/.test(runtime),
  frontSidePlane:/sideOrientation:B\.Mesh\.FRONTSIDE/.test(runtime),
  billboardY:/B\.Mesh\.BILLBOARDMODE_Y/.test(runtime),
  noBackTexture:/roomSignsNeverUseBackTexture:true/.test(runtime),
  originalRoomConfig:/SV-201/.test(main) && /SV-203/.test(main) && /SV-205/.test(main),
  browserSpeedsFromMain:/comfortMode\?3\.4:[\s\S]*7\.0:5\.0/.test(main),
  v297Speeds:/comfort:3\.4, normal:5\.0, sprint:7\.0/.test(runtime),
  digitalParity:/DIGITAL_THRESHOLD = 0\.34/.test(runtime) && /analogToKeyboardParity:true/.test(runtime),
  fullStickSprint:/SPRINT_THRESHOLD = 0\.72/.test(runtime) && /fullStickSprint:true/.test(runtime),
  movementCorrection:/function applyDesktopSpeedCorrection/.test(runtime) && /extraSpeed/.test(runtime),
  desktopCollisions:/camera\._collideWithWorld\(step\)/.test(runtime),
  skipsTransitions:/transitionActive\(\)/.test(runtime),
  desktopUnchanged:/desktopSceneUnchanged:true/.test(runtime),
  compatScript:/ucan_v297_quest_room_signs_speed\.js/.test(compat),
  compatVersion:/QUEST_CORRECTION_VERSION = 'V297'/.test(compat),
  compatFlags:/questAnalogToKeyboardParity = true/.test(compat) && /questBrowserSprintSpeed = 7\.0/.test(compat),
  signFlags:/questRoomSignsFrontFacingTextures = true/.test(compat) && /questV296MirroredCopiesRemoved = true/.test(compat),
  packageCheck:pkg.scripts?.check?.includes('ucan_v297_quest_room_signs_speed.js'),
  packageAudit:pkg.scripts?.['audit:quest-room-speed'] === 'node verify_quest_room_signs_speed_v297.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:'V297', checks, syntaxError }, null, 2));
if (!ok) process.exit(1);
