(() => {
  'use strict';

  const VERSION = 'V269';
  const BUILD = 'V269-20260715-QUEST-GROUNDED';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) {
    console.warn('[UCAN V269] Babylon WebXR no está disponible.');
    return;
  }

  const LEVEL = Object.freeze({ one: 0, two: 8.2, three: 16.4, rooftop: 27.2 });
  const FLOORS = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.rooftop]);
  const WORLD = Object.freeze({ minX: -73, maxX: 73, minZ: -59, maxZ: 59 });
  const WALK_SPEED = 1.85;
  const ACCELERATION = 8.5;
  const BRAKING = 10.5;
  const DEAD_ZONE = 0.18;
  const SNAP_TURN = Math.PI / 6;
  const SNAP_THRESHOLD = 0.72;
  const EYE_HEIGHT_DEFAULT = 1.65;

  const STAIR_LANES = Object.freeze([
    { id:'p1-p2-oeste', minX:-24.8, maxX:-15.2, zBottom:34.4, zTop:7.6, yBottom:LEVEL.one, yTop:LEVEL.two },
    { id:'p2-p1-este', minX:-12.8, maxX:-3.2, zBottom:34.4, zTop:7.6, yBottom:LEVEL.one, yTop:LEVEL.two },
    { id:'p2-p3-oeste', minX:-38.8, maxX:-29.2, zBottom:34.4, zTop:7.6, yBottom:LEVEL.two, yTop:LEVEL.three },
    { id:'p3-p2-este', minX:-30.8, maxX:-21.2, zBottom:34.4, zTop:7.6, yBottom:LEVEL.two, yTop:LEVEL.three },
    { id:'p3-terraza', minX:38.7, maxX:49.3, zBottom:41.2, zTop:8.0, yBottom:LEVEL.three, yTop:LEVEL.rooftop }
  ]);

  const AUDITORIUM_RAMPS = Object.freeze([
    { id:'anfiteatro-central', minX:-5.2, maxX:1.6, zStart:-14.5, zEnd:19.3, yBase:LEVEL.three, rise:2.38 },
    { id:'anfiteatro-lateral', minX:17.8, maxX:23.2, zStart:-8.5, zEnd:19.3, yBase:LEVEL.three, rise:2.04 }
  ]);

  const state = {
    scene: null,
    helper: null,
    nonXrCamera: null,
    xrCamera: null,
    inXR: false,
    currentFloor: LEVEL.one,
    groundY: LEVEL.one,
    eyeHeight: EYE_HEIGHT_DEFAULT,
    calibrationFrames: 0,
    activeSurface: null,
    velocity: null,
    rightStickLatched: false,
    lastSafe: null,
    adjustedStairCollisions: 0,
    blockedFrames: 0,
    installedAt: null
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const nearestFloor = y => FLOORS.reduce((best, floor) => Math.abs(y - floor) < Math.abs(y - best) ? floor : best, FLOORS[0]);
  const finite = value => Number.isFinite(Number(value));

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const status = document.getElementById('status');
    if (status && !window.__UCAN_API__?.setStatus) status.textContent = message;
  }

  function insideLane(position, area) {
    return position.x >= area.minX && position.x <= area.maxX &&
      position.z >= Math.min(area.zTop, area.zBottom) && position.z <= Math.max(area.zTop, area.zBottom);
  }

  function stairSurface(position) {
    const lane = STAIR_LANES.find(item => insideLane(position, item));
    if (!lane) return null;
    const denominator = lane.zBottom - lane.zTop;
    const progress = denominator ? clamp((lane.zBottom - position.z) / denominator, 0, 1) : 0;
    return { id:lane.id, groundY:lerp(lane.yBottom, lane.yTop, progress), progress, low:lane.yBottom, high:lane.yTop };
  }

  function auditoriumSurface(position) {
    const ramp = AUDITORIUM_RAMPS.find(item => position.x >= item.minX && position.x <= item.maxX && position.z >= item.zStart && position.z <= item.zEnd);
    if (!ramp) return null;
    const progress = clamp((position.z - ramp.zStart) / (ramp.zEnd - ramp.zStart), 0, 1);
    return { id:ramp.id, groundY:ramp.yBase + ramp.rise * progress, progress, low:ramp.yBase, high:ramp.yBase + ramp.rise };
  }

  function surfaceAt(position) {
    return stairSurface(position) || auditoriumSurface(position);
  }

  function disableConflictingFeatures(helper) {
    const manager = helper?.baseExperience?.featuresManager;
    if (!manager) return;
    for (const name of [B.WebXRFeatureName?.MOVEMENT, B.WebXRFeatureName?.TELEPORTATION].filter(Boolean)) {
      try { manager.disableFeature(name); } catch (_) {}
    }
  }

  function disableStairStepCollisions(scene) {
    let adjusted = 0;
    const pattern = /peldaño|banda escalera|rampa invisible|plataforma (?:inicio|fin)|escalon central anfiteatro|pasillo lateral escalera anfiteatro/i;
    for (const mesh of scene.meshes || []) {
      if (!mesh || !pattern.test(String(mesh.name || ''))) continue;
      mesh.metadata = { ...(mesh.metadata || {}), xrStairSurface: true };
      if (mesh.checkCollisions) { mesh.checkCollisions = false; adjusted += 1; }
      mesh.isPickable = true;
    }
    return adjusted;
  }

  function readAxes(handedness) {
    const controllers = state.helper?.input?.controllers || [];
    const controller = controllers.find(item => {
      const hand = item?.inputSource?.handedness || item?.motionController?.handedness || '';
      return hand === handedness;
    });
    const gamepad = controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad;
    const axes = Array.from(gamepad?.axes || []);
    if (axes.length < 2) return { x:0, y:0 };
    const offset = axes.length >= 4 ? axes.length - 2 : 0;
    const rawX = finite(axes[offset]) ? Number(axes[offset]) : 0;
    const rawY = finite(axes[offset + 1]) ? Number(axes[offset + 1]) : 0;
    const applyDeadZone = value => {
      const magnitude = Math.abs(value);
      if (magnitude <= DEAD_ZONE) return 0;
      return Math.sign(value) * clamp((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE), 0, 1);
    };
    return { x:applyDeadZone(rawX), y:applyDeadZone(rawY) };
  }

  function cameraYaw(camera) {
    try {
      if (camera?.rotationQuaternion?.toEulerAngles) return camera.rotationQuaternion.toEulerAngles().y;
    } catch (_) {}
    return Number(camera?.rotation?.y || 0);
  }

  function horizontalBasis(camera) {
    let forward = null;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) {
      const yaw = cameraYaw(camera);
      forward = new B.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    }
    forward.y = 0;
    if (forward.lengthSquared?.() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    const right = new B.Vector3(forward.z, 0, -forward.x).normalize();
    return { forward, right };
  }

  function collisionPredicate(mesh) {
    if (!mesh || mesh.isVisible === false || mesh.metadata?.xrStairSurface) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (!mesh.checkCollisions) return false;
    const name = String(mesh.name || '');
    if (/gran losa|ruta avatar|zona segura VR|rooftop deck|rampa invisible|plataforma (?:inicio|fin)|peldaño|banda escalera/i.test(name)) return false;
    return true;
  }

  function blockedByGeometry(step, groundY) {
    const scene = state.scene;
    if (!scene?.pickWithRay || !B.Ray || step.lengthSquared() < 1e-7) return false;
    const direction = step.clone().normalize();
    const length = step.length() + 0.42;
    for (const height of [0.42, 1.18]) {
      const origin = new B.Vector3(state.xrCamera.position.x, groundY + height, state.xrCamera.position.z);
      const hit = scene.pickWithRay(new B.Ray(origin, direction, length), collisionPredicate, false);
      if (hit?.hit && hit.distance <= length) return true;
    }
    return false;
  }

  function applyHorizontalMovement(dt) {
    const camera = state.xrCamera;
    const left = readAxes('left');
    const { forward, right } = horizontalBasis(camera);
    const desired = right.scale(left.x).add(forward.scale(-left.y));
    if (desired.lengthSquared() > 1) desired.normalize();
    desired.scaleInPlace(WALK_SPEED);

    const moving = desired.lengthSquared() > 0.0001;
    const response = 1 - Math.exp(-(moving ? ACCELERATION : BRAKING) * dt);
    state.velocity = B.Vector3.Lerp(state.velocity, desired, response);
    state.velocity.y = 0;
    if (state.velocity.lengthSquared() < 0.0004) state.velocity.set(0, 0, 0);

    let step = state.velocity.scale(dt);
    const maxStep = WALK_SPEED * 0.05;
    if (step.length() > maxStep) step = step.normalize().scale(maxStep);
    if (step.lengthSquared() < 1e-8) return;

    const targetGround = surfaceAt(camera.position)?.groundY ?? state.currentFloor;
    if (!blockedByGeometry(step, targetGround)) {
      camera.position.x = clamp(camera.position.x + step.x, WORLD.minX, WORLD.maxX);
      camera.position.z = clamp(camera.position.z + step.z, WORLD.minZ, WORLD.maxZ);
      state.blockedFrames = 0;
      return;
    }

    const xStep = new B.Vector3(step.x, 0, 0);
    const zStep = new B.Vector3(0, 0, step.z);
    let moved = false;
    if (Math.abs(xStep.x) > 1e-5 && !blockedByGeometry(xStep, targetGround)) {
      camera.position.x = clamp(camera.position.x + xStep.x, WORLD.minX, WORLD.maxX);
      moved = true;
    }
    if (Math.abs(zStep.z) > 1e-5 && !blockedByGeometry(zStep, targetGround)) {
      camera.position.z = clamp(camera.position.z + zStep.z, WORLD.minZ, WORLD.maxZ);
      moved = true;
    }
    if (!moved) {
      state.velocity.scaleInPlace(0.15);
      state.blockedFrames += 1;
    }
  }

  function applySnapTurn() {
    const right = readAxes('right');
    if (Math.abs(right.x) < 0.35) { state.rightStickLatched = false; return; }
    if (state.rightStickLatched || Math.abs(right.x) < SNAP_THRESHOLD) return;
    state.rightStickLatched = true;
    const amount = right.x > 0 ? SNAP_TURN : -SNAP_TURN;
    const camera = state.xrCamera;
    if (camera.cameraRotation) camera.cameraRotation.y += amount;
    else if (camera.rotation) camera.rotation.y += amount;
  }

  function observedEyeHeight(camera) {
    const real = Number(camera?.realWorldHeight);
    if (finite(real) && real >= 0.75 && real <= 2.25) return real;
    return state.eyeHeight;
  }

  function updateGroundHeight(dt) {
    const camera = state.xrCamera;
    const surface = surfaceAt(camera.position);
    const physicalEye = observedEyeHeight(camera);
    if (state.calibrationFrames < 45) {
      state.calibrationFrames += 1;
      if (finite(camera.realWorldHeight) && camera.realWorldHeight >= 1.0 && camera.realWorldHeight <= 2.2) {
        state.eyeHeight = lerp(state.eyeHeight, camera.realWorldHeight, 0.18);
      }
    }

    let ground = state.currentFloor;
    if (surface) {
      ground = surface.groundY;
      state.activeSurface = surface.id;
      if (surface.progress <= 0.04) state.currentFloor = surface.low;
      if (surface.progress >= 0.96) state.currentFloor = surface.high;
    } else {
      const inferredBase = camera.position.y - physicalEye;
      const candidate = nearestFloor(inferredBase);
      if (Math.abs(inferredBase - candidate) < 1.05) state.currentFloor = candidate;
      if (state.activeSurface) {
        state.activeSurface = null;
        setStatus(`Meta Quest: nivel estabilizado en ${state.currentFloor === LEVEL.rooftop ? 'la terraza' : `el piso ${FLOORS.indexOf(state.currentFloor) + 1}`}.`);
      }
      ground = state.currentFloor;
    }

    state.groundY = ground;
    const targetY = ground + physicalEye;
    const currentY = Number(camera.position.y);
    if (!finite(currentY) || Math.abs(currentY - targetY) > 4.0) {
      camera.position.y = targetY;
    } else {
      const maxVertical = 1.35 * dt;
      camera.position.y = currentY + clamp(targetY - currentY, -maxVertical, maxVertical);
    }
    if (camera.cameraDirection) camera.cameraDirection.y = 0;
  }

  function syncDesktopAndAvatar() {
    const camera = state.xrCamera;
    const desktop = state.nonXrCamera;
    if (desktop) {
      desktop.position.x = camera.position.x;
      desktop.position.z = camera.position.z;
      desktop.position.y = state.groundY + 1.72;
      if (desktop.rotation) desktop.rotation.y = cameraYaw(camera);
    }
    const localAvatar = state.scene?.getTransformNodeByName?.('avatar-local');
    if (localAvatar?.isEnabled?.()) localAvatar.setEnabled(false);
  }

  function safetyCheck() {
    const camera = state.xrCamera;
    const position = camera.position;
    const valid = finite(position.x) && finite(position.y) && finite(position.z) &&
      position.x >= WORLD.minX - 2 && position.x <= WORLD.maxX + 2 &&
      position.z >= WORLD.minZ - 2 && position.z <= WORLD.maxZ + 2 &&
      position.y >= 0.45 && position.y <= LEVEL.rooftop + 3.2;
    if (!valid) {
      if (state.lastSafe) camera.position.copyFrom(state.lastSafe);
      else camera.position.set(0, state.currentFloor + state.eyeHeight, 42);
      state.velocity.set(0, 0, 0);
      setStatus('Meta Quest: se corrigió automáticamente una posición inestable.');
      return;
    }
    state.lastSafe.copyFrom(position);
  }

  function updateXR() {
    if (!state.inXR || !state.xrCamera) return;
    const dt = clamp((state.scene?.getEngine?.().getDeltaTime?.() || 16) / 1000, 0.001, 0.033);
    if (state.xrCamera.cameraDirection) state.xrCamera.cameraDirection.y = 0;
    applyHorizontalMovement(dt);
    applySnapTurn();
    updateGroundHeight(dt);
    safetyCheck();
    syncDesktopAndAvatar();
  }

  function initialFloorFromDesktop() {
    const desktopY = Number(state.nonXrCamera?.position?.y || EYE_HEIGHT_DEFAULT);
    return nearestFloor(desktopY - 1.72);
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanQuestGroundedV269) return helper;
    helper.__ucanQuestGroundedV269 = true;
    state.scene = scene;
    state.helper = helper;
    state.nonXrCamera = scene.activeCamera;
    state.xrCamera = helper.baseExperience.camera;
    state.velocity = new B.Vector3(0, 0, 0);
    state.lastSafe = new B.Vector3(0, EYE_HEIGHT_DEFAULT, 42);
    state.installedAt = new Date().toISOString();
    state.adjustedStairCollisions = disableStairStepCollisions(scene);

    disableConflictingFeatures(helper);
    const xrCamera = state.xrCamera;
    xrCamera.applyGravity = false;
    xrCamera.checkCollisions = false;
    xrCamera.minZ = 0.05;
    if (xrCamera.cameraDirection) xrCamera.cameraDirection.set(0, 0, 0);

    helper.baseExperience.onStateChangedObservable.add(xrState => {
      state.inXR = xrState === B.WebXRState.IN_XR;
      if (state.inXR) {
        disableConflictingFeatures(helper);
        state.currentFloor = initialFloorFromDesktop();
        state.groundY = state.currentFloor;
        state.calibrationFrames = 0;
        state.activeSurface = null;
        state.velocity.set(0, 0, 0);
        state.rightStickLatched = false;
        if (state.nonXrCamera?.position) {
          xrCamera.position.x = state.nonXrCamera.position.x;
          xrCamera.position.z = state.nonXrCamera.position.z;
        }
        const physicalEye = observedEyeHeight(xrCamera);
        xrCamera.position.y = state.currentFloor + physicalEye;
        state.lastSafe.copyFrom(xrCamera.position);
        setStatus('Meta Quest V269: joystick izquierdo para caminar y joystick derecho para girar. Movimiento fijado al suelo.');
      } else if (xrState === B.WebXRState.NOT_IN_XR && state.nonXrCamera) {
        state.velocity.set(0, 0, 0);
        state.nonXrCamera.position.x = xrCamera.position.x;
        state.nonXrCamera.position.z = xrCamera.position.z;
        state.nonXrCamera.position.y = state.currentFloor + 1.72;
      }
    });

    scene.onBeforeRenderObservable.add(updateXR);
    window.__UCAN_XR_HELPER__ = helper;
    window.__UCAN_QUEST_XR_AUDIT__ = {
      version: VERSION,
      build: BUILD,
      installed: true,
      groundedLocomotion: true,
      builtInMovementDisabled: true,
      verticalInputDisabled: true,
      leftStick: 'movimiento horizontal',
      rightStick: 'giro de 30 grados',
      collisionProbes: true,
      safetyClamp: true,
      desktopAvatarSync: true,
      floorTransitions: ['Piso 1 ↔ Piso 2', 'Piso 2 ↔ Piso 3', 'Piso 3 ↔ Terraza'],
      getState: () => ({
        inXR: state.inXR,
        floor: state.currentFloor,
        groundY: state.groundY,
        eyeHeight: state.eyeHeight,
        activeSurface: state.activeSurface,
        blockedFrames: state.blockedFrames,
        cameraPosition: state.xrCamera?.position?.asArray?.() || null
      })
    };
    console.info('[UCAN V269] Locomoción Meta Quest estabilizada:', window.__UCAN_QUEST_XR_AUDIT__);
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanQuestGroundedV269Patched) return;

  async function patchedCreateDefaultXRExperienceAsync(options = {}) {
    const helper = await original.call(this, { ...options, disableTeleportation: true });
    return install(this, helper);
  }
  patchedCreateDefaultXRExperienceAsync.__ucanQuestGroundedV269Patched = true;
  patchedCreateDefaultXRExperienceAsync.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patchedCreateDefaultXRExperienceAsync;

  window.__UCAN_QUEST_XR_BOOT__ = { version:VERSION, build:BUILD, patched:true, grounded:true };
  console.info('[UCAN V269] Interceptor WebXR estable preparado.');
})();