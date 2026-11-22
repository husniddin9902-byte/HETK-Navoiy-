/* HETK v84: read-only automatic schematic, derived from the SAME provisional
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
/* v84: one connected, filter-driven SVG for ALL visible PS and feeders.
 * Each PS is drawn ONCE, its feeder outlets use shared voltage-specific
 * conditional buses, and the projected GIS routes stay in the same drawing.
 * Not a SCADA state and not a claim that provisional GPS legs are confirmed.
 */
function render(model,opts={}){
  const technical=!!opts.technical,animate=opts.animate!==false;
  const groups=model?.groups||[];
  if(!groups.length&&!opts.legacy?.stations?.length)return '<div class="dg-mnemo-empty">Tanlangan hudud va kuchlanishda obyekt mavjud emas.</div>';
  const lineWidth=[2,3,4,5].includes(+opts.lineWidth)?+opts.lineWidth:3;
  const leafStep=technical?69:62,depthStep=technical?157:148;
  const byStation=new Map();
  for(const group of groups){
    const id=group.station.id;
    if(!byStation.has(id))byStation.set(id,{id,station:group.station,feeders:[]});
    byStation.get(id).feeders.push(group);
  }
  // Incorporate only PS and high-voltage edges explicitly present in the
  // existing dispatch model. Their simulated state is NOT real switchgear.
  const legacy=opts.legacy||{},legacyMap=new Map();
  const allLegacyIds=new Set((legacy.stations||[]).map(ps=>ps.id));
  const eligibleLines=(legacy.lines||[]).filter(l=>l&&allLegacyIds.has(l.a)&&allLegacyIds.has(l.b)&&(!opts.voltage||opts.voltage[l.voltage]));
  const eligibleLegacyPs=new Set(eligibleLines.flatMap(l=>[l.a,l.b]));
  for(const ps of legacy.stations||[]){
    if(!ps||ps.kind==='tap'||!ps.id)continue;
    if(!eligibleLegacyPs.has(ps.id)&&!byStation.has(ps.folderId)&&!byStation.has(ps.id))continue;
    const key=ps.folderId&&byStation.has(ps.folderId)?ps.folderId:
      byStation.has(ps.id)?ps.id:'legacy:'+ps.id;
    if(!byStation.has(key))byStation.set(key,{id:key,station:{id:key,name:ps.name||'PS',lat:ps.lat,lng:ps.lng,volts:ps.volts},feeders:[],legacyId:ps.id});
    if(!byStation.get(key).legacyId)byStation.get(key).legacyId=ps.id;
    legacyMap.set(ps.id,key);
  }
  const highLines=eligibleLines.filter(l=>legacyMap.has(l.a)&&legacyMap.has(l.b)&&
    legacyMap.get(l.a)!==legacyMap.get(l.b)&&(!opts.voltage||opts.voltage[l.voltage]));
  const stations=[...byStation.values()].sort((a,b)=>String(a.station.name).localeCompare(String(b.station.name),'uz'));
  let totalTP=0,totalEstimated=0,totalConfirmed=0,totalRecorded=0;
  function feederLayout(group){
    const p=group.projected||{nodes:[],children:new Map([['ps',[]]]),byId:new Map(),estimatedCount:0,confirmedCount:0,recordedSegments:0};
    const positions=new Map();let cursor=46,maxDepth=0;
    function visit(id,depth,ancestors){
      if(depth>120||ancestors.has(id))return cursor;
      const kids=p.children.get(id)||[];
      const next=new Set(ancestors);next.add(id);
      const ys=kids.map(child=>visit(child.id,depth+1,next));
      let y;if(ys.length)y=(ys[0]+ys[ys.length-1])/2;
      else{y=cursor;cursor+=leafStep;}
      positions.set(id,{x:depth*depthStep,y});maxDepth=Math.max(maxDepth,depth);
      return y;
    }
    visit('ps',0,new Set());
    totalTP+=group.allTps?.length||0;
    totalEstimated+=p.estimatedCount||0;totalConfirmed+=p.confirmedCount||0;
    totalRecorded+=p.recordedSegments||0;
    return {group,projection:p,positions,maxDepth,height:Math.max(110,cursor+18),rootY:positions.get('ps')?.y||46};
  }
  for(const st of stations){
    // Busways of different voltage classes must never be shorted together.
    st.feeders.sort((a,b)=>num(b.feed.kv)-num(a.feed.kv)||String(a.feed.name).localeCompare(String(b.feed.name),'uz'));
    st.feederLayouts=st.feeders.map(feederLayout);
    st.busGroups=new Map();let y=78;
    for(const fl of st.feederLayouts){
      fl.top=y;fl.rootWorldY=y+fl.rootY;
      const kv=+fl.group.feed.kv;
      if(!st.busGroups.has(kv))st.busGroups.set(kv,[]);
      st.busGroups.get(kv).push(fl);
      y+=fl.height+24;
    }
    st.height=Math.max(270,y+25);
    st.width=Math.max(930,...st.feederLayouts.map(f=>580+depthStep*f.maxDepth+130));
    st.psY=(st.feederLayouts[0]?.rootWorldY+st.feederLayouts[st.feederLayouts.length-1]?.rootWorldY)/2||130;
  }
  // Adaptive columns give a coherent single sheet rather than one long
  // separate bordered panel per feeder. Stations remain distinct electrical
  // sources: never invent PS-to-PS conductors without a recorded connection.
  if(!stations.length)return '<div class="dg-mnemo-empty">Tanlangan hudud va kuchlanishda obyekt mavjud emas.</div>';
  const totalHeight=stations.reduce((sum,s)=>sum+s.height+100,0);
  const largest=Math.max(...stations.map(s=>s.height));
  const columnTarget=Math.max(largest,1700,Math.min(11000,Math.sqrt(totalHeight*1550)));
  let colX=60,colY=70,colW=0,canvasH=0;
  for(const st of stations){
    if(colY>70&&colY+st.height>columnTarget+70){colX+=colW+110;colY=70;colW=0;}
    st.x=colX;st.y=colY;colY+=st.height+95;
    colW=Math.max(colW,st.width);canvasH=Math.max(canvasH,colY);
  }
  const width=Math.ceil(colX+colW+80),height=Math.ceil(canvasH+60);
  const defs='<defs><pattern id="dg84-grid" width="100" height="100" patternUnits="userSpaceOnUse"><path d="M100 0H0V100" fill="none" stroke="#edf3f9" stroke-width="0.8"/></pattern></defs>';
  const background=`<rect width="${width}" height="${height}" fill="white"/><rect width="${width}" height="${height}" fill="url(#dg84-grid)"/>`;
  const wires=[],labels=[],nodes=[];
  const bySceneId=new Map(stations.map(st=>[st.id,st]));
  for(const line of highLines){
    const a=bySceneId.get(legacyMap.get(line.a)),b=bySceneId.get(legacyMap.get(line.b));
    if(!a||!b)continue;
    const x1=a.x+105,y1=a.y+a.psY,x2=b.x+105,y2=b.y+b.psY;
    const c=colors[line.voltage]||'#4776a2',midX=Math.min(x1,x2)-58;
    // The high-voltage relationship exists in the virtual dispatch model;
    // show it in this SAME view, behind low-voltage feeders, without making
    // assumptions about actual QF, energized status or feeder interlocks.
    const path=`M${x1} ${y1}H${midX}V${y2}H${x2}`;
    wires.push(`<g class="dg-mnemo-high-voltage"><title>${esc(line.name||'Liniya')} · ${esc(line.voltage)} kV · dispetcherlik virtual modeli</title><path d="${path}" fill="none" stroke="${c}" stroke-width="${Math.max(4,lineWidth+1)}" stroke-dasharray="12 6" opacity=".85" stroke-linejoin="round"/></g>`);
    labels.push(`<text x="${midX-5}" y="${Math.min(y1,y2)-12}" fill="${c}" font-weight="800" font-size="11">${esc(line.name||'Liniya')} · ${esc(line.voltage)} kV (virtual)</text>`);
  }
  for(const st of stations){
    const sx=st.x,sy=st.y,psX=sx+105,psY=sy+st.psY;
    const buses=[...st.busGroups.entries()];
    // Each feeder exits only the same-voltage bus. It is a conditional bus:
    // its physical switchgear topology is not inferred from the folder tree.
    buses.forEach(([kv,feeders],busIndex)=>{
      const busX=sx+310+busIndex*42,sourceX=psX+94;
      const ys=feeders.map(f=>sy+f.rootWorldY),start=Math.min(...ys),end=Math.max(...ys),mid=(start+end)/2;
      const c=colors[kv]||colors[10];
      wires.push(`<path d="M${sourceX} ${psY} H${busX-20} V${mid} H${busX}" fill="none" stroke="${c}" stroke-width="${lineWidth}" stroke-dasharray="5 5" stroke-linejoin="round" opacity=".74"/>`);
      wires.push(`<path d="M${busX} ${Math.min(start,mid)-14}V${Math.max(end,mid)+14}" stroke="${c}" stroke-width="${technical?7:5}" fill="none" stroke-linecap="square"/>`);
      labels.push(`<text x="${busX+12}" y="${Math.min(start,mid)-23}" class="dg-mnemo-station-label" font-size="12" font-weight="800" fill="${c}">${kv} kV · shina (shartli)</text>`);
      for(const fl of feeders){
        const rootY=sy+fl.rootWorldY,feedX=sx+530,leadX=feedX-35;
        const path=`M${busX} ${rootY}H${leadX}`;
        wires.push(`<path d="${path}" stroke="${c}" stroke-width="${lineWidth}" fill="none"/>`);
        wires.push(`<circle cx="${busX}" cy="${rootY}" r="4.5" fill="white" stroke="${c}" stroke-width="2"/>`);
        // No switch state is known; the outlet symbol is a passive connection.
        if(technical)wires.push(`<path d="M${busX+17} ${rootY-6}v12m9-12v12" stroke="${c}" stroke-width="1.7" fill="none"/>`);
        labels.push(`<text x="${leadX-4}" y="${rootY-13}" font-size="12" fill="#1e4f79" font-weight="800" text-anchor="end">${esc(fl.group.feed.name)} · ${kv} kV</text>`);
        const px=id=>{
          const p=fl.positions.get(id);return p?{x:feedX+p.x,y:sy+fl.top+p.y}:null;
        };
        const root=px('ps');
        if(root){wires.push(`<path d="M${leadX} ${rootY}H${root.x}" stroke="${c}" stroke-width="${lineWidth}" fill="none"/>`);}
        for(const n of fl.projection.nodes){
          const from=px(n.parentId),to=px(n.id);
          if(!from||!to)continue;
          const isEstimate=n.estimated===true,empty=n.noGps===true;
          const color=empty?'#91a2b4':n.mode==='cable'?'#a769c8':c;
          const tx=n.kind==='tp'?to.x-72:to.x;
          const midX=Math.min(tx-8,Math.round((from.x+tx)/2));
          const path=`M${from.x} ${from.y}H${midX}V${to.y}H${tx}`;
          const dashed=isEstimate||n.mode==='cable';
          wires.push(`<path d="${path}" fill="none" stroke="${color}" stroke-width="${lineWidth}" ${dashed?`stroke-dasharray="${isEstimate?'7 6':'4 5'}"`:''} stroke-linecap="round" stroke-linejoin="round"/>`);
          if(animate&&!empty)wires.push(`<circle r="2.8" fill="#fff" stroke="${color}" stroke-width="1" class="dg-mnemo-light"><animateMotion path="${path}" dur="${isEstimate?'5.2':'3.8'}s" repeatCount="indefinite"/></circle>`);
          const rawNote=fl.group.notes?.[n.id];
          const manual=typeof rawNote==='string'?rawNote:rawNote?.text;
          if(technical&&(manual||n.recorded)){
            const original=fl.group.byId?.get(n.id);
            const parent=original?.parentId==='ps'?fl.group.station:fl.group.byId?.get(original?.parentId);
            const dist=km(parent,original||n);
            const description=(n.kind==='pole'?'Tayanch ':n.kind==='cable'?'Kabel ':n.kind==='tp'?'TP ':'Nuqta ')+(n.number||'')+(dist==null?'':' · '+Math.round(dist*1000)+' m');
            labels.push(`<g class="dg-mnemo-note" ${opts.svgOnly?'':`data-mnemo-note="${esc(n.id)}" data-mnemo-feeder="${esc(fl.group.feed.id)}" role="button" tabindex="0"`}><title>${esc(description)}</title><text x="${midX+4}" y="${Math.min(from.y,to.y)-8}" font-size="10" fill="${manual?'#a35c1d':'#68829b'}">${esc(manual||description)}${manual?' ✎':''}</text></g>`);
          }
          if(n.kind==='tp'){
            if(!n.tp){nodes.push(`<circle cx="${to.x}" cy="${to.y}" r="6" fill="#fff" stroke="#c56f3b"/><title>TP havolasi yo‘q</title>`);continue;}
            const tp=n.tp,names=wrapLabel(tp.name,19).slice(0,3);
            const h=Math.max(46,25+names.length*14),x=to.x-70,y=to.y-h/2;
            const fill=empty?'#fff4df':tp.isPrivate?'#ffedf0':'#eaf4ff',edge=empty?'#b58f40':tp.isPrivate?'#d14a5e':'#377bd2';
            const text=centeredLines(names,to.x,to.y-(names.length*14)/2+2,'#19476e',10,750)
              +`<text x="${to.x}" y="${to.y+names.length*7+12}" text-anchor="middle" fill="#406787" font-size="9">${tp.kva!==''?esc(tp.kva+' kVA'):'kVA yo‘q'}${empty?' · GPS yo‘q':isEstimate?' · ≈':''}</text>`;
            nodes.push(`<g class="dg-mnemo-tp" aria-label="${esc(tp.name)}"><title>${esc(tp.name)} · ${esc(tp.kva)} kVA · ${isEstimate?'taxminiy':'kiritilgan'} ulanish</title>${box(x,y,140,h,fill,edge,text,10)}</g>`);
          }else if(n.virtualJunction){
            nodes.push(`<circle cx="${to.x}" cy="${to.y}" r="3.4" fill="${isEstimate?'#fff':color}" stroke="${color}" stroke-width="2"/>`);
          }else{
            nodes.push(`<circle cx="${to.x}" cy="${to.y}" r="${n.kind==='pole'?4.7:4}" fill="#fff" stroke="${color}" stroke-width="2"/>`);
            if(technical&&n.number)labels.push(`<text x="${to.x}" y="${to.y+19}" text-anchor="middle" font-size="10" fill="#365675">${esc(n.number)}</text>`);
          }
        }
      }
    });
    // PS rendered only once per station, regardless of the feeder count.
    const psName=wrapLabel(st.station.name,24).slice(0,3),bh=Math.max(66,psName.length*15+25);
    const psContent=centeredLines(psName,psX,psY-(psName.length*14)/2+4,'#fff',12,800)
      +`<text x="${psX}" y="${psY+psName.length*7+15}" text-anchor="middle" font-size="10" fill="#d4eaff">${esc(st.feeders.length?[...st.busGroups.keys()].join(' / ')+' kV · '+st.feeders.length+' fider':(st.station.volts||[]).join('/')+' kV · virtual PS')}</text>`;
    nodes.push(`<g class="dg-mnemo-station" ${st.legacyId&&!opts.svgOnly?`data-open-ps="${esc(st.legacyId)}" role="button" tabindex="0"`:''}><title>${esc(st.station.name)}</title>${box(psX-95,psY-bh/2,190,bh,'#134b7d','#1a6aa8',psContent,11)}</g>`);
  }
  const totalStations=stations.length;
  const summary=`${totalStations} PS · ${groups.length} fider · ${totalTP} TP/KTP · ${totalRecorded} tayanch/nuqta · ${totalEstimated} taxminiy ulanish${highLines.length?' · '+highLines.length+' virtual yuqori kuchlanish liniyasi':''}`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" class="dg-mnemo-svg ${technical?'dg-mnemo-technical-svg':''}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Barcha tanlangan PS va fiderlar bitta umumiy mnemosxemada">${defs}${background}<g class="dg-mnemo-wires">${wires.join('')}</g><g class="dg-mnemo-labels">${labels.join('')}</g><g class="dg-mnemo-nodes">${nodes.join('')}</g></svg>`;
  if(opts.svgOnly)return svg;
  return `<div class="dg-mnemo-toolbar"><strong>⚡ ${technical?'Umumiy texnik bir chiziqli sxema':'Umumiy jonli mnemosxema'}</strong><span>${summary}</span><div class="dg-mnemo-zoom-tools" role="group" aria-label="Sxemani yaqinlashtirish"><button type="button" data-action="mnemo-zoom-out" aria-label="Uzoqlashtirish" title="Uzoqlashtirish">−</button><span class="dg-mnemo-zoom-label" data-mnemo-zoom-label>100%</span><button type="button" data-action="mnemo-zoom-in" aria-label="Yaqinlashtirish" title="Yaqinlashtirish">+</button><button type="button" data-action="mnemo-zoom-fit" title="Butun sxemani sig‘dirish">⛶ Sig‘dirish</button><button type="button" data-action="mnemo-zoom-reset" title="100%">1:1</button></div></div><div class="dg-mnemo-scroller" tabindex="0" aria-label="Umumiy sxema; surish va Control bilan g‘ildirakni aylantirib kattalashtirish"><div class="dg-mnemo-scaled" data-original-width="${width}" data-original-height="${height}">${svg}</div></div><div class="dg-mnemo-hint">Barcha fiderlar bitta sxemada; qaysilarini ko‘rishni «Parametrlar»dagi filtr belgilaydi. Uzlukli liniyalar — GIS bo‘yicha taxminiy, uzluksiz liniyalar — kiritilgan trassa. Tayanch va TP/KTP qo‘shilsa sxema yangilanadi. Shinalar shartli, 35–500 kV bog‘lanishlar faqat kiritilgan virtual dispetcherlik modelidan; bu SCADA yoki real tok holati emas. Sichqoncha bilan suring, +/− tugmalari yoki Ctrl+g‘ildirakdan foydalaning.</div>`;
}

function downloadSvg(svg,fileName){
  if(!svg||!/^<svg[\s>]/.test(svg))throw new Error('Vektor sxema topilmadi');
  const blob=new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n',svg],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName||'HETK-mnemosxema.svg';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
window.HETKLiveMnemo={build,render,mapTpMarkers,downloadSvg,feedBelongs,version:'84-one-canvas-filtered'};
})();
