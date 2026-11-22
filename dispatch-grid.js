/* HETK-Navoiy — Dispatch Grid simulation v81
 * NO SCADA CONTROL. Role-restricted Firebase RTDB shared simulation draft
 * autosaves with revision checks; existing local drafts are backed up before migration.
 * The animated dots are derived from the saved model and virtual QF states.
 */
(function () {
  'use strict';
  const ROLE_SET = new Set(['super_admin', 'chief_dispatcher', 'dispatcher']);
  const STORAGE = 'hetk.dispatchGrid.draft.v60.'; // Preserve legacy local draft key.
  const CLOUD_PATH = 'DispatchGridSimulation/shared'; // A SIMULATION ONLY shared draft. Never a SCADA state.
  const VOLTAGES = [500, 220, 110, 35, 10, 6];
  const COLORS = { 500:'#a73790', 220:'#e74655', 110:'#3186f6', 35:'#20b978', 10:'#e4a642', 6:'#ae7cf4' };
  let root, button, data, editorType = '', editorId = '', currentUser = null;
  let activePsId = null, callouts = null;
  let view = 'combined', section = 'stations', overrides = {}, chosen = null, map = null, mapLayer = null;
  let voltageVisible = Object.fromEntries(VOLTAGES.map(v=>[v,true])), mapTowers = false, mapTps = false, mapConsumers = false, legendExpanded = false, initialized = false;
  let showObjects = false, showImpact = false, showStats = false, pickerMap = null, pickerMarker = null, pickerRoute = null, pickerSelection = null;
  let pickerContext = null, baseMapLayer = null, pickerBaseMapLayer = null, visiblePickerObjects = true;
  let existingTPs = null, existingTPsPending = false, mapStyle = 'street';
  let expandedFolders = new Set(); // User-controlled open branches of HETK folder tree.
  let cloudWanted=false, cloudRevision=null, cloudBusy=false, cloudDirty=false, cloudBlocked=false;
  let cloudTimer=null, cloudEpoch=0, cloudReadStarted=false, cloudListenerRef=null, cloudListenerFn=null;
  let localChangeSerial=0, cloudStatusText='Firebase ulanishi tekshirilmoqda…';
  let cloudReady=false, cloudReadError=false, lastFolderSyncHash='';
  let feederPreviewModel=null, feederPreviewBusy=false, feederPreviewEpoch=0, feederPreviewUser='';
  let feederPreviewPoints={},feederPreviewAgain=false,liveRefreshInterval=null,liveScopeRef=null,liveScopeFn=null,liveScopeId='',liveRefreshTimer=null;
  let mnemoFilter={region:'',territory:'',ps:'',feeder:''};
  let mnemoLineWidth=3,mnemoLights=true;
  let mnemoExportBusy=false;
  const isSuperAdmin=()=>currentUser?.role==='super_admin';
  function canSeeFolder(id){return !window.HETKAuth?.canSeeFolder||window.HETKAuth.canSeeFolder(id,mainFolders());}
  function matchesScope(feederId,stationId){
    if(mnemoFilter.ps&&stationId!==mnemoFilter.ps)return false;
    if(mnemoFilter.feeder&&feederId!==mnemoFilter.feeder)return false;
    for(const id of [mnemoFilter.region,mnemoFilter.territory].filter(Boolean)){
      if(!folderIncludes(feederId,id)&&!folderIncludes(stationId,id))return false;
    }
    return true;
  }
  function currentMnemo(){return window.HETKLiveMnemo?.build?.(feederPreviewModel,feederPreviewPoints,mainFolders(),mnemoFilter,voltageVisible)||{groups:[],issues:[],totalTps:0};}


  const el = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const psLabel = name => { const clean=String(name||'').trim().replace(/^[\s'‘’ʼʻ`´"«»]+|[\s'‘’ʼʻ`´"«»]+$/g,'').trim(); return /^(?:PS|ПС)(?=\s|[-–—.:/]|$)/iu.test(clean)?clean:'PS '+clean; };
  const num = (v, fallback=0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback; };
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  const uid = () => 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,9);
  const empty = () => ({ version:1, stations:[], lines:[], feeders:[], tps:[], consumers:[] });
  const isAllowed = u => !!(u && u.active!==false && ROLE_SET.has(u.role));
  const storeKey = () => STORAGE + (currentUser && (currentUser.uid || currentUser.login) || 'unknown');
  const arr = (x) => Array.isArray(x) ? x : [];
  const MAP_TILES = {
    // Allow the user to zoom in, but never ask imagery services for map tiles
    // beyond a conservative native level. Esri can return a grey 'Map data not
    // yet available' JPEG (HTTP 200) for Uzbekistan at very large scales;
    // tileerror will NOT catch it. Leaflet upscales a known lower-level tile.
    street: {url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', opts:{maxZoom:20,maxNativeZoom:19,attribution:'&copy; OpenStreetMap contributors'}},
    satellite: {url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', opts:{maxZoom:20,maxNativeZoom:17,attribution:'Tiles &copy; Esri, Maxar, Earthstar Geographics, GIS User Community'}}
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
  function scopeOptions(){
    const folders=mainFolders(),stations=feederPreviewModel?.visibleStations||[];
    const regionOpts=Object.entries(folders).filter(([id,f])=>(f?.parentId||'root')==='root'&&canSeeFolder(id))
      .sort((a,b)=>String(a[1].name).localeCompare(String(b[1].name),'uz')).map(([id,f])=>({id,name:f.name}));
    const territories=Object.entries(folders).filter(([id,f])=>canSeeFolder(id)&&/(?:^|\s)(?:TET|ShET|ТЭТ|ШЭТ)(?:\s|$)/iu.test(String(f?.name||'')))
      .filter(([id])=>!mnemoFilter.region||folderIncludes(id,mnemoFilter.region))
      .sort((a,b)=>String(a[1].name).localeCompare(String(b[1].name),'uz')).map(([id,f])=>({id,name:folderPath(id,folders)}));
    const stationsFiltered=stations.filter(x=>!mnemoFilter.region||folderIncludes(x.id,mnemoFilter.region)||x.feeders?.some(f=>folderIncludes(f.id,mnemoFilter.region)))
      .filter(x=>!mnemoFilter.territory||folderIncludes(x.id,mnemoFilter.territory)||x.feeders?.some(f=>folderIncludes(f.id,mnemoFilter.territory)))
      .map(x=>({id:x.id,name:x.name}));
    const feeders=stations.flatMap(ps=>(ps.feeders||[]).filter(f=>matchesScope(f.id,ps.id)||(!mnemoFilter.ps&&!mnemoFilter.feeder&&(!mnemoFilter.region||folderIncludes(f.id,mnemoFilter.region))&&(!mnemoFilter.territory||folderIncludes(f.id,mnemoFilter.territory)))).map(f=>({id:f.id,name:`${f.name} (${ps.name})`})));
    return {region:regionOpts,territory:territories,ps:stationsFiltered,feeder:feeders};
  }
  function selectScope(type,title,items){
    const selected=mnemoFilter[type]||'';
    return `<label class="dg-param-select"><span>${title}</span><select data-param-scope="${type}"><option value="">Barchasi</option>${items.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>`;
  }
  function mapParameterMenu(){
    const option=(action,label,selected)=>`<button type="button" role="checkbox" aria-checked="${selected}" data-param-layer="${action}"><span class="dg-param-mark" aria-hidden="true">${selected?'✓':'○'}</span>${label}</button>`;
    const voltage=VOLTAGES.map(v=>`<button type="button" role="checkbox" aria-checked="${!!voltageVisible[v]}" data-param-voltage="${v}"><span class="dg-param-mark" aria-hidden="true">${voltageVisible[v]?'✓':'○'}</span><span class="dg-param-voltage-dot" style="--dg-voltage:${COLORS[v]}"></span>${v} kV</button>`).join('');
    const options=scopeOptions();
    return `<details class="dg-layer-menu"><summary aria-label="Xarita va mnemosxema parametrlarini ochish">⚙ Parametrlar <span aria-hidden="true">▾</span></summary><div class="dg-layer-menu-panel" role="group" aria-label="Ko‘rsatiladigan obyektlar va qatlamlar"><div class="dg-layer-group-title">Hudud va obyektlar</div>${selectScope('region','Viloyat / asosiy hudud',options.region)}${selectScope('territory','TET/ShET',options.territory)}${selectScope('ps','Podstansiya (PS)',options.ps)}${selectScope('feeder','Fider',options.feeder)}<div class="dg-layer-menu-separator"></div><div class="dg-layer-group-title">Liniya · kuchlanish</div>${voltage}<div class="dg-layer-menu-separator"></div>${option('towers','Tayanch raqamlari',mapTowers)}${option('map-tps','TP/KTP',mapTps)}<div class="dg-layer-menu-separator"></div><div class="dg-layer-group-title">Mnemosxema</div>${option('mnemo-lights','Harakatli chiroqchalar',mnemoLights)}<label class="dg-param-select"><span>Chiziq qalinligi (ekran, px)</span><select data-param-weight><option value="2" ${mnemoLineWidth===2?'selected':''}>2 px · ingichka</option><option value="3" ${mnemoLineWidth===3?'selected':''}>3 px · standart</option><option value="4" ${mnemoLineWidth===4?'selected':''}>4 px · qalin</option><option value="5" ${mnemoLineWidth===5?'selected':''}>5 px · juda qalin</option></select></label><div class="dg-layer-menu-actions"><button type="button" class="dg-params-cancel" data-action="params-cancel">Bekor qilish</button><button type="button" class="dg-params-apply" data-action="params-apply">OK</button></div></div></details>`;
  }
  // Parameter ticks are a DRAFT until OK. Cancel, Escape and outside click
  // never alter visible line layers; reopening always reflects committed state.
  function setParameterTick(button,checked){
    if(!button)return;
    button.setAttribute('aria-checked',String(!!checked));
    const mark=button.querySelector('.dg-param-mark');
    if(mark)mark.textContent=checked?'✓':'○';
  }
  function resetParameterTicks(menu){
    if(!menu)return;
    menu.querySelectorAll('[data-param-voltage]').forEach(btn=>setParameterTick(btn,!!voltageVisible[Number(btn.dataset.paramVoltage)]));
    menu.querySelectorAll('[data-param-layer]').forEach(btn=>setParameterTick(btn,btn.dataset.paramLayer==='towers'?mapTowers:btn.dataset.paramLayer==='map-tps'?mapTps:btn.dataset.paramLayer==='mnemo-lights'?mnemoLights:false));
    const weight=menu.querySelector('[data-param-weight]');if(weight)weight.value=String(mnemoLineWidth);
    menu.querySelectorAll('[data-param-scope]').forEach(select=>select.value=mnemoFilter[select.dataset.paramScope]||'');
  }
  function applyParameterTicks(menu){
    if(!menu)return;
    menu.querySelectorAll('[data-param-voltage]').forEach(btn=>{const kv=Number(btn.dataset.paramVoltage);if(VOLTAGES.includes(kv))voltageVisible[kv]=btn.getAttribute('aria-checked')==='true';});
    menu.querySelectorAll('[data-param-layer]').forEach(btn=>{
      const value=btn.getAttribute('aria-checked')==='true';
      if(btn.dataset.paramLayer==='towers')mapTowers=value;
      if(btn.dataset.paramLayer==='map-tps')mapTps=value;
      if(btn.dataset.paramLayer==='mnemo-lights')mnemoLights=value;
    });
    mnemoFilter=Object.fromEntries([...menu.querySelectorAll('[data-param-scope]')].map(select=>[select.dataset.paramScope,select.value||'']));
    const w=Number(menu.querySelector('[data-param-weight]')?.value);if([2,3,4,5].includes(w))mnemoLineWidth=w;
    menu.open=false;
    syncLiveScope();
    refresh();
  }
  function changeScopeDraft(menu,field){
    if(!menu)return;
    const draft=Object.fromEntries([...menu.querySelectorAll('[data-param-scope]')].map(e=>[e.dataset.paramScope,e.value]));
    const order=['region','territory','ps','feeder'],changed=order.indexOf(field);
    for(let i=changed+1;i<order.length;i++)draft[order[i]]='';
    const folders=mainFolders(),stations=feederPreviewModel?.visibleStations||[];
    const allow=(id,parent)=>!parent||folderIncludes(id,parent);
    const candidates={
      territory:Object.entries(folders).filter(([id,f])=>canSeeFolder(id)&&/(?:^|\s)(?:TET|ShET|ТЭТ|ШЭТ)(?:\s|$)/iu.test(String(f?.name||''))&&allow(id,draft.region)).map(([id,f])=>({id,name:folderPath(id,folders)})),
      ps:stations.filter(s=>[draft.region,draft.territory].filter(Boolean).every(id=>allow(s.id,id)||s.feeders?.some(f=>allow(f.id,id)))).map(s=>({id:s.id,name:s.name})),
      feeder:stations.flatMap(s=>(s.feeders||[]).filter(f=>(!draft.ps||s.id===draft.ps)&&[draft.region,draft.territory].filter(Boolean).every(id=>allow(f.id,id)||allow(s.id,id))).map(f=>({id:f.id,name:f.name+' ('+s.name+')'})))
    };
    for(const type of order.slice(changed+1)){
      const element=menu.querySelector(`[data-param-scope="${type}"]`);if(!element)continue;
      element.innerHTML='<option value="">Barchasi</option>'+(candidates[type]||[]).map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join('');
      element.value=draft[type];
    }
  }
  // READ ONLY: reuse exactly the same PS/fider/TP model and cable/overhead route
  // generator as the Boshqaruv panel map. Never write to the management database.
  async function loadFeederPreview(force=false){
    if(feederPreviewBusy){feederPreviewAgain=feederPreviewAgain||force;return;}
    if(!currentUser?.uid || !window.HETKPSFeederMap?.buildModel || !window.HETKData?.readTPs)return;
    const userId=currentUser.uid, epoch=++feederPreviewEpoch;
    feederPreviewBusy=true;
    try{
      const snapshot=await window.HETKData.readTPs(!!force);
      if(epoch!==feederPreviewEpoch || currentUser?.uid!==userId)return;
      const ctx=window.HETKManagementStatsContext||{},points=snapshot?.val?.()||{};
      feederPreviewPoints=Object.fromEntries(Object.entries(points).filter(([,tp])=>!ctx.pointAllowed||ctx.pointAllowed(tp)));
      feederPreviewModel=window.HETKPSFeederMap.buildModel(mainFolders(),points,{
        selectedFolderId:'root',canSeeFolder:canSeeFolder,
        pointAllowed:(tp)=>!ctx.pointAllowed || ctx.pointAllowed(tp)
      });
      feederPreviewUser=userId;
      if(root&&!root.hidden)refresh();
    }catch(error){console.warn('Dispetcherlik: 6/10 kV fider xaritasini o‘qish imkoni yo‘q:',error?.message||error);}
    finally{
      if(epoch===feederPreviewEpoch){
        feederPreviewBusy=false;
        if(feederPreviewAgain){feederPreviewAgain=false;setTimeout(()=>loadFeederPreview(true),30);}
      }
    }
  }
  const liveChildren=[];
  function stopLiveScope(){
    for(const entry of liveChildren.splice(0))try{entry.ref.off(entry.event,entry.callback);}catch(_){}
    liveScopeRef=null;liveScopeFn=null;liveScopeId='';
    if(liveRefreshTimer){clearTimeout(liveRefreshTimer);liveRefreshTimer=null;}
  }
  function patchLiveTP(key,value,removed=false){
    if(!currentUser||!root||root.hidden||!key)return;
    const ctx=window.HETKManagementStatsContext||{};
    if(removed||!value||ctx.pointAllowed&&!ctx.pointAllowed(value))delete feederPreviewPoints[key];
    else feederPreviewPoints[key]=value;
    try{
      feederPreviewModel=window.HETKPSFeederMap?.buildModel?.(mainFolders(),feederPreviewPoints,{
        selectedFolderId:'root',canSeeFolder:canSeeFolder,
        pointAllowed:tp=>!ctx.pointAllowed||ctx.pointAllowed(tp)
      })||feederPreviewModel;
      refresh();
    }catch(e){console.warn('Mnemosxema yangi TP ko‘rinishi:',e?.message||e);}
  }
  function bindLiveEvent(ref,event,callback){
    ref.on(event,callback,error=>{console.warn('Mnemosxema kuzatuv ruxsati:',error?.message||error);stopLiveScope();});
    liveChildren.push({ref,event,callback});
  }
  function syncLiveScope(){
    // The country-wide administrator listens to changed/removed children, NOT
    // an expensive full-TPs 'value' stream. New push-key entries are watched
    // from the last known key. Others get a specific regional/feeder index.
    const scopeId=mnemoFilter.feeder||mnemoFilter.territory||mnemoFilter.region||'';
    const path=currentUser&&root&&!root.hidden?(scopeId?'TPsByAncestor/'+scopeId:isSuperAdmin()?'TPs':''):'';
    if(path===liveScopeId)return;
    stopLiveScope();
    if(!path||(scopeId&&!canSeeFolder(scopeId)))return;
    try{
      const ref=window.firebase?.database?.().ref(path);
      if(!ref)return;
      liveScopeId=path;
      if(typeof ref.orderByKey==='function'){
        // New TP IDs are generated by RTDB push(), whose keys sort by time.
        // Missed/out-of-order IDs are still recovered by the periodic sync.
        const known=Object.keys(feederPreviewPoints).sort();
        const recent=known[known.length-1]||'';
        const query=recent?ref.orderByKey().startAt(recent):ref.orderByKey().limitToLast(1);
        bindLiveEvent(query,'child_added',snap=>{
          if(snap?.key&&!feederPreviewPoints[snap.key])patchLiveTP(snap.key,snap.val());
        });
        bindLiveEvent(ref,'child_changed',snap=>patchLiveTP(snap?.key,snap?.val()));
        bindLiveEvent(ref,'child_removed',snap=>patchLiveTP(snap?.key,null,true));
      }else{
        // Compatible fallback for environments where query APIs are absent.
        let first=true;
        const onValue=()=>{
          if(first){first=false;return;}
          if(liveRefreshTimer)clearTimeout(liveRefreshTimer);
          liveRefreshTimer=setTimeout(()=>{liveRefreshTimer=null;loadFeederPreview(true);},350);
        };
        bindLiveEvent(ref,'value',onValue);
      }
    }catch(error){console.warn('Mnemosxema jonli TP obunasi:',error);stopLiveScope();}
  }
  function startLiveUpdates(){
    stopLiveUpdates();
    syncLiveScope();
    // For broad country-wide views, do not attach a heavy all-TPs listener.
    // Scoped notifications are immediate; broad views use cache-bypassing reads.
    liveRefreshInterval=setInterval(()=>{
      if(root&&!root.hidden&&currentUser&&document.visibilityState!=='hidden')loadFeederPreview(true);
    },30000);
  }
  function stopLiveUpdates(){
    if(liveRefreshInterval){clearInterval(liveRefreshInterval);liveRefreshInterval=null;}
    stopLiveScope();
  }
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
  // Folder PSs are projected into the dispatch model by their immutable folder IDs.
  // This never moves a folder or changes the main Folders database.
  function psFolder(folder){
    if(!folder)return false;
    if(folder.psFolder===true)return true;
    const name=String(folder.name||'').normalize('NFKC').trim().replace(/^[^\p{L}\p{N}]+/u,'').trim();
    if(/^(?:PS|ПС)(?=$|[\s.\-–—_:\/'‘’ʼʻ`´"«»(])/iu.test(name))return true;
    return !/(?:fider|fedir|fid[eі]r|фидер)/iu.test(name) && /(?:^|[^\d])(?:500|220|110|35)\s*\/\s*(?:110|35|10|6)(?=\s|$|[’ʼʻ'"«»])/iu.test(name);
  }
  function folderVoltages(name){
    const found=(String(name||'').match(/(?:500|220|110|35|10|6)(?=\s|\/|\b)/g)||[]).map(Number);
    return [...new Set(found.filter(v=>VOLTAGES.includes(v)))].sort((a,b)=>b-a);
  }
  function syncFolderStations(){
    if(!data)return 0;
    const folders=mainFolders(),items=Object.entries(folders).filter(([,f])=>psFolder(f));
    if(!items.length)return 0;
    const normalizedName=s=>String(s||'').toLocaleLowerCase().normalize('NFKC').replace(/^[^\p{L}\p{N}]+/u,'').trim();
    const nameCounts={};for(const [,f] of items){const key=normalizedName(f.name);nameCounts[key]=(nameCounts[key]||0)+1;}
    let changed=0;
    for(const [folderId,folder] of items){
      let rec=data.stations.find(x=>x.kind!=='tap'&&x.folderId===folderId);
      if(!rec){
        // Reuse legacy manually created PS only if its name uniquely matches a folder.
        const same=data.stations.filter(x=>x.kind!=='tap'&&!x.folderId&&normalizedName(x.name)===normalizedName(folder.name));
        if(same.length===1 && nameCounts[normalizedName(folder.name)]===1)rec=same[0];
      }
      const gps=folder.lat!==''&&folder.lng!==''&&folder.lat!=null&&folder.lng!=null&&validGps(folder.lat,folder.lng);
      const volts=folderVoltages(folder.name);
      if(!rec){
        rec={id:'folderps_'+folderId,folderId,folderSourced:true,name:folder.name||'PS',folder:folderPath(folderId,folders),kind:'ps',volts:volts.length?volts:[10],lat:gps?num(folder.lat):null,lng:gps?num(folder.lng):null,x:120+(data.stations.length%5)*165,y:95+(Math.floor(data.stations.length/5)%3)*115};
        if(data.stations.some(x=>x.id===rec.id))continue;
        data.stations.push(rec);changed++;continue;
      }
      const next={folderId,folderSourced:true,name:folder.name||rec.name,folder:folderPath(folderId,folders)};
      if(volts.length)next.volts=volts;
      if(gps){next.lat=num(folder.lat);next.lng=num(folder.lng);}
      if(Object.entries(next).some(([key,val])=>JSON.stringify(rec[key])!==JSON.stringify(val))){Object.assign(rec,next);changed++;}
    }
    if(changed){saveLocal(false);if(root&&!root.hidden&&el('dg-editor')?.hidden!==false)refresh();}
    return changed;
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
  const earthState = (l,end) => ['on','off'].includes(l['earth'+end.toUpperCase()]) ? l['earth'+end.toUpperCase()] : 'unknown';
  const isGroundMarked = l => earthState(l,'a')==='on' || earthState(l,'b')==='on';
  const accessibleEdge = l => !actualOpen(l,'a') && !actualOpen(l,'b') && !isGroundMarked(l);
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
  const localMetaKey = suffix => STORAGE + suffix + '.' + (currentUser?.uid||currentUser?.login||'unknown');
  const readMeta = suffix => {try{return localStorage.getItem(localMetaKey(suffix));}catch(e){return null;}};
  const writeMeta = (suffix,value) => {try{localStorage.setItem(localMetaKey(suffix),String(value));}catch(e){/* Optional local flag. */}};
  function onlyValidSwitches(raw,model=data){
    const out={};const ids=new Set(arr(model?.lines).map(l=>l.id));
    if(raw&&typeof raw==='object'&&!Array.isArray(raw))for(const [key,value] of Object.entries(raw)){
      const m=/^(.+):(a|b)$/.exec(key);
      if(m&&ids.has(m[1])&&typeof value==='boolean')out[key]=value;
    }
    return out;
  }
  function loadSwitchesLocal(){
    try{return onlyValidSwitches(JSON.parse(localStorage.getItem(localMetaKey('virtualSwitches'))||'{}'));}
    catch(e){return {};}
  }
  function markLocalChanged(){
    localChangeSerial++;
    if(cloudWanted){cloudDirty=true;writeMeta('cloudDirty','1');setCloudStatus(cloudReady?'Firebase: o‘zgarishlar saqlanmoqda…':'Firebase tekshirilmoqda · lokal zaxira saqlandi');if(cloudReady)queueCloudSave();}
  }
  function saveSwitchesLocal(mark=true){
    overrides=onlyValidSwitches(overrides);
    try{localStorage.setItem(localMetaKey('virtualSwitches'),JSON.stringify(overrides));}
    catch(e){showMsg('Virtual QF holatini brauzer xotirasiga yozib bo‘lmadi.','error');}
    if(mark)markLocalChanged();
  }
  function saveLocal(mark=true){
    try{normalizeTowerIds(data);localStorage.setItem(storeKey(),JSON.stringify(data));}
    catch(e){showMsg('Brauzer xotirasiga yozib bo‘lmadi. Saqlash uchun joy/ruxsatni tekshiring.','error');}
    if(mark)markLocalChanged();
  }
  function backupLocal(reason){
    if(!draftIsNonempty(data))return;
    try{
      const key=storeKey()+'.backup.'+new Date().toISOString().replace(/[:.]/g,'-');
      localStorage.setItem(key,JSON.stringify({reason,at:new Date().toISOString(),model:data,virtualSwitches:overrides}));
      const indexKey=storeKey()+'.backups';const list=JSON.parse(localStorage.getItem(indexKey)||'[]');
      list.push(key);while(list.length>5){const oldest=list.shift();localStorage.removeItem(oldest);}
      localStorage.setItem(indexKey,JSON.stringify(list));
    }catch(e){console.warn('[DispatchGrid] Lokal zaxira yaratib bo‘lmadi',e);}
  }
  function isUnmodifiedDemo(d){
    return arr(d?.stations).filter(x=>!x.folderSourced).length===6 && arr(d?.lines).length===5 &&
      d.stations.some(x=>x.id==='S-A'&&String(x.name).includes('(namuna)')) &&
      d.lines.some(x=>x.id==='L-1'&&String(x.name).includes('(namuna)'));
  }
  function loadLocal(){
    try{
      const raw=JSON.parse(localStorage.getItem(storeKey())||'null');
      if(raw&&Array.isArray(raw.stations)&&Array.isArray(raw.lines))
        return normalizeTowerIds({version:1,stations:arr(raw.stations),lines:arr(raw.lines),feeders:arr(raw.feeders),tps:arr(raw.tps),consumers:arr(raw.consumers)});
    }catch(e){/* Keep a clean draft on corrupt data. */}
    return empty();
  }
  const draftIsNonempty = d => ['stations','lines','feeders','tps','consumers'].some(k=>arr(d?.[k]).length>0);
  function setCloudStatus(message){
    cloudStatusText=message;
    const target=el('dg-cloud-status');if(target)target.textContent=message;
  }
  function firebaseRef(){
    try{
      const auth=window.firebase?.auth?.().currentUser;
      if(!currentUser?.uid||!auth||auth.uid!==currentUser.uid)return null;
      return window.firebase?.database?.().ref(CLOUD_PATH)||null;
    }catch(e){return null;}
  }
  function stopCloudListener(){
    if(cloudListenerRef&&cloudListenerFn)try{cloudListenerRef.off('value',cloudListenerFn);}catch(e){}
    cloudListenerRef=null;cloudListenerFn=null;
    if(cloudTimer){clearTimeout(cloudTimer);cloudTimer=null;}
  }
  function cloudPacket(snapshot){
    const raw=snapshot?.val?.();
    if(!raw||raw.simulationOnly!==true||raw.version!==1||!raw.model||raw.model.version!==1)throw new Error('Firebase dagi qoralama formati noto‘g‘ri.');
    return raw;
  }
  function applyCloud(packet){
    backupLocal('Firebase nusxasini avtomatik yuklashdan oldin');
    data=normalizeTowerIds({version:1,...Object.fromEntries(['stations','lines','feeders','tps','consumers'].map(k=>[k,arr(packet.model[k])]))});
    syncFolderStations();
    overrides=onlyValidSwitches(packet.virtualSwitches||{},data);
    cloudRevision=Number(packet.revision)||0;
    cloudDirty=false;cloudBlocked=false;cloudReady=true;cloudReadError=false;
    writeMeta('cloudRevision',cloudRevision);writeMeta('cloudDirty','0');writeMeta('cloudMode','1');
    cloudWanted=true;saveLocal(false);saveSwitchesLocal(false);
    if(root&&!root.hidden&&el('dg-editor')?.hidden!==false)refresh();
    setCloudStatus('Firebase: sinov ma’lumotlari saqlangan · rev '+cloudRevision);
  }
  function observeCloud(ref){
    if(cloudListenerRef)return;
    const expected=cloudEpoch;
    cloudListenerFn=snapshot=>{
      if(expected!==cloudEpoch||!currentUser||!cloudWanted||!snapshot.exists())return;
      let packet;try{packet=cloudPacket(snapshot);}catch(e){setCloudStatus(e.message);return;}
      if(Number(packet.revision)===cloudRevision||cloudBusy)return;
      if(cloudDirty||!el('dg-editor')?.hidden){cloudBlocked=true;setCloudStatus('Firebase’da yangi versiya bor, lokal tahrir esa saqlanmagan. Hech narsa ustidan yozilmadi; dispetcher mas’uliga murojaat qiling.');return;}
      applyCloud(packet);
    };
    cloudListenerRef=ref;
    ref.on('value',cloudListenerFn,error=>{if(expected===cloudEpoch)setCloudStatus('Firebase tinglash xatosi: '+(error?.code||error?.message||'ruxsat yo‘q'));});
  }
  async function openCloudSession(){
    const epoch=cloudEpoch,ref=firebaseRef();
    if(!ref){cloudReadError=true;setCloudStatus('Firebase Auth ulanmagan — faqat lokal zaxira bor; avtomatik sinxronlash ishlamayapti');return;}
    if(cloudReadStarted)return;cloudReadStarted=true;cloudReady=false;
    setCloudStatus('Firebase’dagi dispetcherlik ma’lumotlari yuklanmoqda…');
    try{
      const snapshot=await ref.once('value');
      if(epoch!==cloudEpoch||!currentUser)return;
      if(!snapshot.exists()){
        cloudRevision=0;cloudReady=true;cloudReadError=false;
        if(isUnmodifiedDemo(data)){
          backupLocal('Ilgari yuklangan toza namuna avtomatik olib tashlandi');
          data=empty();overrides={};saveLocal(false);saveSwitchesLocal(false);
        }
        syncFolderStations();
        setCloudStatus('Firebase’da sxema hali yo‘q. PSlar papkalardan ko‘rsatiladi; birinchi tahrirdan so‘ng avtomatik saqlanadi.');
        observeCloud(ref);if(root&&!root.hidden)refresh();
        return;
      }
      const packet=cloudPacket(snapshot);
      // Server is the authoritative shared draft. Keep the old browser draft in
      // a dated local backup before switching to it, never silently upload it.
      applyCloud(packet);observeCloud(ref);
      if(isUnmodifiedDemo(packet.model))setCloudStatus('Firebase’da NAMUNA saqlangan. Bu haqiqiy sxema emas! Avval eski PS/liniyalar mavjudligini tekshiring.');
    }catch(e){if(epoch===cloudEpoch){cloudReadError=true;setCloudStatus('Firebase yuklanmadi: '+(e?.code||e?.message||'ruxsat talab etiladi')+' · ma’lumotlar lokal qoladi, bazaga yozilmadi');}}
    finally{if(epoch===cloudEpoch)cloudReadStarted=false;}
  }
  function queueCloudSave(){
    if(!cloudWanted||!cloudReady||cloudBusy||cloudBlocked)return;
    if(cloudTimer)clearTimeout(cloudTimer);
    cloudTimer=setTimeout(()=>{cloudTimer=null;writeCloud(false);},900);
  }
  async function writeCloud(manual){
    if(cloudBusy)return;
    const ref=firebaseRef();
    if(!ref){setCloudStatus('Firebase Auth ulanmagan — faqat lokal saqlandi');return;}
    if(cloudBlocked||!cloudReady){return;}
    const epoch=cloudEpoch;
    cloudBusy=true;
    try{
      if(!cloudWanted||cloudRevision===null){
        const snap=await ref.once('value');
        if(epoch!==cloudEpoch)return;
        if(snap.exists()){
          const remote=cloudPacket(snap);
          cloudBlocked=true;setCloudStatus('Firebase’da boshqa sxema mavjud. Lokal o‘zgarish uni bosib ketmasligi uchun saqlash to‘xtatildi.');return;
        }else cloudRevision=0;
      }
      if(epoch!==cloudEpoch)return;
      if(cloudBlocked){setCloudStatus('Boshqa dispetcher sxemani o‘zgartirgan: lokal o‘zgarish zaxirada, avtomatik ustidan yozilmaydi.');return;}
      const serial=localChangeSerial;
      const payload={version:1,simulationOnly:true,model:JSON.parse(JSON.stringify(data)),virtualSwitches:onlyValidSwitches(overrides),updatedBy:currentUser.uid,updatedAt:window.firebase.database.ServerValue.TIMESTAMP};
      let revisionConflict=false;
      const result=await ref.transaction(remote=>{
        const revision=Number(remote?.revision)||0;
        if(revision!==cloudRevision){revisionConflict=true;return;}
        return {...payload,revision:revision+1};
      },undefined,false);
      if(epoch!==cloudEpoch)return;
      if(!result.committed){cloudBlocked=true;setCloudStatus('Saqlash to‘qnashuvi: boshqa dispetcher yangi nusxani saqlagan. Lokal o‘zgarish zaxirada qoldi.');return;}
      cloudRevision=Number(result.snapshot.val()?.revision)||cloudRevision+1;
      cloudWanted=true;cloudBlocked=false;writeMeta('cloudMode','1');writeMeta('cloudRevision',cloudRevision);
      if(serial===localChangeSerial){cloudDirty=false;writeMeta('cloudDirty','0');setCloudStatus('Firebase: sinov ma’lumotlari saqlandi · rev '+cloudRevision);}
      else{cloudDirty=true;writeMeta('cloudDirty','1');setCloudStatus('Firebase: yangi o‘zgarishlar navbatda…');}
      observeCloud(ref);
      if(cloudDirty)setTimeout(()=>queueCloudSave(),50);
    }catch(e){
      setCloudStatus('Firebase saqlash xatosi: '+(e?.code||e?.message||'ruxsat talab etiladi')+' · o‘zgarish lokal nusxada saqlangan, bazaga yozilmadi');
      cloudDirty=true;writeMeta('cloudDirty','1');
    }finally{cloudBusy=false;}
  }
  // A connected electrical component is energized if it reaches an enabled source
  // through lines whose breaker end states are both closed. For components with
  // multiple sources, power-flow direction is AMBIGUOUS and is never animated.
  function analyze(d=data, simulated=overrides) {
    const old=overrides; overrides=simulated;
    try {
      const nodes = new Map(d.stations.map(x=>[x.id,x]));
      const links = new Map(d.stations.map(x=>[x.id,[]]));
      const malformed=[],malformedIds=[];
      for(const l of d.lines){
        const a=nodes.get(l.a), b=nodes.get(l.b);
        if(!a || !b || !arr(a.volts).includes(num(l.voltage)) || !arr(b.volts).includes(num(l.voltage))){
          malformed.push(l.name || l.id); malformedIds.push(l.id); continue;
        }
        if(accessibleEdge(l)){
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
      return {nodes,components,links,byNode,energized,sourceCount,dist,direction,malformed,malformedIds,feederState,tpState,consumerState,affected,unknown,affectedTps,affectedKva:affectedTps.reduce((n,t)=>n+Math.max(0,num(t.kva)),0),parallel:components.filter(x=>x.sources.length>1),islands:components.filter(x=>x.sources.length===0)};
    } finally {overrides=old;}
  }

  function validGps(lat,lng){
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat)>=-90 && Number(lat)<=90 && Number(lng)>=-180 && Number(lng)<=180;
  }
  function lineDistance(a,b){
    // Haversine great-circle distance between GPS points (surface geometry).
    const toRad=Math.PI/180,lat1=num(a.lat)*toRad,lat2=num(b.lat)*toRad;
    const dLat=lat2-lat1,dLng=(num(b.lng)-num(a.lng))*toRad;
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    return 2*6371008.8*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  // Plan length: sum of geographic segments through entered support points.
  // This is not conductor length (sag/spans) and cannot assert survey accuracy.
  function lineLengthInfo(line){
    const pts=geometryFor(line);
    if(pts.length<2 || pts.some(p=>!validGps(p.lat,p.lng)))
      return {meters:null,label:'GPS yetarli emas',quality:'missing'};
    const meters=pts.slice(1).reduce((total,p,i)=>total+lineDistance(pts[i],p),0);
    const supports=arr(line.towers);
    const full=supports.length>0 && supports.every(t=>t.lat!=null&&t.lng!=null&&validGps(t.lat,t.lng));
    const quality=full?'supports':supports.length?'partial':'straight';
    const desc=full?'GPS tayanchlar bo‘yicha':'Taxminiy trassa';
    return {meters,label:(meters>=1000?(meters/1000).toFixed(2)+' km':Math.round(meters)+' m'),quality,desc};
  }
  function lineStateInfo(line,result){
    if(isGroundMarked(line))return {state:'Yerga ulagich qayd etilgan (virtual)',active:false,reason:'Virtual yerga ulagich belgisi bor. QF holatini va haqiqiy kuchlanishni mustaqil tekshirish shart.'};
    if(actualOpen(line,'a')||actualOpen(line,'b'))return {state:'QF ochiq (virtual)',active:false,reason:'Bir yoki ikkala uchidagi QF ochiq'};
    if(result.malformedIds.includes(line.id))return {state:'Ulanish mos emas',active:false,reason:'Kuchlanish yoki ulanish nuqtalari mos emas'};
    if(!result.energized[line.a]||!result.energized[line.b])return {state:'Manbaga ulanmagan',active:false,reason:'Yopiq QF orqali faol manbaga yo‘l yo‘q'};
    if(result.sourceCount[line.a]>1)return {state:'Ko‘p manba — yo‘nalish noaniq',active:true,reason:'Bir konturda bir nechta manba bor; MW oqimi aniqlanmagan'};
    if(!result.direction[line.id])return {state:'Ta’minot bor, yo‘nalish noaniq',active:true,reason:'Halqa yoki teng masofali yo‘llarda yo‘nalish tasdiqlanmagan'};
    return {state:'Ta’minot yo‘li (virtual)',active:true,reason:'Bitta manbadan keladigan topologik yo‘l'};
  }
  function mapLinePopup(line,result){
    const a=station(line.a),b=station(line.b),state=lineStateInfo(line,result),len=lineLengthInfo(line);
    const psJump=(ps)=>ps&&ps.kind!=='tap'?`<button type="button" class="dg-popup-edit" data-open-ps="${esc(ps.id)}">⚡ ${esc(ps.name)} · PS oynasi</button>`:'';
    return `<div class="dg-line-popup"><strong>${esc(line.name)}</strong><div><b style="color:${COLORS[line.voltage]||'#58799d'}">${num(line.voltage)} kV</b> · ${esc(a?.name||'?')} — ${esc(b?.name||'?')}</div><div class="dg-popup-status">${esc(state.state)}</div><div><b>Trassa uzunligi:</b> ${esc(len.label)}${len.quality==='supports'?' (tayanchlar bo‘yicha)':' (taxminiy)'}</div><small>${esc(state.reason)}</small><div class="dg-popup-switches">${psJump(a)}${psJump(b)}</div><small>Virtual QF va yerga ulagich holati PS oynasida ko‘rsatiladi. Bu operativ sxema emas.</small><button type="button" class="dg-popup-edit" data-edit="line" data-id="${esc(line.id)}">✎ Liniyani tahrirlash</button></div>`;
  }
  const showReading = v => v==null||v===''?'—':Number(v).toLocaleString('uz-UZ',{maximumFractionDigits:3});
  function openPsPanel(id){
    if(station(id)?.kind==='tap'||!station(id))return;
    activePsId=id;showObjects=false;showImpact=false;updateSidebar();renderPsPanel();
  }
  function renderPsPanel(){
    const box=el('dg-ps-panel');if(!box)return;
    const ps=station(activePsId);
    if(!ps||ps.kind==='tap'){box.hidden=true;activePsId=null;return;}
    const r=analyze(),attached=data.lines.filter(l=>l.a===ps.id||l.b===ps.id);
    const feeders=data.feeders.filter(f=>f.psId===ps.id);
    const allTps=feeders.flatMap(f=>data.tps.filter(t=>t.feederId===f.id));
    const kva=allTps.reduce((total,t)=>total+Math.max(0,num(t.kva)),0);
    const loads=feeders.filter(f=>f.loadKw!=null&&f.loadKw!=='');
    const totalLoad=loads.reduce((sum,f)=>sum+num(f.loadKw),0);
    const statusLine=(l)=>{
      const end=l.a===ps.id?'a':'b',side=end.toUpperCase(), other=station(l[end==='a'?'b':'a']);
      const opened=actualOpen(l,end), earth=earthState(l,end);
      const status=earth==='on'?'Yerga ulagich qayd etilgan':opened?'QF ochiq': 'QF yopiq';
      const alarming=(earth==='on'&&!opened);
      return `<article class="dg-ps-line ${alarming?'dg-ps-alert':''}">
        <div class="dg-ps-line-title"><span class="dg-ps-volt" style="--volt:${COLORS[l.voltage]||'#64748b'}">${num(l.voltage)} kV</span><div><strong>${esc(l.name)}</strong><small>Ulanish: ${esc(other?.name||'aniqlanmagan')} · ${esc(lineLengthInfo(l).label)}</small></div></div>
        <div class="dg-ps-line-ctrl"><div class="dg-qf-state ${opened?'is-open':'is-closed'}">QF-${side}: ${opened?'○ Ochiq':'● Yopiq'}</div>
        <button type="button" class="dg-ps-simulate" data-switch="${esc(l.id+':'+end)}">${opened?'Virtual yopish':'Virtual ochish'}</button></div>
        <label class="dg-ps-earth">Yerga ulagich (${side} uchi) · <select data-earth-state="${esc(l.id+':'+end)}"><option value="unknown" ${earth==='unknown'?'selected':''}>Ma’lumot kiritilmagan</option><option value="off" ${earth==='off'?'selected':''}>Olingan deb qayd etilgan</option><option value="on" ${earth==='on'?'selected':''}>O‘rnatilgan deb qayd etilgan</option></select></label>
        ${alarming?'<div class="dg-ps-warning">⚠ Virtual QF yopiq va yerga ulagich o‘rnatilgan deb qayd etilgan. Bu xavfli mos kelmaslik, haqiqiy holat tekshirilishi shart!</div>':''}
      </article>`;
    };
    const feederCard=(f)=>{
      const tps=data.tps.filter(t=>t.feederId===f.id), totalKva=tps.reduce((sum,t)=>sum+Math.max(0,num(t.kva)),0);
      const last=f.meterAt?new Date(f.meterAt).toLocaleString('uz-UZ'):'—';
      return `<article class="dg-ps-feeder" data-feeder-record="${esc(f.id)}">
        <div class="dg-ps-feeder-head"><div><strong>${esc(f.name)}</strong><small>${num(f.voltage)} kV · ${tps.length} TP/KTP · ${totalKva.toLocaleString('uz-UZ')} kVA nominal</small></div><button type="button" data-edit="feeder" data-id="${esc(f.id)}">✎</button></div>
        <div class="dg-ps-tp-names">${tps.length?tps.map(t=>`<span>${esc(t.name)} · ${showReading(t.kva)} kVA</span>`).join(''):'TP/KTP hali biriktirilmagan'}</div>
        <div class="dg-ps-input-grid">
        <label>Yuklama (kW)<input type="number" min="0" step="any" data-feeder-field="loadKw" value="${esc(f.loadKw??'')}" placeholder="kW"></label>
        <label>Tok (A)<input type="number" min="0" step="any" data-feeder-field="loadAmp" value="${esc(f.loadAmp??'')}" placeholder="A"></label>
        <label>Hisoblagich raqami<input maxlength="70" data-feeder-field="meterNumber" value="${esc(f.meterNumber??'')}" placeholder="Raqam"></label>
        <label>Ko‘rsatkich (kWh)<input type="number" min="0" step="any" data-feeder-field="meterKwh" value="${esc(f.meterKwh??'')}" placeholder="kWh"></label>
        </div>
        <div class="dg-ps-feeder-bottom"><small>Oxirgi qayd: ${esc(last)}</small><button type="button" data-save-feeder="${esc(f.id)}">Saqlash</button></div>
        ${arr(f.readings).length?`<div class="dg-ps-readings"><b>Oxirgi ko‘rsatkichlar:</b> ${arr(f.readings).slice(-3).reverse().map(x=>`<span>${esc(new Date(x.at).toLocaleDateString('uz-UZ'))}: ${showReading(x.kwh)} kWh</span>`).join('')}</div>`:''}
      </article>`;
    };
    box.hidden=false;
    box.innerHTML=`<header class="dg-ps-panel-head"><div><small>PS BOSHQARUV KARTASI · LOKAL SINOV</small><h2>${esc(ps.name)}</h2><span>${esc(arr(ps.volts).join('/'))} kV · ${ps.kind==='source'?'Manba PS':'Oddiy PS'}</span></div><button type="button" data-action="close-ps-panel" aria-label="PS oynasini yopish">✕</button></header>
      <div class="dg-ps-panel-body"><div class="dg-ps-banner">⚠ Bu ma’lumotlar lokal qoralama. QF tugmalari haqiqiy tarmoqni boshqarmaydi; holatlar SCADA bilan tekshirilmagan.</div>
      <div class="dg-ps-metrics"><div><b>${attached.length}</b><small>Ulangan liniya</small></div><div><b>${feeders.length}</b><small>Fider</small></div><div><b>${kva.toLocaleString('uz-UZ')}</b><small>TP/KTP kVA</small></div><div><b>${loads.length?showReading(totalLoad):'—'}</b><small>Yuklama kW*</small></div></div>
      <div class="dg-ps-folder">📁 ${esc(ps.folder|| (ps.folderId?folderPath(ps.folderId):'Papka biriktirilmagan'))}</div>
      <div class="dg-ps-section-head"><h3>Ulangan liniyalar va PSdagi QF</h3><small>${r.energized[ps.id]?'Modelda manbaga ulangan':'Modelda ta’minot yo‘q / aniqlanmagan'}</small></div>
      ${attached.length?attached.map(statusLine).join(''):'<p class="dg-ps-empty">Bu PSga liniya bog‘lanmagan.</p>'}
      <div class="dg-ps-section-head"><h3>Fiderlar, yuklama va hisoblagichlar</h3><button type="button" data-action="ps-add-feeder">+ Fider</button></div>
      ${feeders.length?feeders.map(feederCard).join(''):'<p class="dg-ps-empty">Hali fider biriktirilmagan. «+ Fider» orqali mavjud HETK papkasini tanlang.</p>'}
      <div class="dg-ps-note">* Yuklama va hisoblagich qiymatlari qo‘lda kiritiladi; 0 yoki bo‘sh qiymat real o‘lchov sifatida tasdiqlanmagan. kVA nominal TP quvvati, kW yuklama. Yerga ulagich haqidagi belgi operativ xavfsizlik kafolati emas.</div>
      </div>`;
  }
  // Viewport-based decluttering: roughly 3 cm on a 96-CSS-pixel/inch display.
  // Recomputed on pan/zoom, so zoomed-out lines lose their name instead of
  // creating a pile of overlapping tags. The underlying PS / lines NEVER hide.
  const LABEL_MIN_SCREEN_PX = 114;
  const LABEL_EDGE_PADDING = 12;
  function clipScreenSegment(a,b,sz,pad=12){
    const dx=b.x-a.x,dy=b.y-a.y;
    const limits=[[-dx,a.x-pad],[dx,sz.x-pad-a.x],[-dy,a.y-pad],[dy,sz.y-pad-a.y]];
    let low=0,high=1;
    for(const [p,q] of limits){
      if(Math.abs(p)<1e-8){if(q<0)return null;continue;}
      const t=q/p;
      if(p<0)low=Math.max(low,t);else high=Math.min(high,t);
      if(low>high)return null;
    }
    return {ax:a.x+low*dx,ay:a.y+low*dy,bx:a.x+high*dx,by:a.y+high*dy,length:Math.hypot(dx,dy)*(high-low)};
  }
  function projectedLineSegments(line,sz){
    const geo=geometryFor(line),result=[];
    for(let i=0;i<geo.length-1;i++){
      const a=map.latLngToContainerPoint([geo[i].lat,geo[i].lng]);
      const b=map.latLngToContainerPoint([geo[i+1].lat,geo[i+1].lng]);
      const segment=clipScreenSegment(a,b,sz,LABEL_EDGE_PADDING);
      if(segment&&segment.length>1)result.push(segment);
    }
    return result;
  }
  function boxesOverlap(a,b,gap=5){
    return a.x<b.x+b.w+gap && b.x<a.x+a.w+gap &&
      a.y<b.y+b.h+gap && b.y<a.y+a.h+gap;
  }
  function lineTouchesBox(s,rect,pad=5){
    // Liang-Barsky segment / expanded label rectangle test (no DOM layout required).
    const x0=rect.x-pad,x1=rect.x+rect.w+pad,y0=rect.y-pad,y1=rect.y+rect.h+pad;
    const dx=s.bx-s.ax,dy=s.by-s.ay;
    let t0=0,t1=1;
    for(const [p,q] of [[-dx,s.ax-x0],[dx,x1-s.ax],[-dy,s.ay-y0],[dy,y1-s.ay]]){
      if(Math.abs(p)<1e-8){if(q<0)return false;continue;}
      const t=q/p;
      if(p<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);
      if(t0>t1)return false;
    }
    return true;
  }
  function labelDimensions(text,size,kind){
    // Full PS name comes from its Folders record. Do not truncate it with
    // ellipses: on narrow screens wrap while leaving the original text intact.
    const isPs=kind==='ps',maximum=Math.max(90,Math.min(isPs?(size.x<650?235:430):(size.x<650?166:234),size.x-30));
    let raw=String(text).length*6.9+25;
    try{
      const canvas=document.createElement('canvas');
      const ctx=canvas.getContext('2d');
      if(ctx){ctx.font='800 11px system-ui, Arial, sans-serif';raw=ctx.measureText(String(text)).width+25;}
    }catch(e){}
    const width=Math.min(maximum,Math.max(78,Math.ceil(raw)));
    const rows=isPs?Math.max(1,Math.ceil((raw-12)/Math.max(60,width-25))):1;
    return {w:width,h:isPs?12+rows*17:29};
  }
  function candidatePositions(anchor,w,h){
    const p=anchor;
    // Every candidate keeps text off the exact PS point / conductor.
    return [
      {x:p.x+27,y:p.y-55}, {x:p.x-w-27,y:p.y-55},
      {x:p.x+27,y:p.y+28}, {x:p.x-w-27,y:p.y+28},
      {x:p.x-w/2,y:p.y-83}, {x:p.x-w/2,y:p.y+48},
      {x:p.x+49,y:p.y-79}, {x:p.x-w-49,y:p.y-79},
      {x:p.x+49,y:p.y+48}, {x:p.x-w-49,y:p.y+48},
      {x:p.x-w/2,y:p.y-111}, {x:p.x-w/2,y:p.y+75}
    ].map(c=>({x:Math.round(c.x),y:Math.round(c.y),w,h}));
  }
  function placeCallout(anchor,text,kind,ref,context){
    const {size,occupied,segments,psPoints}=context;
    const {w,h}=labelDimensions(text,size,kind);
    const preferRight=anchor.x<size.x/2,preferBelow=anchor.y<size.y/2;
    // Labels gravitate to different sides depending on their map position,
    // rather than every leader automatically pointing in the same direction.
    const positions=candidatePositions(anchor,w,h).sort((a,b)=>{
      function rank(r){
        const toRight=r.x>=anchor.x,toBelow=r.y>=anchor.y;
        const horizontal=(toRight===preferRight)?0:1;
        const vertical=(toBelow===preferBelow)?0:1;
        return horizontal*1000+vertical*500+Math.hypot(r.x+r.w/2-anchor.x,r.y+r.h/2-anchor.y);
      }
      return rank(a)-rank(b);
    });
    for(const rect of positions){
      if(rect.x<9||rect.y<9||rect.x+rect.w>size.x-9||rect.y+rect.h>size.y-9)continue;
      if(occupied.some(box=>boxesOverlap(rect,box,7)))continue;
      if(segments.some(s=>lineTouchesBox(s,rect,4)))continue;
      if(psPoints.some(p=>p!==anchor && p.x>rect.x-12 && p.x<rect.x+rect.w+12 && p.y>rect.y-12 && p.y<rect.y+rect.h+12))continue;
      occupied.push(rect);
      let endX,endY;
      if(rect.x>anchor.x){endX=rect.x;endY=rect.y+h/2;}
      else if(rect.x+rect.w<anchor.x){endX=rect.x+rect.w;endY=rect.y+h/2;}
      else{endX=rect.x+w/2;endY=rect.y>anchor.y?rect.y:rect.y+h;}
      const dx=endX-anchor.x,dy=endY-anchor.y;
      const length=Math.hypot(dx,dy),angle=Math.atan2(dy,dx);
      const color=kind==='line'?(COLORS[ref.voltage]||'#56728a'):(ref.kind==='source'?'#1374d0':'#164579');
      const html=`<div class="dg-smart-callout" style="--dg-accent:${color}"><i class="dg-smart-leader" aria-hidden="true" style="width:${length.toFixed(1)}px;transform:rotate(${angle.toFixed(5)}rad)"></i><span class="dg-smart-tag ${kind==='ps'?'dg-smart-ps':''}" style="left:${rect.x-anchor.x}px;top:${rect.y-anchor.y}px;width:${w}px;min-height:${h}px" title="${esc(text)}">${esc(text)}</span></div>`;
      const marker=L.marker(map.containerPointToLatLng([anchor.x,anchor.y]),{icon:L.divIcon({className:'dg-smart-callout-icon',html,iconSize:[1,1],iconAnchor:[0,0]}),interactive:true,zIndexOffset:kind==='ps'?850:650}).addTo(callouts);
      if(kind==='line')marker.bindPopup(mapLinePopup(ref,context.overview));
      else marker.on('click',()=>openPsPanel(ref.id));
      return true;
    }
    return false;
  }
  function drawMapCallouts(){
    if(!map||!callouts||!window.L?.divIcon)return;
    callouts.clearLayers();
    const size=map.getSize();if(!size?.x||!size?.y)return;
    const bounds=map.getBounds();
    const overview=analyze();
    const context={size,overview,occupied:[],segments:[],psPoints:[]};
    // A hidden "Liniya" layer also hides its callout labels and conductors.
    const lines=data.lines.filter(line=>voltageVisible[num(line.voltage)]&&visibleDispatchLine(line)).map(line=>{
      const segments=projectedLineSegments(line,size);
      context.segments.push(...segments);
      return {line,segments,visibleLength:segments.reduce((sum,s)=>sum+s.length,0)};
    });
    const stations=data.stations.filter(ps=>visibleStation(ps)&&ps.kind!=='tap'&&ps.lat!=null&&ps.lng!=null&&validGps(ps.lat,ps.lng)&&bounds.contains([num(ps.lat),num(ps.lng)]))
      .map(ps=>({ps,point:map.latLngToContainerPoint([num(ps.lat),num(ps.lng)])}));
    context.psPoints=stations.map(s=>s.point);
    // Group only genuinely close PS markers. Clicking original markers still
    // opens the exact PS. Zoom in to separate the grouped labels again.
    const byPriority=[...stations].sort((a,b)=>(a.ps.kind==='source'?0:1)-(b.ps.kind==='source'?0:1)||a.ps.name.localeCompare(b.ps.name,'uz'));
    const used=new Set();
    for(const candidate of byPriority){
      if(used.has(candidate.ps.id))continue;
      const group=[candidate];used.add(candidate.ps.id);
      for(const other of byPriority){
        if(used.has(other.ps.id))continue;
        if(Math.hypot(other.point.x-candidate.point.x,other.point.y-candidate.point.y)<LABEL_MIN_SCREEN_PX){
          group.push(other);used.add(other.ps.id);
        }
      }
      const summary=psLabel(candidate.ps.name); // Only the PS name; no group count or repeated kV levels.
      placeCallout(candidate.point,summary,'ps',candidate.ps,context);
    }
    // Show text ONLY when at least ~3 cm of this line is visible. In dense
    // regions a colliding label is suppressed, not drawn over another line.
    lines.filter(l=>l.visibleLength>=LABEL_MIN_SCREEN_PX)
      .sort((a,b)=>b.visibleLength-a.visibleLength||num(b.line.voltage)-num(a.line.voltage))
      .forEach(({line,segments,visibleLength})=>{
        // Use length-weighted locations along the entire VISIBLE route. Many
        // support points can split a long line into dozens of tiny segments.
        // The label must still show when their COMBINED length exceeds 3 cm.
        for(const fraction of [.50,.25,.75,.125,.875,.375,.625]){
          let remaining=visibleLength*fraction,anchor=null;
          for(const s of segments){
            if(remaining<=s.length){
              const t=s.length?remaining/s.length:0;
              anchor={x:s.ax+(s.bx-s.ax)*t,y:s.ay+(s.by-s.ay)*t};break;
            }
            remaining-=s.length;
          }
          if(anchor&&placeCallout(anchor,`${line.name} · ${num(line.voltage)} kV`,'line',line,context))break;
        }
      });
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
          <div class="dg-brand"><span class="dg-brand-icon">⚡</span><div><strong id="dg-title">Elektr tarmoqlari · Dispetcherlik</strong></div></div>
          <div class="dg-head-actions"><button type="button" class="dg-close" data-action="close" aria-label="Yopish">✕</button></div>
        </header>
        <div class="dg-toolbar">
          <div class="dg-switch-views" role="tablist" aria-label="Ko‘rinish turi">
            <button type="button" data-view="simple">◈ Sodda sxema</button>
            <button type="button" data-view="technical">▦ Texnik sxema</button>
            <button type="button" data-view="combined">▧ GIS xarita</button>
          </div>
          <div class="dg-gis-toolbar-slot" id="dg-gis-toolbar-slot" hidden></div>
          <div class="dg-toolbar-actions">
            <button type="button" data-action="toggle-objects" aria-controls="dg-sidebar" aria-expanded="false">☰ Obyektlar</button>
            <button type="button" data-action="toggle-impact" aria-controls="dg-impact" aria-expanded="false">◫ Ta’sir tahlili</button>
            <button type="button" data-action="toggle-stats" aria-expanded="false">▥ Statistika</button>
          </div>
        </div>
        <div class="dg-cloud-bar" hidden><span id="dg-cloud-status" role="status">Firebase yuklanmoqda…</span></div>
        <div id="hetk-grid-message" class="dg-message" hidden></div>
        <div class="dg-body">
          <aside class="dg-sidebar" id="dg-sidebar">
            <button type="button" class="dg-panel-close" data-action="close-objects" aria-label="Obyektlar panelini yopish">✕</button>
            <div class="dg-sidebar-title"><span>Obyektlar</span></div>
            <div class="dg-add-grid">
              <button type="button" data-add="station">+ PS / manba</button><button type="button" data-add="line">+ Liniya</button>
              <button type="button" data-add="tap">+ Otpayka</button><button type="button" data-add="tower">+ Tayanch</button>
              <button type="button" data-add="feeder">+ Fider</button><button type="button" data-add="tp">+ TP/KTP</button>
              <button type="button" class="dg-add-wide" data-add="consumer">+ Mahalla / tashkilot</button>
            </div>
            <div class="dg-list-tabs">
              <button type="button" data-section="stations">PS</button><button type="button" data-section="lines">Liniya</button><button type="button" data-section="taps">Otpayka</button><button type="button" data-section="towers">Tayanch</button>
              <button type="button" data-section="feeders">Fider</button><button type="button" data-section="tps">TP/KTP</button>
              <button type="button" data-section="consumers">Iste’molchi</button>
            </div>
            <div class="dg-item-list" id="dg-item-list"></div>
            
          </aside>
          <main class="dg-main">
            <div class="dg-kpis" id="dg-kpis"></div>
            <div class="dg-visual-layout" id="dg-visual-layout"><section class="dg-visual"><div class="dg-view-title" id="dg-view-title"></div><div id="dg-visual-content"></div></section></div>
          </main>
          <aside class="dg-impact" id="dg-impact"></aside>
          <aside class="dg-ps-panel" id="dg-ps-panel" hidden></aside>
        </div>
        
      </div>
      <div class="dg-modal" id="dg-editor" hidden><div class="dg-editor-card" role="dialog" aria-modal="true" aria-label="Obyekt tahrirlash"><div class="dg-editor-head"><strong id="dg-editor-title">Tahrirlash</strong><button type="button" data-action="cancel-editor" aria-label="Yopish">✕</button></div><form id="dg-editor-form"></form></div></div>
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
    root.addEventListener('click',ev=>{const menu=root.querySelector('.dg-layer-menu[open]');if(menu&&!menu.contains(ev.target)){resetParameterTicks(menu);menu.open=false;}});
    root.addEventListener('toggle',ev=>{if(ev.target.matches?.('.dg-layer-menu')&&ev.target.open)resetParameterTicks(ev.target);},true);
    root.addEventListener('keydown',ev=>{if(ev.key==='Escape'){const menu=root.querySelector('.dg-layer-menu[open]');if(menu){resetParameterTicks(menu);menu.open=false;ev.stopPropagation();return;}}if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('g[data-mnemo-note]')){ev.preventDefault();editMnemoNote(ev.target.dataset.mnemoNote,ev.target.dataset.mnemoFeeder);return;}if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('g[data-open-ps]')){ev.preventDefault();openPsPanel(ev.target.dataset.openPs);}});
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
    root.addEventListener('change',ev=>{
      const scope=ev.target.closest('select[data-param-scope]');
      if(scope){changeScopeDraft(scope.closest('.dg-layer-menu'),scope.dataset.paramScope);return;}
      const select=ev.target.closest('select[data-earth-state]');if(!select)return;
      const [id,end]=String(select.dataset.earthState).split(':');const line=data.lines.find(l=>l.id===id);
      if(!line||!['a','b'].includes(end)||(!cloudReady&&!cloudReadError))return;
      const prev=earthState(line,end),value=select.value;
      if(value==='on'&&!actualOpen(line,end)&&!confirm('QF virtual yopiq turibdi! «Yerga ulagich o‘rnatilgan» deb belgilash faqat lokal sinovdir, haqiqiy tizimni himoya qilmaydi. Davom etasizmi?')){select.value=prev;return;}
      line['earth'+end.toUpperCase()]=value;
      saveLocal();refresh();showMsg('Virtual yerga ulagich qayd etildi; Firebase holatini tekshiring. Haqiqiy uskunani bildirmaydi.','info');
    });
  }

  function authChanged(u){
    const wasOpen=root&&!root.hidden;
    const prior=currentUser && currentUser.uid;
    currentUser=isAllowed(u) ? u : null;
    if(button)button.hidden=!currentUser;
    if(!currentUser){
      cloudEpoch++;stopCloudListener();cloudWanted=false;cloudReady=false;cloudDirty=false;
      cloudBlocked=false;cloudRevision=null;cloudReadStarted=false;cloudReadError=false;
      feederPreviewEpoch++;feederPreviewModel=null;feederPreviewPoints={};feederPreviewBusy=false;feederPreviewUser='';stopLiveUpdates();mnemoFilter={region:'',territory:'',ps:'',feeder:''};
      if(wasOpen)close();activePsId=null;data=empty();overrides={};existingTPs=null;existingTPsPending=false;return;
    }
    if(prior!==(u.uid||null)){
      feederPreviewEpoch++;feederPreviewModel=null;feederPreviewPoints={};feederPreviewBusy=false;feederPreviewUser='';stopLiveUpdates();mnemoFilter={region:'',territory:'',ps:'',feeder:''};
      cloudEpoch++;stopCloudListener();cloudReadStarted=false;cloudBusy=false;cloudBlocked=false;
      cloudReady=false;cloudReadError=false;cloudRevision=null;
      existingTPs=null;existingTPsPending=false;data=loadLocal();overrides=loadSwitchesLocal();
      cloudWanted=true;cloudDirty=false; // Old local draft must NEVER auto-overwrite the server.
      syncFolderStations();chosen=null;activePsId=null;if(wasOpen)refresh();
      setCloudStatus('Firebase’dan haqiqiy sxema avtomatik yuklanmoqda…');
      Promise.resolve().then(()=>openCloudSession());
    }
  }
  function open(){if(!canEdit())return;root.hidden=false;root.setAttribute('aria-hidden','false');document.body.classList.add('dg-modal-open');syncFolderStations();refresh();updateSidebar();setCloudStatus(cloudStatusText);if(cloudWanted&&!cloudReady)openCloudSession();loadFeederPreview(true);startLiveUpdates();}
  function close(){if(!root)return;stopLiveUpdates();activePsId=null;callouts=null;root.hidden=true;root.setAttribute('aria-hidden','true');document.body.classList.remove('dg-modal-open');closeEditor();if(map){map.remove();map=null;mapLayer=null;baseMapLayer=null;}}
  function exportMnemoSvg(){
    if(!isSuperAdmin())return showMsg('Faqat Bosh admin rasmiy vektorli sxemani yuklab olishi mumkin.','error');
    const model=currentMnemo();if(!model.groups.length)return showMsg('Filtrga mos sxema mavjud emas.','info');
    if(model.groups.length>500)return showMsg('Sxema 500 tadan ortiq fiderdan iborat. To‘liq SVG uchun viloyat, PS yoki fider filtrini tanlang.','error');
    const svg=window.HETKLiveMnemo?.render?.(model,{svgOnly:true,animate:false,technical:view==='technical',lineWidth:mnemoLineWidth});
    if(!svg)return showMsg('Vektor moduli topilmadi.','error');
    window.HETKLiveMnemo.downloadSvg(svg,'HETK-mnemosxema-'+new Date().toISOString().slice(0,10)+'.svg');
  }
  function printMnemoPdf(){
    if(!isSuperAdmin())return showMsg('PDF chiqarish faqat Bosh admin uchun.','error');
    const model=currentMnemo();if(!model.groups.length)return showMsg('Chop etish uchun mos fider yo‘q.','info');
    if(model.groups.length>500)return showMsg('To‘liq PDF uchun 500 tadan kamroq fider tanlang; hech qanday fider tushirib qoldirilmaydi.','error');
    const svg=window.HETKLiveMnemo?.render?.(model,{svgOnly:true,animate:false,technical:view==='technical',lineWidth:mnemoLineWidth});
    if(!svg)return showMsg('Vektor chizma topilmadi.','error');
    // Chromium/Edge print pipelines preserve inline SVG as vector geometry.
    // This window is intentionally generated only following a super-admin click.
    const page=window.open('','_blank');
    if(!page)return showMsg('Chop etish oynasi bloklandi. Brauzerdan popupga ruxsat bering.','error');
    const printed=svg.replace(/width="[0-9]+" height="[0-9]+" viewBox=/,'width="100%" height="auto" viewBox=');
    page.document.open();page.document.write(`<!doctype html><html lang="uz"><head><meta charset="UTF-8"><title>HETK · Mnemosxema · PDF</title><style id="paper-style">@page{size:A1 landscape;margin:8mm}</style><style>body{margin:0;background:white;font:12px Arial,sans-serif}svg{width:100%;height:auto;display:block;break-inside:avoid}small{display:block;color:#456;break-inside:avoid}.tools{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:10px;background:#eef5fd;margin-bottom:10px;color:#164b7a}.tools button,.tools select{padding:8px 12px;border-radius:6px;border:1px solid #8caec9;background:#fff;color:#153d67;font:600 12px Arial}@media print{.tools{display:none}}</style></head><body><div class="tools"><label>Chop o‘lchami: <select id="paper" onchange="setPaper(this.value)"><option value="A4 landscape">A4</option><option value="A3 landscape">A3</option><option value="A2 landscape">A2</option><option value="A1 landscape" selected>A1</option><option value="A0 landscape">A0</option><option value="1200mm 900mm">90 × 120 sm</option><option value="2000mm 3000mm">2 × 3 metr</option><option value="3000mm 5000mm">3 × 5 metr</option></select></label><button type="button" onclick="window.print()">Vektor PDF / Chop etish</button></div>${printed}<small>HETK mnemosxema · kiritilgan model, jonli telemetriya emas · ${esc(new Date().toLocaleDateString('uz-UZ'))}</small><script>function setPaper(v){document.getElementById('paper-style').textContent='@page{size:'+v+';margin:8mm}';}<\/script></body></html>`);page.document.close();
    page.focus();
  }
  async function editMnemoNote(pointId,feederId){
    if(!isSuperAdmin())return showMsg('Izohni tahrirlash hozircha faqat Bosh admin uchun.','error');
    const folders=mainFolders(),route=folders[feederId]?.feederRoute6kv;
    if(!route?.points?.some(p=>p.id===pointId)||!canSeeFolder(feederId))return showMsg('Fider yoki liniya nuqtasi topilmadi.','error');
    if(!/^[A-Za-z0-9_-]{1,90}$/.test(pointId)||!/^[-A-Za-z0-9_]{1,160}$/.test(feederId))return showMsg('Noto‘g‘ri nuqta identifikatori.','error');
    const old=folders[feederId]?.mnemoNotes?.[pointId];
    const value=prompt('Liniya yonidagi vaqtinchalik yozuv (tayanch soni, masofa). Bo‘sh qoldirsangiz avtomatik hisob chiqadi:',typeof old==='string'?old:old?.text||'');
    if(value===null)return;
    const text=String(value).trim();
    if(text.length>100)return showMsg('Izoh 100 ta belgidan oshmasin.','error');
    try{
      const ref=window.firebase?.database?.().ref('Folders/'+feederId+'/mnemoNotes/'+pointId);
      if(!ref||!currentUser)return showMsg('Firebase ulanmadi.','error');
      await ref.set(text?{text,updatedBy:currentUser.uid,updatedAt:window.firebase.database.ServerValue.TIMESTAMP}:null);
      showMsg('Liniya yozuvi alohida saqlandi. Mavjud fider va TP ma’lumotlari o‘zgartirilmadi.','success');
    }catch(error){showMsg('Izohni saqlab bo‘lmadi: '+(error?.message||error),'error');}
  }
  function onClick(ev){
    const note=ev.target.closest('[data-mnemo-note]');if(note){editMnemoNote(note.dataset.mnemoNote,note.dataset.mnemoFeeder);return;}
    const svgPs=ev.target.closest('[data-open-ps]');
    if(svgPs && svgPs.tagName.toLowerCase()!=='button'){openPsPanel(svgPs.dataset.openPs);return;}
    const target=ev.target.closest('button');if(!target||!root.contains(target))return;
    if(target.dataset.view){view=target.dataset.view;refresh();return;}
    if(target.dataset.action==='mnemo-export-svg'){exportMnemoSvg();return;}
    if(target.dataset.action==='mnemo-print-pdf'){printMnemoPdf();return;}
    if(target.dataset.mapStyle){switchMapStyle(target.dataset.mapStyle);return;}
    if(target.dataset.paramVoltage||target.dataset.paramLayer){
      const menu=target.closest('.dg-layer-menu');if(!menu)return;
      setParameterTick(target,target.getAttribute('aria-checked')!=='true');
      return; // Keep the menu OPEN while the user selects several layers.
    }
    if(target.dataset.action==='params-apply'){
      applyParameterTicks(target.closest('.dg-layer-menu'));return;
    }
    if(target.dataset.action==='params-cancel'){
      const menu=target.closest('.dg-layer-menu');resetParameterTicks(menu);if(menu)menu.open=false;
      return;
    }
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
    if(target.dataset.add){if(!cloudReady&&!cloudReadError)return showMsg('Firebase hali yuklanmoqda.','info');openEditor(target.dataset.add);return;}
    if(target.dataset.edit){if(!cloudReady&&!cloudReadError)return showMsg('Firebase hali yuklanmoqda.','info');openEditor(target.dataset.edit,target.dataset.id||'');return;}
    if(target.dataset.openPs){openPsPanel(target.dataset.openPs);return;}
    if(target.dataset.saveFeeder){if(!cloudReady&&!cloudReadError)return showMsg('Firebase hali yuklanmoqda.','info');
      const record=feeder(target.dataset.saveFeeder),wrap=target.closest('[data-feeder-record]');if(!record||!wrap)return;
      const numeric=['loadKw','loadAmp','meterKwh'];const values={};
      for(const key of numeric){const f=wrap.querySelector(`[data-feeder-field="${key}"]`);const raw=f?.value.trim()||'';if(raw!==''&&(!Number.isFinite(Number(raw))||Number(raw)<0))return showMsg('Yuklama, tok va hisoblagich ko‘rsatkichlari manfiy bo‘lmasin.','error');values[key]=raw===''?null:Number(raw);}
      const meterNum=wrap.querySelector('[data-feeder-field="meterNumber"]')?.value.trim()||'';
      const readingChanged=values.meterKwh!=null&&(values.meterKwh!==record.meterKwh||meterNum!==(record.meterNumber||''));
      Object.assign(record,values,{meterNumber:meterNum,meterAt:new Date().toISOString()});
      if(readingChanged)record.readings=[...arr(record.readings),{at:record.meterAt,kwh:record.meterKwh,meterNumber:meterNum}].slice(-250);
      saveLocal();renderPsPanel();showMsg('Fider ma’lumoti lokal saqlandi, Firebase’ga yuborilmoqda.','info');return;
    }
    if(target.dataset.attachTps){attachExistingTps(target.dataset.attachTps);return;}
    if(target.dataset.del){removeEntity(target.dataset.del,target.dataset.id);return;}
    if(target.dataset.select){chosen=target.dataset.select;refresh();return;}
    if(target.dataset.switch){if(!cloudReady&&!cloudReadError)return showMsg('Firebase hali yuklanmoqda.','info');const key=target.dataset.switch;const [lineId, end]=key.split(':');const l=data.lines.find(x=>x.id===lineId);
      if(!l || station(l[end])?.kind==='tap')return;
      if(actualOpen(l,end)&&isGroundMarked(l)&&!confirm('DIQQAT: virtual yerga ulagich o‘rnatilgan deb qayd etilgan! Bu faqat SIMULYATSIYA; haqiqiy holatni boshqarmaydi. Virtual QFni yopishni davom ettirasizmi?'))return;
      overrides[key]=!actualOpen(l,end);saveSwitchesLocal();refresh();return;}
    const a=target.dataset.action;
    if(a==='close')close();
    if(a==='close-ps-panel'){activePsId=null;renderPsPanel();}
    if(a==='ps-add-feeder'){openEditor('feeder');const f=el('dg-editor-form')?.elements.namedItem('psId');if(f&&activePsId)f.value=activePsId;}
    if(a==='cancel-editor')closeEditor();
    if(a==='toggle-objects'){showObjects=!showObjects;if(showObjects){showImpact=false;activePsId=null;renderPsPanel();}updateSidebar();}
    if(a==='toggle-impact'){showImpact=!showImpact;if(showImpact){showObjects=false;activePsId=null;renderPsPanel();}updateSidebar();}
    if(a==='toggle-stats'){showStats=!showStats;updateSidebar();}
    if(a==='close-objects'){showObjects=false;updateSidebar();}
    if(a==='close-impact'){showImpact=false;updateSidebar();}
    if(target.dataset.voltage){const kv=Number(target.dataset.voltage);if(VOLTAGES.includes(kv))voltageVisible[kv]=!voltageVisible[kv];refresh();return;}
    if(a==='towers'){mapTowers=!mapTowers;refresh();}
    if(a==='picker-objects'){visiblePickerObjects=!visiblePickerObjects;const btn=root.querySelector('[data-action="picker-objects"]');if(btn)btn.textContent=(visiblePickerObjects?'✓':'○')+' PS va liniyalar';renderPickerContext();}
    if(a==='expand-picker'){const wrap=root.querySelector('.dg-pick-section');if(wrap){const big=wrap.classList.toggle('dg-picker-expanded');target.textContent=big?'⊟ Xaritani kichraytirish':'⛶ Xaritani kattalashtirish';setTimeout(()=>pickerMap?.invalidateSize(),90);}}
    if(a==='map-tps'){mapTps=!mapTps;refresh();}
    if(a==='map-consumers'){mapConsumers=!mapConsumers;refresh();}
  }
  function refresh(){if(!root||root.hidden)return;
    root.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    renderList();renderMain();renderImpact();renderPsPanel();
  }
  function badgeStatus(oper) {return oper?'dg-good':'dg-off';}
  function renderList(){
    root.querySelectorAll('[data-section]').forEach(b=>b.classList.toggle('active',b.dataset.section===section));
    const container=el('dg-item-list');if(!container)return;
    const towerItems=data.lines.flatMap(l=>arr(l.towers).map((t,i)=>({id:towerRef(l,t,i),name:t.number?'Tayanch '+t.number:'Raqamsiz tayanch',lineId:l.id,number:t.number,lat:t.lat,lng:t.lng})));
    const mapSec={stations:data.stations.filter(x=>x.kind!=='tap'),lines:data.lines,taps:data.stations.filter(x=>x.kind==='tap'),towers:towerItems,feeders:data.feeders,tps:data.tps,consumers:data.consumers};
    const items=mapSec[section]||[];
    container.innerHTML=items.length ? items.map(x=>{
      const type={stations:'station',lines:'line',taps:'tap-point',towers:'tower',feeders:'feeder',tps:'tp',consumers:'consumer'}[section];
      const info=section==='stations'? `${x.kind==='source'?'MANBA PS':'PS'} · ${arr(x.volts).join('/')} kV`:
        section==='lines' ? `${esc(x.voltage)} kV · ${esc(station(x.a)?.name||'?')} — ${esc(station(x.b)?.name||'?')} · ${esc(lineLengthInfo(x).label)}` :
        section==='taps' ? `${arr(x.volts).join('/')} kV · ${data.lines.filter(l=>l.a===x.id||l.b===x.id).length} ta ulanish` :
        section==='towers' ? `${esc(data.lines.find(l=>l.id===x.lineId)?.name||'?')} · ${x.lat==null?'Joylashuv taxminiy':(Number(x.lat).toFixed(5)+', '+Number(x.lng).toFixed(5))}` :
        section==='feeders' ? `${esc(station(x.psId)?.name||'?')} · ${esc(x.voltage)} kV`:
        section==='tps' ? `${esc(feeder(x.feederId)?.name||'?')} · ${num(x.kva)} kVA`:
        `${x.kind==='mahalla'?'Mahalla':'Tashkilot'} · ${esc(tp(x.tpId)?.name||'bog‘lanmagan')}`;
      return `<article class="dg-item ${chosen===x.id?'selected':''}"><button type="button" class="dg-item-main" data-select="${esc(x.id)}"><strong>${esc(x.name)}</strong><small>${info}</small></button>${section==='feeders'?`<button type="button" title="Shu fider papkasidagi HETK TP/KTP larni biriktirish" data-attach-tps="${esc(x.id)}">↳ TP</button>`:''}<button type="button" title="Tahrirlash" data-edit="${type}" data-id="${esc(x.id)}">✎</button></article>`;
    }).join('') : `<div class="dg-empty-list">Hozircha ma’lumot yo‘q. PSlar «Guruhlar» bo‘limidan avtomatik aniqlanadi, boshqa obyektlarni + bilan kiriting.</div>`;
  }

  function flowDiagnostics(result){
    let moving=0;const reasons=[];
    for(const line of data.lines){
      const info=lineStateInfo(line,result);
      if(info.active && result.sourceCount[line.a]===1 && result.sourceCount[line.b]===1 && result.direction[line.id])moving++;
      else if(reasons.length<5)reasons.push(`${line.name||line.id}: ${info.state}`);
    }
    return {moving,reasons};
  }
  function renderMain(){
    const result=analyze();
    const countPS=data.stations.filter(x=>x.kind!=='tap').length;
    el('dg-kpis').innerHTML=[
      ['Podstansiyalar',countPS,'fa-bolt'],['Liniya uchastkalari',data.lines.length,'fa-project-diagram'],
      ['Ta’minotsiz TP/KTP*',result.affectedTps.length,'fa-building'],['Ta’sirlangan mahalla/tashkilot*',result.affected.length,'fa-exclamation-triangle']
    ].map(([label,val,ic])=>`<div class="dg-kpi"><i class="fas ${ic}"></i><div><b>${val}</b><span>${label}</span></div></div>`).join('');
    let title='';
    if(view==='simple') title='Umumiy jonli mnemosxema';
    if(view==='technical') title='Texnik mnemosxema · mavjud bir chiziqli model';
    // GIS controls belong in the vacant centre of the TOP toolbar, not in a
    // second title row that steals map height. Other views keep their title.
    const slot=el('dg-gis-toolbar-slot');
    if(slot){
      slot.hidden=false;
      const oldMenu=slot.querySelector('.dg-layer-menu[open]');
      // Do not destroy the user's uncommitted checkmarks when a remote TP arrives.
      if(!oldMenu){
        slot.innerHTML=`<div class="dg-layer-tools">${view==='combined'?mapStyleButtons():''}${mapParameterMenu()}${view!=='combined'&&isSuperAdmin()?'<button type="button" class="dg-mnemo-export" data-action="mnemo-export-svg">↓ SVG</button><button type="button" class="dg-mnemo-export" data-action="mnemo-print-pdf">▤ PDF / Chop</button>':''}</div>`;
      }
    }
    const heading=el('dg-view-title');
    heading.hidden=view==='combined';
    heading.innerHTML=view==='combined'?'':`<div class="dg-view-heading"><strong>${esc(title)}</strong></div>`;
    const visual=el('dg-visual-content');
    if(view==='combined'){
      // Keep the Leaflet instance and its viewport alive across edits / toggles.
      // Only the network overlay is redrawn; recreating the whole map would
      // repeatedly tear down the animated supply paths and reset zoom.
      if(!visual.querySelector('#dg-map')){
        if(map){map.remove();map=null;mapLayer=null;baseMapLayer=null;callouts=null;}
        visual.innerHTML='<div class="dg-combined"><div id="dg-map" class="dg-map"></div></div>';
      }
      renderMap(result);
    } else {
      if(map){map.remove();map=null;mapLayer=null;baseMapLayer=null;callouts=null;}
      const existing=renderDiagram(result,view==='technical');
      const live=window.HETKLiveMnemo?.render?.(currentMnemo(),{technical:view==='technical',animate:mnemoLights,lineWidth:mnemoLineWidth})||'';
      // Keep the existing high-voltage and manually entered dispatch schema.
      // Live feeder projection is additional and cannot mutate its source data.
      visual.innerHTML=live?`<div class="dg-mnemo-workspace">${live}<details class="dg-legacy-diagram"><summary>Yuqori kuchlanish / avvalgi dispetcherlik sxemasi</summary>${existing}</details></div>`:existing;
    }
  }
  function geometryFor(line){
    const a=station(line.a), b=station(line.b);if(!a||!b||a.lat==null||a.lng==null||b.lat==null||b.lng==null)return [];
    const sorted=arr(line.towers);
    const fallback=sorted.map((t,i)=>({lat: num(a.lat)+(num(b.lat)-num(a.lat))*((i+1)/(sorted.length+1)),lng:num(a.lng)+(num(b.lng)-num(a.lng))*((i+1)/(sorted.length+1)), number:t.number}));
    const pts=[{lat:num(a.lat),lng:num(a.lng)},...sorted.map((t,i)=>({lat:t.lat==null?fallback[i].lat:num(t.lat),lng:t.lng==null?fallback[i].lng:num(t.lng),number:t.number})),{lat:num(b.lat),lng:num(b.lng)}];
    return pts;
  }
  function visibleStation(st){
    if(![mnemoFilter.region,mnemoFilter.territory,mnemoFilter.ps,mnemoFilter.feeder].some(Boolean))return true;
    const id=st.folderId||'',psId=st.folderId||st.id?.replace(/^folderps_/, '')||'';
    if(mnemoFilter.ps&&psId!==mnemoFilter.ps)return false;
    if(mnemoFilter.feeder){const src=feederPreviewModel?.stations?.get?.(psId);if(!src?.feeders?.some(f=>f.id===mnemoFilter.feeder))return false;}
    return [mnemoFilter.region,mnemoFilter.territory].filter(Boolean).every(scope=>folderIncludes(id,scope)||feederPreviewModel?.stations?.get?.(psId)?.feeders?.some(f=>folderIncludes(f.id,scope)));
  }
  function visibleDispatchLine(line){return visibleStation(station(line.a)||{})||visibleStation(station(line.b)||{});}
  function renderMap(result){
    if(!window.L || !el('dg-map')){el('dg-map').textContent='Xarita kutubxonasi yuklanmagan.';return;}
    const mapIsNew=!map;
    if(mapIsNew)map=L.map('dg-map',{zoomControl:true,attributionControl:true}).setView([40.11,65.51],10);
    // Leaflet popup controls are registered only once per map instance.
    if(mapIsNew && map.on)map.on('popupopen',e=>{
      const popup=e.popup?.getElement?.();if(!popup)return;
      popup.querySelectorAll('button[data-open-ps]').forEach(btn=>btn.addEventListener('click',evt=>{evt.preventDefault();evt.stopPropagation();openPsPanel(btn.dataset.openPs);map?.closePopup?.();},{once:true}));
      popup.querySelectorAll('button[data-edit]').forEach(btn=>btn.addEventListener('click',evt=>{
        evt.preventDefault();evt.stopPropagation();openEditor(btn.dataset.edit,btn.dataset.id||'');
      },{once:true}));
      popup.querySelectorAll('button[data-del]').forEach(btn=>btn.addEventListener('click',evt=>{
        evt.preventDefault();evt.stopPropagation();removeEntity(btn.dataset.del,btn.dataset.id||'');
      },{once:true}));
      popup.querySelectorAll('button[data-switch]').forEach(btn=>btn.addEventListener('click',evt=>{
        evt.preventDefault();evt.stopPropagation();
        const [id,end]=btn.dataset.switch.split(':');
        const line=data.lines.find(l=>l.id===id);
        if(!line||station(line[end])?.kind==='tap')return;
        if(!cloudReady&&!cloudReadError)return showMsg('Firebase hali yuklanmoqda.','info');
        overrides[id+':'+end]=!actualOpen(line,end);saveSwitchesLocal();
        refresh();showMsg('QF-'+end.toUpperCase()+' virtual sinovda almashtirildi. Firebase holatini tekshiring.','info');
      },{once:true}));
    });
    if(mapIsNew)baseMapLayer=makeBaseMap(map);
    if(mapLayer && !mapIsNew)mapLayer.clearLayers();
    else mapLayer=L.layerGroup().addTo(map);
    const bounds=[];
    data.lines.forEach(l=>{
      if(!voltageVisible[num(l.voltage)]||!visibleDispatchLine(l))return;
      const coords=geometryFor(l).map(x=>[x.lat,x.lng]);
      if(coords.length<2||coords.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))return;
      const st=lineStateInfo(l,result),on=st.active;
      // Voltage is ALWAYS expressed by hue. State is expressed by solid/dashed,
      // opacity and QF markers, so an isolated 110kV route does not look like 35kV.
      const voltageColor=COLORS[l.voltage]||'#7889a9';
      const poly=L.polyline(coords,{color:voltageColor,weight:l.voltage>=110?6:5,opacity:on?.96:.57,dashArray:on?null:'9 9',lineCap:'round'}).addTo(mapLayer);
      poly.bindPopup(mapLinePopup(l,result));
      // Names are rendered as viewport-aware leader callouts, never over the conductor.
      coords.forEach(p=>bounds.push(p));
      // QF virtual controls live at their own station, not at arbitrary points on the route.
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
        if(marker.bindPopup)marker.bindPopup(`<strong>${esc(text)}</strong><br>${actual?'GPS: '+num(t.lat).toFixed(6)+', '+num(t.lng).toFixed(6):'GPS kiritilmagan; chiziqdagi taxminiy joy'}<br><button type="button" class="dg-popup-edit" data-edit="tower" data-id="${esc(towerRef(l,original,i))}">✎ Tahrirlash</button> <button type="button" class="dg-popup-edit dg-popup-delete" data-del="tower" data-id="${esc(towerRef(l,original,i))}">O‘chirish</button>`);
      });
    });
    // Existing 6/10 kV GIS lines from Boshqaruv paneli, read-only. These are
    // NOT assumed electrical connections to the 35/110/220/500 kV model.
    // A drawn provisional line must never be mistaken for a surveyed circuit.
    if(feederPreviewModel){
      for(const feed of feederPreviewModel.previewLines||[]){
        if(!voltageVisible[feed.kv]||!matchesScope(feed.feederId,feed.stationId))continue;
        const ps=feederPreviewModel.stations?.get?.(feed.stationId);
        const routed=feed.route?.points?.length && window.HETKFeederRouteEditor?.graph?.(feed.route,ps);
        const good=routed && !routed.errors?.length && routed.routes?.length;
        const legs=good?routed.routes:[{path:feed.path,mode:'draft'}];
        for(const leg of legs){
          const points=leg.path||[];
          if(points.length<2 || points.some(p=>!validGps(p[0],p[1])))continue;
          const cable=leg.mode==='cable',draft=leg.mode==='draft';
          L.polyline(points,{color:cable?'#d966e0':COLORS[feed.kv],weight:draft?3:4,
            opacity:0.91,dashArray:cable?'4 7':draft?'8 7':null,
            className:'dg-gis-feeder-route'}).addTo(mapLayer)
            .bindTooltip(esc(feed.name)+' · '+feed.kv+' kV · '+(draft?'taxminiy GPS yo‘nalish':'kiritilgan tayanch/burilish yo‘nalishi'),{sticky:true});
          // Match Boshqaruv paneli's moving dots on 6/10 kV feeders.
          // Each oriented branch starts at its recorded parent (PS -> feeder).
          // This is an illustrative animation, never a live current reading.
          L.polyline(points,{color:'#fff',weight:2,opacity:0.96,dashArray:'2 17',
            lineCap:'round',interactive:false,className:'dg-gis-feeder-flow-path'}).addTo(mapLayer);
        }
      }
    }
    data.stations.forEach(p=>{
      if(!visibleStation(p))return;
      if(p.lat==null||p.lng==null||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lng)))return;
      const color=p.kind==='source'?'#1e7adf':p.kind==='tap'?'#e8a547':'#153e75';
      const marker=L.circleMarker([num(p.lat),num(p.lng)],{radius:p.kind==='tap'?5:9,color:'#fff',weight:2,fillColor:color,fillOpacity:1}).addTo(mapLayer);
      if(p.kind==='tap')marker.bindPopup(`<strong>${esc(p.name)}</strong><br>${arr(p.volts).join('/')} kV<br><button type="button" class="dg-popup-edit" data-edit="tap-point" data-id="${esc(p.id)}">✎ Tahrirlash</button> <button type="button" class="dg-popup-edit dg-popup-delete" data-del="tap-point" data-id="${esc(p.id)}">O‘chirish</button>`);
      else marker.on('click',()=>openPsPanel(p.id));
      bounds.push([num(p.lat),num(p.lng)]);
    });
    if(mapTps)data.tps.forEach(t=>{
      const f=feeder(t.feederId);if(f&&!matchesScope(f.folderId||f.id,f.psId))return;
      if(t.lat==null||t.lng==null||!validGps(t.lat,t.lng))return;
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
    if(!callouts || mapIsNew)callouts=L.layerGroup().addTo(map);
    else callouts.clearLayers();
    if(mapIsNew)map.on('moveend zoomend resize',drawMapCallouts);
    if(bounds.length && mapIsNew){try{map.fitBounds(bounds,{padding:[35,35],maxZoom:12});}catch(e){}}
    if(mapIsNew && typeof L.control==='function'){
      const legend=L.control({position:'bottomleft'});
      legend.onAdd=()=>{
        const e=document.createElement('div');e.className='dg-map-legend dg-legend-toggleable';
        e.innerHTML=`<button type="button" class="dg-legend-toggle" aria-expanded="${legendExpanded}" aria-controls="dg-map-legend-content">◈ Kuchlanishlar <span aria-hidden="true">${legendExpanded?'▴':'▾'}</span></button><div id="dg-map-legend-content" class="dg-legend-content" ${legendExpanded?'':'hidden'}><strong>Kuchlanish va holat (virtual)</strong><div class="dg-legend-list">${VOLTAGES.map(v=>`<span><i style="background:${COLORS[v]}"></i>${v} kV</span>`).join('')}</div><div class="dg-legend-status"><span>QFlarni PS nuqtasini bosib ko‘ring</span><span>┄ Uzilgan chiziq: modelda ta’minot yo‘q</span></div></div>`;
        if(L.DomEvent?.disableClickPropagation)L.DomEvent.disableClickPropagation(e);
        if(L.DomEvent?.disableScrollPropagation)L.DomEvent.disableScrollPropagation(e);
        const toggle=e.querySelector('.dg-legend-toggle'),content=e.querySelector('.dg-legend-content');
        toggle.addEventListener('click',ev=>{
          ev.stopPropagation();legendExpanded=!legendExpanded;
          content.hidden=!legendExpanded;toggle.setAttribute('aria-expanded',String(legendExpanded));
          toggle.querySelector('span').textContent=legendExpanded?'▴':'▾';
        });
        return e;
      };
      if(typeof legend.addTo==='function')legend.addTo(map);
    }
    setTimeout(()=>{if(map){map.invalidateSize();drawMapCallouts();}},130);
  }
  // Auto-place ONLY when stored diagram positions overlap. GIS positions and
  // stored manual X/Y are left untouched. Uses all connections including open QFs
  // so the layout remains stable when an operator tests a virtual switching state.
  function diagramLayout(){
    const nodes=data.stations,manual=new Map(nodes.map(n=>[n.id,{x:num(n.x,NaN),y:num(n.y,NaN)}]));
    let collision=nodes.some(n=>!Number.isFinite(manual.get(n.id).x)||!Number.isFinite(manual.get(n.id).y));
    for(let i=0;i<nodes.length&&!collision;i++)for(let j=0;j<i;j++){
      const a=manual.get(nodes[i].id),b=manual.get(nodes[j].id);
      const minX=(nodes[i].kind==='tap'||nodes[j].kind==='tap')?105:177;
      if(Math.abs(a.x-b.x)<minX&&Math.abs(a.y-b.y)<79){collision=true;break;}
    }
    if(!collision)return {positions:manual,width:940,height:455,automatic:false};
    const byId=new Map(nodes.map(n=>[n.id,n]));
    const graph=new Map(nodes.map(n=>[n.id,[]]));
    for(const l of data.lines)if(byId.has(l.a)&&byId.has(l.b)){graph.get(l.a).push(l.b);graph.get(l.b).push(l.a);}
    const seen=new Set(),groups=[];
    for(const n of nodes){if(seen.has(n.id))continue;
      const q=[n.id],members=[];seen.add(n.id);
      while(q.length){const id=q.shift();members.push(id);
        for(const peer of graph.get(id)||[])if(!seen.has(peer)){seen.add(peer);q.push(peer);}
      }
      groups.push(members);
    }
    const positions=new Map();let bottom=40,maxLevel=0;
    if(groups.length===nodes.length && nodes.length>1){
      const columns=Math.min(4,nodes.length);
      nodes.forEach((n,i)=>positions.set(n.id,{x:135+(i%columns)*315,y:115+Math.floor(i/columns)*125}));
      return {positions,width:Math.max(940,270+(columns-1)*315),height:Math.max(455,230+Math.ceil(nodes.length/columns)*125),automatic:true};
    }
    for(const members of groups){
      const source=members.find(id=>byId.get(id).kind==='source')||members[0];
      const distances={[source]:0},q=[source];
      while(q.length){const id=q.shift();for(const peer of graph.get(id)||[])if(distances[peer]==null){distances[peer]=distances[id]+1;q.push(peer);}}
      const levels=new Map();for(const id of members){const depth=distances[id]||0;maxLevel=Math.max(maxLevel,depth);if(!levels.has(depth))levels.set(depth,[]);levels.get(depth).push(id);}
      const height=Math.max(190,Math.max(...Array.from(levels.values(),a=>a.length))*118+70);
      for(const [depth,ids] of levels)ids.forEach((id,i)=>positions.set(id,{x:135+depth*315,y:bottom+height/2+(i-(ids.length-1)/2)*112}));
      bottom+=height+35;
    }
    return {positions,width:Math.max(940,270+maxLevel*315),height:Math.max(455,bottom+25),automatic:true};
  }
  function renderDiagram(result,technical){
    const layout=diagramLayout(),vwidth=layout.width,vheight=layout.height;
    const sx=n=>layout.positions.get(n.id)?.x??480,sy=n=>layout.positions.get(n.id)?.y??170;
    const lines=data.lines.map(l=>{
      const a=station(l.a),b=station(l.b);if(!a||!b)return '';
      const x1=sx(a),y1=sy(a),x2=sx(b),y2=sy(b), color=COLORS[l.voltage]||'#788bb0';
      const active=accessibleEdge(l)&&result.energized[l.a]===true&&result.energized[l.b]===true;
      const parallel=result.sourceCount[l.a]>1;
      const dir=active&&!parallel?result.direction[l.id]:0;
      const path=`M ${x1} ${y1} L ${x2} ${y2}`;
      const labelX=(x1+x2)/2,labelY=(y1+y2)/2-48;
      const shortName=l.name.length>19?l.name.slice(0,18)+'…':l.name;
      const bulbs=dir?Array.from({length:3},(_,i)=>{
        const start=dir===1?0:1,end=dir===1?1:0;
        const a0=(start+(end-start)*(i/3)),a1=end;
        const fromX=x1+(x2-x1)*a0,fromY=y1+(y2-y1)*a0,toX=x1+(x2-x1)*a1,toY=y1+(y2-y1)*a1;
        return `<circle class="dg-flow-light" r="5" cx="${fromX}" cy="${fromY}" fill="#b4ffdf"><animate attributeName="cx" values="${fromX};${toX}" begin="${(i*.43).toFixed(2)}s" dur="1.4s" repeatCount="indefinite"/><animate attributeName="cy" values="${fromY};${toY}" begin="${(i*.43).toFixed(2)}s" dur="1.4s" repeatCount="indefinite"/></circle>`;
      }).join(''):'';
      function breaker(end,n,x,y){if(n?.kind==='tap')return '';
        const opened=actualOpen(l,end),step=clamp(96/Math.max(1,Math.hypot(x2-x1,y2-y1)),.18,.43),tx=end==='a'?step:1-step,px=x1+(x2-x1)*tx,py=y1+(y2-y1)*tx;
        return `<g class="dg-breaker ${opened?'open':'closed'}"><rect x="${px-8}" y="${py-8}" width="16" height="16" rx="2" fill="${opened?'#fff':'#20b978'}" stroke="${opened?'#fa6675':'#067957'}" stroke-width="2.5"/>${technical?`<text x="${px}" y="${py-14}" text-anchor="middle" font-size="12" fill="currentColor">QF ${opened?'ochiq':'yopiq'}</text>`:''}</g>`;
      }
      const label=technical?`<g><rect x="${labelX-65}" y="${labelY-16}" width="130" height="22" rx="6" fill="#e9f4ff" stroke="#bfd4e9"/><text x="${labelX}" y="${labelY-1}" text-anchor="middle" font-size="11" fill="#123f6c">${esc(shortName)} · ${num(l.voltage)} kV</text></g>`:
        `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">${esc(shortName)}</text>`;
      return `<g><path d="${path}" stroke="${color}" stroke-opacity="${active?'1':'0.47'}" stroke-width="${l.voltage>=110?6:5}" stroke-linecap="round" fill="none" ${active?'':'stroke-dasharray="8 7"'}/>${bulbs}${label}${breaker('a',a)}${breaker('b',b)}</g>`;
    }).join('');
    const nodes=data.stations.map(n=>{
      const x=sx(n),y=sy(n),on=result.energized[n.id], amb=result.sourceCount[n.id]>1;
      if(n.kind==='tap')return `<g><circle cx="${x}" cy="${y}" r="10" stroke="#e3a14b" stroke-width="3" fill="#fff"/><circle cx="${x}" cy="${y}" r="4" fill="${on?'#1cc984':'#94a3b8'}"/><text text-anchor="middle" x="${x}" y="${y+27}" font-size="11" fill="currentColor">${esc(n.name)}</text></g>`;
      const title=esc(n.name.length>23?n.name.slice(0,22)+'…':n.name);
      return `<g class="dg-svg-ps-open" data-open-ps="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(n.name)} PS boshqaruvini ochish"><rect x="${x-83}" y="${y-31}" width="166" height="66" rx="11" fill="${n.kind==='source'?'#1452a0':'#133c6a'}" stroke="${amb?'#f6b34f':on?'#2cd6a8':'#839ab2'}" stroke-width="${on?3:2}"/><text x="${x}" y="${y-5}" fill="#fff" font-size="14" text-anchor="middle" font-weight="700">${title}</text><text x="${x}" y="${y+15}" fill="#beddfa" font-size="12" text-anchor="middle">${esc(arr(n.volts).join('/'))} kV${n.kind==='source'?' · MANBA':''}</text>${technical?`<text x="${x}" y="${y+52}" fill="currentColor" text-anchor="middle" font-size="11">${data.feeders.filter(f=>f.psId===n.id).length} fider</text>`:''}</g>`;
    }).join('');
    return `<div class="dg-diagram-wrap"><svg class="dg-network-svg" style="min-width:${vwidth}px;min-height:${Math.min(vheight,850)}px" viewBox="0 0 ${vwidth} ${vheight}" role="img" aria-label="Podstansiyalar, liniyalar va o‘chirgichlar sxemasi"><defs><filter id="dg-glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><g>${lines}</g><g>${nodes}</g></svg><div class="dg-diagram-caption">Chiroqchalar: faqat bir manbali ta’minot yo‘li. Uzuq rangli chiziq: virtual QF ochiq yoki modelda ta’minot yo‘q. ${layout.automatic?'Ustma-ust joylashgan PSlar ekranda avtomatik ajratildi; saqlangan X/Y va GPS o‘zgarmadi.':'Sxema X/Y joylashuvlari saqlangan.'}</div></div>`;
  }
  function renderImpact(){
    const r=analyze();const impactedPS=data.stations.filter(x=>x.kind==='ps'&&!r.energized[x.id]);
    const warnings=[];
    if(r.parallel.length) warnings.push({title:'Ikki manba bir konturda',msg:'Parallellash imkoniyati bor. Sinxronizm va himoya tekshirilmaguncha yo‘nalish animatsiyasi o‘chirildi.'});
    if(r.malformed.length)warnings.push({title:'Noto‘g‘ri yoki yetishmaydigan ulanish',msg:'Tekshiring: '+r.malformed.join(', ')});
    if(data.lines.some(l=>isGroundMarked(l)&&(!actualOpen(l,'a')||!actualOpen(l,'b'))))warnings.push({title:'Yerga ulagich va virtual QF mos kelmasligi',msg:'Ba’zi uchastkada yerga ulagich o‘rnatilgan deb qayd etilgan, QF esa yopiq. Bu xavfli holat bo‘lishi mumkin. Haqiqiy tarmoq bo‘yicha xulosa chiqarmang.'});
    if(Object.keys(overrides).length)warnings.push({title:'Virtual sxema o‘zgartirildi',msg:'Bu faqat ushbu ekrandagi sinov. Haqiqiy o‘chirgich holati o‘zgarmadi.'});
    const groups={mahalla:r.affected.filter(c=>c.kind==='mahalla'),organization:r.affected.filter(c=>c.kind!=='mahalla')};
    const consDisplay=(list)=>list.length?list.map(c=>{
      const t=tp(c.tpId),f=t&&feeder(t.feederId);
      return `<div class="dg-impact-row"><strong>${esc(c.name)}</strong><small>${esc(t?.name||'TP?')} · ${esc(f?.name||'Fider?')}</small></div>`;
    }).join(''):'<p class="dg-none">Bog‘langan obyekt yo‘q.</p>';
    const controls=data.stations.filter(ps=>ps.kind!=='tap').map(ps=>{
      const lines=data.lines.filter(l=>l.a===ps.id||l.b===ps.id);
      return `<div class="dg-switch-row"><div><strong>${esc(ps.name)}</strong><small>${lines.length} liniya · PSning virtual QF holatlarini shu yerda ko‘ring</small></div><div class="dg-qf-controls"><button type="button" class="dg-popup-edit" data-open-ps="${esc(ps.id)}">PS oynasini ochish</button></div></div>`;
    }).join('');
    el('dg-impact').innerHTML=`
      <div class="dg-impact-head"><strong>Ta’sir tahlili</strong><div><span>Virtual rejim</span><button type="button" class="dg-impact-close" data-action="close-impact" aria-label="Panelni yopish">✕</button></div></div>
      <div class="dg-impact-score"><strong>${r.affected.length}</strong><span>Mahalla / tashkilot*<small>Model bo‘yicha ta’minotsiz qolishi mumkin</small></span></div>
      <div class="dg-mini-stats"><span>${impactedPS.length} PS</span><span>${r.affectedTps.length} TP/KTP</span><span>${r.affectedKva.toLocaleString('uz-UZ')} kVA*</span></div>
      ${warnings.map(w=>`<div class="dg-alert"><b>⚠ ${esc(w.title)}</b><p>${esc(w.msg)}</p></div>`).join('')}
      <div class="dg-impact-section"><h3>Mahallalar (${groups.mahalla.length})</h3>${consDisplay(groups.mahalla)}</div>
      <div class="dg-impact-section"><h3>Tashkilotlar (${groups.organization.length})</h3>${consDisplay(groups.organization)}</div>
      ${r.unknown.length?`<div class="dg-alert"><b>To‘liq bog‘lanmagan iste’molchilar: ${r.unknown.length}</b><p>Fider/TP bog‘lanishlarini to‘ldirmasdan aniq ta’sir ro‘yxati olinmaydi.</p></div>`:''}
      <div class="dg-impact-section"><h3>PSlar orqali virtual QF</h3><p class="dg-section-note">QF va yerga ulagichlar PS oynasida; haqiqiy uskunalar boshqarilmaydi.</p>${controls||'<p class="dg-none">Liniya yaratilmagan.</p>'}</div>
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
    const sourcePsId=mainFolders()[folderId]?.sourcePsFolderId;
    const matching=data.stations.filter(s=>s.kind!=='tap'&&s.folderId&&(sourcePsId?s.folderId===sourcePsId:folderIncludes(folderId,s.folderId)));
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
      if(rec.folderSourced)html+='<div class="dg-form-tip">Bu PS «Guruhlar»dan avtomatik olingan. Nomi va GPS koordinatasini asosiy PS papkasida tahrirlang; bu yerda virtual «Manba PS» turini belgilash mumkin.</div>'; 
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
      if(id){const len=lineLengthInfo(rec);html+=`<div class="dg-length-summary">📏 Xaritadan hisoblangan uzunlik: <b>${esc(len.label)}</b><small>${esc(len.desc||'Dastlabki to‘g‘ri yo‘l. Tayanchlar qo‘shilganda qayta hisoblanadi.')}. Simning haqiqiy uzunligi emas.</small></div>`;}
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
      html+='<div class="dg-form-tip">Fider o‘z xizmat ko‘rsatuvchi hududida qoladi. Agar manba PS boshqa TETda bo‘lsa, avval «Guruhlar»da fiderning elektr manbasini biriktiring.</div>';
    } else if(type==='tp'){
      html+=field('name','TP/KTP nomi',rec.name,'required maxlength="120"');
      html+=select('feederId','Ulangan fider',options(data.feeders,rec.feederId));
      html+=existingTPFields();
      html+=folderPickerHtml(rec.folderId||'');
      html+=field('kva','Nominal quvvati, kVA',rec.kva==null?'':rec.kva,'type="number" min="0" step="0.1" required');
      html+='<div class="dg-two">'+field('lat','GPS kenglik (ixtiyoriy)',rec.lat==null?'':rec.lat,'type="number" min="-90" max="90" step="any"')+field('lng','GPS uzunlik (ixtiyoriy)',rec.lng==null?'':rec.lng,'type="number" min="-180" max="180" step="any"')+'</div>';
      html+=locationPickerHtml('tp');
      html+='<div class="dg-form-tip">TP/KTPni bu yerdan o‘chirib bo‘lmaydi. O‘chirish faqat Boshqaruv paneli orqali, U/J Masteri bilan amaldagi tasdiqlash tartibida bajariladi.</div>';
    } else if(type==='consumer'){
      html+=select('kind','Iste’molchi turi',`<option value="mahalla" ${rec.kind==='mahalla'?'selected':''}>Mahalla</option><option value="organization" ${rec.kind==='organization'?'selected':''}>Tashkilot</option>`);
      html+=field('name','Mahalla / tashkilot nomi',rec.name,'required maxlength="180"');
      html+=select('tpId','Qaysi TP/KTP orqali ta’minlanadi?',options(data.tps,rec.tpId));
      html+=field('note','Izoh (ixtiyoriy)',rec.note,'maxlength="260"');
      html+='<div class="dg-two">'+field('lat','Joylashuv markazi: GPS kenglik',rec.lat==null?'':rec.lat,'type="number" min="-90" max="90" step="any"')+field('lng','Joylashuv markazi: GPS uzunlik',rec.lng==null?'':rec.lng,'type="number" min="-180" max="180" step="any"')+'</div>';
      html+=locationPickerHtml('consumer');
      html+='<div class="dg-form-tip">Iste’molchi bir nechta TPdan ta’minlansa, oddiy bitta bog‘lanish asosidagi ta’sir hisobi yetarli emas. Bunday murakkab ulanish uchun alohida model kerak.</div>';
    }
    el('dg-editor-form').innerHTML=html+`<div class="dg-editor-actions">${id&&type!=='tp'?`<button type="button" class="dg-delete" data-del="${esc(type)}" data-id="${esc(id)}">O‘chirish</button>`:''}<button type="button" data-action="cancel-editor">Bekor qilish</button><button type="submit" class="dg-save">Saqlash</button></div>`;
    el('dg-editor').hidden=false;
    updateFolderVisibility();
    if(['station','tap','tap-point','tower','tp','consumer'].includes(type))initLocationPicker(type);
    if(type==='tp')prepareExistingTPs();
  }
  function onSave(ev){
    ev.preventDefault();if(!canEdit())return;
    if(!cloudReady&&!cloudReadError)return showMsg('Firebase tekshirilmoqda. Sxema yuklanishini kutib, qayta saqlang.','error');
    if(cloudBlocked)return showMsg('Firebase’da boshqa tahrir bor. Xavfsizlik uchun yozish to‘xtatilgan; mas’ulga murojaat qiling.','error');
    const f=new FormData(ev.currentTarget),v=n=>String(f.get(n)||'').trim();
    const type=editorType,id=editorId||uid(),rec={id};
    let collection;
    if(type==='station'){
      rec.kind=v('kind');rec.name=v('name');rec.volts=[...new Set(v('volts').split(/[ ,;/]+/).map(Number).filter(n=>VOLTAGES.includes(n)))];
      if(!rec.volts.length) return showMsg('To‘g‘ri kuchlanish kiriting (220, 110, 35, 10 yoki 6).','error');
      const chosenFolder=selectedFolderFromForm(ev.currentTarget);rec.folderId=chosenFolder.id||station(id)?.folderId||'';rec.folder=chosenFolder.path||station(id)?.folder||'';rec.lat=v('lat')===''?null:num(v('lat'));rec.lng=v('lng')===''?null:num(v('lng'));
      if(!station(id)&&rec.folderId&&data.stations.some(x=>x.kind!=='tap'&&x.folderId===rec.folderId))return showMsg('Bu PS papkasi dispetcherlikda allaqachon mavjud. Shu PSni tahrirlang.','error');
      if((rec.lat==null)!==(rec.lng==null))return showMsg('Xarita uchun ikkala GPS koordinatasini kiriting.','error');
      if(rec.lat!=null&&!validGps(rec.lat,rec.lng))return showMsg('GPS kenglik −90…90, uzunlik −180…180 oralig‘ida bo‘lsin.','error');
      rec.x=clamp(num(v('x'),470),45,895);rec.y=clamp(num(v('y'),200),55,385);
      collection='stations';
      const prior=station(id);
      if(prior){if(prior.kind==='tap')return;rec.sourceOff=prior.sourceOff;
        if(prior.folderSourced){Object.assign(rec,{folderSourced:true,folderId:prior.folderId,folder:prior.folder,name:prior.name,volts:prior.volts,lat:prior.lat,lng:prior.lng});}
      }
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
      const oldLine=data.lines.find(x=>x.id===id);rec.earthA=oldLine?.earthA||'unknown';rec.earthB=oldLine?.earthB||'unknown';
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
      // Never silently close an unexpected loop or parallel two sources.
      // Joining a PS already energized by another component, or already in
      // the originating component, can make the entire modeled flow ambiguous.
      // Insert the new branch with its PS-side virtual QF OPEN in that case.
      const before=analyze();
      const sameComponent=before.byNode[origin.a]!=null && before.byNode[origin.a]===before.byNode[target.id];
      const anotherSupply=before.energized[target.id]===true && !sameComponent;
      const safeOpen=sameComponent||anotherSupply||target.kind==='source';
      const branch={id:uid(),name:'Otpayka '+target.name,voltage:num(origin.voltage),a:j.id,b:target.id,openA:false,openB:safeOpen,towers:[]};
      data.stations.push(j);data.lines.splice(index,1,first,second,branch);
      // Preserve virtual QF state at both outer terminals when the old
      // section is split. The new tap has no invented terminal breaker.
      const oldA=overrides[origin.id+':a'],oldB=overrides[origin.id+':b'];
      delete overrides[origin.id+':a'];delete overrides[origin.id+':b'];
      if(typeof oldA==='boolean')overrides[first.id+':a']=oldA;
      if(typeof oldB==='boolean')overrides[second.id+':b']=oldB;
      saveSwitchesLocal();saveLocal();closeEditor();refresh();showMsg(safeOpen?'Otpayka yaratildi. PS boshqa yo‘ldan ham bog‘langan: kutilmagan halqa / ikki manba hosil bo‘lmasligi uchun yangi tarmoqning PS tomonidagi VIRTUAL QF OCHIQ qoldi. PS kartasidan tekshiring.':'Otpayka yaratildi. Avvalgi ta’minot yo‘li saqlandi, yangi tarmoq ham yopiq virtual QF bilan ulandi.','info');return;
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
      Object.assign(rec,feeder(id)||{});rec.id=id;
      rec.name=v('name');rec.psId=v('psId');rec.voltage=num(v('voltage'));
      rec.folderId=selectedFolderFromForm(ev.currentTarget).id||feeder(id)?.folderId||'';
      const parentPS=station(rec.psId);      if(rec.folderId&&parentPS?.folderId&&!folderIncludes(rec.folderId,parentPS.folderId) && mainFolders()[rec.folderId]?.sourcePsFolderId!==parentPS.folderId)return showMsg('Boshqa hududdagi fider uchun «Guruhlar»da manba PSni biriktiring yoki mos PS tanlang.','error');
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
    if(type==='line'){delete overrides[id+':a'];delete overrides[id+':b'];}
    saveSwitchesLocal();saveLocal();closeEditor();refresh();showMsg('O‘zgarish lokal qabul qilindi. Firebase tasdig‘ini yuqoridagi holat satridan tekshiring.','info');
  }
  // Remove a junction only if its ORIGINAL trunk can be unambiguously restored.
  // Never guess between multiple branches: a wrong splice would falsify the grid.
  function tapDeletionPlan(id){
    const tap=station(id);
    if(!tap||tap.kind!=='tap')return {error:'Otpayka nuqtasi topilmadi.'};
    const links=data.lines.filter(l=>l.a===id||l.b===id);
    if(!links.length)return {tap,links,remove:[],merged:null};
    const approaches=links.filter(l=>l.b===id), departures=links.filter(l=>l.a===id);
    const choices=[];
    for(const a of approaches)for(const b of departures){
      if(a.id===b.id||a.name!==b.name||num(a.voltage)!==num(b.voltage)||a.a===b.b)continue;
      choices.push({a,b});
    }
    // The 3-link case is the standard v69 'split trunk + branch' layout. An
    // extra line or two plausible trunk pairs requires manual review.
    if(!((links.length===2||links.length===3) && choices.length===1))return {
      error:`Bu otpaykada ${links.length} ta ulanish bor. Magistral qaysi ikki liniyadan iboratligini xavfsiz aniqlab bo‘lmadi. Avval ortiqcha shoxobchalarni alohida tekshiring.`
    };
    const {a,b}=choices[0];
    const merged={...a,a:a.a,b:b.b,openA:a.openA,openB:b.openB,earthA:a.earthA,earthB:b.earthB,
      towers:[...arr(a.towers),...arr(b.towers)]};
    const branch=links.filter(l=>l!==a&&l!==b);
    return {tap,links,remove:links,merged,a,b,branch};
  }
  function removeEntity(type,id){
    if(type==='tp')return showMsg('TP/KTPni dispetcherlikdan o‘chirish taqiqlangan. Boshqaruv panelida U/J Masteri orqali tasdiqlash tartibidan foydalaning.','error');
    if(!cloudReady||cloudBlocked||cloudReadError)return showMsg('Firebase sinxronlash tayyor emas. Xavfsizlik uchun o‘chirish to‘xtatildi.','error');
    if(type==='tower'){
      const found=findTowerRef(id);if(!found)return showMsg('Tayanch topilmadi.','error');
      if(!confirm('Tayanch '+(found.tower.number||'raqamsiz')+'ni «'+found.line.name+'» liniyasidan o‘chirasizmi? Bu amal Firebase’ga saqlanadi.'))return;
      found.line.towers.splice(found.index,1);saveLocal();closeEditor();refresh();showMsg('Tayanch o‘chirildi. Firebase’ga yuborilmoqda.','info');return;
    }
    if(type==='tap-point'){
      const plan=tapDeletionPlan(id);if(plan.error)return showMsg(plan.error,'error');
      const prompt=plan.links.length===0?`«${plan.tap.name}» otpayka nuqtasini o‘chirasizmi?`:
        `«${plan.tap.name}» otpaykasini o‘chirasizmi?\n\nMagistralning 2 bo‘lagi qayta birlashtiriladi (${plan.a.name}).\n${plan.branch.length} ta shoxobcha liniyasi va unga tegishli tayanchlar sxemadan olib tashlanadi.\nBoshqa PS va fider papkalari saqlanadi.`;
      if(!confirm(prompt))return;
      if(plan.merged){
        const aOverride=overrides[plan.a.id+':a'], bOverride=overrides[plan.b.id+':b'];
        const first=data.lines.indexOf(plan.a);
        data.lines=data.lines.filter(l=>!plan.remove.includes(l));
        data.lines.splice(Math.max(0,Math.min(first,data.lines.length)),0,plan.merged);
        plan.remove.forEach(l=>{delete overrides[l.id+':a'];delete overrides[l.id+':b'];});
        if(typeof aOverride==='boolean')overrides[plan.merged.id+':a']=aOverride;
        if(typeof bOverride==='boolean')overrides[plan.merged.id+':b']=bOverride;
      }
      data.stations=data.stations.filter(x=>x.id!==id);
      saveSwitchesLocal(false);saveLocal();closeEditor();refresh();showMsg('Otpayka olib tashlandi; magistral bog‘lanishi tiklandi. Firebase’ga yuborilmoqda.','info');return;
    }
    if(type==='station'&&station(id)?.folderSourced)return showMsg('Bu PS «Guruhlar» papkasidan olingan. Uni shu yerdan o‘chirib bo‘lmaydi.','error');
    const deps={
      station:()=>data.lines.some(x=>x.a===id||x.b===id)||data.feeders.some(x=>x.psId===id),
      line:()=>false,
      feeder:()=>data.tps.some(x=>x.feederId===id),
      consumer:()=>false
    };
    if(deps[type]?.())return showMsg('Bu obyektga boshqa elementlar ulangan. Oldin ularni uzing yoki o‘chiring.','error');
    const group={station:'stations',line:'lines',feeder:'feeders',consumer:'consumers'}[type];
    if(!group)return;
    if(!confirm('Ushbu obyektni dispetcherlik sxemasidan o‘chirasizmi? O‘chirish Firebase’ga avtomatik yuboriladi.'))return;
    data[group]=data[group].filter(x=>x.id!==id);
    if(type==='line'){delete overrides[id+':a'];delete overrides[id+':b'];}
    saveSwitchesLocal(false);saveLocal();closeEditor();refresh();
  }
  function init(){if(initialized)return;initialized=true;mapStyle=readMapStyle();createShell();
    window.addEventListener('online',()=>{if(cloudWanted&&cloudDirty&&cloudReady&&!cloudBlocked)queueCloudSave();else if(cloudWanted&&!cloudReady)openCloudSession();});
    document.addEventListener('hetk-management-scope-changed',e=>{if(e?.detail?.reason==='folders'&&currentUser){syncFolderStations();feederPreviewModel=null;loadFeederPreview(true);}});
    document.addEventListener('hetk-scoped-data-changed',e=>{if(e?.detail?.type==='tps'&&currentUser){loadFeederPreview(true);}});
    document.addEventListener('hetk-auth-ready',e=>authChanged(e.detail&&e.detail.user));
    document.addEventListener('hetk-auth-user-updated',e=>authChanged(e.detail&&e.detail.user));
    document.addEventListener('hetk-auth-cleared',()=>authChanged(null));
    if(window.HETKAuth?.currentUser)authChanged(window.HETKAuth.currentUser);
    try{window.firebase?.auth?.().onAuthStateChanged?.(()=>{if(currentUser&&!cloudReady&&!cloudReadStarted)openCloudSession();});}catch(e){}
  }
  window.HETKDispatchGrid = {open:()=>open(),analyzeDraft:()=>data?analyze():null,version:'81-live-mnemo-readonly'};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
