
(function(){
const S=JSON.parse(document.getElementById('state').textContent);
const ROOMS=[['tudo','Tudo'],['sala','Sala'],['cozinha','Cozinha'],['quarto','Quarto'],['banheiro','Banheiro'],['variedades','Variedades'],['roupas','Roupas']];
const LABEL={disponivel:'Disponível',reservado:'Reservado',vendido:'Vendido'};
const WA='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.6-.3Z"/></svg>';
let room='tudo', onlyAvail=false, sort='padrao', admin=false, logged=false;
let draft={}; // id -> {status, price}
try{const r=localStorage.getItem('tv-room');if(r)room=r;}catch(e){}

const $=(s,el=document)=>el.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=n=>'R$ '+Number(n).toLocaleString('pt-BR',{maximumFractionDigits:0});
const cur=it=>Object.assign({},it,draft[it.id]||{});
const allItems=()=>S.items.map(cur).filter(i=>!i.__del);
const phone=()=>String(S.config.whatsapp||'').replace(/\D/g,'');
const waLink=it=>'https://wa.me/'+phone()+'?text='+encodeURIComponent(it.late&&it.status==='disponivel'?'Oi! Vi no site da mudança e quero reservar com sinal: '+it.name+' ('+brl(it.price)+'). Sei que a retirada é nos últimos dias. Como faço o sinal?':'Oi! Vi no site da mudança e tenho interesse em: '+it.name+' ('+brl(it.price)+'). Ainda está disponível?');
const deadline=new Date(S.config.deadline);
const fmtDay=d=>d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','');

function wantBtn(it){
  if(it.status==='vendido') return '<span class="want off">Já tem novo dono</span>';
  if(!phone()) return '<span class="want off">WhatsApp em breve</span>';
  const t=it.status==='reservado'?'Entrar na fila':(it.late?'Reservar com sinal':'Quero este');
  return '<a class="want" href="'+waLink(it)+'" target="_blank" rel="noopener">'+WA+t+'</a>';
}

function shell(){
  const all=allItems();
  $('#root').innerHTML=
  '<div class="airmail"></div>'+
  '<div class="pickup" role="note"><div class="wrap"><span class="stamp">Atenção</span><b>'+esc(S.config.where)+'</b><span>Não fazemos entrega: quem compra precisa vir buscar.</span></div></div>'+
  '<header class="wrap hero">'+
    '<div><div class="eyebrow"><span class="stamp">Par avion</span><span>Bazar da mudança</span></div>'+
    '<h1>Família <em>vende tudo.</em></h1>'+
    '<p class="lede">Estamos de mudança para outro país e <strong>cada coisa desta casa precisa de um novo lar</strong>. Escolha o que gostou, chame no WhatsApp e combine a retirada. Quem chama primeiro, leva.</p></div>'+
    '<div class="board" aria-label="Contagem regressiva"><div class="board-head"><span>Último dia de vendas</span><span>'+esc(fmtDay(deadline))+'</span></div>'+
      '<div class="flaps" id="flaps"></div>'+
      '<div class="progress" aria-hidden="true"><i id="prog"></i></div>'+
      '<div class="board-foot"><span id="sold"></span><span class="gate">Quem chama primeiro, leva</span></div></div>'+
  '</header>'+
  '<div class="wrap"><ol class="steps">'+
    '<li><span><b>Escolha</b>Toque na foto para ver todos os ângulos.</span></li>'+
    '<li><span><b>Chame no WhatsApp</b>A mensagem já vai pronta com o nome do item.</span></li>'+
    '<li><span><b>Retire e pague</b>'+esc(S.config.where)+'. '+esc(S.config.payment)+'. Itens com selo <i>Retirada no fim</i> ainda estão em uso: reserve com sinal.</span></li>'+
  '</ol>'+
  '<section class="config" aria-label="Configurações">'+
    '<h4>Modo dona: configurações</h4>'+
    '<label for="cfg-wa">Seu WhatsApp (com DDD)<input id="cfg-wa" inputmode="tel" placeholder="(11) 91234-5678" value="'+esc(S.config.whatsapp||'')+'"></label>'+
    '<label for="cfg-where">Retirada<input id="cfg-where" value="'+esc(S.config.where)+'"></label>'+
    '<label for="cfg-pay">Pagamento<input id="cfg-pay" value="'+esc(S.config.payment)+'"></label>'+
    '<label for="cfg-sinal">Texto sobre o sinal<input id="cfg-sinal" value="'+esc(S.config.sinal||'')+'"></label>'+
  '</section></div>'+
  '<nav class="toolbar" aria-label="Cômodos"><div class="wrap"><div class="rooms" id="rooms"></div>'+
    '<div class="filters"><label for="only"><input type="checkbox" id="only"'+(onlyAvail?' checked':'')+'> Só o que ainda está disponível</label>'+
    '<span style="display:flex;gap:12px;align-items:center"><span class="count" id="count"></span>'+
    '<select id="sort" aria-label="Ordenar"><option value="padrao">Destaques</option><option value="menor">Menor preço</option><option value="maior">Maior preço</option></select></span></div></div></nav>'+
  '<main class="wrap"><div class="grid" id="grid"></div></main>'+
  '<div class="airmail"></div>'+
  '<footer class="wrap"><div><b>Família Vende Tudo</b>Itens usados, vendidos no estado em que estão nas fotos.</div><div>'+esc(S.config.where)+'<br>Vendas e retiradas até '+esc(deadline.toLocaleDateString('pt-BR',{day:'numeric',month:'long'}))+'</div><div class="fab" id="fab" hidden></div></footer>'+
  '<dialog id="dlg" aria-label="Detalhes do item"></dialog><dialog id="lg" aria-label="Área da dona"></dialog><dialog id="ed" aria-label="Editar anúncio"></dialog>';
  $('#sort').value=sort;
  $('#only').onchange=e=>{onlyAvail=e.target.checked;renderGrid();};
  $('#sort').onchange=e=>{sort=e.target.value;renderGrid();};
  ['wa','where','pay','sinal'].forEach(k=>{$('#cfg-'+k).oninput=e=>{const key={wa:'whatsapp',where:'where',pay:'payment',sinal:'sinal'}[k];draft.__config=Object.assign(draft.__config||{},{[key]:e.target.value});updateFab();};});
  renderRooms();renderGrid();tick();setInterval(tick,1000);updateFab();
}

function renderRooms(){
  const all=allItems();
  $('#rooms').innerHTML=ROOMS.map(([k,l])=>{
    const n=k==='tudo'?all.length:all.filter(i=>i.cat===k).length;
    return '<button class="room" aria-pressed="'+(room===k)+'" data-room="'+k+'">'+l+' <small>'+n+'</small></button>';
  }).join('');
  $('#rooms').onclick=e=>{const b=e.target.closest('[data-room]');if(!b)return;room=b.dataset.room;try{localStorage.setItem('tv-room',room)}catch(_){};renderRooms();renderGrid();};
}

function list(){
  let l=allItems().filter(i=>room==='tudo'||i.cat===room);
  if(onlyAvail&&!admin) l=l.filter(i=>i.status==='disponivel');
  const rank={disponivel:0,reservado:0,vendido:1};
  if(sort==='menor') l.sort((a,b)=>a.price-b.price);
  else l.sort((a,b)=>b.price-a.price);
  if(!admin) l.sort((a,b)=>rank[a.status]-rank[b.status]);
  return l;
}

function card(it,i){
  const tape=it.status!=='disponivel'?'<div class="tape '+it.status+'" aria-hidden="true">'+(LABEL[it.status].toUpperCase()+' · ').repeat(4)+'</div>':'';
  return '<article class="card'+(draft[it.id]?' changed':'')+'" data-status="'+it.status+'" data-id="'+it.id+'" style="--i:'+Math.min(i,16)+'">'+
    '<button class="photo" data-open="'+it.id+'" aria-label="Ver fotos de '+esc(it.name)+'" style="--bgimg:url(\''+esc(it.photos[0])+'\')"><img src="'+esc(it.photos[0])+'" alt="'+esc(it.name)+'" loading="'+(i<6?'eager':'lazy')+'" data-fit>'+
    (it.photos.length>1?'<span class="nphotos">'+it.photos.length+' fotos</span>':'')+(it.late&&it.status!=='vendido'?'<span class="late">Retirada<br>no fim</span>':'')+tape+
    '<span class="tag">'+brl(it.price)+'</span></button>'+
    '<h3>'+esc(it.name)+'</h3><p>'+esc(it.desc)+'</p>'+(it.late&&it.status==='disponivel'?'<div class="late-note">Ainda em uso. Reserve com sinal.</div>':'')+wantBtn(it)+
    '<div class="adm"><button class="edit-btn" data-edit="'+it.id+'">Editar anúncio e fotos</button><div class="seg" role="group" aria-label="Status">'+
      ['disponivel','reservado','vendido'].map(v=>'<button data-set="'+v+'" data-v="'+v+'" aria-pressed="'+(it.status===v)+'">'+LABEL[v]+'</button>').join('')+
    '</div><label class="chk" for="lt-'+it.id+'"><input type="checkbox" id="lt-'+it.id+'" data-late="'+it.id+'"'+(it.late?' checked':'')+'> Retirada só no fim</label><label for="pr-'+it.id+'">Preço R$<input id="pr-'+it.id+'" data-price="'+it.id+'" type="number" min="0" step="5" value="'+it.price+'"></label></div>'+
  '</article>';
}

function renderGrid(){
  const l=list();
  const g=$('#grid');
  if(!l.length){
    g.innerHTML='<div class="empty"><h3>'+(room==='banheiro'||room==='quarto'?'Fotos chegando':'Nada por aqui')+'</h3>'+(room==='banheiro'||room==='quarto'?'Ainda estou fotografando este cômodo. Volte em breve!':'Tudo deste filtro já foi vendido.')+'</div>';
  } else {
    const home=l.filter(i=>i.cat!=='roupas'), wear=l.filter(i=>i.cat==='roupas');
    g.innerHTML=home.map(card).join('')+(wear.length?'<div class="sep" role="separator"><span class="stamp">Bagagem extra</span><h2>O que não coube na mala</h2><p>Roupas, calçados e acessórios que vão ficar por aqui. Confira tamanho e estado nas fotos antes de chamar.</p></div>'+wear.map((it,i)=>card(it,home.length+i)).join(''):'');
  }
  const all=allItems();
  $('#count').textContent=l.length+(l.length===1?' item':' itens');
  const sold=all.filter(i=>i.status==='vendido').length, res=all.filter(i=>i.status==='reservado').length;
  $('#sold').textContent=sold+' de '+all.length+' já foram'+(res?' · '+res+' reservados':'');
  $('#prog').style.width=(all.length?Math.round(100*sold/all.length):0)+'%';
}

document.addEventListener('load',e=>{const im=e.target;if(im.tagName==='IMG'&&im.hasAttribute('data-fit')&&im.naturalWidth>im.naturalHeight*1.15)im.parentNode.classList.add('contain');},true);
document.addEventListener('click',e=>{
  const ed=e.target.closest('[data-edit]'); if(ed&&admin){openEditor(ed.dataset.edit);return;}
  const o=e.target.closest('[data-open]'); if(o){openItem(o.dataset.open);return;}
  const s=e.target.closest('[data-set]');
  if(s&&admin){const id=s.closest('[data-id]').dataset.id;setDraft(id,{status:s.dataset.set});renderGrid();}
});
document.addEventListener('change',e=>{
  const l=e.target.dataset&&e.target.dataset.late;
  if(l&&admin){setDraft(l,{late:e.target.checked});renderGrid();}
});
document.addEventListener('input',e=>{
  const p=e.target.dataset&&e.target.dataset.price;
  if(p&&admin){setDraft(p,{price:Math.max(0,Math.round(+e.target.value||0))});e.target.closest('.card').classList.add('changed');const t=e.target.closest('.card').querySelector('.tag');if(t)t.textContent=brl(cur(S.items.find(i=>i.id===p)).price);}
});
function setDraft(id,patch){
  const base=S.items.find(i=>i.id===id);
  const d=Object.assign({},draft[id]||{},patch);
  Object.keys(d).forEach(k=>{if(JSON.stringify(d[k])===JSON.stringify(base[k]))delete d[k];});
  if(Object.keys(d).length)draft[id]=d;else delete draft[id];
  updateFab();
}

function tick(){
  const ms=deadline-Date.now(), f=$('#flaps'); if(!f)return;
  if(ms<=0){f.innerHTML='<div class="flap" style="grid-column:1/-1"><b>ENCERRADO</b><span>Obrigada a todos!</span></div>';return;}
  const d=Math.floor(ms/864e5),h=Math.floor(ms/36e5)%24,m=Math.floor(ms/6e4)%60,s=Math.floor(ms/1e3)%60;
  const p=n=>String(n).padStart(2,'0');
  f.innerHTML=[[p(d),d===1?'dia':'dias'],[p(h),'horas'],[p(m),'min'],[p(s),'seg']].map(([v,l])=>'<div class="flap"><b>'+v+'</b><span>'+l+'</span></div>').join('');
}

function openItem(id){
  const it=cur(S.items.find(i=>i.id===id)); const dlg=$('#dlg');
  const room=(ROOMS.find(r=>r[0]===it.cat)||[,''])[1];
  dlg.innerHTML='<button class="close" aria-label="Fechar">×</button><div class="dlg">'+
    '<div class="gal"><div class="slides" id="slides">'+it.photos.map((p,i)=>'<img src="'+esc(p)+'" alt="'+esc(it.name)+' foto '+(i+1)+'">').join('')+'</div>'+
    (it.photos.length>1?'<button class="nav prev" aria-label="Foto anterior">‹</button><button class="nav next" aria-label="Próxima foto">›</button><div class="dots">'+it.photos.map((_,i)=>'<button aria-label="Foto '+(i+1)+'" data-dot="'+i+'"'+(i?'':' aria-current="true"')+'></button>').join('')+'</div>':'')+'</div>'+
    '<div class="info"><div class="eyebrow">'+esc(room)+'</div><h2>'+esc(it.name)+'</h2>'+
    '<span class="pill '+it.status+'">'+LABEL[it.status]+'</span>'+
    '<div class="price">'+(it.status==='vendido'?'<s>'+brl(it.price)+'</s>':brl(it.price))+'</div>'+
    '<p>'+esc(it.desc)+'</p>'+(it.late&&it.status!=='vendido'?'<p class="late-note">Este item ainda está em uso na casa. '+esc(S.config.sinal||'')+'</p>':'')+wantBtn(it)+
    '<div class="fine">'+esc(S.config.where)+' · '+esc(S.config.payment)+' · até '+esc(deadline.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}))+'.<br>Não fazemos reserva pelo site: '+(it.status==='reservado'?'este item já está reservado, mas você pode entrar na fila caso a pessoa desista.':(it.late?'a reserva vale a partir do sinal combinado no WhatsApp.':'o primeiro que confirmar no WhatsApp leva.'))+'</div></div></div>';
  const sl=$('#slides',dlg), n=it.photos.length;
  const go=i=>sl.scrollTo({left:sl.clientWidth*Math.max(0,Math.min(n-1,i)),behavior:'smooth'});
  const idx=()=>Math.round(sl.scrollLeft/sl.clientWidth);
  sl.onscroll=()=>{dlg.querySelectorAll('[data-dot]').forEach((d,i)=>d.setAttribute('aria-current',i===idx()));};
  dlg.onclick=e=>{
    if(e.target===dlg||e.target.closest('.close'))dlg.close();
    else if(e.target.closest('.prev'))go(idx()-1);
    else if(e.target.closest('.next'))go(idx()+1);
    else if(e.target.dataset.dot)go(+e.target.dataset.dot);
  };
  dlg.onkeydown=e=>{if(e.key==='ArrowRight')go(idx()+1);if(e.key==='ArrowLeft')go(idx()-1);};
  dlg.showModal();
}

/* ---------- modo dona ---------- */
const API='api.php';
const CAT_LABEL=ROOMS.filter(r=>r[0]!=='tudo');
async function api(action,body,isForm){
  try{
    const r=await fetch(API+'?a='+action,{method:'POST',credentials:'same-origin',headers:isForm?{'X-Dona':'1'}:{'X-Dona':'1','Content-Type':'application/json'},body:isForm?body:JSON.stringify(body||{})});
    let data={};try{data=await r.json();}catch(_){}
    return {status:r.status,ok:r.ok&&data.ok===true,data};
  }catch(_){return {status:0,ok:false,data:{}};}
}
function nChanges(){return Object.keys(draft).length;}
function setAdmin(on){admin=on;document.body.classList.toggle('admin',on);updateFab();renderRooms();renderGrid();}
function updateFab(){
  const fab=$('#fab'); if(!fab)return;
  if(!logged){fab.hidden=true;fab.classList.remove('floating');return;}
  fab.hidden=false;
  fab.classList.toggle('floating',admin);
  const n=nChanges();
  fab.innerHTML=admin?
    '<button class="toggle" id="fab-new">Novo<span class="wide"> anúncio</span></button><button class="save" id="save"'+(n?'':' disabled')+'>Salvar<span class="wide"> e publicar</span>'+(n?' ('+n+')':'')+'</button><button class="toggle" id="fab-pass">Senha</button><button class="toggle" id="fab-out">Sair</button>':
    '<button class="toggle" id="fab-in">Área da dona</button>';
  if(admin){
    $('#fab-new').onclick=()=>openEditor(null);
    $('#save').onclick=save;
    $('#fab-pass').onclick=openPassword;
    $('#fab-out').onclick=logout;
  } else $('#fab-in').onclick=()=>setAdmin(true);
}
function toast(t,ms){const el=document.createElement('div');el.className='toast';el.textContent=t;document.body.appendChild(el);setTimeout(()=>el.remove(),ms||3500);}

function openLogin(){
  const d=$('#lg');
  d.innerHTML='<form class="panel" id="lg-form"><h3>Área da dona</h3><label for="lg-email">E-mail<input id="lg-email" type="email" autocomplete="username" required></label><label for="lg-pass">Senha<input id="lg-pass" type="password" autocomplete="current-password" required></label><p class="err" id="lg-err" hidden></p><div class="panel-actions"><button type="button" class="ghost" id="lg-cancel">Cancelar</button><button class="primary" type="submit">Entrar</button></div></form>';
  $('#lg-cancel').onclick=()=>d.close();
  $('#lg-form').onsubmit=async e=>{
    e.preventDefault();
    const r=await api('login',{email:$('#lg-email').value,password:$('#lg-pass').value});
    if(r.ok){logged=true;d.close();setAdmin(true);return;}
    const err=$('#lg-err');err.hidden=false;
    err.textContent=r.status===429?'Muitas tentativas. Espere 15 minutos e tente de novo.':(r.status===401?'E-mail ou senha incorretos.':'Não deu para entrar agora. Tente de novo.');
  };
  d.showModal();
}
function openPassword(){
  const d=$('#lg');
  d.innerHTML='<form class="panel" id="pw-form"><h3>Trocar senha</h3><label for="pw-cur">Senha atual<input id="pw-cur" type="password" autocomplete="current-password" required></label><label for="pw-new">Nova senha (mínimo 10 caracteres)<input id="pw-new" type="password" autocomplete="new-password" minlength="10" required></label><label for="pw-rep">Repita a nova senha<input id="pw-rep" type="password" autocomplete="new-password" minlength="10" required></label><p class="err" id="pw-err" hidden></p><div class="panel-actions"><button type="button" class="ghost" id="pw-cancel">Cancelar</button><button class="primary" type="submit">Trocar senha</button></div></form>';
  $('#pw-cancel').onclick=()=>d.close();
  $('#pw-form').onsubmit=async e=>{
    e.preventDefault();
    const err=$('#pw-err');err.hidden=false;
    if($('#pw-new').value!==$('#pw-rep').value){err.textContent='As duas senhas novas não são iguais.';return;}
    const r=await api('password',{current:$('#pw-cur').value,next:$('#pw-new').value});
    if(r.ok){d.close();toast('Senha trocada.');return;}
    err.textContent=r.status===401?'A senha atual está incorreta.':'Não deu para trocar a senha. Tente de novo.';
  };
  d.showModal();
}
async function logout(){
  if(nChanges()&&!confirm('Você tem alterações que ainda não foram salvas. Sair mesmo assim?'))return;
  await api('logout');
  logged=false;draft={};
  location.reload();
}

function slug(s){return (String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'item')+'-'+Date.now().toString(36);}
function shrink(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),img=new Image();
    img.onload=()=>{
      const s=Math.min(1,1000/Math.max(img.naturalWidth,img.naturalHeight)),c=document.createElement('canvas');
      c.width=Math.round(img.naturalWidth*s);c.height=Math.round(img.naturalHeight*s);
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b=>b?resolve(b):reject(),'image/jpeg',.82);
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject();};
    img.src=url;
  });
}
function openEditor(id){
  const d=$('#ed'),isNew=id===null,it=isNew?{name:'',desc:'',cat:'variedades',price:0,photos:[]}:cur(S.items.find(i=>i.id===id));
  const ed={photos:it.photos.slice()};
  d.innerHTML='<form class="panel" id="ed-form"><h3>'+(isNew?'Novo anúncio':'Editar anúncio')+'</h3>'+
    '<label for="ed-name">Nome<input id="ed-name" maxlength="200" required></label>'+
    '<label for="ed-desc">Descrição<textarea id="ed-desc" rows="4" maxlength="2000"></textarea></label>'+
    '<div class="panel-row"><label for="ed-cat">Cômodo<select id="ed-cat">'+CAT_LABEL.map(([k,l])=>'<option value="'+k+'">'+l+'</option>').join('')+'</select></label>'+
    '<label for="ed-price">Preço R$<input id="ed-price" type="number" min="0" step="1" required></label></div>'+
    '<div class="ed-label">Fotos <small>a primeira é a capa</small></div><div class="ed-photos" id="ed-photos"></div>'+
    '<label class="ghost file-btn" for="ed-file" id="ed-file-label">Adicionar fotos<input id="ed-file" type="file" accept="image/*" multiple></label>'+
    '<p class="err" id="ed-err" hidden></p>'+
    '<div class="panel-actions">'+(isNew?'':'<button type="button" class="danger" id="ed-del">Excluir anúncio</button>')+'<button type="button" class="ghost" id="ed-cancel">Cancelar</button><button class="primary" type="submit">Aplicar</button></div></form>';
  $('#ed-name').value=it.name;$('#ed-desc').value=it.desc;$('#ed-cat').value=it.cat;$('#ed-price').value=it.price;
  const err=m=>{const e=$('#ed-err');e.hidden=!m;e.textContent=m||'';};
  const paint=()=>{
    const box=$('#ed-photos');box.innerHTML='';
    ed.photos.forEach((p,i)=>{
      const w=document.createElement('div');w.className='ed-photo';
      const img=document.createElement('img');img.src=p;img.alt='Foto '+(i+1);w.appendChild(img);
      if(i===0){const b=document.createElement('span');b.className='ed-cover';b.textContent='Capa';w.appendChild(b);}
      else{const c=document.createElement('button');c.type='button';c.textContent='Virar capa';c.onclick=()=>{ed.photos.splice(i,1);ed.photos.unshift(p);paint();};w.appendChild(c);}
      const x=document.createElement('button');x.type='button';x.textContent='Remover';x.onclick=()=>{ed.photos.splice(i,1);paint();};w.appendChild(x);
      box.appendChild(w);
    });
  };
  paint();
  $('#ed-file').onchange=async e=>{
    const files=[...e.target.files];e.target.value='';err('');
    const label=$('#ed-file-label');
    for(let i=0;i<files.length;i++){
      label.firstChild.textContent='Enviando '+(i+1)+' de '+files.length+'…';
      let blob;
      try{blob=await shrink(files[i]);}catch(_){err('Este aparelho não conseguiu abrir "'+files[i].name+'". Tente uma foto em JPG.');continue;}
      const fd=new FormData();fd.append('foto',blob,'foto.jpg');
      const r=await api('upload',fd,true);
      if(r.ok){ed.photos.push(r.data.path);paint();}
      else if(r.status===401){err('Sua sessão expirou. Feche, entre de novo e tente outra vez.');break;}
      else err('Não deu para enviar "'+files[i].name+'".');
    }
    label.firstChild.textContent='Adicionar fotos';
  };
  $('#ed-cancel').onclick=()=>d.close();
  if(!isNew)$('#ed-del').onclick=()=>{
    if(!confirm('Excluir "'+it.name+'" do site? Ele só sai de vez quando você clicar em Salvar e publicar.'))return;
    if(draft[id]&&draft[id].__new){S.items=S.items.filter(i=>i.id!==id);delete draft[id];}
    else draft[id]={__del:true};
    d.close();updateFab();renderRooms();renderGrid();
  };
  $('#ed-form').onsubmit=e=>{
    e.preventDefault();
    if(!ed.photos.length){err('Coloque pelo menos uma foto.');return;}
    const patch={name:$('#ed-name').value.trim(),desc:$('#ed-desc').value.trim(),cat:$('#ed-cat').value,price:Math.max(0,Math.round(+$('#ed-price').value||0)),photos:ed.photos};
    if(isNew){
      const nid=slug(patch.name);
      S.items.push(Object.assign({id:nid,status:'disponivel',late:false},patch));
      draft[nid]={__new:true};
    } else if(draft[id]&&draft[id].__new){
      Object.assign(S.items.find(i=>i.id===id),patch);
    } else setDraft(id,patch);
    d.close();updateFab();renderRooms();renderGrid();
  };
  d.showModal();
}

async function save(){
  const sv=$('#save'); if(sv){sv.disabled=true;sv.textContent='Publicando…';}
  const config=Object.assign({},S.config,draft.__config||{});
  const items=[];
  S.items.forEach(i=>{
    const d=draft[i.id]||{};
    if(d.__del)return;
    const m=Object.assign({},i,d);
    delete m.__new;
    items.push(m);
  });
  const r=await api('save',{version:S.version,state:{config,items}});
  if(r.ok){
    draft={};
    try{sessionStorage.setItem('fv-admin','1');sessionStorage.setItem('fv-toast','Publicado! Todo mundo já vê a versão nova.');}catch(_){}
    location.reload();
    return;
  }
  if(r.status===401){logged=false;updateFab();toast('Sua sessão expirou. Entre de novo; suas alterações continuam aqui.',5000);openLogin();}
  else if(r.status===409){toast('O site foi alterado em outro aparelho. Recarregando: refaça a última alteração.',5000);draft={};setTimeout(()=>location.reload(),2500);}
  else toast('Não deu para publicar agora. Tente de novo em instantes.');
  updateFab();
}

window.addEventListener('beforeunload',e=>{if(nChanges()){e.preventDefault();e.returnValue='';}});
window.addEventListener('hashchange',checkHash);
function checkHash(){
  if(location.hash!=='#dona')return;
  history.replaceState(null,'',location.pathname+location.search);
  if(logged)setAdmin(true);else openLogin();
}

shell();
(async()=>{
  try{
    const r=await fetch(API+'?a=me',{credentials:'same-origin'});
    logged=!!(await r.json()).logged;
  }catch(_){}
  let again=false,msg=null;
  try{again=sessionStorage.getItem('fv-admin')==='1';msg=sessionStorage.getItem('fv-toast');sessionStorage.removeItem('fv-admin');sessionStorage.removeItem('fv-toast');}catch(_){}
  if(logged&&again)setAdmin(true);else updateFab();
  if(msg)toast(msg);
  checkHash();
})();
})();
