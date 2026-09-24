(function(){
  'use strict';

  const SAFETY_HOME_ROLES = new Set([
    'republic_tb_engineer',
    'regional_tb_chief',
    'regional_tb_operations_engineer',
    'regional_tb_engineer',
    'regional_fire_safety_engineer',
    'tb_engineer'
  ]);

  let notificationRef = null;
  let notificationHandler = null;

  function byId(id){ return document.getElementById(id); }
  function account(){ return window.HETKAuth && window.HETKAuth.currentUser; }
  function enabledFor(user){ return !!(user && user.active !== false && SAFETY_HOME_ROLES.has(user.role)); }

  function setHeader(safetyMode){
    const title = document.querySelector('.header-title');
    if(title){
      if(!title.dataset.mapTitle) title.dataset.mapTitle = title.textContent || 'Joylashuvni saqlash';
      title.textContent = safetyMode ? 'Mehnat muhofazasi' : title.dataset.mapTitle;
    }
    const list = byId('list-btn');
    if(list) list.title = safetyMode ? 'Tekshiruvlar va boshqaruv paneli' : '';
  }

  function updateNoticeCount(count){
    const n = Math.max(0, Number(count) || 0);
    const top = byId('hetk-safety-home-notice-count');
    const action = document.querySelector('.hetk-safety-home-action-count');
    const label = byId('hetk-safety-home-notice') && byId('hetk-safety-home-notice').querySelector('span');
    [top, action].forEach(el=>{
      if(!el) return;
      el.textContent = String(n);
      el.hidden = n === 0;
    });
    if(label) label.textContent = n ? `${n} ta yangi bildirishnoma` : 'Yangi bildirishnoma yo‘q';
  }

  function stopNotifications(){
    if(notificationRef && notificationHandler){
      try{ notificationRef.off('value', notificationHandler); }catch(_e){}
    }
    notificationRef = null;
    notificationHandler = null;
    updateNoticeCount(0);
  }

  function startNotifications(user){
    stopNotifications();
    if(!enabledFor(user) || !window.firebase || !firebase.apps || !firebase.apps.length) return;
    notificationRef = firebase.database().ref(`UserNotifications/${user.uid}`);
    notificationHandler = snap=>{
      let unread = 0;
      snap.forEach(child=>{ const row=child.val()||{}; if(row.read !== true) unread++; });
      updateNoticeCount(unread);
    };
    notificationRef.on('value', notificationHandler, ()=>updateNoticeCount(0));
  }

  function apply(user){
    const show = enabledFor(user);
    const home = byId('hetk-safety-home');
    document.body.classList.toggle('hetk-safety-home-active', show);
    if(home){
      home.hidden = !show;
      home.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    setHeader(show);
    if(show){
      const list = byId('list-container');
      if(list) list.style.display = 'none';
      startNotifications(user);
    }else{
      stopNotifications();
      if(window.map && typeof window.map.invalidateSize === 'function') setTimeout(()=>window.map.invalidateSize(), 80);
    }
  }

  function openProfileTab(tab){
    if(typeof window.openProfileModule === 'function') window.openProfileModule();
    if(typeof window.activateProfileTab === 'function') window.activateProfileTab(tab);
  }

  function openTests(){
    if(!window.HETKTraining || typeof window.HETKTraining.open !== 'function') return;
    window.HETKTraining.open();
    requestAnimationFrame(()=>{
      const button=document.querySelector('#hetk-training-overlay [data-training-tab="tests"]');
      if(button) button.click();
    });
  }

  function runAction(action){
    if(action === 'permits') return openProfileTab('employees');
    if(action === 'exams') return openTests();
    if(action === 'equipment'){
      if(window.HETKSafetyEquipment && typeof window.HETKSafetyEquipment.open === 'function') window.HETKSafetyEquipment.open();
      return;
    }
    if(action === 'inspections'){
      const button=byId('list-btn');
      if(button) button.click();
      return;
    }
    if(action === 'notifications'){
      openProfileTab('messages');
      requestAnimationFrame(()=>{
        const button=document.querySelector('[data-communication-tab="notifications"]');
        if(button) button.click();
      });
      return;
    }
    if(action === 'reports'){
      if(window.HETKStatistics && typeof window.HETKStatistics.open === 'function') window.HETKStatistics.open();
    }
  }

  function bind(){
    const home=byId('hetk-safety-home');
    if(home && home.dataset.bound !== '1'){
      home.dataset.bound='1';
      home.addEventListener('click',event=>{
        const button=event.target.closest('[data-safety-action]');
        if(button) runAction(button.dataset.safetyAction);
      });
    }
    document.addEventListener('hetk-auth-ready',event=>apply(event.detail && event.detail.user));
    document.addEventListener('hetk-auth-user-updated',event=>apply(event.detail && event.detail.user));
    document.addEventListener('hetk-auth-cleared',()=>apply(null));
    if(account()) apply(account());
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
