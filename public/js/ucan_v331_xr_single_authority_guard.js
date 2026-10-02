(() => {
  'use strict';

  const VERSION='V331';
  const REVISION='R40';
  const BUILD='V331-20261002-XR-SINGLE-VERTICAL-AUTHORITY-R40';
  const state={
    installed:false,frames:0,visualRepairs:0,rigRepairs:0,verticalRepairs:0,
    ownershipFaults:0,lastIssue:null,lastRepairAt:0
  };
  const finite=v=>Number.isFinite(Number(v));
  const authority=()=>window.__UCAN_XR_FINAL_AUTHORITY_V328__||null;
  const horizontal=()=>window.__UCAN_XR_STAIRS_ENTRY_V324__||null;
  const helper=()=>window.__UCAN_XR_HELPER__||null;
  const scene=()=>window.__UCAN_API__?.getScene?.()||null;
  const desktop=()=>window.__UCAN_API__?.getCamera?.()||null;

  function repairVisuals(){
    const s=scene(); if(!s)return;
    let changed=0;
    for(const [key,value] of [['lightsEnabled',true],['texturesEnabled',true],['shadowsEnabled',true],['particlesEnabled',true]]){
      if(s[key]===false){s[key]=value;changed++;}
    }
    const image=s.imageProcessingConfiguration;
    if(image&&(!finite(image.exposure)||image.exposure<0.35)){image.exposure=0.82;changed++;}
    if(image&&(!finite(image.contrast)||image.contrast<0.5)){image.contrast=1.18;changed++;}
    for(const material of s.materials||[]){
      if(!material||material.alpha==null||Number(material.alpha)>=0.999)continue;
      if(material.needDepthPrePass===true){material.needDepthPrePass=false;changed++;}
      if(material.disableDepthWrite!==true){material.disableDepthWrite=true;changed++;}
      if(window.BABYLON?.Material?.MATERIAL_ALPHABLEND!=null&&material.transparencyMode!==window.BABYLON.Material.MATERIAL_ALPHABLEND){
        material.transparencyMode=window.BABYLON.Material.MATERIAL_ALPHABLEND;changed++;
      }
    }
    if(changed)state.visualRepairs+=changed;
  }

  function repairRig(){
    const h=helper(),d=desktop(); if(!h||!d)return;
    const xr=h.baseExperience?.camera; if(!xr)return;
    let changed=0;
    for(const camera of [xr,...(xr.rigCameras||[])]){
      if(!camera)continue;
      if(d.layerMask!=null&&camera.layerMask!==d.layerMask){camera.layerMask=d.layerMask;changed++;}
      const desiredMin=Math.max(0.04,Math.min(Number(d.minZ||0.06),0.12));
      if(!finite(camera.minZ)||Math.abs(Number(camera.minZ)-desiredMin)>0.02){camera.minZ=desiredMin;changed++;}
      const desiredMax=Math.max(Number(d.maxZ||0),1800);
      if(!finite(camera.maxZ)||Number(camera.maxZ)<desiredMax){camera.maxZ=desiredMax;changed++;}
    }
    if(changed)state.rigRepairs+=changed;
  }

  function enforceSingleVerticalWriter(){
    const a=authority(),h=horizontal();
    const as=a?.getState?.()||a||{};
    const hs=h?.getState?.()||h||{};
    if(!a?.installed||!as.inXR)return;
    const delegated=hs.verticalAuthorityDelegatedToV328===true;
    const owns=a.ownsVertical===true||as.singleFinalVerticalAuthority===true;
    if(!delegated||!owns){
      state.ownershipFaults++;
      state.lastIssue={type:'vertical-authority',delegated,owns,at:new Date().toISOString()};
    }
    if(as.activeRide||as.jumping)return;
    const rootY=Number(as.rootY),expected=Number(as.expectedRootY);
    if(!finite(rootY)||!finite(expected))return;
    const drift=Math.abs(rootY-expected);
    if(drift<0.06)return;
    const now=performance.now();
    if(now-state.lastRepairAt<900)return;
    state.lastRepairAt=now;
    a.setGround?.(Number(as.stableFloor),'v331-single-writer-repair');
    state.verticalRepairs++;
    state.lastIssue={type:'root-y-drift',rootY,expected,drift,at:new Date().toISOString()};
  }

  function tick(){
    const a=authority();
    if(!a?.installed)return;
    state.frames++;
    const as=a.getState?.()||a;
    if(as.inXR){
      repairRig();
      repairVisuals();
      enforceSingleVerticalWriter();
    }
    window.__UCAN_XR_STABILITY_V331__={
      version:VERSION,revision:REVISION,build:BUILD,installed:true,
      singleVerticalWriter:true,
      horizontalLocomotionDelegatesHeight:true,
      automaticStairsOwnedByFinalAuthority:true,
      exactFloorLanding:true,
      desktopSpeedParity:true,
      stereoVisualParityGuard:true,
      transparentMaterialQuestFix:true,
      getState:()=>({...state,authority:a.getState?.()||null,horizontal:horizontal()?.getState?.()||null})
    };
  }

  function install(){
    if(state.installed)return true;
    const s=scene(); if(!s||!window.BABYLON)return false;
    state.installed=true;
    s.onBeforeRenderObservable.add(()=>{if((state.frames%12)===0)tick();else state.frames++;});
    repairVisuals();
    window.setInterval(()=>{try{tick();}catch(error){state.lastIssue={type:'guard',message:String(error?.message||error),at:new Date().toISOString()};}},700);
    console.info('[UCAN V331 R40] Guard de autoridad vertical única y paridad inmersiva instalado.');
    tick();
    return true;
  }

  let attempts=0;
  const timer=setInterval(()=>{attempts++;if(install()||attempts>700)clearInterval(timer);},100);
})();