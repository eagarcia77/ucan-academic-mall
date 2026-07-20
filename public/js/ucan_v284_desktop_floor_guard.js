(() => {
  'use strict';

  const VERSION = 'V284';
  const BUILD = 'V284-20260720-DESKTOP-FLOOR-GUARD';
  const B = window.BABYLON;
  if (!B) return;

  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const FLOORS = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]);
  const PLAYER_HEIGHT = 1.72;
  const states = new WeakMap();

  const finite = value => Number.isFinite(Number(value));
  const near = (a, b, epsilon = 0.58) => Math.abs(Number(a) - Number(b)) <= epsilon;
  const nearestFloor = value => FLOORS.reduce((best, floor) => Math.abs(value - floor) < Math.abs(value - best) ? floor : best, FLOORS[0]);

  function inTheaterAisle(position) {
    if (!position) return false;
    const center = position.x > -4.8 && position.x < 1.2 && position.z > -14 && position.z < 18.8;
    const side = position.x > 18.2 && position.x < 22.8 && position.z > -8 && position.z < 18.8;
    return center || side;
  }

  function rideActive() {
    try { return Boolean(window.__ucanV254IsRiding?.()); }
    catch (_) { return false; }
  }

  function xrActive() {
    try { return Boolean(window.__UCAN_UNIFIED_XR_AUDIT__?.inXR); }
    catch (_) { return false; }
  }

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function updateAudit(state) {
    window.__UCAN_DESKTOP_FLOOR_GUARD_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      desktopOnly:true,
      theaterHeightRequiresFloorThree:true,
      floorOneCenterProtected:true,
      floorTwoCenterProtected:true,
      sideAisleProtected:true,
      escalatorTransitionsPreserved:true,
      xrControllerPreserved:'V283',
      stableFloor:state.stableFloor,
      corrections:state.corrections,
      lastCorrection:state.lastCorrection,
      getState:() => ({
        stableFloor:state.stableFloor,
        corrections:state.corrections,
        lastCorrection:state.lastCorrection,
        position:state.camera?.position ? {
          x:state.camera.position.x,
          y:state.camera.position.y,
          z:state.camera.position.z
        } : null
      })
    };
  }

  function install() {
    const scene = window.__UCAN_API__?.getScene?.();
    const camera = window.__UCAN_API__?.getCamera?.();
    if (!scene || !camera?.position) return false;
    if (states.has(scene)) return true;

    const initialGround = nearestFloor(Number(camera.position.y || PLAYER_HEIGHT) - PLAYER_HEIGHT);
    const state = {
      scene,
      camera,
      stableFloor:initialGround,
      corrections:0,
      lastCorrection:null,
      auditFrame:0
    };
    states.set(scene, state);

    scene.onBeforeRenderObservable.add(() => {
      if (xrActive() || rideActive()) return;
      const position = state.camera?.position;
      if (!position || !finite(position.x) || !finite(position.y) || !finite(position.z)) return;

      const aisle = inTheaterAisle(position);
      const erroneousLift = aisle
        && state.stableFloor < LEVEL.three - 0.1
        && position.y > LEVEL.two + PLAYER_HEIGHT + 2.0;

      if (erroneousLift) {
        const attemptedY = position.y;
        position.y = state.stableFloor + PLAYER_HEIGHT;
        state.corrections += 1;
        state.lastCorrection = {
          floor:state.stableFloor,
          attemptedY,
          restoredY:position.y,
          x:position.x,
          z:position.z,
          at:new Date().toISOString()
        };
        if (state.corrections === 1 || state.corrections % 120 === 0) {
          status(`V284: se mantuvo correctamente el Piso ${state.stableFloor === LEVEL.one ? 1 : 2}; el pasillo del anfiteatro solo eleva en el Piso 3.`);
        }
      } else {
        const candidate = nearestFloor(position.y - PLAYER_HEIGHT);
        if (near(position.y, candidate + PLAYER_HEIGHT, 0.62)) state.stableFloor = candidate;
      }

      if (++state.auditFrame % 30 === 0) updateAudit(state);
    });

    updateAudit(state);
    console.info('[UCAN V284] Protección de pisos 1 y 2 contra elevación accidental al anfiteatro instalada.');
    return true;
  }

  function boot(attempt = 0) {
    try {
      if (install()) return;
    } catch (error) {
      console.error('[UCAN V284] No se pudo instalar la protección de pisos:', error);
    }
    if (attempt < 80) window.setTimeout(() => boot(attempt + 1), 100);
  }

  window.__UCAN_DESKTOP_FLOOR_GUARD_BOOT__ = {
    version:VERSION,
    build:BUILD,
    ready:true,
    desktopFloorGuard:true,
    theaterHeightRequiresFloorThree:true,
    floorOneAndTwoCenterProtected:true
  };

  boot();
})();
