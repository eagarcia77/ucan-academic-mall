(() => {
  'use strict';

  const ROOMS = ['SV-201','SV-202','SV-203','SV-204','SV-205','ANF-301'];
  const ROOM_LABELS = {
    'SV-201':'Sala Virtual 201', 'SV-202':'Sala Virtual 202', 'SV-203':'Sala Virtual 203',
    'SV-204':'Sala Virtual 204', 'SV-205':'Sala Virtual 205', 'ANF-301':'Anfiteatro 301'
  };
  const GO_TO_ROOM = { class201:'SV-201', class202:'SV-202', class203:'SV-203', class204:'SV-204', class205:'SV-205', theater:'ANF-301' };
  const ROOM_BOUNDS = {
    'SV-201': { minX:-72, maxX:-40, minY:7.2, maxY:14.8, minZ:-24, maxZ:15 },
    'SV-202': { minX:-42, maxX:-14, minY:7.2, maxY:14.8, minZ:-51, maxZ:-18 },
    'SV-203': { minX:-14, maxX:14, minY:7.2, maxY:14.8, minZ:-51, maxZ:-18 },
    'SV-204': { minX:14, maxX:42, minY:7.2, maxY:14.8, minZ:-51, maxZ:-18 },
    'SV-205': { minX:40, maxX:72, minY:7.2, maxY:14.8, minZ:-24, maxZ:15 },
    'ANF-301': { minX:-52, maxX:52, minY:14.7, maxY:24.8, minZ:-39, maxZ:44 }
  };

  const clientId = getClientId();
  const peers = new Map();
  const participants = new Map();
  const remoteAudios = new Map();
  const personalVolumes = new Map();

  let localStream = null;
  let eventSource = null;
  let heartbeatTimer = null;
  let roomCountTimer = null;
  let roomDetectionTimer = null;
  let currentRoom = '';
  let selectedRoom = 'SV-201';
  let detectedRoom = '';
  let roomCandidate = '';
  let roomCandidateSince = 0;
  let joined = false;
  let microphoneMuted = false;
  let listeningMuted = false;
  let rtcConfig = { iceServers:[] };
  let rtcConfigLoaded = false;
  let roomLimit = 12;
  let closing = false;
  let switchingRoom = false;
  let followLocation = localStorage.getItem('ucanVoiceFollowLocation') !== 'false';

  function getClientId() {
    const existing = sessionStorage.getItem('ucanVoiceClientId');
    if (existing) return existing;
    const id = globalThis.crypto?.randomUUID?.().replace(/-/g,'_') || `voice_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem('ucanVoiceClientId', id);
    return id;
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once:true });
    else fn();
  }

  function injectVoiceStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #voicePanel{position:fixed;right:16px;bottom:16px;z-index:44;width:min(390px,calc(100vw - 32px));display:none;background:rgba(6,16,18,.96);color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:18px;box-shadow:0 24px 75px rgba(0,0,0,.5);backdrop-filter:blur(16px);overflow:hidden}
      #voicePanel.open{display:block}.voice-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;background:linear-gradient(120deg,#007b5f,#0b5446)}.voice-head h2{margin:0;font-size:17px}.voice-close{min-width:38px;padding:6px;background:#fff;color:#17302b}
      .voice-body{padding:13px}.voice-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.voice-field{margin-bottom:9px}.voice-field label{display:block;font-size:11px;font-weight:800;margin-bottom:4px;color:#cdebe4}.voice-field input,.voice-field select,.voice-field input[type=range]{width:100%;background:#fff;color:#14211e;border:1px solid #b9c8c1}.voice-check{display:flex;align-items:center;gap:8px;font-size:11px;color:#cdebe4;margin:5px 0 9px}.voice-check input{width:auto}
      .voice-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:8px}.voice-actions button{padding:8px}.voice-actions .wide{grid-column:1/-1}.voice-connected{background:#fed141;color:#111}.voice-danger{background:#5a2525;color:#fff}.voice-status{margin:9px 0 7px;padding:8px;border-radius:9px;background:rgba(255,255,255,.08);font-size:12px;line-height:1.4}.voice-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:#a9b2af}.voice-dot.live{background:#28d17c;box-shadow:0 0 10px rgba(40,209,124,.8)}.voice-dot.warn{background:#fed141}.voice-dot.error{background:#ef5f5f}
      .voice-participants{margin-top:8px;max-height:190px;overflow:auto;border:1px solid rgba(255,255,255,.13);border-radius:10px}.voice-person{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 9px;align-items:center;padding:8px 9px;border-bottom:1px solid rgba(255,255,255,.09);font-size:12px}.voice-person:last-child{border-bottom:0}.voice-person-state{color:#a9dcd2;font-size:10px;text-align:right}.voice-person-volume{grid-column:1/-1;width:100%;height:5px}.voice-note{font-size:10px;line-height:1.35;color:#b9d8d2;margin-top:9px}.voice-level{height:5px;background:rgba(255,255,255,.12);border-radius:10px;overflow:hidden;margin-top:5px}.voice-level span{display:block;height:100%;width:0;background:#fed141;transition:width .08s linear}
      #voiceHudBtn[data-live="true"],#roomVoiceDock[data-live="true"] .room-voice-main{background:#28d17c;color:#07110f}.voice-count{font-size:10px;opacity:.82}#voiceAudioSink{display:none}
      #roomVoiceDock{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:23;display:none;align-items:center;gap:8px;max-width:min(760px,calc(100vw - 24px));padding:9px 10px;border-radius:16px;background:rgba(6,16,18,.92);border:1px solid rgba(255,255,255,.2);box-shadow:0 16px 55px rgba(0,0,0,.42);backdrop-filter:blur(14px)}
      #roomVoiceDock.visible{display:flex}.room-voice-info{min-width:150px}.room-voice-title{font-size:12px;font-weight:900;color:#fff}.room-voice-sub{font-size:10px;color:#b9d8d2}.room-voice-main,.room-voice-small{padding:8px 10px;border-radius:10px}.room-voice-small{background:#173033;color:#e7fffb;border:1px solid rgba(255,255,255,.16)}.room-voice-small:disabled{opacity:.5}.room-voice-main{background:#fed141;color:#111}
      @media(max-width:820px){#voicePanel{right:8px;bottom:112px;width:min(360px,calc(100vw - 16px));max-height:72vh;overflow:auto}#roomVoiceDock{bottom:8px;flex-wrap:wrap;justify-content:center}.room-voice-info{width:100%;text-align:center}}
    `;
    document.head.appendChild(style);
  }

  function addVoiceHudButton() {
    const hud = document.getElementById('hud');
    const status = document.getElementById('status');
    if (!hud || document.getElementById('voiceHudBtn')) return;
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = '<button id="voiceHudBtn" class="secondary">🎙 Audio de salas <span id="voiceHudCount" class="voice-count"></span></button><button id="voiceQuickMute" class="secondary" disabled>Micrófono</button>';
    hud.insertBefore(row, status || null);
    document.getElementById('voiceHudBtn')?.addEventListener('click', () => toggleVoicePanel());
    document.getElementById('voiceQuickMute')?.addEventListener('click', toggleMicrophone);
  }

  function createVoicePanel() {
    const panel = document.createElement('section');
    panel.id = 'voicePanel';
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-labelledby','voiceTitle');
    const savedName = localStorage.getItem('ucanVoiceName') || `Participante ${clientId.slice(-4)}`;
    panel.innerHTML = `
      <div class="voice-head"><h2 id="voiceTitle">Audio individual por sala</h2><button id="voiceClose" class="voice-close" aria-label="Cerrar">×</button></div>
      <div class="voice-body">
        <div class="voice-field"><label for="voiceName">Nombre visible</label><input id="voiceName" maxlength="40" value="${escapeAttr(savedName)}"></div>
        <div class="voice-field"><label for="voiceRoom">Sala de conversación</label><select id="voiceRoom">${ROOMS.map(room=>`<option value="${room}">${ROOM_LABELS[room]}</option>`).join('')}</select></div>
        <label class="voice-check"><input id="voiceFollowRoom" type="checkbox" ${followLocation?'checked':''}> Cambiar automáticamente el audio cuando entro a otra sala</label>
        <div class="voice-grid">
          <div class="voice-field"><label for="voiceVolume">Volumen general</label><input id="voiceVolume" type="range" min="0" max="100" value="100"></div>
          <div class="voice-field"><label>Nivel del micrófono</label><div class="voice-level"><span id="voiceLevelBar"></span></div></div>
        </div>
        <div class="voice-actions">
          <button id="voiceJoin" class="voice-connected wide">Entrar al audio</button>
          <button id="voiceMic" class="secondary" disabled>🎙 Micrófono activo</button>
          <button id="voiceListen" class="secondary" disabled>🔊 Escuchar activo</button>
          <button id="voiceLeave" class="voice-danger wide" disabled>Salir del audio</button>
        </div>
        <div id="voiceStatus" class="voice-status"><span class="voice-dot"></span><span id="voiceStatusText">Entre a una sala virtual o seleccione una sala.</span></div>
        <div id="voiceParticipants" class="voice-participants"><div class="voice-person"><span>Sin conexión</span><span class="voice-person-state">0 participantes</span></div></div>
        <div class="voice-note">Cada sala virtual y el anfiteatro tienen una conversación independiente. Solo escuchará a quienes estén conectados al mismo espacio. En Internet y Meta Quest debe utilizar HTTPS.</div>
      </div>`;
    document.body.appendChild(panel);
    const sink = document.createElement('div'); sink.id = 'voiceAudioSink'; document.body.appendChild(sink);

    document.getElementById('voiceClose')?.addEventListener('click', () => panel.classList.remove('open'));
    document.getElementById('voiceJoin')?.addEventListener('click', () => connectToRoom(document.getElementById('voiceRoom')?.value || selectedRoom));
    document.getElementById('voiceLeave')?.addEventListener('click', () => leaveVoiceRoom(true));
    document.getElementById('voiceMic')?.addEventListener('click', toggleMicrophone);
    document.getElementById('voiceListen')?.addEventListener('click', toggleListening);
    document.getElementById('voiceVolume')?.addEventListener('input', applyRemoteVolume);
    document.getElementById('voiceName')?.addEventListener('change', event => localStorage.setItem('ucanVoiceName', event.target.value.trim().slice(0,40)));
    document.getElementById('voiceRoom')?.addEventListener('change', event => selectRoom(event.target.value, false));
    document.getElementById('voiceFollowRoom')?.addEventListener('change', event => {
      followLocation = Boolean(event.target.checked);
      localStorage.setItem('ucanVoiceFollowLocation', String(followLocation));
      updateAllUI();
    });
  }

  function createRoomVoiceDock() {
    const dock = document.createElement('section');
    dock.id = 'roomVoiceDock';
    dock.setAttribute('aria-label','Controles de audio de la sala actual');
    dock.innerHTML = `
      <div class="room-voice-info"><div id="roomVoiceTitle" class="room-voice-title">Audio de sala</div><div id="roomVoiceSub" class="room-voice-sub">Fuera de una sala con audio</div></div>
      <button id="roomVoiceMain" class="room-voice-main">Entrar al audio</button>
      <button id="roomVoiceMic" class="room-voice-small" disabled>🎙 Mic</button>
      <button id="roomVoiceListen" class="room-voice-small" disabled>🔊 Escuchar</button>
      <button id="roomVoiceMore" class="room-voice-small">Más</button>`;
    document.body.appendChild(dock);
    document.getElementById('roomVoiceMain')?.addEventListener('click', () => {
      const room = detectedRoom || selectedRoom;
      if (!room) return;
      if (joined && currentRoom === room) leaveVoiceRoom(true);
      else connectToRoom(room);
    });
    document.getElementById('roomVoiceMic')?.addEventListener('click', toggleMicrophone);
    document.getElementById('roomVoiceListen')?.addEventListener('click', toggleListening);
    document.getElementById('roomVoiceMore')?.addEventListener('click', () => toggleVoicePanel(true));
  }

  function escapeAttr(value) {
    return String(value || '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function toggleVoicePanel(forceOpen = null) {
    const panel = document.getElementById('voicePanel');
    if (!panel) return;
    if (forceOpen === true) panel.classList.add('open');
    else if (forceOpen === false) panel.classList.remove('open');
    else panel.classList.toggle('open');
  }

  function setVoiceStatus(message, state = '') {
    const text = document.getElementById('voiceStatusText');
    const dot = document.querySelector('#voiceStatus .voice-dot');
    if (text) text.textContent = message;
    if (dot) dot.className = `voice-dot ${state}`.trim();
  }

  function selectRoom(room, openPanel = false) {
    if (!ROOMS.includes(room)) return false;
    selectedRoom = room;
    const select = document.getElementById('voiceRoom');
    if (select) select.value = room;
    if (openPanel) toggleVoicePanel(true);
    updateAllUI();
    return true;
  }

  function updateAllUI() {
    const room = selectedRoom || detectedRoom || 'SV-201';
    const join = document.getElementById('voiceJoin');
    const leave = document.getElementById('voiceLeave');
    const mic = document.getElementById('voiceMic');
    const listen = document.getElementById('voiceListen');
    const quick = document.getElementById('voiceQuickMute');
    const hud = document.getElementById('voiceHudBtn');
    const dock = document.getElementById('roomVoiceDock');
    const dockTitle = document.getElementById('roomVoiceTitle');
    const dockSub = document.getElementById('roomVoiceSub');
    const dockMain = document.getElementById('roomVoiceMain');
    const dockMic = document.getElementById('roomVoiceMic');
    const dockListen = document.getElementById('roomVoiceListen');

    if (join) {
      join.disabled = switchingRoom;
      join.textContent = joined ? (room === currentRoom ? `Conectado a ${currentRoom}` : `Cambiar a ${room}`) : `Entrar a ${room}`;
    }
    if (leave) leave.disabled = !joined || switchingRoom;
    if (mic) { mic.disabled = !joined; mic.textContent = microphoneMuted ? '🔇 Micrófono silenciado' : '🎙 Micrófono activo'; }
    if (listen) { listen.disabled = !joined; listen.textContent = listeningMuted ? '🔇 Escucha silenciada' : '🔊 Escuchar activo'; }
    if (quick) { quick.disabled = !joined; quick.textContent = microphoneMuted ? 'Activar el micrófono' : 'Silenciar el micrófono'; }
    if (hud) hud.dataset.live = joined ? 'true' : 'false';

    if (dock) {
      dock.classList.toggle('visible', Boolean(detectedRoom));
      dock.dataset.live = joined && currentRoom === detectedRoom ? 'true' : 'false';
    }
    if (dockTitle) dockTitle.textContent = detectedRoom ? `Audio · ${ROOM_LABELS[detectedRoom]}` : 'Audio de sala';
    if (dockSub) {
      if (!detectedRoom) dockSub.textContent = 'Fuera de una sala con audio';
      else if (joined && currentRoom === detectedRoom) dockSub.textContent = `${participants.size} participante${participants.size===1?'':'s'} · conversación independiente`;
      else if (joined) dockSub.textContent = `Conectado a ${currentRoom}; puede cambiar a ${detectedRoom}`;
      else dockSub.textContent = 'Micrófono y escucha disponibles para esta sala';
    }
    if (dockMain) {
      dockMain.disabled = !detectedRoom || switchingRoom;
      dockMain.textContent = joined && currentRoom === detectedRoom ? 'Salir del audio' : joined ? `Cambiar a ${detectedRoom || room}` : 'Activar audio de esta sala';
    }
    if (dockMic) { dockMic.disabled = !joined || currentRoom !== detectedRoom; dockMic.textContent = microphoneMuted ? '🔇 Mic' : '🎙 Mic'; }
    if (dockListen) { dockListen.disabled = !joined || currentRoom !== detectedRoom; dockListen.textContent = listeningMuted ? '🔇 Escucha' : '🔊 Escucha'; }
  }

  async function loadRtcConfig() {
    if (rtcConfigLoaded) return;
    const response = await fetch('/api/voice/config', { cache:'no-store' });
    if (!response.ok) throw new Error('No se pudo obtener la configuración de audio.');
    const data = await response.json();
    rtcConfig = { iceServers:Array.isArray(data.iceServers) ? data.iceServers : [] };
    roomLimit = Number(data.roomLimit || 12);
    rtcConfigLoaded = true;
  }

  async function ensureMicrophone() {
    const activeTrack = localStream?.getAudioTracks?.().find(track => track.readyState === 'live');
    if (activeTrack) return localStream;
    setVoiceStatus('Solicitando permiso para usar el micrófono…', 'warn');
    localStream = await navigator.mediaDevices.getUserMedia({
      audio:{ echoCancellation:true, noiseSuppression:true, autoGainControl:true, channelCount:1 },
      video:false
    });
    microphoneMuted = false;
    setupMicrophoneMeter(localStream);
    return localStream;
  }

  async function connectToRoom(room = selectedRoom) {
    if (!ROOMS.includes(room)) return;
    selectRoom(room, false);
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) {
      setVoiceStatus('El audio requiere HTTPS o localhost y un navegador compatible con WebRTC.', 'error');
      toggleVoicePanel(true);
      return;
    }
    if (joined && currentRoom === room) {
      setVoiceStatus(`Ya está conectado a ${ROOM_LABELS[room]}.`, 'live');
      return;
    }

    const nameInput = document.getElementById('voiceName');
    const name = (nameInput?.value || `Participante ${clientId.slice(-4)}`).trim().slice(0,40) || 'Participante';
    localStorage.setItem('ucanVoiceName', name);
    switchingRoom = true;
    updateAllUI();

    try {
      closing = false;
      await loadRtcConfig();
      await ensureMicrophone();
      if (joined) await disconnectCurrentRoom(false, false);

      setVoiceStatus(`Entrando a ${ROOM_LABELS[room]}…`, 'warn');
      const response = await fetch('/api/voice/join', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ clientId, room, name })
      });
      const data = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(data.error || `No se pudo entrar a ${room}.`);

      currentRoom = room;
      joined = true;
      selectedRoom = room;
      participants.clear();
      participants.set(clientId, { id:clientId, name, room, self:true, state:'connected' });
      for (const peer of data.participants || []) participants.set(peer.id, { ...peer, state:'connecting' });
      openEventStream();
      startHeartbeat();
      for (const peer of data.participants || []) { ensurePeer(peer.id, peer.name); maybeInitiate(peer.id); }
      setVoiceStatus(`Micrófono y escucha activos en ${ROOM_LABELS[room]}.`, 'live');
      window.__UCAN_API__?.setStatus(`Audio individual activo en ${room}. Solo escucha esta sala.`);
      renderParticipants();
      refreshRoomCounts();
      dispatchVoiceState();
    } catch (error) {
      console.error('[UCAN Voice V265]', error);
      await disconnectCurrentRoom(false, false);
      setVoiceStatus(error.message || 'No se pudo iniciar el audio.', 'error');
      toggleVoicePanel(true);
    } finally {
      switchingRoom = false;
      updateAllUI();
    }
  }

  function openEventStream() {
    eventSource?.close();
    eventSource = new EventSource(`/api/voice/events?clientId=${encodeURIComponent(clientId)}`);
    eventSource.onmessage = event => {
      try { handleVoiceEvent(JSON.parse(event.data)); }
      catch (error) { console.warn('[UCAN Voice V265] Evento inválido', error); }
    };
    eventSource.onerror = () => {
      if (joined && !closing) setVoiceStatus(`Reconectando la señal de ${currentRoom}…`, 'warn');
    };
  }

  async function handleVoiceEvent(message) {
    if (!message?.type) return;
    if (message.type === 'connected') {
      setVoiceStatus(`Micrófono y escucha activos en ${ROOM_LABELS[currentRoom]}.`, 'live');
      for (const peer of message.participants || []) {
        participants.set(peer.id, { ...peer, state:peers.get(peer.id)?.pc?.connectionState || 'connecting' });
        ensurePeer(peer.id, peer.name);
        maybeInitiate(peer.id);
      }
      renderParticipants();
    } else if (message.type === 'peer-joined') {
      const peer = message.peer;
      if (!peer || peer.id === clientId) return;
      participants.set(peer.id, { ...peer, state:'connecting' });
      ensurePeer(peer.id, peer.name);
      maybeInitiate(peer.id);
      renderParticipants();
      refreshRoomCounts();
    } else if (message.type === 'peer-left') {
      closePeer(message.peerId);
      participants.delete(message.peerId);
      renderParticipants();
      refreshRoomCounts();
    } else if (message.type === 'signal') {
      await handleSignal(message.from, message.name, message.data);
    }
    updateAllUI();
    dispatchVoiceState();
  }

  function ensurePeer(peerId, peerName = 'Participante') {
    if (!peerId || peerId === clientId) return null;
    if (peers.has(peerId)) return peers.get(peerId);
    const pc = new RTCPeerConnection(rtcConfig);
    const entry = { pc, peerId, peerName, pendingCandidates:[], offerStarted:false };
    peers.set(peerId, entry);
    for (const track of localStream?.getTracks?.() || []) pc.addTrack(track, localStream);
    pc.onicecandidate = event => { if (event.candidate) sendSignal(peerId, { candidate:event.candidate }).catch(()=>{}); };
    pc.ontrack = event => attachRemoteAudio(peerId, peerName, event.streams?.[0] || new MediaStream([event.track]));
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      const person = participants.get(peerId); if (person) person.state = state;
      renderParticipants();
      if (state === 'failed' && clientId.localeCompare(peerId) < 0) restartPeerIce(peerId);
      if (state === 'closed') closePeer(peerId);
    };
    pc.oniceconnectionstatechange = () => {
      const person = participants.get(peerId); if (person) person.state = pc.iceConnectionState;
      renderParticipants();
    };
    return entry;
  }

  async function maybeInitiate(peerId) {
    if (!joined || clientId.localeCompare(peerId) >= 0) return;
    const entry = ensurePeer(peerId, participants.get(peerId)?.name);
    if (!entry || entry.offerStarted || entry.pc.signalingState !== 'stable') return;
    entry.offerStarted = true;
    try {
      const offer = await entry.pc.createOffer();
      await entry.pc.setLocalDescription(offer);
      await sendSignal(peerId, { description:entry.pc.localDescription });
    } catch (error) {
      entry.offerStarted = false;
      console.warn('[UCAN Voice V265] No se pudo crear oferta', error);
    }
  }

  async function handleSignal(from, name, data) {
    if (!joined || !from || !data) return;
    participants.set(from, { ...(participants.get(from) || {}), id:from, name:name || participants.get(from)?.name || 'Participante', room:currentRoom, state:'connecting' });
    const entry = ensurePeer(from, name);
    const pc = entry.pc;
    try {
      if (data.description) {
        const description = data.description;
        if (description.type === 'offer') {
          if (pc.signalingState !== 'stable') await pc.setLocalDescription({ type:'rollback' }).catch(()=>{});
          await pc.setRemoteDescription(description);
          await flushCandidates(entry);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(from, { description:pc.localDescription });
        } else if (description.type === 'answer') {
          await pc.setRemoteDescription(description);
          await flushCandidates(entry);
        }
      } else if (data.candidate) {
        if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(()=>{});
        else entry.pendingCandidates.push(data.candidate);
      }
      renderParticipants();
    } catch (error) {
      console.warn('[UCAN Voice V265] Error procesando señal', error);
    }
  }

  async function flushCandidates(entry) {
    for (const candidate of entry.pendingCandidates.splice(0)) await entry.pc.addIceCandidate(candidate).catch(()=>{});
  }

  async function restartPeerIce(peerId) {
    const entry = peers.get(peerId);
    if (!entry || entry.pc.signalingState !== 'stable') return;
    try {
      const offer = await entry.pc.createOffer({ iceRestart:true });
      await entry.pc.setLocalDescription(offer);
      await sendSignal(peerId, { description:entry.pc.localDescription });
    } catch (error) {
      console.warn('[UCAN Voice V265] No se pudo reiniciar ICE', error);
    }
  }

  async function sendSignal(to, data) {
    if (!joined) return;
    const response = await fetch('/api/voice/signal', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ from:clientId, to, data })
    });
    if (!response.ok) throw new Error(`Falló señalización con ${to}.`);
  }

  function attachRemoteAudio(peerId, peerName, stream) {
    let audio = remoteAudios.get(peerId);
    if (!audio) {
      audio = document.createElement('audio');
      audio.autoplay = true;
      audio.playsInline = true;
      audio.dataset.peerId = peerId;
      audio.setAttribute('aria-label',`Audio de ${peerName}`);
      document.getElementById('voiceAudioSink')?.appendChild(audio);
      remoteAudios.set(peerId, audio);
    }
    audio.srcObject = stream;
    audio.muted = listeningMuted;
    applyRemoteVolume();
    audio.play().catch(() => setVoiceStatus('Pulse “Escuchar activo” para autorizar el sonido del navegador.', 'warn'));
  }

  function closePeer(peerId) {
    const entry = peers.get(peerId);
    if (entry) {
      peers.delete(peerId);
      try { entry.pc.close(); } catch {}
    }
    const audio = remoteAudios.get(peerId);
    if (audio) {
      try { audio.pause(); audio.srcObject = null; audio.remove(); } catch {}
      remoteAudios.delete(peerId);
    }
    personalVolumes.delete(peerId);
  }

  function closeAllPeers() {
    for (const id of [...peers.keys()]) closePeer(id);
  }

  function toggleMicrophone() {
    if (!localStream || !joined) return;
    microphoneMuted = !microphoneMuted;
    for (const track of localStream.getAudioTracks()) track.enabled = !microphoneMuted;
    setVoiceStatus(microphoneMuted ? `Micrófono silenciado en ${currentRoom}.` : `Micrófono activo en ${currentRoom}.`, microphoneMuted ? 'warn' : 'live');
    renderParticipants();
    updateAllUI();
    dispatchVoiceState();
  }

  function toggleListening() {
    if (!joined) return;
    listeningMuted = !listeningMuted;
    for (const audio of remoteAudios.values()) {
      audio.muted = listeningMuted;
      if (!listeningMuted) audio.play().catch(()=>{});
    }
    setVoiceStatus(listeningMuted ? `Escucha silenciada en ${currentRoom}.` : `Escuchando toda la conversación de ${currentRoom}.`, listeningMuted ? 'warn' : 'live');
    updateAllUI();
    dispatchVoiceState();
  }

  function applyRemoteVolume() {
    const globalVolume = Number(document.getElementById('voiceVolume')?.value || 100) / 100;
    for (const [peerId, audio] of remoteAudios) {
      const personal = Number(personalVolumes.get(peerId) ?? 1);
      audio.volume = Math.max(0, Math.min(1, globalVolume * personal));
    }
  }

  async function disconnectCurrentRoom(stopTracks = false, showMessage = true) {
    closing = true;
    if (joined) {
      try {
        await fetch('/api/voice/leave', {
          method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ clientId }), keepalive:true
        });
      } catch {}
    }
    joined = false;
    currentRoom = '';
    eventSource?.close();
    eventSource = null;
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    closeAllPeers();
    participants.clear();
    if (stopTracks && localStream) {
      for (const track of localStream.getTracks()) track.stop();
      localStream = null;
      microphoneMuted = false;
      listeningMuted = false;
    }
    if (showMessage) setVoiceStatus('Fuera del audio. Puede entrar a otra sala.', '');
    renderParticipants();
    updateAllUI();
    refreshRoomCounts();
    dispatchVoiceState();
    closing = false;
  }

  async function leaveVoiceRoom(stopTracks = true) {
    await disconnectCurrentRoom(stopTracks, true);
  }

  function startHeartbeat() {
    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (!joined) return;
      fetch('/api/voice/heartbeat', {
        method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ clientId }), keepalive:true
      }).catch(()=>{});
    }, 20000);
  }

  function setupMicrophoneMeter(stream) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const context = new AudioContextClass();
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const values = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        if (!localStream || localStream !== stream) { context.close().catch(()=>{}); return; }
        analyser.getByteFrequencyData(values);
        const avg = values.reduce((a,b)=>a+b,0) / values.length;
        const bar = document.getElementById('voiceLevelBar');
        if (bar) bar.style.width = `${microphoneMuted ? 0 : Math.min(100, avg * 1.55)}%`;
        requestAnimationFrame(draw);
      };
      context.resume().catch(()=>{});
      draw();
    } catch (error) {
      console.debug('[UCAN Voice V265] Medidor no disponible', error);
    }
  }

  function renderParticipants() {
    const wrap = document.getElementById('voiceParticipants');
    if (!wrap) return;
    wrap.innerHTML = '';
    const values = [...participants.values()];
    if (!values.length) {
      const row = document.createElement('div');
      row.className = 'voice-person';
      row.innerHTML = '<span>Sin conexión</span><span class="voice-person-state">0 participantes</span>';
      wrap.appendChild(row);
      updateAllUI();
      return;
    }
    values.sort((a,b)=>(a.self?-1:b.self?1:String(a.name).localeCompare(String(b.name))));
    for (const person of values) {
      const row = document.createElement('div');
      row.className = 'voice-person';
      const name = document.createElement('span');
      name.textContent = `${person.self ? 'Usted · ' : ''}${person.name || 'Participante'}`;
      const state = document.createElement('span');
      state.className = 'voice-person-state';
      state.textContent = person.self ? (microphoneMuted?'micrófono silenciado':'micrófono activo') : humanConnectionState(person.state);
      row.append(name,state);
      if (!person.self) {
        const volume = document.createElement('input');
        volume.className = 'voice-person-volume';
        volume.type = 'range';
        volume.min = '0';
        volume.max = '100';
        volume.value = String(Math.round((personalVolumes.get(person.id) ?? 1) * 100));
        volume.setAttribute('aria-label',`Volumen de ${person.name || 'participante'}`);
        volume.addEventListener('input', () => {
          personalVolumes.set(person.id, Number(volume.value) / 100);
          applyRemoteVolume();
        });
        row.appendChild(volume);
      }
      wrap.appendChild(row);
    }
    updateAllUI();
  }

  function humanConnectionState(state) {
    const map = {
      connected:'conectado', completed:'conectado', checking:'conectando', connecting:'conectando', new:'conectando',
      disconnected:'interrumpido', failed:'sin conexión', closed:'desconectado'
    };
    return map[state] || 'conectando';
  }

  async function refreshRoomCounts() {
    try {
      const response = await fetch('/api/voice/rooms', { cache:'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      const select = document.getElementById('voiceRoom');
      const selected = select?.value || selectedRoom;
      if (select) {
        for (const option of select.options) {
          const count = Number(data.rooms?.[option.value] || 0);
          option.textContent = `${ROOM_LABELS[option.value]} · ${count}/${data.roomLimit || roomLimit}`;
        }
        select.value = selected;
      }
      const roomForBadge = detectedRoom || currentRoom || selectedRoom;
      const count = Number(data.rooms?.[roomForBadge] || 0);
      const badge = document.getElementById('voiceHudCount');
      if (badge) badge.textContent = count ? `(${count})` : '';
      const dockSub = document.getElementById('roomVoiceSub');
      if (dockSub && detectedRoom && !(joined && currentRoom === detectedRoom)) {
        dockSub.textContent = `${count} conectado${count===1?'':'s'} · conversación independiente`;
      }
    } catch {}
  }

  function roomFromPosition(position) {
    if (!position) return '';
    for (const room of ROOMS) {
      const b = ROOM_BOUNDS[room];
      if (position.x >= b.minX && position.x <= b.maxX && position.y >= b.minY && position.y <= b.maxY && position.z >= b.minZ && position.z <= b.maxZ) return room;
    }
    return '';
  }

  function monitorPhysicalRoom() {
    const camera = window.__UCAN_API__?.getCamera?.();
    const candidate = roomFromPosition(camera?.position);
    if (candidate !== roomCandidate) {
      roomCandidate = candidate;
      roomCandidateSince = performance.now();
      return;
    }
    if (candidate === detectedRoom || performance.now() - roomCandidateSince < 850) return;
    detectedRoom = candidate;
    if (detectedRoom) {
      selectRoom(detectedRoom, false);
      if (joined && currentRoom !== detectedRoom) {
        if (followLocation && !switchingRoom) {
          connectToRoom(detectedRoom);
        } else {
          setVoiceStatus(`Entró a ${detectedRoom}. Puede cambiar el audio desde el control inferior.`, 'warn');
        }
      }
    }
    updateAllUI();
    refreshRoomCounts();
  }

  function syncRoomFromNavigation() {
    document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => {
      const room = GO_TO_ROOM[button.getAttribute('data-go')];
      if (!room) return;
      detectedRoom = room;
      roomCandidate = room;
      roomCandidateSince = performance.now();
      selectRoom(room, false);
      if (joined && currentRoom !== room) {
        if (followLocation) connectToRoom(room);
        else setVoiceStatus(`Está conectado a ${currentRoom}. Pulse “Cambiar a ${room}” para mover el audio.`, 'warn');
      }
    }));
    document.getElementById('boardSelect')?.addEventListener('change', event => {
      if (ROOMS.includes(event.target.value)) selectRoom(event.target.value, false);
    });
  }

  function dispatchVoiceState() {
    const detail = {
      joined, currentRoom, selectedRoom, detectedRoom, microphoneMuted, listeningMuted,
      participants:[...participants.values()]
    };
    window.dispatchEvent(new CustomEvent('ucan:voice-state', { detail }));
  }

  function leaveWithBeacon() {
    if (!joined) return;
    const blob = new Blob([JSON.stringify({ clientId })], { type:'application/json' });
    navigator.sendBeacon?.('/api/voice/leave', blob);
  }

  ready(() => {
    injectVoiceStyles();
    addVoiceHudButton();
    createVoicePanel();
    createRoomVoiceDock();
    syncRoomFromNavigation();
    selectRoom(selectedRoom, false);
    updateAllUI();
    refreshRoomCounts();
    roomCountTimer = setInterval(refreshRoomCounts, 10000);
    roomDetectionTimer = setInterval(monitorPhysicalRoom, 350);
    window.addEventListener('beforeunload', leaveWithBeacon);
    window.__UCAN_VOICE__ = {
      join:connectToRoom,
      joinRoom:connectToRoom,
      leave:leaveVoiceRoom,
      selectRoom,
      openPanel:() => toggleVoicePanel(true),
      toggleMicrophone,
      toggleListening,
      getState:() => ({ joined,currentRoom,selectedRoom,detectedRoom,microphoneMuted,listeningMuted,participants:[...participants.values()] })
    };
  });
})();
