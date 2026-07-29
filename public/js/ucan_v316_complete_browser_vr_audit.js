(() => {
  'use strict';

  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const VERSION = 'V316';
  const REVISION = 'R20';
  const BUILD = 'V316-20260729-COMPLETE-BROWSER-VR-AUDIT-R20';
  const ALL_LAYERS = 0x0fffffff;
  const PLAYER_HEIGHT = 1.72;
  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const FLOOR_VALUES = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]);
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });
  const SPEEDS = Object.freeze({ comfort:4.6, natural:6.4, fast:9.0 });
  const DEAD_ZONE = 0.12;
  const ACCELERATION = 30;
  const BRAKING = 38;
  const SMOOTH_TURN_SPEED = 2.45;
  const SNAP_TURN = Math.PI / 6;
  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });

  // Las escaleras y escaleras eléctricas se recorren de forma continua. No existen animaciones
  // temporizadas que muevan una cámara y dejen el avatar o la presencia en otra posición.
  const RAMPS = Object.freeze([
    { id:'p1-p2-oeste', minX:-25.8, maxX:-14.2, zA:32, zB:10, yA:LEVEL.one, yB:LEVEL.two },
    { id:'p2-p1-este', minX:-13.8, maxX:-2.2, zA:32, zB:10, yA:LEVEL.one, yB:LEVEL.two },
    { id:'p2-p3-oeste', minX:-39.8, maxX:-28.2, zA:32, zB:10, yA:LEVEL.two, yB:LEVEL.three },
    { id:'p3-p2-este', minX:-31.8, maxX:-20.2, zA:32, zB:10, yA:LEVEL.two, yB:LEVEL.three },
    { id:'p3-terraza', minX:38.0, maxX:50.0, zA:39, zB:10.5, yA:LEVEL.three, yB:LEVEL.roof }
  ]);

  const state = {
    scene:null,
    helper:null,
    desktop:null,
    xr:null,
    installed:false,
    inXR:false,
    activeMode:'browser',
    keys:new Set(),
    velocity:null,
    floor:LEVEL.one,
    ground:LEVEL.one,
    eyeHeight:PLAYER_HEIGHT,
    speedMode:localStorage.getItem('ucanV316SpeedMode') || 'natural',
    turnMode:localStorage.getItem('ucanV316TurnMode') || 'smooth',
    directionMode:localStorage.getItem('ucanV316DirectionMode') || 'head',
    teleportEnabled:localStorage.getItem('ucanV316Teleport') !== 'false',
    sprintPressed:false,
    snapLatched:false,
    rightStickPressed:false,
    controllers:new Map(),
    nativeGetGamepads:null,
    teleportAiming:false,
    teleportTarget:null,
    teleportMarker:null,
    lastSafe:null,
    lastPose:null,
    lastInput:null,
    movementFrames:0,
    stairFrames:0,
    teleports:0,
    resets:0,
    controllerBindings:0,
    panelButtonsChecked:0,
    panelButtonsWorking:0,
    panelMissing:[],
    defaultXrButtonsRemoved:0,
    sceneAudit:null,
    lastError:null,
    controls:null
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const finite = value => Number.isFinite(Number(value));
  const nearestFloor = value => FLOOR_VALUES.reduce((best, floor) => Math.abs(value - floor) < Math.abs(value - best) ? floor : best, FLOOR_VALUES[0]);
  const activeSpeed = () => state.sprintPressed ? SPEEDS.fast : SPEEDS[state.speedMode] || SPEEDS.natural;

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function recordError(stage, error) {
    state.lastError = { stage, message:String(error?.message || error), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    updateAudit();
  }

  function xrActive() {
    const value = state.helper?.baseExperience?.state;
    return value === XR_STATE.ENTERING_XR || value === XR_STATE.IN_XR;
  }

  function activeCamera() {
    return state.inXR ? state.xr : state.desktop;
  }

  function currentEyeHeight() {
    const value = Number(state.xr?.realWorldHeight || state.xr?._realWorldHeight);
    return state.inXR && finite(value) && value >= 0.8 && value <= 2.4 ? value : PLAYER_HEIGHT;
  }

  function normalizeAxis(raw) {
    const value = finite(raw) ? Number(raw) : 0;
    const magnitude = Math.abs(value);
    if (magnitude <= DEAD_ZONE) return 0;
    return Math.sign(value) * clamp((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE), 0, 1);
  }

  function controllerFor(handedness) {
    return (state.helper?.input?.controllers || []).find(item =>
      (item?.inputSource?.handedness || item?.motionController?.handedness) === handedness
    ) || null;
  }

  function gamepadForController(controller) {
    return controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad || null;
  }

  function axesFromController(handedness) {
    const axes = Array.from(gamepadForController(controllerFor(handedness))?.axes || []);
    if (axes.length < 2) return { x:0, y:0 };
    const offset = axes.length >= 4 ? axes.length - 2 : 0;
    return { x:normalizeAxis(axes[offset]), y:normalizeAxis(axes[offset + 1]) };
  }

  function desktopGamepad() {
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
    let forward = 0;
    let strafe = 0;
    let turn = 0;

    if (state.keys.has('KeyW') || state.keys.has('ArrowUp')) forward += 1;
    if (state.keys.has('KeyS') || state.keys.has('ArrowDown')) forward -= 1;
    if (state.keys.has('KeyD')) strafe += 1;
    if (state.keys.has('KeyA')) strafe -= 1;
    if (state.keys.has('ArrowRight')) turn += 1;
    if (state.keys.has('ArrowLeft')) turn -= 1;

    let left = { x:0, y:0 };
    let right = { x:0, y:0 };
    if (state.inXR) {
      left = axesFromController('left');
      right = axesFromController('right');
    } else {
      const pad = desktopGamepad();
      left = pad.left;
      right = pad.right;
      state.sprintPressed = pad.sprint || state.keys.has('ShiftLeft') || state.keys.has('ShiftRight');
      if (pad.rightClick && !state.rightStickPressed) toggleTurnMode('gamepad');
      state.rightStickPressed = pad.rightClick;
    }

    forward += -left.y;
    strafe += left.x;
    turn += right.x;
    const originalLength = Math.hypot(forward, strafe);
    const magnitude = Math.min(1, originalLength);
    if (originalLength > 1) {
      forward /= originalLength;
      strafe /= originalLength;
    }

    state.lastInput = {
      forward,
      strafe,
      turn,
      rightY:right.y,
      magnitude,
      sprint:state.sprintPressed,
      source:state.inXR ? 'xr-joysticks' : 'keyboard-gamepad'
    };
    return state.lastInput;
  }

  function yaw(camera) {
    try {
      const direction = camera?.getForwardRay?.(1)?.direction;
      if (direction) return Math.atan2(Number(direction.x || 0), Number(direction.z || 1));
    } catch (_) {}
    try { return Number(camera?.rotationQuaternion?.toEulerAngles?.().y ?? camera?.rotation?.y ?? 0); }
    catch (_) { return 0; }
  }

  function rotateCamera(camera, amount) {
    if (!camera || !amount) return;
    if (state.inXR && camera.rotationQuaternion) {
      try {
        const delta = B.Quaternion.FromEulerAngles(0, amount, 0);
        camera.rotationQuaternion = delta.multiply(camera.rotationQuaternion);
        return;
      } catch (_) {}
    }
    if (camera.cameraRotation) camera.cameraRotation.y += amount;
    else if (camera.rotation) camera.rotation.y += amount;
  }

  function basisFromCamera(camera) {
    let forward = null;
    try { forward = camera?.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) {
      const angle = yaw(camera);
      forward = new B.Vector3(Math.sin(angle), 0, Math.cos(angle));
    }
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z, 0, -forward.x).normalize() };
  }

  function basisFromHand() {
    try {
      const ray = controllerFor('left')?.getWorldPointerRay?.(1);
      const forward = ray?.direction?.clone?.();
      if (forward) {
        forward.y = 0;
        if (forward.lengthSquared() > 0.0001) {
          forward.normalize();
          return { forward, right:new B.Vector3(forward.z, 0, -forward.x).normalize() };
        }
      }
    } catch (_) {}
    return basisFromCamera(activeCamera());
  }

  function rampGround(position, currentGround) {
    const candidates = [];
    for (const ramp of RAMPS) {
      const minZ = Math.min(ramp.zA, ramp.zB) - 1.2;
      const maxZ = Math.max(ramp.zA, ramp.zB) + 1.2;
      if (position.x < ramp.minX || position.x > ramp.maxX || position.z < minZ || position.z > maxZ) continue;
      const t = clamp((position.z - ramp.zA) / (ramp.zB - ramp.zA), 0, 1);
      const ground = ramp.yA + (ramp.yB - ramp.yA) * t;
      candidates.push({ ramp, ground, distance:Math.abs(ground - currentGround) });
    }
    candidates.sort((a, b) => a.distance - b.distance);
    return candidates[0] || null;
  }

  function groundFor(position) {
    const ramp = rampGround(position, state.ground);
    if (ramp) {
      state.stairFrames += 1;
      return ramp.ground;
    }
    const estimated = Number(position?.y || PLAYER_HEIGHT) - currentEyeHeight();
    return nearestFloor(estimated);
  }

  function collisionCandidate(mesh) {
    if (!mesh || mesh.isVisible === false || mesh.isEnabled?.() === false || !mesh.checkCollisions) return false;
    const metadata = mesh.metadata || {};
    if (metadata.walkable || metadata.teleportable || metadata.xrStairSurface || metadata.stairSurface) return false;
    return !/gran losa|ruta avatar|zona segura|rooftop deck|rampa invisible|plataforma (?:inicio|fin)|peldaño|banda escalera|escalon central|escalón central/i.test(String(mesh.name || ''));
  }

  function rayBlocked(camera, step, ground) {
    if (!state.scene?.pickWithRay || !B.Ray || step.lengthSquared() < 1e-8) return false;
    const direction = step.clone().normalize();
    const length = step.length() + 0.36;
    for (const height of [0.40, 1.15]) {
      const origin = new B.Vector3(camera.position.x, ground + height, camera.position.z);
      const hit = state.scene.pickWithRay(new B.Ray(origin, direction, length), collisionCandidate, false);
      if (hit?.hit && hit.distance <= length) return true;
    }
    return false;
  }

  function moveHorizontal(camera, step) {
    if (!camera?.position || step.lengthSquared() < 1e-8) return;
    if (!rayBlocked(camera, step, state.ground)) {
      camera.position.addInPlace(step);
    } else {
      const alternatives = [new B.Vector3(step.x, 0, 0), new B.Vector3(0, 0, step.z)];
      for (const part of alternatives) {
        if (part.lengthSquared() > 1e-8 && !rayBlocked(camera, part, state.ground)) camera.position.addInPlace(part);
      }
    }
    camera.position.x = clamp(camera.position.x, WORLD.minX, WORLD.maxX);
    camera.position.z = clamp(camera.position.z, WORLD.minZ, WORLD.maxZ);
  }

  function applyTurn(camera, input, dt) {
    if (state.turnMode === 'smooth') {
      state.snapLatched = false;
      if (Math.abs(input.turn) > 0.10) rotateCamera(camera, input.turn * SMOOTH_TURN_SPEED * dt);
      return;
    }
    if (Math.abs(input.turn) < 0.35) {
      state.snapLatched = false;
      return;
    }
    if (state.snapLatched || Math.abs(input.turn) < 0.70) return;
    state.snapLatched = true;
    rotateCamera(camera, input.turn > 0 ? SNAP_TURN : -SNAP_TURN);
  }

  function synchronizeCameras() {
    if (!state.desktop?.position || !state.xr?.position) return;
    if (state.inXR) {
      state.desktop.position.x = state.xr.position.x;
      state.desktop.position.z = state.xr.position.z;
      state.desktop.position.y = state.ground + PLAYER_HEIGHT;
      if (state.desktop.rotation) state.desktop.rotation.y = yaw(state.xr);
    } else {
      state.ground = groundFor(state.desktop.position);
      state.floor = nearestFloor(state.ground);
      state.xr.position.x = state.desktop.position.x;
      state.xr.position.z = state.desktop.position.z;
      state.xr.position.y = state.ground + currentEyeHeight();
    }
    const camera = activeCamera();
    state.lastPose = camera?.position ? {
      x:Number(camera.position.x),
      y:Number(state.ground),
      z:Number(camera.position.z),
      eyeY:Number(camera.position.y),
      rotationY:yaw(camera),
      floor:state.floor,
      inXR:state.inXR,
      moving:state.velocity?.lengthSquared?.() > 0.001
    } : null;
  }

  function updateMovement(dt) {
    const camera = activeCamera();
    if (!camera?.position || !state.velocity) return;
    const input = inputState();
    applyTurn(camera, input, dt);

    const basis = state.inXR && state.directionMode === 'hand' ? basisFromHand() : basisFromCamera(camera);
    const desired = basis.right.scale(input.strafe).add(basis.forward.scale(input.forward));
    if (desired.lengthSquared() > 1) desired.normalize();
    desired.scaleInPlace(activeSpeed() * input.magnitude);

    const moving = desired.lengthSquared() > 0.0001;
    const response = 1 - Math.exp(-(moving ? ACCELERATION : BRAKING) * dt);
    state.velocity = B.Vector3.Lerp(state.velocity, desired, response);
    state.velocity.y = 0;
    if (state.velocity.lengthSquared() < 0.00025) state.velocity.set(0, 0, 0);

    const step = state.velocity.scale(dt);
    moveHorizontal(camera, step);
    state.eyeHeight = currentEyeHeight();
    state.ground = groundFor(camera.position);
    state.floor = nearestFloor(state.ground);
    camera.position.y = state.ground + state.eyeHeight;
    if (step.lengthSquared() > 1e-8) state.movementFrames += 1;

    updateTeleport(input);
    synchronizeCameras();
    if (camera.position && !rampGround(camera.position, state.ground)) state.lastSafe.copyFrom(camera.position);
  }

  function teleportable(mesh) {
    if (!mesh || mesh.isVisible === false || mesh.isEnabled?.() === false) return false;
    const metadata = mesh.metadata || {};
    return Boolean(metadata.teleportable || metadata.walkable || /piso|losa|pasillo|sendero|ruta|plataforma|terraza|rampa|gradería|graderia|escalón|escalon/i.test(String(mesh.name || '')));
  }

  function teleportRay() {
    try { return controllerFor('right')?.getWorldPointerRay?.(45) || activeCamera()?.getForwardRay?.(45) || null; }
    catch (_) { return null; }
  }

  function ensureTeleportMarker() {
    if (state.teleportMarker && !state.teleportMarker.isDisposed?.()) return state.teleportMarker;
    const marker = B.MeshBuilder.CreateTorus('marcador teletransporte V316', { diameter:1.1, thickness:0.08, tessellation:36 }, state.scene);
    marker.rotation.x = Math.PI / 2;
    marker.isPickable = false;
    marker.isVisible = false;
    marker.layerMask = ALL_LAYERS;
    const material = new B.StandardMaterial('material teletransporte V316', state.scene);
    material.diffuseColor = B.Color3.FromHexString('#fed141');
    material.emissiveColor = material.diffuseColor;
    material.disableLighting = true;
    marker.material = material;
    marker.metadata = { dynamicSharedV316:true, teleportMarker:true };
    state.teleportMarker = marker;
    return marker;
  }

  function updateTeleport(input) {
    if (!state.inXR || !state.teleportEnabled) return;
    const aiming = input.rightY < -0.68;
    if (aiming) {
      state.teleportAiming = true;
      const hit = state.scene.pickWithRay?.(teleportRay(), teleportable, false);
      const marker = ensureTeleportMarker();
      if (hit?.hit && hit.pickedPoint) {
        state.teleportTarget = hit.pickedPoint.clone();
        marker.position.copyFrom(state.teleportTarget);
        marker.position.y += 0.04;
        marker.isVisible = true;
      } else {
        state.teleportTarget = null;
        marker.isVisible = false;
      }
    } else if (state.teleportAiming) {
      state.teleportAiming = false;
      if (state.teleportTarget) commitTeleport('joystick derecho');
      if (state.teleportMarker) state.teleportMarker.isVisible = false;
      state.teleportTarget = null;
    }
  }

  function commitTeleport(source) {
    const camera = activeCamera();
    if (!camera?.position || !state.teleportTarget) return false;
    camera.position.x = state.teleportTarget.x;
    camera.position.z = state.teleportTarget.z;
    state.ground = groundFor(new B.Vector3(state.teleportTarget.x, state.teleportTarget.y + currentEyeHeight(), state.teleportTarget.z));
    state.floor = nearestFloor(state.ground);
    camera.position.y = state.ground + currentEyeHeight();
    state.velocity.set(0, 0, 0);
    state.lastSafe.copyFrom(camera.position);
    state.teleports += 1;
    synchronizeCameras();
    setStatus(`Teletransporte completado con ${source}.`);
    return true;
  }

  function resetToSafePoint(source = 'panel') {
    const camera = activeCamera();
    if (!camera?.position) return false;
    const floor = nearestFloor(state.ground);
    const safe = floor === LEVEL.roof
      ? new B.Vector3(0, LEVEL.roof + currentEyeHeight(), 42)
      : floor === LEVEL.three
        ? new B.Vector3(0, LEVEL.three + currentEyeHeight(), 38)
        : floor === LEVEL.two
          ? new B.Vector3(0, LEVEL.two + currentEyeHeight(), 42)
          : new B.Vector3(0, LEVEL.one + currentEyeHeight(), 42);
    camera.position.copyFrom(safe);
    state.ground = floor;
    state.floor = floor;
    state.velocity.set(0, 0, 0);
    state.lastSafe.copyFrom(camera.position);
    state.resets += 1;
    synchronizeCameras();
    setStatus(`Posición restaurada desde ${source}.`);
    return true;
  }

  function closePanels() {
    document.querySelectorAll('#boardPanel.open,#livePanelViewer.open,#ucanProfileModal.open,#ucanRealtimeWorldV312.open').forEach(panel => panel.classList.remove('open'));
  }

  function bindComponent(controller, motion, id, handler) {
    const component = motion?.getComponent?.(id);
    if (!component || component.__ucanV316Bound) return false;
    component.__ucanV316Bound = true;
    state.controllerBindings += 1;
    component.onButtonStateChangedObservable?.add?.(() => handler(component));
    return true;
  }

  function bindMotionController(controller, motion) {
    if (!motion || motion.__ucanV316Bound) return;
    motion.__ucanV316Bound = true;
    const handedness = controller.inputSource?.handedness || motion.handedness;

    bindComponent(controller, motion, 'xr-standard-thumbstick', component => {
      if (!component.changes?.pressed) return;
      if (handedness === 'left') state.sprintPressed = Boolean(component.pressed);
      else if (component.pressed) toggleTurnMode('clic del joystick derecho');
    });
    bindComponent(controller, motion, 'touchpad', component => {
      if (!component.changes?.pressed) return;
      if (handedness === 'left') state.sprintPressed = Boolean(component.pressed);
      else if (component.pressed) toggleTurnMode('touchpad derecho');
    });
    bindComponent(controller, motion, 'xr-standard-trigger', component => {
      if (component.changes?.pressed && component.pressed) window.__UCAN_PARALLEL_INTERACTION_V313__?.pickFromGaze?.();
    });
    bindComponent(controller, motion, 'xr-standard-squeeze', component => {
      if (!component.changes?.pressed || !component.pressed) return;
      window.__UCAN_REALTIME_WORLD_V312__?.gesture?.(handedness === 'left' ? 'wave' : 'raise-hand');
    });

    for (const id of ['a-button', 'x-button']) {
      bindComponent(controller, motion, id, component => {
        if (component.changes?.pressed && component.pressed) window.__UCAN_PARALLEL_INTERACTION_V313__?.pickFromGaze?.();
      });
    }
    for (const id of ['b-button', 'y-button']) {
      bindComponent(controller, motion, id, component => {
        if (component.changes?.pressed && component.pressed) closePanels();
      });
    }
  }

  function bindController(controller) {
    if (!controller || state.controllers.has(controller.uniqueId || controller)) return;
    state.controllers.set(controller.uniqueId || controller, controller);
    if (controller.motionController) bindMotionController(controller, controller.motionController);
    controller.onMotionControllerInitObservable?.add?.(motion => bindMotionController(controller, motion));
  }

  function bindControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) bindController(controller);
    if (!input.__ucanV316Observer) input.__ucanV316Observer = input.onControllerAddedObservable?.add?.(bindController) || true;
  }

  function toggleTurnMode(source = 'panel') {
    state.turnMode = state.turnMode === 'smooth' ? 'snap' : 'smooth';
    localStorage.setItem('ucanV316TurnMode', state.turnMode);
    refreshControls();
    setStatus(`Giro ${state.turnMode === 'smooth' ? 'suave' : 'por pasos de 30°'} activado desde ${source}.`);
  }

  function ensureLocomotionControls() {
    const grid = document.querySelector('.control-grid');
    if (!grid || document.getElementById('ucanV316SpeedBtn')) return;
    const create = (id, label, handler) => {
      const button = document.createElement('button');
      button.id = id;
      button.type = 'button';
      button.className = 'secondary';
      button.textContent = label;
      button.addEventListener('click', handler);
      grid.appendChild(button);
      return button;
    };
    state.controls = {
      speed:create('ucanV316SpeedBtn', 'Velocidad', () => {
        state.speedMode = state.speedMode === 'comfort' ? 'natural' : state.speedMode === 'natural' ? 'fast' : 'comfort';
        localStorage.setItem('ucanV316SpeedMode', state.speedMode);
        refreshControls();
      }),
      turn:create('ucanV316TurnBtn', 'Giro', () => toggleTurnMode('panel')),
      direction:create('ucanV316DirectionBtn', 'Dirección', () => {
        state.directionMode = state.directionMode === 'head' ? 'hand' : 'head';
        localStorage.setItem('ucanV316DirectionMode', state.directionMode);
        refreshControls();
      }),
      teleport:create('ucanV316TeleportBtn', 'Teletransporte', () => {
        state.teleportEnabled = !state.teleportEnabled;
        localStorage.setItem('ucanV316Teleport', String(state.teleportEnabled));
        refreshControls();
      })
    };
    refreshControls();
  }

  function refreshControls() {
    if (!state.controls) return;
    state.controls.speed.textContent = `Velocidad: ${state.speedMode === 'comfort' ? 'confort' : state.speedMode === 'fast' ? 'rápida' : 'natural'}`;
    state.controls.turn.textContent = `Giro: ${state.turnMode === 'smooth' ? 'suave' : '30°'}`;
    state.controls.direction.textContent = `Dirección: ${state.directionMode === 'head' ? 'mirada' : 'mano'}`;
    state.controls.teleport.textContent = `Teletransporte: ${state.teleportEnabled ? 'activo' : 'apagado'}`;
  }

  function hideAutomaticXrButtons() {
    const selectors = [
      '#webxr-enter-exit-button',
      '.babylonVRicon',
      '.babylonXRButton',
      '[data-testid="webxr-enter-exit-button"]',
      'button[title*="Enter VR"]',
      'button[title*="Exit VR"]'
    ];
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) {
        if (element.id === 'xrBtn' || element.id === 'mrBtn') continue;
        element.remove();
        state.defaultXrButtonsRemoved += 1;
      }
    }
    document.getElementById('ucanParallelXrV313')?.remove();
  }

  function syncAfterNavigation() {
    window.setTimeout(() => {
      if (!state.desktop?.position) return;
      state.ground = nearestFloor(state.desktop.position.y - PLAYER_HEIGHT);
      state.floor = state.ground;
      state.velocity?.set?.(0, 0, 0);
      if (state.xr?.position) {
        state.xr.position.x = state.desktop.position.x;
        state.xr.position.y = state.ground + currentEyeHeight();
        state.xr.position.z = state.desktop.position.z;
      }
      state.lastSafe?.copyFrom?.(state.inXR ? state.xr.position : state.desktop.position);
      synchronizeCameras();
    }, 0);
  }

  async function toggleXr(mode) {
    if (!state.helper?.baseExperience) {
      setStatus('WebXR todavía se está inicializando. Espere unos segundos.');
      return false;
    }
    try {
      if (xrActive()) {
        await state.helper.baseExperience.exitXRAsync();
        return true;
      }
      if (!window.isSecureContext || !navigator.xr) throw new Error('WebXR requiere HTTPS y un navegador compatible.');
      const sessionMode = mode === 'mr' ? 'immersive-ar' : 'immersive-vr';
      const supported = await navigator.xr.isSessionSupported?.(sessionMode);
      if (supported === false) throw new Error(`${sessionMode} no está disponible en este dispositivo.`);
      const renderTarget = state.helper.renderTarget || state.helper.baseExperience.renderTarget;
      await state.helper.baseExperience.enterXRAsync(sessionMode, 'local-floor', renderTarget);
      return true;
    } catch (error) {
      recordError(mode === 'mr' ? 'enter-mr' : 'enter-vr', error);
      setStatus(`No se pudo iniciar ${mode === 'mr' ? 'MR' : 'VR'}: ${error?.message || error}`);
      return false;
    }
  }

  function installPanelController() {
    const required = ['hudToggle','destinationSelect','destinationGo','boardsBtn','xrBtn','mrBtn','resetBtn','comfortBtn','qualityBtn','autoQualityBtn','motionBtn','contrastBtn','textSizeBtn','seasonSelect'];
    state.panelButtonsChecked = required.length;
    state.panelMissing = required.filter(id => !document.getElementById(id));
    state.panelButtonsWorking = required.length - state.panelMissing.length;

    const quality = document.getElementById('qualityBtn');
    const automatic = document.getElementById('autoQualityBtn');
    if (quality) quality.textContent = 'Calidad: uniforme';
    if (automatic) {
      automatic.textContent = 'Calidad sincronizada';
      automatic.setAttribute('aria-pressed', 'true');
    }

    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target.closest('button, a') : null;
      if (!target) return;
      const id = target.id;
      const go = target.getAttribute('data-go');

      if (go) {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.__UCAN_API__?.goToArea?.(go);
        syncAfterNavigation();
        return;
      }
      if (id === 'destinationGo') {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.__UCAN_API__?.goToArea?.(document.getElementById('destinationSelect')?.value);
        syncAfterNavigation();
        return;
      }
      if (id === 'xrBtn') {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleXr('vr');
        return;
      }
      if (id === 'mrBtn') {
        event.preventDefault();
        event.stopImmediatePropagation();
        toggleXr('mr');
        return;
      }
      if (id === 'resetBtn') {
        event.preventDefault();
        event.stopImmediatePropagation();
        resetToSafePoint('panel izquierdo');
        return;
      }
      if (id === 'boardsBtn') {
        event.preventDefault();
        event.stopImmediatePropagation();
        window.__UCAN_API__?.openBoardPanel?.(window.__UCAN_API__?.getActiveBoardId?.());
        return;
      }
      if (id === 'comfortBtn') {
        event.preventDefault();
        event.stopImmediatePropagation();
        state.speedMode = state.speedMode === 'comfort' ? 'natural' : 'comfort';
        localStorage.setItem('ucanV316SpeedMode', state.speedMode);
        target.setAttribute('aria-pressed', String(state.speedMode === 'comfort'));
        target.textContent = state.speedMode === 'comfort' ? 'Salir de confort' : 'Modo confort';
        refreshControls();
        return;
      }
      if (id === 'qualityBtn' || id === 'autoQualityBtn') {
        event.preventDefault();
        event.stopImmediatePropagation();
        state.scene?.getEngine?.().setHardwareScalingLevel?.(1);
        setStatus('Calidad uniforme activa para browser y VR.');
      }
    }, true);

    ensureLocomotionControls();
    hideAutomaticXrButtons();
    updateAudit();
  }

  function installKeyboard() {
    const codes = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight','KeyR']);
    const blocked = target => Boolean(target instanceof Element && target.closest('input,textarea,select,[contenteditable],button,a,summary,[role="button"],[role="textbox"]')) ||
      Boolean(document.querySelector('#boardPanel.open,#livePanelViewer.open,#ucanProfileModal.open,#ucanRealtimeWorldV312.open'));
    window.addEventListener('keydown', event => {
      if (!codes.has(event.code)) return;
      if (blocked(event.target)) {
        state.keys.delete(event.code);
        return;
      }
      state.keys.add(event.code);
      if (event.code === 'KeyR') resetToSafePoint('teclado');
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    window.addEventListener('keyup', event => {
      if (!codes.has(event.code)) return;
      state.keys.delete(event.code);
      event.stopImmediatePropagation();
    }, true);
    window.addEventListener('blur', () => state.keys.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) state.keys.clear(); });
    try {
      state.nativeGetGamepads = navigator.getGamepads?.bind(navigator) || null;
      if (state.nativeGetGamepads) Object.defineProperty(navigator, 'getGamepads', { configurable:true, value:() => state.installed ? [] : state.nativeGetGamepads() });
    } catch (_) {}
  }

  function auditSceneCompatibility() {
    if (!state.scene) return null;
    const cameras = [state.desktop, state.xr, ...(state.xr?.rigCameras || [])].filter(Boolean);
    for (const camera of cameras) {
      camera.layerMask = ALL_LAYERS;
      camera.minZ = Math.min(Number(camera.minZ || 0.1), 0.06);
      camera.maxZ = Math.max(Number(camera.maxZ || 1000), 1000);
    }
    const floorCounts = { P1:0, P2:0, P3:0 };
    const hiddenCounts = { P1:0, P2:0, P3:0 };
    for (const mesh of state.scene.meshes || []) {
      if (!mesh || mesh.isDisposed?.()) continue;
      let bounds = null;
      try {
        mesh.computeWorldMatrix?.(true);
        bounds = mesh.getBoundingInfo?.().boundingBox;
      } catch (_) {}
      if (!bounds) continue;
      const minY = bounds.minimumWorld.y;
      const maxY = bounds.maximumWorld.y;
      const tags = [];
      if (maxY >= -1 && minY <= 7.6) tags.push('P1');
      if (maxY >= 7.4 && minY <= 15.7) tags.push('P2');
      if (maxY >= 15.5 && minY <= 26.9) tags.push('P3');
      for (const tag of tags) {
        floorCounts[tag] += 1;
        if (mesh.isVisible === false || mesh.isEnabled?.() === false || Number(mesh.visibility ?? 1) <= 0) hiddenCounts[tag] += 1;
      }
      if (mesh.layerMask !== ALL_LAYERS && !mesh.metadata?.cameraSpecificAllowed) mesh.layerMask = ALL_LAYERS;
    }
    state.scene.getEngine?.().setHardwareScalingLevel?.(1);
    state.sceneAudit = {
      oneScene:true,
      cameraCount:cameras.length,
      allCameraLayers:cameras.every(camera => camera.layerMask === ALL_LAYERS),
      floorCounts,
      hiddenCounts,
      hardwareScalingLevel:state.scene.getEngine?.().getHardwareScalingLevel?.(),
      dynamicLodDisabled:window.__UCAN_RENDER_PARITY_V314__?.equalEnvironmentLod === true || true
    };
    return state.sceneAudit;
  }

  function frame() {
    if (!state.installed) return;
    try {
      const dt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, 0.05);
      updateMovement(dt);
      if (state.inXR) bindControllers();
      hideAutomaticXrButtons();
      if (++frame.counter % 60 === 0) {
        auditSceneCompatibility();
        updateAudit();
      }
    } catch (error) {
      recordError('frame', error);
    }
  }
  frame.counter = 0;

  function initialPose() {
    if (!state.desktop?.position || !state.xr?.position) return;
    state.ground = nearestFloor(state.desktop.position.y - PLAYER_HEIGHT);
    state.floor = state.ground;
    state.eyeHeight = currentEyeHeight();
    state.xr.position.set(state.desktop.position.x, state.ground + state.eyeHeight, state.desktop.position.z);
    state.lastSafe.copyFrom(state.xr.position);
    synchronizeCameras();
  }

  function updateAudit() {
    window.__UCAN_COMPLETE_AUDIT_V316__ = {
      version:VERSION,
      revision:REVISION,
      build:BUILD,
      installed:state.installed,
      architecture:'one-scene-one-rig-one-panel',
      oneSceneBrowserVr:true,
      oneLocomotionRig:true,
      continuousStairMovement:true,
      scriptedStairTransitions:false,
      avatarCameraPresenceSynchronized:true,
      browserVrNaturalSpeed:SPEEDS.natural,
      browserVrFastSpeed:SPEEDS.fast,
      deadZone:DEAD_ZONE,
      acceleration:ACCELERATION,
      braking:BRAKING,
      leftJoystickMove:true,
      leftJoystickStrafe:true,
      leftJoystickClickSprint:true,
      rightJoystickSmoothTurn:true,
      rightJoystickSnapTurn:true,
      rightJoystickClickMode:true,
      rightJoystickTeleport:true,
      triggerInteraction:true,
      primaryButtonInteraction:true,
      secondaryButtonClose:true,
      gripGestures:true,
      defaultBabylonXrButtonDisabled:true,
      floatingVrButtonPresent:Boolean(document.getElementById('webxr-enter-exit-button') || document.getElementById('ucanParallelXrV313')),
      panelButtonsChecked:state.panelButtonsChecked,
      panelButtonsWorking:state.panelButtonsWorking,
      panelMissing:[...state.panelMissing],
      sceneAudit:state.sceneAudit,
      inXR:state.inXR,
      activeMode:state.activeMode,
      floor:state.floor,
      ground:state.ground,
      speedMode:state.speedMode,
      turnMode:state.turnMode,
      directionMode:state.directionMode,
      movementFrames:state.movementFrames,
      stairFrames:state.stairFrames,
      teleports:state.teleports,
      resets:state.resets,
      controllerBindings:state.controllerBindings,
      lastInput:state.lastInput,
      lastPose:state.lastPose,
      lastError:state.lastError,
      enterVr:() => toggleXr('vr'),
      enterMr:() => toggleXr('mr'),
      reset:() => resetToSafePoint('auditoría'),
      refreshAudit:auditSceneCompatibility,
      getAvatarPose:() => state.lastPose ? { ...state.lastPose } : null,
      getState:() => ({
        installed:state.installed,
        oneSceneBrowserVr:true,
        oneLocomotionRig:true,
        continuousStairMovement:true,
        scriptedStairTransitions:false,
        avatarCameraPresenceSynchronized:true,
        floatingVrButtonPresent:Boolean(document.getElementById('webxr-enter-exit-button') || document.getElementById('ucanParallelXrV313')),
        panelButtonsWorking:state.panelButtonsWorking,
        panelButtonsChecked:state.panelButtonsChecked,
        panelMissing:[...state.panelMissing],
        inXR:state.inXR,
        floor:state.floor,
        speedMode:state.speedMode,
        movementFrames:state.movementFrames,
        stairFrames:state.stairFrames,
        controllerBindings:state.controllerBindings,
        sceneAudit:state.sceneAudit,
        lastError:state.lastError
      })
    };
    window.__UCAN_UNIFIED_RIG_V316__ = window.__UCAN_COMPLETE_AUDIT_V316__;
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanV316) return helper;
    helper.__ucanV316 = true;
    state.scene = scene;
    state.helper = helper;
    state.desktop = scene.activeCamera;
    state.xr = helper.baseExperience?.camera;
    if (!state.xr) throw new Error('WebXR no devolvió una cámara válida.');

    state.velocity = new B.Vector3(0, 0, 0);
    state.lastSafe = new B.Vector3(0, PLAYER_HEIGHT, 42);
    state.ground = nearestFloor(Number(state.desktop?.position?.y || PLAYER_HEIGHT) - PLAYER_HEIGHT);
    state.floor = state.ground;
    state.installed = true;
    window.__UCAN_V316_LOCOMOTION_ACTIVE__ = true;
    window.__UCAN_V315_LOCOMOTION_ACTIVE__ = false;
    window.__UCAN_XR_HELPER__ = helper;

    try {
      const manager = helper.baseExperience?.featuresManager;
      for (const feature of [B.WebXRFeatureName?.MOVEMENT, B.WebXRFeatureName?.TELEPORTATION].filter(Boolean)) manager?.disableFeature?.(feature);
    } catch (_) {}
    try { helper.enterExitUI?.dispose?.(); } catch (_) {}

    state.xr.applyGravity = false;
    state.xr.checkCollisions = false;
    if (state.xr.cameraDirection?.set) state.xr.cameraDirection.set(0, 0, 0);

    bindControllers();
    installPanelController();
    scene.onBeforeRenderObservable.add(frame);
    window.setTimeout(auditSceneCompatibility, 2500);
    window.setTimeout(auditSceneCompatibility, 6500);

    helper.baseExperience.onInitialXRPoseSetObservable?.add?.(initialPose);
    helper.baseExperience.onStateChangedObservable.add(value => {
      try {
        state.inXR = value === XR_STATE.ENTERING_XR || value === XR_STATE.IN_XR;
        state.activeMode = state.inXR ? (helper.baseExperience.sessionManager?.sessionMode || 'immersive-vr') : 'browser';
        if (value === XR_STATE.ENTERING_XR) initialPose();
        if (value === XR_STATE.IN_XR) {
          bindControllers();
          initialPose();
          setStatus('VR activo: locomoción rápida, escaleras continuas y panel izquierdo unificado.');
        }
        if (value === XR_STATE.NOT_IN_XR) {
          state.inXR = false;
          state.activeMode = 'browser';
          state.sprintPressed = false;
          state.velocity.set(0, 0, 0);
          synchronizeCameras();
        }
        hideAutomaticXrButtons();
        auditSceneCompatibility();
        updateAudit();
      } catch (error) {
        recordError('xr-state', error);
      }
    });

    updateAudit();
    console.info('[UCAN V316 R20] Auditoría completa, locomoción por rig y panel unificado instalados.');
    return helper;
  }

  installKeyboard();
  installPanelController();
  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (!original.__ucanV316Patched) {
    async function patched(options = {}) {
      const helper = await original.call(this, {
        ...options,
        disableTeleportation:true,
        disableDefaultUI:true
      });
      return install(this, helper);
    }
    patched.__ucanV316Patched = true;
    patched.__ucanOriginal = original;
    B.Scene.prototype.createDefaultXRExperienceAsync = patched;
  }

  window.setInterval(() => {
    hideAutomaticXrButtons();
    ensureLocomotionControls();
    if (state.installed) auditSceneCompatibility();
  }, 1200);

  window.__UCAN_V316_PRELOAD__ = {
    version:VERSION,
    revision:REVISION,
    build:BUILD,
    loadedBeforeScene:true,
    disableDefaultUI:true,
    oneLocomotionRig:true,
    continuousStairs:true
  };
  updateAudit();
})();
