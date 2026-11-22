/* HETK v83: read-only automatic schematic, derived from the SAME provisional
 * 6/10 kV GPS routes as GIS, progressively refined by recorded feeder poles.
 * An estimated line is always explicitly dashed, never treated as confirmed.
 * No Firebase writes, no inferred SCADA telemetry or switch state.
 */
(function(){
'use strict';
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Number.isFinite(+v)?+v:0;
const colors={500:'#a73790',220:'#e74655',110:'#3186f6',35:'#20b978',10:'#e4a642',6:'#7861e9'};
const valid=(a,b)=>a!=null&&b!=null&&a!==''&&b!==''&&Number.isFinite(+a)&&Number.isFinite(+b)&&Math.abs(+a)<=90&&Math.abs(+b)<=180&&(+a!==0||+b!==0);
function km(a,b){
  if(!valid(a?.lat,a?.lng)||!valid(b?.lat,b?.lng))return null;
  const rad=Math.PI/180,lat=(+b.lat-+a.lat)*rad,lon=(+b.lng-+a.lng)*rad;
  const z=Math.sin(lat/2)**2+Math.cos(+a.lat*rad)*Math.cos(+b.lat*rad)*Math.sin(lon/2)**2;
  return 12742*Math.atan2(Math.sqrt(z),Math.sqrt(Math.max(0,1-z)));
}
function ancestors(id,folders){const result=[],visited=new Set();let current=id;
  while(current&&current!=='root'&&folders[current]&&!visited.has(current)&&result.length<100){result.push(current);visited.add(current);current=folders[current].parentId;}
  return result;
}
function tpFolders(tp){return [...new Set([tp?.primaryFolderId,tp?.folderId,...Object.entries(tp?.folders||{}).filter(([,v])=>v===true||v===1).map(([id])=>id)].filter(Boolean))];}
function nearestFeeder(tp,feederIds,folders){
  for(const folderId of tpFolders(tp))for(const id of ancestors(folderId,folders)){
    if(feederIds.has(id))return id;
    const f=folders[id];
    if(f&&(f.psFolder===true||/^(?:PS|ПС)[\s.\-–—_:/'‘’ʼʻ`´"«»(]/iu.test(String(f.name||''))))break;
  }
  return '';
}
function feedBelongs(station,feed,filter,folders){
  if(filter?.ps&&station.id!==filter.ps)return false;
  if(filter?.feeder&&feed.id!==filter.feeder)return false;
  for(const wanted of [filter?.region,filter?.territory].filter(Boolean)){
    // A cross-territory feeder is grouped by its service folder; its source
    // station is allowed to appear as an external PS, not copied/moved.
    if(!ancestors(feed.id,folders).includes(wanted)&&!ancestors(station.id,folders).includes(wanted))return false;
  }
  return true;
}
/* Build a graphical topology from the live GIS projection. No extra stored
 * electrical edges are created: projected edges exist only in memory and are
 * visibly distinguished from entered feederRoute6kv legs in the SVG.
 */
function projectedTopology(group,previewLine){
  const nodes=[],byId=new Map(),gps=group.allTps.filter(t=>valid(t.lat,t.lng)),
    noGps=group.allTps.filter(t=>!valid(t.lat,t.lng));
  const add=p=>{nodes.push(p);byId.set(p.id,p);};
  const raw=group.confirmed?group.nodes:[];
  const linkedByPoint=new Map(group.linked.map(x=>[x.point.id,x.tp]));
  for(const point of raw){
    add({...point,kind:point.kind||'pole',tp:linkedByPoint.get(point.id)||null,
      estimated:false,recorded:true});
  }
  const attached=new Set(group.linked.map(x=>x.tp.id));
  const remaining=gps.filter(tp=>!attached.has(tp.id));
  let autoNum=0;
  const makeId=()=>`__mn83_${autoNum++}`;
  let estimatedCount=0;
  if(group.confirmed&&raw.length){
    // Reuse exactly the same snapped draft legs that are now drawn in GIS.
    const composite=window.HETKPSFeederMap?.compositeRoutes?.(previewLine,group.station);
    const attachByEdge=new Map();
    for(const leg of composite?.segments||[]){
      if(!leg.provisional||!leg.tpId||!byId.has(leg.toId))continue;
      const tp=remaining.find(x=>x.id===leg.tpId);
      if(!tp)continue;
      if(!attachByEdge.has(leg.toId))attachByEdge.set(leg.toId,[]);
      attachByEdge.get(leg.toId).push({tp,t:Math.max(0,Math.min(1,+leg.t||0)),at:leg.at});
    }
    // A different/old GIS bundle might not yet have compositeRoutes; still
    // use a provisional endpoint rather than leaving the TP as an orphan card.
    const mapped=new Set([...attachByEdge.values()].flat().map(a=>a.tp.id));
    for(const tp of remaining.filter(x=>!mapped.has(x.id))){
      let best=null;
      for(const point of raw){
        const parent=point.parentId==='ps'?group.station:byId.get(point.parentId);
        if(!parent||!valid(parent.lat,parent.lng))continue;
        const a=[+parent.lat,+parent.lng],b=[+point.lat,+point.lng],target=[+tp.lat,+tp.lng];
        const snap=window.HETKPSFeederMap?.snapToLeg?.(target,[a,b]);
        if(snap&&(!best||snap.score<best.score))best={...snap,toId:point.id};
      }
      if(!best){add({id:makeId(),parentId:'ps',kind:'tp',tp,lat:tp.lat,lng:tp.lng,estimated:true});estimatedCount++;continue;}
      if(!attachByEdge.has(best.toId))attachByEdge.set(best.toId,[]);
      attachByEdge.get(best.toId).push({tp,t:best.t,at:best.at});
    }
    // Split the original leg at a calculated branch location; the original
    // conductor remains recorded, only the TP drop is provisional.
    for(const [edgeId,attachments] of attachByEdge){
      const end=byId.get(edgeId);if(!end)continue;
      const originalParent=end.parentId;
      let prior=originalParent;
      attachments.sort((a,b)=>a.t-b.t||a.tp.id.localeCompare(b.tp.id));
      for(const item of attachments){
        const pointId=makeId();
        add({id:pointId,parentId:prior,kind:'junction',lat:item.at?.[0],lng:item.at?.[1],
          estimated:false,recorded:false,virtualJunction:true});
        add({id:makeId(),parentId:pointId,kind:'tp',tp:item.tp,lat:item.tp.lat,lng:item.tp.lng,estimated:true});
        estimatedCount++;
        prior=pointId;
      }
      end.parentId=prior;
    }
  }else{
    // The order is the existing provisionalRoute path from the main HETK GIS.
    // A compact junction serves up to four successive GPS TPs, so the result
    // is a legible one-line scheme instead of a kilometre-long KTP chain.
    const stops=(previewLine?.path||[]).slice(1);
    const available=[...gps],sorted=[];
    for(const coord of stops){
      if(!available.length)break;
      let best=0,score=Infinity;
      available.forEach((tp,i)=>{const d=(+tp.lat-+coord[0])**2+(+tp.lng-+coord[1])**2;if(d<score){score=d;best=i;}});
      sorted.push(...available.splice(best,1));
    }
    sorted.push(...available.sort((a,b)=>a.name.localeCompare(b.name,'uz')));
    let parentId='ps';
    for(let i=0;i<sorted.length;i+=4){
      const batch=sorted.slice(i,i+4),last=batch[batch.length-1];
      const junction=makeId();
      add({id:junction,parentId,kind:'junction',lat:last.lat,lng:last.lng,
        estimated:true,virtualJunction:true});
      for(const tp of batch){
        add({id:makeId(),parentId:junction,kind:'tp',tp,lat:tp.lat,lng:tp.lng,estimated:true});
        estimatedCount++;
      }
      parentId=junction;
    }
  }
  // A TP with no GPS is shown only as an unlocated provisional endpoint.
  // This NEVER creates a geographic coordinate or appears as a confirmed link.
  for(const tp of noGps){add({id:makeId(),parentId:'ps',kind:'tp',tp,estimated:true,noGps:true});estimatedCount++;}
  const children=new Map([['ps',[]],...nodes.map(p=>[p.id,[]])]);
  for(const n of nodes){if(!children.has(n.parentId))children.set(n.parentId,[]);children.get(n.parentId).push(n);}
  for(const kids of children.values())kids.sort((a,b)=>{
    // Endpoint drops first; continue the feeder magistral after the drops.
    const ka=a.kind==='tp'?0:a.virtualJunction?2:1,kb=b.kind==='tp'?0:b.virtualJunction?2:1;
    return ka-kb||String(a.number||a.tp?.name||a.id).localeCompare(String(b.number||b.tp?.name||b.id),'uz');
  });
  return {nodes,byId,children,estimatedCount,confirmedCount:group.linked.length,
    recordedSegments:group.confirmed?raw.length:0};
}
function build(preview,points,folders,filter,voltage){
  const groups=[],issues=[];
  const stations=preview?.visibleStations||[];
  const feedIds=new Set(stations.flatMap(s=>s.feeders||[]).map(f=>f.id));
  const previewByFeed=new Map((preview?.previewLines||[]).map(f=>[f.feederId,f]));
  const tpByFeed=new Map();
  for(const [id,tp] of Object.entries(points||{})){
    const fid=nearestFeeder(tp,feedIds,folders);if(!fid)continue;
    if(!tpByFeed.has(fid))tpByFeed.set(fid,[]);
    tpByFeed.get(fid).push({id,name:tp.name||tp.address||id,kva:tp.power??tp.kva??'',
      isPrivate:tp.isPrivate===true,lat:tp.lat,lng:tp.lng});
  }
  for(const station of stations)for(const feed of station.feeders||[]){
    if(!voltage?.[feed.kv]||!feedBelongs(station,feed,filter,folders))continue;
    const tps=(tpByFeed.get(feed.id)||[]).sort((a,b)=>a.name.localeCompare(b.name,'uz'));
    const rawPoints=Array.isArray(feed.route?.points)?feed.route.points:[];
    let graph=null;
    if(rawPoints.length&&window.HETKFeederRouteEditor?.graph){
      try{graph=window.HETKFeederRouteEditor.graph(feed.route,station);}catch(_e){graph=null;}
    }
    const confirmed=!!(graph&&!graph.errors?.length&&graph.routes?.length&&valid(station.lat,station.lng));
    if(graph?.errors?.length)issues.push(`${feed.name}: tayanch trassasi xato, taxminiy yo‘nalish ishlatilmoqda`);
    const nodes=confirmed?rawPoints.map((p,i)=>({...p,sourceIndex:i})):[];
    const byId=new Map(nodes.map(p=>[p.id,p]));
    const children=new Map([['ps',[]],...nodes.map(p=>[p.id,[]])]);
    for(const p of nodes)if(children.has(p.parentId))children.get(p.parentId).push(p);
    const feederTps=new Map(tps.map(t=>[t.id,t]));
    const linked=nodes.filter(p=>p.kind==='tp'&&p.tpId&&feederTps.has(p.tpId))
      .map(p=>({point:p,tp:feederTps.get(p.tpId)}));
    const linkedIds=new Set(linked.map(x=>x.tp.id));
    for(const p of nodes.filter(p=>p.kind==='tp'&&!feederTps.has(p.tpId)))
      issues.push(`${feed.name}: ${p.number||p.id} tayanchdagi TP havolasi topilmadi`);
    const unlinked=tps.filter(t=>!linkedIds.has(t.id));
    const group={station,feed,linked,unlinked,nodes,byId,children,confirmed,graph,
      allTps:tps,notes:folders[feed.id]?.mnemoNotes||{}};
    const previewLine=previewByFeed.get(feed.id)||{stationId:station.id,feederId:feed.id,
      path:window.HETKPSFeederMap?.provisionalRoute?.(
        [station.lat,station.lng],tps.filter(t=>valid(t.lat,t.lng)).map(t=>[+t.lat,+t.lng]))||[],
      route:feed.route,tps:feed.tps||tps};
    group.projected=projectedTopology(group,previewLine);
    groups.push(group);
  }
  groups.sort((a,b)=>a.station.name.localeCompare(b.station.name,'uz')||a.feed.name.localeCompare(b.feed.name,'uz'));
  return {groups,issues,totalTps:groups.reduce((s,g)=>s+g.allTps.length,0),
    totalLinked:groups.reduce((s,g)=>s+g.linked.length,0),
    totalEstimated:groups.reduce((s,g)=>s+g.projected.estimatedCount,0)};
}
/* All permitted GPS points on the GIS layer, not merely the local
 * DispatchGridSimulation.tps list. A TP that has no feeder remains a map
 * marker in a broad/territorial view, NEVER a synthesized electrical link.
 */
function mapTpMarkers(points,folders,preview,filter={},canSee=()=>true){
  const visible=preview?.visibleStations||[];
  const feeders=new Map(visible.flatMap(ps=>(ps.feeders||[]).map(f=>[f.id,{station:ps,feed:f}])));
  const ids=new Set(feeders.keys()),rows=[];
  for(const [id,tp] of Object.entries(points||{})){
    if(!tp||!valid(tp.lat,tp.lng))continue;
    const owning=tpFolders(tp);
    if(owning.length && !owning.some(fid=>canSee(fid)))continue;
    const fid=nearestFeeder(tp,ids,folders),link=feeders.get(fid);
    if(filter.ps&&link?.station.id!==filter.ps)continue;
    if(filter.feeder&&fid!==filter.feeder)continue;
    if([filter.region,filter.territory].filter(Boolean).some(scope=>
      !owning.some(own=>ancestors(own,folders).includes(scope))&&
      !(link&&feedBelongs(link.station,link.feed,{region:scope},folders))))continue;
    rows.push({id,name:tp.name||tp.address||id,lat:+tp.lat,lng:+tp.lng,
      kva:tp.power??tp.kva??'',private:tp.isPrivate===true,
      feederId:fid,feederName:link?.feed.name||'',kv:link?.feed.kv,stationName:link?.station.name||''});
  }
  return rows;
}
function subtreeLayout(group,baseY){
  const byId=group.byId,children=group.children;
  const levels=new Map(),locations=new Map();let cursor=baseY+90,maxDepth=0;
  function assign(id,depth){
    if(depth>40)return baseY+80;
    const kids=children.get(id)||[];
    const ys=kids.map(k=>assign(k.id,depth+1));
    const y=ys.length?(ys[0]+ys[ys.length-1])/2:cursor;
    if(!ys.length)cursor+=100;
    maxDepth=Math.max(maxDepth,depth);
    const x=depth===0?151:310+Math.min(depth-1,14)*190;
    locations.set(id,{x,y});
    return y;
  }
  assign('ps',0);
  return {locations,baseY,height:Math.max(180,cursor-baseY+36),maxDepth};
}
function tspan(lines,x,y,color='#153e66',bold=false){return lines.map((text,i)=>`<text x="${x}" y="${y+i*15}" fill="${color}" font-size="${i===0?12:10}" font-weight="${bold&&i===0?800:550}" text-anchor="middle">${esc(text)}</text>`).join('');}
function box(x,y,w,h,fill,stroke,children,r=9){return `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${children}</g>`;}
function wrapLabel(value,maxLen=22){
  const result=[];let line='';
  for(const word of String(value||'').trim().split(/\s+/).filter(Boolean)){
    if(line&&line.length+1+word.length>maxLen){result.push(line);line='';}
    if(word.length>maxLen){if(line){result.push(line);line='';}for(let i=0;i<word.length;i+=maxLen)result.push(word.slice(i,i+maxLen));}
    else line=line?line+' '+word:word;
  }
  if(line)result.push(line);
  return result.length?result:['Nomsiz'];
}
function centeredLines(lines,x,y,color='#153e66',size=11,weight=700){
  return lines.map((v,i)=>`<text x="${x}" y="${y+i*14}" text-anchor="middle" fill="${color}" font-size="${size}" font-weight="${weight}">${esc(v)}</text>`).join('');
}
/* Both tabs are views of the SAME projected tree. The simple view omits
 * support detail; the technical view adds a shina, branches, pole numbers and
 * entered segment annotations. No "unlinked KTP" card grid remains.
 */
function render(model,opts={}){
  const technical=!!opts.technical,animate=opts.animate!==false;
  const all=model?.groups||[],maxGroups=Math.min(all.length,opts.maxGroups||(opts.svgOnly?500:90));
  const groups=all.slice(0,maxGroups);
  if(!groups.length)return '<div class="dg-mnemo-empty">Tanlangan hudud va kuchlanishda fider mavjud emas.</div>';
  const lineWidth=[2,3,4,5].includes(+opts.lineWidth)?+opts.lineWidth:3;
  const parts=[],widths=[];let offset=35;
  for(let index=0;index<groups.length;index++){
    const g=groups[index],top=offset,color=colors[g.feed.kv]||colors[10];
    const projection=g.projected||{nodes:[],children:new Map([['ps',[]]]),byId:new Map(),estimatedCount:0,confirmedCount:0,recordedSegments:0};
    const positions=new Map(),startY=top+(technical?174:118);
    let leafY=startY,maxDepth=0;
    function walk(id,depth,visiting=new Set()){
      if(depth>100||visiting.has(id))return leafY;
      const kids=projection.children.get(id)||[];
      let y;
      if(!kids.length){y=leafY;leafY+=technical?73:66;}
      else{
        const ys=kids.map(p=>walk(p.id,depth+1,new Set([...visiting,id])));
        y=(ys[0]+ys[ys.length-1])/2;
      }
      const x=(technical?205:180)+Math.min(depth,100)*(technical?142:132);
      positions.set(id,{x,y});maxDepth=Math.max(maxDepth,depth);
      return y;
    }
    walk('ps',0);
    const root=positions.get('ps')||{x:technical?205:180,y:startY};
    const height=Math.max(technical?260:185,leafY-top+14);
    const needWidth=Math.max(1200,300+Math.min(maxDepth,100)*(technical?142:132)+200);
    widths.push(needWidth);
    const content=[];
    content.push(`<rect x="35" y="${top}" width="{paneWidth}" height="${height}" rx="13" fill="${index%2?'#fafdff':'#fff'}" stroke="#cbdced" stroke-width="1.5"/>`);
    content.push(`<text x="57" y="${top+27}" font-size="15" font-weight="800" fill="#174675">${esc(g.station.name)}</text>`);
    content.push(`<text x="57" y="${top+47}" font-size="11" fill="#4f718f">${esc(g.feed.name)} · ${g.feed.kv} kV · ${g.allTps.length} TP/KTP · ${projection.recordedSegments} kiritilgan nuqta · ${projection.estimatedCount} taxminiy ulanish</text>`);
    if(technical){
      const busY=top+77;
      content.push(`<path d="M 78 ${busY} H {busEnd}" stroke="${color}" stroke-width="${Math.max(6,lineWidth+3)}"/>`);
      content.push(`<text x="{busLabel}" y="${busY-12}" text-anchor="end" fill="${color}" font-size="11" font-weight="800">${g.feed.kv} kV · shina (shartli)</text>`);
      content.push(`<circle cx="${root.x}" cy="${busY}" r="5" fill="white" stroke="${color}" stroke-width="2"/>`);
      content.push(`<path d="M${root.x} ${busY+5} V${root.y}" stroke="${color}" stroke-width="${lineWidth}"/>`);
      content.push(`<circle cx="${root.x}" cy="${busY+37}" r="4" fill="#fff" stroke="${color}" stroke-width="2"/>`);
      content.push(`<text x="${root.x+18}" y="${busY+41}" font-size="11" font-weight="700" fill="#214e75">${esc(g.feed.name)}</text>`);
    }else{
      // Source block in the simple view (no fabricated breaker symbol).
      const psY=root.y-25;
      content.push(box(65,psY,175,53,'#164a7b','#164a7b',
        centeredLines(wrapLabel(g.station.name,24).slice(0,2),152,psY+19,'#fff',11,750)+
        `<text x="152" y="${psY+45}" text-anchor="middle" fill="#d0e7ff" font-size="10">${g.feed.kv} kV</text>`,11));
    }
    for(const n of projection.nodes){
      const parent=positions.get(n.parentId),to=positions.get(n.id);
      if(!parent||!to)continue;
      const estimated=n.estimated===true,empty=n.noGps===true;
      const segmentColor=empty?'#96a2b1':n.mode==='cable'?'#a769c8':color;
      const mid=Math.round((parent.x+to.x)/2);
      const path=`M${parent.x} ${parent.y} H${mid} V${to.y} H${to.x}`;
      const dashed=estimated||n.mode==='cable';
      content.push(`<path d="${path}" fill="none" stroke="${segmentColor}" stroke-width="${lineWidth}" ${dashed?`stroke-dasharray="${estimated?'7 6':'4 5'}"`:''} stroke-linejoin="round" stroke-linecap="round"/>`);
      if(animate&&!empty){
        content.push(`<circle r="3.2" fill="#fff" stroke="${segmentColor}" stroke-width="1" class="dg-mnemo-light"><animateMotion path="${path}" dur="${estimated?'4.2':'3.5'}s" repeatCount="indefinite"/></circle>`);
      }
      const manualRaw=g.notes[n.id],manual=typeof manualRaw==='string'?manualRaw:manualRaw?.text;
      if(technical&&(manual||n.recorded)){
        // If an explicit leg was split by a provisional TP branch, keep
        // its original recorded start point for the length annotation.
        const sourcePoint=n.recorded?g.byId.get(n.id):null;
        const sourceParent=sourcePoint?.parentId||n.parentId;
        const prev=sourceParent==='ps'?g.station:(sourcePoint?g.byId.get(sourceParent):projection.byId.get(sourceParent));
        const distance=km(prev,n);
        const defaultInfo=technical?(n.kind==='pole'?'Tayanch ':n.kind==='cable'?'Kabel ':n.kind==='turn'?'Burilish ':n.kind==='tp'?'TP ':'')+(n.number||'')+(distance==null?'':' · '+Math.round(distance*1000)+' m'):'';
        if(manual||n.recorded){
          content.push(`<g class="dg-mnemo-note" ${opts.svgOnly?'':`data-mnemo-note="${esc(n.id)}" data-mnemo-feeder="${esc(g.feed.id)}" role="button" tabindex="0"`}><title>${esc(defaultInfo)}</title><text x="${mid+5}" y="${Math.min(parent.y,to.y)-9}" font-size="9.5" fill="${manual?'#9b5c19':'#6e8196'}">${esc(manual||defaultInfo)}${manual?' ✎':''}</text></g>`);
        }
      }
      if(n.kind==='tp'){
        const tp=n.tp;
        if(!tp){
          content.push(`<circle cx="${to.x}" cy="${to.y}" r="7" stroke="#d86a38" stroke-width="2" fill="#fff"/><text x="${to.x+12}" y="${to.y+4}" fill="#a65831" font-size="10">TP havolasi yo‘q</text>`);
          continue;
        }
        const names=wrapLabel(tp.name,19).slice(0,3),h=Math.max(47,23+names.length*13);
        const fill=empty?'#fff6de':tp.isPrivate?'#ffebee':'#eaf3ff',outline=empty?'#b68b37':tp.isPrivate?'#d14a5e':'#377bd2';
        const labelY=to.y-(names.length*13)/2+1;
        const label=centeredLines(names,to.x,labelY,'#21486e',10,750)
          +`<text x="${to.x}" y="${to.y+names.length*6.5+11}" fill="#426783" font-size="9" text-anchor="middle">${tp.kva!==''?esc(tp.kva+' kVA'):'kVA yo‘q'}${empty?' · GPS yo‘q':estimated?' · ≈':''}</text>`;
        content.push(box(to.x-67,to.y-h/2,134,h,fill,outline,label,9));
      }else if(n.virtualJunction){
        content.push(`<circle cx="${to.x}" cy="${to.y}" r="${technical?4.5:3.5}" fill="${estimated?'#fff':segmentColor}" stroke="${segmentColor}" stroke-width="2"/>`);
      }else{
        content.push(`<circle cx="${to.x}" cy="${to.y}" r="${n.kind==='pole'?5:4.5}" fill="#fff" stroke="${segmentColor}" stroke-width="2"/>`);
        if(technical&&n.number)content.push(`<text x="${to.x}" y="${to.y+18}" text-anchor="middle" fill="#3b5877" font-size="10">${esc(n.number)}</text>`);
      }
    }
    content.push(`<text x="{busLabel}" y="${top+height-14}" text-anchor="end" font-size="10" fill="#6e8195">${projection.estimatedCount?'Uzlukli chiziq: GPS bo‘yicha taxminiy ulanish · ':''}${projection.confirmedCount} ta kiritilgan TP ulanishi</text>`);
    parts.push(content.join(''));
    offset+=height+17;
  }
  const width=Math.max(1260,...widths.map(x=>x+65));
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" class="dg-mnemo-svg ${technical?'dg-mnemo-technical-svg':''}" width="${width}" height="${offset+20}" viewBox="0 0 ${width} ${offset+20}" role="img" aria-label="Avtomatik 6/10 kV mnemosxema"><rect width="${width}" height="${offset+20}" fill="#edf4fb"/><text x="37" y="23" fill="#1c507e" font-size="14" font-weight="800">${technical?'Texnik bir chiziqli sxema':'Sodda mnemosxema'} · GIS yo‘nalishidan avtomatik</text><g transform="translate(${Math.max(500,width-510)},5)"><path d="M0 11h28" stroke="#e3a640" stroke-width="3"/><text x="35" y="15" font-size="10" fill="#46627b">Kiritilgan trassa</text><path d="M170 11h29" stroke="#e3a640" stroke-width="3" stroke-dasharray="6 5"/><text x="207" y="15" font-size="10" fill="#46627b">Taxminiy</text></g>${parts.join('').replaceAll('{paneWidth}',String(width-70)).replaceAll('{busEnd}',String(width-115)).replaceAll('{busLabel}',String(width-122))}</svg>`;
  if(opts.svgOnly)return svg;
  const hidden=all.length-maxGroups;
  const tps=groups.reduce((a,g)=>a+g.allTps.length,0),recorded=groups.reduce((a,g)=>a+g.projected.confirmedCount,0),approx=groups.reduce((a,g)=>a+g.projected.estimatedCount,0);
  const warning=hidden?`<div class="dg-mnemo-warning">${maxGroups} fider ko‘rsatilmoqda; qolgan ${hidden} tasi uchun parametrdan PS yoki fiderni tanlang.</div>`:'';
  return `<div class="dg-mnemo-toolbar"><strong>⚡ ${technical?'Texnik bir chiziqli sxema':'Jonli mnemosxema'}</strong><span>${groups.length} fider · ${tps} TP/KTP · ${recorded} aniq · ${approx} taxminiy</span></div>${warning}<div class="dg-mnemo-scroller">${svg}</div><div class="dg-mnemo-hint">Uzluksiz liniyalar — kiritilgan trassa bo‘laklari; uzlukli liniyalar — xaritadagi GPS bo‘yicha taxminiy yo‘nalish. Yangi TP/KTP va tayanchlar kiritilsa, xarita va ushbu sxema avtomatik qayta tuziladi. Bu SCADA yoki real tok holati emas.</div>`;
}
function downloadSvg(svg,fileName){
  if(!svg||!/^<svg[\s>]/.test(svg))throw new Error('Vektor sxema topilmadi');
  const blob=new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n',svg],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName||'HETK-mnemosxema.svg';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
window.HETKLiveMnemo={build,render,mapTpMarkers,downloadSvg,feedBelongs,version:'83-auto-gis-progressive'};
})();
