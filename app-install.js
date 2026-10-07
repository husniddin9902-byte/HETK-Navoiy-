(function(){
  'use strict';
  let installPrompt=null;
  let toastTimer=0;

  function byId(id){return document.getElementById(id);}
  function standalone(){return window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;}
  function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent);}
  function toast(message){
    let el=byId('hetk-app-toast');
    if(!el){el=document.createElement('div');el.id='hetk-app-toast';el.className='hetk-app-toast';document.body.appendChild(el);}
    el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),3200);
  }

  async function refreshData(){
    const btn=byId('hetk-data-refresh');if(!btn||btn.disabled)return;
    const label=btn.querySelector('span');btn.disabled=true;btn.classList.add('is-working');if(label)label.textContent='Yangilanmoqda';
    try{
      if(window.HETKData&&typeof window.HETKData.refreshAll==='function')await window.HETKData.refreshAll();
      else document.dispatchEvent(new CustomEvent('hetk-manual-refresh'));
      toast('Ma’lumotlar yangilandi');
    }catch(error){console.error('Yangilash xatosi:',error);toast('Ma’lumotlarni yangilab bo‘lmadi. Internetni tekshiring.');}
    finally{btn.disabled=false;btn.classList.remove('is-working');if(label)label.textContent='Yangilash';}
  }

  function showInstallButton(){const btn=byId('hetk-app-install');if(btn&&!standalone()&&installPrompt)btn.hidden=false;}
  async function requireNotifications(){
    if(!('Notification' in window)||!('serviceWorker' in navigator)){
      throw new Error('Bu brauzer bildirishnomalarni qo\u2018llamaydi. Ilovani o\u2018rnatib bo\u2018lmaydi.');
    }
    if(Notification.permission==='denied'){
      throw new Error('Bildirishnoma bloklangan. Avval brauzer sozlamasidan ruxsat bering.');
    }
    if(!window.HETKPush||typeof window.HETKPush.enable!=='function'){
      throw new Error('Bildirishnoma xizmati hali tayyor emas. Tizimga kirib, qayta urinib ko\u2018ring.');
    }
    const enabled=await window.HETKPush.enable();
    if(!enabled||Notification.permission!=='granted'){
      throw new Error('Ilovani o\u2018rnatish uchun bildirishnomaga ruxsat berish majburiy.');
    }
    return true;
  }
  async function installApp(){
    // Tugma faqat brauzer haqiqiy o'rnatish oynasini bera olganda ko'rinadi.
    // Yorliq yoki brauzer menyusi bo'yicha ko'rsatma chiqarilmaydi.
    if(!installPrompt)return;
    const btn=byId('hetk-app-install'),label=btn&&btn.querySelector('span');
    if(btn&&btn.disabled)return;
    if(btn){btn.disabled=true;btn.classList.add('is-working');}
    if(label)label.textContent='Ruxsat';
    try{
      const permissionWasGranted=('Notification' in window)&&Notification.permission==='granted';
      await requireNotifications();
      // Chrome Android va Windows bir foydalanuvchi bosishida ketma-ket
      // bildirishnoma hamda PWA o'rnatish oynasini ochishni bloklashi mumkin.
      // Ruxsat hozirgina berilgan bo'lsa, installPromptni saqlab qolamiz va
      // keyingi bosishda bevosita o'rnatish oynasini ochamiz.
      if(!permissionWasGranted){
        toast('Bildirishnomaga ruxsat berildi. Endi O\u2018rnatish tugmasini yana bir marta bosing.');
        return;
      }
      const prompt=installPrompt;installPrompt=null;
      if(label)label.textContent='O\u2018rnatish';
      await prompt.prompt();
      const choice=await prompt.userChoice;
      if(choice&&choice.outcome==='accepted'){
        if(btn)btn.hidden=true;
      }else{
        toast('Ilovani o\u2018rnatish bekor qilindi');
        if(btn)btn.hidden=true;
      }
    }catch(error){
      console.warn('O\u2018rnatish to\u2018xtatildi:',error);
      toast(error&&error.message?error.message:'Bildirishnomaga ruxsat berilmagani uchun o\u2018rnatilmadi.');
    }finally{
      if(btn){btn.disabled=false;btn.classList.remove('is-working');}
      if(label)label.textContent='O\u2018rnatish';
    }
  }

  function showUpdate(registration,nextVersion){
    if(byId('hetk-update-banner'))return;
    const box=document.createElement('div');box.id='hetk-update-banner';box.className='hetk-update-banner';box.innerHTML='<span>Yangi versiya tayyor</span><button type="button">Yangilash</button>';
    box.querySelector('button').addEventListener('click',()=>{
      if(nextVersion)try{localStorage.setItem('hetk-app-version',nextVersion);}catch(_e){}
      if(registration&&registration.waiting)registration.waiting.postMessage({type:'SKIP_WAITING'});else location.reload();
    });
    document.body.appendChild(box);
  }

  async function checkAppVersion(){
    try{
      const response=await fetch('app-version.json?ts='+Date.now(),{cache:'no-store'});if(!response.ok)return;
      const data=await response.json(),next=String(data.version||'');if(!next)return;
      const key='hetk-app-version',current=localStorage.getItem(key);
      if(!current){localStorage.setItem(key,next);return;}
      if(current!==next)showUpdate(null,next);
    }catch(_e){}
  }

  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;showInstallButton();});
  window.addEventListener('appinstalled',()=>{const btn=byId('hetk-app-install');if(btn)btn.hidden=true;toast('HETK ilovasi o‘rnatildi');});
  document.addEventListener('DOMContentLoaded',()=>{
    const refresh=byId('hetk-data-refresh');if(refresh)refresh.addEventListener('click',refreshData);
    const install=byId('hetk-app-install');if(install)install.addEventListener('click',installApp);
    checkAppVersion();
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('firebase-messaging-sw.js',{scope:'./',updateViaCache:'none'}).then(reg=>{
        reg.update().catch(()=>{});
        if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg);
        reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)showUpdate(reg);});});
      }).catch(error=>console.warn('Ilova xizmati ulanmagan:',error));
      let refreshing=false;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing)return;refreshing=true;location.reload();});
    }
  });
})();
