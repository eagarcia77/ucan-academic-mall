'use strict';

const VERSION = 'V287';
const BUILD = 'V287-20260720-FLOOR-STATE-SKY-OPT';

const HELPER_ANCHOR = "  let currentAreaKey = 'foodcourt';";
const RIDE_ANCHOR = "          camera.position.copyFrom(zone.to.clone());\n          camera.setTarget(zone.lookTo.clone());";
const NAVIGATE_ANCHOR = "    camera.position.copyFrom(target.pos());\n    camera.setTarget(target.target());";
const RESET_ANCHOR = "    camera.position.copyFrom(safe);\n    camera.setTarget(target);";
const API_ANCHOR = "      activeCamera.position.copyFrom(target.pos()); activeCamera.setTarget(target.target()); return true;";
const CLAMP_PATTERN = /  function clampCameraHeight\(camera\) \{[\s\S]*?\n  \}\n\n\n  function setupReliableMovement/;

const FLOOR_HELPERS = `

  // V287: el piso deja de inferirse de la altura instantánea de la cámara.
  // Solo cambia al completar una ruta, usar navegación o salir de XR.
  const UCAN_FLOOR_BASES_V287 = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.rooftop]);
  let ucanStableFloorV287 = LEVEL.one;
  let ucanWasInXRV287 = false;
  let ucanFloorCorrectionsV287 = 0;
  let ucanFloorAuditFrameV287 = 0;
  let ucanLastFloorChangeV287 = { floorBase:LEVEL.one, reason:'initial', at:new Date().toISOString() };
  let ucanLastFloorCorrectionV287 = null;

  function nearestFloorBaseV287(value) {
    const number = Number(value);
    return UCAN_FLOOR_BASES_V287.reduce((best, floor) => Math.abs(number - floor) < Math.abs(number - best) ? floor : best, UCAN_FLOOR_BASES_V287[0]);
  }

  function floorNumberV287(base) {
    return base === LEVEL.one ? 1 : base === LEVEL.two ? 2 : base === LEVEL.three ? 3 : 4;
  }

  function publishFloorStateV287() {
    window.__UCAN_FLOOR_STATE_V287__ = {
      version:'${VERSION}',
      build:'${BUILD}',
      installed:true,
      explicitState:true,
      inferredFromTransientHeight:false,
      transitionsOnly:true,
      floorBase:ucanStableFloorV287,
      floorNumber:floorNumberV287(ucanStableFloorV287),
      corrections:ucanFloorCorrectionsV287,
      lastFloorChange:ucanLastFloorChangeV287,
      lastCorrection:ucanLastFloorCorrectionV287,
      theaterRampOnlyOnFloorThree:true,
      floorOneLocked:true,
      floorTwoLocked:true,
      xrSynchronized:true,
      getState:() => ({
        floorBase:ucanStableFloorV287,
        floorNumber:floorNumberV287(ucanStableFloorV287),
        corrections:ucanFloorCorrectionsV287,
        lastFloorChange:ucanLastFloorChangeV287,
        lastCorrection:ucanLastFloorCorrectionV287
      }),
      setFloorBase:(base, reason='external') => setStableFloorBaseV287(base, reason)
    };
  }

  function setStableFloorBaseV287(base, reason='unknown') {
    const next = nearestFloorBaseV287(base);
    if (!Number.isFinite(Number(base)) || Math.abs(Number(base) - next) > 1.35) return false;
    if (ucanStableFloorV287 !== next || reason !== 'frame') {
      ucanStableFloorV287 = next;
      ucanLastFloorChangeV287 = { floorBase:next, floorNumber:floorNumberV287(next), reason, at:new Date().toISOString() };
      publishFloorStateV287();
    }
    return true;
  }

  function setStableFloorFromEyeYV287(eyeY, reason='height') {
    return setStableFloorBaseV287(Number(eyeY) - PLAYER_HEIGHT, reason);
  }

  function syncStableFloorFromXRV287() {
    try {
      const audit = window.__UCAN_UNIFIED_XR_AUDIT__;
      const xrState = audit?.getState?.();
      if (xrState?.inXR) {
        ucanWasInXRV287 = true;
        return true;
      }
      if (ucanWasInXRV287) {
        setStableFloorBaseV287(Number(xrState?.floor), 'xr-exit');
        ucanWasInXRV287 = false;
      }
    } catch (_) {}
    return false;
  }

  publishFloorStateV287();`;

const CLAMP_REPLACEMENT = `  function clampCameraHeight(camera) {
    if (window.__ucanV254IsRiding && window.__ucanV254IsRiding()) return;
    if (syncStableFloorFromXRV287()) return;
    if (!camera?.position) return;

    const inCenterAisle = camera.position.x > -4.8 && camera.position.x < 1.2 && camera.position.z > -14 && camera.position.z < 18.8;
    const inSideAisle = camera.position.x > 18.2 && camera.position.x < 22.8 && camera.position.z > -8 && camera.position.z < 18.8;

    // El desnivel del anfiteatro existe únicamente cuando el estado explícito es Piso 3.
    if (ucanStableFloorV287 === LEVEL.three && (inCenterAisle || inSideAisle)) {
      const z0 = inCenterAisle ? -12 : -7;
      const z1 = 17.4;
      const rise = inCenterAisle ? 2.38 : 2.04;
      const t = Math.max(0, Math.min(1, (camera.position.z - z0) / (z1 - z0)));
      camera.position.y = LEVEL.three + PLAYER_HEIGHT + rise * t;
      if (++ucanFloorAuditFrameV287 % 30 === 0) publishFloorStateV287();
      return;
    }

    // Todos los demás espacios permanecen bloqueados en el piso confirmado.
    const expectedY = ucanStableFloorV287 + PLAYER_HEIGHT;
    if (Math.abs(camera.position.y - expectedY) > 0.035) {
      const attemptedY = camera.position.y;
      camera.position.y = expectedY;
      ucanFloorCorrectionsV287 += 1;
      ucanLastFloorCorrectionV287 = {
        floorBase:ucanStableFloorV287,
        floorNumber:floorNumberV287(ucanStableFloorV287),
        attemptedY,
        restoredY:expectedY,
        x:camera.position.x,
        z:camera.position.z,
        at:new Date().toISOString()
      };
    }
    if (++ucanFloorAuditFrameV287 % 30 === 0) publishFloorStateV287();
  }


  function setupReliableMovement`;

function replaceExactlyOnce(code, search, replacement, label) {
  const count = typeof search === 'string'
    ? code.split(search).length - 1
    : Array.from(code.matchAll(new RegExp(search.source, search.flags.includes('g') ? search.flags : search.flags + 'g'))).length;
  if (count !== 1) throw new Error(`${label}: se esperaba 1 coincidencia y se encontraron ${count}.`);
  return code.replace(search, replacement);
}

function patchMainScene(source) {
  let code = String(source || '');
  if (code.includes('__UCAN_FLOOR_STATE_V287__')) {
    return { code, patched:true, alreadyPatched:true, checks:{ marker:true } };
  }

  const checks = {};
  code = replaceExactlyOnce(code, HELPER_ANCHOR, `${HELPER_ANCHOR}${FLOOR_HELPERS}`, 'helper-anchor');
  checks.helpers = code.includes('__UCAN_FLOOR_STATE_V287__');

  code = replaceExactlyOnce(code, CLAMP_PATTERN, CLAMP_REPLACEMENT, 'clamp-function');
  checks.clampReplaced = code.includes('ucanStableFloorV287 === LEVEL.three') && !code.includes('const floors=[LEVEL.one+PLAYER_HEIGHT');

  code = replaceExactlyOnce(
    code,
    RIDE_ANCHOR,
    "          camera.position.copyFrom(zone.to.clone());\n          setStableFloorFromEyeYV287(camera.position.y, `route:${zone.id}`);\n          camera.setTarget(zone.lookTo.clone());",
    'route-completion'
  );
  checks.routeCompletion = code.includes('setStableFloorFromEyeYV287(camera.position.y, `route:${zone.id}`)');

  code = replaceExactlyOnce(
    code,
    NAVIGATE_ANCHOR,
    "    const destinationPosition = target.pos();\n    camera.position.copyFrom(destinationPosition);\n    setStableFloorFromEyeYV287(destinationPosition.y, `navigate:${key}`);\n    camera.setTarget(target.target());",
    'navigate-to-area'
  );
  checks.navigation = code.includes('setStableFloorFromEyeYV287(destinationPosition.y, `navigate:${key}`)');

  code = replaceExactlyOnce(
    code,
    RESET_ANCHOR,
    "    camera.position.copyFrom(safe);\n    setStableFloorFromEyeYV287(safe.y, 'reset-safe-point');\n    camera.setTarget(target);",
    'reset-safe-point'
  );
  checks.reset = code.includes("setStableFloorFromEyeYV287(safe.y, 'reset-safe-point')");

  code = replaceExactlyOnce(
    code,
    API_ANCHOR,
    "      const destinationPosition=target.pos(); activeCamera.position.copyFrom(destinationPosition); setStableFloorFromEyeYV287(destinationPosition.y, `api:${key}`); activeCamera.setTarget(target.target()); return true;",
    'api-go-to-area'
  );
  checks.apiNavigation = code.includes('setStableFloorFromEyeYV287(destinationPosition.y, `api:${key}`)');

  checks.oldTransientNearestRemoved = !code.includes('const floors=[LEVEL.one+PLAYER_HEIGHT,LEVEL.two+PLAYER_HEIGHT,LEVEL.three+PLAYER_HEIGHT,LEVEL.rooftop+PLAYER_HEIGHT]');
  checks.all = Object.values(checks).every(Boolean);
  if (!checks.all) throw new Error(`La corrección V287 quedó incompleta: ${JSON.stringify(checks)}`);

  return { code, patched:true, alreadyPatched:false, checks };
}

module.exports = { VERSION, BUILD, patchMainScene };
