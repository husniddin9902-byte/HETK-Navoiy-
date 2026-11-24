/* HETK-Navoiy v86 · PS inspector only. Existing map, diagrams and menus stay unchanged.
 * This view reads authorised HETK feeder/TP data. Operational measurements are
 * separate, user-entered records inside the existing revision-controlled model.
 * No SCADA/QF state, meter telemetry or PS status is inferred from a reading.
 */
(function(){
'use strict';
const E=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const N=v=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
const fmt=v=>v===null||v===undefined||v===''?'—':Number(v).toLocaleString('uz-UZ',{maximumFractionDigits:2});
const arr=a=>Array.isArray(a)?a:[];
const dateFmt=value=>{const d=new Date(value);return Number.isNaN(d.valueOf())?'—':d.toLocaleString('uz-UZ',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});};
const shortDate=value=>{const d=new Date(value);return Number.isNaN(d.valueOf())?'—':d.toLocaleDateString('uz-UZ');};
const safeDate=v=>{const t=new Date(v);return Number.isNaN(t.getTime())?'':t.toISOString();};
const textCompare=(a,b)=>String(a||'').localeCompare(String(b||''),'uz',{numeric:true});
const tag=(s,cls='')=>`<span class="dg-p85-tag ${cls}">${E(s)}</span>`;
const tinyIcon=(kind)=>({transformer:'⚡',feeder:'↳',ps:'▣'})[kind]||'◉';
const nowLocal=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
const todayYear=()=>new Date().getFullYear();
const state={box:null,ctx:null,psId:'',tab:'overview',openFeeder:'',search:'',editingTransformer:'',measurementTarget:null,year:todayYear(),historyFilter:'all'};
function opsKey(ps){return String(ps.folderId||ps.id);}
function storedOps(create=false){
 const d=state.ctx?.data,ps=state.ctx?.ps;if(!d||!ps)return {};
 const key=opsKey(ps);
 if(create){if(!d.psOperations||typeof d.psOperations!=='object'||Array.isArray(d.psOperations))d.psOperations={};
  if(!d.psOperations[key])d.psOperations[key]={transformers:[],assignments:{},measurements:[]};
 }
 const o=d.psOperations?.[key];return o&&typeof o==='object'?o:{};
}
function opsTransformers(o){return arr(o?.transformers).filter(t=>t&&/^[A-Za-z\d_-]{1,12}$/.test(String(t.id||'')));}
function opsMeasurements(o){return arr(o?.measurements).filter(m=>m&&m.id&&safeDate(m.at));}
function measuredAt(o,kind,id){return opsMeasurements(o).filter(m=>m.kind===kind&&String(m.targetId)===String(id)).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));}
function lastMeasurement(o,kind,id){return measuredAt(o,kind,id)[0]||null;}
function pointFolderIds(tp){return [...new Set([tp?.primaryFolderId,tp?.folderId,...Object.entries(tp?.folders||{}).filter(([,v])=>v===true||v===1).map(([id])=>id)].filter(Boolean).map(String))];}
// Main HETK Folders is authoritative for PS -> feeder/line -> TP nesting.
// The GIS preview is optional: loading TPs/GPS must not hide existing feeder folders.
function isPsFolder(folder){
 if(!folder)return false;
 if(window.HETKPSFeederMap?.isPS)return window.HETKPSFeederMap.isPS(folder);
 if(folder.psFolder===true)return true;
 const n=String(folder.name||'').normalize('NFKC').trim().replace(/^[^\p{L}\p{N}]+/u,'').trim();
 return /^(?:PS|ПС)(?=$|[\s.\-–—_:/'‘’ʼʻ`´"«»(])/iu.test(n)||(/(?:^|[^\d])(?:500|220|110|35)\s*\/\s*(?:110|35|10|6)(?=\s|$|[’ʼʻ'"«»])/iu.test(n)&&!/(?:fider|fedir|фидер)/iu.test(n));
}
function isFeederFolder(folder){
 if(!folder||isPsFolder(folder))return false;
 const n=String(folder.name||'').normalize('NFKC').trim();
 return /(?:fider|fedir|fid[eі]r|фидер|liniya|линия|\b(?:L|Л)[-\s–—])/iu.test(n)||!!folder.sourcePsFolderId;
}
function owningPs(folderId,folders){
 const seen=new Set();let id=String(folderId||''),depth=0;
 while(id&&id!=='root'&&folders[id]&&!seen.has(id)&&depth++<160){
  seen.add(id);if(isPsFolder(folders[id]))return id;
  id=String(folders[id].parentId||'root');
 }
 return '';
}
function feederVoltage(folder,ps){
 const n=String(folder?.name||'');
 const explicit=n.match(/(?:^|[^\d])(500|220|110|35|10|6)\s*(?:k\s*v|кв)(?=\s|$|[.,;:()])/iu);
 if(explicit)return Number(explicit[1]);
 const parser=window.HETKPSFeederMap?.voltageForFeeder;
 return parser?N(parser(n,ps?.name||'')):null;
}
function psFolderKey(ctx){
 const f=ctx.folders||{},ps=ctx.ps;
 const id=String(ps.folderId||String(ps.id||'').replace(/^folderps_/,''));
 if(f[id])return id;
 // Legacy, folderless stations are never matched by an ambiguous duplicate name.
 const matching=Object.keys(f).filter(key=>isPsFolder(f[key])&&String(f[key].name||'').normalize('NFKC').trim().toLocaleLowerCase()===String(ps.name||'').normalize('NFKC').trim().toLocaleLowerCase());
 return matching.length===1?matching[0]:id;
}
function childStations(ctx){
 const folders=ctx.folders||{},psId=psFolderKey(ctx),items=[];
 for(const [id,f] of Object.entries(folders)){
  if(id===psId||!isPsFolder(f)||ctx.canSeeFolder&&!ctx.canSeeFolder(id))continue;
  // Find the nearest ancestor PS, ignoring intermediate organizational folders.
  if(owningPs(f.parentId,folders)!==psId)continue;
  items.push({id,name:f.name||id});
 }
 return items.sort((a,b)=>textCompare(a.name,b.name));
}
function parentStation(ctx){
 const folders=ctx.folders||{},psId=psFolderKey(ctx),parent=owningPs(folders[psId]?.parentId,folders);
 if(!parent||ctx.canSeeFolder&&!ctx.canSeeFolder(parent))return null;
 return {id:parent,name:folders[parent]?.name||parent};
}
function buildFeeders(ctx){
 const ps=ctx.ps,folders=ctx.folders||{},psId=psFolderKey(ctx),list=[],byKey=new Map();
 const source=ctx.previewModel?.stations?.get?.(psId)||ctx.previewModel?.visibleStations?.find?.(p=>p.id===psId);
 const locals=arr(ctx.data?.feeders).filter(f=>String(f.psId)===String(ps.id)||String(f.psId)===psId);
 const localByFolder=new Map(locals.filter(f=>f.folderId).map(f=>[String(f.folderId),f]));
 const previews=new Map(arr(source?.feeders).map(p=>[String(p.id),p]));
 const add=(key,name,kv,record,preview,folderSourced)=>{
  key=String(key);if(!key||byKey.has(key))return byKey.get(key);
  const f={key,name:name||key,kv:N(kv),record:record||null,preview:preview||null,tps:[],folderSourced:!!folderSourced};
  list.push(f);byKey.set(key,f);return f;
 };
 // First index the actual HETK folder structure, independent of asynchronous GIS loading.
 // A nested PS is never a feeder of its parent, and any explicit source-PS link wins.
 for(const [id,folder] of Object.entries(folders)){
  if(!isFeederFolder(folder)||ctx.canSeeFolder&&!ctx.canSeeFolder(id))continue;
  const explicit=String(folder.sourcePsFolderId||'').trim();
  const stationId=explicit||owningPs(folder.parentId,folders);
  if(stationId!==psId)continue;
  const record=localByFolder.get(id)||locals.find(f=>String(f.id)===id)||null;
  const preview=previews.get(id)||null;
  add(id,folder.name,feederVoltage(folder,ps)??N(preview?.kv)??N(record?.voltage),record,preview,true);
 }
 // Include already resolved projection entries, including cross-territory feeders.
 for(const preview of previews.values()){
  const id=String(preview.id);
  if(ctx.canSeeFolder&&!ctx.canSeeFolder(id))continue;
  const record=localByFolder.get(id)||locals.find(f=>String(f.id)===id)||null;
  add(id,folders[id]?.name||preview.name||record?.name||id,N(preview.kv)??N(record?.voltage),record,preview,!!folders[id]);
 }
 // Preserve legacy manually entered feeders when no matching folder exists.
 for(const record of locals){
  const id=String(record.folderId||record.id);
  const existing=byKey.get(id);
  if(existing){if(!existing.record)existing.record=record;continue;}
  if(record.folderId&&folders[id]&&ctx.canSeeFolder&&!ctx.canSeeFolder(id))continue;
  // If the record has an actual folder with a different source PS, don't borrow it.
  if(record.folderId&&folders[id]&&owningPs(folders[id].parentId,folders)!==psId&&String(folders[id].sourcePsFolderId||'')!==psId)continue;
  add(id,record.name,N(record.voltage),record,null,!!folders[id]);
 }
 // Follow each TP's primary folder chain to its nearest feeder in THIS PS.
 // Stop at a nested PS boundary: its TP belongs only to that substation.
 function belongingFeeder(tp){
  for(const start of pointFolderIds(tp)){
   const visited=new Set();let id=start,n=0;
   while(id&&id!=='root'&&folders[id]&&!visited.has(id)&&n++<160){
    if(byKey.has(id))return byKey.get(id);
    if(isPsFolder(folders[id]))break;
    visited.add(id);id=String(folders[id].parentId||'root');
   }
  }
  return null;
 }
 const haveByFeeder=new Map(list.map(f=>[f.key,new Set()]));
 function attach(f,id,name,kva,origin){
  if(!f)return;id=String(id);const seen=haveByFeeder.get(f.key);
  if(seen.has(id))return;seen.add(id);
  f.tps.push({id,name:name||id,kva:N(kva),source:origin});
 }
 for(const [id,tp] of Object.entries(ctx.previewPoints||{})){
  if(!tp)continue;
  attach(belongingFeeder(tp),id,tp.name||tp.address||'TP/KTP',N(tp.power)??N(tp.kva),'base');
 }
 for(const f of list){
  for(const t of arr(ctx.data?.tps).filter(t=>[f.key,f.record?.id,f.record?.folderId].filter(Boolean).map(String).includes(String(t.feederId)))){
   attach(f,String(t.linkedTpId||t.id),t.name||t.id,N(t.kva),'dispatch');
  }
  for(const t of arr(f.preview?.tps)){
   const tp=ctx.previewPoints?.[t.id];
   attach(f,String(t.id),tp?.name||t.name||t.id,N(tp?.power)??N(tp?.kva),'preview');
  }
  f.tps.sort((a,b)=>textCompare(a.name,b.name));
  f.nominal=f.tps.reduce((sum,t)=>sum+(t.kva||0),0);
 }
 return list.sort((a,b)=>textCompare(a.name,b.name));
}
function summary(ctx,fs,o){
 const trs=opsTransformers(o),ms=opsMeasurements(o),tps=fs.reduce((n,f)=>n+f.tps.length,0),nominal=fs.reduce((n,f)=>n+f.nominal,0);
 const psLatest=lastMeasurement(o,'ps',opsKey(ctx.ps));
 const latestByFeeder=fs.map(f=>lastMeasurement(o,'feeder',f.key));
 const loaded=latestByFeeder.filter(m=>N(m?.kw)!==null);
 const psTime=psLatest?Date.parse(psLatest.at)||0:0;
 const lastFeederTime=Math.max(0,...latestByFeeder.filter(Boolean).map(m=>Date.parse(m.at)||0));
 const usePs=N(psLatest?.kw)!==null && (psTime>=lastFeederTime || !loaded.length);
 const kw=usePs?N(psLatest.kw):loaded.length?loaded.reduce((sum,m)=>sum+N(m.kw),0):null;
 const kwOrigin=usePs?'PS o‘lchovi':loaded.length?`Fiderlar: ${loaded.length}/${fs.length}`:'O‘lchov kiritilmagan';
 return {trs,ms,tps,nominal,kw,kwOrigin};
}
function compactMetric(v,label,icon){return `<div class="dg-p85-metric"><span class="dg-p85-metric-icon">${icon}</span><div><strong>${E(v)}</strong><small>${E(label)}</small></div></div>`;}
function header(ctx,fs,s){
 const ps=ctx.ps;
 return `<div class="dg-p85-header"><div class="dg-p85-head-id"><span class="dg-p85-sub-icon">⚡</span><div><h2>${E(ps.name)}</h2><p>${E(ps.folder||ctx.folderPath?.(ps.folderId)||'Podstansiya')} · ${E(arr(ps.volts).join('/'))} kV</p></div></div><div class="dg-p85-head-actions"><button type="button" data-p85="close" aria-label="Yopish">✕</button></div></div>
 <nav class="dg-p85-tabs" aria-label="PS bo‘limlari">${[['overview','⌂ Umumiy'],['transformers','▣ Transformatorlar'],['feeders','⌘ Fiderlar'],['loads','▥ Yuklamalar'],['history','◷ Tarix / Analitika'],['export','⇩ Yuklab olish'],['virtual','◇ Virtual QF']].map(([id,label])=>`<button type="button" class="${state.tab===id?'active':''}" data-p85="tab" data-value="${id}" aria-selected="${state.tab===id}">${label}</button>`).join('')}</nav>
 <div class="dg-p85-metrics">${compactMetric(String(s.trs.length),'Transformator','⚡')}${compactMetric(String(fs.length),'Fider','⌘')}${compactMetric((ctx.previewReady||Object.keys(ctx.previewPoints||{}).length)?String(s.tps):'…','TP/KTP','◈')}${compactMetric((ctx.previewReady||Object.keys(ctx.previewPoints||{}).length)?fmt(s.nominal)+' kVA':'…','Jami nominal','◆')}${compactMetric(fmt(s.kw)+(s.kw!==null?' kW':''),'So‘nggi yuklama','▤')}</div>`;
}
function sectionTitle(title,button=''){return `<div class="dg-p85-section-head"><h3>${title}</h3>${button}</div>`;}
function actionButton(id,label,attrs=''){return `<button type="button" class="dg-p85-action" data-p85="${id}" ${attrs}>${label}</button>`;}
function transformerCard(t,o){
 const load=lastMeasurement(o,'transformer',t.id);const assigned=Object.entries(o.assignments||{}).filter(([,id])=>id===t.id).length;
 return `<div class="dg-p85-transformer"><div class="dg-p85-trans-icon">♜</div><div class="dg-p85-trans-info"><b>${E(t.id)}</b><span>${N(t.mva)!==null?fmt(t.mva)+' MVA':'Quvvat kiritilmagan'}</span></div><div class="dg-p85-trans-meta"><b>${N(load?.kw)!==null?fmt(load.kw)+' kW':'—'}</b><span>So‘nggi o‘lchov · ${assigned} fider</span></div><button type="button" data-p85="measure" data-kind="transformer" data-id="${E(t.id)}">+ O‘lchov</button><button type="button" data-p85="edit-tr" data-id="${E(t.id)}" aria-label="Transformatorni tahrirlash">✎</button></div>`;
}
function feederRow(f,o,compact=false){
 const active=state.openFeeder===f.key,latest=lastMeasurement(o,'feeder',f.key);
 const old=f.record,kw=N(latest?.kw)??N(old?.loadKw);const assignment=o.assignments?.[f.key]||'';
 const ts=opsTransformers(o);
 const opts=`<option value="">Manba belgilanmagan</option>`+ts.map(t=>`<option value="${E(t.id)}" ${assignment===t.id?'selected':''}>${E(t.id)}</option>`).join('');
 return `<div class="dg-p85-feeder" data-p85-feeder="${E(f.key)}"><div class="dg-p85-feeder-row"><button type="button" class="dg-p85-feeder-toggle" data-p85="expand" data-id="${E(f.key)}" aria-expanded="${active}">${active?'−':'+'}</button><div class="dg-p85-feeder-title"><strong>${E(f.name)}</strong><small>${f.kv===null?'—':E(f.kv)+' kV'} · ${f.tps.length} TP/KTP · ${fmt(f.nominal)} kVA</small></div><div class="dg-p85-feeder-kw"><b>${kw===null?'—':fmt(kw)+' kW'}</b><small>So‘nggi yuklama</small></div><label class="dg-p85-assignment"><span>Manba</span><select aria-label="${E(f.name)} manbasi" data-p85-assign="${E(f.key)}" ${ts.length?'':'disabled'}>${opts}</select></label><button type="button" class="dg-p85-small" data-p85="measure" data-kind="feeder" data-id="${E(f.key)}">Ko‘rsatkich +</button>${f.record?`<button type="button" class="dg-p85-small" data-p85="edit-feeder" data-id="${E(f.record.id)}" title="Fiderni tahrirlash">✎</button>`:''}</div>${active?`<div class="dg-p85-feeder-details"><div class="dg-p85-feeder-meas"><span>Hisoblagich №: <b>${E(latest?.meterNumber||old?.meterNumber||'—')}</b></span><span>kWh: <b>${fmt(latest?.kwh??old?.meterKwh)}</b></span><span>Oxirgi sana: <b>${E(dateFmt(latest?.at||old?.meterAt))}</b></span></div><table class="dg-p85-table"><thead><tr><th>TP/KTP nomi</th><th>Nominal quvvat</th></tr></thead><tbody>${f.tps.length?f.tps.map(t=>`<tr><td>${E(t.name)}</td><td>${t.kva===null?'—':fmt(t.kva)+' kVA'}</td></tr>`).join(''):'<tr><td colspan="2">TP/KTP biriktirilmagan</td></tr>'}</tbody></table></div>`:''}</div>`;
}
function feederList(fs,o){
 const q=state.search.trim().toLocaleLowerCase();const matching=fs.filter(f=>!q||[f.name,...f.tps.map(t=>t.name)].join(' ').toLocaleLowerCase().includes(q));
 return `<div class="dg-p85-feeder-list">${matching.length?matching.map(f=>feederRow(f,o)).join(''):'<div class="dg-p85-empty">Mos fider topilmadi</div>'}</div>`;
}
function childStationsPanel(ctx){
 const children=childStations(ctx||{}),parent=parentStation(ctx||{});
 if(!children.length&&!parent)return '';
 const back=parent?`<button type="button" class="dg-p86-substation dg-p86-parent" data-p85="open-sub-ps" data-id="${E(parent.id)}"><span>↑</span><b>Yuqori PS: ${E(parent.name)}</b><span aria-hidden="true">›</span></button>`:'';
 return `<section class="dg-p85-card dg-p86-substations">${sectionTitle(children.length?`Ichki podstansiyalar (${children.length} ta)`:'PS iyerarxiyasi')}<div class="dg-p86-substations-list">${back}${children.map(p=>`<button type="button" class="dg-p86-substation" data-p85="open-sub-ps" data-id="${E(p.id)}"><span>▣</span><b>${E(p.name)}</b><small>PS panelini ochish</small><span aria-hidden="true">›</span></button>`).join('')}</div></section>`;
}
function feedersPane(fs,o){return `${childStationsPanel(state.ctx)}<section class="dg-p85-card">${sectionTitle(`Fiderlar (${fs.length} ta)`,`<div class="dg-p85-title-tools"><input class="dg-p85-search" data-p85-search type="search" value="${E(state.search)}" placeholder="Fider yoki TP/KTP qidirish" aria-label="Fider yoki TP/KTP qidirish">${actionButton('add-feeder','+ Fider')}</div>`)}${feederList(fs,o)}</section>`;}
function transformersPane(s,o){
 return `<section class="dg-p85-card">${sectionTitle(`Transformatorlar (${s.trs.length} ta)`,actionButton('add-tr','+ Transformator qo‘shish'))}${s.trs.length?s.trs.map(t=>transformerCard(t,o)).join(''):'<div class="dg-p85-empty">T1, T2 va boshqa transformatorlarni quvvati bilan qo‘shishingiz mumkin.</div>'}${transformerForm(o)}</section>`;
}
function transformerForm(o){
 if(state.editingTransformer===null)return '';
 const t=opsTransformers(o).find(t=>t.id===state.editingTransformer);
 const auto='T'+(Math.max(0,...opsTransformers(o).map(t=>/^T\d+$/.test(t.id)?+t.id.slice(1):0))+1);
 return `<form class="dg-p85-edit-form" id="dg-p85-transformer-form"><h4>${t?'Transformatorni tahrirlash':'Yangi transformator'}</h4><div class="dg-p85-fields"><label>Nomi<input name="name" maxlength="12" required value="${E(t?.id||auto)}" ${t?'readonly':''} pattern="[A-Za-z0-9_-]{1,12}"></label><label>Quvvati (MVA)<input name="mva" type="number" min="0.001" max="5000" step="any" placeholder="Masalan: 10" value="${E(t?.mva??'')}" required></label></div><div class="dg-p85-form-buttons"><button type="submit">Saqlash</button>${actionButton('cancel-tr','Bekor qilish')}${t?actionButton('remove-tr','O‘chirish',`data-id="${E(t.id)}"`):''}</div></form>`;
}
function yearChoices(ms){const years=[...new Set([todayYear(),...ms.map(m=>new Date(m.at).getFullYear()).filter(Number.isFinite)])].sort((a,b)=>b-a);return years.map(y=>`<option value="${y}" ${state.year===y?'selected':''}>${y}</option>`).join('');}
function monthSeries(o,fs,psId){
 const ms=opsMeasurements(o).filter(m=>new Date(m.at).getFullYear()===state.year),rows=[];
 for(let mon=0;mon<12;mon++){
  const monthly=ms.filter(m=>new Date(m.at).getMonth()===mon&&N(m.kw)!==null);
  const psRecords=monthly.filter(m=>m.kind==='ps'&&m.targetId===psId).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  if(psRecords.length){rows.push(N(psRecords[0].kw));continue;}
  const latestById=new Map();
  for(const m of monthly.filter(m=>m.kind==='feeder')){
   const prev=latestById.get(m.targetId);if(!prev||Date.parse(prev.at)<Date.parse(m.at))latestById.set(m.targetId,m);
  }
  rows.push(latestById.size?[...latestById.values()].reduce((sum,m)=>sum+N(m.kw),0):null);
 }
 return rows;
}
function chartSvg(o,fs,psId){
 const vals=monthSeries(o,fs,psId),known=vals.map((v,i)=>({x:52+i*55,y:v})).filter(p=>p.y!==null);
 if(!known.length)return '<div class="dg-p85-chart-empty">Tanlangan yil uchun yuklama ko‘rsatkichlari hali kiritilmagan.</div>';
 const max=Math.max(1,...known.map(p=>p.y)),upper=Math.ceil(max/1000)*1000||1;
 const coord=(v,i)=>({x:52+i*55,y:160-v/upper*122});
 const points=vals.map((v,i)=>v===null?null:coord(v,i));let paths=[],run=[];
 for(const p of [...points,null]){if(p)run.push(p);else{if(run.length)paths.push(run.map((x,i)=>`${i?'L':'M'} ${x.x} ${x.y.toFixed(2)}`).join(' '));run=[];}}
 const months=['Yan','Fev','Mar','Apr','May','Iyun','Iyul','Avg','Sen','Okt','Noy','Dek'];
 return `<svg class="dg-p85-chart" viewBox="0 0 690 206" role="img" aria-label="${state.year} yil yuklama grafigi">${[0,1,2,3].map(k=>{const y=160-k*40.7;return `<line x1="52" x2="664" y1="${y}" y2="${y}" stroke="#e0eaf6"/><text x="42" y="${y+4}" text-anchor="end" fill="#6280a3" font-size="10">${Math.round(upper*k/3).toLocaleString('uz-UZ')}</text>`;}).join('')}${paths.map(p=>`<path d="${p}" fill="none" stroke="#1776d9" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}${points.map((p,i)=>p?`<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="white" stroke="#1675d5" stroke-width="2"><title>${months[i]}: ${fmt(vals[i])} kW</title></circle>`:'').join('')}${months.map((m,i)=>`<text x="${52+i*55}" y="182" text-anchor="middle" fill="#466789" font-size="11">${m}</text>`).join('')}</svg>`;
}
function hotCold(o,psId){return ['hot','cold'].map(kind=>{
 const ms=opsMeasurements(o).filter(m=>m.kind==='ps'&&m.targetId===psId&&m.season===kind&&N(m.kw)!==null).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 const m=ms[0];return `<div class="dg-p85-season"><span>${kind==='hot'?'☀️':'❄️'}</span><div><b>${kind==='hot'?'Eng issiq kun':'Eng sovuq kun'}</b><small>${m?shortDate(m.at):'Sana kiritilmagan'}</small></div><strong>${m?fmt(m.kw)+' kW':'—'}</strong></div>`;
 }).join('');}
function analytics(o,fs,psId){return `<section class="dg-p85-card">${sectionTitle('Yuklama dinamikasi',`<label class="dg-p85-select-label">Yil <select data-p85-year>${yearChoices(opsMeasurements(o))}</select></label>`)}<div class="dg-p85-analytics"><div class="dg-p85-graph">${chartSvg(o,fs,psId)}</div><div class="dg-p85-seasons">${hotCold(o,psId)}</div></div></section>`;}
function factorPane(o,s){
 const ms=opsMeasurements(o),last=ms.filter(m=>m.kind==='ps'&&N(m.kw)>0&&N(m.kvar)!==null).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
 const p=N(last?.kw),q=N(last?.kvar),pf=p&&q!==null?p/Math.hypot(p,q):null;
 const compensation=pf!==null&&pf<.95?p*(Math.tan(Math.acos(pf))-Math.tan(Math.acos(.95))):null;
 return `<section class="dg-p85-card">${sectionTitle('Quvvat koeffitsiyenti va kompensatsiya')}<div class="dg-p85-factor"><div><small>Faol quvvat (P)</small><strong>${p!==null?fmt(p)+' kW':'—'}</strong></div><div><small>Reaktiv quvvat (Q)</small><strong>${q!==null?fmt(q)+' kvar':'—'}</strong></div><div><small>Hisoblangan cos φ</small><strong>${pf!==null?pf.toFixed(3):'—'}</strong></div><div><small>cos φ = 0,95 uchun Qc</small><strong>${compensation!==null?fmt(Math.max(0,compensation))+' kvar':'—'}</strong></div></div></section>`;
}
function overview(ctx,fs,o,s){return `<div class="dg-p85-overview"><div class="dg-p85-stack">${transformersPane(s,o)}${factorPane(o,s)}</div><div class="dg-p85-stack">${feedersPane(fs,o)}</div><div class="dg-p85-wide">${analytics(o,fs,opsKey(ctx.ps))}</div></div>`;}
function loadForm(o,fs){
 if(!state.measurementTarget)return '';
 const {kind,id}=state.measurementTarget;
 const label=kind==='ps'?state.ctx.ps.name:kind==='transformer'?id:fs.find(f=>f.key===id)?.name||id;
 const previous=lastMeasurement(o,kind,id);const old=fs.find(f=>f.key===id)?.record;
 return `<form id="dg-p85-reading-form" class="dg-p85-reading-form"><div class="dg-p85-section-head"><h3>Ko‘rsatkich kiritish · ${E(label)}</h3>${actionButton('cancel-measure','✕ Yopish')}</div><input type="hidden" name="kind" value="${E(kind)}"><input type="hidden" name="targetId" value="${E(id)}"><div class="dg-p85-reading-fields">
 <label>Sana va vaqt *<input type="datetime-local" name="at" value="${E(nowLocal())}" required></label>
 <label>Hisoblagich raqami<input name="meterNumber" maxlength="70" placeholder="Masalan: 00123456" value="${E(previous?.meterNumber||old?.meterNumber||'')}"></label>
 <label>Ko‘rsatkich (kWh)<input type="number" name="kwh" min="0" step="any" placeholder="kWh"></label>
 <label>Yuklama (kW)<input type="number" name="kw" min="0" step="any" placeholder="kW"></label>
 <label>Tok (A)<input type="number" name="amp" min="0" step="any" placeholder="A"></label>
 <label>Reaktiv quvvat (kvar)<input type="number" name="kvar" min="0" step="any" placeholder="kvar"></label>
 <label>Kuchlanish (kV)<input type="number" name="voltageKv" min="0" step="any" placeholder="kV"></label>
 <label>O‘lchov turi<select name="season"><option value="normal">Oddiy o‘lchov</option><option value="hot">Eng issiq kun</option><option value="cold">Eng sovuq kun</option></select></label>
 <label class="dg-p85-wide-field">Izoh<input name="note" maxlength="240" placeholder="Ixtiyoriy"></label></div><div class="dg-p85-form-buttons"><button type="submit">✓ Saqlash</button><span>Kamida bitta ko‘rsatkich kiriting. Oldingi yozuvlar o‘chirilmaydi.</span></div></form>`;
}
function loadsPane(ctx,fs,o,s){
 const opts=[`<option value="ps|${E(opsKey(ctx.ps))}">PS jami</option>`,...s.trs.map(t=>`<option value="transformer|${E(t.id)}">Transformator ${E(t.id)}</option>`),...fs.map(f=>`<option value="feeder|${E(f.key)}">${E(f.name)}</option>`)];
 return `<section class="dg-p85-card">${sectionTitle('Sana bo‘yicha ko‘rsatkichlar',actionButton('measure','+ Ko‘rsatkich kiritish',`data-kind="ps" data-id="${E(opsKey(ctx.ps))}"`))}<p class="dg-p85-description">PS, transformator va fider bo‘yicha ixtiyoriy sana va vaqtda alohida o‘lchov saqlanadi. Hisoblagich raqami ham kiritilishi mumkin.</p><div class="dg-p85-load-pickers">${s.trs.map(t=>actionButton('measure',`+ ${E(t.id)} o‘lchovi`,`data-kind="transformer" data-id="${E(t.id)}"`)).join('')}${fs.slice(0,15).map(f=>actionButton('measure',`+ ${E(f.name)}`,`data-kind="feeder" data-id="${E(f.key)}"`)).join('')}</div>${loadForm(o,fs)}</section>${analytics(o,fs,opsKey(ctx.ps))}`;
}
function historyTable(o,fs,ctx){
 const names=new Map([[`ps|${opsKey(ctx.ps)}`,ctx.ps.name],...opsTransformers(o).map(t=>[`transformer|${t.id}`,t.id]),...fs.map(f=>[`feeder|${f.key}`,f.name])]);
 const all=opsMeasurements(o).filter(m=>state.historyFilter==='all'||m.kind===state.historyFilter).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
 return `<div class="dg-p85-table-wrap"><table class="dg-p85-table"><thead><tr><th>Sana / vaqt</th><th>Obyekt</th><th>Yuklama (kW)</th><th>Tok (A)</th><th>kWh</th><th>Hisoblagich №</th><th>Kiritgan</th></tr></thead><tbody>${all.length?all.slice(0,300).map(m=>`<tr><td>${E(dateFmt(m.at))}</td><td>${E(names.get(m.kind+'|'+m.targetId)||m.targetId)}</td><td>${fmt(m.kw)}</td><td>${fmt(m.amp)}</td><td>${fmt(m.kwh)}</td><td>${E(m.meterNumber||'—')}</td><td>${E(m.createdByName||m.createdBy||'—')}</td></tr>`).join(''):'<tr><td colspan="7">Hali o‘lchovlar kiritilmagan</td></tr>'}</tbody></table></div>${all.length>300?`<p class="dg-p85-description">Jadvalda oxirgi 300 ta yozuv. CSV eksportda barcha ${all.length} ta yozuv mavjud.</p>`:''}`;
}
function historyPane(ctx,fs,o){return `${analytics(o,fs,opsKey(ctx.ps))}<section class="dg-p85-card">${sectionTitle('O‘lchovlar tarixi',`<select data-p85-history><option value="all" ${state.historyFilter==='all'?'selected':''}>Barchasi</option><option value="ps" ${state.historyFilter==='ps'?'selected':''}>PS</option><option value="transformer" ${state.historyFilter==='transformer'?'selected':''}>Transformatorlar</option><option value="feeder" ${state.historyFilter==='feeder'?'selected':''}>Fiderlar</option></select>`)}${historyTable(o,fs,ctx)}</section>`;}
function virtualPane(ctx){return `<section class="dg-p85-card">${sectionTitle('PS ulanishlari · virtual model')}<p class="dg-p85-description">Bu bo‘lim faqat dispetcherlikning sinov sxemasidagi QF va yerga ulagich yozuvlarini boshqaradi, haqiqiy uskunaga buyruq yubormaydi.</p>${ctx.virtualLinesMarkup||'<div class="dg-p85-empty">Virtual PSlararo liniyalar kiritilmagan.</div>'}</section>`;}
function exportPane(){return `<section class="dg-p85-card"><h3>Yuklab olish va hisobotlar</h3><div class="dg-p85-export-grid">${[['stats','▤','Fider statistikasi','CSV · Excel bilan ochiladi'],['history','◷','O‘lchovlar tarixi','CSV · barcha sanalar'],['json','⌑','PS ma’lumotlari','JSON · zaxira uchun'],['report','▤','Hisobot / Chop','PDF sifatida saqlash'],['svg','⌘','PS mnemosxemasi','SVG · vektorli sxema']].map(([id,icon,title,info])=>`<button type="button" class="dg-p85-export-card" data-p85="export-${id}"><span>${icon}</span><b>${title}</b><small>${info}</small></button>`).join('')}</div></section>`;}
function render(force=false){
 const box=state.box,ctx=state.ctx;if(!box||!ctx)return;
 // Live TP updates must not destroy a user's partially completed form.
 if(!force&&box.contains(document.activeElement)&&document.activeElement?.closest?.('form'))return;
 const o=storedOps(),fs=buildFeeders(ctx),s=summary(ctx,fs,o);
 const content=state.tab==='overview'?overview(ctx,fs,o,s):state.tab==='transformers'?transformersPane(s,o):state.tab==='feeders'?feedersPane(fs,o):state.tab==='loads'?loadsPane(ctx,fs,o,s):state.tab==='history'?historyPane(ctx,fs,o):state.tab==='virtual'?virtualPane(ctx):exportPane();
 box.hidden=false;box.classList.add('dg-p85');
 box.innerHTML=header(ctx,fs,s)+`<div class="dg-p85-body">${content}</div>`;
}
function writable(){if(state.ctx?.canPersist&&!state.ctx.canPersist()){state.ctx.onMessage?.('Firebase sinxronlash hali tayyor emas yoki boshqa tahrir bilan to‘qnashuv bor. Ma’lumot saqlanmadi.','error');return false;}return true;}
function save(){state.ctx?.onSave?.();render(true);}
function openMeasure(kind,id){state.measurementTarget={kind,id};state.tab='loads';render(true);const input=state.box.querySelector('[name="at"]');input?.focus?.();}
function addOrEditTransformer(form){
 if(!writable())return;
 const fd=new FormData(form);const name=String(fd.get('name')||'').trim().toUpperCase(),mva=N(fd.get('mva'));
 if(!/^[A-Z0-9_-]{1,12}$/.test(name)||!mva||mva<=0||mva>5000)return state.ctx.onMessage?.('Transformator nomi va quvvatini to‘g‘ri kiriting.','error');
 const o=storedOps(true);if(!Array.isArray(o.transformers))o.transformers=[];
 const previous=o.transformers.find(t=>t.id===name);
 if(!previous&&state.editingTransformer&&state.editingTransformer!==name)return;
 if(previous)previous.mva=mva;else o.transformers.push({id:name,mva});
 state.editingTransformer=null;save();
}
function saveMeasurement(form){
 if(!writable())return;
 const fd=new FormData(form),kind=String(fd.get('kind')||''),targetId=String(fd.get('targetId')||'');
 const fs=buildFeeders(state.ctx),o=storedOps(true),ts=opsTransformers(o);
 if(![['ps',opsKey(state.ctx.ps)],...ts.map(t=>['transformer',t.id]),...fs.map(f=>['feeder',f.key])].some(p=>p[0]===kind&&p[1]===targetId))return state.ctx.onMessage?.('O‘lchov obyekti topilmadi.','error');
 const at=safeDate(fd.get('at'));if(!at)return state.ctx.onMessage?.('Sana va vaqtni tekshiring.','error');
 if(Date.parse(at)>Date.now()+86400000)return state.ctx.onMessage?.('Kelajakdagi o‘lchov sanasini tekshiring.','error');
 const values={};let hasNumber=false;
 for(const f of ['kw','amp','kwh','kvar','voltageKv']){
  const raw=String(fd.get(f)??'').trim();if(raw&&(!Number.isFinite(Number(raw))||Number(raw)<0))return state.ctx.onMessage?.('Ko‘rsatkich manfiy yoki noto‘g‘ri bo‘lishi mumkin emas.','error');
  values[f]=raw?Number(raw):null;if(raw)hasNumber=true;
 }
 if(!hasNumber)return state.ctx.onMessage?.('Kamida bitta sonli o‘lchovni kiriting.','error');
 const reading={id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,9),kind,targetId,at,...values,
  meterNumber:String(fd.get('meterNumber')||'').trim().slice(0,70),season:['hot','cold'].includes(fd.get('season'))?fd.get('season'):'normal',note:String(fd.get('note')||'').trim().slice(0,240),createdBy:state.ctx.user?.uid||'',createdByName:state.ctx.user?.name||state.ctx.user?.fullName||'',createdAt:new Date().toISOString()};
 if(!Array.isArray(o.measurements))o.measurements=[];
 o.measurements.push(reading);
 // Preserve old feeder flat fields for compatibility; the historical record is authoritative.
 const f=fs.find(f=>f.key===targetId);
 if(kind==='feeder'&&f?.record&&(!f.record.meterAt||Date.parse(at)>=Date.parse(f.record.meterAt))){
  if(values.kw!==null)f.record.loadKw=values.kw;if(values.amp!==null)f.record.loadAmp=values.amp;
  if(values.kwh!==null)f.record.meterKwh=values.kwh;if(reading.meterNumber)f.record.meterNumber=reading.meterNumber;
  f.record.meterAt=at;
 }
 state.measurementTarget=null;save();state.ctx.onMessage?.('O‘lchov saqlandi. Sinxronlash holatini dispetcherlik panelida tekshiring.','success');
}
function csvEscape(v){let s=String(v==null?'':v);if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function download(filename,blob){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);}
function exportCsv(kind){
 const ctx=state.ctx,o=storedOps(),fs=buildFeeders(ctx),cols=[],records=[];
 if(kind==='history'){
  cols.push('Sana','Obyekt turi','Obyekt','Yuklama kW','Tok A','Reaktiv quvvat kvar','Hisoblagich raqami','Hisoblagich kWh','Kuchlanish kV','Mavsum','Izoh','Kiritgan ID','Kiritilgan vaqt');
  const ids=new Map([...fs.map(f=>['feeder|'+f.key,f.name]),...opsTransformers(o).map(t=>['transformer|'+t.id,t.id]),['ps|'+opsKey(ctx.ps),ctx.ps.name]]);
  for(const m of opsMeasurements(o).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)))records.push([m.at,m.kind,ids.get(m.kind+'|'+m.targetId)||m.targetId,m.kw,m.amp,m.kvar,m.meterNumber,m.kwh,m.voltageKv,m.season,m.note,m.createdBy,m.createdAt]);
 }else{
  cols.push('PS','Fider','Kuchlanish kV','TP KTP soni','Nominal quvvat kVA','Manba T','Oxirgi yuklama kW','Tok A','Hisoblagich raqami','Hisoblagich kWh','Oxirgi sana');
  for(const f of fs){const m=lastMeasurement(o,'feeder',f.key);records.push([ctx.ps.name,f.name,f.kv,f.tps.length,f.nominal,o.assignments?.[f.key],m?.kw??f.record?.loadKw,m?.amp??f.record?.loadAmp,m?.meterNumber??f.record?.meterNumber,m?.kwh??f.record?.meterKwh,m?.at??f.record?.meterAt]);}
 }
 const csv='\ufeff'+[cols,...records].map(r=>r.map(csvEscape).join(';')).join('\r\n');
 download('HETK-PS-'+(kind==='history'?'tarix':'statistika')+'-'+new Date().toISOString().slice(0,10)+'.csv',new Blob([csv],{type:'text/csv;charset=utf-8'}));
}
function exportJson(){const ctx=state.ctx;download('HETK-PS-'+new Date().toISOString().slice(0,10)+'.json',new Blob([JSON.stringify({ps:{id:ctx.ps.id,name:ctx.ps.name},version:85,exportedAt:new Date().toISOString(),operations:storedOps()},null,2)],{type:'application/json;charset=utf-8'}));}
function exportReport(){const ctx=state.ctx,o=storedOps(),fs=buildFeeders(ctx),s=summary(ctx,fs,o);const p=window.open('','_blank');if(!p)return ctx.onMessage?.('Hisobot oynasi bloklangan. Brauzerdan yangi oynalarga ruxsat bering.','error');
 const rows=fs.map(f=>{const m=lastMeasurement(o,'feeder',f.key);return `<tr><td>${E(f.name)}</td><td>${E(f.kv??'—')}</td><td>${f.tps.length}</td><td>${fmt(f.nominal)}</td><td>${E(o.assignments?.[f.key]||'—')}</td><td>${fmt(m?.kw)}</td><td>${E(dateFmt(m?.at))}</td></tr>`;}).join('');
 p.document.open();p.document.write(`<!doctype html><html lang="uz"><head><meta charset="utf-8"><title>${E(ctx.ps.name)} · HETK PS hisoboti</title><style>body{font:12px Arial;color:#123454;margin:18px}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin-top:15px}th,td{border:1px solid #b8cadc;text-align:left;padding:8px}th{background:#e6f0fa}.bar{display:flex;justify-content:space-between;align-items:center;background:#e7f3ff;padding:12px}@media print{.print{display:none}}button{background:#0b64ac;color:white;border:0;padding:10px 18px;cursor:pointer}</style></head><body><div class="bar"><h1>${E(ctx.ps.name)}</h1><button class="print" onclick="print()">PDF / Chop etish</button></div><p>${E(ctx.ps.folder||'')} · ${E(arr(ctx.ps.volts).join('/'))} kV · ${new Date().toLocaleDateString('uz-UZ')}</p><h2>Umumiy ko‘rsatkichlar</h2><p>Transformator: ${s.trs.length}; fider: ${fs.length}; TP/KTP: ${s.tps}; nominal quvvat: ${fmt(s.nominal)} kVA; oxirgi qayd etilgan yuklama: ${fmt(s.kw)} kW.</p><h2>Fiderlar</h2><table><thead><tr><th>Fider</th><th>kV</th><th>TP/KTP</th><th>Nominal kVA</th><th>Manba</th><th>kW</th><th>Sana</th></tr></thead><tbody>${rows}</tbody></table><h2>Transformatorlar</h2><p>${s.trs.map(t=>E(t.id)+' — '+fmt(t.mva)+' MVA').join('; ')||'Ma’lumot kiritilmagan'}</p><p>Manba: HETK dispetcherlik tizimiga kiritilgan ma’lumotlar.</p></body></html>`);p.document.close();p.focus();}
function onClick(ev){const btn=ev.target.closest('[data-p85]');if(!btn||!state.box?.contains(btn))return;
 ev.preventDefault();ev.stopPropagation();const act=btn.dataset.p85,id=btn.dataset.id;
 if(act==='close'){state.ctx?.onClose?.();return;}
 if(act==='open-sub-ps'){state.ctx?.onOpenSubPs?.(id);return;}
 if(act==='add-feeder'){state.ctx?.onAddFeeder?.();return;}
 if(act==='edit-feeder'){state.ctx?.onEditFeeder?.(id);return;}
 if(act==='tab'){state.tab=btn.dataset.value;state.measurementTarget=null;state.editingTransformer=null;render(true);return;}
 if(act==='expand'){state.openFeeder=state.openFeeder===id?'':id;render(true);return;}
 if(act==='measure'){openMeasure(btn.dataset.kind||'ps',btn.dataset.id||opsKey(state.ctx.ps));return;}
 if(act==='cancel-measure'){state.measurementTarget=null;render(true);return;}
 if(act==='add-tr'){state.editingTransformer='';render(true);return;}
 if(act==='edit-tr'){state.editingTransformer=id;render(true);return;}
 if(act==='cancel-tr'){state.editingTransformer=null;render(true);return;}
 if(act==='remove-tr'){
  if(!writable())return;
  const o=storedOps(true);if(Object.values(o.assignments||{}).includes(id))return state.ctx.onMessage?.('Avval ushbu transformatorga biriktirilgan fiderlarning manbasini o‘zgartiring.','error');
  if(!confirm(id+' transformatorini ro‘yxatdan o‘chirasizmi? Uning eski o‘lchovlar tarixi saqlanadi.'))return;
  o.transformers=opsTransformers(o).filter(t=>t.id!==id);state.editingTransformer=null;save();return;
 }
 if(act.startsWith('export-')){
  const kind=act.slice(7);if(kind==='stats'||kind==='history')exportCsv(kind);else if(kind==='json')exportJson();else if(kind==='report')exportReport();else if(kind==='svg')state.ctx?.onExportSvg?.();return;
 }
}
function onChange(ev){if(!state.ctx)return;
 const field=ev.target;
 if(field.matches('[data-p85-assign]')){
  if(!writable()){render(true);return;}
  const key=field.dataset.p85Assign,id=field.value;
  const o=storedOps(true);if(!o.assignments||typeof o.assignments!=='object')o.assignments={};
  if(id&&!opsTransformers(o).some(t=>t.id===id))return state.ctx.onMessage?.('Transformator topilmadi.','error');
  if(id)o.assignments[key]=id;else delete o.assignments[key];save();return;
 }
 if(field.matches('[data-p85-year]')){state.year=Number(field.value)||todayYear();render(true);return;}
 if(field.matches('[data-p85-history]')){state.historyFilter=field.value;render(true);return;}
}
function onInput(ev){if(!ev.target.matches('[data-p85-search]'))return;
 const field=ev.target;state.search=field.value;const from=field.selectionStart;render(true);
 const input=state.box.querySelector('[data-p85-search]');input?.focus();if(input)try{input.setSelectionRange(from,from);}catch(_e){}
}
function onSubmit(ev){if(!state.ctx)return;
 if(ev.target.id==='dg-p85-transformer-form'){ev.preventDefault();ev.stopPropagation();addOrEditTransformer(ev.target);return;}
 if(ev.target.id==='dg-p85-reading-form'){ev.preventDefault();ev.stopPropagation();saveMeasurement(ev.target);return;}
}
function mount(box,ctx){
 if(!box||!ctx?.ps)return;
 if(state.box!==box){state.box=box;box.addEventListener('click',onClick);box.addEventListener('change',onChange);box.addEventListener('input',onInput);box.addEventListener('submit',onSubmit);}
 if(state.psId!==ctx.ps.id){state.psId=ctx.ps.id;state.tab='overview';state.openFeeder='';state.search='';state.measurementTarget=null;state.editingTransformer=null;state.year=todayYear();state.historyFilter='all';}
 state.ctx=ctx;render();
}
window.HETKPSPanel={mount,buildFeeders,childStations,summary,version:86};
})();
