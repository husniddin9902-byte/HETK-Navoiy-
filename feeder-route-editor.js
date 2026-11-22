/* HETK-Navoiy v74: 6/10 kV route editor. Coordinates, numbered poles, branches,
   TP links and cable points. No SCADA operations or real energized-state inference.
   Data is written ONLY inside the existing Folders/{feederId}/feederRoute6kv,
   subject to the existing Folders rules. They are never modified by this module. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const valid=(a,b)=>a!==''&&b!==''&&a!=null&&b!=null&&Number.isFinite(+a)&&Number.isFinite(+b)&&Math.abs(+a)<=90&&Math.abs(+b)<=180&&(Number(a)!==0||Number(b)!==0);
const newid=()=>('p'+Date.now().toString(36)+Math.random().toString(36).slice(2,9));
const MATERIALS={wood:'Yog‘och',concrete:'Temir-beton',mixed:'Yog‘och + temir-beton',steel:'Metall'};
const TYPES={single:'Yakka tayanch',anchor2:'Anker — 2 talik',anchor3:'Anker — 3 talik',anchor4:'Anker — 4 talik'};
const categories={pole:'Tayanch',turn:'Yo‘nalish / burilish',tp:'TP/KTP/GKTP',cable:'Kabel burilishi'};
const distance=(a,b)=>{
 const rad=Math.PI/180, da=(+b[0]-+a[0])*rad,db=(+b[1]-+a[1])*rad;
 const v=Math.sin(da/2)**2+Math.cos(+a[0]*rad)*Math.cos(+b[0]*rad)*Math.sin(db/2)**2;
 return 12742*Math.atan2(Math.sqrt(v),Math.sqrt(Math.max(0,1-v)));
};
function checkRoute(route,ps){
 const points=Array.isArray(route?.points)?route.points:[];
 const ids=new Map(), nums=new Set(),errors=[];
 if(points.length>3000)errors.push('Bir fiderda 3000 dan ortiq nuqta qabul qilinmaydi.');
 points.forEach((p,i)=>{
  if(!p||typeof p.id!=='string'||!p.id||ids.has(p.id))errors.push('Takrorlangan yoki bo‘sh tayanch ID: '+i);
  else ids.set(p.id,p);
  if(!valid(p?.lat,p?.lng))errors.push((p?.number||i)+': koordinata noto‘g‘ri');
  if(!String(p?.number||'').trim()||nums.has(String(p.number)))errors.push('Raqam bo‘sh/takrorlangan: '+(p?.number||i));
  else nums.add(String(p.number));
  if(!['pole','turn','tp','cable'].includes(p?.kind))errors.push('Nuqta turi noto‘g‘ri: '+i);
  if(!['overhead','cable'].includes(p?.mode))errors.push('Havo yoki kabel turini belgilang: '+i);
  if((p.kind==='pole'&&p.mode==='cable')||(p.kind==='cable'&&p.mode==='overhead'))errors.push(p.number+': kabelda tayanch, havo liniyada kabel burilishi bo‘lmaydi');
  if(p.kind==='tp'&&!p.tpId)errors.push(p.number+': TP/KTP obyektini tanlang');
  const between=Number(p.intermediateCount||0);
  if(!Number.isInteger(between)||between<0||between>10000)errors.push(p.number+': oraliq tayanchlar soni noto‘g‘ri');
 });
 points.forEach(p=>{
  if(p.parentId!=='ps'&&!ids.has(p.parentId))errors.push(p.number+': boshlanish nuqtasi topilmadi');
  let cur=p,seen=new Set();
  while(cur&&cur.parentId!=='ps'){
   if(seen.has(cur.id)){errors.push(p.number+': aylana/halqa topildi');break;}
   seen.add(cur.id);cur=ids.get(cur.parentId);
  }
 });
 if(!valid(ps?.lat,ps?.lng))errors.push('PS koordinatasi yo‘q');
 if(!Number.isFinite(+route?.allowance)||+route.allowance<0||+route.allowance>25)errors.push('Uzunlik qo‘shimcha foizi noto‘g‘ri');
 return [...new Set(errors)];
}
function graph(route,ps){
 const points=Array.isArray(route?.points)?route.points:[],ids=new Map(points.map(p=>[p.id,p]));
 const routes=[],errors=checkRoute(route,ps);let km=0,overheadKm=0,cableKm=0,count=0;
 if(errors.length)return {routes,errors,km:0,adjustedKm:0,overheadKm:0,cableKm:0,physicalSupportCount:0};
 for(const p of points){
  const from=p.parentId==='ps'?ps:ids.get(p.parentId);
  if(!from)continue;
  const path=[[+from.lat,+from.lng],[+p.lat,+p.lng]], length=distance(path[0],path[1]);
  km+=length; if(p.mode==='cable')cableKm+=length;else overheadKm+=length;
  count+=p.kind==='pole'?1:0;
  count+=p.mode==='overhead'?Number(p.intermediateCount||0):0;
  routes.push({path,kind:p.kind,mode:p.mode,point:p,length});
 }
 const allowance=Number(route?.allowance||0);
 return {routes,errors,km,adjustedKm:km*(1+allowance/100),overheadKm,cableKm,physicalSupportCount:count};
}
function autoNumber(points,parentId,branch){
 const values=new Set(points.map(p=>String(p.number)));
 let base=parentId==='ps'?'0':String(points.find(p=>p.id===parentId)?.number||'0');
 if(!branch){
  const m=base.match(/^(.*?)(\d+)$/),prefix=m?m[1]:'',n=m?+m[2]:0;
  let i=n+1;while(values.has(prefix+i))i++;
  return prefix+i;
 }
 const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
 for(const letter of letters){const str=base+'-'+letter+'1';if(!values.has(str))return str;}
 let n=27;while(values.has(base+'-S'+n))n++;return base+'-S'+n;
}
function poleSvg(material='concrete',anchor='single',size=24){
 const n=anchor==='anchor4'?4:anchor==='anchor3'?3:anchor==='anchor2'?2:1;
 const left=n===1?11:n===2?5:n===3?3:2;
 let elems='';for(let i=0;i<n;i++){
  const x=left+(i%3)*8,y=n===4&&i===3?15:8;
  if(material==='wood')elems+=`<circle cx="${x}" cy="${y}" r="3.3" stroke="#183d5f" fill="#fff" stroke-width="1.5"/>`;
  else if(material==='mixed')elems+=`<circle cx="${x}" cy="${y}" r="3.3" stroke="#183d5f" fill="#7aa3b8" stroke-width="1.5"/><path d="M${x-3} ${y}h6" stroke="#183d5f"/>`;
  else elems+=`<rect x="${x-3.4}" y="${y-3.4}" width="6.8" height="6.8" rx=".7" stroke="#183d5f" fill="${material==='steel'?'#9db2c0':'#fff'}" stroke-width="1.5"/>`;
 }
 return `<svg width="${size}" height="${size}" viewBox="0 0 26 26" aria-hidden="true">${elems}</svg>`;
}
function permissions(){try{return typeof hetkHasPermission==='function'&&hetkHasPermission('manageFolders');}catch(_){return false;}}
let opened=false,selectedStation='',selectedFeeder='',model=null,map=null,marker=null,preview=null,baseRev=0,draft=null,selectedId='',workingCoord=null,confirmed=true;
let htmlMade=false;
function currentModel(){return window.HETKPSFeederMap?.buildModel(window.currentFolders||{},window.HETKManagementRouteContext?.getPoints?.()||{}, {canSeeFolder:(id)=>typeof hetkCanSeeFolder==='function'?hetkCanSeeFolder(id):true, pointAllowed:(tp)=>typeof hetkPointAllowedByUser==='function'?hetkPointAllowedByUser(tp):true}) || null;}
function folderModel(){const active=window.HETKPSFeederMap?.getLatestModel?.();if(active)return active;const F=typeof currentFolders==='object'?currentFolders:{}; const snap=window.HETKPSFeederMap?.getPoints?.()||{};return window.HETKPSFeederMap?.buildModel(F,snap,{canSeeFolder:typeof hetkCanSeeFolder==='function'?hetkCanSeeFolder:undefined,pointAllowed:typeof hetkPointAllowedByUser==='function'?hetkPointAllowedByUser:undefined});}
function buildUI(){
 if(htmlMade)return;htmlMade=true;
 const button=$('hetk-feeder-route-open');if(button&&!button.dataset.bound){button.dataset.bound='1';button.addEventListener('click',()=>open());}
 const wrap=document.createElement('div');wrap.id='hetk-route-overlay';wrap.className='hetk-route-overlay';wrap.hidden=true;
 wrap.innerHTML=`<section class="hetk-route-window" role="dialog" aria-modal="true" aria-labelledby="hetk-route-title">
 <header class="hetk-route-head"><div><small>HETK-NAVOIY · 6/10 kV TAXMINIY GIS YO‘NALISH</small><h2 id="hetk-route-title">Fider va tayanchlarni kiritish</h2></div><button type="button" id="hetk-route-close" title="Yopish">×</button></header>
 <div class="hetk-route-choose"><label>PS<select id="hetk-route-ps"></select></label><label>Fider<select id="hetk-route-feeder"></select></label><label>Uzunlik qo‘shimchasi (%)<select id="hetk-route-extra"><option value="3">3%</option><option value="4" selected>4%</option><option value="5">5%</option></select></label></div>
 <div class="hetk-route-body"><div class="hetk-route-map-wrap"><div id="hetk-route-map"></div><div class="hetk-route-note">📍 Xaritadan tayanch/burilish joyini bosing. TP tanlansa uning koordinatasi olinadi. Xaritadagi chiziqlar faqat tasdiqlangan nuqtalar orasidan o‘tadi.</div></div>
 <div class="hetk-route-side"><div id="hetk-route-summary" class="hetk-route-summary"></div><div id="hetk-route-warning" class="hetk-route-warning" hidden></div>
 <div class="hetk-route-tabs"><button type="button" id="hetk-route-add" class="on">+ Nuqta qo‘shish</button><button type="button" id="hetk-route-list-tab">Ro‘yxat / tahrir</button></div>
 <div id="hetk-route-form" class="hetk-route-form">
 <label>Qayerdan davom etadi?<select id="hetk-route-parent"></select></label>
 <div class="hetk-route-grid"><label>Yo‘nalish<select id="hetk-route-branch"><option value="main">Davomi</option><option value="branch">Yangi shoxobcha</option></select></label><label>Tayanch / nuqta raqami<input id="hetk-route-num" maxlength="32" autocomplete="off"/></label></div>
 <div class="hetk-route-grid"><label>Uchastka turi<select id="hetk-route-mode"><option value="overhead">Havo liniyasi</option><option value="cable">Yer osti kabeli</option></select></label><label>Belgilanadigan nuqta<select id="hetk-route-kind"><option value="pole">Tayanch</option><option value="turn">Burilish / otpayka</option><option value="tp">TP/KTP/GKTPga ulash</option></select></label></div>
 <div id="hetk-route-pole-fields"><div class="hetk-route-grid"><label>Tayanch materiali<select id="hetk-route-material">${Object.entries(MATERIALS).map(([id,v])=>`<option value="${id}">${esc(v)}</option>`).join('')}</select></label><label>Tayanch shakli<select id="hetk-route-anchor">${Object.entries(TYPES).map(([id,v])=>`<option value="${id}">${esc(v)}</option>`).join('')}</select></label></div></div>
 <label id="hetk-route-between-wrap">Shu yo‘nalishdagi oraliq tayanchlar soni (GPSsiz)<input id="hetk-route-between" type="number" value="0" min="0" max="10000"/></label>
 <div id="hetk-route-tp-wrap" hidden><label>Fiderga tegishli TP/KTP/GKTP<select id="hetk-route-tp"></select></label></div>
 <div class="hetk-route-grid"><label>Kenglik<input id="hetk-route-lat" inputmode="decimal" placeholder="Xaritada bosing"/></label><label>Uzunlik<input id="hetk-route-lng" inputmode="decimal" placeholder="Xaritada bosing"/></label></div>
 <label class="hetk-route-share">Bitta tayanchda boshqa fider ham bormi? <select id="hetk-route-share"><option value="">Yo‘q / aniqlanmagan</option></select></label><small class="hetk-route-help">Bir tayanchdan ikki fider o‘tishi mumkin. Bitta tayanch bo‘lsa ham ular elektr jihatdan avtomatik ulanmaydi. Kesishgan chiziqlar ham ulanmagan deb olinadi.</small>
 <div class="hetk-route-actions"><button type="button" id="hetk-route-reset" class="neutral">Yangisi</button><button type="button" id="hetk-route-addpoint" class="primary">+ Nuqtani qo‘shish</button><button type="button" id="hetk-route-delete" class="danger" hidden>O‘chirish</button></div>
 </div><div id="hetk-route-point-list" class="hetk-route-points" hidden></div></div></div>
 <footer class="hetk-route-foot"><span id="hetk-route-save-state">Yangi kiritilgan nuqtalar «Saqlash» bosilmaguncha Firebase’ga yozilmaydi.</span><div><button type="button" id="hetk-route-cancel">Bekor qilish</button><button type="button" class="primary" id="hetk-route-save">☁ Saqlash</button></div></footer>
 </section>`;
 document.body.appendChild(wrap);
 const on=(id,ev,cb)=>$(id).addEventListener(ev,cb);
 on('hetk-route-close','click',close);on('hetk-route-cancel','click',close);
 on('hetk-route-ps','change',()=>fillFeederSelect());on('hetk-route-feeder','change',()=>selectFeeder());
 on('hetk-route-mode','change',updateFormTypes);on('hetk-route-kind','change',updateFormTypes);
 on('hetk-route-parent','change',suggestNum);on('hetk-route-branch','change',suggestNum);on('hetk-route-num','input',autoBetweenCount);
 on('hetk-route-extra','change',()=>{if(!draft)return;draft.allowance=+$('hetk-route-extra').value;dirty();updateSummary();});
 on('hetk-route-tp','change',()=>{let tp=chosenFeeder()?.tps.find(p=>p.id===$('hetk-route-tp').value);if(tp){setCoord(tp.lat,tp.lng);map?.setView([+tp.lat,+tp.lng],16);}});
 on('hetk-route-share','change',()=>{const choice=$('hetk-route-share').value;if(!choice)return;const [fid,id]=choice.split('::');const f=[...(model?.stations?.values()||[])].flatMap(s=>s.feeders||[]).find(x=>x.id===fid);const other=f?.route?.points?.find(p=>p.id===id);if(other){setCoord(other.lat,other.lng);map?.setView([+other.lat,+other.lng],17);}});
 on('hetk-route-addpoint','click',commitPoint);on('hetk-route-delete','click',deleteSelected);on('hetk-route-reset','click',resetForm);on('hetk-route-save','click',save);
 on('hetk-route-add','click',()=>switchTab('form'));on('hetk-route-list-tab','click',()=>switchTab('list'));
 wrap.addEventListener('mousedown',e=>{if(e.target===wrap)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.stopImmediatePropagation();close();}},true);
}
function currentStation(){return model?.stations?.get(selectedStation);}
function chosenFeeder(){return currentStation()?.feeders?.find(f=>f.id===selectedFeeder);}
function stationOptions(){
 model=folderModel();const stations=[...(model?.stations?.values()||[])].filter(s=>s.located&&s.feeders.length);
 $('hetk-route-ps').innerHTML=stations.length?stations.map(s=>`<option value="${esc(s.id)}">${esc(s.path)}</option>`).join(''):'<option value="">GPSli PS papkasi va fider topilmadi</option>';
 return stations;
}
function fillFeederSelect(fid){
 selectedStation=$('hetk-route-ps').value;
 const fs=currentStation()?.feeders||[];
 $('hetk-route-feeder').innerHTML=fs.map(f=>`<option value="${esc(f.id)}">${esc(f.name)} · ${f.kv} kV</option>`).join('');
 if(fid&&fs.some(f=>f.id===fid))$('hetk-route-feeder').value=fid;
 selectFeeder();
}
function selectFeeder(){
 selectedFeeder=$('hetk-route-feeder').value;const folder=typeof currentFolders==='object'?currentFolders[selectedFeeder]:{};
 const stored=folder?.feederRoute6kv;
 draft={version:1,revision:stored?.revision||0,allowance:[3,4,5].includes(+stored?.allowance)?+stored.allowance:4,
 points:Array.isArray(stored?.points)?JSON.parse(JSON.stringify(stored.points)):[]};
 baseRev=draft.revision;confirmed=true;selectedId='';$('hetk-route-extra').value=String(draft.allowance);
 $('hetk-route-warning').hidden=true;
 $('hetk-route-save-state').textContent='Saqlangan nuqtalar bazadan yuklandi. Tahrirdan keyin «Saqlash»ni bosing.';
 fillTpSelect();fillShared();resetForm();if(map&&currentStation()?.located)map.setView([currentStation().lat,currentStation().lng],15);redraw();updateSummary();renderList();
}
function fillTpSelect(){const f=chosenFeeder();$('hetk-route-tp').innerHTML=(f?.tps||[]).length?
 f.tps.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''):'<option value="">Ushbu fiderda GPSli TP/KTP topilmadi</option>';
}
function fillShared(){
 const opts=['<option value="">Yo‘q / aniqlanmagan</option>'];
 for(const station of model?.stations?.values()||[]){
  for(const f of station.feeders||[]){if(f.id===selectedFeeder)continue;
   for(const p of f.route?.points||[]){if(p.kind!=='pole')continue;
    opts.push(`<option value="${esc(f.id+'::'+p.id)}">${esc(station.name)} / ${esc(f.name)} · ${esc(p.number)}</option>`);
   }
  }
 }$('hetk-route-share').innerHTML=opts.join('');
}
function fillParents(){
 $('hetk-route-parent').innerHTML='<option value="ps">PS · fider chiqishi</option>'+draft.points.map(p=>`<option value="${esc(p.id)}">${esc(p.number)} · ${esc(categories[p.kind]||'Nuqta')}</option>`).join('');
}
function suggestNum(){if(selectedId)return;const n=autoNumber(draft?.points||[],$('hetk-route-parent').value,$('hetk-route-branch').value==='branch');$('hetk-route-num').value=n;}
// For a straight run, entering only the LAST numbered support can infer how many
// unlocated supports lie between two numbered points (user may override freely).
function autoBetweenCount(){
 if($('hetk-route-mode').value==='cable')return;
 const parentId=$('hetk-route-parent').value;const prev=parentId==='ps'?'0':String(draft?.points.find(x=>x.id===parentId)?.number||'');
 const next=$('hetk-route-num').value.trim();
 const a=prev.match(/^(.*?)(\d+)$/),b=next.match(/^(.*?)(\d+)$/);
 if(a&&b&&a[1]===b[1]&&+b[2]>+a[2])$('hetk-route-between').value=String(Math.max(0,+b[2]-+a[2]-1));
}
function resetForm(){
 selectedId='';fillParents();$('hetk-route-parent').value=draft?.points?.length?draft.points[draft.points.length-1].id:'ps';
 $('hetk-route-kind').value='pole';$('hetk-route-mode').value='overhead';$('hetk-route-branch').value='main';$('hetk-route-material').value='concrete';$('hetk-route-anchor').value='single';$('hetk-route-between').value='0';
 $('hetk-route-share').value='';$('hetk-route-lat').value='';$('hetk-route-lng').value='';$('hetk-route-delete').hidden=true;$('hetk-route-addpoint').textContent='+ Nuqtani qo‘shish';
 suggestNum();updateFormTypes();switchTab('form');
}
function updateFormTypes(){
 const cable=$('hetk-route-mode').value==='cable',kind=$('hetk-route-kind');
 if(cable&&kind.value==='pole')kind.value='cable';if(!cable&&kind.value==='cable')kind.value='pole';
 // Do not automatically change TP, which may terminate an overhead or cable section.
 [...kind.options].forEach(o=>{o.disabled=cable?o.value==='pole':o.value==='cable';});
 $('hetk-route-pole-fields').hidden=cable||kind.value!=='pole';$('hetk-route-between-wrap').hidden=cable;$('hetk-route-tp-wrap').hidden=kind.value!=='tp';
}
function setCoord(lat,lng){$('hetk-route-lat').value=(+lat).toFixed(6);$('hetk-route-lng').value=(+lng).toFixed(6);workingCoord=[+lat,+lng];if(marker){marker.setLatLng(workingCoord)}else if(map)marker=L.marker(workingCoord,{draggable:true}).addTo(map);if(marker&&!marker._hetkDrag){marker.on('dragend',()=>{const v=marker.getLatLng();setCoord(v.lat,v.lng)});marker._hetkDrag=true;}}
function open(psId,feederId,pointId){
 buildUI();const stations=stationOptions();if(!stations.length){alert('Avval PS papkasiga koordinata kiriting va fider papkalarini tekshiring.');return;}
 if(psId&&stations.some(s=>s.id===psId))$('hetk-route-ps').value=psId;
 const wrap=$('hetk-route-overlay');wrap.hidden=false;opened=true;
 fillFeederSelect(feederId);setTimeout(()=>{ensureMap();redraw();if(pointId)editPoint(pointId);},70);
}
function close(){if(!opened)return;if(confirmed||!draft?.points?.length||window.confirm('Saqlanmagan tahrirlar bo‘lishi mumkin. Chiqasizmi?')){$('hetk-route-overlay').hidden=true;opened=false; if(map){map.remove();map=null;marker=null;preview=null;}}}
function ensureMap(){
 if(map||!window.L)return;
 map=L.map('hetk-route-map',{zoomControl:true}).setView([currentStation()?.lat||40.1,currentStation()?.lng||65.8],15);
 L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:20,maxNativeZoom:18,attribution:'Tiles © Esri'}).addTo(map);
 preview=L.layerGroup().addTo(map);map.on('click',e=>setCoord(e.latlng.lat,e.latlng.lng));
}
function redraw(){
 if(!map)return;
 preview.clearLayers();if(marker){map.removeLayer(marker);marker=null;}
 const s=currentStation();if(!s)return;
 const base=[s.lat,s.lng];L.circleMarker(base,{radius:12,color:'#fff',weight:3,fillColor:'#0a6ebe',fillOpacity:1}).bindTooltip(s.name).addTo(preview);
 const g=graph(draft,s),kv=chosenFeeder()?.kv||10,main=kv===6?'#a376f3':'#f2a234';
 for(const l of g.routes){
  const color=l.mode==='cable'?'#d966e0':main;
  const poly=L.polyline(l.path,{color,weight:4,dashArray:l.mode==='cable'?'5 8':null,opacity:.95}).addTo(preview);
  poly.bindTooltip(esc(l.point.number)+' · '+esc(categories[l.point.kind])+' · '+l.length.toFixed(3)+' km');
  const icon=L.divIcon({className:'hetk-route-node-icon',html:`<span class="hetk-route-node ${l.point.mode==='cable'?'cable':''}" title="${esc(l.point.number)}">${l.point.kind==='pole'?poleSvg(l.point.material,l.point.anchor):l.point.kind==='tp'?'⚡':'◆'}</span>`,iconSize:[30,30],iconAnchor:[15,15]});
  const pt=L.marker([+l.point.lat,+l.point.lng],{icon}).addTo(preview);
  pt.bindTooltip(esc(l.point.number),{direction:'top'}).on('click',e=>{if(e.originalEvent)L.DomEvent.stopPropagation(e);editPoint(l.point.id);});
 }
 updateSummary();
}
function updateSummary(){
 const station=currentStation(),f=chosenFeeder();if(!station||!f)return;
 const g=graph(draft,station),estimated=draft?.points?.length>0;
 $('hetk-route-summary').innerHTML=`<strong>${esc(f.name)} · ${f.kv} kV</strong><small>${esc(station.name)}</small><div class="hetk-route-metrics"><span>Nuqta: <b>${draft.points.length}</b></span><span>Oraliq tayanchlar: <b>${g.physicalSupportCount}</b></span><span>Chizilgan: <b>${g.km.toFixed(3)} km</b></span><span>Zaxira +${draft.allowance}%: <b>${g.adjustedKm.toFixed(3)} km</b></span></div><small>${estimated?'Tayanch nuqtalari va burilishlar bo‘yicha hisob. O‘lchov taxminiy.':'Hali tayanch kiritilmagan; dastlabki taxminiy chiziq asosiy xaritada ko‘rinishi mumkin.'} Kabel: ${g.cableKm.toFixed(3)} km · Havo: ${g.overheadKm.toFixed(3)} km</small>`;
 if(g.errors.length){$('hetk-route-warning').hidden=false;$('hetk-route-warning').textContent=g.errors.join(' | ');}else $('hetk-route-warning').hidden=true;
}
function dirty(){confirmed=false;$('hetk-route-save-state').textContent='O‘zgarishlar hali Firebase’ga saqlanmadi. «☁ Saqlash»ni bosing.';}
function commitPoint(){
 if(!draft||!chosenFeeder())return;
 const fields={parentId:$('hetk-route-parent').value,number:$('hetk-route-num').value.trim(),kind:$('hetk-route-kind').value,mode:$('hetk-route-mode').value,
 lat:Number(String($('hetk-route-lat').value).replace(',','.')),lng:Number(String($('hetk-route-lng').value).replace(',','.')),
 material:$('hetk-route-material').value,anchor:$('hetk-route-anchor').value,intermediateCount:Math.round(+$('hetk-route-between').value||0),
 tpId:$('hetk-route-kind').value==='tp'?$('hetk-route-tp').value:'',sharedWith:null};
 if(!valid($('hetk-route-lat').value,$('hetk-route-lng').value)){alert('Nuqtani xaritada belgilang yoki koordinatani to‘liq kiriting.');return;}
 if(!fields.number){alert('Tayanch raqamini kiriting.');return;}
 if(fields.kind==='tp'){const tp=chosenFeeder().tps.find(x=>x.id===fields.tpId);if(!tp){alert('Shu fiderdagi TP/KTPni tanlang.');return;}fields.lat=tp.lat;fields.lng=tp.lng;}
 if(fields.mode==='cable'){fields.intermediateCount=0;fields.material='';fields.anchor='';}
 if(fields.mode==='cable'&&fields.kind==='pole')fields.kind='cable';
 if(fields.mode==='overhead'&&fields.kind==='cable')fields.kind='pole';
 if(fields.intermediateCount<0||fields.intermediateCount>10000){alert('Oraliq tayanchlar sonini to‘g‘rilang.');return;}
 if($('hetk-route-share').value){const [fid,pid]=$('hetk-route-share').value.split('::');fields.sharedWith={feederId:fid,pointId:pid};}
 const p={id:selectedId||newid(),...fields};
 const copy=draft.points.map(x=>({...x}));if(selectedId){const i=copy.findIndex(x=>x.id===selectedId);if(i<0)return;copy[i]=p;}else copy.push(p);
 const test={...draft,points:copy},errors=checkRoute(test,currentStation());
 if(errors.length){alert('Nuqtani qo‘shib bo‘lmadi:\n'+errors.slice(0,5).join('\n'));return;}
 draft.points=copy;dirty();renderList();redraw();resetForm();
}
function editPoint(id){
 const p=draft?.points?.find(x=>x.id===id);if(!p)return;
 selectedId=id;fillParents();
 // Can't choose itself as parent or a descendant (reject cycles before saving as well).
 const descendants=new Set([id]);let changed=true;while(changed){changed=false;for(const node of draft.points)if(descendants.has(node.parentId)&&!descendants.has(node.id)){descendants.add(node.id);changed=true;}}
 [...$('hetk-route-parent').options].forEach(opt=>{if(descendants.has(opt.value))opt.disabled=true;});
 $('hetk-route-parent').value=p.parentId;$('hetk-route-num').value=p.number;$('hetk-route-kind').value=p.kind;$('hetk-route-mode').value=p.mode;
 $('hetk-route-material').value=p.material||'concrete';$('hetk-route-anchor').value=p.anchor||'single';$('hetk-route-between').value=String(p.intermediateCount||0);
 $('hetk-route-tp').value=p.tpId||$('hetk-route-tp').value;
 $('hetk-route-share').value=p.sharedWith?p.sharedWith.feederId+'::'+p.sharedWith.pointId:'';
 $('hetk-route-delete').hidden=false;$('hetk-route-addpoint').textContent='✓ O‘zgarishni qo‘shish';updateFormTypes();switchTab('form');
 setCoord(p.lat,p.lng);map?.panTo([+p.lat,+p.lng]);
}
function deleteSelected(){
 if(!selectedId)return;const desc=new Set([selectedId]);let changed=true;while(changed){changed=false;for(const p of draft.points)if(desc.has(p.parentId)&&!desc.has(p.id)){desc.add(p.id);changed=true;}}
 const msg=desc.size>1?`Bu nuqta va unga bog‘langan ${desc.size-1} ta quyi nuqta ham o‘chiriladi. Davom etasizmi?`:'Tanlangan nuqtani o‘chirasizmi?';
 if(!window.confirm(msg))return;draft.points=draft.points.filter(p=>!desc.has(p.id));dirty();renderList();redraw();resetForm();
}
function switchTab(tab){$('hetk-route-form').hidden=tab!=='form';$('hetk-route-point-list').hidden=tab!=='list';$('hetk-route-add').classList.toggle('on',tab==='form');$('hetk-route-list-tab').classList.toggle('on',tab==='list');}
function renderList(){
 $('hetk-route-point-list').innerHTML=draft?.points?.length?draft.points.map((p,i)=>`<button type="button" class="hetk-route-point" data-point="${esc(p.id)}"><b>${esc(p.number)}</b><span>${esc(categories[p.kind]||'Nuqta')} · ${p.mode==='cable'?'Kabel':esc(MATERIALS[p.material]||'Havo')}</span><small>${p.sharedWith?'2 fiderga umumiy tayanch · ':''}${p.parentId==='ps'?'PS dan':esc(draft.points.find(x=>x.id===p.parentId)?.number||'Bog‘lanmagan')} → ${esc(p.number)}</small></button>`).join(''):'<p>Nuqta yo‘q. «+ Nuqta qo‘shish»dan boshlang.</p>';
 $('hetk-route-point-list').querySelectorAll('[data-point]').forEach(b=>b.addEventListener('click',()=>editPoint(b.dataset.point)));
}
async function save(){
 if(!draft||!selectedFeeder)return;
 if(!permissions()){alert('Sizda ushbu fider papkasini tahrirlash ruxsati yo‘q. Firebase qoidalari o‘zgartirilmagan.');return;}
 if(typeof hetkCanAccessFolder==='function'&&!hetkCanAccessFolder(selectedFeeder)){alert('Bu fiderga ruxsatingiz yo‘q.');return;}
 const errs=checkRoute(draft,currentStation());if(errs.length){alert(errs.join('\n'));return;}
 if(typeof database==='undefined'||!database?.ref){alert('Firebase mavjud emas; ma’lumot saqlanmadi.');return;}
 const button=$('hetk-route-save');button.disabled=true;$('hetk-route-save-state').textContent='Firebase’ga saqlanmoqda…';
 const uid=(typeof firebase!=='undefined'?firebase?.auth?.()?.currentUser?.uid:'')||'';
 const expected=baseRev, next={version:1,revision:expected+1,updatedAt:Date.now(),updatedBy:uid,allowance:draft.allowance,points:draft.points};
 try{
  const ref=database.ref('Folders/'+selectedFeeder+'/feederRoute6kv');
  const result=await ref.transaction(cur=>{if(Number(cur?.revision||0)!==expected)return;return next;},undefined,false);
  if(!result.committed){alert('Boshqa foydalanuvchi bu fider yo‘nalishini yangilagan. Eski nusxa yangi ma’lumotni bosib ketmasligi uchun saqlanmadi. Avval qayta oching.');$('hetk-route-save-state').textContent='Versiya to‘qnashuvi. Qayta yuklang.';return;}
  const folder=(typeof currentFolders==='object'&&currentFolders[selectedFeeder])||null;if(folder)folder.feederRoute6kv=next;
  draft.revision=expected+1;baseRev=expected+1;confirmed=true;
  $('hetk-route-save-state').textContent='✓ Firebase saqlandi · rev '+baseRev;
  if(window.HETKPSFeederMap?.refresh)window.HETKPSFeederMap.refresh();
  // Notify the separate dispatch mnemonic immediately; it otherwise waits
  // for its periodic scoped read and might display old pole geometry.
  document.dispatchEvent(new CustomEvent('hetk-feeder-route-changed',{detail:{feederId:selectedFeeder}}));
 }catch(err){$('hetk-route-save-state').textContent='Xatolik: '+(err?.message||'Firebase ruxsati mavjud emas');alert('Firebase saqlash muvaffaqiyatsiz: '+(err?.message||'ruxsat xatoligi'));}
 finally{button.disabled=false;}
}
window.HETKFeederRouteEditor={open,close,graph,checkRoute,autoNumber,distance,poleSvg};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',buildUI);else buildUI();
})();
