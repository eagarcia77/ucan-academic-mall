(() => {
  'use strict';

  const VERSION = 'V268';
  const BUILD = 'V268-20260715-META-QUEST-LOCOMOTION';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) {
    console.warn('[UCAN V268] Babylon WebXR no está disponible.');
    return;
  }

  const LEVEL = Object.freeze({ one: 0, two: 8.2, three: 16.4, rooftop: 27.2 });
  const FLOORS = [LEVEL.one, LEVEL.two, LEVEL.three, LEVEL.rooftop];
  const STAIR_LANES = Object.freeze([
    { id:'p1-p2-oeste', minX:-24.2, maxX:-15.8, zBottom:33.5, zTop:8.5, yBottom:LEVEL.one, yTop:LEVEL.two },
    { id:'p2-p1-este', minX:-12.2, maxX:-3.8, zBottom:33.5, zTop:8.5, yBottom:LEVEL.one, yTop:LEVEL.two },
    { id:'p2-p3-oeste', minX:-38.2, maxX:-29.8, zBottom:33.5, zTop:8.5, yBottom:LEVEL.two, yTop:LEVEL.three },
    { id:'p3-p2-este', minX:-30.2, maxX:-21.8, zBottom:33.5, zTop:8.5, yBottom:LEVEL.two, yTop:LEVEL.three },
    { id:'p3-terraza', minX:39.3, maxX:48.7, zBottom:40.5, zTop:8.7, yBottom:LEVEL.three, yTop:LEVEL.rooftop }
  ]);
  const AUDITORIUM_RAMPS = Object.freeze([
    { id:'anfiteatro-central', minX:-4.8, maxX:1.2, zStart:-14, zEnd:18.8, yBase:LEVEL.three, rise:2.38 },
    { id:'anfiteatro-lateral', minX:18.2, maxX:22.8, zStart:-8, zEnd:18.8, yBase:LEVEL.three, rise:2.04 }
  ]);

  const state = {
    helper: null,
    scene: null,
    nonXrCamera: null,
    xrCamera: null,
    movementFeature: null,
    inXR: false,
    activeLane: null,
    lastFloor: LEVEL.one,
    installedAt: null
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const nearestFloor = y => FLOORS.reduce((best, floor) => Math.abs(y - floor) < Math.abs(y - best) ? floor : best, FLOORS[0]);
  const insideXZ = (position, area) => position.x >= area.minX && position.x <= area.maxX && position.z >= Math.min(area.zTop ?? area.zStart, area.zBottom ?? area.zEnd) && position.z <= Math.max(area.zTop ?? area.zStart, area.zBottom ?? area.zEnd);

  function setStatus(message) {
    window.__UCAN_API__?.setStatus?.(message);
    const status = document.getElementById('status');
    if (status && !window.__UCAN_API__?.setStatus) status.textContent = message;
  }

  function stairHeight(position) {
    const lane = STAIR_LANES.find(item => insideXZ(position, item));
    if (!lane) return null;
    const denominator = lane.zBottom - lane.zTop;
    const progress = denominator ? clamp((lane.zBottom - position.z) / denominator, 0, 1) : 0;
    return { id: lane.id, y: lerp(lane.yBottom, lane.yTop, progress), progress };
  }

  function auditoriumHeight(position) {
    const ramp = AUDITORIUM_RAMPS.find(item => position.x >= item.minX && position.x <= item.maxX && position.z >= item.zStart && position.z <= item.zEnd);
    if (!ramp) return null;
    const progress = clamp((position.z - ramp.zStart) / (ramp.zEnd - ramp.zStart), 0, 1);
    return { id: ramp.id, y: ramp.yBase + ramp.rise * progress, progress };
  }

  function disableStairStepCollisions(scene) {
    let adjusted = 0;
    const stairSurfacePattern = /peldaño|banda escalera|rampa invisible|plataforma (?:inicio|fin)|escalon central anfiteatro|pasillo lateral escalera anfiteatro/i;
    for (const mesh of scene.meshes) {
      if (!mesh || !stairSurfacePattern.test(String(mesh.name || ''))) continue;
      mesh.metadata = { ...(mesh.metadata || {}), xrStairSurface: true };
      if (mesh.checkCollisions) {
        mesh.checkCollisions = false;
        adjusted += 1;
      }
      mesh.isPickable = true;
    }
    return adjusted;
  }

  function questRegistrationConfigurations() {
    const component = B.WebXRControllerComponent;
    const types = [component?.THUMBSTICK_TYPE, component?.TOUCHPAD_TYPE].filter(Boolean);
    const deadZone = (value, threshold) => Math.abs(value) > threshold ? value : 0;
    return [
      {
        allowedComponentTypes: types,
        forceHandedness: 'left',
        axisChangedHandler(axes, movementState, featureContext) {
          movementState.moveX = deadZone(axes.x, featureContext.movementThreshold);
          movementState.moveY = deadZone(axes.y, featureContext.movementThreshold);
        }
      },
      {
        allowedComponentTypes: types,
        forceHandedness: 'right',
        axisChangedHandler(axes, movementState, featureContext) {
          movementState.rotateX = deadZone(axes.x, featureContext.rotationThreshold);
          movementState.rotateY = deadZone(axes.y, featureContext.rotationThreshold);
        }
      }
    ];
  }

  function enableQuestMovement(helper) {
    const manager = helper.baseExperience.featuresManager;
    try { manager.disableFeature(B.WebXRFeatureName.TELEPORTATION); } catch (_) {}
    try {
      return manager.enableFeature(B.WebXRFeatureName.MOVEMENT, 'latest', {
        xrInput: helper.input,
        movementEnabled: true,
        movementSpeed: 0.72,
        movementThreshold: 0.14,
        rotationEnabled: true,
        rotationSpeed: 1.25,
        rotationThreshold: 0.18,
        movementOrientationFollowsViewerPose: true,
        movementOrientationFollowsController: false,
        customRegistrationConfigurations: questRegistrationConfigurations()
      });
    } catch (error) {
      console.error('[UCAN V268] No se pudo activar locomoción continua WebXR:', error);
      return null;
    }
  }

  function setInitialXRFloor() {
    const desktopY = Number(state.nonXrCamera?.position?.y || 1.7);
    const desktopFloors = FLOORS.map(floor => floor + 1.7);
    const nearestDesktop = desktopFloors.reduce((best, floor) => Math.abs(desktopY - floor) < Math.abs(desktopY - best) ? floor : best, desktopFloors[0]);
    const floor = nearestDesktop - 1.7;
    state.xrCamera.position.y = floor;
    state.lastFloor = floor;
  }

  function updateXRHeight() {
    if (!state.inXR || !state.xrCamera) return;
    const camera = state.xrCamera;
    const dt = Math.min((state.scene?.getEngine?.().getDeltaTime?.() || 16) / 1000, 0.05);
    const stair = stairHeight(camera.position);
    const auditorium = stair ? null : auditoriumHeight(camera.position);
    const surface = stair || auditorium;

    if (surface) {
      const factor = Math.min(1, dt * 11);
      camera.position.y = lerp(camera.position.y, surface.y, factor);
      if (camera.cameraDirection) camera.cameraDirection.y = 0;
      if (state.activeLane !== surface.id) {
        state.activeLane = surface.id;
        setStatus('Meta Quest: altura automática activa en escaleras. Continúe con el joystick izquierdo.');
      }
      return;
    }

    if (state.activeLane) {
      const snapped = nearestFloor(camera.position.y);
      camera.position.y = snapped;
      state.lastFloor = snapped;
      state.activeLane = null;
      setStatus(`Meta Quest: llegada confirmada al ${snapped === LEVEL.rooftop ? 'rooftop' : `piso ${FLOORS.indexOf(snapped) + 1}`}.`);
      return;
    }

    const floor = nearestFloor(camera.position.y);
    if (Math.abs(camera.position.y - floor) < 0.42) {
      camera.position.y = lerp(camera.position.y, floor, Math.min(1, dt * 9));
      state.lastFloor = floor;
    }
  }

  function installQuestXR(scene, helper) {
    if (!helper || helper.__ucanQuestLocomotionInstalled) return helper;
    helper.__ucanQuestLocomotionInstalled = true;
    state.helper = helper;
    state.scene = scene;
    state.nonXrCamera = scene.activeCamera;
    state.xrCamera = helper.baseExperience.camera;
    state.installedAt = new Date().toISOString();

    const adjustedCollisions = disableStairStepCollisions(scene);
    const xrCamera = state.xrCamera;
    xrCamera.speed = 2.0;
    xrCamera.checkCollisions = true;
    xrCamera.applyGravity = false;
    xrCamera.ellipsoid = new B.Vector3(0.42, 0.9, 0.42);
    xrCamera.ellipsoidOffset = new B.Vector3(0, 0.9, 0);
    xrCamera.minZ = 0.05;

    state.movementFeature = enableQuestMovement(helper);

    helper.baseExperience.onStateChangedObservable.add(xrState => {
      state.inXR = xrState === B.WebXRState.IN_XR;
      if (state.inXR) {
        setInitialXRFloor();
        setStatus('Meta Quest listo: joystick izquierdo para caminar, joystick derecho para girar. Las escaleras ajustan la altura automáticamente.');
      } else if (xrState === B.WebXRState.NOT_IN_XR && state.nonXrCamera && xrCamera) {
        const floor = nearestFloor(xrCamera.position.y);
        state.nonXrCamera.position.x = xrCamera.position.x;
        state.nonXrCamera.position.z = xrCamera.position.z;
        state.nonXrCamera.position.y = floor + 1.7;
      }
    });

    scene.onBeforeRenderObservable.add(updateXRHeight);

    window.__UCAN_QUEST_XR_AUDIT__ = {
      version: VERSION,
      build: BUILD,
      installed: true,
      standardQuestMapping: true,
      leftStick: 'movimiento',
      rightStick: 'giro',
      smoothStairHeight: true,
      floorTransitions: ['Piso 1 ↔ Piso 2', 'Piso 2 ↔ Piso 3', 'Piso 3 ↔ Terraza'],
      auditoriumRamps: true,
      teleportationDisabledToAvoidConflict: true,
      movementFeatureEnabled: Boolean(state.movementFeature),
      adjustedStairCollisions: adjustedCollisions,
      getState: () => ({ inXR: state.inXR, activeLane: state.activeLane, floor: state.lastFloor, cameraPosition: state.xrCamera?.position?.asArray?.() || null })
    };
    window.__UCAN_XR_HELPER__ = helper;
    console.info('[UCAN V268] Meta Quest locomotion:', window.__UCAN_QUEST_XR_AUDIT__);
    return helper;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanQuestV268Patched) return;

  async function patchedCreateDefaultXRExperienceAsync(options = {}) {
    const helper = await original.call(this, { ...options, disableTeleportation: true });
    return installQuestXR(this, helper);
  }
  patchedCreateDefaultXRExperienceAsync.__ucanQuestV268Patched = true;
  patchedCreateDefaultXRExperienceAsync.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patchedCreateDefaultXRExperienceAsync;

  window.__UCAN_QUEST_XR_BOOT__ = { version: VERSION, build: BUILD, patched: true };
  console.info('[UCAN V268] Interceptor WebXR preparado para Meta Quest.');
})();
