/* HETK-Navoiy v72 — existing Boshqaruv paneli xaritasi uchun PS + 6/10 kV taxminiy fider qatlami.
   No SCADA, no switch commands, no writes to TPs or DispatchGridSimulation.
   Only Folders/$id.lat/lng is written through the existing folder editor (manageFolders permission).
*/
(function(){
  'use strict';
  const STORAGE_KEY='hetk.psFeederMap.previewLines.v71';
  const feederRegex=/(?:fider|fedir|fid[eі]r|фидер)/iu;
  const routeDistance=(a,b)=>{const rad=Math.PI/180,dLat=(+b[0]-+a[0])*rad,dLon=(+b[1]-+a[1])*rad;const v=Math.sin(dLat/2)**2+Math.cos(+a[0]*rad)*Math.cos(+b[0]*rad)*Math.sin(dLon/2)**2;return 12742*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));};
  const pathDistance=path=>path.slice(1).reduce((s,p,i)=>s+routeDistance(path[i],p),0);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isFeeder=name=>feederRegex.test(String(name||''));
  // Explicit PS marker is used only for special legacy folder names.
  // Standard PS names and 35/6, 110/10, 110/35 etc. are detected in every region.
  const isPS=folderOrName=>{
    if(folderOrName&&typeof folderOrName==='object'&&folderOrName.psFolder===true)return true;
    const name=typeof folderOrName==='object'?folderOrName?.name:folderOrName;
    const clean=String(name||'').normalize('NFKC').trim()
      .replace(/^[^\p{L}\p{N}]+/u,'').trim();
    if(/^(?:PS|ПС)(?=$|[\s.\-–—_:\/'‘’ʼʻ`´"«»(])/iu.test(clean))return true;
    if(isFeeder(clean))return false;
    return /(?:^|[^\d])(?:500|220|110|35)\s*\/\s*(?:110|35|10|6)(?=\s|$|[’ʼʻ'"«»])/iu.test(clean);
  };
  const validGps=(lat,lng)=> lat!==null && lng!==null && lat!=='' && lng!=='' &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat))<=90 && Math.abs(Number(lng))<=180 &&
    (Number(lat)!==0 || Number(lng)!==0);
  function folderChildren(folders){
    const byParent={};
    Object.keys(folders||{}).forEach(id=>{const p=String(folders[id]?.parentId||'root');(byParent[p]||(byParent[p]=[])).push(id);});
    return byParent;
  }
  function folderHasAncestor(id,ancestorId,folders){
    if(ancestorId==='root')return true;
    const seen=new Set();let current=id;
    while(current && current!=='root' && folders[current] && !seen.has(current)){
      if(current===ancestorId)return true;
      seen.add(current);current=folders[current].parentId;
    }
    return current===ancestorId;
  }
  function nearestStation(id,folders){
    const seen=new Set();let cur=id;
    while(cur && cur!=='root' && folders[cur] && !seen.has(cur)){
      if(isPS(folders[cur]))return cur;
      seen.add(cur);cur=folders[cur].parentId;
    }
    return '';
  }
  function feederParent(id,stations,folders){
    const seen=new Set();let cur=id, child='';
    while(cur && cur!=='root' && folders[cur] && !seen.has(cur)){
      if(stations.has(cur))return child && isFeeder(folders[child]?.name) ? {station:cur,feeder:child}:null;
      seen.add(cur);child=cur;cur=folders[cur].parentId;
    }
    return null;
  }
  function voltageForFeeder(feederName,psName){
    const name=String(feederName||'').trim();
    if(/(?:^|\s|[-–])6\s*(?:k\s*v|кв)?\s*$/i.test(name)||/\b6\s*(?:k\s*v|кв)\b/i.test(name))return 6;
    if(/(?:^|\s|[-–])10\s*(?:k\s*v|кв)?\s*$/i.test(name)||/\b10\s*(?:k\s*v|кв)\b/i.test(name))return 10;
    // 35/6, 110/6 etc imply a 6 kV low-voltage bus; if both 10 and 6 exist,
    // the individual feeder must be annotated explicitly to override the default.
    const numeric=String(psName||'').match(/\d+(?:\s*\/\s*\d+)+/);
    if(numeric){const levels=numeric[0].split('/').map(x=>Number(x.trim()));if(levels.includes(6) && !levels.includes(10))return 6;}
    return 10;
  }
  function pointFolderIds(point){
    const folders=point?.folders||{};
    return [...new Set([point?.primaryFolderId,point?.folderId,...Object.keys(folders).filter(k=>folders[k]===true||folders[k]===1)].filter(Boolean))];
  }
  function getFolderPath(id,folders){
    let cur=id;const seen=new Set(),parts=[];
    while(cur && cur!=='root' && folders[cur] && !seen.has(cur)){
      seen.add(cur);parts.unshift(folders[cur].name||'Papka');cur=folders[cur].parentId;
    }
    return parts.join(' / ');
  }
  function distanceSquared(a,b){
    const x=(Number(a[1])-Number(b[1]))*Math.cos((Number(a[0])+Number(b[0]))*Math.PI/360);
    const y=Number(a[0])-Number(b[0]);return x*x+y*y;
  }
  // A conservative nearest-neighbor draft, NOT a verified geographical line trace or electrical topology.
  function provisionalRoute(psLatLng,locations){
    const unused=locations.slice(),path=[psLatLng];let here=psLatLng;
    while(unused.length){
      let best=0,bestScore=Infinity;
      unused.forEach((p,i)=>{const d=distanceSquared(here,p);if(d<bestScore){bestScore=d;best=i;}});
      const [next]=unused.splice(best,1);path.push(next);here=next;
    }
    return path;
  }
  // Pure model exposed for QA: inner PS folders are independent, never feeders.
  function buildModel(folders,points,opts={}){
    const canSee=opts.canSeeFolder||(()=>true);
    const pointAllowed=opts.pointAllowed||(()=>true);
    const selected=opts.selectedFolderId||'root';
    const stations=new Map();
    for(const [id,f] of Object.entries(folders||{})){
      if(!isPS(f)||!canSee(id))continue;
      const located=validGps(f.lat,f.lng);
      stations.set(id,{id,name:f.name,lat:located?Number(f.lat):null,lng:located?Number(f.lng):null,located,
        parentId:f.parentId||'root',feeders:[],path:getFolderPath(id,folders)});
    }
    // Only direct feeder children count; PS under PS remains its own station.
    const children=folderChildren(folders);
    for(const s of stations.values()){
      for(const fid of (children[s.id]||[])){
        if(!folders[fid]||isPS(folders[fid])||!isFeeder(folders[fid].name)||!canSee(fid))continue;
        s.feeders.push({id:fid,name:folders[fid].name,kv:voltageForFeeder(folders[fid].name,s.name),tps:[],route:folders[fid].feederRoute6kv||null});
      }
    }
    const feederLookup=new Map();
    for(const s of stations.values())for(const f of s.feeders)feederLookup.set(f.id,{station:s,feeder:f});
    let tpTotal=0;
    for(const [tpId,tp] of Object.entries(points||{})){
      if(!pointAllowed(tp)||!validGps(tp?.lat,tp?.lng))continue;
      const ids=pointFolderIds(tp);
      let candidate=null;
      // Prefer the primary folder, so dual assignment doesn't place the same TP on all feeders.
      for(const folderId of ids){
        const anc=feederParent(folderId,new Set(stations.keys()),folders);
        if(anc && feederLookup.has(anc.feeder)){
          candidate=feederLookup.get(anc.feeder);break;
        }
      }
      if(!candidate)continue;
      candidate.feeder.tps.push({id:tpId,name:tp.name||tp.address||'TP/KTP',lat:Number(tp.lat),lng:Number(tp.lng)});
      tpTotal++;
    }
    const visibleStations=[...stations.values()].filter(s=>
      folderHasAncestor(s.id,selected,folders)||folderHasAncestor(selected,s.id,folders)
    );
    const previewLines=[];
    for(const s of visibleStations){
      if(!s.located)continue;
      for(const f of s.feeders){
        if(selected!=='root' && !(folderHasAncestor(f.id,selected,folders)||folderHasAncestor(selected,f.id,folders)))continue;
        if(!f.tps.length&&!f.route?.points?.length)continue;
        // Keep all validated coordinates, preserve input; avoid artificial electrical branches.
        const path=provisionalRoute([s.lat,s.lng],f.tps.map(p=>[p.lat,p.lng]));
        previewLines.push({stationId:s.id,feederId:f.id,name:f.name,kv:f.kv,path,tpCount:f.tps.length,route:f.route});
      }
    }
    return {stations,visibleStations,previewLines,tpTotal};
  }
  let currentCtx=null,renderedMap=null,stationLayer=null,lineLayer=null,latestModel=null;
  let mapZoomListener=null;
  const lineToggle=()=>document.getElementById('hetk-ps-line-toggle');
  const status=()=>document.getElementById('hetk-ps-map-status');
  const warning=()=>document.getElementById('hetk-ps-map-disclaimer');
  function syncVisibility(){
    if(!renderedMap||!lineLayer)return;
    const checked=!!lineToggle()?.checked;
    if(checked && !renderedMap.hasLayer(lineLayer))renderedMap.addLayer(lineLayer);
    if(!checked && renderedMap.hasLayer(lineLayer))renderedMap.removeLayer(lineLayer);
    if(warning)warning().hidden=!(checked && latestModel?.previewLines?.length);
    if(status()&&latestModel){
      const available=latestModel.visibleStations.filter(s=>s.located).length;
      const missing=latestModel.visibleStations.length-available;
      const routes=latestModel.previewLines.length;
      status().textContent=`PS: ${available}${missing?' · GPSsiz: '+missing:''}${checked?' · taxminiy fider: '+routes:''}`;
    }
  }
  function popup(s){
    const feeders=s.feeders.length? s.feeders.map(f=>`<li><span>${esc(f.name)}</span><em>${f.kv} kV · ${f.tps.length} TP</em></li>`).join(''):'<li>Fider papkalari topilmadi</li>';
    return `<div class="hetk-ps-map-card"><strong>${esc(s.name)}</strong><small>📁 ${esc(s.path)}</small><div class="hetk-ps-map-card-stats"><span>📍 PS koordinatasi mavjud</span><span>⚡ ${s.feeders.length} fider</span></div><ul>${feeders}</ul><button type="button" class="hetk-ps-popup-route-open" data-ps-id="${esc(s.id)}">⚒ Fider tayanchlari / 6–10 kV yo‘nalish</button><p>6/10 kV chiziqlar — faqat ko‘rgazmali taxmin. Yo‘nalishni tayanch va burilishlar bilan aniqlashtirish mumkin. Haqiqiy kuchlanish tasdiqlanmagan.</p></div>`;
  }
  function updateTooltipVisibility(){
    if(!renderedMap||!stationLayer||!stationLayer.eachLayer)return;
    const full=renderedMap.getZoom?.()>=11;
    stationLayer.eachLayer(marker=>{
      if(full)marker.openTooltip?.();else marker.closeTooltip?.();
    });
  }
  function clear(){
    if(renderedMap){
      if(lineLayer && renderedMap.hasLayer?.(lineLayer))renderedMap.removeLayer(lineLayer);
      if(stationLayer && renderedMap.hasLayer?.(stationLayer))renderedMap.removeLayer(stationLayer);
      if(mapZoomListener)renderedMap.off?.('zoomend',mapZoomListener);
    }
    stationLayer=null;lineLayer=null;renderedMap=null;mapZoomListener=null;latestModel=null;currentCtx=null;
    if(warning)warning().hidden=true;
    if(status())status().textContent='PS nuqtalari yuklanmoqda';
  }
  function draw(){
    if(!currentCtx?.map||typeof L==='undefined')return [];
    const map=currentCtx.map;
    const folders=currentCtx.getFolders?.()||{};
    const selectedFolderId=currentCtx.getActiveFolderId?.()||'root';
    const model=buildModel(folders,currentCtx.points||{},
      {selectedFolderId,canSeeFolder:currentCtx.canSeeFolder,pointAllowed:currentCtx.pointAllowed});
    if(renderedMap){
      if(lineLayer && renderedMap.hasLayer?.(lineLayer))renderedMap.removeLayer(lineLayer);
      if(stationLayer && renderedMap.hasLayer?.(stationLayer))renderedMap.removeLayer(stationLayer);
      if(mapZoomListener)renderedMap.off?.('zoomend',mapZoomListener);
    }
    renderedMap=map;latestModel=model;
    lineLayer=L.layerGroup();stationLayer=L.layerGroup().addTo(map);
    const bounds=[];
    for(const s of model.visibleStations){
      if(!s.located)continue;
      bounds.push([s.lat,s.lng]);
      const icon=L.divIcon({className:'hetk-ps-dot-icon',
        html:'<span class="hetk-ps-map-dot" title="PS: '+esc(s.name)+'"></span>',iconSize:[26,26],iconAnchor:[13,13],popupAnchor:[0,-13]});
      const marker=L.marker([s.lat,s.lng],{icon,zIndexOffset:1000}).addTo(stationLayer);
      marker.bindTooltip(esc(s.name),{permanent:true,direction:'right',offset:[14,0],className:'hetk-ps-map-label',opacity:1});
      marker.bindPopup(popup(s),{className:'hetk-ps-map-popup',maxWidth:380});
    }
    for(const l of model.previewLines){
      const c=l.kv===6?'#ae7cf4':'#f4af49';
      const ps=model.stations.get(l.stationId), routed= l.route?.points?.length &&
        window.HETKFeederRouteEditor?.graph?.(l.route,ps);
      const segments=routed&&!routed.errors.length&&routed.routes.length?routed.routes:[{path:l.path,mode:'draft'}];
      const km=routed&&!routed.errors.length?routed.adjustedKm:pathDistance(l.path)*1.04;
      for(const seg of segments){
        const sc=seg.mode==='cable'?'#d966e0':c;
        const poly=L.polyline(seg.path,{color:sc,weight:seg.mode==='draft'?3:4,opacity:.93,
          dashArray:seg.mode==='cable'?'4 8':seg.mode==='draft'?'8 6':null,
          interactive:true,className:'hetk-feeder-draft-path'})
          .bindTooltip(esc(l.name)+' · '+l.kv+' kV · '+(routed&&!routed.errors.length?'KIRITILGAN BO‘LAK · TAXMINIY':'GPS TAXMINIY')+' · ≈'+km.toFixed(3)+' km',{sticky:true})
          .addTo(lineLayer);
        poly.on?.('click',()=>window.HETKFeederRouteEditor?.open(l.stationId,l.feederId));
        L.polyline(seg.path,{color:'#fff',weight:2,opacity:.95,dashArray:'2 17',
          interactive:false,className:'hetk-feeder-flow-path'}).addTo(lineLayer);
        if(seg.point?.kind==='pole'||seg.point?.kind==='cable'||seg.point?.kind==='turn'){
          const n=seg.point;
          const svg=window.HETKFeederRouteEditor?.poleSvg?.(n.material,n.anchor,24) || '⬢';
          const marker=L.marker([+n.lat,+n.lng],{icon:L.divIcon({className:'hetk-feeder-support-icon',
            html:`<span class="hetk-feeder-support ${seg.mode==='cable'?'cable':''}" title="${esc(n.number)}">${n.kind==='pole'?svg:'◆'}</span>`,iconSize:[24,24],iconAnchor:[12,12]}),zIndexOffset:200}).addTo(lineLayer);
          marker.bindTooltip(esc(n.number)+(n.sharedWith?' · 2 fiderga umumiy tayanch':''),{direction:'top'});
          marker.on?.('click',()=>window.HETKFeederRouteEditor?.open(l.stationId,l.feederId,n.id));
        }
      }
    }
    stationLayer.eachLayer?.(marker=>{
      marker.on?.('popupopen',()=>{
        const root=marker.getPopup?.()?.getElement?.();
        const btn=root?.querySelector?.('.hetk-ps-popup-route-open');
        if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',()=>window.HETKFeederRouteEditor?.open(btn.dataset.psId));}
      });
    });
    mapZoomListener=updateTooltipVisibility;
    map.on?.('zoomend',mapZoomListener);
    // Do not open labels on very far zoom; tooltip still available on hover.
    updateTooltipVisibility();
    syncVisibility();
    return bounds;
  }
  function render(ctx){
    if(!ctx?.map)return [];
    currentCtx=ctx;
    return draw();
  }
  const checkbox=lineToggle();
  if(checkbox){
    try{checkbox.checked=localStorage.getItem(STORAGE_KEY)==='1';}catch(_e){checkbox.checked=false;}
    checkbox.addEventListener('change',()=>{
      try{localStorage.setItem(STORAGE_KEY,checkbox.checked?'1':'0');}catch(_e){}
      syncVisibility();
    });
  }
  document.addEventListener('hetk-management-scope-changed',()=>{
    if(currentCtx?.map)draw();
  });
  document.addEventListener('hetk-auth-cleared',()=>clear());
  window.HETKPSFeederMap={render,clear,refresh:()=>currentCtx?draw():[],getLatestModel:()=>latestModel,getPoints:()=>currentCtx?.points||{},buildModel,isPS,voltageForFeeder,provisionalRoute};
})();
