'use strict';

const fs = require('fs');
const { VERSION, BUILD, ORIGINAL_BLOCK, patchMainScene } = require('./lib/direct-floor-fix-v286');

const source = fs.readFileSync('public/js/ucan_babylon_mall_v265_accounts_avatars.js', 'utf8');
const compat = fs.readFileSync('auth-compat-v286.js', 'utf8');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const result = patchMainScene(source);

const checks = {
  version:VERSION === 'V286',
  build:BUILD === 'V286-20260720-DIRECT-FLOOR-FIX',
  originalBugPresentInRepository:source.includes(ORIGINAL_BLOCK),
  patchApplied:result.patched === true,
  exactlyOneTarget:result.originalOccurrences === 1,
  directFloorCondition:result.code.includes('if (onFloorThree && (inCenterAisle || inSideAisle))'),
  actualFloorThreeRange:result.code.includes('camera.position.y >= LEVEL.three + PLAYER_HEIGHT - 0.75') && result.code.includes('camera.position.y < LEVEL.rooftop + PLAYER_HEIGHT - 1.0'),
  oldConditionRemoved:result.oldConditionPresent === false,
  clientAuditMarker:result.code.includes('__UCAN_DIRECT_FLOOR_FIX__'),
  serverInterceptsMainScript:/pathname === MAIN_PATH/.test(compat) && /sendPatchedMainScene/.test(compat),
  noStaticStreamDependency:/intercept-main-script-before-static-stream/.test(compat),
  noRuntimeGuardDependency:/v284AndV285RuntimeGuardsReplaced/.test(compat),
  cacheBusting:/V286-20260720-DIRECT-FLOOR-FIX/.test(compat),
  packageStartsV286:pkg.scripts?.start === 'node -r ./auth-compat-v286.js server.js',
  packageAudit:pkg.scripts?.['audit:direct-floor-fix'] === 'node audit_direct_floor_fix_v286.js'
};

const ok = Object.values(checks).every(Boolean);
console.log(JSON.stringify({ ok, version:VERSION, build:BUILD, checks, patchResult:{ patched:result.patched, reason:result.reason, originalOccurrences:result.originalOccurrences } }, null, 2));
if (!ok) process.exit(1);
