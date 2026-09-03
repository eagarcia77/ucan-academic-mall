(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V328';
  const REVISION = 'R34';
  const BUILD = 'V328-20260903-DYNAMIC-DAY-NIGHT-R34';
  const TARGET_EYE_HEIGHT = 1.72;
  const MAX_UP_CORRECTION = 1.72;
  const MAX_DOWN_CORRECTION = 0.55;
  const ENTRY_DEPTH = 5.8;
  const ENTRY_WIDTH_ASSIST = 1.25;
  const LANDING_CLEARANCE = 2.7;
  const RIDE_COOLDOWN = 1800;
  const JUMP_VELOCITY = 4.4;
  const JUMP_GRAVITY = 12.5;
  const LEVELS = Object.freeze([0, 8.2, 16.4, 27.2]);

  window.__UCAN_XR_FINAL_AUTHORITY_V328_PRELOAD__ = {
    version:VERSION,
    revision:REVISION,
    build:BUILD,
    loaded:true
  };

  const ROUTES = Object.freeze({
    up12:  { id:'up12', fromFloor:0,    toFloor:8.2,  centerX:-20, halfWidth:3.45, fromZ:32,   toZ:10,   direction:-1, duration:2800, label:'Subiendo al Piso 2' },
    down21:{ id:'down21',fromFloor:8.2,  toFloor:0,    centerX:-8,  halfWidth:3.45, fromZ:10,   toZ:32,   direction:1,  duration:2800, label:'Bajando al Piso 1' },
    up23:  { id:'up23', fromFloor:8.2,  toFloor:16.4, centerX:-34, halfWidth:3.45, fromZ:32,   toZ:10,   direction:-1, duration:2800, label:'Subiendo al Piso 3' },
    down32:{ id:'down32',fromFloor:16.4, toFloor:8.2,  centerX:-26, halfWidth:3.45, fromZ:10,   toZ:32,   direction:1,  duration:2800, label:'Bajando al Piso 2' },
    up34:  { id:'up34', fromFloor:16.4, toFloor:27.2, centerX:44,  halfWidth:4.55, fromZ:39,   toZ:10.5, direction:-1, duration:4000, label:'Subiendo a la terraza' },
    down34:{ id:'down34',fromFloor:27.2, toFloor:16.4, centerX:44,  halfWidth:4.55, fromZ:10.5, toZ:39,   direction:1,  duration:4000, label:'Bajando al Piso 3' }
  });

  const HAZARDS = Object.freeze([
    { floor:0,    centerX:-20, halfWidth:4.35, z1:10,   z2:32,   id:'bajo-up12' },
    { floor:0,    centerX:-8,  halfWidth:4.35, z1:10,   z2:32,   id:'bajo-down21' },
    { floor:8.2,  centerX:-34, halfWidth:4.35, z1:10,   z2:32,   id:'bajo-up23' },
    { floor:8.2,  centerX:-26, halfWidth:4.35, z1:10,   z2:32,   id:'bajo-down32' },
    { floor:16.4, centerX:44,  halfWidth:5.35, z1:10.5, z2:39,   id:'bajo-terraza' }
  ]);

  const AREAS = Object.freeze({
    foodcourt:{ floor:0, x:0, z:42 },
    cafeteria:{ floor:0, x:-56, z:12 },
    library:{ floor:0, x:56, z:12 },
    floor2:{ floor:8.2, x:0, z:42 },
    class201:{ floor:8.2, x:-56, z:12 },
    class202:{ floor:8.2, x:-28, z:-20 },
    class203:{ floor:8.2, x:0, z:-20 },
    class204:{ floor:8.2, x:28, z:-20 },
    class205:{ floor:8.2, x:56, z:12 },
    theater:{ floor:16.4, x:0, z:38 },
    rooftop:{ floor:27.2, x:0, z:42 },
    rooftopWeather:{ floor:27.2, x:-33, z:38 },
    rooftopAgenda:{ floor:27.2, x:34, z:37 },
    rooftopMoon:{ floor:27.2, x:-33, z:-38 },
    rooftopSky:{ floor:27.2, x:0, z:-37 },
    rooftopCalendar:{ floor:27.2, x:34, z:-37 }
  });

  const state = {
    installed:false,
    scene:null,
    helper:null,
    xr:null,
    desktop:null,
    observer:null,
    xrStateObserver:null,
    inXR:false,
    ride:null,
    stableFloor:0,
    eyeBaseline:null,
    eyeOffset:0,
    calibrationSamples:[],
    calibrationStartedAt:0,
    calibrated:false,
    jumpOffset:0,
    jumpVelocity:0,
    jumping:false,
    jumpLatch:false,
    rollbackLatch:false,
    lastSafe:null,
    previousSafe:null,
    hazardBlocks:0,
    ridesStarted:0,
    ridesCompleted:0,
    exactSnaps:0,
    assistedRides:0,
    lastRideFinishedAt:0,
    lastCompletedRoute:null,
    calibrations:0,
    legacyObserversRemoved:0,
    navigationPatched:false,
    lastHazardWarningAt:0,
    lastError:null,
    frames:0,
    visualSnapshot:null
  };

  const clamp = (value,min,max) => Math.max(min, Math.min(max, Number(value) || 0));
  const lerp = (a,b,t) => a + (b-a) * t;
  const smoothStep = t => t*t*(3-2*t);
  const finite = value => Number.isFinite(Number(value));
  const near = (a,b,e=0.25) => Math.abs(Number(a)-Number(b)) <= e;
  const stairApi = () => window.__UCAN_STAIR_AUTHORITY_V322__ || null;
  const xrApi = () => window.__UCAN_XR_STAIRS_ENTRY_V324__ || null;

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function fail(stage,error) {
    state.lastError = { stage, message:String(error?.message || error || 'Error XR'), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    publish();
  }

  function nearestFloor(value) {
    return LEVELS.reduce((best,floor) => Math.abs(Number(value)-floor) < Math.abs(Number(value)-best) ? floor : best, LEVELS[0]);
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

  function localEyeHeight() {
    const values = [state.xr?.position?.y, state.xr?.realWorldHeight, state.xr?._realWorldHeight].map(Number);
    const local = values.find(value => finite(value) && value >= 0 && value <= 2.5);
    return finite(local) ? local : TARGET_EYE_HEIGHT;
  }

  function median(values) {
    const sorted = values.filter(finite).map(Number).sort((a,b)=>a-b);
    if (!sorted.length) return TARGET_EYE_HEIGHT;
    const middle = Math.floor(sorted.length/2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
  }

  function beginCalibration(force=false) {
    if (!state.inXR && !force) return false;
    state.calibrationSamples = [];
    state.calibrationStartedAt = performance.now();
    state.calibrated = false;
    return true;
  }

  function calibrationFrame() {
    if (state.calibrated || state.ride || !state.inXR) return;
    const elapsed = performance.now() - state.calibrationStartedAt;
    if (elapsed < 180) return;
    const sample = localEyeHeight();
    if (finite(sample)) state.calibrationSamples.push(sample);
    if (state.calibrationSamples.length < 18 && elapsed < 1000) return;
    const baseline = median(state.calibrationSamples);
    state.eyeBaseline = baseline;
    state.eyeOffset = clamp(TARGET_EYE_HEIGHT - baseline, -MAX_DOWN_CORRECTION, MAX_UP_CORRECTION);
    state.calibrated = true;
    state.calibrations += 1;
    applyGround(state.stableFloor,'calibration');
    status(`Altura VR calibrada a ${TARGET_EYE_HEIGHT.toFixed(2)} m para coincidir con la computadora.`);
  }

  function applyGround(ground,reason='ground') {
    const locomotionRoot = root();
    if (!locomotionRoot) return false;
    const value = Number(ground);
    if (!finite(value)) return false;
    state.stableFloor = state.ride ? state.stableFloor : nearestFloor(value);
    locomotionRoot.position.y = value + state.eyeOffset + state.jumpOffset;
    return true;
  }

  function setWorldXZ(x,z) {
    const locomotionRoot = root();
    const world = worldPosition();
    if (!locomotionRoot || !world) return false;
    locomotionRoot.position.x += Number(x) - world.x;
    const afterX = worldPosition();
    if (afterX) locomotionRoot.position.z += Number(z) - afterX.z;
    return true;
  }

  function syncDesktop(ground=state.stableFloor) {
    const world = worldPosition();
    if (!world || !state.desktop?.position) return;
    state.desktop.position.x = world.x;
    state.desktop.position.z = world.z;
    state.desktop.position.y = Number(ground) + TARGET_EYE_HEIGHT;
  }

  function controller(hand) {
    return (state.helper?.input?.controllers || []).find(item => (item?.inputSource?.handedness || item?.motionController?.handedness) === hand) || null;
  }

  function components(hand) {
    const motion = controller(hand)?.motionController;
    if (!motion) return [];
    if (motion.components && typeof motion.components === 'object') return Object.entries(motion.components).map(([id,value])=>({id,value}));
    try { return (motion.getComponentIds?.() || []).map(id=>({id,value:motion.getComponent?.(id)})); }
    catch (_) { return []; }
  }

  function componentPressed(hand,pattern) {
    return components(hand).some(({id,value}) => pattern.test(String(id)) && (value?.pressed === true || Number(value?.value || 0) > 0.72));
  }

  function buttonPressed(hand,indexes) {
    const gamepad = controller(hand)?.inputSource?.gamepad || controller(hand)?.motionController?.gamepadObject || controller(hand)?.motionController?.gamepad;
    const buttons = Array.from(gamepad?.buttons || []);
    return indexes.some(index => buttons[index]?.pressed === true || Number(buttons[index]?.value || 0) > 0.72);
  }

  function jumpPressed() {
    return componentPressed('right',/(?:^|[-_])a-?button|thumbstick/i) || buttonPressed('right',[3,4]);
  }

  function rollbackPressed() {
    return componentPressed('right',/(?:^|[-_])b-?button/i) || buttonPressed('right',[5]);
  }

  function updateJump(dt) {
    const pressed = jumpPressed();
    if (pressed && !state.jumpLatch && !state.ride && !state.jumping) {
      state.jumping = true;
      state.jumpVelocity = JUMP_VELOCITY;
      state.jumpOffset = 0;
      status('Brinco VR activado.');
    }
    state.jumpLatch = pressed;
    if (!state.jumping || state.ride) {
      if (state.ride) { state.jumping=false; state.jumpVelocity=0; state.jumpOffset=0; }
      return;
    }
    state.jumpVelocity -= JUMP_GRAVITY*dt;
    state.jumpOffset += state.jumpVelocity*dt;
    if (state.jumpOffset <= 0) {
      state.jumpOffset=0;
      state.jumpVelocity=0;
      state.jumping=false;
    }
  }

  function entryRoute() {
    if (state.ride) return null;
    if (performance.now()-state.lastRideFinishedAt < RIDE_COOLDOWN) return null;
    const world = worldPosition();
    if (!world) return null;
    const stable = Number(stairApi()?.getState?.().stableFloor);
    const floor = finite(stable) ? nearestFloor(stable) : state.stableFloor;
    const active = stairApi()?.getState?.().activeRoute;
    if (active && ROUTES[active]) return ROUTES[active];
    return Object.values(ROUTES).find(route =>
      near(floor,route.fromFloor,0.2) &&
      Math.abs(world.x-route.centerX) <= route.halfWidth+ENTRY_WIDTH_ASSIST &&
      Math.abs(world.z-route.fromZ) <= ENTRY_DEPTH
    ) || null;
  }

  function beginRide(route) {
    const world = worldPosition();
    if (!route || !world || !root()) return false;
    state.previousSafe = state.lastSafe?.clone?.() || world.clone();
    state.ride = {
      route,
      startedAt:performance.now(),
      startX:world.x,
      startZ:world.z
    };
    state.stableFloor = route.fromFloor;
    state.jumping=false;
    state.jumpOffset=0;
    state.jumpVelocity=0;
    stairApi()?.setFloor?.(route.fromFloor,'v328-auto-ride-start');
    state.ridesStarted += 1;
    status(`${route.label}. Transporte automático activado; no necesita mover el joystick.`);
    return true;
  }

  function exactFinish(route) {
    const landingZ = route.toZ + route.direction*LANDING_CLEARANCE;
    setWorldXZ(route.centerX,landingZ);
    stairApi()?.setFloor?.(route.toFloor,'v328-exact-landing');
    state.stableFloor = route.toFloor;
    state.ride = null;
    state.jumpOffset=0;
    applyGround(route.toFloor,'exact-finish');
    syncDesktop(route.toFloor);
    const current = worldPosition();
    if (current) state.lastSafe = current.clone();
    state.ridesCompleted += 1;
    state.exactSnaps += 1;
    state.lastRideFinishedAt=performance.now();
    state.lastCompletedRoute=route.id;
    status(`${route.label} completado. Piso fijado exactamente en ${route.toFloor.toFixed(1)} m.`);
  }

  function updateRide() {
    const ride = state.ride;
    if (!ride) return false;
    const route = ride.route;
    const raw = clamp((performance.now()-ride.startedAt)/route.duration,0,1);
    const t = smoothStep(raw);
    const x = lerp(ride.startX,route.centerX,clamp(t*2.2,0,1));
    const z = lerp(ride.startZ,route.toZ,t);
    const ground = lerp(route.fromFloor,route.toFloor,t);
    setWorldXZ(x,z);
    applyGround(ground,'ride');
    syncDesktop(ground);
    if (raw >= 1) exactFinish(route);
    return true;
  }

  function insideHazard(world,hazard) {
    const minZ = Math.min(hazard.z1,hazard.z2)+3.4;
    const maxZ = Math.max(hazard.z1,hazard.z2)-3.4;
    return near(state.stableFloor,hazard.floor,0.25) &&
      Math.abs(world.x-hazard.centerX) <= hazard.halfWidth &&
      world.z >= minZ && world.z <= maxZ;
  }

  function guardUnderStairs() {
    if (state.ride || !state.inXR) return false;
    const world = worldPosition();
    if (!world) return false;
    const hazard = HAZARDS.find(item => insideHazard(world,item));
    if (!hazard) return false;
    const side = world.x < hazard.centerX ? -1 : 1;
    setWorldXZ(hazard.centerX + side*(hazard.halfWidth+0.8),world.z);
    state.hazardBlocks += 1;
    const now = performance.now();
    if (now-state.lastHazardWarningAt > 1200) {
      state.lastHazardWarningAt=now;
      status('Zona bajo escalera bloqueada por seguridad. Use la entrada de la escalera correspondiente.');
    }
    return true;
  }

  function repairBetweenFloors() {
    if (state.ride) return;
    const stair = stairApi()?.getState?.() || {};
    const stable = finite(stair.stableFloor) ? nearestFloor(stair.stableFloor) : state.stableFloor;
    state.stableFloor = stable;
    applyGround(stable,'stable-floor-repair');
    syncDesktop(stable);
  }

  function rollback() {
    if (!state.lastSafe) return false;
    const world = worldPosition();
    if (world) state.previousSafe = world.clone();
    setWorldXZ(state.lastSafe.x,state.lastSafe.z);
    stairApi()?.setFloor?.(state.stableFloor,'v328-rollback');
    state.ride=null;
    state.jumping=false;
    state.jumpOffset=0;
    applyGround(state.stableFloor,'rollback');
    syncDesktop(state.stableFloor);
    status('Posición VR restaurada al último punto seguro.');
    return true;
  }

  function updateRollback() {
    const pressed = rollbackPressed();
    if (pressed && !state.rollbackLatch) rollback();
    state.rollbackLatch = pressed;
  }

  function rememberSafe() {
    if (state.ride || state.jumping) return;
    const world = worldPosition();
    if (!world) return;
    if (HAZARDS.some(item=>insideHazard(world,item))) return;
    state.lastSafe = world.clone();
  }

  function teleportTo(key,source='panel') {
    const target = AREAS[key];
    if (!target || !root()) return false;
    const current = worldPosition();
    if (current) state.previousSafe = current.clone();
    state.ride=null;
    state.jumping=false;
    state.jumpOffset=0;
    state.jumpVelocity=0;
    stairApi()?.setFloor?.(target.floor,`v328-navigation:${key}`);
    state.stableFloor=target.floor;
    setWorldXZ(target.x,target.z);
    applyGround(target.floor,'navigation');
    syncDesktop(target.floor);
    const landed = worldPosition();
    if (landed) state.lastSafe=landed.clone();
    status(`${key==='rooftop'?'Terraza':key}: navegación inmersiva completada desde ${source}.`);
    window.dispatchEvent(new CustomEvent('ucan:xr-area-changed',{detail:{key,floor:target.floor,position:{x:target.x,y:target.floor,z:target.z}}}));
    return true;
  }

  function assistedRide(direction) {
    if (!state.inXR || state.ride) return false;
    const floor=nearestFloor(state.stableFloor);
    const candidates=Object.values(ROUTES).filter(route=>near(route.fromFloor,floor,0.2));
    const route=candidates.find(item=>direction==='up'?item.toFloor>item.fromFloor:item.toFloor<item.fromFloor);
    if (!route) {
      status(direction==='up'?'No hay otro piso superior desde aquí.':'No hay otro piso inferior desde aquí.');
      return false;
    }
    setWorldXZ(route.centerX,route.fromZ-route.direction*0.4);
    state.assistedRides+=1;
    return beginRide(route);
  }

  function patchNavigation() {
    if (state.navigationPatched) return;
    const attempt = () => {
      const api = window.__UCAN_API__;
      if (!api) { window.setTimeout(attempt,120); return; }
      if (!api.__v328OriginalGoToArea) api.__v328OriginalGoToArea = api.goToArea;
      api.goToArea = key => state.inXR ? teleportTo(key,'API') : api.__v328OriginalGoToArea?.(key);
      api.goTo = api.goToArea;
      state.navigationPatched=true;
    };
    attempt();
    document.addEventListener('click',event=>{
      if (!state.inXR) return;
      const button=event.target?.closest?.('[data-go],#destinationGo');
      if (!button) return;
      const key=button.id==='destinationGo'?document.getElementById('destinationSelect')?.value:button.dataset.go;
      if (!key || !AREAS[key]) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      teleportTo(key,'botón');
    },true);
  }

  function removeLegacyVerticalObservers() {
    const observable=state.scene?.onBeforeRenderObservable;
    if (!observable?.observers || typeof observable.remove!=='function') return 0;
    let removed=0;
    for (const observer of [...observable.observers]) {
      if (!observer || observer===state.observer) continue;
      const source=String(observer.callback||'');
      if (/carry\(dt\)/.test(source) || /rideFrame\(dt\)/.test(source) || /repairBetweenFloors\(\)/.test(source)) {
        try { observable.remove(observer); removed+=1; } catch (_) {}
      }
    }
    state.legacyObserversRemoved += removed;
    return removed;
  }

  function ensureLastObserver() {
    const observable=state.scene?.onBeforeRenderObservable;
    if (!observable) return false;
    if (state.observer) {
      try { observable.remove(state.observer); } catch (_) {}
      state.observer=null;
    }
    removeLegacyVerticalObservers();
    state.observer=observable.add(finalFrame);
    return true;
  }

  function captureVisual() {
    const scene=state.scene;
    const image=scene?.imageProcessingConfiguration;
    state.visualSnapshot={
      clearColor:scene?.clearColor?.clone?.()||scene?.clearColor,
      ambientColor:scene?.ambientColor?.clone?.()||scene?.ambientColor,
      exposure:image?.exposure,
      contrast:image?.contrast,
      lights:(scene?.lights||[]).map(light=>({light,enabled:light.isEnabled?.()!==false,intensity:light.intensity}))
    };
  }

  function ensureVisualParity() {
    const scene=state.scene,snapshot=state.visualSnapshot;
    if (!scene || !snapshot) return;
    // Do not restore the entry-time lighting while the natural environment is
    // active: doing so froze the day/night cycle inside Meta Quest.
    const dynamicEnvironment=window.__UCAN_ENVIRONMENT__?.getState?.();
    if (!dynamicEnvironment) {
      if (snapshot.clearColor) scene.clearColor=snapshot.clearColor.clone?.()||snapshot.clearColor;
      if (snapshot.ambientColor) scene.ambientColor=snapshot.ambientColor.clone?.()||snapshot.ambientColor;
    }
    const image=scene.imageProcessingConfiguration;
    if (image) {
      if (finite(snapshot.exposure)) image.exposure=snapshot.exposure;
      if (finite(snapshot.contrast)) image.contrast=snapshot.contrast;
    }
    if (!dynamicEnvironment) {
      for (const item of snapshot.lights) {
        if (!item.light || item.light.isDisposed?.()) continue;
        item.light.intensity=item.intensity;
        if (typeof item.light.setEnabled==='function' && item.light.isEnabled()!==item.enabled) item.light.setEnabled(item.enabled);
      }
    }
  }

  function finalFrame() {
    if (!state.inXR || !root()) return;
    try {
      state.frames+=1;
      calibrationFrame();
      const dt=clamp((state.scene?.getEngine?.().getDeltaTime?.()||16)/1000,0.001,0.05);
      const route=entryRoute();
      if (!state.ride && route) beginRide(route);
      const riding=updateRide();
      if (!riding) {
        updateJump(dt);
        guardUnderStairs();
        repairBetweenFloors();
        updateRollback();
        rememberSafe();
      }
      if (state.frames%45===0) ensureVisualParity();
      publish();
    } catch (error) { fail('frame',error); }
  }

  function addControls() {
    const grid=document.querySelector('.control-grid');
    if (!grid) return;
    if (!document.getElementById('ucanV328Calibrate')) {
      const button=document.createElement('button');
      button.id='ucanV328Calibrate';button.type='button';button.className='secondary';button.textContent='Calibrar altura VR';
      button.onclick=()=>{beginCalibration(true);status('Recalibrando altura VR…');};
      grid.appendChild(button);
    }
    if (!document.getElementById('ucanV328Repair')) {
      const button=document.createElement('button');
      button.id='ucanV328Repair';button.type='button';button.className='secondary';button.textContent='Reparar nivel XR';
      button.onclick=()=>{state.ride=null;state.jumping=false;state.jumpOffset=0;repairBetweenFloors();status('Nivel XR reparado al piso estable.');};
      grid.appendChild(button);
    }
    if (!document.getElementById('ucanV328FloorUp')) {
      const button=document.createElement('button');
      button.id='ucanV328FloorUp';button.type='button';button.className='secondary';button.textContent='Subir piso (asistido)';
      button.onclick=()=>assistedRide('up');
      grid.appendChild(button);
    }
    if (!document.getElementById('ucanV328FloorDown')) {
      const button=document.createElement('button');
      button.id='ucanV328FloorDown';button.type='button';button.className='secondary';button.textContent='Bajar piso (asistido)';
      button.onclick=()=>assistedRide('down');
      grid.appendChild(button);
    }
  }

  function enterXR() {
    state.inXR=true;
    const stair=stairApi()?.getState?.()||{};
    const desktopGround=nearestFloor(Number(state.desktop?.position?.y||TARGET_EYE_HEIGHT)-TARGET_EYE_HEIGHT);
    state.stableFloor=finite(stair.stableFloor)?nearestFloor(stair.stableFloor):desktopGround;
    state.ride=null;
    state.jumpOffset=0;
    state.jumpVelocity=0;
    state.jumping=false;
    beginCalibration(true);
    captureVisual();
    window.setTimeout(()=>{removeLegacyVerticalObservers();ensureLastObserver();repairBetweenFloors();},0);
    window.setTimeout(()=>{removeLegacyVerticalObservers();ensureLastObserver();repairBetweenFloors();ensureVisualParity();},180);
    window.setTimeout(()=>{removeLegacyVerticalObservers();ensureLastObserver();repairBetweenFloors();ensureVisualParity();},650);
    status('V328: altura de computadora, escaleras automáticas y aterrizaje exacto activos.');
  }

  function exitXR() {
    state.inXR=false;
    state.ride=null;
    state.jumping=false;
    state.jumpOffset=0;
    state.jumpVelocity=0;
    state.calibrated=false;
    syncDesktop(state.stableFloor);
  }

  function getState() {
    return {
      installed:state.installed,
      inXR:state.inXR,
      singleFinalVerticalAuthority:true,
      automaticStairsWithoutJoystick:true,
      exactFloorLanding:true,
      preventsBetweenFloors:true,
      desktopEyeHeightParity:true,
      targetEyeHeight:TARGET_EYE_HEIGHT,
      eyeBaseline:state.eyeBaseline,
      eyeOffset:state.eyeOffset,
      calibrated:state.calibrated,
      stableFloor:state.stableFloor,
      activeRide:state.ride?.route?.id||null,
      ridesStarted:state.ridesStarted,
      ridesCompleted:state.ridesCompleted,
      exactSnaps:state.exactSnaps,
      assistedRides:state.assistedRides,
      stairEntryDepth:ENTRY_DEPTH,
      stairEntryWidthAssist:ENTRY_WIDTH_ASSIST,
      rideCooldownMs:RIDE_COOLDOWN,
      lastCompletedRoute:state.lastCompletedRoute,
      jumpEnabled:true,
      jumping:state.jumping,
      underStairSafetyVolumes:true,
      hazardBlocks:state.hazardBlocks,
      legacyV326V327VerticalObserversRemoved:state.legacyObserversRemoved,
      directImmersiveNavigation:true,
      visualParitySnapshot:true,
      dynamicDayNightPreserved:true,
      environmentClockShared:true,
      frames:state.frames,
      lastError:state.lastError,
      world:worldPosition()?{x:worldPosition().x,y:worldPosition().y,z:worldPosition().z}:null
    };
  }

  function publish() {
    window.__UCAN_XR_FINAL_AUTHORITY_V328__={
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      ...getState(),
      installed:state.installed,
      ownsVertical:true,
      ownsAutomaticStairs:true,
      setGround:(ground,reason='external')=>applyGround(ground,reason),
      teleportTo,
      rollback,
      recalibrate:()=>beginCalibration(true),
      repairFloor:()=>repairBetweenFloors(),
      getState
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene=window.__UCAN_API__?.getScene?.()||null;
    state.helper=window.__UCAN_XR_HELPER__||null;
    state.xr=state.helper?.baseExperience?.camera||null;
    state.desktop=window.__UCAN_API__?.getCamera?.()||state.scene?.activeCamera||null;
    if (!state.scene || !state.helper || !state.xr || !state.desktop || !xrApi()?.installed || !stairApi()?.installed) return false;

    state.stableFloor=nearestFloor(Number(state.desktop.position.y)-TARGET_EYE_HEIGHT);
    state.lastSafe=worldPosition()?.clone?.()||new B.Vector3(Number(state.desktop.position.x||0),state.stableFloor+TARGET_EYE_HEIGHT,Number(state.desktop.position.z||42));
    captureVisual();
    removeLegacyVerticalObservers();
    ensureLastObserver();
    patchNavigation();
    addControls();

    state.xrStateObserver=state.helper.baseExperience.onStateChangedObservable.add(value=>{
      const X=B.WebXRState||{};
      if (value===X.ENTERING_XR || value===X.IN_XR) enterXR();
      else if (value===X.NOT_IN_XR) exitXR();
    });

    state.installed=true;
    publish();
    console.info('[UCAN V328 R34] Día/noche dinámico, navegación cómoda y autoridad final XR instalados.');
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
