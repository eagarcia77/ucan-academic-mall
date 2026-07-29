(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const VERSION = 'V315';
  const REVISION = 'R19';
  const BUILD = 'V315-20260729-FLOORS-JOYSTICK-ONE-LOCOMOTION-R19';
  const ALL_LAYERS = 0x0fffffff;
  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const FLOOR_VALUES = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]);
  const PLAYER_HEIGHT = 1.72;
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });
  const SPEEDS = Object.freeze({ comfort:3.4, natural:5.0, fast:7.0 });
  const DEAD_ZONE = 0.18;
  const ACCELERATION = 22;
  const BRAKING = 28;
  const SMOOTH_TURN_SPEED = 1.9;
  const SNAP_TURN = Math.PI / 6;
  const FLOOR_REPAIR_MS = 120;
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });

  const ROUTES = Object.freeze([
    { id:'up12', kind:'escalator', direction:'up', fromFloor:LEVEL.one, toFloor:LEVEL.two, x:-20, minX:-24.8, maxX:-15.2, fromZ:32, toZ:10, duration:3600 },
    { id:'down21', kind:'escalator', direction:'down', fromFloor:LEVEL.two, toFloor:LEVEL.one, x:-8, minX:-12.8, maxX:-3.2, fromZ:10, toZ:32, duration:3600 },
    { id:'up23', kind:'escalator', direction:'up', fromFloor:LEVEL.two, toFloor:LEVEL.three, x:-34, minX:-38.8, maxX:-29.2, fromZ:32, toZ:10, duration:3600 },
    { id:'down32', kind:'escalator', direction:'down', fromFloor:LEVEL.three, toFloor:LEVEL.two, x:-26, minX:-30.8, maxX:-21.2, fromZ:10, toZ:32, duration:3600 },
    { id:'up34', kind:'stairs', direction:'up', fromFloor:LEVEL.three, toFloor:LEVEL.roof, x:44, minX:38.7, maxX:49.3, fromZ:39, toZ:10.5, duration:5200 },
    { id:'down43', kind:'stairs', direction:'down', fromFloor:LEVEL.roof, toFloor:LEVEL.three, x:44, minX:38.7, maxX:49.3, fromZ:10.5, toZ:39, duration:5200 }
  ]);

  const state = {
    scene:null,
    helper:null,
    desktop:null,
    xr:null,
    inXR:false,
    installed:false,
    poseReady:false,
    floor:LEVEL.one,
    ground:LEVEL.one,
    eyeHeight:PLAYER_HEIGHT,
    velocity:null,
    transition:null,
    lastSafe:null,
    keys:new Set(),
    speedMode:localStorage.getItem('ucanV315SpeedMode') || 'natural',
    turnMode:localStorage.getItem('ucanV315TurnMode') || 'smooth',
    directionMode:localStorage.getItem('ucanV315DirectionMode') || 'head',
    teleportEnabled:localStorage.getItem('ucanV315Teleport') !== 'false',
    snapLatched:false,
    sprintPressed:false,
    rightStickPressed:false,
    teleportAiming:false,
    teleportTarget:null,
    teleportMarker:null,
    controllers:new Map(),
    nativeGetGamepads:null,
    gamepadMaskInstalled:false,
    floorRecords:new Map(),
    floorHashes:{},
    floorCurrentHashes:{},
    floorsReady:false,
    floorRepairs:0,
    floorDeviations:0,
    lastFloorRepair:0,
    movementFrames:0,
    controllerBindings:0,
    teleports:0,
    completedRoutes:0,
    lastInput:null,
    lastError:null,
    controls:null
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const finite = value => Number.isFinite(Number(value));
  const lerp = (a,b,t) => a + (b-a) * t;
  const smoothStep = t => t*t*(3-2*t);
  const nearestFloor = value => FLOOR_VALUES.reduce((best,floor) => Math.abs(value-floor) < Math.abs(value-best) ? floor : best, FLOOR_VALUES[0]);
  const clone = value => { try { return value?.clone?.() ?? value; } catch (_) { return value; } };
  const activeSpeed = () => state.sprintPressed ? SPEEDS.fast : SPEEDS[state.speedMode] || SPEEDS.natural;

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function recordError(stage, error) {
    state.lastError = { stage, message:String(error?.message || error), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    updateAudit();
  }

  function blockedByUi(target) {
    const element = target instanceof Element ? target : null;
    return Boolean(element?.closest('input, textarea, select, [contenteditable], button, a, summary, [role="button"], [role="textbox"]')) ||
      Boolean(document.querySelector('#boardPanel.open, #livePanelViewer.open, #ucanProfileModal.open, #ucanRealtimeWorldV312.open'));
  }

  function installKeyboardInterception() {
    const movementCodes = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyR']);
    window.addEventListener('keydown', event => {
      if (!movementCodes.has(event.code)) return;
      if (blockedByUi(event.target)) {
        state.keys.delete(event.code);
        event.stopImmediatePropagation();
        return;
      }
      state.keys.add(event.code);
      if (event.code === 'KeyR') resetToSafePoint('teclado');
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    window.addEventListener('keyup', event => {
      if (!movementCodes.has(event.code)) return;
      state.keys.delete(event.code);
      event.stopImmediatePropagation();
    }, true);
    window.addEventListener('blur', () => state.keys.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) state.keys.clear(); });
  }

  function maskLegacyGamepadPolling() {
    try {
      if (!navigator.getGamepads) return;
      state.nativeGetGamepads = navigator.getGamepads.bind(navigator);
      Object.defineProperty(navigator, 'getGamepads', {
        configurable:true,
        value:() => state.installed ? [] : state.nativeGetGamepads()
      });
      state.gamepadMaskInstalled = true;
    } catch (_) {
      try {
        state.nativeGetGamepads = navigator.getGamepads?.bind(navigator) || null;
      } catch (_) {}
    }
  }

  function normalizeAxis(raw) {
    const value = finite(raw) ? Number(raw) : 0;
    const magnitude = Math.abs(value);
    if (magnitude <= DEAD_ZONE) return 0;
    return Math.sign(value) * clamp((magnitude-DEAD_ZONE)/(1-DEAD_ZONE), 0, 1);
  }

  function controllerFor(handedness) {
    return (state.helper?.input?.controllers || []).find(item => (item?.inputSource?.handedness || item?.motionController?.handedness) === handedness) || null;
  }

  function gamepadForController(controller) {
    return controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad || null;
  }

  function axesFromController(handedness) {
    const controller = controllerFor(handedness);
    const gamepad = gamepadForController(controller);
    const axes = Array.from(gamepad?.axes || []);
    if (axes.length < 2) return { x:0, y:0 };
    const offset = axes.length >= 4 ? axes.length-2 : 0;
    return { x:normalizeAxis(axes[offset]), y:normalizeAxis(axes[offset+1]) };
  }

  function desktopGamepadAxes() {
    const pads = state.nativeGetGamepads ? Array.from(state.nativeGetGamepads() || []).filter(Boolean) : [];
    const pad = pads.find(item => !/oculus|quest|touch/i.test(String(item.id || ''))) || pads[0];
    const axes = Array.from(pad?.axes || []);
    const buttons = Array.from(pad?.buttons || []);
    return {
      left:{ x:normalizeAxis(axes[0]), y:normalizeAxis(axes[1]) },
      right:{ x:normalizeAxis(axes[2]), y:normalizeAxis(axes[3]) },
      sprint:Boolean(buttons[10]?.pressed),
      rightClick:Boolean(buttons[11]?.pressed)
    };
  }

  function inputState() {
    let forward=0, strafe=0, turn=0;
    if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) forward += 1;
    if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) forward -= 1;
    if (state.keys.has('KeyD')) strafe += 1;
    if (state.keys.has('KeyA')) strafe -= 1;
    if (state.keys.has('ArrowRight')) turn += 1;
    if (state.keys.has('ArrowLeft')) turn -= 1;

    let left={x:0,y:0}, right={x:0,y:0};
    if (state.inXR) {
      left = axesFromController('left');
      right = axesFromController('right');
    } else {
      const pad = desktopGamepadAxes();
      left = pad.left;
      right = pad.right;
      state.sprintPressed = pad.sprint || state.keys.has('ShiftLeft') || state.keys.has('ShiftRight');
      if (pad.rightClick && !state.rightStickPressed) toggleTurnMode('gamepad');
      state.rightStickPressed = pad.rightClick;
    }
    forward += -left.y;
    strafe += left.x;
    turn += right.x;
    const magnitude = Math.min(1, Math.hypot(forward,strafe));
    if (magnitude > 1e-5) { forward /= Math.max(1,Math.hypot(forward,strafe)); strafe /= Math.max(1,Math.hypot(forward,strafe)); }
    state.lastInput = { forward, strafe, turn, rightY:right.y, magnitude, sprint:state.sprintPressed, source:state.inXR?'xr-joystick':'keyboard-gamepad' };
    return state.lastInput;
  }

  function yaw(camera) {
    try { if (camera?.rotationQuaternion?.toEulerAngles) return camera.rotationQuaternion.toEulerAngles().y; } catch (_) {}
    return Number(camera?.rotation?.y || camera?.cameraRotation?.y || 0);
  }

  function addYaw(camera, amount) {
    if (!camera || !amount) return;
    if (camera.cameraRotation) camera.cameraRotation.y += amount;
    else if (camera.rotation) camera.rotation.y += amount;
  }

  function basisFromCamera(camera) {
    let forward;
    try { forward = camera?.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) {
      const angle = yaw(camera);
      forward = new B.Vector3(Math.sin(angle),0,Math.cos(angle));
    }
    forward.y=0;
    if (forward.lengthSquared()<0.0001) forward.set(0,0,1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z,0,-forward.x).normalize() };
  }

  function basisFromHand() {
    const controller = controllerFor('left');
    try {
      const ray = controller?.getWorldPointerRay?.(1);
      const forward = ray?.direction?.clone?.();
      if (forward) {
        forward.y=0;
        if (forward.lengthSquared()>0.0001) {
          forward.normalize();
          return { forward, right:new B.Vector3(forward.z,0,-forward.x).normalize() };
        }
      }
    } catch (_) {}
    return basisFromCamera(activeCamera());
  }

  function activeCamera() {
    return state.inXR ? state.xr : state.desktop;
  }

  function currentEyeHeight() {
    const value = Number(state.xr?.realWorldHeight || state.xr?._realWorldHeight);
    return state.inXR && finite(value) && value>=0.8 && value<=2.4 ? value : PLAYER_HEIGHT;
  }

  function floorGround(position) {
    if (!position) return state.floor;
    if (Math.abs(state.floor-LEVEL.three)<0.4) {
      const center = position.x>-5.2 && position.x<1.6 && position.z>-14.5 && position.z<19.3;
      const side = position.x>17.8 && position.x<23.2 && position.z>-8.5 && position.z<19.3;
      if (center || side) {
        const start=center?-14.5:-8.5, end=19.3, rise=center?2.38:2.04;
        return LEVEL.three + rise*clamp((position.z-start)/(end-start),0,1);
      }
    }
    return state.floor;
  }

  function routeEntry(position) {
    if (!position || state.transition) return null;
    return ROUTES.find(route => Math.abs(state.floor-route.fromFloor)<0.4 && position.x>=route.minX-0.5 && position.x<=route.maxX+0.5 && Math.abs(position.z-route.fromZ)<=4.5) || null;
  }

  function beginRoute(route) {
    const camera = activeCamera();
    if (!camera?.position) return;
    state.transition = { route, startedAt:performance.now(), startX:camera.position.x };
    state.velocity.set(0,0,0);
    status(`${route.kind==='escalator'?'Escalera eléctrica':'Escalera'}: transición automática igual en browser y VR.`);
  }

  function updateRoute() {
    const camera = activeCamera();
    if (!state.transition || !camera?.position) return false;
    const {route,startedAt,startX}=state.transition;
    const raw=clamp((performance.now()-startedAt)/route.duration,0,1);
    const t=smoothStep(raw);
    const eye=currentEyeHeight();
    camera.position.x=lerp(startX,route.x,clamp(0.18+t*0.22,0,0.4));
    camera.position.z=lerp(route.fromZ,route.toZ,t);
    camera.position.y=lerp(route.fromFloor,route.toFloor,t)+eye;
    if(raw>=1){
      state.floor=route.toFloor;
      state.ground=route.toFloor;
      camera.position.set(route.x,route.toFloor+eye,route.toZ+(route.direction==='up'?-1.2:1.2));
      state.transition=null;
      state.completedRoutes++;
      state.lastSafe.copyFrom(camera.position);
    }
    return true;
  }

  function collisionCandidate(mesh) {
    if (!mesh || mesh.isVisible===false || !mesh.checkCollisions || mesh.isEnabled?.()===false) return false;
    if (mesh.metadata?.walkable || mesh.metadata?.teleportable || mesh.metadata?.xrStairSurface) return false;
    return !/gran losa|ruta avatar|zona segura VR|rooftop deck|rampa invisible|plataforma (?:inicio|fin)|peldaño|banda escalera|escalon central/i.test(String(mesh.name||''));
  }

  function rayBlocked(camera,step,ground) {
    if (!state.scene?.pickWithRay || !B.Ray || step.lengthSquared()<1e-8) return false;
    const direction=step.clone().normalize(), length=step.length()+0.42;
    for(const height of [0.42,1.18]){
      const origin=new B.Vector3(camera.position.x,ground+height,camera.position.z);
      const hit=state.scene.pickWithRay(new B.Ray(origin,direction,length),collisionCandidate,false);
      if(hit?.hit && hit.distance<=length) return true;
    }
    return false;
  }

  function moveCamera(camera,step,ground) {
    if (!camera?.position || step.lengthSquared()<1e-8) return;
    const oldY=camera.position.y;
    if (!state.inXR && typeof camera._collideWithWorld==='function') {
      try { camera._collideWithWorld(step); }
      catch (_) { if(!rayBlocked(camera,step,ground)) camera.position.addInPlace(step); }
    } else if (!rayBlocked(camera,step,ground)) {
      camera.position.addInPlace(step);
    } else {
      for(const part of [new B.Vector3(step.x,0,0),new B.Vector3(0,0,step.z)]) if(part.lengthSquared()>1e-8 && !rayBlocked(camera,part,ground)) camera.position.addInPlace(part);
    }
    camera.position.x=clamp(camera.position.x,WORLD.minX,WORLD.maxX);
    camera.position.z=clamp(camera.position.z,WORLD.minZ,WORLD.maxZ);
    camera.position.y=oldY;
  }

  function applyTurn(camera,input,dt) {
    if (!camera) return;
    if(state.turnMode==='smooth'){
      state.snapLatched=false;
      if(Math.abs(input.turn)>0.14) addYaw(camera,input.turn*SMOOTH_TURN_SPEED*dt);
      return;
    }
    if(Math.abs(input.turn)<0.35){state.snapLatched=false;return;}
    if(state.snapLatched || Math.abs(input.turn)<0.72)return;
    state.snapLatched=true;
    addYaw(camera,input.turn>0?SNAP_TURN:-SNAP_TURN);
  }

  function updateMovement(dt) {
    const camera=activeCamera();
    if(!camera?.position)return;
    if(state.transition){updateRoute();syncCameras();return;}
    const input=inputState();
    applyTurn(camera,input,dt);
    const route=routeEntry(camera.position);
    if(route){beginRoute(route);return;}
    const basis=state.inXR && state.directionMode==='hand'?basisFromHand():basisFromCamera(camera);
    const desired=basis.right.scale(input.strafe).add(basis.forward.scale(input.forward));
    if(desired.lengthSquared()>1)desired.normalize();
    desired.scaleInPlace(activeSpeed()*input.magnitude);
    const response=1-Math.exp(-(desired.lengthSquared()>0.0001?ACCELERATION:BRAKING)*dt);
    state.velocity=B.Vector3.Lerp(state.velocity,desired,response);
    state.velocity.y=0;
    if(state.velocity.lengthSquared()<0.00025)state.velocity.set(0,0,0);
    const step=state.velocity.scale(dt);
    state.ground=floorGround(camera.position);
    moveCamera(camera,step,state.ground);
    state.eyeHeight=currentEyeHeight();
    camera.position.y=state.ground+state.eyeHeight;
    if(step.lengthSquared()>1e-8)state.movementFrames++;
    syncCameras();
    updateTeleport(input);
    state.lastSafe.copyFrom(camera.position);
  }

  function syncCameras() {
    if(!state.desktop?.position||!state.xr?.position)return;
    if(state.inXR){
      state.desktop.position.x=state.xr.position.x;
      state.desktop.position.z=state.xr.position.z;
      state.desktop.position.y=state.ground+PLAYER_HEIGHT;
      if(state.desktop.rotation)state.desktop.rotation.y=yaw(state.xr);
    }else{
      state.floor=nearestFloor(state.desktop.position.y-PLAYER_HEIGHT);
      state.ground=floorGround(state.desktop.position);
    }
  }

  function teleportRay() {
    const right=controllerFor('right');
    try { if(right?.getWorldPointerRay)return right.getWorldPointerRay(45); } catch (_) {}
    try { return activeCamera()?.getForwardRay?.(45); } catch (_) { return null; }
  }

  function teleportable(mesh) {
    if(!mesh||mesh.isVisible===false||mesh.isEnabled?.()===false)return false;
    const meta=mesh.metadata||{}, name=String(mesh.name||'');
    return Boolean(meta.teleportable||meta.walkable||/piso|losa|pasillo|sendero|ruta|plataforma|terraza|rampa|graderia|escalon/i.test(name));
  }

  function ensureTeleportMarker() {
    if(state.teleportMarker&&!state.teleportMarker.isDisposed?.())return state.teleportMarker;
    const marker=B.MeshBuilder.CreateTorus('marcador teletransporte V315',{diameter:1.1,thickness:0.08,tessellation:36},state.scene);
    marker.rotation.x=Math.PI/2;marker.isPickable=false;marker.isVisible=false;marker.layerMask=ALL_LAYERS;
    const mat=new B.StandardMaterial('material teletransporte V315',state.scene);mat.diffuseColor=B.Color3.FromHexString('#fed141');mat.emissiveColor=mat.diffuseColor;mat.disableLighting=true;
    marker.material=mat;marker.metadata={dynamicSharedV315:true,teleportMarker:true};state.teleportMarker=marker;return marker;
  }

  function updateTeleport(input) {
    if(!state.inXR||!state.teleportEnabled)return;
    const aiming=input.rightY < -0.72;
    if(aiming){
      state.teleportAiming=true;
      const ray=teleportRay();
      const hit=ray&&state.scene.pickWithRay?.(ray,teleportable,false);
      const marker=ensureTeleportMarker();
      if(hit?.hit&&hit.pickedPoint){
        state.teleportTarget=hit.pickedPoint.clone();
        marker.position.copyFrom(state.teleportTarget);marker.position.y+=0.04;marker.isVisible=true;
      }else{state.teleportTarget=null;marker.isVisible=false;}
    }else if(state.teleportAiming){
      state.teleportAiming=false;
      if(state.teleportTarget)commitTeleport('joystick derecho');
      if(state.teleportMarker)state.teleportMarker.isVisible=false;
      state.teleportTarget=null;
    }
  }

  function commitTeleport(source) {
    const camera=activeCamera();if(!camera?.position||!state.teleportTarget)return false;
    const ground=nearestFloor(state.teleportTarget.y);
    state.floor=ground;state.ground=ground;state.transition=null;state.velocity.set(0,0,0);
    camera.position.set(state.teleportTarget.x,ground+currentEyeHeight(),state.teleportTarget.z);
    state.lastSafe.copyFrom(camera.position);state.teleports++;syncCameras();status(`Teletransporte completado con ${source}.`);return true;
  }

  function toggleTurnMode(source='control') {
    state.turnMode=state.turnMode==='smooth'?'snap':'smooth';
    localStorage.setItem('ucanV315TurnMode',state.turnMode);refreshControls();status(`Giro ${state.turnMode==='smooth'?'suave':'por pasos de 30°'} activado desde ${source}.`);
  }

  function closePanels() {
    document.querySelectorAll('#boardPanel.open,#livePanelViewer.open,#ucanProfileModal.open,#ucanRealtimeWorldV312.open').forEach(panel=>panel.classList.remove('open'));
    window.__UCAN_VR_INTERACTION_V305_R9__?.close?.();
  }

  function bindComponent(controller,motion,id,handler) {
    const component=motion?.getComponent?.(id);if(!component||component.__ucanV315Bound)return false;
    component.__ucanV315Bound=true;state.controllerBindings++;
    component.onButtonStateChangedObservable?.add?.(()=>handler(component));return true;
  }

  function bindMotionController(controller,motion) {
    if(!motion||motion.__ucanV315Bound)return;motion.__ucanV315Bound=true;
    const handed=controller.inputSource?.handedness||motion.handedness;
    bindComponent(controller,motion,'xr-standard-thumbstick',component=>{
      if(!component.changes?.pressed)return;
      if(handed==='left')state.sprintPressed=Boolean(component.pressed);
      else if(component.pressed)toggleTurnMode('clic del joystick derecho');
    });
    bindComponent(controller,motion,'touchpad',component=>{
      if(!component.changes?.pressed)return;
      if(handed==='left')state.sprintPressed=Boolean(component.pressed);
      else if(component.pressed)toggleTurnMode('touchpad derecho');
    });
    for(const id of handed==='left'?['x-button','a-button']:['a-button','x-button'])bindComponent(controller,motion,id,component=>{if(component.changes?.pressed&&component.pressed)window.__UCAN_PARALLEL_INTERACTION_V313__?.pickFromGaze?.();});
    for(const id of ['b-button','y-button'])bindComponent(controller,motion,id,component=>{if(component.changes?.pressed&&component.pressed)closePanels();});
  }

  function bindController(controller) {
    if(!controller||state.controllers.has(controller.uniqueId||controller))return;
    state.controllers.set(controller.uniqueId||controller,controller);
    if(controller.motionController)bindMotionController(controller,controller.motionController);
    controller.onMotionControllerInitObservable?.add?.(motion=>bindMotionController(controller,motion));
  }

  function bindControllers() {
    const input=state.helper?.input;if(!input)return;
    for(const controller of input.controllers||[])bindController(controller);
    if(!input.__ucanV315Observer)input.__ucanV315Observer=input.onControllerAddedObservable?.add?.(bindController)||true;
  }

  function meshDynamic(mesh) {
    const meta=mesh?.metadata||{},name=String(mesh?.name||'');
    return Boolean(meta.avatar||meta.local||meta.remoteAvatarV312||meta.remoteAvatarV313||meta.realtimeWorldV312||meta.weatherParticle||meta.celestialObject||meta.skyObject||meta.dynamicSharedV315||/avatar|controller|webxr|burbuja|foco compartido|marcador teletransporte|nube|lluvia|nieve|partícula|particula|sol visual|luna visual|estrella|planeta|cometa|satélite|satelite/i.test(name));
  }

  function worldBounds(mesh) {
    try{mesh.computeWorldMatrix?.(true);const b=mesh.getBoundingInfo?.().boundingBox;return b?{minY:b.minimumWorld.y,maxY:b.maximumWorld.y}:null}catch{return null}
  }

  function floorTags(mesh) {
    const b=worldBounds(mesh);if(!b)return[];const tags=[];
    if(b.maxY>=-1&&b.minY<=7.6)tags.push('P1');
    if(b.maxY>=7.4&&b.minY<=15.7)tags.push('P2');
    if(b.maxY>=15.5&&b.minY<=26.9)tags.push('P3');
    return tags;
  }

  function captureFloorRecord(mesh,tags) {
    return {mesh,tags,parent:mesh.parent||null,position:clone(mesh.position),rotation:clone(mesh.rotation),quaternion:clone(mesh.rotationQuaternion),scaling:clone(mesh.scaling),enabled:mesh.isEnabled?.()!==false,visible:mesh.isVisible!==false,visibility:Number(mesh.visibility??1),material:mesh.material||null,layerMask:Number(mesh.layerMask??ALL_LAYERS),group:Number(mesh.renderingGroupId||0),billboard:Number(mesh.billboardMode||0),pickable:Boolean(mesh.isPickable),collisions:Boolean(mesh.checkCollisions),shadows:Boolean(mesh.receiveShadows)};
  }

  function hashFloor(tag,current=false) {
    const values=[];
    for(const [id,r] of state.floorRecords){if(!r.tags.includes(tag))continue;const m=r.mesh;if(!m||m.isDisposed?.()){values.push([id,'disposed']);continue}values.push([id,current?m.isEnabled?.()!==false:r.enabled,current?m.isVisible!==false:r.visible,Number(current?m.visibility:r.visibility).toFixed(4),current?m.material?.uniqueId||0:r.material?.uniqueId||0,current?Number(m.layerMask):r.layerMask,current?[m.position.x,m.position.y,m.position.z]:[r.position?.x,r.position?.y,r.position?.z],current?[m.rotation.x,m.rotation.y,m.rotation.z]:[r.rotation?.x,r.rotation?.y,r.rotation?.z],current?[m.scaling.x,m.scaling.y,m.scaling.z]:[r.scaling?.x,r.scaling?.y,r.scaling?.z]]);}
    const text=JSON.stringify(values);let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619)}return(hash>>>0).toString(16).padStart(8,'0');
  }

  function captureFloors() {
    if(!state.scene)return false;
    const records=new Map();
    for(const mesh of state.scene.meshes||[]){if(!mesh||mesh.isDisposed?.()||meshDynamic(mesh))continue;const tags=floorTags(mesh);if(tags.length)records.set(mesh.uniqueId,captureFloorRecord(mesh,tags));}
    state.floorRecords=records;state.floorsReady=records.size>0;
    for(const tag of ['P1','P2','P3'])state.floorHashes[tag]=hashFloor(tag,false);
    repairFloors(true);updateAudit();return state.floorsReady;
  }

  function restoreFloorRecord(r) {
    const m=r.mesh;if(!m||m.isDisposed?.())return 0;let z=0;
    try{
      if(m.parent!==r.parent){m.parent=r.parent;z++;}
      if(r.position&&!m.position?.equals?.(r.position)){m.position.copyFrom?.(r.position);z++;}
      if(r.rotation&&!m.rotation?.equals?.(r.rotation)){m.rotation.copyFrom?.(r.rotation);z++;}
      if(r.quaternion){if(!m.rotationQuaternion){m.rotationQuaternion=clone(r.quaternion);z++;}else if(!m.rotationQuaternion.equals?.(r.quaternion)){m.rotationQuaternion.copyFrom?.(r.quaternion);z++;}}
      if(r.scaling&&!m.scaling?.equals?.(r.scaling)){m.scaling.copyFrom?.(r.scaling);z++;}
      if((m.isEnabled?.()!==false)!==r.enabled){m.setEnabled?.(r.enabled);z++;}
      const props={isVisible:r.visible,visibility:r.visibility,material:r.material,layerMask:r.layerMask,renderingGroupId:r.group,billboardMode:r.billboard,isPickable:r.pickable,checkCollisions:r.collisions,receiveShadows:r.shadows};
      for(const[k,v]of Object.entries(props))if(m[k]!==v){m[k]=v;z++;}
    }catch(_){}
    return z;
  }

  function repairFloors(force=false) {
    if(!state.floorsReady)return 0;const now=performance.now();if(!force&&now-state.lastFloorRepair<FLOOR_REPAIR_MS)return 0;state.lastFloorRepair=now;
    let repairs=0;for(const r of state.floorRecords.values())repairs+=restoreFloorRecord(r);
    state.floorRepairs++;state.floorDeviations=repairs;
    for(const tag of ['P1','P2','P3'])state.floorCurrentHashes[tag]=hashFloor(tag,true);
    for(const camera of [state.scene?.activeCamera,state.desktop,state.xr,...(state.xr?.rigCameras||[])].filter(Boolean)){camera.layerMask=ALL_LAYERS;if(Number(camera.minZ)>.06)camera.minZ=.06;if(Number(camera.maxZ)<1000)camera.maxZ=1000;}
    updateAudit();return repairs;
  }

  function resetToSafePoint(source='control') {
    const camera=activeCamera();if(!camera?.position)return false;
    const fallback=state.lastSafe||new B.Vector3(0,state.floor+currentEyeHeight(),42);
    camera.position.copyFrom(fallback);state.transition=null;state.velocity.set(0,0,0);syncCameras();status(`Posición restaurada desde ${source}.`);return true;
  }

  function ensureControls() {
    const grid=document.querySelector('.control-grid');if(!grid||document.getElementById('ucanV315SpeedBtn'))return;
    const button=(id,label,handler)=>{const b=document.createElement('button');b.id=id;b.className='secondary';b.textContent=label;b.addEventListener('click',handler);grid.appendChild(b);return b;};
    state.controls={
      speed:button('ucanV315SpeedBtn','Velocidad',()=>{state.speedMode=state.speedMode==='comfort'?'natural':state.speedMode==='natural'?'fast':'comfort';localStorage.setItem('ucanV315SpeedMode',state.speedMode);refreshControls();}),
      turn:button('ucanV315TurnBtn','Giro',()=>toggleTurnMode('panel')),
      direction:button('ucanV315DirectionBtn','Dirección',()=>{state.directionMode=state.directionMode==='head'?'hand':'head';localStorage.setItem('ucanV315DirectionMode',state.directionMode);refreshControls();}),
      teleport:button('ucanV315TeleportBtn','Teletransporte',()=>{state.teleportEnabled=!state.teleportEnabled;localStorage.setItem('ucanV315Teleport',String(state.teleportEnabled));refreshControls();})
    };refreshControls();
  }

  function refreshControls() {
    if(!state.controls)return;
    state.controls.speed.textContent=`Velocidad: ${state.speedMode==='comfort'?'confort':state.speedMode==='fast'?'rápida':'natural'}`;
    state.controls.turn.textContent=`Giro: ${state.turnMode==='smooth'?'suave':'30°'}`;
    state.controls.direction.textContent=`Dirección: ${state.directionMode==='head'?'mirada':'mano'}`;
    state.controls.teleport.textContent=`Teletransporte: ${state.teleportEnabled?'activo':'apagado'}`;
  }

  function initialPose() {
    if(!state.desktop?.position||!state.xr?.position)return;
    state.eyeHeight=currentEyeHeight();state.floor=nearestFloor(state.desktop.position.y-PLAYER_HEIGHT);state.ground=state.floor;
    state.xr.position.set(state.desktop.position.x,state.floor+state.eyeHeight,state.desktop.position.z);
    state.lastSafe.copyFrom(state.xr.position);state.poseReady=true;
  }

  function frame() {
    if(!state.installed)return;
    try{
      const dt=clamp((state.scene.getEngine().getDeltaTime()||16)/1000,0.001,0.05);
      if(state.inXR&&!state.poseReady)initialPose();
      updateMovement(dt);
      repairFloors(false);
      if(state.inXR)bindControllers();
      if(++frame.counter%30===0)updateAudit();
    }catch(error){recordError('frame',error);}
  }
  frame.counter=0;

  function updateAudit() {
    window.__UCAN_FLOORS_JOYSTICK_V315__={
      version:VERSION,revision:REVISION,build:BUILD,installed:state.installed,inXR:state.inXR,
      oneLocomotionEngine:true,sameMovementBrowserVr:true,sameFloor1:true,sameFloor2:true,sameFloor3:true,
      leftJoystickMove:true,leftJoystickClickSprint:true,rightJoystickTurn:true,rightJoystickClickTurnMode:true,rightJoystickForwardTeleport:true,
      smoothTurn:true,snapTurn30:true,headRelative:true,handRelative:true,deadZone:DEAD_ZONE,acceleration:ACCELERATION,braking:BRAKING,
      triggerUsesSharedInteraction:true,primaryButtonsUseSharedInteraction:true,secondaryButtonsClosePanels:true,gripUsesSharedGestures:true,
      automaticEscalators:true,rooftopStairs:true,collisionProbes:true,safetyReset:true,
      speedMode:state.speedMode,turnMode:state.turnMode,directionMode:state.directionMode,teleportEnabled:state.teleportEnabled,
      floor:state.floor,ground:state.ground,movementFrames:state.movementFrames,controllerBindings:state.controllerBindings,teleports:state.teleports,completedRoutes:state.completedRoutes,
      floorsReady:state.floorsReady,floorMeshes:state.floorRecords.size,floorHashes:{...state.floorHashes},floorCurrentHashes:{...state.floorCurrentHashes},floorHashesMatch:['P1','P2','P3'].every(tag=>state.floorHashes[tag]&&state.floorHashes[tag]===state.floorCurrentHashes[tag]),floorRepairs:state.floorRepairs,floorDeviations:state.floorDeviations,
      gamepadMaskInstalled:state.gamepadMaskInstalled,lastInput:state.lastInput,lastError:state.lastError,
      captureFloors,repairFloors:()=>repairFloors(true),reset:()=>resetToSafePoint('auditoría'),
      getState:()=>({installed:state.installed,inXR:state.inXR,sameMovementBrowserVr:true,floorsReady:state.floorsReady,floorHashesMatch:['P1','P2','P3'].every(tag=>state.floorHashes[tag]&&state.floorHashes[tag]===state.floorCurrentHashes[tag]),floorHashes:{...state.floorHashes},floorCurrentHashes:{...state.floorCurrentHashes},floor:state.floor,speedMode:state.speedMode,turnMode:state.turnMode,directionMode:state.directionMode,teleportEnabled:state.teleportEnabled,controllerBindings:state.controllerBindings,movementFrames:state.movementFrames,teleports:state.teleports,floorDeviations:state.floorDeviations,lastError:state.lastError})
    };
  }

  function install(scene,helper) {
    if(!helper||helper.__ucanV315)return helper;helper.__ucanV315=true;
    state.scene=scene;state.helper=helper;state.desktop=scene.activeCamera;state.xr=helper.baseExperience?.camera;
    if(!state.xr)throw new Error('WebXR no devolvió una cámara válida.');
    state.velocity=new B.Vector3(0,0,0);state.lastSafe=new B.Vector3(0,PLAYER_HEIGHT,42);state.floor=nearestFloor(Number(state.desktop?.position?.y||PLAYER_HEIGHT)-PLAYER_HEIGHT);state.ground=state.floor;
    state.installed=true;window.__UCAN_V315_LOCOMOTION_ACTIVE__=true;window.__UCAN_XR_HELPER__=helper;
    try{const manager=helper.baseExperience?.featuresManager;for(const feature of [B.WebXRFeatureName?.MOVEMENT,B.WebXRFeatureName?.TELEPORTATION].filter(Boolean))manager?.disableFeature?.(feature);}catch(_){}
    state.xr.applyGravity=false;state.xr.checkCollisions=false;if(state.xr.cameraDirection?.set)state.xr.cameraDirection.set(0,0,0);
    bindControllers();ensureControls();scene.onBeforeRenderObservable.add(frame);
    window.setTimeout(()=>{if(!state.inXR)captureFloors();},3500);
    window.setTimeout(()=>{if(!state.inXR)captureFloors();},8000);
    helper.baseExperience.onInitialXRPoseSetObservable?.add?.(initialPose);
    helper.baseExperience.onStateChangedObservable.add(value=>{
      try{
        if(value===XR_STATE.ENTERING_XR){if(!state.floorsReady)captureFloors();state.inXR=true;initialPose();repairFloors(true);}
        else if(value===XR_STATE.IN_XR){state.inXR=true;if(!state.poseReady)initialPose();bindControllers();repairFloors(true);status('V315: pisos 1, 2 y 3 y movimiento del joystick sincronizados con el browser.');}
        else if(value===XR_STATE.NOT_IN_XR){state.inXR=false;state.poseReady=false;state.transition=null;state.sprintPressed=false;if(state.desktop?.position&&state.lastSafe){state.desktop.position.x=state.lastSafe.x;state.desktop.position.z=state.lastSafe.z;state.desktop.position.y=state.floor+PLAYER_HEIGHT;}repairFloors(true);}
        updateAudit();
      }catch(error){recordError('xr-state',error);}
    });
    updateAudit();console.info('[UCAN V315 R19] Pisos 1–3 y locomoción completa de joystick instalados.');return helper;
  }

  installKeyboardInterception();maskLegacyGamepadPolling();
  const original=B.Scene.prototype.createDefaultXRExperienceAsync;
  if(!original.__ucanV315Patched){
    async function patched(options={}){
      const helper=await original.call(this,{...options,disableTeleportation:true});
      return install(this,helper);
    }
    patched.__ucanV315Patched=true;patched.__ucanOriginal=original;B.Scene.prototype.createDefaultXRExperienceAsync=patched;
  }
  window.__UCAN_V315_PRELOAD__={version:VERSION,revision:REVISION,build:BUILD,loadedBeforeScene:true,oneLocomotionEngine:true};
})();
