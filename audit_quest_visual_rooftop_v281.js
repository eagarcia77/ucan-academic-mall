const fs = require('fs');

const parity = fs.readFileSync('public/js/ucan_v281_quest_visual_rooftop_parity.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v271.js', 'utf8');

const checks = {
  version: /const VERSION = 'V281'/.test(parity),
  layerBuild: /V281-20260720-QUEST-VISUAL-ROOFTOP-PARITY/.test(parity),
  currentServerBuild: /V282-20260720-QUEST-BROWSER-ONE-WAY-ESCALATOR-PARITY/.test(compat),
  questExposureCalibration: /DEFAULT_EXPOSURE_FACTOR = 0\.86/.test(parity) && /applyQuestVisualCalibration/.test(parity),
  desktopVisualRestore: /restoreDesktopVisual/.test(parity) && /image\.exposure = state\.desktopVisual\.exposure/.test(parity),
  rooftopDetection: /onRooftop/.test(parity) && /const ROOFTOP = 27\.2/.test(parity),
  browserSpeedParity: /natural:5\.0/.test(parity) && /comfort:3\.4/.test(parity),
  immediateStop: /inertiaCancelledFrames/.test(parity) && /state\.xr\.position\.x = state\.beforePosition\.x/.test(parity),
  nativeCollisionParity: /_collideWithWorld/.test(parity) && /state\.desktop\?\.ellipsoid/.test(parity),
  preservesRoomScale: /captureBeforeLocomotion/.test(parity) && /preservesRoomScalePose:true/.test(parity),
  runtimeAudit: /__UCAN_QUEST_VISUAL_ROOFTOP_PARITY__/.test(parity),
  loadedByCampus: /UCAN_QUEST_PARITY_SCRIPT/.test(compat) && /ucan_v281_quest_visual_rooftop_parity\.js/.test(compat),
  versionEndpoint: /questExposureCalibrated:true/.test(compat) && /rooftopDesktopMovement:true/.test(compat)
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, layerVersion:'V281', serverVersion:'V282', checks }, null, 2));
if (!ok) process.exit(1);
