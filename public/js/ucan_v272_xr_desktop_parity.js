(() => {
  'use strict';

  const VERSION = 'V272';
  const BUILD = 'V272-20260717-XR-DESKTOP-PARITY-SPEED';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const LEVEL = Object.freeze({ one: 0, two: 8.2, three: 16.4, rooftop: 27.2 });
  const FLOORS = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.rooftop]);
  const WORLD = Object.freeze({ minX: -73, maxX: 73, minZ: -59, maxZ: 59 });
  const SPEEDS = Object.freeze({ comfort: 3.4, natural: 5.0, fast: 7.0 });
  const EYE = 1.65;
  const DEAD_ZONE = 0.14;
  const ACCELERATION = 22;
  const BRAKING = 26;
  const SMOOTH_TURN_SPEED = 1.9;
  const SNAP_TURN = Math.PI / 6;
  const SPEED_MIGRATION_KEY = 'ucanVrSpeedBuild';

  const LANES = Object.freeze([
    { id:'p1-p2-oeste', minX:-24.8, maxX:-15.2, zBottom:34.4, zTop:7.6, low:LEVEL.one, high:LEVEL.two },
    { id:'p2-p1-este', minX:-12.8, maxX:-3.2, zBottom:34.4, zTop:7.6, low:LEVEL.one, high:LEVEL.two },
    { id:'p2-p3-oeste', minX:-38.8, maxX:-29.2, zBottom:34.4, zTop:7.6, low:LEVEL.two, high:LEVEL.three },
    { id:'p3-p2-este', minX:-30.8, maxX:-21.2, zBottom:34.4, zTop:7.6, low:LEVEL.two, high:LEVEL.three },
    { id:'p3-terraza', minX:38.7, maxX:49.3, zBottom:41.2, zTop:8.0, low:LEVEL.three, high:LEVEL.rooftop }
  ]);

  const RAMPS = Object.freeze([
    { id:'anfiteatro-central', minX:-5.2, maxX:1.6, zStart:-14.5, zEnd:19.3, rise:2.38 },
    { id:'anfiteatro-lateral', minX:17.8, maxX:23.2, zStart:-8.5, zEnd:19.3, rise:2.04 }
  ]);

  let initialSpeedMode = localStorage.getItem('ucanVrSpeedMode') || 'natural';
  if (localStorage.getItem(SPEED_MIGRATION_KEY) !== BUILD || !SPEEDS[initialSpeedMode]) {
    initialSpeedMode = 'natural';
    localStorage.setItem('ucanVrSpeedMode', initialSpeedMode);
    localStorage.setItem(SPEED_MIGRATION_KEY, BUILD);
  }

  const state = {
    scene: null,
    helper: null,
    desktop: null,
    xr: null,
    inXR: false,
    stableFloor: LEVEL.one,
    groundY: LEVEL.one,
    transition: null,
    velocity: null,
    lastSafe: null,
    rightLatched: false,
    speedMode: initialSpeedMode,
    turnMode: localStorage.getItem('ucanVrTurnMode') || 'smooth',
    snapshot: null,
    meshes: [],
    materials: [],
    lastRestore: 0,
    captureStage: 'none',
    engine: null,
    originalScale: null,
    allowScale: false,
    alignedFromDesktop: false
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const same = (a, b) => Math.abs(Number(a) - Number(b)) < 0.05;
  const finite = value => Number.isFinite(Number(value));
  const nearestFloor = y => FLOORS.reduce((best, floor) => Math.abs(y - floor) < Math.abs(y - best) ? floor : best, FLOORS[0]);
  const clone = value => { try { return value?.clone?.() || value; } catch (_) { return value; } };
  const activeSpeed = () => SPEEDS[state.speedMode] || SPEEDS.natural;

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function insideLane(position, lane) {
    return position.x >= lane.minX && position.x <= lane.maxX &&
      position.z >= Math.min(lane.zTop, lane.zBottom) && position.z <= Math.max(lane.zTop, lane.zBottom);
  }

  function laneAt(position) {
    const active = state.transition && LANES.find(lane => lane.id === state.transition.id);
    if (active && insideLane(position, active)) return active;
    return LANES.find(lane =>
      (same(state.stableFloor, lane.low) || same(state.stableFloor, lane.high)) && insideLane(position, lane)
    ) || null;
  }

  function surfaceAt(position) {
    const lane = laneAt(position);
    if (lane) {
      const progress = clamp((lane.zBottom - position.z) / (lane.zBottom - lane.zTop), 0, 1);
      return { type:'stair', id:lane.id, low:lane.low, high:lane.high, progress, ground:lerp(lane.low, lane.high, progress) };
    }
    if (!same(state.stableFloor, LEVEL.three)) return null;
    const ramp = RAMPS.find(item => position.x >= item.minX && position.x <= item.maxX && position.z >= item.zStart && position.z <= item.zEnd);
    if (!ramp) return null;
    const progress = clamp((position.z - ramp.zStart) / (ramp.zEnd - ramp.zStart), 0, 1);
    return { type:'auditorium', id:ramp.id, progress, ground:LEVEL.three + ramp.rise * progress };
  }

  function eyeHeight() {
    const value = Number(state.xr?.realWorldHeight);
    return finite(value) && value >= 0.75 && value <= 2.25 ? value : EYE;
  }

  function updateFloor() {
    const surface = surfaceAt(state.xr.position);
    let ground = state.stableFloor;
    if (surface?.type === 'stair') {
      if (!state.transition || state.transition.id !== surface.id) state.transition = { id:surface.id, origin:state.stableFloor };
      ground = surface.ground;
      if (same(state.transition.origin, surface.low) && surface.progress >= 0.97) {
        state.stableFloor = surface.high;
        state.transition = null;
        ground = state.stableFloor;
      } else if (same(state.transition.origin, surface.high) && surface.progress <= 0.03) {
        state.stableFloor = surface.low;
        state.transition = null;
        ground = state.stableFloor;
      }
    } else if (surface?.type === 'auditorium') {
      state.transition = null;
      ground = surface.ground;
    } else {
      if (state.transition) {
        state.stableFloor = state.transition.origin;
        state.transition = null;
      }
      ground = state.stableFloor;
    }
    state.groundY = ground;
    state.xr.position.y = ground + eyeHeight();
    if (state.xr.cameraDirection) state.xr.cameraDirection.y = 0;
  }

  function controllerAxes(handedness) {
    const controller = (state.helper?.input?.controllers || []).find(item =>
      (item?.inputSource?.handedness || item?.motionController?.handedness) === handedness
    );
    const gamepad = controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad;
    const axes = Array.from(gamepad?.axes || []);
    if (axes.length < 2) return { x:0, y:0 };
    const offset = axes.length >= 4 ? axes.length - 2 : 0;
    const applyDeadZone = raw => {
      const value = finite(raw) ? Number(raw) : 0;
      const magnitude = Math.abs(value);
      if (magnitude <= DEAD_ZONE) return 0;
      return Math.sign(value) * clamp((magnitude - DEAD_ZONE) / (1 - DEAD_ZONE), 0, 1);
    };
    return { x:applyDeadZone(axes[offset]), y:applyDeadZone(axes[offset + 1]) };
  }

  function cameraYaw(camera) {
    try { if (camera?.rotationQuaternion?.toEulerAngles) return camera.rotationQuaternion.toEulerAngles().y; } catch (_) {}
    return Number(camera?.rotation?.y || 0);
  }

  function horizontalBasis(camera) {
    let forward;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) {
      const yaw = cameraYaw(camera);
      forward = new B.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    }
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z, 0, -forward.x).normalize() };
  }

  function collisionMesh(mesh) {
    if (!mesh || mesh.isVisible === false || mesh.metadata?.xrStairSurface) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (!mesh.checkCollisions) return false;
    return !/gran losa|ruta avatar|zona segura VR|rooftop deck|rampa invisible|plataforma (?:inicio|fin)|peldaño|banda escalera/i.test(String(mesh.name || ''));
  }

  function blocked(step, ground) {
    if (!state.scene?.pickWithRay || !B.Ray || step.lengthSquared() < 1e-7) return false;
    const direction = step.clone().normalize();
    const length = step.length() + 0.42;
    for (const height of [0.42, 1.18]) {
      const origin = new B.Vector3(state.xr.position.x, ground + height, state.xr.position.z);
      const hit = state.scene.pickWithRay(new B.Ray(origin, direction, length), collisionMesh, false);
      if (hit?.hit && hit.distance <= length) return true;
    }
    return false;
  }

  function move(dt) {
    const left = controllerAxes('left');
    const { forward, right } = horizontalBasis(state.xr);
    const desired = right.scale(left.x).add(forward.scale(-left.y));
    const magnitude = Math.min(1, Math.hypot(left.x, left.y));
    if (desired.lengthSquared() > 1) desired.normalize();
    desired.scaleInPlace(activeSpeed() * (0.72 + 0.28 * magnitude));
    const moving = desired.lengthSquared() > 0.0001;
    const response = 1 - Math.exp(-(moving ? ACCELERATION : BRAKING) * dt);
    state.velocity = B.Vector3.Lerp(state.velocity, desired, response);
    state.velocity.y = 0;
    if (state.velocity.lengthSquared() < 0.0004) state.velocity.set(0, 0, 0);
    let step = state.velocity.scale(dt);
    const maxStep = activeSpeed() * 0.05;
    if (step.length() > maxStep) step = step.normalize().scale(maxStep);
    if (step.lengthSquared() < 1e-8) return;
    const ground = surfaceAt(state.xr.position)?.ground ?? state.stableFloor;
    if (!blocked(step, ground)) {
      state.xr.position.x = clamp(state.xr.position.x + step.x, WORLD.minX, WORLD.maxX);
      state.xr.position.z = clamp(state.xr.position.z + step.z, WORLD.minZ, WORLD.maxZ);
      return;
    }
    for (const part of [new B.Vector3(step.x, 0, 0), new B.Vector3(0, 0, step.z)]) {
      if (part.lengthSquared() > 1e-8 && !blocked(part, ground)) {
        state.xr.position.x = clamp(state.xr.position.x + part.x, WORLD.minX, WORLD.maxX);
        state.xr.position.z = clamp(state.xr.position.z + part.z, WORLD.minZ, WORLD.maxZ);
      }
    }
  }

  function turn(dt) {
    const right = controllerAxes('right');
    const camera = state.xr;
    if (state.turnMode === 'smooth') {
      state.rightLatched = false;
      if (Math.abs(right.x) < 0.16) return;
      const amount = right.x * SMOOTH_TURN_SPEED * dt;
      if (camera.cameraRotation) camera.cameraRotation.y += amount;
      else if (camera.rotation) camera.rotation.y += amount;
      return;
    }
    if (Math.abs(right.x) < 0.35) { state.rightLatched = false; return; }
    if (state.rightLatched || Math.abs(right.x) < 0.72) return;
    state.rightLatched = true;
    const amount = right.x > 0 ? SNAP_TURN : -SNAP_TURN;
    if (camera.cameraRotation) camera.cameraRotation.y += amount;
    else if (camera.rotation) camera.rotation.y += amount;
  }

  function captureMesh(mesh) {
    const name = String(mesh?.name || '');
    return name && !/avatar|controller|motion.?controller|webxr|teleport|pointer|selection|gaze|laser|hand mesh|left hand|right hand|ray/i.test(name);
  }

  function captureVisual(stage) {
    const scene = state.scene;
    const desktop = state.desktop;
    const engine = scene.getEngine();
    const image = scene.imageProcessingConfiguration;
    state.meshes = (scene.meshes || []).filter(captureMesh).map(mesh => ({
      mesh,
      enabled: mesh.isEnabled?.() !== false,
      visible: mesh.isVisible !== false,
      visibility: Number(mesh.visibility ?? 1),
      layerMask: mesh.layerMask,
      renderingGroupId: mesh.renderingGroupId,
      alwaysSelectAsActiveMesh: Boolean(mesh.alwaysSelectAsActiveMesh),
      receiveShadows: Boolean(mesh.receiveShadows)
    }));
    state.materials = (scene.materials || []).map(material => ({
      material,
      alpha: material.alpha,
      backFaceCulling: material.backFaceCulling,
      disableLighting: material.disableLighting,
      wireframe: material.wireframe,
      pointsCloud: material.pointsCloud
    }));
    state.snapshot = {
      scaling: engine.getHardwareScalingLevel(),
      clearColor: clone(scene.clearColor),
      ambientColor: clone(scene.ambientColor),
      fogEnabled: scene.fogEnabled,
      fogMode: scene.fogMode,
      fogDensity: scene.fogDensity,
      fogStart: scene.fogStart,
      fogEnd: scene.fogEnd,
      fogColor: clone(scene.fogColor),
      environmentTexture: scene.environmentTexture,
      environmentIntensity: scene.environmentIntensity,
      autoClear: scene.autoClear,
      autoClearDepthAndStencil: scene.autoClearDepthAndStencil,
      shadowsEnabled: scene.shadowsEnabled,
      lightsEnabled: scene.lightsEnabled,
      texturesEnabled: scene.texturesEnabled,
      particlesEnabled: scene.particlesEnabled,
      postProcessesEnabled: scene.postProcessesEnabled,
      forceWireframe: scene.forceWireframe,
      forcePointsCloud: scene.forcePointsCloud,
      useRightHandedSystem: scene.useRightHandedSystem,
      contrast: image?.contrast,
      exposure: image?.exposure,
      toneMappingEnabled: image?.toneMappingEnabled,
      toneMappingType: image?.toneMappingType,
      cameraLayerMask: desktop?.layerMask,
      cameraMinZ: desktop?.minZ,
      cameraMaxZ: desktop?.maxZ,
      desktopPosition: clone(desktop?.position),
      desktopRotation: clone(desktop?.rotation),
      desktopRotationQuaternion: clone(desktop?.rotationQuaternion),
      desktopFov: desktop?.fov,
      environmentState: window.__UCAN_API__?.getEnvironment?.() || null,
      lights: (scene.lights || []).map(light => ({
        light,
        enabled: light.isEnabled?.() !== false,
        intensity: light.intensity,
        diffuse: clone(light.diffuse),
        specular: clone(light.specular),
        groundColor: clone(light.groundColor)
      }))
    };
    state.captureStage = stage;
    state.lastRestore = 0;
    window.__UCAN_XR_VISUAL_LOCK__ = {
      active: true,
      version: VERSION,
      build: BUILD,
      captureStage: stage,
      capturedMeshes: state.meshes.length,
      capturedMaterials: state.materials.length,
      capturedLights: state.snapshot.lights.length,
      rigCameraParity: true,
      fullSceneParity: true,
      sameAssetsAsDesktop: true,
      sameLightingAsDesktop: true
    };
  }

  function cameraParity(camera, snapshot) {
    if (!camera) return;
    camera.layerMask = snapshot.cameraLayerMask ?? camera.layerMask;
    camera.minZ = Math.max(0.05, Math.min(Number(snapshot.cameraMinZ || 0.08), 0.12));
    camera.maxZ = Math.max(Number(snapshot.cameraMaxZ || 0), 2500);
  }

  function alignXRWithDesktop() {
    if (!state.desktop || !state.xr) return;
    let aligned = false;
    try {
      if (typeof state.xr.setTransformationFromNonVRCamera === 'function') {
        state.xr.setTransformationFromNonVRCamera(state.desktop, true);
        aligned = true;
      }
    } catch (_) {}
    if (!aligned) {
      state.xr.position.x = state.desktop.position.x;
      state.xr.position.z = state.desktop.position.z;
      const desktopYaw = cameraYaw(state.desktop);
      if (state.xr.rotationQuaternion && B.Quaternion?.FromEulerAngles) {
        state.xr.rotationQuaternion.copyFrom(B.Quaternion.FromEulerAngles(0, desktopYaw, 0));
      } else if (state.xr.rotation) {
        state.xr.rotation.y = desktopYaw;
      }
    }
    state.alignedFromDesktop = true;
  }

  function restoreVisual(force = false) {
    if (!state.inXR || !state.snapshot) return;
    const scene = state.scene;
    const snapshot = state.snapshot;
    cameraParity(state.xr, snapshot);
    for (const camera of state.xr.rigCameras || []) cameraParity(camera, snapshot);
    const now = performance.now();
    if (!force && now - state.lastRestore < 120) return;
    state.lastRestore = now;
    if (snapshot.clearColor) scene.clearColor = clone(snapshot.clearColor);
    if (snapshot.ambientColor) scene.ambientColor = clone(snapshot.ambientColor);
    scene.fogEnabled = snapshot.fogEnabled;
    scene.fogMode = snapshot.fogMode;
    scene.fogDensity = snapshot.fogDensity;
    scene.fogStart = snapshot.fogStart;
    scene.fogEnd = snapshot.fogEnd;
    if (snapshot.fogColor) scene.fogColor = clone(snapshot.fogColor);
    scene.environmentTexture = snapshot.environmentTexture;
    scene.environmentIntensity = snapshot.environmentIntensity;
    scene.autoClear = snapshot.autoClear;
    scene.autoClearDepthAndStencil = snapshot.autoClearDepthAndStencil;
    scene.shadowsEnabled = snapshot.shadowsEnabled;
    scene.lightsEnabled = snapshot.lightsEnabled;
    scene.texturesEnabled = snapshot.texturesEnabled;
    scene.particlesEnabled = snapshot.particlesEnabled;
    scene.postProcessesEnabled = snapshot.postProcessesEnabled;
    scene.forceWireframe = snapshot.forceWireframe;
    scene.forcePointsCloud = snapshot.forcePointsCloud;
    scene.useRightHandedSystem = snapshot.useRightHandedSystem;
    if (typeof scene.setRenderingAutoClearDepthStencil === 'function') {
      for (const groupId of [1, 2, 3]) scene.setRenderingAutoClearDepthStencil(groupId, false, false, false);
    }
    const image = scene.imageProcessingConfiguration;
    if (image) {
      if (finite(snapshot.contrast)) image.contrast = snapshot.contrast;
      if (finite(snapshot.exposure)) image.exposure = snapshot.exposure;
      if (typeof snapshot.toneMappingEnabled === 'boolean') image.toneMappingEnabled = snapshot.toneMappingEnabled;
      if (snapshot.toneMappingType != null) image.toneMappingType = snapshot.toneMappingType;
    }
    for (const item of state.meshes) {
      if (!item.mesh || item.mesh.isDisposed?.()) continue;
      if (typeof item.mesh.setEnabled === 'function' && item.mesh.isEnabled() !== item.enabled) item.mesh.setEnabled(item.enabled);
      item.mesh.isVisible = item.visible;
      item.mesh.visibility = item.visibility;
      item.mesh.layerMask = item.layerMask;
      item.mesh.renderingGroupId = item.renderingGroupId;
      item.mesh.alwaysSelectAsActiveMesh = item.alwaysSelectAsActiveMesh;
      item.mesh.receiveShadows = item.receiveShadows;
    }
    for (const item of state.materials) {
      if (!item.material || item.material.isDisposed?.()) continue;
      item.material.alpha = item.alpha;
      item.material.backFaceCulling = item.backFaceCulling;
      item.material.disableLighting = item.disableLighting;
      item.material.wireframe = item.wireframe;
      item.material.pointsCloud = item.pointsCloud;
    }
    for (const item of snapshot.lights) {
      if (!item.light || item.light.isDisposed?.()) continue;
      if (typeof item.light.setEnabled === 'function' && item.light.isEnabled() !== item.enabled) item.light.setEnabled(item.enabled);
      item.light.intensity = item.intensity;
      if (item.diffuse) item.light.diffuse = clone(item.diffuse);
      if (item.specular) item.light.specular = clone(item.specular);
      if (item.groundColor) item.light.groundColor = clone(item.groundColor);
    }
    if (state.engine && Math.abs(state.engine.getHardwareScalingLevel() - snapshot.scaling) > 0.01) {
      state.allowScale = true;
      try { state.originalScale(snapshot.scaling); } finally { state.allowScale = false; }
    }
  }

  function installScalingGuard(engine) {
    state.engine = engine;
    if (state.originalScale) return;
    state.originalScale = engine.setHardwareScalingLevel.bind(engine);
    engine.setHardwareScalingLevel = value => state.inXR && !state.allowScale
      ? engine.getHardwareScalingLevel()
      : state.originalScale(value);
  }

  function disableConflictingFeatures(helper) {
    const manager = helper?.baseExperience?.featuresManager;
    if (!manager) return;
    for (const name of [B.WebXRFeatureName?.MOVEMENT, B.WebXRFeatureName?.TELEPORTATION].filter(Boolean)) {
      try { manager.disableFeature(name); } catch (_) {}
    }
  }

  function disableStairCollisions(scene) {
    for (const mesh of scene.meshes || []) {
      if (!/peldaño|banda escalera|rampa invisible|plataforma (?:inicio|fin)|escalon central anfiteatro|pasillo lateral escalera anfiteatro/i.test(String(mesh?.name || ''))) continue;
      mesh.metadata = { ...(mesh.metadata || {}), xrStairSurface:true };
      mesh.checkCollisions = false;
      mesh.isPickable = true;
    }
  }

  function safetyCheck() {
    const position = state.xr.position;
    const valid = finite(position.x) && finite(position.y) && finite(position.z) &&
      position.x >= WORLD.minX - 2 && position.x <= WORLD.maxX + 2 &&
      position.z >= WORLD.minZ - 2 && position.z <= WORLD.maxZ + 2 &&
      position.y >= 0.45 && position.y <= LEVEL.rooftop + 3.3;
    if (!valid) {
      state.xr.position.copyFrom(state.lastSafe || new B.Vector3(0, state.stableFloor + EYE, 42));
      state.velocity.set(0, 0, 0);
    } else {
      state.lastSafe.copyFrom(position);
    }
  }

  function syncDesktopAndAvatar() {
    if (state.desktop?.position) {
      state.desktop.position.x = state.xr.position.x;
      state.desktop.position.z = state.xr.position.z;
      state.desktop.position.y = state.groundY + 1.72;
      if (state.desktop.rotation) state.desktop.rotation.y = cameraYaw(state.xr);
    }
    const avatar = state.scene?.getTransformNodeByName?.('avatar-local');
    if (avatar?.isEnabled?.()) avatar.setEnabled(false);
  }

  function ensureControls() {
    const grid = document.querySelector('.control-grid');
    if (!grid || document.getElementById('ucanVrSpeedBtn')) return;
    const speedButton = document.createElement('button');
    speedButton.id = 'ucanVrSpeedBtn';
    speedButton.className = 'secondary';
    const labels = { comfort:'VR: confort 3.4', natural:'VR: igual PC 5.0', fast:'VR: rápido 7.0' };
    const refreshSpeed = () => {
      speedButton.textContent = labels[state.speedMode] || labels.natural;
      speedButton.setAttribute('aria-label', `Velocidad VR ${activeSpeed().toFixed(1)} metros por segundo`);
    };
    speedButton.onclick = () => {
      state.speedMode = state.speedMode === 'comfort' ? 'natural' : state.speedMode === 'natural' ? 'fast' : 'comfort';
      localStorage.setItem('ucanVrSpeedMode', state.speedMode);
      refreshSpeed();
      setStatus(`Velocidad VR: ${activeSpeed().toFixed(1)} m/s.`);
    };
    refreshSpeed();
    const turnButton = document.createElement('button');
    turnButton.id = 'ucanVrTurnBtn';
    turnButton.className = 'secondary';
    const refreshTurn = () => { turnButton.textContent = state.turnMode === 'smooth' ? 'Giro VR: suave' : 'Giro VR: 30°'; };
    turnButton.onclick = () => {
      state.turnMode = state.turnMode === 'smooth' ? 'snap' : 'smooth';
      localStorage.setItem('ucanVrTurnMode', state.turnMode);
      refreshTurn();
    };
    refreshTurn();
    grid.append(speedButton, turnButton);
  }

  function update() {
    if (!state.inXR) return;
    const dt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, 0.033);
    move(dt);
    turn(dt);
    updateFloor();
    restoreVisual();
    safetyCheck();
    syncDesktopAndAvatar();
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanV272) return helper;
    helper.__ucanV272 = true;
    state.scene = scene;
    state.helper = helper;
    state.desktop = scene.activeCamera;
    state.xr = helper.baseExperience.camera;
    state.velocity = new B.Vector3(0, 0, 0);
    state.lastSafe = new B.Vector3(0, EYE, 42);
    disableStairCollisions(scene);
    installScalingGuard(scene.getEngine());
    ensureControls();
    disableConflictingFeatures(helper);
    state.xr.applyGravity = false;
    state.xr.checkCollisions = false;
    if (state.xr.cameraDirection) state.xr.cameraDirection.set(0, 0, 0);
    helper.baseExperience.onStateChangedObservable.add(xrState => {
      if (xrState === B.WebXRState.ENTERING_XR) captureVisual('before-xr-camera-switch');
      state.inXR = xrState === B.WebXRState.IN_XR;
      if (state.inXR) {
        disableConflictingFeatures(helper);
        if (!state.snapshot) captureVisual('in-xr-fallback');
        state.stableFloor = nearestFloor(Number(state.desktop?.position?.y || EYE) - 1.72);
        state.groundY = state.stableFloor;
        state.transition = null;
        state.velocity.set(0, 0, 0);
        alignXRWithDesktop();
        if (state.desktop?.position) {
          state.xr.position.x = state.desktop.position.x;
          state.xr.position.z = state.desktop.position.z;
        }
        state.xr.position.y = state.stableFloor + eyeHeight();
        state.lastSafe.copyFrom(state.xr.position);
        restoreVisual(true);
        setStatus('Meta Quest V272: misma escena de computadora y velocidad normal de 5.0 m/s.');
      } else if (xrState === B.WebXRState.NOT_IN_XR && state.desktop?.position) {
        state.velocity.set(0, 0, 0);
        state.desktop.position.x = state.xr.position.x;
        state.desktop.position.z = state.xr.position.z;
        state.desktop.position.y = state.stableFloor + 1.72;
        if (window.__UCAN_XR_VISUAL_LOCK__) window.__UCAN_XR_VISUAL_LOCK__.active = false;
      }
    });
    scene.onBeforeRenderObservable.add(update);
    window.__UCAN_XR_HELPER__ = helper;
    window.__UCAN_QUEST_XR_AUDIT__ = {
      version: VERSION,
      build: BUILD,
      installed: true,
      groundedLocomotion: true,
      desktopSpeedParity: true,
      desktopNormalSpeed: 5.0,
      desktopComfortSpeed: 3.4,
      desktopFastSpeed: 7.0,
      currentSpeed: () => activeSpeed(),
      naturalMovement: true,
      visualParityLock: true,
      fullSceneParity: true,
      sameAssetsAsDesktop: true,
      sameLightingAsDesktop: true,
      stereoRigCameraParity: true,
      desktopPoseAlignment: true,
      desktopSnapshotBeforeXR: true,
      floorInferenceDisabled: true,
      auditoriumRestrictedToFloor3: true,
      builtInMovementDisabled: true,
      verticalInputDisabled: true,
      leftStick: 'movimiento horizontal igual a computadora',
      rightStick: 'giro suave o 30 grados',
      speedModes: SPEEDS,
      collisionProbes: true,
      safetyClamp: true,
      desktopAvatarSync: true,
      getState: () => ({
        inXR: state.inXR,
        floor: state.stableFloor,
        groundY: state.groundY,
        transition: state.transition ? { ...state.transition } : null,
        speedMode: state.speedMode,
        speed: activeSpeed(),
        visualCaptureStage: state.captureStage,
        alignedFromDesktop: state.alignedFromDesktop,
        cameraPosition: state.xr?.position?.asArray?.() || null
      })
    };
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanV272Patched) return;
  async function patched(options = {}) {
    const helper = await original.call(this, { ...options, disableTeleportation:true });
    return install(this, helper);
  }
  patched.__ucanV272Patched = true;
  patched.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patched;

  window.__UCAN_QUEST_XR_BOOT__ = {
    version: VERSION,
    build: BUILD,
    patched: true,
    grounded: true,
    visualParity: true,
    fullSceneParity: true,
    floorLock: true,
    desktopSpeedParity: true,
    defaultSpeed: 5.0
  };
  console.info('[UCAN V272] Paridad visual de escritorio y velocidad Meta Quest preparadas.');
})();
