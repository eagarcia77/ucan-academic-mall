(() => {
  'use strict';

  const VERSION='V277';
  const BUILD='V277-20260720-XR-NAV-ROLLBACK-PERSISTENCE';
  const $=id=>document.getElementById(id);
  const MAX_HISTORY=8;
  let installed=false;

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function user(){return window.__UCAN_IDENTITY__?.getUser?.()||null;}
  function key(type,direction='past'){
    const id=user()?.id||localStorage.getItem('ucanAccountUserId')||'local';
    return `ucan-v277-${type}-${direction}:${id}`;
  }
  function read(type,direction='past'){
    try{const value=JSON.parse(localStorage.getItem(key(type,direction))||'[]');return Array.isArray(value)?value:[];}catch(_){return[];}
  }
  function write(type,direction,list){localStorage.setItem(key(type,direction),JSON.stringify(list.slice(-MAX_HISTORY)));}
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  function push(type,value,direction='past'){
    const list=read(type,direction);const snapshot={savedAt:new Date().toISOString(),value:clone(value)};
    if(!list.length||!same(list[list.length-1].value,snapshot.value))list.push(snapshot);
    write(type,direction,list);return list.length;
  }
  function pop(type,direction='past'){
    const list=read(type,direction),item=list.pop()||null;write(type,direction,list);return item;
  }
  function clear(type,direction='future'){localStorage.removeItem(key(type,direction));}

  function avatarFromForm(){
    const values=id=>$(id)?.value;
    return{
      skinTone:values('avatarSkin'),hairStyle:values('avatarHairStyle'),hairColor:values('avatarHairColor'),
      topStyle:values('avatarTopStyle'),topColor:values('avatarTopColor'),bottomStyle:values('avatarBottomStyle'),
      bottomColor:values('avatarBottomColor'),shoeStyle:values('avatarShoeStyle'),shoeColor:values('avatarShoeColor'),
      accessories:[...document.querySelectorAll('#avatarAccessories input:checked')].map(input=>input.value).slice(0,3)
    };
  }
  function profileFromForm(){return{displayName:$('ucanProfileName')?.value||'',email:$('ucanProfileEmail')?.value||''};}
  function currentAvatar(){return clone(user()?.avatar||avatarFromForm());}
  function currentProfile(){const u=user();return{displayName:u?.displayName||'',email:u?.email||''};}

  async function api(url,options={}){
    const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
    return data;
  }

  function message(text,error=false){
    const target=$('ucanRollbackMessage')||$('ucanAvatarMessage');
    if(target){target.textContent=text;target.style.color=error?'#9c1c1c':'#175f4c';}
  }

  function updateStatus(){
    const u=user();if(!u)return;
    const avatarPast=read('avatar').length,avatarFuture=read('avatar','future').length;
    const profilePast=read('profile').length,profileFuture=read('profile','future').length;
    const status=$('ucanPersistenceStatus');
    if(status)status.innerHTML=`<strong>Persistencia V277</strong><br>Avatar guardado: ${u.avatarConfigured?'Sí':'Pendiente'}${u.avatarConfiguredAt?` · ${new Date(u.avatarConfiguredAt).toLocaleString('es-PR')}`:''}<br>Contraseña completada: ${!u.forcePasswordChange?'Sí':'Pendiente'}${u.passwordChangedAt?` · ${new Date(u.passwordChangedAt).toLocaleString('es-PR')}`:''}<br>Rollback disponible: avatar ${avatarPast}, información ${profilePast}.`;
    const buttons={ucanAvatarRollback:avatarPast,ucanAvatarRedo:avatarFuture,ucanProfileRollback:profilePast,ucanProfileRedo:profileFuture};
    for(const [id,count] of Object.entries(buttons)){const button=$(id);if(button){button.disabled=count===0;button.title=count?`${count} versión(es) disponible(s)`:'No hay versiones disponibles';}}
  }

  async function restore(type,direction){
    const item=pop(type,direction);if(!item){message('No hay una versión disponible para restaurar.');updateStatus();return;}
    const opposite=direction==='past'?'future':'past';
    const current=type==='avatar'?currentAvatar():currentProfile();
    push(type,current,opposite);
    try{
      let data;
      if(type==='avatar')data=await api('/api/profile/avatar',{method:'PUT',body:JSON.stringify({avatar:item.value})});
      else data=await api('/api/profile',{method:'PATCH',body:JSON.stringify(item.value)});
      if(data.user&&user())Object.assign(user(),data.user);
      message(`${direction==='past'?'Rollback':'Rehacer'} de ${type==='avatar'?'avatar':'información'} aplicado correctamente.`);
      updateStatus();
      setTimeout(()=>location.reload(),650);
    }catch(error){
      pop(type,opposite);push(type,item.value,direction);message(error.message,true);updateStatus();
    }
  }

  function addButton(container,id,text,handler){
    if(!container||$(id))return;
    const button=document.createElement('button');button.type='button';button.id=id;button.className='secondary';button.textContent=text;button.onclick=handler;container.appendChild(button);
  }

  function installHistoryUI(){
    const sections=[...document.querySelectorAll('#ucanProfileModal .ucan-profile-section')];
    const avatarSection=sections.find(section=>/personalización|avatar/i.test(section.querySelector('h3')?.textContent||''));
    const profileSection=sections.find(section=>/información de la cuenta/i.test(section.querySelector('h3')?.textContent||''));
    const avatarActions=avatarSection?.querySelector('.ucan-profile-actions');
    const profileActions=profileSection?.querySelector('.ucan-profile-actions');
    addButton(avatarActions,'ucanAvatarRollback','↶ Rollback avatar',()=>restore('avatar','past'));
    addButton(avatarActions,'ucanAvatarRedo','↷ Rehacer avatar',()=>restore('avatar','future'));
    addButton(profileActions,'ucanProfileRollback','↶ Rollback información',()=>restore('profile','past'));
    addButton(profileActions,'ucanProfileRedo','↷ Rehacer información',()=>restore('profile','future'));

    if(profileSection&&!$('ucanPersistenceStatus')){
      const box=document.createElement('div');box.id='ucanPersistenceStatus';box.style.cssText='margin-top:13px;padding:11px 12px;border-radius:11px;background:#edf7f3;border:1px solid #bcd8ce;color:#214c42;font-size:12px;line-height:1.45';profileSection.appendChild(box);
    }
    if(profileSection&&!$('ucanRollbackMessage')){
      const box=document.createElement('div');box.id='ucanRollbackMessage';box.className='ucan-profile-message';box.setAttribute('aria-live','polite');profileSection.appendChild(box);
    }

    $('ucanSaveAvatar')?.addEventListener('click',()=>{
      const old=currentAvatar(),next=avatarFromForm();if(!same(old,next)){push('avatar',old);clear('avatar');updateStatus();}
    },true);
    $('ucanSaveProfile')?.addEventListener('click',()=>{
      const old=currentProfile(),next=profileFromForm();if(!same(old,next)){push('profile',old);clear('profile');updateStatus();}
    },true);
    updateStatus();
  }

  function enforceCompletionPersistence(){
    const u=user();if(!u)return;
    if(u.avatarConfigured||u.avatarConfiguredAt)localStorage.setItem(`ucan-avatar-complete:${u.id}`,u.avatarConfiguredAt||new Date().toISOString());
    if(!u.forcePasswordChange&&u.passwordChangedAt)localStorage.setItem(`ucan-password-complete:${u.id}`,u.passwordChangedAt);

    const required=$('ucanRequiredMessage');
    if(required&&!u.forcePasswordChange)required.style.display='none';

    const modal=$('ucanProfileModal');
    if(modal?.classList.contains('open')&&u.avatarConfigured&&!u.forcePasswordChange){
      setTimeout(()=>{
        const latest=user();
        if(latest?.avatarConfigured&&!latest?.forcePasswordChange&&modal.classList.contains('open'))$('ucanProfileClose')?.click();
      },450);
    }
  }

  function install(){
    if(installed||!window.__UCAN_IDENTITY__||!$('ucanProfileModal')||!$('ucanSaveAvatar'))return false;
    installed=true;installHistoryUI();enforceCompletionPersistence();
    const observer=new MutationObserver(()=>{updateStatus();enforceCompletionPersistence();});
    observer.observe($('ucanProfileModal'),{attributes:true,attributeFilter:['class']});
    window.addEventListener('storage',updateStatus);
    window.__UCAN_PROFILE_ROLLBACK__={
      version:VERSION,build:BUILD,installed:true,maxHistory:MAX_HISTORY,
      avatarRollback:()=>restore('avatar','past'),profileRollback:()=>restore('profile','past'),
      getState:()=>({avatarPast:read('avatar').length,avatarFuture:read('avatar','future').length,profilePast:read('profile').length,profileFuture:read('profile','future').length,user:user()?{avatarConfigured:user().avatarConfigured,forcePasswordChange:user().forcePasswordChange,avatarConfiguredAt:user().avatarConfiguredAt,passwordChangedAt:user().passwordChangedAt}:null})
    };
    console.info('[UCAN V277] Rollback y persistencia de perfil instalados.');
    return true;
  }

  const timer=setInterval(()=>{if(install())clearInterval(timer);},120);
  setTimeout(()=>clearInterval(timer),30000);
})();