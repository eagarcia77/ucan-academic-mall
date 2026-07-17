'use strict';
const fs=require('fs');
const vm=require('vm');
class Observable{constructor(){this.handlers=[];}add(fn){this.handlers.push(fn);return fn;}notify(v){for(const fn of this.handlers)fn(v);}}
class Vector3{
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  set(x,y,z){this.x=x;this.y=y;this.z=z;return this;} clone(){return new Vector3(this.x,this.y,this.z);}
  copyFrom(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;} asArray(){return [this.x,this.y,this.z];}
  add(v){return new Vector3(this.x+v.x,this.y+v.y,this.z+v.z);} scale(v){return new Vector3(this.x*v,this.y*v,this.z*v);}
  scaleInPlace(v){this.x*=v;this.y*=v;this.z*=v;return this;} addInPlace(v){this.x+=v.x;this.y+=v.y;this.z+=v.z;return this;}
  lengthSquared(){return this.x*this.x+this.y*this.y+this.z*this.z;} length(){return Math.sqrt(this.lengthSquared());}
  normalize(){const l=this.length()||1;this.x/=l;this.y/=l;this.z/=l;return this;}
  static Lerp(a,b,t){return new Vector3(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);}
}
class Ray{constructor(origin,direction,length){this.origin=origin;this.direction=direction;this.length=length;}}
const frameObs=new Observable();
const leftGamepad={axes:[0,0,0,-1]};
const rightGamepad={axes:[0,0,0,0]};
const helper={input:{controllers:[{inputSource:{handedness:'left',gamepad:leftGamepad}},{inputSource:{handedness:'right',gamepad:rightGamepad}}]},baseExperience:{camera:{position:new Vector3(0,1.65,42),realWorldHeight:1.65,cameraDirection:new Vector3(),cameraRotation:new Vector3(),rotation:new Vector3(),getForwardRay:()=>({direction:new Vector3(0,0,1)})},featuresManager:{disabled:[],disableFeature(name){this.disabled.push(name);}},onStateChangedObservable:new Observable()}};
class Scene{constructor(){this.meshes=[];this.activeCamera={position:new Vector3(0,1.72,42),rotation:new Vector3()};this.onBeforeRenderObservable=frameObs;}getEngine(){return {getDeltaTime:()=>16};}pickWithRay(){return {hit:false};}getTransformNodeByName(){return null;}}
Scene.prototype.createDefaultXRExperienceAsync=async()=>helper;
const context={console,window:null,document:{getElementById:()=>null},BABYLON:{Scene,Vector3,Ray,WebXRState:{IN_XR:2,NOT_IN_XR:0},WebXRFeatureName:{TELEPORTATION:'teleport',MOVEMENT:'movement'}}};context.window=context;
vm.createContext(context);vm.runInContext(fs.readFileSync('public/js/ucan_v269_quest_grounded.js','utf8'),context);
(async()=>{
  const scene=new context.BABYLON.Scene();await scene.createDefaultXRExperienceAsync({});
  helper.baseExperience.onStateChangedObservable.notify(context.BABYLON.WebXRState.IN_XR);
  for(let i=0;i<120;i++)frameObs.notify();
  const camera=helper.baseExperience.camera;
  if(Math.abs(camera.position.z-42)<0.25)throw new Error('El joystick izquierdo no produjo movimiento hacia adelante.');
  if(Math.abs(camera.position.y-1.65)>0.2)throw new Error(`La cámara se separó del suelo: y=${camera.position.y}`);
  camera.position.set(-20,1.65,21);
  for(let i=0;i<120;i++)frameObs.notify();
  if(camera.position.y<2.0||camera.position.y>10.2)throw new Error(`Altura de escalera inestable: ${camera.position.y}`);
  camera.position.y=999;
  frameObs.notify();
  if(camera.position.y>40)throw new Error('La recuperación de posición no funcionó.');
  const audit=context.window.__UCAN_QUEST_XR_AUDIT__;
  if(!audit?.groundedLocomotion||!audit?.builtInMovementDisabled)throw new Error('Auditoría V269 incompleta.');
  console.log(JSON.stringify({passed:true,position:camera.position.asArray(),audit:audit.getState()},null,2));
})().catch(err=>{console.error(err);process.exit(1);});
