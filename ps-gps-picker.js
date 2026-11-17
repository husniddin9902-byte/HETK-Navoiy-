/* HETK-Navoiy v73. GIS koordinata tanlash — faqat papka formasidagi GPS maydonlarini to'ldiradi.
 * Hech qaysi Firebase qoidasi yoki ma'lumotini mustaqil yozmaydi.
 * PS nuqtasini xaritada belgilash/joylashuvdan topish ochiq tasdiqlash talab qiladi.
 */
(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  const overlay=byId('hetk-ps-gps-picker');
  if(!overlay)return;
  const mapNode=byId('hetk-ps-picker-map');
  const title=byId('hetk-ps-picker-title');
  const msg=byId('hetk-ps-picker-message');
  const value=byId('hetk-ps-picker-value');
  const confirmBtn=byId('hetk-ps-picker-confirm');
  const styleBtn=byId('hetk-ps-picker-style');
  const meBtn=byId('hetk-ps-picker-me');
  const originalBodyOverflow={value:''};
  let map=null,marker=null,gpsCircle=null,tpLayer=null,baseLayer=null;
  let provider='satellite',activePrefix=null,candidate=null,opener=null,openGeneration=0;
  function controls(prefix){return {
    lat:byId('hetk-'+prefix+'-ps-lat'),lng:byId('hetk-'+prefix+'-ps-lng'),
    box:byId('hetk-'+prefix+'-ps-gps')
  };}
  function coord(lat,lng){
    const a=Number(String(lat==null?'':lat).replace(',','.')),
          b=Number(String(lng==null?'':lng).replace(',','.'));
    return lat!=='' && lat!=null && lng!=='' && lng!=null &&
      Number.isFinite(a) && Number.isFinite(b) && Math.abs(a)<=90 && Math.abs(b)<=180 &&
      !(a===0 && b===0) ? [a,b] : null;
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function showMessage(s){msg.textContent=s;}
  function setCandidate(latlng,source){
    const point=coord(latlng.lat,latlng.lng);
    if(!point)return;
    candidate={lat:point[0],lng:point[1]};
    value.textContent=point[0].toFixed(6)+' , '+point[1].toFixed(6);
    confirmBtn.disabled=false;
    if(!map)return;
    if(!marker){
      const icon=L.divIcon({className:'',html:'<span class="hetk-ps-picker-dot"></span>',
        iconSize:[22,22],iconAnchor:[11,11]});
      marker=L.marker(point,{icon,draggable:true,zIndexOffset:2000}).addTo(map);
      marker.on('dragend',()=>setCandidate(marker.getLatLng(),'drag'));
    }else{marker.setLatLng(point);}
    showMessage(source==='location'?'Qurilma joyi belgilandi. PS shu joyda ekanini tekshiring.':
      'Nuqta tanlandi. «Shu nuqtani tanlash» bilan formaga o‘tkazing.');
  }
  const tiles={
    satellite:{url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',opts:{maxZoom:20,maxNativeZoom:18,attribution:'Tiles © Esri, Maxar, Earthstar Geographics'}},
    plain:{url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',opts:{maxZoom:19,maxNativeZoom:19,attribution:'© OpenStreetMap contributors'}}
  };
  function setTiles(which){
    provider=which;
    if(map){if(baseLayer)map.removeLayer(baseLayer);baseLayer=L.tileLayer(tiles[provider].url,tiles[provider].opts).addTo(map);}
    styleBtn.textContent=provider==='satellite'?'◫ Oddiy xarita':'◈ Sun’iy yo‘ldosh';
  }
  function ensureMap(){
    if(map)return true;
    if(!window.L || typeof L.map!=='function'){
      showMessage('Xarita kutubxonasi yuklanmadi. Internetni tekshiring yoki koordinatani qo‘lda kiriting.');
      return false;
    }
    try{
      map=L.map(mapNode,{zoomControl:true,closePopupOnClick:true,scrollWheelZoom:true})
        .setView([40.10,65.81],6);
      setTiles('satellite');
      tpLayer=L.layerGroup().addTo(map);
      map.on('click',e=>setCandidate(e.latlng,'map'));
      return true;
    }catch(err){
      showMessage('Xaritani ochishda xatolik: '+(err&&err.message||'noma’lum'));
      return false;
    }
  }
  function descendant(folderId,ancestor,folders){
    if(!ancestor||ancestor==='root')return false;
    let cur=folderId;const seen=new Set();
    while(cur && cur!=='root' && !seen.has(cur)){
      if(cur===ancestor)return true;
      seen.add(cur);cur=folders[cur]?.parentId;
    }
    return false;
  }
  function pointInFolder(tp,folderId,folders){
    const included=[tp?.primaryFolderId,tp?.folderId,...Object.entries(tp?.folders||{})
      .filter(([,v])=>v===true||v===1).map(([k])=>k)].filter(Boolean);
    return included.some(fid=>descendant(fid,folderId,folders));
  }
  function renderNearbyPoints(points){
    if(!tpLayer)return;
    tpLayer.clearLayers();
    const source=points.slice(0,100);
    source.forEach(p=>{
      const icon=L.divIcon({className:'',html:'<span class="hetk-ps-picker-tp-marker" style="display:block;width:12px;height:12px"></span>',
        iconSize:[12,12],iconAnchor:[6,6]});
      const m=L.marker([p.lat,p.lng],{icon,zIndexOffset:-1000}).addTo(tpLayer);
      const el=document.createElement('span');el.textContent=p.name;
      m.bindTooltip(el,{direction:'top',opacity:.9});
      m.on('click',()=>showMessage('Bu KTP nuqtasi. PS uchun xaritada boshqa joyni bosing.'));
    });
  }
  async function centerOnRelatedTPs(prefix,generation){
    if(typeof hetkScopedTPsOnce!=='function'||!map)return;
    const folderId=prefix==='edit'?(typeof editingFolderId==='string'?editingFolderId:null):byId('parent-folder-select')?.value;
    if(!folderId || folderId==='root')return;
    try{
      const snap=await hetkScopedTPsOnce();
      if(openGeneration!==generation || !activePrefix || candidate)return;
      const data=snap?.val?.()||{};
      const folders=typeof currentFolders==='object'?currentFolders:{};
      const places=[];
      for(const [id,tp] of Object.entries(data)){
        if(!tp||!(typeof hetkPointAllowedByUser!=='function'||hetkPointAllowedByUser(tp)))continue;
        if(!pointInFolder(tp,folderId,folders))continue;
        const pos=coord(tp.lat,tp.lng);
        if(pos)places.push({lat:pos[0],lng:pos[1],name:tp.name||tp.address||('TP '+id)});
        if(places.length>=400)break;
      }
      if(!places.length)return;
      const centerPlaces=places.slice(0,400);
      renderNearbyPoints(centerPlaces);
      if(centerPlaces.length===1){map.setView([centerPlaces[0].lat,centerPlaces[0].lng],15);}
      else{
        const bounds=L.latLngBounds(centerPlaces.map(x=>[x.lat,x.lng]));
        map.fitBounds(bounds,{padding:[35,35],maxZoom:15,animate:false});
      }
      showMessage('Shu papkaga tegishli KTP/GKTP nuqtalari ko‘rsatildi. PS joyini alohida belgilang.');
    }catch(err){
      // This is only a map-centering convenience; it must never block manual GPS selection.
      if(openGeneration===generation)showMessage('PS joyini xaritada bosib belgilang (TP ro‘yxatini olish imkoni bo‘lmadi).');
    }
  }
  function open(prefix,locateImmediately=false){
    if(prefix!=='edit'&&prefix!=='new')return;
    const c=controls(prefix);
    if(!c.box || c.box.hidden || !c.lat || !c.lng)return;
    if(!overlay.hidden)close();
    activePrefix=prefix;opener=document.activeElement;candidate=null;openGeneration++;
    meBtn.disabled=false;
    confirmBtn.disabled=true;value.textContent='Koordinata tanlanmagan';
    const name=byId(prefix==='edit'?'edit-group-name':'new-group-name')?.value?.trim()||'Yangi PS';
    title.textContent=name+' · xaritadagi joylashuvi';
    overlay.hidden=false;originalBodyOverflow.value=document.body.style.overflow;document.body.style.overflow='hidden';
    showMessage('Xaritani bosib PS joyini belgilang.');
    if(ensureMap()){
      map.invalidateSize?.(true);
      if(tpLayer)tpLayer.clearLayers();
      if(marker){map.removeLayer(marker);marker=null;}
      if(gpsCircle){map.removeLayer(gpsCircle);gpsCircle=null;}
      const previous=coord(c.lat.value,c.lng.value);
      if(previous){map.setView(previous,16);setCandidate({lat:previous[0],lng:previous[1]},'existing');}
      else{
        const other=typeof panelInternalMap!=='undefined'&&panelInternalMap?.getCenter?.();
        if(other)map.setView([other.lat,other.lng],Math.min(panelInternalMap.getZoom?.()||13,16));
        else map.setView([40.10,65.81],6);
        centerOnRelatedTPs(prefix,openGeneration);
      }
    }
    overlay.querySelector('.hetk-ps-picker')?.focus();
    if(locateImmediately)locate();
  }
  function close(){
    if(overlay.hidden)return;
    overlay.hidden=true;activePrefix=null;openGeneration++;
    meBtn.disabled=false;
    document.body.style.overflow=originalBodyOverflow.value;
    if(gpsCircle && map){map.removeLayer(gpsCircle);gpsCircle=null;}
    if(opener?.focus)opener.focus();
    opener=null;
  }
  function locate(){
    if(!activePrefix)return;
    if(!navigator.geolocation || window.isSecureContext===false){
      showMessage('Joylashuv uchun HTTPS/ilova ruxsati kerak. Xaritadan qo‘lda belgilang.');return;
    }
    meBtn.disabled=true;showMessage('Qurilma joylashuvi aniqlanmoqda…');
    const generation=openGeneration;
    navigator.geolocation.getCurrentPosition(
      pos=>{
        if(generation!==openGeneration || overlay.hidden)return;
        meBtn.disabled=false;
        const here={lat:pos.coords.latitude,lng:pos.coords.longitude};
        if(!coord(here.lat,here.lng)){showMessage('Joylashuv koordinatasi noto‘g‘ri qaytdi.');return;}
        if(!ensureMap())return;
        map.setView([here.lat,here.lng],17);
        setCandidate(here,'location');
        if(gpsCircle)map.removeLayer(gpsCircle);
        const accuracy=Number(pos.coords.accuracy);
        if(Number.isFinite(accuracy)&&accuracy>0){gpsCircle=L.circle([here.lat,here.lng],{radius:accuracy,color:'#1f84d3',weight:1,fillOpacity:.07,interactive:false}).addTo(map);}
        showMessage('Sizning joylashuvingiz topildi'+(Number.isFinite(accuracy)?' (aniqlik: ≈'+Math.round(accuracy)+' m)':'')+'. PS shu nuqtada bo‘lsa tasdiqlang.');
      },
      err=>{
        if(generation!==openGeneration || overlay.hidden)return;
        meBtn.disabled=false;
        const code=Number(err?.code);
        showMessage(code===1?'Joylashuvga ruxsat berilmadi. Brauzer/Windows sozlamalarini tekshiring yoki xaritadan belgilang.':
          code===2?'Joylashuv aniqlanmadi. Xaritadan qo‘lda belgilang.':
          'Joylashuvni olish vaqti tugadi. Xaritadan belgilang yoki yana urinib ko‘ring.');
      },
      {enableHighAccuracy:true,maximumAge:30000,timeout:16000}
    );
  }
  document.querySelectorAll('[data-hetk-ps-map]').forEach(button=>{
    button.addEventListener('click',()=>open(button.dataset.hetkPsMap,false));
  });
  document.querySelectorAll('[data-hetk-ps-locate]').forEach(button=>{
    button.addEventListener('click',()=>open(button.dataset.hetkPsLocate,true));
  });
  byId('hetk-ps-picker-close').addEventListener('click',close);
  byId('hetk-ps-picker-cancel').addEventListener('click',close);
  overlay.addEventListener('mousedown',event=>{if(event.target===overlay)close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!overlay.hidden){event.stopImmediatePropagation();close();}} ,true);
  byId('hetk-ps-picker-me').addEventListener('click',locate);
  styleBtn.addEventListener('click',()=>setTiles(provider==='satellite'?'plain':'satellite'));
  confirmBtn.addEventListener('click',()=>{
    if(!activePrefix || !candidate)return;
    const c=controls(activePrefix);
    if(!c.lat||!c.lng)return;
    c.lat.value=candidate.lat.toFixed(6);c.lng.value=candidate.lng.toFixed(6);
    c.lat.dispatchEvent(new Event('input',{bubbles:true}));
    c.lng.dispatchEvent(new Event('input',{bubbles:true}));
    close();
  });
  window.HETKPSPicker={open,close,getSelected:()=>candidate?{...candidate}:null};
})();
