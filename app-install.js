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

  function showInstallButton(){const btn=byId('hetk-app-install');if(btn)btn.hidden=standalone();}
  async function requireNotifications(){
    if(!('Notification' in window)||!('serviceWorker' in navigator)){
      throw new Error('Bu brauzer bildirishnomalarni qo\u2018llamaydi. Ilovani o\u2018rnatib bo\u2018lmaydi.');
    }
    if(Notification.permission==='denied'){
      throw new Error('Bildirishnoma bloklangan. Avval brauzer sozlamasidan ruxsat bering.');
    }
    let permission=Notification.permission;
    if(permission!=='granted')permission=await Notification.requestPermission();
    if(permission!=='granted'){
      throw new Error('Ilovani o\u2018rnatish uchun bildirishnomaga ruxsat berish majburiy.');
    }
    // FCM kalitini bazaga yozish o'rnatish oynasini to'sib qo'ymasligi kerak.
    // Bildirishnoma ruxsati yetarli; token ulanishi orqa fonda davom etadi.
    if(window.HETKPush&&typeof window.HETKPush.enable==='function'){
      Promise.resolve(window.HETKPush.enable()).catch(error=>console.warn('Bildirishnoma ulanishi:',error));
    }
    return true;
  }
  async function installApp(){
    const btn=byId('hetk-app-install'),label=btn&&btn.querySelector('span');
    if(btn&&btn.disabled)return;
    if(btn){btn.disabled=true;btn.classList.add('is-working');}
    if(label)label.textContent='Ruxsat';
    try{
      const permissionWasGranted=('Notification' in window)&&Notification.permission==='granted';
      await requireNotifications();
      if(!permissionWasGranted){
        toast('Bildirishnomaga ruxsat berildi. Endi Yuklash tugmasini yana bir marta bosing.');
        return;
      }
      const ua=String(navigator.userAgent||'').toLowerCase();
      let file='';
      if(/android/.test(ua)) file='HETK-Navoiy-Android-v1.0.apk';
      else if(/windows/.test(ua)) file='HETK-Navoiy-Setup.exe';
      else if(installPrompt){
        const prompt=installPrompt;installPrompt=null;
        await prompt.prompt();
        await prompt.userChoice;
        return;
      }else{
        toast('iPhone uchun hozircha saytning o\u2018zidan foydalaniladi.');
        return;
      }
      if(label)label.textContent='Yuklanmoqda';
      const link=document.createElement('a');
      link.href=new URL(file,document.baseURI).href;
      link.download=file;
      document.body.appendChild(link);link.click();link.remove();
      toast('Ilova fayli yuklanmoqda');
    }catch(error){
      console.warn('O\u2018rnatish to\u2018xtatildi:',error);
      toast(error&&error.message?error.message:'Bildirishnomaga ruxsat berilmagani uchun o\u2018rnatilmadi.');
    }finally{
      if(btn){btn.disabled=false;btn.classList.remove('is-working');}
      if(label)label.textContent='Yuklash';
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

  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;});
  window.addEventListener('appinstalled',()=>{const btn=byId('hetk-app-install');if(btn)btn.hidden=true;toast('HETK ilovasi o‘rnatildi');});
  document.addEventListener('DOMContentLoaded',()=>{
    const refresh=byId('hetk-data-refresh');if(refresh)refresh.addEventListener('click',refreshData);
    const install=byId('hetk-app-install');if(install)install.addEventListener('click',installApp);
    showInstallButton();
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
