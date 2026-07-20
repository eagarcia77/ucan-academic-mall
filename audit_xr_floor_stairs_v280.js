const fs = require('fs');

const alignment = fs.readFileSync('public/js/ucan_v280_xr_floor_stair_alignment.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v271.js', 'utf8');

const checks = {
  version: /const VERSION = 'V280'/.test(alignment),
  layerBuild: /V280-20260720-XR-HEIGHT-STAIRS-FLOOR-SNAP/.test(alignment),
  currentServerBuild: /V282-20260720-QUEST-BROWSER-ONE-WAY-ESCALATOR-PARITY/.test(compat),
  realWorldHeight: /realWorldHeight/.test(alignment) && /readEyeHeight/.test(alignment),
  headAndFloorSeparated: /camera\.position\.y = Number\(value\) \+ state\.eyeHeight/.test(alignment) && /feetY\(state\)/.test(alignment),
  stairEntryExpanded: /const ENTRY_DEPTH = 6\.4/.test(alignment) && /widenStairEntry/.test(alignment),
  stairProgressAlignment: /activeStairGround/.test(alignment) && /lerp\(lane\.low, lane\.high, progress\)/.test(alignment),
  postTransitionSnap: /floorSnapRecovery/.test(alignment) && /post-transition-floor-snap/.test(alignment),
  runtimeAudit: /__UCAN_XR_FLOOR_STAIR_AUDIT__/.test(alignment),
  loadedByCampus: /UCAN_ALIGNMENT_SCRIPT/.test(compat) && /ucan_v280_xr_floor_stair_alignment\.js/.test(compat),
  versionEndpoint: /alignmentScript:UCAN_ALIGNMENT_SCRIPT/.test(compat) && /automaticStairAlignment:true/.test(compat)
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, layerVersion:'V280', serverVersion:'V282', checks }, null, 2));
if (!ok) process.exit(1);
