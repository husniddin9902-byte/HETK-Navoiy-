/* HETK-Navoiy — Dispatch Grid prototype v64
 * SIMULATION ONLY: No SCADA control, no live switching, no network writes.
 * This is a local draft in this browser, not an operational dispatch system.
 */
(function () {
  'use strict';
  const ROLE_SET = new Set(['super_admin', 'chief_dispatcher', 'dispatcher']);
  const STORAGE = 'hetk.dispatchGrid.draft.v60.'; // Keep v60 key for backwards-compatible local drafts.
  const VOLTAGES = [220, 110, 35, 10, 6];
  const COLORS = { 220:'#e74655', 110:'#3186f6', 35:'#20b978', 10:'#e4a642', 6:'#ae7cf4' };
  let root, button, data, editorType = '', editorId = '', currentUser = null;
  let view = 'combined', section = 'stations', overrides = {}, chosen = null, map = null, mapLayer = null;
  let mapTowers = false, mapTps = false, mapConsumers = false, initialized = false;
  let showObjects = false, showImpact = false, showStats = false, pickerMap = null, pickerMarker = null, pickerRoute = null, pickerSelection = null;
  let pickerContext = null, baseMapLayer = null, pickerBaseMapLayer = null, visiblePickerObjects = true;
  let existingTPs = null, existingTPsPending = false, mapStyle = 'street';
  let expandedFolders = new Set(); // User-controlled open branches of HETK folder tree.

  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v, fallback=0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const uid = () => 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);
  const empty = () => ({ version:1, stations:[], lines:[], feeders:[], tps:[], consumers:[] });
  const isAllowed = u => !!(u && u.active!==false && ROLE_SET.has(u.role));
  const storeKey = () => STORAGE + (currentUser && (currentUser.uid || currentUser.login) || 'unknown');
  const arr = (x) => Array.isArray(x) ? x : [];
  const MAP_TILES = {
    street: {url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', opts:{maxZoom:19,maxNativeZoom:19,attribution:'&copy; OpenStreetMap contributors'}},
    satellite: {url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts:{maxZoom:20,maxNativeZoom:19,attribution:'Tiles &copy; Esri, Maxar, Earthstar Geographics, GIS User Community'}}
  };
  function readMapStyle(){try{return localStorage.getItem(STORAGE+'basemap')==='satellite'?'satellite':'street';}catch(e){return 'street';}}
  function makeBaseMap(target){
    const conf=MAP_TILES[mapStyle]||MAP_TILES.street;
    const layer=L.tileLayer(conf.url,conf.opts).addTo(target);
    let errors=0;
    if(mapStyle==='satellite' && layer.on)layer.on('tileerror',()=>{if(++errors===5)showMsg('Sun’iy yo‘ldosh tasviri yuklanmadi. Internetni tekshiring yoki «Oddiy» xaritaga qayting.','error');});
    return layer;
  }
  function switchMapStyle(style){
    if(!MAP_TILES[style])return;
    mapStyle=style;
    try{localStorage.setItem(STORAGE+'basemap',mapStyle);}catch(e){}
    if(map){if(baseMapLayer)map.removeLayer(baseMapLayer);baseMapLayer=makeBaseMap(map);if(baseMapLayer.bringToBack)baseMapLayer.bringToBack();}
    if(pickerMap){if(pickerBaseMapLayer)pickerMap.removeLayer(pickerBaseMapLayer);pickerBaseMapLayer=makeBaseMap(pickerMap);if(pickerBaseMapLayer.bringToBack)pickerBaseMapLayer.bringToBack();}
    if(root)root.querySelectorAll('[data-map-style]').forEach(b=>{const active=b.dataset.mapStyle===mapStyle;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  }
  function mapStyleButtons(){return `<div class="dg-basemaps" role="group" aria-label="Xarita foni"><button type="button" data-map-style="street" aria-pressed="${mapStyle==='street'}" class="${mapStyle==='street'?'active':''}">🗺 Oddiy</button><button type="button" data-map-style="satellite" aria-pressed="${mapStyle==='satellite'}" class="${mapStyle==='satellite'?'active':''}">🛰 Sun’iy yo‘ldosh</button></div>`;}
  // Reuse the existing HETK folder hierarchy. The ID, not its mutable label, is saved.
  // This is a READ-ONLY use of the main application's loaded folder list.
  function mainFolders(){try{return window.HETKManagementStatsContext?.getFolders?.()||window.currentFolders||{};}catch(e){return {};}}
  function folderPath(id,folders=mainFolders()){
    if(!id||!folders[id])return '';
    const names=[],seen=new Set();let current=id;
    while(current&&current!=='root'&&folders[current]&&!seen.has(current)&&names.length<40){seen.add(current);names.unshift(folders[current].name||current);current=folders[current].parentId;}
    return names.join(' → ');
  }
  function folderIncludes(childId,ancestorId,folders=mainFolders()){
    if(!childId||!ancestorId)return false;
    const seen=new Set();let id=childId;
    while(id&&id!=='root'&&folders[id]&&!seen.has(id)){if(id===ancestorId)return true;seen.add(id);id=folders[id].parentId;}
    return false;
  }
  function folderEntries(){
    const folders=mainFolders(),ids=Object.keys(folders);
    const auth=window.HETKAuth;
    const permitted=ids.filter(id=>!auth?.canSeeFolder||auth.canSeeFolder(id,folders));
    const allowed=new Set(permitted);
    // Keep visible ancestors so the folder hierarchy remains intelligible.
    for(const id of permitted){let parent=folders[id]?.parentId,guard=0;while(parent&&parent!=='root'&&folders[parent]&&guard++<50){allowed.add(parent);parent=folders[parent].parentId;}}
    const children={};
    ids.filter(id=>allowed.has(id)).forEach(id=>{const parent=folders[id]?.parentId||'root';(children[parent]||(children[parent]=[])).push(id);});
    Object.values(children).forEach(list=>list.sort((a,b)=>String(folders[a]?.name||'').localeCompare(String(folders[b]?.name||''),'uz')));
    const ordered=[],seen=new Set();
    function add(id,depth,parents){
      if(seen.has(id))return;seen.add(id);
      ordered.push({id,depth:Math.min(depth,12),name:folders[id]?.name||id,path:folderPath(id,folders),selectable:permitted.includes(id),parents,hasChildren:!!children[id]?.length});
      (children[id]||[]).forEach(child=>add(child,depth+1,[...parents,id]));
    }
    (children.root||[]).forEach(id=>add(id,0,[]));
    ids.filter(id=>allowed.has(id)&&!seen.has(id)).forEach(id=>add(id,0,[]));
    return ordered;
  }
  function folderPickerHtml(selectedId='',legacyName=''){
    const entries=folderEntries();
    const selected=entries.find(x=>x.id===selectedId);
    const label=selected?.path||legacyName||'Papka tanlanmagan';
    expandedFolders=new Set(entries.filter(x=>x.depth===0).map(x=>x.id));
    // Open just the selected branch, not all 1000+ entries.
    if(selected)selected.parents.forEach(id=>expandedFolders.add(id));
    const rows=entries.map(x=>`<div class="dg-folder-node" data-folder-node="${esc(x.id)}" data-folder-name="${esc(x.name.toLocaleLowerCase())}" data-folder-parents="${esc(x.parents.join('|'))}" style="--folder-depth:${x.depth}"><button type="button" class="dg-folder-toggle" data-folder-toggle="${esc(x.id)}" title="${x.hasChildren?'Papka ichini ochish/yopish':'Ichki papkasi yo‘q'}" aria-label="${esc(x.name)} papkasini ochish yoki yopish" ${x.hasChildren?'':'disabled'}>${x.hasChildren?'−':'·'}</button><button type="button" data-folder-choice="${esc(x.id)}" data-folder-path="${esc(x.path)}" class="dg-folder-row ${selectedId===x.id?'selected':''}" ${x.selectable?'':'disabled title="Bu papka tanlash uchun ochiq emas"'}>📁 ${esc(x.name)}</button></div>`).join('');
    return `<section class="dg-folder-picker"><strong>📂 HETK papkasini tanlash</strong><small>Chapdagi +/− tugmalari bilan papkalarni oching. Qidiruv faqat mos papkalar va ularning ota papkalarini ko‘rsatadi. Liniyalar avtomatik ulanmaydi.</small><input type="search" class="dg-folder-search" data-folder-filter placeholder="PS, fider yoki papka nomini qidirish" autocomplete="off"><div class="dg-folder-tree">${rows||'<div class="dg-form-tip">Papkalar hali yuklanmagan. Asosiy guruhlar oynasini ochib, qayta urinib ko‘ring.</div>'}</div><input type="hidden" name="folderId" value="${esc(selectedId)}"><div class="dg-folder-chosen" id="dg-folder-chosen">Tanlangan: ${esc(label)}</div></section>`;
  }
  function updateFolderVisibility(){
    const form=el('dg-editor-form');if(!form)return;
    const nodes=[...form.querySelectorAll('[data-folder-node]')];if(!nodes.length)return;
    const q=String(form.querySelector('[data-folder-filter]')?.value||'').trim().toLocaleLowerCase();
    let relevant=null;
    if(q){
      relevant=new Set();
      for(const node of nodes){
        if(String(node.dataset.folderName||'').includes(q)){
          relevant.add(node.dataset.folderNode);
          String(node.dataset.folderParents||'').split('|').filter(Boolean).forEach(id=>relevant.add(id));
        }
      }
    }
    nodes.forEach(node=>{
      const id=node.dataset.folderNode,parents=String(node.dataset.folderParents||'').split('|').filter(Boolean);
      node.hidden=q?!relevant.has(id):parents.some(parent=>!expandedFolders.has(parent));
      const toggle=node.querySelector('[data-folder-toggle]');
      if(toggle&&!toggle.disabled){const open=q?true:expandedFolders.has(id);toggle.textContent=open?'−':'+';toggle.setAttribute('aria-expanded',String(open));}
    });
  }
  function selectedFolderFromForm(form){
    const id=String(form.elements.namedItem('folderId')?.value||'').trim();return {id,path:folderPath(id)};
  }
  function storedTPFolderIds(t){return [...new Set([t?.primaryFolderId,t?.folderId,...Object.keys(t?.folders||{}).filter(id=>t.folders[id]===true||t.folders[id]===1)].filter(Boolean))];}
  function existingTPFields(){return `<section class="dg-existing-tp"><strong>🔗 HETK bazasidagi TP/KTPni biriktirish (ixtiyoriy)</strong><small>Asosiy bazadan faqat o‘qiladi. Tanlangan fider papkasidagi TP/KTP lar ko‘rsatiladi. HETKdagi elementning o‘zi o‘zgarmaydi.</small><input type="search" id="dg-tp-search" placeholder="TP/KTP nomi yoki raqami bo‘yicha qidirish"><select name="linkedTpId" id="dg-linked-tp"><option value="">— Yangi lokal TP/KTP —</option></select><small id="dg-tp-count">HETK elementlari yuklanmoqda…</small></section>`;}
  function refreshExistingTPs(){
    const form=el('dg-editor-form'),selectEl=form?.elements.namedItem('linkedTpId');if(!selectEl||!existingTPs)return;
    const f=feeder(form.elements.namedItem('feederId')?.value||''),folderId=f?.folderId||'';
    const q=String(el('dg-tp-search')?.value||'').trim().toLocaleLowerCase();
    const old=selectEl.value||selectEl.dataset.original||'',list=[];
    for(const [id,t] of Object.entries(existingTPs)){
      if(folderId && !storedTPFolderIds(t).some(tpFolder=>folderIncludes(tpFolder,folderId)))continue;
      if(q && !(String(t.name||'')+' '+String(id)).toLocaleLowerCase().includes(q))continue;
      list.push({id,name:t.name||id,power:t.power});
    }
    list.sort((a,b)=>a.name.localeCompare(b.name,'uz'));
    selectEl.innerHTML='<option value="">— Yangi lokal TP/KTP —</option>'+list.slice(0,300).map(t=>`<option value="${esc(t.id)}" ${t.id===old?'selected':''}>${esc(t.name)}${t.power?' · '+esc(t.power)+' kVA':''}</option>`).join('');
    const counter=el('dg-tp-count');if(counter)counter.textContent=`Mos kelgan elementlar: ${list.length}${list.length>300?' (birinchi 300 ta, qidiruvdan foydalaning)':''}.`;
  }
  async function attachExistingTps(feederId){
    const f=feeder(feederId);
    if(!f||!f.folderId)return showMsg('Avval fiderni mavjud papka bilan bog‘lang.','error');
    if(!window.HETKData?.readTPs)return showMsg('HETK elementlar bazasini o‘qish funksiyasi yo‘q.','error');
    try{
      if(!existingTPs)existingTPs=(await window.HETKData.readTPs()).val()||{};
      const matches=Object.entries(existingTPs).filter(([id,t])=>storedTPFolderIds(t).some(folderId=>folderIncludes(folderId,f.folderId)));
      const linked=new Set(data.tps.filter(t=>t.linkedTpId).map(t=>t.linkedTpId));
      const pending=matches.filter(([id])=>!linked.has(id));
      if(!pending.length)return showMsg('Ushbu fider papkasida yangi biriktiriladigan TP/KTP topilmadi.','info');
      if(!confirm(`${f.name} papkasidagi ${pending.length} ta TP/KTPni dispetcherlikning LOKAL qoralamasiga bog‘laysizmi? HETK asosiy bazasi o‘zgarmaydi.`))return;
      const selected=pending.slice(0,500);
      for(const [mainId,t] of selected){
        const folderId=storedTPFolderIds(t).find(tpFolder=>folderIncludes(tpFolder,f.folderId))||f.folderId;
        const gps=t.lat!=null&&t.lng!=null&&String(t.lat).trim()!==''&&String(t.lng).trim()!==''&&validGps(t.lat,t.lng);
        data.tps.push({id:uid(),name:t.name||mainId,feederId:f.id,kva:Math.max(0,num(t.power)),folderId,linkedTpId:mainId,lat:gps?num(t.lat):null,lng:gps?num(t.lng):null});
      }
      saveLocal();refresh();showMsg(`${selected.length} ta TP/KTP lokal modelga biriktirildi. Asosiy bazaga yozilmadi.`,'success');
      if(pending.length>500)showMsg('500 ta bog‘landi. Qolganlarini alohida qo‘shish mumkin.','info');
    }catch(e){showMsg('HETK elementlarini o‘qib bo‘lmadi: '+e.message,'error');}
  }
  async function prepareExistingTPs(){
    const slot=el('dg-linked-tp');if(!slot)return;
    slot.dataset.original=String(data.tps.find(t=>t.id===editorId)?.linkedTpId||'');
    if(existingTPs){refreshExistingTPs();return;}
    if(!window.HETKData?.readTPs){el('dg-tp-count').textContent='HETK elementlarini o‘qish moduli mavjud emas.';return;}
    if(existingTPsPending)return;
    existingTPsPending=true;
    try{
      const snap=await window.HETKData.readTPs();existingTPs=snap.val()||{};
      if(el('dg-linked-tp'))refreshExistingTPs();
    }catch(e){if(el('dg-tp-count'))el('dg-tp-count').textContent='Elementlarni olish imkoni bo‘lmadi. Qo‘lda kiritish mumkin.';}
    finally{existingTPsPending=false;}
  }
  function towerRef(line,t,i){return line.id+':'+(t.id||i);}
  function findTowerRef(ref){
    const [lineId,key]=String(ref||'').split(':');
    const line=data.lines.find(l=>l.id===lineId);
    if(!line)return null;
    let index=arr(line.towers).findIndex(t=>t.id===key);
    if(index<0&&/^\d+$/.test(key))index=Number(key);
    if(!line.towers?.[index])return null;
    return {line,index,tower:line.towers[index]};
  }
  const station = id => data.stations.find(x=>x.id===id);
  const feeder = id => data.feeders.find(x=>x.id===id);
  const tp = id => data.tps.find(x=>x.id===id);
  const savedOpen = (l, end) => end==='a' ? l.openA===true : l.openB===true;
  const actualOpen = (l,end) => overrides[l.id+':'+end] == null ? savedOpen(l,end) : overrides[l.id+':'+end];
  const accessibleEdge = l => !actualOpen(l,'a') && !actualOpen(l,'b');
  const canEdit = () => isAllowed(currentUser);
  const showMsg = (message, kind='info') => {
    const box = el('hetk-grid-message'); if(!box) return;
    box.textContent=message; box.dataset.kind=kind; box.hidden=false;
    clearTimeout(showMsg._timer);
    showMsg._timer=setTimeout(()=>{ if(box) box.hidden=true;},5500);
  };
  // Stable IDs for old v63 tower points. The migration is additive: no GPS,
  // line, breaker or station records are discarded or rearranged.
  function normalizeTowerIds(draft){
    for(const line of arr(draft?.lines)){
      line.towers=arr(line.towers).map(t=>({...(t&&typeof t==='object'?t:{}),id:t?.id||uid()}));
    }
    return draft;
  }
  const saveLocal = () => {try { normalizeTowerIds(data);localStorage.setItem(storeKey(),JSON.stringify(data)); } catch(e){showMsg('Brauzer xotirasiga yozib bo‘lmadi. JSON eksportini saqlang.','error');}};
  const loadLocal = () => {
    try {
      const raw=JSON.parse(localStorage.getItem(storeKey()) || 'null');
      if(raw && Array.isArray(raw.stations) && Array.isArray(raw.lines)) {
        return normalizeTowerIds({version:1,stations:arr(raw.stations),lines:arr(raw.lines),feeders:arr(raw.feeders),tps:arr(raw.tps),consumers:arr(raw.consumers)});
      }
    } catch(e) { /* Keep a clean draft on corrupt data. */ }
    return empty();
  };
  const sample = () => {
    const d = empty();
    d.stations = [
      {id:'S-A',name:'Manba A (namuna)',kind:'source',volts:[110,35],folder:'Namunaviy hudud',lat:40.11,lng:65.34,x:100,y:115},
      {id:'S-B',name:'Manba B (namuna)',kind:'source',volts:[110,35],folder:'Namunaviy hudud',lat:40.13,lng:65.68,x:830,y:115},
      {id:'S-C',name:'PS C (namuna)',kind:'ps',volts:[35,10],folder:'Namunaviy TET',lat:40.08,lng:65.46,x:345,y:345},
      {id:'S-D',name:'PS D (namuna)',kind:'ps',volts:[35,10],folder:'Namunaviy TET',lat:40.08,lng:65.59,x:630,y:345},
      {id:'J-1',name:'Otpayka 1',kind:'tap',volts:[35],folder:'',lat:40.12,lng:65.46,x:345,y:115},
      {id:'J-2',name:'Otpayka 2',kind:'tap',volts:[35],folder:'',lat:40.12,lng:65.59,x:630,y:115}
    ];
    d.lines = [
      {id:'L-1',name:'L-35-01 (namuna)',voltage:35,a:'S-A',b:'J-1',openA:false,openB:false,towers:[{number:'1'}]},
      {id:'L-2',name:'L-35-01 (namuna)',voltage:35,a:'J-1',b:'J-2',openA:false,openB:false,towers:[{number:'2'},{number:'3'}]},
      {id:'L-3',name:'L-35-01 (namuna)',voltage:35,a:'J-2',b:'S-B',openA:false,openB:true,towers:[{number:'4'}]},
      {id:'L-4',name:'Otpayka C (namuna)',voltage:35,a:'J-1',b:'S-C',openA:false,openB:false,towers:[]},
      {id:'L-5',name:'Otpayka D (namuna)',voltage:35,a:'J-2',b:'S-D',openA:false,openB:false,towers:[]}
    ];
    d.feeders = [
      {id:'F-1',name:'Fider-1',psId:'S-C',voltage:10},
      {id:'F-2',name:'Fider-2',psId:'S-D',voltage:10}
    ];
    d.tps = [
      {id:'T-1',name:'TP-101',feederId:'F-1',kva:250},
      {id:'T-2',name:'TP-102',feederId:'F-1',kva:400},
      {id:'T-3',name:'KTP-103',feederId:'F-2',kva:630}
    ];
    d.consumers = [
      {id:'C-1',name:'Namuna mahallasi',kind:'mahalla',tpId:'T-1',note:'Faqat misol'},
      {id:'C-2',name:'Namuna maktabi',kind:'organization',tpId:'T-2',note:'Faqat misol'},
      {id:'C-3',name:'Namuna shifoxonasi',kind:'organization',tpId:'T-3',note:'Faqat misol'}
    ];
    return normalizeTowerIds(d);
  };

  // A connected electrical component is energized if it reaches an enabled source
  // through lines whose breaker end states are both closed. For components with
  // multiple sources, power-flow direction is AMBIGUOUS and is never animated.
  function analyze(d=data, simulated=overrides) {
    const old=overrides; overrides=simulated;
    try {
      const nodes = new Map(d.stations.map(x=>[x.id,x]));
      const links = new Map(d.stations.map(x=>[x.id,[]]));
      const malformed=[];
      for(const l of d.lines){
        const a=nodes.get(l.a), b=nodes.get(l.b);
        if(!a || !b || !arr(a.volts).includes(num(l.voltage)) || !arr(b.volts).includes(num(l.voltage))){
          malformed.push(l.name || l.id); continue;
        }
        if(!actualOpen(l,'a') && !actualOpen(l,'b')){
          links.get(l.a).push({id:l.b,line:l});links.get(l.b).push({id:l.a,line:l});
        }
      }
      const components=[],byNode={}, energized={},sourceCount={},dist={},direction={};
      for(const node of d.stations){
        if(byNode[node.id]!=null) continue;
        const stack=[node.id], seen=new Set(), members=[];
        while(stack.length){const n=stack.pop();if(seen.has(n))continue;seen.add(n);members.push(n);for(const edge of (links.get(n)||[]))stack.push(edge.id);}
        const sources=members.filter(id=>nodes.get(id).kind==='source' && nodes.get(id).sourceOff!==true);
        const ci=components.length;
        components.push({members,sources});
        for(const n of members){byNode[n]=ci;energized[n]=sources.length>0;sourceCount[n]=sources.length;}
        if(sources.length===1){
          const q=[sources[0]];dist[sources[0]]=0;
          while(q.length){const n=q.shift();for(const edge of (links.get(n)||[]))if(dist[edge.id]==null){dist[edge.id]=dist[n]+1;q.push(edge.id);}}
        }
      }
      for(const l of d.lines){
        const ca=byNode[l.a],cb=byNode[l.b];
        if(ca==null||ca!==cb||!accessibleEdge(l)||sourceCount[l.a]!==1){direction[l.id]=0;continue;}
        if(dist[l.a]<dist[l.b])direction[l.id]=1;
        else if(dist[l.b]<dist[l.a])direction[l.id]=-1;
        else direction[l.id]=0;
      }
      const feederState={}, tpState={}, consumerState={}, affected=[],unknown=[];
      for(const f of d.feeders) feederState[f.id] = energized[f.psId] === true;
      for(const t of d.tps) tpState[t.id] = feederState[t.feederId] === true;
      for(const c of d.consumers){
        const t=d.tps.find(x=>x.id===c.tpId);
        if(!t || !d.feeders.some(x=>x.id===t.feederId)) {consumerState[c.id]='unknown';unknown.push(c);}
        else { consumerState[c.id]=tpState[t.id]?'supplied':'affected'; if(!tpState[t.id])affected.push(c); }
      }
      const affectedTps=d.tps.filter(x=>tpState[x.id]===false && d.feeders.some(f=>f.id===x.feederId));
      return {nodes,components,links,byNode,energized,sourceCount,dist,direction,malformed,feederState,tpState,consumerState,affected,unknown,affectedTps,affectedKva:affectedTps.reduce((n,t)=>n+Math.max(0,num(t.kva)),0),parallel:components.filter(x=>x.sources.length>1),islands:components.filter(x=>x.sources.length===0)};
    } finally {overrides=old;}
  }

  function validGps(lat,lng){
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat)>=-90 && Number(lat)<=90 && Number(lng)>=-180 && Number(lng)<=180;
  }
  function lineDistance(a,b){
    const latRad=((num(a.lat)+num(b.lat))/2)*Math.PI/180;
    return Math.hypot((num(b.lat)-num(a.lat))*111132,(num(b.lng)-num(a.lng))*111320*Math.cos(latRad));
  }
  function routePointAt(line,ratio){
    const pts=geometryFor(line);
    if(pts.length<2)return null;
    const lengths=pts.slice(1).map((p,i)=>lineDistance(pts[i],p));
    const total=lengths.reduce((a,b)=>a+b,0);
    if(total<=0)return {lat:pts[0].lat,lng:pts[0].lng,segment:0};
    let remaining=clamp(ratio,0,1)*total;
    for(let i=0;i<lengths.length;i++){
      if(remaining<=lengths[i]||i===lengths.length-1){
        const t=lengths[i]?clamp(remaining/lengths[i],0,1):0;
        return {lat:pts[i].lat+(pts[i+1].lat-pts[i].lat)*t,lng:pts[i].lng+(pts[i+1].lng-pts[i].lng)*t,segment:i};
      }
      remaining-=lengths[i];
    }
    return null;
  }
  function updateSidebar(){
    if(!root)return;
    root.classList.toggle('dg-show-objects',showObjects);
    root.classList.toggle('dg-show-impact',showImpact);
    root.classList.toggle('dg-show-stats',showStats);
    root.querySelectorAll('[data-action="toggle-stats"]').forEach(b=>{b.setAttribute('aria-expanded',String(showStats));b.classList.toggle('active',showStats);});
    root.querySelectorAll('[data-action="toggle-objects"]').forEach(b=>{
      b.setAttribute('aria-expanded',String(showObjects));b.classList.toggle('active',showObjects);
    });
    root.querySelectorAll('[data-action="toggle-impact"]').forEach(b=>{
      b.setAttribute('aria-expanded',String(showImpact));b.classList.toggle('active',showImpact);
    });
    if(map)setTimeout(()=>map&&map.invalidateSize(),80);
  }
  function destroyPicker(){
    if(pickerMap){try{pickerMap.remove();}catch(e){}pickerMap=null;}
    pickerMarker=null;pickerRoute=null;pickerSelection=null;pickerContext=null;pickerBaseMapLayer=null;
  }
  function closeEditor(){destroyPicker();if(el('dg-editor'))el('dg-editor').hidden=true;}
  function createShell(){
    root=document.createElement('div');root.id='hetk-grid';root.hidden=true;root.setAttribute('aria-hidden','true');
    root.innerHTML=`
      <div class="dg-frame" role="dialog" aria-modal="true" aria-labelledby="dg-title">
        <header class="dg-topbar">
          <div class="dg-brand"><span class="dg-brand-icon">⚡</span><div><strong id="dg-title">Elektr tarmoqlari · Dispetcherlik</strong><small>HETK-Navoiy / PS · Liniya · Fider · Iste’molchi</small></div></div>
          <div class="dg-head-actions"><span class="dg-simulation-tag">SINOV · haqiqiy tarmoq emas</span><button type="button" class="dg-close" data-action="close" aria-label="Yopish">✕</button></div>
        </header>
        <div class="dg-toolbar">
          <div class="dg-switch-views" role="tablist" aria-label="Ko‘rinish turi">
            <button type="button" data-view="simple">◈ Sodda sxema</button>
            <button type="button" data-view="technical">▦ Texnik sxema</button>
            <button type="button" data-view="combined">▧ GIS xarita</button>
          </div>
          <div class="dg-toolbar-actions">
            <button type="button" data-action="toggle-objects" aria-controls="dg-sidebar" aria-expanded="false">☰ Obyektlar</button>
            <button type="button" data-action="toggle-impact" aria-controls="dg-impact" aria-expanded="false">◫ Ta’sir tahlili</button>
            <button type="button" data-action="toggle-stats" aria-expanded="false">▥ Statistika</button>
            <button type="button" data-action="reset-switches" title="Sinovdagi o‘chirgichlarni asl holatga qaytarish">↶ Sxemani tiklash</button>
            <button type="button" data-action="sample">Namuna</button>
            <button type="button" data-action="clear" class="dg-clear-button" title="Mahalliy qoralamani (namunani ham) tozalash">✕ Tozalash</button>
            <button type="button" data-action="export">↓ JSON</button>
            <button type="button" data-action="import">↑ JSON</button>
          </div>
        </div>
        <div id="hetk-grid-message" class="dg-message" hidden></div>
        <div class="dg-body">
          <aside class="dg-sidebar" id="dg-sidebar">
            <button type="button" class="dg-panel-close" data-action="close-objects" aria-label="Obyektlar panelini yopish">✕</button>
            <div class="dg-sidebar-title"><span>Obyektlar</span><small>Qo‘lda kiritish · lokal qoralama</small></div>
            <div class="dg-add-grid">
              <button type="button" data-add="station">+ PS / manba</button><button type="button" data-add="line">+ Liniya</button>
              <button type="button" data-add="tap">+ Otpayka</button><button type="button" data-add="tower">+ Tayanch</button>
              <button type="button" data-add="feeder">+ Fider</button><button type="button" data-add="tp">+ TP/KTP</button>
              <button type="button" class="dg-add-wide" data-add="consumer">+ Mahalla / tashkilot</button>
            </div>
            <div class="dg-list-tabs">
              <button type="button" data-section="stations">PS</button><button type="button" data-section="lines">Liniya</button><button type="button" data-section="towers">Tayanch</button>
              <button type="button" data-section="feeders">Fider</button><button type="button" data-section="tps">TP/KTP</button>
              <button type="button" data-section="consumers">Iste’molchi</button>
            </div>
            <div class="dg-item-list" id="dg-item-list"></div>
            <div class="dg-local-notice">🔒 Birinchi bosqich: ma’lumotlar faqat shu qurilma brauzerida saqlanadi. Hozircha Firebase va SCADA bilan sinxron emas. Haqiqiy kommutatsiya bajarilmaydi.</div>
          </aside>
          <main class="dg-main">
            <div class="dg-kpis" id="dg-kpis"></div>
            <div class="dg-visual-layout" id="dg-visual-layout"><section class="dg-visual"><div class="dg-view-title" id="dg-view-title"></div><div id="dg-visual-content"></div></section></div>
          </main>
          <aside class="dg-impact" id="dg-impact"></aside>
        </div>
        <footer class="dg-footer"><span>⚠ Ta’minot va uzilish natijalari kiritilgan modelga asoslangan taxmin. Operativ qaror yoki xavfsiz ulash uchun ishlatilmaydi.</span><span>v64 · Lokal prototip</span></footer>
      </div>
      <div class="dg-modal" id="dg-editor" hidden><div class="dg-editor-card" role="dialog" aria-modal="true" aria-label="Obyekt tahrirlash"><div class="dg-editor-head"><strong id="dg-editor-title">Tahrirlash</strong><button type="button" data-action="cancel-editor" aria-label="Yopish">✕</button></div><form id="dg-editor-form"></form></div></div>
      <input type="file" id="dg-import-file" accept=".json,application/json" hidden>
    `;
    document.body.appendChild(root);
    button=document.createElement('button');button.id='hetk-dispatch-open';button.type='button';button.hidden=true;
    button.innerHTML='<i class="fas fa-network-wired" aria-hidden="true"></i><span>Dispetcherlik</span>';
    button.title='Elektr tarmoqlari (sinov)';
    button.className='hetk-header-tool';
    const header=document.querySelector('.header-right');
    if(header)header.insertBefore(button,header.firstChild);
    button.addEventListener('click',open);
    root.addEventListener('click',onClick);
    el('dg-editor-form').addEventListener('submit',onSave);
    el('dg-editor-form').addEventListener('input',ev=>{
      if(ev.target.matches('[data-folder-filter]'))updateFolderVisibility();
      if(ev.target.id==='dg-tp-search')refreshExistingTPs();
    });
    el('dg-editor-form').addEventListener('change',ev=>{
      if(ev.target.name==='feederId')refreshExistingTPs();
      if(ev.target.name==='linkedTpId'&&ev.target.value&&existingTPs){
        const tp=existingTPs[ev.target.value];if(!tp)return;const f=ev.currentTarget;
        for(const [name,value] of [['name',tp.name],['kva',tp.power],['lat',tp.lat],['lng',tp.lng]]){const control=f.elements.namedItem(name);if(control&&value!=null)control.value=value;}
        const fld=storedTPFolderIds(tp)[0];const folderInput=f.elements.namedItem('folderId');if(folderInput&&fld){folderInput.value=fld;const marker=el('dg-folder-chosen');if(marker)marker.textContent='Tanlangan: '+folderPath(fld);f.querySelectorAll('.dg-folder-row').forEach(b=>b.classList.toggle('selected',b.dataset.folderChoice===fld));const picked=f.querySelector(`[data-folder-node="${CSS.escape(fld)}"]`);if(picked){String(picked.dataset.folderParents||'').split('|').filter(Boolean).forEach(id=>expandedFolders.add(id));updateFolderVisibility();}}
        const lat=Number(tp.lat),lng=Number(tp.lng);if(validGps(tp.lat,tp.lng)&&tp.lat!=null&&tp.lng!=null&&pickerMap){if(!pickerMarker){pickerMarker=L.marker([lat,lng],{draggable:true}).addTo(pickerMap);}else pickerMarker.setLatLng([lat,lng]);pickerMap.setView([lat,lng],15);}
      }
    });
    el('dg-import-file').addEventListener('change',importFile);
  }

  function authChanged(u){
    const wasOpen=root&&!root.hidden;
    const prior=currentUser && currentUser.uid;
    currentUser=isAllowed(u) ? u : null;
    if(button)button.hidden=!currentUser;
    if(!currentUser){if(wasOpen)close();data=empty();overrides={};existingTPs=null;existingTPsPending=false;return;}
    if(prior!==(u.uid||null)){existingTPs=null;existingTPsPending=false;data=loadLocal();overrides={};chosen=null;if(wasOpen)refresh();}
  }
  function open(){if(!canEdit())return;root.hidden=false;root.setAttribute('aria-hidden','false');document.body.classList.add('dg-modal-open');refresh();updateSidebar();}
  function close(){if(!root)return;root.hidden=true;root.setAttribute('aria-hidden','true');document.body.classList.remove('dg-modal-open');closeEditor();if(map){map.remove();map=null;mapLayer=null;baseMapLayer=null;}}
  function onClick(ev){
    const target=ev.target.closest('button');if(!target||!root.contains(target))return;
    if(target.dataset.view){view=target.dataset.view;refresh();return;}
    if(target.dataset.mapStyle){switchMapStyle(target.dataset.mapStyle);return;}
    if(target.dataset.folderToggle){
      const id=target.dataset.folderToggle;
      if(expandedFolders.has(id))expandedFolders.delete(id);else expandedFolders.add(id);
      updateFolderVisibility();return;
    }
    if(target.dataset.folderChoice){
      const form=el('dg-editor-form'),fld=form?.elements.namedItem('folderId');if(fld)fld.value=target.dataset.folderChoice;
      root.querySelectorAll('.dg-folder-row').forEach(b=>b.classList.toggle('selected',b===target));
      const node=target.closest('[data-folder-node]');if(node)String(node.dataset.folderParents||'').split('|').filter(Boolean).forEach(id=>expandedFolders.add(id));updateFolderVisibility();
      const text=el('dg-folder-chosen');if(text)text.textContent='Tanlangan: '+target.dataset.folderPath;
      const name=form?.elements.namedItem('name');if(name&&!name.value.trim())name.value=mainFolders()[fld.value]?.name||'';
      if(editorType==='feeder')matchFeederPSFolder(fld.value);
      if(editorType==='tp')refreshExistingTPs();return;
    }
    if(target.dataset.section){section=target.dataset.section;renderList();return;}
    if(target.dataset.add){openEditor(target.dataset.add);return;}
    if(target.dataset.edit){openEditor(target.dataset.edit,target.dataset.id||'');return;}
    if(target.dataset.attachTps){attachExistingTps(target.dataset.attachTps);return;}
    if(target.dataset.del){removeEntity(target.dataset.del,target.dataset.id);return;}
    if(target.dataset.select){chosen=target.dataset.select;refresh();return;}
    if(target.dataset.switch){const key=target.dataset.switch;const [lineId, end]=key.split(':');const l=data.lines.find(x=>x.id===lineId);
      if(!l || station(l[end])?.kind==='tap')return;
      overrides[key]=!actualOpen(l,end);refresh();return;}
    const a=target.dataset.action;
    if(a==='close')close();
    if(a==='cancel-editor')closeEditor();
    if(a==='toggle-objects'){showObjects=!showObjects;if(showObjects)showImpact=false;updateSidebar();}
    if(a==='toggle-impact'){showImpact=!showImpact;if(showImpact)showObjects=false;updateSidebar();}
    if(a==='toggle-stats'){showStats=!showStats;updateSidebar();}
    if(a==='close-objects'){showObjects=false;updateSidebar();}
    if(a==='close-impact'){showImpact=false;updateSidebar();}
    if(a==='reset-switches'){overrides={};refresh();}
    if(a==='sample' && confirm('NAMUNA ma’lumotlarini yuklaysizmi? Joriy lokal qoralamangiz almashtiriladi. Avval JSON eksport qiling.')) {data=sample();overrides={};chosen=null;saveLocal();refresh();showMsg('Faqat ko‘rgazmali ma’lumotlar yuklandi.','success');}
    if(a==='clear' && confirm('DIQQAT: Barcha namunalar va ushbu brauzer qoralamasidagi kiritilgan obyektlar o‘chadi. Zarur bo‘lsa avval «↓ JSON» eksport qiling. Tozalaysizmi?')) {data=empty();overrides={};chosen=null;saveLocal();refresh();showMsg('Namuna va lokal qoralama tozalandi.','success');}
    if(a==='export')exportFile();
    if(a==='import')el('dg-import-file').click();
    if(a==='towers'){mapTowers=!mapTowers;refresh();}
    if(a==='picker-objects'){visiblePickerObjects=!visiblePickerObjects;const btn=root.querySelector('[data-action="picker-objects"]');if(btn)btn.textContent=(visiblePickerObjects?'✓':'○')+' PS va liniyalar';renderPickerContext();}
    if(a==='expand-picker'){const wrap=root.querySelector('.dg-pick-section');if(wrap){const big=wrap.classList.toggle('dg-picker-expanded');target.textContent=big?'⊟ Xaritani kichraytirish':'⛶ Xaritani kattalashtirish';setTimeout(()=>pickerMap?.invalidateSize(),90);}}
    if(a==='map-tps'){mapTps=!mapTps;refresh();}
    if(a==='map-consumers'){mapConsumers=!mapConsumers;refresh();}
  }
  function refresh(){if(!root||root.hidden)return;
    root.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    renderList();renderMain();renderImpact();
  }
  function badgeStatus(oper) {return oper?'dg-good':'dg-off';}
  function renderList(){
    root.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
    const container=el('dg-item-list');if(!container)return;
    const towerItems=data.lines.flatMap(l=>arr(l.towers).map((t,i)=>({id:towerRef(l,t,i),name:t.number?'Tayanch '+t.number:'Raqamsiz tayanch',lineId:l.id,number:t.number,lat:t.lat,lng:t.lng})));
    const mapSec={stations:data.stations.filter(x=>x.kind!=='tap'),lines:data.lines,towers:towerItems,feeders:data.feeders,tps:data.tps,consumers:data.consumers};
    const items=mapSec[section]||[];
    container.innerHTML=items.length ? items.map(x=>{
      const type={stations:'station',lines:'line',towers:'tower',feeders:'feeder',tps:'tp',consumers:'consumer'}[section];
      const info=section==='stations'? `${x.kind==='source'?'MANBA PS':'PS'} · ${arr(x.volts).join('/')} kV`:
        section==='lines' ? `${esc(x.voltage)} kV · ${esc(station(x.a)?.name||'?')} — ${esc(station(x.b)?.name||'?')}` :
        section==='towers' ? `${esc(data.lines.find(l=>l.id===x.lineId)?.name||'?')} · ${x.lat==null?'Joylashuv taxminiy':(Number(x.lat).toFixed(5)+', '+Number(x.lng).toFixed(5))}` :
        section==='feeders' ? `${esc(station(x.psId)?.name||'?')} · ${esc(x.voltage)} kV`:
        section==='tps' ? `${esc(feeder(x.feederId)?.name||'?')} · ${num(x.kva)} kVA`:
        `${x.kind==='mahalla'?'Mahalla':'Tashkilot'} · ${esc(tp(x.tpId)?.name||'bog‘lanmagan')}`;
      return `<article class="dg-item ${chosen===x.id?'selected':''}"><button type="button" class="dg-item-main" data-select="${esc(x.id)}"><strong>${esc(x.name)}</strong><small>${info}</small></button>${section==='feeders'?`<button type="button" title="Shu fider papkasidagi HETK TP/KTP larni biriktirish" data-attach-tps="${esc(x.id)}">↳ TP</button>`:''}<button type="button" title="Tahrirlash" data-edit="${type}" data-id="${esc(x.id)}">✎</button></article>`;
    }).join('') : `<div class="dg-empty-list">Hozircha ma’lumot yo‘q. Yuqoridagi + tugmasi bilan qo‘shing yoki «Namuna»ni oching.</div>`;
  }

  function renderMain(){
    const result=analyze();
    const countPS=data.stations.filter(x=>x.kind!=='tap').length;
    el('dg-kpis').innerHTML=[
      ['Podstansiyalar',countPS,'fa-bolt'],['Liniya uchastkalari',data.lines.length,'fa-project-diagram'],
      ['Ta’minotsiz TP/KTP*',result.affectedTps.length,'fa-building'],['Ta’sirlangan mahalla/tashkilot*',result.affected.length,'fa-exclamation-triangle']
    ].map(([label,val,ic])=>`<div class="dg-kpi"><i class="fas ${ic}"></i><div><b>${val}</b><span>${label}</span></div></div>`).join('');
    let title='';
    if(view==='simple') title='Sodda dispetcherlik sxemasi';
    if(view==='technical') title='Texnik bir chiziqli ko‘rinish (soddalashtirilgan)';
    if(view==='combined') title='GIS xarita — PS, liniya, otpayka va tayanchlar';
    el('dg-view-title').innerHTML=`<div><strong>${title}</strong><small>Harakatli nuqtalar — faqat modelda bitta manbadan yetib boradigan yo‘l; haqiqiy tok oqimi emas</small></div>${view==='combined'?
      `<div class="dg-layer-tools">${mapStyleButtons()}<button type="button" data-action="towers">${mapTowers?'✓':'○'} Tayanch raqamlari</button><button type="button" data-action="map-tps">${mapTps?'✓':'○'} TP/KTP</button><button type="button" data-action="map-consumers">${mapConsumers?'✓':'○'} Mahalla / tashkilot</button></div>`:''}`;
    const visual=el('dg-visual-content');
    if(view==='combined'){
      visual.innerHTML='<div class="dg-combined"><div id="dg-map" class="dg-map"></div></div>';
      renderMap(result);
    } else {
      if(map){map.remove();map=null;mapLayer=null;baseMapLayer=null;}
      visual.innerHTML=renderDiagram(result,view==='technical');
    }
  }
  function geometryFor(line){
    const a=station(line.a), b=station(line.b);if(!a||!b||a.lat==null||a.lng==null||b.lat==null||b.lng==null)return [];
    const sorted=arr(line.towers);
    const fallback=sorted.map((t,i)=>({lat: num(a.lat)+(num(b.lat)-num(a.lat))*((i+1)/(sorted.length+1)),lng:num(a.lng)+(num(b.lng)-num(a.lng))*((i+1)/(sorted.length+1)), number:t.number}));
    const pts=[{lat:num(a.lat),lng:num(a.lng)},...sorted.map((t,i)=>({lat:t.lat==null?fallback[i].lat:num(t.lat),lng:t.lng==null?fallback[i].lng:num(t.lng),number:t.number})),{lat:num(b.lat),lng:num(b.lng)}];
    return pts;
  }
  function renderMap(result){
    if(!window.L || !el('dg-map')){el('dg-map').textContent='Xarita kutubxonasi yuklanmagan.';return;}
    if(map){map.remove();map=null;baseMapLayer=null;}
    map=L.map('dg-map',{zoomControl:true,attributionControl:true}).setView([40.11,65.51],10);
    // Leaflet popup content stops click bubbling. Bind its edit button directly.
    if(map.on)map.on('popupopen',e=>{
      const popup=e.popup?.getElement?.();if(!popup)return;
      popup.querySelectorAll('button[data-edit]').forEach(btn=>btn.addEventListener('click',evt=>{
        evt.preventDefault();evt.stopPropagation();openEditor(btn.dataset.edit,btn.dataset.id||'');
      },{once:true}));
    });
    baseMapLayer=makeBaseMap(map);
    mapLayer=L.layerGroup().addTo(map);const bounds=[];
    data.lines.forEach(l=>{
      const coords=geometryFor(l).map(x=>[x.lat,x.lng]);
      if(coords.length<2||coords.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))return;
      const on=accessibleEdge(l) && result.energized[l.a] && result.energized[l.b];
      const poly=L.polyline(coords,{color:on?(COLORS[l.voltage]||'#999'):'#9ba6b5',weight:l.voltage>=110?5:4,opacity:on?0.92:0.62,dashArray:on?null:'7 9'}).addTo(mapLayer);
      poly.bindPopup(`<strong>${esc(l.name)}</strong><div>${esc(l.voltage)} kV</div><div>Simulyatsiyada: ${on?'Ta’minot yo‘li mavjud':'Ulangan manba yo‘q yoki o‘chirgich ochiq'}</div><button type="button" class="dg-popup-edit" data-edit="line" data-id="${esc(l.id)}">✎ Liniyani tahrirlash</button>`);
      poly.bindTooltip(esc(l.name),{permanent:true,direction:'center',className:'dg-line-label'});
      coords.forEach(p=>bounds.push(p));
      // Moving light dots trace a modeled *supply path*, NEVER measured MW flow.
      // Reverse geographic coordinates when the model reaches this edge from B.
      const direction=on&&result.sourceCount[l.a]===1&&result.sourceCount[l.b]===1?result.direction[l.id]:0;
      if(direction){
        const route=direction===1?coords:[...coords].reverse();
        L.polyline(route,{color:'#e3fff5',weight:4,opacity:0.95,dashArray:'1 14',lineCap:'round',interactive:false,className:'dg-gis-flow-path'}).addTo(mapLayer);
      }
      // Show each numbered or unnumbered support as a persistent clickable point.
      // Without GPS the point is an ESTIMATE between adjacent known positions.
      geometryFor(l).slice(1,-1).forEach((t,i)=>{
        const original=arr(l.towers)[i]||{};
        const actual=original.lat!=null&&original.lng!=null&&validGps(original.lat,original.lng);
        const text=(t.number?'Tayanch '+t.number:'Raqamsiz tayanch')+(actual?'':' (GPS aniqlanmagan — taxminiy)');
        const marker=L.circleMarker([t.lat,t.lng],{radius:actual?5:4,color:actual?'#123d6b':'#7b8997',weight:2,fillColor:actual?'#fff':'#dadfe5',fillOpacity:1}).addTo(mapLayer);
        if(marker.bindTooltip)marker.bindTooltip(esc(text),{permanent:mapTowers,direction:'top'});
        if(marker.bindPopup)marker.bindPopup(`<strong>${esc(text)}</strong><br>${actual?'GPS: '+num(t.lat).toFixed(6)+', '+num(t.lng).toFixed(6):'GPS kiritilmagan; chiziqdagi taxminiy joy'}<br><button type="button" class="dg-popup-edit" data-edit="tower" data-id="${esc(towerRef(l,original,i))}">✎ Tayanch joyini tahrirlash</button>`);
      });
    });
    data.stations.forEach(p=>{
      if(p.lat==null||p.lng==null||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng)))return;
      const color=p.kind==='source'?'#1e7adf':p.kind==='tap'?'#e8a547':'#153e75';
      L.circleMarker([num(p.lat),num(p.lng)],{radius:p.kind==='tap'?5:9,color:'#fff',weight:2,fillColor:color,fillOpacity:1})
        .addTo(mapLayer).bindTooltip(esc(p.name),{permanent:p.kind!=='tap',direction:'top',className:'dg-ps-tooltip'}).bindPopup(`<strong>${esc(p.name)}</strong><br>${arr(p.volts).join('/')} kV<br>${esc(p.folder||'Papka biriktirilmagan')}<br>GPS: ${num(p.lat).toFixed(6)}, ${num(p.lng).toFixed(6)}<br><button type="button" class="dg-popup-edit" data-edit="${p.kind==='tap'?'tap-point':'station'}" data-id="${esc(p.id)}">✎ ${p.kind==='tap'?'Otpayka nuqtasini':'PSni'} tahrirlash</button>`);
      bounds.push([num(p.lat),num(p.lng)]);
    });
    if(mapTps)data.tps.forEach(t=>{
      if(t.lat==null||t.lng==null||!validGps(t.lat,t.lng))return;
      const f=feeder(t.feederId);
      L.circleMarker([num(t.lat),num(t.lng)],{radius:6,color:'#fff',weight:2,fillColor:'#9855bd',fillOpacity:1}).addTo(mapLayer)
        .bindTooltip(esc(t.name),{direction:'top'})
        .bindPopup(`<strong>${esc(t.name)}</strong><br>${num(t.kva)} kVA<br>Fider: ${esc(f?.name||'aniqlanmagan')}<br><button type="button" class="dg-popup-edit" data-edit="tp" data-id="${esc(t.id)}">✎ Tahrirlash</button>`);
      bounds.push([num(t.lat),num(t.lng)]);
    });
    if(mapConsumers)data.consumers.forEach(c=>{
      if(c.lat==null||c.lng==null||!validGps(c.lat,c.lng))return;
      L.circleMarker([num(c.lat),num(c.lng)],{radius:6,color:'#fff',weight:2,fillColor:c.kind==='mahalla'?'#ed9c2e':'#c45e81',fillOpacity:1}).addTo(mapLayer)
        .bindTooltip(esc(c.name),{direction:'top'})
        .bindPopup(`<strong>${esc(c.name)}</strong><br>${c.kind==='mahalla'?'Mahalla':'Tashkilot'}<br>${esc(tp(c.tpId)?.name||'TP biriktirilmagan')}<br><button type="button" class="dg-popup-edit" data-edit="consumer" data-id="${esc(c.id)}">✎ Tahrirlash</button>`);
      bounds.push([num(c.lat),num(c.lng)]);
    });
    if(bounds.length){try{map.fitBounds(bounds,{padding:[35,35],maxZoom:12});}catch(e){}}
    setTimeout(()=>{if(map)map.invalidateSize();},100);
  }
  function renderDiagram(result,technical){
    const vwidth=940,vheight=455;
    const sx=n=>clamp(num(n.x,480),45,895),sy=n=>clamp(num(n.y,170),55,385);
    const lines=data.lines.map(l=>{
      const a=station(l.a),b=station(l.b);if(!a||!b)return '';
      const x1=sx(a),y1=sy(a),x2=sx(b),y2=sy(b), color=COLORS[l.voltage]||'#788bb0';
      const active=accessibleEdge(l)&&result.energized[l.a]===true&&result.energized[l.b]===true;
      const parallel=result.sourceCount[l.a]>1;
      const dir=active&&!parallel?result.direction[l.id]:0;
      const path=`M ${x1} ${y1} L ${x2} ${y2}`;
      const labelX=(x1+x2)/2,labelY=(y1+y2)/2-12;
      const bulbs=dir?Array.from({length:3},(_,i)=>{
        const start=dir===1?0:1,end=dir===1?1:0;
        const a0=(start+(end-start)*(i/3)),a1=end;
        const fromX=x1+(x2-x1)*a0,fromY=y1+(y2-y1)*a0,toX=x1+(x2-x1)*a1,toY=y1+(y2-y1)*a1;
        return `<circle class="dg-flow-light" r="5" cx="${fromX}" cy="${fromY}" fill="#b4ffdf"><animate attributeName="cx" values="${fromX};${toX}" begin="${(i*.43).toFixed(2)}s" dur="1.4s" repeatCount="indefinite"/><animate attributeName="cy" values="${fromY};${toY}" begin="${(i*.43).toFixed(2)}s" dur="1.4s" repeatCount="indefinite"/></circle>`;
      }).join(''):'';
      function breaker(end,n,x,y){if(n?.kind==='tap')return '';
        const opened=actualOpen(l,end),tx=end==='a'?0.15:0.85,px=x1+(x2-x1)*tx,py=y1+(y2-y1)*tx;
        return `<g class="dg-breaker ${opened?'open':'closed'}"><rect x="${px-8}" y="${py-8}" width="16" height="16" rx="2" fill="${opened?'#fff':'#20b978'}" stroke="${opened?'#fa6675':'#067957'}" stroke-width="2.5"/>${technical?`<text x="${px}" y="${py-14}" text-anchor="middle" font-size="12" fill="currentColor">QF ${opened?'ochiq':'yopiq'}</text>`:''}</g>`;
      }
      const label=technical?`<g><rect x="${labelX-65}" y="${labelY-16}" width="130" height="22" rx="6" fill="#e9f4ff" stroke="#bfd4e9"/><text x="${labelX}" y="${labelY-1}" text-anchor="middle" font-size="11" fill="#123f6c">${esc(l.name)} · ${num(l.voltage)} kV</text></g>`:
        `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${esc(l.name)}</text>`;
      return `<g><path d="${path}" stroke="${active?color:'#adb8c7'}" stroke-width="${l.voltage>=110?6:5}" stroke-linecap="round" fill="none" ${active?'':'stroke-dasharray="8 7"'}/>${bulbs}${label}${breaker('a',a)}${breaker('b',b)}</g>`;
    }).join('');
    const nodes=data.stations.map(n=>{
      const x=sx(n),y=sy(n),on=result.energized[n.id], amb=result.sourceCount[n.id]>1;
      if(n.kind==='tap')return `<g><circle cx="${x}" cy="${y}" r="10" stroke="#e3a14b" stroke-width="3" fill="#fff"/><circle cx="${x}" cy="${y}" r="4" fill="${on?'#1cc984':'#94a3b8'}"/><text text-anchor="middle" x="${x}" y="${y+27}" font-size="11" fill="currentColor">${esc(n.name)}</text></g>`;
      const title=esc(n.name.length>23?n.name.slice(0,22)+'…':n.name);
      return `<g><rect x="${x-83}" y="${y-31}" width="166" height="66" rx="11" fill="${n.kind==='source'?'#1452a0':'#133c6a'}" stroke="${amb?'#f6b34f':on?'#2cd6a8':'#839ab2'}" stroke-width="${on?3:2}"/><text x="${x}" y="${y-5}" fill="#fff" font-size="14" text-anchor="middle" font-weight="700">${title}</text><text x="${x}" y="${y+15}" fill="#beddfa" font-size="12" text-anchor="middle">${esc(arr(n.volts).join('/'))} kV${n.kind==='source'?' · MANBA':''}</text>${technical?`<text x="${x}" y="${y+52}" fill="currentColor" text-anchor="middle" font-size="11">${data.feeders.filter(f=>f.psId===n.id).length} fider</text>`:''}</g>`;
    }).join('');
    return `<div class="dg-diagram-wrap"><svg class="dg-network-svg" viewBox="0 0 ${vwidth} ${vheight}" role="img" aria-label="Podstansiyalar, liniyalar va o‘chirgichlar sxemasi"><defs><filter id="dg-glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g>${lines}</g><g>${nodes}</g></svg><div class="dg-diagram-caption">Chiroqchalar: faqat bir manbali ta’minot yo‘li. Kulrang chiziq: o‘chirilgan yoki holati aniqlanmagan. Sxema koordinatalari qo‘lda tahrirlanadi.</div></div>`;
  }
  function renderImpact(){
    const r=analyze();const impactedPS=data.stations.filter(x=>x.kind==='ps'&&!r.energized[x.id]);
    const warnings=[];
    if(r.parallel.length) warnings.push({title:'Ikki manba bir konturda',msg:'Parallellash imkoniyati bor. Sinxronizm va himoya tekshirilmaguncha yo‘nalish animatsiyasi o‘chirildi.'});
    if(r.malformed.length)warnings.push({title:'Noto‘g‘ri yoki yetishmaydigan ulanish',msg:'Tekshiring: '+r.malformed.join(', ')});
    if(Object.keys(overrides).length)warnings.push({title:'Virtual sxema o‘zgartirildi',msg:'Bu faqat ushbu ekrandagi sinov. Haqiqiy o‘chirgich holati o‘zgarmadi.'});
    const groups={mahalla:r.affected.filter(c=>c.kind==='mahalla'),organization:r.affected.filter(c=>c.kind!=='mahalla')};
    const consDisplay=(list)=>list.length?list.map(c=>{
      const t=tp(c.tpId),f=t&&feeder(t.feederId);
      return `<div class="dg-impact-row"><strong>${esc(c.name)}</strong><small>${esc(t?.name||'TP?')} · ${esc(f?.name||'Fider?')}</small></div>`;
    }).join(''):'<p class="dg-none">Bog‘langan obyekt yo‘q.</p>';
    const controls=data.lines.map(l=>{
      const a=station(l.a),b=station(l.b);
      const create=(end,node)=>node && node.kind!=='tap'?`<button type="button" class="dg-qf ${actualOpen(l,end)?'is-open':'is-closed'}" data-switch="${esc(l.id+':'+end)}" title="Faqat virtual sxemadagi holatni almashtiradi">${actualOpen(l,end)?'○ Ochiq':'● Yopiq'} · ${end==='a'?'A':'B'}</button>`:'';
      return `<div class="dg-switch-row"><div><strong>${esc(l.name)}</strong><small>${esc(a?.name||'?')} — ${esc(b?.name||'?')}</small></div><div class="dg-qf-controls">${create('a',a)}${create('b',b)}</div></div>`;
    }).join('');
    el('dg-impact').innerHTML=`
      <div class="dg-impact-head"><strong>Ta’sir tahlili</strong><div><span>Virtual rejim</span><button type="button" class="dg-impact-close" data-action="close-impact" aria-label="Panelni yopish">✕</button></div></div>
      <div class="dg-impact-score"><strong>${r.affected.length}</strong><span>Mahalla / tashkilot*<small>Model bo‘yicha ta’minotsiz qolishi mumkin</small></span></div>
      <div class="dg-mini-stats"><span>${impactedPS.length} PS</span><span>${r.affectedTps.length} TP/KTP</span><span>${r.affectedKva.toLocaleString('uz-UZ')} kVA*</span></div>
      ${warnings.map(w=>`<div class="dg-alert"><b>⚠ ${esc(w.title)}</b><p>${esc(w.msg)}</p></div>`).join('')}
      <div class="dg-impact-section"><h3>Mahallalar (${groups.mahalla.length})</h3>${consDisplay(groups.mahalla)}</div>
      <div class="dg-impact-section"><h3>Tashkilotlar (${groups.organization.length})</h3>${consDisplay(groups.organization)}</div>
      ${r.unknown.length?`<div class="dg-alert"><b>To‘liq bog‘lanmagan iste’molchilar: ${r.unknown.length}</b><p>Fider/TP bog‘lanishlarini to‘ldirmasdan aniq ta’sir ro‘yxati olinmaydi.</p></div>`:''}
      <div class="dg-impact-section"><h3>Virtual QF o‘chirgichlari</h3><p class="dg-section-note">Bosilsa faqat shu ekrandagi sxema o‘zgaradi.</p>${controls||'<p class="dg-none">Liniya yaratilmagan.</p>'}</div>
      <div class="dg-impact-footnote">* Natija faqat kiritilgan aloqa modeli va mavjud iste’molchilar ro‘yxatiga asoslangan. kVA — nominal transformator quvvatlari yig‘indisi, yuklama emas. Ma’lumotlar to‘liqligi tasdiqlanmaguncha real uzilish hisobi emas.</div>`;
  }
  const options = (list,selected='')=>list.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.name)}</option>`).join('');
  const field = (name,label,val='',attrs='')=>`<label class="dg-field"><span>${label}</span><input name="${name}" value="${esc(val)}" ${attrs}></label>`;
  const select = (name,label,html)=>`<label class="dg-field"><span>${label}</span><select name="${name}">${html}</select></label>`;
  function locationPickerHtml(type){
    const instruction=type==='consumer'?'Mahalla yoki tashkilot markazini xaritada bosing. Bu nuqta uning butun elektr ta’minoti hududini ifodalamaydi.'
      :type==='tp'?'TP/KTPning haqiqiy joyini xaritada bosing yoki markerni suring.'
      :type==='tap'
      ? 'Xaritadagi tanlangan liniya ustiga bosing. Otpayka aynan shu trassaga yopishtiriladi, foiz avtomatik hisoblanadi.'
      : type==='tap-point'
      ? 'Otpayka nuqtasining yangi GPS joyini xaritadan tanlang. Elektr ulanish o‘zgarmaydi; tanlangan nuqta sxemada ham ishlatiladi.'
      : type==='tower'
        ? 'Liniya yo‘li ko‘rsatiladi. Tayanch joyiga bosing yoki markerni suring. GPS raqamini qo‘lda ham kiritishingiz mumkin.'
        : 'Xaritani yaqinlashtiring, PS joyiga bosing yoki ko‘k markerni suring. GPS kenglik/uzunlik avtomatik yoziladi.';
    return `<section class="dg-pick-section"><div class="dg-pick-head"><strong>📍 Xaritadan aniq koordinatani tanlash</strong><small>${instruction}</small></div><div class="dg-picker-tools">${mapStyleButtons()}<button type="button" data-action="picker-objects">${visiblePickerObjects?'✓':'○'} PS va liniyalar</button><button type="button" data-action="expand-picker">⛶ Xaritani kattalashtirish</button></div><div id="dg-location-picker" class="dg-location-map"></div><div class="dg-picker-coord" id="dg-picker-info">GPS kiritilmagan · xaritadan nuqtani tanlang</div></section>`;
  }
  function renderPickerContext(){
    if(!pickerMap||!window.L)return;
    if(pickerContext){pickerMap.removeLayer(pickerContext);pickerContext=null;}
    if(!visiblePickerObjects)return;
    pickerContext=L.layerGroup().addTo(pickerMap);
    const selectedLineId=el('dg-editor-form')?.elements.namedItem('lineId')?.value||'';
    for(const l of data.lines){
      const coords=geometryFor(l);if(coords.length<2)continue;
      const selected=l.id===selectedLineId;
      const path=L.polyline(coords.map(p=>[p.lat,p.lng]),{color:COLORS[l.voltage]||'#74819b',weight:selected?6:3,opacity:selected?0.95:0.7,dashArray:selected?null:'5 6'}).addTo(pickerContext);
      if(path.bindTooltip)path.bindTooltip(esc(l.name)+' · '+esc(l.voltage)+' kV',{direction:'center',permanent:selected,className:'dg-line-label'});
    }
    for(const l of data.lines){
      const points=geometryFor(l).slice(1,-1);
      points.forEach((t,i)=>{const marker=L.circleMarker([t.lat,t.lng],{radius:3,color:'#274968',weight:1,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(pickerContext);if(marker.bindTooltip)marker.bindTooltip(esc('Tayanch '+(t.number||'raqamsiz')));});
    }
    for(const ps of data.stations){
      if(!validGps(ps.lat,ps.lng)||ps.lat==null||ps.lng==null)continue;
      const marker=L.circleMarker([num(ps.lat),num(ps.lng)],{radius:ps.kind==='tap'?4:7,weight:2,color:'#fff',fillColor:ps.kind==='source'?'#e15a4d':ps.kind==='tap'?'#e7ac3d':'#1478cb',fillOpacity:0.95}).addTo(pickerContext);
      if(marker.bindTooltip)marker.bindTooltip(esc(ps.name)+' · '+arr(ps.volts).join('/')+' kV',{permanent:false,direction:'top'});
      if(marker.on)marker.on('click',ev=>{if(window.L.DomEvent?.stopPropagation)window.L.DomEvent.stopPropagation(ev);pickerMap?.setView([num(ps.lat),num(ps.lng)],Math.max(15,pickerMap.getZoom()));});
    }
  }
  function initLocationPicker(type){
    destroyPicker();
    const slot=el('dg-location-picker');if(!slot)return;
    if(!window.L){slot.textContent='Leaflet xaritasi yuklanmagan. GPSni qo‘lda kiriting.';return;}
    const form=el('dg-editor-form'),latField=form.elements.namedItem('lat'),lngField=form.elements.namedItem('lng');
    const lineField=form.elements.namedItem('lineId');
    const validField=(field)=>field&&field.value.trim()!=='';
    const existing=validField(latField)&&validField(lngField)&&validGps(latField.value,lngField.value);
    let center=existing?[num(latField.value),num(lngField.value)]:null;
    if(!center&&lineField){const line=data.lines.find(l=>l.id===lineField.value);const pts=line&&geometryFor(line);if(pts?.length)center=[pts[Math.floor(pts.length/2)].lat,pts[Math.floor(pts.length/2)].lng];}
    if(!center){const ps=data.stations.find(s=>s.lat!=null&&s.lng!=null&&validGps(s.lat,s.lng));center=ps?[num(ps.lat),num(ps.lng)]:[40.1,65.5];}
    pickerMap=L.map(slot,{zoomControl:true,attributionControl:true}).setView(center,existing?15:11);
    pickerBaseMapLayer=makeBaseMap(pickerMap);
    renderPickerContext();
    function updateInfo(lat,lng){
      if(latField&&lngField){latField.value=Number(lat).toFixed(6);lngField.value=Number(lng).toFixed(6);}
      const info=el('dg-picker-info');if(info)info.textContent='Tanlangan GPS: '+Number(lat).toFixed(6)+', '+Number(lng).toFixed(6)+' (WGS84)';
    }
    function mark(lat,lng){
      if(!pickerMap)return;
      if(!pickerMarker){pickerMarker=L.marker([lat,lng],{draggable:type!=='tap'}).addTo(pickerMap);
        if(type!=='tap')pickerMarker.on('dragend',()=>{const p=pickerMarker.getLatLng();updateInfo(p.lat,p.lng);});
      } else pickerMarker.setLatLng([lat,lng]);
      pickerSelection={lat,lng};
      updateInfo(lat,lng);
    }
    function drawRoute(){
      if(pickerRoute){pickerMap.removeLayer(pickerRoute);pickerRoute=null;}
      const l=lineField&&data.lines.find(x=>x.id===lineField.value);
      const pts=l&&geometryFor(l);
      if(!pts?.length){const info=el('dg-picker-info');if(info && !pickerSelection)info.textContent='Liniyaga ulanish uchun PSlarning GPS koordinatalarini avval kiriting.';return;}
      pickerRoute=L.polyline(pts.map(p=>[p.lat,p.lng]),{color:COLORS[l.voltage]||'#1387c4',weight:6,opacity:.95}).addTo(pickerMap);
      const bounds=pickerRoute.getBounds();if(bounds.isValid())pickerMap.fitBounds(bounds.pad(.3),{maxZoom:15});
      if(type==='tap'){
        const f=form.elements.namedItem('percent');const point=routePointAt(l,clamp(num(f?.value,50)/100,0.01,.99));
        if(point)mark(point.lat,point.lng);
      }
    }
    pickerMap.on('click',ev=>{
      if(type!=='tap'){mark(ev.latlng.lat,ev.latlng.lng);return;}
      const l=lineField&&data.lines.find(x=>x.id===lineField.value);
      const pts=l&&geometryFor(l);
      if(!pts?.length){showMsg('Otpayka uchun avval liniya uchlaridagi PS GPS joyini kiriting.','error');return;}
      const click=pickerMap.latLngToLayerPoint(ev.latlng);let best=null;
      const length=pts.slice(1).map((p,i)=>lineDistance(pts[i],p)),total=length.reduce((a,b)=>a+b,0);
      let traveled=0;
      for(let i=0;i<pts.length-1;i++){
        const a=pickerMap.latLngToLayerPoint([pts[i].lat,pts[i].lng]);
        const b=pickerMap.latLngToLayerPoint([pts[i+1].lat,pts[i+1].lng]);
        const dx=b.x-a.x,dy=b.y-a.y;
        const t=clamp(((click.x-a.x)*dx+(click.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
        const x=a.x+t*dx,y=a.y+t*dy,dist=Math.hypot(click.x-x,click.y-y);
        if(!best||dist<best.dist)best={dist,ratio:total?(traveled+length[i]*t)/total:0};
        traveled+=length[i];
      }
      if(!best||best.dist>32){showMsg('Otpayka joyi liniyadan uzoqda. Chiziqqa yaqinroq bosing.','error');return;}
      const percent=clamp(best.ratio*100,1,99);
      const field=form.elements.namedItem('percent');if(field)field.value=percent.toFixed(2);
      const point=routePointAt(l,percent/100);if(point)mark(point.lat,point.lng);
    });
    if(lineField)lineField.addEventListener('change',()=>{renderPickerContext();drawRoute();});
    if(type==='tap')form.elements.namedItem('percent')?.addEventListener('change',()=>{
      const l=data.lines.find(x=>x.id===lineField.value);const p=l&&routePointAt(l,clamp(num(form.elements.namedItem('percent').value)/100,0.01,.99));if(p)mark(p.lat,p.lng);
    });
    if(latField&&lngField){for(const input of [latField,lngField])input.addEventListener('change',()=>{
      if(validField(latField)&&validField(lngField)&&validGps(latField.value,lngField.value)){
        const lat=num(latField.value),lng=num(lngField.value);
        if(type!=='tap'){mark(lat,lng);pickerMap.setView([lat,lng],Math.max(13,pickerMap.getZoom()));}
      }
    });}
    if(lineField)drawRoute();
    if(existing&&type!=='tap')mark(num(latField.value),num(lngField.value));
    setTimeout(()=>{if(pickerMap)pickerMap.invalidateSize();},140);
  }
  function matchFeederPSFolder(folderId){
    if(!folderId)return;
    const form=el('dg-editor-form'),choice=form?.elements.namedItem('psId');if(!choice)return;
    const matching=data.stations.filter(s=>s.kind!=='tap'&&s.folderId&&folderIncludes(folderId,s.folderId));
    if(matching.length===1)choice.value=matching[0].id;
  }
  function openEditor(type,id='') {
    if(!canEdit())return;
    if(['line','tap','tower'].includes(type) && !data.stations.length){showMsg('Avval PS yarating.','error');return;}
    if(type==='consumer' && !data.tps.length){showMsg('Avval TP/KTP yarating.','error');return;}
    if(type==='tp' && !data.feeders.length){showMsg('Avval fider yarating.','error');return;}
    const collection={station:'stations',line:'lines',feeder:'feeders',tp:'tps',consumer:'consumers'}[type];
    let rec=collection?(data[collection].find(x=>x.id===id)||{}):{};
    if(type==='tower' && id){const found=findTowerRef(id);rec=found?{...found.tower,lineId:found.line.id}:{};}
    if(type==='tap-point' && id){rec=station(id)||{};}
    editorType=type;editorId=id;
    const names={station:'PS yoki manba',line:'Liniya',tap:'Otpayka', 'tap-point':'Otpayka nuqtasi', tower:'Tayanch',feeder:'Fider',tp:'TP/KTP',consumer:'Mahalla yoki tashkilot'};
    el('dg-editor-title').textContent=(id?'Tahrirlash: ':'Qo‘shish: ')+names[type];
    let html='';
    if(type==='station'){
      html+=select('kind','PS turi',`<option value="ps" ${rec.kind!=='source'?'selected':''}>Oddiy PS</option><option value="source" ${rec.kind==='source'?'selected':''}>Manba PS</option>`);
      html+=field('name','PS nomi',rec.name,'required maxlength="100"');
      html+=field('volts','Kuchlanish darajalari (masalan: 35,10)',arr(rec.volts).join(','),'required placeholder="35,10"');
      html+=folderPickerHtml(rec.folderId||'',rec.folder||'');
      html+='<div class="dg-two">'+field('lat','GPS kenglik (latitude)',rec.lat==null?'':rec.lat,'type="number" min="-90" max="90" step="any" placeholder="40.123456"')+field('lng','GPS uzunlik (longitude)',rec.lng==null?'':rec.lng,'type="number" min="-180" max="180" step="any" placeholder="65.123456"')+'</div>';
      html+=locationPickerHtml('station');
      html+='<details class="dg-schema-position"><summary>▦ Sxemadagi joylashuv (ixtiyoriy)</summary><div class="dg-form-tip">X/Y — GIS xaritadagi GPS emas! Faqat 1- va 2-variant sxemada PS qayerda chizilishini bildiradi. GPSni yuqoridagi xaritada belgilang.</div><div class="dg-two">'+field('x','Sxemadagi X — chapdan o‘ngga (45–895)',rec.x==null?Math.floor(120+Math.random()*620):rec.x,'type="number" min="45" max="895"')+field('y','Sxemadagi Y — yuqoridan pastga (55–385)',rec.y==null?220:rec.y,'type="number" min="55" max="385"')+'</div></details>';
    } else if(type==='line'){
      html+=field('name','Liniya nomi',rec.name,'required maxlength="120"');
      html+=select('voltage','Kuchlanish',VOLTAGES.map(v=>`<option value="${v}" ${num(rec.voltage||35)===v?'selected':''}>${v} kV</option>`).join(''));
      html+=select('a','Birinchi ulanish nuqtasi',options(data.stations,rec.a));
      html+=select('b','Ikkinchi ulanish nuqtasi',options(data.stations,rec.b));
      html+='<div class="dg-form-tip">PSlar avtomatik ulanmaydi. Har ikkala nuqtada ham shu kuchlanish darajasi mavjud bo‘lishi shart. Liniyani yaratish xavfsiz elektr ulanishini tasdiqlamaydi.</div>';
      html+=`<div class="dg-two">${select('openA','A tomondagi QF (model)',`<option value="false" ${!rec.openA?'selected':''}>Yopiq</option><option value="true" ${rec.openA?'selected':''}>Ochiq</option>`)}${select('openB','B tomondagi QF (model)',`<option value="false" ${!rec.openB?'selected':''}>Yopiq</option><option value="true" ${rec.openB?'selected':''}>Ochiq</option>`)}</div>`;
    } else if(type==='tap'){
      html+=select('lineId','Otpayka chiqadigan liniya uchastkasi',options(data.lines));
      html+=field('name','Otpayka nomi','Otpayka '+(data.stations.filter(x=>x.kind==='tap').length+1),'required');
      html+=field('percent','Liniya trassasi bo‘yicha joyi, %','50','type="number" min="1" max="99" step="0.01" required');
      html+=locationPickerHtml('tap');
      html+=select('target','Qaysi PSga otpayka ketadi?',options(data.stations.filter(x=>x.kind!=='tap')));
      html+='<div class="dg-form-tip">Tanlangan uchastka 2 qismga bo‘linadi. Otpayka alohida ulanish nuqtasi sifatida saqlanadi. Bu faqat sxematik model.</div>';
    } else if(type==='tap-point'){
      html+=field('name','Otpayka nuqtasining nomi',rec.name,'required maxlength="120"');
      html+='<div class="dg-form-tip">Bu yerda faqat nuqtaning GPS joyi va nomi yangilanadi. Mavjud liniya/PS ulanishlari va QF holatlari o‘zgarmaydi. Xaritadan haqiqiy magistral tarmoqlanish joyini tanlang.</div>';
      html+='<div class="dg-two">'+field('lat','GPS kenglik',rec.lat==null?'':rec.lat,'type="number" min="-90" max="90" step="any" required')+field('lng','GPS uzunlik',rec.lng==null?'':rec.lng,'type="number" min="-180" max="180" step="any" required')+'</div>';
      html+=locationPickerHtml('tap-point');
    } else if(type==='tower'){
      html+=select('lineId' ,'Liniya uchastkasi',options(data.lines,rec.lineId));
      html+=field('number','Tayanch raqami (ixtiyoriy)',rec.number||'', 'placeholder="Masalan: 12A" maxlength="40"');
      html+='<div class="dg-two">'+field('lat','GPS kenglik (ixtiyoriy)',rec.lat==null?'':rec.lat,'type="number" min="-90" max="90" step="any"')+field('lng','GPS uzunlik (ixtiyoriy)',rec.lng==null?'':rec.lng,'type="number" min="-180" max="180" step="any"')+'</div>';
      html+=locationPickerHtml('tower');
      html+='<div class="dg-form-tip">Tayanch xaritada doim kichik nuqta bo‘lib chiqadi. GPS berilmasa taxminiy joy ko‘rsatiladi. Nuqtani bosib aniq joyiga ko‘chirish mumkin.</div>';
    } else if(type==='feeder'){
      html+=field('name','Fider nomi',rec.name,'required maxlength="120"');
      html+=select('psId','Qaysi PSdan chiqadi?',options(data.stations.filter(x=>x.kind!=='tap'),rec.psId));
      html+=select('voltage','Fider kuchlanishi', [6,10].map(v=>`<option value="${v}" ${num(rec.voltage||10)===v?'selected':''}>${v} kV</option>`).join(''));
      html+=folderPickerHtml(rec.folderId||'');
      html+='<div class="dg-form-tip">PS papkasining ichidagi fider papkasini tanlang. Tegishli PS faqat bitta bo‘lsa avtomatik tanlanadi; yangi elektr liniya yaratilmaydi.</div>';
    } else if(type==='tp'){
      html+=field('name','TP/KTP nomi',rec.name,'required maxlength="120"');
      html+=select('feederId','Ulangan fider',options(data.feeders,rec.feederId));
      html+=existingTPFields();
      html+=folderPickerHtml(rec.folderId||'');
      html+=field('kva','Nominal quvvati, kVA',rec.kva==null?'':rec.kva,'type="number" min="0" step="0.1" required');
      html+='<div class="dg-two">'+field('lat','GPS kenglik (ixtiyoriy)',rec.lat==null?'':rec.lat,'type="number" min="-90" max="90" step="any"')+field('lng','GPS uzunlik (ixtiyoriy)',rec.lng==null?'':rec.lng,'type="number" min="-180" max="180" step="any"')+'</div>';
      html+=locationPickerHtml('tp');
    } else if(type==='consumer'){
      html+=select('kind','Iste’molchi turi',`<option value="mahalla" ${rec.kind==='mahalla'?'selected':''}>Mahalla</option><option value="organization" ${rec.kind==='organization'?'selected':''}>Tashkilot</option>`);
      html+=field('name','Mahalla / tashkilot nomi',rec.name,'required maxlength="180"');
      html+=select('tpId','Qaysi TP/KTP orqali ta’minlanadi?',options(data.tps,rec.tpId));
      html+=field('note','Izoh (ixtiyoriy)',rec.note,'maxlength="260"');
      html+='<div class="dg-two">'+field('lat','Joylashuv markazi: GPS kenglik',rec.lat==null?'':rec.lat,'type="number" min="-90" max="90" step="any"')+field('lng','Joylashuv markazi: GPS uzunlik',rec.lng==null?'':rec.lng,'type="number" min="-180" max="180" step="any"')+'</div>';
      html+=locationPickerHtml('consumer');
      html+='<div class="dg-form-tip">Iste’molchi bir nechta TPdan ta’minlansa, oddiy bitta bog‘lanish asosidagi ta’sir hisobi yetarli emas. Bunday murakkab ulanish uchun alohida model kerak.</div>';
    }
    el('dg-editor-form').innerHTML=html+`<div class="dg-editor-actions">${id&&type!=='tap-point'?`<button type="button" class="dg-delete" data-del="${esc(type)}" data-id="${esc(id)}">O‘chirish</button>`:''}<button type="button" data-action="cancel-editor">Bekor qilish</button><button type="submit" class="dg-save">Saqlash</button></div>`;
    el('dg-editor').hidden=false;
    updateFolderVisibility();
    if(['station','tap','tap-point','tower','tp','consumer'].includes(type))initLocationPicker(type);
    if(type==='tp')prepareExistingTPs();
  }
  function onSave(ev){
    ev.preventDefault();if(!canEdit())return;
    const f=new FormData(ev.currentTarget),v=n=>String(f.get(n)||'').trim();
    const type=editorType,id=editorId||uid(),rec={id};
    let collection;
    if(type==='station'){
      rec.kind=v('kind');rec.name=v('name');rec.volts=[...new Set(v('volts').split(/[ ,;/]+/).map(Number).filter(n=>VOLTAGES.includes(n)))];
      if(!rec.volts.length) return showMsg('To‘g‘ri kuchlanish kiriting (220, 110, 35, 10 yoki 6).','error');
      const chosenFolder=selectedFolderFromForm(ev.currentTarget);rec.folderId=chosenFolder.id||station(id)?.folderId||'';rec.folder=chosenFolder.path||station(id)?.folder||'';rec.lat=v('lat')===''?null:num(v('lat'));rec.lng=v('lng')===''?null:num(v('lng'));
      if((rec.lat==null)!==(rec.lng==null))return showMsg('Xarita uchun ikkala GPS koordinatasini kiriting.','error');
      if(rec.lat!=null&&!validGps(rec.lat,rec.lng))return showMsg('GPS kenglik −90…90, uzunlik −180…180 oralig‘ida bo‘lsin.','error');
      rec.x=clamp(num(v('x'),470),45,895);rec.y=clamp(num(v('y'),200),55,385);
      collection='stations';
      const prior=station(id);
      if(prior){if(prior.kind==='tap')return;rec.sourceOff=prior.sourceOff;}
      const oldLines=data.lines.filter(x=>x.a===id||x.b===id);
      if(oldLines.some(l=>!rec.volts.includes(num(l.voltage))))return showMsg('PSga ulangan liniya kuchlanishi saqlanayotgan PS darajasida yo‘q. Avval liniyani tahrirlang.','error');
    } else if(type==='tap-point'){
      const old=station(id);if(!old||old.kind!=='tap')return showMsg('Otpayka topilmadi.','error');
      if(!v('name'))return showMsg('Otpayka nomini kiriting.','error');
      if(!v('lat')||!v('lng')||!validGps(v('lat'),v('lng')))return showMsg('Otpayka GPS koordinatalarini tekshiring.','error');
      Object.assign(old,{name:v('name'),lat:num(v('lat')),lng:num(v('lng'))});
      saveLocal();closeEditor();refresh();showMsg('Otpayka nuqtasi ko‘chirildi. Elektr ulanishlar o‘zgarmadi.','success');return;
    } else if(type==='line'){
      rec.name=v('name');rec.voltage=num(v('voltage'));rec.a=v('a');rec.b=v('b');
      if(rec.a===rec.b)return showMsg('Liniya ikki xil ulanish nuqtasi orasida bo‘lishi kerak.','error');
      if(!station(rec.a)?.volts.includes(rec.voltage)||!station(rec.b)?.volts.includes(rec.voltage))return showMsg('Kuchlanish mos emas: ikkala PS/otpayka ham liniya kuchlanishini qo‘llashi kerak.','error');
      rec.openA=v('openA')==='true';rec.openB=v('openB')==='true';
      rec.towers=arr(data.lines.find(x=>x.id===id)?.towers);collection='lines';
    } else if(type==='tap'){
      const origin=data.lines.find(l=>l.id===v('lineId')),target=station(v('target'));if(!origin||!target)return showMsg('Liniya va PSni tanlang.','error');
      if(!arr(target.volts).includes(num(origin.voltage)))return showMsg('Otpayka PS kuchlanishi liniyaga mos emas.','error');
      const a=station(origin.a),b=station(origin.b);
      const ratio=clamp(num(v('percent'),50),0.01,99.99)/100;
      const onRoute=routePointAt(origin,ratio);
      const j={id:uid(),name:v('name'),kind:'tap',volts:[num(origin.voltage)],folder:'',lat:onRoute?.lat??null,lng:onRoute?.lng??null,x:num(a?.x)+(num(b?.x)-num(a?.x))*ratio,y:num(a?.y)+(num(b?.y)-num(a?.y))*ratio};
      const index=data.lines.indexOf(origin);
      // Preserve the original terminal switches, do not invent a breaker at the tap.
      const supports=arr(origin.towers);
      const existingPoints=geometryFor(origin);
      const normalized=supports.map((t,i)=>({ ...t,lat:t.lat==null?existingPoints[i+1]?.lat:t.lat,lng:t.lng==null?existingPoints[i+1]?.lng:t.lng,estimated:t.lat==null||t.lng==null }));
      const splitAt=onRoute?.segment??Math.round(supports.length*ratio);
      const first={...origin,id:uid(),b:j.id,openB:false,towers:normalized.slice(0,splitAt)};
      const second={...origin,id:uid(),a:j.id,openA:false,towers:normalized.slice(splitAt)};
      const branch={id:uid(),name:'Otpayka '+target.name,voltage:num(origin.voltage),a:j.id,b:target.id,openA:false,openB:false,towers:[]};
      data.stations.push(j);data.lines.splice(index,1,first,second,branch);
      overrides={};saveLocal();closeEditor();refresh();showMsg('Otpayka, ikki magistral uchastka va PSga tarmoq yaratildi.','success');return;
    } else if(type==='tower'){
      const line=data.lines.find(l=>l.id===v('lineId'));if(!line)return showMsg('Liniyani tanlang.','error');
      const coordA=v('lat'),coordB=v('lng');
      if(!!coordA!==!!coordB)return showMsg('GPS uchun kenglik va uzunlikni birga kiriting.','error');
      if(coordA&&!validGps(coordA,coordB))return showMsg('GPS koordinatalarini tekshiring.','error');
      if(!Array.isArray(line.towers))line.towers=[];
      const origin=editorId?findTowerRef(editorId):null;
      if(editorId&&!origin)return showMsg('Tahrirlanadigan tayanch topilmadi.','error');
      const entry={id:origin?.tower.id||uid(),number:v('number'),lat:coordA===''?null:num(coordA),lng:coordB===''?null:num(coordB)};
      if(origin){
        if(origin.line===line)line.towers[origin.index]=entry;
        else {origin.line.towers.splice(origin.index,1);line.towers.push(entry);}
      } else line.towers.push(entry);
      saveLocal();closeEditor();refresh();showMsg('Tayanch saqlandi.','success');return;
    } else if(type==='feeder'){
      rec.name=v('name');rec.psId=v('psId');rec.voltage=num(v('voltage'));
      rec.folderId=selectedFolderFromForm(ev.currentTarget).id||feeder(id)?.folderId||'';
      const parentPS=station(rec.psId);if(rec.folderId&&parentPS?.folderId&&!folderIncludes(rec.folderId,parentPS.folderId))return showMsg('Fider papkasi tanlangan PS papkasi ichida emas. To‘g‘ri PS/fiderni tanlang.','error');
      if(!station(rec.psId)?.volts.includes(rec.voltage))return showMsg('Fider kuchlanishi PS shinasiga mos kelishi kerak.','error');collection='feeders';
    } else if(type==='tp'){
      rec.name=v('name');rec.feederId=v('feederId');rec.kva=num(v('kva'));
      rec.linkedTpId=v('linkedTpId');rec.folderId=selectedFolderFromForm(ev.currentTarget).id||data.tps.find(t=>t.id===id)?.folderId||'';
      if(rec.linkedTpId&&data.tps.some(t=>t.id!==id&&t.linkedTpId===rec.linkedTpId))return showMsg('Bu HETK elementi boshqa TP/KTP qoralamasiga bog‘langan.','error');
      const chosenFeeder=feeder(rec.feederId);if(rec.folderId&&chosenFeeder?.folderId&&!folderIncludes(rec.folderId,chosenFeeder.folderId))return showMsg('TP/KTP papkasi tanlangan fider papkasi ichida emas. Tekshiring.','error');
      rec.lat=v('lat')===''?null:num(v('lat'));rec.lng=v('lng')===''?null:num(v('lng'));
      if((rec.lat==null)!==(rec.lng==null)|| (rec.lat!=null&&!validGps(rec.lat,rec.lng)))return showMsg('TP/KTP GPS koordinatalarini tekshiring.','error');
      if(!feeder(rec.feederId))return showMsg('Fider tanlanmagan.','error');if(rec.kva<0)return showMsg('kVA manfiy bo‘lmasin.','error');collection='tps';
    } else if(type==='consumer'){
      rec.name=v('name');rec.kind=v('kind');rec.tpId=v('tpId');rec.note=v('note');
      rec.lat=v('lat')===''?null:num(v('lat'));rec.lng=v('lng')===''?null:num(v('lng'));
      if((rec.lat==null)!==(rec.lng==null)|| (rec.lat!=null&&!validGps(rec.lat,rec.lng)))return showMsg('Mahalla/tashkilot GPS koordinatalarini tekshiring.','error');
      if(!tp(rec.tpId))return showMsg('TP/KTP tanlanmagan.','error');collection='consumers';
    } else return;
    if(!rec.name) return showMsg('Nomi bo‘sh bo‘lmasin.','error');
    const at=data[collection].findIndex(x=>x.id===id);if(at>=0)data[collection][at]=rec;else data[collection].push(rec);
    overrides={};saveLocal();closeEditor();refresh();showMsg('Lokal qoralamaga saqlandi.','success');
  }
  function removeEntity(type,id){
    if(!confirm('Ushbu obyektni lokal qoralamadan o‘chirasizmi?'))return;
    if(type==='tower'){
      const found=findTowerRef(id);
      if(!found)return showMsg('Tayanch topilmadi.','error');
      found.line.towers.splice(found.index,1);saveLocal();closeEditor();refresh();showMsg('Tayanch o‘chirildi.','success');return;
    }
    const deps={
      station:()=>data.lines.some(x=>x.a===id||x.b===id)||data.feeders.some(x=>x.psId===id),
      line:()=>false,
      feeder:()=>data.tps.some(x=>x.feederId===id),
      tp:()=>data.consumers.some(x=>x.tpId===id),
      consumer:()=>false
    };
    if(deps[type]?.())return showMsg('Bu obyektga boshqa elementlar ulangan. Oldin ularni uzing yoki o‘chiring.','error');
    const group={station:'stations',line:'lines',feeder:'feeders',tp:'tps',consumer:'consumers'}[type];
    if(!group)return;data[group]=data[group].filter(x=>x.id!==id);overrides={};saveLocal();closeEditor();refresh();
  }
  function exportFile(){
    const blob=new Blob([JSON.stringify({...data,_notice:'LOCAL DRAFT - NOT FOR OPERATIVE SWITCHING'},null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='HETK-dispetcherlik-qoralama-'+new Date().toISOString().slice(0,10)+'.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importFile(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>2*1024*1024)return showMsg('Import fayli 2 MB dan katta bo‘lmasin.','error');
    try{
      const next=JSON.parse(await file.text());
      if(!next||!['stations','lines','feeders','tps','consumers'].every(k=>Array.isArray(next[k])))throw Error('Mos bo‘lmagan JSON');
      if(!confirm('Import joriy lokal qoralama o‘rnini egallaydi. Davom etasizmi?'))return;
      data=normalizeTowerIds({version:1,...Object.fromEntries(['stations','lines','feeders','tps','consumers'].map(k=>[k,next[k].slice(0,2000)]))});
      overrides={};saveLocal();refresh();showMsg('Qoralama import qilindi. Operativ ma’lumot emas.','success');
    }catch(e){showMsg('JSONni o‘qib bo‘lmadi: '+e.message,'error');}
  }
  function init(){if(initialized)return;initialized=true;mapStyle=readMapStyle();createShell();
    document.addEventListener('hetk-auth-ready',e=>authChanged(e.detail&&e.detail.user));
    document.addEventListener('hetk-auth-user-updated',e=>authChanged(e.detail&&e.detail.user));
    document.addEventListener('hetk-auth-cleared',()=>authChanged(null));
    if(window.HETKAuth?.currentUser)authChanged(window.HETKAuth.currentUser);
  }
  window.HETKDispatchGrid = {open:()=>open(),analyzeDraft:()=>data?analyze():null,version:'64-local-draft'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
