const express=require('express');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const app=express();
const PORT=Number(process.env.PORT||3000);
const FRONT=path.join(__dirname,'..','frontend');
const DATA=path.resolve(process.env.DATA_FILE||path.join(__dirname,'data','db.json'));
const INFINITEPAY_LINKS_URL='https://api.checkout.infinitepay.io/links';
const INFINITEPAY_CHECK_URL='https://api.checkout.infinitepay.io/payment_check';
const CHECKOUT_LINK_TTL_MS=24*60*60*1000;
const services=[['Cerimonial'],['Recepcionista'],['Garçom'],['Segurança'],['Fotografia'],['Filmagem'],['Decoração'],['Som'],['Iluminação'],['Buffet']].map((x,i)=>({id:i+1,name:x[0]}));
const SERVICE_PRICE_OPTIONS={
  7:[['natural-flowers','Flores naturais'],['artificial-flowers','Flores artificiais'],['table-centerpieces','Arranjos para mesas dos convidados'],['main-table','Decoração da mesa principal'],['photo-backdrop','Painel para fotos'],['balloons','Arcos ou arranjos de balões'],['candles','Velas decorativas'],['themed-decoration','Decoração temática']],
  8:[['sound-500w','Caixas de som: até 500 W','power'],['sound-1000w','Caixas de som: até 1.000 W','power'],['sound-2000w','Caixas de som: até 2.000 W','power'],['sound-3000w','Caixas de som: até 3.000 W','power'],['wireless-microphone','Microfone sem fio'],['wired-microphone','Microfone com fio'],['dj-setup','Equipamento para DJ'],['stage-monitor','Retorno de palco']],
  9:[['ambient-lighting','Iluminação ambiente'],['dance-floor','Iluminação para pista de dança'],['moving-heads','Moving heads'],['architectural-lighting','Iluminação cênica do espaço'],['string-lights','Cordões de luz decorativos'],['spotlights','Refletores e focos de destaque'],['led-uplights','Luzes LED no piso (uplights)']],
  10:[['buffet-dinner','Jantar','menu'],['buffet-cocktail','Coquetel','menu'],['buffet-barbecue','Churrasco','menu'],['buffet-brunch','Brunch','menu'],['vegetarian-options','Opções vegetarianas'],['vegan-options','Opções veganas'],['gluten-free-options','Opções sem glúten'],['lactose-free-options','Opções sem lactose'],['kids-menu','Cardápio infantil'],['dessert-table','Mesa de sobremesas']]
};
const quantitylessServiceIds=new Set([1,7,9]);
const sessions=new Map();
const googleOAuthStates=new Map();
const googleLoginTickets=new Map();
const paymentCreationLocks=new Set();
const DEFAULT_PLANS=[
  {id:'essencial',name:'Essencial',price:990,priceLabel:'A partir de',description:'Para quem precisa de organização.',features:['Reunião de briefing','Roteiro básico','Checklist do evento','Orientação de fornecedores','Planejamento do cronograma','Suporte pré-evento'],active:true,featured:false},
  {id:'completo',name:'Completo',price:1990,priceLabel:'A partir de',description:'Para quem quer tranquilidade.',features:['Briefing completo','Roteiro personalizado','Gestão de fornecedores','Ensaio e alinhamento','Coordenação do evento','Equipe no Dia D'],active:true,featured:true},
  {id:'premium',name:'Premium',price:null,priceLabel:'Projeto personalizado',description:'Para quem quer uma experiência completa.',features:['Planejamento completo','Produção do evento','Gestão de fornecedores','Cerimonial completo','Equipe operacional','Coordenação integral'],active:true,featured:false}
];
function db(){
  fs.mkdirSync(path.dirname(DATA),{recursive:true});
  const defaults={users:[],events:[],quotes:[],payments:[],staff:[],availability:[],payouts:[],reviews:[],servicePrices:[],plans:JSON.parse(JSON.stringify(DEFAULT_PLANS))};
  if(!fs.existsSync(DATA))fs.writeFileSync(DATA,JSON.stringify(defaults,null,2));
  const loaded=JSON.parse(fs.readFileSync(DATA,'utf8'));
  const merged={...defaults,...loaded};
  for(const key of ['users','events','quotes','payments','staff','availability','payouts','reviews'])if(!Array.isArray(merged[key]))merged[key]=[];
  if(!Array.isArray(merged.servicePrices))merged.servicePrices=[];
  if(!Array.isArray(merged.plans)||!merged.plans.length)merged.plans=JSON.parse(JSON.stringify(DEFAULT_PLANS));
  fs.writeFileSync(DATA,JSON.stringify(merged,null,2));
  return merged;
}
let D=db();
const save=()=>fs.writeFileSync(DATA,JSON.stringify(D,null,2));
const id=a=>a.reduce((m,x)=>Math.max(m,x.id||0),0)+1;
const pub=u=>{const summary=reviewSummary(u.id);return {id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role,city:u.city,state:u.state,bio:u.bio,serviceIds:Array.isArray(u.serviceIds)?u.serviceIds:[],status:u.status,rating:summary.rating??u.rating??5,review_count:summary.reviewCount,total_jobs:u.total_jobs||0,priorityUntil:u.priorityUntil||null}};
function servicePriceDefinitions(){
  return services.flatMap(service=>{
    const unit=service.id===10?'por convidado':quantitylessServiceIds.has(service.id)?'por evento':'por profissional/unidade';
    const rows=[{serviceId:service.id,optionId:null,label:service.name,unit,kind:'service'}];
    for(const [optionId,label,group] of SERVICE_PRICE_OPTIONS[service.id]||[])rows.push({serviceId:service.id,optionId,label,unit,kind:group==='menu'?'menu':'option'});
    return rows;
  });
}
function servicePrice(serviceId,optionId=null){
  return D.servicePrices.find(item=>Number(item.service_id)===Number(serviceId)&&(item.option_id||null)===(optionId||null))?.unit_price??null;
}
function estimateServicePrices(serviceQuantities){
  const lines=[],unpriced=[];
  let total=0;
  for(const item of serviceQuantities){
    const serviceId=Number(item.service_id);
    const service=services.find(entry=>entry.id===serviceId);
    if(!service)continue;
    const quantity=serviceId===10?Number(item.quantity)||1:quantitylessServiceIds.has(serviceId)?1:Number(item.quantity)||1;
    const options=(SERVICE_PRICE_OPTIONS[serviceId]||[]).filter(([optionId])=>(item.options||[]).includes(optionId));
    const base=servicePrice(serviceId);
    const menuOptions=options.filter(([, ,group])=>group==='menu');
    let chargeBase=base!==null;
    if(serviceId===10&&menuOptions.length){
      const [optionId,label]=menuOptions[0];
      const menuPrice=servicePrice(serviceId,optionId);
      if(menuPrice!==null){
        lines.push({service_id:serviceId,option_id:optionId,description:label,quantity,unit_price:menuPrice,total:Math.round(menuPrice*quantity*100)/100});
        total+=menuPrice*quantity;
        chargeBase=false;
      }else if(base===null){
        unpriced.push({service_id:serviceId,option_id:optionId,description:label});
        chargeBase=false;
      }
    }
    if(chargeBase){
      lines.push({service_id:serviceId,option_id:null,description:service.name,quantity,unit_price:base,total:Math.round(base*quantity*100)/100});
      total+=base*quantity;
    }else if(base===null&&!(serviceId===10&&menuOptions.length)){
      unpriced.push({service_id:serviceId,option_id:null,description:service.name});
    }
    for(const [optionId,label,group] of options){
      if(serviceId===10&&group==='menu')continue;
      const price=servicePrice(serviceId,optionId);
      if(price===null){unpriced.push({service_id:serviceId,option_id:optionId,description:label});continue}
      lines.push({service_id:serviceId,option_id:optionId,description:`${service.name} · ${label}`,quantity,unit_price:price,total:Math.round(price*quantity*100)/100});
      total+=price*quantity;
    }
  }
  return {lines,unpriced,total:Math.round(total*100)/100};
}
function reviewSummary(professionalId){
  const reviews=D.reviews.filter(review=>review.professional_id===professionalId);
  return {rating:reviews.length?Math.round(reviews.reduce((sum,review)=>sum+review.rating,0)/reviews.length*100)/100:null,reviewCount:reviews.length};
}
function resolveRequestedProfessionals(raw,serviceQuantities,eventDate,excludeEventId=null){
  if(raw===undefined)return [];
  if(!Array.isArray(raw)||raw.length>500)throw new Error('A seleção de profissionais é inválida.');
  const result=[],seen=new Set();
  for(const choice of raw){
    const professionalId=Number(choice.professionalId??choice.professional_id);
    const serviceId=Number(choice.serviceId??choice.service_id);
    const key=`${professionalId}:${serviceId}`;
    if(seen.has(key))throw new Error('Não repita o profissional no mesmo serviço.');
    seen.add(key);
    const professional=D.users.find(user=>user.id===professionalId&&user.role==='professional'&&user.status==='active');
    const requested=serviceQuantities.find(item=>item.service_id===serviceId);
    const service=services.find(item=>item.id===serviceId);
    if(!professional||!requested||!service||!Array.isArray(professional.serviceIds)||!professional.serviceIds.map(Number).includes(serviceId))throw new Error('Um dos profissionais selecionados não está habilitado para o serviço.');
    const markedUnavailable=D.availability.some(item=>item.professional_id===professional.id&&item.date===eventDate&&item.status==='indisponivel');
    const hasScheduleConflict=D.staff.some(staff=>{
      if(staff.professional_id!==professional.id||!['convidado','confirmado'].includes(staff.status))return false;
      const event=D.events.find(item=>item.id===staff.event_id);
      return event?.event_date===eventDate&&event.id!==excludeEventId&&!['cancelado','finalizado'].includes(event.status);
    });
    if(markedUnavailable||hasScheduleConflict)throw new Error(`${professional.name} não está disponível na data escolhida.`);
    const buffet=service.name==='Buffet';
    const maxSelected=buffet?1:requested.quantity;
    if(result.filter(item=>item.service_id===serviceId).length>=maxSelected)throw new Error(`Selecione no máximo ${maxSelected} profissional(is) para ${service.name}.`);
    result.push({professional_id:professional.id,professional_name:professional.name,service_id:serviceId,service_name:service.name,unit_price:0,service_description:'',quantity:1,total:0});
  }
  return result;
}
async function infinitePayRequest(url,payload){
  let response;
  try{
    response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
  }catch(error){
    throw new Error('Não foi possível conectar à InfinitePay. Tente novamente.');
  }
  let result;
  try{result=await response.json()}catch(error){throw new Error('A InfinitePay retornou uma resposta inválida.')}
  if(!response.ok)throw new Error(result.message||result.error||'A InfinitePay não aceitou a solicitação.');
  return result;
}
function publicBaseUrl(){
  const configured=String(process.env.PUBLIC_BASE_URL||`http://localhost:${PORT}`).trim().replace(/\/+$/,'');
  let parsed;
  try{parsed=new URL(configured)}catch(error){throw new Error('Configure uma PUBLIC_BASE_URL válida para o checkout.')}
  if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error('A PUBLIC_BASE_URL configurada é inválida.');
  if(process.env.NODE_ENV==='production'&&parsed.protocol!=='https:')throw new Error('Em produção, PUBLIC_BASE_URL deve usar HTTPS.');
  return parsed.toString().replace(/\/+$/,'');
}
function isCheckoutLinkFresh(payment){
  const createdAt=Date.parse(payment.created_at||'');
  const age=Date.now()-createdAt;
  return Number.isFinite(createdAt)&&age>=0&&age<CHECKOUT_LINK_TTL_MS;
}
async function verifyInfinitePayPayment(payment,details){
  const result=await infinitePayRequest(INFINITEPAY_CHECK_URL,{
    handle:process.env.INFINITEPAY_HANDLE,
    order_nsu:payment.order_nsu,
    transaction_nsu:details.transaction_nsu,
    slug:details.slug
  });
  if(result.success!==true||result.paid!==true)return false;
  if(Number(result.amount)!==payment.amount)throw new Error('O valor confirmado pela InfinitePay não corresponde ao orçamento.');
  if(payment.type==='priority'){
    const professional=D.users.find(user=>user.id===payment.professional_id&&user.role==='professional');
    if(!professional)throw new Error('O profissional associado ao pagamento não foi encontrado.');
    const now=Date.now();
    const currentExpiry=Date.parse(professional.priorityUntil||'');
    const baseTime=Number.isFinite(currentExpiry)&&currentExpiry>now?currentExpiry:now;
    payment.status='paid';
    payment.invoice_slug=details.slug;
    payment.transaction_nsu=details.transaction_nsu;
    payment.capture_method=String(details.capture_method||result.capture_method||'');
    payment.receipt_url=String(details.receipt_url||'');
    payment.paid_at=new Date(now).toISOString();
    professional.priorityUntil=new Date(baseTime+30*24*60*60*1000).toISOString();
    save();
    return true;
  }
  const quote=D.quotes.find(item=>item.id===payment.quote_id);
  const event=D.events.find(item=>item.id===payment.event_id);
  if(!quote||!event)throw new Error('O orçamento associado ao pagamento não foi encontrado.');
  if(quote.status!=='aguardando_pagamento'||event.status!=='aguardando_pagamento')throw new Error('O orçamento não está mais aguardando pagamento.');
  payment.status='paid';
  payment.invoice_slug=details.slug;
  payment.transaction_nsu=details.transaction_nsu;
  payment.capture_method=String(details.capture_method||result.capture_method||'');
  payment.receipt_url=String(details.receipt_url||'');
  payment.paid_at=new Date().toISOString();
  quote.status='aceito';
  event.status='aprovado';
  save();
  return true;
}
function normalizePlans(value){
  if(!Array.isArray(value)||value.length<1||value.length>12)throw new Error('Mantenha entre 1 e 12 planos.');
  const result=value.map((p,i)=>{
    const name=String(p.name||'').trim().slice(0,80);
    if(!name)throw new Error(`Informe o nome do plano ${i+1}.`);
    const rawPrice=p.price;
    const price=rawPrice===null||rawPrice===''||typeof rawPrice==='undefined'?null:Number(rawPrice);
    if(price!==null&&(!Number.isFinite(price)||price<0||price>100000000))throw new Error(`O preço do plano ${name} é inválido.`);
    const idSource=String(p.id||name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70)||`plano-${i+1}`;
    const features=(Array.isArray(p.features)?p.features:String(p.features||'').split(/\r?\n/)).map(x=>String(x).trim().slice(0,140)).filter(Boolean).slice(0,30);
    return {id:idSource,name,price,priceLabel:String(p.priceLabel||'').trim().slice(0,40)||(price===null?'Consultar':'A partir de'),description:String(p.description||'').trim().slice(0,500),features,active:p.active!==false,featured:Boolean(p.featured)};
  });
  const ids=result.map(p=>p.id);
  if(new Set(ids).size!==ids.length)throw new Error('Cada plano precisa ter um identificador diferente. Remova ou renomeie planos duplicados.');
  return result;
}
function auth(req,res,next){const t=(req.headers.authorization||'').replace(/^Bearer\s+/i,'');const uid=sessions.get(t);req.user=D.users.find(u=>u.id===uid);if(!req.user)return res.status(401).json({error:'Não autenticado.'});next()}function role(r){return(req,res,next)=>req.user.role===r?next():res.status(403).json({error:'Acesso não permitido.'})}
function hash(p,s=crypto.randomBytes(16).toString('hex')){return new Promise((ok,no)=>crypto.scrypt(p,s,64,(e,k)=>e?no(e):ok({salt:s,hash:k.toString('hex')})))}async function verify(p,u){const h=await hash(p,u.passwordSalt);return crypto.timingSafeEqual(Buffer.from(h.hash,'hex'),Buffer.from(u.passwordHash,'hex'))}
const privatePages=new Set(['admin.html','cliente.html','profissional.html']);
app.use(express.json({limit:'1mb'}));app.use('/api',(req,res,next)=>{res.setHeader('Cache-Control','no-store');next()});app.use(express.static(FRONT,{index:false,setHeaders:(res,filePath)=>{if(privatePages.has(path.basename(filePath))){res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, private');res.setHeader('Pragma','no-cache');res.setHeader('Expires','0')}}}));app.get('/',(q,s)=>s.sendFile(path.join(FRONT,'inicio.html')));app.get('/api/services',(q,s)=>s.json(services));app.get('/api/service-prices',(q,s)=>s.json(servicePriceDefinitions().map(definition=>({...definition,unitPrice:servicePrice(definition.serviceId,definition.optionId)}))));app.get('/api/admin/service-prices',auth,role('admin'),(q,s)=>s.json(servicePriceDefinitions().map(definition=>({...definition,unitPrice:servicePrice(definition.serviceId,definition.optionId)}))));app.put('/api/admin/service-prices',auth,role('admin'),(req,res)=>{try{const definitions=servicePriceDefinitions();if(!Array.isArray(req.body.prices)||req.body.prices.length!==definitions.length)throw new Error('A lista de preços está incompleta. Atualize a página e tente novamente.');const seen=new Set();const prices=req.body.prices.map(item=>{const serviceId=Number(item.serviceId),optionId=item.optionId?String(item.optionId):null,key=`${serviceId}:${optionId||''}`;if(seen.has(key)||!definitions.some(definition=>definition.serviceId===serviceId&&(definition.optionId||null)===optionId))throw new Error('Um dos serviços ou opções de preço é inválido.');seen.add(key);const unitPrice=item.unitPrice===null||item.unitPrice===''?null:Number(item.unitPrice);if(unitPrice!==null&&(!Number.isFinite(unitPrice)||unitPrice<0.01||unitPrice>100000000))throw new Error('Informe preços entre R$ 0,01 e R$ 100.000.000,00.');return {service_id:serviceId,option_id:optionId,unit_price:unitPrice}});D.servicePrices=prices;save();res.json({message:'Preços dos serviços salvos.',prices:servicePriceDefinitions().map(definition=>({...definition,unitPrice:servicePrice(definition.serviceId,definition.optionId)}))})}catch(error){res.status(400).json({error:error.message||'Não foi possível salvar os preços dos serviços.'})}});app.get('/api/plans',(q,s)=>s.json(D.plans.filter(p=>p.active)));app.get('/api/admin/plans',auth,role('admin'),(q,s)=>s.json(D.plans));app.put('/api/admin/plans',auth,role('admin'),(q,s)=>{try{D.plans=normalizePlans(q.body.plans);save();s.json({message:'Planos atualizados.',plans:D.plans})}catch(e){s.status(400).json({error:e.message||'Não foi possível salvar os planos.'})}});
app.post('/api/auth/login',async(req,res)=>{const u=D.users.find(x=>x.email===String(req.body.email||'').trim().toLowerCase());if(!u||!(await verify(req.body.password||'',u)))return res.status(401).json({error:'E-mail ou senha inválidos.'});if(u.role==='professional'&&u.status!=='active')return res.status(403).json({error:'Seu cadastro ainda não foi aprovado.'});const t=crypto.randomBytes(32).toString('hex');sessions.set(t,u.id);res.json({token:t,user:pub(u)})});
app.get('/auth/google/start',(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const accountRole=req.query.role==='client'?'client':'professional';
  const loginPage=accountRole==='client'?'/cliente-login.html':'/profissional-login.html';
  const clientId=String(process.env.GOOGLE_CLIENT_ID||'').trim();
  const clientSecret=String(process.env.GOOGLE_CLIENT_SECRET||'').trim();
  const redirectUri=String(process.env.GOOGLE_REDIRECT_URI||'').trim();
  if(!clientId||!clientSecret||!redirectUri)return res.redirect(`${loginPage}?googleError=not_configured`);
  const now=Date.now();
  for(const [key,value] of googleOAuthStates)if(value.expiresAt<=now)googleOAuthStates.delete(key);
  const state=crypto.randomBytes(32).toString('hex');
  const requestedReturnTo=String(req.query.returnTo||'');
  const returnParams=requestedReturnTo.startsWith('/pagamento-retorno.html?')?new URLSearchParams(requestedReturnTo.split('?')[1]):null;
  const paymentType=returnParams?.get('payment_type');
  const returnTo=(accountRole==='professional'&&paymentType==='priority'||accountRole==='client'&&paymentType!=='priority')?requestedReturnTo:null;
  googleOAuthStates.set(state,{expiresAt:now+10*60*1000,redirectUri,returnTo,role:accountRole});
  const authorization=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'openid email profile',state,prompt:'select_account'}).toString();
  res.redirect(authorization.toString());
});
app.get('/auth/google/callback',async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  const state=String(req.query.state||'');
  const oauthState=googleOAuthStates.get(state);
  googleOAuthStates.delete(state);
  const loginPage=oauthState?.role==='client'?'/cliente-login.html':'/profissional-login.html';
  if(!oauthState||oauthState.expiresAt<=Date.now())return res.redirect(`${loginPage}?googleError=failed`);
  if(req.query.error)return res.redirect(`${loginPage}?googleError=denied`);
  const code=String(req.query.code||'');
  if(!code)return res.redirect(`${loginPage}?googleError=failed`);
  try{
    const tokenResponse=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:String(process.env.GOOGLE_CLIENT_ID||'').trim(),client_secret:String(process.env.GOOGLE_CLIENT_SECRET||'').trim(),redirect_uri:oauthState.redirectUri,grant_type:'authorization_code'})});
    if(!tokenResponse.ok){console.error(`Google OAuth token exchange failed with status ${tokenResponse.status}.`);return res.redirect(`${loginPage}?googleError=failed`)}
    const tokenData=await tokenResponse.json();
    if(!tokenData.access_token){console.error('Google OAuth token exchange did not return an access token.');return res.redirect(`${loginPage}?googleError=failed`)}
    const profileResponse=await fetch('https://openidconnect.googleapis.com/v1/userinfo',{headers:{Authorization:`Bearer ${tokenData.access_token}`}});
    if(!profileResponse.ok){console.error(`Google OAuth profile request failed with status ${profileResponse.status}.`);return res.redirect(`${loginPage}?googleError=failed`)}
    const profile=await profileResponse.json();
    const email=String(profile.email||'').trim().toLowerCase();
    if(profile.email_verified!==true||!email)return res.redirect(`${loginPage}?googleError=failed`);
    const user=D.users.find(entry=>entry.email===email&&entry.role===oauthState.role);
    if(!user)return res.redirect(`${loginPage}?googleError=no_account`);
    if(user.status!=='active')return res.redirect(`${loginPage}?googleError=pending`);
    const now=Date.now();
    for(const [key,value] of googleLoginTickets)if(value.expiresAt<=now)googleLoginTickets.delete(key);
    const ticket=crypto.randomBytes(32).toString('hex');
    googleLoginTickets.set(ticket,{userId:user.id,role:oauthState.role,expiresAt:now+60*1000});
    const returnQuery=oauthState.returnTo?`?returnTo=${encodeURIComponent(oauthState.returnTo)}`:'';
    res.redirect(`${loginPage}${returnQuery}#googleTicket=${ticket}`);
  }catch(error){
    console.error('Google OAuth callback failed:',error.message);
    res.redirect(`${loginPage}?googleError=failed`);
  }
});
app.post('/api/auth/google/exchange',(req,res)=>{
  const ticket=String(req.body.ticket||'');
  const login=googleLoginTickets.get(ticket);
  googleLoginTickets.delete(ticket);
  if(!login||login.expiresAt<=Date.now())return res.status(401).json({error:'A autenticação do Google expirou. Tente novamente.'});
  const user=D.users.find(entry=>entry.id===login.userId&&entry.role===login.role);
  if(!user||user.status!=='active')return res.status(403).json({error:'Sua conta não está ativa.'});
  const token=crypto.randomBytes(32).toString('hex');
  sessions.set(token,user.id);
  res.json({token,user:pub(user)});
});
app.post('/api/auth/register/client',async(req,res)=>{const b=req.body;if(!b.name||!b.email||!b.password||!b.city||!b.state)return res.status(400).json({error:'Preencha os campos obrigatórios.'});if(D.users.some(u=>u.email===b.email.trim().toLowerCase()))return res.status(409).json({error:'Este e-mail já está cadastrado.'});const p=await hash(b.password);const u={id:id(D.users),name:b.name.trim(),email:b.email.trim().toLowerCase(),phone:(b.phone||'').trim(),passwordHash:p.hash,passwordSalt:p.salt,role:'client',city:b.city.trim(),state:b.state.trim().toUpperCase(),bio:'',status:'active',rating:5,total_jobs:0};D.users.push(u);save();const t=crypto.randomBytes(32).toString('hex');sessions.set(t,u.id);res.status(201).json({token:t,user:pub(u)})});
app.post('/api/auth/register/professional',async(req,res)=>{const b=req.body;if(!b.name||!b.email||!b.password||!b.city||!b.state)return res.status(400).json({error:'Preencha os campos obrigatórios.'});if(D.users.some(u=>u.email===b.email.trim().toLowerCase()))return res.status(409).json({error:'Este e-mail já está cadastrado.'});const p=await hash(b.password);D.users.push({id:id(D.users),name:b.name.trim(),email:b.email.trim().toLowerCase(),phone:(b.phone||'').trim(),passwordHash:p.hash,passwordSalt:p.salt,role:'professional',city:b.city.trim(),state:b.state.trim().toUpperCase(),bio:(b.bio||'').trim(),serviceIds:b.serviceIds||[],status:'pending',rating:5,total_jobs:0});save();res.status(201).json({message:'Cadastro enviado. Aguarde a aprovação.'})});
app.get('/api/events/mine',auth,role('client'),(req,res)=>res.json(D.events.filter(e=>e.client_id===req.user.id).map(event=>({...event,staff:D.staff.filter(item=>item.event_id===event.id&&item.status==='confirmado').map(item=>({...item,professional_name:D.users.find(user=>user.id===item.professional_id)?.name||'-',service_name:services.find(service=>service.id===item.service_id)?.name||item.role})),my_reviews:D.reviews.filter(review=>review.event_id===event.id&&review.client_id===req.user.id)})).sort((a,b)=>String(a.event_date).localeCompare(String(b.event_date)))));
app.get('/api/events',auth,role('admin'),(req,res)=>{let a=D.events.map(e=>({...e,client_name:D.users.find(u=>u.id===e.client_id)?.name||'-',staff:D.staff.filter(s=>s.event_id===e.id).map(s=>({...s,professional_name:D.users.find(u=>u.id===s.professional_id)?.name||'-',service_name:services.find(x=>x.id===s.service_id)?.name||s.role}))}));if(req.query.status)a=a.filter(e=>e.status===req.query.status);res.json(a.sort((x,y)=>String(x.event_date).localeCompare(String(y.event_date))))});
app.get('/api/events/:id',auth,(req,res)=>{const e=D.events.find(x=>x.id===+req.params.id);if(!e)return res.status(404).json({error:'Evento não encontrado.'});if(req.user.role==='client'&&e.client_id!==req.user.id)return res.status(403).json({error:'Acesso negado.'});const staff=D.staff.filter(s=>s.event_id===e.id).map(s=>({...s,professional_name:D.users.find(u=>u.id===s.professional_id)?.name||'-',service_name:services.find(x=>x.id===s.service_id)?.name||s.role}));res.json({...e,staff})});
function normalizeEventPayload(b,excludeEventId=null){
  const eventType=String(b.eventType||'').trim().slice(0,80);
  const eventDate=String(b.eventDate||'').trim();
  const guestCount=Number(b.guestCount);
  const city=String(b.city||'').trim().slice(0,100);
  if(!eventType||!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)||!Number.isFinite(Date.parse(eventDate))||!Number.isInteger(guestCount)||guestCount<1||guestCount>100000||!city)throw new Error('Informe o tipo, a data, a quantidade de convidados e a cidade corretamente.');
  let raw=Array.isArray(b.serviceQuantities)?b.serviceQuantities:[];
  if(!raw.length&&Array.isArray(b.serviceIds))raw=b.serviceIds.map(serviceId=>({serviceId,quantity:1}));
  if(!raw.length)throw new Error('Selecione pelo menos um serviço.');
  if(raw.length>services.length)throw new Error('A quantidade de tipos de serviço selecionados é inválida.');
  const seen=new Set();
  const serviceQuantities=raw.map(item=>{
    const serviceId=Number(item.serviceId??item.service_id);
    const service=services.find(s=>s.id===serviceId);
    if(!service)throw new Error('Um dos serviços selecionados não existe.');
    if(seen.has(serviceId))throw new Error('Não repita o mesmo serviço.');
    seen.add(serviceId);
    const quantity=Number(item.quantity??(quantitylessServiceIds.has(serviceId)?1:NaN));
    const maximum=service.name==='Buffet'?100000:500;
    if(!Number.isInteger(quantity)||quantity<1||quantity>maximum)throw new Error(`A quantidade de ${service.name} deve estar entre 1 e ${maximum}.`);
    const options=Array.isArray(item.options)?[...new Set(item.options.map(option=>String(option).trim()).filter(Boolean))].slice(0,20):[];
    const allowedOptions=SERVICE_PRICE_OPTIONS[serviceId]||[];
    if(options.some(option=>!allowedOptions.some(([optionId])=>optionId===option)))throw new Error(`Uma das opções de ${service.name} é inválida.`);
    const optionGroups=options.map(option=>allowedOptions.find(([optionId])=>optionId===option)?.[2]).filter(Boolean);
    if(new Set(optionGroups).size!==optionGroups.length)throw new Error(`Selecione apenas uma opção de cada grupo em ${service.name}.`);
    return {service_id:serviceId,service_name:service.name,quantity,unit:serviceId===10?'convidados':quantitylessServiceIds.has(serviceId)?'evento':'profissionais/unidades',options};
  });
  const rawStyle=b.eventStyle&&typeof b.eventStyle==='object'?b.eventStyle:{};
  const palette=Array.isArray(rawStyle.palette)?[...new Set(rawStyle.palette.map(x=>String(x).trim().slice(0,40)).filter(Boolean))].slice(0,10):[];
  const requestedProfessionals=resolveRequestedProfessionals(b.selectedProfessionals,serviceQuantities,eventDate,excludeEventId);
  const estimate=estimateServicePrices(serviceQuantities);
  return {event_type:eventType,event_date:eventDate,start_time:b.startTime?String(b.startTime).slice(0,5):null,guest_count:guestCount,city,address:String(b.address||'').trim().slice(0,180),notes:String(b.notes||'').trim().slice(0,2000),service_ids:serviceQuantities.map(x=>x.service_id),service_quantities:serviceQuantities,requested_professionals:requestedProfessionals,estimate_items:estimate.lines,unpriced_items:estimate.unpriced,estimated_total:estimate.total,event_style:{formality:String(rawStyle.formality||'').trim().slice(0,40),decorationStyle:String(rawStyle.decorationStyle||'').trim().slice(0,60),palette,paletteNotes:String(rawStyle.paletteNotes||'').trim().slice(0,300)}};
}
app.post('/api/events',auth,role('client'),(req,res)=>{try{const values=normalizeEventPayload(req.body);const e={id:id(D.events),client_id:req.user.id,...values,status:'solicitado',created_at:new Date().toISOString()};D.events.push(e);save();res.status(201).json(e)}catch(e){res.status(400).json({error:e.message||'Não foi possível criar a solicitação.'})}});
app.patch('/api/events/:id',auth,role('client'),(req,res)=>{const e=D.events.find(x=>x.id===Number(req.params.id)&&x.client_id===req.user.id);if(!e)return res.status(404).json({error:'Evento não encontrado.'});const locked=['aprovado','equipe_sendo_montada','equipe_confirmada','em_andamento','finalizado','cancelado'];if(locked.includes(e.status))return res.status(403).json({error:'Este evento não pode mais ser editado porque já foi aprovado ou encerrado.'});try{const values=normalizeEventPayload(req.body,e.id);if(['orcamento_enviado','aguardando_cliente'].includes(e.status)){D.quotes.filter(q=>q.event_id===e.id&&q.status==='enviado').forEach(q=>q.status='alteracao_solicitada');e.status='em_analise'}Object.assign(e,values,{updated_at:new Date().toISOString()});save();res.json(e)}catch(error){res.status(400).json({error:error.message||'Não foi possível atualizar o evento.'})}});
app.post('/api/events/:id/reviews',auth,role('client'),(req,res)=>{
  const event=D.events.find(item=>item.id===Number(req.params.id)&&item.client_id===req.user.id);
  if(!event)return res.status(404).json({error:'Evento não encontrado.'});
  if(event.status!=='finalizado')return res.status(409).json({error:'Você poderá avaliar a equipe depois que o evento for finalizado.'});
  const professionalId=Number(req.body.professionalId);
  const professional=D.users.find(user=>user.id===professionalId&&user.role==='professional');
  const participated=D.staff.some(item=>item.event_id===event.id&&item.professional_id===professionalId&&item.status==='confirmado');
  if(!professional||!participated)return res.status(400).json({error:'Só é possível avaliar profissionais confirmados neste evento.'});
  if(D.reviews.some(review=>review.event_id===event.id&&review.client_id===req.user.id&&review.professional_id===professionalId))return res.status(409).json({error:'Você já avaliou este profissional neste evento.'});
  const rating=Number(req.body.rating);
  const comment=String(req.body.comment||'').trim();
  if(!Number.isInteger(rating)||rating<1||rating>5||comment.length>1000)return res.status(400).json({error:'Informe uma nota de 1 a 5 e um comentário de até 1.000 caracteres.'});
  const review={id:id(D.reviews),event_id:event.id,client_id:req.user.id,professional_id:professionalId,rating,comment,created_at:new Date().toISOString()};
  D.reviews.push(review);
  const summary=reviewSummary(professionalId);
  professional.rating=summary.rating;
  professional.rating=summary.rating;
  professional.review_count=summary.reviewCount;
  save();
  res.status(201).json(review);
});
app.patch('/api/events/:id/cancel',auth,role('client'),(req,res)=>{const e=D.events.find(x=>x.id===Number(req.params.id)&&x.client_id===req.user.id);if(!e)return res.status(404).json({error:'Evento não encontrado.'});if(!['solicitado','em_analise','orcamento_enviado','aguardando_cliente'].includes(e.status))return res.status(409).json({error:'Este evento não pode ser cancelado nesta etapa. Entre em contato com a equipe.'});e.status='cancelado';D.quotes.filter(q=>q.event_id===e.id&&q.status==='enviado').forEach(q=>q.status='cancelado');D.staff.filter(s=>s.event_id===e.id&&['convidado','confirmado'].includes(s.status)).forEach(s=>s.status='cancelado');save();res.json({message:'Evento cancelado.',event:e})});
app.patch('/api/events/:id/status',auth,role('admin'),(req,res)=>{const e=D.events.find(x=>x.id===+req.params.id);if(!e)return res.status(404).json({error:'Evento não encontrado.'});if(e.status==='aguardando_pagamento')return res.status(409).json({error:'O status deste evento só pode avançar depois da confirmação do pagamento.'});e.status=req.body.status;save();res.json(e)});
app.get('/api/quotes',auth,role('admin'),(req,res)=>res.json(D.quotes.map(q=>{const e=D.events.find(x=>x.id===q.event_id),u=D.users.find(x=>x.id===e?.client_id);return {...q,event_type:e?.event_type||'-',client_name:u?.name||'-'}})));
app.get('/api/quotes/event/:id',auth,role('client'),(req,res)=>{const e=D.events.find(x=>x.id===+req.params.id&&x.client_id===req.user.id);if(!e)return res.status(404).json({error:'Evento não encontrado.'});res.json(D.quotes.filter(q=>q.event_id===e.id))});
app.post('/api/quotes',auth,role('admin'),(req,res)=>{
  const eventId=Number(req.body.eventId);
  const event=D.events.find(item=>item.id===eventId);
  if(!event)return res.status(404).json({error:'Evento não encontrado.'});
  const legacyApprovedEvent=event.status==='aprovado'&&!D.quotes.some(quote=>quote.event_id===event.id)&&!D.payments.some(payment=>payment.event_id===event.id);
  if(!['solicitado','em_analise','aguardando_cliente'].includes(event.status)&&!legacyApprovedEvent)return res.status(409).json({error:'Este evento não está disponível para receber um novo orçamento.'});
  const existing=D.quotes.some(quote=>quote.event_id===event.id&&['enviado','aguardando_pagamento'].includes(quote.status));
  if(existing)return res.status(409).json({error:'Este evento já possui um orçamento aguardando resposta ou pagamento.'});
  if(!Array.isArray(req.body.items)||req.body.items.length<1||req.body.items.length>50)return res.status(400).json({error:'Adicione entre 1 e 50 itens ao orçamento.'});
  let subtotal=0;
  const items=[];
  for(const item of req.body.items){
    const description=String(item.description||'').trim().slice(0,200);
    const quantity=Number(item.quantity);
    const unitPrice=Number(item.unitPrice);
    if(!description||!Number.isSafeInteger(quantity)||quantity<1||quantity>100000||!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>100000000)return res.status(400).json({error:'Revise a descrição, quantidade e valor unitário de cada item.'});
    const total=quantity*unitPrice;
    if(!Number.isFinite(total)||!Number.isSafeInteger(Math.round(total*100)))return res.status(400).json({error:'O valor de um item excede o limite permitido.'});
    subtotal+=total;
    if(!Number.isFinite(subtotal)||!Number.isSafeInteger(Math.round(subtotal*100)))return res.status(400).json({error:'O subtotal do orçamento excede o limite permitido.'});
    items.push({description,quantity,unitPrice,total});
  }
  const discount=Number(req.body.discount||0);
  if(!Number.isFinite(discount)||discount<0||discount>subtotal)return res.status(400).json({error:'O desconto deve ser válido e não pode superar o subtotal.'});
  const total=Math.round((subtotal-discount)*100)/100;
  if(total<=0)return res.status(400).json({error:'O total do orçamento deve ser maior que zero.'});
  const quote={id:id(D.quotes),event_id:event.id,discount,items,total,status:'enviado',created_at:new Date().toISOString()};
  D.quotes.push(quote);
  event.status='orcamento_enviado';
  save();
  res.status(201).json(quote);
});
app.patch('/api/quotes/:id/decision',auth,role('client'),(req,res)=>{const q=D.quotes.find(x=>x.id===+req.params.id),e=q&&D.events.find(x=>x.id===q.event_id);if(!q||!e||e.client_id!==req.user.id)return res.status(404).json({error:'Orçamento não encontrado.'});if(q.status!=='enviado')return res.status(409).json({error:'Este orçamento já foi respondido.'});const decision=String(req.body.decision||'');if(decision==='aceito')return res.status(409).json({error:'O aceite do orçamento exige a conclusão do pagamento pela InfinitePay.'});if(!['recusado','alteracao_solicitada'].includes(decision))return res.status(400).json({error:'Decisão de orçamento inválida.'});if(decision==='alteracao_solicitada'&&!String(req.body.note||'').trim())return res.status(400).json({error:'Descreva a alteração desejada.'});q.status=decision;if(decision==='alteracao_solicitada')q.client_note=String(req.body.note||'').trim().slice(0,1000);else q.client_note='';e.status=decision==='recusado'?'cancelado':'aguardando_cliente';save();res.json(q)});
app.post('/api/quotes/:id/payment',auth,role('client'),async(req,res)=>{
  const quote=D.quotes.find(item=>item.id===Number(req.params.id));
  const event=quote&&D.events.find(item=>item.id===quote.event_id);
  if(!quote||!event||event.client_id!==req.user.id)return res.status(404).json({error:'Orçamento não encontrado.'});
  if(!['enviado','aguardando_pagamento'].includes(quote.status))return res.status(409).json({error:'Este orçamento não está disponível para pagamento.'});
  const existing=D.payments.find(payment=>payment.quote_id===quote.id&&payment.status==='pending'&&payment.checkout_url);
  if(existing&&isCheckoutLinkFresh(existing))return res.json({checkoutUrl:existing.checkout_url,paymentId:existing.id});
  if(existing){existing.checkout_url='';save()}
  const handle=String(process.env.INFINITEPAY_HANDLE||'').trim().replace(/^\$/,'');
  if(!handle)return res.status(503).json({error:'Configure a InfiniteTag em INFINITEPAY_HANDLE para habilitar os pagamentos.'});
  const amount=Math.round(Number(quote.total)*100);
  if(!Number.isSafeInteger(amount)||amount<=0)return res.status(400).json({error:'O valor total do orçamento não é válido para pagamento.'});
  const paymentId=crypto.randomUUID();
  const orderNsu=`imp-${paymentId}`;
  let redirectUrl;
  try{
    redirectUrl=new URL('/pagamento-retorno.html',`${publicBaseUrl()}/`);
  }catch(error){return res.status(503).json({error:error.message||'Configure a URL pública do sistema.'})}
  redirectUrl.searchParams.set('payment_id',paymentId);
  const payload={
    handle,
    redirect_url:redirectUrl.toString(),
    order_nsu:orderNsu,
    items:[{quantity:1,price:amount,description:`Orçamento #${quote.id} - ${event.event_type}`.slice(0,200)}],
    customer:{name:req.user.name,email:req.user.email}
  };
  if(process.env.INFINITEPAY_WEBHOOK_URL)payload.webhook_url=process.env.INFINITEPAY_WEBHOOK_URL;
  if(paymentCreationLocks.has(quote.id))return res.status(409).json({error:'O checkout deste orçamento já está sendo preparado. Tente novamente em instantes.'});
  paymentCreationLocks.add(quote.id);
  let result;
  try{result=await infinitePayRequest(INFINITEPAY_LINKS_URL,payload)}catch(error){return res.status(502).json({error:error.message||'Não foi possível criar o checkout InfinitePay.'})}finally{paymentCreationLocks.delete(quote.id)}
  let checkoutUrl;
  try{checkoutUrl=new URL(result.checkout_url||result.url)}catch(error){return res.status(502).json({error:'A InfinitePay retornou um link de pagamento inválido.'})}
  if(checkoutUrl.protocol!=='https:'||!/(^|\.)infinitepay\.(com\.br|io)$/i.test(checkoutUrl.hostname))return res.status(502).json({error:'A InfinitePay retornou um endereço de checkout não confiável.'});
  const payment={id:paymentId,quote_id:quote.id,event_id:event.id,client_id:req.user.id,amount,order_nsu:orderNsu,status:'pending',checkout_url:checkoutUrl.toString(),created_at:new Date().toISOString()};
  D.payments.push(payment);
  quote.status='aguardando_pagamento';
  event.status='aguardando_pagamento';
  save();
  res.status(201).json({checkoutUrl:payment.checkout_url,paymentId:payment.id});
});
app.post('/api/payments/:id/verify',auth,role('client'),async(req,res)=>{
  const payment=D.payments.find(item=>item.id===req.params.id&&item.client_id===req.user.id);
  if(!payment)return res.status(404).json({error:'Pagamento não encontrado.'});
  if(payment.status==='paid')return res.json({status:'paid'});
  const details={order_nsu:String(req.body.order_nsu||''),slug:String(req.body.slug||''),transaction_nsu:String(req.body.transaction_nsu||''),capture_method:String(req.body.capture_method||''),receipt_url:String(req.body.receipt_url||'')};
  if(details.order_nsu!==payment.order_nsu||!details.slug||!details.transaction_nsu)return res.status(400).json({error:'Não foi possível validar os dados de retorno do pagamento.'});
  if(!process.env.INFINITEPAY_HANDLE)return res.status(503).json({error:'Configure a InfiniteTag em INFINITEPAY_HANDLE para confirmar pagamentos.'});
  try{
    const paid=await verifyInfinitePayPayment(payment,details);
    res.json({status:paid?'paid':'pending'});
  }catch(error){res.status(502).json({error:error.message||'Não foi possível confirmar o pagamento com a InfinitePay.'})}
});
app.post('/api/professionals/me/priority/payment',auth,role('professional'),async(req,res)=>{
  if(req.user.status!=='active')return res.status(403).json({error:'Apenas profissionais ativos podem contratar prioridade.'});
  const existing=D.payments.find(payment=>payment.type==='priority'&&payment.professional_id===req.user.id&&payment.status==='pending'&&payment.checkout_url);
  if(existing&&isCheckoutLinkFresh(existing))return res.json({checkoutUrl:existing.checkout_url,paymentId:existing.id});
  if(existing){existing.checkout_url='';save()}
  const handle=String(process.env.INFINITEPAY_HANDLE||'').trim().replace(/^\$/,'');
  if(!handle)return res.status(503).json({error:'Configure a InfiniteTag em INFINITEPAY_HANDLE para habilitar os pagamentos.'});
  const paymentId=crypto.randomUUID();
  const orderNsu=`imp-priority-${paymentId}`;
  let redirectUrl;
  try{redirectUrl=new URL('/pagamento-retorno.html',`${publicBaseUrl()}/`)}catch(error){return res.status(503).json({error:error.message||'Configure a URL pública do sistema.'})}
  redirectUrl.searchParams.set('payment_id',paymentId);
  redirectUrl.searchParams.set('payment_type','priority');
  const payload={
    handle,
    redirect_url:redirectUrl.toString(),
    order_nsu:orderNsu,
    items:[{quantity:1,price:2000,description:'Prioridade na fila de escala - 30 dias'}],
    customer:{name:req.user.name,email:req.user.email}
  };
  const lockKey=`priority:${req.user.id}`;
  if(paymentCreationLocks.has(lockKey))return res.status(409).json({error:'O checkout da prioridade já está sendo preparado. Tente novamente em instantes.'});
  paymentCreationLocks.add(lockKey);
  let result;
  try{result=await infinitePayRequest(INFINITEPAY_LINKS_URL,payload)}catch(error){return res.status(502).json({error:error.message||'Não foi possível criar o checkout InfinitePay.'})}finally{paymentCreationLocks.delete(lockKey)}
  let checkoutUrl;
  try{checkoutUrl=new URL(result.checkout_url||result.url)}catch(error){return res.status(502).json({error:'A InfinitePay retornou um link de pagamento inválido.'})}
  if(checkoutUrl.protocol!=='https:'||!/(^|\.)infinitepay\.(com\.br|io)$/i.test(checkoutUrl.hostname))return res.status(502).json({error:'A InfinitePay retornou um endereço de checkout não confiável.'});
  const payment={id:paymentId,type:'priority',professional_id:req.user.id,amount:2000,order_nsu:orderNsu,status:'pending',checkout_url:checkoutUrl.toString(),created_at:new Date().toISOString()};
  D.payments.push(payment);
  save();
  res.status(201).json({checkoutUrl:payment.checkout_url,paymentId:payment.id});
});
app.post('/api/professionals/me/priority/verify',auth,role('professional'),async(req,res)=>{
  const payment=D.payments.find(item=>item.id===req.body.paymentId&&item.type==='priority'&&item.professional_id===req.user.id);
  if(!payment)return res.status(404).json({error:'Pagamento de prioridade não encontrado.'});
  if(payment.status==='paid')return res.json({status:'paid',priorityUntil:req.user.priorityUntil||null});
  const details={order_nsu:String(req.body.order_nsu||''),slug:String(req.body.slug||''),transaction_nsu:String(req.body.transaction_nsu||''),capture_method:String(req.body.capture_method||''),receipt_url:String(req.body.receipt_url||'')};
  if(details.order_nsu!==payment.order_nsu||!details.slug||!details.transaction_nsu)return res.status(400).json({error:'Não foi possível validar os dados de retorno do pagamento.'});
  if(!process.env.INFINITEPAY_HANDLE)return res.status(503).json({error:'Configure a InfiniteTag em INFINITEPAY_HANDLE para confirmar pagamentos.'});
  try{
    const paid=await verifyInfinitePayPayment(payment,details);
    res.json({status:paid?'paid':'pending',priorityUntil:paid?req.user.priorityUntil:null});
  }catch(error){res.status(502).json({error:error.message||'Não foi possível confirmar o pagamento com a InfinitePay.'})}
});
app.post('/api/webhooks/infinitepay',async(req,res)=>{
  const orderNsu=String(req.body.order_nsu||'');
  const payment=D.payments.find(item=>item.order_nsu===orderNsu);
  if(!payment)return res.status(400).json({error:'Pedido de pagamento não encontrado.'});
  if(payment.status==='paid')return res.status(200).json({ok:true});
  const details={slug:String(req.body.invoice_slug||''),transaction_nsu:String(req.body.transaction_nsu||''),capture_method:String(req.body.capture_method||''),receipt_url:String(req.body.receipt_url||'')};
  if(!details.slug||!details.transaction_nsu||!process.env.INFINITEPAY_HANDLE)return res.status(400).json({error:'Dados do webhook insuficientes para confirmar o pagamento.'});
  try{
    const paid=await verifyInfinitePayPayment(payment,details);
    if(!paid)return res.status(400).json({error:'A InfinitePay ainda não confirmou o pagamento.'});
    res.status(200).json({ok:true});
  }catch(error){res.status(400).json({error:error.message||'Não foi possível validar o webhook da InfinitePay.'})}
});
app.get('/api/admin/availability',auth,role('admin'),(req,res)=>{
  const date=String(req.query.date||'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T12:00:00`)))return res.status(400).json({error:'Informe uma data válida para consultar a disponibilidade.'});
  const busyProfessionalIds=[...new Set(D.staff.filter(staff=>{
    if(!['convidado','confirmado'].includes(staff.status))return false;
    const event=D.events.find(item=>item.id===staff.event_id);
    return event?.event_date===date&&!['cancelado','finalizado'].includes(event.status);
  }).map(staff=>staff.professional_id))];
  res.json({date,availability:D.availability.filter(item=>item.date===date).map(item=>({professional_id:item.professional_id,status:item.status})),busyProfessionalIds});
});
app.get('/api/professionals',auth,(req,res)=>{let p=D.users.filter(u=>u.role==='professional');if(req.query.status)p=p.filter(u=>u.status===req.query.status);res.json(p.map(pub))});
app.get('/api/professionals/catalog',auth,role('client'),(req,res)=>{
  const date=String(req.query.date||'');
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(`${date}T12:00:00`))))return res.status(400).json({error:'Informe uma data válida para consultar a disponibilidade.'});
  const requestedEventId=Number(req.query.excludeEvent);
  const currentEvent=D.events.find(event=>event.id===requestedEventId&&event.client_id===req.user.id);
  const catalog=D.users.filter(user=>user.role==='professional'&&user.status==='active').map(user=>{
    const summary=reviewSummary(user.id);
    const unavailableByPreference=D.availability.some(item=>item.professional_id===user.id&&item.date===date&&item.status==='indisponivel');
    const unavailableByConflict=date&&D.staff.some(staff=>{
      if(staff.professional_id!==user.id||!['convidado','confirmado'].includes(staff.status))return false;
      const event=D.events.find(item=>item.id===staff.event_id);
      return event?.event_date===date&&event.id!==currentEvent?.id&&!['cancelado','finalizado'].includes(event.status);
    });
    return {id:user.id,name:user.name,city:user.city,state:user.state,bio:user.bio||'',serviceIds:Array.isArray(user.serviceIds)?user.serviceIds.map(Number):[],rating:summary.rating,reviewCount:summary.reviewCount,availability:date?(unavailableByPreference||unavailableByConflict?'unavailable':'available'):'unknown',reviews:D.reviews.filter(review=>review.professional_id===user.id).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,5).map(review=>({rating:review.rating,comment:review.comment,created_at:review.created_at}))};
  });
  res.json(catalog);
});
app.get('/api/admin/professionals/pending',auth,role('admin'),(req,res)=>res.json(D.users.filter(u=>u.role==='professional'&&u.status==='pending').map(pub)));
app.patch('/api/professionals/:id/approve',auth,role('admin'),(req,res)=>{const u=D.users.find(x=>x.id===+req.params.id&&x.role==='professional');if(!u)return res.status(404).json({error:'Profissional não encontrado.'});u.status=req.body.approve?'active':'blocked';save();res.json({user:pub(u)})});
app.post('/api/professionals/invite',auth,role('admin'),(req,res)=>{
  const b=req.body;
  const e=D.events.find(x=>x.id===Number(b.eventId));
  const p=D.users.find(x=>x.id===Number(b.professionalId)&&x.role==='professional'&&x.status==='active');
  const serviceId=Number(b.serviceId);
  const service=services.find(item=>item.id===serviceId);
  const agreedPrice=Number(b.agreedPrice);
  if(!e||!p)return res.status(400).json({error:'Evento ou profissional inválido.'});
  if(!['aprovado','equipe_sendo_montada','equipe_confirmada'].includes(e.status))return res.status(409).json({error:'A equipe só pode ser convocada após a aprovação do evento e a confirmação do pagamento.'});
  const eventQuotes=D.quotes.filter(quote=>quote.event_id===e.id);
  const eventPayments=D.payments.filter(payment=>payment.event_id===e.id);
  if(eventQuotes.some(quote=>['enviado','aguardando_pagamento'].includes(quote.status))||((eventQuotes.length>0||eventPayments.length>0)&&!eventPayments.some(payment=>payment.status==='paid')))return res.status(409).json({error:'A equipe só pode ser convocada após a confirmação do pagamento.'});
  if(!service||!Array.isArray(p.serviceIds)||!p.serviceIds.map(Number).includes(serviceId))return res.status(400).json({error:'Este profissional não está habilitado para o serviço selecionado.'});
  const requestedService=(Array.isArray(e.service_quantities)?e.service_quantities:[]).find(item=>Number(item.service_id??item.serviceId)===serviceId);
  if(!requestedService)return res.status(400).json({error:'O serviço selecionado não faz parte do pedido deste evento.'});
  if(!Number.isFinite(agreedPrice)||agreedPrice<0||agreedPrice>100000000)return res.status(400).json({error:'Informe um valor de repasse válido.'});
  const assignedStatuses=['convidado','confirmado'];
  if(D.staff.some(staff=>staff.event_id===e.id&&staff.professional_id===p.id&&staff.service_id===serviceId&&assignedStatuses.includes(staff.status)))return res.status(409).json({error:'Este profissional já foi escalado para este serviço.'});
  const assignedCount=D.staff.filter(staff=>staff.event_id===e.id&&staff.service_id===serviceId&&assignedStatuses.includes(staff.status)).length;
  if(service.name!=='Buffet'&&assignedCount>=Number(requestedService.quantity))return res.status(409).json({error:'A quantidade solicitada para este serviço já foi preenchida.'});
  const availability=D.availability.find(item=>item.professional_id===p.id&&item.date===e.event_date);
  if(availability?.status==='indisponivel')return res.status(409).json({error:'O profissional informou que não está disponível nesta data.'});
  const conflict=D.staff.some(staff=>{
    if(staff.professional_id!==p.id||!assignedStatuses.includes(staff.status))return false;
    const event=D.events.find(item=>item.id===staff.event_id);
    return event?.event_date===e.event_date&&event.id!==e.id&&!['cancelado','finalizado'].includes(event.status);
  });
  if(conflict)return res.status(409).json({error:'O profissional já possui outro evento escalado nesta data.'});
  const s={id:id(D.staff),event_id:e.id,professional_id:p.id,service_id:serviceId,role:String(b.role||service.name).trim().slice(0,100),agreed_price:agreedPrice,status:'convidado'};
  D.staff.push(s);e.status='equipe_sendo_montada';save();res.status(201).json(s)
});
app.get('/api/professionals/me/jobs',auth,role('professional'),(req,res)=>res.json(D.staff.filter(s=>s.professional_id===req.user.id).map(s=>{const e=D.events.find(x=>x.id===s.event_id);return {...s,event_type:e?.event_type||'-',event_date:e?.event_date||null,start_time:e?.start_time||null,city:e?.city||'',address:e?.address||'',guest_count:e?.guest_count||0,event_status:e?.status||null,service_name:services.find(x=>x.id===s.service_id)?.name||s.role}}).sort((a,b)=>String(a.event_date||'').localeCompare(String(b.event_date||'')))));
app.patch('/api/professionals/me/jobs/:id',auth,role('professional'),(req,res)=>{const s=D.staff.find(x=>x.id===+req.params.id&&x.professional_id===req.user.id);if(!s)return res.status(404).json({error:'Trabalho não encontrado.'});if(s.status!=='convidado')return res.status(409).json({error:'Este convite já foi respondido.'});if(!['confirmado','recusado'].includes(req.body.decision))return res.status(400).json({error:'Escolha aceitar ou recusar o convite.'});s.status=req.body.decision;save();res.json(s)});
app.get('/api/professionals/me/availability',auth,role('professional'),(req,res)=>res.json(D.availability.filter(x=>x.professional_id===req.user.id).sort((a,b)=>String(a.date).localeCompare(String(b.date)))));
app.post('/api/professionals/me/availability',auth,role('professional'),(req,res)=>{const date=String(req.body.date||'');const status=String(req.body.status||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['disponivel','indisponivel'].includes(status))return res.status(400).json({error:'Informe uma data e uma disponibilidade válidas.'});const a=D.availability.find(x=>x.professional_id===req.user.id&&x.date===date);if(a)a.status=status;else D.availability.push({id:id(D.availability),professional_id:req.user.id,date,status});save();res.json({ok:true,date,status})});
app.patch('/api/professionals/me/profile',auth,role('professional'),(req,res)=>{try{const b=req.body;const name=String(b.name||'').trim();const city=String(b.city||'').trim();const state=String(b.state||'').trim().toUpperCase();const servicesSelected=Array.isArray(b.serviceIds)?[...new Set(b.serviceIds.map(Number).filter(n=>services.some(x=>x.id===n)))]:[];if(!name||!city||!/^[A-Z]{2}$/.test(state))return res.status(400).json({error:'Informe nome, cidade e UF com duas letras.'});if(!servicesSelected.length)return res.status(400).json({error:'Selecione ao menos um serviço.'});req.user.name=name.slice(0,120);req.user.phone=String(b.phone||'').trim().slice(0,30);req.user.city=city.slice(0,100);req.user.state=state;req.user.bio=String(b.bio||'').trim().slice(0,1000);req.user.serviceIds=servicesSelected;save();res.json({user:pub(req.user)})}catch(error){res.status(400).json({error:error.message||'Não foi possível atualizar o perfil.'})}});
app.get('/api/professionals/me/payouts',auth,role('professional'),(req,res)=>{const jobs=D.staff.filter(s=>s.professional_id===req.user.id);const result=[];for(const s of jobs){const e=D.events.find(x=>x.id===s.event_id);const saved=D.payouts.find(p=>p.staff_id===s.id);if(saved){result.push({...saved,event_type:e?.event_type||'-',event_date:e?.event_date||null,service_name:services.find(x=>x.id===s.service_id)?.name||s.role});}else if(e?.status==='finalizado'){result.push({id:null,staff_id:s.id,event_id:e.id,professional_id:req.user.id,amount:Number(s.agreed_price||0),status:'aguardando_registro',paidAt:null,event_type:e.event_type,event_date:e.event_date,service_name:services.find(x=>x.id===s.service_id)?.name||s.role});}}result.sort((a,b)=>String(b.event_date||'').localeCompare(String(a.event_date||'')));res.json(result)});
app.post('/api/professionals/me/exit',auth,role('professional'),(req,res)=>{if(req.body.confirm!==true)return res.status(400).json({error:'Confirme a solicitação de saída.'});const today=new Date();today.setHours(0,0,0,0);const limit=new Date(today);limit.setDate(limit.getDate()+7);const withinSeven=D.staff.some(s=>s.professional_id===req.user.id&&s.status==='confirmado'&&(()=>{const e=D.events.find(x=>x.id===s.event_id);if(!e||!e.event_date||['cancelado','finalizado'].includes(e.status))return false;const dt=new Date(`${e.event_date}T12:00:00`);return dt>=today&&dt<=limit})());if(withinSeven)return res.status(409).json({error:'Você possui trabalho confirmado nos próximos 7 dias. Conclua ou regularize essa escala antes de solicitar a saída.'});D.staff.filter(s=>s.professional_id===req.user.id&&['convidado','confirmado'].includes(s.status)).forEach(s=>s.status='cancelado');req.user.exitRequestAt=new Date().toISOString();req.user.status='blocked';save();res.json({exitCompleted:true,message:'Sua conta foi desativada e você saiu da plataforma.'})});
app.get('/api/admin/payouts',auth,role('admin'),(req,res)=>{const eligible=D.staff.filter(s=>D.events.some(e=>e.id===s.event_id&&e.status==='finalizado')).map(s=>{const e=D.events.find(x=>x.id===s.event_id);const p=D.payouts.find(x=>x.staff_id===s.id);return {staff_id:s.id,professional_id:s.professional_id,professional_name:D.users.find(u=>u.id===s.professional_id)?.name||'-',event_id:e.id,event_type:e.event_type,event_date:e.event_date,city:e.city,service_name:services.find(x=>x.id===s.service_id)?.name||s.role,role:s.role,agreed_price:Number(s.agreed_price||0),payout:p||null}});const payouts=D.payouts.map(p=>{const s=D.staff.find(x=>x.id===p.staff_id);const e=D.events.find(x=>x.id===p.event_id);return {...p,professional_name:D.users.find(u=>u.id===p.professional_id)?.name||'-',event_type:e?.event_type||'-',event_date:e?.event_date||null,service_name:services.find(x=>x.id===s?.service_id)?.name||s?.role||'-'}}).sort((a,b)=>String(b.paidAt||b.createdAt||'').localeCompare(String(a.paidAt||a.createdAt||'')));res.json({eligible,payouts})});
app.post('/api/admin/payouts',auth,role('admin'),(req,res)=>{const staffId=Number(req.body.staffId),amount=Number(req.body.amount),status=String(req.body.status||'pendente'),paidAt=req.body.paidAt?String(req.body.paidAt).slice(0,10):null;const s=D.staff.find(x=>x.id===staffId);if(!s)return res.status(404).json({error:'Escala não encontrada.'});const e=D.events.find(x=>x.id===s.event_id);if(!e||e.status!=='finalizado')return res.status(409).json({error:'O repasse só pode ser registrado depois da finalização do evento.'});if(!Number.isFinite(amount)||amount<=0||amount>100000000)return res.status(400).json({error:'Informe um valor válido para o repasse.'});if(!['pendente','pago'].includes(status))return res.status(400).json({error:'Status de repasse inválido.'});if(status==='pago'&&(!paidAt||!/\d{4}-\d{2}-\d{2}/.test(paidAt)))return res.status(400).json({error:'Informe a data do pagamento.'});let p=D.payouts.find(x=>x.staff_id===s.id);if(p)Object.assign(p,{amount,status,paidAt:status==='pago'?paidAt:null,updatedAt:new Date().toISOString()});else{p={id:id(D.payouts),staff_id:s.id,event_id:e.id,professional_id:s.professional_id,amount,status,paidAt:status==='pago'?paidAt:null,createdAt:new Date().toISOString()};D.payouts.push(p)}save();res.json(p)});
app.get('/api/admin/dashboard',auth,role('admin'),(req,res)=>{const today=new Date().toISOString().slice(0,10);res.json({eventsToday:D.events.filter(e=>e.event_date===today).length,upcomingEvents:D.events.filter(e=>e.event_date>=today).length,professionalsActive:D.users.filter(u=>u.role==='professional'&&u.status==='active').length,pendingRequests:D.events.filter(e=>['solicitado','em_analise'].includes(e.status)).length})});
app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Rota da API não encontrada.'});res.sendFile(path.join(FRONT,'inicio.html'))});
(async()=>{
  const adminEmail=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  const adminPassword=String(process.env.ADMIN_PASSWORD||'');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)||adminPassword.length<12)throw new Error('Configure ADMIN_EMAIL e ADMIN_PASSWORD (com pelo menos 12 caracteres) no arquivo .env para iniciar o acesso administrativo.');
  let admin=D.users.find(user=>user.role==='admin');
  if(D.users.some(user=>String(user.email||'').trim().toLowerCase()===adminEmail&&user.id!==admin?.id))throw new Error('O ADMIN_EMAIL já está sendo usado por outra conta. Escolha um e-mail exclusivo para a administração.');
  const credentials=await hash(adminPassword);
  if(!admin){
    admin={id:id(D.users),name:'Administrador',phone:'',role:'admin',city:'',state:'',bio:'',status:'active',rating:5,total_jobs:0};
    D.users.push(admin);
  }
  Object.assign(admin,{email:adminEmail,passwordHash:credentials.hash,passwordSalt:credentials.salt,status:'active'});
  save();
  app.listen(PORT,()=>console.log(`Imperio Cerimonial: http://localhost:${PORT}`));
})().catch(error=>{console.error(error.message);process.exitCode=1});
