(function(){
  'use strict';

  const STATUS={
    draft:'Qoralama',pending_issue:'Berishga yuborilgan',issued:'Naryad berildi',
    preparation_permitted:'Tayyorlashga ruxsat',workplace_ready:'Ish joyi tayyor',active:'Ishga qo‘yildi',
    performer_completed:'Bajaruvchi tugatdi',ready_to_close:'Yopishga tayyor',closed:'Yopilgan',
    rejected:'Qaytarilgan',cancelled:'Bekor qilingan'
  };
  const RIGHTS={
    draftNaryad:{label:'Naryad qoralamasini tuzish',min:1},
    issueNaryad:{label:'Naryad berish',min:5},
    permitPreparation:{label:'Ish joyini tayyorlashga ruxsat berish',min:4},
    prepareWorkplace:{label:'Ish joyini tayyorlash',min:4},
    admitWork:{label:'Brigadani ishga qo‘yish',min:4},
    workLeader:{label:'Ish rahbari bo‘lish',min:5},
    workPerformer:{label:'Ish bajaruvchi bo‘lish',min:4},
    observer:{label:'Kuzatuvchi bo‘lish',min:3},
    issueOrder:{label:'Farmoyish berish (keyingi bosqich)',min:4}
  };
  const MANAGERS=new Set(['super_admin','director','chief_engineer']);
  const OPERATIONAL_ROLES=new Set(['super_admin','director','chief_engineer','chief_dispatcher','dispatcher','master','electrician','employee','pto_engineer']);
  const DAY=24*60*60*1000;
  const LEXUZ_URL='https://lex.uz/uz/docs/-5038211';

  let db=null;
  let me=null;
  let users={};
  let folders={};
  let tps={};
  let naryads={};
  let currentTab='list';
  let selectedId='';
  let editingId='';
  let selectedRightsUid='';
  let refs=[];
  let toastTimer=null;

  function esc(value){return String(value===undefined||value===null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function attr(value){return esc(value);}
  function byId(id){return document.getElementById(id);}
  function now(){return Date.now();}
  function roleLabel(user){
    if(!user) return 'Hodim';
    if(window.HETKAuth&&window.HETKAuth.getAccountRoleLabel) return window.HETKAuth.getAccountRoleLabel(user);
    return user.roleLabel||user.role||'Hodim';
  }
  function groupNumber(value){return ({I:1,II:2,III:3,IV:4,V:5})[String(value||'I').toUpperCase()]||1;}
  function safetyGroup(user){return window.HETKAuth&&window.HETKAuth.getSafetyGroup?window.HETKAuth.getSafetyGroup(user):((user&&user.safety&&user.safety.group)||'I');}
  function userName(uid){const u=users[uid]||{};return u.fullName||u.login||uid||'—';}
  function fmtTime(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('uz-UZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
  function localInput(value){const d=value?new Date(value):new Date();if(Number.isNaN(d.getTime()))return '';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;}
  function val(id){const el=byId(id);return el?String(el.value||'').trim():'';}
  function checked(id){const el=byId(id);return !!(el&&el.checked);}
  function objectKeysTrue(value){return Object.keys(value||{}).filter(k=>value[k]);}
  function managementUser(user){return !!(user&&(user.rootAccess||MANAGERS.has(user.role)));}
  function canManageRights(){return managementUser(me);}
  function canDraft(){return !!(me&&(managementUser(me)||me.role==='master'||me.role==='chief_dispatcher'||(me.naryadRights&&me.naryadRights.draftNaryad)));}
  function rightRecord(user){return (user&&user.naryadRights)||{};}
  function rightIsCurrent(user,key){
    const rights=rightRecord(user);
    if(rights[key]!==true)return false;
    if(rights.validUntil){const end=new Date(rights.validUntil+'T23:59:59').getTime();if(!Number.isNaN(end)&&end<now())return false;}
    return true;
  }
  function hasLiveWorkPermit(user){
    const list=Object.values((user&&user.safety&&user.safety.specialWorks)||{});
    return list.some(item=>item&&item.decision==='Yuqori kuchlanish ostida');
  }
  function actionEligible(user,key,voltage,quiet){
    if(!user||user.active===false){if(!quiet)throw new Error('Tanlangan hodim faol emas.');return false;}
    if(!rightIsCurrent(user,key)){if(!quiet)throw new Error(`${userName(user.uid)} uchun “${RIGHTS[key].label}” yozma vakolati berilmagan yoki muddati tugagan.`);return false;}
    let min=RIGHTS[key].min;
    if(['prepareWorkplace','admitWork','workPerformer'].includes(key)&&voltage==='low')min=3;
    const group=safetyGroup(user);
    if(groupNumber(group)<min){if(!quiet)throw new Error(`${userName(user.uid)}ning amaldagi XTB guruhi ${group}. Bu vazifa uchun kamida ${['','I','II','III','IV','V'][min]} guruh kerak.`);return false;}
    return true;
  }
  function toast(message,type){
    const box=byId('hetk-naryad-toast');if(!box)return;
    box.textContent=message;box.className=`hetk-naryad-toast ${type||''} show`;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>box.classList.remove('show'),3600);
  }
  function errorBox(message){const el=byId('hetk-naryad-form-error');if(!el){toast(message,'error');return;}el.textContent=message;el.classList.add('show');el.scrollIntoView({behavior:'smooth',block:'center'});}
  function clearError(){const el=byId('hetk-naryad-form-error');if(el){el.textContent='';el.classList.remove('show');}}

  function buildShell(){
    if(byId('hetk-naryad-overlay'))return;
    const overlay=document.createElement('div');
    overlay.id='hetk-naryad-overlay';overlay.className='hetk-naryad-overlay';overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML=`<section class="hetk-naryad-shell" role="dialog" aria-modal="true" aria-labelledby="hetk-naryad-heading">
      <header class="hetk-naryad-topbar">
        <div class="hetk-naryad-title"><i class="fas fa-file-signature"></i><div><h2 id="hetk-naryad-heading">Elektron naryadlar</h2><p>638-son Qoidaning 3-ilova shakli asosida</p></div></div>
        <button type="button" class="hetk-naryad-close" data-n-close aria-label="Yopish">×</button>
      </header>
      <nav id="hetk-naryad-nav" class="hetk-naryad-nav"></nav>
      <main id="hetk-naryad-body" class="hetk-naryad-body"></main>
    </section><div id="hetk-naryad-toast" class="hetk-naryad-toast"></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',handleClick);
    overlay.addEventListener('input',handleInput);
    overlay.addEventListener('change',handleChange);
    overlay.addEventListener('submit',handleSubmit);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay.classList.contains('open'))close();});
  }
  function setButton(){
    const btn=byId('hetk-naryad-open');if(!btn)return;
    btn.hidden=!(me&&me.active!==false&&OPERATIONAL_ROLES.has(me.role));
    const pending=Object.values(naryads).filter(n=>n&&requiresMyAction(n)).length;
    const badge=byId('hetk-naryad-count');if(badge){badge.textContent=pending>99?'99+':String(pending);badge.hidden=pending===0;}
  }
  function open(){
    if(!me)return;
    buildShell();byId('hetk-naryad-overlay').classList.add('open');byId('hetk-naryad-overlay').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
    currentTab='list';selectedId='';editingId='';render();
  }
  function close(){const el=byId('hetk-naryad-overlay');if(el){el.classList.remove('open');el.setAttribute('aria-hidden','true');}document.body.style.overflow='';}
  function renderNav(){
    const nav=byId('hetk-naryad-nav');if(!nav)return;
    const items=[['list','fa-list','Naryadlar']];
    if(canDraft())items.push(['new','fa-plus-circle',editingId?'Qoralamani tahrirlash':'Yangi naryad']);
    if(canManageRights())items.push(['rights','fa-user-shield','Vakolatlar']);
    nav.innerHTML=items.map(([id,icon,label])=>`<button type="button" class="hetk-naryad-tab ${currentTab===id?'active':''}" data-n-tab="${id}"><i class="fas ${icon}"></i> ${label}</button>`).join('');
  }
  function notice(){return `<div class="hetk-naryad-notice"><i class="fas fa-shield-alt"></i><span><b>Sinov rejimi.</b> Modul <a href="${LEXUZ_URL}" target="_blank" rel="noopener">VMning 638-son qarori</a>dagi naryad shakli va tashkiliy ketma-ketlikka tayangan. Hozirgi “tasdiq” tizim qaydi bo‘lib, malakali elektron imzo o‘rnini bosmaydi.</span></div>`;}
  function render(){
    if(!byId('hetk-naryad-body'))return;renderNav();
    if(selectedId&&naryads[selectedId])renderDetail(naryads[selectedId]);
    else if(currentTab==='new')renderForm(editingId&&naryads[editingId]);
    else if(currentTab==='rights')renderRights();
    else renderList();
  }

  function tpFolderIds(tp){const ids=new Set();objectKeysTrue(tp&&tp.folders).forEach(id=>ids.add(id));if(tp&&tp.folderId)ids.add(tp.folderId);if(tp&&tp.primaryFolderId)ids.add(tp.primaryFolderId);return Array.from(ids);}
  function canAccessTp(tp){
    if(!me||!tp)return false;if(me.rootAccess||['super_admin','director','chief_engineer','chief_dispatcher','dispatcher'].includes(me.role))return true;
    const ids=tpFolderIds(tp);return ids.some(id=>window.HETKAuth&&window.HETKAuth.canAccessFolder&&window.HETKAuth.canAccessFolder(id,folders));
  }
  function folderPath(id){const names=[];const seen=new Set();let cur=id;while(cur&&folders[cur]&&!seen.has(cur)){seen.add(cur);names.unshift(folders[cur].name||cur);cur=folders[cur].parentId;}return names.join(' / ');}
  function tpPath(tp){const id=(tp&&tp.primaryFolderId)||tpFolderIds(tp)[0];return id?folderPath(id):'Papka biriktirilmagan';}
  function selected(value,current){return String(value||'')===String(current||'')?' selected':'';}
  function userOption(uid,selectedUid){const u=users[uid];return `<option value="${attr(uid)}"${selected(uid,selectedUid)}>${esc(userName(uid))} — ${esc(roleLabel(u))} — ${esc(safetyGroup(u))} guruh</option>`;}
  function eligibleUsers(key,voltage){return Object.keys(users).filter(uid=>actionEligible(Object.assign({uid},users[uid]),key,voltage,true)).sort((a,b)=>userName(a).localeCompare(userName(b),'uz'));}
  function optionsFor(key,voltage,current,optional){const ids=eligibleUsers(key,voltage);return `${optional?'<option value="">Tayinlanmaydi</option>':'<option value="">Tanlang</option>'}${ids.map(uid=>userOption(uid,current)).join('')}`;}
  function brigadeCheckboxes(selectedMap,condition){
    const rows=Object.keys(users).filter(uid=>users[uid]&&users[uid].active!==false&&groupNumber(safetyGroup(users[uid]))>=(condition==='live'?3:2)).sort((a,b)=>userName(a).localeCompare(userName(b),'uz'));
    return rows.map(uid=>`<label class="hetk-naryad-check"><input type="checkbox" data-n-brigade="${attr(uid)}"${selectedMap&&selectedMap[uid]?' checked':''}><span>${esc(userName(uid))}<small>${esc(roleLabel(users[uid]))} · ${esc(safetyGroup(users[uid]))} guruh</small></span></label>`).join('')||'<p class="hetk-naryad-field-help">Mos malaka guruhidagi faol hodim topilmadi.</p>';
  }
  function visibleTps(query){const q=String(query||'').toLocaleLowerCase('uz');return Object.keys(tps).filter(id=>canAccessTp(tps[id])).filter(id=>!q||`${tps[id].name||''} ${tpPath(tps[id])}`.toLocaleLowerCase('uz').includes(q)).sort((a,b)=>String(tps[a].name||'').localeCompare(String(tps[b].name||''),'uz'));}
  function tpOptions(current,query){const ids=visibleTps(query);return '<option value="">Elementni tanlang</option>'+ids.map(id=>`<option value="${attr(id)}"${selected(id,current)}>${esc(tps[id].name||id)} — ${esc(tpPath(tps[id]))}</option>`).join('');}

  function renderList(){
    const body=byId('hetk-naryad-body');
    body.innerHTML=`${notice()}<div class="hetk-naryad-toolbar"><input id="hetk-naryad-list-search" class="hetk-naryad-search" placeholder="Naryad raqami, element yoki ish bo‘yicha qidirish"><select id="hetk-naryad-list-status" class="hetk-naryad-select"><option value="">Barcha holatlar</option>${Object.keys(STATUS).map(k=>`<option value="${k}">${STATUS[k]}</option>`).join('')}</select><button type="button" class="hetk-naryad-refresh" data-n-refresh><i class="fas fa-sync-alt"></i> Yangilash</button></div><div id="hetk-naryad-list" class="hetk-naryad-list"></div>`;
    refreshList();
  }
  function canView(n){
    if(!n||!me)return false;if(managementUser(me)||['chief_dispatcher','dispatcher'].includes(me.role))return true;
    if(n.createdBy===me.uid)return true;
    if(Object.values(n.assignees||{}).includes(me.uid)||(n.brigade&&n.brigade[me.uid]))return true;
    return objectKeysTrue(n.folderIds).some(id=>window.HETKAuth&&window.HETKAuth.canAccessFolder&&window.HETKAuth.canAccessFolder(id,folders));
  }
  function refreshList(){
    const box=byId('hetk-naryad-list');if(!box)return;
    const q=String((byId('hetk-naryad-list-search')||{}).value||'').toLocaleLowerCase('uz');const status=String((byId('hetk-naryad-list-status')||{}).value||'');
    const items=Object.keys(naryads).map(id=>Object.assign({id},naryads[id]||{})).filter(canView).filter(n=>!status||n.status===status).filter(n=>!q||`${n.number||''} ${n.tpName||''} ${n.workContent||''} ${n.division||''}`.toLocaleLowerCase('uz').includes(q)).sort((a,b)=>Number(b.updatedAt||b.createdAt||0)-Number(a.updatedAt||a.createdAt||0));
    if(!items.length){box.innerHTML='<div class="hetk-naryad-empty"><i class="far fa-clipboard"></i><h3>Naryad topilmadi</h3><p>Qidiruv yoki holat filtrini o‘zgartiring.</p></div>';return;}
    box.innerHTML=items.map(n=>`<article class="hetk-naryad-card" data-n-open="${attr(n.id)}"><div class="hetk-naryad-card-head"><span class="hetk-naryad-card-number">${esc(n.number||'Raqamsiz')}</span><span class="hetk-naryad-status ${attr(n.status)}">${esc(STATUS[n.status]||n.status)}</span></div><h3>${esc(n.tpName||'Element tanlanmagan')}</h3><p>${esc(n.workContent||'Ish mazmuni kiritilmagan')}</p><div class="hetk-naryad-card-meta"><span><i class="far fa-clock"></i> ${esc(fmtTime(n.startAt))}</span><span><i class="fas fa-bolt"></i> ${n.voltage==='low'?'1000 V gacha':'6–10 kV'}</span>${requiresMyAction(n)?'<span><i class="fas fa-bell"></i> Sizning harakatingiz kutilmoqda</span>':''}</div></article>`).join('');
  }

  function renderForm(existing){
    if(!canDraft()){currentTab='list';return render();}
    const n=existing||{};const a=n.assignees||{};const voltage=n.voltage||'high';const condition=n.workCondition||'deenergized';
    const measures=Object.values(n.measures||{});if(!measures.length)measures.push({equipment:'',action:''});
    const start=n.startAt||now()+60*60*1000;const finish=n.endAt||Number(start)+8*60*60*1000;
    byId('hetk-naryad-body').innerHTML=`${notice()}<form id="hetk-naryad-form" class="hetk-naryad-form" novalidate>
      <div class="hetk-naryad-form-head"><i class="fas fa-clipboard-list"></i><div><h3>${existing?'Naryad qoralamasini tahrirlash':'Yangi naryad qoralamasi'}</h3><p>Majburiy maydonlarni to‘ldiring. Naryad faqat vakolatli V guruh hodim tasdiqlagandan keyin berilgan hisoblanadi.</p></div></div>
      <div id="hetk-naryad-form-error" class="hetk-naryad-error"></div>
      <section class="hetk-naryad-section"><h4 class="hetk-naryad-section-title"><i class="fas fa-building"></i> Tashkilot va ish joyi</h4><div class="hetk-naryad-grid three">
        <div class="hetk-naryad-field"><label>Tashkilot *</label><input id="n-org" class="hetk-naryad-input" value="${attr(n.organization||'HETK Navoiy hududiy filiali')}" required></div>
        <div class="hetk-naryad-field"><label>Bo‘linma / tuman *</label><input id="n-division" class="hetk-naryad-input" value="${attr(n.division||(me.workZoneName||me.region||''))}" required></div>
        <div class="hetk-naryad-field"><label>Kuchlanish sinfi *</label><select id="n-voltage" class="hetk-naryad-select"><option value="high"${selected('high',voltage)}>6–10 kV</option><option value="low"${selected('low',voltage)}>1000 V gacha</option></select></div>
        <div class="hetk-naryad-field full"><label>Elementni qidirish</label><input id="n-tp-search" class="hetk-naryad-input" placeholder="Masalan: KTP-577 yoki fider nomi"></div>
        <div class="hetk-naryad-field full"><label>Element / ish joyi *</label><select id="n-tp" class="hetk-naryad-select" required>${tpOptions(n.tpId,'')}</select><small id="n-tp-path" class="hetk-naryad-field-help">${n.tpId&&tps[n.tpId]?esc(tpPath(tps[n.tpId])):'Ruxsat etilgan elementlardan tanlang'}</small></div>
        <div class="hetk-naryad-field"><label>Ish turi *</label><select id="n-condition" class="hetk-naryad-select"><option value="deenergized"${selected('deenergized',condition)}>Kuchlanish olinib</option><option value="near_live"${selected('near_live',condition)}>Kuchlanishli qism yaqinida</option><option value="live"${selected('live',condition)}>Kuchlanish ostida</option></select></div>
        <div class="hetk-naryad-field"><label>Ish mazmuni va aniq joyi *</label><textarea id="n-work" class="hetk-naryad-textarea" placeholder="Nima va qayerda bajariladi">${esc(n.workContent||'')}</textarea></div>
      </div></section>
      <section class="hetk-naryad-section"><h4 class="hetk-naryad-section-title"><i class="fas fa-users-cog"></i> Mas’ul shaxslar va brigada</h4><div class="hetk-naryad-grid three">
        <div class="hetk-naryad-field"><label>Naryad beruvchi * <small>(V guruh)</small></label><select id="n-issuer" class="hetk-naryad-select">${optionsFor('issueNaryad',voltage,a.issuer,false)}</select></div>
        <div class="hetk-naryad-field"><label>Ish rahbari <small>(V guruh)</small></label><select id="n-leader" class="hetk-naryad-select">${optionsFor('workLeader',voltage,a.leader,true)}</select></div>
        <div class="hetk-naryad-field"><label>Tayyorlashga ruxsat beruvchi *</label><select id="n-permitter" class="hetk-naryad-select">${optionsFor('permitPreparation',voltage,a.permitter,false)}</select></div>
        <div class="hetk-naryad-field"><label>Ish joyini tayyorlovchi *</label><select id="n-preparer" class="hetk-naryad-select">${optionsFor('prepareWorkplace',voltage,a.preparer,false)}</select></div>
        <div class="hetk-naryad-field"><label>Ishga qo‘yuvchi *</label><select id="n-admitter" class="hetk-naryad-select">${optionsFor('admitWork',voltage,a.admitter,false)}</select></div>
        <div class="hetk-naryad-field"><label>Ish bajaruvchi *</label><select id="n-performer" class="hetk-naryad-select">${optionsFor('workPerformer',voltage,a.performer,false)}</select></div>
        <div class="hetk-naryad-field"><label>Kuzatuvchi <small>(kamida III guruh)</small></label><select id="n-observer" class="hetk-naryad-select">${optionsFor('observer',voltage,a.observer,true)}</select></div>
        <div class="hetk-naryad-field full"><label>Brigada a’zolari *</label><div id="n-brigade" class="hetk-naryad-check-grid">${brigadeCheckboxes(n.brigade,condition)}</div></div>
      </div></section>
      <section class="hetk-naryad-section"><h4 class="hetk-naryad-section-title"><i class="far fa-calendar-alt"></i> Vaqt va xavfsizlik choralari</h4><div class="hetk-naryad-grid">
        <div class="hetk-naryad-field"><label>Ish boshlanishi *</label><input id="n-start" class="hetk-naryad-input" type="datetime-local" value="${attr(localInput(start))}"></div>
        <div class="hetk-naryad-field"><label>Ish tugashi *</label><input id="n-end" class="hetk-naryad-input" type="datetime-local" value="${attr(localInput(finish))}"><small class="hetk-naryad-field-help">Naryad muddati 15 kalendar kundan oshmaydi.</small></div>
        <div class="hetk-naryad-field full"><label>1-jadval — ish joyini tayyorlash choralari *</label><div id="n-measures" class="hetk-naryad-measures">${measures.map(m=>measureRow(m)).join('')}</div><button type="button" class="hetk-naryad-add-row" data-n-add-measure><i class="fas fa-plus"></i> Chora qo‘shish</button></div>
        <div class="hetk-naryad-field full"><label>Maxsus ko‘rsatmalar</label><textarea id="n-special" class="hetk-naryad-textarea" placeholder="Qo‘shimcha xavfsizlik choralari, navbatchi nazorati va boshqalar">${esc(n.specialInstructions||'')}</textarea></div>
        <div class="hetk-naryad-field full"><div class="hetk-naryad-check-grid"><label class="hetk-naryad-check"><input id="n-outage" type="checkbox"${n.outageRequired?' checked':''}><span>Iste’molchilarni uzish talab qilinadi</span></label><label class="hetk-naryad-check"><input id="n-notify" type="checkbox"${n.consumerNotification?' checked':''}><span>Xabarchi bot uchun ogohlantirish tayyorlansin</span></label></div></div>
      </div></section>
      <div class="hetk-naryad-form-actions"><button type="button" class="hetk-naryad-btn ghost" data-n-cancel-form>Bekor qilish</button><button type="submit" class="hetk-naryad-btn primary"><i class="fas fa-save"></i> Qoralamani saqlash</button></div>
    </form>`;
  }
  function measureRow(m){return `<div class="hetk-naryad-measure"><input class="hetk-naryad-input hetk-measure-equipment" value="${attr(m&&m.equipment||'')}" placeholder="Qurilma nomi"><input class="hetk-naryad-input hetk-measure-action" value="${attr(m&&m.action||'')}" placeholder="Nima uziladi, qayerga yerga ulagich qo‘yiladi"><button type="button" class="hetk-naryad-remove" data-n-remove-measure title="Olib tashlash">×</button></div>`;}
  function refreshRoleOptions(){
    const voltage=val('n-voltage')||'high';const ids={issuer:'issueNaryad',leader:'workLeader',permitter:'permitPreparation',preparer:'prepareWorkplace',admitter:'admitWork',performer:'workPerformer',observer:'observer'};
    Object.keys(ids).forEach(name=>{const el=byId('n-'+name);if(!el)return;const old=el.value;el.innerHTML=optionsFor(ids[name],voltage,old,name==='leader'||name==='observer');});
  }
  function refreshBrigadeOptions(){const el=byId('n-brigade');if(!el)return;const chosen={};el.querySelectorAll('[data-n-brigade]:checked').forEach(input=>chosen[input.dataset.nBrigade]=true);el.innerHTML=brigadeCheckboxes(chosen,val('n-condition'));}
  function collectForm(){
    const tpId=val('n-tp');const tp=tps[tpId]||{};const brigade={};const brigadeEl=byId('n-brigade');if(brigadeEl)brigadeEl.querySelectorAll('[data-n-brigade]:checked').forEach(input=>{const uid=input.dataset.nBrigade;if(uid)brigade[uid]=participant(uid);});
    const measures={};document.querySelectorAll('#n-measures .hetk-naryad-measure').forEach((row,index)=>{const equipment=String((row.querySelector('.hetk-measure-equipment')||{}).value||'').trim();const action=String((row.querySelector('.hetk-measure-action')||{}).value||'').trim();if(equipment||action)measures[index]={equipment,action};});
    const assignees={issuer:val('n-issuer'),leader:val('n-leader'),permitter:val('n-permitter'),preparer:val('n-preparer'),admitter:val('n-admitter'),performer:val('n-performer'),observer:val('n-observer')};
    const people={};Object.keys(assignees).forEach(key=>{if(assignees[key])people[key]=participant(assignees[key]);});
    const folderIds={};tpFolderIds(tp).forEach(id=>folderIds[id]=true);
    return {organization:val('n-org'),division:val('n-division'),tpId,tpName:tp.name||tpId,tpPath:tpPath(tp),folderIds,primaryFolderId:tp.primaryFolderId||tp.folderId||tpFolderIds(tp)[0]||'',voltage:val('n-voltage'),workCondition:val('n-condition'),workContent:val('n-work'),assignees,people,brigade,startAt:new Date(val('n-start')).getTime(),endAt:new Date(val('n-end')).getTime(),measures,specialInstructions:val('n-special'),outageRequired:checked('n-outage'),consumerNotification:checked('n-notify')};
  }
  function participant(uid){const u=users[uid]||{};return {uid,name:userName(uid),role:u.role||'',roleLabel:roleLabel(u),group:safetyGroup(u),certificateNo:(u.safety&&u.safety.certificateNo)||''};}
  function validateDraft(data){
    if(!data.organization||!data.division)throw new Error('Tashkilot va bo‘linmani kiriting.');
    if(!data.tpId||!tps[data.tpId]||!canAccessTp(tps[data.tpId]))throw new Error('Ruxsat etilgan elementni tanlang.');
    if(!data.workContent)throw new Error('Ish mazmuni va aniq joyini kiriting.');
    if(!Number.isFinite(data.startAt)||!Number.isFinite(data.endAt)||data.endAt<=data.startAt)throw new Error('Ishning boshlanish va tugash vaqtini to‘g‘ri kiriting.');
    if(data.endAt-data.startAt>15*DAY)throw new Error('Naryad muddati 15 kalendar kundan oshishi mumkin emas.');
    const required=['issuer','permitter','preparer','admitter','performer'];required.forEach(key=>{if(!data.assignees[key])throw new Error('Barcha majburiy mas’ul shaxslarni tanlang.');});
    actionEligible(Object.assign({uid:data.assignees.issuer},users[data.assignees.issuer]),'issueNaryad',data.voltage);
    actionEligible(Object.assign({uid:data.assignees.permitter},users[data.assignees.permitter]),'permitPreparation',data.voltage);
    actionEligible(Object.assign({uid:data.assignees.preparer},users[data.assignees.preparer]),'prepareWorkplace',data.voltage);
    actionEligible(Object.assign({uid:data.assignees.admitter},users[data.assignees.admitter]),'admitWork',data.voltage);
    actionEligible(Object.assign({uid:data.assignees.performer},users[data.assignees.performer]),'workPerformer',data.voltage);
    if(data.assignees.leader)actionEligible(Object.assign({uid:data.assignees.leader},users[data.assignees.leader]),'workLeader',data.voltage);
    if(data.assignees.observer)actionEligible(Object.assign({uid:data.assignees.observer},users[data.assignees.observer]),'observer',data.voltage);
    if(!Object.keys(data.brigade).length)throw new Error('Kamida bitta brigada a’zosini tanlang.');
    if(!Object.keys(data.measures).length)throw new Error('Ish joyini tayyorlash uchun kamida bitta xavfsizlik chorasini kiriting. Tayyorlash talab qilinmasa, “Talab qilinmaydi” deb yozing.');
    Object.values(data.measures).forEach(m=>{if(!m.equipment||!m.action)throw new Error('Har bir xavfsizlik chorasida qurilma nomi va bajariladigan amal yozilishi kerak.');});
    if(data.workCondition==='live'){
      const performer=Object.assign({uid:data.assignees.performer},users[data.assignees.performer]);
      if(!hasLiveWorkPermit(performer))throw new Error('Kuchlanish ostidagi ish uchun bajaruvchining “Yuqori kuchlanish ostida” maxsus ish ruxsati bo‘lishi kerak.');
      Object.keys(data.brigade).forEach(uid=>{if(groupNumber(safetyGroup(users[uid]))<3)throw new Error('Kuchlanish ostidagi ish brigadasining har bir a’zosi kamida III guruh bo‘lishi kerak.');});
    }
  }
  async function saveDraft(){
    clearError();try{
      const data=collectForm();validateDraft(data);const stamp=now();let id=editingId;let number=editingId&&naryads[editingId]&&naryads[editingId].number;
      if(editingId){const old=naryads[editingId];if(!old||old.status!=='draft'||!(old.createdBy===me.uid||managementUser(me)))throw new Error('Bu qoralamani tahrirlash mumkin emas.');}
      if(!id){id=db.ref('Naryads').push().key;number=await nextNumber();}
      const old=naryads[id]||{};const payload=Object.assign({},old,data,{id,number,status:'draft',formVersion:'638-3-ilova-v1',createdAt:old.createdAt||stamp,createdBy:old.createdBy||me.uid,createdByName:old.createdByName||userName(me.uid),updatedAt:stamp,updatedBy:me.uid,updatedByName:userName(me.uid)});
      const history=Object.assign({},old.history||{});const key=db.ref(`Naryads/${id}/history`).push().key;history[key]={action:old.createdAt?'draft_updated':'draft_created',label:old.createdAt?'Qoralama tahrirlandi':'Qoralama yaratildi',at:stamp,by:me.uid,byName:userName(me.uid),byRole:roleLabel(me)};payload.history=history;
      await db.ref('Naryads/'+id).set(payload);editingId='';selectedId=id;currentTab='list';toast('Naryad qoralamasi saqlandi.','success');render();
    }catch(e){errorBox(e.message||String(e));}
  }
  async function nextNumber(){const year=new Date().getFullYear();const result=await db.ref('NaryadSequences/'+year).transaction(v=>(Number(v)||0)+1);return `N-${year}-${String(result.snapshot.val()).padStart(4,'0')}`;}

  function statusBadge(n){return `<span class="hetk-naryad-status ${attr(n.status)}">${esc(STATUS[n.status]||n.status)}</span>`;}
  function personCard(label,key,n){const p=n.people&&n.people[key];return `<div class="hetk-naryad-person"><i class="fas fa-user"></i><div><small>${esc(label)}</small><b>${p?`${esc(p.name)} · ${esc(p.group)} guruh`:'Tayinlanmagan'}</b></div></div>`;}
  function measuresTable(n){const rows=Object.values(n.measures||{});return `<div class="hetk-naryad-table-wrap"><table class="hetk-naryad-table"><thead><tr><th>№</th><th>Qurilma nomi</th><th>Uzish / yerga ulagich chorasi</th></tr></thead><tbody>${rows.map((m,i)=>`<tr><td>${i+1}</td><td>${esc(m.equipment)}</td><td>${esc(m.action)}</td></tr>`).join('')||'<tr><td colspan="3">Kiritilmagan</td></tr>'}</tbody></table></div>`;}
  function historyHtml(n){const items=Object.values(n.history||{}).sort((a,b)=>Number(b.at||0)-Number(a.at||0));return `<div class="hetk-naryad-history">${items.map(h=>`<div class="hetk-naryad-history-item"><b>${esc(h.label||h.action)}</b><span>${esc(h.byName||'—')} · ${esc(h.byRole||'')} · ${esc(fmtTime(h.at))}</span>${h.note?`<span>${esc(h.note)}</span>`:''}</div>`).join('')||'<p>Harakatlar hali yo‘q.</p>'}</div>`;}
  function renderDetail(n){
    const brigade=Object.values(n.brigade||{});byId('hetk-naryad-body').innerHTML=`<div class="hetk-naryad-detail">
      ${notice()}<div class="hetk-naryad-detail-head"><button type="button" class="hetk-naryad-back" data-n-back><i class="fas fa-arrow-left"></i></button><div class="hetk-naryad-detail-title"><h3>${esc(n.number||'Naryad')}</h3><p>${esc(n.tpName||'')} · ${esc(n.tpPath||'')}</p></div>${statusBadge(n)}</div>
      <section class="hetk-naryad-section"><h4 class="hetk-naryad-section-title"><i class="fas fa-clipboard-check"></i> Naryad ma’lumotlari</h4><div class="hetk-naryad-summary"><div><small>Tashkilot</small><b>${esc(n.organization||'—')}</b></div><div><small>Bo‘linma</small><b>${esc(n.division||'—')}</b></div><div><small>Boshlanishi</small><b>${esc(fmtTime(n.startAt))}</b></div><div><small>Tugashi</small><b>${esc(fmtTime(n.endAt))}</b></div><div><small>Kuchlanish</small><b>${n.voltage==='low'?'1000 V gacha':'6–10 kV'}</b></div><div><small>Ish turi</small><b>${n.workCondition==='live'?'Kuchlanish ostida':n.workCondition==='near_live'?'Kuchlanishli qism yaqinida':'Kuchlanish olinib'}</b></div><div><small>Uzish talab qilinadi</small><b>${n.outageRequired?'Ha':'Yo‘q'}</b></div><div><small>Xabarchi bot</small><b>${n.consumerNotification?'Ogohlantirish tayyorlanadi':'Tanlanmagan'}</b></div></div></section>
      <section class="hetk-naryad-section"><h4 class="hetk-naryad-section-title"><i class="fas fa-tools"></i> Topshiriladi</h4><p>${esc(n.workContent||'—')}</p></section>
      <section class="hetk-naryad-section"><h4 class="hetk-naryad-section-title"><i class="fas fa-users"></i> Mas’ul shaxslar</h4><div class="hetk-naryad-people">${personCard('Naryad beruvchi','issuer',n)}${personCard('Ish rahbari','leader',n)}${personCard('Tayyorlashga ruxsat beruvchi','permitter',n)}${personCard('Ish joyini tayyorlovchi','preparer',n)}${personCard('Ishga qo‘yuvchi','admitter',n)}${personCard('Ish bajaruvchi','performer',n)}${personCard('Kuzatuvchi','observer',n)}</div><h4>Brigada a’zolari</h4><p>${brigade.length?brigade.map(p=>`${esc(p.name)} (${esc(p.group)} guruh)`).join(', '):'—'}</p></section>
      <section class="hetk-naryad-section"><h4 class="hetk-naryad-section-title"><i class="fas fa-shield-alt"></i> 1-jadval — xavfsizlik choralari</h4>${measuresTable(n)}${n.specialInstructions?`<h4>Maxsus ko‘rsatmalar</h4><p>${esc(n.specialInstructions)}</p>`:''}</section>
      ${actionBox(n)}
      <section class="hetk-naryad-section"><h4 class="hetk-naryad-section-title"><i class="fas fa-history"></i> Tasdiqlar va harakatlar tarixi</h4>${historyHtml(n)}</section>
    </div>`;
  }
  function isAssigned(n,key){return !!(me&&n&&n.assignees&&n.assignees[key]===me.uid);}
  function canEditDraft(n){return n.status==='draft'&&me&&(n.createdBy===me.uid||managementUser(me));}
  function requiresMyAction(n){
    if(!me||!n)return false;
    return (n.status==='pending_issue'&&isAssigned(n,'issuer'))||(n.status==='issued'&&isAssigned(n,'permitter'))||(n.status==='preparation_permitted'&&isAssigned(n,'preparer'))||(n.status==='workplace_ready'&&isAssigned(n,'admitter'))||(n.status==='active'&&isAssigned(n,'performer'))||(n.status==='performer_completed'&&(n.assignees&&n.assignees.leader?isAssigned(n,'leader'):isAssigned(n,'performer')))||(n.status==='ready_to_close'&&(isAssigned(n,'permitter')||isAssigned(n,'admitter')));
  }
  function actionBox(n){
    let html='';
    if(canEditDraft(n))html=`<h4>Qoralama tayyor bo‘lsa, naryad beruvchiga yuboring</h4><div class="hetk-naryad-action-row"><button class="hetk-naryad-btn" data-n-action="edit"><i class="fas fa-edit"></i> Tahrirlash</button><button class="hetk-naryad-btn primary" data-n-action="submit"><i class="fas fa-paper-plane"></i> Naryad berishga yuborish</button></div>`;
    else if(n.status==='pending_issue'&&isAssigned(n,'issuer'))html=`<h4>V guruhli naryad beruvchining tasdig‘i kutilmoqda</h4><p>Xavfsizlik choralari, brigada tarkibi va malaka guruhlarini tekshiring.</p><div class="hetk-naryad-action-row"><button class="hetk-naryad-btn success" data-n-action="issue">Naryadni berish</button><button class="hetk-naryad-btn danger" data-n-action="reject">Qoralamaga qaytarish</button></div>`;
    else if(n.status==='issued'&&isAssigned(n,'permitter'))html=`<h4>Ish joyini tayyorlash va ishga qo‘yishga ruxsat</h4><p>Tezkor sxema va boshqa ishlar bilan muvofiqligini tekshirgandan keyin ruxsat bering. Ruxsat oldindan berilmaydi.</p><div class="hetk-naryad-action-row"><button class="hetk-naryad-btn warning" data-n-action="permit">Tayyorlashga ruxsat berish</button></div>`;
    else if(n.status==='preparation_permitted'&&isAssigned(n,'preparer'))html=`<h4>Ish joyini tayyorlash qaydi</h4><p>1-jadvaldagi uzish, to‘sish va yerga ulagich choralari amalda bajarilganini tasdiqlang.</p><label class="hetk-naryad-check"><input id="n-ready-check" type="checkbox"><span>Barcha ko‘rsatilgan xavfsizlik choralari bajarildi</span></label><div class="hetk-naryad-action-row" style="margin-top:10px"><button class="hetk-naryad-btn success" data-n-action="ready">Ish joyi tayyor</button></div>`;
    else if(n.status==='workplace_ready'&&isAssigned(n,'admitter'))html=`<h4>Brigadani ishga qo‘yish</h4><p>Hodimlarning shaxsi va guvohnomalarini tekshiring, ish joyini ko‘rsating va yo‘riqnoma bering.</p><textarea id="n-live-parts" class="hetk-naryad-textarea" placeholder="Ish joyiga yaqin qolgan kuchlanishli qismlar (bo‘lmasa — Yo‘q)"></textarea><div class="hetk-naryad-check-grid" style="margin-top:9px"><label class="hetk-naryad-check"><input id="n-identity-check" type="checkbox"><span>Shaxs va guvohnomalar tekshirildi</span></label><label class="hetk-naryad-check"><input id="n-briefing-check" type="checkbox"><span>Maqsadli yo‘riqnoma berildi</span></label></div><div class="hetk-naryad-action-row" style="margin-top:10px"><button class="hetk-naryad-btn success" data-n-action="admit">Brigadani ishga qo‘yish</button></div>`;
    else if(n.status==='active'&&isAssigned(n,'performer'))html=`<h4>Ish bajarilmoqda</h4><p>Brigada ish joyidan chiqarilib, ish tugagandan keyingina qayd qiling.</p><textarea id="n-complete-note" class="hetk-naryad-textarea" placeholder="Bajarilgan ish va holat haqida izoh"></textarea><label class="hetk-naryad-check" style="margin-top:9px"><input id="n-brigade-left" type="checkbox"><span>Brigada ish joyidan chiqarildi, asbob va materiallar yig‘ildi</span></label><div class="hetk-naryad-action-row" style="margin-top:10px"><button class="hetk-naryad-btn warning" data-n-action="performer_done">Ish tugallandi</button></div>`;
    else if(n.status==='performer_completed'&&n.assignees&&n.assignees.leader&&isAssigned(n,'leader'))html=`<h4>Ish rahbarining yakuniy tekshiruvi</h4><label class="hetk-naryad-check"><input id="n-leader-check" type="checkbox"><span>Ish to‘liq tugagan va ish joyi xavfsiz holatga keltirilgan</span></label><div class="hetk-naryad-action-row" style="margin-top:10px"><button class="hetk-naryad-btn success" data-n-action="leader_done">Yakuniy tasdiq</button></div>`;
    else if(n.status==='performer_completed'&&!n.assignees.leader&&isAssigned(n,'performer'))html=`<h4>Naryadni yopishga yuborish</h4><div class="hetk-naryad-action-row"><button class="hetk-naryad-btn success" data-n-action="leader_done">Yopishga tayyor</button></div>`;
    else if(n.status==='ready_to_close'&&(isAssigned(n,'permitter')||isAssigned(n,'admitter')))html=`<h4>Naryadni yopish va kuchlanish berishga ruxsat</h4><textarea id="n-close-informed" class="hetk-naryad-textarea" placeholder="Ish tugagani haqida kimga xabar berildi"></textarea><div class="hetk-naryad-check-grid" style="margin-top:9px"><label class="hetk-naryad-check"><input id="n-grounding-removed" type="checkbox"><span>Vaqtinchalik yerga ulagichlar olib tashlandi</span></label><label class="hetk-naryad-check"><input id="n-all-reports" type="checkbox"><span>Barcha brigadalardan tugash xabari olindi</span></label></div><div class="hetk-naryad-action-row" style="margin-top:10px"><button class="hetk-naryad-btn success" data-n-action="close">Naryadni yopish</button></div>`;
    else html=`<h4>${n.status==='closed'?'Naryad yopilgan':'Keyingi mas’ul shaxsning harakati kutilmoqda'}</h4><p>${n.status==='closed'?'Yopilgan naryad va uning harakatlar tarixi o‘zgartirilmaydi.':nextResponsible(n)}</p>`;
    return `<section class="hetk-naryad-section"><div class="hetk-naryad-action-box">${html}</div></section>`;
  }
  function nextResponsible(n){const map={pending_issue:'issuer',issued:'permitter',preparation_permitted:'preparer',workplace_ready:'admitter',active:'performer',performer_completed:(n.assignees&&n.assignees.leader?'leader':'performer'),ready_to_close:'permitter'};const key=map[n.status];return key?`${userName(n.assignees&&n.assignees[key])} harakati kutilmoqda.`:'Jarayon yakunlangan.';}

  async function notify(uid,n,title,action){
    if(!uid||uid===me.uid)return;const stamp=now();const id=db.ref(`UserNotifications/${uid}`).push().key;const payload={id,kind:'activity',action,read:false,title,actorUid:me.uid,actorName:userName(me.uid),actorRole:roleLabel(me),elementName:n.tpName||'',folderPath:n.tpPath||'',naryadId:n.id,naryadNumber:n.number,createdAt:stamp,expiresAt:stamp+30*DAY};
    await db.ref(`UserNotifications/${uid}/${id}`).set(payload);
    if(window.HETKPush&&window.HETKPush.safeSendToUsers)window.HETKPush.safeSendToUsers([uid],'notifications','Elektron naryad',title,{action,naryadId:n.id});
  }
  async function transition(n,to,label,patch,nextUid){
    const stamp=now();const key=db.ref(`Naryads/${n.id}/history`).push().key;const updates={};updates[`Naryads/${n.id}/status`]=to;updates[`Naryads/${n.id}/updatedAt`]=stamp;updates[`Naryads/${n.id}/updatedBy`]=me.uid;updates[`Naryads/${n.id}/updatedByName`]=userName(me.uid);updates[`Naryads/${n.id}/history/${key}`]={action:to,label,at:stamp,by:me.uid,byName:userName(me.uid),byRole:roleLabel(me),note:patch&&patch.historyNote||''};
    Object.keys(patch||{}).filter(k=>k!=='historyNote').forEach(k=>updates[`Naryads/${n.id}/${k}`]=patch[k]);
    if(n.tpId){if(to==='closed'||to==='cancelled'||to==='rejected'){updates[`TPs/${n.tpId}/operationalNaryads/${n.id}`]=null;updates[`TPs/${n.tpId}/lastClosedNaryad`]={id:n.id,number:n.number,closedAt:stamp,closedBy:me.uid};}else if(!['draft','pending_issue'].includes(to)){updates[`TPs/${n.tpId}/operationalNaryads/${n.id}`]={id:n.id,number:n.number,status:to,outageRequired:!!n.outageRequired,startAt:n.startAt,endAt:n.endAt,updatedAt:stamp};}}
    await db.ref().update(updates);if(nextUid)await notify(nextUid,n,`${n.number}: ${label}`,to);toast(label,'success');
  }
  function freshUser(uid){return Object.assign({uid},users[uid]||{});}
  async function executeAction(action){
    const n=naryads[selectedId];if(!n)throw new Error('Naryad topilmadi.');
    if(action==='edit'){if(!canEditDraft(n))throw new Error('Tahrirlashga ruxsat yo‘q.');editingId=n.id;selectedId='';currentTab='new';return render();}
    if(action==='submit'){if(!canEditDraft(n))throw new Error('Yuborishga ruxsat yo‘q.');validateDraft(n);return transition(n,'pending_issue','Naryad beruvchiga yuborildi',{},n.assignees.issuer);}
    if(action==='reject'){if(!isAssigned(n,'issuer'))throw new Error('Bu harakat sizga biriktirilmagan.');const reason=prompt('Qaytarish sababini yozing:');if(reason===null)return;if(!reason.trim())throw new Error('Qaytarish sababini kiriting.');return transition(n,'draft','Naryad qoralamaga qaytarildi',{historyNote:reason.trim()},n.createdBy);}
    if(action==='issue'){if(!isAssigned(n,'issuer')||n.status!=='pending_issue')throw new Error('Naryad berish sizga biriktirilmagan.');actionEligible(freshUser(me.uid),'issueNaryad',n.voltage);if(!confirm('Brigada tarkibi, guruhlar va xavfsizlik choralarini tekshirdingizmi?'))return;return transition(n,'issued','Naryad berildi',{issuedAt:now(),issuedBy:me.uid,issuedByName:userName(me.uid)},n.assignees.permitter);}
    if(action==='permit'){if(!isAssigned(n,'permitter')||n.status!=='issued')throw new Error('Ruxsat berish sizga biriktirilmagan.');actionEligible(freshUser(me.uid),'permitPreparation',n.voltage);if(!confirm('Ish joyini hozir tayyorlash mumkinligini tezkor sxema bo‘yicha tekshirdingizmi?'))return;return transition(n,'preparation_permitted','Ish joyini tayyorlashga ruxsat berildi',{preparationPermitAt:now(),preparationPermitBy:me.uid},n.assignees.preparer);}
    if(action==='ready'){if(!isAssigned(n,'preparer')||n.status!=='preparation_permitted')throw new Error('Ish joyini tayyorlash sizga biriktirilmagan.');actionEligible(freshUser(me.uid),'prepareWorkplace',n.voltage);if(!checked('n-ready-check'))throw new Error('Barcha xavfsizlik choralari bajarilganini belgilang.');return transition(n,'workplace_ready','Ish joyi tayyorlandi',{workplaceReadyAt:now(),workplaceReadyBy:me.uid},n.assignees.admitter);}
    if(action==='admit'){if(!isAssigned(n,'admitter')||n.status!=='workplace_ready')throw new Error('Ishga qo‘yish sizga biriktirilmagan.');actionEligible(freshUser(me.uid),'admitWork',n.voltage);const live=val('n-live-parts');if(!live)throw new Error('Yaqin qolgan kuchlanishli qismlarni yozing yoki “Yo‘q” deb kiriting.');if(!checked('n-identity-check')||!checked('n-briefing-check'))throw new Error('Shaxs/guvohnoma tekshiruvi va maqsadli yo‘riqnomani tasdiqlang.');return transition(n,'active','Brigada ishga qo‘yildi',{admittedAt:now(),admittedBy:me.uid,remainingLiveParts:live,identityChecked:true,briefingGiven:true},n.assignees.performer);}
    if(action==='performer_done'){if(!isAssigned(n,'performer')||n.status!=='active')throw new Error('Ishni tugatish qaydi sizga biriktirilmagan.');actionEligible(freshUser(me.uid),'workPerformer',n.voltage);if(!checked('n-brigade-left'))throw new Error('Brigada ish joyidan chiqarilganini tasdiqlang.');const next=n.assignees.leader||n.assignees.permitter;return transition(n,n.assignees.leader?'performer_completed':'ready_to_close','Ish bajaruvchi ishni tugatdi',{performerCompletedAt:now(),performerCompletedBy:me.uid,completionNote:val('n-complete-note'),brigadeLeft:true},next);}
    if(action==='leader_done'){if(n.assignees.leader){if(!isAssigned(n,'leader')||n.status!=='performer_completed')throw new Error('Ish rahbari tasdig‘i sizga biriktirilmagan.');actionEligible(freshUser(me.uid),'workLeader',n.voltage);if(!checked('n-leader-check'))throw new Error('Yakuniy tekshiruvni tasdiqlang.');}else if(!isAssigned(n,'performer'))throw new Error('Bu harakat sizga biriktirilmagan.');return transition(n,'ready_to_close','Ish rahbari yakuniy tasdiq berdi',{leaderCompletedAt:now(),leaderCompletedBy:me.uid},n.assignees.permitter);}
    if(action==='close'){if(!(isAssigned(n,'permitter')||isAssigned(n,'admitter'))||n.status!=='ready_to_close')throw new Error('Naryadni yopish sizga biriktirilmagan.');if(isAssigned(n,'permitter'))actionEligible(freshUser(me.uid),'permitPreparation',n.voltage);else actionEligible(freshUser(me.uid),'admitWork',n.voltage);if(!checked('n-grounding-removed')||!checked('n-all-reports'))throw new Error('Yerga ulagichlar va barcha tugash xabarlarini tasdiqlang.');const informed=val('n-close-informed');if(!informed)throw new Error('Ish tugagani haqida kimga xabar berilganini yozing.');return transition(n,'closed','Naryad yopildi',{closedAt:now(),closedBy:me.uid,closedByName:userName(me.uid),groundingRemoved:true,allReportsReceived:true,informedPerson:informed},n.createdBy);}
  }

  function rightsUsers(query){const q=String(query||'').toLocaleLowerCase('uz');return Object.keys(users).filter(uid=>users[uid]&&users[uid].active!==false).filter(uid=>!q||`${userName(uid)} ${roleLabel(users[uid])}`.toLocaleLowerCase('uz').includes(q)).sort((a,b)=>userName(a).localeCompare(userName(b),'uz'));}
  function renderRights(){
    if(!canManageRights()){currentTab='list';return render();}
    const ids=rightsUsers('');if(!selectedRightsUid||!users[selectedRightsUid])selectedRightsUid=ids[0]||'';
    byId('hetk-naryad-body').innerHTML=`${notice()}<div class="hetk-naryad-rights-layout"><div><input id="n-rights-search" class="hetk-naryad-search hetk-naryad-user-search" placeholder="Hodimni qidirish"><div id="n-rights-users" class="hetk-naryad-user-list"></div></div><div id="n-rights-card"></div></div>`;refreshRightsUsers();renderRightsCard();
  }
  function refreshRightsUsers(){const box=byId('n-rights-users');if(!box)return;const ids=rightsUsers((byId('n-rights-search')||{}).value);box.innerHTML=ids.map(uid=>`<button type="button" class="hetk-naryad-user-item ${uid===selectedRightsUid?'active':''}" data-n-right-user="${attr(uid)}"><i class="fas fa-user"></i><span><b>${esc(userName(uid))}</b><small>${esc(roleLabel(users[uid]))} · ${esc(safetyGroup(users[uid]))} guruh</small></span></button>`).join('')||'<div class="hetk-naryad-empty"><p>Hodim topilmadi.</p></div>';}
  function renderRightsCard(){
    const box=byId('n-rights-card');if(!box)return;const u=Object.assign({uid:selectedRightsUid},users[selectedRightsUid]||{});if(!selectedRightsUid){box.innerHTML='<div class="hetk-naryad-empty"><p>Hodim tanlang.</p></div>';return;}const r=rightRecord(u);
    box.innerHTML=`<form id="n-rights-form" class="hetk-naryad-right-card"><h3>${esc(userName(selectedRightsUid))}</h3><p>${esc(roleLabel(u))} · amaldagi XTB guruhi: <b>${esc(safetyGroup(u))}</b></p><div id="hetk-naryad-form-error" class="hetk-naryad-error"></div><div class="hetk-naryad-right-grid">${Object.keys(RIGHTS).map(key=>`<label class="hetk-naryad-check"><input type="checkbox" data-n-right="${key}"${r[key]===true?' checked':''}><span>${esc(RIGHTS[key].label)} <small>(kamida ${['','I','II','III','IV','V'][RIGHTS[key].min]})</small></span></label>`).join('')}</div><div class="hetk-naryad-right-warning"><b>Muhim:</b> huquq faqat rahbariyatning yozma buyrug‘i asosida beriladi. XTB imtihoni muddati tugasa, tizim amaliy tasdiqni avtomatik to‘xtatadi.</div><div class="hetk-naryad-grid three"><div class="hetk-naryad-field"><label>Buyruq raqami</label><input id="n-right-order" class="hetk-naryad-input" value="${attr(r.orderNo||'')}"></div><div class="hetk-naryad-field"><label>Buyruq sanasi</label><input id="n-right-date" type="date" class="hetk-naryad-input" value="${attr(r.orderDate||'')}"></div><div class="hetk-naryad-field"><label>Vakolat amal qiladi</label><input id="n-right-until" type="date" class="hetk-naryad-input" value="${attr(r.validUntil||'')}"></div></div><div class="hetk-naryad-action-row" style="justify-content:flex-end;margin-top:14px"><button type="submit" class="hetk-naryad-btn primary"><i class="fas fa-save"></i> Vakolatlarni saqlash</button></div></form>`;
  }
  async function saveRights(){
    clearError();try{if(!canManageRights())throw new Error('Vakolatlarni boshqarishga ruxsat yo‘q.');const u=Object.assign({uid:selectedRightsUid},users[selectedRightsUid]||{});if(!u.uid)throw new Error('Hodim tanlanmagan.');const record={};let any=false;document.querySelectorAll('[data-n-right]').forEach(el=>{record[el.dataset.nRight]=!!el.checked;if(el.checked)any=true;});record.orderNo=val('n-right-order');record.orderDate=val('n-right-date');record.validUntil=val('n-right-until');if(any&&(!record.orderNo||!record.orderDate||!record.validUntil))throw new Error('Vakolat berilganda buyruq raqami, sanasi va amal qilish muddatini kiriting.');if(record.validUntil&&new Date(record.validUntil+'T23:59:59').getTime()<now())throw new Error('Vakolatning amal qilish muddati o‘tib ketgan.');Object.keys(RIGHTS).forEach(key=>{if(record[key]&&groupNumber(safetyGroup(u))<RIGHTS[key].min)throw new Error(`“${RIGHTS[key].label}” uchun kamida ${['','I','II','III','IV','V'][RIGHTS[key].min]} guruh kerak.`);});record.grantedAt=now();record.grantedBy=me.uid;record.grantedByName=userName(me.uid);await db.ref(`users/${u.uid}/naryadRights`).set(record);users[u.uid].naryadRights=record;toast('Naryad vakolatlari saqlandi.','success');renderRightsCard();}catch(e){errorBox(e.message||String(e));}
  }

  function handleClick(e){
    const closeBtn=e.target.closest('[data-n-close]');if(closeBtn)return close();
    const tab=e.target.closest('[data-n-tab]');if(tab){currentTab=tab.dataset.nTab;selectedId='';if(currentTab!=='new')editingId='';return render();}
    const openCard=e.target.closest('[data-n-open]');if(openCard){selectedId=openCard.dataset.nOpen;return render();}
    if(e.target.closest('[data-n-back]')){selectedId='';currentTab='list';return render();}
    if(e.target.closest('[data-n-refresh]'))return refreshList();
    if(e.target.closest('[data-n-cancel-form]')){editingId='';currentTab='list';selectedId='';return render();}
    if(e.target.closest('[data-n-add-measure]')){const box=byId('n-measures');if(box)box.insertAdjacentHTML('beforeend',measureRow({}));return;}
    const remove=e.target.closest('[data-n-remove-measure]');if(remove){const rows=document.querySelectorAll('#n-measures .hetk-naryad-measure');if(rows.length>1)remove.closest('.hetk-naryad-measure').remove();else toast('Kamida bitta chora qatori qolishi kerak.','error');return;}
    const action=e.target.closest('[data-n-action]');if(action){action.disabled=true;executeAction(action.dataset.nAction).catch(err=>toast(err.message||String(err),'error')).finally(()=>{action.disabled=false;});return;}
    const rightUser=e.target.closest('[data-n-right-user]');if(rightUser){selectedRightsUid=rightUser.dataset.nRightUser;refreshRightsUsers();renderRightsCard();}
  }
  function handleInput(e){if(e.target.id==='hetk-naryad-list-search')refreshList();if(e.target.id==='n-tp-search'){const selectEl=byId('n-tp');if(selectEl)selectEl.innerHTML=tpOptions(selectEl.value,e.target.value);}if(e.target.id==='n-rights-search')refreshRightsUsers();}
  function handleChange(e){if(e.target.id==='hetk-naryad-list-status')refreshList();if(e.target.id==='n-voltage')refreshRoleOptions();if(e.target.id==='n-condition')refreshBrigadeOptions();if(e.target.id==='n-tp'){const p=byId('n-tp-path');p.textContent=e.target.value&&tps[e.target.value]?tpPath(tps[e.target.value]):'Ruxsat etilgan elementlardan tanlang';}}
  function handleSubmit(e){if(e.target.id==='hetk-naryad-form'){e.preventDefault();const btn=e.target.querySelector('[type=submit]');btn.disabled=true;saveDraft().finally(()=>btn.disabled=false);}if(e.target.id==='n-rights-form'){e.preventDefault();const btn=e.target.querySelector('[type=submit]');btn.disabled=true;saveRights().finally(()=>btn.disabled=false);}}

  function bindRef(ref,event,handler){ref.on(event,handler);refs.push([ref,event,handler]);}
  function unbindAll(){refs.forEach(([ref,event,handler])=>ref.off(event,handler));refs=[];users={};folders={};tps={};naryads={};}
  function start(account){
    me=account;if(!window.firebase||!firebase.apps||!firebase.apps.length)return;db=firebase.database();buildShell();unbindAll();
    const maps=[['users',v=>{users=v||{};if(me&&users[me.uid]){me=Object.assign({uid:me.uid},users[me.uid]);if(window.HETKAuth)window.HETKAuth.currentUser=me;}setButton();if(byId('hetk-naryad-overlay').classList.contains('open'))render();}],['Folders',v=>{folders=v||{};if(byId('hetk-naryad-overlay').classList.contains('open'))render();}],['TPs',v=>{tps=v||{};if(byId('hetk-naryad-overlay').classList.contains('open'))render();}],['Naryads',v=>{naryads=v||{};setButton();if(byId('hetk-naryad-overlay').classList.contains('open'))render();}]];
    maps.forEach(([path,setter])=>{const ref=db.ref(path);bindRef(ref,'value',snap=>setter(snap.val()));});setButton();
  }
  function clear(){unbindAll();me=null;setButton();close();}
  function init(){buildShell();const btn=byId('hetk-naryad-open');if(btn)btn.addEventListener('click',open);document.addEventListener('hetk-auth-ready',e=>start(e.detail&&e.detail.user));document.addEventListener('hetk-auth-user-updated',e=>start(e.detail&&e.detail.user));document.addEventListener('hetk-auth-cleared',clear);if(window.HETKAuth&&window.HETKAuth.currentUser)start(window.HETKAuth.currentUser);}
  window.HETKNaryad={open,close};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
