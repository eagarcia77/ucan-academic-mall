(() => {
  'use strict';

  const state = {
    user:null, options:null, localAvatar:null, remote:new Map(), thirdPerson:false,
    preview:{ engine:null, scene:null, avatar:null }, lastPresence:0, lastPoll:0,
    followCamera:null, controllerCamera:null, scene:null, lastPosition:null, startTime:performance.now()
  };

  const $ = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  async function api(url, options={}) {
    const response = await fetch(url, { ...options, headers:{ 'Content-Type':'application/json', ...(options.headers||{}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  }
  function waitForEnvironment() {
    return new Promise((resolve, reject) => {
      const started=Date.now();
      const timer=setInterval(() => {
        if (window.__UCAN_API__?.getScene?.() && window.UCANAvatar) { clearInterval(timer); resolve(); }
        else if (Date.now()-started>20000) { clearInterval(timer); reject(new Error('El entorno 3D no terminó de inicializar.')); }
      },120);
    });
  }
  function injectStyles() {
    const style=document.createElement('style');
    style.textContent=`
      .ucan-user-strip{display:flex;align-items:center;gap:8px;margin:8px 0;padding:8px 9px;border-radius:12px;background:rgba(0,123,95,.18);border:1px solid rgba(210,246,239,.22)}
      .ucan-user-avatar{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:#fed141;color:#17302b;font-weight:950}.ucan-user-meta{min-width:0;flex:1}.ucan-user-meta b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ucan-user-meta span{font-size:10px;color:#bde3df}.ucan-account-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:7px;margin-top:8px}.ucan-account-grid button,.ucan-account-grid a{font-size:12px;text-align:center;text-decoration:none}
      #ucanProfileModal{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(10px)}#ucanProfileModal.open{display:flex}.ucan-profile-card{width:min(1120px,98vw);max-height:96vh;overflow:auto;background:#f5f7f5;color:#14211e;border:3px solid #007b5f;border-radius:22px;box-shadow:0 30px 100px #0009}.ucan-profile-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;background:linear-gradient(120deg,#073b35,#007b5f);color:#fff;padding:13px 16px}.ucan-profile-head h2{margin:0;font-size:20px}.ucan-profile-close{background:#fff;color:#17302b;font-size:22px;min-width:42px}.ucan-profile-body{display:grid;grid-template-columns:minmax(330px,.9fr) minmax(380px,1.1fr);gap:16px;padding:16px}.ucan-profile-section{background:#fff;border:1px solid #d4e1dc;border-radius:15px;padding:15px;margin-bottom:12px}.ucan-profile-section h3{margin:0 0 12px}.ucan-avatar-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ucan-avatar-form label{display:block;font-size:12px;font-weight:850;margin-bottom:4px}.ucan-avatar-form select,.ucan-avatar-form input{width:100%;padding:9px;border:1px solid #b6c8c1;border-radius:9px;background:#fff;color:#14211e}.ucan-accessories{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.ucan-accessories label{display:flex;align-items:center;gap:7px;padding:7px;border:1px solid #d7e2de;border-radius:8px;font-weight:650}.ucan-avatar-stage{position:sticky;top:74px;min-height:590px;background:radial-gradient(circle at 50% 22%,#edf7f3,#cfded8);border-radius:15px;border:1px solid #c5d7d0;overflow:hidden}.ucan-avatar-stage canvas{width:100%;height:590px;display:block}.ucan-profile-actions{display:flex;gap:8px;flex-wrap:wrap}.ucan-profile-actions button{background:#007b5f;color:#fff}.ucan-profile-actions .secondary{background:#e4ece8;color:#17302b}.ucan-profile-message{min-height:22px;font-size:13px;padding-top:8px}.ucan-required{padding:10px;border-left:5px solid #fed141;background:#fff8d7;margin-bottom:12px;border-radius:8px}.ucan-online-panel{position:fixed;right:18px;bottom:18px;z-index:22;width:min(290px,calc(100vw - 36px));display:none;background:rgba(6,16,18,.92);border:1px solid rgba(255,255,255,.18);border-radius:15px;padding:12px;color:#fff;box-shadow:0 18px 55px #0008}.ucan-online-panel.open{display:block}.ucan-online-panel h3{margin:0 0 8px;font-size:15px}.ucan-online-list{display:grid;gap:6px;max-height:260px;overflow:auto}.ucan-online-person{display:flex;justify-content:space-between;gap:8px;padding:7px;border-radius:8px;background:#ffffff0c;font-size:12px}.ucan-online-empty{color:#bde3df;font-size:12px}.ucan-role-admin{color:#fed141}.ucan-live-badge{display:inline-flex;align-items:center;gap:5px}.ucan-live-dot{width:8px;height:8px;background:#69e59d;border-radius:50%;box-shadow:0 0 9px #69e59d}
      @media(max-width:850px){.ucan-profile-body{grid-template-columns:1fr}.ucan-avatar-stage{position:relative;top:auto;min-height:430px}.ucan-avatar-stage canvas{height:430px}.ucan-avatar-form{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }
  function injectInterface() {
    const utility=$('utilityActions');
    const userStrip=document.createElement('div');
    userStrip.className='ucan-user-strip'; userStrip.id='ucanUserStrip';
    userStrip.innerHTML=`<div class="ucan-user-avatar" id="ucanUserInitial">U</div><div class="ucan-user-meta"><b id="ucanDisplayName">Usuario</b><span id="ucanRoleText">Cuenta UCAN</span></div><span class="ucan-live-badge"><span class="ucan-live-dot"></span><span id="ucanOnlineCount">1</span></span>`;
    utility?.before(userStrip);
    if (utility) utility.innerHTML=`<div class="ucan-account-grid"><button id="ucanAvatarBtn" class="secondary">Mi avatar</button><button id="ucanThirdPersonBtn" class="secondary">Vista de avatar</button><button id="ucanOnlineBtn" class="secondary">Usuarios en línea</button><a id="ucanAdminBtn" class="secondary" href="/admin" style="display:none">Administración</a><button id="ucanLogoutBtn" class="secondary">Cerrar sesión</button></div>`;

    const modal=document.createElement('section'); modal.id='ucanProfileModal'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`<div class="ucan-profile-card"><div class="ucan-profile-head"><h2>Perfil y avatar</h2><button id="ucanProfileClose" class="ucan-profile-close" aria-label="Cerrar">×</button></div><div class="ucan-profile-body"><div><div id="ucanRequiredMessage" class="ucan-required" style="display:none">Debe cambiar su contraseña temporal antes de continuar usando la cuenta.</div><section class="ucan-profile-section"><h3>Personalización del avatar</h3><div class="ucan-avatar-form">
      <div><label for="avatarSkin">Tono de piel</label><select id="avatarSkin"></select></div><div><label for="avatarHairStyle">Estilo de cabello</label><select id="avatarHairStyle"></select></div>
      <div><label for="avatarHairColor">Color de cabello</label><select id="avatarHairColor"></select></div><div><label for="avatarTopStyle">Ropa superior</label><select id="avatarTopStyle"></select></div>
      <div><label for="avatarTopColor">Color de ropa superior</label><select id="avatarTopColor"></select></div><div><label for="avatarBottomStyle">Ropa inferior</label><select id="avatarBottomStyle"></select></div>
      <div><label for="avatarBottomColor">Color de ropa inferior</label><select id="avatarBottomColor"></select></div><div><label for="avatarShoeStyle">Tipo de zapatos</label><select id="avatarShoeStyle"></select></div>
      <div><label for="avatarShoeColor">Color de zapatos</label><select id="avatarShoeColor"></select></div></div><h4>Accesorios — máximo 3</h4><div id="avatarAccessories" class="ucan-accessories"></div><div class="ucan-profile-actions" style="margin-top:12px"><button id="ucanSaveAvatar">Guardar avatar</button><button id="ucanResetAvatar" class="secondary">Restablecer diseño</button></div><div id="ucanAvatarMessage" class="ucan-profile-message" aria-live="polite"></div></section>
      <section class="ucan-profile-section"><h3>Información de la cuenta</h3><div class="ucan-avatar-form"><div><label for="ucanProfileName">Nombre mostrado</label><input id="ucanProfileName"></div><div><label for="ucanProfileEmail">Correo electrónico</label><input id="ucanProfileEmail" type="email"></div></div><div class="ucan-profile-actions" style="margin-top:12px"><button id="ucanSaveProfile">Guardar información</button></div></section>
      <section class="ucan-profile-section"><h3>Cambiar contraseña</h3><div class="ucan-avatar-form"><div><label for="ucanCurrentPassword">Contraseña actual</label><input id="ucanCurrentPassword" type="password" autocomplete="current-password"></div><div><label for="ucanNewPassword">Nueva contraseña</label><input id="ucanNewPassword" type="password" minlength="10" autocomplete="new-password"></div><div><label for="ucanConfirmPassword">Confirmar contraseña</label><input id="ucanConfirmPassword" type="password" minlength="10" autocomplete="new-password"></div></div><div class="ucan-profile-actions" style="margin-top:12px"><button id="ucanChangePassword">Actualizar contraseña</button></div><div id="ucanPasswordMessage" class="ucan-profile-message" aria-live="polite"></div></section></div><div class="ucan-avatar-stage"><canvas id="ucanAvatarPreview" aria-label="Vista previa tridimensional del avatar"></canvas></div></div></div>`;
    document.body.appendChild(modal);
    const online=document.createElement('aside'); online.id='ucanOnlinePanel'; online.className='ucan-online-panel'; online.innerHTML='<h3>Participantes conectados</h3><div id="ucanOnlineList" class="ucan-online-list"></div>'; document.body.appendChild(online);
  }
  function optionLabel(value) {
    const map={corto:'Corto',largo:'Largo',rizado:'Rizado',moño:'Moño',rapado:'Rapado','sin-cabello':'Sin cabello',camiseta:'Camiseta',sudadera:'Sudadera',chaqueta:'Chaqueta',formal:'Formal',pantalón:'Pantalón',jeans:'Jeans',falda:'Falda',deportivo:'Deportivo',tenis:'Tenis',zapatos:'Zapatos',botas:'Botas'};
    return map[value] || value;
  }
  function colorLabel(value) { return value.toUpperCase(); }
  function fillSelect(id, values, selected, labels=false) {
    const select=$(id); if(!select)return; select.innerHTML=values.map(value=>`<option value="${escapeHtml(value)}" ${value===selected?'selected':''}>${labels?optionLabel(value):colorLabel(value)}</option>`).join('');
    select.style.background = values.includes(selected) && selected.startsWith('#') ? `linear-gradient(90deg,${selected} 0 34px,#fff 34px)` : '';
  }
  function populateForm(avatar) {
    const opt=state.options.avatarOptions; const cfg=window.UCANAvatar.normalize(avatar);
    fillSelect('avatarSkin',opt.skinTone,cfg.skinTone); fillSelect('avatarHairStyle',opt.hairStyle,cfg.hairStyle,true); fillSelect('avatarHairColor',opt.hairColor,cfg.hairColor); fillSelect('avatarTopStyle',opt.topStyle,cfg.topStyle,true); fillSelect('avatarTopColor',opt.topColor,cfg.topColor); fillSelect('avatarBottomStyle',opt.bottomStyle,cfg.bottomStyle,true); fillSelect('avatarBottomColor',opt.bottomColor,cfg.bottomColor); fillSelect('avatarShoeStyle',opt.shoeStyle,cfg.shoeStyle,true); fillSelect('avatarShoeColor',opt.shoeColor,cfg.shoeColor);
    $('avatarAccessories').innerHTML=opt.accessories.map(value=>`<label><input type="checkbox" value="${escapeHtml(value)}" ${cfg.accessories.includes(value)?'checked':''}> ${escapeHtml(value)}</label>`).join('');
    $('ucanProfileName').value=state.user.displayName;$('ucanProfileEmail').value=state.user.email; updatePreview();
  }
  function currentAvatarForm() {
    const checked=[...document.querySelectorAll('#avatarAccessories input:checked')].map(input=>input.value).slice(0,3);
    return {skinTone:$('avatarSkin').value,hairStyle:$('avatarHairStyle').value,hairColor:$('avatarHairColor').value,topStyle:$('avatarTopStyle').value,topColor:$('avatarTopColor').value,bottomStyle:$('avatarBottomStyle').value,bottomColor:$('avatarBottomColor').value,shoeStyle:$('avatarShoeStyle').value,shoeColor:$('avatarShoeColor').value,accessories:checked};
  }
  function setupPreview() {
    const canvas=$('ucanAvatarPreview'); const engine=new BABYLON.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true}); const scene=new BABYLON.Scene(engine); scene.clearColor=new BABYLON.Color4(.86,.92,.89,1);
    const camera=new BABYLON.ArcRotateCamera('avatarPreviewCamera',-Math.PI/2,Math.PI/2.35,6.2,new BABYLON.Vector3(0,1.45,0),scene);camera.attachControl(canvas,true);camera.lowerRadiusLimit=4.5;camera.upperRadiusLimit=8;
    const hemi=new BABYLON.HemisphericLight('avatarPreviewHemi',new BABYLON.Vector3(0,1,0),scene);hemi.intensity=.95;const light=new BABYLON.DirectionalLight('avatarPreviewKey',new BABYLON.Vector3(-1,-2,1),scene);light.position.set(4,8,-4);light.intensity=.75;
    const ground=BABYLON.MeshBuilder.CreateCylinder('avatarPreviewGround',{height:.15,diameter:4,tessellation:48},scene);ground.position.y=-.1;const mat=new BABYLON.StandardMaterial('avatarPreviewGroundMat',scene);mat.diffuseColor=BABYLON.Color3.FromHexString('#c8d8d2');ground.material=mat;
    state.preview={engine,scene,avatar:null}; engine.runRenderLoop(()=>scene.render()); window.addEventListener('resize',()=>engine.resize());
  }
  function updatePreview() {
    if(!state.preview.scene)return; state.preview.avatar?.dispose?.(); state.preview.avatar=window.UCANAvatar.create(state.preview.scene,currentAvatarForm(),{name:'avatar-preview',label:false,scale:1.05}); state.preview.avatar.root.rotation.y=Math.PI;
  }
  function recreateLocalAvatar() {
    if(!state.scene || !state.controllerCamera)return; const wasVisible=state.thirdPerson; state.localAvatar?.dispose?.(); state.localAvatar=window.UCANAvatar.create(state.scene,state.user.avatar,{name:'avatar-local',userId:state.user.id,displayName:state.user.displayName,role:state.user.role,local:true}); state.localAvatar.root.setEnabled(wasVisible);
    if(state.followCamera)state.followCamera.lockedTarget=state.localAvatar.root;
  }
  function createRemote(participant) {
    const avatar=window.UCANAvatar.create(state.scene,participant.avatar,{name:`avatar-remote-${participant.userId}`,userId:participant.userId,displayName:participant.displayName,role:participant.role,scale:1});
    avatar.root.position.set(participant.position.x,participant.position.y-1.65,participant.position.z);avatar.root.rotation.y=participant.rotationY+Math.PI;
    return {avatar,target:new BABYLON.Vector3(participant.position.x,participant.position.y-1.65,participant.position.z),rotationY:participant.rotationY+Math.PI,hash:JSON.stringify(participant.avatar),lastPosition:avatar.root.position.clone(),lastUpdate:performance.now()};
  }
  function updateRemoteParticipants(participants) {
    const seen=new Set();
    for(const participant of participants){seen.add(participant.userId);let item=state.remote.get(participant.userId);const hash=JSON.stringify(participant.avatar);
      if(!item || item.hash!==hash){item?.avatar?.dispose?.();item=createRemote(participant);state.remote.set(participant.userId,item);} item.target.set(participant.position.x,participant.position.y-1.65,participant.position.z);item.rotationY=participant.rotationY+Math.PI;item.displayName=participant.displayName;item.area=participant.area;
    }
    for(const [id,item] of state.remote)if(!seen.has(id)){item.avatar.dispose();state.remote.delete(id);}
    renderOnlineList(participants);
  }
  function renderOnlineList(participants=[]) {
    $('ucanOnlineCount').textContent=String(participants.length+1); const list=$('ucanOnlineList'); if(!list)return;
    const all=[{displayName:state.user.displayName,role:state.user.role,area:$('currentLocation')?.textContent||'Campus',self:true},...participants];
    list.innerHTML=all.length?all.map(person=>`<div class="ucan-online-person"><span><b class="${person.role==='admin'?'ucan-role-admin':''}">${escapeHtml(person.displayName)}</b>${person.self?' (usted)':''}</span><span>${escapeHtml(person.area||'Campus')}</span></div>`).join(''):'<div class="ucan-online-empty">No hay participantes conectados.</div>';
  }
  function setupSceneAvatar() {
    state.scene=window.__UCAN_API__.getScene();state.controllerCamera=window.__UCAN_API__.getCamera();recreateLocalAvatar();state.localAvatar.root.setEnabled(false);state.lastPosition=state.controllerCamera.position.clone();
    state.scene.onBeforeRenderObservable.add(()=>{
      if(!state.localAvatar)return;const camera=state.controllerCamera;const baseY=camera.position.y-1.65;state.localAvatar.root.position.set(camera.position.x,baseY,camera.position.z);state.localAvatar.root.rotation.y=camera.rotation.y+Math.PI;
      const moved=BABYLON.Vector3.DistanceSquared(camera.position,state.lastPosition)>.0007;state.localAvatar.animate(moved,(performance.now()-state.startTime)/1000);state.lastPosition.copyFrom(camera.position);
      for(const item of state.remote.values()){const previous=item.avatar.root.position.clone();item.avatar.root.position=BABYLON.Vector3.Lerp(item.avatar.root.position,item.target,.16);item.avatar.root.rotation.y+=(item.rotationY-item.avatar.root.rotation.y)*.16;const walking=BABYLON.Vector3.DistanceSquared(previous,item.avatar.root.position)>.00003;item.avatar.animate(walking,(performance.now()-state.startTime)/1000);}
    });
  }
  function toggleThirdPerson() {
    state.thirdPerson=!state.thirdPerson;const button=$('ucanThirdPersonBtn');
    if(state.thirdPerson){state.localAvatar.root.setEnabled(true);if(!state.followCamera){state.followCamera=new BABYLON.FollowCamera('ucanAvatarFollowCamera',state.localAvatar.root.position.add(new BABYLON.Vector3(0,2,-5)),state.scene);state.followCamera.radius=5.3;state.followCamera.heightOffset=2.15;state.followCamera.rotationOffset=180;state.followCamera.cameraAcceleration=.08;state.followCamera.maxCameraSpeed=18;state.followCamera.lockedTarget=state.localAvatar.root;}state.scene.activeCamera=state.followCamera;state.followCamera.attachControl($('renderCanvas'),true);button.textContent='Vista en primera persona';}
    else{state.localAvatar.root.setEnabled(false);state.followCamera?.detachControl();state.scene.activeCamera=state.controllerCamera;state.controllerCamera.attachControl($('renderCanvas'),true);button.textContent='Vista de avatar';}
  }
  function openModal(force=false) {$('ucanProfileModal').classList.add('open');$('ucanProfileModal').setAttribute('aria-hidden','false');$('ucanRequiredMessage').style.display=force?'block':'none';populateForm(state.user.avatar);state.preview.engine?.resize();}
  function closeModal() {if(state.user.forcePasswordChange)return;$('ucanProfileModal').classList.remove('open');$('ucanProfileModal').setAttribute('aria-hidden','true');}
  function bindEvents() {
    $('ucanAvatarBtn').onclick=()=>openModal(false);$('ucanProfileClose').onclick=closeModal;$('ucanThirdPersonBtn').onclick=toggleThirdPerson;$('ucanOnlineBtn').onclick=()=>$('ucanOnlinePanel').classList.toggle('open');$('ucanAdminBtn').style.display=state.user.role==='admin'?'block':'none';
    $('ucanLogoutBtn').onclick=async()=>{await fetch('/api/presence',{method:'DELETE'}).catch(()=>{});await api('/api/auth/logout',{method:'POST',body:'{}'}).catch(()=>{});location.replace('/login');};
    $('ucanProfileModal').addEventListener('click',event=>{if(event.target===$('ucanProfileModal'))closeModal();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeModal();$('ucanOnlinePanel').classList.remove('open');}});
    document.querySelectorAll('#ucanProfileModal select').forEach(select=>select.addEventListener('change',()=>{if(select.value.startsWith('#'))select.style.background=`linear-gradient(90deg,${select.value} 0 34px,#fff 34px)`;updatePreview();}));
    $('avatarAccessories').addEventListener('change',event=>{const checked=[...document.querySelectorAll('#avatarAccessories input:checked')];if(checked.length>3){event.target.checked=false;$('ucanAvatarMessage').textContent='Puede seleccionar un máximo de tres accesorios.';}updatePreview();});
    $('ucanSaveAvatar').onclick=async()=>{const button=$('ucanSaveAvatar');button.disabled=true;$('ucanAvatarMessage').textContent='Guardando avatar…';try{const data=await api('/api/profile/avatar',{method:'PUT',body:JSON.stringify({avatar:currentAvatarForm()})});state.user=data.user;updateUserUI();recreateLocalAvatar();$('ucanAvatarMessage').textContent='Avatar guardado correctamente.';}catch(error){$('ucanAvatarMessage').textContent=error.message;}finally{button.disabled=false;}};
    $('ucanResetAvatar').onclick=()=>{populateForm(state.options.defaultAvatar);$('ucanAvatarMessage').textContent='Diseño restablecido. Presione Guardar avatar para conservarlo.';};
    $('ucanSaveProfile').onclick=async()=>{try{const data=await api('/api/profile',{method:'PATCH',body:JSON.stringify({displayName:$('ucanProfileName').value,email:$('ucanProfileEmail').value})});state.user=data.user;updateUserUI();recreateLocalAvatar();$('ucanAvatarMessage').textContent='Información actualizada.';}catch(error){$('ucanAvatarMessage').textContent=error.message;}};
    $('ucanChangePassword').onclick=async()=>{const current=$('ucanCurrentPassword').value,newPassword=$('ucanNewPassword').value,confirm=$('ucanConfirmPassword').value;if(newPassword!==confirm){$('ucanPasswordMessage').textContent='Las contraseñas nuevas no coinciden.';return;}try{const data=await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:current,newPassword})});state.user=data.user;updateUserUI();$('ucanPasswordMessage').textContent='Contraseña actualizada.';$('ucanCurrentPassword').value=$('ucanNewPassword').value=$('ucanConfirmPassword').value='';$('ucanRequiredMessage').style.display='none';}catch(error){$('ucanPasswordMessage').textContent=error.message;}};
    window.addEventListener('beforeunload',()=>{fetch('/api/presence',{method:'DELETE',keepalive:true}).catch(()=>{});});
  }
  function updateUserUI() {$('ucanDisplayName').textContent=state.user.displayName;$('ucanUserInitial').textContent=(state.user.displayName||state.user.username||'U').trim().charAt(0).toUpperCase();$('ucanRoleText').textContent=state.user.role==='admin'?'Administrador':'Usuario del campus';$('ucanAdminBtn').style.display=state.user.role==='admin'?'block':'none';localStorage.setItem('ucanVoiceName',state.user.displayName);localStorage.setItem('ucanExperienceName',state.user.displayName);localStorage.setItem('ucanAccountUserId',state.user.id);}
  async function presenceLoop() {
    const camera=state.controllerCamera; if(!camera)return;
    try{await api('/api/presence',{method:'POST',body:JSON.stringify({position:{x:camera.position.x,y:camera.position.y,z:camera.position.z},rotationY:camera.rotation.y,area:$('currentLocation')?.textContent||'Campus'})});const data=await api('/api/presence');updateRemoteParticipants(data.participants||[]);}catch(error){console.warn('Presencia UCAN:',error.message);}
  }
  async function init() {
    try {
      const me=await api('/api/auth/me');state.user=me.user;state.options=await api('/api/auth/options');injectStyles();injectInterface();updateUserUI();setupPreview();populateForm(state.user.avatar);bindEvents();await waitForEnvironment();setupSceneAvatar();renderOnlineList([]);presenceLoop();setInterval(presenceLoop,2200);
      const params=new URLSearchParams(location.search);if(params.get('avatar')==='1'||!state.user.avatarConfigured)openModal(false);if(params.get('password')==='change'||state.user.forcePasswordChange)openModal(true);
      window.__UCAN_IDENTITY__={version:'V265',getUser:()=>state.user,getRemoteCount:()=>state.remote.size,openAvatarEditor:()=>openModal(false),toggleThirdPerson};
    } catch(error) { console.error('Identidad UCAN:',error); location.replace('/login'); }
  }
  init();
})();
