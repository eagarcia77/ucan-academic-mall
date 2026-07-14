(() => {
  'use strict';

  const SPACES = ['SV-201','SV-202','SV-203','SV-204','SV-205','ANF-301','CAFETERIA','BIBLIOTECA'];
  const LABELS = {
    'SV-201':'SV-201 · Pulse Lab', 'SV-202':'SV-202 · Scenario Lab', 'SV-203':'SV-203 · Sprint Room',
    'SV-204':'SV-204 · Media Studio', 'SV-205':'SV-205 · Research Hub', 'ANF-301':'ANF-301 · Live Stage',
    'CAFETERIA':'Cafetería · Café inteligente', 'BIBLIOTECA':'Biblioteca · Biblioteca inteligente'
  };
  const MENU = [
    {id:'cafe',name:'Café puertorriqueño',price:2.25,tags:['vegano','sin gluten'],kind:'Bebidas'},
    {id:'latte',name:'Latte de vainilla',price:3.75,tags:['vegetariano'],kind:'Bebidas'},
    {id:'wrap',name:'Wrap de pollo y aguacate',price:7.50,tags:['alto en proteína'],kind:'Almuerzo'},
    {id:'bowl',name:'Bowl criollo de vegetales',price:8.25,tags:['vegano','sin gluten'],kind:'Almuerzo'},
    {id:'sandwich',name:'Sándwich integral de pavo',price:6.75,tags:['alto en proteína'],kind:'Desayuno'},
    {id:'fruit',name:'Vaso de frutas frescas',price:4.00,tags:['vegano','sin gluten'],kind:'Desayuno'}
  ];
  const CATALOG = [
    {title:'Diseño instruccional para el aprendizaje en línea',author:'Repositorio UCAN',topic:'Educación en línea',format:'Libro digital'},
    {title:'Investigación educativa aplicada',author:'Colección académica',topic:'Investigación',format:'Libro'},
    {title:'Ciberseguridad y redes modernas',author:'Biblioteca tecnológica',topic:'Tecnología',format:'Libro digital'},
    {title:'Inteligencia artificial en la educación superior',author:'Repositorio institucional',topic:'Inteligencia artificial',format:'Artículo'},
    {title:'Blackboard Ultra: estrategias de diseño y evaluación',author:'UCAN',topic:'Blackboard',format:'Guía'},
    {title:'Metodología de investigación: APA 7',author:'Centro de recursos',topic:'APA',format:'Manual'}
  ];

  let currentSpace = 'SV-201';
  let currentState = {};
  let refreshTimer = null;
  let mediaRecorder = null;
  let mediaChunks = [];
  let mediaStream = null;
  let cart = [];
  let localCountdown = null;

  function esc(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function actor(){return (localStorage.getItem('ucanExperienceName')||'Participante').trim().slice(0,40)||'Participante';}
  function money(value){return `$${Number(value||0).toFixed(2)}`;}

  function injectStyles(){
    const style=document.createElement('style');
    style.textContent=`
      #experiencePanel{position:fixed;inset:0;z-index:46;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(0,0,0,.76);backdrop-filter:blur(9px)}
      #experiencePanel.open{display:flex}.exp-card{width:min(1160px,97vw);max-height:94vh;overflow:auto;background:#f6f8f6;color:#14211e;border:3px solid #007b5f;border-radius:22px;box-shadow:0 28px 90px rgba(0,0,0,.55)}
      .exp-head{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:linear-gradient(120deg,#007b5f,#0b5446);color:#fff}.exp-head h2{margin:0;font-size:19px}.exp-close{background:#fff;color:#17302b;min-width:42px}
      .exp-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) minmax(180px,.7fr) auto;gap:10px;padding:14px 16px;border-bottom:1px solid #d7dfdb;background:#eef4f1}.exp-toolbar input,.exp-toolbar select{width:100%;background:#fff;color:#14211e;border:1px solid #b9c9c2}.exp-status{align-self:end;padding:9px 12px;border-radius:10px;background:#dbece5;color:#174b3f;font-size:12px;font-weight:800}
      #experienceContent{padding:16px}.exp-hero{display:grid;grid-template-columns:1.2fr .8fr;gap:14px;margin-bottom:14px}.exp-box{background:#fff;border:1px solid #ccd7d2;border-radius:15px;padding:14px}.exp-box h3{margin:0 0 8px}.exp-box h4{margin:10px 0 7px}.exp-box p{line-height:1.45}.exp-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.exp-actions button{background:#007b5f;color:#fff}.exp-actions button.alt{background:#e6eee9;color:#17302b;border:1px solid #c7d3cd}.exp-actions button.warn{background:#8d3e32;color:#fff}
      .exp-form{display:grid;grid-template-columns:1fr 1fr;gap:10px}.exp-form .wide{grid-column:1/-1}.exp-form input,.exp-form textarea,.exp-form select{width:100%;background:#fff;color:#14211e;border:1px solid #b9c9c2;border-radius:10px;padding:10px;font:inherit}.exp-form textarea{min-height:86px;resize:vertical}.exp-label{font-size:12px;font-weight:800;margin-bottom:5px;display:block}
      .poll-option{display:grid;grid-template-columns:auto 1fr auto;gap:8px;align-items:center;margin:8px 0}.poll-bar{height:14px;border-radius:8px;background:#e4ece8;overflow:hidden}.poll-bar span{display:block;height:100%;background:linear-gradient(90deg,#007b5f,#28a989)}
      .kanban{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.kanban-col{background:#edf2ef;border:1px solid #ced8d3;border-radius:13px;padding:10px;min-height:180px}.kanban-col h4{margin:0 0 8px}.kanban-card,.exp-item{background:#fff;border:1px solid #cbd6d1;border-radius:11px;padding:10px;margin-bottom:8px}.kanban-card button{font-size:11px;padding:5px 7px}.tag{display:inline-block;border-radius:999px;padding:3px 8px;background:#e4eee9;color:#275a4e;font-size:11px;font-weight:800}.reaction-row{display:flex;gap:8px;flex-wrap:wrap}.reaction-row button{font-size:16px}.menu-grid,.catalog-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.menu-card,.catalog-card{background:#fff;border:1px solid #cbd6d1;border-radius:13px;padding:12px}.menu-card h4,.catalog-card h4{margin:0 0 6px}.queue-number{font-size:42px;font-weight:900;color:#007b5f}.teleprompter{background:#0f1716;color:#f5fff9;border-radius:13px;padding:18px;min-height:180px;font-size:26px;line-height:1.5;overflow:auto}.record-live{background:#9d2f2f!important;color:#fff!important}.countdown{font-size:48px;font-weight:900;text-align:center;color:#007b5f}.small{font-size:12px;color:#567068}.empty{color:#71857c;font-style:italic}
      @media(max-width:820px){.exp-toolbar,.exp-hero,.exp-form,.kanban,.menu-grid,.catalog-grid{grid-template-columns:1fr}.exp-form .wide{grid-column:auto}}
    `;
    document.head.appendChild(style);
  }

  function injectHudButton(){
    const grid=document.querySelector('#hud .grid'); if(!grid||document.getElementById('experiencesBtn')) return;
    const btn=document.createElement('button'); btn.id='experiencesBtn'; btn.className='secondary'; btn.textContent='Experiencias'; btn.addEventListener('click',()=>open(currentSpace)); grid.appendChild(btn);
  }

  function createPanel(){
    const panel=document.createElement('section'); panel.id='experiencePanel'; panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
    panel.innerHTML=`<div class="exp-card"><div class="exp-head"><h2>UCAN Experience Hub V265</h2><button id="experienceClose" class="exp-close" aria-label="Cerrar">×</button></div>
      <div class="exp-toolbar"><div><label class="exp-label" for="experienceSpace">Espacio</label><select id="experienceSpace">${SPACES.map(s=>`<option value="${s}">${LABELS[s]}</option>`).join('')}</select></div>
      <div><label class="exp-label" for="experienceName">Nombre visible</label><input id="experienceName" maxlength="40" value="${esc(actor())}"></div><div id="experienceStatus" class="exp-status">Listo</div></div>
      <div id="experienceContent"></div></div>`;
    document.body.appendChild(panel);
    document.getElementById('experienceClose')?.addEventListener('click',close);
    panel.addEventListener('click',e=>{if(e.target===panel)close();});
    document.getElementById('experienceSpace')?.addEventListener('change',e=>{currentSpace=e.target.value;loadSpace();});
    document.getElementById('experienceName')?.addEventListener('change',e=>localStorage.setItem('ucanExperienceName',e.target.value.trim().slice(0,40)));
  }

  function setStatus(text,error=false){const el=document.getElementById('experienceStatus');if(el){el.textContent=text;el.style.background=error?'#f5d6d1':'#dbece5';el.style.color=error?'#79291f':'#174b3f';}}
  function open(space='SV-201'){currentSpace=SPACES.includes(space)?space:'SV-201';document.getElementById('experienceSpace').value=currentSpace;document.getElementById('experiencePanel').classList.add('open');loadSpace();startRefresh();}
  function close(){document.getElementById('experiencePanel')?.classList.remove('open');stopRefresh();stopRecording(true);}
  function startRefresh(){stopRefresh();refreshTimer=setInterval(()=>{if(document.getElementById('experiencePanel')?.classList.contains('open')&&currentSpace!=='SV-204')loadSpace(true);},4000);}
  function stopRefresh(){if(refreshTimer)clearInterval(refreshTimer);refreshTimer=null;}

  async function getState(){
    const response=await fetch(`/api/collab?space=${encodeURIComponent(currentSpace)}`,{cache:'no-store'});
    if(!response.ok)throw new Error('No se pudo recuperar la actividad.');
    return response.json();
  }
  async function action(actionName,payload={}){
    setStatus('Guardando…');
    const response=await fetch('/api/collab/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({space:currentSpace,action:actionName,payload,actor:actor()})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'No se pudo completar la acción.');
    currentState=data.state||{}; setStatus('Actualizado'); render(); return data;
  }
  async function loadSpace(silent=false){
    if(currentSpace==='SV-204'){currentState={};render();return;}
    try{if(!silent)setStatus('Sincronizando…');const data=await getState();currentState=data.state||{};if(!silent)setStatus('En línea');render();}
    catch(err){setStatus(err.message,true);if(!silent)render();}
  }

  function render(){
    const content=document.getElementById('experienceContent'); if(!content)return;
    const renderers={'SV-201':renderPoll,'SV-202':renderScenario,'SV-203':renderKanban,'SV-204':renderMedia,'SV-205':renderResearch,'ANF-301':renderStage,'CAFETERIA':renderCafe,'BIBLIOTECA':renderLibrary};
    const voiceEnabled=['SV-201','SV-202','SV-203','SV-204','SV-205','ANF-301'].includes(currentSpace);
    content.innerHTML=`<div class="exp-hero"><div class="exp-box"><h3>${LABELS[currentSpace]}</h3><p>${description(currentSpace)}</p>${voiceEnabled?'<p class="small">Esta sala tiene audio independiente: solo escuchará a participantes conectados aquí.</p>':''}</div><div class="exp-box"><h3>Acceso rápido</h3><div class="exp-actions"><button class="alt" data-go-space="${currentSpace}">Ir al espacio 3D</button><button class="alt" id="refreshExperience">Actualizar</button>${voiceEnabled?`<button id="experienceVoiceJoin">🎙 Activar micrófono y escuchar ${currentSpace}</button><button id="experienceVoicePanel" class="alt">Controles de audio</button>`:''}</div></div></div><div id="experienceModule"></div>`;
    document.querySelector('[data-go-space]')?.addEventListener('click',()=>goToSpace(currentSpace));
    document.getElementById('refreshExperience')?.addEventListener('click',()=>loadSpace());
    document.getElementById('experienceVoiceJoin')?.addEventListener('click',()=>window.__UCAN_VOICE__?.joinRoom?.(currentSpace));
    document.getElementById('experienceVoicePanel')?.addEventListener('click',()=>{window.__UCAN_VOICE__?.selectRoom?.(currentSpace,false);window.__UCAN_VOICE__?.openPanel?.();});
    const module=document.getElementById('experienceModule'); module.innerHTML=renderers[currentSpace](); bindModule();
  }

  function description(space){return ({
    'SV-201':'Aprendizaje activo con encuestas rápidas, resultados visuales y comprobación inmediata de comprensión.',
    'SV-202':'Laboratorio de decisiones para resolver escenarios, comparar alternativas y documentar razonamientos.',
    'SV-203':'Sala ágil para organizar proyectos mediante un tablero Kanban compartido.',
    'SV-204':'Estudio de medios con teleprompter, cuenta regresiva y grabación local de audio.',
    'SV-205':'Muro de investigación para reunir evidencia, fuentes, notas y etiquetas temáticas.',
    'ANF-301':'Experiencia de evento en vivo con preguntas, reacciones del público y fila de oradores.',
    'CAFETERIA':'Menú digital con filtros, carrito y turno de recogido para simular una cafetería universitaria inteligente.',
    'BIBLIOTECA':'Catálogo académico y reservación de espacios de estudio en una biblioteca inteligente.'
  })[space]||'';}

  function renderPoll(){
    const poll=currentState.poll||null;
    const total=poll?.options?.reduce((s,o)=>s+Number(o.votes||0),0)||0;
    return `<div class="exp-box"><h3>Crear o actualizar encuesta</h3><div class="exp-form"><div class="wide"><label class="exp-label">Pregunta</label><input id="pollQuestion" value="${esc(poll?.question||'')}"></div><div><label class="exp-label">Opción 1</label><input id="pollOption1" value="${esc(poll?.options?.[0]?.text||'')}"></div><div><label class="exp-label">Opción 2</label><input id="pollOption2" value="${esc(poll?.options?.[1]?.text||'')}"></div><div><label class="exp-label">Opción 3</label><input id="pollOption3" value="${esc(poll?.options?.[2]?.text||'')}"></div><div class="exp-actions"><button id="savePoll">Publicar encuesta</button></div></div></div>
      <div class="exp-box"><h3>${esc(poll?.question||'No hay encuesta activa')}</h3>${poll?poll.options.map((o,i)=>`<div class="poll-option"><button class="alt" data-vote="${i}">Votar</button><div><strong>${esc(o.text)}</strong><div class="poll-bar"><span style="width:${total?Math.round(o.votes/total*100):0}%"></span></div></div><span>${o.votes||0}</span></div>`).join(''):'<p class="empty">Publique una pregunta para comenzar.</p>'}</div>`;
  }

  function renderScenario(){
    const decisions=currentState.decisions||[];
    return `<div class="exp-box"><h3>Escenario de decisión</h3><div class="exp-form"><div class="wide"><label class="exp-label">Situación o problema</label><textarea id="scenarioPrompt">${esc(currentState.prompt||'')}</textarea></div><div class="wide"><label class="exp-label">Decisión propuesta</label><textarea id="scenarioDecision"></textarea></div><div class="exp-actions"><button id="saveScenario">Publicar escenario</button><button id="addDecision" class="alt">Añadir decisión</button></div></div></div>
      <div class="exp-box"><h3>${esc(currentState.prompt||'Decisiones del grupo')}</h3>${decisions.length?decisions.map(d=>`<div class="exp-item"><strong>${esc(d.actor)}</strong><p>${esc(d.text)}</p><span class="small">${new Date(d.createdAt).toLocaleString()}</span></div>`).join(''):'<p class="empty">Todavía no hay decisiones documentadas.</p>'}</div>`;
  }

  function renderKanban(){
    const cards=currentState.cards||[]; const cols=[['ideas','Ideas'],['progress','En proceso'],['done','Completado']];
    return `<div class="exp-box"><h3>Nueva tarea</h3><div class="exp-form"><div><label class="exp-label">Título</label><input id="kanbanTitle"></div><div><label class="exp-label">Columna</label><select id="kanbanColumn">${cols.map(c=>`<option value="${c[0]}">${c[1]}</option>`).join('')}</select></div><div class="exp-actions"><button id="addKanban">Añadir tarjeta</button></div></div></div>
      <div class="kanban">${cols.map(([key,label])=>`<div class="kanban-col"><h4>${label}</h4>${cards.filter(c=>c.column===key).map(c=>`<div class="kanban-card"><strong>${esc(c.title)}</strong><div class="small">${esc(c.actor)}</div><div class="exp-actions">${key!=='ideas'?`<button class="alt" data-move="${c.id}" data-column="${key==='done'?'progress':'ideas'}">←</button>`:''}${key!=='done'?`<button class="alt" data-move="${c.id}" data-column="${key==='ideas'?'progress':'done'}">→</button>`:''}</div></div>`).join('')||'<p class="empty">Sin tarjetas</p>'}</div>`).join('')}</div>`;
  }

  function renderMedia(){
    const saved=localStorage.getItem('ucanTeleprompter')||'Bienvenidos a esta sesión de UCAN. Escriba aquí su guion.';
    return `<div class="exp-box"><h3>Teleprompter y estudio de grabación</h3><div class="exp-form"><div class="wide"><label class="exp-label">Guion</label><textarea id="teleprompterInput">${esc(saved)}</textarea></div><div><label class="exp-label">Cuenta regresiva</label><select id="mediaCountdown"><option value="3">3 segundos</option><option value="5">5 segundos</option><option value="10">10 segundos</option></select></div><div class="exp-actions"><button id="startRecording">Grabar audio</button><button id="stopRecording" class="warn">Detener</button></div></div></div><div class="exp-box"><div id="countdownDisplay" class="countdown"></div><div id="teleprompterDisplay" class="teleprompter">${esc(saved)}</div><div id="recordingResult" class="exp-actions"></div><p class="small">La grabación se procesa localmente en el navegador y no se envía al servidor automáticamente.</p></div>`;
  }

  function renderResearch(){
    const items=currentState.evidence||[];
    return `<div class="exp-box"><h3>Nueva evidencia</h3><div class="exp-form"><div><label class="exp-label">Título</label><input id="evidenceTitle"></div><div><label class="exp-label">Etiqueta</label><input id="evidenceTag" placeholder="Ej. metodología"></div><div class="wide"><label class="exp-label">Fuente o enlace</label><input id="evidenceSource"></div><div class="wide"><label class="exp-label">Nota analítica</label><textarea id="evidenceNote"></textarea></div><div class="exp-actions"><button id="addEvidence">Añadir evidencia</button></div></div></div><div class="exp-box"><h3>Muro de evidencia</h3>${items.length?items.map(i=>`<div class="exp-item"><span class="tag">${esc(i.tag||'evidencia')}</span><h4>${esc(i.title)}</h4><p>${esc(i.note)}</p><div class="small">Fuente: ${esc(i.source||'No indicada')} · ${esc(i.actor)}</div></div>`).join(''):'<p class="empty">No hay evidencia añadida.</p>'}</div>`;
  }

  function renderStage(){
    const questions=currentState.questions||[]; const reactions=currentState.reactions||{}; const speakers=currentState.speakers||[];
    return `<div class="exp-box"><h3>Interacción con la audiencia</h3><div class="exp-form"><div class="wide"><label class="exp-label">Pregunta para el escenario</label><textarea id="stageQuestion"></textarea></div><div class="exp-actions"><button id="addQuestion">Enviar pregunta</button><button id="joinSpeaker" class="alt">Solicitar turno de palabra</button></div></div><div class="reaction-row"><button data-react="applause">👏 ${reactions.applause||0}</button><button data-react="idea">💡 ${reactions.idea||0}</button><button data-react="question">❓ ${reactions.question||0}</button></div></div>
      <div class="exp-hero"><div class="exp-box"><h3>Preguntas destacadas</h3>${questions.length?questions.sort((a,b)=>(b.votes||0)-(a.votes||0)).map(q=>`<div class="exp-item"><p>${esc(q.text)}</p><div class="exp-actions"><button class="alt" data-upvote="${q.id}">▲ ${q.votes||0}</button><span class="small">${esc(q.actor)}</span></div></div>`).join(''):'<p class="empty">No hay preguntas.</p>'}</div><div class="exp-box"><h3>Fila de oradores</h3>${speakers.length?speakers.map((s,i)=>`<div class="exp-item"><strong>${i+1}. ${esc(s.actor)}</strong></div>`).join(''):'<p class="empty">No hay personas en espera.</p>'}<div class="countdown" id="stageTimer">05:00</div><div class="exp-actions"><button id="startStageTimer" class="alt">Iniciar 5 min</button></div></div></div>`;
  }

  function renderCafe(){
    const orders=currentState.orders||[];
    return `<div class="exp-hero"><div class="exp-box"><h3>Menú inteligente</h3><div class="menu-grid">${MENU.map(item=>`<div class="menu-card"><span class="tag">${esc(item.kind)}</span><h4>${esc(item.name)}</h4><div>${item.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join(' ')}</div><p><strong>${money(item.price)}</strong></p><button data-menu="${item.id}">Añadir</button></div>`).join('')}</div></div><div class="exp-box"><h3>Mi pedido</h3><div id="cafeCart">${cart.length?cart.map(i=>`<div class="exp-item">${esc(i.name)} · ${money(i.price)}</div>`).join(''):'<p class="empty">El carrito está vacío.</p>'}</div><h3>Total: ${money(cart.reduce((s,i)=>s+i.price,0))}</h3><div class="exp-actions"><button id="submitOrder">Enviar pedido</button><button id="clearCart" class="alt">Vaciar</button></div></div></div><div class="exp-box"><h3>Pedidos en preparación</h3>${orders.slice(-8).reverse().map(o=>`<div class="exp-item"><span class="queue-number">${esc(o.number)}</span><strong>${esc(o.actor)}</strong><div>${o.items.map(i=>esc(i.name)).join(', ')}</div></div>`).join('')||'<p class="empty">No hay pedidos activos.</p>'}</div>`;
  }

  function renderLibrary(){
    const reservations=currentState.reservations||[];
    return `<div class="exp-hero"><div class="exp-box"><h3>Catálogo académico</h3><input id="catalogSearch" placeholder="Buscar título, tema o autor"><div id="catalogResults" class="catalog-grid">${catalogCards(CATALOG)}</div></div><div class="exp-box"><h3>Reservar espacio</h3><div class="exp-form"><div><label class="exp-label">Espacio</label><select id="librarySeat"><option>Pod silencioso 1</option><option>Pod silencioso 2</option><option>Mesa colaborativa A</option><option>Mesa colaborativa B</option><option>Estación accesible</option></select></div><div><label class="exp-label">Duración</label><select id="libraryDuration"><option value="30">30 minutos</option><option value="60">60 minutos</option><option value="90">90 minutos</option></select></div><div class="exp-actions"><button id="reserveSeat">Reservar</button></div></div></div></div><div class="exp-box"><h3>Reservaciones recientes</h3>${reservations.slice(-10).reverse().map(r=>`<div class="exp-item"><strong>${esc(r.seat)}</strong><div>${esc(r.actor)} · ${esc(r.duration)} minutos</div><span class="small">${new Date(r.createdAt).toLocaleString()}</span></div>`).join('')||'<p class="empty">No hay reservaciones.</p>'}</div>`;
  }
  function catalogCards(items){return items.map(i=>`<div class="catalog-card"><span class="tag">${esc(i.format)}</span><h4>${esc(i.title)}</h4><p>${esc(i.author)}</p><div class="small">${esc(i.topic)}</div></div>`).join('')||'<p class="empty">No se encontraron recursos.</p>';}

  function bindModule(){
    document.getElementById('savePoll')?.addEventListener('click',()=>action('set-poll',{question:document.getElementById('pollQuestion').value,options:[1,2,3].map(i=>document.getElementById(`pollOption${i}`).value).filter(Boolean)}).catch(e=>setStatus(e.message,true)));
    document.querySelectorAll('[data-vote]').forEach(b=>b.addEventListener('click',()=>action('vote',{index:Number(b.dataset.vote)}).catch(e=>setStatus(e.message,true))));
    document.getElementById('saveScenario')?.addEventListener('click',()=>action('set-scenario',{prompt:document.getElementById('scenarioPrompt').value}).catch(e=>setStatus(e.message,true)));
    document.getElementById('addDecision')?.addEventListener('click',()=>action('add-decision',{text:document.getElementById('scenarioDecision').value}).catch(e=>setStatus(e.message,true)));
    document.getElementById('addKanban')?.addEventListener('click',()=>action('add-card',{title:document.getElementById('kanbanTitle').value,column:document.getElementById('kanbanColumn').value}).catch(e=>setStatus(e.message,true)));
    document.querySelectorAll('[data-move]').forEach(b=>b.addEventListener('click',()=>action('move-card',{id:b.dataset.move,column:b.dataset.column}).catch(e=>setStatus(e.message,true))));
    document.getElementById('teleprompterInput')?.addEventListener('input',e=>{localStorage.setItem('ucanTeleprompter',e.target.value);const d=document.getElementById('teleprompterDisplay');if(d)d.textContent=e.target.value;});
    document.getElementById('startRecording')?.addEventListener('click',startRecording);
    document.getElementById('stopRecording')?.addEventListener('click',()=>stopRecording(false));
    document.getElementById('addEvidence')?.addEventListener('click',()=>action('add-evidence',{title:document.getElementById('evidenceTitle').value,tag:document.getElementById('evidenceTag').value,source:document.getElementById('evidenceSource').value,note:document.getElementById('evidenceNote').value}).catch(e=>setStatus(e.message,true)));
    document.getElementById('addQuestion')?.addEventListener('click',()=>action('add-question',{text:document.getElementById('stageQuestion').value}).catch(e=>setStatus(e.message,true)));
    document.getElementById('joinSpeaker')?.addEventListener('click',()=>action('join-speaker',{}).catch(e=>setStatus(e.message,true)));
    document.querySelectorAll('[data-react]').forEach(b=>b.addEventListener('click',()=>action('reaction',{kind:b.dataset.react}).catch(e=>setStatus(e.message,true))));
    document.querySelectorAll('[data-upvote]').forEach(b=>b.addEventListener('click',()=>action('upvote-question',{id:b.dataset.upvote}).catch(e=>setStatus(e.message,true))));
    document.getElementById('startStageTimer')?.addEventListener('click',()=>startCountdown(300,'stageTimer'));
    document.querySelectorAll('[data-menu]').forEach(b=>b.addEventListener('click',()=>{const item=MENU.find(i=>i.id===b.dataset.menu);if(item){cart.push(item);render();}}));
    document.getElementById('clearCart')?.addEventListener('click',()=>{cart=[];render();});
    document.getElementById('submitOrder')?.addEventListener('click',()=>{if(!cart.length)return setStatus('Añada productos al carrito.',true);action('cafe-order',{items:cart.map(i=>({id:i.id,name:i.name,price:i.price}))}).then(()=>{cart=[];render();}).catch(e=>setStatus(e.message,true));});
    document.getElementById('catalogSearch')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();const items=CATALOG.filter(i=>`${i.title} ${i.author} ${i.topic}`.toLowerCase().includes(q));document.getElementById('catalogResults').innerHTML=catalogCards(items);});
    document.getElementById('reserveSeat')?.addEventListener('click',()=>action('reserve-seat',{seat:document.getElementById('librarySeat').value,duration:Number(document.getElementById('libraryDuration').value)}).catch(e=>setStatus(e.message,true)));
  }

  async function startRecording(){
    try{
      if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw new Error('Este navegador no permite grabación local.');
      const seconds=Number(document.getElementById('mediaCountdown')?.value||3); await countdownPromise(seconds,'countdownDisplay');
      mediaStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      mediaChunks=[]; mediaRecorder=new MediaRecorder(mediaStream);
      mediaRecorder.ondataavailable=e=>{if(e.data.size)mediaChunks.push(e.data);};
      mediaRecorder.onstop=()=>{const blob=new Blob(mediaChunks,{type:mediaRecorder.mimeType||'audio/webm'});const url=URL.createObjectURL(blob);const result=document.getElementById('recordingResult');if(result)result.innerHTML=`<audio controls src="${url}"></audio><a href="${url}" download="grabacion-ucan-${Date.now()}.webm"><button>Descargar grabación</button></a>`;};
      mediaRecorder.start(); document.getElementById('startRecording')?.classList.add('record-live'); setStatus('Grabando audio…');
    }catch(err){setStatus(err.message,true);}
  }
  function stopRecording(silent=false){
    if(mediaRecorder&&mediaRecorder.state!=='inactive')mediaRecorder.stop();
    mediaStream?.getTracks?.().forEach(t=>t.stop()); mediaStream=null; mediaRecorder=null;
    document.getElementById('startRecording')?.classList.remove('record-live'); if(!silent)setStatus('Grabación detenida.');
  }
  function countdownPromise(seconds,id){return new Promise(resolve=>{let left=seconds;const el=document.getElementById(id);if(el)el.textContent=left;const timer=setInterval(()=>{left--;if(el)el.textContent=left>0?left:'REC';if(left<=0){clearInterval(timer);setTimeout(()=>{if(el)el.textContent='';resolve();},350);}},1000);});}
  function startCountdown(seconds,id){if(localCountdown)clearInterval(localCountdown);let left=seconds;const el=document.getElementById(id);const draw=()=>{if(el)el.textContent=`${String(Math.floor(left/60)).padStart(2,'0')}:${String(left%60).padStart(2,'0')}`;};draw();localCountdown=setInterval(()=>{left--;draw();if(left<=0){clearInterval(localCountdown);localCountdown=null;}},1000);}

  function goToSpace(space){
    const map={'SV-201':'class201','SV-202':'class202','SV-203':'class203','SV-204':'class204','SV-205':'class205','ANF-301':'theater','CAFETERIA':'cafeteria','BIBLIOTECA':'library'};
    window.__UCAN_API__?.goToArea?.(map[space]); close();
  }

  function init(){injectStyles();injectHudButton();createPanel();window.__UCAN_EXPERIENCES__={open,close,getCurrentSpace:()=>currentSpace};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
