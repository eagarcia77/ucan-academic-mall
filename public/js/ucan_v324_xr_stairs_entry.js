(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B) return;

  const VERSION = 'V324';
  const REVISION = 'R28';
  const BUILD = 'V324-20260730-XR-PARENT-RIG-QUEST-ENTRY-R28';
  const BUTTON_ID = 'ucanV324VrEntry';
  const LEVELS = [0, 8.2, 16.4, 27.2];
  const SPEEDS = { comfort:4.8, natural:6.8, fast:9.2 };
  const ROUTES = {
    up12:{ centerX:-20, halfWidth:3.45, direction:-1 },
    down21:{ centerX:-8, halfWidth:3.45, direction:1 },
    up23:{ centerX:-34, halfWidth:3.45, direction:-1 },
    down32:{ centerX:-26, halfWidth:3.45, direction:1 },
    up34:{ centerX:44, halfWidth:4.55, direction:-1 },
    down34:{ centerX:44, halfWidth:4.55, direction:1 }
  };
  const DEAD_ZONE = 0.12;
  const ACCELERATION = 30;
  const BRAKING = 38;
  const TURN_SPEED = 2.45;
  const SNAP_ANGLE = Math.PI / 6;

  const state = {
    installed:false, scene:null, helper:null, desktop:null, xr:null, root:null,
    v316Observer:null, xrObserver:null, inXR:false, supported:null, button:null,
    velocity:null, ground:0, turnLatched:false, teleportAiming:false,
    teleportTarget:null, teleportMarker:null, rightClick:false,
    movementFrames:0, stairFrames:0, completedExits:0, clicks:0, entries:0,
    lastWorld:null, lastError:null
  };

  const clamp = (v,min,max) => Math.max(min, Math.min(max, Number(v) || 0));
  const nearestFloor = value => LEVELS.reduce((best, floor) => Math.abs(Number(value)-floor) < Math.abs(Number(value)-best) ? floor : best, LEVELS[0]);
  const rigApi = () => window.__UCAN_LOCOMOTION_CONTROLS_V323__ || null;
  const stairApi = () => window.__UCAN_STAIR_AUTHORITY_V322__ || null;

  function fail(stage, reason) {
    state.lastError = { stage, message:String(reason?.message || reason), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, reason);
    publish();
  }

  function worldPosition() {
    if (!state.xr) return null;
    try {
      state.xr.computeWorldMatrix?.(true);
      const value = state.xr.globalPosition || state.xr.getAbsolutePosition?.() || state.xr.position;
      return value?.clone?.() || new B.Vector3(Number(value?.x||0), Number(value?.y||0), Number(value?.z||0));
    } catch (_) { return null; }
  }

  function ensureRoot() {
    if (!state.scene || !state.xr) return null;
    if (state.root && !state.root.isDisposed?.()) return state.root;
    if (state.xr.parent) state.root = state.xr.parent;
    else {
      state.root = new B.TransformNode('UCAN XR locomotion root V324', state.scene);
      state.root.position.set(0,0,0);
      state.root.rotation.set(0,0,0);
      state.xr.parent = state.root;
    }
    return state.root;
  }

  function alignRootToDesktop() {
    const root = ensureRoot();
    const world = worldPosition();
    if (!root || !world || !state.desktop?.position) return false;
    root.position.x += state.desktop.position.x - world.x;
    root.position.z += state.desktop.position.z - world.z;
    root.position.y = state.ground;
    return true;
  }

  function setWorldXZ(x,z) {
    const root = ensureRoot();
    const world = worldPosition();
    if (!root || !world) return false;
    root.position.x += Number(x) - world.x;
    root.position.z += Number(z) - world.z;
    return true;
  }

  function syncDesktop() {
    const world = worldPosition();
    if (!world || !state.desktop?.position) return;
    state.desktop.position.x = world.x;
    state.desktop.position.z = world.z;
    state.desktop.position.y = state.ground + 1.72;
    state.lastWorld = { x:world.x, y:state.ground, z:world.z };
  }

  function normalizeAxis(raw) {
    const value = Number.isFinite(Number(raw)) ? Number(raw) : 0;
    const magnitude = Math.abs(value);
    if (magnitude <= DEAD_ZONE) return 0;
    return Math.sign(value) * clamp((magnitude-DEAD_ZONE)/(1-DEAD_ZONE),0,1);
  }

  function controller(hand) {
    return (state.helper?.input?.controllers || []).find(item => (item?.inputSource?.handedness || item?.motionController?.handedness) === hand) || null;
  }

  function gamepad(hand) {
    const item = controller(hand);
    return item?.inputSource?.gamepad || item?.motionController?.gamepadObject || item?.motionController?.gamepad || null;
  }

  function axes(hand) {
    const values = Array.from(gamepad(hand)?.axes || []);
    if (values.length < 2) return {x:0,y:0};
    const offset = values.length >= 4 ? values.length-2 : 0;
    return { x:normalizeAxis(values[offset]), y:normalizeAxis(values[offset+1]) };
  }

  function pressed(hand,index) { return Boolean(gamepad(hand)?.buttons?.[index]?.pressed); }

  function yawBasis() {
    const mode = rigApi()?.getState?.().directionMode || 'head';
    if (mode === 'hand') {
      try {
        const direction = controller('left')?.getWorldPointerRay?.(1)?.direction?.clone?.();
        if (direction) {
          direction.y = 0;
          if (direction.lengthSquared() > 0.0001) {
            direction.normalize();
            return { forward:direction, right:new B.Vector3(direction.z,0,-direction.x) };
          }
        }
      } catch (_) {}
    }
    let direction = null;
    try { direction = state.xr?.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!direction) direction = new B.Vector3(0,0,1);
    direction.y = 0;
    if (direction.lengthSquared() < 0.0001) direction.set(0,0,1);
    direction.normalize();
    return { forward:direction, right:new B.Vector3(direction.z,0,-direction.x) };
  }

  function collisionCandidate(mesh) {
    if (!mesh || mesh.isVisible === false || mesh.isEnabled?.() === false || !mesh.checkCollisions) return false;
    const data = mesh.metadata || {};
    if (data.walkable || data.teleportable || data.xrStairSurface || data.stairSurface || data.geometryOnlyV322) return false;
    return !/piso|losa|ruta avatar|zona segura|rampa|peldaño|banda escalera|plataforma|descanso/i.test(String(mesh.name||''));
  }

  function blocked(position, step) {
    const stair = stairApi()?.getState?.() || {};
    if (stair.activeRoute) return false;
    if (!state.scene?.pickWithRay || step.lengthSquared() < 1e-8) return false;
    const direction = step.clone().normalize();
    const length = step.length()+0.38;
    for (const height of [0.4,1.15]) {
      const origin = new B.Vector3(position.x,state.ground+height,position.z);
      const hit = state.scene.pickWithRay(new B.Ray(origin,direction,length),collisionCandidate,false);
      if (hit?.hit && hit.distance <= length) return true;
    }
    return false;
  }

  function constrainRoute(world) {
    const stair = stairApi()?.getState?.() || {};
    const route = ROUTES[stair.activeRoute];
    if (!route || !state.root || !world) return;
    const targetX = clamp(world.x, route.centerX-route.halfWidth+0.45, route.centerX+route.halfWidth-0.45);
    state.root.position.x += targetX-world.x;
  }

  function move(step) {
    const world = worldPosition();
    if (!world || !state.root || step.lengthSquared() < 1e-8) return;
    if (!blocked(world,step)) state.root.position.addInPlace(step);
    else {
      for (const part of [new B.Vector3(step.x,0,0),new B.Vector3(0,0,step.z)]) {
        if (part.lengthSquared() > 1e-8 && !blocked(worldPosition(),part)) state.root.position.addInPlace(part);
      }
    }
    constrainRoute(worldPosition());
  }

  function speed() {
    const mode = rigApi()?.getState?.().speedMode || 'natural';
    return pressed('left',3) ? SPEEDS.fast : (SPEEDS[mode] || SPEEDS.natural);
  }

  function turn(rightX,dt) {
    const root = ensureRoot();
    if (!root) return;
    const mode = rigApi()?.getState?.().turnMode || 'smooth';
    const click = pressed('right',3);
    if (click && !state.rightClick) rigApi()?.toggleTurn?.();
    state.rightClick = click;
    if (mode === 'smooth') {
      state.turnLatched = false;
      if (Math.abs(rightX) > 0.1) root.rotation.y += rightX*TURN_SPEED*dt;
    } else {
      if (Math.abs(rightX) < 0.35) state.turnLatched = false;
      else if (!state.turnLatched && Math.abs(rightX) >= 0.7) {
        state.turnLatched = true;
        root.rotation.y += rightX > 0 ? SNAP_ANGLE : -SNAP_ANGLE;
      }
    }
  }

  function teleportable(mesh) {
    const data = mesh?.metadata || {};
    return Boolean(mesh && mesh.isVisible !== false && mesh.isEnabled?.() !== false && (data.walkable || data.teleportable || /piso|losa|pasillo|ruta|plataforma|terraza|rampa/i.test(String(mesh.name||''))));
  }

  function marker() {
    if (state.teleportMarker && !state.teleportMarker.isDisposed?.()) return state.teleportMarker;
    const mesh = B.MeshBuilder.CreateTorus('marcador teletransporte V324',{diameter:1.1,thickness:0.08,tessellation:32},state.scene);
    mesh.rotation.x = Math.PI/2;
    mesh.isPickable = false;
    mesh.isVisible = false;
    const material = new B.StandardMaterial('material teletransporte V324',state.scene);
    material.diffuseColor = B.Color3.FromHexString('#fed141');
    material.emissiveColor = material.diffuseColor;
    material.disableLighting = true;
    mesh.material = material;
    state.teleportMarker = mesh;
    return mesh;
  }

  function updateTeleport(rightY) {
    if (rigApi()?.getState?.().teleportEnabled === false) return;
    const aiming = rightY < -0.68;
    if (aiming) {
      state.teleportAiming = true;
      const ray = controller('right')?.getWorldPointerRay?.(45) || state.xr?.getForwardRay?.(45);
      const hit = ray ? state.scene.pickWithRay?.(ray,teleportable,false) : null;
      const display = marker();
      if (hit?.hit && hit.pickedPoint) {
        state.teleportTarget = hit.pickedPoint.clone();
        display.position.copyFrom(state.teleportTarget);
        display.position.y += 0.04;
        display.isVisible = true;
      } else {
        state.teleportTarget = null;
        display.isVisible = false;
      }
    } else if (state.teleportAiming) {
      state.teleportAiming = false;
      if (state.teleportTarget) {
        state.ground = nearestFloor(state.teleportTarget.y);
        stairApi()?.setFloor?.(state.ground,'v324-teleport');
        setWorldXZ(state.teleportTarget.x,state.teleportTarget.z);
        state.root.position.y = state.ground;
      }
      if (state.teleportMarker) state.teleportMarker.isVisible = false;
      state.teleportTarget = null;
    }
  }

  function frame() {
    if (!state.inXR || !state.root) return;
    try {
      const dt = clamp((state.scene.getEngine().getDeltaTime()||16)/1000,0.001,0.05);
      const left = axes('left');
      const right = axes('right');
      turn(right.x,dt);
      const basis = yawBasis();
      const desired = basis.right.scale(left.x).add(basis.forward.scale(-left.y));
      const magnitude = Math.min(1,Math.hypot(left.x,left.y));
      if (desired.lengthSquared() > 1) desired.normalize();
      desired.scaleInPlace(speed()*magnitude);
      const response = 1-Math.exp(-(desired.lengthSquared()>0.0001?ACCELERATION:BRAKING)*dt);
      state.velocity = B.Vector3.Lerp(state.velocity,desired,response);
      state.velocity.y = 0;
      if (state.velocity.lengthSquared()<0.00025) state.velocity.set(0,0,0);
      move(state.velocity.scale(dt));
      const world = worldPosition();
      const before = stairApi()?.getState?.() || {};
      state.ground = stairApi()?.resolveGround?.(world,state.ground) ?? state.ground;
      state.root.position.y = state.ground;
      const after = stairApi()?.getState?.() || {};
      if (before.activeRoute && !after.activeRoute) state.completedExits += 1;
      if (after.activeRoute) state.stairFrames += 1;
      if (state.velocity.lengthSquared()>0.0001) state.movementFrames += 1;
      updateTeleport(right.y);
      syncDesktop();
      publish();
    } catch (reason) { fail('xr-frame',reason); }
  }

  function findV316Observer() {
    const observers = state.scene?.onBeforeRenderObservable?.observers || [];
    return observers.find(observer => {
      const callback = observer?.callback;
      const text = String(callback || '');
      return callback?.name === 'frame' && /updateMovement\(dt\)/.test(text);
    }) || null;
  }

  function stopV316Frame() {
    if (!state.v316Observer) state.v316Observer = findV316Observer();
    if (state.v316Observer) state.scene.onBeforeRenderObservable.remove(state.v316Observer);
  }

  function startV316Frame() {
    if (!state.v316Observer?.callback) return;
    const observers = state.scene?.onBeforeRenderObservable?.observers || [];
    if (!observers.some(item => item.callback === state.v316Observer.callback)) {
      state.v316Observer = state.scene.onBeforeRenderObservable.add(state.v316Observer.callback);
    }
  }

  function activate() {
    stopV316Frame();
    ensureRoot();
    state.ground = nearestFloor(state.desktop.position.y-1.72);
    window.setTimeout(alignRootToDesktop,0);
    window.setTimeout(alignRootToDesktop,120);
    if (!state.xrObserver) state.xrObserver = state.scene.onBeforeRenderObservable.add(frame);
    state.inXR = true;
    refreshButton();
    publish();
  }

  function deactivate() {
    state.inXR = false;
    syncDesktop();
    if (state.xrObserver) {
      state.scene.onBeforeRenderObservable.remove(state.xrObserver);
      state.xrObserver = null;
    }
    startV316Frame();
    refreshButton();
    publish();
  }

  function ensureStyle() {
    if (document.getElementById('ucanV324VrEntryStyle')) return;
    const style = document.createElement('style');
    style.id = 'ucanV324VrEntryStyle';
    style.textContent = `#${BUTTON_ID}{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));z-index:1200;display:none;align-items:center;justify-content:center;gap:9px;min-width:164px;min-height:54px;padding:12px 18px;border:3px solid #fed141;border-radius:16px;background:#007b5f;color:#fff;font:800 15px/1.15 Inter,Segoe UI,system-ui,sans-serif;box-shadow:0 16px 42px rgba(0,0,0,.42);cursor:pointer;touch-action:manipulation}#${BUTTON_ID}:focus-visible{outline:4px solid #fff;outline-offset:3px}#${BUTTON_ID}:disabled{opacity:.68;cursor:wait}`;
    document.head.appendChild(style);
  }

  function ensureButton() {
    ensureStyle();
    let button = document.getElementById(BUTTON_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = BUTTON_ID;
      button.type = 'button';
      button.textContent = 'Preparando VR…';
      button.title = 'Entrar en VR desde un visor compatible';
      button.setAttribute('aria-label','Entrar al campus en realidad virtual');
      button.addEventListener('click',enterVr);
      document.body.appendChild(button);
    }
    state.button = button;
    return button;
  }

  function refreshButton() {
    const button = ensureButton();
    const ready = Boolean(rigApi()?.enterVr);
    const visible = state.supported === true && !state.inXR;
    button.style.display = visible ? 'inline-flex' : 'none';
    button.disabled = !ready;
    button.textContent = ready ? 'Entrar en VR' : 'Preparando VR…';
    button.setAttribute('aria-hidden',String(!visible));
  }

  async function enterVr() {
    state.clicks += 1;
    try {
      const control = rigApi();
      if (!control?.enterVr) throw new Error('El motor WebXR todavía no está listo.');
      state.button.disabled = true;
      state.button.textContent = 'Entrando en VR…';
      const result = await control.enterVr();
      if (result === false) throw new Error('El navegador rechazó immersive-vr.');
      state.entries += 1;
      return true;
    } catch (reason) {
      fail('enter-vr',reason);
      refreshButton();
      window.__UCAN_API__?.setStatus?.(`No se pudo entrar en VR: ${reason?.message||reason}`);
      return false;
    }
  }

  async function detectSupport() {
    try { state.supported = Boolean(window.isSecureContext && navigator.xr?.isSessionSupported && await navigator.xr.isSessionSupported('immersive-vr')); }
    catch (_) { state.supported = false; }
    refreshButton();
    publish();
  }

  function publish() {
    window.__UCAN_XR_STAIRS_ENTRY_V324__ = {
      version:VERSION,revision:REVISION,build:BUILD,installed:state.installed,
      xrParentRig:Boolean(state.root),v316FrameSuspendedInXr:Boolean(state.inXR && state.v316Observer),
      headTrackingPreserved:true,stairCollisionBypassedDuringRoute:true,
      rightVrButtonSupported:state.supported,rightVrButtonPresent:Boolean(document.getElementById(BUTTON_ID)),
      rightVrButtonVisible:Boolean(state.button && state.button.style.display !== 'none'),
      inXR:state.inXR,ground:state.ground,movementFrames:state.movementFrames,
      stairFrames:state.stairFrames,completedExits:state.completedExits,
      clicks:state.clicks,entries:state.entries,lastWorld:state.lastWorld,lastError:state.lastError,
      enterVr,refresh:refreshButton,getState:() => ({
        installed:state.installed,xrParentRig:Boolean(state.root),v316FrameSuspendedInXr:Boolean(state.inXR && state.v316Observer),
        headTrackingPreserved:true,stairCollisionBypassedDuringRoute:true,rightVrButtonSupported:state.supported,
        rightVrButtonPresent:Boolean(document.getElementById(BUTTON_ID)),rightVrButtonVisible:Boolean(state.button && state.button.style.display !== 'none'),
        inXR:state.inXR,ground:state.ground,activeRoute:stairApi()?.getState?.().activeRoute||null,
        routeProgress:stairApi()?.getState?.().routeProgress||0,completedExits:state.completedExits,lastError:state.lastError
      })
    };
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    state.desktop = window.__UCAN_API__?.getCamera?.() || state.scene?.activeCamera || null;
    state.helper = window.__UCAN_XR_HELPER__ || null;
    state.xr = state.helper?.baseExperience?.camera || null;
    if (!state.scene || !state.desktop || !state.helper || !state.xr || !state.scene.onBeforeRenderObservable) return false;
    state.velocity = new B.Vector3(0,0,0);
    state.ground = nearestFloor(state.desktop.position.y-1.72);
    state.v316Observer = findV316Observer();
    state.helper.baseExperience.onStateChangedObservable.add(value => {
      const X = B.WebXRState || {};
      if (value === X.ENTERING_XR || value === X.IN_XR) activate();
      else if (value === X.NOT_IN_XR) deactivate();
    });
    state.installed = true;
    ensureButton();
    detectSupport();
    window.setInterval(refreshButton,900);
    publish();
    console.info('[UCAN V324 R28] Locomoción WebXR por nodo padre y botón derecho instalados.');
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    try { if (install() || attempts >= 700) window.clearInterval(timer); }
    catch (reason) { fail('install',reason); if (attempts >= 700) window.clearInterval(timer); }
  },100);
  publish();
})();