'use strict';
const fs=require('fs');
const path=require('path');
const file=path.join(__dirname,'public/js/ucan_v268_quest_locomotion.js');
const source=fs.readFileSync(file,'utf8');
const checks={
  patchesWebXR:/createDefaultXRExperienceAsync/.test(source),
  enablesMovement:/WebXRFeatureName\.MOVEMENT/.test(source),
  standardQuestMapping:/forceHandedness:\s*'left'[\s\S]*movementState\.moveX[\s\S]*forceHandedness:\s*'right'[\s\S]*movementState\.rotateX/.test(source),
  handlesStairs:/STAIR_LANES/.test(source)&&/smoothStairHeight/.test(source),
  handlesRooftop:/p3-terraza/.test(source),
  handlesAuditorium:/AUDITORIUM_RAMPS/.test(source),
  exposesAudit:/__UCAN_QUEST_XR_AUDIT__/.test(source),
  disablesTeleportConflict:/disableTeleportation:\s*true/.test(source)
};
const passed=Object.values(checks).every(Boolean);
console.log(JSON.stringify({version:'V268',passed,checks},null,2));
if(!passed)process.exit(1);
