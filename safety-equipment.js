(function(){
  'use strict';

  const DAY=24*60*60*1000;
  const NOTICE_LIFETIME=180*DAY;
  const VIEW_ROLES=new Set(['super_admin','director','republic_tb_engineer','chief_engineer','regional_tb_engineer','tb_engineer','master']);
  const ITEM_MANAGER_ROLES=new Set(['super_admin','republic_tb_engineer','chief_engineer','regional_tb_engineer','tb_engineer']);
  const TEST_MANAGER_ROLES=new Set(['super_admin','republic_tb_engineer','chief_engineer','regional_tb_engineer','tb_engineer']);
  const CATALOG_MANAGER_ROLES=new Set(['super_admin','republic_tb_engineer','regional_tb_engineer']);
  const TB_ROLES=new Set(['republic_tb_engineer','regional_tb_engineer','tb_engineer']);
  const FIELD_LABELS={
    inventoryNo:'Inventar raqami',catalogId:'Vosita turi',equipmentName:'Vosita nomi',workZoneId:'U/J',
    lastTestDate:'Sinovdan o‘tgan sana',nextTestDate:'Keyingi sinov sanasi',status:'Holati',notes:'Izoh',
    name:'Vosita nomi',intervalValue:'Sinov oralig‘i',intervalUnit:'Oraliq birligi',active:'Faolligi'
  };
  const STATUS_LABELS={active:'Amalda',out_of_cycle:'Navbatdan tashqari sinov',testing:'Sinovda',archived:'Yaroqsiz / arxiv'};
  const UNIT_LABELS={day:'kun',month:'oy',year:'yil'};

  let db=null,me=null,users={},folders={},zones={},catalog={},items={},settings={},audits={};
  let refs=[],tab='items',searchText='',zoneFilter='all',statusFilter='active',reminderTimer=null,reminderInterval=null;

  function byId(id){return document.getElementById(id);}
  function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  function attr(value){return esc(value);}
  function role(){return me&&me.role||'';}
  function roleLabel(user){
    if(window.HETKAuth&&window.HETKAuth.getAccountRoleLabel)return window.HETKAuth.getAccountRoleLabel(user||{});
    return (user&&user.roleLabel)||(user&&user.role)||'Hodim';
  }
  function userName(uid){const u=users[uid]||{};return u.fullName||u.login||'Hodim';}
  function canView(){return !!(me&&me.active!==false&&(me.rootAccess||VIEW_ROLES.has(role())));}
  function canManageItems(){return !!(me&&(me.rootAccess||ITEM_MANAGER_ROLES.has(role())));}
  function canManageTests(){return !!(me&&(me.rootAccess||TEST_MANAGER_ROLES.has(role())));}
  function canManageCatalog(){return !!(me&&(me.rootAccess||CATALOG_MANAGER_ROLES.has(role())));}
  function isMaster(){return role()==='master';}
  function now(){return Date.now();}
  function todayStart(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();}
  function parseDate(value){if(!value)return 0;const t=Date.parse(String(value).slice(0,10)+'T00:00:00');return Number.isFinite(t)?t:0;}
  function fmtDate(value){const t=parseDate(value);return t?new Date(t).toLocaleDateString('uz-UZ'):'—';}
  function fmtTime(value){const d=new Date(Number(value)||0);return Number.isNaN(d.getTime())?'—':d.toLocaleString('uz-UZ');}
  function isoDate(value){const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return '';const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
  function addInterval(dateValue,value,unit){
    const t=parseDate(dateValue),n=Math.max(0,Number(value)||0);if(!t||!n)return '';
    const d=new Date(t);if(unit==='year'||unit==='month'){const originalDay=d.getDate(),targetMonth=d.getMonth()+(unit==='year'?n*12:n);d.setDate(1);d.setMonth(targetMonth);const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(originalDay,lastDay));}else d.setDate(d.getDate()+n);return isoDate(d);
  }
  function intervalText(row){const n=Number(row&&row.intervalValue)||0;return n?`${n} ${UNIT_LABELS[row.intervalUnit]||'kun'}`:'Kiritilmagan';}
  function objectTrueKeys(value){return Object.keys(value||{}).filter(k=>value[k]);}
  function folderChildren(root){
    const out=[];Object.keys(folders).forEach(id=>{if(folders[id]&&folders[id].parentId===root){out.push(id);out.push(...folderChildren(id));}});return out;
  }
  function accountFolderSet(user){
    if(!user)return new Set();if(user.rootAccess||user.role==='super_admin'||user.role==='republic_tb_engineer')return new Set(Object.keys(folders));
    const set=new Set();objectTrueKeys(user.folders).forEach(id=>{if(!folders[id])return;set.add(id);folderChildren(id).forEach(x=>set.add(x));});return set;
  }
  function zoneRoots(zone){return objectTrueKeys(zone&&zone.folders);}
  function accountCoversZone(user,zoneId){
    if(!user)return false;const zone=zones[zoneId]||{};
    if(user.rootAccess||user.role==='super_admin'||user.role==='republic_tb_engineer')return true;
    if(user.workZoneId&&user.workZoneId===zoneId)return true;
    const roots=zoneRoots(zone),allowed=accountFolderSet(user);return !!(roots.length&&roots.every(id=>allowed.has(id)));
  }
  function visibleZones(){
    return Object.keys(zones).map(id=>Object.assign({id},zones[id]||{})).filter(z=>z.active!==false).filter(z=>{
      if(isMaster())return z.id===me.workZoneId||z.currentMasterUid===me.uid;
      return accountCoversZone(me,z.id);
    }).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'uz'));
  }
  function zoneName(id){return zones[id]&&zones[id].name||'Biriktirilmagan U/J';}
  function catalogRow(id){return catalog[id]||{};}
  function itemName(item){return item.equipmentName||catalogRow(item.catalogId).name||'Nomsiz vosita';}
  function daysLeft(item){const due=parseDate(item.nextTestDate);return due?Math.ceil((due-todayStart())/DAY):null;}
  function itemState(item){
    if(item.status==='archived'||item.status==='failed'||item.active===false)return {key:'archived',label:'Yaroqsiz / arxiv',days:null};
    if(item.status==='out_of_cycle')return {key:'out_of_cycle',label:'Navbatdan tashqari sinov',days:daysLeft(item)};
    if(item.status==='testing')return {key:'testing',label:'Sinovda',days:daysLeft(item)};
    const days=daysLeft(item);if(days===null)return {key:'soon',label:'Muddat kiritilmagan',days};
    if(days<0)return {key:'expired',label:`${Math.abs(days)} kun o‘tgan`,days};
    if(days<=10)return {key:'soon',label:days===0?'Bugun tugaydi':`${days} kun qoldi`,days};
    return {key:'ok',label:'Amalda',days};
  }
  function rowVisible(item){
    if(!item||!accountCoversZone(me,item.workZoneId))return false;
    if(isMaster()&&item.workZoneId!==me.workZoneId&&zones[item.workZoneId]&&zones[item.workZoneId].currentMasterUid!==me.uid)return false;
    if(zoneFilter!=='all'&&item.workZoneId!==zoneFilter)return false;
    const st=itemState(item);
    if(statusFilter==='active'&&st.key==='archived')return false;
    if(statusFilter!=='all'&&statusFilter!=='active'&&st.key!==statusFilter)return false;
    const q=searchText.trim().toLocaleLowerCase('uz');if(!q)return true;
    return `${item.inventoryNo||''} ${itemName(item)} ${zoneName(item.workZoneId)} ${item.notes||''}`.toLocaleLowerCase('uz').includes(q);
  }
  function visibleItems(){return Object.keys(items).map(id=>Object.assign({id},items[id]||{})).filter(rowVisible).sort((a,b)=>String(zoneName(a.workZoneId)).localeCompare(zoneName(b.workZoneId),'uz')||String(itemName(a)).localeCompare(itemName(b),'uz')||String(a.inventoryNo||'').localeCompare(String(b.inventoryNo||''),'uz'));}

  function buildShell(){
    if(byId('hetk-se-overlay'))return;
    const overlay=document.createElement('div');overlay.id='hetk-se-overlay';overlay.className='hetk-se-overlay';overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=`<section class="hetk-se-shell" role="dialog" aria-modal="true" aria-labelledby="hetk-se-title">
      <header class="hetk-se-head"><span class="hetk-se-headmark"><i class="fas fa-shield-alt"></i></span><div class="hetk-se-headtitle"><h2 id="hetk-se-title">Himoya vositalari nazorati</h2><p>U/J vositalari, sinov muddatlari va navbatdan tashqari tekshiruvlar</p></div><button class="hetk-se-close" type="button" data-se-close aria-label="Yopish">×</button></header>
      <nav class="hetk-se-tabs"><button class="hetk-se-tab active" data-se-tab="items"><i class="fas fa-list-check"></i>Vositalar</button><button class="hetk-se-tab" data-se-tab="catalog"><i class="fas fa-book"></i>Umumiy ro‘yxat</button><button class="hetk-se-tab" data-se-tab="history"><i class="fas fa-clock-rotate-left"></i>O‘zgarishlar tarixi</button></nav>
      <main id="hetk-se-main" class="hetk-se-main"></main>
    </section>`;
    overlay.addEventListener('click',handleClick);overlay.addEventListener('input',handleInput);overlay.addEventListener('change',handleChange);document.body.appendChild(overlay);
  }
  function setButton(){
    const btn=byId('hetk-safety-equipment-open');if(!btn)return;btn.hidden=!canView();
    const badge=byId('hetk-safety-equipment-count');if(!badge)return;
    const urgent=Object.keys(items).map(id=>items[id]).filter(it=>it&&accountCoversZone(me,it.workZoneId)).filter(it=>['soon','expired','out_of_cycle'].includes(itemState(it).key)).length;
    badge.textContent=String(urgent);badge.hidden=!urgent;
  }
  function open(){if(!canView())return;buildShell();byId('hetk-se-overlay').classList.add('open');byId('hetk-se-overlay').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';render();scheduleReminderScan();}
  function close(){const el=byId('hetk-se-overlay');if(el){el.classList.remove('open');el.setAttribute('aria-hidden','true');}closeModal();document.body.style.overflow='';}
  function render(){
    document.querySelectorAll('[data-se-tab]').forEach(b=>b.classList.toggle('active',b.dataset.seTab===tab));
    if(tab==='catalog')renderCatalog();else if(tab==='history')renderHistory();else renderItems();
  }
  function summaryHtml(){
    const all=Object.keys(items).map(id=>items[id]).filter(it=>it&&accountCoversZone(me,it.workZoneId));
    const count=k=>all.filter(it=>itemState(it).key===k).length;
    return `<section class="hetk-se-summary"><div class="hetk-se-summary-card"><i class="fas fa-shield"></i><div><span>Faol vositalar</span><b>${all.filter(it=>itemState(it).key!=='archived').length}</b></div></div><div class="hetk-se-summary-card warn"><i class="fas fa-hourglass-half"></i><div><span>10 kun ichida</span><b>${count('soon')}</b></div></div><div class="hetk-se-summary-card danger"><i class="fas fa-triangle-exclamation"></i><div><span>Muddati o‘tgan</span><b>${count('expired')}</b></div></div><div class="hetk-se-summary-card yellow"><i class="fas fa-flask"></i><div><span>Navbatdan tashqari</span><b>${count('out_of_cycle')}</b></div></div><div class="hetk-se-summary-card"><i class="fas fa-box-archive"></i><div><span>Yaroqsiz / arxiv</span><b>${count('archived')}</b></div></div></section>`;
  }
  function zoneOptions(selected,allLabel){return `${allLabel?`<option value="all">${esc(allLabel)}</option>`:''}${visibleZones().map(z=>`<option value="${attr(z.id)}"${z.id===selected?' selected':''}>${esc(z.name||'Nomsiz U/J')}</option>`).join('')}`;}
  function renderItems(){
    const rows=visibleItems();const main=byId('hetk-se-main');if(!main)return;
    main.innerHTML=`${summaryHtml()}<div class="hetk-se-toolbar"><div class="hetk-se-search"><i class="fas fa-search"></i><input id="hetk-se-search" value="${attr(searchText)}" placeholder="Inventar raqami, vosita yoki U/J bo‘yicha qidirish"></div><select id="hetk-se-zone-filter" class="hetk-se-select">${zoneOptions(zoneFilter,'Barcha U/J lar')}</select><select id="hetk-se-status-filter" class="hetk-se-select"><option value="active"${statusFilter==='active'?' selected':''}>Faol vositalar</option><option value="all"${statusFilter==='all'?' selected':''}>Barcha holatlar</option><option value="ok"${statusFilter==='ok'?' selected':''}>Amalda</option><option value="soon"${statusFilter==='soon'?' selected':''}>10 kun ichida</option><option value="expired"${statusFilter==='expired'?' selected':''}>Muddati o‘tgan</option><option value="out_of_cycle"${statusFilter==='out_of_cycle'?' selected':''}>Navbatdan tashqari</option><option value="testing"${statusFilter==='testing'?' selected':''}>Sinovda</option><option value="archived"${statusFilter==='archived'?' selected':''}>Yaroqsiz / arxiv</option></select>${canManageItems()?'<button class="hetk-se-btn primary" data-se-add><i class="fas fa-plus"></i>Vosita biriktirish</button>':''}</div>
      <p class="hetk-se-note"><b>Bir satr — bitta himoya vositasi.</b> Master faqat inventar raqamini tahrirlaydi va nosoz vositani navbatdan tashqari sinovga yubora oladi.</p>
      ${rows.length?itemsTable(rows):`<div class="hetk-se-empty"><i class="fas fa-shield-halved"></i><h3>Vosita topilmadi</h3><p>Tanlangan U/J yoki filtr bo‘yicha himoya vositasi mavjud emas.</p>${canManageItems()?'<button class="hetk-se-btn primary" data-se-add><i class="fas fa-plus"></i>Birinchi vositani qo‘shish</button>':''}</div>`}`;
  }
  function itemsTable(rows){
    return `<div class="hetk-se-tablewrap"><table class="hetk-se-table"><thead><tr><th>№</th><th>Inventar raqami</th><th>Himoya vositasi</th><th>Ustalik joyi</th><th>Oxirgi sinov</th><th>Keyingi sinov</th><th>Holati</th><th></th></tr></thead><tbody>${rows.map((item,index)=>itemRow(item,index)).join('')}</tbody></table></div>`;
  }
  function itemRow(item,index){
    const st=itemState(item),cat=catalogRow(item.catalogId),actions=[];
    if(st.key!=='archived'){
      if(canManageItems())actions.push(`<button class="hetk-se-iconbtn" data-se-edit="${attr(item.id)}" title="Ma’lumotni tahrirlash"><i class="fas fa-pen"></i></button>`);
      else if(isMaster())actions.push(`<button class="hetk-se-iconbtn" data-se-inventory="${attr(item.id)}" title="Inventar raqamini tahrirlash"><i class="fas fa-hashtag"></i></button>`);
      if(canManageTests())actions.push(`<button class="hetk-se-iconbtn green" data-se-test="${attr(item.id)}" title="Sinov natijasini kiritish"><i class="fas fa-flask-vial"></i></button>`);
      if(isMaster()&&st.key!=='out_of_cycle'&&st.key!=='testing')actions.push(`<button class="hetk-se-iconbtn yellow" data-se-out="${attr(item.id)}" title="Navbatdan tashqari sinov"><i class="fas fa-triangle-exclamation"></i></button>`);
    }
    return `<tr class="${st.key==='out_of_cycle'?'out-of-cycle':st.key}"><td class="num">${index+1}</td><td><span class="hetk-se-inventory">${esc(item.inventoryNo||'Kiritilmagan')}</span></td><td class="hetk-se-name"><b>${esc(itemName(item))}</b><small>Me’yoriy oraliq: ${esc(intervalText(cat))}</small></td><td class="hetk-se-zone"><b>${esc(zoneName(item.workZoneId))}</b><small>${esc((zones[item.workZoneId]&&zones[item.workZoneId].region)||'')}</small></td><td class="hetk-se-date"><b>${esc(fmtDate(item.lastTestDate))}</b><small>${esc(item.lastProtocolNo?'Bayonnoma: '+item.lastProtocolNo:'')}</small></td><td class="hetk-se-date"><b>${esc(fmtDate(item.nextTestDate))}</b><small>${st.days!=null&&st.days>=0?esc(st.days+' kun'):''}</small></td><td><span class="hetk-se-status ${st.key}"><i class="fas ${st.key==='ok'?'fa-circle-check':st.key==='expired'?'fa-circle-xmark':st.key==='out_of_cycle'?'fa-triangle-exclamation':st.key==='archived'?'fa-box-archive':'fa-clock'}"></i>${esc(st.label)}</span></td><td><div class="hetk-se-actions">${actions.join('')}</div></td></tr>`;
  }

  function renderCatalog(){
    const main=byId('hetk-se-main'),rows=Object.keys(catalog).map(id=>Object.assign({id},catalog[id]||{})).sort((a,b)=>Number(b.active!==false)-Number(a.active!==false)||String(a.name||'').localeCompare(String(b.name||''),'uz'));
    if(!main)return;main.innerHTML=`<div class="hetk-se-catalog-grid"><section><div class="hetk-se-toolbar"><div class="hetk-se-search"><i class="fas fa-search"></i><input id="hetk-se-catalog-search" placeholder="Vosita nomini qidirish"></div>${canManageCatalog()?'<button class="hetk-se-btn primary" data-se-catalog-add><i class="fas fa-plus"></i>Ro‘yxatga qo‘shish</button>':''}</div><p class="hetk-se-note warning">Bu ro‘yxat butun tizim uchun umumiy. Vosita nomi va me’yoriy sinov oralig‘idagi har bir o‘zgarish tarixga yoziladi va TB muhandislariga bildiriladi.</p>${catalogTable(rows)}</section><aside class="hetk-se-catalog-side"><h3>Tahrirlash himoyasi</h3><p>Umumiy ro‘yxatni faqat viloyat/respublika TB muhandisi yoki Bosh administrator maxsus kod bilan o‘zgartiradi.</p><div class="hetk-se-code-state ${settings.catalogEditCodeHash?'':'unset'}"><i class="fas fa-${settings.catalogEditCodeHash?'lock':'triangle-exclamation'}"></i> ${settings.catalogEditCodeHash?'Tahrirlash kodi o‘rnatilgan':'Kod hali o‘rnatilmagan'}</div>${canManageCatalog()?'<button class="hetk-se-btn secondary" data-se-code><i class="fas fa-key"></i>Kodni o‘rnatish / almashtirish</button>':'<p><i class="fas fa-eye"></i> Siz uchun faqat ko‘rish rejimi.</p>'}</aside></div>`;
  }
  function catalogTable(rows){
    const q=String((byId('hetk-se-catalog-search')||{}).value||'').toLocaleLowerCase('uz');const filtered=q?rows.filter(x=>String(x.name||'').toLocaleLowerCase('uz').includes(q)):rows;
    if(!filtered.length)return `<div class="hetk-se-empty"><i class="fas fa-book-open"></i><h3>Umumiy ro‘yxat bo‘sh</h3><p>Viloyat yoki Respublika TB muhandisi vosita nomlari va sinov oraliqlarini kiritadi.</p></div>`;
    return `<div class="hetk-se-tablewrap"><table class="hetk-se-table"><thead><tr><th>№</th><th>Himoya vositasi nomi</th><th>Me’yoriy sinov oralig‘i</th><th>Holati</th><th>Oxirgi tahrir</th><th></th></tr></thead><tbody>${filtered.map((row,i)=>`<tr class="${row.active===false?'archived':''}"><td class="num">${i+1}</td><td class="hetk-se-name"><b>${esc(row.name||'Nomsiz')}</b></td><td><b>${esc(intervalText(row))}</b></td><td><span class="hetk-se-status ${row.active===false?'archived':'ok'}">${row.active===false?'Ro‘yxatdan chiqarilgan':'Faol'}</span></td><td class="hetk-se-date"><b>${esc(row.updatedByName||'—')}</b><small>${esc(fmtTime(row.updatedAt))}</small></td><td><div class="hetk-se-actions">${canManageCatalog()?`<button class="hetk-se-iconbtn" data-se-catalog-edit="${attr(row.id)}" title="Tahrirlash"><i class="fas fa-pen"></i></button>${row.active!==false?`<button class="hetk-se-iconbtn yellow" data-se-catalog-disable="${attr(row.id)}" title="Ro‘yxatdan chiqarish"><i class="fas fa-box-archive"></i></button>`:`<button class="hetk-se-iconbtn green" data-se-catalog-restore="${attr(row.id)}" title="Faollashtirish"><i class="fas fa-rotate-left"></i></button>`}`:''}</div></td></tr>`).join('')}</tbody></table></div>`;
  }
  function renderHistory(){
    const main=byId('hetk-se-main');if(!main)return;const rows=Object.keys(audits).map(id=>Object.assign({id},audits[id]||{})).filter(a=>!a.workZoneId||accountCoversZone(me,a.workZoneId)||a.entityType==='catalog').sort((a,b)=>Number(b.createdAt||0)-Number(a.createdAt||0)).slice(0,250);
    main.innerHTML=`<p class="hetk-se-note"><b>O‘chmaydigan tarix:</b> kim, qachon va qaysi maydonni o‘zgartirgani eski va yangi qiymati bilan saqlanadi.</p><div class="hetk-se-audit">${rows.length?rows.map(a=>auditHtml(a)).join(''):`<div class="hetk-se-empty"><i class="fas fa-clock-rotate-left"></i><h3>Tarix hali bo‘sh</h3></div>`}</div>`;
  }
  function auditHtml(a){const changes=Object.keys(a.changes||{}).map(k=>a.changes[k]||{});return `<article class="hetk-se-audit-item"><header><b>${esc(a.label||'O‘zgarish')}</b><time>${esc(fmtTime(a.createdAt))}</time></header><p><strong>${esc(a.actorName||'Hodim')}</strong> · ${esc(a.actorRole||'')} ${a.workZoneId?'· '+esc(zoneName(a.workZoneId)):''}</p>${changes.length?`<div class="hetk-se-change-list">${changes.map(c=>`<span>${esc(c.label||'Maydon')}: <del>${esc(c.before==null?'—':c.before)}</del> → <ins>${esc(c.after==null?'—':c.after)}</ins></span>`).join('')}</div>`:''}</article>`;}

  function openModal(content,wide){closeModal();const wrap=document.createElement('div');wrap.id='hetk-se-modal';wrap.className='hetk-se-modal';wrap.innerHTML=`<section class="hetk-se-dialog${wide?' wide':''}">${content}</section>`;wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-se-modal-close]'))closeModal();});document.body.appendChild(wrap);return wrap;}
  function closeModal(){const el=byId('hetk-se-modal');if(el)el.remove();}
  function modalMessage(text){const el=byId('hetk-se-formerror');if(el){el.textContent=text;el.classList.add('show');}}
  function setBusy(btn,on,text){if(!btn)return;if(on){btn.dataset.oldText=btn.innerHTML;btn.disabled=true;btn.textContent=text||'Saqlanmoqda...';}else{btn.disabled=false;if(btn.dataset.oldText)btn.innerHTML=btn.dataset.oldText;}}
  function toast(message,type){const old=document.querySelector('.hetk-se-toast');if(old)old.remove();const el=document.createElement('div');el.className=`hetk-se-toast ${type||''}`;el.textContent=message;document.body.appendChild(el);setTimeout(()=>el.remove(),4200);}
  function fieldValue(id){const el=byId(id);return el?String(el.value||'').trim():'';}

  function itemForm(item){
    const editing=!!item,rows=Object.keys(catalog).map(id=>Object.assign({id},catalog[id]||{})).filter(x=>x.active!==false||x.id===(item&&item.catalogId)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'uz'));
    if(!rows.length){toast('Avval “Umumiy ro‘yxat”ga himoya vositalari va sinov oralig‘ini kiriting.','error');tab='catalog';render();return;}
    const zoneRows=visibleZones();if(!zoneRows.length)return toast('Sizga ruxsat etilgan U/J topilmadi.','error');
    const content=`<header><i class="fas fa-shield-halved"></i><div><h3>${editing?'Himoya vositasini tahrirlash':'U/J ga himoya vositasi biriktirish'}</h3><p>${editing?'Sinov muddatini uzaytirish “Sinov natijasi” tugmasida bajariladi.':'Har bir dona alohida satr sifatida saqlanadi.'}</p></div><button data-se-modal-close>×</button></header><div class="hetk-se-dialog-body"><div id="hetk-se-formerror" class="hetk-se-formerror"></div><div class="hetk-se-formgrid"><div class="hetk-se-field"><span>Himoya vositasi *</span><select id="hetk-se-item-catalog"${editing?' disabled':''}>${rows.map(x=>`<option value="${attr(x.id)}"${x.id===(item&&item.catalogId)?' selected':''}>${esc(x.name)} — ${esc(intervalText(x))}</option>`).join('')}</select></div><div class="hetk-se-field"><span>Ustalik joyi (U/J) *</span><select id="hetk-se-item-zone">${zoneRows.map(z=>`<option value="${attr(z.id)}"${z.id===(item&&item.workZoneId)?' selected':''}>${esc(z.name)}</option>`).join('')}</select></div><div class="hetk-se-field"><span>Inventar raqami *</span><input id="hetk-se-item-inventory" value="${attr(item&&item.inventoryNo||'')}" placeholder="Masalan: HV-0045"></div>${editing?'':`<div class="hetk-se-field"><span>Sinovdan o‘tgan sana *</span><input id="hetk-se-item-tested" type="date" value="${attr(item&&item.lastTestDate||isoDate(now()))}"></div><div class="hetk-se-field"><span>Keyingi sinov muddati *</span><input id="hetk-se-item-next" type="date" value="${attr(item&&item.nextTestDate||'')}"><small>Vosita uchun belgilangan umumiy oraliqdan avtomatik hisoblanadi, zarur bo‘lsa qo‘lda tuzatiladi.</small></div>`}<div class="hetk-se-field full"><span>Izoh</span><textarea id="hetk-se-item-notes" placeholder="Vositaning holati yoki qo‘shimcha ma’lumot">${esc(item&&item.notes||'')}</textarea></div></div></div><footer><button class="cancel" data-se-modal-close>Bekor qilish</button><button id="hetk-se-item-save" class="save"><i class="fas fa-save"></i> Saqlash</button></footer>`;
    const modal=openModal(content,true);const calc=()=>{if(editing)return;const cat=catalogRow(fieldValue('hetk-se-item-catalog'));const next=addInterval(fieldValue('hetk-se-item-tested'),cat.intervalValue,cat.intervalUnit);if(next)byId('hetk-se-item-next').value=next;};
    if(!editing){byId('hetk-se-item-catalog').addEventListener('change',calc);byId('hetk-se-item-tested').addEventListener('change',calc);calc();}
    byId('hetk-se-item-save').addEventListener('click',()=>saveItem(item&&item.id||'',modal));
  }
  function inventoryDuplicate(number,exceptId){const n=number.toLocaleLowerCase('uz');return Object.keys(items).some(id=>id!==exceptId&&itemState(items[id]).key!=='archived'&&String(items[id].inventoryNo||'').trim().toLocaleLowerCase('uz')===n);}
  async function saveItem(id){
    if(!canManageItems())return;const editing=!!id,btn=byId('hetk-se-item-save'),inventoryNo=fieldValue('hetk-se-item-inventory'),workZoneId=fieldValue('hetk-se-item-zone'),notes=fieldValue('hetk-se-item-notes'),catalogId=fieldValue('hetk-se-item-catalog')||(items[id]&&items[id].catalogId)||'';
    if(!catalogId||!catalog[catalogId])return modalMessage('Himoya vositasi turini tanlang.');if(!workZoneId||!zones[workZoneId])return modalMessage('U/J ni tanlang.');if(!inventoryNo)return modalMessage('Inventar raqamini kiriting.');if(inventoryDuplicate(inventoryNo,id))return modalMessage('Bu inventar raqami boshqa faol vositada mavjud.');
    const before=id?Object.assign({},items[id]||{}):{};const stamp=now(),cat=catalogRow(catalogId);let after;
    if(id){after=Object.assign({},before,{inventoryNo,workZoneId,notes,equipmentName:cat.name||before.equipmentName,updatedAt:stamp,updatedBy:me.uid,updatedByName:userName(me.uid)});}
    else{
      const lastTestDate=fieldValue('hetk-se-item-tested'),nextTestDate=fieldValue('hetk-se-item-next');if(!lastTestDate||!nextTestDate)return modalMessage('Oxirgi va keyingi sinov sanalarini kiriting.');if(parseDate(nextTestDate)<=parseDate(lastTestDate))return modalMessage('Keyingi sinov sanasi oxirgi sinov sanasidan keyin bo‘lishi kerak.');
      id=db.ref('SafetyEquipmentItems').push().key;after={id,catalogId,equipmentName:cat.name||'',inventoryNo,workZoneId,lastTestDate,nextTestDate,status:'active',active:true,notes,createdAt:stamp,createdBy:me.uid,createdByName:userName(me.uid),updatedAt:stamp,updatedBy:me.uid,updatedByName:userName(me.uid),testHistory:{}};
    }
    setBusy(btn,true);try{const updates={};updates[`SafetyEquipmentItems/${id}`]=after;appendAudit(updates,'item',id,editing?'update':'create',editing?'Himoya vositasi ma’lumoti tahrirlandi':'U/J ga yangi himoya vositasi biriktirildi',before,after,workZoneId);await db.ref().update(updates);const recipients=recipientUids(new Set(['master','tb_engineer','regional_tb_engineer','republic_tb_engineer','chief_engineer']),workZoneId);await notifyUsers(recipients,{action:editing?'safety_equipment_update':'safety_equipment_create',title:editing?`${itemName(after)} ma’lumoti yangilandi`:`${itemName(after)} U/J ga biriktirildi`,item:after,changes:diff(before,after)});closeModal();toast('Ma’lumot saqlandi.','success');}catch(e){modalMessage(e.message||String(e));}finally{setBusy(btn,false);}
  }

  function inventoryForm(item){
    if(!isMaster()||!accountCoversZone(me,item.workZoneId))return;const content=`<header><i class="fas fa-hashtag"></i><div><h3>Inventar raqamini tahrirlash</h3><p>${esc(itemName(item))} · ${esc(zoneName(item.workZoneId))}</p></div><button data-se-modal-close>×</button></header><div class="hetk-se-dialog-body"><div id="hetk-se-formerror" class="hetk-se-formerror"></div><div class="hetk-se-field"><span>Inventar raqami *</span><input id="hetk-se-inventory-value" value="${attr(item.inventoryNo||'')}" placeholder="Masalan: HV-0045"><small>Master uchun o‘zgartirish mumkin bo‘lgan yagona asosiy maydon.</small></div></div><footer><button class="cancel" data-se-modal-close>Bekor qilish</button><button id="hetk-se-inventory-save" class="save">Saqlash</button></footer>`;openModal(content);byId('hetk-se-inventory-save').addEventListener('click',()=>saveInventory(item));
  }
  async function saveInventory(item){
    const value=fieldValue('hetk-se-inventory-value'),btn=byId('hetk-se-inventory-save');if(!value)return modalMessage('Inventar raqamini kiriting.');if(inventoryDuplicate(value,item.id))return modalMessage('Bu inventar raqami boshqa faol vositada mavjud.');
    const before=Object.assign({},item),after=Object.assign({},item,{inventoryNo:value,updatedAt:now(),updatedBy:me.uid,updatedByName:userName(me.uid)});setBusy(btn,true);
    try{const updates={};updates[`SafetyEquipmentItems/${item.id}`]=after;appendAudit(updates,'item',item.id,'inventory_update','Master inventar raqamini o‘zgartirdi',before,after,item.workZoneId);await db.ref().update(updates);await notifyUsers(recipientUids(TB_ROLES,item.workZoneId),{action:'safety_equipment_inventory',title:`Master ${itemName(item)} inventar raqamini o‘zgartirdi`,item:after,changes:diff(before,after)});closeModal();toast('Inventar raqami saqlandi va TB muhandisiga bildirildi.','success');}catch(e){modalMessage(e.message||String(e));}finally{setBusy(btn,false);}
  }

  function outOfCycleForm(item){
    const content=`<header><i class="fas fa-triangle-exclamation"></i><div><h3>Navbatdan tashqari sinovga yuborish</h3><p>${esc(itemName(item))} · ${esc(item.inventoryNo||'')}</p></div><button data-se-modal-close>×</button></header><div class="hetk-se-dialog-body"><div id="hetk-se-formerror" class="hetk-se-formerror"></div><p class="hetk-se-note warning">Tasdiqlangach vosita satri sariq rangga o‘tadi, TB va Bosh muhandisga bildirishnoma yuboriladi.</p><div class="hetk-se-field"><span>Aniqlangan nuqson yoki sabab *</span><textarea id="hetk-se-out-reason" placeholder="Masalan: qo‘lqop yuzasida yorilish aniqlandi"></textarea></div></div><footer><button class="cancel" data-se-modal-close>Bekor qilish</button><button id="hetk-se-out-save" class="save">Sinovga yuborish</button></footer>`;openModal(content);byId('hetk-se-out-save').addEventListener('click',()=>saveOutOfCycle(item));
  }
  async function saveOutOfCycle(item){
    if(!isMaster()||!accountCoversZone(me,item.workZoneId))return;const reason=fieldValue('hetk-se-out-reason'),btn=byId('hetk-se-out-save');if(!reason)return modalMessage('Aniqlangan nuqson yoki sababni yozing.');const before=Object.assign({},item),stamp=now(),after=Object.assign({},item,{status:'out_of_cycle',outOfCycleReason:reason,outOfCycleRequestedAt:stamp,outOfCycleRequestedBy:me.uid,outOfCycleRequestedByName:userName(me.uid),updatedAt:stamp,updatedBy:me.uid,updatedByName:userName(me.uid)});setBusy(btn,true);
    try{const updates={};updates[`SafetyEquipmentItems/${item.id}`]=after;appendAudit(updates,'item',item.id,'out_of_cycle','Vosita navbatdan tashqari sinovga yuborildi',before,after,item.workZoneId);await db.ref().update(updates);await notifyUsers(recipientUids(new Set(['tb_engineer','regional_tb_engineer','republic_tb_engineer','chief_engineer']),item.workZoneId),{action:'safety_equipment_out_of_cycle',title:`${zoneName(item.workZoneId)}: ${itemName(item)} navbatdan tashqari sinovga yuborildi`,item:after,changes:diff(before,after)});closeModal();toast('Vosita sinovga yuborildi.','success');}catch(e){modalMessage(e.message||String(e));}finally{setBusy(btn,false);}
  }

  function testForm(item){
    if(!canManageTests())return;const today=isoDate(now()),cat=catalogRow(item.catalogId),defaultNext=addInterval(today,cat.intervalValue,cat.intervalUnit);
    const content=`<header><i class="fas fa-flask-vial"></i><div><h3>Sinov natijasini rasmiylashtirish</h3><p>${esc(itemName(item))} · ${esc(item.inventoryNo||'')} · ${esc(zoneName(item.workZoneId))}</p></div><button data-se-modal-close>×</button></header><div class="hetk-se-dialog-body"><div id="hetk-se-formerror" class="hetk-se-formerror"></div>${item.status==='out_of_cycle'?`<p class="hetk-se-note warning"><b>Navbatdan tashqari sinov sababi:</b> ${esc(item.outOfCycleReason||'Ko‘rsatilmagan')}</p>`:''}<div class="hetk-se-result-options"><label><input type="radio" name="hetk-se-test-result" value="passed" checked><span class="pass"><i class="fas fa-circle-check"></i>Sinovdan o‘tdi</span></label><label><input type="radio" name="hetk-se-test-result" value="failed"><span class="fail"><i class="fas fa-circle-xmark"></i>Yaroqsiz deb topildi</span></label></div><div class="hetk-se-formgrid"><div class="hetk-se-field"><span>Sinov sanasi *</span><input id="hetk-se-test-date" type="date" value="${today}"></div><div class="hetk-se-field" id="hetk-se-test-next-wrap"><span>Keyingi sinov muddati *</span><input id="hetk-se-test-next" type="date" value="${attr(defaultNext)}"><small>Umumiy ro‘yxatdagi ${esc(intervalText(cat))} oraliq bo‘yicha hisoblandi.</small></div><div class="hetk-se-field"><span>Bayonnoma / dalolatnoma raqami</span><input id="hetk-se-test-protocol" placeholder="Masalan: 42/2026"></div><div class="hetk-se-field full"><span>Sinov xulosasi / izoh</span><textarea id="hetk-se-test-note" placeholder="Sinov natijasi bo‘yicha qo‘shimcha ma’lumot"></textarea></div></div></div><footer><button class="cancel" data-se-modal-close>Bekor qilish</button><button id="hetk-se-test-save" class="save">Natijani saqlash</button></footer>`;
    const modal=openModal(content,true);modal.querySelectorAll('[name="hetk-se-test-result"]').forEach(x=>x.addEventListener('change',()=>{byId('hetk-se-test-next-wrap').style.display=x.value==='failed'&&x.checked?'none':'';}));byId('hetk-se-test-date').addEventListener('change',()=>{const next=addInterval(fieldValue('hetk-se-test-date'),cat.intervalValue,cat.intervalUnit);if(next)byId('hetk-se-test-next').value=next;});byId('hetk-se-test-save').addEventListener('click',()=>saveTest(item));
  }
  async function saveTest(item){
    const result=(document.querySelector('[name="hetk-se-test-result"]:checked')||{}).value||'passed',testedAt=fieldValue('hetk-se-test-date'),nextDate=fieldValue('hetk-se-test-next'),protocol=fieldValue('hetk-se-test-protocol'),note=fieldValue('hetk-se-test-note'),btn=byId('hetk-se-test-save');if(!testedAt)return modalMessage('Sinov sanasini kiriting.');if(result==='passed'&&!nextDate)return modalMessage('Keyingi sinov muddatini kiriting.');if(result==='passed'&&parseDate(nextDate)<=parseDate(testedAt))return modalMessage('Keyingi sinov sanasi sinov sanasidan keyin bo‘lishi kerak.');
    const before=Object.assign({},item),stamp=now(),history=Object.assign({},item.testHistory||{}),historyId=db.ref(`SafetyEquipmentItems/${item.id}/testHistory`).push().key;history[historyId]={id:historyId,result,testedAt,nextTestDate:result==='passed'?nextDate:'',protocolNo:protocol,note,performedAt:stamp,performedBy:me.uid,performedByName:userName(me.uid),performedByRole:roleLabel(me)};
    const after=Object.assign({},item,{lastTestDate:testedAt,nextTestDate:result==='passed'?nextDate:'',lastProtocolNo:protocol,lastTestNote:note,lastTestResult:result,status:result==='passed'?'active':'archived',active:result==='passed',testHistory:history,updatedAt:stamp,updatedBy:me.uid,updatedByName:userName(me.uid)});if(result==='failed'){after.archivedAt=stamp;after.archivedBy=me.uid;after.archivedByName=userName(me.uid);after.archiveReason=note||'Sinovdan yaroqsiz deb topildi';}
    setBusy(btn,true);try{const updates={};updates[`SafetyEquipmentItems/${item.id}`]=after;appendAudit(updates,'item',item.id,result==='passed'?'test_passed':'test_failed',result==='passed'?'Vosita sinovdan o‘tdi, muddati uzaytirildi':'Vosita yaroqsiz deb topilib faol ro‘yxatdan chiqarildi',before,after,item.workZoneId);await db.ref().update(updates);let roles=new Set(['master','tb_engineer','regional_tb_engineer','republic_tb_engineer','chief_engineer']);if(role()==='tb_engineer')roles=new Set(['master','regional_tb_engineer','republic_tb_engineer','chief_engineer']);await notifyUsers(recipientUids(roles,item.workZoneId),{action:result==='passed'?'safety_equipment_test_passed':'safety_equipment_test_failed',title:result==='passed'?`${itemName(item)} sinovdan o‘tdi — yangi muddat ${fmtDate(nextDate)}`:`${itemName(item)} yaroqsiz deb topildi va U/J faol ro‘yxatidan chiqarildi`,item:after,changes:diff(before,after)});closeModal();statusFilter=result==='failed'?'archived':'active';toast(result==='passed'?'Sinov natijasi va yangi muddat saqlandi.':'Vosita yaroqsizlar arxiviga o‘tkazildi.','success');}catch(e){modalMessage(e.message||String(e));}finally{setBusy(btn,false);}
  }

  function catalogForm(row){
    const editing=!!row;const content=`<header><i class="fas fa-book"></i><div><h3>${editing?'Umumiy ro‘yxatni tahrirlash':'Umumiy ro‘yxatga vosita qo‘shish'}</h3><p>Bu ma’lumot butun tizim uchun universal bo‘ladi.</p></div><button data-se-modal-close>×</button></header><div class="hetk-se-dialog-body"><div id="hetk-se-formerror" class="hetk-se-formerror"></div><div class="hetk-se-formgrid"><div class="hetk-se-field full"><span>Himoya vositasi nomi *</span><input id="hetk-se-cat-name" value="${attr(row&&row.name||'')}" placeholder="Masalan: Dielektrik qo‘lqop"></div><div class="hetk-se-field"><span>Sinov oralig‘i *</span><input id="hetk-se-cat-value" type="number" min="1" step="1" value="${attr(row&&row.intervalValue||'')}" placeholder="Masalan: 6"></div><div class="hetk-se-field"><span>Birligi *</span><select id="hetk-se-cat-unit"><option value="day"${row&&row.intervalUnit==='day'?' selected':''}>Kun</option><option value="month"${!row||!row.intervalUnit||row.intervalUnit==='month'?' selected':''}>Oy</option><option value="year"${row&&row.intervalUnit==='year'?' selected':''}>Yil</option></select></div><div class="hetk-se-field full"><span>Tahrirlash kodi *</span><input id="hetk-se-cat-code" type="password" inputmode="numeric" autocomplete="off" placeholder="Maxsus kod"><small>${settings.catalogEditCodeHash?'Amaldagi kodni kiriting.':'Birinchi saqlashda shu kod o‘rnatiladi (kamida 4 belgi).'}</small></div></div></div><footer><button class="cancel" data-se-modal-close>Bekor qilish</button><button id="hetk-se-cat-save" class="save">Saqlash</button></footer>`;openModal(content);byId('hetk-se-cat-save').addEventListener('click',()=>saveCatalog(row&&row.id||''));
  }
  async function sha256(value){const bytes=new TextEncoder().encode(String(value));const hash=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,'0')).join('');}
  async function verifyCatalogCode(code,allowCreate){
    if(!code||code.length<4)throw new Error('Tahrirlash kodi kamida 4 belgidan iborat bo‘lsin.');const hash=await sha256(code);
    if(settings.catalogEditCodeHash){if(hash!==settings.catalogEditCodeHash)throw new Error('Tahrirlash kodi noto‘g‘ri.');return {hash,isNew:false};}
    if(!allowCreate)throw new Error('Avval tahrirlash kodini o‘rnating.');return {hash,isNew:true};
  }
  async function saveCatalog(id){
    if(!canManageCatalog())return;const name=fieldValue('hetk-se-cat-name'),value=Number(fieldValue('hetk-se-cat-value')),unit=fieldValue('hetk-se-cat-unit'),code=fieldValue('hetk-se-cat-code'),btn=byId('hetk-se-cat-save');if(!name)return modalMessage('Vosita nomini kiriting.');if(!Number.isInteger(value)||value<1)return modalMessage('Sinov oralig‘ini musbat butun son bilan kiriting.');if(!UNIT_LABELS[unit])return modalMessage('Oraliq birligini tanlang.');
    setBusy(btn,true);try{const verified=await verifyCatalogCode(code,true);const duplicate=Object.keys(catalog).some(key=>key!==id&&catalog[key]&&catalog[key].active!==false&&String(catalog[key].name||'').trim().toLocaleLowerCase('uz')===name.toLocaleLowerCase('uz'));if(duplicate)throw new Error('Bu nomdagi vosita umumiy ro‘yxatda mavjud.');const before=id?Object.assign({},catalog[id]||{}):{};if(!id)id=db.ref('SafetyEquipmentCatalog').push().key;const stamp=now(),after=Object.assign({},before,{id,name,intervalValue:value,intervalUnit:unit,active:before.active!==false,updatedAt:stamp,updatedBy:me.uid,updatedByName:userName(me.uid),updatedByRole:roleLabel(me)});if(!before.createdAt){after.createdAt=stamp;after.createdBy=me.uid;}
      const updates={};updates[`SafetyEquipmentCatalog/${id}`]=after;if(verified.isNew)updates['SafetyEquipmentSettings/catalogEditCodeHash']=verified.hash;appendAudit(updates,'catalog',id,before.id?'catalog_update':'catalog_create',before.id?'Umumiy himoya vositasi me’yori tahrirlandi':'Umumiy ro‘yxatga himoya vositasi qo‘shildi',before,after,'');await db.ref().update(updates);await notifyUsers(allTbUids(),{action:before.id?'safety_equipment_catalog_update':'safety_equipment_catalog_create',title:before.id?`${name} me’yoriy ma’lumoti o‘zgardi`:`Umumiy ro‘yxatga ${name} qo‘shildi`,item:{equipmentName:name,workZoneId:''},changes:diff(before,after)});closeModal();toast('Umumiy ro‘yxat saqlandi va TB muhandislariga bildirildi.','success');}catch(e){modalMessage(e.message||String(e));}finally{setBusy(btn,false);}
  }
  function codeForm(){
    const content=`<header><i class="fas fa-key"></i><div><h3>Tahrirlash kodini ${settings.catalogEditCodeHash?'almashtirish':'o‘rnatish'}</h3><p>Kod ochiq matn ko‘rinishida bazada saqlanmaydi.</p></div><button data-se-modal-close>×</button></header><div class="hetk-se-dialog-body"><div id="hetk-se-formerror" class="hetk-se-formerror"></div><div class="hetk-se-formgrid">${settings.catalogEditCodeHash?'<div class="hetk-se-field full"><span>Amaldagi kod *</span><input id="hetk-se-old-code" type="password" inputmode="numeric"></div>':''}<div class="hetk-se-field"><span>Yangi kod *</span><input id="hetk-se-new-code" type="password" inputmode="numeric"></div><div class="hetk-se-field"><span>Yangi kodni takrorlang *</span><input id="hetk-se-new-code2" type="password" inputmode="numeric"></div></div></div><footer><button class="cancel" data-se-modal-close>Bekor qilish</button><button id="hetk-se-code-save" class="save">Kodni saqlash</button></footer>`;openModal(content);byId('hetk-se-code-save').addEventListener('click',saveCode);
  }
  async function saveCode(){
    const old=fieldValue('hetk-se-old-code'),fresh=fieldValue('hetk-se-new-code'),fresh2=fieldValue('hetk-se-new-code2'),btn=byId('hetk-se-code-save');if(fresh!==fresh2)return modalMessage('Yangi kodlar bir xil emas.');if(fresh.length<4)return modalMessage('Yangi kod kamida 4 belgidan iborat bo‘lsin.');setBusy(btn,true);
    try{if(settings.catalogEditCodeHash)await verifyCatalogCode(old,false);const hash=await sha256(fresh),stamp=now(),before={catalogEditCodeHash:settings.catalogEditCodeHash?'O‘rnatilgan':'O‘rnatilmagan'},after={catalogEditCodeHash:'O‘rnatilgan'};const updates={'SafetyEquipmentSettings/catalogEditCodeHash':hash,'SafetyEquipmentSettings/catalogEditCodeUpdatedAt':stamp,'SafetyEquipmentSettings/catalogEditCodeUpdatedBy':me.uid};appendAudit(updates,'settings','catalog_code','code_update','Umumiy ro‘yxat tahrirlash kodi yangilandi',before,after,'');await db.ref().update(updates);await notifyUsers(allTbUids(),{action:'safety_equipment_code_update',title:'Himoya vositalari umumiy ro‘yxatining tahrirlash kodi yangilandi',item:{equipmentName:'Tahrirlash kodi'},changes:diff(before,after)});closeModal();toast('Tahrirlash kodi yangilandi.','success');}catch(e){modalMessage(e.message||String(e));}finally{setBusy(btn,false);}
  }
  function catalogStatusForm(row,restore){
    const content=`<header><i class="fas fa-${restore?'rotate-left':'box-archive'}"></i><div><h3>${restore?'Vosita turini faollashtirish':'Vosita turini ro‘yxatdan chiqarish'}</h3><p>${esc(row.name||'')}</p></div><button data-se-modal-close>×</button></header><div class="hetk-se-dialog-body"><div id="hetk-se-formerror" class="hetk-se-formerror"></div><p class="hetk-se-note warning">Mavjud U/J vositalari va tarix o‘chmaydi. Faqat yangi biriktirish ro‘yxatidagi holat o‘zgaradi.</p><div class="hetk-se-field"><span>Tahrirlash kodi *</span><input id="hetk-se-cat-status-code" type="password" inputmode="numeric"></div></div><footer><button class="cancel" data-se-modal-close>Bekor qilish</button><button id="hetk-se-cat-status-save" class="${restore?'save':'danger'}">${restore?'Faollashtirish':'Ro‘yxatdan chiqarish'}</button></footer>`;openModal(content);byId('hetk-se-cat-status-save').addEventListener('click',()=>saveCatalogStatus(row,restore));
  }
  async function saveCatalogStatus(row,restore){
    const btn=byId('hetk-se-cat-status-save');setBusy(btn,true);try{await verifyCatalogCode(fieldValue('hetk-se-cat-status-code'),false);const before=Object.assign({},row),after=Object.assign({},row,{active:!!restore,updatedAt:now(),updatedBy:me.uid,updatedByName:userName(me.uid),updatedByRole:roleLabel(me)}),updates={};updates[`SafetyEquipmentCatalog/${row.id}`]=after;appendAudit(updates,'catalog',row.id,restore?'catalog_restore':'catalog_disable',restore?'Umumiy ro‘yxatdagi vosita turi faollashtirildi':'Umumiy ro‘yxatdagi vosita turi chiqarildi',before,after,'');await db.ref().update(updates);await notifyUsers(allTbUids(),{action:restore?'safety_equipment_catalog_restore':'safety_equipment_catalog_disable',title:`${row.name} — ${restore?'umumiy ro‘yxatda faollashtirildi':'umumiy ro‘yxatdan chiqarildi'}`,item:{equipmentName:row.name},changes:diff(before,after)});closeModal();toast('Umumiy ro‘yxat yangilandi.','success');}catch(e){modalMessage(e.message||String(e));}finally{setBusy(btn,false);}
  }

  function displayValue(key,value){if(key==='workZoneId')return zoneName(value);if(key==='catalogId')return catalogRow(value).name||value||'—';if(key==='lastTestDate'||key==='nextTestDate')return fmtDate(value);if(key==='status')return STATUS_LABELS[value]||value||'—';if(key==='active')return value===false?'Yo‘q':'Ha';if(key==='intervalUnit')return UNIT_LABELS[value]||value||'—';return value==null||value===''?'—':String(value);}
  function diff(before,after){
    const ignore=new Set(['id','createdAt','createdBy','createdByName','updatedAt','updatedBy','updatedByName','updatedByRole','testHistory']);const keys=new Set([...Object.keys(before||{}),...Object.keys(after||{})]),rows=[];
    keys.forEach(key=>{if(ignore.has(key)||typeof (before||{})[key]==='object'||typeof (after||{})[key]==='object')return;const a=displayValue(key,(before||{})[key]),b=displayValue(key,(after||{})[key]);if(a!==b)rows.push({label:FIELD_LABELS[key]||key,before:a,after:b});});return rows;
  }
  function changesObject(rows){const out={};(rows||[]).forEach((r,i)=>out[i]=r);return out;}
  function appendAudit(updates,entityType,entityId,action,label,before,after,workZoneId){const id=db.ref('SafetyEquipmentAudit').push().key;updates[`SafetyEquipmentAudit/${id}`]={id,entityType,entityId,action,label,workZoneId:workZoneId||'',actorUid:me.uid,actorName:userName(me.uid),actorRole:roleLabel(me),changes:changesObject(diff(before,after)),createdAt:now()};}
  function recipientUids(roles,workZoneId,includeCurrent){
    const found=new Set();Object.keys(users).forEach(uid=>{const u=users[uid]||{};if(u.active===false||!roles.has(u.role))return;if(workZoneId&&u.role!=='republic_tb_engineer'&&!accountCoversZone(u,workZoneId))return;found.add(uid);});
    if(roles.has('master')&&workZoneId&&zones[workZoneId]&&zones[workZoneId].currentMasterUid)found.add(zones[workZoneId].currentMasterUid);if(me&&!includeCurrent)found.delete(me.uid);return Array.from(found);
  }
  function allTbUids(){return Object.keys(users).filter(uid=>users[uid]&&users[uid].active!==false&&TB_ROLES.has(users[uid].role)&&(!me||uid!==me.uid));}
  async function notifyUsers(uids,opts){
    const unique=Array.from(new Set((uids||[]).filter(Boolean)));if(!unique.length)return;const stamp=now(),updates={};unique.forEach(uid=>{const id=db.ref(`UserNotifications/${uid}`).push().key;updates[`UserNotifications/${uid}/${id}`]={id,kind:'activity',action:opts.action||'safety_equipment',read:false,title:opts.title||'Himoya vositasi ma’lumoti yangilandi',actorUid:me&&me.uid||'',actorName:me?userName(me.uid):'Tizim',actorRole:me?roleLabel(me):'Avtomatik nazorat',elementName:itemName(opts.item||{}),folderPath:opts.item&&opts.item.workZoneId?zoneName(opts.item.workZoneId):'Himoya vositalari',changes:changesObject(opts.changes||[]),createdAt:stamp,expiresAt:stamp+NOTICE_LIFETIME};});await db.ref().update(updates);if(window.HETKPush&&window.HETKPush.safeSendToUsers)await window.HETKPush.safeSendToUsers(unique,'notifications','Himoya vositalari',opts.title||'Yangi bildirishnoma',{action:opts.action||'safety_equipment'});
  }

  function scheduleReminderScan(){clearTimeout(reminderTimer);reminderTimer=setTimeout(scanReminders,1400);}
  async function claimReminder(item,rule,uid){
    const due=String(item.nextTestDate||'no-date').replace(/[^0-9-]/g,''),token=`${me&&me.uid||'system'}_${now()}_${Math.random().toString(36).slice(2)}`,ref=db.ref(`SafetyEquipmentReminderMarks/${item.id}/${due}/${rule}/${uid}`);const result=await ref.transaction(value=>value===null?{token,createdAt:now(),createdBy:me&&me.uid||''}:undefined);return !!(result.committed&&result.snapshot&&result.snapshot.val()&&result.snapshot.val().token===token);
  }
  async function scanReminders(){
    if(!db||!me||!canView())return;const all=Object.keys(items).map(id=>Object.assign({id},items[id]||{})).filter(it=>it.active!==false&&it.status!=='archived'&&it.nextTestDate);
    for(const item of all){const days=daysLeft(item);let rules=[];if(days>=0&&days<=10)rules.push({key:'before10',roles:new Set(days<=5?['master','tb_engineer']:['master','tb_engineer','regional_tb_engineer']),title:`${itemName(item)} sinov muddati tugashiga ${days} kun qoldi`});if(days>=0&&days<=5)rules.push({key:'before5',roles:new Set(['regional_tb_engineer']),title:`Viloyat nazorati: ${itemName(item)} sinov muddati tugashiga ${days} kun qoldi`});if(days<0)rules.push({key:'expired',roles:new Set(['master','tb_engineer','regional_tb_engineer','republic_tb_engineer','chief_engineer']),title:`${itemName(item)} sinov muddati ${Math.abs(days)} kun oldin tugagan`});
      for(const ruleRow of rules){const uids=recipientUids(ruleRow.roles,item.workZoneId,true);for(const uid of uids){try{if(await claimReminder(item,ruleRow.key,uid))await notifyUsers([uid],{action:`safety_equipment_${ruleRow.key}`,title:`${zoneName(item.workZoneId)}: ${ruleRow.title}`,item,changes:[{label:'Keyingi sinov muddati',before:'—',after:fmtDate(item.nextTestDate)}]});}catch(e){console.warn('Himoya vositasi eslatmasi yuborilmadi:',e);}}}
    }
  }

  function handleClick(e){
    if(e.target.closest('[data-se-close]'))return close();const tabBtn=e.target.closest('[data-se-tab]');if(tabBtn){tab=tabBtn.dataset.seTab;return render();}
    if(e.target.closest('[data-se-add]'))return itemForm(null);const edit=e.target.closest('[data-se-edit]');if(edit)return itemForm(Object.assign({id:edit.dataset.seEdit},items[edit.dataset.seEdit]||{}));const inv=e.target.closest('[data-se-inventory]');if(inv)return inventoryForm(Object.assign({id:inv.dataset.seInventory},items[inv.dataset.seInventory]||{}));const out=e.target.closest('[data-se-out]');if(out)return outOfCycleForm(Object.assign({id:out.dataset.seOut},items[out.dataset.seOut]||{}));const test=e.target.closest('[data-se-test]');if(test)return testForm(Object.assign({id:test.dataset.seTest},items[test.dataset.seTest]||{}));
    if(e.target.closest('[data-se-catalog-add]'))return catalogForm(null);const ce=e.target.closest('[data-se-catalog-edit]');if(ce)return catalogForm(Object.assign({id:ce.dataset.seCatalogEdit},catalog[ce.dataset.seCatalogEdit]||{}));const cd=e.target.closest('[data-se-catalog-disable]');if(cd)return catalogStatusForm(Object.assign({id:cd.dataset.seCatalogDisable},catalog[cd.dataset.seCatalogDisable]||{}),false);const cr=e.target.closest('[data-se-catalog-restore]');if(cr)return catalogStatusForm(Object.assign({id:cr.dataset.seCatalogRestore},catalog[cr.dataset.seCatalogRestore]||{}),true);if(e.target.closest('[data-se-code]'))return codeForm();
  }
  function handleInput(e){if(e.target.id==='hetk-se-search'){searchText=e.target.value;renderItems();const input=byId('hetk-se-search');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}}if(e.target.id==='hetk-se-catalog-search'){const value=e.target.value;const rows=Object.keys(catalog).map(id=>Object.assign({id},catalog[id]||{})).filter(x=>String(x.name||'').toLocaleLowerCase('uz').includes(value.toLocaleLowerCase('uz')));const table=e.target.closest('section').querySelector('.hetk-se-tablewrap,.hetk-se-empty');if(table)table.outerHTML=catalogTable(rows);}}
  function handleChange(e){if(e.target.id==='hetk-se-zone-filter'){zoneFilter=e.target.value;renderItems();}if(e.target.id==='hetk-se-status-filter'){statusFilter=e.target.value;renderItems();}}
  function bindRef(path,setter){const ref=db.ref(path),handler=snap=>{setter(snap.val()||{});setButton();if(byId('hetk-se-overlay')&&byId('hetk-se-overlay').classList.contains('open'))render();scheduleReminderScan();};ref.on('value',handler);refs.push([ref,handler]);}
  function unbind(){refs.forEach(([ref,handler])=>ref.off('value',handler));refs=[];clearTimeout(reminderTimer);if(reminderInterval)clearInterval(reminderInterval);reminderInterval=null;}
  function start(account){
    me=account;if(!window.firebase||!firebase.apps||!firebase.apps.length)return;db=firebase.database();buildShell();unbind();bindRef('users',v=>{users=v;if(me&&users[me.uid]){me=Object.assign({uid:me.uid},users[me.uid]);if(window.HETKAuth)window.HETKAuth.currentUser=me;}});bindRef('Folders',v=>folders=v);bindRef('WorkZones',v=>zones=v);bindRef('SafetyEquipmentCatalog',v=>catalog=v);bindRef('SafetyEquipmentItems',v=>items=v);bindRef('SafetyEquipmentSettings',v=>settings=v);bindRef('SafetyEquipmentAudit',v=>audits=v);reminderInterval=setInterval(scanReminders,6*60*60*1000);setButton();
  }
  function clear(){unbind();me=null;users={};folders={};zones={};catalog={};items={};settings={};audits={};setButton();close();}
  function init(){buildShell();const btn=byId('hetk-safety-equipment-open');if(btn)btn.addEventListener('click',open);document.addEventListener('hetk-auth-ready',e=>start(e.detail&&e.detail.user));document.addEventListener('hetk-auth-user-updated',e=>start(e.detail&&e.detail.user));document.addEventListener('hetk-auth-cleared',clear);if(window.HETKAuth&&window.HETKAuth.currentUser)start(window.HETKAuth.currentUser);}
  window.HETKSafetyEquipment={open,close,scanReminders};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
