'use strict';
const cfg=window.VILAINE_CONFIG||{};
if(cfg.adminUrl&&new URL(cfg.adminUrl,location.href).origin!==location.origin)location.replace(cfg.adminUrl);
const $=id=>document.getElementById(id);
let csrf='',dashboard=null,uploads=[],selected=[],pendingKey='',busy=false;
const selectedUploads=new Set();
function message(id,text,error=false){const el=$(id);el.textContent=text;el.classList.toggle('error',error);if(id==='global-message')el.hidden=!text;}
async function api(path,{method='GET',body,key}={}){
  const headers={Accept:'application/json'};
  if(method!=='GET'){headers['X-CSRF-Token']=csrf;if(!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body||{});}}
  if(key)headers['Idempotency-Key']=key;
  let response;try{response=await fetch(`${cfg.apiBase||''}/api${path}`,{method,headers,body,credentials:'same-origin'});}catch{throw new Error('Não foi possível conectar ao servidor. Tente novamente.');}
  if(!response.headers.get('content-type')?.includes('application/json')){const error=new Error('O backend seguro ainda não foi ativado neste endereço.');error.unavailable=true;throw error;}
  const data=await response.json();
  if(!response.ok){const error=new Error(data.error||'Não foi possível concluir a operação.');error.status=response.status;error.unavailable=response.status===503;if(response.status===401&&path!=='/login')showLogin();throw error;}
  return data;
}
function showLogin(){csrf='';$('dashboard-screen').hidden=true;$('login-screen').hidden=false;}
function showDashboard(){ $('login-screen').hidden=true;$('dashboard-screen').hidden=false; }
function showView(name){for(const el of document.querySelectorAll('.view'))el.hidden=el.id!==`view-${name}`;for(const el of document.querySelectorAll('.nav-button'))el.classList.toggle('active',el.dataset.view===name);window.scrollTo({top:0,behavior:'smooth'});}
function badge(status){const el=document.createElement('span');el.className=`badge ${status==='Publicado'?'published':/Erro|Revisar|RECONCILIAR|Pendente/.test(status)?'error':''}`;el.textContent=status;return el;}
function date(value){return value?new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'—';}
function publicationItem(item){const row=document.createElement('div');row.className='publication-item';const icon=document.createElement('span');icon.className='publication-icon';icon.textContent=item.format==='Reel'?'▷':'▧';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=item.title;const small=document.createElement('small');small.textContent=`${item.format} · ${date(item.scheduledAt)}`;info.append(title,small);row.append(icon,info,badge(item.status));return row;}
async function loadDashboard(){
  dashboard=await api('/dashboard');
  $('stat-published').textContent=dashboard.counts.published;
  $('stat-planned').textContent=dashboard.counts.planned;
  $('stat-attention').textContent=dashboard.counts.attention;
  const recent=$('recent-publications');recent.replaceChildren();
  for(const item of dashboard.publications.slice(0,5))recent.append(publicationItem(item));
  if(!recent.children.length){const p=document.createElement('p');p.className='empty-state';p.textContent='As publicações aparecerão aqui quando entrarem na fila.';recent.append(p);}
  const table=$('publications-table');table.replaceChildren();
  for(const item of dashboard.publications){
    const tr=document.createElement('tr');
    for(const text of [item.title,item.format]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
    const status=document.createElement('td');status.append(badge(item.status));if(item.error){const small=document.createElement('small');small.textContent=item.error;status.append(small);}tr.append(status);
    const when=document.createElement('td');when.textContent=date(item.scheduledAt);tr.append(when);
    const metrics=document.createElement('td');const m=item.metrics;
    metrics.textContent=m?Object.entries({Curtidas:m.likes,Comentários:m.comments,Salvamentos:m.saved,Compartilhamentos:m.shares,Visualizações:m.views,Alcance:m.reach}).filter(([,v])=>typeof v==='number').map(([k,v])=>`${k}: ${v}`).join(' · ')||'Indisponível':'Indisponível';tr.append(metrics);
    const link=document.createElement('td');if(/^https:\/\/(www\.)?instagram\.com\//.test(item.permalink||'')){const a=document.createElement('a');a.href=item.permalink;a.textContent='Ver ↗';a.className='text-link';a.target='_blank';a.rel='noopener';link.append(a);}else link.textContent='—';tr.append(link);table.append(tr);
  }
  $('metrics-updated').textContent=dashboard.metricsUpdated?`Métricas atualizadas em ${date(dashboard.metricsUpdated)}. Horários de Brasília.`:'Métricas ainda não sincronizadas. Horários de Brasília.';
  $('integration-status').textContent=dashboard.integrationSummary;
  if(dashboard.warning)message('global-message',dashboard.warning);
}
async function loadSettings(){const data=await api('/settings');$('studio-email').value=data.email;$('studio-phone').value=data.phone;$('editing-folder').value=data.editingFolder;}
function previewCard(src,name,detail,checkbox){const card=document.createElement(checkbox?'label':'div');card.className='photo-card';if(checkbox){const input=document.createElement('input');input.type='checkbox';input.checked=selectedUploads.has(checkbox);input.addEventListener('change',()=>{input.checked?selectedUploads.add(checkbox):selectedUploads.delete(checkbox);pendingKey='';});card.append(input);}const image=document.createElement('img');image.src=src;image.alt=name;image.loading='lazy';const caption=document.createElement('div');caption.className='photo-caption';caption.textContent=name;const small=document.createElement('small');small.textContent=detail;caption.append(small);card.append(image,caption);return card;}
async function loadUploads(){const result=await api('/uploads');uploads=result.items;const grid=$('uploaded-files');grid.replaceChildren();for(const item of uploads){const selectable=!item.claimed;grid.append(previewCard(`${cfg.apiBase||''}/api/uploads/${encodeURIComponent(item.id)}/preview`,item.name,item.claimed?'Encaminhado para publicação':'Na pasta de edição',selectable?item.id:null));}if(!uploads.length){const p=document.createElement('p');p.className='empty-state';p.textContent='As fotos enviadas por este painel aparecerão aqui.';grid.append(p);}}
async function authenticated(){showDashboard();await Promise.all([loadDashboard(),loadSettings(),loadUploads()]);}
$('github-access').href=`https://github.com/${cfg.repository}/actions`;
$('today').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'long'}).format(new Date());
for(const el of document.querySelectorAll('[data-view]'))el.addEventListener('click',()=>showView(el.dataset.view));
for(const el of document.querySelectorAll('[data-open-content]'))el.addEventListener('click',()=>showView('content'));
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;message('login-message','Verificando acesso…');try{const data=await api('/login',{method:'POST',body:{username:$('username').value,password:$('password').value}});csrf=data.csrf;$('password').value='';message('login-message','');await authenticated();}catch(error){message('login-message',error.message,true);}finally{button.disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('/logout',{method:'POST'});showLogin();}catch(error){message('global-message',error.message,true);}});
$('photo-files').addEventListener('change',()=>{
  for(const item of selected)URL.revokeObjectURL(item.preview);
  const files=[...$('photo-files').files];
  if(files.length>10||files.some(f=>!['image/jpeg','image/png'].includes(f.type)||f.size>12*1024*1024)){selected=[];$('selected-files').replaceChildren();$('upload-photos').disabled=true;message('upload-message','Escolha até 10 fotos JPEG/PNG, com no máximo 12 MB cada.',true);return;}
  selected=files.map(file=>({file,key:crypto.randomUUID(),preview:URL.createObjectURL(file),done:false}));$('selected-files').replaceChildren(...selected.map(x=>previewCard(x.preview,x.file.name,`${(x.file.size/1024/1024).toFixed(1)} MB`)));$('upload-photos').disabled=!selected.length;message('upload-message','');
});
$('upload-photos').addEventListener('click',async()=>{if(busy)return;busy=true;$('upload-photos').disabled=true;try{for(let i=0;i<selected.length;i++){const item=selected[i];if(item.done)continue;message('upload-message',`Enviando foto ${i+1} de ${selected.length}…`);const body=new FormData();body.append('file',item.file);await api('/uploads',{method:'POST',body,key:item.key});item.done=true;}message('upload-message','Fotos enviadas para a pasta de edição com sucesso.');await loadUploads();}catch(error){message('upload-message',error.message,true);}finally{busy=false;$('upload-photos').disabled=selected.every(x=>x.done);}});
$('publication-format').addEventListener('change',()=>{pendingKey='';const format=$('publication-format').value;$('format-help').textContent=format==='Reels'?'Reels cria um vídeo vertical com as fotos selecionadas, sem música. Os originais são preservados.':format==='Carrossel'?'Carrossel publica de 2 a 10 fotos, na ordem de envio.':'Feed publica uma foto. O contato do WhatsApp é acrescentado à legenda.';});
$('publication-caption').addEventListener('input',()=>{pendingKey='';});
$('review-publication').addEventListener('click',()=>{const n=selectedUploads.size,format=$('publication-format').value;if(!n||(format==='Feed'&&n!==1)||(format==='Carrossel'&&(n<2||n>10))){message('publication-message',format==='Feed'?'Selecione exatamente uma foto para o Feed.':format==='Carrossel'?'Selecione de 2 a 10 fotos para o carrossel.':'Selecione as fotos que deseja publicar.',true);return;}$('confirmation-copy').textContent=`${n} foto(s) · ${format} · @vilainealvesstudio2026.${format==='Reels'?' Será criado um vídeo sem música.':''}`;$('publish-dialog').showModal();});
$('cancel-publish').addEventListener('click',()=>$('publish-dialog').close());
$('confirm-publish').addEventListener('click',async()=>{const button=$('confirm-publish');button.disabled=true;pendingKey||=crypto.randomUUID();try{const result=await api('/publish',{method:'POST',key:pendingKey,body:{uploadIds:[...selectedUploads],format:$('publication-format').value,caption:$('publication-caption').value}});$('publish-dialog').close();message('publication-message',result.message);selectedUploads.clear();pendingKey='';await Promise.all([loadUploads(),loadDashboard()]);}catch(error){$('publish-dialog').close();message('publication-message',error.message,true);}finally{button.disabled=false;}});
$('reload-uploads').addEventListener('click',()=>loadUploads().catch(error=>message('global-message',error.message,true)));
$('refresh-metrics').addEventListener('click',async()=>{const button=$('refresh-metrics');button.disabled=true;try{const result=await api('/metrics/refresh',{method:'POST'});message('global-message',result.message);}catch(error){message('global-message',error.message,true);}finally{button.disabled=false;}});
$('settings-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const result=await api('/settings',{method:'PATCH',body:{email:$('studio-email').value,phone:$('studio-phone').value,editingFolder:$('editing-folder').value}});message('settings-message',result.warning||'Informações salvas. O site e as próximas divulgações usarão os novos contatos.',!!result.warning);}catch(error){message('settings-message',error.message,true);}finally{button.disabled=false;}});
$('password-form').addEventListener('submit',async event=>{event.preventDefault();if($('new-password').value!==$('confirm-password').value){message('password-message','As novas senhas não coincidem.',true);return;}const button=event.submitter;button.disabled=true;try{const result=await api('/password',{method:'POST',body:{currentPassword:$('current-password').value,newPassword:$('new-password').value}});csrf=result.csrf;$('password-form').reset();message('password-message','Senha alterada. As outras sessões foram encerradas.');}catch(error){message('password-message',error.message,true);}finally{button.disabled=false;}});
(async()=>{try{const session=await api('/session');csrf=session.csrf;await authenticated();}catch(error){if(error.unavailable){$('backend-notice').hidden=false;$('login-form').querySelector('button[type="submit"]').disabled=true;}else if(error.status!==401)message('login-message',error.message,true);}})();
setInterval(()=>{if(csrf&&!$('dashboard-screen').hidden&&!$('publish-dialog').open)loadDashboard().catch(()=>{});},60000);
