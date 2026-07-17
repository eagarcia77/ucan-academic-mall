(() => {
  'use strict';

  const VERSION = 'V275';
  const BUILD = 'V275-20260717-XR-STAIR-BLOCKERS-TERRACE';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  const LEVEL = Object.freeze({ one: 0, two: 8.2, three: 16.4, roof: 27.2 });
  const FLOORS = Object.freeze([LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.roof]);
  const WORLD = Object.freeze({ minX: -73, maxX: 73, minZ: -59, maxZ: 59 });
  const SPEED = Object.freeze({ comfort: 3.4, natural: 5, fast: 7 });
  const RUN_SPEED = Object.freeze({ comfort: 5, natural: 7.5, fast: 8.5 });
  const ENTRY_GATE_DEPTH = 3.8;
  const ACTIVE_LANE_MARGIN = 1.25;
  const TRANSITION_FINISH = 0.94;
  const TRANSITION_SNAP = 0.56;

  const LANES = Object.freeze([
    { id: 'p1-p2-oeste', minX: -24.8, maxX: -15.2, z0: 34.4, z1: 7.6, low: LEVEL.one, high: LEVEL.two },
    { id: 'p2-p1-este', minX: -12.8, maxX: -3.2, z0: 34.4, z1: 7.6, low: LEVEL.one, high: LEVEL.two },
    { id: 'p2-p3-oeste', minX: -38.8, maxX: -29.2, z0: 34.4, z1: 7.6, low: LEVEL.two, high: LEVEL.three },
    { id: 'p3-p2-este', minX: -30.8, maxX: -21.2, z0: 34.4, z1: 7.6, low: LEVEL.two, high: LEVEL.three },
    { id: 'p3-terraza', minX: 38.7, maxX: 49.3, z0: 41.2, z1: 8.0, low: LEVEL.three, high: LEVEL.roof }
  ]);

  const RAMPS = Object.freeze([
    { id: 'anfiteatro-central', minX: -5.2, maxX: 1.6, z0: -14.5, z1: 19.3, rise: 2.38 },
    { id: 'anfiteatro-lateral', minX: 17.8, maxX: 23.2, z0: -8.5, z1: 19.3, rise: 2.04 }
  ]);

  const migrationKey = 'ucanVrSpeedBuild';
  let speedMode = localStorage.getItem('ucanVrSpeedMode') || 'natural';
  if (localStorage.getItem(migrationKey) !== BUILD || !SPEED[speedMode]) {
    speedMode = 'natural';
    localStorage.setItem('ucanVrSpeedMode', speedMode);
    localStorage.setItem(migrationKey, BUILD);
  }

  const state = {
    scene: null,
    helper: null,
    session: null,
    desktop: null,
    xr: null,
    inXR: false,
    poseReady: false,
    floor: LEVEL.one,
    ground: LEVEL.one,
    appliedGround: LEVEL.one,
    transition: null,
    velocity: null,
    lastSafe: null,
    speedMode,
    turnMode: localStorage.getItem('ucanVrTurnMode') || 'smooth',
    turnLatch: false,
    run: false,
    jumpPressed: false,
    jumping: false,
    jumpVelocity: 0,
    jumpOffset: 0,
    sceneSnapshot: null,
    railMaterial: null,
    blockers: [],
    transitionCount: 0
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const same = (a, b) => Math.abs(Number(a) - Number(b)) < 0.05;
  const finite = value => Number.isFinite(Number(value));
  const nearestFloor = y => FLOORS.reduce((best, floor) => Math.abs(y - floor) < Math.abs(y - best) ? floor : best, FLOORS[0]);
  const normalSpeed = () => SPEED[state.speedMode] || SPEED.natural;
  const currentSpeed = () => state.run ? (RUN_SPEED[state.speedMode] || RUN_SPEED.natural) : normalSpeed();

  function status(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const element = document.getElementById('status');
    if (element && !window.__UCAN_API__?.setStatus) element.textContent = message;
  }

  function yaw(camera) {
    try {
      if (camera?.rotationQuaternion?.toEulerAngles) return camera.rotationQuaternion.toEulerAngles().y;
    } catch (_) {}
    return Number(camera?.rotation?.y || 0);
  }

  function setYaw(camera, value) {
    if (camera?.rotationQuaternion && B.Quaternion?.FromEulerAngles) {
      camera.rotationQuaternion.copyFrom(B.Quaternion.FromEulerAngles(0, value, 0));
    } else if (camera?.rotation) {
      camera.rotation.y = value;
    }
  }

  function insideLane(position, lane, margin = 0) {
    const minZ = Math.min(lane.z0, lane.z1) - margin;
    const maxZ = Math.max(lane.z0, lane.z1) + margin;
    return position.x >= lane.minX - margin && position.x <= lane.maxX + margin &&
      position.z >= minZ && position.z <= maxZ;
  }

  function progressFor(position, lane) {
    return clamp((lane.z0 - position.z) / (lane.z0 - lane.z1), 0, 1);
  }

  function entryDirection(position, lane) {
    if (!insideLane(position, lane, 0.35)) return null;
    if (same(state.floor, lane.low) && Math.abs(position.z - lane.z0) <= ENTRY_GATE_DEPTH) return 'up';
    if (same(state.floor, lane.high) && Math.abs(position.z - lane.z1) <= ENTRY_GATE_DEPTH) return 'down';
    return null;
  }

  function activeLane(position) {
    if (state.transition) {
      const lane = LANES.find(item => item.id === state.transition.id);
      if (lane && insideLane(position, lane, ACTIVE_LANE_MARGIN)) return lane;
      return lane || null;
    }
    for (const lane of LANES) {
      const direction = entryDirection(position, lane);
      if (!direction) continue;
      state.transition = {
        id: lane.id,
        direction,
        origin: direction === 'up' ? lane.low : lane.high,
        target: direction === 'up' ? lane.high : lane.low,
        startedAt: performance.now()
      };
      state.transitionCount += 1;
      return lane;
    }
    return null;
  }

  function surfaceAt(position) {
    const lane = activeLane(position);
    if (lane) {
      const t = progressFor(position, lane);
      return { type: 'stair', id: lane.id, lane, t, ground: lerp(lane.low, lane.high, t) };
    }
    if (!same(state.floor, LEVEL.three)) return null;
    const ramp = RAMPS.find(item => position.x >= item.minX && position.x <= item.maxX && position.z >= item.z0 && position.z <= item.z1);
    if (!ramp) return null;
    const t = clamp((position.z - ramp.z0) / (ramp.z1 - ramp.z0), 0, 1);
    return { type: 'ramp', id: ramp.id, t, ground: LEVEL.three + ramp.rise * t };
  }

  function finishTransition(lane, targetFloor) {
    const goingUp = same(targetFloor, lane.high);
    state.floor = targetFloor;
    state.ground = targetFloor;
    state.transition = null;
    state.jumpOffset = 0;
    state.jumping = false;
    state.jumpVelocity = 0;
    state.xr.position.z = goingUp ? lane.z1 - 1.15 : lane.z0 + 1.15;
    state.xr.position.x = clamp(state.xr.position.x, lane.minX + 0.55, lane.maxX - 0.55);
    applyGround(targetFloor);
    state.lastSafe?.copyFrom?.(state.xr.position);
    status(goingUp && lane.id === 'p3-terraza'
      ? 'Llegó correctamente a la terraza.'
      : `Cambio de nivel completado: ${targetFloor.toFixed(1)} m.`);
  }

  function resolveAbandonedTransition(lane) {
    if (!state.transition) return;
    const t = progressFor(state.xr.position, lane);
    const target = t >= TRANSITION_SNAP ? lane.high : lane.low;
    finishTransition(lane, target);
  }

  function controller(hand) {
    return (state.helper?.input?.controllers || []).find(item =>
      (item?.inputSource?.handedness || item?.motionController?.handedness) === hand
    ) || null;
  }

  function gamepad(hand) {
    const item = controller(hand);
    return item?.inputSource?.gamepad || item?.motionController?.gamepadObject || item?.motionController?.gamepad || null;
  }

  function components(hand) {
    const item = controller(hand);
    const motion = item?.motionController;
    if (!motion) return [];
    if (motion.components && typeof motion.components === 'object') {
      return Object.entries(motion.components).map(([id, value]) => ({ id, value }));
    }
    try {
      return (motion.getComponentIds?.() || []).map(id => ({ id, value: motion.getComponent?.(id) }));
    } catch (_) {
      return [];
    }
  }

  function componentPressed(hand, pattern) {
    return components(hand).some(({ id, value }) => pattern.test(String(id)) &&
      (value?.pressed === true || Number(value?.value || 0) > 0.72));
  }

  function buttonPressed(hand, indexes) {
    const buttons = Array.from(gamepad(hand)?.buttons || []);
    return indexes.some(index => buttons[index]?.pressed === true || Number(buttons[index]?.value || 0) > 0.72);
  }

  function axes(hand) {
    const values = Array.from(gamepad(hand)?.axes || []);
    if (values.length < 2) return { x: 0, y: 0 };
    const offset = values.length >= 4 ? values.length - 2 : 0;
    const deadZone = raw => {
      const value = finite(raw) ? Number(raw) : 0;
      const magnitude = Math.abs(value);
      if (magnitude <= 0.14) return 0;
      return Math.sign(value) * clamp((magnitude - 0.14) / 0.86, 0, 1);
    };
    return { x: deadZone(values[offset]), y: deadZone(values[offset + 1]) };
  }

  function runControl() {
    return componentPressed('left', /thumbstick|squeeze|grip/i) || buttonPressed('left', [1, 3]);
  }

  function jumpControl() {
    return componentPressed('right', /(?:^|[-_])(a|x)-?button|thumbstick/i) || buttonPressed('right', [3, 4]);
  }

  function horizontalBasis(camera) {
    let forward;
    try { forward = camera.getForwardRay?.(1)?.direction?.clone?.(); } catch (_) {}
    if (!forward) {
      const angle = yaw(camera);
      forward = new B.Vector3(Math.sin(angle), 0, Math.cos(angle));
    }
    forward.y = 0;
    if (forward.lengthSquared() < 0.0001) forward.set(0, 0, 1);
    forward.normalize();
    return { forward, right: new B.Vector3(forward.z, 0, -forward.x).normalize() };
  }

  function collisionMesh(mesh) {
    if (!mesh || mesh.metadata?.xrStairSurface || !mesh.checkCollisions) return false;
    if (mesh.metadata?.xrUnderStairBlocker) return true;
    if (mesh.isVisible === false) return false;
    if (typeof mesh.isEnabled === 'function' && !mesh.isEnabled()) return false;
    return !/gran losa|ruta avatar|zona segura VR|rooftop deck|rampa invisible|plataforma (?:inicio|fin)|peldaño|banda escalera/i.test(String(mesh.name || ''));
  }

  function blocked(step, ground) {
    if (!state.scene?.pickWithRay || !B.Ray || step.lengthSquared() < 1e-7) return false;
    const direction = step.clone().normalize();
    const length = step.length() + 0.45;
    for (const height of [0.42, 1.18]) {
      const origin = new B.Vector3(state.xr.position.x, ground + height, state.xr.position.z);
      const hit = state.scene.pickWithRay(new B.Ray(origin, direction, length), collisionMesh, false);
      if (hit?.hit && hit.distance <= length) return true;
    }
    return false;
  }

  function move(dt) {
    const input = axes('left');
    const basis = horizontalBasis(state.xr);
    state.run = runControl();
    const desired = basis.right.scale(input.x).add(basis.forward.scale(-input.y));
    const magnitude = Math.min(1, Math.hypot(input.x, input.y));
    if (desired.lengthSquared() > 1) desired.normalize();
    desired.scaleInPlace(currentSpeed() * (0.72 + 0.28 * magnitude));
    const response = 1 - Math.exp(-(desired.lengthSquared() > 0.0001 ? 23 : 27) * dt);
    state.velocity = B.Vector3.Lerp(state.velocity, desired, response);
    state.velocity.y = 0;
    if (state.velocity.lengthSquared() < 0.0004) state.velocity.set(0, 0, 0);
    let step = state.velocity.scale(dt);
    const maxStep = currentSpeed() * 0.05;
    if (step.length() > maxStep) step = step.normalize().scale(maxStep);
    if (step.lengthSquared() < 1e-8) return;
    const ground = surfaceAt(state.xr.position)?.ground ?? state.floor;
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
    const right = axes('right');
    if (state.turnMode === 'smooth') {
      state.turnLatch = false;
      if (Math.abs(right.x) < 0.16) return;
      setYaw(state.xr, yaw(state.xr) + right.x * 1.9 * dt);
      return;
    }
    if (Math.abs(right.x) < 0.35) {
      state.turnLatch = false;
      return;
    }
    if (state.turnLatch || Math.abs(right.x) < 0.72) return;
    state.turnLatch = true;
    setYaw(state.xr, yaw(state.xr) + (right.x > 0 ? Math.PI / 6 : -Math.PI / 6));
  }

  function updateJump(dt, surface) {
    const pressed = jumpControl();
    if (pressed && !state.jumpPressed && !state.jumping && !state.transition && surface?.type !== 'stair') {
      state.jumping = true;
      state.jumpVelocity = 4.35;
      state.jumpOffset = 0;
      status('Brinco VR activado.');
    }
    state.jumpPressed = pressed;
    if (surface?.type === 'stair' && state.jumping) {
      state.jumping = false;
      state.jumpVelocity = 0;
      state.jumpOffset = 0;
    }
    if (!state.jumping) return;
    state.jumpVelocity -= 12.5 * dt;
    state.jumpOffset += state.jumpVelocity * dt;
    if (state.jumpOffset <= 0) {
      state.jumpOffset = 0;
      state.jumpVelocity = 0;
      state.jumping = false;
    }
  }

  function applyGround(target) {
    const delta = target - state.appliedGround;
    if (state.poseReady && finite(delta) && Math.abs(delta) > 0.0005) state.xr.position.y += delta;
    state.appliedGround = target;
  }

  function updateGround(dt) {
    const surface = surfaceAt(state.xr.position);
    let ground = state.floor;

    if (surface?.type === 'stair') {
      const { lane, t } = surface;
      const transition = state.transition;
      ground = surface.ground;
      if (transition?.direction === 'up' && (t >= TRANSITION_FINISH || state.xr.position.z <= lane.z1 + 1.25)) {
        finishTransition(lane, lane.high);
        return;
      }
      if (transition?.direction === 'down' && (t <= 1 - TRANSITION_FINISH || state.xr.position.z >= lane.z0 - 1.25)) {
        finishTransition(lane, lane.low);
        return;
      }
      if (transition && !insideLane(state.xr.position, lane, ACTIVE_LANE_MARGIN)) {
        resolveAbandonedTransition(lane);
        return;
      }
    } else if (surface?.type === 'ramp') {
      state.transition = null;
      ground = surface.ground;
    } else if (state.transition) {
      const lane = LANES.find(item => item.id === state.transition.id);
      if (lane) {
        resolveAbandonedTransition(lane);
        return;
      }
      state.transition = null;
    }

    updateJump(dt, surface);
    state.ground = ground;
    applyGround(ground + state.jumpOffset);
  }

  function createUnderStairBlockers(scene) {
    const blockers = [];
    const material = new B.StandardMaterial('bloqueo invisible bajo escaleras V275', scene);
    material.alpha = 0.001;
    material.disableLighting = true;
    material.backFaceCulling = false;

    for (const lane of LANES) {
      const segments = lane.id === 'p3-terraza' ? 16 : 14;
      const run = Math.abs(lane.z0 - lane.z1);
      const segmentDepth = run / segments + 0.35;
      const width = Math.max(1.4, lane.maxX - lane.minX - 0.55);
      for (let index = 1; index < segments - 1; index += 1) {
        const t = (index + 0.5) / segments;
        const stairSurface = lerp(lane.low, lane.high, t);
        const bottom = lane.low - 0.08;
        const top = stairSurface - 0.28;
        const height = top - bottom;
        if (height < 0.52) continue;
        const mesh = B.MeshBuilder.CreateBox(`bloqueo bajo escalera ${lane.id} ${index}`, {
          width,
          height,
          depth: segmentDepth
        }, scene);
        mesh.position.set((lane.minX + lane.maxX) / 2, bottom + height / 2, lerp(lane.z0, lane.z1, t));
        mesh.material = material;
        mesh.visibility = 0.001;
        mesh.isVisible = true;
        mesh.isPickable = false;
        mesh.checkCollisions = true;
        mesh.alwaysSelectAsActiveMesh = true;
        mesh.metadata = {
          xrUnderStairBlocker: true,
          stairId: lane.id,
          segment: index,
          floor: lane.low
        };
        blockers.push(mesh);
      }
    }
    state.blockers = blockers;
    return {
      total: blockers.length,
      stairs: LANES.length,
      terraceSegments: blockers.filter(item => item.metadata?.stairId === 'p3-terraza').length
    };
  }

  function fixTransparentMaterials(scene) {
    const railMeshes = (scene.meshes || []).filter(mesh =>
      /baranda cristal|cristal lateral escalera|cristal escalera|baranda.*escalera/i.test(String(mesh?.name || ''))
    );
    if (!railMeshes.length) return { rails: 0, materials: 0 };
    const rail = new B.StandardMaterial('cristal barandas XR visible V275', scene);
    rail.diffuseColor = B.Color3.FromHexString('#9bdde8');
    rail.emissiveColor = B.Color3.FromHexString('#173f46').scale(0.28);
    rail.specularColor = new B.Color3(0.18, 0.24, 0.26);
    rail.specularPower = 42;
    rail.alpha = 0.28;
    rail.backFaceCulling = false;
    rail.needDepthPrePass = false;
    rail.disableDepthWrite = true;
    rail.separateCullingPass = true;
    if (B.Material?.MATERIAL_ALPHABLEND != null) rail.transparencyMode = B.Material.MATERIAL_ALPHABLEND;
    railMeshes.forEach((mesh, index) => {
      mesh.material = rail;
      mesh.renderingGroupId = 2;
      mesh.alphaIndex = 200 + index;
      mesh.isVisible = true;
      mesh.visibility = 1;
      mesh.alwaysSelectAsActiveMesh = true;
    });
    let patched = 0;
    for (const material of scene.materials || []) {
      if (!/cristal|glass|agua/i.test(String(material?.name || '')) || material === rail) continue;
      material.needDepthPrePass = false;
      material.disableDepthWrite = true;
      material.backFaceCulling = false;
      material.separateCullingPass = true;
      if (Number(material.alpha) >= 0.05) material.alpha = Math.max(0.24, Math.min(0.58, Number(material.alpha)));
      if (material.diffuseColor && material.diffuseColor.r < 0.2 && material.diffuseColor.g < 0.3) {
        material.diffuseColor = B.Color3.FromHexString('#8fc9d3');
        material.emissiveColor = B.Color3.FromHexString('#163b42').scale(0.18);
      }
      if (B.Material?.MATERIAL_ALPHABLEND != null) material.transparencyMode = B.Material.MATERIAL_ALPHABLEND;
      patched += 1;
    }
    state.railMaterial = rail;
    return { rails: railMeshes.length, materials: patched };
  }

  function stairCollisionFix(scene) {
    for (const mesh of scene.meshes || []) {
      if (!/peldaño|banda escalera|rampa invisible|plataforma (?:inicio|fin)|escalon central anfiteatro|pasillo lateral escalera anfiteatro/i.test(String(mesh?.name || ''))) continue;
      mesh.metadata = { ...(mesh.metadata || {}), xrStairSurface: true };
      mesh.checkCollisions = false;
      mesh.isPickable = true;
    }
  }

  function disableBuiltIns(helper) {
    const manager = helper?.baseExperience?.featuresManager;
    if (!manager) return;
    for (const name of [B.WebXRFeatureName?.MOVEMENT, B.WebXRFeatureName?.TELEPORTATION].filter(Boolean)) {
      try { manager.disableFeature(name); } catch (_) {}
    }
  }

  function captureScene(scene) {
    state.sceneSnapshot = {
      autoClear: scene.autoClear,
      autoClearDepthAndStencil: scene.autoClearDepthAndStencil,
      lightsEnabled: scene.lightsEnabled,
      texturesEnabled: scene.texturesEnabled,
      shadowsEnabled: scene.shadowsEnabled,
      particlesEnabled: scene.particlesEnabled,
      postProcessesEnabled: scene.postProcessesEnabled,
      clearColor: scene.clearColor?.clone?.() || scene.clearColor,
      ambientColor: scene.ambientColor?.clone?.() || scene.ambientColor,
      environmentTexture: scene.environmentTexture,
      environmentIntensity: scene.environmentIntensity
    };
  }

  function makeVisible() {
    const scene = state.scene;
    const snapshot = state.sceneSnapshot;
    if (!scene || !snapshot) return;
    scene.autoClear = true;
    scene.autoClearDepthAndStencil = true;
    scene.lightsEnabled = true;
    scene.texturesEnabled = true;
    scene.shadowsEnabled = snapshot.shadowsEnabled !== false;
    scene.particlesEnabled = snapshot.particlesEnabled !== false;
    scene.postProcessesEnabled = snapshot.postProcessesEnabled !== false;
    if (snapshot.clearColor) scene.clearColor = snapshot.clearColor.clone?.() || snapshot.clearColor;
    if (snapshot.ambientColor) scene.ambientColor = snapshot.ambientColor.clone?.() || snapshot.ambientColor;
    scene.environmentTexture = snapshot.environmentTexture;
    scene.environmentIntensity = snapshot.environmentIntensity;
    try { scene.setRenderingAutoClearDepthStencil?.(0, true, true, true); } catch (_) {}
    for (const light of scene.lights || []) if (typeof light.setEnabled === 'function') light.setEnabled(true);
    if (state.railMaterial) {
      state.railMaterial.needDepthPrePass = false;
      state.railMaterial.disableDepthWrite = true;
      state.railMaterial.alpha = 0.28;
    }
  }

  function restoreScene() {
    const scene = state.scene;
    const snapshot = state.sceneSnapshot;
    if (!scene || !snapshot) return;
    scene.autoClear = snapshot.autoClear;
    scene.autoClearDepthAndStencil = snapshot.autoClearDepthAndStencil;
    scene.lightsEnabled = snapshot.lightsEnabled;
    scene.texturesEnabled = snapshot.texturesEnabled;
    scene.shadowsEnabled = snapshot.shadowsEnabled;
    scene.particlesEnabled = snapshot.particlesEnabled;
    scene.postProcessesEnabled = snapshot.postProcessesEnabled;
  }

  function cameraParity(camera) {
    if (!camera) return;
    camera.layerMask = 0x0FFFFFFF;
    camera.minZ = 0.05;
    camera.maxZ = 2500;
  }

  function initialPose(camera) {
    state.floor = nearestFloor(Number(state.desktop?.position?.y || 1.72) - 1.72);
    state.ground = state.appliedGround = state.floor;
    state.transition = null;
    state.jumpOffset = 0;
    state.jumping = false;
    let aligned = false;
    try {
      if (typeof camera.setTransformationFromNonVRCamera === 'function') {
        camera.setTransformationFromNonVRCamera(state.desktop, true);
        aligned = true;
      }
    } catch (_) {}
    if (!aligned) {
      camera.position.x = Number(state.desktop?.position?.x || 0);
      camera.position.z = Number(state.desktop?.position?.z || 42);
      camera.position.y = state.floor;
      setYaw(camera, yaw(state.desktop));
    }
    state.poseReady = true;
    state.lastSafe.set(camera.position.x, camera.position.y, camera.position.z);
  }

  function safety() {
    const position = state.xr.position;
    const valid = finite(position.x) && finite(position.y) && finite(position.z) &&
      position.x >= WORLD.minX - 3 && position.x <= WORLD.maxX + 3 &&
      position.z >= WORLD.minZ - 3 && position.z <= WORLD.maxZ + 3 &&
      position.y >= state.ground - 1.25 && position.y <= state.ground + 4.5;
    if (!valid) {
      position.copyFrom(state.lastSafe || new B.Vector3(0, state.ground, 42));
      state.velocity.set(0, 0, 0);
      state.jumpOffset = 0;
      state.jumping = false;
    } else {
      state.lastSafe.copyFrom(position);
    }
  }

  function syncDesktop() {
    if (state.desktop?.position) {
      state.desktop.position.x = state.xr.position.x;
      state.desktop.position.z = state.xr.position.z;
      state.desktop.position.y = state.ground + 1.72;
      if (state.desktop.rotation) state.desktop.rotation.y = yaw(state.xr);
    }
    const avatar = state.scene?.getTransformNodeByName?.('avatar-local');
    if (avatar?.isEnabled?.()) avatar.setEnabled(false);
  }

  function controlsUI() {
    const grid = document.querySelector('.control-grid');
    if (!grid || document.getElementById('ucanVrSpeedBtn')) return;
    const speedButton = document.createElement('button');
    speedButton.id = 'ucanVrSpeedBtn';
    speedButton.className = 'secondary';
    const labels = { comfort: 'VR: confort 3.4', natural: 'VR: igual PC 5.0', fast: 'VR: rápido 7.0' };
    const refresh = () => { speedButton.textContent = labels[state.speedMode] || labels.natural; };
    speedButton.onclick = () => {
      state.speedMode = state.speedMode === 'comfort' ? 'natural' : state.speedMode === 'natural' ? 'fast' : 'comfort';
      localStorage.setItem('ucanVrSpeedMode', state.speedMode);
      refresh();
      status(`Velocidad VR: ${normalSpeed().toFixed(1)} m/s. Mantenga presionado el joystick izquierdo o el grip para correr.`);
    };
    refresh();
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
    if (!state.inXR || !state.poseReady) return;
    const dt = clamp((state.scene.getEngine().getDeltaTime() || 16) / 1000, 0.001, 0.033);
    move(dt);
    turn(dt);
    updateGround(dt);
    makeVisible();
    safety();
    syncDesktop();
  }

  function install(scene, helper) {
    if (!helper || helper.__ucanV275) return helper;
    helper.__ucanV275 = true;
    state.scene = scene;
    state.helper = helper;
    state.session = helper.baseExperience.sessionManager;
    state.desktop = scene.activeCamera;
    state.xr = helper.baseExperience.camera;
    state.velocity = new B.Vector3(0, 0, 0);
    state.lastSafe = new B.Vector3(0, 0, 42);
    captureScene(scene);
    const glassAudit = fixTransparentMaterials(scene);
    stairCollisionFix(scene);
    const blockerAudit = createUnderStairBlockers(scene);
    controlsUI();
    disableBuiltIns(helper);
    state.xr.applyGravity = false;
    state.xr.checkCollisions = false;
    if (state.xr.cameraDirection) state.xr.cameraDirection.set(0, 0, 0);
    helper.baseExperience.onInitialXRPoseSetObservable.add(initialPose);
    state.xr.onXRCameraInitializedObservable?.add(() => {
      cameraParity(state.xr);
      for (const camera of state.xr.rigCameras || []) cameraParity(camera);
    });
    helper.baseExperience.onStateChangedObservable.add(xrState => {
      if (xrState === B.WebXRState.ENTERING_XR) {
        captureScene(scene);
        state.poseReady = false;
        makeVisible();
      }
      state.inXR = xrState === B.WebXRState.IN_XR;
      if (state.inXR) {
        disableBuiltIns(helper);
        if (!state.poseReady) initialPose(state.xr);
        state.velocity.set(0, 0, 0);
        makeVisible();
        cameraParity(state.xr);
        for (const camera of state.xr.rigCameras || []) cameraParity(camera);
        status('Meta Quest V275: bloqueos debajo de todas las escaleras y acceso estable a la terraza.');
      } else if (xrState === B.WebXRState.NOT_IN_XR) {
        state.velocity.set(0, 0, 0);
        state.poseReady = false;
        state.run = false;
        state.jumping = false;
        state.jumpOffset = 0;
        state.transition = null;
        restoreScene();
        if (state.desktop?.position) {
          state.desktop.position.x = state.xr.position.x;
          state.desktop.position.z = state.xr.position.z;
          state.desktop.position.y = state.floor + 1.72;
        }
      }
    });
    scene.onBeforeRenderObservable.add(update);
    window.__UCAN_XR_HELPER__ = helper;
    window.__UCAN_QUEST_XR_AUDIT__ = {
      version: VERSION,
      build: BUILD,
      installed: true,
      blackScreenProtection: true,
      transparentRailFix: true,
      underStairBlockers: true,
      blockerAudit,
      gatedStairEntry: true,
      underStairActivationPrevented: true,
      terraceTransitionFixed: true,
      transitionEndpointSnap: true,
      sideExitRecovery: true,
      normalSpeed: 5,
      runSpeed: 7.5,
      runControls: ['presionar joystick izquierdo', 'grip izquierdo'],
      jumpControls: ['botón A', 'presionar joystick derecho'],
      jumpEnabled: true,
      floorLock: true,
      currentSpeed: () => currentSpeed(),
      getState: () => ({
        inXR: state.inXR,
        poseReady: state.poseReady,
        floor: state.floor,
        ground: state.ground,
        cameraY: state.xr?.position?.y,
        speedMode: state.speedMode,
        currentSpeed: currentSpeed(),
        running: state.run,
        jumping: state.jumping,
        jumpOffset: state.jumpOffset,
        transition: state.transition ? { ...state.transition } : null,
        transitionCount: state.transitionCount,
        blockers: state.blockers.length
      })
    };
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanV275Patched) return;
  async function patched(options = {}) {
    const safe = { ...options };
    delete safe.outputCanvasOptions;
    delete safe.ignoreNativeCameraTransformation;
    safe.disableTeleportation = true;
    safe.optionalFeatures = options.optionalFeatures ?? true;
    safe.uiOptions = { ...(options.uiOptions || {}), sessionMode: 'immersive-vr', referenceSpaceType: 'local-floor' };
    const helper = await original.call(this, safe);
    return install(this, helper);
  }
  patched.__ucanV275Patched = true;
  patched.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patched;

  window.__UCAN_QUEST_XR_BOOT__ = {
    version: VERSION,
    build: BUILD,
    patched: true,
    underStairBlockers: true,
    gatedStairEntry: true,
    terraceTransitionFixed: true,
    runEnabled: true,
    jumpEnabled: true,
    defaultSpeed: 5,
    runSpeed: 7.5
  };
  console.info('[UCAN V275] Bloqueos bajo escaleras y transición estable a la terraza preparados.');
})();
