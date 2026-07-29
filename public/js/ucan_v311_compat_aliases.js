(() => {
  'use strict';

  function unifiedState() {
    return window.__UCAN_UNIFIED_WORLD_V311__?.getState?.() || window.__UCAN_UNIFIED_WORLD_V311__ || null;
  }

  function installAliases() {
    const current = unifiedState();
    if (!current?.installed) return false;

    window.__UCAN_PRESENCE_XR_V307__ = {
      version:'V311',
      installed:true,
      strategy:'one-scene-one-world',
      legacyCompatibilityOnly:true,
      browserToVrVisibility:true,
      vrToBrowserVisibility:true,
      sameAccountMultipleDevices:true,
      getState:() => {
        const state = unifiedState() || {};
        return {
          installed:Boolean(state.installed),
          clientId:window.__UCAN_UNIFIED_WORLD_V311__?.clientId || null,
          device:state.device,
          inXR:state.inXR,
          remoteAvatars:state.remoteAvatars,
          participants:Array.isArray(state.participants) ? state.participants : [],
          lastPose:window.__UCAN_UNIFIED_WORLD_V311__?.lastPose || null,
          failures:state.failures,
          lastError:state.lastError
        };
      }
    };

    window.__UCAN_CROSS_ENV_V308__ = {
      version:'V311',
      installed:true,
      sharedSceneInstance:true,
      browserToVr:true,
      vrToBrowser:true,
      legacyCompatibilityOnly:true,
      getState:() => {
        const state = unifiedState() || {};
        return {
          installed:Boolean(state.installed),
          sharedSceneInstance:true,
          device:state.device,
          inXR:state.inXR,
          remoteAvatars:state.remoteAvatars,
          eventsSent:state.eventsSent,
          eventsReceived:state.eventsReceived,
          lastError:state.lastError
        };
      }
    };

    window.__UCAN_V311_COMPAT_ALIASES__ = {
      installed:true,
      source:'V311',
      legacyClientsLoaded:false,
      diagnosticsMapped:true
    };
    return true;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (installAliases() || attempts >= 600) window.clearInterval(timer);
  }, 100);
})();
