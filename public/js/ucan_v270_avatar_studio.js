(() => {
  'use strict';
  const VERSION='V270';
  const $=id=>document.getElementById(id);
  const escape=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const presets={
    inter:{name:'Profesional Inter',icon:'🎓',cfg:{topStyle:'formal',topColor:'#007b5f',bottomStyle:'pantalón',bottomColor:'#152d30',shoeStyle:'zapatos',shoeColor:'#111111',accessories:['gafas']}},
    campus:{name:'Campus casual',icon:'🌿',cfg:{topStyle:'camiseta',topColor:'#fed141',bottomStyle:'jeans',bottomColor:'#243b5a',shoeStyle:'tenis',shoeColor:'#ffffff',accessories:['mochila']}},
    tech:{name:'Creador digital',icon:'💻',cfg:{topStyle:'sudadera',topColor:'#244b87',bottomStyle:'deportivo',bottomColor:'#222222',shoeStyle:'tenis',shoeColor:'#111111',accessories:['audífonos','gafas']}},
    creative:{name:'Estilo creativo',icon:'✨',cfg:{topStyle:'chaqueta',topColor:'#7b4fa3',bottomStyle:'pantalón',bottomColor:'#6a5947',shoeStyle:'botas',shoeColor:'#6d402d',accessories:['bufanda','sombrero']}}
  };
  const colorSelects=['avatarSkin','avatarHairColor','avatarTopColor','avatarBottomColor','avatarShoeColor'];
  let initialized=false;

  function fireChange(element){element?.dispatchEvent(new Event('change',{bubbles:true}));}
  function applyConfig(cfg){
    for(const [key,value] of Object.entries(cfg)){
      const map={skinTone:'avatarSkin',hairStyle:'avatarHairStyle',hairColor:'avatarHairColor',topStyle:'avatarTopStyle',topColor:'avatarTopColor',bottomStyle:'avatarBottomStyle',bottomColor:'avatarBottomColor',shoeStyle:'avatarShoeStyle',shoeColor:'avatarShoeColor'};
      if(key==='accessories'){
        document.querySelectorAll('#avatarAccessories input').forEach(input=>{input.checked=value.includes(input.value);});
        fireChange($('avatarAccessories'));
      } else if(map[key]&&$(map[key])) { $(map[key]).value=value; fireChange($(map[key])); }
    }
    refreshSwatches();
  }
  function randomize(){
    const ids=['avatarSkin','avatarHairStyle','avatarHairColor','avatarTopStyle','avatarTopColor','avatarBottomStyle','avatarBottomColor','avatarShoeStyle','avatarShoeColor'];
    ids.forEach(id=>{const select=$(id);if(!select?.options?.length)return;select.selectedIndex=Math.floor(Math.random()*select.options.length);fireChange(select);});
    const acc=[...document.querySelectorAll('#avatarAccessories input')];acc.forEach(input=>input.checked=false);
    acc.sort(()=>Math.random()-.5).slice(0,Math.floor(Math.random()*4)).forEach(input=>input.checked=true);
    fireChange($('avatarAccessories'));refreshSwatches();
  }
  function refreshSwatches(){
    for(const id of colorSelects){
      const select=$(id);const holder=document.querySelector(`[data-swatches-for="${id}"]`);if(!select||!holder)continue;
      holder.querySelectorAll('button').forEach(button=>button.classList.toggle('selected',button.dataset.value===select.value));
    }
  }
  function buildSwatches(select){
    const holder=document.createElement('div');holder.className='ucan-color-swatches';holder.dataset.swatchesFor=select.id;
    [...select.options].forEach(option=>{const button=document.createElement('button');button.type='button';button.className='ucan-swatch';button.dataset.value=option.value;button.style.setProperty('--swatch',option.value);button.title=option.value;button.setAttribute('aria-label',`Seleccionar color ${option.value}`);button.onclick=()=>{select.value=option.value;fireChange(select);refreshSwatches();};holder.appendChild(button);});
    select.insertAdjacentElement('afterend',holder);select.classList.add('ucan-native-color-select');
  }
  function activateTab(name){
    document.querySelectorAll('.ucan-studio-tab').forEach(btn=>btn.classList.toggle('active',btn.dataset.tab===name));
    document.querySelectorAll('.ucan-profile-section').forEach(section=>section.classList.toggle('ucan-section-hidden',section.dataset.studioSection!==name));
    const stage=document.querySelector('.ucan-avatar-stage');if(stage)stage.classList.toggle('account-mode',name!=='avatar');
  }
  function classifySections(){
    document.querySelectorAll('.ucan-profile-section').forEach(section=>{
      const title=section.querySelector('h3')?.textContent||'';
      section.dataset.studioSection=/contraseña/i.test(title)?'security':/cuenta|información/i.test(title)?'account':'avatar';
    });
  }
  function showToast(text){
    let toast=$('ucanStudioToast');if(!toast){toast=document.createElement('div');toast.id='ucanStudioToast';toast.className='ucan-studio-toast';document.body.appendChild(toast);}toast.textContent=text;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600);
  }
  function repairAvatarFlag(){
    const identity=window.__UCAN_IDENTITY__;const user=identity?.getUser?.();if(!user||user.avatarConfigured)return;
    const key=`ucan-avatar-complete:${user.id}`;if(!localStorage.getItem(key))return;
    fetch('/api/profile/avatar',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar:user.avatar})}).then(r=>r.ok?r.json():null).then(data=>{if(data?.user){Object.assign(user,data.user);showToast('Perfil del avatar sincronizado.');}}).catch(()=>{});
  }
  function enhance(){
    if(initialized||!$('ucanProfileModal')||!$('avatarSkin'))return false;initialized=true;
    const style=document.createElement('style');style.textContent=`
      #ucanProfileModal{background:radial-gradient(circle at 18% 10%,rgba(0,123,95,.38),rgba(2,9,12,.93) 48%,rgba(2,5,8,.98));}
      .ucan-profile-card{width:min(1260px,98vw)!important;background:linear-gradient(145deg,#f8fbfa,#e8f1ee)!important;border:1px solid rgba(255,255,255,.7)!important;border-radius:28px!important;box-shadow:0 36px 120px rgba(0,0,0,.62)!important;overflow:hidden!important;}
      .ucan-profile-head{background:linear-gradient(120deg,#052f2b,#007b5f 58%,#0e9675)!important;padding:18px 22px!important;}
      .ucan-profile-head h2{font-size:0!important}.ucan-profile-head h2:after{content:'UCAN Avatar Studio';font-size:24px;letter-spacing:.2px}.ucan-profile-head:after{content:'Diseñe una identidad digital moderna para el campus';font-size:12px;color:#d7fff5;margin-left:auto;margin-right:10px}
      .ucan-profile-body{grid-template-columns:minmax(430px,1fr) minmax(430px,.92fr)!important;gap:20px!important;padding:20px!important;}
      .ucan-studio-toolbar{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:0 20px 14px;background:#f8fbfa;border-bottom:1px solid #cfddd8}.ucan-studio-tab{border:1px solid #c5d7d0;background:#edf4f1;color:#173d36;border-radius:12px;padding:11px;font-weight:900}.ucan-studio-tab.active{background:#007b5f;color:white;border-color:#007b5f;box-shadow:0 8px 24px rgba(0,123,95,.22)}
      .ucan-profile-section{border:1px solid #ceddd8!important;border-radius:18px!important;box-shadow:0 10px 30px rgba(20,58,48,.07);padding:18px!important}.ucan-section-hidden{display:none!important}
      .ucan-preset-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:4px 0 10px}.ucan-preset-title b{font-size:13px}.ucan-random-btn{background:#122e2a!important;color:#fff!important;border-radius:10px!important;padding:8px 11px!important}
      .ucan-presets{display:grid;grid-template-columns:repeat(2,1fr);gap:9px;margin-bottom:16px}.ucan-preset{background:linear-gradient(145deg,#fff,#edf4f1)!important;border:1px solid #c7d8d2!important;color:#173d36!important;border-radius:14px!important;padding:12px!important;text-align:left!important;display:flex;align-items:center;gap:10px}.ucan-preset span{font-size:24px}.ucan-preset small{display:block;color:#607a73;font-weight:600;margin-top:2px}
      .ucan-avatar-form{gap:13px!important}.ucan-avatar-form>div{background:#f8fbfa;border:1px solid #d4e1dd;border-radius:13px;padding:10px}.ucan-avatar-form label{font-size:11px!important;text-transform:uppercase;letter-spacing:.5px;color:#47635c}.ucan-avatar-form select,.ucan-avatar-form input{border:1px solid #bfd1cb!important;border-radius:10px!important;min-height:42px!important}
      .ucan-native-color-select{display:none!important}.ucan-color-swatches{display:flex;flex-wrap:wrap;gap:8px;padding-top:3px}.ucan-swatch{width:30px;height:30px;padding:0!important;border-radius:50%!important;background:var(--swatch)!important;border:3px solid white!important;box-shadow:0 0 0 1px #9fb5ae;transition:.18s transform,.18s box-shadow}.ucan-swatch:hover{transform:scale(1.12)}.ucan-swatch.selected{box-shadow:0 0 0 3px #007b5f;transform:scale(1.08)}
      .ucan-accessories{grid-template-columns:repeat(3,1fr)!important}.ucan-accessories label{background:#f7faf9;transition:.18s;border-radius:11px!important}.ucan-accessories label:has(input:checked){border-color:#007b5f!important;background:#e4f5ef;box-shadow:0 0 0 2px rgba(0,123,95,.12)}
      .ucan-avatar-stage{top:90px!important;min-height:650px!important;background:radial-gradient(circle at 50% 28%,#fdfefe 0,#d9ebe5 48%,#9dbeb4 100%)!important;border-radius:22px!important;border:1px solid #b8d0c8!important;box-shadow:inset 0 0 70px rgba(0,123,95,.12),0 18px 45px rgba(16,57,47,.14)}.ucan-avatar-stage:before{content:'VISTA 3D EN TIEMPO REAL';position:absolute;z-index:2;left:16px;top:16px;padding:7px 10px;border-radius:999px;background:rgba(4,35,31,.84);color:#fff;font-size:10px;font-weight:900;letter-spacing:.7px}.ucan-avatar-stage:after{content:'Arrastre para girar · rueda para acercar';position:absolute;z-index:2;bottom:12px;left:50%;transform:translateX(-50%);padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.84);color:#34554d;font-size:11px;white-space:nowrap}.ucan-avatar-stage canvas{height:650px!important}.ucan-avatar-stage.account-mode{opacity:.76}
      .ucan-profile-actions button{border-radius:12px!important;padding:11px 16px!important}.ucan-profile-actions button:first-child{background:linear-gradient(120deg,#007b5f,#0b9674)!important;box-shadow:0 8px 24px rgba(0,123,95,.22)}
      .ucan-studio-toast{position:fixed;left:50%;bottom:28px;z-index:95;transform:translate(-50%,30px);opacity:0;background:#082f2a;color:#fff;padding:12px 18px;border-radius:999px;box-shadow:0 18px 50px #0007;transition:.25s}.ucan-studio-toast.show{transform:translate(-50%,0);opacity:1}
      @media(max-width:900px){.ucan-profile-body{grid-template-columns:1fr!important}.ucan-avatar-stage{position:relative!important;top:auto!important;min-height:480px!important}.ucan-avatar-stage canvas{height:480px!important}.ucan-accessories{grid-template-columns:repeat(2,1fr)!important}.ucan-profile-head:after{display:none}}
    `;document.head.appendChild(style);
    classifySections();
    const card=document.querySelector('.ucan-profile-card');const body=document.querySelector('.ucan-profile-body');
    const toolbar=document.createElement('div');toolbar.className='ucan-studio-toolbar';toolbar.innerHTML='<button type="button" class="ucan-studio-tab active" data-tab="avatar">Avatar</button><button type="button" class="ucan-studio-tab" data-tab="account">Cuenta</button><button type="button" class="ucan-studio-tab" data-tab="security">Seguridad</button>';card.insertBefore(toolbar,body);toolbar.querySelectorAll('button').forEach(button=>button.onclick=()=>activateTab(button.dataset.tab));
    const avatarSection=document.querySelector('[data-studio-section="avatar"]');const form=avatarSection?.querySelector('.ucan-avatar-form');
    if(form){const block=document.createElement('div');block.style.gridColumn='1/-1';block.innerHTML=`<div class="ucan-preset-title"><b>Estilos inteligentes</b><button type="button" id="ucanRandomAvatar" class="ucan-random-btn">✨ Sorpréndeme</button></div><div class="ucan-presets">${Object.entries(presets).map(([key,p])=>`<button type="button" class="ucan-preset" data-preset="${key}"><span>${p.icon}</span><div><b>${escape(p.name)}</b><small>Aplicar combinación</small></div></button>`).join('')}</div>`;form.insertBefore(block,form.firstChild);block.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>{applyConfig(presets[button.dataset.preset].cfg);showToast(`${presets[button.dataset.preset].name} aplicado.`);});$('ucanRandomAvatar').onclick=()=>{randomize();showToast('Nuevo estilo generado.');};}
    colorSelects.forEach(id=>{const select=$(id);if(select)buildSwatches(select);});refreshSwatches();activateTab('avatar');
    $('ucanAvatarBtn').textContent='Avatar Studio';$('ucanSaveAvatar').textContent='Guardar diseño';
    $('ucanSaveAvatar').addEventListener('click',()=>setTimeout(()=>{const msg=$('ucanAvatarMessage')?.textContent||'';if(/guardado correctamente/i.test(msg))showToast('Diseño guardado en su cuenta.');},500));
    $('ucanChangePassword').addEventListener('click',()=>setTimeout(()=>{const msg=$('ucanPasswordMessage')?.textContent||'';if(/actualizada/i.test(msg))showToast('Contraseña actualizada. No volverá a solicitarse.');},500));
    repairAvatarFlag();
    window.__UCAN_AVATAR_STUDIO__={version:VERSION,initialized:true,presets:Object.keys(presets),randomize,applyPreset:key=>presets[key]&&applyConfig(presets[key].cfg),activateTab};
    return true;
  }
  const timer=setInterval(()=>{if(enhance())clearInterval(timer);},100);setTimeout(()=>clearInterval(timer),25000);
})();