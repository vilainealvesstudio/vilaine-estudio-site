import {normalizePhoto} from './photo-format.js';
import {photoName} from './file-name.js';
const cfg=window.VILAINE_CONFIG||{};
if(cfg.adminUrl&&new URL(cfg.adminUrl,location.href).origin!==location.origin)location.replace(cfg.adminUrl);
const $=id=>document.getElementById(id);
let csrf='',dashboard=null,uploads=[],selected=[],pendingKey='',busy=false;
const selectedUploads=new Set();
const messageDrafts=new Map(),photoRequests=new Map();
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
  $('stat-published').textContent=dashboard.counts.published??'—';
  $('stat-planned').textContent=dashboard.counts.planned;
  $('stat-attention').textContent=dashboard.counts.attention??'—';
  const recent=$('recent-publications');recent.replaceChildren();
  for(const item of dashboard.publications.slice(0,5))recent.append(publicationItem(item));
  if(!recent.children.length){const p=document.createElement('p');p.className='empty-state';p.textContent='As publicações aparecerão aqui quando entrarem na fila.';recent.append(p);}
  const table=$('publications-table');table.replaceChildren();
  for(const item of dashboard.publications){
    const tr=document.createElement('tr');
    for(const text of [item.title,item.format]){const td=document.createElement('td');td.textContent=text;tr.append(td);}
    const status=document.createElement('td');status.append(badge(item.status));if(item.highlightNote){const note=document.createElement('small');note.textContent=item.highlightNote;status.append(note);}if(item.error){const small=document.createElement('small');small.textContent=item.error;status.append(small);}tr.append(status);
    const when=document.createElement('td');when.textContent=date(item.scheduledAt);tr.append(when);
    const metrics=document.createElement('td');const m=item.metrics;
    metrics.textContent=m?Object.entries({Curtidas:m.likes,Comentários:m.comments,Salvamentos:m.saved,Compartilhamentos:m.shares,Visualizações:m.views,Alcance:m.reach}).filter(([,v])=>typeof v==='number').map(([k,v])=>`${k}: ${v}`).join(' · ')||'Indisponível':'Indisponível';tr.append(metrics);
    const link=document.createElement('td');if(/^https:\/\/(www\.)?instagram\.com\//.test(item.permalink||'')){const a=document.createElement('a');a.href=item.permalink;a.textContent='Ver ↗';a.className='text-link';a.target='_blank';a.rel='noopener';link.append(a);}else link.textContent='—';if(item.retryable&&item.requestId){const retry=document.createElement('button');retry.className='text-link';retry.textContent='Reenviar solicitação';retry.addEventListener('click',async()=>{retry.disabled=true;try{const result=await api(`/publications/${encodeURIComponent(item.requestId)}/retry`,{method:'POST'});message('global-message',result.message);await loadDashboard();}catch(error){message('global-message',error.message,true);retry.disabled=false;}});link.append(document.createElement('br'),retry);}tr.append(link);table.append(tr);
  }
  $('metrics-updated').textContent=dashboard.metricsUpdated?`Métricas atualizadas em ${date(dashboard.metricsUpdated)}. Horários de Brasília.`:'Métricas ainda não sincronizadas. Horários de Brasília.';
  $('integration-status').textContent=dashboard.integrationSummary;
  if(dashboard.warning)message('global-message',dashboard.warning);
}
async function loadSettings(){const data=await api('/settings');$('studio-email').value=data.email;$('studio-phone').value=data.phone;$('editing-folder').value=data.editingFolder;$('studio-highlights').value=(data.highlights||[]).join('\n');const menu=$('publication-highlight'),chosen=menu.value;menu.replaceChildren(new Option('Não adicionar a destaque',''),...(data.highlights||[]).map(name=>new Option(name,name)));menu.value=chosen;const whatsapp=`https://wa.me/${data.phone.replace(/\D/g,'')}`;$('instagram-whatsapp-link').href=whatsapp;$('instagram-whatsapp-url').textContent=whatsapp;}
async function loadGoogleConnection(){
  const status=await api('/google/status');
  $('google-status').textContent=status.connected?'Conta Google conectada. Os uploads usarão essa conta.':status.configured?'Pronto para autorizar. Clique abaixo e escolha a conta que possui a pasta.':'A configuração inicial OAuth ainda precisa ser cadastrada no Cloudflare.';
  $('google-redirect').textContent=status.redirectUri||'';
  $('connect-google').textContent=status.connected?'Reconectar conta Google':'Conectar minha conta Google';
  if(new URLSearchParams(location.search).get('google')==='conectado'&&status.connected)message('google-message','Conta Google conectada com sucesso. Tente enviar a foto novamente.');
  if(new URLSearchParams(location.search).get('google')==='cancelado')message('google-message','Autorização cancelada. Você pode conectar novamente.',true);
}
function previewCard(src,name,detail,checkbox){const card=document.createElement('div');card.className='photo-card';if(checkbox){const input=document.createElement('input');input.type='checkbox';input.setAttribute('aria-label',`Selecionar ${name}`);input.checked=selectedUploads.has(checkbox);input.addEventListener('change',()=>{input.checked?selectedUploads.add(checkbox):selectedUploads.delete(checkbox);pendingKey='';});card.append(input);}const image=document.createElement('img');image.src=src;image.alt=name;image.loading='lazy';const caption=document.createElement('div');caption.className='photo-caption';caption.textContent=name;const small=document.createElement('small');small.textContent=detail;caption.append(small);card.append(image,caption);return card;}
function nameEditor(card,name,onSave){
  const box=document.createElement('div');box.className='file-name-editor';
  const input=document.createElement('input');input.type='text';input.value=name;input.maxLength=180;input.dataset.fileName='true';input.setAttribute('aria-label','Nome do arquivo');
  const save=document.createElement('button');save.type='button';save.className='text-link';save.textContent='Salvar nome';
  save.addEventListener('click',async()=>{save.disabled=true;input.disabled=true;try{input.value=await onSave(input.value);message('upload-message','Nome salvo.');}catch(error){message('upload-message',error.message,true);}finally{save.disabled=false;input.disabled=false;}});
  box.append(input,save);card.append(box);return input;
}
function renderSelected(){
  $('selected-files').replaceChildren(...selected.map(item=>{const card=previewCard(item.preview,item.file.name,item.done?'Enviado':`${(item.file.size/1024/1024).toFixed(1)} MB`);
    if(!item.done)item.nameInput=nameEditor(card,item.file.name,async value=>{if(busy)throw new Error('Aguarde o envio terminar.');const name=photoName(value,item.file.name,item.file.type);item.file=new File([item.file],name,{type:item.file.type,lastModified:item.file.lastModified});item.key=crypto.randomUUID();card.querySelector('.photo-caption').firstChild.textContent=name;return name;});return card;}));
}
async function loadUploads(){
  const result=await api('/uploads');uploads=result.items;
  for(const id of selectedUploads)if(!uploads.some(item=>item.id===id&&!item.claimed))selectedUploads.delete(id);
  const grid=$('uploaded-files');grid.replaceChildren();
  for(const item of uploads){
    const card=previewCard(`${cfg.apiBase||''}/api/uploads/${encodeURIComponent(item.id)}/preview`,item.name,item.status|| (item.claimed?'Encaminhado para publicação':'Na pasta de edição'),!item.claimed?item.id:null);grid.append(card);
    if(!item.claimed)nameEditor(card,item.name,async value=>{const result=await api(`/uploads/${encodeURIComponent(item.id)}`,{method:'PATCH',body:{name:value}});item.name=result.name;pendingKey='';card.querySelector('.photo-caption').firstChild.textContent=result.name;return result.name;});
    const messageBox=document.createElement('div');messageBox.className='file-name-editor';
    const label=document.createElement('label');label.textContent='Mensagem desta foto';label.htmlFor=`message-${item.id}`;
    const field=document.createElement('textarea');field.id=label.htmlFor;field.rows=3;field.maxLength=1900;field.dataset.fileName='true';field.value=messageDrafts.get(item.id)??item.message??'';field.placeholder='Escreva a legenda ou deixe em branco para usar o nome/conteúdo.';field.disabled=item.claimed;
    field.addEventListener('input',()=>{messageDrafts.set(item.id,field.value);photoRequests.delete(item.id);pendingKey='';});
    const saveMessage=document.createElement('button');saveMessage.type='button';saveMessage.className='text-link';saveMessage.textContent='Salvar mensagem';saveMessage.disabled=item.claimed;
    saveMessage.addEventListener('click',async()=>{saveMessage.disabled=true;try{await api(`/uploads/${item.id}/message`,{method:'PATCH',body:{message:field.value}});item.message=field.value;message('publication-message','Mensagem salva.');}catch(error){message('publication-message',error.message,true);}finally{saveMessage.disabled=item.claimed;}});
    messageBox.append(label,field,saveMessage);card.append(messageBox);
    if(item.archivePending){const retry=document.createElement('button');retry.type='button';retry.className='text-link photo-download';retry.textContent='Mover para Publicados';retry.addEventListener('click',async()=>{retry.disabled=true;try{const result=await api(`/publications/${encodeURIComponent(item.publicationId)}/archive`,{method:'POST'});message('publication-message',result.message);}catch(error){message('publication-message',error.message,true);}finally{retry.disabled=false;}});card.append(retry);}
    const hide=document.createElement('button');hide.type='button';hide.className='button button-outline photo-download';hide.textContent='Retirar do painel';hide.addEventListener('click',()=>hideUploads([item.id]));card.append(hide);
    const download=document.createElement('a');download.className='text-link photo-download';download.href=`${cfg.apiBase||''}/api/uploads/${encodeURIComponent(item.id)}/download`;download.textContent='Baixar original';card.append(download);
  }
  if(!uploads.length){const p=document.createElement('p');p.className='empty-state';p.textContent='Nenhuma foto aguardando publicação. Os arquivos publicados ficam em Publicados e no histórico.';grid.append(p);}
}
async function authenticated(){showDashboard();await Promise.all([loadDashboard(),loadSettings(),loadUploads(),loadGoogleConnection()]);}
$('github-access').href=`https://github.com/${cfg.repository}/actions`;
$('today').textContent=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'long'}).format(new Date());
for(const el of document.querySelectorAll('[data-view]'))el.addEventListener('click',()=>showView(el.dataset.view));
for(const el of document.querySelectorAll('[data-open-content]'))el.addEventListener('click',()=>showView('content'));
$('login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;message('login-message','Verificando acesso…');try{const data=await api('/login',{method:'POST',body:{username:$('username').value,password:$('password').value}});csrf=data.csrf;$('password').value='';message('login-message','');await authenticated();}catch(error){message('login-message',error.message,true);}finally{button.disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('/logout',{method:'POST'});showLogin();}catch(error){message('global-message',error.message,true);}});
$('photo-files').addEventListener('change',async()=>{
  for(const item of selected)URL.revokeObjectURL(item.preview);
  let files=[...$('photo-files').files];
  if(files.length>10||files.some(f=>f.size>12*1024*1024)){selected=[];$('selected-files').replaceChildren();$('upload-photos').disabled=true;message('upload-message','Escolha até 10 fotos JPEG/PNG, com no máximo 12 MB cada.',true);return;}
  try{files=await Promise.all(files.map(normalizePhoto));}catch(error){selected=[];$('selected-files').replaceChildren();$('upload-photos').disabled=true;message('upload-message',error.message,true);return;}
  selected=files.map(file=>({file,key:crypto.randomUUID(),preview:URL.createObjectURL(file),done:false}));renderSelected();$('upload-photos').disabled=!selected.length;message('upload-message','');
});
async function uploadSelection(){
  const uploaded=[];
  try{
    for(const item of selected){const name=photoName(item.nameInput?.value??item.file.name,item.file.name,item.file.type);
      if(name!==item.file.name){item.file=new File([item.file],name,{type:item.file.type,lastModified:item.file.lastModified});item.key=crypto.randomUUID();}}
    for(const item of [...selected]){
      message('upload-message',`Enviando ${item.file.name}…`);
      const body=new FormData();body.append('file',item.file);
      const result=await api('/uploads',{method:'POST',body,key:item.key});uploaded.push(result.id);
      selected=selected.filter(x=>x!==item);URL.revokeObjectURL(item.preview);renderSelected();
    }
  }finally{if(!selected.length)$('photo-files').value='';await loadUploads();}
  message('upload-message','Envio ao Drive confirmado. As fotos estão em Próximo passo; marque as que deseja publicar.');return uploaded;
}
$('upload-photos').addEventListener('click',async()=>{if(busy)return;busy=true;$('upload-photos').disabled=true;try{await uploadSelection();}catch(error){message('upload-message',error.message,true);}finally{busy=false;$('upload-photos').disabled=selected.every(x=>x.done);}});
$('publication-format').addEventListener('change',()=>{pendingKey='';photoRequests.clear();const format=$('publication-format').value;$('highlight-control').hidden=format!=='Story';$('format-help').textContent=format==='Reels'?'Reels cria um vídeo vertical com as fotos selecionadas, sem música. Os originais são preservados.':format==='Story'?'Story publica uma foto por vez. Requer conta Business e permissão oficial. A mensagem fica no histórico: a API não adiciona texto, links ou stickers à imagem.':format==='Carrossel'?'Carrossel publica de 2 a 10 fotos, na ordem de envio.':'Feed cria uma publicação por foto marcada, usando a mensagem de cada foto. O WhatsApp é acrescentado à legenda.';});
$('review-publication').addEventListener('click',async()=>{
  if(busy)return;const n=selectedUploads.size||selected.length,format=$('publication-format').value;
  if(!n||(format==='Carrossel'&&(n<2||n>10))){message('publication-message',format==='Feed'?'Escolha uma foto acima ou selecione uma foto já enviada.':format==='Carrossel'?'Escolha ou selecione de 2 a 10 fotos.':'Escolha as fotos que deseja publicar.',true);return;}
  busy=true;$('review-publication').disabled=true;
  try{
    const integrations=await api('/integrations');
    if(!integrations.github)throw new Error('Para publicar, configure GITHUB_API_TOKEN nos segredos do Worker. O aviso no topo indica essa pendência.');
    if(!selectedUploads.size){message('publication-message','Enviando as fotos selecionadas antes da confirmação…');for(const id of await uploadSelection())selectedUploads.add(id);}
    $('confirmation-copy').textContent=`${selectedUploads.size} foto(s) · ${['Feed','Story'].includes(format)?`${format}: uma publicação por foto`:format} · @vilainealvesstudio2026.${format==='Reels'?' Será criado um vídeo sem música.':''}${format==='Story'&&$('publication-highlight').value?` Destaque: ${$('publication-highlight').value} — adicionar manualmente no Instagram.`:''}`;
    message('publication-message','');$('publish-dialog').showModal();
  }catch(error){message('publication-message',error.message,true);}finally{busy=false;$('review-publication').disabled=false;}
});
$('publication-highlight').addEventListener('change',()=>{pendingKey='';photoRequests.clear();});
$('cancel-publish').addEventListener('click',()=>$('publish-dialog').close());
$('confirm-publish').addEventListener('click',async()=>{
  const button=$('confirm-publish');button.disabled=true;busy=true;
  try{
    const ids=[...selectedUploads],format=$('publication-format').value;
    const caption=id=>messageDrafts.get(id)??uploads.find(item=>item.id===id)?.message??'';
    for(const id of ids)await api(`/uploads/${id}/message`,{method:'PATCH',body:{message:caption(id)}});
    if(['Feed','Story'].includes(format)){
      for(const id of ids){if(!photoRequests.has(id))photoRequests.set(id,crypto.randomUUID());await api('/publish',{method:'POST',key:photoRequests.get(id),body:{uploadIds:[id],format,caption:caption(id),...(format==='Story'&&$('publication-highlight').value?{highlight:$('publication-highlight').value}:{})}});selectedUploads.delete(id);}
    }else{
      pendingKey||=crypto.randomUUID();await api('/publish',{method:'POST',key:pendingKey,body:{uploadIds:ids,format,caption:ids.map(caption).filter(Boolean).join('\n\n').slice(0,1900)}});selectedUploads.clear();pendingKey='';
    }
    message('publication-message','Solicitações enviadas. Após confirmar a publicação e a movimentação para Publicados, as fotos sairão desta lista.');
  }catch(error){message('publication-message',error.message,true);}
  finally{$('publish-dialog').close();button.disabled=false;busy=false;await Promise.all([loadUploads(),loadDashboard()]).catch(()=>{});}
});
async function hideUploads(ids){
  if(busy||!ids.length)return;busy=true;
  try{const result=await api('/uploads/hide',{method:'POST',body:{ids}});for(const id of ids){selectedUploads.delete(id);messageDrafts.delete(id);}message('publication-message',result.message);await loadUploads();}catch(error){message('publication-message',error.message,true);}finally{busy=false;}
}
$('clear-uploads').addEventListener('click',()=>hideUploads(uploads.map(item=>item.id)));
$('clear-selected').addEventListener('click',()=>{if(busy)return;for(const item of selected)URL.revokeObjectURL(item.preview);selected=[];$('photo-files').value='';renderSelected();$('upload-photos').disabled=true;message('upload-message','Seleção limpa.');});
$('reload-uploads').addEventListener('click',()=>loadUploads().catch(error=>message('global-message',error.message,true)));
$('refresh-metrics').addEventListener('click',async()=>{const button=$('refresh-metrics');button.disabled=true;try{const result=await api('/metrics/refresh',{method:'POST'});message('global-message',result.message);}catch(error){message('global-message',error.message,true);}finally{button.disabled=false;}});
$('settings-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{const result=await api('/settings',{method:'PATCH',body:{email:$('studio-email').value,phone:$('studio-phone').value,editingFolder:$('editing-folder').value,highlights:$('studio-highlights').value.split('\n').map(name=>name.trim()).filter(Boolean)}});await loadSettings();message('settings-message',result.warning||'Informações salvas. O site e as próximas divulgações usarão os novos contatos.',!!result.warning);}catch(error){message('settings-message',error.message,true);}finally{button.disabled=false;}});
$('password-form').addEventListener('submit',async event=>{event.preventDefault();if($('new-password').value!==$('confirm-password').value){message('password-message','As novas senhas não coincidem.',true);return;}const button=event.submitter;button.disabled=true;try{const result=await api('/password',{method:'POST',body:{currentPassword:$('current-password').value,newPassword:$('new-password').value}});csrf=result.csrf;$('password-form').reset();message('password-message','Senha alterada. As outras sessões foram encerradas.');}catch(error){message('password-message',error.message,true);}finally{button.disabled=false;}});
(async()=>{try{const session=await api('/session');csrf=session.csrf;await authenticated();}catch(error){if(error.unavailable){$('backend-notice').hidden=false;$('login-form').querySelector('button[type="submit"]').disabled=true;}else if(error.status!==401)message('login-message',error.message,true);}})();
setInterval(()=>{if(csrf&&!$('dashboard-screen').hidden&&!$('publish-dialog').open)Promise.all([loadDashboard(),...(!busy&&!document.activeElement?.matches('[data-file-name]')?[loadUploads()]:[])]).catch(()=>{});},60000);

$('connect-google').addEventListener('click',async()=>{const button=$('connect-google');button.disabled=true;try{const result=await api('/google/connect',{method:'POST'});const url=new URL(result.url);if(url.origin!=='https://accounts.google.com')throw new Error('Endereço de autorização inválido.');location.assign(url.href);}catch(error){message('google-message',error.message,true);button.disabled=false;}});

$('check-github').addEventListener('click',async()=>{const button=$('check-github');button.disabled=true;message('github-message','Testando acesso ao repositório e ao workflow…');try{const result=await api('/github/check',{method:'POST'});message('github-message',result.message);await loadDashboard();}catch(error){message('github-message',error.message,true);}finally{button.disabled=false;}});
