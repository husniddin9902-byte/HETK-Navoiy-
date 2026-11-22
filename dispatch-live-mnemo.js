/* HETK 81: read-only live mnemonic projection of existing Folders + TPs + feederRoute6kv.
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
    const linkedIds=new Set(nodes.filter(p=>p.kind==='tp'&&p.tpId).map(p=>p.tpId));
    const linked=nodes.filter(p=>p.kind==='tp'&&p.tpId).map(p=>({point:p,tp:tps.find(t=>t.id===p.tpId)||{id:p.tpId,name:'TP ma’lumoti topilmadi',kva:'',isPrivate:false}}));
    const unlinked=tps.filter(tp=>!linkedIds.has(tp.id));
    groups.push({station,feed,linked,unlinked,nodes,byId,children,confirmed,graph,allTps:tps,notes:folders[feed.id]?.mnemoNotes||{}});
  }
  groups.sort((a,b)=>a.station.name.localeCompare(b.station.name,'uz')||a.feed.name.localeCompare(b.feed.name,'uz'));
  return {groups,issues,totalTps:groups.reduce((s,g)=>s+g.allTps.length,0),totalLinked:groups.reduce((s,g)=>s+g.linked.length,0)};
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
function downloadSvg(svg,fileName){
  if(!svg||!/^<svg[\s>]/.test(svg))throw new Error('Vektor sxema topilmadi');
  const blob=new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n',svg],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName||'HETK-mnemosxema.svg';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
window.HETKLiveMnemo={build,render,downloadSvg,feedBelongs,version:'81-readonly-projection'};
})();
