/* HETK 82: read-only live mnemonic projection of existing Folders + TPs + feederRoute6kv.
 * This module NEVER writes to Firebase and NEVER invents electrical connections.
 * SVG is vector; dynamic lights are an illustrative route animation, not SCADA telemetry.
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
function build(preview,points,folders,filter,voltage){
  const groups=[],issues=[];
  const stations=preview?.visibleStations||[];
  const feedIds=new Set(stations.flatMap(s=>s.feeders||[]).map(f=>f.id));
  const tpByFeed=new Map();
  for(const [id,tp] of Object.entries(points||{})){
    const fid=nearestFeeder(tp,feedIds,folders);
    if(!fid)continue;
    if(!tpByFeed.has(fid))tpByFeed.set(fid,[]);
    tpByFeed.get(fid).push({id,name:tp.name||tp.address||id,kva:tp.power??tp.kva??'',isPrivate:tp.isPrivate===true,lat:tp.lat,lng:tp.lng});
  }
  for(const station of stations)for(const feed of station.feeders||[]){
    if(!voltage?.[feed.kv]||!feedBelongs(station,feed,filter,folders))continue;
    const tps=(tpByFeed.get(feed.id)||[]).sort((a,b)=>a.name.localeCompare(b.name,'uz'));
    const rawPoints=Array.isArray(feed.route?.points)?feed.route.points:[];
    const graph=rawPoints.length&&window.HETKFeederRouteEditor?.graph?window.HETKFeederRouteEditor.graph(feed.route,station):null;
    const confirmed=!!(graph&&!graph.errors?.length&&valid(station.lat,station.lng));
    if(graph?.errors?.length)issues.push(`${feed.name}: trassa tekshiruvida xatolik bor`);
    const nodes=confirmed?rawPoints.map((p,i)=>({...p,sourceIndex:i})):[];
    const byId=new Map(nodes.map(p=>[p.id,p]));
    const children=new Map([['ps',[]],...nodes.map(p=>[p.id,[]])]);
    for(const p of nodes)if(children.has(p.parentId))children.get(p.parentId).push(p);
    // A TP is electrically connected only if the recorded feeder route has an
    // explicit TP endpoint ID. GPS closeness never creates a connection.
    const feederTps=new Map(tps.map(t=>[t.id,t]));
    // An endpoint naming a deleted/foreign TP must never be displayed as a
    // confirmed electrical consumer. Keep it as a warning, not a fake link.
    const linked=nodes.filter(p=>p.kind==='tp'&&p.tpId&&feederTps.has(p.tpId))
      .map(p=>({point:p,tp:feederTps.get(p.tpId)}));
    const linkedIds=new Set(linked.map(item=>item.tp.id));
    for(const p of nodes.filter(p=>p.kind==='tp'&&!feederTps.has(p.tpId)))
      issues.push(`${feed.name}: ${p.number||p.id} nuqtasida TP/KTP havolasi topilmadi`);
    const unlinked=tps.filter(tp=>!linkedIds.has(tp.id));
    groups.push({station,feed,linked,unlinked,nodes,byId,children,confirmed,graph,allTps:tps,notes:folders[feed.id]?.mnemoNotes||{}});
  }
  groups.sort((a,b)=>a.station.name.localeCompare(b.station.name,'uz')||a.feed.name.localeCompare(b.feed.name,'uz'));
  return {groups,issues,totalTps:groups.reduce((s,g)=>s+g.allTps.length,0),totalLinked:groups.reduce((s,g)=>s+g.linked.length,0)};
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
function render(model,opts={}){
  const animate=opts.animate!==false,technical=!!opts.technical;
  if(technical)return renderTechnical(model,opts);
  // Screen is virtualised at 90 feeder cards. An export must NEVER silently
  // omit the rest; the caller rejects >500 first with a filter instruction.
  const maxGroups=Math.min(model?.groups?.length||0,opts.maxGroups||(opts.svgOnly?500:90)),groups=(model?.groups||[]).slice(0,maxGroups);
  if(!groups.length)return `<div class="dg-mnemo-empty">Filtrga mos 6/10 kV fider topilmadi. PS papkasi, fider va uning bog‘lanishlarini tekshiring.</div>`;
  const all=[],extents=[];let y=30,width=1200;
  for(const group of groups){
    const layout=subtreeLayout(group,y),color=colors[group.feed.kv]||'#3186f6',lineWidth=[2,3,4,5].includes(+opts.lineWidth)?+opts.lineWidth:3;
    const visibleCount=group.nodes.length,hasRoute=group.confirmed&&visibleCount>0;
    const extraCount=group.unlinked.length;
    const headerH=hasRoute?Math.max(190,layout.height):150;
    const rowH=headerH+(extraCount?64+Math.ceil(extraCount/5)*42:0);
    const top=y+8, startX=40;
    let maxX=460;
    all.push(`<rect x="${startX}" y="${top}" width="{panelWidth}" height="${rowH}" rx="11" fill="${groups.indexOf(group)%2?'#f9fbff':'#fff'}" stroke="#d6e5f3" stroke-width="1.4"/>`);
    all.push(`<text x="58" y="${top+23}" fill="#174c7d" font-size="14" font-weight="800">${esc(group.feed.name)} · ${group.feed.kv} kV</text>`);
    if(group.station.crossTerritory||group.feed.crossTerritory)all.push(`<text x="58" y="${top+40}" fill="#6b7890" font-size="10">Hududlararo manba PS</text>`);
    const root=layout.locations.get('ps')||{x:102,y:top+80};
    const psRows=wrapLabel(group.station.name,22);
    const psW=198,psH=Math.max(62,27+psRows.length*14);
    const psTitle=centeredLines(psRows,root.x,root.y-(psRows.length*14)/2-1,'#fff',11,750)
      +`<text x="${root.x}" y="${root.y+(psRows.length*14)/2+9}" text-anchor="middle" fill="#beddfa" font-size="10">${group.feed.kv} kV</text>`;
    // The PS rectangle is drawn AFTER lines, so their source point never
    // crosses or obscures its complete name.
    const psBox=box(root.x-psW/2,root.y-psH/2,psW,psH,'#124879','#124879',psTitle);
    if(hasRoute){
      for(const p of group.nodes){
        const source=layout.locations.get(p.parentId),target=layout.locations.get(p.id);
        if(!source||!target)continue;
        const path=`M ${source.x} ${source.y} L ${source.x+45} ${source.y} L ${source.x+45} ${target.y} L ${target.x} ${target.y}`;
        const cable=p.mode==='cable';
        all.push(`<path d="${path}" fill="none" stroke="${cable?'#b46cc5':color}" stroke-width="${lineWidth}" ${cable?'stroke-dasharray="7 5"':''} stroke-linejoin="round"/>`);
        if(animate){
          all.push(`<circle r="3.5" fill="#fff" stroke="${color}" stroke-width="1" class="dg-mnemo-light"><animateMotion path="${path}" dur="${(2.8+Math.min(2,group.nodes.length/12)).toFixed(1)}s" repeatCount="indefinite" begin="0s"/></circle>`);
        }
        const parent=p.parentId==='ps'?group.station:group.byId.get(p.parentId);
        const dist=km(parent,p),poles=(p.kind==='pole'?1:0)+(p.mode==='overhead'?Math.max(0,num(p.intermediateCount)):0);
        const computed=`${poles} tayanch${dist!=null?' · '+Math.round(dist*1000)+' m':''}`;
        const note=group.notes[p.id],manual=typeof note==='string'?note:note?.text;
        const supportText=manual?String(manual):computed;
        const lx=p.parentId==='ps'?source.x+106:Math.min(source.x+54,target.x-26),ly=Math.min(source.y,target.y)-13;
        all.push(`<g class="dg-mnemo-note" ${!opts.svgOnly?`data-mnemo-note="${esc(p.id)}" data-mnemo-feeder="${esc(group.feed.id)}" role="button" tabindex="0"`:''}><title>${esc(computed)}${manual?' · Qo‘lda: '+esc(manual):''}</title><text x="${lx}" y="${ly}" font-size="9.5" fill="${manual?'#a45b14':'#425a75'}" ${manual?'font-weight="700"':''}>${esc(supportText)}${manual?' ✎':''}</text></g>`);
        if(p.kind==='tp'){
          const tp=group.allTps.find(t=>t.id===p.tpId);
          const privateTP=tp?.isPrivate===true;
          const nameRows=wrapLabel(tp?.name||p.number||'TP/KTP',20);
          const boxH=Math.max(52,28+nameRows.length*14);
          const nameTexts=centeredLines(nameRows,target.x,target.y-(nameRows.length*14)/2-2,privateTP?'#8e2635':'#154875',11,750);
          const powerText=`<text x="${target.x}" y="${target.y+nameRows.length*7+9}" text-anchor="middle" fill="${privateTP?'#8e2635':'#154875'}" font-size="10">${tp?.kva!==''&&tp?.kva!=null?esc(String(tp.kva)+' kVA'):'quvvat ko‘rsatilmagan'}</text>`;
          all.push(box(target.x-69,target.y-boxH/2,138,boxH,privateTP?'#ffe6e8':'#e5f1ff',privateTP?'#d54455':'#2c78d8',nameTexts+powerText));
          maxX=Math.max(maxX,target.x+92);
        }else{
          all.push(`<circle cx="${target.x}" cy="${target.y}" r="${p.kind==='pole'?4.7:5.7}" stroke="${color}" fill="#fff" stroke-width="2"/>`);
          if(technical||p.kind==='turn')all.push(`<text x="${target.x}" y="${target.y+19}" font-size="9.5" text-anchor="middle" fill="#56718b">${esc(p.number||'')}</text>`);
          maxX=Math.max(maxX,target.x+52);
        }
      }
    }else{
      all.push(`<text x="300" y="${root.y-4}" fill="#926c2c" font-size="13" font-weight="700">Fider yo‘nalishi GISda hali tasdiqlanmagan</text>`);
      all.push(`<text x="300" y="${root.y+16}" fill="#7a8b9e" font-size="11">Tarmoqni taxminan ulab chizmadik. Ulanish nuqtalarini kiriting.</text>`);
    }
    all.push(psBox);
    if(group.unlinked.length){
      const labelY=y+headerH+25;
      all.push(`<text x="58" y="${labelY}" fill="#966726" font-size="11" font-weight="750">Fider papkasidagi, lekin trassada ulanmagan TP/KTP (${group.unlinked.length})</text>`);
      group.unlinked.forEach((t,i)=>{
        const x=58+(i%5)*202,by=labelY+9+Math.floor(i/5)*42;
        const stroke=t.isPrivate?'#c84a58':'#94a5b8';
        const names=wrapLabel(t.name,25);
        const fontSize=names.length>1?9.0:10;
        all.push(box(x,by,188,31,t.isPrivate?'#ffe5e8':'#f1f5fa',stroke,centeredLines(names,x+94,by+(names.length>1?11:20),'#35536b',fontSize,600),6));
      });
      maxX=Math.max(maxX,1100);
    }
    extents.push({maxX});y+=rowH+14;
  }
  width=Math.min(3600,Math.max(1160,...extents.map(e=>e.maxX+90)));
  const fullHeight=Math.max(y+20,250);
  const body=all.join('').replaceAll('{panelWidth}',String(width-80));
  const headline=`<text x="41" y="22" font-weight="750" font-size="13" fill="#1b4c79">Jonli 6/10 kV mnemosxema · mavjud HETK ma’lumotlari</text>`;
  const legend=`<g transform="translate(${width-370},8)"><rect width="354" height="25" rx="6" fill="#edf5fc"/><circle cx="13" cy="12" r="6" fill="#e5f1ff" stroke="#2c78d8" stroke-width="1.5"/><text x="25" y="16" font-size="11" fill="#31546c">ETK</text><circle cx="100" cy="12" r="6" fill="#ffe6e8" stroke="#d54455" stroke-width="1.5"/><text x="112" y="16" font-size="11" fill="#31546c">Xususiy</text><path d="M185 12h27" stroke="#b46cc5" stroke-width="2" stroke-dasharray="5 3"/><text x="219" y="16" font-size="11" fill="#31546c">Yer osti kabeli</text></g>`;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" class="dg-mnemo-svg" width="${width}" height="${fullHeight}" viewBox="0 0 ${width} ${fullHeight}" role="img" aria-label="Jonli elektr taqsimot mnemosxemasi"><rect width="${width}" height="${fullHeight}" fill="#f3f7fc"/>${headline}${legend}${body}</svg>`;
  if(opts.svgOnly)return svg;
  const omitted=(model.groups.length-maxGroups);
  return `<div class="dg-mnemo-toolbar"><strong>⚡ Jonli mnemosxema</strong><span>${groups.length} fider · ${groups.reduce((s,g)=>s+g.allTps.length,0)} TP/KTP · ${groups.reduce((s,g)=>s+g.linked.length,0)} tasdiqlangan ulanish</span></div>${omitted?`<div class="dg-mnemo-warning">Birdaniga ${maxGroups} ta fider ko‘rsatilmoqda, yana ${omitted} tasi bor. Viloyat / PS / fider filtrini tanlang.</div>`:''}<div class="dg-mnemo-scroller">${svg}</div><div class="dg-mnemo-hint">Qizil ramka — xususiy TP/KTP. Ajratilgan TP/KTP fider papkasidan avtomatik olindi, ammo trassadagi elektr ulanishi hali belgilanmagan. Chiroqchalar — model yo‘nalishi, real tok o‘lchovi emas. Oraliq tayanchlar va GISdagi masofa kiritilgan koordinatalar asosida hisoblanadi.</div>`;
}
/* v82 technical view: genuine orthogonal single-line projection of the
 * entered PS → feeder → branch/pole → TP endpoint topology. Symbols for real
 * QF, isolators and transformers MUST NOT be invented from a folder name.
 */
function renderTechnical(model,opts={}){
  const allGroups=model?.groups||[];
  const count=Math.min(allGroups.length,opts.maxGroups||(opts.svgOnly?500:90));
  const groups=allGroups.slice(0,count);
  if(!groups.length)return '<div class="dg-mnemo-empty">Filtrga mos 6/10 kV fider topilmadi. PS va fider papkalarini tekshiring.</div>';
  const weight=[2,3,4,5].includes(+opts.lineWidth)?+opts.lineWidth:3,animate=opts.animate!==false;
  const shapes=[],widths=[];let offset=35;
  for(let index=0;index<groups.length;index++){
    const g=groups[index],color=colors[g.feed.kv]||colors[10];
    const good=g.confirmed&&g.nodes.length>0;
    const positions=new Map(),children=g.children;
    let leafY=offset+166,depthLimit=0;
    // A recorded route is a tree. Show actual junction hierarchy, including
    // bends and poles, and never infer edges by geographical proximity.
    function layout(id,depth,seen=new Set()){
      if(depth>45||seen.has(id))return leafY;
      const kids=good?(children.get(id)||[]):[];
      let y;if(!kids.length){y=leafY;leafY+=76;}
      else{const ys=kids.map(p=>layout(p.id,depth+1,new Set([...seen,id])));y=(ys[0]+ys[ys.length-1])/2;}
      const x=depth===0?160:330+(depth-1)*180;
      positions.set(id,{x,y});depthLimit=Math.max(depthLimit,depth);
      return y;
    }
    layout('ps',0);
    const branchHeight=good?Math.max(200,leafY-offset-48):170;
    const unlinked=g.unlinked,unlinkedRows=Math.ceil(unlinked.length/5);
    const rowH=branchHeight+(unlinked.length?78+unlinkedRows*55:0)+64;
    const paneWidth=Math.max(1160,good?Math.min(9000,470+Math.max(0,depthLimit-1)*180):1160);
    widths.push(paneWidth);
    const top=offset,root=positions.get('ps')||{x:160,y:offset+166};
    const con=[];
    con.push(`<rect x="32" y="${top}" width="{paneWidth}" height="${rowH}" rx="13" fill="${index%2?'#fbfdff':'#fff'}" stroke="#cadbe9" stroke-width="1.5"/>`);
    con.push(`<text x="56" y="${top+28}" font-size="15" fill="#153a65" font-weight="800">${esc(g.station.name)}</text>`);
    con.push(`<text x="56" y="${top+48}" font-size="11" fill="#60788e">PS · mavjud papka ma’lumotlari</text>`);
    // Horizontal 6/10 kV busbar and a schematic outgoing feeder tap. This is
    // an abstraction, NOT evidence about the number/state of switchgear.
    const busY=top+80;
    con.push(`<path d="M 82 ${busY} H ${paneWidth-55}" stroke="${color}" stroke-width="${Math.max(7,weight+3)}" stroke-linecap="square"/>`);
    con.push(`<text x="${paneWidth-55}" y="${busY-14}" text-anchor="end" font-size="11" font-weight="800" fill="${color}">${g.feed.kv} kV · shina (shartli)</text>`);
    con.push(`<circle cx="160" cy="${busY}" r="5.5" fill="#fff" stroke="${color}" stroke-width="2.5"/>`);
    const feederStart=busY+38;
    con.push(`<path d="M160 ${busY+5} V ${feederStart}" stroke="${color}" stroke-width="${weight}"/>`);
    // Breaker/isolator states are not part of the recorded feeder topology.
    // An unfilled labelled junction avoids signalling a fictitious closed QF.
    con.push(`<circle cx="160" cy="${feederStart}" r="4.3" stroke="${color}" stroke-width="2" fill="#fff"/>`);
    con.push(`<text x="183" y="${feederStart+4}" font-size="12" font-weight="800" fill="#214e76">${esc(g.feed.name)} · ${g.feed.kv} kV</text>`);
    con.push(`<path d="M160 ${feederStart+5} V ${root.y}" stroke="${good?color:'#b5c1d0'}" stroke-width="${weight}" ${good?'':'stroke-dasharray="7 6"'}/>`);
    if(good){
      const tpLookup=new Map(g.linked.map(link=>[link.point.id,link.tp]));
      for(const p of g.nodes){
        const from=positions.get(p.parentId),to=positions.get(p.id);
        if(!from||!to)continue;
        const midX=Math.round((from.x+to.x)/2), cable=p.mode==='cable';
        const path=`M ${from.x} ${from.y} H ${midX} V ${to.y} H ${to.x}`;
        const stroke=cable?'#ad68ce':color;
        con.push(`<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${weight}" ${cable?'stroke-dasharray="7 5"':''} stroke-linejoin="round"/>`);
        con.push(`<circle cx="${midX}" cy="${to.y}" r="2.9" fill="${stroke}"/>`);
        if(animate){con.push(`<circle r="3" fill="#fff" stroke="${stroke}" stroke-width="1" class="dg-mnemo-light"><animateMotion path="${path}" dur="3.5s" repeatCount="indefinite"/></circle>`);}
        const parent=p.parentId==='ps'?g.station:g.byId.get(p.parentId);
        const calculated=km(parent,p);
        const computed=`${p.kind==='pole'?1:0}${p.mode==='overhead'&&+p.intermediateCount?' + '+num(p.intermediateCount):''} tayanch${calculated==null?'':' · '+Math.round(calculated*1000)+' m'}`;
        const stored=g.notes[p.id],manual=typeof stored==='string'?stored:stored?.text;
        const note=String(manual||computed);
        con.push(`<g class="dg-mnemo-note" ${opts.svgOnly?'':`data-mnemo-note="${esc(p.id)}" data-mnemo-feeder="${esc(g.feed.id)}" role="button" tabindex="0"`}><title>${esc(computed)}</title><text x="${midX+5}" y="${Math.min(from.y,to.y)-10}" font-size="9.5" fill="${manual?'#97581b':'#597187'}">${esc(note)}${manual?' ✎':''}</text></g>`);
        if(p.kind==='tp'){
          const tp=tpLookup.get(p.id);
          if(tp){
            const label=wrapLabel(tp.name,18),h=Math.max(52,28+label.length*14),fill=tp.isPrivate?'#ffe9e8':'#e9f3ff',strokeTp=tp.isPrivate?'#d45565':'#2d7ee3';
            con.push(box(to.x-67,to.y-h/2,134,h,fill,strokeTp,centeredLines(label,to.x,to.y-(label.length*14)/2+2,'#163f66',10,750)+`<text x="${to.x}" y="${to.y+label.length*7+10}" text-anchor="middle" font-size="10" fill="#27496e">${tp.kva!==''?esc(tp.kva+' kVA'):'kVA kiritilmagan'}</text>`,11));
          }else{
            con.push(`<circle cx="${to.x}" cy="${to.y}" r="8" fill="#fff" stroke="#d96b35" stroke-width="2"/><text x="${to.x+14}" y="${to.y+4}" font-size="10" fill="#ac5326">TP havolasi topilmadi: ${esc(p.number||p.id)}</text>`);
          }
        }else{
          con.push(`<circle cx="${to.x}" cy="${to.y}" r="${p.kind==='pole'?4.5:5.5}" fill="#fff" stroke="${stroke}" stroke-width="2"/>`);
          if(p.number)con.push(`<text x="${to.x}" y="${to.y+19}" font-size="10" fill="#3b5d7a" text-anchor="middle">${esc(p.number)}</text>`);
        }
      }
    }else{
      con.push(`<text x="340" y="${root.y-12}" font-size="13" font-weight="800" fill="#9c6727">Elektr ulanish topologiyasi kiritilmagan / tasdiqlanmagan</text>`);
      con.push(`<text x="340" y="${root.y+10}" font-size="11" fill="#6f7f91">Fiderdan TP/KTPga elektr liniyasi taxmin bilan chizilmadi</text>`);
    }
    if(unlinked.length){
      const start=top+branchHeight+70;
      con.push(`<path d="M55 ${start-21} H${paneWidth-55}" stroke="#e1e7ed" stroke-width="1.5"/>`);
      con.push(`<text x="56" y="${start}" fill="#9a6123" font-size="12" font-weight="750">Ulanishi ko‘rsatilmagan TP/KTP · ${unlinked.length} ta (elektr chizig‘i ulanmagan)</text>`);
      unlinked.forEach((t,i)=>{
        const x=57+(i%5)*216,by=start+13+Math.floor(i/5)*55;
        const lines=wrapLabel(t.name,23),h=43;
        con.push(box(x,by,203,h,t.isPrivate?'#ffebec':'#f0f6fe',t.isPrivate?'#d35b6d':'#92a6bd',centeredLines(lines.slice(0,2),x+101,by+(lines.length>1?14:19),'#274e75',10,700)+`<text x="${x+101}" y="${by+35}" text-anchor="middle" font-size="9" fill="#697e91">${t.kva!==''?esc(t.kva+' kVA'):'quvvat ko‘rsatilmagan'}</text>`,8));
      });
    }
    con.push(`<text x="${paneWidth-55}" y="${top+rowH-12}" text-anchor="end" font-size="10" fill="#7c8997">${good?'GISda kiritilgan topologiya':'Topologiya mavjud emas'} · ${g.linked.length} tasdiqlangan TP/KTP</text>`);
    shapes.push(con.join(''));
    offset+=rowH+17;
  }
  const width=Math.max(1230,...widths.map(n=>n+64)),height=offset+16;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" class="dg-mnemo-svg dg-mnemo-technical-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="HETK texnik bir chiziqli mnemosxema"><rect width="${width}" height="${height}" fill="#edf4fb"/><text x="37" y="23" fill="#1d4e78" font-size="14" font-weight="800">Texnik bir chiziqli sxema · kiritilgan ma’lumotlar asosida</text>${shapes.join('').replaceAll('{paneWidth}',String(width-64))}</svg>`;
  if(opts.svgOnly)return svg;
  const hidden=allGroups.length-count;
  const metrics=`${groups.length} fider · ${groups.reduce((s,g)=>s+g.allTps.length,0)} TP/KTP · ${groups.reduce((s,g)=>s+g.linked.length,0)} tasdiqlangan TP ulanishi`;
  return `<div class="dg-mnemo-toolbar"><strong>⚡ Texnik bir chiziqli sxema</strong><span>${metrics}</span></div>${hidden?`<div class="dg-mnemo-warning">${count} ta fider chizildi; ${hidden} ta boshqa fider uchun parametrdan filtrlash kerak.</div>`:''}<div class="dg-mnemo-scroller">${svg}</div><div class="dg-mnemo-hint">Shina va fider chiqishlari sxematik. Transformator, o‘chirgich, ajratkich va ularning holatlari bazada ko‘rsatilmagan bo‘lsa, taxminan qo‘shilmaydi. Ko‘k/qizil TP ramkalari — ETK/xususiy; ulanishi qayd qilinmagan TP lar chiziqqa bog‘lanmaydi. Harakatli nuqtalar real telemetriya emas.</div>`;
}
function downloadSvg(svg,fileName){
  if(!svg||!/^<svg[\s>]/.test(svg))throw new Error('Vektor sxema topilmadi');
  const blob=new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n',svg],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName||'HETK-mnemosxema.svg';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
window.HETKLiveMnemo={build,render,mapTpMarkers,downloadSvg,feedBelongs,version:'82-technical-projection'};
})();
