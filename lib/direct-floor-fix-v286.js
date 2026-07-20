'use strict';

const VERSION = 'V286';
const BUILD = 'V286-20260720-DIRECT-FLOOR-FIX';

const ORIGINAL_BLOCK = `    const inCenterAisle = camera.position.x > -4.8 && camera.position.x < 1.2 && camera.position.z > -14 && camera.position.z < 18.8;
    const inSideAisle = camera.position.x > 18.2 && camera.position.x < 22.8 && camera.position.z > -8 && camera.position.z < 18.8;
    if (inCenterAisle || inSideAisle) {`;

const PATCHED_BLOCK = `    const inCenterAisle = camera.position.x > -4.8 && camera.position.x < 1.2 && camera.position.z > -14 && camera.position.z < 18.8;
    const inSideAisle = camera.position.x > 18.2 && camera.position.x < 22.8 && camera.position.z > -8 && camera.position.z < 18.8;
    const onFloorThree = camera.position.y >= LEVEL.three + PLAYER_HEIGHT - 0.75
      && camera.position.y < LEVEL.rooftop + PLAYER_HEIGHT - 1.0;
    if (onFloorThree && (inCenterAisle || inSideAisle)) {`;

const CLIENT_AUDIT_MARKER = `
  window.__UCAN_DIRECT_FLOOR_FIX__ = Object.freeze({
    version:'${VERSION}',
    build:'${BUILD}',
    sourceFunctionPatched:true,
    requiresFloorThree:true,
    floorOneProtected:true,
    floorTwoProtected:true
  });
`;

function patchMainScene(source) {
  const input = String(source || '');
  const originalOccurrences = input.split(ORIGINAL_BLOCK).length - 1;
  if (originalOccurrences !== 1) {
    return {
      code:input,
      patched:false,
      reason:`Se esperó exactamente una condición defectuosa y se encontraron ${originalOccurrences}.`,
      originalOccurrences
    };
  }

  let code = input.replace(ORIGINAL_BLOCK, PATCHED_BLOCK);
  if (!code.includes('__UCAN_DIRECT_FLOOR_FIX__')) {
    code = code.replace("  'use strict';", `  'use strict';${CLIENT_AUDIT_MARKER}`);
  }

  return {
    code,
    patched:true,
    reason:null,
    originalOccurrences,
    directConditionPresent:code.includes('if (onFloorThree && (inCenterAisle || inSideAisle))'),
    oldConditionPresent:code.includes('if (inCenterAisle || inSideAisle) {')
  };
}

module.exports = {
  VERSION,
  BUILD,
  ORIGINAL_BLOCK,
  PATCHED_BLOCK,
  patchMainScene
};
