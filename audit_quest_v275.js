const fs = require('fs');
const xr = fs.readFileSync('public/js/ucan_v275_xr_stair_blockers.js', 'utf8');
const blocker = fs.readFileSync('public/js/ucan_v275_blocker_pickability.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v271.js', 'utf8');

const checks = {
  version: /const VERSION = 'V275'/.test(xr),
  build: /V275-20260717-XR-STAIR-BLOCKERS-TERRACE/.test(xr) && /V275-20260717-XR-STAIR-BLOCKERS-TERRACE/.test(compat),
  served: /ucan_v275_xr_stair_blockers\.js/.test(compat) && /ucan_v275_blocker_pickability\.js/.test(compat),
  allFiveStairs: /p1-p2-oeste/.test(xr) && /p2-p1-este/.test(xr) && /p2-p3-oeste/.test(xr) && /p3-p2-este/.test(xr) && /p3-terraza/.test(xr),
  physicalBlockers: /createUnderStairBlockers/.test(xr) && /xrUnderStairBlocker/.test(xr) && /checkCollisions = true/.test(xr),
  pickableBlockers: /pickableForCollisionRays: true/.test(blocker) && /mesh\.isPickable = true/.test(blocker),
  gatedEntry: /ENTRY_GATE_DEPTH/.test(xr) && /entryDirection/.test(xr) && /gatedStairEntry: true/.test(xr),
  noMiddleActivation: /Math\.abs\(position\.z - lane\.z0\) <= ENTRY_GATE_DEPTH/.test(xr) && /Math\.abs\(position\.z - lane\.z1\) <= ENTRY_GATE_DEPTH/.test(xr),
  terraceCompletion: /Llegó correctamente a la terraza/.test(xr) && /terraceTransitionFixed: true/.test(xr),
  endpointSnap: /TRANSITION_FINISH/.test(xr) && /transitionEndpointSnap: true/.test(xr),
  sideExitRecovery: /resolveAbandonedTransition/.test(xr) && /sideExitRecovery: true/.test(xr),
  blackScreenProtection: /delete safe\.outputCanvasOptions/.test(xr) && /delete safe\.ignoreNativeCameraTransformation/.test(xr),
  runAndJump: /RUN_SPEED/.test(xr) && /runControl/.test(xr) && /jumpControl/.test(xr) && /jumpVelocity = 4\.35/.test(xr)
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version: 'V275', checks }, null, 2));
if (!ok) process.exit(1);
