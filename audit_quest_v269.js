'use strict';
const fs=require('fs');
const source=fs.readFileSync('public/js/ucan_v269_quest_grounded.js','utf8');
const checks={
  patchesWebXR:/createDefaultXRExperienceAsync/.test(source),
  disablesBuiltInMovement:/disableConflictingFeatures/.test(source)&&/WebXRFeatureName\?\.MOVEMENT/.test(source),
  horizontalOnly:/desired\.scaleInPlace\(WALK_SPEED\)/.test(source)&&/state\.velocity\.y\s*=\s*0/.test(source),
  groundedHeight:/updateGroundHeight/.test(source)&&/realWorldHeight/.test(source),
  stairTransitions:/STAIR_LANES/.test(source)&&/p3-terraza/.test(source),
  speedLimited:/WALK_SPEED\s*=\s*1\.85/.test(source)&&/maxStep/.test(source),
  safetyClamp:/safetyCheck/.test(source)&&/lastSafe/.test(source),
  snapTurn:/SNAP_TURN/.test(source)&&/rightStickLatched/.test(source),
  avatarSync:/syncDesktopAndAvatar/.test(source)&&/avatar-local/.test(source),
  audit:/__UCAN_QUEST_XR_AUDIT__/.test(source)
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'V269',passed,checks},null,2));
if(!passed)process.exit(1);
