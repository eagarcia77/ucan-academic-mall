(() => {
  'use strict';

  const VERSION = 'V301';
  const BUILD = 'V301-20260723-QUEST-RAILS-SELECTION-COMFORT';
  const B = window.BABYLON;
  if (!B) return;

  const XR_STATE = B.WebXRState || Object.freeze({ NOT_IN_XR:0, ENTERING_XR:1, IN_XR:2, EXITING_XR:3 });
  const LEVEL = Object.freeze({ one:0, two:8.2, three:16.4, roof:27.2 });
  const WORLD = Object.freeze({ minX:-73, maxX:73, minZ:-59, maxZ:59 });
  const STAIR = Object.freeze({ minX:40.8, maxX:47.2, minZ:9.0, maxZ:40.5, bottomZ:39.0, topZ:10.5 });
  const SPEED = Object.freeze({ comfortWalk:3.0, comfortRun:4.8, walk:5.0, run:7.0 });
  const TURN = Object.freeze({ snapDegrees:30, snapCooldownMs:320, smoothSpeed:1.75 });
  const DEAD_ZONE = 0.18;
  const MAX_FRAME_DT = 0.12;
  const MAX_MOVE_SUBSTEP = 0.14;
  const PLAYER_HEIGHT = 1.72;
  const RAY_LENGTH = 350;
  const JUMP_DURATION_MS = 680;
  const JUMP_HEIGHT_NORMAL = 0.92;
  const JUMP_HEIGHT_COMFORT = 0.52;

  const state = {
    scene:null,
    helper:null,
    xr:null,
    desktop:null,
    installed:false,
    inXR:false,
    questDevice:false,
    controllers:new Map(),
    floor:LEVEL.one,
    rooftopCommitted:false,
    currentSpeed:0,
    smoothedDirection:new B.Vector3(0,0,1),
    sprintHeld:false,
    jumpRequested:false,
    jumpActive:false,
    jumpStart:0,
    jumpBaseGround:0,
    lastSnapAt:0,
    snapReady:true,
    vignetteUntil:0,
    vignetteRoot:null,
    vignetteMaterial:null,
    vignetteTexture:null,
    originalComfortPressed:null,
    comfortForced:false,
    hiddenMeshes:new Map(),
    originalPickability:new Map(),
    floorOriginals:new Map(),
    createdMeshes:[],
    createdMaterials:[],
    stableFloorMaterial:null,
    collisionCache:[],
    collisionCacheAt:0,
    lastInteractionScan:0,
    movementFrames:0,
    floorThreeMovementFrames:0,
    sprintFrames:0,
    jumpCount:0,
    jumpFrames:0,
    snapTurns:0,
    smoothTurnFrames:0,
    lowFpsFrames:0,
    movementSubsteps:0,
    collisionChecks:0,
    collisionBlocks:0,
    collisionSlides:0,
    stairFrames:0,
    originalStairRailsHidden:0,
    centerGlassRemoved:0,
    correctedRailMeshes:0,
    terraceFloorPanels:0,
    interactiveMeshes:0,
    selections:0,
    failedSelections:0,
    panelOpens:0,
    objectOpens:0,
    closeUses:0,
    lastSelected:null,
    lastAxes:{ move:{x:0,y:0}, turn:{x:0,y:0} },
    lastSpeed:0,
    lastFrameDt:0,
    lastError:null
  };

  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    if (/OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`)) return true;
    return [...state.controllers.values()].some(record =>
      (record.controller?.inputSource?.profiles || []).some(profile => /oculus|meta|quest|touch/i.test(String(profile)))
    );
  }

  function xrActive() {
    const current = state.helper?.baseExperience?.state;
    return current === XR_STATE.ENTERING_XR || current === XR_STATE.IN_XR;
  }

  function comfortButton() {
    return document.getElementById('comfortBtn');
  }

  function comfortEnabled() {
    const value = comfortButton()?.getAttribute('aria-pressed');
    return value !== 'false';
  }

  function forceComfortDefault() {
    if (state.comfortForced) return;
    const button = comfortButton();
    state.originalComfortPressed = button?.getAttribute('aria-pressed') ?? null;
    if (button) {
      button.setAttribute('aria-pressed', 'true');
      button.classList.add('active');
      button.textContent = button.textContent?.replace(/desactivado/i, 'activado') || 'Confort activado';
    }
    document.body.classList.add('ucan-quest-comfort-v301');
    state.comfortForced = true;
  }

  function restoreComfort() {
    const button = comfortButton();
    if (button && state.originalComfortPressed != null) {
      button.setAttribute('aria-pressed', state.originalComfortPressed);
      button.classList.toggle('active', state.originalComfortPressed === 'true');
    }
    document.body.classList.remove('ucan-quest-comfort-v301');
    state.comfortForced = false;
  }

  function stableFloor() {
    try {
      const floor = Number(window.__UCAN_FLOOR_STATE_V287__?.getState?.()?.floorBase);
      if (finite(floor)) return floor;
    } catch (_) {}
    return state.floor;
  }

  function setStableFloor(base, reason) {
    state.floor = Number(base);
    try { window.__UCAN_FLOOR_STATE_V287__?.setFloorBase?.(base, reason); } catch (_) {}
  }

  function eyeHeight() {
    const values = [state.xr?.realWorldHeight, state.xr?._realWorldHeight, PLAYER_HEIGHT];
    return values.map(Number).find(value => finite(value) && value >= 0.8 && value <= 2.4) || PLAYER_HEIGHT;
  }

  function browserRideActive() {
    try { return Boolean(window.__ucanV254IsRiding?.()); } catch (_) { return false; }
  }

  function insideRooftopStairs(position) {
    return Boolean(position && position.x >= STAIR.minX - 0.6 && position.x <= STAIR.maxX + 0.6 && position.z >= STAIR.minZ - 0.8 && position.z <= STAIR.maxZ + 0.8);
  }

  function rooftopGround(position) {
    if (!insideRooftopStairs(position)) return null;
    const progress = clamp((STAIR.bottomZ - position.z) / (STAIR.bottomZ - STAIR.topZ), 0, 1);
    state.stairFrames += 1;
    if (progress >= 0.80) {
      state.rooftopCommitted = true;
      setStableFloor(LEVEL.roof, 'quest-v301:rooftop-arrival');
    } else if (progress <= 0.02 && state.rooftopCommitted) {
      state.rooftopCommitted = false;
      setStableFloor(LEVEL.three, 'quest-v301:floor-three-arrival');
    }
    return LEVEL.three + (LEVEL.roof - LEVEL.three) * progress;
  }

  function theaterGround(position, floor) {
    if (Math.abs(floor - LEVEL.three) > 0.35) return null;
    const center = position.x > -4.8 && position.x < 1.2 && position.z > -14 && position.z < 18.8;
    const side = position.x > 18.2 && position.x < 22.8 && position.z > -8 && position.z < 18.8;
    if (!center && !side) return null;
    const z0 = center ? -12 : -7;
    const z1 = 17.4;
    const rise = center ? 2.38 : 2.04;
    return LEVEL.three + rise * clamp((position.z - z0) / (z1 - z0), 0, 1);
  }

  function groundFor(position) {
    const stair = rooftopGround(position);
    if (stair != null) return stair;
    let floor = stableFloor();
    if (state.rooftopCommitted) floor = LEVEL.roof;
    const theater = theaterGround(position, floor);
    return theater == null ? floor : theater;
  }

  function motionComponent(controller, type, ids = []) {
    const motion = controller?.motionController;
    try {
      const direct = motion?.getComponentOfType?.(type);
      if (direct) return direct;
    } catch (_) {}
    for (const id of ids) {
      try {
        const component = motion?.getComponent?.(id);
        if (component) return component;
      } catch (_) {}
    }
    return null;
  }

  function normalizeAxis(value) {
    const number = finite(value) ? Number(value) : 0;
    return Math.abs(number) >= DEAD_ZONE ? clamp(number, -1, 1) : 0;
  }

  function gamepad(controller) {
    return controller?.inputSource?.gamepad || controller?.motionController?.gamepadObject || controller?.motionController?.gamepad || null;
  }

  function controllerAxes(controller, purpose) {
    const candidates = [];
    const thumbstick = motionComponent(controller, 'thumbstick', ['xr-standard-thumbstick', 'thumbstick']);
    const componentAxes = thumbstick?.axes || thumbstick?.value?.axes;
    if (componentAxes) {
      if (finite(componentAxes.x) && finite(componentAxes.y)) candidates.push({ x:Number(componentAxes.x), y:Number(componentAxes.y), source:'motion-component' });
      else if (finite(componentAxes[0]) && finite(componentAxes[1])) candidates.push({ x:Number(componentAxes[0]), y:Number(componentAxes[1]), source:'motion-array' });
    }
    const axes = Array.from(gamepad(controller)?.axes || []);
    if (axes.length >= 2) candidates.push({ x:Number(axes[0] || 0), y:Number(axes[1] || 0), source:'gamepad-0-1' });
    if (axes.length >= 4) candidates.push({ x:Number(axes[2] || 0), y:Number(axes[3] || 0), source:'gamepad-2-3' });
    const best = candidates.sort((a, b) => Math.hypot(b.x, b.y) - Math.hypot(a.x, a.y))[0] || { x:0, y:0, source:'none' };
    return { x:normalizeAxis(best.x), y:normalizeAxis(best.y), source:best.source, purpose };
  }

  function componentPressed(controller, type, ids, fallbackIndexes = []) {
    const component = motionComponent(controller, type, ids);
    if (component?.pressed || Number(component?.value || 0) > 0.56) return true;
    const pad = gamepad(controller);
    return fallbackIndexes.some(index => Boolean(pad?.buttons?.[index]?.pressed || Number(pad?.buttons?.[index]?.value || 0) > 0.56));
  }

  function controllerForHand(hand) {
    const records = [...state.controllers.values()];
    return records.find(record => String(record.controller?.inputSource?.handedness || record.controller?.motionController?.handedness) === hand)?.controller ||
      (hand === 'left' ? records[0]?.controller : records[1]?.controller) || null;
  }

  function horizontalBasis(camera) {
    let forward = null;
    try { forward = camera?.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) forward = new B.Vector3(0, 0, 1);
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    return { forward, right:new B.Vector3(forward.z, 0, -forward.x).normalize() };
  }

  function cameraYaw(camera) {
    try { if (camera?.rotationQuaternion?.toEulerAngles) return camera.rotationQuaternion.toEulerAngles().y; } catch (_) {}
    return Number(camera?.rotation?.y || 0);
  }

  function setCameraYaw(camera, value) {
    if (!camera) return;
    try {
      if (camera.rotationQuaternion && B.Quaternion?.FromEulerAngles) camera.rotationQuaternion.copyFrom(B.Quaternion.FromEulerAngles(0, value, 0));
      else if (camera.rotation) camera.rotation.y = value;
    } catch (_) {}
  }

  function createVignette() {
    if (state.vignetteRoot || !state.scene || !state.xr) return;
    const texture = new B.DynamicTexture('viñeta confort Meta Quest V301', { width:512, height:512 }, state.scene, false);
    texture.hasAlpha = true;
    const ctx = texture.getContext();
    ctx.clearRect(0, 0, 512, 512);
    const gradient = ctx.createRadialGradient(256, 256, 112, 256, 256, 360);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.48, 'rgba(0,0,0,0.02)');
    gradient.addColorStop(0.72, 'rgba(0,0,0,0.58)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.96)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    texture.update(false);

    const material = new B.StandardMaterial('material viñeta confort Meta Quest V301', state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.useAlphaFromDiffuseTexture = true;
    material.disableLighting = true;
    material.disableDepthWrite = true;
    material.backFaceCulling = false;
    material.alpha = 0;

    const plane = B.MeshBuilder.CreatePlane('viñeta confort Meta Quest V301', { width:0.82, height:0.82, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
    plane.parent = state.xr;
    plane.position.set(0, 0, 0.48);
    plane.material = material;
    plane.isPickable = false;
    plane.checkCollisions = false;
    plane.renderingGroupId = 10;
    plane.alwaysSelectAsActiveMesh = true;

    state.vignetteRoot = plane;
    state.vignetteMaterial = material;
    state.vignetteTexture = texture;
  }

  function updateVignette(movementAmount, turning) {
    if (!state.vignetteRoot || !state.vignetteMaterial) return;
    if (state.vignetteRoot.parent !== state.xr && state.xr) state.vignetteRoot.parent = state.xr;
    const active = comfortEnabled() && (movementAmount > 0.08 || turning || performance.now() < state.vignetteUntil);
    const target = active ? clamp(0.24 + movementAmount * 0.34 + (turning ? 0.16 : 0), 0.28, 0.68) : 0;
    state.vignetteMaterial.alpha += (target - state.vignetteMaterial.alpha) * 0.24;
    state.vignetteRoot.setEnabled(state.vignetteMaterial.alpha > 0.015);
  }

  function restoreVignette() {
    try { state.vignetteRoot?.dispose?.(); } catch (_) {}
    try { state.vignetteMaterial?.dispose?.(); } catch (_) {}
    try { state.vignetteTexture?.dispose?.(); } catch (_) {}
    state.vignetteRoot = null;
    state.vignetteMaterial = null;
    state.vignetteTexture = null;
  }

  function registerController(controller) {
    if (!controller) return;
    const key = controller.uniqueId || controller;
    if (state.controllers.has(key)) return;
    state.controllers.set(key, { controller, triggerDown:false, primaryDown:false, secondaryDown:false, stickDown:false });
    state.questDevice = questDetected();
  }

  function installControllers() {
    const input = state.helper?.input;
    if (!input) return;
    for (const controller of input.controllers || []) registerController(controller);
    input.onControllerAddedObservable?.add?.(registerController);
    input.onControllerRemovedObservable?.add?.(controller => state.controllers.delete(controller.uniqueId || controller));
  }

  function requestJump() {
    if (state.jumpActive || browserRideActive() || insideRooftopStairs(state.xr?.position)) return false;
    state.jumpRequested = true;
    return true;
  }

  function beginJump(ground) {
    if (!state.jumpRequested || state.jumpActive) return;
    state.jumpRequested = false;
    state.jumpActive = true;
    state.jumpStart = performance.now();
    state.jumpBaseGround = ground;
    state.jumpCount += 1;
  }

  function jumpOffset(ground) {
    if (state.jumpRequested && !state.jumpActive) beginJump(ground);
    if (!state.jumpActive) return 0;
    const progress = (performance.now() - state.jumpStart) / JUMP_DURATION_MS;
    if (progress >= 1 || browserRideActive()) {
      state.jumpActive = false;
      return 0;
    }
    state.jumpFrames += 1;
    const t = clamp(progress, 0, 1);
    const height = comfortEnabled() ? JUMP_HEIGHT_COMFORT : JUMP_HEIGHT_NORMAL;
    return 4 * height * t * (1 - t);
  }

  function isLowHorizontalSurface(mesh) {
    const metadata = mesh?.metadata || {};
    const name = String(mesh?.name || '');
    if (metadata.floorSeparator || metadata.walkable || metadata.teleportable || metadata.questSolidFloorV301) return true;
    return /gran losa|junta |eje central|eje longitudinal|ruta avatar|ruta de circulación|zona segura VR|zona VR |alfombra|pasillo núcleo|pasillo lateral|deck rooftop|piso completo|descanso .*escalera|plataforma (?:inicio|fin)|peldaño|rampa invisible/i.test(name);
  }

  function isCollisionObstacle(mesh) {
    if (!mesh || mesh.checkCollisions !== true || mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    if (isLowHorizontalSurface(mesh)) return false;
    return true;
  }

  function refreshCollisionCache(force = false) {
    const now = performance.now();
    if (!force && now - state.collisionCacheAt < 2500) return;
    state.collisionCacheAt = now;
    const cache = [];
    for (const mesh of state.scene?.meshes || []) {
      if (!isCollisionObstacle(mesh)) continue;
      try {
        mesh.computeWorldMatrix(true);
        const box = mesh.getBoundingInfo().boundingBox;
        const min = box.minimumWorld;
        const max = box.maximumWorld;
        cache.push({ mesh, minX:min.x, maxX:max.x, minY:min.y, maxY:max.y, minZ:min.z, maxZ:max.z });
      } catch (_) {}
    }
    state.collisionCache = cache;
  }

  function blockedAt(position, ground) {
    const radius = 0.38;
    const minY = ground + 0.10;
    const maxY = ground + 1.62;
    state.collisionChecks += 1;
    for (const item of state.collisionCache) {
      if (item.maxY < minY || item.minY > maxY) continue;
      if (position.x + radius < item.minX || position.x - radius > item.maxX) continue;
      if (position.z + radius < item.minZ || position.z - radius > item.maxZ) continue;
      return true;
    }
    return false;
  }

  function moveSingleStep(step, ground) {
    const proposed = state.xr.position.add(step);
    if (insideRooftopStairs(state.xr.position) || insideRooftopStairs(proposed)) {
      proposed.x = clamp(proposed.x, STAIR.minX + 0.48, STAIR.maxX - 0.48);
      state.xr.position.x = clamp(proposed.x, WORLD.minX, WORLD.maxX);
      state.xr.position.z = clamp(proposed.z, WORLD.minZ, WORLD.maxZ);
      return;
    }
    if (!blockedAt(proposed, ground)) {
      state.xr.position.x = proposed.x;
      state.xr.position.z = proposed.z;
    } else {
      state.collisionBlocks += 1;
      let moved = false;
      const xOnly = state.xr.position.add(new B.Vector3(step.x, 0, 0));
      if (Math.abs(step.x) > 1e-6 && !blockedAt(xOnly, ground)) {
        state.xr.position.x = xOnly.x;
        moved = true;
      }
      const zOnly = state.xr.position.add(new B.Vector3(0, 0, step.z));
      if (Math.abs(step.z) > 1e-6 && !blockedAt(zOnly, ground)) {
        state.xr.position.z = zOnly.z;
        moved = true;
      }
      if (moved) state.collisionSlides += 1;
    }
    state.xr.position.x = clamp(state.xr.position.x, WORLD.minX, WORLD.maxX);
    state.xr.position.z = clamp(state.xr.position.z, WORLD.minZ, WORLD.maxZ);
  }

  function mirrorBrowserRide() {
    if (!browserRideActive() || !state.desktop?.position || !state.xr?.position) return false;
    state.xr.position.x = state.desktop.position.x;
    state.xr.position.z = state.desktop.position.z;
    state.xr.position.y = state.desktop.position.y - PLAYER_HEIGHT + eyeHeight();
    return true;
  }

  function syncDesktop(ground) {
    if (!state.desktop?.position || !state.xr?.position) return;
    state.desktop.position.x = state.xr.position.x;
    state.desktop.position.z = state.xr.position.z;
    state.desktop.position.y = ground + PLAYER_HEIGHT;
  }

  function applyTurn(dt, axes) {
    state.lastAxes.turn = { x:axes.x, y:axes.y };
    if (comfortEnabled()) {
      const horizontal = Math.abs(axes.x);
      if (horizontal < 0.28) state.snapReady = true;
      if (horizontal >= 0.72 && Math.abs(axes.y) < 0.72 && state.snapReady && performance.now() - state.lastSnapAt >= TURN.snapCooldownMs) {
        const amount = Math.sign(axes.x) * TURN.snapDegrees * Math.PI / 180;
        setCameraYaw(state.xr, cameraYaw(state.xr) + amount);
        state.lastSnapAt = performance.now();
        state.snapReady = false;
        state.snapTurns += 1;
        state.vignetteUntil = performance.now() + 280;
        return true;
      }
      return false;
    }
    if (Math.abs(axes.x) < 0.22 || Math.abs(axes.y) > 0.72) return false;
    setCameraYaw(state.xr, cameraYaw(state.xr) + axes.x * TURN.smoothSpeed * dt);
    state.smoothTurnFrames += 1;
    return true;
  }

  function applyMovement(dt, axes) {
    if (mirrorBrowserRide()) return 0;
    state.lastAxes.move = { x:axes.x, y:axes.y };
    const magnitude = Math.min(1, Math.hypot(axes.x, axes.y));
    const comfort = comfortEnabled();
    const targetSpeed = magnitude < 0.01 ? 0 : (state.sprintHeld ? (comfort ? SPEED.comfortRun : SPEED.run) : (comfort ? SPEED.comfortWalk : SPEED.walk));
    const acceleration = comfort ? 9.0 : 14.0;
    const deceleration = comfort ? 12.0 : 18.0;
    state.currentSpeed = approach(state.currentSpeed, targetSpeed, (targetSpeed > state.currentSpeed ? acceleration : deceleration) * dt);
    state.lastSpeed = state.currentSpeed;

    const groundBefore = groundFor(state.xr.position);
    if (magnitude >= 0.01 && state.currentSpeed > 0.02) {
      const basis = horizontalBasis(state.xr);
      const direction = basis.right.scale(axes.x).add(basis.forward.scale(-axes.y));
      if (direction.lengthSquared() > 0.0001) direction.normalize();
      const blend = clamp(dt * (comfort ? 8 : 13), 0, 1);
      state.smoothedDirection = B.Vector3.Lerp(state.smoothedDirection, direction, blend);
      if (state.smoothedDirection.lengthSquared() > 0.0001) state.smoothedDirection.normalize();

      const totalDistance = state.currentSpeed * dt;
      const substeps = Math.max(1, Math.ceil(totalDistance / MAX_MOVE_SUBSTEP));
      const step = state.smoothedDirection.scale(totalDistance / substeps);
      for (let index = 0; index < substeps; index += 1) {
        const ground = groundFor(state.xr.position);
        moveSingleStep(step, ground);
        state.movementSubsteps += 1;
      }
      state.movementFrames += 1;
      if (state.sprintHeld) state.sprintFrames += 1;
      if (dt > 0.052) state.lowFpsFrames += 1;
      if (Math.abs(stableFloor() - LEVEL.three) <= 0.4 && !insideRooftopStairs(state.xr.position)) state.floorThreeMovementFrames += 1;
    }

    const groundAfter = groundFor(state.xr.position);
    state.xr.position.y = groundAfter + eyeHeight() + jumpOffset(groundAfter);
    syncDesktop(groundAfter);
    return magnitude;
  }

  function createStableFloorMaterial() {
    if (state.stableFloorMaterial || !state.scene) return state.stableFloorMaterial;
    const material = new B.StandardMaterial('piso estable Meta Quest V301', state.scene);
    const color = B.Color3.FromHexString('#687174');
    material.diffuseColor = color;
    material.emissiveColor = color.scale(0.82);
    material.specularColor = B.Color3.Black();
    material.disableLighting = true;
    material.backFaceCulling = true;
    material.alpha = 1;
    state.stableFloorMaterial = material;
    state.createdMaterials.push(material);
    return material;
  }

  function shouldLockFloor(mesh) {
    if (!mesh || mesh.isVisible === false || typeof mesh.getBoundingInfo !== 'function') return false;
    const name = String(mesh.name || '');
    if (/peldaño|escalera|rampa|baranda|pasamanos|pared|techo|plafón|viga|mesa|silla|sofá|sofa|planta|pantalla|cartel|rótulo|rotulo/i.test(name)) return false;
    const metadata = mesh.metadata || {};
    const nameMatch = /gran losa|ruta avatar|ruta de circulación|zona segura VR|zona VR |alfombra|pasillo núcleo|pasillo lateral|deck rooftop|piso completo|eje central|eje longitudinal|junta /i.test(name);
    if (!(metadata.floorSeparator || metadata.walkable || metadata.teleportable || metadata.questSolidFloorV301 || nameMatch)) return false;
    try {
      mesh.computeWorldMatrix(true);
      return mesh.getBoundingInfo().boundingBox.extendSizeWorld.y <= 0.55;
    } catch (_) { return false; }
  }

  function lockFloorMaterials() {
    const stable = createStableFloorMaterial();
    if (!stable) return;
    for (const mesh of state.scene?.meshes || []) {
      if (!shouldLockFloor(mesh)) continue;
      if (!state.floorOriginals.has(mesh)) state.floorOriginals.set(mesh, { material:mesh.material, receiveShadows:mesh.receiveShadows });
      mesh.material = stable;
      mesh.receiveShadows = false;
    }
  }

  function restoreFloorMaterials() {
    for (const [mesh, original] of state.floorOriginals) {
      try { mesh.material = original.material; mesh.receiveShadows = original.receiveShadows; } catch (_) {}
    }
    state.floorOriginals.clear();
  }

  function hideQuestMesh(mesh, reason) {
    if (!mesh || state.hiddenMeshes.has(mesh)) return;
    state.hiddenMeshes.set(mesh, { enabled:mesh.isEnabled?.() !== false, visible:mesh.isVisible, visibility:mesh.visibility, collisions:mesh.checkCollisions, reason });
    mesh.setEnabled?.(false);
    mesh.isVisible = false;
    mesh.visibility = 0;
    mesh.checkCollisions = false;
  }

  function hideIncorrectRooftopGeometry() {
    for (const mesh of state.scene?.meshes || []) {
      const name = String(mesh?.name || '');
      const metadata = mesh?.metadata || {};
      if (/baranda hueco escalera terraza/i.test(name) || metadata.rooftopStairGuard === true) {
        hideQuestMesh(mesh, 'stair-rail');
        state.originalStairRailsHidden += 1;
        continue;
      }
      if (/tragaluz|baranda tragaluz rooftop|marco.*centro.*terraza|cristal.*centro.*terraza|centro.*cristal/i.test(name) || metadata.centralTerraceFeature === true) {
        hideQuestMesh(mesh, 'center-glass');
        state.centerGlassRemoved += 1;
        continue;
      }
      if (/terraza completa Quest V299|terraza completa Quest V300/i.test(name)) hideQuestMesh(mesh, 'old-terrace-floor');
    }
  }

  function createMaterial(name, color, options = {}) {
    const material = new B.StandardMaterial(name, state.scene);
    material.diffuseColor = B.Color3.FromHexString(color);
    material.emissiveColor = B.Color3.FromHexString(options.emissive || color).scale(options.emissiveScale ?? 0.18);
    material.specularColor = options.specular === false ? B.Color3.Black() : new B.Color3(0.15,0.15,0.15);
    material.alpha = options.alpha ?? 1;
    material.backFaceCulling = options.backFaceCulling ?? true;
    material.disableDepthWrite = options.disableDepthWrite ?? false;
    if (material.alpha < 1 && 'transparencyMode' in material) material.transparencyMode = B.Material?.MATERIAL_ALPHABLEND ?? 2;
    state.createdMaterials.push(material);
    return material;
  }

  function trackMesh(mesh, metadata = {}) {
    mesh.metadata = { ...(mesh.metadata || {}), ...metadata };
    state.createdMeshes.push(mesh);
    return mesh;
  }

  function stairGroundAtZ(z) {
    const progress = clamp((STAIR.bottomZ - z) / (STAIR.bottomZ - STAIR.topZ), 0, 1);
    return LEVEL.three + (LEVEL.roof - LEVEL.three) * progress;
  }

  function buildCorrectedStairRailings() {
    if (state.createdMeshes.some(mesh => mesh?.metadata?.questCorrectedStairRailV301)) return;
    const metal = createMaterial('metal baranda escalera Meta Quest V301', '#263238', { emissive:'#263238', emissiveScale:0.12, specular:false });
    const glass = createMaterial('cristal baranda escalera Meta Quest V301', '#9bc8d3', { emissive:'#9bc8d3', emissiveScale:0.22, alpha:0.30, backFaceCulling:false, disableDepthWrite:true, specular:false });
    const segments = 24;
    const depth = (STAIR.bottomZ - STAIR.topZ) / segments;

    for (const x of [STAIR.minX - 0.18, STAIR.maxX + 0.18]) {
      const topPath = [];
      const lowerPath = [];
      for (let index = 0; index <= segments; index += 1) {
        const z = STAIR.bottomZ - index * depth;
        const ground = stairGroundAtZ(z);
        topPath.push(new B.Vector3(x, ground + 1.33, z));
        lowerPath.push(new B.Vector3(x, ground + 0.47, z));
        if (index % 2 === 0 || index === segments) {
          const post = B.MeshBuilder.CreateCylinder(`poste baranda escalera Quest V301 ${x} ${index}`, { diameter:0.12, height:1.36, tessellation:12 }, state.scene);
          post.position.set(x, ground + 0.68, z);
          post.material = metal;
          post.checkCollisions = false;
          post.isPickable = false;
          trackMesh(post, { questCorrectedStairRailV301:true, stairRailPost:true });
        }
      }
      const top = B.MeshBuilder.CreateTube(`pasamanos superior escalera Quest V301 ${x}`, { path:topPath, radius:0.065, tessellation:12, cap:B.Mesh.CAP_ALL }, state.scene);
      top.material = metal;
      top.isPickable = false;
      top.checkCollisions = false;
      trackMesh(top, { questCorrectedStairRailV301:true, stairTopRail:true });
      const lower = B.MeshBuilder.CreateTube(`riel inferior escalera Quest V301 ${x}`, { path:lowerPath, radius:0.04, tessellation:10, cap:B.Mesh.CAP_ALL }, state.scene);
      lower.material = metal;
      lower.isPickable = false;
      lower.checkCollisions = false;
      trackMesh(lower, { questCorrectedStairRailV301:true, stairLowerRail:true });

      for (let index = 0; index < segments; index += 1) {
        const z1 = STAIR.bottomZ - index * depth;
        const z2 = STAIR.bottomZ - (index + 1) * depth;
        const z = (z1 + z2) / 2;
        const ground = stairGroundAtZ(z);
        const pane = B.MeshBuilder.CreateBox(`cristal baranda escalera Quest V301 ${x} ${index}`, { width:0.075, height:0.76, depth:depth * 0.90 }, state.scene);
        pane.position.set(x, ground + 0.87, z);
        pane.material = glass;
        pane.isPickable = false;
        pane.checkCollisions = false;
        pane.renderingGroupId = 3;
        pane.alphaIndex = 40 + index;
        trackMesh(pane, { questCorrectedStairRailV301:true, stairGlassPanel:true, frontBackVisible:true });
      }
    }
    state.correctedRailMeshes = state.createdMeshes.filter(mesh => mesh?.metadata?.questCorrectedStairRailV301).length;
  }

  function createTerracePanel(name, x1, x2, z1, z2) {
    const mesh = B.MeshBuilder.CreateBox(name, { width:x2-x1, height:0.08, depth:z2-z1 }, state.scene);
    mesh.position.set((x1+x2)/2, LEVEL.roof + 0.04, (z1+z2)/2);
    mesh.material = createStableFloorMaterial();
    mesh.checkCollisions = false;
    mesh.isPickable = false;
    mesh.receiveShadows = false;
    trackMesh(mesh, { walkable:true, teleportable:true, rooftop:true, questSolidFloorV301:true, centerGlassRemoved:true });
    state.terraceFloorPanels += 1;
  }

  function buildCompleteTerraceFloor() {
    if (state.createdMeshes.some(mesh => mesh?.metadata?.questSolidFloorV301)) return;
    createTerracePanel('terraza completa Quest V301 oeste', -72, STAIR.minX, -60, 60);
    createTerracePanel('terraza completa Quest V301 este', STAIR.maxX, 72, -60, 60);
    createTerracePanel('terraza completa Quest V301 sur', STAIR.minX, STAIR.maxX, -60, STAIR.minZ);
    createTerracePanel('terraza completa Quest V301 norte', STAIR.minX, STAIR.maxX, STAIR.maxZ, 60);
  }

  function restoreQuestGeometry() {
    for (const mesh of state.createdMeshes.splice(0)) {
      try { mesh.dispose?.(); } catch (_) {}
    }
    for (const [mesh, original] of state.hiddenMeshes) {
      try {
        mesh.setEnabled?.(original.enabled);
        mesh.isVisible = original.visible;
        mesh.visibility = original.visibility;
        mesh.checkCollisions = original.collisions;
      } catch (_) {}
    }
    state.hiddenMeshes.clear();
    for (const material of state.createdMaterials.splice(0)) {
      try { if (material !== state.stableFloorMaterial) material.dispose?.(); } catch (_) {}
    }
    try { state.stableFloorMaterial?.dispose?.(); } catch (_) {}
    state.stableFloorMaterial = null;
    state.terraceFloorPanels = 0;
  }

  function metadataChain(mesh) {
    const merged = {};
    let current = mesh;
    for (let depth = 0; current && depth < 9; depth += 1, current = current.parent) Object.assign(merged, current.metadata || {});
    return merged;
  }

  function nameChain(mesh) {
    const names = [];
    let current = mesh;
    for (let depth = 0; current && depth < 9; depth += 1, current = current.parent) names.push(String(current.name || ''));
    return names.join(' ');
  }

  function roofPosition(mesh) {
    try { return mesh.getAbsolutePosition?.() || mesh.absolutePosition || mesh.position; } catch (_) { return mesh?.position || null; }
  }

  function humanizeName(name) {
    return String(name || 'Elemento de la terraza')
      .replace(/\b(?:frente|reverso|parte|malla|mesh|Quest V\d+|V\d+)\b/gi, ' ')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, value => value.toUpperCase());
  }

  function classifyRooftopObject(mesh) {
    if (!mesh || mesh.isVisible === false || Number(mesh.visibility ?? 1) <= 0) return null;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return null;
    const metadata = metadataChain(mesh);
    const names = nameChain(mesh);
    const position = roofPosition(mesh);
    const rooftop = metadata.rooftop === true || metadata.astronomyLabel === true || metadata.livePanel === true || metadata.celestialObject === true || (position && position.y >= LEVEL.roof - 1.2);
    if (!rooftop) return null;
    if (metadata.ucanUniversalCloseV292) return { type:'close', title:'Cerrar' };
    if (metadata.livePanel || metadata.livePanelKey || /panel clima|agenda astronómica|fase lunar|mapa celeste|calendario astronómico|reloj san germán/i.test(names)) return { type:'panel', title:humanizeName(metadata.livePanelKey || metadata.title || mesh.name) };
    if (metadata.celestialId || metadata.celestialData || metadata.celestialObject || metadata.astronomyLabel || /planet-|planeta|saturno|júpiter|jupiter|marte|venus|mercurio|urano|neptuno|estrella|constelación|constelacion|luna|eei|iss/i.test(names)) return { type:'celestial', title:humanizeName(metadata.celestialData?.name || mesh.name), category:'Astronomía', summary:'Objeto astronómico interactivo de la terraza.' };
    if (/platillo|ovni|ufo|saucer|disco volador|nave espacial|nave extraterrestre|satélite|satelite|antena parabólica|antena parabolica/i.test(names)) return { type:'object', title:humanizeName(mesh.name), category:'Exploración espacial', summary:'Modelo interactivo de tecnología y exploración espacial presentado en la terraza.' };
    if (/telescopio|refractor|dobson|catadióptrico|catadioptrico/i.test(names)) return { type:'object', title:humanizeName(mesh.name), category:'Instrumento astronómico', summary:'Instrumento utilizado para la observación y el estudio del cielo.' };
    if (metadata.readableSign || /cartel|letrero|rótulo|rotulo|pantalla|panel|mapa|calendario|reloj|agenda|clima|fase lunar|etiqueta|temporada|señal|senal/i.test(names)) return { type:'sign', title:humanizeName(metadata.title || mesh.name), category:'Información de la terraza', summary:'Información interactiva disponible en la terraza astronómica.' };
    return null;
  }

  function decorateRooftopInteractions(force = false) {
    const now = performance.now();
    if (!force && now - state.lastInteractionScan < 1200) return;
    state.lastInteractionScan = now;
    let count = 0;
    for (const mesh of state.scene?.meshes || []) {
      const info = classifyRooftopObject(mesh);
      if (!info) continue;
      if (!state.originalPickability.has(mesh)) state.originalPickability.set(mesh, { isPickable:mesh.isPickable, always:mesh.alwaysSelectAsActiveMesh, metadata:mesh.metadata });
      const existing = metadataChain(mesh);
      const metadata = { ...(mesh.metadata || {}), readableSign:true, rooftop:true, ucanQuestInteractiveV301:true, ucanQuestInteractiveTypeV301:info.type };
      if (info.type === 'panel') {
        metadata.livePanel = true;
        metadata.livePanelKey = existing.livePanelKey || existing.title || String(mesh.name || '').replace(/\s+(?:frente|reverso)$/i, '');
      } else if (info.type !== 'close') {
        metadata.celestialObject = true;
        metadata.celestialData = existing.celestialData || {
          id:`quest-v301-${mesh.uniqueId}`,
          name:info.title,
          category:info.category || 'Terraza astronómica',
          summary:info.summary || 'Elemento interactivo de la terraza.',
          color:'#fed141'
        };
      }
      mesh.metadata = metadata;
      mesh.isPickable = true;
      mesh.alwaysSelectAsActiveMesh = true;
      count += 1;
    }
    state.interactiveMeshes = count;
  }

  function restorePickability() {
    for (const [mesh, original] of state.originalPickability) {
      try {
        mesh.isPickable = original.isPickable;
        mesh.alwaysSelectAsActiveMesh = original.always;
        mesh.metadata = original.metadata;
      } catch (_) {}
    }
    state.originalPickability.clear();
  }

  function interactiveTarget(mesh) {
    let current = mesh;
    for (let depth = 0; current && depth < 9; depth += 1, current = current.parent) {
      if (current.metadata?.ucanQuestInteractiveV301 || current.metadata?.ucanUniversalCloseV292) return current;
    }
    return null;
  }

  function controllerRay(controller) {
    const ray = new B.Ray(B.Vector3.Zero(), new B.Vector3(0,0,1), RAY_LENGTH);
    try {
      if (controller?.getWorldPointerRayToRef) {
        controller.getWorldPointerRayToRef(ray);
        ray.direction.normalize();
        ray.length = RAY_LENGTH;
        return ray;
      }
    } catch (_) {}
    const pointer = controller?.pointer || controller?.grip;
    try {
      ray.origin.copyFrom(pointer.getAbsolutePosition());
      B.Vector3.TransformNormalToRef(new B.Vector3(0,0,1), pointer.getWorldMatrix(), ray.direction);
      ray.direction.normalize();
    } catch (_) {}
    return ray;
  }

  function centerOf(mesh) {
    try { return mesh.getBoundingInfo?.().boundingSphere?.centerWorld?.clone?.() || mesh.getAbsolutePosition?.().clone?.(); } catch (_) { return null; }
  }

  function angularFallback(ray) {
    let best = null;
    const seen = new Set();
    for (const mesh of state.scene?.meshes || []) {
      const target = interactiveTarget(mesh);
      if (!target || seen.has(target.uniqueId)) continue;
      seen.add(target.uniqueId);
      const center = centerOf(target);
      if (!center) continue;
      const vector = center.subtract(ray.origin);
      const distance = vector.length();
      if (!finite(distance) || distance < 0.4 || distance > RAY_LENGTH) continue;
      vector.scaleInPlace(1 / distance);
      const angle = Math.acos(clamp(B.Vector3.Dot(ray.direction, vector), -1, 1));
      const type = target.metadata?.ucanQuestInteractiveTypeV301;
      const limit = (type === 'celestial' || type === 'object') ? 14 * Math.PI / 180 : 9 * Math.PI / 180;
      if (angle > limit) continue;
      const score = angle + distance * 0.000004;
      if (!best || score < best.score) best = { target, score };
    }
    return best?.target || null;
  }

  function dispatchPointer(mesh) {
    try {
      const pickInfo = { hit:true, pickedMesh:mesh, pickedPoint:centerOf(mesh), distance:0 };
      const pointerInfo = new B.PointerInfo(B.PointerEventTypes.POINTERPICK, pickInfo);
      state.scene.onPointerObservable.notifyObservers(pointerInfo, B.PointerEventTypes.POINTERPICK);
    } catch (_) {}
  }

  function openInteractive(mesh) {
    const target = interactiveTarget(mesh) || mesh;
    if (!target) return false;
    if (target.metadata?.ucanUniversalCloseV292) {
      try { window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.close?.(); } catch (_) {}
      state.closeUses += 1;
      return true;
    }
    let opened = false;
    try { opened = window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(target) === true; } catch (_) {}
    if (!opened) {
      dispatchPointer(target);
      try { opened = window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(target) === true; } catch (_) {}
    }
    if (opened || window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.getState?.()?.visible) {
      state.selections += 1;
      state.lastSelected = String(target.metadata?.celestialData?.name || target.metadata?.livePanelKey || target.name || 'Información');
      if (target.metadata?.ucanQuestInteractiveTypeV301 === 'panel' || target.metadata?.ucanQuestInteractiveTypeV301 === 'sign') state.panelOpens += 1;
      else state.objectOpens += 1;
      return true;
    }
    return false;
  }

  function selectFromController(controller) {
    if (!state.inXR || !state.questDevice || !controller) return false;
    decorateRooftopInteractions();
    const ray = controllerRay(controller);
    let pick = null;
    try { pick = state.scene.pickWithRay(ray, mesh => Boolean(interactiveTarget(mesh)), false); } catch (_) {}
    if (pick?.hit && pick.pickedMesh && openInteractive(pick.pickedMesh)) return true;
    const fallback = angularFallback(ray);
    if (fallback && openInteractive(fallback)) return true;
    state.failedSelections += 1;
    window.__UCAN_API__?.setStatus?.('Apunte el rayo al cartel, planeta, telescopio o platillo y presione el gatillo.');
    return false;
  }

  function pollControllerActions() {
    const left = controllerForHand('left');
    const right = controllerForHand('right');
    const moveAxes = left ? controllerAxes(left, 'move') : { x:0, y:0, source:'none' };
    const turnAxes = right ? controllerAxes(right, 'turn') : { x:0, y:0, source:'none' };
    const fullStick = Math.hypot(moveAxes.x, moveAxes.y) >= 0.86;
    const leftStick = left ? componentPressed(left, 'thumbstick', ['xr-standard-thumbstick','thumbstick'], [3]) : false;
    const leftGrip = left ? componentPressed(left, 'squeeze', ['xr-standard-squeeze','squeeze'], [1]) : false;
    state.sprintHeld = leftStick || leftGrip || (!comfortEnabled() && fullStick);

    for (const record of state.controllers.values()) {
      const controller = record.controller;
      const hand = String(controller?.inputSource?.handedness || controller?.motionController?.handedness || '');
      const trigger = componentPressed(controller, 'trigger', ['xr-standard-trigger','trigger'], [0]);
      const primary = componentPressed(controller, 'button', hand === 'right' ? ['a-button'] : ['x-button'], [4]);
      const secondary = componentPressed(controller, 'button', hand === 'right' ? ['b-button'] : ['y-button'], [5]);
      const stick = componentPressed(controller, 'thumbstick', ['xr-standard-thumbstick','thumbstick'], [3]);

      if (trigger && !record.triggerDown) selectFromController(controller);
      record.triggerDown = trigger;

      if (primary && !record.primaryDown) {
        const selected = selectFromController(controller);
        if (!selected) requestJump();
      }
      record.primaryDown = primary;

      if (secondary && !record.secondaryDown) {
        try { window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.close?.(); } catch (_) {}
        state.closeUses += 1;
      }
      record.secondaryDown = secondary;

      if (hand === 'right' && stick && !record.stickDown) requestJump();
      record.stickDown = stick;
    }
    return { moveAxes, turnAxes };
  }

  function enterRuntime() {
    state.inXR = true;
    state.questDevice = questDetected();
    state.xr = state.helper?.baseExperience?.camera || state.xr;
    state.desktop = window.__UCAN_API__?.getCamera?.() || state.desktop;
    state.floor = stableFloor();
    state.rooftopCommitted = Math.abs(state.floor - LEVEL.roof) <= 0.4;
    state.currentSpeed = 0;
    window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ = true;
    forceComfortDefault();
    hideIncorrectRooftopGeometry();
    buildCorrectedStairRailings();
    buildCompleteTerraceFloor();
    lockFloorMaterials();
    decorateRooftopInteractions(true);
    refreshCollisionCache(true);
    createVignette();
    window.__UCAN_API__?.setStatus?.('Meta Quest V301: barandas corregidas, terraza sólida, selección directa y modo de confort activados.');
    updateAudit();
  }

  function exitRuntime() {
    state.inXR = false;
    state.currentSpeed = 0;
    state.sprintHeld = false;
    state.jumpRequested = false;
    state.jumpActive = false;
    window.__UCAN_BROWSER_XR_EMULATION_ACTIVE__ = false;
    restoreVignette();
    restorePickability();
    restoreFloorMaterials();
    restoreQuestGeometry();
    restoreComfort();
    updateAudit();
  }

  function frame() {
    const active = xrActive();
    if (active && !state.inXR) enterRuntime();
    if (!active && state.inXR) exitRuntime();
    if (!state.inXR) return;
    if (!state.questDevice) state.questDevice = questDetected();
    if (!state.questDevice) return;
    state.xr = state.helper?.baseExperience?.camera || state.xr;
    state.desktop = window.__UCAN_API__?.getCamera?.() || state.desktop;
    refreshCollisionCache();
    hideIncorrectRooftopGeometry();
    lockFloorMaterials();
    decorateRooftopInteractions();
    const dt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, MAX_FRAME_DT);
    state.lastFrameDt = dt;
    const actions = pollControllerActions();
    const turning = applyTurn(dt, actions.turnAxes);
    const movementAmount = applyMovement(dt, actions.moveAxes);
    updateVignette(movementAmount, turning);
    updateAudit();
  }

  function recordError(stage, error) {
    state.lastError = { stage, name:String(error?.name || 'Error'), message:String(error?.message || error || 'Error desconocido'), at:new Date().toISOString() };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    updateAudit();
  }

  function updateAudit() {
    const data = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      inXR:state.inXR,
      questDevice:state.questDevice,
      singleAuthoritativeRuntime:true,
      browserScenePreserved:true,
      desktopVisualsUnchanged:true,
      fullTouchControllerMapping:true,
      leftStickMovement:true,
      leftStickClickSprint:true,
      leftGripSprint:true,
      rightStickSnapTurnInComfort:true,
      rightStickSmoothTurnOutsideComfort:true,
      rightStickClickJump:true,
      primaryButtonSelectOrJump:true,
      secondaryButtonClosesWindow:true,
      triggerSelection:true,
      rooftopSignsSelectable:true,
      rooftopCelestialSelectable:true,
      rooftopSaucersSelectable:true,
      rooftopTelescopesSelectable:true,
      universalWindowIntegration:true,
      correctedSlopedStairRailings:true,
      stairGlassFrontBackVisible:true,
      originalHorizontalStairRailsHidden:true,
      rooftopCenterGlassRemoved:true,
      rooftopCenterGlassRailingsRemoved:true,
      rooftopFullSolidFloor:true,
      rooftopStairOpeningPreserved:true,
      defaultComfortMode:true,
      comfortWalkSpeed:SPEED.comfortWalk,
      comfortRunSpeed:SPEED.comfortRun,
      normalWalkSpeed:SPEED.walk,
      normalRunSpeed:SPEED.run,
      snapTurnDegrees:TURN.snapDegrees,
      snapTurnCooldownMs:TURN.snapCooldownMs,
      accelerationSmoothing:true,
      movementSubstepsEnabled:true,
      maximumMoveSubstep:MAX_MOVE_SUBSTEP,
      lowFpsMovementCompensation:true,
      motionVignette:true,
      reducedJumpHeightInComfort:true,
      stableFloorMaterial:true,
      stableFloorColor:'#687174',
      floorReceivesAvatarShadows:false,
      floorColorStableDuringMovement:true,
      movementFrames:state.movementFrames,
      floorThreeMovementFrames:state.floorThreeMovementFrames,
      sprintFrames:state.sprintFrames,
      jumpCount:state.jumpCount,
      jumpFrames:state.jumpFrames,
      snapTurns:state.snapTurns,
      smoothTurnFrames:state.smoothTurnFrames,
      lowFpsFrames:state.lowFpsFrames,
      movementSubsteps:state.movementSubsteps,
      collisionChecks:state.collisionChecks,
      collisionBlocks:state.collisionBlocks,
      collisionSlides:state.collisionSlides,
      stairFrames:state.stairFrames,
      originalStairRailsHidden:state.originalStairRailsHidden,
      centerGlassRemoved:state.centerGlassRemoved,
      correctedRailMeshes:state.correctedRailMeshes,
      terraceFloorPanels:state.terraceFloorPanels,
      interactiveMeshes:state.interactiveMeshes,
      selections:state.selections,
      failedSelections:state.failedSelections,
      panelOpens:state.panelOpens,
      objectOpens:state.objectOpens,
      closeUses:state.closeUses,
      controllers:state.controllers.size,
      comfortEnabled:comfortEnabled(),
      sprintHeld:state.sprintHeld,
      jumpActive:state.jumpActive,
      rooftopCommitted:state.rooftopCommitted,
      lastSelected:state.lastSelected,
      lastAxes:state.lastAxes,
      lastSpeed:state.lastSpeed,
      lastFrameDt:state.lastFrameDt,
      lastError:state.lastError,
      selectFromController,
      getState:() => ({
        inXR:state.inXR,
        questDevice:state.questDevice,
        controllers:state.controllers.size,
        comfortEnabled:comfortEnabled(),
        movementFrames:state.movementFrames,
        floorThreeMovementFrames:state.floorThreeMovementFrames,
        snapTurns:state.snapTurns,
        jumpCount:state.jumpCount,
        originalStairRailsHidden:state.originalStairRailsHidden,
        correctedRailMeshes:state.correctedRailMeshes,
        centerGlassRemoved:state.centerGlassRemoved,
        terraceFloorPanels:state.terraceFloorPanels,
        interactiveMeshes:state.interactiveMeshes,
        selections:state.selections,
        lastSelected:state.lastSelected,
        lastSpeed:state.lastSpeed,
        lastError:state.lastError
      })
    };
    window.__UCAN_QUEST_V301__ = data;
    window.__UCAN_UNIFIED_XR_AUDIT__ = data;
    window.__UCAN_QUEST_CONTROLS_V301__ = data;
  }

  function install(scene, helper) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    state.helper = helper;
    state.xr = helper.baseExperience?.camera || null;
    state.desktop = window.__UCAN_API__?.getCamera?.() || null;
    state.floor = stableFloor();
    installControllers();
    helper.baseExperience?.onStateChangedObservable?.add?.(xrState => {
      if (xrState === XR_STATE.ENTERING_XR || xrState === XR_STATE.IN_XR) enterRuntime();
      else if (xrState === XR_STATE.NOT_IN_XR) exitRuntime();
    });
    scene.onBeforeRenderObservable.add(() => {
      try { frame(); } catch (error) { recordError('frame', error); }
    });
    if (xrActive()) enterRuntime();
    updateAudit();
    console.info(`[UCAN ${VERSION}] Barandas, selección y modo de confort Meta Quest instalados.`);
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    const helper = window.__UCAN_XR_HELPER__;
    if (scene && helper?.baseExperience) return install(scene, helper);
    if (attempt < 320) window.setTimeout(() => boot(attempt + 1), 100);
    else recordError('boot', new Error('No se encontró la escena o el ayudante WebXR.'));
  }

  updateAudit();
  boot();
})();
