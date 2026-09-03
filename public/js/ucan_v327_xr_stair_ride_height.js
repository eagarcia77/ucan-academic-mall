(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V327';
  const REVISION = 'R31';
  const BUILD = 'V327-20260903-XR-AUTO-STAIRS-HEIGHT-R31';
  const AUTO_SPEED = 3.35;
  const LANDING_CLEARANCE = 2.6;
  const DEFAULT_EYE_HEIGHT = 1.68;
  const MIN_REASONABLE_LOCAL_EYE = 1.05;
  const MAX_EYE_CORRECTION = 1.72;
  const ROUTE_TIMEOUT_MS = 12000;

  const ROUTES = Object.freeze({
    up12:  { fromFloor:0,    toFloor:8.2,  centerX:-20, halfWidth:3.45, fromZ:32,   toZ:10,   direction:-1 },
    down21:{ fromFloor:8.2,  toFloor:0,    centerX:-8,  halfWidth:3.45, fromZ:10,   toZ:32,   direction:1 },
    up23:  { fromFloor:8.2,  toFloor:16.4, centerX:-34, halfWidth:3.45, fromZ:32,   toZ:10,   direction:-1 },
    down32:{ fromFloor:16.4, toFloor:8.2,  centerX:-26, halfWidth:3.45, fromZ:10,   toZ:32,   direction:1 },
    up34:  { fromFloor:16.4, toFloor:27.2, centerX:44,  halfWidth:4.55, fromZ:39,   toZ:10.5, direction:-1 },
    down34:{ fromFloor:27.2, toFloor:16.4, centerX:44,  halfWidth:4.55, fromZ:10.5, toZ:39,   direction:1 }
  });

  const state = {
    installed:false,
    scene:null,
    helper:null,
    xr:null,
    desktop:null,
    observer:null,
    ride:null,
    eyeCorrection:0,
    eyeCalibrated:false,
    localEyeHeight:null,
    ridesStarted:0,
    ridesCompleted:0,
    forcedCompletions:0,
    heightCorrections:0,
    frames:0,
    lastGround:0,
    lastWorld:null,
    lastError:null
  };

  const clamp = (v,a,b) => Math.max(a, Math.min(b, Number(v) || 0));
  const lerp = (a,b,t) => a + (b-a) * t;
  const stairApi = () => window.__UCAN_STAIR_AUTHORITY_V322__ || null;
  const xrApi = () => window.__UCAN_XR_STAIRS_ENTRY_V324__ || null;
  const landingApi = () => window.__UCAN_XR_LANDING_RELEASE_V326__ || null;

  function fail(stage,error) {
    state.lastError = { stage, message:String(error?.message || error), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    publish();
  }

  function inXR() {
    const X = B.WebXRState || {};
    const value = state.helper?.baseExperience?.state;
    return value === X.ENTERING_XR || value === X.IN_XR || xrApi()?.getState?.().inXR === true;
  }

  function root() {
    return state.xr?.parent || null;
  }

  function worldPosition() {
    try {
      state.xr?.computeWorldMatrix?.(true);
      const value = state.xr?.globalPosition || state.xr?.getAbsolutePosition?.() || state.xr?.position;
      return value?.clone?.() || null;
    } catch (_) { return null; }
  }

  function progress(route,z) {
    return clamp((Number(z) - route.fromZ) / (route.toZ - route.fromZ), 0, 1);
  }

  function calibrateEye(force=false) {
    if (!state.xr || !root() || (!force && state.eyeCalibrated)) return;
    const localY = Number(state.xr.position?.y);
    if (!Number.isFinite(localY)) return;
    state.localEyeHeight = localY;
    const correction = localY < MIN_REASONABLE_LOCAL_EYE
      ? clamp(DEFAULT_EYE_HEIGHT - localY, 0, MAX_EYE_CORRECTION)
      : 0;
    state.eyeCorrection = correction;
    state.eyeCalibrated = true;
    if (correction > 0.01) state.heightCorrections += 1;
  }

  function applyGround(ground) {
    const locomotionRoot = root();
    if (!locomotionRoot) return;
    locomotionRoot.position.y = Number(ground) + state.eyeCorrection;
    state.lastGround = Number(ground);
  }

  function syncDesktop(ground) {
    const position = worldPosition();
    if (!position || !state.desktop?.position) return;
    state.desktop.position.x = position.x;
    state.desktop.position.z = position.z;
    state.desktop.position.y = Number(ground) + 1.72;
    state.lastWorld = { x:position.x, y:Number(ground), z:position.z };
  }

  function beginRide(routeId) {
    const route = ROUTES[routeId];
    const position = worldPosition();
    if (!route || !position || !root()) return false;
    state.ride = {
      routeId,
      startedAt:performance.now(),
      deadline:performance.now()+ROUTE_TIMEOUT_MS,
      initialProgress:progress(route,position.z)
    };
    state.ridesStarted += 1;
    return true;
  }

  function exactFinish(route,forced=false) {
    const locomotionRoot = root();
    const position = worldPosition();
    if (!locomotionRoot || !position) return false;

    const targetZ = route.toZ + route.direction * LANDING_CLEARANCE;
    locomotionRoot.position.x += route.centerX - position.x;
    const refreshed = worldPosition();
    if (refreshed) locomotionRoot.position.z += targetZ - refreshed.z;

    stairApi()?.setFloor?.(route.toFloor,'v327-exact-completion');
    applyGround(route.toFloor);
    syncDesktop(route.toFloor);
    if (forced) state.forcedCompletions += 1;
    state.ridesCompleted += 1;
    state.ride = null;
    return true;
  }

  function rideFrame(dt) {
    const active = stairApi()?.getState?.().activeRoute || null;
    if (!state.ride && active && ROUTES[active]) beginRide(active);
    if (!state.ride) return false;

    const route = ROUTES[state.ride.routeId];
    const locomotionRoot = root();
    const position = worldPosition();
    if (!route || !locomotionRoot || !position) return false;

    // Mantiene al usuario dentro del eje de la escalera sin bloquear la orientación de la cabeza.
    const desiredX = clamp(position.x, route.centerX-route.halfWidth+0.65, route.centerX+route.halfWidth-0.65);
    const centeredX = lerp(desiredX, route.centerX, clamp(dt*2.2,0,1));
    locomotionRoot.position.x += centeredX - position.x;

    // La escalera transporta automáticamente aunque el joystick quede en neutral.
    const remaining = (route.toZ - position.z) * route.direction;
    if (remaining > 0.015) {
      locomotionRoot.position.z += route.direction * Math.min(AUTO_SPEED*dt, remaining);
    }

    const afterMove = worldPosition();
    if (!afterMove) return true;
    const t = progress(route,afterMove.z);
    const expectedGround = lerp(route.fromFloor,route.toFloor,t);

    // Mantiene sincronizada la autoridad V322 y aplica el mismo desnivel al rig completo.
    const resolved = stairApi()?.resolveGround?.(afterMove,expectedGround);
    const stairState = stairApi()?.getState?.() || {};
    const ground = Number.isFinite(Number(resolved)) ? Number(resolved) : expectedGround;
    applyGround(stairState.activeRoute ? expectedGround : ground);
    syncDesktop(stairState.activeRoute ? expectedGround : ground);

    if (t >= 0.982 || !stairState.activeRoute) {
      return exactFinish(route,false);
    }

    if (performance.now() >= state.ride.deadline) {
      return exactFinish(route,true);
    }
    return true;
  }

  function repairBetweenFloors() {
    if (state.ride || !inXR()) return;
    const stair = stairApi()?.getState?.() || {};
    const stable = Number(stair.stableFloor);
    if (!Number.isFinite(stable)) return;
    applyGround(stable);
    syncDesktop(stable);
  }

  function frame() {
    if (!inXR()) {
      state.ride = null;
      state.eyeCalibrated = false;
      return;
    }
    try {
      state.frames += 1;
      calibrateEye(false);
      const dt = clamp((state.scene?.getEngine?.().getDeltaTime?.() || 16)/1000,0.001,0.05);
      const riding = rideFrame(dt);
      if (!riding) repairBetweenFloors();
      publish();
    } catch (error) { fail('frame',error); }
  }

  function getState() {
    return {
      installed:state.installed,
      xrOnly:true,
      automaticStairRide:true,
      exactFloorSnap:true,
      preventsBetweenFloors:true,
      eyeHeightCorrection:true,
      defaultEyeHeight:DEFAULT_EYE_HEIGHT,
      localEyeHeight:state.localEyeHeight,
      eyeCorrection:state.eyeCorrection,
      activeRide:state.ride?.routeId || null,
      ridesStarted:state.ridesStarted,
      ridesCompleted:state.ridesCompleted,
      forcedCompletions:state.forcedCompletions,
      heightCorrections:state.heightCorrections,
      frames:state.frames,
      stableFloor:stairApi()?.getState?.().stableFloor ?? null,
      activeRoute:stairApi()?.getState?.().activeRoute ?? null,
      landingV326Active:Boolean(landingApi()?.installed),
      lastGround:state.lastGround,
      lastWorld:state.lastWorld,
      lastError:state.lastError
    };
  }

  function publish() {
    window.__UCAN_XR_STAIR_RIDE_V327__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      ...getState(),
      getState,
      recalibrateEye:()=>{ state.eyeCalibrated=false; calibrateEye(true); publish(); }
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    state.xr = state.helper?.baseExperience?.camera || null;
    state.desktop = window.__UCAN_API__?.getCamera?.() || state.scene?.activeCamera || null;

    // Espera V324 y V326 para registrar este observador al final y tener la última palabra vertical.
    if (!state.scene || !state.helper || !state.xr || !state.desktop ||
        !window.__UCAN_XR_STAIRS_ENTRY_V324__?.installed ||
        !stairApi()?.installed ||
        !landingApi()?.installed) return false;

    state.observer = state.scene.onBeforeRenderObservable.add(frame);
    state.installed = true;
    publish();
    console.info('[UCAN V327 R31] Altura WebXR y transporte automático de escaleras activos.');
    return true;
  }

  let attempts=0;
  const timer=window.setInterval(()=>{
    attempts+=1;
    try {
      if (install() || attempts>=900) window.clearInterval(timer);
    } catch (error) {
      fail('install',error);
      if (attempts>=900) window.clearInterval(timer);
    }
  },100);

  publish();
})();
