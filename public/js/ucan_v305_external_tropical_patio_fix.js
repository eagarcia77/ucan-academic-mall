(() => {
  'use strict';

  const VERSION = 'V305';
  const BUILD = 'V305-20260728-EXTERNAL-TROPICAL-PATIO-PERIMETER-R1';
  const B = window.BABYLON;
  if (!B) return;

  // Huella protegida del edificio. Todo elemento del patio debe quedar fuera
  // de este rectángulo y conservar una franja de separación visible.
  const BUILDING = Object.freeze({ halfX: 76, halfZ: 60 });
  const SAFE_RING = Object.freeze({ halfX: 84, halfZ: 70 });
  const BASE_SHIFT = Object.freeze({ x: 18, z: 18 });
  const SIGN_KEYS = new Set([
    'season-current-v304',
    'pr-celebration-v304',
    'four-seasons-v304'
  ]);

  const state = {
    scene: null,
    installed: false,
    relocatedNodes: 0,
    relocatedButterflies: 0,
    correctedSigns: 0,
    scans: 0,
    remainingViolations: 0,
    lastError: null,
    timer: null
  };

  function absolutePosition(node) {
    try {
      node.computeWorldMatrix?.(true);
      return node.getAbsolutePosition?.().clone?.() || node.position?.clone?.() || new B.Vector3(0, 0, 0);
    } catch (_) {
      return node.position?.clone?.() || new B.Vector3(0, 0, 0);
    }
  }

  function setAbsoluteXZ(node, x, z) {
    const current = absolutePosition(node);
    const target = new B.Vector3(x, current.y, z);
    try {
      if (node.parent?.getWorldMatrix) {
        node.parent.computeWorldMatrix?.(true);
        const inverse = node.parent.getWorldMatrix().clone();
        inverse.invert();
        const local = B.Vector3.TransformCoordinates(target, inverse);
        node.position.copyFrom(local);
      } else {
        node.position.x = x;
        node.position.z = z;
      }
      node.computeWorldMatrix?.(true);
    } catch (_) {
      node.position.x = x;
      node.position.z = z;
    }
  }

  function isRootNode(node) {
    const name = String(node?.name || '');
    return /^(?:Ecosistema natural estacional UCAN V304|Decoraciones celebraciones Puerto Rico V304)$/i.test(name) ||
      /^Desplazamiento exterior mariposa V305/i.test(name);
  }

  function panelKey(node) {
    const metadata = node?.metadata || {};
    return String(metadata.livePanelKey || metadata.originalPanelKeyV304R6 || metadata.originalPanelKeyV304R5 || '');
  }

  function isManagedNode(node) {
    if (!node || !node.position || isRootNode(node)) return false;
    const metadata = node.metadata || {};
    const name = String(node.name || '');
    return Boolean(
      metadata.ecosystemV304 === true ||
      metadata.correctedBoardFaceV304R6 === true ||
      SIGN_KEYS.has(panelKey(node)) ||
      /(?:árbol|arbol|palma|arbusto|flor|roca|piedra|luz jardín|luz jardin|bandera Puerto Rico|guirnalda Puerto Rico) .*V304/i.test(name)
    );
  }

  function isButterflyPivot(node) {
    return Boolean(node?.position) && /^mariposa ecosistema V304 \d+$/i.test(String(node.name || ''));
  }

  function signOf(value, fallback = 1) {
    return value < 0 ? -1 : value > 0 ? 1 : fallback;
  }

  function insideProtectedFootprint(x, z) {
    return Math.abs(x) < BUILDING.halfX && Math.abs(z) < BUILDING.halfZ;
  }

  function insideSafeRing(x, z) {
    return Math.abs(x) < SAFE_RING.halfX && Math.abs(z) < SAFE_RING.halfZ;
  }

  function relocationFor(x, z) {
    if (!insideSafeRing(x, z)) return null;

    const distanceToX = SAFE_RING.halfX - Math.abs(x);
    const distanceToZ = SAFE_RING.halfZ - Math.abs(z);
    const useX = distanceToX <= distanceToZ;

    let targetX = x;
    let targetZ = z;

    if (useX) {
      const direction = signOf(x, z < 0 ? -1 : 1);
      targetX += direction * BASE_SHIFT.x;
      if (Math.abs(targetX) < SAFE_RING.halfX) targetX = direction * SAFE_RING.halfX;
    } else {
      const direction = signOf(z, x < 0 ? -1 : 1);
      targetZ += direction * BASE_SHIFT.z;
      if (Math.abs(targetZ) < SAFE_RING.halfZ) targetZ = direction * SAFE_RING.halfZ;
    }

    return { x: targetX, z: targetZ, side: useX ? 'x' : 'z' };
  }

  function relocateButterfly(pivot) {
    if (pivot.metadata?.externalPatioV305Relocated === true) return false;
    const position = absolutePosition(pivot);
    const relocation = relocationFor(position.x, position.z);
    if (!relocation) {
      pivot.metadata = { ...(pivot.metadata || {}), externalPatioV305Relocated: true };
      return false;
    }

    const wrapper = new B.TransformNode(`Desplazamiento exterior mariposa V305 ${pivot.uniqueId}`, state.scene);
    const oldParent = pivot.parent || null;
    wrapper.parent = oldParent;
    wrapper.position.set(relocation.x - position.x, 0, relocation.z - position.z);
    wrapper.metadata = {
      externalPatioV305: true,
      decorative: true,
      sourceButterflyUniqueId: pivot.uniqueId
    };
    pivot.parent = wrapper;
    pivot.metadata = {
      ...(pivot.metadata || {}),
      externalPatioV305Relocated: true,
      externalPatioV305Side: relocation.side
    };
    state.relocatedButterflies += 1;
    return true;
  }

  function relocateNode(node) {
    if (node.metadata?.externalPatioV305Relocated === true) return false;
    const position = absolutePosition(node);
    const relocation = relocationFor(position.x, position.z);

    if (!relocation) {
      node.metadata = { ...(node.metadata || {}), externalPatioV305Relocated: true };
      return false;
    }

    setAbsoluteXZ(node, relocation.x, relocation.z);
    node.metadata = {
      ...(node.metadata || {}),
      externalPatioV305: true,
      externalPatioV305Relocated: true,
      externalPatioV305OriginalPosition: { x: position.x, z: position.z },
      externalPatioV305Side: relocation.side
    };
    if (node.metadata.correctedBoardFaceV304R6 === true || SIGN_KEYS.has(panelKey(node))) {
      state.correctedSigns += 1;
    }
    state.relocatedNodes += 1;
    return true;
  }

  function remainingViolations() {
    let count = 0;
    const nodes = [...(state.scene?.meshes || []), ...(state.scene?.transformNodes || [])];
    for (const node of nodes) {
      if (!(isManagedNode(node) || isButterflyPivot(node))) continue;
      const position = absolutePosition(node);
      if (insideProtectedFootprint(position.x, position.z)) count += 1;
    }
    return count;
  }

  function relocateAll() {
    if (!state.scene || state.scene.isDisposed?.()) return false;
    state.scans += 1;

    for (const node of [...(state.scene.transformNodes || [])]) {
      if (isButterflyPivot(node)) relocateButterfly(node);
    }

    for (const node of [...(state.scene.meshes || []), ...(state.scene.transformNodes || [])]) {
      if (isButterflyPivot(node) || !isManagedNode(node)) continue;
      relocateNode(node);
    }

    state.remainingViolations = remainingViolations();
    window.__UCAN_TROPICAL_PATIO_V305_AUDIT__ = {
      version: VERSION,
      build: BUILD,
      installed: true,
      buildingFootprint: { ...BUILDING },
      safeExteriorRing: { ...SAFE_RING },
      relocatedNodes: state.relocatedNodes,
      relocatedButterflies: state.relocatedButterflies,
      correctedSigns: state.correctedSigns,
      scans: state.scans,
      remainingViolations: state.remainingViolations,
      patioOutsideBuilding: state.remainingViolations === 0,
      lastError: state.lastError
    };
    return true;
  }

  function install() {
    if (state.installed) return true;
    state.scene = window.__UCAN_API__?.getScene?.() || null;
    if (!state.scene) return false;

    state.installed = true;
    relocateAll();
    state.timer = window.setInterval(relocateAll, 1500);

    window.__UCAN_TROPICAL_PATIO_V305__ = {
      version: VERSION,
      build: BUILD,
      installed: true,
      refresh: relocateAll,
      getState: () => ({ ...window.__UCAN_TROPICAL_PATIO_V305_AUDIT__ })
    };

    window.__UCAN_API__?.setStatus?.('Patio tropical V305 reubicado fuera del edificio.');
    console.info('[UCAN V305] Patio tropical exterior:', window.__UCAN_TROPICAL_PATIO_V305_AUDIT__);
    return true;
  }

  let attempts = 0;
  const bootstrap = window.setInterval(() => {
    attempts += 1;
    try {
      if (install() || attempts >= 240) window.clearInterval(bootstrap);
    } catch (error) {
      state.lastError = error?.message || String(error);
      console.error('[UCAN V305] Error reubicando el patio tropical exterior:', error);
      if (attempts >= 240) window.clearInterval(bootstrap);
    }
  }, 100);
})();
