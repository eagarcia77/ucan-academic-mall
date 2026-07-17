(() => {
  'use strict';
  const B = window.BABYLON;
  if (!B?.Scene?.prototype?.createDefaultXRExperienceAsync) return;

  function activateBlockers(scene) {
    let count = 0;
    for (const mesh of scene?.meshes || []) {
      if (!mesh?.metadata?.xrUnderStairBlocker) continue;
      mesh.isPickable = true;
      mesh.isVisible = true;
      mesh.visibility = 0.001;
      mesh.checkCollisions = true;
      mesh.alwaysSelectAsActiveMesh = true;
      count += 1;
    }
    window.__UCAN_UNDER_STAIR_BLOCKERS__ = {
      version: 'V275',
      active: count > 0,
      count,
      pickableForCollisionRays: true,
      visibleToUser: false
    };
    return count;
  }

  const original = B.Scene.prototype.createDefaultXRExperienceAsync;
  if (original.__ucanV275BlockerPickability) return;
  async function patched(options = {}) {
    const helper = await original.call(this, options);
    activateBlockers(this);
    this.onNewMeshAddedObservable?.add(mesh => {
      if (!mesh?.metadata?.xrUnderStairBlocker) return;
      mesh.isPickable = true;
      mesh.isVisible = true;
      mesh.visibility = 0.001;
      mesh.checkCollisions = true;
      mesh.alwaysSelectAsActiveMesh = true;
    });
    return helper;
  }
  patched.__ucanV275BlockerPickability = true;
  patched.__ucanOriginal = original;
  B.Scene.prototype.createDefaultXRExperienceAsync = patched;
  console.info('[UCAN V275] Bloqueos inferiores habilitados para los rayos de colisión.');
})();
