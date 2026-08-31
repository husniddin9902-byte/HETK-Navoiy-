(function(){
  'use strict';

  const state={
    tps:{},folders:{},zones:{},users:{},presence:{},usage:{},settings:{},
    activeFolderId:'root',refs:[],started:false,currentUid:'',presenceRef:null,
    connectedRef:null,heartbeat:null,lastActivityAt:Date.now(),usageDay:'',
    selectedYear:String(new Date().getFullYear()),selectedMonth:String(new Date().getMonth()+1).padStart(2,'0'),
    adminFolderId:'root',selectedTeamUid:'',operationalOpen:false
  };
  const ONLINE_LIMIT_MS=150000;
  const ACTIVE_LIMIT_MS=5*60*1000;

  function byId(id){return document.getElementById(id);}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function db(){return firebase.database();}
  function me(){return window.HETKAuth&&window.HETKAuth.currentUser;}
  function number(value){return Number(value)||0;}
  function dateKey(date){
    const d=date||new Date();
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  }
  function formatDuration(seconds){
    seconds=Math.max(0,Math.round(number(seconds)));
    const hours=Math.floor(seconds/3600),minutes=Math.floor((seconds%3600)/60);
    if(hours) return hours+' soat '+minutes+' daq';
    if(minutes) return minutes+' daqiqa';
    return seconds+' soniya';
  }
  function activeFolderId(){
    const api=window.HETKManagementStatsContext;
    return api&&api.getActiveFolderId ? api.getActiveFolderId() : state.activeFolderId;
  }
  function folderName(id){return id==='root'?'Barcha ruxsat etilgan hududlar':((state.folders[id]||{}).name||'Tanlangan hudud');}
  function folderPath(id){
    const parts=[];let cur=id,guard=0;
    while(cur&&cur!=='root'&&state.folders[cur]&&guard<100){parts.unshift(state.folders[cur].name||'Papka');cur=state.folders[cur].parentId;guard++;}
    return parts.join(' / ');
  }
  function isInside(folderId,parentId){
    if(parentId==='root') return true;
    let cur=folderId,guard=0;
    while(cur&&guard<100){if(cur===parentId)return true;const f=state.folders[cur];if(!f)break;cur=f.parentId;guard++;}
    return false;
  }
  function pointFolderIds(tp){
    if(!tp)return [];
    const ids=[];
    if(tp.folders)Object.keys(tp.folders).forEach(function(id){if(tp.folders[id])ids.push(id);});
    if(tp.primaryFolderId)ids.push(tp.primaryFolderId);
    if(tp.folderId)ids.push(tp.folderId);
    return Array.from(new Set(ids));
  }
  function pointZoneIds(tp){
    if(tp&&tp.workZones)return Object.keys(tp.workZones).filter(function(id){return tp.workZones[id];});
    if(tp&&tp.primaryWorkZoneId)return [tp.primaryWorkZoneId];
    if(tp&&tp.workZoneId)return [tp.workZoneId];
    return [];
  }
  function userFolderIds(user){return Object.keys((user&&user.folders)||{}).filter(function(id){return user.folders[id];});}
  function viewerAllowsPoint(tp){
    const api=window.HETKManagementStatsContext;
    if(api&&api.pointAllowed){try{return !!api.pointAllowed(tp);}catch(_e){}}
    const account=me();if(!account)return false;if(account.rootAccess)return true;
    const allowed=new Set(window.HETKAuth&&window.HETKAuth.getAccessibleFolderIds?window.HETKAuth.getAccessibleFolderIds(state.folders):[]);
    return pointFolderIds(tp).some(function(id){return allowed.has(id);});
  }
  function pointInScope(tp,folderId){
    if(!viewerAllowsPoint(tp))return false;
    if(folderId==='root')return true;
    return pointFolderIds(tp).some(function(id){return isInside(id,folderId);});
  }
  function zoneFolderIds(zone){return Object.keys((zone&&zone.folders)||{}).filter(function(id){return zone.folders[id];});}
  function zoneVisible(zone,folderId){
    const account=me();if(!account)return false;
    const roots=zoneFolderIds(zone);
    const allowed=account.rootAccess?null:new Set(window.HETKAuth&&window.HETKAuth.getAccessibleFolderIds?window.HETKAuth.getAccessibleFolderIds(state.folders):[]);
    return roots.some(function(id){
      const inViewer=!allowed||allowed.has(id)||Array.from(allowed).some(function(a){return isInside(a,id);});
      const inScope=folderId==='root'||isInside(id,folderId)||isInside(folderId,id);
      return inViewer&&inScope;
    });
  }
  function userInScope(user,folderId){
    const account=me();if(!account||!user)return false;
    if(account.role!=='super_admin'&&!account.rootAccess){
      const allowed=new Set(window.HETKAuth&&window.HETKAuth.getAccessibleFolderIds?window.HETKAuth.getAccessibleFolderIds(state.folders):[]);
      const own=userFolderIds(user);
      if(!own.some(function(id){return allowed.has(id);}))return false;
    }
    if(folderId==='root')return true;
    let roots=userFolderIds(user);
    if(user.workZoneId&&state.zones[user.workZoneId])roots=roots.concat(zoneFolderIds(state.zones[user.workZoneId]));
    return roots.some(function(id){return isInside(id,folderId)||isInside(folderId,id);});
  }
  function uidOnline(uid){
    const devices=state.presence[uid]||{},now=Date.now();
    return Object.keys(devices).some(function(id){const p=devices[id]||{};return p.online===true&&now-number(p.lastSeen)<ONLINE_LIMIT_MS;});
  }
  function onlineCount(folderId){
    return Object.keys(state.users).filter(function(uid){const u=state.users[uid]||{};return u.active!==false&&userInScope(u,folderId)&&uidOnline(uid);}).length;
  }
  function scopedPoints(folderId){
    return Object.keys(state.tps).map(function(id){return Object.assign({id:id},state.tps[id]||{});}).filter(function(tp){return pointInScope(tp,folderId);});
  }
  function summary(folderId){
    const points=scopedPoints(folderId);let privateCount=0;
    points.forEach(function(tp){if(tp.isPrivate===true)privateCount++;});
    return {total:points.length,privateCount:privateCount,etk:points.length-privateCount,online:onlineCount(folderId),points:points};
  }
  function zoneRows(folderId,points){
    const counts={};
    points.forEach(function(tp){pointZoneIds(tp).forEach(function(id){
      if(!counts[id])counts[id]={total:0,etk:0,privateCount:0};
      counts[id].total++;if(tp.isPrivate)counts[id].privateCount++;else counts[id].etk++;
    });});
    return Object.keys(state.zones).map(function(id){
      const zone=state.zones[id]||{};const c=counts[id]||{total:0,etk:0,privateCount:0};
      return {id:id,name:zone.name||'Nomsiz U/J',masterUid:zone.currentMasterUid||'',total:c.total,etk:c.etk,privateCount:c.privateCount};
    }).filter(function(row){return zoneVisible(state.zones[row.id],folderId);}).sort(function(a,b){return b.total-a.total||a.name.localeCompare(b.name);});
  }

  function mountOperational(){
    const panel=document.querySelector('#list-container .list-content.full-screen');
    const header=panel&&panel.querySelector('.list-header');
    if(!panel||!header)return null;
    let openButton=byId('hetk-statistics-open');
    if(!openButton){
      openButton=document.createElement('button');
      openButton.id='hetk-statistics-open';
      openButton.type='button';
      openButton.className='hetk-statistics-open';
      openButton.setAttribute('aria-controls','hetk-operational-stats');
      openButton.setAttribute('aria-expanded','false');
      openButton.innerHTML='<i class="fas fa-chart-pie"></i><span>Statistika</span>';
      const close=byId('close-list');
      header.insertBefore(openButton,close||null);
      openButton.addEventListener('click',function(){setOperationalOpen(!state.operationalOpen);});
    }
    let box=byId('hetk-operational-stats');
    if(!box){
      box=document.createElement('aside');box.id='hetk-operational-stats';box.className='hetk-operational-stats';
      box.setAttribute('aria-hidden','true');
      panel.appendChild(box);
    }
    box.classList.toggle('open',state.operationalOpen);
    box.setAttribute('aria-hidden',state.operationalOpen?'false':'true');
    openButton.classList.toggle('active',state.operationalOpen);
    openButton.setAttribute('aria-expanded',state.operationalOpen?'true':'false');
    return box;
  }
  function setOperationalOpen(open){
    state.operationalOpen=!!open;
    renderOperational();
  }
  function renderOperational(){
    const box=mountOperational();if(!box||!me())return;
    const folderId=activeFolderId();state.activeFolderId=folderId;
    const data=summary(folderId),rows=zoneRows(folderId,data.points);
    box.innerHTML=`<div class="hetk-stats-heading"><div><b><i class="fas fa-chart-pie"></i> Tezkor statistika</b><span>${esc(folderName(folderId))}</span></div><div class="hetk-stats-heading-actions"><button type="button" id="hetk-stats-refresh" title="Yangilash"><i class="fas fa-sync-alt"></i></button><button type="button" id="hetk-stats-close" title="Statistikani yopish"><i class="fas fa-times"></i></button></div></div>
      <div class="hetk-stats-drawer-body">
      <div class="hetk-stat-cards">
        <div class="hetk-stat-card total"><i class="fas fa-bolt"></i><span>Jami element</span><strong>${data.total}</strong></div>
        <div class="hetk-stat-card etk"><i class="fas fa-building"></i><span>ETK balansi</span><strong>${data.etk}</strong></div>
        <div class="hetk-stat-card private"><i class="fas fa-industry"></i><span>Xususiy balans</span><strong>${data.privateCount}</strong></div>
        <div class="hetk-stat-card online"><i class="fas fa-user-check"></i><span>Hozir onlayn</span><strong>${data.online}</strong></div>
      </div>
      <details class="hetk-zone-stats" ${rows.length&&rows.length<=8?'open':''}><summary><span><i class="fas fa-hard-hat"></i> Ustalik joylari kesimida</span><b>${rows.length} ta U/J</b></summary>
        <div class="hetk-zone-stat-list">${rows.length?rows.map(function(row){return `<div class="hetk-zone-stat-row"><span class="name">${esc(row.name)}</span><span class="all">Jami <b>${row.total}</b></span><span class="etk">ETK <b>${row.etk}</b></span><span class="private">Xususiy <b>${row.privateCount}</b></span></div>`;}).join(''):'<div class="hetk-stats-empty">Bu hududda U/J topilmadi.</div>'}</div>
      </details></div>`;
    const refresh=byId('hetk-stats-refresh');if(refresh)refresh.addEventListener('click',function(){refresh.classList.add('spin');startDataListeners(true);setTimeout(function(){refresh.classList.remove('spin');},700);});
    const close=byId('hetk-stats-close');if(close)close.addEventListener('click',function(){setOperationalOpen(false);});
    renderOwnZoneCard();
    renderSelectedUserZoneCard(state.selectedTeamUid);
    renderAdminDashboard();
  }

  function renderOwnZoneCard(){
    const account=me(),summaryEl=document.querySelector('.hetk-profile-summary');
    if(!summaryEl||!account)return;
    let box=byId('hetk-own-zone-stat');
    if(!['master','electrician'].includes(account.role)||!account.workZoneId){if(box)box.remove();return;}
    const points=Object.keys(state.tps).map(function(id){return state.tps[id]||{};}).filter(function(tp){return pointZoneIds(tp).includes(account.workZoneId)&&viewerAllowsPoint(tp);});
    const privateCount=points.filter(function(tp){return tp.isPrivate===true;}).length;
    if(!box){box=document.createElement('div');box.id='hetk-own-zone-stat';box.className='hetk-own-zone-stat';summaryEl.parentNode.insertBefore(box,summaryEl.nextSibling);}
    box.innerHTML=`<span><i class="fas fa-hard-hat"></i>${esc(account.workZoneName||'Mening U/J')}</span><b>${points.length} ta element</b><small>ETK ${points.length-privateCount} · Xususiy ${privateCount}</small>`;
  }

  function renderSelectedUserZoneCard(uid){
    const detail=byId('hetk-team-detail'),user=state.users[uid];
    if(!detail)return;const old=byId('hetk-selected-zone-stat');if(old)old.remove();
    if(!uid||!user||!user.workZoneId)return;
    const points=Object.keys(state.tps).map(function(id){return state.tps[id]||{};}).filter(function(tp){return pointZoneIds(tp).includes(user.workZoneId)&&viewerAllowsPoint(tp);});
    const privateCount=points.filter(function(tp){return tp.isPrivate===true;}).length;
    const card=document.createElement('div');card.id='hetk-selected-zone-stat';card.className='hetk-selected-zone-stat';
    card.innerHTML=`<span><i class="fas fa-chart-bar"></i>${esc(user.workZoneName||((state.zones[user.workZoneId]||{}).name)||'U/J statistikasi')}</span><b>Jami ${points.length}</b><small>ETK ${points.length-privateCount}</small><small>Xususiy ${privateCount}</small>`;
    const head=detail.querySelector('.hetk-team-detail-head');if(head)head.parentNode.insertBefore(card,head.nextSibling);else detail.prepend(card);
  }

  function activateProfileTab(name){
    document.querySelectorAll('.hetk-profile-tab').forEach(function(tab){const on=tab.dataset.profileTab===name;tab.classList.toggle('active',on);tab.setAttribute('aria-selected',on?'true':'false');});
    document.querySelectorAll('.hetk-profile-pane').forEach(function(pane){const on=pane.dataset.profilePane===name;pane.classList.toggle('active',on);pane.hidden=!on;});
  }
  function ensureAdminTab(){
    const account=me(),tabs=document.querySelector('.hetk-profile-tabs'),content=byId('profile-content');
    let tab=document.querySelector('.hetk-profile-tab[data-profile-tab="statistics"]'),pane=document.querySelector('[data-profile-pane="statistics"]');
    if(!account||account.role!=='super_admin'){
      if(tab)tab.remove();if(pane)pane.remove();return null;
    }
    if(!tab&&tabs){
      tab=document.createElement('button');tab.className='hetk-profile-tab';tab.type='button';tab.dataset.profileTab='statistics';tab.setAttribute('role','tab');tab.setAttribute('aria-selected','false');tab.innerHTML='<i class="fas fa-chart-line"></i><span>Statistika</span>';
      tabs.appendChild(tab);tab.addEventListener('click',function(){activateProfileTab('statistics');renderAdminDashboard();});
    }
    if(!pane&&content){pane=document.createElement('section');pane.className='hetk-profile-pane';pane.dataset.profilePane='statistics';pane.hidden=true;content.appendChild(pane);}
    return pane;
  }
  function monthOptions(){
    const names=['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    return names.map(function(name,i){const v=String(i+1).padStart(2,'0');return `<option value="${v}" ${state.selectedMonth===v?'selected':''}>${name}</option>`;}).join('');
  }
  function yearOptions(){
    const years=new Set([String(new Date().getFullYear())]);Object.keys(state.usage).forEach(function(key){if(/^\d{4}-/.test(key))years.add(key.slice(0,4));});
    return Array.from(years).sort().reverse().map(function(y){return `<option value="${y}" ${state.selectedYear===y?'selected':''}>${y}</option>`;}).join('');
  }
  function folderOptions(){
    const items=Object.keys(state.folders).map(function(id){return {id:id,path:folderPath(id)};}).sort(function(a,b){return a.path.localeCompare(b.path);});
    return '<option value="root">Barcha hududlar</option>'+items.map(function(item){return `<option value="${esc(item.id)}" ${state.adminFolderId===item.id?'selected':''}>${esc(item.path)}</option>`;}).join('');
  }
  function periodUsage(){
    const prefix=state.selectedYear+'-'+state.selectedMonth+'-',days=[],userSet=new Set();let seconds=0,visits=0;
    Object.keys(state.usage).sort().forEach(function(day){
      if(day.indexOf(prefix)!==0)return;let daySeconds=0,dayVisits=0;
      const records=state.usage[day]||{};
      Object.keys(records).forEach(function(uid){
        const row=records[uid]||{},user=state.users[uid]||{};
        if(state.adminFolderId!=='root'&&!historicalUserInFolder(row,user,state.adminFolderId))return;
        daySeconds+=number(row.activeSeconds);dayVisits+=number(row.visits);userSet.add(uid);
      });
      seconds+=daySeconds;visits+=dayVisits;days.push({day:Number(day.slice(8,10)),seconds:daySeconds,visits:dayVisits});
    });
    return {days:days,seconds:seconds,visits:visits,users:userSet.size};
  }
  function historicalUserInFolder(row,user,folderId){
    let roots=[];
    if(Array.isArray(row.folderIds))roots=row.folderIds.slice();else roots=userFolderIds(user);
    if(row.workZoneId&&state.zones[row.workZoneId])roots=roots.concat(zoneFolderIds(state.zones[row.workZoneId]));
    return roots.some(function(id){return isInside(id,folderId)||isInside(folderId,id);});
  }
  function activityBars(days){
    const max=Math.max(1,...days.map(function(d){return d.seconds;}));
    const fullDays=new Date(Number(state.selectedYear),Number(state.selectedMonth),0).getDate();
    const map={};days.forEach(function(d){map[d.day]=d;});
    let html='';for(let day=1;day<=fullDays;day++){const item=map[day]||{seconds:0,visits:0};const h=Math.max(item.seconds?5:1,Math.round(item.seconds/max*100));html+=`<div class="hetk-day-bar" title="${day}-kun: ${esc(formatDuration(item.seconds))}, ${item.visits} kirish"><i style="height:${h}%"></i><span>${day}</span></div>`;}
    return html;
  }
  function periodCreatedPoints(){
    const prefix=state.selectedYear+'-'+state.selectedMonth;
    return Object.keys(state.tps).map(function(id){return state.tps[id]||{};}).filter(function(tp){
      if(state.adminFolderId!=='root'&&!pointFolderIds(tp).some(function(id){return isInside(id,state.adminFolderId);}))return false;
      if(!tp.createdAt)return false;const d=new Date(number(tp.createdAt));return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')===prefix;
    });
  }
  function topFolderRows(points){
    const rows=Object.keys(state.folders).map(function(id){
      const count=points.filter(function(tp){return pointFolderIds(tp).some(function(folderId){return isInside(folderId,id);});}).length;
      return {id:id,name:state.folders[id].name||'Papka',count:count};
    }).filter(function(row){return row.count>0&&(state.adminFolderId==='root'||isInside(row.id,state.adminFolderId));}).sort(function(a,b){return b.count-a.count;}).slice(0,12);
    const max=Math.max(1,...rows.map(function(row){return row.count;}));
    return rows.length?rows.map(function(row){return `<div class="hetk-rank-row"><span title="${esc(folderPath(row.id))}">${esc(row.name)}</span><i><b style="width:${Math.max(4,Math.round(row.count/max*100))}%"></b></i><strong>${row.count}</strong></div>`;}).join(''):'<div class="hetk-stats-empty">Tanlangan davrda yangi element yo‘q.</div>';
  }
  function adminZoneBars(points){
    const rows=zoneRows(state.adminFolderId,points).slice(0,12),max=Math.max(1,...rows.map(function(r){return r.total;}));
    return rows.length?rows.map(function(row){const etk=Math.round(row.etk/max*100),priv=Math.round(row.privateCount/max*100);return `<div class="hetk-zone-chart-row"><span>${esc(row.name)}</span><i><b class="etk" style="width:${etk}%"></b><b class="private" style="width:${priv}%"></b></i><strong>${row.total}</strong></div>`;}).join(''):'<div class="hetk-stats-empty">U/J ma’lumoti topilmadi.</div>';
  }
  function renderAdminDashboard(){
    const pane=ensureAdminTab();if(!pane||!me()||me().role!=='super_admin')return;
    const actual=adminActualSummary(),period=periodUsage(),created=periodCreatedPoints();
    const privatePct=actual.total?Math.round(actual.privateCount/actual.total*100):0;
    pane.innerHTML=`<div class="hetk-admin-stats">
      <div class="hetk-admin-stats-head"><div><h3><i class="fas fa-chart-line"></i> Bosh administrator statistikasi</h3><p>Elementlar, U/J lar va tizimdan foydalanish ko‘rsatkichlari.</p></div><div class="hetk-stat-filters"><select id="hetk-stat-year">${yearOptions()}</select><select id="hetk-stat-month">${monthOptions()}</select><select id="hetk-stat-folder">${folderOptions()}</select></div></div>
      <div class="hetk-admin-cards"><div><span>Jami element</span><b>${actual.total}</b><small>Hozirgi aniq son</small></div><div><span>Jami hodim</span><b>${actual.users}</b><small>${actual.activeUsers} ta faol</small></div><div><span>Onlayn</span><b>${actual.online}</b><small>So‘nggi 2,5 daqiqa</small></div><div><span>Faol vaqt</span><b>${esc(formatDuration(period.seconds))}</b><small>${period.users} hodim · ${period.visits} kirish</small></div></div>
      <div class="hetk-chart-grid">
        <section class="hetk-chart-card"><h4>Balans tarkibi</h4><div class="hetk-donut-wrap"><div class="hetk-donut" style="--private:${privatePct*3.6}deg"><b>${actual.total}</b><span>element</span></div><div class="hetk-donut-legend"><span><i class="etk"></i>ETK <b>${actual.etk}</b></span><span><i class="private"></i>Xususiy <b>${actual.privateCount}</b></span></div></div></section>
        <section class="hetk-chart-card wide"><h4>${esc(state.selectedYear)}-${esc(state.selectedMonth)} faolligi</h4><div class="hetk-activity-chart">${activityBars(period.days)}</div></section>
        <section class="hetk-chart-card"><h4>U/J kesimida</h4><div class="hetk-zone-chart">${adminZoneBars(actual.points)}</div><div class="hetk-chart-legend"><span class="etk">ETK</span><span class="private">Xususiy</span></div></section>
        <section class="hetk-chart-card"><h4>Tanlangan oyda yaratilgan elementlar: ${created.length}</h4><div class="hetk-rank-chart">${topFolderRows(created)}</div></section>
      </div>
      <section class="hetk-reset-card"><div><h4><i class="fas fa-undo-alt"></i> Test statistikasini nolga qaytarish</h4><p>Faqat kirishlar va faol vaqt tarixi o‘chadi. Elementlar, hodimlar, U/J va onlayn holat o‘chmaydi.</p><span id="hetk-stat-reset-status"></span></div><div><button id="hetk-stat-set-pin" type="button"><i class="fas fa-key"></i> Kodni o‘rnatish</button><button id="hetk-stat-reset" type="button" class="danger"><i class="fas fa-eraser"></i> Nolga qaytarish</button></div></section>
    </div>`;
    bindAdminDashboard();
  }
  function adminActualSummary(){
    const folderId=state.adminFolderId,points=Object.keys(state.tps).map(function(id){return Object.assign({id:id},state.tps[id]||{});}).filter(function(tp){return folderId==='root'||pointFolderIds(tp).some(function(id){return isInside(id,folderId);});});
    const privateCount=points.filter(function(tp){return tp.isPrivate===true;}).length;
    const users=Object.keys(state.users).filter(function(uid){return folderId==='root'||userInAdminFolder(state.users[uid]||{},folderId);});
    return {total:points.length,etk:points.length-privateCount,privateCount:privateCount,points:points,users:users.length,activeUsers:users.filter(function(uid){return (state.users[uid]||{}).active!==false;}).length,online:users.filter(uidOnline).length};
  }
  function userInAdminFolder(user,folderId){
    let roots=userFolderIds(user);if(user.workZoneId&&state.zones[user.workZoneId])roots=roots.concat(zoneFolderIds(state.zones[user.workZoneId]));
    return roots.some(function(id){return isInside(id,folderId)||isInside(folderId,id);});
  }
  function bindAdminDashboard(){
    const year=byId('hetk-stat-year'),month=byId('hetk-stat-month'),folder=byId('hetk-stat-folder');
    if(year)year.addEventListener('change',function(){state.selectedYear=year.value;renderAdminDashboard();});
    if(month)month.addEventListener('change',function(){state.selectedMonth=month.value;renderAdminDashboard();});
    if(folder)folder.addEventListener('change',function(){state.adminFolderId=folder.value;renderAdminDashboard();});
    const setPin=byId('hetk-stat-set-pin');if(setPin)setPin.addEventListener('click',setResetPin);
    const reset=byId('hetk-stat-reset');if(reset)reset.addEventListener('click',resetUsageStatistics);
  }
  async function sha256(value){
    const data=new TextEncoder().encode(String(value));const hash=await crypto.subtle.digest('SHA-256',data);
    return Array.from(new Uint8Array(hash)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
  }
  function resetStatus(message,error){const el=byId('hetk-stat-reset-status');if(el){el.textContent=message||'';el.className=error?'error':'success';}}
  async function setResetPin(){
    if(!me()||me().role!=='super_admin')return;
    const first=window.prompt('Yangi 6 xonali maxfiy kodni kiriting:');if(first===null)return;
    if(!/^\d{6}$/.test(first))return resetStatus('Kod aynan 6 ta raqam bo‘lishi kerak.',true);
    const second=window.prompt('Kodni yana bir marta kiriting:');if(second===null)return;
    if(first!==second)return resetStatus('Ikki kod bir xil emas.',true);
    try{await db().ref('SystemSettings/statisticsResetCodeHash').set(await sha256(first));resetStatus('Maxfiy kod saqlandi.');}
    catch(e){resetStatus('Kodni saqlab bo‘lmadi: '+(e.message||e),true);}
  }
  async function resetUsageStatistics(){
    if(!me()||me().role!=='super_admin')return;
    const savedHash=state.settings.statisticsResetCodeHash||'';
    if(!savedHash)return resetStatus('Avval 6 xonali maxfiy kodni o‘rnating.',true);
    const pin=window.prompt('Statistikani nolga qaytarish kodini kiriting:');if(pin===null)return;
    if(!/^\d{6}$/.test(pin)||await sha256(pin)!==savedHash)return resetStatus('Maxfiy kod noto‘g‘ri.',true);
    if(!window.confirm('Kirishlar va faol vaqt tarixini nolga qaytarasizmi? Elementlar va hodimlar o‘chmaydi.'))return;
    try{
      const now=Date.now(),account=me();
      await db().ref().update({UsageDaily:null,StatisticsEvents:null,'SystemSettings/statisticsResetAt':now,'SystemSettings/statisticsResetBy':account.uid,'SystemSettings/statisticsResetByName':account.fullName||account.login||'Bosh administrator'});
      resetStatus('Test statistikasi nolga qaytarildi.');
    }catch(e){resetStatus('Nolga qaytarib bo‘lmadi: '+(e.message||e),true);}
  }

  function listen(path,key){
    const ref=db().ref(path);ref.on('value',function(snap){state[key]=snap.val()||{};renderOperational();});state.refs.push(ref);
  }
  function startDataListeners(force){
    if(state.started&&!force)return;
    if(force){state.refs.forEach(function(ref){ref.off('value');});state.refs=[];state.started=false;}
    state.started=true;
    listen('TPs','tps');listen('Folders','folders');listen('WorkZones','zones');listen('users','users');listen('UserPresence','presence');listen('UsageDaily','usage');listen('SystemSettings','settings');
  }
  function stopDataListeners(){state.refs.forEach(function(ref){ref.off('value');});state.refs=[];state.started=false;}

  function deviceId(){
    let id='';try{id=localStorage.getItem('hetk-stat-device-id')||'';}catch(_e){}
    if(!id){id='web_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10);try{localStorage.setItem('hetk-stat-device-id',id);}catch(_e){}}
    return id;
  }
  function presencePayload(online){
    const account=me()||{};return {online:online===true,lastSeen:firebase.database.ServerValue.TIMESTAMP,sessionStartedAt:Date.now(),role:account.role||'',fullName:account.fullName||account.login||'',workZoneId:account.workZoneId||'',folderIds:userFolderIds(account),userAgent:String(navigator.userAgent||'').slice(0,180)};
  }
  function recordVisit(){
    const account=me();if(!account)return;state.usageDay=dateKey();
    db().ref('UsageDaily/'+state.usageDay+'/'+account.uid).transaction(function(raw){raw=raw||{};raw.visits=number(raw.visits)+1;raw.activeSeconds=number(raw.activeSeconds);raw.lastActiveAt=Date.now();raw.fullName=account.fullName||account.login||'';raw.role=account.role||'';raw.workZoneId=account.workZoneId||'';raw.folderIds=userFolderIds(account);return raw;});
  }
  function recordActiveMinute(){
    const account=me();if(!account||document.hidden||Date.now()-state.lastActivityAt>ACTIVE_LIMIT_MS)return;
    const today=dateKey();if(state.usageDay!==today){state.usageDay=today;recordVisit();return;}
    db().ref('UsageDaily/'+today+'/'+account.uid).transaction(function(raw){raw=raw||{};raw.visits=number(raw.visits);raw.activeSeconds=number(raw.activeSeconds)+60;raw.lastActiveAt=Date.now();raw.fullName=account.fullName||account.login||'';raw.role=account.role||'';raw.workZoneId=account.workZoneId||'';raw.folderIds=userFolderIds(account);return raw;});
  }
  function heartbeat(){
    if(!state.presenceRef||!me())return;
    state.presenceRef.update({online:true,lastSeen:firebase.database.ServerValue.TIMESTAMP,role:me().role||'',workZoneId:me().workZoneId||'',folderIds:userFolderIds(me())});recordActiveMinute();
  }
  function markActivity(){state.lastActivityAt=Date.now();}
  function startPresence(){
    const account=me();if(!account||state.currentUid===account.uid)return;stopPresence();state.currentUid=account.uid;state.lastActivityAt=Date.now();
    state.presenceRef=db().ref('UserPresence/'+account.uid+'/'+deviceId());state.connectedRef=db().ref('.info/connected');
    state.connectedRef.on('value',function(snap){if(snap.val()===true&&state.presenceRef){state.presenceRef.onDisconnect().set(Object.assign(presencePayload(false),{sessionStartedAt:null}));state.presenceRef.set(presencePayload(true));}});
    ['click','keydown','touchstart','mousemove','scroll'].forEach(function(name){document.addEventListener(name,markActivity,{passive:true});});
    recordVisit();state.heartbeat=setInterval(heartbeat,60000);
  }
  function stopPresence(){
    if(state.heartbeat){clearInterval(state.heartbeat);state.heartbeat=null;}
    if(state.connectedRef){state.connectedRef.off('value');state.connectedRef=null;}
    if(state.presenceRef){state.presenceRef.update({online:false,lastSeen:firebase.database.ServerValue.TIMESTAMP}).catch(function(){});state.presenceRef=null;}
    ['click','keydown','touchstart','mousemove','scroll'].forEach(function(name){document.removeEventListener(name,markActivity);});state.currentUid='';
  }

  function onAuthReady(){state.activeFolderId=activeFolderId();startDataListeners(false);startPresence();ensureAdminTab();renderOperational();}
  document.addEventListener('hetk-auth-ready',onAuthReady);
  document.addEventListener('hetk-auth-user-updated',function(){startPresence();ensureAdminTab();renderOperational();});
  document.addEventListener('hetk-auth-cleared',function(){state.operationalOpen=false;stopPresence();stopDataListeners();const tab=document.querySelector('.hetk-profile-tab[data-profile-tab="statistics"]'),pane=document.querySelector('[data-profile-pane="statistics"]');if(tab)tab.remove();if(pane)pane.remove();});
  document.addEventListener('hetk-management-scope-changed',function(event){
    const detail=(event&&event.detail)||{};
    state.activeFolderId=detail.folderId||activeFolderId();
    if(detail.reason==='reset')state.operationalOpen=false;
    renderOperational();
  });
  document.addEventListener('click',function(event){
    const row=event.target&&event.target.closest?event.target.closest('[data-team-uid]'):null;
    if(!row)return;state.selectedTeamUid=row.dataset.teamUid||'';setTimeout(function(){renderSelectedUserZoneCard(state.selectedTeamUid);},0);
  });
  document.addEventListener('click',function(event){if(event.target&&event.target.closest&&event.target.closest('#close-list')){state.operationalOpen=false;setOperationalOpen(false);}});
  window.addEventListener('beforeunload',function(){if(state.presenceRef)state.presenceRef.update({online:false,lastSeen:firebase.database.ServerValue.TIMESTAMP});});
  window.HETKStatistics={refresh:renderOperational,open:function(){setOperationalOpen(true);},close:function(){setOperationalOpen(false);},getSummary:function(folderId){return summary(folderId||activeFolderId());}};
  if(me())onAuthReady();
})();
