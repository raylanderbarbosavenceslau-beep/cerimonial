const API=window.API_BASE_URL||'/api';
let state={token:localStorage.getItem('cerimonial_token')||null,role:localStorage.getItem('cerimonial_role')||null,user:JSON.parse(localStorage.getItem('cerimonial_user')||'null')};
function toast(message,error=false){const e=document.createElement('div');e.className='toast'+(error?' error':'');e.textContent=message;document.body.appendChild(e);setTimeout(()=>e.remove(),3000)}
function fmtDate(d){return d?new Date(d).toLocaleDateString('pt-BR',{timeZone:'UTC'}):'-'}
function fmtMoney(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function badge(s){const m={solicitado:['blue','Solicitado'],em_analise:['yellow','Em análise'],orcamento_enviado:['yellow','Orçamento enviado'],aguardando_cliente:['yellow','Aguardando cliente'],aguardando_pagamento:['yellow','Aguardando pagamento'],aprovado:['green','Aprovado'],equipe_sendo_montada:['blue','Equipe sendo montada'],equipe_confirmada:['green','Equipe confirmada'],em_andamento:['blue','Em andamento'],finalizado:['green','Finalizado'],cancelado:['red','Cancelado'],pending:['yellow','Pendente'],active:['green','Ativo'],blocked:['red','Bloqueado'],confirmado:['green','Confirmado'],convidado:['yellow','Convidado'],recusado:['red','Recusado'],enviado:['yellow','Enviado'],aceito:['green','Aceito'],alteracao_solicitada:['yellow','Alteração solicitada']};const [c,t]=m[s]||['',s||'-'];return `<span class="badge ${c}">${t}</span>`}
async function api(path,o={}){const h={'Content-Type':'application/json'};if(state.token)h.Authorization=`Bearer ${state.token}`;let r;try{r=await fetch(API+path,{method:o.method||'GET',headers:h,body:o.body?JSON.stringify(o.body):undefined})}catch(e){throw new Error('Não foi possível conectar ao servidor. Inicie o projeto na pasta imperio-cerimonial com npm.cmd start e tente novamente.')};let d={};try{d=await r.json()}catch(e){}if(r.status===401&&state.token&&path!=='/auth/login'){clearSession();location.href='index.html';throw new Error('Sessão expirada.')}if(!r.ok)throw new Error(d.error||'Erro inesperado.');return d}
function saveSession(t,u){state={token:t,role:u.role,user:u};localStorage.setItem('cerimonial_token',t);localStorage.setItem('cerimonial_role',u.role);localStorage.setItem('cerimonial_user',JSON.stringify(u))}
function clearSession(){localStorage.removeItem('cerimonial_token');localStorage.removeItem('cerimonial_role');localStorage.removeItem('cerimonial_user');state={token:null,role:null,user:null}}
function logout(){clearSession();location.replace('index.html')}
function protect(role){if(!state.token||!state.user){location.href=role==='admin'?'admin-login.html':role==='professional'?'profissional-login.html':role==='client'?'cliente-login.html':'index.html';return false}if(role&&state.role!==role){location.href=state.role==='client'?'cliente.html':state.role==='professional'?'profissional.html':'admin.html';return false}return true}
function common(){document.querySelectorAll('[data-logout]').forEach(b=>b.onclick=logout);document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=`${state.user?.name||''} · ${state.role}`);document.querySelectorAll('[data-avatar]').forEach(e=>e.textContent=(state.user?.name||'?')[0].toUpperCase())}
function setupLogin(){const f=document.querySelector('[data-login-form]');if(!f)return;if(state.token&&state.user){location.replace(state.user.role==='client'?'cliente.html':state.user.role==='professional'?'profissional.html':'admin.html');return}f.onsubmit=async e=>{e.preventDefault();try{const d=await api('/auth/login',{method:'POST',body:{email:f.email.value.trim(),password:f.password.value}});const expected=document.body.dataset.loginRole;if(expected&&d.user.role!==expected)throw new Error('Esta conta não possui acesso a esta área.');saveSession(d.token,d.user);const returnTo=new URLSearchParams(location.search).get('returnTo');const returnParams=returnTo?.startsWith('/pagamento-retorno.html?')?new URLSearchParams(returnTo.split('?')[1]):null;const paymentReturnAllowed=Boolean(returnParams&&((expected==='client'&&returnParams.get('payment_type')!=='priority')||(expected==='professional'&&returnParams.get('payment_type')==='priority')));location.href=paymentReturnAllowed?returnTo:d.user.role==='client'?'cliente.html':d.user.role==='professional'?'profissional.html':'admin.html'}catch(e){toast(e.message,true)}}}
function setupGoogleLogin(){const button=document.querySelector('[data-google-login]');if(!button)return;const accountRole=document.body.dataset.loginRole;if(!['client','professional'].includes(accountRole))return;const params=new URLSearchParams(location.search);const returnTo=params.get('returnTo');if(returnTo)button.href=`/auth/google/start?role=${accountRole}&returnTo=${encodeURIComponent(returnTo)}`;const error=params.get('googleError');const messages={not_configured:'O login com Google ainda não foi configurado no servidor.',denied:'O acesso com Google foi cancelado.',failed:'Não foi possível entrar com Google. Tente novamente.',no_account:accountRole==='client'?'Não há cadastro de cliente vinculado a este e-mail. Crie sua conta antes de entrar.':'Não há cadastro profissional vinculado a este e-mail. Crie seu cadastro antes de entrar.',pending:accountRole==='client'?'Sua conta não está ativa.':'Seu cadastro profissional ainda não foi aprovado.'};if(error){toast(messages[error]||messages.failed,true);params.delete('googleError');const query=params.toString();history.replaceState(null,'',`${location.pathname}${query?`?${query}`:''}`)}const hash=new URLSearchParams(location.hash.slice(1));const ticket=hash.get('googleTicket');if(!ticket)return;history.replaceState(null,'',`${location.pathname}${location.search}`);button.setAttribute('aria-disabled','true');button.textContent='Entrando...';api('/auth/google/exchange',{method:'POST',body:{ticket}}).then(data=>{if(data.user.role!==accountRole)throw new Error('Esta conta não possui acesso a esta área.');saveSession(data.token,data.user);const destinationParams=new URLSearchParams(location.search).get('returnTo');const paymentParams=destinationParams?.startsWith('/pagamento-retorno.html?')?new URLSearchParams(destinationParams.split('?')[1]):null;const paymentAllowed=paymentParams&&(accountRole==='client'?paymentParams.get('payment_type')!=='priority':paymentParams.get('payment_type')==='priority');location.replace(paymentAllowed?destinationParams:accountRole==='client'?'cliente.html':'profissional.html')}).catch(error=>{button.removeAttribute('aria-disabled');button.textContent='Entrar com Google';toast(error.message,true)})}
function setupClientReg(){const f=document.querySelector('[data-client-register-form]');if(!f)return;f.onsubmit=async e=>{e.preventDefault();try{const d=await api('/auth/register/client',{method:'POST',body:{name:f.name.value.trim(),email:f.email.value.trim(),phone:f.phone.value.trim(),password:f.password.value,city:f.city.value.trim(),state:f.state.value.trim()}});saveSession(d.token,d.user);location.href='cliente.html'}catch(e){toast(e.message,true)}}}
function setupProReg(){const f=document.querySelector('[data-professional-register-form]');if(!f)return;f.onsubmit=async e=>{e.preventDefault();try{await api('/auth/register/professional',{method:'POST',body:{name:f.name.value.trim(),email:f.email.value.trim(),phone:f.phone.value.trim(),password:f.password.value,city:f.city.value.trim(),state:f.state.value.trim(),bio:f.bio.value.trim(),serviceIds:[...f.querySelectorAll('[name="serviceIds"]:checked')].map(x=>Number(x.value))}});toast('Cadastro enviado. Aguarde a aprovação.');setTimeout(()=>location.href='profissional-login.html',700)}catch(e){toast(e.message,true)}}}
async function clientView(v){
  document.querySelectorAll('[data-client-view]').forEach(b=>b.classList.toggle('active',b.dataset.clientView===v));
  const c=document.getElementById('content');
  c.innerHTML='<div class="pro-loading"><span class="loading-dot"></span><span>Preparando sua área do cliente...</span></div>';
  if(v==='new-event')return clientNewEvent(c);
  if(v==='events')return clientEvents(c);
  if(v==='quotes')return clientQuotes(c);
  try{
    const events=await api('/events/mine');
    const today=localDateISO();
    const quoteGroups=await Promise.all(events.map(ev=>api(`/quotes/event/${ev.id}`).catch(()=>[])));
    const quotes=quoteGroups.flat().map((q,i)=>({...q,event:events.find(ev=>ev.id===q.event_id)||events[i]}));
    const pendingQuotes=quotes.filter(q=>q.status==='enviado');
    const upcoming=events.filter(e=>e.event_date>=today&&!['cancelado','finalizado'].includes(e.status)).sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date)));
    const next=upcoming[0];
    const finalized=events.filter(e=>e.status==='finalizado').length;
    const pendingEvents=events.filter(e=>['solicitado','em_analise','orcamento_enviado','aguardando_cliente','aguardando_pagamento'].includes(e.status)).length;
    const eventCount=document.querySelector('[data-client-events-count]');if(eventCount)eventCount.textContent=String(pendingEvents);
    const quoteCount=document.querySelector('[data-client-quotes-count]');if(quoteCount)quoteCount.textContent=String(pendingQuotes.length);
    const recent=events.slice(0,3);
    c.innerHTML=`<div class="pro-dashboard client-dashboard">
      <section class="pro-welcome client-welcome"><div class="pro-welcome-pattern"></div><div class="pro-welcome-copy"><span class="pro-kicker">ESPAÇO DO CLIENTE</span><h1>Olá, ${escapeHtml((state.user.name||'cliente').trim().split(/\s+/)[0])} <span>✦</span></h1><p>Seu evento começa com uma boa ideia. Acompanhe suas solicitações, veja os orçamentos e organize cada detalhe em um só lugar.</p><div class="pro-welcome-chips"><span>● Conta ativa</span><span>⌖ ${escapeHtml([state.user.city,state.user.state].filter(Boolean).join(' · ')||'Seus eventos, do seu jeito')}</span></div></div><div class="pro-welcome-illustration"><div class="pro-illustration-ring"></div><div class="pro-illustration-star">✦</div><div class="pro-illustration-card"><small>SEU PRÓXIMO PASSO</small><strong>${pendingQuotes.length?`${pendingQuotes.length} orçamento${pendingQuotes.length===1?'':'s'} para analisar`:next?'Seu evento está tomando forma':'Vamos planejar algo especial?'}</strong><span>${pendingQuotes.length?'Confira os valores e responda à proposta.':next?`${escapeHtml(next.event_type)} · ${escapeHtml(fmtDate(next.event_date))}`:'Crie sua primeira solicitação quando estiver pronto.'}</span></div></div></section>
      <div class="pro-stats-grid client-stats-grid">${proMetric('◇','Minhas solicitações',events.length,'Todos os eventos cadastrados','gold')}${proMetric('R$','Orçamentos para analisar',pendingQuotes.length,pendingQuotes.length?'Aguardando sua decisão':'Nenhum orçamento pendente','purple')}${proMetric('◷','Próximos eventos',upcoming.length,'Solicitações não encerradas','blue')}${proMetric('✓','Eventos finalizados',finalized,'Momentos já realizados','green')}</div>
      <div class="pro-dashboard-grid client-dashboard-grid"><section class="pro-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">ACOMPANHAMENTO</span><h2>Seu próximo evento</h2></div><button class="pro-text-button" data-client-go="events">Ver meus eventos →</button></div>${next?`<div class="client-next-event"><div class="client-next-date"><strong>${escapeHtml(String(next.event_date||'').slice(8,10)||'--')}</strong><span>${escapeHtml(new Date(`${next.event_date}T12:00:00`).toLocaleDateString('pt-BR',{month:'short'}).replace('.',''))}</span></div><div class="client-next-body"><div class="client-next-status">${badge(next.status)}</div><h3>${escapeHtml(next.event_type||'Evento')}</h3><p>${escapeHtml(next.city||'Cidade a definir')} · ${Number(next.guest_count||0).toLocaleString('pt-BR')} convidados</p><div class="client-next-meta"><span>◷ ${escapeHtml(fmtDate(next.event_date))}${next.start_time?' · '+escapeHtml(next.start_time):''}</span><span>⌖ ${escapeHtml(next.address||'Local a definir')}</span></div></div></div><div class="pro-panel-footer"><div><span class="pro-footer-icon">✦</span><span><strong>Deixe tudo nos trilhos</strong><small>Confira serviços, quantidades e preferências cadastradas.</small></span></div><button class="btn ghost" data-client-go="events">Acompanhar evento</button></div>`:`<div class="pro-empty"><div class="pro-empty-icon">✦</div><h3>Seu próximo grande momento começa aqui</h3><p>Conte para a Imperio Cerimonial o que está planejando e monte seu pedido em poucas etapas.</p><button class="btn secondary" data-client-go="new-event">Criar minha solicitação</button></div>`}</section>
      <section class="pro-panel client-quotes-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">PROPOSTAS RECEBIDAS</span><h2>Orçamentos recentes</h2></div><span class="pro-count-pill">${pendingQuotes.length} pendente${pendingQuotes.length===1?'':'s'}</span></div><div class="pro-invite-list">${pendingQuotes.slice(0,3).map(q=>`<div class="pro-mini-invite"><div class="pro-mini-invite-icon">R$</div><div class="pro-mini-invite-copy"><strong>${escapeHtml(q.event?.event_type||`Evento #${q.event_id}`)}</strong><span>Proposta #${q.id} · ${escapeHtml(fmtDate(q.created_at))}</span><small>${fmtMoney(q.total)}</small></div><span class="pro-mini-status">Analisar</span></div>`).join('')||'<div class="pro-inline-empty"><span>✓</span><div><strong>Nenhum orçamento pendente</strong><p>Quando a equipe preparar uma proposta, ela aparecerá aqui para você analisar.</p></div></div>'}</div><button class="pro-full-button" data-client-go="quotes">Ver todos os orçamentos <span>→</span></button></section></div>
      <section class="pro-panel client-recent-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">MOVIMENTAÇÕES</span><h2>Solicitações recentes</h2><p>Confira rapidamente os últimos eventos que você cadastrou.</p></div><button class="btn ghost" data-client-go="events">Abrir lista completa</button></div><div class="client-recent-list">${recent.map(ev=>`<article class="client-recent-row"><div class="client-recent-mark">${escapeHtml(String(ev.event_date||'').slice(8,10)||'✦')}</div><div class="client-recent-main"><strong>${escapeHtml(ev.event_type)}</strong><span>${escapeHtml(fmtDate(ev.event_date))} · ${escapeHtml(ev.city)} · ${Number(ev.guest_count||0).toLocaleString('pt-BR')} convidados</span></div>${badge(ev.status)}<button class="client-inline-link" data-open-event="${ev.id}">Detalhes →</button></article>`).join('')||'<div class="pro-inline-empty"><span>✦</span><div><strong>Você ainda não criou solicitações</strong><p>Comece agora e organize seu evento com a nossa equipe.</p></div></div>'}</div></section>
      <section class="client-quick-grid"><button class="pro-quick-card" data-client-go="new-event"><span class="pro-quick-icon icon-gold">＋</span><span><strong>Solicitar evento</strong><small>Descreva seu evento e os serviços desejados</small></span><b>→</b></button><button class="pro-quick-card" data-client-go="events"><span class="pro-quick-icon icon-blue">▤</span><span><strong>Meus eventos</strong><small>Consulte status, detalhes e alterações permitidas</small></span><b>→</b></button><button class="pro-quick-card" data-client-go="quotes"><span class="pro-quick-icon icon-green">R$</span><span><strong>Meus orçamentos</strong><small>Analise valores e responda às propostas</small></span><b>→</b></button></section>
    </div>`;
    c.querySelectorAll('[data-client-go]').forEach(b=>b.onclick=()=>clientView(b.dataset.clientGo));
    c.querySelectorAll('[data-open-event]').forEach(b=>b.onclick=()=>clientView('events').then(()=>{const card=document.querySelector(`[data-client-event="${b.dataset.openEvent}"]`);if(card){card.scrollIntoView({behavior:'smooth',block:'center'});const details=card.querySelector('.client-event-details');if(details){details.hidden=false;const toggle=card.querySelector('[data-event-details-toggle]');if(toggle)toggle.textContent='Ocultar detalhes';}}}));
  }catch(e){c.innerHTML=`<section class="pro-panel pro-error"><div class="pro-error-icon">!</div><h2>Não foi possível carregar seu painel</h2><p>${escapeHtml(e.message)}</p><button class="btn secondary" onclick="clientView('dashboard')">Tentar novamente</button></section>`}
}
  const EVENT_SPECIFICATIONS={
    'decoração':[
      {id:'natural-flowers',label:'Flores naturais'},
      {id:'artificial-flowers',label:'Flores artificiais'},
      {id:'table-centerpieces',label:'Arranjos para mesas dos convidados'},
      {id:'main-table',label:'Decoração da mesa principal'},
      {id:'photo-backdrop',label:'Painel para fotos'},
      {id:'balloons',label:'Arcos ou arranjos de balões'},
      {id:'candles',label:'Velas decorativas'},
      {id:'themed-decoration',label:'Decoração temática'}
    ],
    'iluminação':[
      {id:'ambient-lighting',label:'Iluminação ambiente'},
      {id:'dance-floor',label:'Iluminação para pista de dança'},
      {id:'moving-heads',label:'Moving heads'},
      {id:'architectural-lighting',label:'Iluminação cênica do espaço'},
      {id:'string-lights',label:'Cordões de luz decorativos'},
      {id:'spotlights',label:'Refletores e focos de destaque'},
      {id:'led-uplights',label:'Luzes LED no piso (uplights)'}
    ],
    'buffet':[
      {id:'buffet-dinner',label:'Jantar',group:'menu'},
      {id:'buffet-cocktail',label:'Coquetel',group:'menu'},
      {id:'buffet-barbecue',label:'Churrasco',group:'menu'},
      {id:'buffet-brunch',label:'Brunch',group:'menu'},
      {id:'vegetarian-options',label:'Opções vegetarianas'},
      {id:'vegan-options',label:'Opções veganas'},
      {id:'gluten-free-options',label:'Opções sem glúten'},
      {id:'lactose-free-options',label:'Opções sem lactose'},
      {id:'kids-menu',label:'Cardápio infantil'},
      {id:'dessert-table',label:'Mesa de sobremesas'}
    ],
    'som':[
      {id:'sound-500w',label:'Caixas de som: até 500 W',group:'power'},
      {id:'sound-1000w',label:'Caixas de som: até 1.000 W',group:'power'},
      {id:'sound-2000w',label:'Caixas de som: até 2.000 W',group:'power'},
      {id:'sound-3000w',label:'Caixas de som: até 3.000 W',group:'power'},
      {id:'wireless-microphone',label:'Microfone sem fio'},
      {id:'wired-microphone',label:'Microfone com fio'},
      {id:'dj-setup',label:'Equipamento para DJ'},
      {id:'stage-monitor',label:'Retorno de palco'}
    ]
  };
  const EVENT_SPECIFICATION_LABELS=new Map(Object.values(EVENT_SPECIFICATIONS).flat().map(option=>[option.id,option.label]));
  const QUANTITYLESS_SERVICES=new Set(['cerimonial','decoração','iluminação']);
  async function clientNewEvent(c,existing=null){
  document.querySelectorAll('[data-client-view]').forEach(button=>button.classList.toggle('active',button.dataset.clientView==='new-event'));
  let services,catalog,servicePrices;
  const catalogQuery=new URLSearchParams();
  if(existing?.event_date)catalogQuery.set('date',existing.event_date);
  if(existing?.id)catalogQuery.set('excludeEvent',String(existing.id));
  const catalogPath=`/professionals/catalog${catalogQuery.size?`?${catalogQuery}`:''}`;
  try{[services,catalog,servicePrices]=await Promise.all([api('/services'),api(catalogPath),api('/service-prices')])}catch(error){
    c.innerHTML=`<section class="card empty"><h2>Não foi possível carregar os serviços e profissionais</h2><p>${escapeHtml(error.message)}</p><button class="btn primary" id="retryEventForm">Tentar novamente</button></section>`;
    document.getElementById('retryEventForm').onclick=()=>clientNewEvent(c,existing);
    return;
  }
  const today=new Date();
  const minDate=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const oldStyle=existing?.event_style||{};
  const oldQuantities=Array.isArray(existing?.service_quantities)?existing.service_quantities.map(x=>({serviceId:Number(x.service_id??x.serviceId),quantity:Number(x.quantity)||1,options:Array.isArray(x.options)?x.options:[]})):Array.isArray(existing?.service_ids)?existing.service_ids.map(x=>({serviceId:Number(x),quantity:1,options:[]})):[];
  const oldQuantityById=new Map(oldQuantities.map(x=>[x.serviceId,x]));
  const oldRequested=Array.isArray(existing?.requested_professionals)?existing.requested_professionals:[];
  const oldChoiceKeys=new Set(oldRequested.map(item=>`${Number(item.service_id)}:${Number(item.professional_id)}`));
  const paletteOptions=[['Dourado','#c9a45c'],['Branco','#ffffff'],['Preto','#171717'],['Azul','#3e668e'],['Verde','#55765b'],['Rosa','#d98aa6'],['Lilás','#9278b5'],['Terracota','#c36f4f'],['Neutros','#c9bfb0']];
  const decorationStyleClasses=new Map([['Clássico e elegante','classic'],['Luxuoso','luxurious'],['Rústico','rustic'],['Moderno','modern'],['Minimalista','minimal'],['Romântico','romantic'],['Tropical','tropical'],['Temático','themed'],['Outro','other']]);
  const descriptions={Cerimonial:'Planejamento e coordenação do evento',Recepcionista:'Recepção e orientação de convidados',Garçom:'Equipe de atendimento às mesas',Segurança:'Controle de acesso e segurança',Fotografia:'Registro fotográfico dos momentos',Filmagem:'Filmagem e registro em vídeo',Decoração:'Ambientação e decoração do espaço',Som:'Áudio, microfones e operação de som',Iluminação:'Iluminação decorativa e técnica',Buffet:'Comidas, bebidas e atendimento dos convidados'};
  const quantityCards=services.map(s=>{
    const id=Number(s.id),name=String(s.name),normalizedName=name.toLocaleLowerCase('pt-BR'),isBuffet=normalizedName==='buffet',noQuantity=QUANTITYLESS_SERVICES.has(normalizedName);
    const selected=oldQuantityById.has(id),previous=oldQuantityById.get(id);
    const qty=previous?.quantity||(isBuffet?Number(existing?.guest_count)||1:1);
    const oldOptions=new Set(previous?.options||[]);
    const specifications=EVENT_SPECIFICATIONS[normalizedName]||[];
    const providers=catalog.filter(pro=>(pro.serviceIds||[]).map(Number).includes(id));
    const providerCards=providers.map(pro=>{
    const choiceKey=`${id}:${Number(pro.id)}`;
      const availability=pro.availability||'unknown';
      const eventDateLabel=existing?.event_date?new Date(`${existing.event_date}T12:00:00`).toLocaleDateString('pt-BR'):'';
      const availabilityText=availability==='available'?`Disponível em ${eventDateLabel}`:availability==='unavailable'?`Indisponível em ${eventDateLabel}`:'Selecione a data para consultar';
      const reviews=pro.reviews.length?pro.reviews.slice(0,2).map(review=>`<small class="catalog-review">“${escapeHtml(review.comment||'Avaliação sem comentário')}” · ${Number(review.rating)}/5</small>`).join(''):'';
      return `<label class="catalog-professional-card ${availability==='unavailable'?'is-unavailable':''}" data-catalog-professional="${Number(pro.id)}" data-service-id="${id}"><input type="checkbox" name="professionalChoice" data-service-id="${id}" data-availability="${availability}" value="${Number(pro.id)}" ${oldChoiceKeys.has(choiceKey)&&availability==='available'?'checked':''} ${selected&&availability==='available'?'':'disabled'}><span class="catalog-professional-copy"><strong>${escapeHtml(pro.name)}</strong><small>${escapeHtml([pro.city,pro.state].filter(Boolean).join(' · ')||'Local não informado')} · ${pro.rating===null?'Sem avaliações':`★ ${Number(pro.rating).toLocaleString('pt-BR')} (${pro.reviewCount})`}</small><small class="catalog-availability ${availability}">${availabilityText}</small>${reviews}</span></label>`;
    }).join('');
    return `<article class="service-quantity-card ${selected?'selected':''}" data-service-card="${id}">
      <div class="service-quantity-main ${noQuantity?'no-quantity-control':''}">
        <label class="service-select-label" for="service-${id}">
          <input id="service-${id}" type="checkbox" name="serviceChoice" value="${id}" ${selected?'checked':''}>
          <span class="service-checkbox-ui" aria-hidden="true">✓</span>
          <span class="service-option-content"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(descriptions[name]||'Serviço complementar para seu evento')}</small></span>
        </label>
        ${noQuantity?'':`<div class="quantity-control">
          <label for="quantity-${id}">${isBuffet?'Convidados atendidos':'Quantidade desejada'}</label>
          <div class="quantity-stepper">
            <button type="button" data-quantity-change="-1" data-quantity-id="quantity-${id}" aria-label="Diminuir quantidade de ${escapeHtml(name)}" ${selected?'':'disabled'}>−</button>
            <input id="quantity-${id}" type="number" data-service-quantity="${id}" min="1" max="${isBuffet?100000:500}" value="${qty}" inputmode="numeric" ${selected?'':'disabled'} aria-label="Quantidade para ${escapeHtml(name)}">
            <button type="button" data-quantity-change="1" data-quantity-id="quantity-${id}" aria-label="Aumentar quantidade de ${escapeHtml(name)}" ${selected?'':'disabled'}>+</button>
          </div>
          <small>${isBuffet?'Número de convidados que deseja atender':'Profissionais ou unidades desejadas'}</small>
        </div>`}
      </div>
      ${specifications.length?`<div class="service-specification-block" ${selected?'':'hidden'}><div class="service-specification-heading"><strong>Especificações desejadas</strong><small>Marque as opções para este serviço.</small></div><div class="service-specification-grid">${specifications.map(option=>`<label class="service-specification-option"><input type="checkbox" name="serviceSpecification" data-service-id="${id}" data-option-group="${option.group||''}" value="${option.id}" ${oldOptions.has(option.id)?'checked':''} ${selected?'':'disabled'}><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></div>`:''}
      <div class="service-professional-list"><div class="service-professional-heading"><strong>Profissionais para este serviço <span>(opcional)</span></strong><small>${isBuffet?'Escolha até 1 fornecedor.':`Escolha até ${qty} profissional(is).`}</small></div>${providerCards||'<p class="catalog-empty">Não há profissionais ativos cadastrados para este serviço no momento.</p>'}</div>
    </article>`;
  }).join('');
  const paletteHtml=paletteOptions.map(([label,color])=>`<label class="palette-choice"><input type="checkbox" name="palette" value="${label}" ${Array.isArray(oldStyle.palette)&&oldStyle.palette.includes(label)?'checked':''}><span class="palette-swatch" style="--swatch:${color}" aria-hidden="true"></span><span>${label}</span></label>`).join('');
  const f=existing||{};
  c.innerHTML=`
    <div class="event-page event-wizard-page">
      <div class="hero event-page-hero"><div><span class="section-kicker">${existing?'Atualizar pedido':'Novo pedido'}</span><h1>${existing?'Editar solicitação':'Solicitar evento'}</h1><div class="muted">Planeje cada detalhe do seu evento em poucas etapas. Você poderá revisar tudo antes de enviar.</div></div><div class="event-wizard-side-note"><span class="event-progress-dot">✦</span><div><strong>${existing?'Edição de solicitação':'Planejamento personalizado'}</strong><small>${existing?'Permitido enquanto o evento não estiver aprovado':'Solicitação de orçamento sem compromisso'}</small></div></div></div>
      <section class="card event-form-card">
        <div class="event-wizard-progress" aria-label="Progresso da solicitação">
          <div class="wizard-progress-line"><span id="wizardProgressFill"></span></div>
          <div class="wizard-step-indicators">
            <div class="wizard-indicator active" data-wizard-indicator="0"><span>01</span><div><strong>Dados</strong><small>Evento</small></div></div>
            <div class="wizard-indicator" data-wizard-indicator="1"><span>02</span><div><strong>Serviços</strong><small>Quantidades</small></div></div>
            <div class="wizard-indicator" data-wizard-indicator="2"><span>03</span><div><strong>Estilo</strong><small>Preferências</small></div></div>
            <div class="wizard-indicator" data-wizard-indicator="3"><span>04</span><div><strong>Revisão</strong><small>Enviar pedido</small></div></div>
          </div>
        </div>
        <form class="form event-form event-wizard-form" id="eventForm" novalidate>
          <section class="wizard-step" data-wizard-panel="0">
            <div class="form-block-heading"><span class="form-step">01</span><div><h3>Informações do evento</h3><p>Começamos com os dados principais da sua celebração.</p></div></div>
            <div class="form-grid event-details-grid">
              <div class="field"><label for="eventType">Tipo de evento <span class="required-mark">*</span></label><select id="eventType" name="eventType" required><option value="" disabled ${f.event_type?'':'selected'}>Selecione o tipo de evento</option>${['Casamento','15 anos','Aniversário','Formatura','Corporativo','Confraternização','Outro'].map(x=>`<option ${f.event_type===x?'selected':''}>${x}</option>`).join('')}</select></div>
              <div class="field"><label for="eventDate">Data desejada <span class="required-mark">*</span></label><input id="eventDate" name="eventDate" type="date" min="${minDate}" value="${escapeHtml(f.event_date||'')}" required></div>
              <div class="field"><label for="startTime">Horário previsto</label><input id="startTime" name="startTime" type="time" value="${escapeHtml(f.start_time||'')}"><small class="field-hint">Pode ser um horário aproximado.</small></div>
              <div class="field"><label for="guestCount">Número de convidados <span class="required-mark">*</span></label><input id="guestCount" name="guestCount" type="number" min="1" max="100000" value="${escapeHtml(f.guest_count||'')}" inputmode="numeric" placeholder="Ex.: 120 convidados" required><small class="field-hint">Essa informação ajuda a dimensionar equipe e buffet.</small></div>
              <div class="field"><label for="city">Cidade do evento <span class="required-mark">*</span></label><input id="city" name="city" maxlength="100" value="${escapeHtml(f.city||'')}" placeholder="Cidade e estado" autocomplete="address-level2" required></div>
              <div class="field"><label for="address">Local ou endereço</label><input id="address" name="address" maxlength="180" value="${escapeHtml(f.address||'')}" placeholder="Salão, sítio, igreja ou endereço" autocomplete="street-address"><small class="field-hint">Se ainda não escolheu o espaço, pode deixar em branco.</small></div>
            </div>
            <div class="wizard-note"><span>i</span><p>Você poderá conferir e ajustar essas informações na última etapa, antes de enviar.</p></div>
          </section>
          <section class="wizard-step" data-wizard-panel="1" hidden>
            <div class="form-block-heading"><span class="form-step">02</span><div><h3>Serviços e quantidades</h3><p>Marque os serviços desejados e informe exatamente quantos profissionais ou unidades precisa.</p></div></div>
            <div class="service-selection-top"><span>O que seu evento precisa?</span><span class="service-counter"><strong id="selectedServiceCount">${oldQuantities.length}</strong> serviço(s) selecionado(s)</span></div>
            <div class="service-quantity-grid">${quantityCards||'<div class="service-empty">Nenhum serviço está disponível no momento.</div>'}</div>
            <div class="catalog-estimate" id="catalogEstimate"></div>
            <div class="wizard-note"><span>i</span><p>Os valores são definidos pela administração por serviço e, quando aplicável, por opção. Escolher profissionais não altera os preços. Para buffet, os valores são por convidado; os demais seguem a unidade indicada.</p></div>
          </section>
          <section class="wizard-step" data-wizard-panel="2" hidden>
            <div class="form-block-heading"><span class="form-step">03</span><div><h3>Estilo do evento</h3><p>Conte como você imagina o ambiente. Essas preferências ajudam a personalizar a proposta.</p></div></div>
            <div class="style-section"><div class="field"><label for="eventFormality">Formalidade</label><select id="eventFormality" name="eventFormality"><option value="">Ainda vou decidir</option>${['Formal','Semiformal','Descontraído','Temático'].map(x=>`<option ${oldStyle.formality===x?'selected':''}>${x}</option>`).join('')}</select></div>
              <div class="field"><label for="decorationStyle">Estilo de decoração</label><select id="decorationStyle" name="decorationStyle"><option value="">Ainda vou decidir</option>${['Clássico e elegante','Luxuoso','Rústico','Moderno','Minimalista','Romântico','Tropical','Temático','Outro'].map(x=>`<option ${oldStyle.decorationStyle===x?'selected':''}>${x}</option>`).join('')}</select></div>
              <div class="field palette-field"><label>Paleta de cores preferida</label><p class="field-hint">Você pode selecionar mais de uma opção.</p><div class="palette-grid">${paletteHtml}</div></div>
              <section class="decoration-preview" id="decorationPreview" aria-live="polite" aria-label="Prévia ilustrativa da decoração">
                <div class="decoration-preview-heading"><div><span class="pro-kicker">PRÉVIA DO AMBIENTE</span><h4 id="decorationPreviewTitle">Seu evento · estilo a definir</h4></div><span class="decoration-preview-tag">Ilustrativa</span></div>
                <div class="decoration-scene style-undecided" id="decorationScene" aria-hidden="true">
                  <span class="decoration-scene-light"></span><span class="decoration-scene-arch"></span><span class="decoration-scene-table"></span><span class="decoration-scene-flower flower-left"></span><span class="decoration-scene-flower flower-right"></span><span class="decoration-scene-candle candle-left"></span><span class="decoration-scene-candle candle-right"></span>
                </div>
                <div class="decoration-preview-footer"><span id="decorationPreviewStyle">Escolha um estilo para personalizar o cenário.</span><div class="decoration-preview-swatches" id="decorationPreviewSwatches"></div></div>
                <small class="decoration-preview-note">Prévia visual aproximada das cores e do estilo. A montagem real depende do espaço e dos itens definidos no orçamento.</small>
              </section>
              <div class="field"><label for="paletteNotes">Outras cores ou referências</label><input id="paletteNotes" name="paletteNotes" maxlength="300" value="${escapeHtml(oldStyle.paletteNotes||'')}" placeholder="Ex.: verde-oliva, dourado fosco e tons naturais"></div>
              <div class="field"><label for="eventNotes">Observações e pedidos especiais</label><textarea id="eventNotes" name="notes" rows="4" maxlength="2000" placeholder="Acessibilidade, horários especiais, necessidades específicas ou outras ideias…">${escapeHtml(f.notes||'')}</textarea><div class="textarea-footer"><small class="field-hint">Compartilhe somente o que considerar importante neste momento.</small><small><span id="notesCount">${String(f.notes||'').length}</span>/2000</small></div></div>
            </div>
          </section>
          <section class="wizard-step" data-wizard-panel="3" hidden>
            <div class="form-block-heading"><span class="form-step">04</span><div><h3>Revise sua solicitação</h3><p>Confira os dados, as quantidades e as preferências antes de enviar ao administrador.</p></div></div>
            <div id="eventReview" class="event-review"></div>
            <div class="review-confirmation"><span>✓</span><p>Ao enviar, sua solicitação ficará disponível para análise e preparação do orçamento. O envio não confirma a contratação.</p></div>
          </section>
          <div class="event-form-footer wizard-footer"><button class="btn ghost" type="button" id="wizardPrev" hidden>← Voltar</button><span class="wizard-step-caption" id="wizardStepCaption">Etapa 1 de 4</span><div class="page-actions event-form-actions"><button class="btn ghost" type="button" id="cancelEvent">Cancelar</button><button class="btn primary" type="button" id="wizardNext">Continuar <span aria-hidden="true">→</span></button><button class="btn primary submit-event-btn" type="submit" id="submitEvent" hidden><span>${existing?'Salvar alterações':'Enviar solicitação'}</span><span aria-hidden="true">✓</span></button></div></div>
        </form>
      </section>
    </div>`;
  const form=document.getElementById('eventForm');
  const selectedCount=document.getElementById('selectedServiceCount');
  const notesInput=document.getElementById('eventNotes');
  const notesCount=document.getElementById('notesCount');
  const panels=[...form.querySelectorAll('[data-wizard-panel]')];
  const indicators=[...c.querySelectorAll('[data-wizard-indicator]')];
  const prev=document.getElementById('wizardPrev'),next=document.getElementById('wizardNext'),submit=document.getElementById('submitEvent');
  let step=0;
  let availabilityDate=existing?.event_date||'';
  let availabilityRequest=0;
  const checkedServices=()=>[...form.querySelectorAll('[name="serviceChoice"]:checked')].map(box=>{const serviceId=Number(box.value),quantityInput=form.querySelector(`[data-service-quantity="${serviceId}"]`);return {serviceId,quantity:Number(quantityInput?.value)||1,name:services.find(s=>Number(s.id)===serviceId)?.name||'Serviço',options:[...form.querySelectorAll(`[name="serviceSpecification"][data-service-id="${serviceId}"]:checked`)].map(option=>option.value)}});
  const selectedPalette=()=>[...form.querySelectorAll('[name="palette"]:checked')].map(x=>x.value);
  const refreshServiceCard=card=>{const check=card.querySelector('[name="serviceChoice"]'),q=card.querySelector('[data-service-quantity]'),buttons=card.querySelectorAll('[data-quantity-change]'),specificationBlock=card.querySelector('.service-specification-block');card.classList.toggle('selected',check.checked);if(q)q.disabled=!check.checked;buttons.forEach(b=>b.disabled=!check.checked);card.querySelectorAll('[name="professionalChoice"]').forEach(choice=>choice.disabled=!check.checked||choice.dataset.availability!=='available');card.querySelectorAll('[name="serviceSpecification"]').forEach(option=>option.disabled=!check.checked);if(specificationBlock)specificationBlock.hidden=!check.checked};
  const updateServiceCount=()=>{selectedCount.textContent=String(form.querySelectorAll('[name="serviceChoice"]:checked').length)};
  const checkedProfessionals=()=>[...form.querySelectorAll('[name="professionalChoice"]:checked')].map(box=>({serviceId:Number(box.dataset.serviceId),professionalId:Number(box.value)}));
  function getPriceEstimate(){
    const picked=checkedServices(),lines=[],unpriced=[];
    let total=0;
    for(const service of picked){
      const buffet=service.name.toLocaleLowerCase('pt-BR')==='buffet';
      const quantity=buffet?service.quantity:QUANTITYLESS_SERVICES.has(service.name.toLocaleLowerCase('pt-BR'))?1:service.quantity;
      const selectedOptions=service.options.map(optionId=>servicePrices.find(price=>Number(price.serviceId)===service.serviceId&&price.optionId===optionId)).filter(Boolean);
      const menuOption=selectedOptions.find(price=>price.kind==='menu');
      const basePrice=servicePrices.find(price=>Number(price.serviceId)===service.serviceId&&!price.optionId)?.unitPrice??null;
      const addLine=(label,unitPrice,optionId=null)=>{
        const lineTotal=Math.round(Number(unitPrice)*quantity*100)/100;
        lines.push({serviceName:service.name,itemName:label,quantity,unitPrice:Number(unitPrice),total:lineTotal,optionId});
        total+=lineTotal;
      };
      if(buffet&&menuOption){
        if(menuOption.unitPrice!==null)addLine(menuOption.label,menuOption.unitPrice,menuOption.optionId);
        else if(basePrice!==null)addLine(`${service.name} · preço base`,basePrice);
        else unpriced.push({serviceName:menuOption.label});
      }else if(basePrice!==null)addLine(service.name,basePrice);
      else unpriced.push({serviceName:service.name});
      for(const option of selectedOptions){
        if(buffet&&option.kind==='menu')continue;
        if(option.unitPrice===null)unpriced.push({serviceName:`${service.name} · ${option.label}`});
        else addLine(`${service.name} · ${option.label}`,option.unitPrice,option.optionId);
      }
    }
    return {lines,total:Math.round(total*100)/100,unpriced};
  }
  function updateDecorationPreview(){
    const scene=document.getElementById('decorationScene');
    if(!scene)return;
    const palette=selectedPalette();
    const colorByName=new Map(paletteOptions);
    const chosenColors=palette.map(color=>colorByName.get(color)).filter(Boolean);
    const colors=[chosenColors[0]||'#c9a45c',chosenColors[1]||'#f3eee4',chosenColors[2]||'#55765b'];
    scene.style.setProperty('--preview-primary',colors[0]);
    scene.style.setProperty('--preview-secondary',colors[1]);
    scene.style.setProperty('--preview-accent',colors[2]);
    const style=form.elements.decorationStyle.value;
    scene.className=`decoration-scene style-${decorationStyleClasses.get(style)||'undecided'}`;
    const eventType=form.elements.eventType.value||'Seu evento';
    document.getElementById('decorationPreviewTitle').textContent=`${eventType} · ${style||'estilo a definir'}`;
    document.getElementById('decorationPreviewStyle').textContent=style?`Estilo ${style}${form.elements.eventFormality.value?` · ${form.elements.eventFormality.value}`:''}`:'Escolha um estilo para personalizar o cenário.';
    document.getElementById('decorationPreviewSwatches').innerHTML=palette.length
      ?palette.map(color=>`<span class="decoration-preview-swatch" style="--preview-swatch:${colorByName.get(color)}" title="${escapeHtml(color)}"></span>`).join('')
      :'<span class="decoration-preview-default">Paleta não definida</span>';
  }
  async function refreshAvailability(date){
    const requestId=++availabilityRequest;
    if(!date){
      availabilityDate='';
      c.querySelectorAll('.catalog-professional-card').forEach(card=>{
        const checkbox=card.querySelector('[name="professionalChoice"]'),status=card.querySelector('.catalog-availability');
        checkbox.dataset.availability='unknown';checkbox.disabled=true;card.classList.remove('is-unavailable');
        status.className='catalog-availability unknown';status.textContent='Selecione a data para consultar';
      });
      updateEstimate();
      return true;
    }
    const query=new URLSearchParams({date});
    if(existing?.id)query.set('excludeEvent',String(existing.id));
    try{
      const updatedCatalog=await api(`/professionals/catalog?${query}`);
      if(requestId!==availabilityRequest)return false;
      catalog=updatedCatalog;availabilityDate=date;
      const eventDateLabel=new Date(`${date}T12:00:00`).toLocaleDateString('pt-BR');
      c.querySelectorAll('.catalog-professional-card').forEach(card=>{
        const checkbox=card.querySelector('[name="professionalChoice"]'),status=card.querySelector('.catalog-availability');
        const professional=catalog.find(item=>Number(item.id)===Number(card.dataset.catalogProfessional));
        const availability=professional?.availability||'unknown';
        checkbox.dataset.availability=availability;
        if(availability==='unavailable')checkbox.checked=false;
        checkbox.disabled=!card.closest('[data-service-card]').querySelector('[name="serviceChoice"]').checked||availability!=='available';
        card.classList.toggle('is-unavailable',availability==='unavailable');
        status.className=`catalog-availability ${availability}`;
        status.textContent=availability==='available'?`Disponível em ${eventDateLabel}`:availability==='unavailable'?`Indisponível em ${eventDateLabel}`:'Não foi possível consultar';
      });
      updateEstimate();
      return true;
    }catch(error){
      if(requestId===availabilityRequest)toast(error.message||'Não foi possível consultar a disponibilidade dos profissionais.',true);
      return false;
    }
  }
  function updateEstimate(){
    const picked=checkedServices(),selected=checkedProfessionals(),estimate=getPriceEstimate();
    const selectionCounts=picked.map(item=>{
      const count=selected.filter(choice=>choice.serviceId===item.serviceId).length;
      const noQuantity=QUANTITYLESS_SERVICES.has(item.name.toLocaleLowerCase('pt-BR'));
      return `${escapeHtml(item.name)}: ${count}/${item.name.toLowerCase()==='buffet'||noQuantity?1:item.quantity} profissional(is) selecionado(s)`;
    });
    const selectedSpecifications=picked.flatMap(item=>item.options.map(optionId=>`${item.name}: ${EVENT_SPECIFICATION_LABELS.get(optionId)||optionId}`));
    document.getElementById('catalogEstimate').innerHTML=`<div><span>Estimativa em tempo real · preços definidos pela administração</span><strong>${fmtMoney(estimate.total)}</strong></div><small>${selectionCounts.join(' · ')||'Selecione serviços para ver uma estimativa em tempo real.'}</small>${estimate.lines.map(line=>`<small>${escapeHtml(line.itemName)} · ${line.quantity.toLocaleString('pt-BR')} × ${fmtMoney(line.unitPrice)} = ${fmtMoney(line.total)}</small>`).join('')}${estimate.unpriced.map(item=>`<small>A administração ainda não definiu o preço de ${escapeHtml(item.serviceName)}; a equipe poderá preparar uma proposta.</small>`).join('')}${selectedSpecifications.length?`<small>Especificações no pedido: ${selectedSpecifications.map(escapeHtml).join(' · ')}</small>`:''}<small>Escolher profissionais não altera os valores. A estimativa não é uma proposta final e será revisada pela equipe.</small>`;
  }
  form.querySelectorAll('[name="decorationStyle"],[name="eventFormality"],[name="eventType"],[name="palette"]').forEach(input=>input.addEventListener('change',updateDecorationPreview));
  form.querySelectorAll('[name="serviceChoice"]').forEach(box=>box.addEventListener('change',()=>{const card=box.closest('[data-service-card]');if(!box.checked){card.querySelectorAll('[name="professionalChoice"],[name="serviceSpecification"]').forEach(choice=>{choice.checked=false})}refreshServiceCard(card);updateServiceCount();updateEstimate()}));
  form.elements.eventDate.addEventListener('change',()=>refreshAvailability(form.elements.eventDate.value));
  form.querySelectorAll('[name="serviceSpecification"]').forEach(box=>box.addEventListener('change',()=>{if(box.checked&&box.dataset.optionGroup){box.closest('[data-service-card]').querySelectorAll(`[name="serviceSpecification"][data-option-group="${box.dataset.optionGroup}"]`).forEach(option=>{if(option!==box)option.checked=false})}updateEstimate()}));
  form.querySelectorAll('[name="professionalChoice"]').forEach(box=>box.addEventListener('change',()=>{
    const serviceId=Number(box.dataset.serviceId);
    const service=services.find(item=>Number(item.id)===serviceId);
    const input=form.querySelector(`[data-service-quantity="${serviceId}"]`);
    const serviceName=String(service?.name||'').toLocaleLowerCase('pt-BR');
    const limit=serviceName==='buffet'||QUANTITYLESS_SERVICES.has(serviceName)?1:Number(input?.value||0);
    const selected=[...form.querySelectorAll(`[name="professionalChoice"][data-service-id="${serviceId}"]:checked`)];
    if(selected.length>limit){box.checked=false;toast(`Escolha no máximo ${limit} profissional(is) para ${service?.name||'este serviço'}.`,true)}
    updateEstimate();
  }));
  form.querySelectorAll('[data-quantity-change]').forEach(button=>button.addEventListener('click',()=>{const input=document.getElementById(button.dataset.quantityId);if(!input||input.disabled)return;const value=Number(input.value||1),min=Number(input.min||1),max=Number(input.max||500);input.value=String(Math.max(min,Math.min(max,value+Number(button.dataset.quantityChange))));input.dispatchEvent(new Event('input',{bubbles:true}))}));
  form.querySelectorAll('[data-service-quantity]').forEach(input=>{if(oldQuantityById.has(Number(input.dataset.serviceQuantity)))input.dataset.touched='true';input.addEventListener('input',()=>{input.dataset.touched='true';updateEstimate()});input.addEventListener('change',()=>{const min=Number(input.min||1),max=Number(input.max||500),v=Number(input.value);input.value=String(!Number.isInteger(v)?min:Math.max(min,Math.min(max,v)));updateEstimate()})});
  form.querySelectorAll('[data-service-card]').forEach(refreshServiceCard);
  if(notesInput)notesInput.addEventListener('input',()=>{notesCount.textContent=String(notesInput.value.length)});
  updateEstimate();
  updateDecorationPreview();
  form.elements.guestCount.addEventListener('input',()=>{const buffet=services.find(s=>String(s.name).toLowerCase()==='buffet');if(!buffet)return;const quantityInput=form.querySelector(`[data-service-quantity="${buffet.id}"]`);if(quantityInput&&!quantityInput.dataset.touched){const guestNumber=Number(form.elements.guestCount.value);if(guestNumber>0)quantityInput.value=String(Math.min(100000,guestNumber));updateEstimate()}});
  const stepValid=()=>{
    if(step===0){const required=['eventType','eventDate','guestCount','city'];for(const name of required){const field=form.elements[name];if(!field.checkValidity()){field.reportValidity();field.focus();return false}}if(form.elements.eventDate.value<minDate){form.elements.eventDate.setCustomValidity('Escolha uma data a partir de hoje.');form.elements.eventDate.reportValidity();form.elements.eventDate.focus();form.elements.eventDate.setCustomValidity('');return false}return true}
    if(step===1){const picked=checkedServices();if(!picked.length){toast('Selecione pelo menos um serviço.',true);return false}for(const item of picked){const input=form.querySelector(`[data-service-quantity="${item.serviceId}"]`);if(input&&(!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>Number(input.max))){toast(`Confira a quantidade de ${item.name}.`,true);input.focus();return false}const count=checkedProfessionals().filter(choice=>choice.serviceId===item.serviceId).length;const noQuantity=QUANTITYLESS_SERVICES.has(item.name.toLocaleLowerCase('pt-BR'));const limit=item.name.toLowerCase()==='buffet'||noQuantity?1:item.quantity;if(count>limit){toast(`Selecione no máximo ${limit} profissional(is) para ${item.name}.`,true);return false}}return true}
    return true;
  };
  function updateReview(){
    const data=form.elements;
    const picked=checkedServices();
    const palette=selectedPalette();
    const pills=palette.length?palette.map(x=>`<span class="review-pill">${escapeHtml(x)}</span>`).join(''):'<span class="review-muted">Não definida</span>';
    const styleParts=[['Formalidade',data.eventFormality.value||'Não definida'],['Decoração',data.decorationStyle.value||'Não definida']];
    const details=picked.map(item=>{const noQuantity=QUANTITYLESS_SERVICES.has(item.name.toLocaleLowerCase('pt-BR'));const specifications=item.options.map(optionId=>EVENT_SPECIFICATION_LABELS.get(optionId)).filter(Boolean);return `<div class="review-service-row"><span><strong>${escapeHtml(item.name)}</strong>${noQuantity?'':`<small>${item.name.toLowerCase()==='buffet'?'Convidados atendidos':'Profissionais / unidades desejadas'}</small>`}${specifications.length?`<small>Especificações: ${specifications.map(escapeHtml).join(', ')}</small>`:''}</span>${noQuantity?'':`<strong>${item.quantity.toLocaleString('pt-BR')}</strong>`}</div>`}).join('');
    const priceEstimate=getPriceEstimate();
    const estimateLines=priceEstimate.lines.map(line=>`<div class="review-service-row"><span><strong>${escapeHtml(line.itemName)}</strong><small>${line.quantity.toLocaleString('pt-BR')} × ${fmtMoney(line.unitPrice)}</small></span><strong>${fmtMoney(line.total)}</strong></div>`).join('');
    const estimate=priceEstimate.lines.length||priceEstimate.unpriced.length?`${estimateLines}${priceEstimate.unpriced.map(item=>`<p class="review-muted">A administração ainda não definiu o preço de ${escapeHtml(item.serviceName)}; a equipe poderá preparar uma proposta.</p>`).join('')}<div class="review-service-row review-estimate-total"><span><strong>Estimativa dos serviços</strong><small>Os preços são definidos pela administração. O orçamento oficial será revisado pela equipe.</small></span><strong>${fmtMoney(priceEstimate.total)}</strong></div>`:'<p class="review-muted">Nenhum serviço foi selecionado.</p>';
    document.getElementById('eventReview').innerHTML=`<div class="review-section"><div class="review-section-heading"><h4>Dados do evento</h4><button type="button" class="review-edit-link" data-review-go="0">Editar</button></div><div class="review-data-grid"><div><small>Tipo</small><strong>${escapeHtml(data.eventType.value)}</strong></div><div><small>Data</small><strong>${escapeHtml(fmtDate(data.eventDate.value))}</strong></div><div><small>Horário</small><strong>${escapeHtml(data.startTime.value||'Não definido')}</strong></div><div><small>Convidados</small><strong>${escapeHtml(data.guestCount.value)}</strong></div><div><small>Cidade</small><strong>${escapeHtml(data.city.value)}</strong></div><div><small>Local</small><strong>${escapeHtml(data.address.value||'A definir')}</strong></div></div></div><div class="review-section"><div class="review-section-heading"><h4>Serviços e quantidades</h4><button type="button" class="review-edit-link" data-review-go="1">Editar</button></div><div class="review-services-list">${details||'<p>Nenhum serviço selecionado.</p>'}${estimate}</div></div><div class="review-section"><div class="review-section-heading"><h4>Estilo e observações</h4><button type="button" class="review-edit-link" data-review-go="2">Editar</button></div><div class="review-style-list">${styleParts.map(([label,value])=>`<div><small>${label}</small><strong>${escapeHtml(value)}</strong></div>`).join('')}<div><small>Paleta de cores</small><div class="review-pills">${pills}</div></div><div><small>Outras cores / referências</small><strong>${escapeHtml(data.paletteNotes.value||'Nenhuma')}</strong></div><div><small>Observações</small><p>${escapeHtml(data.notes.value||'Nenhuma observação informada.')}</p></div></div></div>`;
    document.querySelectorAll('[data-review-go]').forEach(button=>button.onclick=()=>setStep(Number(button.dataset.reviewGo)));
  }
  function setStep(nextStep){step=Math.max(0,Math.min(3,nextStep));panels.forEach((panel,i)=>{panel.hidden=i!==step});indicators.forEach((item,i)=>{item.classList.toggle('active',i===step);item.classList.toggle('completed',i<step);item.setAttribute('aria-current',i===step?'step':'false')});document.getElementById('wizardProgressFill').style.width=`${step/3*100}%`;document.getElementById('wizardStepCaption').textContent=`Etapa ${step+1} de 4`;prev.hidden=step===0;next.hidden=step===3;submit.hidden=step!==3;if(step===3)updateReview();c.querySelector('.event-wizard-progress').scrollIntoView({behavior:'smooth',block:'nearest'});}
  next.onclick=async()=>{if(step===0&&form.elements.eventDate.value!==availabilityDate&&!await refreshAvailability(form.elements.eventDate.value))return;if(stepValid())setStep(step+1)};
  prev.onclick=()=>setStep(step-1);
  document.getElementById('cancelEvent').onclick=()=>clientView('events');
  setStep(0);
  form.onsubmit=async e=>{
    e.preventDefault();
    if(step!==3)return;
    if(!stepValid())return;
    const picked=checkedServices();
    if(!picked.length){setStep(1);toast('Selecione ao menos um serviço.',true);return}
    const data=form.elements;
    const payload={eventType:data.eventType.value,eventDate:data.eventDate.value,startTime:data.startTime.value||null,guestCount:Number(data.guestCount.value),city:data.city.value.trim(),address:data.address.value.trim(),notes:data.notes.value.trim(),serviceQuantities:picked.map(x=>({serviceId:x.serviceId,quantity:x.quantity,options:x.options})),selectedProfessionals:checkedProfessionals(),eventStyle:{formality:data.eventFormality.value,decorationStyle:data.decorationStyle.value,palette:selectedPalette(),paletteNotes:data.paletteNotes.value.trim()}};
    submit.disabled=true;submit.innerHTML='<span>Salvando solicitação...</span><span aria-hidden="true">…</span>';
    try{
      if(existing)await api(`/events/${existing.id}`,{method:'PATCH',body:payload});else await api('/events',{method:'POST',body:payload});
      toast(existing?'Solicitação atualizada.':'Evento solicitado com sucesso!');
      await clientView('events');
    }catch(err){toast(err.message,true);submit.disabled=false;submit.innerHTML=`<span>${existing?'Salvar alterações':'Enviar solicitação'}</span><span aria-hidden="true">✓</span>`}
  };
}

function eventDetailsMarkup(event){
  const serviceNames={1:'Cerimonial',2:'Recepcionista',3:'Garçom',4:'Segurança',5:'Fotografia',6:'Filmagem',7:'Decoração',8:'Som',9:'Iluminação',10:'Buffet'};
  const quantities=Array.isArray(event.service_quantities)&&event.service_quantities.length?event.service_quantities:(Array.isArray(event.service_ids)?event.service_ids.map(id=>({service_id:id,service_name:serviceNames[id],quantity:null})):[]);
  const style=event.event_style||{};
  const servicesHtml=quantities.length?quantities.map(item=>{const name=item.service_name||serviceNames[item.service_id]||'Serviço';const noQuantity=QUANTITYLESS_SERVICES.has(name.toLocaleLowerCase('pt-BR'));const specifications=(Array.isArray(item.options)?item.options:[]).map(optionId=>EVENT_SPECIFICATION_LABELS.get(optionId)).filter(Boolean);return `<div class="event-detail-service"><span><strong>${escapeHtml(name)}</strong>${specifications.length?`<small>Especificações: ${specifications.map(escapeHtml).join(', ')}</small>`:''}</span>${noQuantity?'':`<strong>${item.quantity?escapeHtml(item.quantity):'Quantidade não registrada'}${name.toLowerCase()==='buffet'&&item.quantity?' convidados':''}</strong>`}</div>`}).join(''):'<p class="muted">Nenhum serviço foi registrado.</p>';
  const requested=Array.isArray(event.requested_professionals)?event.requested_professionals:[];
  const estimateItems=Array.isArray(event.estimate_items)?event.estimate_items:[];
  const estimateHtml=estimateItems.map(item=>`<div class="event-detail-service"><span><strong>${escapeHtml(item.description)}</strong></span><strong>${Number(item.quantity).toLocaleString('pt-BR')} × ${fmtMoney(item.unit_price)}<small>${fmtMoney(item.total)}</small></strong></div>`).join('');
  const requestedHtml=requested.map(item=>`<div class="event-detail-service"><span><strong>${escapeHtml(item.professional_name)}</strong><small>${escapeHtml(item.service_name)} · selecionado pelo cliente</small></span></div>`).join('');
  const missingItems=Array.isArray(event.unpriced_items)?event.unpriced_items:[];
  const estimateSection=`<section><h4>Estimativa por serviço</h4><div class="event-detail-services">${estimateHtml||'<p class="muted">Não havia preços cadastrados para os serviços quando o pedido foi enviado.</p>'}${missingItems.map(item=>`<p class="muted">Preço não definido: ${escapeHtml(item.description)}</p>`).join('')}${estimateItems.length?`<div class="event-detail-service event-estimate-total"><strong>Estimativa dos serviços</strong><strong>${fmtMoney(event.estimated_total)}</strong></div>`:''}</div><small class="muted">A escolha de profissionais não altera os preços. A equipe revisará o orçamento final.</small>${requestedHtml?`<h4>Profissionais de preferência</h4><div class="event-detail-services">${requestedHtml}</div>`:''}</section>`;
  const palette=Array.isArray(style.palette)&&style.palette.length?style.palette.map(color=>`<span class="review-pill">${escapeHtml(color)}</span>`).join(''):'<span class="review-muted">Não definida</span>';
  return `<div class="event-detail-grid"><section><h4>Serviços e quantidades</h4><div class="event-detail-services">${servicesHtml}</div></section>${estimateSection}<section><h4>Estilo do evento</h4><div class="event-detail-fields"><div><small>Formalidade</small><strong>${escapeHtml(style.formality||'Não informada')}</strong></div><div><small>Decoração</small><strong>${escapeHtml(style.decorationStyle||'Não informada')}</strong></div><div><small>Paleta de cores</small><div class="review-pills">${palette}</div></div><div><small>Referências</small><p>${escapeHtml(style.paletteNotes||'Nenhuma')}</p></div></div></section><section class="event-detail-wide"><h4>Local e observações</h4><div class="event-detail-fields"><div><small>Local</small><strong>${escapeHtml(event.address||'A definir')}</strong></div><div><small>Horário</small><strong>${escapeHtml(event.start_time||'Não informado')}</strong></div><div class="event-detail-wide"><small>Observações</small><p>${escapeHtml(event.notes||'Nenhuma observação informada.')}</p></div></div></section></div>`;
}
async function clientEvents(c){
  let events;
  try{events=await api('/events/mine')}catch(e){c.innerHTML=`<section class="pro-panel pro-error"><div class="pro-error-icon">!</div><h2>Não foi possível carregar seus eventos</h2><p>${escapeHtml(e.message)}</p><button class="btn secondary" onclick="clientView('events')">Tentar novamente</button></section>`;return}
  const eventBadge=document.querySelector('[data-client-events-count]');if(eventBadge)eventBadge.textContent=String(events.filter(e=>['solicitado','em_analise','orcamento_enviado','aguardando_cliente','aguardando_pagamento'].includes(e.status)).length);
  const editableStatuses=['solicitado','em_analise','orcamento_enviado','aguardando_cliente'];
  const active=events.filter(e=>!['cancelado','finalizado'].includes(e.status)).length;
  const waiting=events.filter(e=>['solicitado','em_analise','orcamento_enviado','aguardando_cliente','aguardando_pagamento'].includes(e.status)).length;
  c.innerHTML=`<div class="pro-page client-page"><div class="pro-page-heading"><div><span class="pro-kicker">SEU PLANEJAMENTO</span><h1>Meus eventos</h1><p>Acompanhe cada solicitação, confira serviços e quantidades, edite informações permitidas e consulte os orçamentos.</p></div><button class="btn primary" id="newEventFromList">＋ Solicitar evento</button></div><div class="pro-stats-grid client-list-stats">${proMetric('◇','Total de eventos',events.length,'Todas as solicitações','gold')}${proMetric('◷','Em andamento',active,'Não encerrados','blue')}${proMetric('…','Aguardando análise',waiting,'Pedidos em aberto','purple')}${proMetric('✓','Finalizados',events.filter(e=>e.status==='finalizado').length,'Eventos concluídos','green')}</div><section class="pro-panel client-events-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">HISTÓRICO E STATUS</span><h2>Suas solicitações</h2></div><label class="pro-filter-label">Filtrar por status <select id="clientEventFilter"><option value="all">Todos os status</option><option value="open">Em aberto</option><option value="orcamento_enviado">Orçamento enviado</option><option value="aprovado">Aprovados</option><option value="finalizado">Finalizados</option><option value="cancelado">Cancelados</option></select></label></div><div class="client-event-list" id="clientEventList">${events.map(ev=>{
    const canEdit=editableStatuses.includes(ev.status);const canCancel=canEdit;const d=ev.event_date?new Date(`${ev.event_date}T12:00:00`):null;
    const reviews=Array.isArray(ev.my_reviews)?ev.my_reviews:[];
    const reviewPanel=ev.status==='finalizado'&&Array.isArray(ev.staff)&&ev.staff.length?`<section class="client-event-reviews"><h4>Como foi trabalhar com a equipe?</h4>${ev.staff.map(member=>{const previous=reviews.find(review=>review.professional_id===member.professional_id);return previous?`<div class="client-review-done"><strong>${escapeHtml(member.professional_name)} · ${escapeHtml(member.service_name)}</strong><span>Sua nota: ${Number(previous.rating)}/5${previous.comment?` — ${escapeHtml(previous.comment)}`:''}</span></div>`:`<form class="client-review-form" data-review-event="${Number(ev.id)}" data-review-professional="${Number(member.professional_id)}"><strong>${escapeHtml(member.professional_name)} · ${escapeHtml(member.service_name)}</strong><label>Nota <select name="rating" required><option value="">Selecione</option><option value="5">5 — Excelente</option><option value="4">4 — Muito bom</option><option value="3">3 — Bom</option><option value="2">2 — Regular</option><option value="1">1 — Precisa melhorar</option></select></label><label>Comentário (opcional) <textarea name="comment" rows="2" maxlength="1000" placeholder="Compartilhe sua experiência"></textarea></label><button class="btn secondary" type="submit">Enviar avaliação</button></form>`}).join('')}</section>`:'';
    return `<article class="client-event-card client-event-card-premium" data-client-event="${ev.id}" data-client-status="${escapeHtml(ev.status)}"><div class="client-event-main-row"><div class="client-date-tile"><strong>${d?escapeHtml(String(d.getDate()).padStart(2,'0')):'—'}</strong><span>${d?escapeHtml(d.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')):'data'}</span></div><div class="client-event-summary"><span class="event-id-label">SOLICITAÇÃO #${ev.id}</span><h3>${escapeHtml(ev.event_type)}</h3><p>${escapeHtml(fmtDate(ev.event_date))}${ev.start_time?' · '+escapeHtml(ev.start_time):''} · ${escapeHtml(ev.city)} · ${Number(ev.guest_count||0).toLocaleString('pt-BR')} convidados</p><div class="client-event-tags"><span>⌖ ${escapeHtml(ev.address||'Local a definir')}</span><span>✦ ${Array.isArray(ev.service_quantities)?ev.service_quantities.length:(ev.service_ids||[]).length} serviços</span></div></div><div class="client-event-status">${badge(ev.status)}</div></div><div class="client-event-details" hidden>${eventDetailsMarkup(ev)}</div>${reviewPanel}<div class="client-event-actions"><button class="btn ghost" type="button" data-event-details-toggle>Ver detalhes</button>${canEdit?'<button class="btn secondary" type="button" data-edit-event>Editar solicitação</button>':''}<button class="btn primary" type="button" data-view-quote>Orçamentos</button>${canCancel?'<button class="btn danger-outline" type="button" data-cancel-event>Cancelar evento</button>':''}</div></article>`;
  }).join('')||'<div class="client-empty-state"><div class="client-empty-icon">✦</div><h3>Seu próximo evento começa aqui</h3><p>Crie sua primeira solicitação e compartilhe com a equipe da Imperio Cerimonial o que está planejando.</p><button class="btn primary" id="firstEventBtn">Solicitar meu primeiro evento</button></div>'}</div></section></div>`;
  document.getElementById('newEventFromList').onclick=()=>clientNewEvent(c);
  document.getElementById('firstEventBtn')?.addEventListener('click',()=>clientNewEvent(c));
  const filter=document.getElementById('clientEventFilter');if(filter)filter.onchange=()=>c.querySelectorAll('[data-client-event]').forEach(card=>{const s=card.dataset.clientStatus;card.hidden=filter.value==='all'?false:filter.value==='open'?['solicitado','em_analise','orcamento_enviado','aguardando_cliente','aguardando_pagamento'].includes(s):s===filter.value});
  c.querySelectorAll('[data-review-event]').forEach(form=>form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;try{await api(`/events/${form.dataset.reviewEvent}/reviews`,{method:'POST',body:{professionalId:Number(form.dataset.reviewProfessional),rating:Number(form.elements.rating.value),comment:form.elements.comment.value.trim()}});toast('Avaliação enviada. Obrigado pelo feedback!');await clientEvents(c)}catch(error){toast(error.message,true);button.disabled=false}});
  c.querySelectorAll('[data-event-details-toggle]').forEach(button=>button.onclick=event=>{const card=button.closest('[data-client-event]');const detail=card.querySelector('.client-event-details');detail.hidden=!detail.hidden;button.textContent=detail.hidden?'Ver detalhes':'Ocultar detalhes'});
  c.querySelectorAll('[data-edit-event]').forEach(button=>button.onclick=()=>{const ev=events.find(e=>String(e.id)===button.closest('[data-client-event]').dataset.clientEvent);if(ev)clientNewEvent(c,ev)});
  c.querySelectorAll('[data-view-quote]').forEach(button=>button.onclick=async()=>{const card=button.closest('[data-client-event]');const ev=events.find(e=>String(e.id)===card.dataset.clientEvent);if(ev)await showEventQuotes(ev)});
  c.querySelectorAll('[data-cancel-event]').forEach(button=>button.onclick=async()=>{const card=button.closest('[data-client-event]');const ev=events.find(e=>String(e.id)===card.dataset.clientEvent);if(!ev||!confirm(`Deseja cancelar a solicitação #${ev.id} (${ev.event_type})? Esta ação não poderá ser desfeita.`))return;button.disabled=true;try{await api(`/events/${ev.id}/cancel`,{method:'PATCH',body:{}});toast('Evento cancelado.');await clientEvents(c)}catch(e){toast(e.message,true);button.disabled=false}});
}
async function getClientQuotes(){const events=await api('/events/mine');const groups=await Promise.all(events.map(e=>api(`/quotes/event/${e.id}`).catch(()=>[])));const quotes=groups.flat().map(q=>({...q,event:events.find(e=>e.id===q.event_id)})).sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));const count=document.querySelector('[data-client-quotes-count]');if(count)count.textContent=String(quotes.filter(q=>q.status==='enviado').length);return quotes}
async function clientQuotes(c){
  let quotes;try{quotes=await getClientQuotes()}catch(e){c.innerHTML=`<section class="pro-panel pro-error"><div class="pro-error-icon">!</div><h2>Não foi possível carregar os orçamentos</h2><p>${escapeHtml(e.message)}</p><button class="btn secondary" onclick="clientView('quotes')">Tentar novamente</button></section>`;return}
  const pending=quotes.filter(q=>q.status==='enviado').length;
  const waitingChanges=quotes.filter(q=>q.status==='alteracao_solicitada').length;
  c.innerHTML=`<div class="pro-page client-page"><div class="pro-page-heading"><div><span class="pro-kicker">PROPOSTAS COMERCIAIS</span><h1>Meus orçamentos</h1><p>Revise os itens e valores enviados pela equipe e responda quando estiver pronto.</p></div><span class="pro-count-pill">${pending} aguardando decisão</span></div><div class="pro-job-summary client-quote-stats">${proMetric('R$','Para analisar',pending,'Propostas aguardando sua resposta','gold')}${proMetric('↻','Alterações solicitadas',waitingChanges,'Aguardando retorno da equipe','purple')}${proMetric('✓','Aceitos',quotes.filter(q=>q.status==='aceito').length,'Propostas aprovadas','green')}</div><div class="client-quotes-list">${quotes.map(q=>{const ev=q.event||{};const items=Array.isArray(q.items)?q.items:[];return `<article class="pro-panel client-quote-card" data-client-quote="${q.id}"><div class="client-quote-head"><div><span class="event-id-label">ORÇAMENTO #${q.id} · EVENTO #${q.event_id}</span><h2>${escapeHtml(ev.event_type||'Evento')}</h2><p>${escapeHtml(fmtDate(ev.event_date))} · ${escapeHtml(ev.city||'Cidade não informada')} · ${Number(ev.guest_count||0).toLocaleString('pt-BR')} convidados</p></div>${badge(q.status)}</div><div class="client-quote-lines">${items.map(item=>`<div class="client-quote-line"><span><strong>${escapeHtml(item.description||'Serviço')}</strong><small>${Number(item.quantity||1).toLocaleString('pt-BR')} × ${fmtMoney(item.unitPrice)}</small></span><strong>${fmtMoney(item.total??Number(item.quantity||1)*Number(item.unitPrice||0))}</strong></div>`).join('')}<div class="client-quote-total"><span>Desconto</span><strong>− ${fmtMoney(q.discount)}</strong></div><div class="client-quote-total grand"><span>Valor total</span><strong>${fmtMoney(q.total)}</strong></div></div>${q.status==='enviado'?`<div class="client-quote-actions"><button type="button" class="btn primary" data-quote-decision="aceito" data-quote-id="${q.id}">Aceitar e pagar</button><button type="button" class="btn secondary" data-quote-decision="alteracao_solicitada" data-quote-id="${q.id}">Solicitar alteração</button><button type="button" class="btn ghost" data-quote-decision="recusado" data-quote-id="${q.id}">Recusar proposta</button></div>`:q.status==='aguardando_pagamento'?`<div class="client-quote-actions"><button type="button" class="btn primary" data-quote-pay="${q.id}">Continuar pagamento</button></div>`:q.client_note?`<div class="client-quote-note"><strong>Observação enviada</strong><p>${escapeHtml(q.client_note)}</p></div>`:''}</article>`}).join('')||'<section class="pro-panel client-empty-state"><div class="client-empty-icon">R$</div><h3>Nenhum orçamento por enquanto</h3><p>Quando o administrador preparar uma proposta para um dos seus eventos, ela aparecerá nesta área com os itens, valores e opções de resposta.</p><button class="btn secondary" data-client-go="events">Ver meus eventos</button></section>'}</div></div>`;
  c.querySelectorAll('[data-client-go]').forEach(b=>b.onclick=()=>clientView(b.dataset.clientGo));
  c.querySelectorAll('[data-quote-decision]').forEach(b=>b.onclick=()=>processClientQuoteDecision(Number(b.dataset.quoteId),b.dataset.quoteDecision,()=>clientQuotes(c)));
  c.querySelectorAll('[data-quote-pay]').forEach(b=>b.onclick=()=>startClientQuotePayment(Number(b.dataset.quotePay),b));
}
async function startClientQuotePayment(quoteId,button){
  if(button){button.disabled=true;button.textContent='Abrindo checkout...'}
  try{
    const result=await api(`/quotes/${quoteId}/payment`,{method:'POST',body:{}});
    location.assign(result.checkoutUrl);
  }catch(error){toast(error.message,true);if(button){button.disabled=false;button.textContent='Tentar pagamento novamente'}}
}
async function processClientQuoteDecision(quoteId,decision,refresh){
  let note='';
  if(decision==='aceito'){if(!confirm('Deseja aceitar este orçamento e prosseguir para o checkout seguro da InfinitePay?'))return;return startClientQuotePayment(quoteId)}
  if(decision==='recusado'&&!confirm('Deseja recusar este orçamento? A solicitação será cancelada.'))return;
  if(decision==='alteracao_solicitada'){note=prompt('Conte o que você gostaria de alterar no orçamento:','');if(note===null)return;note=note.trim();if(!note)return toast('Escreva o que deseja alterar antes de enviar.',true)}
  try{await api(`/quotes/${quoteId}/decision`,{method:'PATCH',body:{decision,note}});toast(decision==='aceito'?'Orçamento aceito.':decision==='recusado'?'Orçamento recusado.':'Solicitação de alteração enviada.');await refresh()}catch(e){toast(e.message,true)}
}
async function showEventQuotes(ev){
  let quotes;try{quotes=await api(`/quotes/event/${ev.id}`)}catch(e){toast(e.message,true);return}
  if(!quotes.length){toast('Ainda não há orçamento para este evento.');return}
  const q=quotes[quotes.length-1];
  document.querySelector('.client-modal-overlay')?.remove();
  const items=Array.isArray(q.items)?q.items:[];
  const overlay=document.createElement('div');overlay.className='client-modal-overlay';
  overlay.innerHTML=`<section class="client-quote-modal" role="dialog" aria-modal="true" aria-labelledby="clientQuoteTitle"><button class="client-modal-close" type="button" aria-label="Fechar">×</button><span class="pro-kicker">PROPOSTA COMERCIAL</span><h2 id="clientQuoteTitle">Orçamento · ${escapeHtml(ev.event_type)}</h2><p class="client-modal-caption">Evento #${ev.id} · ${escapeHtml(fmtDate(ev.event_date))} · ${escapeHtml(ev.city)}</p><div class="client-quote-lines">${items.map(item=>`<div class="client-quote-line"><span><strong>${escapeHtml(item.description||'Serviço')}</strong><small>${Number(item.quantity||1).toLocaleString('pt-BR')} × ${fmtMoney(item.unitPrice)}</small></span><strong>${fmtMoney(item.total??Number(item.quantity||1)*Number(item.unitPrice||0))}</strong></div>`).join('')}<div class="client-quote-total"><span>Desconto</span><strong>− ${fmtMoney(q.discount)}</strong></div><div class="client-quote-total grand"><span>Total</span><strong>${fmtMoney(q.total)}</strong></div></div><div class="client-modal-status">Status: ${badge(q.status)}</div>${q.status==='enviado'?'<div class="client-quote-actions"><button type="button" class="btn primary" data-modal-decision="aceito">Aceitar e pagar</button><button type="button" class="btn secondary" data-modal-decision="alteracao_solicitada">Solicitar alteração</button><button type="button" class="btn ghost" data-modal-decision="recusado">Recusar</button></div>':q.status==='aguardando_pagamento'?'<div class="client-quote-actions"><button type="button" class="btn primary" data-modal-pay>Continuar pagamento</button></div>':''}</section>`;
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();overlay.querySelector('.client-modal-close').onclick=close;overlay.onclick=e=>{if(e.target===overlay)close()};document.addEventListener('keydown',function esc(e){if(e.key==='Escape'&&document.body.contains(overlay)){close();document.removeEventListener('keydown',esc)}});
  overlay.querySelectorAll('[data-modal-decision]').forEach(b=>b.onclick=async()=>{await processClientQuoteDecision(q.id,b.dataset.modalDecision,async()=>{close();await clientView('events')})});
  const payButton=overlay.querySelector('[data-modal-pay]');
  payButton?.addEventListener('click',()=>startClientQuotePayment(q.id,payButton));
}
async function proView(v){
  document.querySelectorAll('[data-prof-view]').forEach(b=>b.classList.toggle('active',b.dataset.profView===v));
  const c=document.getElementById('content');
  c.innerHTML='<div class="pro-loading"><span class="loading-dot"></span><span>Preparando sua área profissional...</span></div>';
  try{
    if(v==='availability')return await proAvailability(c);
    if(v==='jobs')return await proJobs(c);
    if(v==='invitations')return await proInvitations(c);
    if(v==='priority')return await proPriority(c);
    if(v==='payouts')return await proPayouts(c);
    if(v==='profile')return await proProfile(c);
    return await proDashboard(c);
  }catch(error){
    c.innerHTML=`<section class="pro-error"><div class="pro-error-icon">!</div><h2>Não conseguimos carregar esta área</h2><p>${escapeHtml(error.message)}</p><button class="btn primary" id="retryProfessional">Tentar novamente</button></section>`;
    document.getElementById('retryProfessional')?.addEventListener('click',()=>proView(v));
  }
}
function proInitials(name){return String(name||'P').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function proJobCategory(j){if(j.status==='convidado')return 'pending';if(j.status==='recusado'||j.status==='cancelado')return 'closed';if(j.event_status==='finalizado'||j.status==='finalizado')return 'finished';if(j.status==='confirmado')return 'confirmed';return 'other'}
function proInviteMarkup(j){return `<article class="pro-invite-card"><div class="pro-invite-date"><strong>${escapeHtml(String(j.event_date||'').slice(8,10)||'--')}</strong><span>${escapeHtml((String(j.event_date||'').slice(5,7)&&new Date(`${j.event_date}T12:00:00`).toLocaleDateString('pt-BR',{month:'short'}))||'Data')}</span></div><div class="pro-invite-info"><div class="pro-card-overline">CONVITE DE TRABALHO · #${Number(j.id)}</div><h3>${escapeHtml(j.event_type||'Evento')}</h3><p>${escapeHtml(j.service_name||j.role||'Serviço')} <span>•</span> ${escapeHtml(j.city||'Local não informado')}</p><div class="pro-invite-meta"><span>◷ ${escapeHtml(fmtDate(j.event_date))}${j.start_time?' · '+escapeHtml(j.start_time):''}</span><span>⌖ ${escapeHtml(j.city||'A combinar')}</span></div></div><div class="pro-invite-value"><small>Valor combinado</small><strong>${fmtMoney(j.agreed_price)}</strong><div class="pro-invite-actions"><button class="btn primary" data-job-accept="${Number(j.id)}">Aceitar</button><button class="btn ghost" data-job-decline="${Number(j.id)}">Recusar</button></div></div></article>`}
function bindProInviteActions(container){container.querySelectorAll('[data-job-accept]').forEach(b=>b.onclick=()=>changeJob(Number(b.dataset.jobAccept),'confirmado'));container.querySelectorAll('[data-job-decline]').forEach(b=>b.onclick=()=>{if(confirm('Deseja recusar este convite?'))changeJob(Number(b.dataset.jobDecline),'recusado')})}
function proMetric(icon,label,value,detail,tone='gold'){return `<article class="pro-stat-card"><div class="pro-stat-top"><span class="pro-stat-icon ${tone}">${icon}</span><span class="pro-stat-label">${label}</span></div><strong class="pro-stat-value">${value}</strong><span class="pro-stat-detail">${detail}</span></article>`}
async function proDashboard(c){
  const [jobs,availability,payouts]=await Promise.all([api('/professionals/me/jobs'),api('/professionals/me/availability'),api('/professionals/me/payouts')]);
  const pending=jobs.filter(j=>j.status==='convidado');
  const pendingCount=document.querySelector('[data-pro-pending-count]');if(pendingCount)pendingCount.textContent=String(pending.length);
  const confirmed=jobs.filter(j=>j.status==='confirmado'&&j.event_status!=='finalizado'&&j.event_status!=='cancelado');
  const upcoming=confirmed.filter(j=>j.event_date>=localDateISO()).sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date)));
  const finished=jobs.filter(j=>j.event_status==='finalizado');
  const totalConfirmed=jobs.filter(j=>['confirmado','finalizado'].includes(j.status)||j.event_status==='finalizado').reduce((sum,j)=>sum+Number(j.agreed_price||0),0);
  const waitingPayout=payouts.filter(p=>p.status!=='pago').reduce((sum,p)=>sum+Number(p.amount||0),0);
  const next=upcoming[0];
  const today=localDateISO();
  const availableMap=new Map(availability.map(a=>[a.date,a.status]));
  const nextDays=Array.from({length:7},(_,i)=>{const date=new Date();date.setDate(date.getDate()+i);return localDateISO(date)});
  c.innerHTML=`<div class="pro-dashboard">
    <section class="pro-welcome"><div class="pro-welcome-pattern"></div><div class="pro-welcome-copy"><span class="pro-kicker">PAINEL DO PROFISSIONAL</span><h1>Bom dia, ${escapeHtml((state.user.name||'profissional').trim().split(/\s+/)[0])} <span>✦</span></h1><p>Organize sua agenda, acompanhe seus convites e deixe cada evento pronto para acontecer.</p><div class="pro-welcome-chips"><span>● Perfil ativo</span><span>⌖ ${escapeHtml([state.user.city,state.user.state].filter(Boolean).join(' · ')||'Local não informado')}</span></div></div><div class="pro-welcome-illustration"><div class="pro-illustration-ring"></div><div class="pro-illustration-star">✦</div><div class="pro-illustration-card"><small>SEU PRÓXIMO PASSO</small><strong>${pending.length?`${pending.length} convite${pending.length===1?'':'s'} para responder`:'Mantenha sua agenda atualizada'}</strong><span>${pending.length?'Responda para não perder oportunidades.':'Mostre quando você está disponível.'}</span></div></div></section>
    <div class="pro-stats-grid">${proMetric('✉','Convites pendentes',pending.length,pending.length?'Aguardando sua resposta':'Tudo respondido','gold')}${proMetric('◷','Próximos trabalhos',upcoming.length,'Trabalhos confirmados','blue')}${proMetric('✓','Eventos realizados',finished.length,'Na sua trajetória','green')}${proMetric('R$','Repasses em aberto',fmtMoney(waitingPayout),'Acompanhe seus pagamentos','purple')}</div>
    <div class="pro-dashboard-grid"><section class="pro-panel pro-next-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">AGENDA</span><h2>Seu próximo trabalho</h2></div><button class="pro-text-button" data-pro-go="jobs">Ver todos →</button></div>${next?`<div class="pro-next-event"><div class="pro-next-event-date"><strong>${escapeHtml(String(next.event_date||'').slice(8,10))}</strong><span>${escapeHtml(new Date(`${next.event_date}T12:00:00`).toLocaleDateString('pt-BR',{month:'short'}))}</span></div><div class="pro-next-event-body"><span class="pro-event-badge">CONFIRMADO</span><h3>${escapeHtml(next.event_type||'Evento')}</h3><p>${escapeHtml(next.service_name||next.role||'Serviço')} · ${escapeHtml(next.city||'Local não informado')}</p><div class="pro-next-meta"><span>◷ ${escapeHtml(fmtDate(next.event_date))}${next.start_time?' · '+escapeHtml(next.start_time):''}</span><strong>${fmtMoney(next.agreed_price)}</strong></div></div></div>`:`<div class="pro-empty"><div class="pro-empty-icon">✦</div><h3>Seu próximo evento começa aqui</h3><p>Quando você aceitar um convite, os detalhes do trabalho vão aparecer neste espaço.</p><button class="btn secondary" data-pro-go="invitations">Ver convites</button></div>`}<div class="pro-panel-footer"><div><span class="pro-footer-icon">↗</span><span><strong>Seu calendário em dia</strong><small>Atualize sua disponibilidade para receber convites adequados.</small></span></div><button class="btn ghost" data-pro-go="availability">Atualizar agenda</button></div></section>
    <section class="pro-panel pro-invitations-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">OPORTUNIDADES</span><h2>Convites recentes</h2></div><span class="pro-count-pill">${pending.length} pendente${pending.length===1?'':'s'}</span></div><div class="pro-invite-list">${pending.slice(0,2).map(j=>`<div class="pro-mini-invite"><div class="pro-mini-invite-icon">✦</div><div class="pro-mini-invite-copy"><strong>${escapeHtml(j.event_type||'Evento')}</strong><span>${escapeHtml(j.service_name||j.role||'Serviço')} · ${escapeHtml(j.city||'A combinar')}</span><small>${fmtDate(j.event_date)} · ${fmtMoney(j.agreed_price)}</small></div><span class="pro-mini-status">Novo</span></div>`).join('')||'<div class="pro-inline-empty"><span>✓</span><div><strong>Você está em dia!</strong><p>Novos convites aparecerão aqui quando forem enviados.</p></div></div>'}</div><button class="pro-full-button" data-pro-go="invitations">Abrir todos os convites <span>→</span></button></section></div>
    <section class="pro-panel pro-week-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">DISPONIBILIDADE</span><h2>Próximos sete dias</h2><p>Deixe claro quando pode assumir um trabalho.</p></div><button class="btn ghost" data-pro-go="availability">Gerenciar agenda</button></div><div class="pro-week-strip">${nextDays.map((d,i)=>{const status=availableMap.get(d)||'nao_definido';return `<button class="pro-week-day ${status==='disponivel'?'is-available':status==='indisponivel'?'is-unavailable':''}" data-quick-date="${d}" title="Clique para marcar como disponível"><span>${i===0?'HOJE':new Date(`${d}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','').toUpperCase()}</span><strong>${d.slice(8,10)}</strong><small>${status==='disponivel'?'Disponível':status==='indisponivel'?'Indisponível':'Não definido'}</small></button>`}).join('')}</div></section>
    <section class="pro-quick-grid"><button class="pro-quick-card" data-pro-go="jobs"><span class="pro-quick-icon icon-blue">▤</span><span><strong>Meus trabalhos</strong><small>Consulte funções, datas e valores</small></span><b>→</b></button><button class="pro-quick-card" data-pro-go="payouts"><span class="pro-quick-icon icon-green">R$</span><span><strong>Meus repasses</strong><small>Confira pagamentos e pendências</small></span><b>→</b></button><button class="pro-quick-card" data-pro-go="profile"><span class="pro-quick-icon icon-gold">◎</span><span><strong>Meu perfil</strong><small>Atualize seus dados e serviços</small></span><b>→</b></button></section>
  </div>`;
  c.querySelectorAll('[data-pro-go]').forEach(b=>b.onclick=()=>proView(b.dataset.proGo));
  c.querySelectorAll('[data-quick-date]').forEach(b=>b.onclick=async()=>{try{await api('/professionals/me/availability',{method:'POST',body:{date:b.dataset.quickDate,status:'disponivel'}});toast('Dia marcado como disponível.');proView('dashboard')}catch(e){toast(e.message,true)}});
}
async function proPriority(c){
  const priorityUntil=Date.parse(state.user.priorityUntil||'');
  const priorityActive=Number.isFinite(priorityUntil)&&priorityUntil>Date.now();
  c.innerHTML=`<div class="pro-page"><div class="pro-page-heading"><div><span class="pro-kicker">DESTAQUE PROFISSIONAL</span><h1>Prioridade na escala</h1><p>Ative um destaque temporário para aparecer primeiro entre os profissionais elegíveis e disponíveis.</p></div>${priorityActive?'<span class="pro-count-pill">Ativa</span>':''}</div><section class="pro-panel pro-priority-panel ${priorityActive?'is-active':''}"><div class="pro-priority-copy"><span class="pro-kicker">${priorityActive?'PRIORIDADE ATIVA':'MAIS VISIBILIDADE'}</span><h2>${priorityActive?'Você está na frente da fila de escala':'Apareça primeiro na fila de escala'}</h2><p>${priorityActive?`Seu destaque fica ativo até ${new Date(priorityUntil).toLocaleDateString('pt-BR')}.`:'Quando a equipe buscar profissionais, seu perfil aparecerá primeiro se estiver habilitado para o serviço e disponível na data. A prioridade não garante convites ou contratação.'}</p></div><div class="pro-priority-action"><strong>${priorityActive?'Renove por R$ 20,00':'30 dias · R$ 20,00'}</strong><button class="btn ${priorityActive?'secondary':'primary'}" type="button" data-buy-priority>${priorityActive?'Renovar prioridade':'Ativar prioridade'}</button></div></section><div class="pro-priority-steps"><article class="pro-panel"><span>1</span><div><strong>Pagamento confirmado</strong><p>A prioridade começa somente após confirmação pela InfinitePay.</p></div></article><article class="pro-panel"><span>2</span><div><strong>Ordem mais alta</strong><p>Você aparece primeiro entre profissionais aptos para a vaga.</p></div></article><article class="pro-panel"><span>3</span><div><strong>Convite continua humano</strong><p>A equipe escolhe quem convidar; o pagamento não garante trabalho.</p></div></article></div></div>`;
  c.querySelector('[data-buy-priority]').onclick=async event=>{
    const button=event.currentTarget;
    button.disabled=true;
    button.textContent='Abrindo pagamento...';
    try{
      const checkout=await api('/professionals/me/priority/payment',{method:'POST',body:{}});
      location.assign(checkout.checkoutUrl);
    }catch(error){toast(error.message,true);button.disabled=false;button.textContent=priorityActive?'Renovar prioridade':'Ativar prioridade'}
  };
}
async function proInvitations(c){
  const jobs=await api('/professionals/me/jobs');const invites=jobs.filter(j=>j.status==='convidado');
  c.innerHTML=`<div class="pro-page"><div class="pro-page-heading"><div><span class="pro-kicker">OPORTUNIDADES DE TRABALHO</span><h1>Meus convites</h1><p>Avalie os detalhes de cada evento antes de confirmar sua participação.</p></div><span class="pro-count-pill">${invites.length} aguardando resposta</span></div><div class="pro-invite-list pro-invite-list-full">${invites.map(proInviteMarkup).join('')||'<section class="pro-panel pro-empty"><div class="pro-empty-icon">✉</div><h2>Nenhum convite pendente</h2><p>Quando a equipe administrativa convidar você para um evento, ele aparecerá nesta lista.</p><button class="btn secondary" data-pro-go="availability">Atualizar disponibilidade</button></section>'}</div></div>`;
  bindProInviteActions(c);c.querySelector('[data-pro-go="availability"]')?.addEventListener('click',()=>proView('availability'));
}
function localDateISO(date=new Date()){const d=new Date(date);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
async function proAvailability(c){
  const saved=await api('/professionals/me/availability');const map=new Map(saved.map(a=>[a.date,a.status]));const today=new Date();today.setHours(12,0,0,0);const days=Array.from({length:35},(_,i)=>{const d=new Date(today);d.setDate(today.getDate()+i);return localDateISO(d)});
  c.innerHTML=`<div class="pro-page"><div class="pro-page-heading"><div><span class="pro-kicker">AGENDA DE TRABALHO</span><h1>Minha disponibilidade</h1><p>Marque os dias em que você pode trabalhar. A equipe usa estas informações para montar as escalas.</p></div><div class="pro-availability-legend"><span><i class="available-dot"></i>Disponível</span><span><i class="unavailable-dot"></i>Indisponível</span></div></div><section class="pro-panel pro-calendar-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">PRÓXIMOS 35 DIAS</span><h2>Organize sua agenda</h2></div><span class="pro-count-pill">Atualizado por você</span></div><div class="pro-calendar-grid">${days.map(d=>{const status=map.get(d)||'nao_definido';const dayDate=new Date(`${d}T12:00:00`);return `<article class="pro-calendar-day ${status==='disponivel'?'day-available':status==='indisponivel'?'day-unavailable':''}" data-calendar-day="${d}"><div class="pro-calendar-day-top"><span>${dayDate.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','')}</span><strong>${d.slice(8,10)}</strong></div><small>${dayDate.toLocaleDateString('pt-BR',{month:'short'}).replace('.','')}</small><div class="pro-calendar-day-status" data-date-status>${status==='disponivel'?'Disponível':status==='indisponivel'?'Indisponível':'Não definido'}</div><div class="pro-calendar-controls"><button type="button" class="calendar-available ${status==='disponivel'?'selected':''}" data-set-availability="${d}" data-availability="disponivel">Livre</button><button type="button" class="calendar-unavailable ${status==='indisponivel'?'selected':''}" data-set-availability="${d}" data-availability="indisponivel">Ocupado</button></div></article>`}).join('')}</div><div class="pro-calendar-note"><span>i</span><p>Disponibilidade não é confirmação de trabalho. Convites recebidos continuam precisando de sua resposta.</p></div></section></div>`;
  c.querySelectorAll('[data-set-availability]').forEach(b=>b.onclick=async()=>{const date=b.dataset.setAvailability,status=b.dataset.availability;try{await api('/professionals/me/availability',{method:'POST',body:{date,status}});const card=b.closest('[data-calendar-day]');card.classList.toggle('day-available',status==='disponivel');card.classList.toggle('day-unavailable',status==='indisponivel');card.querySelector('[data-date-status]').textContent=status==='disponivel'?'Disponível':'Indisponível';card.querySelectorAll('[data-set-availability]').forEach(btn=>btn.classList.toggle('selected',btn===b));toast('Disponibilidade atualizada.')}catch(e){toast(e.message,true)}});
}
async function proJobs(c){
  const jobs=await api('/professionals/me/jobs');const active=jobs.filter(j=>!['recusado','cancelado'].includes(j.status));
  c.innerHTML=`<div class="pro-page"><div class="pro-page-heading"><div><span class="pro-kicker">HISTÓRICO E AGENDA</span><h1>Meus trabalhos</h1><p>Acompanhe os eventos para os quais você foi convidado ou já confirmou presença.</p></div></div><div class="pro-job-summary">${proMetric('◷','Total de trabalhos',jobs.length,'Convites e escalas','gold')}${proMetric('✓','Confirmados',jobs.filter(j=>j.status==='confirmado').length,'Participações confirmadas','green')}${proMetric('✦','Concluídos',jobs.filter(j=>j.event_status==='finalizado').length,'Eventos finalizados','blue')}</div><section class="pro-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">LISTAGEM</span><h2>Seu histórico profissional</h2></div><label class="pro-filter-label">Filtrar <select id="proJobFilter"><option value="all">Todos</option><option value="pending">Convites pendentes</option><option value="confirmed">Confirmados</option><option value="finished">Finalizados</option><option value="closed">Recusados/cancelados</option></select></label></div><div id="proJobsList" class="pro-jobs-list">${jobs.map(j=>`<article class="pro-job-card" data-job-card data-job-category="${proJobCategory(j)}"><div class="pro-job-date"><span>${escapeHtml(String(j.event_date||'').slice(8,10)||'--')}</span><small>${j.event_date?escapeHtml(new Date(`${j.event_date}T12:00:00`).toLocaleDateString('pt-BR',{month:'short'})):'—'}</small></div><div class="pro-job-main"><div class="pro-job-title-row"><div><h3>${escapeHtml(j.event_type||'Evento')}</h3><p>${escapeHtml(j.service_name||j.role||'Serviço')} · ${escapeHtml(j.city||'Local não informado')}</p></div>${badge(j.event_status==='finalizado'?'finalizado':j.status)}</div><div class="pro-job-meta"><span>◷ ${escapeHtml(fmtDate(j.event_date))}${j.start_time?' · '+escapeHtml(j.start_time):''}</span><span>⌖ ${escapeHtml(j.address||j.city||'Local a confirmar')}</span></div></div><div class="pro-job-value"><small>Valor combinado</small><strong>${fmtMoney(j.agreed_price)}</strong>${j.status==='convidado'?`<div class="pro-job-actions"><button class="btn primary" data-job-accept="${Number(j.id)}">Aceitar</button><button class="btn ghost" data-job-decline="${Number(j.id)}">Recusar</button></div>`:''}</div></article>`).join('')||'<div class="pro-empty"><div class="pro-empty-icon">▤</div><h3>Nenhum trabalho por enquanto</h3><p>Seus convites e eventos confirmados aparecerão aqui.</p></div>'}</div></section></div>`;
  document.getElementById('proJobFilter').onchange=e=>c.querySelectorAll('[data-job-card]').forEach(card=>card.hidden=e.target.value!=='all'&&card.dataset.jobCategory!==e.target.value);bindProInviteActions(c);
}
async function proPayouts(c){
  const payouts=await api('/professionals/me/payouts');const paid=payouts.filter(p=>p.status==='pago').reduce((n,p)=>n+Number(p.amount||0),0);const pending=payouts.filter(p=>p.status!=='pago').reduce((n,p)=>n+Number(p.amount||0),0);
  c.innerHTML=`<div class="pro-page"><div class="pro-page-heading"><div><span class="pro-kicker">FINANCEIRO</span><h1>Meus repasses</h1><p>Consulte os valores registrados pelo administrador e acompanhe o status dos pagamentos pelos seus trabalhos.</p></div></div><div class="pro-payout-summary">${proMetric('R$','Total recebido',fmtMoney(paid),'Repasses pagos','green')}${proMetric('◷','Em aberto',fmtMoney(pending),'Aguardando registro ou pagamento','gold')}${proMetric('▤','Registros',payouts.length,'Repasses associados aos eventos','blue')}</div><section class="pro-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">EXTRATO</span><h2>Histórico de repasses</h2></div></div><div class="pro-payout-list">${payouts.map(p=>`<article class="pro-payout-row"><span class="pro-payout-icon ${p.status==='pago'?'paid':''}">${p.status==='pago'?'✓':'R$'}</span><div class="pro-payout-body"><strong>${escapeHtml(p.event_type||'Evento')}</strong><span>${escapeHtml(p.service_name||'Serviço')} · ${escapeHtml(fmtDate(p.event_date))}</span><small>${p.paidAt?'Pago em '+escapeHtml(fmtDate(p.paidAt)):p.status==='aguardando_registro'?'Aguardando o administrador registrar o repasse':'Registro financeiro atualizado pelo administrador'}</small></div><div class="pro-payout-amount"><strong>${fmtMoney(p.amount)}</strong>${badge(p.status)}</div></article>`).join('')||'<div class="pro-empty"><div class="pro-empty-icon">R$</div><h3>Seu extrato aparecerá aqui</h3><p>Quando seus trabalhos forem concluídos e os repasses forem registrados, você poderá acompanhar os pagamentos nesta área.</p></div>'}</div><div class="pro-calendar-note"><span>i</span><p>Os repasses são registrados pelo administrador após a conclusão do evento. Em caso de divergência, entre em contato com a equipe da Imperio Cerimonial.</p></div></section></div>`;
}
async function proProfile(c){
  const services=await api('/services');const u=state.user||{};const selected=new Set((u.serviceIds||[]).map(Number));
  c.innerHTML=`<div class="pro-page"><div class="pro-page-heading"><div><span class="pro-kicker">SUA IDENTIDADE PROFISSIONAL</span><h1>Meu perfil</h1><p>Mantenha seus dados e os serviços que você presta atualizados para facilitar a montagem das escalas.</p></div>${badge(u.status||'active')}</div><div class="pro-profile-layout"><section class="pro-panel pro-profile-card"><div class="pro-profile-cover"></div><div class="pro-profile-identity"><div class="pro-profile-avatar">${escapeHtml(proInitials(u.name))}</div><div><h2>${escapeHtml(u.name||'Profissional')}</h2><p>${escapeHtml([u.city,u.state].filter(Boolean).join(' · ')||'Local não informado')}</p><span>${badge(u.status||'active')}</span></div></div><div class="pro-profile-note"><strong>Seu perfil ajuda a equipe a encontrar você</strong><p>Informe seus dados e as especialidades que você oferece. Os preços dos serviços são definidos pela administração.</p></div></section><section class="pro-panel pro-profile-form-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">DADOS CADASTRAIS</span><h2>Informações profissionais</h2></div></div><form id="proProfileForm" class="pro-profile-form"><div class="pro-profile-fields"><label class="pro-field"><span>Nome completo</span><input name="name" value="${escapeHtml(u.name||'')}" maxlength="120" required></label><label class="pro-field"><span>E-mail de acesso</span><input value="${escapeHtml(u.email||'')}" disabled><small>O e-mail é usado para entrar na plataforma.</small></label><label class="pro-field"><span>Telefone</span><input name="phone" value="${escapeHtml(u.phone||'')}" maxlength="30" placeholder="(00) 00000-0000"></label><label class="pro-field"><span>Cidade</span><input name="city" value="${escapeHtml(u.city||'')}" maxlength="100" required></label><label class="pro-field"><span>Estado (UF)</span><input name="state" value="${escapeHtml(u.state||'')}" maxlength="2" minlength="2" required></label><label class="pro-field pro-profile-wide"><span>Biografia profissional</span><textarea name="bio" maxlength="1000" rows="4" placeholder="Conte um pouco sobre sua experiência, especialidades e perfil de trabalho.">${escapeHtml(u.bio||'')}</textarea></label></div><div class="pro-profile-services"><div><h3>Serviços que você presta</h3><p>Selecione suas especialidades. Os preços são configurados pela administração e não dependem do profissional escolhido.</p></div><div class="pro-service-picks">${services.map(s=>{const serviceId=Number(s.id),isSelected=selected.has(serviceId);return `<article class="pro-service-pick" data-pro-service-card><label class="pro-service-pick-title"><input type="checkbox" name="serviceIds" value="${serviceId}" ${isSelected?'checked':''}><span>${escapeHtml(s.name)}</span><b>✓</b></label></article>`}).join('')}</div></div><div class="pro-profile-actions"><span>Você pode atualizar as especialidades oferecidas a qualquer momento.</span><button type="submit" class="btn primary">Salvar alterações</button></div></form></section></div><section class="pro-danger-zone"><div><strong>Solicitar saída da plataforma</strong><p>Use esta opção caso não queira mais receber convites. A solicitação segue as regras para trabalhos confirmados e repasses em aberto.</p></div><button id="proExitPlatform" type="button" class="btn danger">Solicitar saída</button></section></div>`;
  const profileForm=document.getElementById('proProfileForm');
  profileForm.onsubmit=async e=>{e.preventDefault();const f=e.currentTarget;const serviceIds=[...f.querySelectorAll('[name="serviceIds"]:checked')].map(x=>Number(x.value));const payload={name:f.name.value.trim(),phone:f.phone.value.trim(),city:f.city.value.trim(),state:f.state.value.trim().toUpperCase(),bio:f.bio.value.trim(),serviceIds};if(payload.state.length!==2)return toast('Informe a sigla do estado com duas letras.',true);if(!payload.serviceIds.length)return toast('Selecione ao menos um serviço.',true);const button=f.querySelector('[type="submit"]');button.disabled=true;button.textContent='Salvando...';try{const d=await api('/professionals/me/profile',{method:'PATCH',body:payload});state.user=d.user;localStorage.setItem('cerimonial_user',JSON.stringify(d.user));common();toast('Perfil atualizado. Os preços são gerenciados pelo administrador.');proView('profile')}catch(err){toast(err.message,true);button.disabled=false;button.textContent='Salvar alterações'}};
  document.getElementById('proExitPlatform').onclick=async()=>{if(!confirm('Tem certeza que deseja solicitar sua saída da plataforma? Convites e trabalhos futuros podem ser cancelados conforme as regras do sistema.'))return;try{const d=await api('/professionals/me/exit',{method:'POST',body:{confirm:true}});toast(d.message||'Solicitação processada.');if(d.exitCompleted){clearSession();setTimeout(()=>location.href='profissional-login.html',500)}else proView('profile')}catch(err){toast(err.message,true)}};
}
async function changeJob(id,decision){try{await api(`/professionals/me/jobs/${id}`,{method:'PATCH',body:{decision}});toast(decision==='confirmado'?'Trabalho aceito!':'Convite recusado.');proView('dashboard')}catch(e){toast(e.message,true)}}
async function adminView(v,focusEventId=null){
  document.querySelectorAll('[data-admin-view]').forEach(button=>button.classList.toggle('active',button.dataset.adminView===v));
  const c=document.getElementById('content');
  c.innerHTML='<div class="pro-loading"><span class="loading-dot"></span><span>Carregando o painel...</span></div>';
  if(v==='calendar')return adminCalendar(c);
  if(v==='schedule')return adminSchedule(c,focusEventId);
  if(v==='events')return adminEvents(c);
  if(v==='professionals')return adminProfessionals(c);
  if(v==='service-prices')return adminServicePrices(c);
  if(v==='quotes')return adminQuotes(c);
  if(v==='plans')return adminPlans(c);
  if(v==='payouts')return adminPayouts(c);
  try{
    const [summary,events]=await Promise.all([api('/admin/dashboard'),api('/events')]);
    c.innerHTML=`<div class="pro-page admin-page"><section class="pro-welcome admin-welcome"><div class="pro-welcome-pattern"></div><div class="pro-welcome-copy"><span class="pro-kicker">PAINEL ADMINISTRATIVO</span><h1>Visão geral <span>✦</span></h1><p>Acompanhe os principais indicadores e mantenha a operação da Imperio Cerimonial organizada.</p><div class="pro-welcome-chips"><span>● Painel atualizado</span><span>⌖ Gestão de eventos e equipe</span></div></div><div class="pro-welcome-illustration"><div class="pro-illustration-ring"></div><div class="pro-illustration-star">✦</div><div class="pro-illustration-card"><small>OPERAÇÃO IMPERIO</small><strong>${Number(summary.pendingRequests)} solicitações para acompanhar</strong><span>Consulte eventos, propostas e profissionais em um só lugar.</span></div></div></section><div class="pro-stats-grid admin-stats-grid">${proMetric('◷','Eventos hoje',summary.eventsToday,'Agendados para hoje','gold')}${proMetric('▤','Próximos eventos',summary.upcomingEvents,'Na agenda da equipe','blue')}${proMetric('♙','Profissionais ativos',summary.professionalsActive,'Aprovados para trabalhar','green')}${proMetric('◇','Novas solicitações',summary.pendingRequests,'Aguardando análise','purple')}</div><section class="pro-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">AGENDA</span><h2>Próximos eventos</h2><p>Visão rápida das solicitações cadastradas.</p></div><button class="btn secondary" id="goAdminEvents">Ver todos os eventos <span>→</span></button></div><div class="table-wrap"><table class="table"><thead><tr><th>Evento</th><th>Cliente</th><th>Data</th><th>Status</th></tr></thead><tbody>${events.slice(0,8).map(event=>`<tr><td><strong>${escapeHtml(event.event_type)}</strong></td><td>${escapeHtml(event.client_name)}</td><td>${escapeHtml(fmtDate(event.event_date))}</td><td>${badge(event.status)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Nenhum evento cadastrado.</td></tr>'}</tbody></table></div></section></div>`;
    document.getElementById('goAdminEvents')?.addEventListener('click',()=>adminView('events'));
  }catch(error){c.innerHTML=`<section class="pro-panel pro-error"><div class="pro-error-icon">!</div><h2>Não foi possível carregar o painel</h2><p>${escapeHtml(error.message)}</p><button class="btn secondary" type="button" data-admin-retry> Tentar novamente</button></section>`;c.querySelector('[data-admin-retry]').onclick=()=>adminView('dashboard')}
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function calendarDateKey(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function adminScheduleMarkup(event,services){
  const requested=Array.isArray(event.service_quantities)?event.service_quantities:(Array.isArray(event.service_ids)?event.service_ids.map(service_id=>({service_id,quantity:1})):[]);
  const staff=Array.isArray(event.staff)?event.staff:[];
  const canSchedule=['aprovado','equipe_sendo_montada','equipe_confirmada'].includes(event.status);
  const lockedMessage=event.status==='finalizado'
    ?'Este evento foi finalizado. A escala está disponível somente para consulta.'
    :event.status==='cancelado'
      ?'Este evento foi cancelado e não pode receber novos convites.'
      :'A escala será liberada após a aprovação do evento e a confirmação do pagamento.';
  const serviceOptions=requested.map(item=>{
    const serviceId=Number(item.service_id??item.serviceId);
    const service=services.find(entry=>Number(entry.id)===serviceId);
    return service?`<option value="${serviceId}">${escapeHtml(service.name)} · ${Number(item.quantity||1)} solicitado(s)</option>`:'';
  }).join('');
  return `<section class="admin-calendar-detail pro-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">DETALHES E ESCALA</span><h2>${escapeHtml(event.event_type||'Evento')}</h2><p>${escapeHtml(event.client_name||'Cliente')} · ${escapeHtml(fmtDate(event.event_date))} · ${escapeHtml(event.city||'')}</p></div>${badge(event.status)}</div><div class="admin-calendar-event-meta"><span><strong>Horário</strong>${escapeHtml(event.start_time||'Não informado')}</span><span><strong>Convidados</strong>${Number(event.guest_count||0).toLocaleString('pt-BR')}</span><span><strong>Endereço</strong>${escapeHtml(event.address||event.city||'Não informado')}</span></div><div class="admin-calendar-staff"><h3>Profissionais escalados <span>${staff.filter(person=>['convidado','confirmado'].includes(person.status)).length}</span></h3>${staff.filter(person=>person.status!=='cancelado'&&person.status!=='recusado').map(person=>`<div class="admin-calendar-staff-row"><span><strong>${escapeHtml(person.professional_name)}</strong><small>${escapeHtml(person.service_name||person.role||'Serviço')} · ${fmtMoney(person.agreed_price)}</small></span>${badge(person.status)}</div>`).join('')||'<p class="admin-calendar-empty-staff">Ainda não há profissionais escalados para este evento.</p>'}</div>${canSchedule&&serviceOptions?`<form class="admin-schedule-form" data-schedule-event="${Number(event.id)}" data-event-date="${escapeHtml(event.event_date)}"><div><span class="pro-kicker">NOVA CONVOCAÇÃO</span><h3>Escalar profissional</h3></div><div class="admin-schedule-fields"><label>Serviço solicitado<select name="serviceId" required>${serviceOptions}</select></label><label>Profissional<select name="professionalId" required><option value="">Consultando disponibilidade...</option></select></label><label>Função na equipe<input name="role" maxlength="100" placeholder="Opcional"></label><label>Repasse combinado (R$)<input name="agreedPrice" type="number" min="0" max="100000000" step="0.01" value="0" required></label></div><div class="admin-schedule-footer"><small data-availability-note>Os profissionais ocupados ou indisponíveis nesta data não poderão ser selecionados.</small><button type="submit" class="btn primary">Enviar convite</button></div></form>`:`<div class="admin-schedule-locked">${serviceOptions?lockedMessage:'Este evento não tem serviços solicitados para montar uma escala.'}</div>`}</section>`;
}
async function bindAdminScheduleForms(container,events,professionals,refresh){
  container.querySelectorAll('[data-schedule-event]').forEach(form=>{
    const serviceSelect=form.elements.serviceId;
    const professionalSelect=form.elements.professionalId;
    const note=form.querySelector('[data-availability-note]');
    let requestNumber=0;
    const updateProfessionals=async()=>{
      const request=++requestNumber;
      professionalSelect.innerHTML='<option value="">Consultando disponibilidade...</option>';
      try{
        const data=await api(`/admin/availability?date=${encodeURIComponent(form.dataset.eventDate)}`);
        if(request!==requestNumber)return;
        const event=events.find(item=>Number(item.id)===Number(form.dataset.scheduleEvent));
        const assigned=new Set((event?.staff||[]).filter(item=>['convidado','confirmado'].includes(item.status)).map(item=>Number(item.professional_id)));
        const availability=new Map(data.availability.map(item=>[Number(item.professional_id),item.status]));
        const busy=new Set(data.busyProfessionalIds.map(Number));
        const serviceId=Number(serviceSelect.value);
        const eligible=professionals.filter(person=>(person.serviceIds||[]).map(Number).includes(serviceId)).sort((a,b)=>{
          const aExpiry=Date.parse(a.priorityUntil||''),bExpiry=Date.parse(b.priorityUntil||'');
          const aActive=Number.isFinite(aExpiry)&&aExpiry>Date.now()?aExpiry:0;
          const bActive=Number.isFinite(bExpiry)&&bExpiry>Date.now()?bExpiry:0;
          return bActive-aActive;
        });
        const availableCount=eligible.filter(person=>availability.get(Number(person.id))!=='indisponivel'&&!busy.has(Number(person.id))&&!assigned.has(Number(person.id))).length;
        professionalSelect.innerHTML='<option value="">Selecione um profissional</option>'+eligible.map(person=>{
          const unavailable=availability.get(Number(person.id))==='indisponivel';
          const occupied=busy.has(Number(person.id))||assigned.has(Number(person.id));
          const reason=unavailable?' — indisponível':occupied?' — já escalado':'';
          const expiry=Date.parse(person.priorityUntil||'');
          const priority=Number.isFinite(expiry)&&expiry>Date.now();
          return `<option value="${Number(person.id)}" ${unavailable||occupied?'disabled':''}>${priority?'★ PRIORITÁRIO · ':''}${escapeHtml(person.name)}${reason}</option>`;
        }).join('');
        form.querySelector('[type="submit"]').disabled=availableCount===0;
        note.textContent=availableCount?'Profissionais com disponibilidade não informada são considerados disponíveis.':'Não há profissionais disponíveis e habilitados para este serviço nesta data.';
      }catch(error){
        if(request!==requestNumber)return;
        professionalSelect.innerHTML='<option value="">Disponibilidade indisponível</option>';
        form.querySelector('[type="submit"]').disabled=true;
        note.textContent=error.message;
      }
    };
    serviceSelect.onchange=updateProfessionals;
    updateProfessionals();
    form.onsubmit=async event=>{
      event.preventDefault();
      const button=form.querySelector('[type="submit"]');
      button.disabled=true;
      button.textContent='Enviando convite...';
      try{
        await api('/professionals/invite',{method:'POST',body:{eventId:Number(form.dataset.scheduleEvent),professionalId:Number(professionalSelect.value),serviceId:Number(serviceSelect.value),role:form.elements.role.value.trim(),agreedPrice:Number(form.elements.agreedPrice.value)}});
        toast('Convite enviado ao profissional.');
        await refresh(Number(form.dataset.scheduleEvent));
      }catch(error){toast(error.message,true);button.disabled=false;button.textContent='Enviar convite'}
    };
  });
}
async function adminCalendar(c,month=new Date(),selectedDate=calendarDateKey(new Date())){
  try{
    const events=await api('/events');
    const year=month.getFullYear(),monthIndex=month.getMonth(),firstDay=new Date(year,monthIndex,1,12);
    const monthStart=new Date(year,monthIndex,1-firstDay.getDay(),12);
    const eventsByDate=new Map();
    events.forEach(event=>{if(!event.event_date)return;const list=eventsByDate.get(event.event_date)||[];list.push(event);eventsByDate.set(event.event_date,list)});
    const cells=Array.from({length:42},(_,index)=>{
      const date=new Date(monthStart);date.setDate(monthStart.getDate()+index);
      const key=calendarDateKey(date),dayEvents=eventsByDate.get(key)||[];
      return `<div class="admin-calendar-day ${date.getMonth()!==monthIndex?'outside-month':''} ${key===selectedDate?'selected-day':''} ${key===calendarDateKey(new Date())?'today':''}"><button class="admin-calendar-day-number" type="button" data-calendar-date="${key}" aria-label="Selecionar ${escapeHtml(date.toLocaleDateString('pt-BR'))}">${date.getDate()}</button><div class="admin-calendar-day-events">${dayEvents.slice(0,3).map(event=>`<button type="button" class="admin-calendar-event ${['cancelado','finalizado'].includes(event.status)?'muted-event':''}" data-calendar-event="${Number(event.id)}" data-calendar-date="${key}" title="${escapeHtml(event.event_type)} · ${escapeHtml(event.client_name||'')}"><span>${escapeHtml(event.start_time||'')}</span>${escapeHtml(event.event_type||'Evento')}</button>`).join('')}${dayEvents.length>3?`<span class="admin-calendar-more">+${dayEvents.length-3} mais</span>`:''}</div></div>`;
    }).join('');
    const dayEvents=eventsByDate.get(selectedDate)||[];
    const selectedDateLabel=new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    const monthLabel=firstDay.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
    c.innerHTML=`<div class="pro-page admin-page admin-calendar-page"><div class="pro-page-heading"><div><span class="pro-kicker">AGENDA OPERACIONAL</span><h1>Calendário de eventos</h1><p>Consulte as datas e abra um evento para organizar a equipe na tela de escala.</p></div><span class="pro-count-pill">${events.length} eventos</span></div><section class="pro-panel admin-calendar-panel"><div class="admin-calendar-toolbar"><div><span class="pro-kicker">AGENDA MENSAL</span><h2>${escapeHtml(monthLabel)}</h2></div><div class="admin-calendar-controls"><button class="btn secondary" type="button" data-calendar-prev aria-label="Mês anterior">‹</button><button class="btn secondary" type="button" data-calendar-today>Hoje</button><button class="btn secondary" type="button" data-calendar-next aria-label="Próximo mês">›</button></div></div><div class="admin-calendar-grid"><div class="admin-calendar-weekdays">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(day=>`<span>${day}</span>`).join('')}</div><div class="admin-calendar-days">${cells}</div></div><div class="admin-calendar-legend"><span><i></i> Evento</span><span>Clique em um evento para abrir sua escala.</span></div></section><section class="admin-calendar-day-list pro-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">DIA SELECIONADO</span><h2>${escapeHtml(selectedDateLabel)}</h2></div><span class="pro-count-pill">${dayEvents.length} evento(s)</span></div>${dayEvents.map(event=>`<div class="admin-calendar-event-row"><span><strong>${escapeHtml(event.start_time||'Horário não informado')}</strong><small>${escapeHtml(event.event_type||'Evento')} · ${escapeHtml(event.client_name||'Cliente')}</small></span><div class="admin-calendar-row-actions">${badge(event.status)}<button type="button" class="btn secondary" data-open-schedule="${Number(event.id)}">Abrir escala</button></div></div>`).join('')||'<div class="admin-calendar-no-events">Nenhum evento cadastrado neste dia. Selecione outra data no calendário.</div>'}</section></div>`;
    c.querySelectorAll('[data-calendar-date]').forEach(button=>button.onclick=()=>adminCalendar(c,month,button.dataset.calendarDate,null));
    c.querySelectorAll('[data-calendar-event]').forEach(button=>button.onclick=()=>adminView('schedule',Number(button.dataset.calendarEvent)));
    c.querySelectorAll('[data-open-schedule]').forEach(button=>button.onclick=()=>adminView('schedule',Number(button.dataset.openSchedule)));
    c.querySelector('[data-calendar-prev]').onclick=()=>{const next=new Date(year,monthIndex-1,1,12);adminCalendar(c,next,calendarDateKey(next),null)};
    c.querySelector('[data-calendar-next]').onclick=()=>{const next=new Date(year,monthIndex+1,1,12);adminCalendar(c,next,calendarDateKey(next),null)};
    c.querySelector('[data-calendar-today]').onclick=()=>adminCalendar(c,new Date(),calendarDateKey(new Date()),null);
  }catch(error){c.innerHTML=`<section class="pro-panel pro-error"><div class="pro-error-icon">!</div><h2>Não foi possível carregar o calendário</h2><p>${escapeHtml(error.message)}</p><button class="btn secondary" type="button" data-calendar-retry>Tentar novamente</button></section>`;c.querySelector('[data-calendar-retry]').onclick=()=>adminCalendar(c,month,selectedDate)}
}
function adminScheduleEventList(events,selectedId,emptyMessage,selectable){
  if(!events.length)return `<p class="admin-schedule-empty">${emptyMessage}</p>`;
  return `<div class="admin-schedule-event-list">${events.map(event=>{
    const assigned=(event.staff||[]).filter(person=>['convidado','confirmado'].includes(person.status)).length;
    return `<article class="admin-schedule-event-item ${Number(event.id)===Number(selectedId)?'active':''}"><div><span class="pro-kicker">${escapeHtml(fmtDate(event.event_date))}${event.start_time?' · '+escapeHtml(event.start_time):''}</span><h3>${escapeHtml(event.event_type||'Evento')}</h3><p>${escapeHtml(event.client_name||'Cliente')} · ${escapeHtml(event.city||'Cidade não informada')}</p><small>${assigned} profissional(is) escalado(s)</small></div><div class="admin-schedule-event-action">${badge(event.status)}<button type="button" class="btn ${selectable?'secondary':'ghost'}" data-select-schedule="${Number(event.id)}">${selectable?'Abrir evento':'Ver detalhes'}</button></div></article>`;
  }).join('')}</div>`;
}
async function adminSchedule(c,focusEventId=null){
  try{
    const [events,professionals,services]=await Promise.all([api('/events'),api('/professionals?status=active'),api('/services')]);
    const ready=events.filter(event=>['aprovado','equipe_sendo_montada','equipe_confirmada'].includes(event.status));
    const waiting=events.filter(event=>!['aprovado','equipe_sendo_montada','equipe_confirmada','em_andamento','finalizado','cancelado'].includes(event.status));
    const inProgress=events.filter(event=>event.status==='em_andamento');
    const finished=events.filter(event=>event.status==='finalizado');
    const cancelled=events.filter(event=>event.status==='cancelado');
    const selected=events.find(event=>Number(event.id)===Number(focusEventId))||null;
    c.innerHTML=`<div class="pro-page admin-page admin-schedule-page"><div class="pro-page-heading"><div><span class="pro-kicker">GESTÃO DA EQUIPE</span><h1>Montar equipe</h1><p>Os eventos estão separados por etapa. Abra um evento liberado para ver a escala e enviar convites.</p></div><span class="pro-count-pill">${ready.length} liberado(s)</span></div><section class="pro-panel admin-schedule-group"><div class="pro-panel-heading"><div><span class="pro-kicker">AÇÃO NECESSÁRIA</span><h2>Prontos para escalar</h2><p>Eventos aprovados que podem receber convites.</p></div><span class="pro-count-pill">${ready.length}</span></div>${adminScheduleEventList(ready,focusEventId,'Nenhum evento liberado para montar equipe.',true)}</section><section class="pro-panel admin-schedule-group"><div class="pro-panel-heading"><div><span class="pro-kicker">AGUARDANDO</span><h2>Aguardando aprovação ou pagamento</h2><p>Esses eventos ainda não podem receber escala.</p></div><span class="pro-count-pill">${waiting.length}</span></div>${adminScheduleEventList(waiting,focusEventId,'Nenhum evento aguardando liberação.',true)}</section>${inProgress.length?`<section class="pro-panel admin-schedule-group"><div class="pro-panel-heading"><div><span class="pro-kicker">EM EXECUÇÃO</span><h2>Eventos em andamento</h2><p>Consulta da equipe; novos convites estão encerrados.</p></div><span class="pro-count-pill">${inProgress.length}</span></div>${adminScheduleEventList(inProgress,focusEventId,'Nenhum evento em andamento.',true)}</section>`:''}<section class="pro-panel admin-schedule-group"><div class="pro-panel-heading"><div><span class="pro-kicker">CONCLUÍDOS</span><h2>Eventos finalizados</h2><p>Consulta da equipe e do histórico; novos convites estão encerrados.</p></div><span class="pro-count-pill">${finished.length}</span></div>${adminScheduleEventList(finished,focusEventId,'Nenhum evento finalizado.',true)}</section>${cancelled.length?`<details class="admin-schedule-cancelled"><summary>Eventos cancelados · ${cancelled.length}</summary>${adminScheduleEventList(cancelled,focusEventId,'Nenhum evento cancelado.',true)}</details>`:''}${selected?`<div class="admin-schedule-detail-wrap">${adminScheduleMarkup(selected,services)}</div>`:''}</div>`;
    c.querySelectorAll('[data-select-schedule]').forEach(button=>button.onclick=()=>adminSchedule(c,Number(button.dataset.selectSchedule)));
    if(selected)await bindAdminScheduleForms(c,events,professionals,eventId=>adminSchedule(c,eventId));
  }catch(error){c.innerHTML=`<section class="pro-panel pro-error"><div class="pro-error-icon">!</div><h2>Não foi possível carregar a escala</h2><p>${escapeHtml(error.message)}</p><button class="btn secondary" type="button" data-schedule-retry>Tentar novamente</button></section>`;c.querySelector('[data-schedule-retry]').onclick=()=>adminSchedule(c,focusEventId)}
}
function planEditorCard(p,index){const planId=String(p.id||`plano-${Date.now()}-${index}`);const features=Array.isArray(p.features)?p.features.join('\\n'):String(p.features||'');return `<article class="pro-panel plan-edit-card" data-plan-row data-plan-id="${escapeHtml(planId)}"><div class="plan-edit-heading"><div><span class="pro-kicker">PLANO ${index+1}</span><h3>${escapeHtml(p.name||'Novo plano')}</h3></div><button type="button" class="btn danger" data-delete-plan>Excluir plano</button></div><div class="form-grid"><div class="field"><label>Nome do plano</label><input data-field="name" maxlength="80" value="${escapeHtml(p.name||'')}" required></div><div class="field"><label>Preço em reais (deixe vazio para consultar)</label><input data-field="price" type="number" min="0" step="0.01" value="${p.price===null||typeof p.price==='undefined'?'':escapeHtml(p.price)}" placeholder="Ex.: 990,00"></div><div class="field"><label>Texto antes do preço</label><input data-field="priceLabel" maxlength="40" value="${escapeHtml(p.priceLabel||'A partir de')}"></div><div class="field"><label>Descrição curta</label><input data-field="description" maxlength="500" value="${escapeHtml(p.description||'')}"></div></div><div class="field"><label>Serviços incluídos (um por linha)</label><textarea data-field="features" rows="6" maxlength="4000" placeholder="Reunião de briefing&#10;Planejamento do cronograma">${escapeHtml(features.replace(/\\n/g,'\n'))}</textarea></div><div class="plan-edit-options"><label><input data-field="active" type="checkbox" ${p.active!==false?'checked':''}> Exibir na página inicial</label><label><input data-field="featured" type="checkbox" ${p.featured?'checked':''}> Destacar como plano recomendado</label></div></article>`}
async function adminPlans(c){
  let plans;
  try{plans=await api('/admin/plans')}catch(e){c.innerHTML=`<div class="empty">${escapeHtml(e.message)}</div>`;return}
  c.innerHTML=`<div class="pro-page admin-page"><div class="pro-page-heading"><div><span class="pro-kicker">PÁGINA PÚBLICA</span><h1>Planos</h1><p>Edite os planos e serviços exibidos na página inicial.</p></div><div class="page-actions"><button class="btn secondary" id="addPlan">＋ Adicionar plano</button><button class="btn primary" id="savePlans">Salvar alterações</button></div></div><div class="pro-calendar-note plan-editor-notice"><span>i</span><p>Desativar um plano apenas o oculta da página inicial. As alterações serão publicadas quando você salvar.</p></div><div id="planEditList" class="plan-edit-list">${plans.map(planEditorCard).join('')}</div><div class="page-actions plan-editor-bottom"><button class="btn secondary" id="addPlanBottom">＋ Adicionar plano</button><button class="btn primary" id="savePlansBottom">Salvar alterações</button></div></div>`;
  const list=document.getElementById('planEditList');
  function bindPlanActions(){list.querySelectorAll('[data-delete-plan]').forEach(button=>button.onclick=()=>{button.closest('[data-plan-row]').remove();if(!list.children.length)list.innerHTML='<div class="card empty">Nenhum plano. Use “Adicionar plano” para criar um.</div>'})}
  function addPlan(){const empty=list.querySelector('.empty');if(empty)empty.remove();const p={id:`novo-plano-${Date.now()}-${Math.floor(Math.random()*10000)}`,name:'Novo plano',price:null,priceLabel:'Consultar',description:'Descreva este plano.',features:['Atendimento personalizado'],active:true,featured:false};list.insertAdjacentHTML('beforeend',planEditorCard(p,list.querySelectorAll('[data-plan-row]').length));bindPlanActions()}
  async function savePlans(){const rows=[...list.querySelectorAll('[data-plan-row]')];if(!rows.length){toast('Mantenha pelo menos um plano.',true);return}const payload=rows.map(row=>({id:row.dataset.planId,name:row.querySelector('[data-field="name"]').value.trim(),price:row.querySelector('[data-field="price"]').value===''?null:Number(row.querySelector('[data-field="price"]').value),priceLabel:row.querySelector('[data-field="priceLabel"]').value.trim(),description:row.querySelector('[data-field="description"]').value.trim(),features:row.querySelector('[data-field="features"]').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean),active:row.querySelector('[data-field="active"]').checked,featured:row.querySelector('[data-field="featured"]').checked}));if(payload.some(p=>!p.name)){toast('Preencha o nome de todos os planos.',true);return}if(payload.filter(p=>p.featured&&p.active).length>1){toast('Marque no máximo um plano como destaque.',true);return}const btns=[document.getElementById('savePlans'),document.getElementById('savePlansBottom')].filter(Boolean);btns.forEach(b=>{b.disabled=true;b.textContent='Salvando...'});try{await api('/admin/plans',{method:'PUT',body:{plans:payload}});toast('Planos salvos e publicados na página inicial.');await adminPlans(c)}catch(e){toast(e.message,true);btns.forEach(b=>{b.disabled=false;b.textContent='Salvar alterações'})}}
  document.getElementById('addPlan').onclick=addPlan;document.getElementById('addPlanBottom').onclick=addPlan;document.getElementById('savePlans').onclick=savePlans;document.getElementById('savePlansBottom').onclick=savePlans;bindPlanActions();
}
function adminQuoteComposerMarkup(event){
  const requested=Array.isArray(event.requested_professionals)?event.requested_professionals:[];
  const estimateItems=Array.isArray(event.estimate_items)?event.estimate_items:[];
  const legacyEstimate=!Array.isArray(event.estimate_items)?requested:[];
  const quoteItems=estimateItems.length?estimateItems.map(item=>`<div class="admin-quote-item"><label>Descrição<input name="description" maxlength="200" value="${escapeHtml(item.description)}" required></label><label>Quantidade<input name="quantity" type="number" min="1" step="1" value="${Number(item.quantity)}" required></label><label>Valor unitário<input name="unitPrice" type="number" min="0.01" step="0.01" value="${Number(item.unit_price)}" required></label><button type="button" class="btn ghost" data-remove-quote-item aria-label="Remover item">×</button></div>`).join(''):legacyEstimate.length?legacyEstimate.map(item=>`<div class="admin-quote-item"><label>Descrição<input name="description" maxlength="200" value="${escapeHtml(`${item.service_name} — ${item.professional_name}`)}" required></label><label>Quantidade<input name="quantity" type="number" min="1" step="1" value="${Number(item.quantity)}" required></label><label>Valor unitário<input name="unitPrice" type="number" min="0.01" step="0.01" value="${Number(item.unit_price)}" required></label><button type="button" class="btn ghost" data-remove-quote-item aria-label="Remover item">×</button></div>`).join(''):'<div class="admin-quote-item"><label>Descrição<input name="description" maxlength="200" placeholder="Ex.: Cerimonial do evento" required></label><label>Quantidade<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Valor unitário<input name="unitPrice" type="number" min="0.01" step="0.01" placeholder="0,00" required></label><button type="button" class="btn ghost" data-remove-quote-item aria-label="Remover item" disabled>×</button></div>';
  const hasEstimate=estimateItems.length>0||legacyEstimate.length>0;
  return `<form class="admin-quote-form" data-quote-form="${event.id}" hidden><div class="admin-quote-form-heading"><div><span class="pro-kicker">PROPOSTA COMERCIAL</span><h3>Orçamento para ${escapeHtml(event.client_name)}</h3><p>${escapeHtml(event.event_type)} · ${escapeHtml(fmtDate(event.event_date))}</p>${hasEstimate?`<small>Itens preenchidos com a estimativa de ${fmtMoney(event.estimated_total)} enviada pelo cliente. Revise e ajuste antes de enviar.</small>`:''}</div><button type="button" class="btn ghost" data-close-quote aria-label="Fechar orçamento">Fechar</button></div><div class="admin-quote-items" data-quote-items>${quoteItems}</div><div class="admin-quote-form-controls"><button type="button" class="btn secondary" data-add-quote-item>＋ Adicionar item</button><label>Desconto (R$)<input name="discount" type="number" min="0" step="0.01" value="0"></label><div class="admin-quote-total"><span>Total da proposta</span><strong data-quote-total>R$ 0,00</strong></div></div><div class="admin-quote-form-footer"><span>O cliente poderá consultar a proposta e aceitar ou solicitar alterações na área dele.</span><button type="submit" class="btn primary">Enviar orçamento ao cliente</button></div></form>`;
}
function adminEventCardMarkup(event,quote,quotes,statuses){
  const legacyApprovedEvent=event.status==='aprovado'&&!quote;
  const canQuote=(['solicitado','em_analise','aguardando_cliente'].includes(event.status)||legacyApprovedEvent)&&!quotes.some(item=>item.event_id===event.id&&['enviado','aguardando_pagamento'].includes(item.status));
  const labels={solicitado:'Solicitado',em_analise:'Em análise',orcamento_enviado:'Orçamento enviado',aguardando_cliente:'Aguardando cliente',aguardando_pagamento:'Aguardando pagamento',aprovado:'Aprovado',equipe_sendo_montada:'Equipe sendo montada',equipe_confirmada:'Equipe confirmada',em_andamento:'Em andamento',finalizado:'Finalizado',cancelado:'Cancelado'};
  const quoteStatus=quote?`<div class="admin-event-quote-status"><span>Último orçamento #${quote.id} · ${fmtMoney(quote.total)}</span>${badge(quote.status)}</div>`:'';
  const quoteButton=canQuote?`<button type="button" class="btn primary" data-open-quote="${event.id}" data-has-quote="${quote?'true':'false'}">${quote?'Criar novo orçamento':'Criar orçamento'}</button>`:'';
  const statusOptions=statuses.map(status=>`<option value="${status}" ${status===event.status?'selected':''}>${labels[status]}</option>`).join('');
  const quoteComposer=canQuote?adminQuoteComposerMarkup(event):'';
  return `<article class="pro-panel admin-event-card" data-admin-event-card="${event.id}"><div class="admin-event-top"><div><span class="event-id-label">SOLICITAÇÃO #${event.id}</span><h3>${escapeHtml(event.event_type)}</h3><p>${escapeHtml(event.client_name)} · ${escapeHtml(fmtDate(event.event_date))}${event.start_time?' · '+escapeHtml(event.start_time):''}</p><p class="muted">${escapeHtml(event.city)} · ${Number(event.guest_count||0).toLocaleString('pt-BR')} convidados</p>${quoteStatus}</div><div class="admin-event-status">${badge(event.status)}</div></div><div class="admin-event-actions"><button type="button" class="btn secondary" data-event-details-toggle="${event.id}">Ver detalhes do pedido</button>${quoteButton}<label class="status-field"><span>Atualizar status</span><select data-status-id="${event.id}" ${event.status==='aguardando_pagamento'?'disabled title="A confirmação de pagamento atualiza o status automaticamente."':''}>${statusOptions}</select></label></div><div class="admin-event-detail" data-event-detail="${event.id}" hidden>${eventDetailsMarkup(event)}</div>${quoteComposer}</article>`;
}
async function adminEvents(c){
  const [events,quotes]=await Promise.all([api('/events'),api('/quotes')]);
  const latestQuoteByEvent=new Map();
  quotes.forEach(quote=>{
    const latest=latestQuoteByEvent.get(quote.event_id);
    if(!latest||String(quote.created_at||'')>String(latest.created_at||''))latestQuoteByEvent.set(quote.event_id,quote);
  });
  const statuses=['solicitado','em_analise','orcamento_enviado','aguardando_cliente','aguardando_pagamento','aprovado','equipe_sendo_montada','equipe_confirmada','em_andamento','finalizado','cancelado'];
  c.innerHTML=`<div class="pro-page admin-page"><div class="pro-page-heading"><div><span class="pro-kicker">ACOMPANHAMENTO</span><h1>Eventos</h1><p>Consulte os pedidos, servi&ccedil;os e quantidades para preparar cada or&ccedil;amento.</p></div><span class="pro-count-pill">${events.length} eventos</span></div><div class="admin-event-list">${events.map(event=>adminEventCardMarkup(event,latestQuoteByEvent.get(event.id),quotes,statuses)).join('')||'<section class="pro-panel client-empty-state"><div class="client-empty-icon">&#9633;</div><h3>Nenhum evento solicitado</h3><p>Quando um cliente enviar uma solicita&ccedil;&atilde;o, ela aparecer&aacute; aqui.</p></section>'}</div></div>`;
  c.querySelectorAll('[data-event-details-toggle]').forEach(button=>button.onclick=()=>{const detail=c.querySelector(`[data-event-detail="${button.dataset.eventDetailsToggle}"]`);detail.hidden=!detail.hidden;button.textContent=detail.hidden?'Ver detalhes do pedido':'Ocultar detalhes do pedido'});
  c.querySelectorAll('[data-status-id]').forEach(s=>s.onchange=async()=>{try{await api(`/events/${s.dataset.statusId}/status`,{method:'PATCH',body:{status:s.value}});toast('Status atualizado.')}catch(e){toast(e.message,true)}});
  c.querySelectorAll('[data-open-quote]').forEach(button=>button.onclick=()=>{
    const card=button.closest('[data-admin-event-card]');
    const form=card.querySelector('[data-quote-form]');
    form.hidden=!form.hidden;
    button.textContent=form.hidden?(button.dataset.hasQuote==='true'?'Criar novo orçamento':'Criar orçamento'):'Fechar orçamento';
    if(!form.hidden)form.scrollIntoView({behavior:'smooth',block:'center'});
  });
  c.querySelectorAll('[data-quote-form]').forEach(form=>{
    const itemsContainer=form.querySelector('[data-quote-items]');
    const totalOutput=form.querySelector('[data-quote-total]');
    const updateTotal=()=>{
      const subtotal=[...itemsContainer.querySelectorAll('.admin-quote-item')].reduce((sum,row)=>{
        const quantity=Number(row.querySelector('[name="quantity"]').value||0);
        const price=Number(row.querySelector('[name="unitPrice"]').value||0);
        return sum+(Number.isFinite(quantity*price)?quantity*price:0);
      },0);
      const discount=Number(form.elements.discount.value||0);
      totalOutput.textContent=fmtMoney(Math.max(0,subtotal-(Number.isFinite(discount)?discount:0)));
      itemsContainer.querySelectorAll('[data-remove-quote-item]').forEach(remove=>remove.disabled=itemsContainer.querySelectorAll('.admin-quote-item').length===1);
    };
    form.querySelector('[data-add-quote-item]').onclick=()=>{
      itemsContainer.insertAdjacentHTML('beforeend','<div class="admin-quote-item"><label>Descrição<input name="description" maxlength="200" placeholder="Ex.: Decoração" required></label><label>Quantidade<input name="quantity" type="number" min="1" step="1" value="1" required></label><label>Valor unitário<input name="unitPrice" type="number" min="0.01" step="0.01" placeholder="0,00" required></label><button type="button" class="btn ghost" data-remove-quote-item aria-label="Remover item">×</button></div>');
      updateTotal();
    };
    form.querySelector('[data-close-quote]').onclick=()=>{form.hidden=true;const openButton=form.closest('[data-admin-event-card]').querySelector('[data-open-quote]');openButton.textContent=openButton.dataset.hasQuote==='true'?'Criar novo orçamento':'Criar orçamento'};
    form.addEventListener('input',updateTotal);
    form.addEventListener('click',event=>{
      const remove=event.target.closest('[data-remove-quote-item]');
      if(remove&&!remove.disabled){remove.closest('.admin-quote-item').remove();updateTotal()}
    });
    form.onsubmit=async event=>{
      event.preventDefault();
      const items=[...itemsContainer.querySelectorAll('.admin-quote-item')].map(row=>({
        description:row.querySelector('[name="description"]').value.trim(),
        quantity:Number(row.querySelector('[name="quantity"]').value),
        unitPrice:Number(row.querySelector('[name="unitPrice"]').value)
      }));
      const discount=Number(form.elements.discount.value||0);
      const submit=form.querySelector('[type="submit"]');
      submit.disabled=true;
      submit.textContent='Enviando...';
      try{
        await api('/quotes',{method:'POST',body:{eventId:Number(form.dataset.quoteForm),items,discount}});
        toast('Orçamento enviado para a área do cliente.');
        await adminEvents(c);
      }catch(error){toast(error.message,true);submit.disabled=false;submit.textContent='Enviar orçamento ao cliente'}
    };
    updateTotal();
  });
}
async function adminProfessionals(c){
  const [all,pending]=await Promise.all([api('/professionals'),api('/admin/professionals/pending')]);
  c.innerHTML=`<div class="pro-page admin-page"><div class="pro-page-heading"><div><span class="pro-kicker">GESTÃO DA EQUIPE</span><h1>Profissionais</h1><p>Aprove cadastros e consulte os dados da equipe. Os preços são configurados por serviço, na seção Preços dos serviços.</p></div><span class="pro-count-pill">${pending.length} cadastros pendentes</span></div><section class="pro-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">NOVOS CADASTROS</span><h2>Aguardando aprovação</h2></div></div><div id="pendingP" class="admin-pending-list"></div></section><section class="pro-panel admin-professionals-panel"><div class="pro-panel-heading"><div><span class="pro-kicker">EQUIPE</span><h2>Profissionais cadastrados</h2></div><span class="pro-count-pill">${all.length} profissionais</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Cidade</th><th>Avaliação</th><th>Status</th></tr></thead><tbody>${all.map(p=>`<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.email)}</td><td>${escapeHtml([p.city,p.state].filter(Boolean).join(' · ')||'-')}</td><td>${p.review_count?`★ ${Number(p.rating).toLocaleString('pt-BR')} (${p.review_count})`:'Sem avaliações'}</td><td>${badge(p.status)}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhum profissional cadastrado.</td></tr>'}</tbody></table></div></section></div>`;
  const box=document.getElementById('pendingP');
  if(!pending.length)box.innerHTML='<div class="pro-empty"><div class="pro-empty-icon">♙</div><h3>Nenhuma aprovação pendente</h3><p>Novos cadastros de profissionais aparecerão aqui.</p></div>';
  pending.forEach(p=>{const row=document.createElement('article');row.className='admin-pending-row';row.innerHTML=`<div><strong>${escapeHtml(p.name)}</strong><span>${escapeHtml(p.email)} · ${escapeHtml([p.city,p.state].filter(Boolean).join(' · '))}</span></div><div class="page-actions"><button type="button" class="btn primary">Aprovar</button><button type="button" class="btn ghost">Recusar</button></div>`;row.querySelector('.btn.primary').onclick=()=>changePro(p.id,true);row.querySelector('.btn.ghost').onclick=()=>changePro(p.id,false);box.appendChild(row)});
}
async function adminServicePrices(c){
  let definitions;
  try{definitions=await api('/admin/service-prices')}catch(error){c.innerHTML=`<section class="pro-panel pro-error"><h2>Não foi possível carregar os preços</h2><p>${escapeHtml(error.message)}</p></section>`;return}
  const grouped=new Map();
  for(const definition of definitions){if(!grouped.has(definition.serviceId))grouped.set(definition.serviceId,[]);grouped.get(definition.serviceId).push(definition)}
  c.innerHTML=`<div class="pro-page admin-page"><div class="pro-page-heading"><div><span class="pro-kicker">TABELA DE PREÇOS</span><h1>Preços dos serviços</h1><p>Defina os valores uma única vez para todos os clientes e profissionais.</p></div><button class="btn primary" id="saveServicePrices">Salvar preços</button></div><div class="pro-calendar-note plan-editor-notice"><span>i</span><p>Preencha o preço base e, se desejar, valores específicos para opções. Jantar, Coquetel e Churrasco são preços alternativos por convidado: quando um deles estiver informado, substitui o preço base do Buffet. As outras opções selecionadas são adicionais. Deixe em branco para não definir um valor.</p></div><div class="admin-service-price-list">${[...grouped].map(([serviceId,rows])=>`<section class="pro-panel admin-service-price-group"><div class="pro-panel-heading"><div><span class="pro-kicker">${escapeHtml(rows[0].unit.toUpperCase())}</span><h2>${escapeHtml(rows[0].label)}</h2></div></div><div class="admin-service-price-rows">${rows.map(definition=>`<label class="admin-service-price-row"><span><strong>${definition.optionId?escapeHtml(definition.label):'Preço base'}</strong><small>${definition.kind==='menu'?'Preço da opção principal (substitui o preço base do Buffet quando preenchido).':definition.optionId?'Adicional se selecionado pelo cliente.':`Valor padrão de ${escapeHtml(rows[0].label)}.`}</small></span><span class="admin-service-price-input"><span>R$</span><input type="number" min="0.01" max="100000000" step="0.01" data-service-price data-service-id="${definition.serviceId}" data-option-id="${escapeHtml(definition.optionId||'')}" value="${definition.unitPrice===null?'':Number(definition.unitPrice)}" placeholder="Não definido" aria-label="Preço ${escapeHtml(definition.label)} por ${escapeHtml(definition.unit)}"></span><small class="admin-service-price-unit">${escapeHtml(definition.unit)}</small></label>`).join('')}</div></section>`).join('')}</div></div>`;
  document.getElementById('saveServicePrices').onclick=async event=>{
    const button=event.currentTarget;
    const prices=[...c.querySelectorAll('[data-service-price]')].map(input=>({serviceId:Number(input.dataset.serviceId),optionId:input.dataset.optionId||null,unitPrice:input.value===''?null:Number(input.value)}));
    if(prices.some(item=>item.unitPrice!==null&&(!Number.isFinite(item.unitPrice)||item.unitPrice<0.01||item.unitPrice>100000000))){toast('Confira os preços informados.',true);return}
    button.disabled=true;button.textContent='Salvando...';
    try{await api('/admin/service-prices',{method:'PUT',body:{prices}});toast('Preços dos serviços salvos.');await adminServicePrices(c)}
    catch(error){toast(error.message,true);button.disabled=false;button.textContent='Salvar preços'}
  };
}
function servicesName(serviceId){return ({1:'Cerimonial',2:'Recepcionista',3:'Garçom',4:'Segurança',5:'Fotografia',6:'Filmagem',7:'Decoração',8:'Som',9:'Iluminação',10:'Buffet'})[Number(serviceId)]||'Serviço'}
async function changePro(id,approve){try{await api(`/professionals/${id}/approve`,{method:'PATCH',body:{approve}});toast(approve?'Profissional aprovado.':'Profissional recusado.');adminProfessionals(document.getElementById('content'))}catch(e){toast(e.message,true)}}
async function adminPayouts(c){
  const data=await api('/admin/payouts');
  const eligible=data.eligible||[];const payouts=data.payouts||[];
  c.innerHTML=`<div class="hero"><div><span class="section-kicker">FINANCEIRO DA EQUIPE</span><h1>Repasses aos profissionais</h1><div class="muted">Registre os valores combinados e acompanhe pagamentos depois da finalização do evento.</div></div></div><section class="card"><div class="pro-panel-heading"><div><h2>Eventos finalizados que precisam de repasse</h2><p class="muted">Cada registro corresponde a um profissional escalado para um evento finalizado.</p></div><span class="pro-count-pill">${eligible.length} registros</span></div><div class="admin-payout-eligible">${eligible.map(x=>`<article class="admin-payout-row" data-payout-row="${Number(x.staff_id)}"><div class="admin-payout-main"><strong>${escapeHtml(x.professional_name||'Profissional')}</strong><span>${escapeHtml(x.event_type||'Evento')} · ${escapeHtml(fmtDate(x.event_date))}</span><small>${escapeHtml(x.service_name||x.role||'Serviço')} · ${escapeHtml(x.city||'')}</small></div><div class="admin-payout-editor"><label>Valor do repasse<input type="number" min="0.01" step="0.01" data-payout-amount value="${Number(x.payout?.amount??x.agreed_price??0)}"></label><label>Status<select data-payout-status><option value="pendente" ${x.payout?.status!=='pago'?'selected':''}>Pendente</option><option value="pago" ${x.payout?.status==='pago'?'selected':''}>Pago</option></select></label><label>Data do pagamento<input type="date" data-payout-date value="${escapeHtml(String(x.payout?.paidAt||'').slice(0,10))}" ${x.payout?.status==='pago'?'':'disabled'}></label><button class="btn primary" data-save-payout="${Number(x.staff_id)}">Salvar</button></div></article>`).join('')||'<div class="empty">Não há trabalhos de eventos finalizados aguardando registro.</div>'}</div></section><section class="card" style="margin-top:18px"><div class="pro-panel-heading"><div><h2>Histórico de repasses</h2><p class="muted">Registros salvos pela administração.</p></div><span class="pro-count-pill">${payouts.length} registros</span></div><div class="table-wrap"><table class="table"><thead><tr><th>Profissional</th><th>Evento</th><th>Função</th><th>Valor</th><th>Status</th><th>Data do pagamento</th></tr></thead><tbody>${payouts.map(p=>`<tr><td>${escapeHtml(p.professional_name||'-')}</td><td>${escapeHtml(p.event_type||'-')} · ${escapeHtml(fmtDate(p.event_date))}</td><td>${escapeHtml(p.service_name||'-')}</td><td>${fmtMoney(p.amount)}</td><td>${badge(p.status)}</td><td>${p.paidAt?escapeHtml(fmtDate(p.paidAt)):'-'}</td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum repasse registrado.</td></tr>'}</tbody></table></div></section>`;
  c.querySelectorAll('[data-payout-status]').forEach(select=>select.onchange=()=>{const row=select.closest('[data-payout-row]');const date=row.querySelector('[data-payout-date]');date.disabled=select.value!=='pago';if(select.value==='pago'&&!date.value)date.value=localDateISO()});
  c.querySelectorAll('[data-save-payout]').forEach(button=>button.onclick=async()=>{const row=button.closest('[data-payout-row]'),amount=Number(row.querySelector('[data-payout-amount]').value),status=row.querySelector('[data-payout-status]').value,paidAt=row.querySelector('[data-payout-date]').value;if(!Number.isFinite(amount)||amount<=0)return toast('Informe um valor maior que zero.',true);if(status==='pago'&&!paidAt)return toast('Informe a data do pagamento.',true);button.disabled=true;button.textContent='Salvando...';try{await api('/admin/payouts',{method:'POST',body:{staffId:Number(button.dataset.savePayout),amount,status,paidAt:status==='pago'?paidAt:null}});toast('Repasse salvo.');adminPayouts(c)}catch(e){toast(e.message,true);button.disabled=false;button.textContent='Salvar'}});
}
async function adminQuotes(c){
  const quotes=await api('/quotes');
  c.innerHTML=`<div class="pro-page admin-page"><div class="pro-page-heading"><div><span class="pro-kicker">PROPOSTAS COMERCIAIS</span><h1>Orçamentos</h1><p>Acompanhe as propostas enviadas aos clientes. Para criar uma, abra o evento correspondente.</p></div><div class="admin-quote-heading-actions"><span class="pro-count-pill">${quotes.length} propostas</span><button type="button" class="btn primary" id="createAdminQuote">Criar orçamento</button></div></div><section class="pro-panel"><div class="table-wrap"><table class="table"><thead><tr><th>Orçamento</th><th>Cliente</th><th>Valor</th><th>Status</th><th>Enviado em</th></tr></thead><tbody>${quotes.map(quote=>`<tr><td><strong>#${quote.id} · Evento #${quote.event_id} · ${escapeHtml(quote.event_type)}</strong>${quote.client_note?`<br><small class="client-admin-quote-note">Pedido de alteração: ${escapeHtml(quote.client_note)}</small>`:''}</td><td>${escapeHtml(quote.client_name)}</td><td><strong>${fmtMoney(quote.total)}</strong></td><td>${badge(quote.status)}</td><td>${escapeHtml(fmtDate(quote.created_at))}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhum orçamento enviado. Abra Eventos para preparar uma proposta para o cliente.</td></tr>'}</tbody></table></div></section></div>`;
  c.querySelector('#createAdminQuote').onclick=()=>adminView('events');
}
function setupPages(){const r=document.body.dataset.role;if(r==='client'){if(!protect('client'))return;common();document.querySelectorAll('[data-client-view]').forEach(b=>b.onclick=()=>clientView(b.dataset.clientView));clientView('dashboard')}if(r==='professional'){if(!protect('professional'))return;common();document.querySelectorAll('[data-prof-view]').forEach(b=>b.onclick=()=>proView(b.dataset.profView));proView('dashboard')}if(r==='admin'){if(!protect('admin'))return;common();document.querySelectorAll('[data-admin-view]').forEach(b=>b.onclick=()=>adminView(b.dataset.adminView));adminView('dashboard')}}
async function setupPaymentReturn(){
  const root=document.querySelector('[data-payment-return]');
  if(!root)return;
  const params=new URLSearchParams(location.search);
  const paymentId=params.get('payment_id');
  const priorityPayment=params.get('payment_type')==='priority';
  const expectedRole=priorityPayment?'professional':'client';
  const accountPage=priorityPayment?'profissional.html':'cliente.html';
  const loginPage=priorityPayment?'profissional-login.html':'cliente-login.html';
  if(!state.token||state.role!==expectedRole){
    const returnTo=`${location.pathname}${location.search}`;
    location.assign(`${loginPage}?returnTo=${encodeURIComponent(returnTo)}`);
    return;
  }
  if(!paymentId){root.innerHTML=`<h1>Não foi possível identificar o pagamento</h1><p>Volte à sua área e tente novamente.</p><a class="btn primary" href="${accountPage}">Voltar</a>`;return}
  const verify=async()=>{
    root.innerHTML='<h1>Confirmando pagamento</h1><p>Estamos consultando a InfinitePay. Aguarde um instante.</p>';
    try{
      const body={
        paymentId,
        order_nsu:params.get('order_nsu'),
        slug:params.get('slug'),
        transaction_nsu:params.get('transaction_nsu'),
        capture_method:params.get('capture_method'),
        receipt_url:params.get('receipt_url')
      };
      const result=priorityPayment
        ?await api('/professionals/me/priority/verify',{method:'POST',body})
        :await api(`/payments/${encodeURIComponent(paymentId)}/verify`,{method:'POST',body});
      if(result.status==='paid'){
        if(priorityPayment&&state.user){state.user.priorityUntil=result.priorityUntil;localStorage.setItem('cerimonial_user',JSON.stringify(state.user))}
        root.innerHTML=priorityPayment
          ?'<h1>Prioridade ativada!</h1><p>Seu perfil ficará no topo da fila de escala por 30 dias, quando estiver habilitado e disponível para o serviço. Isso não garante convites ou contratação.</p><a class="btn primary" href="profissional.html">Voltar para minha área</a>'
          :'<h1>Pagamento confirmado!</h1><p>Seu orçamento foi aprovado. A equipe da Imperio Cerimonial dará continuidade ao atendimento.</p><a class="btn primary" href="cliente.html">Voltar para minha área</a>';
      }else{
        root.innerHTML=`<h1>Pagamento em confirmação</h1><p>A InfinitePay ainda não confirmou o pagamento. Aguarde alguns instantes e tente novamente.</p><button class="btn primary" type="button" data-retry-payment>Consultar novamente</button> <a class="btn secondary" href="${accountPage}">Voltar para minha área</a>`;
        root.querySelector('[data-retry-payment]').onclick=verify;
      }
    }catch(error){
      root.innerHTML=`<h1>Não foi possível confirmar o pagamento</h1><p>${escapeHtml(error.message)}</p><button class="btn primary" type="button" data-retry-payment>Tentar novamente</button> <a class="btn secondary" href="${accountPage}">Voltar para minha área</a>`;
      root.querySelector('[data-retry-payment]').onclick=verify;
    }
  };
  await verify();
}
window.addEventListener('pageshow',event=>{if(!event.persisted)return;if(document.body.dataset.role||document.body.dataset.loginRole){document.documentElement.style.visibility='hidden';location.reload()}});
document.addEventListener('DOMContentLoaded',()=>{setupLogin();setupGoogleLogin();setupClientReg();setupProReg();setupPages();setupPaymentReturn()});
