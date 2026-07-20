'use strict';

const VERSION = 'V286';
const BUILD = 'V286-20260720-DIRECT-FLOOR-FIX';

// Localiza las dos declaraciones del pasillo seguidas por la condición defectuosa.
// Tolera CRLF/LF y diferencias de indentación sin ampliar el parche a otras funciones.
const ORIGINAL_PATTERN_SOURCE = String.raw`(^[\t ]*const inCenterAisle = camera\.position\.x > -4\.8 && camera\.position\.x < 1\.2 && camera\.position\.z > -14 && camera\.position\.z < 18\.8;\r?\n^[\t ]*const inSideAisle = camera\.position\.x > 18\.2 && camera\.position\.x < 22\.8 && camera\.position\.z > -8 && camera\.position\.z < 18\.8;\r?\n)(^[\t ]*)if \(inCenterAisle \|\| inSideAisle\) \{`;

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

function originalPattern() {
  return new RegExp(ORIGINAL_PATTERN_SOURCE, 'gm');
}

function countOriginalTargets(source) {
  return Array.from(String(source || '').matchAll(originalPattern())).length;
}

function patchMainScene(source) {
  const input = String(source || '');
  const originalOccurrences = countOriginalTargets(input);
  if (originalOccurrences !== 1) {
    return {
      code:input,
      patched:false,
      reason:`Se esperó exactamente una condición defectuosa y se encontraron ${originalOccurrences}.`,
      originalOccurrences
    };
  }

  let code = input.replace(originalPattern(), (_match, declarations, indent) => `${declarations}${indent}const onFloorThree = camera.position.y >= LEVEL.three + PLAYER_HEIGHT - 0.75\n${indent}  && camera.position.y < LEVEL.rooftop + PLAYER_HEIGHT - 1.0;\n${indent}if (onFloorThree && (inCenterAisle || inSideAisle)) {`);

  if (!code.includes('__UCAN_DIRECT_FLOOR_FIX__')) {
    code = code.replace(/^[\t ]*['"]use strict['"];?/m, match => `${match}${CLIENT_AUDIT_MARKER}`);
  }

  return {
    code,
    patched:true,
    reason:null,
    originalOccurrences,
    directConditionPresent:code.includes('if (onFloorThree && (inCenterAisle || inSideAisle))'),
    oldConditionPresent:/^[\t ]*if \(inCenterAisle \|\| inSideAisle\) \{/m.test(code)
  };
}

module.exports = {
  VERSION,
  BUILD,
  ORIGINAL_PATTERN_SOURCE,
  countOriginalTargets,
  patchMainScene
};
