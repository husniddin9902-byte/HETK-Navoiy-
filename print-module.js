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
        fact('fa-calculator','Balans hisoblagich',tp.balanceMeterNumber || tp.meterNumber || '—'),
        fact('fa-tower-broadcast','Konsentrator',tp.concentratorNumber || tp.concentratorSerial || '—'),
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
    balanceMeter:{label:'Balans hisoblagich',value:tp=>tp.balanceMeterNumber || tp.meterNumber || '—'},
    concentrator:{label:'Konsentrator',value:tp=>tp.concentratorNumber || tp.concentratorSerial || '—'},
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

function wordExport(html){
    const style='<style>body{font-family:Arial;color:#0b2851}.hetk-document-page{page-break-after:always}.hetk-doc-brand{border-bottom:4px solid #0d3c7c}.hetk-doc-logo{font-size:36px;font-weight:bold}.hetk-doc-title,.hetk-doc-report-title{text-align:center}.hetk-doc-table{width:100%;border-collapse:collapse}.hetk-doc-table td,.hetk-doc-table th{border:1px solid #567;padding:6px}.hetk-doc-table th{background:#0d3c7c;color:#fff}.hetk-passport-fact{border:1px solid #9cb5cf;padding:5px;margin:3px}.hetk-passport-main-image img,.hetk-doc-photo-card img{max-width:100%}</style>';
    const doc='<!doctype html><html><head><meta charset="UTF-8">'+style+'</head><body>'+html+'</body></html>';
    downloadBlob(new Blob(['\ufeff',doc],{type:'application/msword'}),fileBase()+'.doc');
}

function excelExport(opts){
    const fields=(opts.fields.length ? opts.fields : ['feeder','name']).filter(key=>PRINT_FIELDS[key]);
    const rows=printSelection.items.map((tp,index)=>'<tr><td>'+(index+1)+'</td>'+fields.map(key=>'<td>'+hetkEscapeHtml(PRINT_FIELDS[key].value(tp))+'</td>').join('')+'</tr>').join('');
    const html='<!doctype html><html><head><meta charset="UTF-8"></head><body><h2>'+hetkEscapeHtml(printSelection.name)+'</h2><p>Shakllantirdi: '+hetkEscapeHtml(actorName())+' • '+hetkEscapeHtml(printDate(Date.now()))+'</p><table border="1"><tr><th>№</th>'+fields.map(key=>'<th>'+hetkEscapeHtml(PRINT_FIELDS[key].label)+'</th>').join('')+'</tr>'+rows+'</table></body></html>';
    downloadBlob(new Blob(['\ufeff',html],{type:'application/vnd.ms-excel'}),fileBase()+'.xls');
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
        if(opts.format==='excel'){excelExport(opts);showToast('Excel fayli tayyorlandi.');return;}
        const html=await buildDocument(opts);
        if(opts.format==='word'){wordExport(html);showToast('Word fayli tayyorlandi.');return;}
        const previewContent=document.getElementById('hetk-print-preview-content');
        const previewOverlay=document.getElementById('hetk-print-preview-overlay');
        previewContent.innerHTML=html;
        if(opts.format==='printer'){previewOverlay.hidden=false;setTimeout(()=>window.print(),250);return;}
        if(typeof html2pdf==='undefined'){
            previewOverlay.hidden=false;showToast('PDF moduli yuklanmadi. Printer oynasidan “PDF sifatida saqlash”ni tanlang.');setTimeout(()=>window.print(),250);return;
        }
        const host=document.createElement('div');host.style.cssText='position:fixed;left:-20000px;top:0;background:#fff;z-index:-1;';host.innerHTML=html;document.body.appendChild(host);
        await html2pdf().set({
            margin:0,filename:fileBase()+'.pdf',image:{type:'jpeg',quality:.96},
            html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff'},
            jsPDF:{unit:'mm',format:'a4',orientation:opts.paper==='landscape'?'landscape':'portrait'},
            pagebreak:{mode:['css','legacy'],before:'.hetk-document-page + .hetk-document-page'}
        }).from(host).save();
        host.remove();showToast('PDF fayli tayyorlandi.');
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
