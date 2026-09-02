(function(){
'use strict';

let printSelection={type:null,id:null,name:'',items:[]};
let printRequestNo=0;

function hasActiveSearchOrFilter(){
    return !!(
        (searchState && String(searchState.text || '').trim()) ||
        (filterState && (
            filterState.balance !== 'none' || filterState.responsible !== 'none' ||
            filterState.created !== 'none' || filterState.updated !== 'none' ||
            filterState.comment !== 'none' || filterState.dual !== 'none' ||
            filterState.power !== 'none' || filterState.status !== 'none'
        ))
    );
}

function pointFolderIds(tp){
    if(tp && tp.folders) return Object.keys(tp.folders).filter(id=>tp.folders[id]);
    if(tp && tp.primaryFolderId) return [tp.primaryFolderId];
    if(tp && tp.folderId) return [tp.folderId];
    return [];
}

function pointWithinFolder(tp,folderId){
    if(folderId==='root') return hetkPointAllowedByUser(tp);
    const scope=new Set(getAllChildFolderIds(folderId));
    return hetkPointAllowedByUser(tp) && pointFolderIds(tp).some(id=>scope.has(id));
}

window.hetkSelectPrintFolder=function(folderId){
    printSelection={
        type:'folder',id:folderId,
        name:folderId==='root' ? 'Barcha ruxsat etilgan papkalar' : ((currentFolders[folderId] && currentFolders[folderId].name) || 'Tanlangan papka'),
        items:[]
    };
    window.hetkRefreshPrintSelection();
};

window.hetkSelectPrintElement=function(tp){
    if(!tp) return;
    const id=tp.id || tp.tpId || '';
    printSelection={type:'element',id,name:tp.name || 'Element',items:[Object.assign({},tp,{id})]};
    updateSelectionUI();
};

window.hetkResetPrintSelection=function(){
    printSelection={type:null,id:null,name:'',items:[]};
    printRequestNo++;
    updateSelectionUI();
    closeDialog();
};

window.hetkRefreshPrintSelection=async function(){
    if(!printSelection.type || printSelection.type==='element') return updateSelectionUI();
    const requestNo=++printRequestNo;
    let points=[];
    if(hasActiveSearchOrFilter() && searchState && Array.isArray(searchState.results)){
        points=searchState.results.filter(tp=>pointWithinFolder(tp,printSelection.id)).map(tp=>Object.assign({},tp,{id:tp.id || tp.tpId || ''}));
    }else{
        try{
            const snapshot=await database.ref('TPs').once('value');
            points=Object.entries(snapshot.val() || {}).map(([id,tp])=>Object.assign({},tp,{id})).filter(tp=>pointWithinFolder(tp,printSelection.id));
        }catch(error){
            console.error('PRINT ITEMS LOAD ERROR:',error);
            showToast('Chop etiladigan elementlarni yuklab bo‘lmadi.');
        }
    }
    if(requestNo!==printRequestNo) return;
    const unique=new Map();
    points.forEach(tp=>unique.set(tp.id || tp.tpId,tp));
    printSelection.items=Array.from(unique.values()).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'uz'));
    updateSelectionUI();
};

function updateSelectionUI(){
    const count=printSelection.items.length;
    const openBtn=document.getElementById('hetk-print-open');
    const badge=document.getElementById('hetk-print-count');
    const bar=document.getElementById('hetk-print-selection');
    const countText=document.getElementById('hetk-print-selection-count');
    const nameText=document.getElementById('hetk-print-selection-name');
    if(openBtn) openBtn.hidden=!printSelection.type || count===0;
    if(badge) badge.textContent=String(count);
    if(bar) bar.hidden=!printSelection.type || count===0;
    if(countText) countText.textContent=count+' ta element tanlandi';
    if(nameText) nameText.textContent=printSelection.name || '—';
}

function openDialog(){
    if(!printSelection.items.length) return showToast('Avval papka yoki elementni tanlang.');
    const overlay=document.getElementById('hetk-print-overlay');
    document.getElementById('hetk-print-source-name').textContent=printSelection.name || '—';
    document.getElementById('hetk-print-source-count').textContent=printSelection.items.length+' ta element';
    const icon=document.getElementById('hetk-print-source-icon');
    if(icon) icon.className=printSelection.type==='element' ? 'fas fa-bolt' : 'fas fa-folder';
    const portrait=document.querySelector('input[name="hetk-print-paper"][value="portrait"]');
    const landscape=document.querySelector('input[name="hetk-print-paper"][value="landscape"]');
    if(landscape) landscape.disabled=printSelection.type==='element';
    if(printSelection.type==='element' && portrait) portrait.checked=true;
    overlay.hidden=false;
    overlay.setAttribute('aria-hidden','false');
}

function closeDialog(){
    const overlay=document.getElementById('hetk-print-overlay');
    if(overlay){overlay.hidden=true;overlay.setAttribute('aria-hidden','true');}
}

function options(){
    const checked=(name,fallback)=>document.querySelector('input[name="'+name+'"]:checked')?.value || fallback;
    return {
        format:checked('hetk-print-format','pdf'),images:checked('hetk-print-images','none'),
        paper:checked('hetk-print-paper','portrait'),
        fields:Array.from(document.querySelectorAll('.hetk-print-field-grid input:checked')).map(input=>input.value)
    };
}

function printDate(value,withTime){
    if(!value) return '—';
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(value))){
        const parts=String(value).split('-');
        return parts[2]+'.'+parts[1]+'.'+parts[0];
    }
    const date=new Date(value);
    if(Number.isNaN(date.getTime())) return String(value);
    const dateOptions=withTime===false
        ? {day:'2-digit',month:'2-digit',year:'numeric'}
        : {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'};
    return date.toLocaleString('uz-UZ',dateOptions);
}

function statusLabel(value){
    return value==='excellent' ? 'Yaxshi' : value==='satisfactory' ? 'Qoniqarli' : value==='emergency' ? 'Avariya holatida' : (value || '—');
}

function primaryFolderId(tp){return tp.primaryFolderId || tp.folderId || pointFolderIds(tp)[0] || '';}
function primaryFolderName(tp){const id=primaryFolderId(tp);return (currentFolders[id] && currentFolders[id].name) || '—';}

function maintenanceRows(tp){
    const source=tp && tp.maintenanceHistory;
    const rows=Array.isArray(source) ? source : Object.values(source || {});
    return rows.filter(Boolean).map(hetkNormalizeRepair).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
}

function lastRepair(tp,type){
    return maintenanceRows(tp).filter(row=>row.type===type).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0] || null;
}

function actorName(){
    const me=hetkCurrentAccount();
    return me ? (me.fullName || me.login || 'Foydalanuvchi') : 'Foydalanuvchi';
}

function imageRecordUrl(img){
    if(!img) return '';
    if(img.fileId) return telegramFileUrl(img.fileId) || '';
    return img.url || '';
}

function blobToDataUrl(blob){
    return new Promise((resolve,reject)=>{
        const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);
    });
}

async function fetchPrintImage(img){
    const url=imageRecordUrl(img);
    if(!url) return '';
    if(String(url).startsWith('data:')) return url;
    try{
        const headers={};
        if(String(url).startsWith(TELEGRAM_WORKER_URL)) headers.Authorization='Bearer '+await getTelegramAuthToken();
        let response=await fetch(url,{headers});
        if(response.status===401 && String(url).startsWith(TELEGRAM_WORKER_URL)){
            const token=window.HETKAuth && window.HETKAuth.getIdToken ? await window.HETKAuth.getIdToken(true) : await getTelegramAuthToken();
            response=await fetch(url,{headers:{Authorization:'Bearer '+token}});
        }
        if(!response.ok) return '';
        return await blobToDataUrl(await response.blob());
    }catch(error){console.warn('PRINT IMAGE ERROR:',error);return '';}
}

async function qrDataUrl(text){
    if(!text || typeof QRCode==='undefined') return '';
    const host=document.createElement('div');
    host.style.cssText='position:fixed;left:-9999px;top:-9999px;background:#fff;padding:4px;';
    document.body.appendChild(host);
    try{
        new QRCode(host,{text,width:120,height:120,correctLevel:QRCode.CorrectLevel.M});
        await new Promise(resolve=>setTimeout(resolve,40));
        const canvas=host.querySelector('canvas');const image=host.querySelector('img');
        return canvas ? canvas.toDataURL('image/png') : (image ? image.src : '');
    }finally{host.remove();}
}

function docHeader(rightText){
    return '<div class="hetk-doc-brand"><div class="hetk-doc-logo">HETK</div><div class="hetk-doc-company">HUDUDIY ELEKTR TARMOQLARI KORXONASI<br>TERRITORIAL ELEKTR TARMOQLARI TIZIMI</div><div class="hetk-doc-class">'+hetkEscapeHtml(rightText || '10 kV sinf KTP/TP obyektlari')+'</div></div>';
}

function docFooter(pageText){
    return '<div class="hetk-doc-footer"><span>Fayl shakllantirildi: '+hetkEscapeHtml(printDate(Date.now()))+'</span><span>Shakllantirdi: '+hetkEscapeHtml(actorName())+'</span><span>'+hetkEscapeHtml(pageText || '')+'</span></div>';
}

function fact(icon,label,value){
    return '<div class="hetk-passport-fact"><i class="fas '+icon+'"></i><b>'+hetkEscapeHtml(label)+'</b><span>'+hetkEscapeHtml(value == null || value==='' ? '—' : value)+'</span></div>';
}

async function passportHtml(tp,opts){
    const images=Array.isArray(tp.images) ? tp.images : Object.values(tp.images || {});
    const wanted=opts.images==='none' ? [] : (opts.images==='main' ? [images[Number(tp.mainImageIndex)||0] || images[0]].filter(Boolean) : images);
    const imageData=[];for(const image of wanted) imageData.push(await fetchPrintImage(image));
    const main=imageData[0] || '';const thumbs=imageData.slice(1,4);
    const primaryId=primaryFolderId(tp);const path=primaryId ? getFolderPath(primaryId) : '—';
    const currentRepair=lastRepair(tp,'current');const capitalRepair=lastRepair(tp,'capital');
    const mapLink=(tp.lat && tp.lng) ? 'https://maps.google.com/?q='+tp.lat+','+tp.lng : '';
    const qr=await qrDataUrl(mapLink);
    const workZones=hetkGetTPWorkZoneNames(tp).join(', ') || tp.workZoneName || '—';
    const mahalla=tp.primaryMahalla || (tp.mahallaLinks && tp.mahallaLinks.map(x=>x.name).filter(Boolean).join(', ')) || '—';
    const facts=[
        fact('fa-bolt','Quvvati',tp.power ? tp.power+' kVA' : '—'),
        fact('fa-scale-balanced','Balans',tp.isPrivate ? 'Xususiy'+(tp.ownerFirm?' — '+tp.ownerFirm:'') : 'ETK'),
        fact('fa-shield-halved','Texnik holati',statusLabel(tp.status)),fact('fa-house','Mahalla',mahalla),
        fact('fa-helmet-safety','U/J',workZones),fact('fa-location-dot','Manzil',tp.address || '—'),
        fact('fa-crosshairs','Koordinata',tp.lat && tp.lng ? tp.lat+'; '+tp.lng : '—'),
        fact('fa-calculator','Balans hisoblagich',tp.balanceMeterSerial || tp.balanceMeterNumber || '—'),
        fact('fa-tower-broadcast','Konsentrator',tp.concentratorSerial || tp.concentratorNumber || '—'),
        fact('fa-calendar-check','Ishga tushirilgan',printDate(tp.commissionedDate,false)),
        fact('fa-screwdriver-wrench','Oxirgi joriy ta’mir',currentRepair ? printDate(currentRepair.date,false) : '—'),
        fact('fa-gears','Oxirgi kapital ta’mir',capitalRepair ? printDate(capitalRepair.date,false) : '—')
    ].join('');
    const thumbsHtml=thumbs.length ? '<div class="hetk-passport-thumbs">'+thumbs.map(src=>'<div><img src="'+src+'" alt="Element rasmi"></div>').join('')+'</div>' : '';
    const qrHtml=qr ? '<img src="'+qr+'" alt="Navigatsiya QR" style="width:28mm;height:28mm;">' : '<span>Koordinata mavjud emas</span>';
    let html='<section class="hetk-document-page">'+docHeader()+'<h1 class="hetk-doc-title">ELEMENT PASPORTI</h1>'+
        '<div class="hetk-doc-element-heading"><span class="name">'+hetkEscapeHtml(tp.name || 'ELEMENT')+'</span><span class="feeder">'+hetkEscapeHtml(primaryFolderName(tp))+'</span></div>'+
        '<div class="hetk-doc-path"><i class="fas fa-folder"></i> '+hetkEscapeHtml(path)+'</div><div class="hetk-passport-grid"><div>'+
        '<div class="hetk-passport-main-image">'+(main?'<img src="'+main+'" alt="Asosiy rasm">':'<div class="hetk-passport-placeholder"><i class="fas fa-image"></i><span>Rasm tanlanmagan</span></div>')+'</div>'+thumbsHtml+
        '</div><div class="hetk-passport-facts">'+facts+'</div></div><div class="hetk-doc-box"><h3><i class="fas fa-note-sticky"></i> Izohlar</h3>'+hetkEscapeHtml(tp.note || 'Izoh mavjud emas').replace(/\n/g,'<br>')+'</div>'+
        '<div class="hetk-doc-two"><div class="hetk-doc-box"><h3><i class="fas fa-calendar-days"></i> Yaratilgan / oxirgi tahrir</h3>Yaratilgan: '+hetkEscapeHtml(printDate(tp.createdAt))+'<br>Oxirgi tahrir: '+hetkEscapeHtml(printDate(tp.updatedAt))+'</div>'+
        '<div class="hetk-doc-box" style="display:flex;align-items:center;justify-content:center;gap:10px;"><div>'+qrHtml+'</div><div><b>NAVIGATSIYA (QR)</b><br>Joylashuvni xaritada ochish uchun skanerlang</div></div></div>'+docFooter('Sahifa 1')+'</section>';
    const history=maintenanceRows(tp);
    if(history.length){
        html+='<section class="hetk-document-page">'+docHeader('Ekspluatatsiya tarixi')+'<h2 class="hetk-doc-report-title">'+hetkEscapeHtml(tp.name || 'Element')+' — TA’MIRLASH TARIXI</h2><p class="hetk-doc-report-meta">Ishga tushirilgan: '+hetkEscapeHtml(printDate(tp.commissionedDate,false))+'</p>'+
            '<table class="hetk-doc-table"><thead><tr><th>№</th><th>Ta’mir turi</th><th>Sana</th><th>Bajarilgan ishlar</th><th>Izoh</th><th>Kiritgan xodim</th></tr></thead><tbody>'+history.map((row,index)=>'<tr><td>'+(index+1)+'</td><td>'+(row.type==='capital'?'Kapital ta’mir':'Joriy ta’mir')+'</td><td>'+hetkEscapeHtml(printDate(row.date,false))+'</td><td>'+hetkEscapeHtml(row.work||'—')+'</td><td>'+hetkEscapeHtml(row.note||'—')+'</td><td>'+hetkEscapeHtml(row.updatedByName||row.createdByName||'—')+'</td></tr>').join('')+'</tbody></table>'+docFooter('Ta’mirlash tarixi')+'</section>';
    }
    if(opts.images==='all' && imageData.length>4){
        html+='<section class="hetk-document-page">'+docHeader('Rasmlar ilovasi')+'<h2 class="hetk-doc-report-title">'+hetkEscapeHtml(tp.name || 'Element')+' — RASMLAR</h2><div class="hetk-doc-photo-appendix">'+imageData.slice(4).map((src,index)=>'<div class="hetk-doc-photo-card"><strong>Rasm '+(index+5)+'</strong><img src="'+src+'" alt="Element rasmi"></div>').join('')+'</div>'+docFooter('Rasmlar ilovasi')+'</section>';
    }
    return html;
}

const PRINT_FIELDS={
    feeder:{label:'1-papka (Fider)',value:tp=>primaryFolderName(tp)},name:{label:'Nomi',value:tp=>tp.name || '—'},
    power:{label:'Quvvati',value:tp=>tp.power ? tp.power+' kVA' : '—'},
    mahalla:{label:'Mahalla',value:tp=>tp.primaryMahalla || (tp.mahallaLinks||[]).map(x=>x.name).filter(Boolean).join(', ') || '—'},
    workzone:{label:'U/J',value:tp=>hetkGetTPWorkZoneNames(tp).join(', ') || tp.workZoneName || '—'},
    balance:{label:'Balans',value:tp=>tp.isPrivate ? 'Xususiy'+(tp.ownerFirm?' — '+tp.ownerFirm:'') : 'ETK'},
    status:{label:'Texnik holati',value:tp=>statusLabel(tp.status)},address:{label:'Manzil',value:tp=>tp.address || '—'},
    coords:{label:'Koordinata',value:tp=>tp.lat && tp.lng ? tp.lat+'; '+tp.lng : '—'},
    commissioned:{label:'Ishga tushirilgan',value:tp=>printDate(tp.commissionedDate,false)},
    repairs:{label:'Oxirgi ta’mir',value:tp=>{const rows=maintenanceRows(tp);const last=rows[rows.length-1];return last ? (last.type==='capital'?'Kapital':'Joriy')+' — '+printDate(last.date,false) : '—';}},
    balanceMeter:{label:'Balans hisoblagich',value:tp=>tp.balanceMeterSerial || tp.balanceMeterNumber || '—'},
    concentrator:{label:'Konsentrator',value:tp=>tp.concentratorSerial || tp.concentratorNumber || '—'},
    ownerFirm:{label:'Xususiy korxona',value:tp=>tp.ownerFirm || '—'},
    ownerName:{label:'Korxona vakili',value:tp=>tp.ownerName || '—'},
    ownerPhone:{label:'Korxona telefoni',value:tp=>tp.ownerPhone || '—'},
    createdAt:{label:'Yaratilgan sana',value:tp=>printDate(tp.createdAt)},
    updatedAt:{label:'Oxirgi tahrir',value:tp=>printDate(tp.updatedAt)},
    note:{label:'Izoh',value:tp=>tp.note || '—'}
};

async function reportHtml(items,opts){
    const fields=(opts.fields.length ? opts.fields : ['feeder','name']).filter(key=>PRINT_FIELDS[key]);
    const includeMain=opts.images==='main';const rows=[];const appendix=[];
    for(let i=0;i<items.length;i++){
        const tp=items[i];let mainData='';
        if(opts.images!=='none'){
            const images=Array.isArray(tp.images) ? tp.images : Object.values(tp.images || {});
            const mainRecord=images[Number(tp.mainImageIndex)||0] || images[0];
            if(mainRecord) mainData=await fetchPrintImage(mainRecord);
            if(opts.images==='all'){
                const all=[];for(const image of images){const data=await fetchPrintImage(image);if(data) all.push(data);}
                if(all.length) appendix.push({tp,images:all});
            }
        }
        rows.push('<tr><td>'+(i+1)+'</td>'+fields.map(key=>'<td>'+hetkEscapeHtml(PRINT_FIELDS[key].value(tp))+'</td>').join('')+(includeMain?'<td>'+(mainData?'<img src="'+mainData+'" style="width:26mm;height:20mm;object-fit:cover;">':'—')+'</td>':'')+'</tr>');
    }
    const landscape=opts.paper==='landscape';
    let html='<section class="hetk-document-page '+(landscape?'landscape':'')+'">'+docHeader()+'<h2 class="hetk-doc-report-title">ELEMENTLAR RO‘YXATI</h2><p class="hetk-doc-report-meta">Manba: '+hetkEscapeHtml(printSelection.name)+' • Jami: '+items.length+' ta element</p><table class="hetk-doc-table"><thead><tr><th>№</th>'+fields.map(key=>'<th>'+hetkEscapeHtml(PRINT_FIELDS[key].label)+'</th>').join('')+(includeMain?'<th>Asosiy rasm</th>':'')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table>'+docFooter(items.length+' ta element')+'</section>';
    if(opts.images==='all'){
        for(const entry of appendix){html+='<section class="hetk-document-page '+(landscape?'landscape':'')+'">'+docHeader('Rasmlar ilovasi')+'<h2 class="hetk-doc-report-title">'+hetkEscapeHtml(entry.tp.name || 'Element')+'</h2><div class="hetk-doc-photo-appendix">'+entry.images.map((src,index)=>'<div class="hetk-doc-photo-card"><strong>Rasm '+(index+1)+'</strong><img src="'+src+'" alt="Element rasmi"></div>').join('')+'</div>'+docFooter('Rasmlar ilovasi')+'</section>';}
    }
    return html;
}

async function buildDocument(opts){
    const pages=printSelection.type==='element' && printSelection.items.length===1
        ? await passportHtml(printSelection.items[0],opts)
        : await reportHtml(printSelection.items,opts);
    return '<div class="hetk-document-root">'+pages+'</div>';
}

function fileBase(){
    const clean=String(printSelection.name || 'HETK_elementlar').replace(/[^a-zA-Z0-9А-Яа-яЁёЎўҚқҒғҲҳ_-]+/g,'_').replace(/^_+|_+$/g,'');
    return 'HETK_'+(clean || 'elementlar')+'_'+new Date().toISOString().slice(0,10);
}

function downloadBlob(blob,fileName){
    const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
    anchor.href=url;anchor.download=fileName;document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
}

function wordValue(value){
    return String(value == null || value==='' ? '—' : value);
}

function dataUrlBytes(dataUrl){
    const encoded=String(dataUrl || '').split(',')[1] || '';
    const raw=atob(encoded);const bytes=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i++) bytes[i]=raw.charCodeAt(i);
    return bytes;
}

function normalizeWordImage(dataUrl,maxWidth,maxHeight){
    return new Promise(resolve=>{
        if(!dataUrl) return resolve(null);
        const image=new Image();
        image.onload=()=>{
            try{
                const scale=Math.min(1,maxWidth/image.naturalWidth,maxHeight/image.naturalHeight);
                const width=Math.max(1,Math.round(image.naturalWidth*scale));
                const height=Math.max(1,Math.round(image.naturalHeight*scale));
                const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
                const context=canvas.getContext('2d');context.fillStyle='#ffffff';context.fillRect(0,0,width,height);
                context.drawImage(image,0,0,width,height);
                resolve({type:'jpg',data:dataUrlBytes(canvas.toDataURL('image/jpeg',.9)),width,height});
            }catch(error){console.warn('WORD IMAGE CONVERT ERROR:',error);resolve(null);}
        };
        image.onerror=()=>resolve(null);image.src=dataUrl;
    });
}

function wordBorders(d,color){
    const border={style:d.BorderStyle.SINGLE,size:4,color:color || '9CB5CF'};
    return {top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border};
}

function wordParagraph(d,text,settings){
    settings=settings || {};
    const lines=wordValue(text).split(/\r?\n/);const children=[];
    lines.forEach((line,index)=>{
        if(index) children.push(new d.TextRun({break:1}));
        children.push(new d.TextRun({text:line,bold:!!settings.bold,color:settings.color || '0B2851',size:settings.size || 20,font:'Arial'}));
    });
    return new d.Paragraph({
        children,
        alignment:settings.alignment || d.AlignmentType.LEFT,
        spacing:{before:settings.before || 0,after:settings.after == null ? 80 : settings.after,line:276},
        keepNext:!!settings.keepNext,
        pageBreakBefore:!!settings.pageBreakBefore
    });
}

function wordCell(d,text,width,settings){
    settings=settings || {};
    return new d.TableCell({
        width:{size:width,type:d.WidthType.DXA},
        verticalAlign:d.VerticalAlign.CENTER,
        margins:{top:100,bottom:100,left:120,right:120},
        shading:settings.fill ? {fill:settings.fill,color:'auto'} : undefined,
        children:[wordParagraph(d,text,{
            bold:settings.bold,color:settings.color,size:settings.size,
            alignment:settings.alignment || d.AlignmentType.LEFT,after:0
        })]
    });
}

function wordKeyValueTable(d,rows,tableWidth){
    const labelWidth=Math.round(tableWidth*.34);const valueWidth=tableWidth-labelWidth;
    return new d.Table({
        width:{size:tableWidth,type:d.WidthType.DXA},columnWidths:[labelWidth,valueWidth],
        layout:d.TableLayoutType.FIXED,borders:wordBorders(d),
        rows:rows.map(row=>new d.TableRow({cantSplit:true,children:[
            wordCell(d,row[0],labelWidth,{bold:true,fill:'EAF2FB'}),wordCell(d,row[1],valueWidth,{})
        ]}))
    });
}

async function wordReportTable(d,items,fields,tableWidth,includeMainImage){
    const numberWidth=620;const imageWidth=includeMainImage ? 1800 : 0;
    const base=Math.floor((tableWidth-numberWidth-imageWidth)/Math.max(1,fields.length));
    const widths=[numberWidth];
    for(let i=0;i<fields.length;i++) widths.push(i===fields.length-1 ? tableWidth-widths.reduce((a,b)=>a+b,0) : base);
    if(includeMainImage){widths[widths.length-1]-=imageWidth;widths.push(imageWidth);}
    const header=['№'].concat(fields.map(key=>PRINT_FIELDS[key].label)).concat(includeMainImage?['Asosiy rasm']:[]);
    const rows=[new d.TableRow({tableHeader:true,cantSplit:true,children:header.map((label,index)=>wordCell(d,label,widths[index],{
        bold:true,fill:'0D3C7C',color:'FFFFFF',size:18,alignment:d.AlignmentType.CENTER
    }))})];
    for(let index=0;index<items.length;index++){
        const tp=items[index];
        const values=[index+1].concat(fields.map(key=>PRINT_FIELDS[key].value(tp)));
        const cells=values.map((value,column)=>wordCell(d,value,widths[column],{
            size:17,alignment:column===0 ? d.AlignmentType.CENTER : d.AlignmentType.LEFT
        }));
        if(includeMainImage){
            const images=Array.isArray(tp.images) ? tp.images : Object.values(tp.images || {});
            const mainRecord=images[Number(tp.mainImageIndex)||0] || images[0];
            const picture=await wordImageParagraph(d,mainRecord,95,68,false);
            cells.push(new d.TableCell({
                width:{size:imageWidth,type:d.WidthType.DXA},verticalAlign:d.VerticalAlign.CENTER,
                margins:{top:70,bottom:70,left:70,right:70},
                children:[picture || wordParagraph(d,'—',{alignment:d.AlignmentType.CENTER,after:0})]
            }));
        }
        rows.push(new d.TableRow({cantSplit:true,children:cells}));
    }
    return new d.Table({
        width:{size:tableWidth,type:d.WidthType.DXA},columnWidths:widths,
        layout:d.TableLayoutType.FIXED,borders:wordBorders(d,'7893B1'),rows
    });
}

async function wordImageParagraph(d,imageRecord,maxWidth,maxHeight,pageBreakBefore){
    const data=await fetchPrintImage(imageRecord);const converted=await normalizeWordImage(data,maxWidth,maxHeight);
    if(!converted) return null;
    return new d.Paragraph({
        pageBreakBefore:!!pageBreakBefore,alignment:d.AlignmentType.CENTER,spacing:{before:100,after:140},
        children:[new d.ImageRun({type:converted.type,data:converted.data,transformation:{width:converted.width,height:converted.height}})]
    });
}

async function wordExport(opts){
    if(typeof docx==='undefined'){
        showToast('Word moduli yuklanmadi. Sahifani yangilab qayta urinib ko‘ring.');
        return false;
    }
    const d=docx;const isSingle=printSelection.type==='element' && printSelection.items.length===1;
    const landscape=!isSingle && opts.paper==='landscape';
    const tableWidth=landscape ? 15360 : 10440;const children=[];
    children.push(wordParagraph(d,'HETK',{bold:true,size:40,color:'0D3C7C',after:40,keepNext:true}));
    children.push(wordParagraph(d,'HUDUDIY ELEKTR TARMOQLARI KORXONASI',{bold:true,size:20,color:'0D3C7C',after:160,keepNext:true}));

    if(isSingle){
        const tp=printSelection.items[0];const primaryId=primaryFolderId(tp);
        children.push(wordParagraph(d,'ELEMENT PASPORTI',{bold:true,size:34,alignment:d.AlignmentType.CENTER,after:120,keepNext:true}));
        children.push(wordParagraph(d,tp.name || 'ELEMENT',{bold:true,size:30,alignment:d.AlignmentType.CENTER,after:40,keepNext:true}));
        children.push(wordParagraph(d,primaryFolderName(tp),{bold:true,size:24,color:'1479D3',alignment:d.AlignmentType.CENTER,after:140}));
        children.push(wordParagraph(d,primaryId ? getFolderPath(primaryId) : '—',{size:18,color:'496781',alignment:d.AlignmentType.CENTER,after:160}));
        if(opts.images!=='none'){
            const images=Array.isArray(tp.images) ? tp.images : Object.values(tp.images || {});
            const mainRecord=images[Number(tp.mainImageIndex)||0] || images[0];
            const picture=await wordImageParagraph(d,mainRecord,520,330,false);if(picture) children.push(picture);
        }
        const currentRepair=lastRepair(tp,'current');const capitalRepair=lastRepair(tp,'capital');
        const mahalla=tp.primaryMahalla || (tp.mahallaLinks||[]).map(x=>x.name).filter(Boolean).join(', ') || '—';
        const facts=[
            ['Quvvati',tp.power ? tp.power+' kVA' : '—'],
            ['Balans',tp.isPrivate ? 'Xususiy'+(tp.ownerFirm?' — '+tp.ownerFirm:'') : 'ETK'],
            ['Texnik holati',statusLabel(tp.status)],['Mahalla',mahalla],
            ['U/J',hetkGetTPWorkZoneNames(tp).join(', ') || tp.workZoneName || '—'],['Manzil',tp.address || '—'],
            ['Koordinata',tp.lat && tp.lng ? tp.lat+'; '+tp.lng : '—'],
            ['Balans hisoblagich',tp.balanceMeterSerial || tp.balanceMeterNumber || '—'],
            ['Konsentrator',tp.concentratorSerial || tp.concentratorNumber || '—'],
            ['Ishga tushirilgan',printDate(tp.commissionedDate,false)],
            ['Oxirgi joriy ta’mir',currentRepair ? printDate(currentRepair.date,false) : '—'],
            ['Oxirgi kapital ta’mir',capitalRepair ? printDate(capitalRepair.date,false) : '—'],
            ['Izoh',tp.note || '—'],['Yaratilgan sana',printDate(tp.createdAt)],['Oxirgi tahrir',printDate(tp.updatedAt)]
        ];
        children.push(wordKeyValueTable(d,facts,tableWidth));
        const history=maintenanceRows(tp);
        if(history.length){
            children.push(wordParagraph(d,'TA’MIRLASH TARIXI',{bold:true,size:26,alignment:d.AlignmentType.CENTER,before:220,after:100,keepNext:true}));
            const repairFields=[
                {label:'Ta’mir turi',value:row=>row.type==='capital'?'Kapital ta’mir':'Joriy ta’mir'},
                {label:'Sana',value:row=>printDate(row.date,false)},
                {label:'Bajarilgan ishlar',value:row=>row.work || '—'},
                {label:'Izoh',value:row=>row.note || '—'},
                {label:'Kiritgan xodim',value:row=>row.updatedByName || row.createdByName || '—'}
            ];
            const repairKeys=repairFields.map((_,index)=>'repair'+index);const saved={};
            repairKeys.forEach((key,index)=>{saved[key]=PRINT_FIELDS[key];PRINT_FIELDS[key]=repairFields[index];});
            children.push(await wordReportTable(d,history,repairKeys,tableWidth,false));
            repairKeys.forEach(key=>{if(saved[key]) PRINT_FIELDS[key]=saved[key];else delete PRINT_FIELDS[key];});
        }
        if(opts.images==='all'){
            const images=Array.isArray(tp.images) ? tp.images : Object.values(tp.images || {});
            for(let i=0;i<images.length;i++){
                const picture=await wordImageParagraph(d,images[i],520,650,i===0);if(picture) children.push(picture);
            }
        }
    }else{
        const fields=(opts.fields.length ? opts.fields : ['feeder','name']).filter(key=>PRINT_FIELDS[key]);
        children.push(wordParagraph(d,'ELEMENTLAR RO‘YXATI',{bold:true,size:30,alignment:d.AlignmentType.CENTER,after:80,keepNext:true}));
        children.push(wordParagraph(d,'Manba: '+(printSelection.name || '—')+'  •  Jami: '+printSelection.items.length+' ta element',{size:19,alignment:d.AlignmentType.CENTER,after:140,keepNext:true}));
        children.push(await wordReportTable(d,printSelection.items,fields,tableWidth,opts.images==='main'));
        if(opts.images==='all'){
            for(const tp of printSelection.items){
                const images=Array.isArray(tp.images) ? tp.images : Object.values(tp.images || {});
                if(!images.length) continue;
                children.push(wordParagraph(d,(tp.name || 'Element')+' — RASMLAR',{
                    bold:true,size:28,alignment:d.AlignmentType.CENTER,pageBreakBefore:true,after:120
                }));
                for(const image of images){
                    const picture=await wordImageParagraph(d,image,landscape?720:520,520,false);if(picture) children.push(picture);
                }
            }
        }
    }
    children.push(wordParagraph(d,'Fayl shakllantirildi: '+printDate(Date.now())+'     Shakllantirdi: '+actorName(),{
        size:16,color:'496781',alignment:d.AlignmentType.CENTER,before:180,after:0
    }));
    const documentFile=new d.Document({
        creator:actorName(),title:printSelection.name || 'HETK elementlari',subject:'HETK elementlar ma’lumoti',
        description:'HETK monitoring tizimida shakllantirilgan hujjat',
        styles:{default:{document:{run:{font:'Arial',size:20,color:'0B2851'},paragraph:{spacing:{after:80,line:276}}}}},
        sections:[{properties:{page:{
            size:{width:11906,height:16838,orientation:landscape ? d.PageOrientation.LANDSCAPE : d.PageOrientation.PORTRAIT},
            margin:{top:720,right:720,bottom:720,left:720,header:360,footer:360,gutter:0}
        }},children}]
    });
    const blob=await d.Packer.toBlob(documentFile);
    downloadBlob(blob,fileBase()+'.docx');
    return true;
}

function excelExport(opts){
    if(typeof XLSX==='undefined'){
        showToast('Excel moduli yuklanmadi. Internetni tekshirib qayta urinib ko‘ring.');
        return false;
    }
    const fields=(opts.fields.length ? opts.fields : ['feeder','name']).filter(key=>PRINT_FIELDS[key]);
    const header=['№'].concat(fields.map(key=>PRINT_FIELDS[key].label));
    const rows=printSelection.items.map((tp,index)=>[index+1].concat(fields.map(key=>PRINT_FIELDS[key].value(tp))));
    const generated='Shakllantirdi: '+actorName()+' • '+printDate(Date.now());
    const data=[
        [printSelection.name || 'HETK elementlari'],
        [generated],
        ['Jami: '+printSelection.items.length+' ta element'],
        [],
        header
    ].concat(rows);
    const worksheet=XLSX.utils.aoa_to_sheet(data);
    const lastColumn=Math.max(0,header.length-1);
    worksheet['!merges']=[
        {s:{r:0,c:0},e:{r:0,c:lastColumn}},
        {s:{r:1,c:0},e:{r:1,c:lastColumn}},
        {s:{r:2,c:0},e:{r:2,c:lastColumn}}
    ];
    worksheet['!cols']=header.map((label,index)=>({wch:index===0 ? 7 : Math.min(42,Math.max(14,String(label).length+4))}));
    if(rows.length){
        worksheet['!autofilter']={ref:XLSX.utils.encode_range({s:{r:4,c:0},e:{r:4+rows.length,c:lastColumn}})};
    }
    const workbook=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook,worksheet,'Elementlar');
    workbook.Props={
        Title:printSelection.name || 'HETK elementlari',
        Subject:'HETK elementlar ro‘yxati',
        Author:actorName(),
        CreatedDate:new Date()
    };
    XLSX.writeFile(workbook,fileBase()+'.xlsx',{compression:true});
    return true;
}

async function showPreview(){
    if(!printSelection.items.length) return showToast('Chop etiladigan element topilmadi.');
    const button=document.getElementById('hetk-print-preview');
    if(button){button.disabled=true;button.textContent='Tayyorlanmoqda…';}
    try{
        document.getElementById('hetk-print-preview-content').innerHTML=await buildDocument(options());
        document.getElementById('hetk-print-preview-overlay').hidden=false;
    }catch(error){console.error('PRINT PREVIEW ERROR:',error);showToast('Ko‘rib chiqishni tayyorlashda xatolik yuz berdi.');}
    finally{if(button){button.disabled=false;button.textContent='Ko‘rib chiqish';}}
}

async function generateFile(){
    if(!printSelection.items.length) return showToast('Chop etiladigan element topilmadi.');
    const opts=options();const button=document.getElementById('hetk-print-generate');
    if(button){button.disabled=true;button.textContent='Tayyorlanmoqda…';}
    try{
        if(opts.format==='excel'){
            if(excelExport(opts)) showToast('Excel (.xlsx) fayli tayyorlandi.');
            return;
        }
        if(opts.format==='word'){
            if(await wordExport(opts)) showToast('Word (.docx) fayli tayyorlandi.');
            return;
        }
        const html=await buildDocument(opts);
        const previewContent=document.getElementById('hetk-print-preview-content');
        const previewOverlay=document.getElementById('hetk-print-preview-overlay');
        previewContent.innerHTML=html;
        if(opts.format==='printer'){previewOverlay.hidden=false;setTimeout(()=>window.print(),250);return;}
        if(typeof html2pdf==='undefined'){
            previewOverlay.hidden=false;showToast('PDF moduli yuklanmadi. Printer oynasidan “PDF sifatida saqlash”ni tanlang.');setTimeout(()=>window.print(),250);return;
        }
        const host=document.createElement('div');
        host.className='hetk-pdf-export-host';
        host.style.cssText='position:absolute;left:0;top:0;width:'+(opts.paper==='landscape'?'297mm':'210mm')+';background:#fff;z-index:1;pointer-events:none;';
        host.innerHTML=html;
        document.body.appendChild(host);
        try{
            await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
            const pendingImages=Array.from(host.querySelectorAll('img')).filter(img=>!img.complete).map(img=>new Promise(resolve=>{
                img.addEventListener('load',resolve,{once:true});
                img.addEventListener('error',resolve,{once:true});
                setTimeout(resolve,5000);
            }));
            if(pendingImages.length) await Promise.all(pendingImages);
            const exportWidth=Math.max(host.scrollWidth,Math.round((opts.paper==='landscape'?297:210)*96/25.4));
            const exportHeight=Math.max(host.scrollHeight,Math.round((opts.paper==='landscape'?210:297)*96/25.4));
            await html2pdf().set({
                margin:0,filename:fileBase()+'.pdf',image:{type:'jpeg',quality:.97},
                html2canvas:{
                    scale:2,useCORS:true,allowTaint:false,backgroundColor:'#ffffff',
                    scrollX:0,scrollY:0,windowWidth:exportWidth,windowHeight:exportHeight
                },
                jsPDF:{unit:'mm',format:'a4',orientation:opts.paper==='landscape'?'landscape':'portrait'},
                pagebreak:{mode:['css','legacy'],before:'.hetk-document-page + .hetk-document-page'}
            }).from(host).save();
            showToast('PDF fayli tayyorlandi.');
        }finally{
            host.remove();
        }
    }catch(error){console.error('PRINT GENERATE ERROR:',error);showToast('Faylni tayyorlashda xatolik yuz berdi.');}
    finally{if(button){button.disabled=false;button.textContent='Faylni tayyorlash';}}
}

function bind(){
    const byId=id=>document.getElementById(id);
    byId('hetk-print-open')?.addEventListener('click',openDialog);
    ['hetk-print-close','hetk-print-back','hetk-print-cancel'].forEach(id=>byId(id)?.addEventListener('click',closeDialog));
    byId('hetk-print-preview')?.addEventListener('click',showPreview);
    byId('hetk-print-generate')?.addEventListener('click',generateFile);
    byId('hetk-print-preview-close')?.addEventListener('click',()=>{byId('hetk-print-preview-overlay').hidden=true;});
    document.querySelectorAll('.hetk-print-format').forEach(label=>label.addEventListener('click',()=>{
        document.querySelectorAll('.hetk-print-format').forEach(item=>item.classList.remove('active'));label.classList.add('active');
    }));
    byId('hetk-print-overlay')?.addEventListener('click',event=>{if(event.target===event.currentTarget) closeDialog();});
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind);else bind();
})();
