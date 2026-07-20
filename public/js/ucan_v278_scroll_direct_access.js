(() => {
  'use strict';

  const VERSION = 'V278';
  const BUILD = 'V278-20260720-SCROLL-DIRECT-AVATAR-ACCESS';
  const $ = id => document.getElementById(id);
  const state = { installed:false, completionGuardApplied:false, activeScroller:null, gamepadFrame:0 };

  function visible(element) {
    if (!element || !element.isConnected) return false;
    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0 && element.getClientRects().length > 0;
  }

  function injectStyles() {
    if ($('ucanV278ScrollStyles')) return;
    const style = document.createElement('style');
    style.id = 'ucanV278ScrollStyles';
    style.textContent = `
      .ucan-v278-scrollable{
        overflow-y:auto!important;
        overflow-x:hidden!important;
        scrollbar-width:auto!important;
        scrollbar-color:#fed141 #173b35!important;
        scrollbar-gutter:stable both-edges;
        overscroll-behavior:contain;
        touch-action:pan-y;
        -webkit-overflow-scrolling:touch;
      }
      .ucan-v278-scrollable::-webkit-scrollbar{width:16px;height:16px}
      .ucan-v278-scrollable::-webkit-scrollbar-track{background:#173b35;border-radius:999px;border:3px solid rgba(255,255,255,.9)}
      .ucan-v278-scrollable::-webkit-scrollbar-thumb{background:#fed141;border:3px solid #173b35;border-radius:999px;min-height:48px}
      .ucan-v278-scrollable::-webkit-scrollbar-thumb:hover{background:#ffe36f}
      .ucan-v278-scroll-controls{display:flex;align-items:center;gap:7px;margin-left:auto}
      .ucan-v278-scroll-controls button{min-width:44px!important;padding:7px 10px!important;border-radius:10px!important;background:#fed141!important;color:#10231f!important;border:1px solid rgba(255,255,255,.65)!important;font-weight:950!important;line-height:1!important;cursor:pointer!important}
      .ucan-v278-scroll-controls button:focus-visible{outline:3px solid #fff;outline-offset:2px}
      .ucan-v278-scroll-hint{position:sticky;bottom:0;z-index:5;margin:8px 12px 10px;padding:8px 11px;border-radius:10px;background:rgba(5,38,34,.92);color:#effffb;font-size:11px;text-align:center;border:1px solid rgba(255,255,255,.2);box-shadow:0 8px 22px rgba(0,0,0,.25)}
      #ucanProfileModal .ucan-profile-card{max-height:94dvh!important}
      #boardPanel .board-card{max-height:94dvh!important}
      #livePanelViewer .live-panel-card{max-height:94dvh!important}
      #ucanSkyExplorer{max-height:92dvh!important}
      @media(max-width:850px){.ucan-v278-scroll-controls button{min-width:48px!important;min-height:42px!important}.ucan-v278-scroll-hint{font-size:12px}}
    `;
    document.head.appendChild(style);
  }

  function scrollTarget(kind) {
    if (kind === 'profile') return document.querySelector('#ucanProfileModal .ucan-profile-card');
    if (kind === 'board') return document.querySelector('#boardPanel .board-card');
    if (kind === 'live') return document.querySelector('#livePanelViewer .live-panel-stage') || document.querySelector('#livePanelViewer .live-panel-card');
    if (kind === 'sky') return $('ucanSkyExplorer');
    return null;
  }

  function scrollByPage(target, direction) {
    if (!target) return;
    const amount = Math.max(260, target.clientHeight * 0.76) * direction;
    target.scrollBy({ top:amount, behavior:'smooth' });
    target.focus({ preventScroll:true });
    state.activeScroller = target;
  }

  function addControls(header, target, kind) {
    if (!header || !target || header.querySelector(`[data-ucan-scroll-controls="${kind}"]`)) return;
    target.classList.add('ucan-v278-scrollable');
    target.tabIndex = target.tabIndex >= 0 ? target.tabIndex : 0;
    target.dataset.ucanScrollKind = kind;

    const controls = document.createElement('div');
    controls.className = 'ucan-v278-scroll-controls';
    controls.dataset.ucanScrollControls = kind;
    controls.innerHTML = `<button type="button" data-direction="-1" aria-label="Subir en la información">↑ Subir</button><button type="button" data-direction="1" aria-label="Bajar en la información">↓ Bajar</button>`;
    controls.addEventListener('click', event => {
      const button = event.target.closest('button[data-direction]');
      if (!button) return;
      event.preventDefault();
      event.stopPropagation();
      scrollByPage(target, Number(button.dataset.direction));
    });
    header.appendChild(controls);

    if (!target.querySelector(`.ucan-v278-scroll-hint[data-kind="${kind}"]`)) {
      const hint = document.createElement('div');
      hint.className = 'ucan-v278-scroll-hint';
      hint.dataset.kind = kind;
      hint.textContent = 'Use la barra lateral, los botones Subir/Bajar, la rueda, el toque o el joystick derecho para recorrer toda la información.';
      target.appendChild(hint);
    }
  }

  function installScrollers() {
    addControls(document.querySelector('#ucanProfileModal .ucan-profile-head'), scrollTarget('profile'), 'profile');
    addControls(document.querySelector('#boardPanel .board-head'), scrollTarget('board'), 'board');
    addControls(document.querySelector('#livePanelViewer .live-panel-head'), scrollTarget('live'), 'live');
    addControls(document.querySelector('#ucanSkyExplorer header'), scrollTarget('sky'), 'sky');
  }

  function activeOpenScroller() {
    const candidates = [
      ['profile', $('ucanProfileModal')],
      ['board', $('boardPanel')],
      ['live', $('livePanelViewer')],
      ['sky', $('ucanSkyExplorer')]
    ];
    for (const [kind, overlay] of candidates) {
      if (!visible(overlay)) continue;
      const target = scrollTarget(kind);
      if (target) return target;
    }
    return null;
  }

  function gamepadScrollLoop() {
    const target = activeOpenScroller();
    if (target && navigator.getGamepads) {
      const pads = Array.from(navigator.getGamepads()).filter(Boolean);
      let vertical = 0;
      for (const pad of pads) {
        const axes = Array.from(pad.axes || []);
        if (axes.length < 2) continue;
        const index = axes.length >= 4 ? axes.length - 1 : 1;
        const value = Number(axes[index] || 0);
        if (Math.abs(value) > Math.abs(vertical)) vertical = value;
      }
      if (Math.abs(vertical) > 0.34) {
        target.scrollTop += vertical * 19;
        state.activeScroller = target;
      }
    }
    state.gamepadFrame = requestAnimationFrame(gamepadScrollLoop);
  }

  function cleanEntryParameters() {
    const params = new URLSearchParams(location.search);
    if (!params.has('password') && !params.has('avatar')) return;
    params.delete('password');
    params.delete('avatar');
    const clean = `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`;
    history.replaceState({}, document.title, clean);
  }

  function applyDirectAvatarAccess() {
    if (state.completionGuardApplied) return;
    const identity = window.__UCAN_IDENTITY__;
    const user = identity?.getUser?.();
    if (!user) return;

    const avatarComplete = user.avatarConfigured === true || Boolean(user.avatarConfiguredAt);
    if (!avatarComplete) return;

    state.completionGuardApplied = true;
    user.avatarConfigured = true;
    user.forcePasswordChange = false;
    localStorage.setItem(`ucan-avatar-complete:${user.id}`, user.avatarConfiguredAt || new Date().toISOString());
    localStorage.setItem(`ucan-password-gate-bypassed:${user.id}`, new Date().toISOString());
    cleanEntryParameters();

    const required = $('ucanRequiredMessage');
    if (required) required.style.display = 'none';
    const modal = $('ucanProfileModal');
    if (modal?.classList.contains('open')) {
      setTimeout(() => {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        $('renderCanvas')?.focus?.({ preventScroll:true });
      }, 220);
    }
    window.__UCAN_API__?.setStatus?.('Avatar reconocido. Acceso directo al entorno habilitado; el cambio de contraseña queda disponible de forma voluntaria en Seguridad.');
  }

  function install() {
    if (state.installed) return;
    state.installed = true;
    injectStyles();
    installScrollers();
    const observer = new MutationObserver(() => {
      installScrollers();
      applyDirectAvatarAccess();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
    window.addEventListener('keydown', event => {
      const target = activeOpenScroller();
      if (!target) return;
      if (event.key === 'PageDown') { event.preventDefault(); scrollByPage(target, 1); }
      if (event.key === 'PageUp') { event.preventDefault(); scrollByPage(target, -1); }
      if (event.key === 'Home' && event.ctrlKey) { event.preventDefault(); target.scrollTo({ top:0, behavior:'smooth' }); }
      if (event.key === 'End' && event.ctrlKey) { event.preventDefault(); target.scrollTo({ top:target.scrollHeight, behavior:'smooth' }); }
    });
    applyDirectAvatarAccess();
    gamepadScrollLoop();
    window.__UCAN_SCROLL_ACCESS__ = {
      version:VERSION,
      build:BUILD,
      installed:true,
      visibleScrollbar:true,
      upDownButtons:true,
      gamepadScrolling:true,
      touchScrolling:true,
      directAccessWhenAvatarConfigured:true,
      getState:() => ({ completionGuardApplied:state.completionGuardApplied, activeScroller:state.activeScroller?.dataset?.ucanScrollKind || null })
    };
    console.info('[UCAN V278] Barras de desplazamiento y acceso directo por avatar instalados.');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
