(() => {
  'use strict';

  const VERSION = 'V285';
  const BUILD = 'V285-20260720-DESKTOP-FLOOR-LOCK';
  const B = window.BABYLON;
  if (!B) return;

  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const FLOORS = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]);
  const PLAYER_HEIGHT = 1.72;
  const states = new WeakMap();

  const finite = value => Number.isFinite(Number(value));
  const near = (a, b, epsilon = 0.62) => Math.abs(Number(a) - Number(b)) <= epsilon;
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

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function updateAudit(state) {
    window.__UCAN_DESKTOP_FLOOR_LOCK_AUDIT__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      phase:'onBeforeCameraRender',
      runsAfterSceneHeightAdjustments:true,
      lowerFloorsLockedInCenter:true,
      floorOneCenterProtected:true,
      floorTwoCenterProtected:true,
      sideAisleProtected:true,
      theaterHeightRequiresConfirmedFloorThree:true,
      escalatorTransitionsPreserved:true,
      xrControllerPreserved:'V283',
      stableFloor:state.stableFloor,
      corrections:state.corrections,
      lastCorrection:state.lastCorrection,
      observerAttached:state.observerAttached,
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

  function protectFloor(state) {
    if (xrActive() || rideActive()) return;
    const position = state.camera?.position;
    if (!position || !finite(position.x) || !finite(position.y) || !finite(position.z)) return;

    const aisle = inTheaterAisle(position);

    // El piso estable solo se actualiza fuera del pasillo del anfiteatro. Esto evita
    // que la elevación defectuosa del código heredado convierta el Piso 1 o 2 en Piso 3.
    if (!aisle) {
      const candidate = nearestFloor(position.y - PLAYER_HEIGHT);
      if (near(position.y, candidate + PLAYER_HEIGHT)) state.stableFloor = candidate;
      if (++state.auditFrame % 30 === 0) updateAudit(state);
      return;
    }

    // El desnivel del anfiteatro se permite únicamente cuando el usuario llegó
    // legítimamente al Piso 3 desde una zona exterior al pasillo.
    if (state.stableFloor < LEVEL.three - 0.1) {
      const expectedY = state.stableFloor + PLAYER_HEIGHT;
      if (!near(position.y, expectedY, 0.12)) {
        const attemptedY = position.y;
        position.y = expectedY;
        state.corrections += 1;
        state.lastCorrection = {
          floor:state.stableFloor,
          attemptedY,
          restoredY:expectedY,
          x:position.x,
          z:position.z,
          at:new Date().toISOString()
        };
        if (state.corrections === 1 || state.corrections % 120 === 0) {
          setStatus(`V285: Piso ${state.stableFloor === LEVEL.one ? 1 : 2} bloqueado correctamente; el centro no puede elevar al Piso 3.`);
        }
      }
    }

    if (++state.auditFrame % 30 === 0) updateAudit(state);
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
      auditFrame:0,
      observerAttached:false
    };
    states.set(scene, state);

    // Esta fase ocurre después de onBeforeRenderObservable, donde el código heredado
    // aplica la elevación incorrecta, pero antes de que la cámara dibuje el fotograma.
    scene.onBeforeCameraRenderObservable.add(() => protectFloor(state));
    state.observerAttached = true;

    updateAudit(state);
    console.info('[UCAN V285] Bloqueo definitivo de pisos 1 y 2 instalado antes del renderizado de cámara.');
    return true;
  }

  function boot(attempt = 0) {
    try {
      if (install()) return;
    } catch (error) {
      console.error('[UCAN V285] No se pudo instalar el bloqueo de pisos:', error);
    }
    if (attempt < 120) window.setTimeout(() => boot(attempt + 1), 100);
  }

  window.__UCAN_DESKTOP_FLOOR_LOCK_BOOT__ = {
    version:VERSION,
    build:BUILD,
    ready:true,
    phase:'onBeforeCameraRender',
    lowerFloorsLockedInCenter:true,
    theaterHeightRequiresConfirmedFloorThree:true
  };

  boot();
})();
