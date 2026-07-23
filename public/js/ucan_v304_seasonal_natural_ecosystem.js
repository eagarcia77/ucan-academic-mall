(() => {
  'use strict';

  const VERSION = 'V304';
  const BUILD = 'V304-20260723-SEASONAL-NATURAL-ECOSYSTEM-PR';
  const TIME_ZONE = 'America/Puerto_Rico';
  const B = window.BABYLON;
  if (!B) return;

  const SEASONS = Object.freeze({
    spring:{ key:'spring', label:'Primavera', range:'20 mar – 20 jun', leaf:'#3f9f55', leaf2:'#72c96b', flower:'#ff6fae', accent:'#f6c453', ground:'#315f38' },
    summer:{ key:'summer', label:'Verano', range:'21 jun – 21 sep', leaf:'#237a3b', leaf2:'#43a955', flower:'#ff553b', accent:'#ffd44d', ground:'#285c34' },
    autumn:{ key:'autumn', label:'Otoño', range:'22 sep – 20 dic', leaf:'#547c39', leaf2:'#a36b2d', flower:'#e18a32', accent:'#f1c05a', ground:'#465b32' },
    winter:{ key:'winter', label:'Invierno', range:'21 dic – 19 mar', leaf:'#2d6c52', leaf2:'#5f9782', flower:'#9fd5ee', accent:'#d8edf6', ground:'#34564a' }
  });

  const FIXED_EVENTS = Object.freeze([
    { month:1, day:1, title:'Año Nuevo', category:'Día festivo', theme:'new-year' },
    { month:1, day:6, title:'Día de Reyes', category:'Tradición puertorriqueña', theme:'reyes' },
    { month:3, day:22, title:'Día de la Abolición de la Esclavitud en Puerto Rico', category:'Conmemoración histórica', theme:'heritage' },
    { month:6, day:19, title:'Juneteenth', category:'Día festivo', theme:'heritage' },
    { month:6, day:24, title:'Noche de San Juan', category:'Tradición cultural de Puerto Rico', theme:'san-juan' },
    { month:7, day:4, title:'Día de la Independencia de Estados Unidos', category:'Día festivo', theme:'patriotic-us' },
    { month:7, day:24, title:'Día de la Bandera, Himno y Escudo de Puerto Rico', category:'Conmemoración puertorriqueña', theme:'puerto-rico' },
    { month:7, day:25, title:'Día de la Constitución de Puerto Rico', category:'Día festivo de Puerto Rico', theme:'puerto-rico' },
    { month:7, day:27, title:'Natalicio de José Celso Barbosa', category:'Día festivo de Puerto Rico', theme:'puerto-rico' },
    { month:11, day:11, title:'Día del Veterano', category:'Día festivo', theme:'veterans' },
    { month:11, day:19, title:'Día del Descubrimiento de Puerto Rico y de la Puertorriqueñidad', category:'Día festivo de Puerto Rico', theme:'puerto-rico' },
    { month:12, day:25, title:'Navidad', category:'Día festivo', theme:'christmas' }
  ]);

  const state = {
    scene:null,
    root:null,
    celebrationRoot:null,
    installed:false,
    questMode:false,
    dateKey:null,
    season:null,
    celebration:null,
    materials:{},
    signs:{},
    animated:[],
    treeCount:0,
    palmCount:0,
    bushCount:0,
    flowerCount:0,
    rockCount:0,
    lightCount:0,
    flagCount:0,
    butterflyCount:0,
    lastError:null,
    refreshTimer:null
  };

  const color = hex => B.Color3.FromHexString(hex);
  const finite = value => Number.isFinite(Number(value));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function questDetected() {
    const ua = String(navigator.userAgent || '');
    const brands = Array.isArray(navigator.userAgentData?.brands)
      ? navigator.userAgentData.brands.map(item => item?.brand || '').join(' ')
      : '';
    return /OculusBrowser|Meta Quest|Quest 2|Quest 3|Quest Pro/i.test(`${ua} ${brands}`);
  }

  function puertoRicoNow() {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone:TIME_ZONE,
      year:'numeric', month:'2-digit', day:'2-digit', weekday:'long'
    }).formatToParts(new Date()).map(part => [part.type, part.value]));
    const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return {
      year, month, day,
      date,
      key:`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      label:new Intl.DateTimeFormat('es-PR', {
        timeZone:TIME_ZONE, weekday:'long', year:'numeric', month:'long', day:'numeric'
      }).format(new Date())
    };
  }

  function seasonFor(month, day) {
    const md = month * 100 + day;
    if (md >= 320 && md <= 620) return SEASONS.spring;
    if (md >= 621 && md <= 921) return SEASONS.summer;
    if (md >= 922 && md <= 1220) return SEASONS.autumn;
    return SEASONS.winter;
  }

  function nthWeekday(year, month, weekday, nth) {
    const first = new Date(Date.UTC(year, month - 1, 1, 12));
    const day = 1 + ((7 + weekday - first.getUTCDay()) % 7) + (nth - 1) * 7;
    return { year, month, day };
  }

  function lastWeekday(year, month, weekday) {
    const last = new Date(Date.UTC(year, month, 0, 12));
    return { year, month, day:last.getUTCDate() - ((7 + last.getUTCDay() - weekday) % 7) };
  }

  function eventsForYear(year) {
    const events = FIXED_EVENTS.map(event => ({ ...event, year }));
    events.push(
      { ...nthWeekday(year, 1, 1, 3), title:'Natalicio de Martin Luther King, Jr.', category:'Día festivo', theme:'heritage' },
      { ...nthWeekday(year, 2, 1, 3), title:'Día de los Presidentes', category:'Día festivo', theme:'patriotic-us' },
      { ...lastWeekday(year, 5, 1), title:'Día de la Recordación', category:'Día festivo', theme:'veterans' },
      { ...nthWeekday(year, 9, 1, 1), title:'Día del Trabajo', category:'Día festivo', theme:'labor' },
      { ...nthWeekday(year, 10, 1, 2), title:'Día de la Raza', category:'Día festivo', theme:'heritage' },
      { ...nthWeekday(year, 11, 4, 4), title:'Día de Acción de Gracias', category:'Día festivo', theme:'thanksgiving' }
    );
    return events.sort((a, b) => Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day));
  }

  function celebrationFor(now) {
    const today = Date.UTC(now.year, now.month - 1, now.day);
    const events = [...eventsForYear(now.year), ...eventsForYear(now.year + 1)];
    let nearest = null;
    for (const event of events) {
      const eventTime = Date.UTC(event.year, event.month - 1, event.day);
      const daysAway = Math.round((eventTime - today) / 86400000);
      if (daysAway < 0) continue;
      if (!nearest || daysAway < nearest.daysAway) nearest = { ...event, daysAway };
      if (daysAway === 0) break;
    }
    return nearest && nearest.daysAway <= 7 ? nearest : null;
  }

  function makeMaterial(name, hex, options = {}) {
    const material = new B.StandardMaterial(name, state.scene);
    material.diffuseColor = color(hex);
    material.emissiveColor = options.emissive ? color(options.emissive) : B.Color3.Black();
    material.specularColor = options.specular ? color(options.specular) : new B.Color3(0.05, 0.05, 0.05);
    material.alpha = options.alpha == null ? 1 : options.alpha;
    material.backFaceCulling = options.backFaceCulling !== false;
    if (options.disableLighting) material.disableLighting = true;
    return material;
  }

  function track(mesh, metadata = {}) {
    mesh.parent = state.root;
    mesh.checkCollisions = false;
    mesh.metadata = { ...(mesh.metadata || {}), ecosystemV304:true, decorative:true, ...metadata };
    return mesh;
  }

  function createCylinder(name, position, height, diameter, material, tessellation = 10) {
    const mesh = B.MeshBuilder.CreateCylinder(name, { height, diameter, tessellation }, state.scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    return track(mesh);
  }

  function createSphere(name, position, diameter, material, segments = 8) {
    const mesh = B.MeshBuilder.CreateSphere(name, { diameter, segments }, state.scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    return track(mesh);
  }

  function createTree(x, z, scale = 1, flamboyan = false) {
    const trunkHeight = 5.8 * scale;
    createCylinder(`tronco árbol ecosistema V304 ${state.treeCount}`, new B.Vector3(x, trunkHeight / 2, z), trunkHeight, 0.65 * scale, state.materials.trunk, 10);
    const crownY = trunkHeight + 1.3 * scale;
    const crownMat = flamboyan ? state.materials.leaf2 : state.materials.leaf;
    [[0,0,4.2],[-1.5,0.15,3.2],[1.45,0.1,3.3],[0,0.8,3.2]].forEach((item, index) => {
      createSphere(`copa árbol ecosistema V304 ${state.treeCount}-${index}`, new B.Vector3(x + item[0] * scale, crownY + item[1] * scale, z), item[2] * scale, crownMat, 8);
    });
    if (flamboyan) {
      const blossomCount = state.questMode ? 6 : 11;
      for (let i = 0; i < blossomCount; i += 1) {
        const angle = i * 2.399;
        const radius = (1.1 + (i % 3) * 0.65) * scale;
        createSphere(`flor flamboyán V304 ${state.treeCount}-${i}`, new B.Vector3(
          x + Math.cos(angle) * radius,
          crownY + 0.6 * scale + Math.sin(i * 1.7) * 0.7 * scale,
          z + Math.sin(angle) * radius
        ), 0.48 * scale, state.materials.flower, 6);
      }
    }
    state.treeCount += 1;
  }

  function createPalm(x, z, scale = 1) {
    const height = 7.2 * scale;
    createCylinder(`tronco palma ecosistema V304 ${state.palmCount}`, new B.Vector3(x, height / 2, z), height, 0.48 * scale, state.materials.palmTrunk, 9);
    const leaves = state.questMode ? 5 : 8;
    for (let i = 0; i < leaves; i += 1) {
      const angle = i * Math.PI * 2 / leaves;
      const leaf = B.MeshBuilder.CreateCylinder(`hoja palma ecosistema V304 ${state.palmCount}-${i}`, {
        height:4.2 * scale, diameterTop:0.05, diameterBottom:0.34 * scale, tessellation:6
      }, state.scene);
      leaf.position.set(x + Math.cos(angle) * 1.35 * scale, height + 0.35 * scale, z + Math.sin(angle) * 1.35 * scale);
      leaf.rotation.z = Math.PI / 2.7;
      leaf.rotation.y = -angle;
      leaf.material = state.materials.leaf;
      track(leaf);
    }
    createSphere(`corona palma V304 ${state.palmCount}`, new B.Vector3(x, height, z), 0.95 * scale, state.materials.leaf2, 7);
    state.palmCount += 1;
  }

  function createBush(x, z, scale = 1, flowering = false) {
    const material = flowering ? state.materials.leaf2 : state.materials.leaf;
    createSphere(`arbusto ecosistema V304 ${state.bushCount}`, new B.Vector3(x, 0.85 * scale, z), 2.0 * scale, material, 7);
    if (flowering) {
      for (let i = 0; i < 3; i += 1) {
        createSphere(`flor arbusto V304 ${state.bushCount}-${i}`, new B.Vector3(x + (i - 1) * 0.55 * scale, 1.35 * scale, z + (i % 2 ? 0.35 : -0.3) * scale), 0.32 * scale, state.materials.accent, 5);
        state.flowerCount += 1;
      }
    }
    state.bushCount += 1;
  }

  function createRock(x, z, scale = 1) {
    const rock = B.MeshBuilder.CreateSphere(`roca jardín V304 ${state.rockCount}`, { diameter:1.4 * scale, segments:5 }, state.scene);
    rock.scaling.set(1.35, 0.65, 1.0);
    rock.position.set(x, 0.42 * scale, z);
    rock.rotation.y = state.rockCount * 0.71;
    rock.material = state.materials.rock;
    track(rock);
    state.rockCount += 1;
  }

  function createGardenLight(x, z) {
    createCylinder(`poste luz jardín V304 ${state.lightCount}`, new B.Vector3(x, 0.75, z), 1.5, 0.12, state.materials.metal, 8);
    const lamp = createSphere(`luz jardín V304 ${state.lightCount}`, new B.Vector3(x, 1.58, z), 0.32, state.materials.lamp, 6);
    lamp.material.disableLighting = true;
    state.lightCount += 1;
  }

  function wrapLines(ctx, text, maxWidth) {
    const paragraphs = String(text || '').split('\n');
    const lines = [];
    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/).filter(Boolean);
      let line = '';
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = test;
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  function createBoard(name, position, width, height, key) {
    const texture = new B.DynamicTexture(`${name} textura`, { width:1024, height:512 }, state.scene, false);
    texture.hasAlpha = false;
    const material = new B.StandardMaterial(`${name} material`, state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    const mesh = B.MeshBuilder.CreatePlane(name, { width, height, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.isPickable = true;
    mesh.billboardMode = B.Mesh.BILLBOARDMODE_Y;
    track(mesh, { livePanel:true, livePanelKey:key, readableSign:true, seasonalBoard:true, title:name });
    if (B.ActionManager && B.ExecuteCodeAction) {
      mesh.actionManager = new B.ActionManager(state.scene);
      mesh.actionManager.registerAction(new B.ExecuteCodeAction(B.ActionManager.OnPickTrigger, () => {
        window.__UCAN_UNIVERSAL_SIGN_WINDOW__?.openPanelByMesh?.(mesh);
      }));
    }
    return { mesh, texture, material };
  }

  function drawBoard(board, options) {
    const ctx = board.texture.getContext();
    ctx.clearRect(0, 0, 1024, 512);
    ctx.fillStyle = options.background || '#143c2d';
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = options.band || '#e9b929';
    ctx.fillRect(0, 0, 1024, 56);
    ctx.fillRect(0, 474, 1024, 38);
    ctx.strokeStyle = options.border || '#f5e6aa';
    ctx.lineWidth = 12;
    ctx.strokeRect(12, 12, 1000, 488);
    ctx.textAlign = 'center';
    ctx.fillStyle = options.titleColor || '#ffffff';
    ctx.font = 'bold 54px Arial';
    ctx.fillText(options.title || '', 512, 132);
    ctx.font = 'bold 76px Arial';
    ctx.fillStyle = options.highlight || '#ffd44d';
    ctx.fillText(options.highlightText || '', 512, 230);
    ctx.font = '34px Arial';
    ctx.fillStyle = '#ffffff';
    const lines = wrapLines(ctx, options.body || '', 870).slice(0, 4);
    lines.forEach((line, index) => ctx.fillText(line, 512, 304 + index * 42));
    board.texture.update(false);
  }

  function createPuertoRicoFlag(name, x, y, z, scale = 1) {
    const pole = createCylinder(`${name} poste`, new B.Vector3(x, y / 2, z), y, 0.10 * scale, state.materials.metal, 8);
    pole.parent = state.celebrationRoot;
    const texture = new B.DynamicTexture(`${name} textura`, { width:600, height:360 }, state.scene, false);
    const ctx = texture.getContext();
    const stripe = 72;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i % 2 === 0 ? '#d71920' : '#ffffff';
      ctx.fillRect(0, i * stripe, 600, stripe);
    }
    ctx.fillStyle = '#0050a4';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(270, 180); ctx.lineTo(0, 360); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '150px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', 95, 180);
    texture.update(false);
    const material = new B.StandardMaterial(`${name} material`, state.scene);
    material.diffuseTexture = texture;
    material.emissiveTexture = texture;
    material.disableLighting = true;
    material.backFaceCulling = false;
    const flag = B.MeshBuilder.CreatePlane(name, { width:4.8 * scale, height:2.9 * scale, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
    flag.position.set(x + 2.45 * scale, y - 1.5 * scale, z);
    flag.material = material;
    flag.parent = state.celebrationRoot;
    flag.isPickable = false;
    flag.metadata = { ecosystemV304:true, puertoRicoFlag:true, decorative:true };
    state.flagCount += 1;
  }

  function createCelebrationDecorations() {
    state.celebrationRoot = new B.TransformNode('Decoraciones celebraciones Puerto Rico V304', state.scene);
    state.celebrationRoot.parent = state.root;
    createPuertoRicoFlag('Bandera Puerto Rico ecosistema V304 oeste', -19, 8.2, 55.2, 1);
    createPuertoRicoFlag('Bandera Puerto Rico ecosistema V304 este', 13, 8.2, 55.2, 1);
    const colors = [state.materials.red, state.materials.white, state.materials.blue];
    for (let i = 0; i < 17; i += 1) {
      const bead = createSphere(`guirnalda Puerto Rico V304 ${i}`, new B.Vector3(-16 + i * 2, 6.8 + Math.sin(i * Math.PI / 16) * 1.2, 54.8), 0.38, colors[i % 3], 6);
      bead.parent = state.celebrationRoot;
    }
    state.celebrationRoot.setEnabled(false);
  }

  function createButterfly(index, centerX, centerZ) {
    const pivot = new B.TransformNode(`mariposa ecosistema V304 ${index}`, state.scene);
    pivot.parent = state.root;
    const wingMaterial = index % 2 ? state.materials.butterflyBlue : state.materials.butterflyOrange;
    for (const side of [-1, 1]) {
      const wing = B.MeshBuilder.CreatePlane(`ala mariposa V304 ${index}-${side}`, { width:0.42, height:0.28, sideOrientation:B.Mesh.DOUBLESIDE }, state.scene);
      wing.position.set(side * 0.19, 0, 0);
      wing.rotation.y = side * 0.35;
      wing.material = wingMaterial;
      wing.isPickable = false;
      wing.parent = pivot;
    }
    pivot.position.set(centerX, 2.2 + (index % 3) * 0.45, centerZ);
    state.animated.push({ node:pivot, centerX, centerZ, radius:2.5 + index * 0.35, speed:0.35 + index * 0.04, phase:index * 1.3 });
    state.butterflyCount += 1;
  }

  function buildEcosystem() {
    state.root = new B.TransformNode('Ecosistema natural estacional UCAN V304', state.scene);
    state.questMode = questDetected();

    state.materials.trunk = makeMaterial('tronco natural V304', '#6b4328');
    state.materials.palmTrunk = makeMaterial('tronco palma V304', '#8a633b');
    state.materials.leaf = makeMaterial('hojas estación V304', '#237a3b');
    state.materials.leaf2 = makeMaterial('hojas secundarias estación V304', '#43a955');
    state.materials.flower = makeMaterial('flores estación V304', '#ff553b', { emissive:'#3b100b' });
    state.materials.accent = makeMaterial('flores acento estación V304', '#ffd44d', { emissive:'#392b08' });
    state.materials.rock = makeMaterial('piedras jardín V304', '#6f756d');
    state.materials.metal = makeMaterial('metal jardín V304', '#273331');
    state.materials.lamp = makeMaterial('luz jardín V304', '#ffe39a', { emissive:'#ffe39a', disableLighting:true });
    state.materials.red = makeMaterial('rojo Puerto Rico V304', '#d71920', { emissive:'#42080b' });
    state.materials.white = makeMaterial('blanco Puerto Rico V304', '#ffffff', { emissive:'#343434' });
    state.materials.blue = makeMaterial('azul Puerto Rico V304', '#0050a4', { emissive:'#071e42' });
    state.materials.butterflyBlue = makeMaterial('mariposa azul V304', '#39bde8', { emissive:'#0b3240', backFaceCulling:false });
    state.materials.butterflyOrange = makeMaterial('mariposa naranja V304', '#f09a36', { emissive:'#462405', backFaceCulling:false });

    const flamboyanPositions = [[-66,-42,1.05],[65,-40,1.0],[-62,40,0.95],[62,39,1.0]];
    const treePositions = [[-43,-55,0.85],[42,-55,0.85],[-70,-8,0.9],[70,-5,0.9],[-45,54,0.8],[43,54,0.8]];
    const palmPositions = [[-57,-50,0.9],[56,-50,0.9],[-68,25,0.86],[68,25,0.86],[-22,56,0.75],[22,56,0.75]];
    const factor = state.questMode ? 0.72 : 1;
    flamboyanPositions.slice(0, state.questMode ? 3 : flamboyanPositions.length).forEach(([x,z,s]) => createTree(x,z,s * factor,true));
    treePositions.slice(0, state.questMode ? 4 : treePositions.length).forEach(([x,z,s]) => createTree(x,z,s * factor,false));
    palmPositions.slice(0, state.questMode ? 4 : palmPositions.length).forEach(([x,z,s]) => createPalm(x,z,s * factor));

    const bushPositions = [
      [-69,-28],[-69,9],[-67,48],[-52,55],[-34,56],[-12,56],[12,56],[34,56],[52,55],[67,48],
      [69,8],[69,-27],[55,-55],[32,-56],[10,-56],[-10,-56],[-32,-56],[-55,-55]
    ];
    bushPositions.slice(0, state.questMode ? 12 : bushPositions.length).forEach(([x,z], index) => createBush(x,z,0.8 + (index % 3) * 0.12,index % 2 === 0));

    const rockPositions = [[-71,-18],[-70,34],[-48,57],[-26,57],[26,57],[48,57],[70,34],[71,-18],[48,-57],[22,-57],[-22,-57],[-48,-57]];
    rockPositions.slice(0, state.questMode ? 7 : rockPositions.length).forEach(([x,z], index) => createRock(x,z,0.75 + (index % 3) * 0.15));

    const lightPositions = [[-38,53],[-19,53],[0,53],[19,53],[38,53],[-64,30],[64,30],[-64,-30],[64,-30]];
    lightPositions.slice(0, state.questMode ? 6 : lightPositions.length).forEach(([x,z]) => createGardenLight(x,z));

    state.signs.season = createBoard('Cartel estación actual V304', new B.Vector3(-22, 4.4, 53.8), 13.5, 6.3, 'season-current-v304');
    state.signs.celebration = createBoard('Cartel celebración Puerto Rico V304', new B.Vector3(22, 4.4, 53.8), 13.5, 6.3, 'pr-celebration-v304');
    state.signs.fourSeasons = createBoard('Cartel cuatro estaciones V304', new B.Vector3(0, 3.6, -56.2), 15.5, 5.2, 'four-seasons-v304');

    createCelebrationDecorations();
    const butterflies = state.questMode ? 2 : 6;
    for (let i = 0; i < butterflies; i += 1) createButterfly(i, i % 2 ? 60 : -60, -30 + i * 12);

    state.scene.onBeforeRenderObservable.add(() => {
      const seconds = performance.now() / 1000;
      for (const item of state.animated) {
        item.node.position.x = item.centerX + Math.cos(seconds * item.speed + item.phase) * item.radius;
        item.node.position.z = item.centerZ + Math.sin(seconds * item.speed + item.phase) * item.radius;
        item.node.position.y = 2.1 + Math.sin(seconds * 1.7 + item.phase) * 0.55;
        item.node.rotation.y = -(seconds * item.speed + item.phase) + Math.PI / 2;
      }
    });
  }

  function applySeason(season) {
    state.season = season;
    state.materials.leaf.diffuseColor = color(season.leaf);
    state.materials.leaf2.diffuseColor = color(season.leaf2);
    state.materials.flower.diffuseColor = color(season.flower);
    state.materials.accent.diffuseColor = color(season.accent);
    drawBoard(state.signs.season, {
      title:'ESTACIÓN ACTUAL',
      highlightText:season.label.toUpperCase(),
      body:`${season.range}\nEcosistema tropical de San Germán, Puerto Rico`,
      background:season.ground,
      band:season.accent,
      highlight:season.flower
    });
    drawBoard(state.signs.fourSeasons, {
      title:'LAS CUATRO ESTACIONES',
      highlightText:season.label.toUpperCase(),
      body:'Primavera  •  Verano  •  Otoño  •  Invierno\nLa estación vigente aparece resaltada.',
      background:'#203d32',
      band:season.accent,
      highlight:season.flower
    });
  }

  function applyCelebration(event, now) {
    state.celebration = event;
    const exact = event?.daysAway === 0;
    const nearPuertoRico = event?.theme === 'puerto-rico' && event.daysAway <= 3;
    state.celebrationRoot?.setEnabled(Boolean(nearPuertoRico));
    const heading = exact ? 'HOY SE CELEBRA' : event ? 'PRÓXIMA CELEBRACIÓN' : 'PUERTO RICO HOY';
    const highlightText = event
      ? `${event.day} DE ${new Intl.DateTimeFormat('es-PR', { month:'long', timeZone:TIME_ZONE }).format(new Date(Date.UTC(event.year, event.month - 1, event.day))).toUpperCase()}`
      : now.label.split(',')[0].toUpperCase();
    const body = event
      ? `${event.title}\n${event.category}${exact ? '' : ` · dentro de ${event.daysAway} día${event.daysAway === 1 ? '' : 's'}`}`
      : `${now.label}\nNaturaleza, educación, comunidad y futuro.`;
    drawBoard(state.signs.celebration, {
      title:heading,
      highlightText,
      body,
      background:event?.theme === 'puerto-rico' ? '#123f6c' : '#3e2d4d',
      band:event?.theme === 'puerto-rico' ? '#d71920' : '#e9b929',
      highlight:'#ffffff'
    });
    state.signs.celebration.mesh.metadata = {
      ...(state.signs.celebration.mesh.metadata || {}),
      celebrationTitle:event?.title || 'Puerto Rico hoy',
      celebrationCategory:event?.category || 'Información diaria',
      celebrationDate:event ? `${event.year}-${String(event.month).padStart(2,'0')}-${String(event.day).padStart(2,'0')}` : now.key,
      daysAway:event?.daysAway ?? null
    };
  }

  function refreshCalendar(force = false) {
    const now = puertoRicoNow();
    if (!force && state.dateKey === now.key) return;
    state.dateKey = now.key;
    const season = seasonFor(now.month, now.day);
    const celebration = celebrationFor(now);
    applySeason(season);
    applyCelebration(celebration, now);
    updateAudit(now);
  }

  function recordError(stage, error) {
    state.lastError = {
      stage,
      name:String(error?.name || 'Error'),
      message:String(error?.message || error || 'Error desconocido'),
      at:new Date().toISOString()
    };
    console.error(`[UCAN ${VERSION}] ${stage}:`, error);
    updateAudit();
  }

  function updateAudit(now = puertoRicoNow()) {
    window.__UCAN_SEASONAL_ECOSYSTEM_V304__ = {
      version:VERSION,
      build:BUILD,
      installed:state.installed,
      timeZone:TIME_ZONE,
      currentDate:now.key,
      currentDateLabel:now.label,
      currentSeason:state.season?.key || seasonFor(now.month, now.day).key,
      currentSeasonLabel:state.season?.label || seasonFor(now.month, now.day).label,
      currentCelebration:state.celebration?.title || null,
      currentCelebrationDaysAway:state.celebration?.daysAway ?? null,
      browserAndQuest:true,
      questOptimized:state.questMode,
      dynamicFourSeasonTheme:true,
      puertoRicoCelebrationCalendar:true,
      officialPuertoRicoDateIdentification:true,
      ecosystemAroundBuilding:true,
      nativeTropicalVisualTheme:true,
      seasonalSignsPickable:true,
      universalWindowIntegration:true,
      puertoRicoFlagsDateAware:true,
      dailyAutomaticRefresh:true,
      treeCount:state.treeCount,
      palmCount:state.palmCount,
      bushCount:state.bushCount,
      flowerCount:state.flowerCount,
      rockCount:state.rockCount,
      lightCount:state.lightCount,
      flagCount:state.flagCount,
      butterflyCount:state.butterflyCount,
      lastError:state.lastError,
      refresh:() => refreshCalendar(true),
      getState:() => ({
        installed:state.installed,
        timeZone:TIME_ZONE,
        currentDate:state.dateKey,
        currentSeason:state.season?.label || null,
        currentCelebration:state.celebration?.title || null,
        celebrationDaysAway:state.celebration?.daysAway ?? null,
        questOptimized:state.questMode,
        trees:state.treeCount,
        palms:state.palmCount,
        bushes:state.bushCount,
        butterflies:state.butterflyCount,
        lastError:state.lastError
      })
    };
  }

  function install(scene) {
    if (state.installed) return;
    state.installed = true;
    state.scene = scene;
    try {
      buildEcosystem();
      refreshCalendar(true);
      state.refreshTimer = window.setInterval(() => {
        try { refreshCalendar(false); } catch (error) { recordError('calendar-refresh', error); }
      }, 60000);
      window.__UCAN_API__?.setStatus?.('UCAN Academic V304: ecosistema tropical, estaciones y celebraciones de Puerto Rico activados.');
      updateAudit();
      console.info(`[UCAN ${VERSION}] Ecosistema natural estacional de Puerto Rico instalado.`);
    } catch (error) {
      recordError('install', error);
    }
  }

  function boot(attempt = 0) {
    const scene = window.__UCAN_API__?.getScene?.();
    if (scene) return install(scene);
    if (attempt < 360) window.setTimeout(() => boot(attempt + 1), 100);
    else recordError('boot', new Error('No se encontró la escena principal de UCAN Academic.'));
  }

  updateAudit();
  boot();
})();
