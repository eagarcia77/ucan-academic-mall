(() => {
  'use strict';

  const DEFAULTS = {
    skinTone:'#dca27b', hairStyle:'corto', hairColor:'#17110f',
    topStyle:'camiseta', topColor:'#007b5f', bottomStyle:'pantalón', bottomColor:'#152d30',
    shoeStyle:'tenis', shoeColor:'#ffffff', accessories:[]
  };

  function config(value = {}) {
    return { ...DEFAULTS, ...value, accessories:Array.isArray(value.accessories) ? [...new Set(value.accessories)].slice(0,3) : [] };
  }
  function color(value, fallback) {
    try { return BABYLON.Color3.FromHexString(value || fallback); } catch { return BABYLON.Color3.FromHexString(fallback); }
  }
  function material(scene, name, value, fallback, emissive = 0) {
    const mat = new BABYLON.StandardMaterial(name, scene);
    mat.diffuseColor = color(value, fallback);
    mat.specularColor = new BABYLON.Color3(.08,.08,.08);
    if (emissive) mat.emissiveColor = mat.diffuseColor.scale(emissive);
    return mat;
  }
  function parent(mesh, root, metadata = {}) {
    mesh.parent = root;
    mesh.isPickable = false;
    mesh.checkCollisions = false;
    mesh.metadata = { avatarPart:true, ...metadata };
    return mesh;
  }
  function box(scene, name, size, position, mat, root) {
    const mesh = BABYLON.MeshBuilder.CreateBox(name, { width:size.x, height:size.y, depth:size.z }, scene);
    mesh.position.copyFrom(position); mesh.material = mat; return parent(mesh, root);
  }
  function sphere(scene, name, diameter, position, mat, root, segments = 18) {
    const mesh = BABYLON.MeshBuilder.CreateSphere(name, { diameter, segments }, scene);
    mesh.position.copyFrom(position); mesh.material = mat; return parent(mesh, root);
  }
  function cylinder(scene, name, height, diameter, position, mat, root, tessellation = 18) {
    const mesh = BABYLON.MeshBuilder.CreateCylinder(name, { height, diameter, tessellation }, scene);
    mesh.position.copyFrom(position); mesh.material = mat; return parent(mesh, root);
  }
  function namePlate(scene, root, text, role) {
    const texture = new BABYLON.DynamicTexture(`avatar-name-${root.uniqueId}`, {width:512,height:128}, scene, false);
    const ctx = texture.getContext();
    ctx.clearRect(0,0,512,128);
    ctx.fillStyle='rgba(4,24,23,.88)'; ctx.fillRect(8,8,496,112);
    ctx.strokeStyle=role==='admin'?'#fed141':'#8ad8c6'; ctx.lineWidth=6; ctx.strokeRect(8,8,496,112);
    ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font='bold 44px Segoe UI, Arial';
    ctx.fillText(String(text||'Participante').slice(0,28),256,64); texture.update();
    const mat = new BABYLON.StandardMaterial(`avatar-name-mat-${root.uniqueId}`,scene);
    mat.diffuseTexture=texture; mat.emissiveTexture=texture; mat.disableLighting=true; mat.backFaceCulling=false; mat.useAlphaFromDiffuseTexture=true;
    const plane = BABYLON.MeshBuilder.CreatePlane(`avatar-name-${root.uniqueId}`,{width:2.15,height:.54,sideOrientation:BABYLON.Mesh.DOUBLESIDE},scene);
    plane.position.set(0,3.35,0); plane.billboardMode=BABYLON.Mesh.BILLBOARDMODE_ALL; plane.material=mat; parent(plane,root,{namePlate:true});
    return plane;
  }

  function create(scene, rawConfig = {}, options = {}) {
    const cfg = config(rawConfig);
    const root = new BABYLON.TransformNode(options.name || `avatar-${Date.now()}`, scene);
    root.metadata = { avatar:true, userId:options.userId || '', local:Boolean(options.local), config:cfg };
    root.scaling.setAll(Number(options.scale || 1));

    const skin = material(scene,`${root.name}-skin`,cfg.skinTone,'#dca27b');
    const hair = material(scene,`${root.name}-hair`,cfg.hairColor,'#17110f');
    const top = material(scene,`${root.name}-top`,cfg.topColor,'#007b5f');
    const bottom = material(scene,`${root.name}-bottom`,cfg.bottomColor,'#152d30');
    const shoes = material(scene,`${root.name}-shoes`,cfg.shoeColor,'#ffffff');
    const dark = material(scene,`${root.name}-dark`,'#13211f','#13211f');
    const metal = material(scene,`${root.name}-metal`,'#9fb5b0','#9fb5b0',.08);

    const parts = {};
    parts.hips = box(scene,'avatar-cadera',new BABYLON.Vector3(.68,.34,.38),new BABYLON.Vector3(0,1.08,0),bottom,root);
    const torsoSize = cfg.topStyle==='formal' ? new BABYLON.Vector3(.9,1.18,.46) : cfg.topStyle==='sudadera' ? new BABYLON.Vector3(.96,1.14,.5) : new BABYLON.Vector3(.82,1.12,.42);
    parts.torso = box(scene,'avatar-torso',torsoSize,new BABYLON.Vector3(0,1.73,0),top,root);
    if (cfg.topStyle==='chaqueta' || cfg.topStyle==='formal') {
      const lapel = box(scene,'avatar-solapa',new BABYLON.Vector3(.12,.62,.04),new BABYLON.Vector3(-.12,1.82,-.24),dark,root); lapel.rotation.z=-.25;
      const lapel2 = box(scene,'avatar-solapa',new BABYLON.Vector3(.12,.62,.04),new BABYLON.Vector3(.12,1.82,-.24),dark,root); lapel2.rotation.z=.25;
    }
    parts.neck = cylinder(scene,'avatar-cuello',.22,.24,new BABYLON.Vector3(0,2.35,0),skin,root);
    parts.head = sphere(scene,'avatar-cabeza',.78,new BABYLON.Vector3(0,2.72,0),skin,root,24);
    // Ojos y rostro mirando hacia -Z.
    const eyeMat = material(scene,`${root.name}-eyes`,'#182525','#182525',.2);
    box(scene,'avatar-ojo-izq',new BABYLON.Vector3(.08,.05,.035),new BABYLON.Vector3(-.14,2.79,-.385),eyeMat,root);
    box(scene,'avatar-ojo-der',new BABYLON.Vector3(.08,.05,.035),new BABYLON.Vector3(.14,2.79,-.385),eyeMat,root);
    box(scene,'avatar-boca',new BABYLON.Vector3(.18,.025,.025),new BABYLON.Vector3(0,2.57,-.39),dark,root);

    // Cabello.
    if (cfg.hairStyle !== 'sin-cabello') {
      const hairCap = sphere(scene,'avatar-cabello',.81,new BABYLON.Vector3(0,2.84,.02),hair,root,20);
      hairCap.scaling.y = cfg.hairStyle==='rapado' ? .28 : .48; hairCap.position.y = cfg.hairStyle==='rapado' ? 2.93 : 2.88;
      if (cfg.hairStyle==='largo') {
        const back = box(scene,'avatar-cabello-largo',new BABYLON.Vector3(.68,.9,.22),new BABYLON.Vector3(0,2.46,.26),hair,root); back.rotation.x=.05;
      } else if (cfg.hairStyle==='rizado') {
        for (let i=0;i<8;i++) {
          const angle=(i/8)*Math.PI*2; sphere(scene,`avatar-rizo-${i}`,.25,new BABYLON.Vector3(Math.cos(angle)*.34,2.94+Math.sin(i)*.05,Math.sin(angle)*.25),hair,root,10);
        }
      } else if (cfg.hairStyle==='moño') {
        sphere(scene,'avatar-moño',.34,new BABYLON.Vector3(0,3.25,.12),hair,root,14);
      }
    }

    // Brazos y piernas.
    parts.leftArm = cylinder(scene,'avatar-brazo-izq',1.03,.25,new BABYLON.Vector3(-.57,1.72,0),skin,root); parts.leftArm.rotation.z=-.08;
    parts.rightArm = cylinder(scene,'avatar-brazo-der',1.03,.25,new BABYLON.Vector3(.57,1.72,0),skin,root); parts.rightArm.rotation.z=.08;
    const sleeveHeight = cfg.topStyle==='camiseta' ? .38 : .68;
    cylinder(scene,'avatar-manga-izq',sleeveHeight,.31,new BABYLON.Vector3(-.54,2.02,0),top,root).rotation.z=-.08;
    cylinder(scene,'avatar-manga-der',sleeveHeight,.31,new BABYLON.Vector3(.54,2.02,0),top,root).rotation.z=.08;
    parts.leftLeg = cylinder(scene,'avatar-pierna-izq',1.08,.3,new BABYLON.Vector3(-.21,.55,0),bottom,root);
    parts.rightLeg = cylinder(scene,'avatar-pierna-der',1.08,.3,new BABYLON.Vector3(.21,.55,0),bottom,root);
    const shoeDepth = cfg.shoeStyle==='botas' ? .5 : .58;
    parts.leftShoe = box(scene,'avatar-zapato-izq',new BABYLON.Vector3(.34,cfg.shoeStyle==='botas'?.3:.22,shoeDepth),new BABYLON.Vector3(-.21,.05,-.1),shoes,root);
    parts.rightShoe = box(scene,'avatar-zapato-der',new BABYLON.Vector3(.34,cfg.shoeStyle==='botas'?.3:.22,shoeDepth),new BABYLON.Vector3(.21,.05,-.1),shoes,root);

    // Accesorios acumulables.
    for (const accessory of cfg.accessories) {
      if (accessory==='gafas') {
        const left = BABYLON.MeshBuilder.CreateTorus('avatar-gafa-izq',{diameter:.26,thickness:.035,tessellation:18},scene); left.position.set(-.15,2.78,-.4); left.rotation.x=Math.PI/2; left.material=dark; parent(left,root);
        const right = BABYLON.MeshBuilder.CreateTorus('avatar-gafa-der',{diameter:.26,thickness:.035,tessellation:18},scene); right.position.set(.15,2.78,-.4); right.rotation.x=Math.PI/2; right.material=dark; parent(right,root);
        box(scene,'avatar-puente-gafas',new BABYLON.Vector3(.12,.035,.035),new BABYLON.Vector3(0,2.78,-.42),dark,root);
      } else if (accessory==='gorra') {
        const cap = cylinder(scene,'avatar-gorra',.18,.82,new BABYLON.Vector3(0,3.12,0),top,root,24);
        box(scene,'avatar-visera',new BABYLON.Vector3(.55,.06,.34),new BABYLON.Vector3(0,3.08,-.38),top,root);
      } else if (accessory==='sombrero') {
        cylinder(scene,'avatar-sombrero-copa',.35,.68,new BABYLON.Vector3(0,3.2,0),top,root,24);
        cylinder(scene,'avatar-sombrero-ala',.08,1.15,new BABYLON.Vector3(0,3.06,0),top,root,32);
      } else if (accessory==='mochila') {
        const pack = box(scene,'avatar-mochila',new BABYLON.Vector3(.64,.88,.28),new BABYLON.Vector3(0,1.72,.35),top,root);
        pack.material = material(scene,`${root.name}-pack`,'#4b3d31','#4b3d31');
      } else if (accessory==='audífonos') {
        const band = BABYLON.MeshBuilder.CreateTorus('avatar-audifonos',{diameter:.78,thickness:.08,tessellation:24},scene); band.position.set(0,2.84,0); band.rotation.z=Math.PI/2; band.scaling.y=.7; band.material=metal; parent(band,root);
        box(scene,'avatar-audifono-izq',new BABYLON.Vector3(.12,.32,.16),new BABYLON.Vector3(-.41,2.75,0),dark,root);
        box(scene,'avatar-audifono-der',new BABYLON.Vector3(.12,.32,.16),new BABYLON.Vector3(.41,2.75,0),dark,root);
      } else if (accessory==='bufanda') {
        const scarf = BABYLON.MeshBuilder.CreateTorus('avatar-bufanda',{diameter:.48,thickness:.11,tessellation:24},scene); scarf.position.set(0,2.32,0); scarf.rotation.x=Math.PI/2; scarf.material=top; parent(scarf,root);
      }
    }

    if (options.label !== false) parts.namePlate = namePlate(scene,root,options.displayName || 'Participante',options.role || 'user');

    let lastWalk = 0;
    function animate(walking, elapsedSeconds) {
      const phase = elapsedSeconds * 7;
      const amount = walking ? Math.sin(phase) * .42 : 0;
      parts.leftArm.rotation.x = amount; parts.rightArm.rotation.x = -amount;
      parts.leftLeg.rotation.x = -amount * .6; parts.rightLeg.rotation.x = amount * .6;
      parts.leftShoe.rotation.x = parts.leftLeg.rotation.x; parts.rightShoe.rotation.x = parts.rightLeg.rotation.x;
      lastWalk = amount;
    }
    function dispose() {
      try { root.getChildMeshes().forEach(mesh => { try { mesh.material?.diffuseTexture?.dispose?.(); } catch {} try { mesh.material?.dispose?.(); } catch {} mesh.dispose(); }); } catch {}
      root.dispose();
    }
    return { root, parts, config:cfg, animate, dispose, setVisible(value){ root.setEnabled(Boolean(value)); }, get lastWalk(){ return lastWalk; } };
  }

  window.UCANAvatar = { create, defaults:DEFAULTS, normalize:config };
})();
