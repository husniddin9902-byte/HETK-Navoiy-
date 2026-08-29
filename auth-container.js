(function(){
  'use strict';

  const ROLE_DEFS = {
    super_admin: {
      label: 'Bosh administrator', level: 100,
      createRoles: ['director','chief_engineer','regional_tb_engineer','tb_engineer','pto_engineer','chief_dispatcher','master','adli_kard_engineer','dispatcher','electrician','employee'],
      canCreateUsers: true, canDeactivateUsers: true, canManagePermissions: true, canManageFolders: true
    },
    director: {
      label: 'Direktor', level: 90,
      createRoles: ['chief_engineer','tb_engineer','pto_engineer','chief_dispatcher','master','adli_kard_engineer','dispatcher','electrician','employee'],
      canCreateUsers: true, canDeactivateUsers: true, canManagePermissions: true, canManageFolders: true
    },
    chief_engineer: {
      label: 'Bosh / Asosiy muhandis', level: 85,
      createRoles: ['tb_engineer','pto_engineer','chief_dispatcher','master','adli_kard_engineer','dispatcher','electrician','employee'],
      canCreateUsers: true, canDeactivateUsers: true, canManagePermissions: true, canManageFolders: true
    },
    regional_tb_engineer: {
      label: 'MMQXT va E muhandisi (viloyat)', level: 80,
      createRoles: [], canCreateUsers: false, canDeactivateUsers: false, canManagePermissions: false, canManageFolders: false
    },
    tb_engineer: {
      label: 'MMQXT va E muhandisi (tuman)', level: 75,
      createRoles: [], canCreateUsers: false, canDeactivateUsers: false, canManagePermissions: false, canManageFolders: false
    },
    pto_engineer: {
      label: 'PTO muhandis', level: 65,
      createRoles: [], canCreateUsers: false, canDeactivateUsers: false, canManagePermissions: false, canManageFolders: false
    },
    chief_dispatcher: {
      label: 'Bosh dispetcher', level: 60,
      createRoles: ['dispatcher','employee'],
      canCreateUsers: true, canDeactivateUsers: true, canManagePermissions: true, canManageFolders: false
    },
    master: {
      label: 'Usta / Master', level: 55,
      createRoles: ['electrician'],
      canCreateUsers: true, canDeactivateUsers: true, canManagePermissions: true, canManageFolders: false
    },
    adli_kard_engineer: {
      label: 'Adli kard muhandisi', level: 50,
      createRoles: [], canCreateUsers: false, canDeactivateUsers: false, canManagePermissions: false, canManageFolders: false
    },
    dispatcher: {
      label: 'Dispetcher', level: 30,
      createRoles: [], canCreateUsers: false, canDeactivateUsers: false, canManagePermissions: false, canManageFolders: false
    },
    electrician: {
      label: 'Elektromontyor', level: 25,
      createRoles: [], canCreateUsers: false, canDeactivateUsers: false, canManagePermissions: false, canManageFolders: false
    },
    employee: {
      label: 'Hodim', level: 20,
      createRoles: [], canCreateUsers: false, canDeactivateUsers: false, canManagePermissions: false, canManageFolders: false
    }
  };

  let auth = null;
  let databaseRef = null;
  let currentAccount = null;
  let usersExist = true;
  let creatingFirstAdmin = false;
  let teamUsersCache = {};
  let teamFoldersCache = {};
  let selectedTeamUid = null;
  let usersTeamRef = null;
  let foldersTeamRef = null;
  let workZonesTeamRef = null;
  let teamWorkZonesCache = {};
  let editorFolderLimitRoots = null;
  let editorFolderLocked = false;
  let userEditorMode = 'create';
  let editingTeamUid = null;
  let currentUserLiveRef = null;
  let teamTreeExpanded = new Set(['__root__']);
  let teamTreeAutoInitialized = false;
  let editorSelectedFolderIds = new Set();
  let folderPickerExpanded = new Set();
  let workZoneSelectedFolderIds = new Set();
  let workZonePickerExpanded = new Set();
  let editingWorkZoneId = null;

  const TELEGRAM_WORKER_URL = 'https://hetk-telegram.husniddin-99-02.workers.dev';
  const DEFAULT_MALE_AVATAR = 'profile-default-male.png';
  const DEFAULT_FEMALE_AVATAR = 'profile-default-female.png';

  function normalizeGender(value){ return value === 'female' ? 'female' : 'male'; }
  function genderLabel(value){ return normalizeGender(value) === 'female' ? 'Ayol' : 'Erkak'; }
  function defaultAvatarUrl(gender){
    const fileName = normalizeGender(gender) === 'female' ? DEFAULT_FEMALE_AVATAR : DEFAULT_MALE_AVATAR;
    return new URL(fileName, document.baseURI).href;
  }
  function telegramProfilePhotoUrl(fileId){
    return fileId ? `${TELEGRAM_WORKER_URL}/telegram/file?file_id=${encodeURIComponent(fileId)}` : '';
  }
  function accountAvatarUrl(account){
    if(account && account.telegramPhotoFileId) return telegramProfilePhotoUrl(account.telegramPhotoFileId);
    if(account && account.photoData) return account.photoData;
    return defaultAvatarUrl(account && account.gender);
  }

  async function employeeTelegramFetch(method, body, isForm){
    if(!auth || !auth.currentUser) throw new Error('Telegram uchun tizimga qayta kiring.');
    async function send(forceRefresh){
      const token = await auth.currentUser.getIdToken(!!forceRefresh);
      const headers = {'Authorization':'Bearer '+token};
      if(!isForm) headers['Content-Type']='application/json';
      return await fetch(`${TELEGRAM_WORKER_URL}/telegram/${method}?channel=employees`,{
        method:'POST',headers,body:isForm ? body : JSON.stringify(body || {})
      });
    }
    let response=await send(false);
    if(response.status===401) response=await send(true);
    let result={};
    try{ result=await response.json(); }catch(_e){}
    if(!response.ok || !result.ok) throw new Error(result.description || result.error || 'Telegram xatosi');
    return result;
  }

  function shortText(value,max){
    const text=String(value || '').trim();
    return text.length>max ? text.slice(0,max-1)+'…' : text;
  }
  function formatProfileDate(value){
    if(!value) return '—';
    if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)){
      const p=value.split('-'); return `${p[2]}.${p[1]}.${p[0]}`;
    }
    const d=new Date(value); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('uz-UZ');
  }
  function employeeFoldersText(account){
    if(account && account.rootAccess) return "O‘zbekiston — barcha hududlar";
    const ids=Object.keys((account && account.folders) || {}).filter(id=>account.folders[id]);
    if(!ids.length) return 'Biriktirilmagan';
    return shortText(ids.map(id=>folderPath(id) || ((teamFoldersCache[id]||{}).name) || id).join('; '),170);
  }
  function employeePermissionsText(account){
    const labels={createUsers:'hodim yaratish',deactivateUsers:'bloklash',managePermissions:'ruxsat boshqarish',manageFolders:'papka boshqarish'};
    const allowed=Object.keys(labels).filter(key=>hasPermission(key,account)).map(key=>labels[key]);
    return allowed.length ? allowed.join(', ') : 'Oddiy foydalanish';
  }
  function activeDisciplineText(account){
    const now=Date.now();
    const list=Object.values((account && account.disciplinaryActions) || {}).filter(x=>x && (!x.expiresAt || Number(x.expiresAt)>now));
    if(!list.length) return 'Yo‘q';
    return shortText(list.map(x=>(x.type==='reprimand'?'Hayfsan':'Ogohlantirish')+': '+(x.reason||'')).join('; '),120);
  }
  function buildEmployeeTelegramCaption(account){
    const rec=safetyRecord(account);
    const state=permitState(account);
    const lines=[
      '👤 HODIM PROFILI',
      '',
      `🪪 F.I.Sh: ${account.fullName || '—'}`,
      `⚧ Jinsi: ${genderLabel(account.gender)}`,
      `📞 Telefon: ${account.phone || '—'}`,
      `🔐 Login: ${account.login || '—'}`,
      `💼 Lavozim: ${getRoleLabel(account)}`,
      `📍 Hudud / U/J: ${account.workZoneName || account.region || '—'}`,
      `📌 Holati: ${account.active===false ? 'Nofaol' : 'Faol'}`,
      `📂 Hudud ruxsati: ${employeeFoldersText(account)}`,
      `🛡 Tizim huquqlari: ${employeePermissionsText(account)}`,
      '',
      '📜 MALAKA GUVOHNOMASI',
      `⚡ XTB guruhi: ${rec.group || 'I'}`,
      `🔢 Guvohnoma №: ${rec.certificateNo || '—'}`,
      `🗓 Sinov sanasi: ${formatProfileDate(rec.examDate)}`,
      `⏳ Amal muddati: ${formatProfileDate(rec.validUntil)}`,
      `✅ Ruxsatnoma holati: ${state.text || '—'}`,
      `📝 Izoh: ${shortText(rec.notes || '—',100)}`,
      `⚠️ Intizomiy holat: ${activeDisciplineText(account)}`,
      '',
      `➕ Yaratgan: ${account.createdByName || '—'}`,
      `🕒 Yaratilgan: ${formatProfileDate(account.createdAt)}`,
      `🔄 Yangilangan: ${formatProfileDate(account.updatedAt)}`,
      `🆔 UID: ${account.uid || '—'}`
    ];
    return lines.join('\n').slice(0,1024);
  }

  async function blobFromDataUrl(dataUrl){
    const response=await fetch(dataUrl); return await response.blob();
  }
  async function defaultAvatarBlob(gender){
    const response=await fetch(defaultAvatarUrl(gender),{cache:'no-store'});
    if(!response.ok) throw new Error('Standart profil rasmi topilmadi.');
    return await response.blob();
  }
  async function sendEmployeePhotoPost(account, photoSource){
    const caption=buildEmployeeTelegramCaption(account);
    if(typeof photoSource==='string' && photoSource){
      return await employeeTelegramFetch('sendPhoto',{photo:photoSource,caption},false);
    }
    const blob=photoSource instanceof Blob ? photoSource : await defaultAvatarBlob(account.gender);
    const form=new FormData();
    form.append('photo',blob,'profile.jpg');
    form.append('caption',caption);
    return await employeeTelegramFetch('sendPhoto',form,true);
  }
  async function deleteEmployeePost(messageId){
    if(!messageId) return;
    try{ await employeeTelegramFetch('deleteMessage',{message_id:messageId},false); }catch(e){ console.warn('Eski hodim posti o‘chirilmadi:',e); }
  }
  async function syncEmployeeTelegram(uid, account, options){
    options=options || {};
    const merged=Object.assign({uid},account || {});
    const legacyBlob=merged.photoData ? await blobFromDataUrl(merged.photoData) : null;
    const newPhoto=options.photoBlob || legacyBlob || null;
    const mustRepost=!!newPhoto || !merged.telegramEmployeeMessageId || options.replaceDefaultPhoto;
    if(mustRepost){
      const oldMessageId=merged.telegramEmployeeMessageId || null;
      const source=newPhoto || (merged.telegramPhotoFileId && !options.replaceDefaultPhoto ? merged.telegramPhotoFileId : null);
      const sent=await sendEmployeePhotoPost(merged,source);
      const photos=(sent.result && sent.result.photo) || [];
      const lastPhoto=photos[photos.length-1] || {};
      const patch={
        telegramEmployeeMessageId:sent.result.message_id,
        telegramPhotoFileId:lastPhoto.file_id || merged.telegramPhotoFileId || '',
        telegramPhotoKind:newPhoto ? 'custom' : 'default',
        photoData:null,
        telegramUpdatedAt:Date.now()
      };
      await databaseRef.ref('users/'+uid).update(patch);
      await deleteEmployeePost(oldMessageId);
      return Object.assign({},merged,patch);
    }
    try{
      await employeeTelegramFetch('editMessageCaption',{
        message_id:merged.telegramEmployeeMessageId,
        caption:buildEmployeeTelegramCaption(merged)
      },false);
      await databaseRef.ref('users/'+uid+'/telegramUpdatedAt').set(Date.now());
      return merged;
    }catch(e){
      if(String(e.message||'').toLowerCase().includes('message is not modified')) return merged;
      const sent=await sendEmployeePhotoPost(merged,merged.telegramPhotoFileId || null);
      const photos=(sent.result && sent.result.photo) || [];
      const lastPhoto=photos[photos.length-1] || {};
      const patch={telegramEmployeeMessageId:sent.result.message_id,telegramPhotoFileId:lastPhoto.file_id||merged.telegramPhotoFileId||'',telegramUpdatedAt:Date.now(),photoData:null};
      await databaseRef.ref('users/'+uid).update(patch);
      return Object.assign({},merged,patch);
    }
  }
  async function safeSyncEmployeeTelegram(uid, account, options){
    try{return await syncEmployeeTelegram(uid,account,options);}catch(e){
      console.error('Hodim Telegram posti yangilanmadi:',e);
      if(options && options.showError) alert('Hodim saqlandi, lekin Telegram posti yangilanmadi: '+(e.message||e));
      return account;
    }
  }

  function byId(id){ return document.getElementById(id); }

  function normalizeLogin(value){
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^\.+|\.+$/g, '');
  }

  function loginToEmail(login){
    // Eski foydalanuvchilar bilan moslik uchun qoldirilgan legacy email.
    return normalizeLogin(login) + '@hetk.local';
  }

  function loginIndexKey(login){
    const value = normalizeLogin(login);
    try{
      return btoa(value).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
    }catch(_e){
      return value.replace(/\./g,'_dot_');
    }
  }

  function makeInternalAuthEmail(){
    const rnd = Math.random().toString(36).slice(2,10);
    return `u${Date.now().toString(36)}${rnd}@hetk-app.com`;
  }

  async function resolveAuthEmail(login){
    const normalized = normalizeLogin(login);
    if(!normalized) return '';
    try{
      const idxSnap = await databaseRef.ref('loginIndex/' + loginIndexKey(normalized)).once('value');
      const idx = idxSnap.val();
      if(idx && idx.authEmail) return String(idx.authEmail);

      // Eski bazani avtomatik ko‘chirish uchun users ichidan login bo‘yicha qidiramiz.
      const usersSnap = await databaseRef.ref('users').orderByChild('login').equalTo(normalized).once('value');
      let foundEmail = '';
      usersSnap.forEach(child => {
        if(foundEmail) return;
        const account = child.val() || {};
        if(account.authEmail) foundEmail = String(account.authEmail);
      });
      if(foundEmail) return foundEmail;
    }catch(_e){}
    return loginToEmail(normalized);
  }

  async function loginAlreadyExists(login, excludeUid){
    const normalized = normalizeLogin(login);
    if(!normalized) return false;
    try{
      const idxSnap = await databaseRef.ref('loginIndex/' + loginIndexKey(normalized)).once('value');
      const idx = idxSnap.val();
      if(idx && idx.uid && idx.uid !== excludeUid) return true;
    }catch(_e){}
    try{
      const usersSnap = await databaseRef.ref('users').orderByChild('login').equalTo(normalized).once('value');
      let exists = false;
      usersSnap.forEach(child => { if(child.key !== excludeUid) exists = true; });
      return exists;
    }catch(_e){ return false; }
  }

  async function ensureLoginIndex(account, user){
    if(!account || !user || !account.login) return account;
    const authEmail = String(user.email || account.authEmail || loginToEmail(account.login));
    const key = loginIndexKey(account.login);
    const updates = {};
    updates['users/' + user.uid + '/authEmail'] = authEmail;
    updates['loginIndex/' + key] = {
      uid:user.uid,
      login:normalizeLogin(account.login),
      authEmail,
      active:account.active !== false,
      updatedAt:Date.now()
    };
    await databaseRef.ref().update(updates);
    account.authEmail = authEmail;
    return account;
  }

  function friendlyAuthError(error){
    const code = error && error.code ? error.code : '';
    if(code === 'auth/operation-not-allowed') return "Firebase Authentication'da Email/Password usulini yoqish kerak.";
    if(code === 'auth/invalid-login-credentials' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'Login yoki parol noto‘g‘ri.';
    if(code === 'auth/weak-password') return 'Parol kamida 6 ta belgidan iborat bo‘lsin.';
    if(code === 'auth/email-already-in-use') return 'Bu login avval yaratilgan.';
    if(code === 'auth/invalid-email') return 'Login formatida xato bor. Faqat lotin harflari, raqam, nuqta, _ yoki - ishlating.';
    if(code === 'auth/too-many-requests') return 'Urinishlar ko‘payib ketdi. Birozdan keyin qayta urinib ko‘ring.';
    if(code === 'auth/requires-recent-login') return 'Parolni almashtirish uchun qayta kirish kerak.';
    return (error && error.message) ? error.message : 'Noma’lum xatolik yuz berdi.';
  }

  function setMessage(type, text){
    const el = byId('hetk-auth-message');
    if(!el) return;
    el.className = 'hetk-auth-message show ' + type;
    el.textContent = text;
  }

  function clearMessage(){
    const el = byId('hetk-auth-message');
    if(!el) return;
    el.className = 'hetk-auth-message';
    el.textContent = '';
  }

  function setBusy(button, busy, busyText){
    if(!button) return;
    if(busy){
      button.dataset.oldText = button.textContent;
      button.textContent = busyText || 'Kutilmoqda...';
      button.disabled = true;
    }else{
      button.textContent = button.dataset.oldText || button.textContent;
      button.disabled = false;
    }
  }

  function buildAuthUI(){
    if(byId('hetk-auth-overlay')) return;
    const wrap = document.createElement('div');
    wrap.id = 'hetk-auth-overlay';
    wrap.innerHTML = `
      <div class="hetk-auth-card" id="hetk-auth-card">
        <div class="hetk-auth-brand">
          <div class="hetk-auth-logo">⚡</div>
          <h1>HETK Monitoring</h1>
          <p>Hududiy elektr tarmoqlari boshqaruv tizimi</p>
        </div>
        <div class="hetk-auth-body">
          <div id="hetk-auth-message" class="hetk-auth-message"></div>

          <section class="hetk-auth-login">
            <h2 class="hetk-auth-title">Tizimga kirish</h2>
            <p class="hetk-auth-subtitle">Sizga berilgan login va parol orqali tizimga kiring.</p>
            <div class="hetk-auth-field">
              <label for="hetk-login">Login</label>
              <div class="hetk-auth-input-wrap">
                <input class="hetk-auth-input" id="hetk-login" autocomplete="username" placeholder="Masalan: admin">
              </div>
            </div>
            <div class="hetk-auth-field">
              <label for="hetk-password">Parol</label>
              <div class="hetk-auth-input-wrap">
                <input class="hetk-auth-input" id="hetk-password" type="password" autocomplete="current-password" placeholder="Parolingiz">
                <button class="hetk-auth-pass-toggle" type="button" data-toggle-password="hetk-password"><i class="fas fa-eye"></i></button>
              </div>
            </div>
            <button id="hetk-login-btn" class="hetk-auth-primary" type="button">Kirish</button>
            <div id="hetk-first-admin-area" hidden>
              <div class="hetk-auth-sep"></div>
              <button id="hetk-open-setup" class="hetk-auth-secondary" type="button"><i class="fas fa-user-shield"></i> Birinchi Bosh adminni yaratish</button>
              <div class="hetk-auth-hint">Bu tugma bazada hali foydalanuvchi bo‘lmagandagina ko‘rinadi.</div>
            </div>
          </section>

          <section class="hetk-auth-setup">
            <button id="hetk-setup-back" class="hetk-auth-back" type="button"><i class="fas fa-arrow-left"></i> Kirishga qaytish</button>
            <h2 class="hetk-auth-title">Bosh administrator</h2>
            <p class="hetk-auth-subtitle">Bu tizimdagi birinchi va eng yuqori darajadagi foydalanuvchi bo‘ladi.</p>
            <div class="hetk-auth-field"><label>F.I.Sh</label><input class="hetk-auth-input" id="hetk-setup-name" placeholder="To‘liq ism-sharif"></div>
            <div class="hetk-auth-field"><label>Login</label><input class="hetk-auth-input" id="hetk-setup-login" autocomplete="username" placeholder="Masalan: admin"></div>
            <div class="hetk-auth-field"><label>Jinsi</label><select class="hetk-auth-input" id="hetk-setup-gender"><option value="male">Erkak</option><option value="female">Ayol</option></select></div>
            <div class="hetk-auth-field"><label>Parol</label><div class="hetk-auth-input-wrap"><input class="hetk-auth-input" id="hetk-setup-password" type="password" autocomplete="new-password" placeholder="Kamida 6 ta belgi"><button class="hetk-auth-pass-toggle" type="button" data-toggle-password="hetk-setup-password"><i class="fas fa-eye"></i></button></div></div>
            <div class="hetk-auth-field"><label>Parolni takrorlang</label><div class="hetk-auth-input-wrap"><input class="hetk-auth-input" id="hetk-setup-password2" type="password" autocomplete="new-password" placeholder="Parolni qayta kiriting"><button class="hetk-auth-pass-toggle" type="button" data-toggle-password="hetk-setup-password2"><i class="fas fa-eye"></i></button></div></div>
            <button id="hetk-create-first-admin" class="hetk-auth-primary" type="button">Bosh adminni yaratish</button>
          </section>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  }

  function setOverlayVisible(visible){
    const overlay = byId('hetk-auth-overlay');
    if(!overlay) return;
    overlay.hidden = !visible;
    document.body.style.overflow = visible ? 'hidden' : '';
  }

  async function checkUsersExist(){
    try{
      const snap = await databaseRef.ref('users').once('value');
      usersExist = snap.exists();
    }catch(e){
      usersExist = true;
    }
    const area = byId('hetk-first-admin-area');
    if(area) area.hidden = usersExist;
  }

  function bindPasswordToggles(){
    document.querySelectorAll('[data-toggle-password]').forEach(btn => {
      if(btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', function(){
        const input = byId(btn.dataset.togglePassword);
        if(!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.innerHTML = show ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
      });
    });
  }

  function bindAuthUI(){
    const loginBtn = byId('hetk-login-btn');
    const loginInput = byId('hetk-login');
    const passwordInput = byId('hetk-password');
    const openSetup = byId('hetk-open-setup');
    const setupBack = byId('hetk-setup-back');
    const createBtn = byId('hetk-create-first-admin');
    const card = byId('hetk-auth-card');

    loginBtn.addEventListener('click', doLogin);
    passwordInput.addEventListener('keydown', e => { if(e.key === 'Enter') doLogin(); });
    loginInput.addEventListener('keydown', e => { if(e.key === 'Enter') passwordInput.focus(); });

    openSetup.addEventListener('click', () => {
      clearMessage();
      card.classList.add('setup-mode');
      setTimeout(() => byId('hetk-setup-name').focus(), 50);
    });
    setupBack.addEventListener('click', () => {
      clearMessage();
      card.classList.remove('setup-mode');
    });
    createBtn.addEventListener('click', createFirstAdmin);
    bindPasswordToggles();
  }

  async function doLogin(){
    clearMessage();
    const login = normalizeLogin(byId('hetk-login').value);
    const password = byId('hetk-password').value;
    const btn = byId('hetk-login-btn');
    if(!login) return setMessage('error','Loginni kiriting.');
    if(!password) return setMessage('error','Parolni kiriting.');
    setBusy(btn,true,'Kirilmoqda...');
    try{
      const authEmail = await resolveAuthEmail(login);
      await auth.signInWithEmailAndPassword(authEmail, password);
    }catch(e){
      setMessage('error',friendlyAuthError(e));
    }finally{
      setBusy(btn,false);
    }
  }

  async function createFirstAdmin(){
    clearMessage();
    if(usersExist) return setMessage('error','Bosh administrator avval yaratilgan.');
    const fullName = String(byId('hetk-setup-name').value || '').trim();
    const login = normalizeLogin(byId('hetk-setup-login').value);
    const gender = normalizeGender(byId('hetk-setup-gender') && byId('hetk-setup-gender').value);
    const pass1 = byId('hetk-setup-password').value;
    const pass2 = byId('hetk-setup-password2').value;
    const btn = byId('hetk-create-first-admin');
    if(fullName.length < 3) return setMessage('error','F.I.Sh ni to‘liq kiriting.');
    if(login.length < 3) return setMessage('error','Login kamida 3 ta belgidan iborat bo‘lsin.');
    if(pass1.length < 6) return setMessage('error','Parol kamida 6 ta belgidan iborat bo‘lsin.');
    if(pass1 !== pass2) return setMessage('error','Parollar bir xil emas.');
    setBusy(btn,true,'Yaratilmoqda...');
    creatingFirstAdmin = true;
    try{
      const usersSnap = await databaseRef.ref('users').once('value');
      if(usersSnap.exists()){
        usersExist = true;
        throw new Error('Bosh administrator avval yaratilgan.');
      }
      if(await loginAlreadyExists(login,'')) throw new Error('Bu login avval yaratilgan.');
      const internalEmail = makeInternalAuthEmail();
      const cred = await auth.createUserWithEmailAndPassword(internalEmail, pass1);
      const uid = cred.user.uid;
      const now = Date.now();
      const account = {
        uid,
        login,
        authEmail: internalEmail,
        fullName,
        role: 'super_admin',
        roleLabel: ROLE_DEFS.super_admin.label,
        level: ROLE_DEFS.super_admin.level,
        region: "O'zbekiston",
        phone: '',
        gender,
        active: true,
        rootAccess: true,
        folders: {},
        createdBy: uid,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        photoData: null,
        safety: defaultSafetyRecord(),
        disciplinaryActions: {},
        permissions: defaultPermissionsForRole('super_admin')
      };
      const firstUpdates = {};
      firstUpdates['users/' + uid] = account;
      firstUpdates['loginIndex/' + loginIndexKey(login)] = {uid,login,authEmail:internalEmail,active:true,updatedAt:now};
      await databaseRef.ref().update(firstUpdates);
      Object.assign(account,await safeSyncEmployeeTelegram(uid,account,{replaceDefaultPhoto:true,showError:true}));
      await cred.user.updateProfile({displayName: fullName});
      usersExist = true;
      currentAccount = account;
      populateProfile(account);
      window.HETKAuth.currentUser = account;
      setOverlayVisible(false);
      document.dispatchEvent(new CustomEvent('hetk-auth-ready',{detail:{user:account}}));
      setMessage('success','Bosh administrator yaratildi. Tizimga kirildi.');
    }catch(e){
      setMessage('error',friendlyAuthError(e));
    }finally{
      creatingFirstAdmin = false;
      setBusy(btn,false);
    }
  }

  async function loadAccount(user){
    const snap = await databaseRef.ref('users/' + user.uid).once('value');
    if(!snap.exists()) return null;
    return Object.assign({uid:user.uid}, snap.val() || {});
  }

  function getRoleLabel(account){
    if(!account) return 'Hodim';
    if(account.role === 'master' && account.workZoneName) return account.workZoneName + ' Masteri';
    if(account.role === 'electrician' && account.workZoneName) return account.workZoneName + ' Elektromontyori';
    if(account.role === 'tb_engineer' || account.role === 'regional_tb_engineer') return ROLE_DEFS[account.role].label;
    if(account.roleLabel) return account.roleLabel;
    return ROLE_DEFS[account.role] ? ROLE_DEFS[account.role].label : (account.role || 'Hodim');
  }

  const SAFETY_GROUPS = ['I','II','III','IV','V'];
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const DISCIPLINE_LIFETIME_MS = 365 * ONE_DAY_MS;

  function defaultSafetyRecord(){
    return {group:'I', examDate:'', validUntil:'', certificateNo:'', notes:'', updatedAt:0, updatedBy:'', updatedByName:'', updatedByRole:''};
  }

  function safetyRecord(account){
    return Object.assign(defaultSafetyRecord(), (account && account.safety) || {});
  }

  function parseDateEnd(value){
    if(!value) return 0;
    if(typeof value === 'number') return value;
    const raw=String(value).trim();
    if(!raw) return 0;
    const t=Date.parse(raw.length<=10 ? raw+'T23:59:59' : raw);
    return Number.isFinite(t) ? t : 0;
  }

  function parseDateStart(value){
    if(!value) return 0;
    if(typeof value === 'number') return value;
    const raw=String(value).trim();
    const t=Date.parse(raw.length<=10 ? raw+'T00:00:00' : raw);
    return Number.isFinite(t) ? t : 0;
  }

  function effectiveSafetyGroup(account){
    const rec=safetyRecord(account);
    const until=parseDateEnd(rec.validUntil);
    if(until && until < Date.now()) return 'I';
    return SAFETY_GROUPS.includes(String(rec.group||'').toUpperCase()) ? String(rec.group).toUpperCase() : 'I';
  }

  function permitState(account){
    const rec=safetyRecord(account);
    const until=parseDateEnd(rec.validUntil);
    const start=parseDateStart(rec.examDate) || (until ? until - 365*ONE_DAY_MS : 0);
    if(!until) return {kind:'none',days:null,hours:null,text:'Muddat kiritilmagan',percent:0,until:0};
    const left=until-Date.now();
    if(left<=0) return {kind:'expired',days:0,hours:0,text:'Muddati o‘tgan',percent:0,until};
    const days=Math.floor(left/ONE_DAY_MS);
    const hours=Math.floor((left%ONE_DAY_MS)/(60*60*1000));
    const total=Math.max(ONE_DAY_MS,until-start);
    const percent=Math.max(0,Math.min(100,Math.round((left/total)*100)));
    let kind='ok';
    if(days<=10) kind='danger'; else if(days<=30) kind='warn';
    return {kind,days,hours,text:days+' kun '+hours+' soat qoldi',percent,until};
  }

  function formatDateOnly(value){
    const t=parseDateStart(value);
    if(!t) return '—';
    return new Date(t).toLocaleDateString('uz-UZ');
  }

  function isSafetyOfficer(account){
    const role=(account||currentAccount||{}).role;
    return role==='tb_engineer' || role==='regional_tb_engineer';
  }

  function isDistrictSafetyOfficer(account){return !!account && account.role==='tb_engineer';}
  function isRegionalSafetyOfficer(account){return !!account && account.role==='regional_tb_engineer';}

  function isDistrictPermitCategory(target){
    if(!target) return false;
    if(target.role==='electrician') return true;
    const text=(String(target.roleLabel||'')+' '+String(getRoleLabel(target)||'')).toLowerCase();
    return text.includes('shofyor') || text.includes('shofyor') || text.includes('haydovchi');
  }

  function canEditSafetyPermit(target){
    if(!currentAccount || !target || target.uid===currentAccount.uid) return false;
    if(!isTargetWithinScope(target)) return false;
    if(isRegionalSafetyOfficer(currentAccount)){
      return target.role!=='super_admin' && target.role!=='regional_tb_engineer';
    }
    if(isDistrictSafetyOfficer(currentAccount)) return isDistrictPermitCategory(target);
    return false;
  }

  function canManageDiscipline(target){
    if(!currentAccount || !target || target.uid===currentAccount.uid) return false;
    if(!isSafetyOfficer(currentAccount)) return false;
    if(!isTargetWithinScope(target)) return false;
    if(isDistrictSafetyOfficer(currentAccount) && target.role==='regional_tb_engineer') return false;
    return target.role!=='super_admin';
  }

  function activeDisciplinaryActions(account){
    const raw=(account && account.disciplinaryActions) || {};
    const now=Date.now();
    return Object.keys(raw).map(id=>Object.assign({id},raw[id]||{})).filter(x=>x && x.expiresAt && Number(x.expiresAt)>now).sort((a,b)=>Number(b.issuedAt||0)-Number(a.issuedAt||0));
  }

  function disciplineCountdown(action){
    const left=Math.max(0,Number(action.expiresAt||0)-Date.now());
    const days=Math.floor(left/ONE_DAY_MS);
    const hours=Math.floor((left%ONE_DAY_MS)/(60*60*1000));
    return days+' kun '+hours+' soat qoldi';
  }

  function safetyPermitHtml(account, opts){
    opts=opts||{};
    const rec=safetyRecord(account);
    const state=permitState(account);
    const group=effectiveSafetyGroup(account);
    const canEdit=!!opts.canEdit;
    return `<section class="hetk-safety-card">
      <div class="hetk-safety-title"><div><i class="fas fa-id-badge"></i><span>MALAKA GUVOHNOMASI</span></div>${canEdit?'<button type="button" class="hetk-safety-edit-btn" data-safety-edit="'+escapeAttr(account.uid||'')+'"><i class="fas fa-pen"></i> Tahrirlash</button>':''}</div>
      <div class="hetk-safety-main">
        <div class="hetk-safety-group"><small>XTB guruhi</small><strong>${escapeHtml(group)}</strong><span>guruh</span></div>
        <div class="hetk-safety-expiry"><div class="hetk-safety-expiry-top"><span>Ruxsatnoma muddati</span><b class="${state.kind}">${escapeHtml(state.text)}</b></div><div class="hetk-safety-progress"><i class="${state.kind}" style="width:${state.percent}%"></i></div><small>${state.until ? 'Amal qiladi: '+escapeHtml(new Date(state.until).toLocaleDateString('uz-UZ')) : 'TB muhandisi ma’lumot kiritadi'}</small></div>
      </div>
      <div class="hetk-certificate-table">
        <div><span>Guvohnoma №</span><b>${escapeHtml(rec.certificateNo||'—')}</b></div>
        <div><span>Bilimlar sinovi</span><b>${escapeHtml(formatDateOnly(rec.examDate))}</b></div>
        <div><span>Amal qilish sanasi</span><b>${escapeHtml(formatDateOnly(rec.validUntil))}</b></div>
        <div><span>Sinov / tahrir qilgan</span><b>${escapeHtml(rec.updatedByName ? rec.updatedByName+' · '+(rec.updatedByRole||'') : '—')}</b></div>
      </div>
      ${rec.notes?`<div class="hetk-safety-note">${escapeHtml(rec.notes)}</div>`:''}
    </section>`;
  }

  function disciplineHtml(account, opts){
    opts=opts||{};
    const actions=activeDisciplinaryActions(account);
    const canManage=!!opts.canManage;
    return `<section class="hetk-discipline-card">
      <div class="hetk-discipline-head"><div><i class="fas fa-exclamation-triangle"></i><span>Ogohlantirish va hayfsanlar</span></div>${canManage?'<button type="button" class="hetk-discipline-add" data-discipline-add="'+escapeAttr(account.uid||'')+'"><i class="fas fa-plus"></i> Berish</button>':''}</div>
      <div class="hetk-discipline-list">${actions.length?actions.map(a=>`<article class="hetk-discipline-item ${a.type==='reprimand'?'reprimand':'warning'}"><div class="hetk-discipline-item-main"><b>${a.type==='reprimand'?'Hayfsan':'Ogohlantirish'}</b><p>${escapeHtml(a.reason||'Sabab ko‘rsatilmagan')}</p><small>${new Date(Number(a.issuedAt||0)).toLocaleString('uz-UZ')} · ${escapeHtml(a.issuedByName||'TB muhandisi')}</small></div><div class="hetk-discipline-time"><span>${escapeHtml(disciplineCountdown(a))}</span>${canManage?`<button type="button" data-discipline-remove="${escapeAttr(account.uid||'')}" data-action-id="${escapeAttr(a.id)}" title="Olib tashlash"><i class="fas fa-times"></i></button>`:''}</div></article>`).join(''):'<div class="hetk-discipline-empty"><i class="fas fa-check-circle"></i> Faol ogohlantirish yoki hayfsan yo‘q.</div>'}</div>
    </section>`;
  }

  function renderProfileSafetySummary(account){
    const summary=document.querySelector('.hetk-profile-summary');
    const training=byId('profile-training');
    if(!summary || !training) return;
    let wrap=summary.querySelector('.hetk-profile-summary-actions');
    if(!wrap){
      wrap=document.createElement('div');wrap.className='hetk-profile-summary-actions';
      training.parentNode.insertBefore(wrap,training);wrap.appendChild(training);
    }
    let card=wrap.querySelector('.hetk-profile-safety-mini');
    if(!card){card=document.createElement('div');card.className='hetk-profile-safety-mini';wrap.appendChild(card);}
    const st=permitState(account); const group=effectiveSafetyGroup(account);
    card.className='hetk-profile-safety-mini '+st.kind;
    card.innerHTML=`<div><i class="fas fa-shield-alt"></i><b>XTB · ${escapeHtml(group)} guruh</b></div><span>${escapeHtml(st.text)}</span><em><i style="width:${st.percent}%"></i></em>`;
  }

  function renderProfileSafetySections(account){
    return safetyPermitHtml(account,{canEdit:false}) + disciplineHtml(account,{canManage:false});
  }

  function bindSafetyActions(root){
    const scope=root || document;
    scope.querySelectorAll('[data-safety-edit]').forEach(btn=>btn.addEventListener('click',()=>openSafetyPermitEditor(btn.dataset.safetyEdit)));
    scope.querySelectorAll('[data-discipline-add]').forEach(btn=>btn.addEventListener('click',()=>openDisciplineEditor(btn.dataset.disciplineAdd)));
    scope.querySelectorAll('[data-discipline-remove]').forEach(btn=>btn.addEventListener('click',()=>removeDisciplinaryAction(btn.dataset.disciplineRemove,btn.dataset.actionId)));
  }

  function closeSafetyOverlay(){ const el=byId('hetk-safety-overlay'); if(el) el.remove(); }

  function openSafetyPermitEditor(uid){
    const raw=teamUsersCache[uid]; if(!raw) return;
    const target=Object.assign({uid},raw); if(!canEditSafetyPermit(target)) return;
    closeSafetyOverlay();
    const rec=safetyRecord(target);
    const overlay=document.createElement('div'); overlay.id='hetk-safety-overlay'; overlay.className='hetk-safety-overlay';
    overlay.innerHTML=`<div class="hetk-safety-overlay-backdrop" data-close-safety></div><div class="hetk-safety-editor"><header><div><small>${escapeHtml(target.fullName||'Hodim')}</small><h3>MALAKA GUVOHNOMASI</h3></div><button type="button" data-close-safety><i class="fas fa-times"></i></button></header><div class="hetk-safety-editor-body"><div id="hetk-safety-editor-msg" class="hetk-user-editor-message"></div><div class="hetk-safety-form-grid"><label><span>XTB guruhi *</span><select id="hetk-safety-group">${SAFETY_GROUPS.map(g=>`<option value="${g}" ${effectiveSafetyGroup(target)===g?'selected':''}>${g} guruh</option>`).join('')}</select></label><label><span>Guvohnoma raqami</span><input id="hetk-safety-cert" value="${escapeAttr(rec.certificateNo||'')}" placeholder="Masalan: 125/26"></label><label><span>Bilimlar sinovi sanasi *</span><input id="hetk-safety-exam" type="date" value="${escapeAttr(rec.examDate||'')}"></label><label><span>Ruxsatnoma amal qilish muddati *</span><input id="hetk-safety-until" type="date" value="${escapeAttr(rec.validUntil||'')}"></label></div><label class="hetk-safety-notes-label"><span>Izoh</span><textarea id="hetk-safety-notes" rows="3" placeholder="Sinov yoki ruxsatnoma bo‘yicha izoh">${escapeHtml(rec.notes||'')}</textarea></label></div><footer><button type="button" data-close-safety>Bekor qilish</button><button type="button" id="hetk-safety-save"><i class="fas fa-save"></i> Saqlash</button></footer></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close-safety]').forEach(x=>x.addEventListener('click',closeSafetyOverlay));
    byId('hetk-safety-save').addEventListener('click',()=>saveSafetyPermit(uid));
  }

  async function saveSafetyPermit(uid){
    const raw=teamUsersCache[uid]; if(!raw) return;
    const target=Object.assign({uid},raw); if(!canEditSafetyPermit(target)) return;
    const group=String(byId('hetk-safety-group').value||'I');
    const certificateNo=String(byId('hetk-safety-cert').value||'').trim();
    const examDate=String(byId('hetk-safety-exam').value||'');
    const validUntil=String(byId('hetk-safety-until').value||'');
    const notes=String(byId('hetk-safety-notes').value||'').trim();
    const msg=byId('hetk-safety-editor-msg'); const btn=byId('hetk-safety-save');
    if(!examDate || !validUntil){msg.className='hetk-user-editor-message show error';msg.textContent='Bilimlar sinovi sanasi va ruxsatnoma muddatini kiriting.';return;}
    if(parseDateEnd(validUntil)<parseDateStart(examDate)){msg.className='hetk-user-editor-message show error';msg.textContent='Ruxsatnoma muddati sinov sanasidan oldin bo‘lishi mumkin emas.';return;}
    setBusy(btn,true,'Saqlanmoqda...');
    try{
      const now=Date.now(); const roleLabel=getRoleLabel(currentAccount);
      const safety={group,certificateNo,examDate,validUntil,notes,updatedAt:now,updatedBy:currentAccount.uid,updatedByName:currentAccount.fullName||currentAccount.login||'',updatedByRole:roleLabel};
      await databaseRef.ref('users/'+uid+'/safety').update(safety);
      await safeSyncEmployeeTelegram(uid,Object.assign({},target,{safety,updatedAt:now}),{showError:true});
      closeSafetyOverlay();
    }catch(e){msg.className='hetk-user-editor-message show error';msg.textContent=friendlyAuthError(e);}finally{setBusy(btn,false);}
  }

  function closeDisciplineOverlay(){ const el=byId('hetk-discipline-overlay'); if(el) el.remove(); }

  function openDisciplineEditor(uid){
    const raw=teamUsersCache[uid]; if(!raw) return;
    const target=Object.assign({uid},raw); if(!canManageDiscipline(target)) return;
    closeDisciplineOverlay();
    const overlay=document.createElement('div');overlay.id='hetk-discipline-overlay';overlay.className='hetk-safety-overlay';
    overlay.innerHTML=`<div class="hetk-safety-overlay-backdrop" data-close-discipline></div><div class="hetk-safety-editor hetk-discipline-editor"><header><div><small>${escapeHtml(target.fullName||'Hodim')}</small><h3>Intizomiy chora</h3></div><button type="button" data-close-discipline><i class="fas fa-times"></i></button></header><div class="hetk-safety-editor-body"><div id="hetk-discipline-msg" class="hetk-user-editor-message"></div><div class="hetk-discipline-type"><label><input type="radio" name="hetk-discipline-type" value="warning" checked><span><i class="fas fa-exclamation-circle"></i> Ogohlantirish</span></label><label><input type="radio" name="hetk-discipline-type" value="reprimand"><span><i class="fas fa-gavel"></i> Hayfsan</span></label></div><label class="hetk-safety-notes-label"><span>Sababi *</span><textarea id="hetk-discipline-reason" rows="4" placeholder="Ogohlantirish yoki hayfsan sababini yozing"></textarea></label><div class="hetk-discipline-rule"><i class="fas fa-clock"></i> Chora berilgan vaqtdan boshlab 1 yil amal qiladi va muddat tugagach faol ro‘yxatdan avtomatik chiqadi.</div></div><footer><button type="button" data-close-discipline>Bekor qilish</button><button type="button" id="hetk-discipline-save"><i class="fas fa-check"></i> Tasdiqlash</button></footer></div>`;
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-close-discipline]').forEach(x=>x.addEventListener('click',closeDisciplineOverlay));
    byId('hetk-discipline-save').addEventListener('click',()=>saveDisciplinaryAction(uid));
  }

  async function saveDisciplinaryAction(uid){
    const raw=teamUsersCache[uid]; if(!raw) return;
    const target=Object.assign({uid},raw); if(!canManageDiscipline(target)) return;
    const type=(document.querySelector('input[name="hetk-discipline-type"]:checked')||{}).value||'warning';
    const reason=String(byId('hetk-discipline-reason').value||'').trim(); const msg=byId('hetk-discipline-msg'); const btn=byId('hetk-discipline-save');
    if(reason.length<3){msg.className='hetk-user-editor-message show error';msg.textContent='Sababini yozing.';return;}
    setBusy(btn,true,'Saqlanmoqda...');
    try{
      const now=Date.now(); const ref=databaseRef.ref('users/'+uid+'/disciplinaryActions').push();
      const action={type,reason,issuedAt:now,expiresAt:now+DISCIPLINE_LIFETIME_MS,issuedByUid:currentAccount.uid,issuedByName:currentAccount.fullName||currentAccount.login||'',issuedByRole:getRoleLabel(currentAccount)};
      await ref.set(action);
      const actions=Object.assign({},target.disciplinaryActions||{}); actions[ref.key]=action;
      await safeSyncEmployeeTelegram(uid,Object.assign({},target,{disciplinaryActions:actions,updatedAt:now}),{showError:true});
      closeDisciplineOverlay();
    }catch(e){msg.className='hetk-user-editor-message show error';msg.textContent=friendlyAuthError(e);}finally{setBusy(btn,false);}
  }

  async function removeDisciplinaryAction(uid,actionId){
    const raw=teamUsersCache[uid]; if(!raw || !actionId) return;
    const target=Object.assign({uid},raw); if(!canManageDiscipline(target)) return;
    if(!confirm('Bu ogohlantirish/hayfsanni olib tashlaysizmi?')) return;
    try{
      await databaseRef.ref('users/'+uid+'/disciplinaryActions/'+actionId).remove();
      const actions=Object.assign({},target.disciplinaryActions||{}); delete actions[actionId];
      await safeSyncEmployeeTelegram(uid,Object.assign({},target,{disciplinaryActions:actions,updatedAt:Date.now()}),{showError:true});
    }catch(e){alert(friendlyAuthError(e));}
  }

  function normalizeWorkZoneName(value){
    let name=String(value || '').trim().replace(/\s+/g,' ');
    if(!name) return '';
    if(!/\bU\s*\/\s*J$/i.test(name)) name += ' U/J';
    return name.replace(/\s*U\s*\/\s*J$/i,' U/J');
  }

  function workZoneRoots(zone){
    return Object.keys((zone && zone.folders) || {}).filter(id => zone.folders[id]);
  }

  function workZoneAccessibleIds(zone){
    const set=new Set();
    workZoneRoots(zone).forEach(id => {
      if(!teamFoldersCache[id]) return;
      set.add(id);
      getChildrenFolderIds(id,teamFoldersCache).forEach(child => set.add(child));
    });
    return Array.from(set);
  }

  function canCurrentUserUseWorkZone(zone){
    if(!currentAccount || !zone || zone.active===false) return false;
    if(currentAccount.rootAccess || currentAccount.role==='super_admin') return true;
    if(currentAccount.workZoneId && currentAccount.workZoneId === zone.id) return true;
    const mine=new Set(getAccessibleFolderIds(currentAccount,teamFoldersCache));
    const roots=workZoneRoots(zone);
    return roots.length ? roots.every(id => mine.has(id)) : false;
  }

  function applyAvatar(container, photoData){
    if(!container) return;
    if(photoData){
      container.innerHTML = `<img src="${photoData}" alt="Profil rasmi" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;">`;
    }else{
      container.innerHTML = '<i class="fas fa-user"></i>';
    }
  }

  function populateProfile(account){
    const nameEl = byId('profile-name');
    const posEl = byId('profile-position');
    const regionEl = byId('profile-region');
    if(nameEl) nameEl.textContent = account.fullName || 'F.I.Sh';
    if(posEl) posEl.textContent = getRoleLabel(account);
    if(regionEl){
      const zoneRole = account.role === 'master' || account.role === 'electrician';
      regionEl.textContent = zoneRole ? '' : (account.region || 'Hudud biriktirilmagan');
      regionEl.style.display = zoneRole ? 'none' : '';
    }
    const avatar = document.querySelector('.hetk-profile-avatar');
    applyAvatar(avatar, accountAvatarUrl(account));
    renderProfileSafetySummary(account);
    renderPersonalEditor(account);
    renderEmployeesManager(account);
    installLogoutButton();
  }

  function renderPersonalEditor(account){
    const pane = document.querySelector('[data-profile-pane="personal"]');
    if(!pane) return;
    const roleLabel = getRoleLabel(account);
    pane.innerHTML = `
      <div class="hetk-account-card">
        <div class="hetk-account-head">
          <div class="hetk-account-photo" id="hetk-account-photo">
            <div class="hetk-account-photo-placeholder" id="hetk-account-photo-preview"><i class="fas fa-user"></i></div>
            <label class="hetk-account-photo-btn" for="hetk-account-photo-input" title="Rasmni almashtirish"><i class="fas fa-camera"></i></label>
            <input id="hetk-account-photo-input" type="file" accept="image/*" hidden>
          </div>
          <div><h3>${escapeHtml(account.fullName || 'F.I.Sh')}</h3><p>${escapeHtml(roleLabel)}${(account.role==='master'||account.role==='electrician') ? '' : ' · '+escapeHtml(account.region || 'Hudud biriktirilmagan')}</p></div>
        </div>
        <div class="hetk-account-body">
          <div class="hetk-account-grid">
            <div class="hetk-account-field"><label>F.I.Sh</label><input id="hetk-edit-name" value="${escapeAttr(account.fullName || '')}"></div>
            <div class="hetk-account-field"><label>Telefon</label><input id="hetk-edit-phone" value="${escapeAttr(account.phone || '')}" placeholder="+998 ..."></div>
            <div class="hetk-account-field"><label>Jinsi</label><select id="hetk-edit-gender"><option value="male" ${normalizeGender(account.gender)==='male'?'selected':''}>Erkak</option><option value="female" ${normalizeGender(account.gender)==='female'?'selected':''}>Ayol</option></select></div>
            <div class="hetk-account-field" id="hetk-login-field"><label>Login</label><input id="hetk-edit-login" value="${escapeAttr(account.login || '')}" autocomplete="username" placeholder="Masalan: tojiev1"><small class="hetk-field-error" id="hetk-login-error"></small></div>
            <div class="hetk-account-field" id="hetk-login-password-field"><label>Loginni o‘zgartirish uchun hozirgi parol</label><input id="hetk-login-current-password" type="password" autocomplete="current-password" placeholder="Login o‘zgarmasa shart emas"><small class="hetk-field-error" id="hetk-login-password-error"></small></div>
            <div class="hetk-account-field"><label>Lavozim</label><input value="${escapeAttr(roleLabel)}" readonly></div>
            ${(account.role==='master'||account.role==='electrician') ? `<div class="hetk-account-field"><label>Ustalik joyi</label><input value="${escapeAttr(account.workZoneName || account.region || '')}" readonly></div>` : `<div class="hetk-account-field"><label>Hudud</label><input value="${escapeAttr(account.region || '')}" readonly></div>`}
            <div class="hetk-account-field"><label>Holati</label><input value="${account.active === false ? 'Nofaol' : 'Faol'}" readonly></div>
          </div>
          <div class="hetk-account-actions"><button id="hetk-save-profile" class="hetk-account-btn primary" type="button"><i class="fas fa-save"></i> Saqlash</button></div>
          <div class="hetk-account-status" id="hetk-profile-save-status"></div>

          <div class="hetk-account-password">
            <h4><i class="fas fa-key"></i> Parolni almashtirish</h4>
            <div class="hetk-account-grid">
              <div class="hetk-account-field"><label>Hozirgi parol</label><input id="hetk-current-password" type="password" autocomplete="current-password"></div>
              <div class="hetk-account-field"><label>Yangi parol</label><input id="hetk-new-password" type="password" autocomplete="new-password" placeholder="Kamida 6 ta belgi"></div>
              <div class="hetk-account-field"><label>Yangi parolni takrorlang</label><input id="hetk-new-password2" type="password" autocomplete="new-password" placeholder="Yangi parolni yana kiriting"></div>
            </div>
            <div class="hetk-account-actions"><button id="hetk-change-password" class="hetk-account-btn light" type="button"><i class="fas fa-lock"></i> Parolni yangilash</button></div>
            <div class="hetk-account-status" id="hetk-password-status"></div>
          </div>
        </div>
        ${renderProfileSafetySections(account)}
      </div>`;

    const photoPreview = byId('hetk-account-photo-preview');
    applyAvatar(photoPreview, accountAvatarUrl(account));
    byId('hetk-account-photo-input').addEventListener('change', handlePhotoUpload);
    byId('hetk-save-profile').addEventListener('click', saveProfileChanges);
    byId('hetk-change-password').addEventListener('click', changePassword);
    bindSafetyActions(pane);
    const loginEl=byId('hetk-edit-login'); if(loginEl) loginEl.addEventListener('input',clearLoginFieldErrors);
    const loginPwd=byId('hetk-login-current-password'); if(loginPwd) loginPwd.addEventListener('input',clearLoginFieldErrors);
  }

  function roleDef(role){
    return ROLE_DEFS[role] || {label: role || 'Hodim', level: 0, createRoles: [], canCreateUsers:false, canDeactivateUsers:false, canManagePermissions:false, canManageFolders:false};
  }

  function defaultPermissionsForRole(role){
    const def = roleDef(role);
    return {
      createUsers: !!def.canCreateUsers,
      deactivateUsers: !!def.canDeactivateUsers,
      managePermissions: !!def.canManagePermissions,
      manageFolders: !!def.canManageFolders
    };
  }

  function hasPermission(permission, account){
    const acc = account || currentAccount;
    if(!acc) return false;
    if(acc.role === 'super_admin') return true;
    if(acc.permissions && Object.prototype.hasOwnProperty.call(acc.permissions, permission)) return !!acc.permissions[permission];
    const def = roleDef(acc.role);
    const map = {
      createUsers:'canCreateUsers',
      deactivateUsers:'canDeactivateUsers',
      managePermissions:'canManagePermissions',
      manageFolders:'canManageFolders'
    };
    return !!def[map[permission]];
  }

  function getChildrenFolderIds(folderId, folderMap){
    const out=[];
    Object.keys(folderMap || {}).forEach(id => {
      if(folderMap[id] && folderMap[id].parentId === folderId){
        out.push(id);
        out.push(...getChildrenFolderIds(id, folderMap));
      }
    });
    return out;
  }

  function getAccessibleFolderIds(account, folderMap){
    const acc = account || currentAccount;
    const folders = folderMap || teamFoldersCache || {};
    if(!acc) return [];
    if(acc.rootAccess) return Object.keys(folders);
    const roots = Object.keys(acc.folders || {}).filter(id => acc.folders[id]);
    const set = new Set();
    roots.forEach(id => {
      if(!folders[id]) return;
      set.add(id);
      getChildrenFolderIds(id, folders).forEach(child => set.add(child));
    });
    return Array.from(set);
  }

  function getVisibleFolderIds(account, folderMap){
    const acc = account || currentAccount;
    const folders = folderMap || teamFoldersCache || {};
    if(!acc) return [];
    if(acc.rootAccess) return Object.keys(folders);
    const set = new Set(getAccessibleFolderIds(acc, folders));
    Array.from(set).forEach(id => {
      let cur=id;
      let guard=0;
      while(cur && cur !== 'root' && folders[cur] && guard < 100){
        const parent=folders[cur].parentId;
        if(parent && parent !== 'root') set.add(parent);
        cur=parent;
        guard++;
      }
    });
    return Array.from(set);
  }

  function canAccessFolder(folderId, folderMap, account){
    const acc=account || currentAccount;
    if(!acc) return false;
    if(folderId === 'root') return true;
    if(acc.rootAccess) return true;
    return getAccessibleFolderIds(acc, folderMap || teamFoldersCache).includes(folderId);
  }

  function canSeeFolder(folderId, folderMap, account){
    const acc=account || currentAccount;
    if(!acc) return false;
    if(folderId === 'root') return true;
    if(acc.rootAccess) return true;
    return getVisibleFolderIds(acc, folderMap || teamFoldersCache).includes(folderId);
  }

  function folderPath(folderId, folderMap){
    const folders=folderMap || teamFoldersCache || {};
    const path=[];
    let cur=folderId, guard=0;
    while(cur && cur !== 'root' && folders[cur] && guard < 100){
      path.unshift(folders[cur].name || 'Papka');
      cur=folders[cur].parentId;
      guard++;
    }
    return path.join(' / ');
  }

  function normalizeSelectedFolderRoots(ids, folderMap){
    const folders=folderMap || teamFoldersCache || {};
    const unique=Array.from(new Set((ids || []).filter(id => folders[id])));
    return unique.filter(id => {
      let cur=folders[id] && folders[id].parentId;
      let guard=0;
      while(cur && cur !== 'root' && folders[cur] && guard < 100){
        if(unique.includes(cur)) return false;
        cur=folders[cur].parentId;
        guard++;
      }
      return true;
    });
  }

  function accountFolderRoots(account){
    return Object.keys((account && account.folders) || {}).filter(id => account.folders[id]);
  }

  function isTargetWithinScope(target){
    if(!currentAccount || !target) return false;
    if(currentAccount.role === 'super_admin' || currentAccount.rootAccess) return true;
    if(target.rootAccess) return false;
    const mySet=new Set(getAccessibleFolderIds(currentAccount, teamFoldersCache));
    const targetRoots=accountFolderRoots(target);
    if(!targetRoots.length) return false;
    return targetRoots.every(id => mySet.has(id));
  }

  function canViewTarget(target){
    if(!currentAccount || !target) return false;
    if(target.uid === currentAccount.uid) return true;
    if(currentAccount.role === 'super_admin') return true;
    // MMQXT va E muhandisi o‘z hududidagi barcha hodimlarni, lavozimidan qat’i nazar ko‘radi.
    if(isSafetyOfficer(currentAccount)) return isTargetWithinScope(target);
    if(Number(target.level || roleDef(target.role).level || 0) >= Number(currentAccount.level || roleDef(currentAccount.role).level || 0)) return false;
    return isTargetWithinScope(target);
  }

  function canManageTarget(target, action){
    if(!currentAccount || !target || target.uid === currentAccount.uid) return false;
    const myDef=roleDef(currentAccount.role);
    const targetLevel=Number(target.level || roleDef(target.role).level || 0);
    const myLevel=Number(currentAccount.level || myDef.level || 0);
    if(targetLevel >= myLevel) return false;
    if(!isTargetWithinScope(target)) return false;
    if(currentAccount.role === 'super_admin') return true;
    if(action === 'permissions' && hasPermission('managePermissions')) return true;
    if(action === 'deactivate' && hasPermission('deactivateUsers')){
      return (myDef.createRoles || []).includes(target.role);
    }
    if(action === 'role' || action === 'edit'){
      return hasPermission('createUsers') && (myDef.createRoles || []).includes(target.role);
    }
    return false;
  }

  function getCreatableRoles(){
    if(!currentAccount) return [];
    return (roleDef(currentAccount.role).createRoles || []).filter(r => ROLE_DEFS[r]);
  }

  function renderEmployeesManager(account){
    const pane=document.querySelector('[data-profile-pane="employees"]');
    if(!pane) return;
    const canCreate=hasPermission('createUsers', account) && getCreatableRoles().length>0;
    const canPerm=hasPermission('managePermissions', account);
    const canManageZones=canManageWorkZones();
    pane.innerHTML=`
      <div class="hetk-team-wrap">
        <div class="hetk-team-toolbar">
          <div>
            <h3>Hodimlar va ruxsatlar</h3>
            <p>Lavozim, hudud va papkalarga kirish huquqlarini boshqarish.</p>
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            ${canManageZones ? '<button id="hetk-manage-workzones" class="hetk-team-add" type="button"><i class="fas fa-hard-hat"></i><span>U/J larni boshqarish</span></button>' : ''}
            ${canCreate ? '<button id="hetk-add-user" class="hetk-team-add" type="button"><i class="fas fa-user-plus"></i><span>Yangi hodim / admin</span></button>' : ''}
          </div>
        </div>
        ${canPerm && !canCreate ? '<div class="hetk-team-info"><i class="fas fa-shield-alt"></i> Sizga quyi lavozimdagi hodimlarning papka ruxsatlarini o‘zgartirish huquqi berilgan.</div>' : ''}
        <div class="hetk-team-layout">
          <section class="hetk-team-list-card">
            <div class="hetk-team-search"><i class="fas fa-search"></i><input id="hetk-team-search" placeholder="Hodimni qidirish..."></div>
            ${isSafetyOfficer(account) ? `<div class="hetk-safety-filters"><select id="hetk-safety-filter"><option value="all">Barcha ruxsatnomalar</option><option value="expired">Muddati o‘tgan</option><option value="10">10 kun ichida</option><option value="30">30 kun ichida</option><option value="90">90 kun ichida</option><option value="valid">Amaldagi</option><option value="none">Muddat kiritilmagan</option></select><select id="hetk-safety-group-filter"><option value="all">Barcha XTB guruhlar</option>${SAFETY_GROUPS.map(g=>`<option value="${g}">${g} guruh</option>`).join('')}</select></div>` : ''}
            <div class="hetk-team-count" id="hetk-team-count">Yuklanmoqda...</div>
            <div class="hetk-team-list" id="hetk-team-list"></div>
          </section>
          <section class="hetk-team-detail-card" id="hetk-team-detail">
            <div class="hetk-team-empty"><i class="fas fa-user-shield"></i><h4>Hodimni tanlang</h4><p>Ma’lumot va ruxsatlarni ko‘rish uchun chap tomondan hodimni tanlang.</p></div>
          </section>
        </div>
      </div>
      <div id="hetk-user-editor" class="hetk-user-editor" hidden>
        <div class="hetk-user-editor-backdrop" data-close-user-editor></div>
        <div class="hetk-user-editor-sheet">
          <div class="hetk-user-editor-head">
            <div><h3 id="hetk-user-editor-title">Yangi hodim / admin</h3><p id="hetk-user-editor-subtitle">Lavozim va ruxsat etilgan hududlarni belgilang.</p></div>
            <button type="button" class="hetk-user-editor-close" data-close-user-editor><i class="fas fa-times"></i></button>
          </div>
          <div class="hetk-user-editor-body">
            <div id="hetk-user-editor-message" class="hetk-user-editor-message"></div>
            <div class="hetk-user-form-grid">
              <div class="hetk-user-field"><label>F.I.Sh *</label><input id="hetk-user-fullname" placeholder="To‘liq ism-sharif"></div>
              <div class="hetk-user-field"><label>Telefon</label><input id="hetk-user-phone" placeholder="+998 ..."></div>
              <div class="hetk-user-field"><label>Jinsi *</label><select id="hetk-user-gender"><option value="male">Erkak</option><option value="female">Ayol</option></select></div>
              <div class="hetk-user-field"><label>Login *</label><input id="hetk-user-login" placeholder="Masalan: xatirchi.master"></div>
              <div class="hetk-user-field"><label>Lavozim *</label><select id="hetk-user-role"></select></div>
              <div class="hetk-user-field hetk-create-password"><label>Vaqtinchalik parol *</label><input id="hetk-user-password" type="password" placeholder="Kamida 6 ta belgi"></div>
              <div class="hetk-user-field hetk-create-password"><label>Parolni takrorlang *</label><input id="hetk-user-password2" type="password" placeholder="Parolni qayta kiriting"></div>
            </div>
            <div id="hetk-user-workzone-section" class="hetk-user-workzone-section" hidden>
              <div class="hetk-user-folder-title">
                <div>
                  <h4><i class="fas fa-hard-hat"></i> Ustalik joyi (U/J)</h4>
                  <p id="hetk-user-workzone-help">Master va elektromontyor doim bitta U/J ga bog‘lanadi.</p>
                </div>
              </div>
              <div class="hetk-workzone-grid">
                <div class="hetk-user-field">
                  <label>U/J ni tanlang *</label>
                  <select id="hetk-user-workzone-select"></select>
                </div>
                <div id="hetk-user-workzone-new-wrap" class="hetk-user-field" hidden>
                  <label>Yangi U/J nomi *</label>
                  <input id="hetk-user-workzone-new-name" placeholder="Masalan: Zarafshon U/J">
                </div>
              </div>
              <div id="hetk-user-workzone-current" class="hetk-workzone-current"></div>
            </div>
            <div class="hetk-user-folder-section">
              <div class="hetk-user-folder-title"><div><h4><i class="fas fa-folder-tree"></i> Papka / hudud ruxsati</h4><p>Tanlangan papka va uning ichidagi barcha pastki papkalar ko‘rinadi.</p></div><span id="hetk-selected-folder-count">0 ta tanlangan</span></div>
              <div class="hetk-team-search" style="margin:10px 0"><i class="fas fa-search"></i><input id="hetk-user-folder-search" placeholder="Papka nomini qidirish..."></div>
              <div id="hetk-user-folder-tree" class="hetk-user-folder-tree"></div>
            </div>
          </div>
          <div class="hetk-user-editor-foot">
            <button type="button" class="hetk-user-cancel" data-close-user-editor>Bekor qilish</button>
            <button type="button" id="hetk-user-save" class="hetk-user-save"><i class="fas fa-save"></i> Saqlash</button>
          </div>
        </div>
      </div>
      <div id="hetk-workzone-editor" class="hetk-user-editor" hidden>
        <div class="hetk-user-editor-backdrop" data-close-workzone-editor></div>
        <div class="hetk-user-editor-sheet">
          <div class="hetk-user-editor-head">
            <div><h3>Ustalik joylarini boshqarish</h3><p>U/J hududlari va mas’ul Masterini mavjud hodimlardan belgilang.</p></div>
            <button type="button" class="hetk-user-editor-close" data-close-workzone-editor><i class="fas fa-times"></i></button>
          </div>
          <div class="hetk-user-editor-body">
            <div id="hetk-workzone-editor-message" class="hetk-user-editor-message"></div>
            <div class="hetk-user-form-grid">
              <div class="hetk-user-field"><label>U/J ni tanlang *</label><select id="hetk-workzone-manage-select"></select></div>
              <div class="hetk-user-field"><label>U/J nomi *</label><input id="hetk-workzone-manage-name" placeholder="Masalan: Zarafshon U/J"></div>
              <div class="hetk-user-field"><label>Mas’ul Master *</label><select id="hetk-workzone-manage-master"></select></div>
            </div>
            <div class="hetk-user-folder-section">
              <div class="hetk-user-folder-title"><div><h4><i class="fas fa-folder-tree"></i> U/J xizmat ko‘rsatadigan papkalar</h4><p>Bir U/J ga ko‘p papka, bitta papkaga bir nechta U/J biriktirish mumkin.</p></div><span id="hetk-workzone-folder-count">0 ta tanlangan</span></div>
              <div class="hetk-team-search" style="margin:10px 0"><i class="fas fa-search"></i><input id="hetk-workzone-folder-search" placeholder="Papka nomini qidirish..."></div>
              <div id="hetk-workzone-folder-tree" class="hetk-user-folder-tree"></div>
            </div>
          </div>
          <div class="hetk-user-editor-foot">
            <button type="button" class="hetk-user-cancel" data-close-workzone-editor>Bekor qilish</button>
            <button type="button" id="hetk-workzone-save" class="hetk-user-save"><i class="fas fa-save"></i> U/J ni saqlash</button>
          </div>
        </div>
      </div>`;

    if(usersTeamRef) usersTeamRef.off('value');
    if(foldersTeamRef) foldersTeamRef.off('value');
    if(workZonesTeamRef) workZonesTeamRef.off('value');
    usersTeamRef=databaseRef.ref('users');
    foldersTeamRef=databaseRef.ref('Folders');
    workZonesTeamRef=databaseRef.ref('WorkZones');
    usersTeamRef.on('value', snap => {
      teamUsersCache=snap.val() || {};
      if(selectedTeamUid && !teamUsersCache[selectedTeamUid]) selectedTeamUid=null;
      renderTeamList();
      if(selectedTeamUid) renderTeamDetail(selectedTeamUid);
    });
    foldersTeamRef.on('value', snap => {
      teamFoldersCache=snap.val() || {};
      renderTeamList();
      if(selectedTeamUid) renderTeamDetail(selectedTeamUid);
      if(!byId('hetk-user-editor').hidden) renderUserFolderPicker(getEditorSelectedFolders());
    });
    workZonesTeamRef.on('value', snap => {
      teamWorkZonesCache=snap.val() || {};
      Object.keys(teamWorkZonesCache).forEach(id => { if(teamWorkZonesCache[id]) teamWorkZonesCache[id].id=id; });
      renderTeamList();
      if(selectedTeamUid) renderTeamDetail(selectedTeamUid);
      if(!byId('hetk-user-editor').hidden) refreshWorkZoneEditor();
    });
    const search=byId('hetk-team-search');
    if(search) search.addEventListener('input', renderTeamList);
    const safetyFilter=byId('hetk-safety-filter'); if(safetyFilter) safetyFilter.addEventListener('change',renderTeamList);
    const safetyGroupFilter=byId('hetk-safety-group-filter'); if(safetyGroupFilter) safetyGroupFilter.addEventListener('change',renderTeamList);
    const add=byId('hetk-add-user');
    if(add) add.addEventListener('click', openCreateUserEditor);
    const manageZones=byId('hetk-manage-workzones');
    if(manageZones) manageZones.addEventListener('click',openWorkZoneManager);
    document.querySelectorAll('[data-close-user-editor]').forEach(el => el.addEventListener('click', closeUserEditor));
    const roleSelect=byId('hetk-user-role');
    if(roleSelect) roleSelect.addEventListener('change', () => refreshWorkZoneEditor());
    const zoneSelect=byId('hetk-user-workzone-select');
    if(zoneSelect) zoneSelect.addEventListener('change', () => handleWorkZoneSelectionChange());
    const folderSearch=byId('hetk-user-folder-search');
    if(folderSearch) folderSearch.addEventListener('input', () => renderUserFolderPicker());
    const save=byId('hetk-user-save');
    if(save) save.addEventListener('click', saveUserEditor);
    document.querySelectorAll('[data-close-workzone-editor]').forEach(el=>el.addEventListener('click',closeWorkZoneManager));
    const manageSelect=byId('hetk-workzone-manage-select');
    if(manageSelect) manageSelect.addEventListener('change',()=>loadWorkZoneManager(manageSelect.value));
    const manageSearch=byId('hetk-workzone-folder-search');
    if(manageSearch) manageSearch.addEventListener('input',()=>renderWorkZoneFolderPicker());
    const manageSave=byId('hetk-workzone-save');
    if(manageSave) manageSave.addEventListener('click',saveWorkZoneManager);
  }

  function getVisibleUsers(){
    const q=String((byId('hetk-team-search') && byId('hetk-team-search').value) || '').trim().toLowerCase();
    const permitFilter=String((byId('hetk-safety-filter')&&byId('hetk-safety-filter').value)||'all');
    const groupFilter=String((byId('hetk-safety-group-filter')&&byId('hetk-safety-group-filter').value)||'all');
    return Object.keys(teamUsersCache).map(uid => Object.assign({uid},teamUsersCache[uid] || {})).filter(canViewTarget).filter(u => {
      if(q){
        const roots=accountFolderRoots(u);
        const paths=roots.map(id=>folderPath(id)).join(' ');
        if(![u.fullName,u.login,getRoleLabel(u),u.region,u.workZoneName,paths].join(' ').toLowerCase().includes(q)) return false;
      }
      if(groupFilter!=='all' && effectiveSafetyGroup(u)!==groupFilter) return false;
      if(permitFilter!=='all'){
        const st=permitState(u);
        if(permitFilter==='expired' && st.kind!=='expired') return false;
        if(permitFilter==='none' && st.kind!=='none') return false;
        if(permitFilter==='valid' && (st.kind==='expired'||st.kind==='none')) return false;
        if(['10','30','90'].includes(permitFilter)){
          const limit=Number(permitFilter);
          if(st.days===null || st.kind==='expired' || st.days>limit) return false;
        }
      }
      return true;
    }).sort((a,b) => {
      if(isSafetyOfficer(currentAccount)){
        const ax=permitState(a), bx=permitState(b);
        const av=ax.kind==='expired'?-1:(ax.days===null?999999:ax.days);
        const bv=bx.kind==='expired'?-1:(bx.days===null?999999:bx.days);
        if(av!==bv) return av-bv;
      }
      if(a.uid === currentAccount.uid) return -1;
      if(b.uid === currentAccount.uid) return 1;
      return Number(b.level||0)-Number(a.level||0) || String(a.fullName||'').localeCompare(String(b.fullName||''));
    });
  }

  function folderChainIds(folderId){
    const chain=[];
    let cur=folderId,guard=0;
    while(cur && cur!=='root' && teamFoldersCache[cur] && guard<100){
      chain.unshift(cur);
      cur=teamFoldersCache[cur].parentId;
      guard++;
    }
    return chain;
  }

  function commonFolderForIds(ids){
    const chains=(ids||[]).filter(id=>teamFoldersCache[id]).map(folderChainIds);
    if(!chains.length) return '__root__';
    let common='__root__';
    const min=Math.min(...chains.map(c=>c.length));
    for(let i=0;i<min;i++){
      const id=chains[0][i];
      if(chains.every(c=>c[i]===id)) common=id;
      else break;
    }
    return common;
  }

  function teamUserPlacementFolder(u){
    if(u.rootAccess) return '__root__';
    let roots=[];
    if(u.workZoneId && teamWorkZonesCache[u.workZoneId]) roots=workZoneRoots(teamWorkZonesCache[u.workZoneId]);
    if(!roots.length) roots=accountFolderRoots(u);
    return commonFolderForIds(roots);
  }

  function buildTeamTree(users){
    const nodes={__root__:{id:'__root__',name:'Tashkilot',type:'root',parent:null,children:new Set(),users:[],count:0}};
    function ensureFolder(id){
      if(!id || id==='__root__') return nodes.__root__;
      if(nodes[id]) return nodes[id];
      const f=teamFoldersCache[id];
      if(!f) return nodes.__root__;
      const parentId=(f.parentId && f.parentId!=='root' && teamFoldersCache[f.parentId]) ? f.parentId : '__root__';
      const parent=ensureFolder(parentId);
      nodes[id]={id,name:f.name||'Papka',type:'folder',parent:parent.id,children:new Set(),users:[],count:0};
      parent.children.add(id);
      return nodes[id];
    }
    users.forEach(u=>{
      let parent=ensureFolder(teamUserPlacementFolder(u));
      if(u.workZoneName){
        const zkey='__zone__'+String(u.workZoneId || u.workZoneName).replace(/[^a-zA-Z0-9_-]/g,'_');
        if(!nodes[zkey]){
          nodes[zkey]={id:zkey,name:u.workZoneName,type:'zone',parent:parent.id,children:new Set(),users:[],count:0};
          parent.children.add(zkey);
        }
        parent=nodes[zkey];
      }
      parent.users.push(u);
    });
    function countNode(id){
      const n=nodes[id];
      if(!n) return 0;
      let c=n.users.length;
      Array.from(n.children).forEach(ch=>{c+=countNode(ch);});
      n.count=c;
      return c;
    }
    countNode('__root__');
    return nodes;
  }

  function teamTreeIcon(node){
    if(node.type==='zone') return 'fa-hard-hat';
    if(node.type==='root') return 'fa-sitemap';
    const f=teamFoldersCache[node.id] || {};
    const name=String(f.name||node.name||'').toLowerCase();
    if(name.includes('respubl') || name.includes("o'zbekiston") || name.includes('ozbekiston')) return 'fa-globe-asia';
    if(name.includes('viloyat') || name.includes('hf')) return 'fa-map-marked-alt';
    if(name.includes('tuman') || name.includes('tet')) return 'fa-building';
    if(name.includes('shahar')) return 'fa-city';
    return 'fa-folder';
  }

  function renderTeamUserRow(u,depth){
    const selected=selectedTeamUid===u.uid ? ' selected' : '';
    return `<button class="hetk-team-user hetk-team-tree-user${selected}" style="--team-depth:${depth}" type="button" data-team-uid="${escapeAttr(u.uid)}">
      <span class="hetk-team-user-avatar"><img src="${escapeAttr(accountAvatarUrl(u))}" alt=""></span>
      <span class="hetk-team-user-main"><b>${escapeHtml(u.fullName || 'Nomsiz hodim')}</b><small>${escapeHtml(getRoleLabel(u))}</small><em>${escapeHtml(u.login || '')}</em></span>
      <span class="hetk-team-user-side"><span class="hetk-team-safety-badge ${permitState(u).kind}">XTB ${escapeHtml(effectiveSafetyGroup(u))}</span><span class="hetk-team-user-state ${u.active===false?'off':'on'}">${u.active===false?'Nofaol':'Faol'}</span></span>
    </button>`;
  }

  function renderTeamTreeNode(nodes,id,depth,searching){
    const node=nodes[id];
    if(!node || !node.count) return '';
    const children=Array.from(node.children).filter(cid=>nodes[cid] && nodes[cid].count).sort((a,b)=>String(nodes[a].name||'').localeCompare(String(nodes[b].name||'')));
    const users=node.users.slice().sort((a,b)=>Number(b.level||0)-Number(a.level||0) || String(a.fullName||'').localeCompare(String(b.fullName||'')));
    const expanded=searching || teamTreeExpanded.has(id);
    const hasChildren=children.length || users.length;
    let html='';
    if(id!=='__root__'){
      html+=`<button type="button" class="hetk-team-tree-node ${node.type}" data-team-tree-toggle="${escapeAttr(id)}" style="--team-depth:${depth}">
        <i class="fas ${hasChildren ? (expanded?'fa-chevron-down':'fa-chevron-right') : 'fa-minus'} hetk-team-tree-arrow"></i>
        <i class="fas ${teamTreeIcon(node)} hetk-team-tree-icon"></i>
        <span>${escapeHtml(node.name)}</span><b>${node.count}</b>
      </button>`;
    }
    if(id==='__root__' || expanded){
      const childDepth=id==='__root__'?0:depth+1;
      html+=users.map(u=>renderTeamUserRow(u,childDepth)).join('');
      html+=children.map(ch=>renderTeamTreeNode(nodes,ch,childDepth,searching)).join('');
    }
    return html;
  }

  function renderTeamList(){
    const box=byId('hetk-team-list');
    if(!box) return;
    const users=getVisibleUsers();
    const count=byId('hetk-team-count');
    const q=String((byId('hetk-team-search') && byId('hetk-team-search').value) || '').trim();
    if(count) count.textContent=users.length + ' ta foydalanuvchi' + (q ? ' topildi' : '');
    if(!users.length){
      box.innerHTML='<div class="hetk-team-no-users">Hozircha ko‘rinadigan hodimlar yo‘q.</div>';
      return;
    }
    const nodes=buildTeamTree(users);
    if(!teamTreeAutoInitialized && !q){
      teamTreeExpanded.add('__root__');
      if(users.length<=100){
        Object.keys(nodes).forEach(id=>teamTreeExpanded.add(id));
      }else if(currentAccount){
        let id=teamUserPlacementFolder(currentAccount);
        if(id && id!=='__root__') folderChainIds(id).forEach(x=>teamTreeExpanded.add(x));
      }
      teamTreeAutoInitialized=true;
    }
    box.innerHTML=renderTeamTreeNode(nodes,'__root__',0,!!q);
    box.querySelectorAll('[data-team-tree-toggle]').forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.dataset.teamTreeToggle;
      if(teamTreeExpanded.has(id)) teamTreeExpanded.delete(id); else teamTreeExpanded.add(id);
      renderTeamList();
    }));
    box.querySelectorAll('[data-team-uid]').forEach(btn => btn.addEventListener('click', () => {
      selectedTeamUid=btn.dataset.teamUid;
      renderTeamList();
      renderTeamDetail(selectedTeamUid);
    }));
  }

  function renderTeamDetail(uid){
    const box=byId('hetk-team-detail');
    const raw=teamUsersCache[uid];
    if(!box || !raw) return;
    const u=Object.assign({uid},raw);
    const roots=accountFolderRoots(u);
    const canEdit=canManageTarget(u,'permissions') || canManageTarget(u,'edit');
    const canDeactivate=canManageTarget(u,'deactivate');
    const canSafetyEdit=canEditSafetyPermit(u);
    const canDiscipline=canManageDiscipline(u);
    const chips=u.rootAccess ? '<span class="hetk-scope-chip root"><i class="fas fa-globe"></i> Barcha hududlar</span>' : (roots.length ? roots.map(id => `<span class="hetk-scope-chip"><i class="fas fa-folder"></i>${escapeHtml(folderPath(id) || (teamFoldersCache[id] && teamFoldersCache[id].name) || 'Papka')}</span>`).join('') : '<span class="hetk-scope-chip empty">Papka biriktirilmagan</span>');
    box.innerHTML=`
      <div class="hetk-team-detail-head">
        <span class="hetk-team-detail-avatar"><img src="${escapeAttr(accountAvatarUrl(u))}" alt=""></span>
        <div><h3>${escapeHtml(u.fullName || 'Nomsiz hodim')}</h3><p>${escapeHtml(getRoleLabel(u))}</p><span>${escapeHtml(u.login || '')}</span></div>
        <span class="hetk-detail-status ${u.active===false?'off':'on'}"><i></i>${u.active===false?'Nofaol':'Tizimda faol'}</span>
      </div>
      ${safetyPermitHtml(u,{canEdit:canSafetyEdit})}
      ${disciplineHtml(u,{canManage:canDiscipline})}
      <div class="hetk-team-detail-section"><h4>Ruxsat etilgan hududlar</h4><div class="hetk-scope-chips">${chips}</div></div>
      <div class="hetk-team-detail-grid">
        <div><span>Telefon</span><b>${escapeHtml(u.phone || '—')}</b></div>
        ${(u.role==='master' || u.role==='electrician') ? `<div><span>Ustalik joyi</span><b>${escapeHtml(u.workZoneName || u.region || 'Biriktirilmagan')}</b></div>` : `<div><span>Hudud</span><b>${escapeHtml(u.region || '—')}</b></div>`}
        <div><span>Yaratgan</span><b>${escapeHtml(u.createdByName || '—')}</b></div>
        <div><span>Oxirgi kirish</span><b>${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</b></div>
      </div>
      ${(canEdit || canDeactivate) ? `<div class="hetk-team-detail-actions">
        ${canEdit ? '<button type="button" id="hetk-edit-team-user" class="primary"><i class="fas fa-user-shield"></i> Lavozim / papka ruxsatlari</button>' : ''}
        ${canDeactivate ? `<button type="button" id="hetk-toggle-team-user" class="${u.active===false?'restore':'danger'}"><i class="fas ${u.active===false?'fa-user-check':'fa-user-slash'}"></i> ${u.active===false?'Qayta faollashtirish':'Bloklash'}</button>` : ''}
        ${(canDeactivate && u.active===false) ? '<button type="button" id="hetk-delete-team-user" class="permanent"><i class="fas fa-trash-alt"></i> Butunlay o‘chirish</button>' : ''}
      </div>` : ((!canSafetyEdit && !canDiscipline) ? '<div class="hetk-team-readonly"><i class="fas fa-lock"></i> Bu foydalanuvchining lavozim/papka ma’lumotlarini boshqarish huquqi yo‘q.</div>' : '')}`;
    const edit=byId('hetk-edit-team-user'); if(edit) edit.addEventListener('click', () => openEditUserEditor(uid));
    const toggle=byId('hetk-toggle-team-user'); if(toggle) toggle.addEventListener('click', () => toggleUserActive(uid));
    const del=byId('hetk-delete-team-user'); if(del) del.addEventListener('click', () => deleteUserPermanently(uid));
    bindSafetyActions(box);
  }

  function editorMessage(type,text){
    const el=byId('hetk-user-editor-message');
    if(!el) return;
    el.className='hetk-user-editor-message' + (text ? ' show '+type : '');
    el.textContent=text || '';
  }

  function fillRoleOptions(selectedRole, allowRoleEdit){
    const select=byId('hetk-user-role');
    if(!select) return;
    let roles=getCreatableRoles();
    if(selectedRole && !roles.includes(selectedRole)) roles=[selectedRole].concat(roles);
    select.innerHTML=roles.map(r => `<option value="${escapeAttr(r)}" ${r===selectedRole?'selected':''}>${escapeHtml(roleDef(r).label)}</option>`).join('');
    select.disabled=!allowRoleEdit;
  }

  function getSelectedWorkZoneId(){
    const el=byId('hetk-user-workzone-select');
    return el ? el.value : '';
  }

  function getWorkZoneById(id){
    const z=teamWorkZonesCache[id];
    return z ? Object.assign({id},z) : null;
  }

  function canCreateNewWorkZoneForRole(role){
    return role==='master' && !!currentAccount && ['super_admin','director','chief_engineer'].includes(currentAccount.role);
  }

  function getAvailableWorkZones(){
    return Object.keys(teamWorkZonesCache).map(id => Object.assign({id},teamWorkZonesCache[id] || {}))
      .filter(z => z.active!==false && canCurrentUserUseWorkZone(z))
      .sort((a,b) => String(a.name||'').localeCompare(String(b.name||'')));
  }

  function refreshWorkZoneEditor(preferredId){
    const section=byId('hetk-user-workzone-section');
    const roleEl=byId('hetk-user-role');
    const select=byId('hetk-user-workzone-select');
    const newWrap=byId('hetk-user-workzone-new-wrap');
    const help=byId('hetk-user-workzone-help');
    const currentBox=byId('hetk-user-workzone-current');
    if(!section || !roleEl || !select) return;
    const role=roleEl.value;
    const needsZone=role==='master' || role==='electrician';
    section.hidden=!needsZone;
    if(!needsZone){
      editorFolderLimitRoots=null;editorFolderLocked=false;
      if(newWrap) newWrap.hidden=true;
      renderUserFolderPicker(getEditorSelectedFolders());
      return;
    }
    const editing=editingTeamUid ? Object.assign({uid:editingTeamUid},teamUsersCache[editingTeamUid] || {}) : null;
    const editingCanCore = !editing || canManageTarget(editing,'edit');
    const fixedByMaster=currentAccount && currentAccount.role==='master' && role==='electrician';
    const available=getAvailableWorkZones();
    let selected=preferredId || (editing && editing.workZoneId) || (fixedByMaster ? currentAccount.workZoneId : '') || select.value || '';
    const opts=['<option value="">U/J ni tanlang</option>'];
    available.forEach(z => opts.push(`<option value="${escapeAttr(z.id)}">${escapeHtml(z.name || 'Nomsiz U/J')}</option>`));
    if(canCreateNewWorkZoneForRole(role)) opts.push('<option value="__new__">+ Yangi U/J yaratish</option>');
    select.innerHTML=opts.join('');
    if(selected && (selected==='__new__' || available.some(z=>z.id===selected))) select.value=selected;
    else if(fixedByMaster && currentAccount.workZoneId) select.value=currentAccount.workZoneId;
    select.disabled=fixedByMaster || !editingCanCore;
    if(help){
      if(role==='master') help.textContent='U/J doimiy hudud nomi. Master almashsa TP larni emas, faqat shu U/J ning masterini almashtirasiz.';
      else help.textContent='Elektromontyor o‘z U/J siga bog‘lanadi. Element kiritganda U/J ni o‘zgartira olmaydi.';
    }
    handleWorkZoneSelectionChange(true);
    if(currentBox && fixedByMaster && !currentAccount.workZoneId) currentBox.innerHTML='<span class="warn">Sizga hali U/J biriktirilmagan. Bosh admin avval Master profilingizga U/J biriktirsin.</span>';
  }

  function handleWorkZoneSelectionChange(skipNameReset){
    const roleEl=byId('hetk-user-role');
    const select=byId('hetk-user-workzone-select');
    const newWrap=byId('hetk-user-workzone-new-wrap');
    const newName=byId('hetk-user-workzone-new-name');
    const currentBox=byId('hetk-user-workzone-current');
    if(!roleEl || !select) return;
    const role=roleEl.value;
    const id=select.value;
    if(newWrap) newWrap.hidden=id!=='__new__';
    if(id!=='__new__' && newName && !skipNameReset) newName.value='';
    const zone=id && id!=='__new__' ? getWorkZoneById(id) : null;
    if(zone){
      const roots=workZoneRoots(zone);
      editorFolderLimitRoots=roots.length ? roots : null;
      editorFolderLocked=role==='master' && roots.length>0;
      if(currentBox){
        const master=zone.currentMasterUid && teamUsersCache[zone.currentMasterUid];
        currentBox.innerHTML=`<span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(zone.name || 'U/J')}</span>${master ? `<small>Hozirgi master: <b>${escapeHtml(master.fullName || 'Nomsiz')}</b></small>` : '<small>Hozirgi master biriktirilmagan</small>'}`;
      }
      const selected=(role==='master' && roots.length) ? roots : getEditorSelectedFolders().filter(x => workZoneAccessibleIds(zone).includes(x));
      renderUserFolderPicker(selected.length ? selected : roots);
    }else{
      editorFolderLimitRoots=null;
      editorFolderLocked=false;
      if(currentBox) currentBox.innerHTML=id==='__new__' ? '<small>Yangi U/J tanlangan papka/hududlar asosida yaratiladi.</small>' : '';
      renderUserFolderPicker(getEditorSelectedFolders());
    }
  }

  function getAssignableRootIds(){
    if(!currentAccount) return [];
    if(editorFolderLimitRoots && editorFolderLimitRoots.length){
      return normalizeSelectedFolderRoots(editorFolderLimitRoots,teamFoldersCache);
    }
    if(currentAccount.rootAccess){
      return Object.keys(teamFoldersCache).filter(id => teamFoldersCache[id] && teamFoldersCache[id].parentId === 'root');
    }
    return normalizeSelectedFolderRoots(accountFolderRoots(currentAccount), teamFoldersCache);
  }

  function renderUserFolderPicker(selectedIds){
    const box=byId('hetk-user-folder-tree');
    if(!box) return;
    if(Array.isArray(selectedIds)){
      editorSelectedFolderIds=new Set(normalizeSelectedFolderRoots(selectedIds,teamFoldersCache));
      editorSelectedFolderIds.forEach(id=>folderChainIds(id).forEach(parent=>folderPickerExpanded.add(parent)));
    }
    let accessible=new Set(getAccessibleFolderIds(currentAccount,teamFoldersCache));
    if(editorFolderLimitRoots && editorFolderLimitRoots.length){
      const limited=new Set();
      editorFolderLimitRoots.forEach(id=>{ if(teamFoldersCache[id]){ limited.add(id); getChildrenFolderIds(id,teamFoldersCache).forEach(c=>limited.add(c)); } });
      accessible=new Set(Array.from(accessible).filter(id=>limited.has(id)));
    }
    const roots=getAssignableRootIds();
    if(!roots.length){
      box.innerHTML='<div class="hetk-folder-picker-empty">Sizga biriktirilgan papka topilmadi.</div>';
      updateSelectedFolderCount();
      return;
    }
    const childrenByParent={};
    Object.keys(teamFoldersCache).forEach(id=>{
      const f=teamFoldersCache[id];
      if(!f || !accessible.has(id)) return;
      const parent=f.parentId || 'root';
      (childrenByParent[parent]||(childrenByParent[parent]=[])).push(id);
    });
    Object.keys(childrenByParent).forEach(parent=>childrenByParent[parent].sort((a,b)=>String((teamFoldersCache[a]||{}).name||'').localeCompare(String((teamFoldersCache[b]||{}).name||''))));
    const query=String((byId('hetk-user-folder-search')&&byId('hetk-user-folder-search').value)||'').trim().toLowerCase();
    const matching=new Set();
    if(query){
      Object.keys(teamFoldersCache).forEach(id=>{
        const f=teamFoldersCache[id];
        if(!f || !accessible.has(id) || !String(f.name||'').toLowerCase().includes(query)) return;
        matching.add(id);
        folderChainIds(id).forEach(parent=>matching.add(parent));
      });
    }
    function nodeHtml(id,level){
      if(!teamFoldersCache[id] || !accessible.has(id)) return '';
      if(query && !matching.has(id)) return '';
      const f=teamFoldersCache[id];
      const children=(childrenByParent[id]||[]).filter(cid=>!query || matching.has(cid));
      const expanded=query || folderPickerExpanded.has(id);
      return `<div class="hetk-folder-pick-node">
        <label class="hetk-folder-pick-row" style="--folder-level:${level};padding-left:${8+level*22}px">
          ${children.length ? `<button type="button" data-folder-pick-toggle="${escapeAttr(id)}" aria-expanded="${expanded?'true':'false'}" style="width:24px;height:24px;border:0;background:transparent;color:#54708a;font-weight:900;font-size:18px;cursor:pointer">${expanded?'−':'+'}</button>` : '<span style="display:inline-block;width:24px"></span>'}
          <input class="hetk-folder-pick-check" type="checkbox" value="${escapeAttr(id)}" ${editorSelectedFolderIds.has(id)?'checked':''} ${editorFolderLocked?'disabled':''}>
          <i class="fas fa-folder" style="color:${escapeAttr(f.color || '#1687ff')}"></i>
          <span>${escapeHtml(f.name || 'Papka')}</span>
          ${children.length ? '<small>'+children.length+' ta ichki</small>' : ''}
        </label>
        ${children.length && expanded ? `<div class="hetk-folder-pick-children">${children.map(cid => nodeHtml(cid,level+1)).join('')}</div>` : ''}
      </div>`;
    }
    box.innerHTML=roots.map(id => nodeHtml(id,0)).join('');
    box.querySelectorAll('[data-folder-pick-toggle]').forEach(btn=>btn.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();
      const id=btn.dataset.folderPickToggle;
      if(folderPickerExpanded.has(id)) folderPickerExpanded.delete(id); else folderPickerExpanded.add(id);
      renderUserFolderPicker();
    }));
    box.querySelectorAll('.hetk-folder-pick-check').forEach(cb => cb.addEventListener('change', () => {
      if(cb.checked){
        const id=cb.value;
        let ancestor=teamFoldersCache[id] && teamFoldersCache[id].parentId,blocked=false,guard=0;
        while(ancestor && ancestor!=='root' && teamFoldersCache[ancestor] && guard<100){
          if(editorSelectedFolderIds.has(ancestor)){blocked=true;break;}
          ancestor=teamFoldersCache[ancestor].parentId;guard++;
        }
        if(!blocked){
          editorSelectedFolderIds.add(id);
          Array.from(editorSelectedFolderIds).forEach(other=>{
            if(other!==id && getChildrenFolderIds(id,teamFoldersCache).includes(other)) editorSelectedFolderIds.delete(other);
          });
        }
      }else editorSelectedFolderIds.delete(cb.value);
      renderUserFolderPicker();
    }));
    updateSelectedFolderCount();
  }

  function getEditorSelectedFolders(){
    return Array.from(editorSelectedFolderIds);
  }

  function updateSelectedFolderCount(){
    const el=byId('hetk-selected-folder-count');
    if(!el) return;
    const ids=getEditorSelectedFolders();
    el.textContent=ids.length + ' ta tanlangan';
  }

  function canManageWorkZones(){
    return !!(currentAccount && ['super_admin','director','chief_engineer'].includes(currentAccount.role));
  }

  function manageableWorkZones(){
    return Object.keys(teamWorkZonesCache).map(id=>Object.assign({id},teamWorkZonesCache[id]||{}))
      .filter(zone=>zone.active!==false && canCurrentUserUseWorkZone(zone))
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  }

  function workZoneManagerCandidates(zone){
    const currentMasterUid=zone && zone.currentMasterUid;
    const myLevel=Number(currentAccount.level||roleDef(currentAccount.role).level||0);
    return Object.keys(teamUsersCache).map(uid=>Object.assign({uid},teamUsersCache[uid]||{}))
      .filter(user=>user.active!==false || user.uid===currentMasterUid)
      .filter(user=>user.role!=='super_admin')
      .filter(user=>user.uid===currentMasterUid || (user.uid!==currentAccount.uid && Number(user.level||roleDef(user.role).level||0)<myLevel))
      .filter(user=>currentAccount.rootAccess || currentAccount.role==='super_admin' || isTargetWithinScope(user) || user.uid===currentMasterUid)
      .sort((a,b)=>String(a.fullName||a.login||'').localeCompare(String(b.fullName||b.login||'')));
  }

  function workZoneManagerMessage(type,text){
    const el=byId('hetk-workzone-editor-message');
    if(!el) return;
    el.className='hetk-user-editor-message'+(text?' show '+type:'');
    el.textContent=text||'';
  }

  function openWorkZoneManager(){
    if(!canManageWorkZones()) return;
    const editor=byId('hetk-workzone-editor');
    const select=byId('hetk-workzone-manage-select');
    if(!editor || !select) return;
    const zones=manageableWorkZones();
    select.innerHTML=zones.length ? zones.map(zone=>`<option value="${escapeAttr(zone.id)}">${escapeHtml(zone.name||'Nomsiz U/J')}</option>`).join('') : '<option value="">U/J topilmadi</option>';
    editor.hidden=false;
    document.body.classList.add('hetk-user-editor-open');
    workZoneManagerMessage('','');
    loadWorkZoneManager(select.value);
  }

  function closeWorkZoneManager(){
    const editor=byId('hetk-workzone-editor');
    if(editor) editor.hidden=true;
    editingWorkZoneId=null;
    workZoneSelectedFolderIds=new Set();
    workZonePickerExpanded=new Set();
    workZoneManagerMessage('','');
    if(!byId('hetk-user-editor') || byId('hetk-user-editor').hidden) document.body.classList.remove('hetk-user-editor-open');
  }

  function loadWorkZoneManager(zoneId){
    const zone=getWorkZoneById(zoneId);
    editingWorkZoneId=zone ? zone.id : null;
    const name=byId('hetk-workzone-manage-name');
    const master=byId('hetk-workzone-manage-master');
    if(name) name.value=zone ? (zone.name||'') : '';
    if(master){
      const candidates=zone ? workZoneManagerCandidates(zone) : [];
      master.innerHTML='<option value="">Master tanlanmagan</option>'+candidates.map(user=>`<option value="${escapeAttr(user.uid)}">${escapeHtml(user.fullName||user.login||'Nomsiz')} — ${escapeHtml(getRoleLabel(user))}</option>`).join('');
      if(zone && zone.currentMasterUid) master.value=zone.currentMasterUid;
    }
    workZoneSelectedFolderIds=new Set(normalizeSelectedFolderRoots(zone ? workZoneRoots(zone) : [],teamFoldersCache));
    workZonePickerExpanded=new Set();
    workZoneSelectedFolderIds.forEach(id=>folderChainIds(id).forEach(parent=>workZonePickerExpanded.add(parent)));
    const search=byId('hetk-workzone-folder-search'); if(search) search.value='';
    renderWorkZoneFolderPicker();
  }

  function renderWorkZoneFolderPicker(){
    const box=byId('hetk-workzone-folder-tree');
    if(!box || !currentAccount) return;
    const accessible=new Set(getAccessibleFolderIds(currentAccount,teamFoldersCache));
    const roots=currentAccount.rootAccess ? Object.keys(teamFoldersCache).filter(id=>teamFoldersCache[id] && teamFoldersCache[id].parentId==='root') : normalizeSelectedFolderRoots(accountFolderRoots(currentAccount),teamFoldersCache);
    const childrenByParent={};
    Object.keys(teamFoldersCache).forEach(id=>{
      const folder=teamFoldersCache[id]; if(!folder || !accessible.has(id)) return;
      const parent=folder.parentId||'root'; (childrenByParent[parent]||(childrenByParent[parent]=[])).push(id);
    });
    Object.keys(childrenByParent).forEach(parent=>childrenByParent[parent].sort((a,b)=>String((teamFoldersCache[a]||{}).name||'').localeCompare(String((teamFoldersCache[b]||{}).name||''))));
    const query=String((byId('hetk-workzone-folder-search')&&byId('hetk-workzone-folder-search').value)||'').trim().toLowerCase();
    const matching=new Set();
    if(query){
      Object.keys(teamFoldersCache).forEach(id=>{
        const folder=teamFoldersCache[id];
        if(!folder || !accessible.has(id) || !String(folder.name||'').toLowerCase().includes(query)) return;
        matching.add(id);folderChainIds(id).forEach(parent=>matching.add(parent));
      });
    }
    function nodeHtml(id,level){
      const folder=teamFoldersCache[id];
      if(!folder || !accessible.has(id) || (query && !matching.has(id))) return '';
      const children=(childrenByParent[id]||[]).filter(child=>!query || matching.has(child));
      const expanded=query || workZonePickerExpanded.has(id);
      return `<div class="hetk-folder-pick-node"><label class="hetk-folder-pick-row" style="--folder-level:${level};padding-left:${8+level*22}px">
        ${children.length?`<button type="button" data-workzone-folder-toggle="${escapeAttr(id)}" style="width:24px;height:24px;border:0;background:transparent;color:#54708a;font-weight:900;font-size:18px;cursor:pointer">${expanded?'−':'+'}</button>`:'<span style="display:inline-block;width:24px"></span>'}
        <input class="hetk-workzone-folder-check" type="checkbox" value="${escapeAttr(id)}" ${workZoneSelectedFolderIds.has(id)?'checked':''}>
        <i class="fas fa-folder" style="color:${escapeAttr(folder.color||'#1687ff')}"></i><span>${escapeHtml(folder.name||'Papka')}</span>${children.length?'<small>'+children.length+' ta ichki</small>':''}
        </label>${children.length&&expanded?`<div class="hetk-folder-pick-children">${children.map(child=>nodeHtml(child,level+1)).join('')}</div>`:''}</div>`;
    }
    box.innerHTML=roots.map(id=>nodeHtml(id,0)).join('') || '<div class="hetk-folder-picker-empty">Ruxsat doirasida papka topilmadi.</div>';
    box.querySelectorAll('[data-workzone-folder-toggle]').forEach(btn=>btn.addEventListener('click',event=>{
      event.preventDefault();event.stopPropagation();const id=btn.dataset.workzoneFolderToggle;
      if(workZonePickerExpanded.has(id)) workZonePickerExpanded.delete(id); else workZonePickerExpanded.add(id);
      renderWorkZoneFolderPicker();
    }));
    box.querySelectorAll('.hetk-workzone-folder-check').forEach(cb=>cb.addEventListener('change',()=>{
      const id=cb.value;
      if(cb.checked){
        let parent=teamFoldersCache[id]&&teamFoldersCache[id].parentId,blocked=false,guard=0;
        while(parent&&parent!=='root'&&teamFoldersCache[parent]&&guard<100){if(workZoneSelectedFolderIds.has(parent)){blocked=true;break;}parent=teamFoldersCache[parent].parentId;guard++;}
        if(!blocked){
          workZoneSelectedFolderIds.add(id);
          const descendants=new Set(getChildrenFolderIds(id,teamFoldersCache));
          Array.from(workZoneSelectedFolderIds).forEach(other=>{if(other!==id&&descendants.has(other))workZoneSelectedFolderIds.delete(other);});
        }
      }else workZoneSelectedFolderIds.delete(id);
      renderWorkZoneFolderPicker();
    }));
    const count=byId('hetk-workzone-folder-count'); if(count) count.textContent=workZoneSelectedFolderIds.size+' ta tanlangan';
  }

  function roleHistoryEntry(fromRole,toRole,zone,reason){
    return {fromRole:fromRole||'',toRole:toRole||'',zoneId:zone.id,zoneName:zone.name||'',reason:reason||'U/J Masteri almashtirildi',changedAt:Date.now(),changedBy:currentAccount.uid,changedByName:currentAccount.fullName||currentAccount.login||''};
  }

  function restoredMasterPatch(user){
    const saved=user.preMasterState||{};
    const role=saved.role&&ROLE_DEFS[saved.role]?saved.role:'employee';
    const def=roleDef(role);
    const restoredFolders=saved.folders&&Object.keys(saved.folders).length ? saved.folders : (user.folders||{});
    return {
      role,roleLabel:saved.roleLabel||def.label,level:Number(saved.level||def.level),permissions:saved.permissions||defaultPermissionsForRole(role),
      rootAccess:!!saved.rootAccess,folders:restoredFolders,workZoneId:saved.workZoneId||null,workZoneName:saved.workZoneName||null,
      region:saved.region||buildRegionFromRoots(Object.keys(restoredFolders).filter(id=>restoredFolders[id])),preMasterState:null,active:true,updatedAt:Date.now(),updatedBy:currentAccount.uid
    };
  }

  function stageExistingMasterReplacement(updates,zone,newMasterUid,now,affected,incomingOverride){
    if(!zone || !zone.currentMasterUid || zone.currentMasterUid===newMasterUid) return;
    const oldMasterUid=zone.currentMasterUid;
    const raw=teamUsersCache[oldMasterUid];
    const oldMaster=raw ? Object.assign({uid:oldMasterUid},raw) : null;
    const historyKey=databaseRef.ref('WorkZones/'+zone.id+'/masterHistory').push().key;
    const incoming=incomingOverride||teamUsersCache[newMasterUid]||{};
    updates['WorkZones/'+zone.id+'/masterHistory/'+historyKey]={
      fromUid:oldMasterUid,toUid:newMasterUid||null,
      fromName:oldMaster?(oldMaster.fullName||oldMaster.login||''):'',
      toName:incoming.fullName||incoming.login||'',
      changedAt:now,changedBy:currentAccount.uid,changedByName:currentAccount.fullName||currentAccount.login||''
    };
    if(!oldMaster) return;
    const restore=restoredMasterPatch(oldMaster);
    Object.keys(restore).forEach(key=>updates['users/'+oldMasterUid+'/'+key]=restore[key]);
    const roleHistoryKey=databaseRef.ref('users/'+oldMasterUid+'/roleHistory').push().key;
    updates['users/'+oldMasterUid+'/roleHistory/'+roleHistoryKey]=roleHistoryEntry('master',restore.role,zone,'Masterlik yakunlandi');
    if(affected) affected[oldMasterUid]=Object.assign({},oldMaster,restore,{uid:oldMasterUid});
  }

  function stageMasterPromotionHistory(updates,user,zone,now){
    if(!user || !zone || (user.role==='master' && user.workZoneId===zone.id)) return;
    const preState=user.preMasterState||{
      role:user.role,roleLabel:user.roleLabel||getRoleLabel(user),level:user.level||roleDef(user.role).level,
      permissions:user.permissions||defaultPermissionsForRole(user.role),rootAccess:!!user.rootAccess,
      folders:user.folders||{},workZoneId:user.workZoneId||null,workZoneName:user.workZoneName||null,region:user.region||''
    };
    updates['users/'+user.uid+'/preMasterState']=preState;
    const historyKey=databaseRef.ref('users/'+user.uid+'/roleHistory').push().key;
    updates['users/'+user.uid+'/roleHistory/'+historyKey]=roleHistoryEntry(user.role,'master',zone,'U/J Masteri etib tayinlandi');
  }

  async function saveWorkZoneManager(){
    if(!canManageWorkZones() || !editingWorkZoneId) return;
    const raw=teamWorkZonesCache[editingWorkZoneId]; if(!raw) return workZoneManagerMessage('error','U/J topilmadi.');
    const zone=Object.assign({id:editingWorkZoneId},raw);
    if(!canCurrentUserUseWorkZone(zone)) return workZoneManagerMessage('error','Bu U/J ni tahrirlashga ruxsatingiz yo‘q.');
    const name=normalizeWorkZoneName(byId('hetk-workzone-manage-name').value);
    const newMasterUid=String(byId('hetk-workzone-manage-master').value||'');
    const selectedRoots=normalizeSelectedFolderRoots(Array.from(workZoneSelectedFolderIds),teamFoldersCache);
    if(name.length<4) return workZoneManagerMessage('error','U/J nomini kiriting.');
    if(!newMasterUid || !teamUsersCache[newMasterUid]) return workZoneManagerMessage('error','Mas’ul Master uchun hodimni tanlang.');
    if(!selectedRoots.length) return workZoneManagerMessage('error','Kamida bitta papkani tanlang.');
    const accessible=new Set(getAccessibleFolderIds(currentAccount,teamFoldersCache));
    if(selectedRoots.some(id=>!accessible.has(id))) return workZoneManagerMessage('error','Ruxsat berilmagan papkani biriktirib bo‘lmaydi.');
    const btn=byId('hetk-workzone-save');setBusy(btn,true,'Saqlanmoqda...');
    try{
      const now=Date.now();const folders={};selectedRoots.forEach(id=>folders[id]=true);
      const oldMasterUid=zone.currentMasterUid||'';
      const oldMaster=oldMasterUid&&teamUsersCache[oldMasterUid]?Object.assign({uid:oldMasterUid},teamUsersCache[oldMasterUid]):null;
      const newMaster=Object.assign({uid:newMasterUid},teamUsersCache[newMasterUid]);
      const updates={};const affected={};
      updates['WorkZones/'+zone.id+'/name']=name;
      updates['WorkZones/'+zone.id+'/folders']=folders;
      updates['WorkZones/'+zone.id+'/currentMasterUid']=newMasterUid;
      updates['WorkZones/'+zone.id+'/updatedAt']=now;
      updates['WorkZones/'+zone.id+'/updatedBy']=currentAccount.uid;

      if(oldMasterUid!==newMasterUid){
        const historyKey=databaseRef.ref('WorkZones/'+zone.id+'/masterHistory').push().key;
        updates['WorkZones/'+zone.id+'/masterHistory/'+historyKey]={fromUid:oldMasterUid||null,toUid:newMasterUid,fromName:oldMaster?(oldMaster.fullName||oldMaster.login||''):'',toName:newMaster.fullName||newMaster.login||'',changedAt:now,changedBy:currentAccount.uid,changedByName:currentAccount.fullName||currentAccount.login||''};
        if(oldMaster){
          const restore=restoredMasterPatch(oldMaster);
          Object.keys(restore).forEach(key=>updates['users/'+oldMasterUid+'/'+key]=restore[key]);
          const history=databaseRef.ref('users/'+oldMasterUid+'/roleHistory').push().key;
          updates['users/'+oldMasterUid+'/roleHistory/'+history]=roleHistoryEntry('master',restore.role,zone,'Masterlik yakunlandi');
          affected[oldMasterUid]=Object.assign({},oldMaster,restore,{uid:oldMasterUid});
        }
        if(newMaster.role==='master' && newMaster.workZoneId && newMaster.workZoneId!==zone.id){
          const previousZone=getWorkZoneById(newMaster.workZoneId);
          if(previousZone&&previousZone.currentMasterUid===newMasterUid){
            updates['WorkZones/'+previousZone.id+'/currentMasterUid']=null;updates['WorkZones/'+previousZone.id+'/updatedAt']=now;updates['WorkZones/'+previousZone.id+'/updatedBy']=currentAccount.uid;
          }
        }
        const preState=newMaster.preMasterState || {role:newMaster.role,roleLabel:newMaster.roleLabel||getRoleLabel(newMaster),level:newMaster.level||roleDef(newMaster.role).level,permissions:newMaster.permissions||defaultPermissionsForRole(newMaster.role),rootAccess:!!newMaster.rootAccess,folders:newMaster.folders||{},workZoneId:newMaster.workZoneId||null,workZoneName:newMaster.workZoneName||null,region:newMaster.region||''};
        updates['users/'+newMasterUid+'/preMasterState']=preState;
        const history=databaseRef.ref('users/'+newMasterUid+'/roleHistory').push().key;
        updates['users/'+newMasterUid+'/roleHistory/'+history]=roleHistoryEntry(newMaster.role,'master',zone,'U/J Masteri etib tayinlandi');
      }
      const masterDef=roleDef('master');
      const masterPatch={role:'master',roleLabel:masterDef.label,level:masterDef.level,permissions:defaultPermissionsForRole('master'),rootAccess:false,folders,workZoneId:zone.id,workZoneName:name,region:name,active:true,updatedAt:now,updatedBy:currentAccount.uid};
      Object.keys(masterPatch).forEach(key=>updates['users/'+newMasterUid+'/'+key]=masterPatch[key]);
      affected[newMasterUid]=Object.assign({},newMaster,masterPatch,{uid:newMasterUid});

      const zoneAllowed=new Set();selectedRoots.forEach(id=>{zoneAllowed.add(id);getChildrenFolderIds(id,teamFoldersCache).forEach(child=>zoneAllowed.add(child));});
      Object.keys(teamUsersCache).forEach(uid=>{
        const user=teamUsersCache[uid]||{};if(uid===newMasterUid||uid===oldMasterUid||user.workZoneId!==zone.id)return;
        const kept=normalizeSelectedFolderRoots(accountFolderRoots(user).filter(id=>zoneAllowed.has(id)),teamFoldersCache);
        const userFolders={};(kept.length?kept:selectedRoots).forEach(id=>userFolders[id]=true);
        updates['users/'+uid+'/folders']=userFolders;updates['users/'+uid+'/workZoneName']=name;updates['users/'+uid+'/region']=name;updates['users/'+uid+'/updatedAt']=now;updates['users/'+uid+'/updatedBy']=currentAccount.uid;
        affected[uid]=Object.assign({uid},user,{folders:userFolders,workZoneName:name,region:name,updatedAt:now,updatedBy:currentAccount.uid});
      });
      await databaseRef.ref().update(updates);
      for(const uid of Object.keys(affected)) await safeSyncEmployeeTelegram(uid,affected[uid],{showError:false});
      workZoneManagerMessage('success','U/J ma’lumotlari, papkalari va Masteri saqlandi.');
      setTimeout(()=>closeWorkZoneManager(),500);
    }catch(e){workZoneManagerMessage('error',friendlyAuthError(e));}
    finally{setBusy(btn,false);}
  }

  function openCreateUserEditor(){
    if(!hasPermission('createUsers') || !getCreatableRoles().length) return;
    userEditorMode='create'; editingTeamUid=null;
    byId('hetk-user-editor-title').textContent='Yangi hodim / admin';
    byId('hetk-user-editor-subtitle').textContent='Faqat o‘zingizdan quyi lavozim va o‘zingiz ko‘ra oladigan papkalarni bera olasiz.';
    byId('hetk-user-fullname').value='';byId('hetk-user-fullname').readOnly=false;
    byId('hetk-user-phone').value='';byId('hetk-user-phone').readOnly=false;
    byId('hetk-user-gender').value='male';byId('hetk-user-gender').disabled=false;
    byId('hetk-user-login').value='';byId('hetk-user-login').readOnly=false;
    byId('hetk-user-password').value='';byId('hetk-user-password2').value='';
    document.querySelectorAll('.hetk-create-password').forEach(x => x.style.display='');
    editorFolderLimitRoots=null;editorFolderLocked=false;
    editorSelectedFolderIds=new Set();folderPickerExpanded=new Set();
    const folderSearch=byId('hetk-user-folder-search');if(folderSearch) folderSearch.value='';
    fillRoleOptions(getCreatableRoles()[0],true);
    renderUserFolderPicker([]);
    refreshWorkZoneEditor();
    editorMessage('','');
    byId('hetk-user-editor').hidden=false;
    document.body.classList.add('hetk-user-editor-open');
  }

  function openEditUserEditor(uid){
    const raw=teamUsersCache[uid];
    if(!raw) return;
    const u=Object.assign({uid},raw);
    if(!(canManageTarget(u,'permissions') || canManageTarget(u,'edit'))) return;
    userEditorMode='edit';editingTeamUid=uid;
    byId('hetk-user-editor-title').textContent='Hodim ruxsatlarini tahrirlash';
    byId('hetk-user-editor-subtitle').textContent='Lavozim va papka ruxsatlari faqat sizning vakolatingiz doirasida o‘zgartiriladi.';
    const canEditCore=canManageTarget(u,'edit');
    byId('hetk-user-fullname').value=u.fullName || '';byId('hetk-user-fullname').readOnly=!canEditCore;
    byId('hetk-user-phone').value=u.phone || '';byId('hetk-user-phone').readOnly=!canEditCore;
    byId('hetk-user-gender').value=normalizeGender(u.gender);byId('hetk-user-gender').disabled=!canEditCore;
    byId('hetk-user-login').value=u.login || '';byId('hetk-user-login').readOnly=true;
    document.querySelectorAll('.hetk-create-password').forEach(x => x.style.display='none');
    editorFolderLimitRoots=null;editorFolderLocked=false;
    editorSelectedFolderIds=new Set();folderPickerExpanded=new Set();
    const folderSearch=byId('hetk-user-folder-search');if(folderSearch) folderSearch.value='';
    fillRoleOptions(u.role,canManageTarget(u,'role'));
    renderUserFolderPicker(accountFolderRoots(u));
    refreshWorkZoneEditor(u.workZoneId || '');
    editorMessage('','');
    byId('hetk-user-editor').hidden=false;
    document.body.classList.add('hetk-user-editor-open');
  }

  function closeUserEditor(){
    const el=byId('hetk-user-editor');
    if(el) el.hidden=true;
    document.body.classList.remove('hetk-user-editor-open');
    editorFolderLimitRoots=null;editorFolderLocked=false;
    editorMessage('','');
  }

  function buildRegionFromRoots(roots){
    if(!roots || !roots.length) return 'Hudud biriktirilmagan';
    if(roots.length===1) return folderPath(roots[0]) || ((teamFoldersCache[roots[0]] && teamFoldersCache[roots[0]].name) || 'Hudud');
    return roots.length + ' ta hudud / papka';
  }

  function secondaryAuth(){
    const name='HETKUserCreator';
    let app=(firebase.apps || []).find(a => a.name===name);
    if(!app) app=firebase.initializeApp(firebase.app().options,name);
    return app.auth();
  }

  async function saveUserEditor(){
    const btn=byId('hetk-user-save');
    const fullName=String(byId('hetk-user-fullname').value||'').trim();
    const phone=String(byId('hetk-user-phone').value||'').trim();
    const gender=normalizeGender(byId('hetk-user-gender').value);
    const login=normalizeLogin(byId('hetk-user-login').value);
    const role=byId('hetk-user-role').value;
    let selectedRoots=normalizeSelectedFolderRoots(getEditorSelectedFolders(),teamFoldersCache);
    if(fullName.length<3) return editorMessage('error','F.I.Sh ni to‘liq kiriting.');
    if(userEditorMode==='create' && login.length<3) return editorMessage('error','Login kamida 3 ta belgidan iborat bo‘lsin.');
    if(!ROLE_DEFS[role]) return editorMessage('error','Lavozimni tanlang.');
    if(userEditorMode==='create' && !getCreatableRoles().includes(role)) return editorMessage('error','Bu lavozimni yaratishga ruxsatingiz yo‘q.');

    const needsZone=role==='master' || role==='electrician';
    let zoneChoice=needsZone ? getSelectedWorkZoneId() : '';
    let zone=null, zoneName='', newZoneName='';
    if(needsZone){
      if(!zoneChoice) return editorMessage('error','Ustalik joyini (U/J) tanlang.');
      if(zoneChoice==='__new__'){
        if(!canCreateNewWorkZoneForRole(role)) return editorMessage('error','Yangi U/J yaratishga ruxsatingiz yo‘q.');
        newZoneName=normalizeWorkZoneName(byId('hetk-user-workzone-new-name').value);
        if(newZoneName.length<4) return editorMessage('error','U/J nomini kiriting. Masalan: Zarafshon U/J');
        zoneName=newZoneName;
      }else{
        zone=getWorkZoneById(zoneChoice);
        if(!zone || !canCurrentUserUseWorkZone(zone)) return editorMessage('error','Bu U/J sizning ruxsatingiz doirasida emas.');
        zoneName=zone.name || 'U/J';
        const zoneRoots=workZoneRoots(zone);
        if(role==='master' && zoneRoots.length) selectedRoots=normalizeSelectedFolderRoots(zoneRoots,teamFoldersCache);
        if(role==='electrician'){
          const allowed=new Set(workZoneAccessibleIds(zone));
          if(selectedRoots.some(id=>!allowed.has(id))) return editorMessage('error','Elektromontyorga faqat o‘z U/J hududi ichidan papka berish mumkin.');
          if(!selectedRoots.length && zoneRoots.length) selectedRoots=normalizeSelectedFolderRoots(zoneRoots,teamFoldersCache);
        }
      }
    }

    const myAccessible=new Set(getAccessibleFolderIds(currentAccount,teamFoldersCache));
    if(!selectedRoots.length) return editorMessage('error','Kamida bitta papka / hududni tanlang.');
    if(selectedRoots.some(id => !myAccessible.has(id))) return editorMessage('error','Sizga ruxsat berilmagan papkani biriktirib bo‘lmaydi.');
    const foldersObj={}; selectedRoots.forEach(id => foldersObj[id]=true);
    const def=roleDef(role);
    const patch={
      fullName,phone,gender,role,roleLabel:def.label,level:def.level,
      region:needsZone ? zoneName : buildRegionFromRoots(selectedRoots),
      rootAccess:false,folders:foldersObj,
      permissions:defaultPermissionsForRole(role),updatedAt:Date.now(),updatedBy:currentAccount.uid
    };
    if(needsZone){ patch.workZoneId=zoneChoice==='__new__' ? '' : zoneChoice; patch.workZoneName=zoneName; }
    else { patch.workZoneId=null;patch.workZoneName=null; }

    const confirmMasterReplacement=(z,targetUid) => {
      if(role!=='master' || !z || !z.currentMasterUid || z.currentMasterUid===targetUid) return true;
      const old=teamUsersCache[z.currentMasterUid];
      const oldName=old && old.fullName ? old.fullName : 'avvalgi master';
      return confirm(`${z.name || 'U/J'} da hozir ${oldName} master.\n\nYangi master biriktirilsa avvalgi master profili saqlanadi va oldingi lavozimiga qaytariladi. Davom etasizmi?`);
    };

    setBusy(btn,true,userEditorMode==='create'?'Yaratilmoqda...':'Saqlanmoqda...');
    try{
      const replacementAffected={};
      if(userEditorMode==='create'){
        const pass1=byId('hetk-user-password').value, pass2=byId('hetk-user-password2').value;
        if(pass1.length<6) throw new Error('Parol kamida 6 ta belgidan iborat bo‘lsin.');
        if(pass1!==pass2) throw new Error('Parollar bir xil emas.');
        if(role==='master' && zone && !confirmMasterReplacement(zone,'')) throw new Error('Master almashtirish bekor qilindi.');
        if(await loginAlreadyExists(login,'')) throw new Error('Bu login avval mavjud. Boshqa login kiriting.');
        const sec=secondaryAuth();
        let cred=null;
        try{
          const internalEmail = makeInternalAuthEmail();
          cred=await sec.createUserWithEmailAndPassword(internalEmail,pass1);
          const uid=cred.user.uid;
          const now=Date.now();
          let finalZoneId=patch.workZoneId;
          const updates={};
          if(role==='master' && zoneChoice==='__new__'){
            finalZoneId=databaseRef.ref('WorkZones').push().key;
            updates['WorkZones/'+finalZoneId]={
              name:newZoneName,active:true,folders:foldersObj,currentMasterUid:uid,
              createdAt:now,createdBy:currentAccount.uid,updatedAt:now,updatedBy:currentAccount.uid
            };
          }else if(role==='master' && zone){
            finalZoneId=zone.id;
            updates['WorkZones/'+zone.id+'/currentMasterUid']=uid;
            updates['WorkZones/'+zone.id+'/updatedAt']=now;
            updates['WorkZones/'+zone.id+'/updatedBy']=currentAccount.uid;
            if(!workZoneRoots(zone).length) updates['WorkZones/'+zone.id+'/folders']=foldersObj;
            stageExistingMasterReplacement(updates,zone,uid,now,replacementAffected,{fullName,login});
          }
          const account=Object.assign({},patch,{
            uid,login,authEmail:internalEmail,active:true,createdAt:now,createdBy:currentAccount.uid,
            createdByName:currentAccount.fullName || currentAccount.login || 'Admin',lastLoginAt:0,photoData:null,
            safety:defaultSafetyRecord(),disciplinaryActions:{}
          });
          if(needsZone){account.workZoneId=finalZoneId;account.workZoneName=zoneName;account.region=zoneName;}
          updates['users/'+uid]=account;
          updates['loginIndex/'+loginIndexKey(login)]={uid,login,authEmail:internalEmail,active:true,updatedAt:now};
          await databaseRef.ref().update(updates);
          Object.assign(account,await safeSyncEmployeeTelegram(uid,account,{replaceDefaultPhoto:true,showError:true}));
          for(const oldUid of Object.keys(replacementAffected)) await safeSyncEmployeeTelegram(oldUid,replacementAffected[oldUid],{showError:false});
          try{ await cred.user.updateProfile({displayName:fullName}); }catch(_e){}
          await sec.signOut();
          selectedTeamUid=uid;
          closeUserEditor();
        }catch(e){
          if(cred && cred.user){ try{ await cred.user.delete(); }catch(_e){} }
          try{ await sec.signOut(); }catch(_e){}
          throw e;
        }
      }else{
        const raw=teamUsersCache[editingTeamUid];
        if(!raw) throw new Error('Hodim topilmadi.');
        const target=Object.assign({uid:editingTeamUid},raw);
        if(!(canManageTarget(target,'permissions') || canManageTarget(target,'edit'))) throw new Error('Bu hodimni tahrirlashga ruxsat yo‘q.');
        if(role!==target.role && !canManageTarget(target,'role')) throw new Error('Lavozimni o‘zgartirishga ruxsat yo‘q.');
        if(role!==target.role && !getCreatableRoles().includes(role)) throw new Error('Bu lavozimni bera olmaysiz.');
        if(!canManageTarget(target,'edit')){
          patch.fullName=target.fullName || '';
          patch.phone=target.phone || '';
          patch.gender=normalizeGender(target.gender);
          patch.role=target.role;
          patch.roleLabel=target.roleLabel || roleDef(target.role).label;
          patch.level=target.level || roleDef(target.role).level;
          patch.permissions=target.permissions || defaultPermissionsForRole(target.role);
          patch.workZoneId=target.workZoneId || null;
          patch.workZoneName=target.workZoneName || null;
          patch.region=target.region || buildRegionFromRoots(selectedRoots);
        }
        const updates={};
        let finalZoneId=patch.workZoneId;
        const oldZone=target.workZoneId ? getWorkZoneById(target.workZoneId) : null;
        if(canManageTarget(target,'edit') && needsZone){
          if(role==='master' && zone && !confirmMasterReplacement(zone,target.uid)) throw new Error('Master almashtirish bekor qilindi.');
          if(role==='master' && zoneChoice==='__new__'){
            finalZoneId=databaseRef.ref('WorkZones').push().key;
            updates['WorkZones/'+finalZoneId]={name:newZoneName,active:true,folders:foldersObj,currentMasterUid:target.uid,createdAt:Date.now(),createdBy:currentAccount.uid,updatedAt:Date.now(),updatedBy:currentAccount.uid};
            stageMasterPromotionHistory(updates,target,{id:finalZoneId,name:newZoneName},Date.now());
          }else{
            finalZoneId=zoneChoice;
            if(role==='master' && zone){
              const changeTime=Date.now();
              updates['WorkZones/'+zone.id+'/currentMasterUid']=target.uid;
              updates['WorkZones/'+zone.id+'/updatedAt']=changeTime;
              updates['WorkZones/'+zone.id+'/updatedBy']=currentAccount.uid;
              if(!workZoneRoots(zone).length) updates['WorkZones/'+zone.id+'/folders']=foldersObj;
              stageExistingMasterReplacement(updates,zone,target.uid,changeTime,replacementAffected);
              stageMasterPromotionHistory(updates,target,zone,changeTime);
            }
          }
          patch.workZoneId=finalZoneId;patch.workZoneName=zoneName;patch.region=zoneName;
        }
        if(canManageTarget(target,'edit') && oldZone && target.role==='master' && (role!=='master' || finalZoneId!==target.workZoneId) && oldZone.currentMasterUid===target.uid){
          const changeTime=Date.now();
          updates['WorkZones/'+oldZone.id+'/currentMasterUid']=null;
          updates['WorkZones/'+oldZone.id+'/updatedAt']=changeTime;
          updates['WorkZones/'+oldZone.id+'/updatedBy']=currentAccount.uid;
          const zoneHistoryKey=databaseRef.ref('WorkZones/'+oldZone.id+'/masterHistory').push().key;
          updates['WorkZones/'+oldZone.id+'/masterHistory/'+zoneHistoryKey]={fromUid:target.uid,toUid:null,fromName:target.fullName||target.login||'',toName:'',changedAt:changeTime,changedBy:currentAccount.uid,changedByName:currentAccount.fullName||currentAccount.login||''};
          if(role!=='master'){
            const userHistoryKey=databaseRef.ref('users/'+target.uid+'/roleHistory').push().key;
            updates['users/'+target.uid+'/roleHistory/'+userHistoryKey]=roleHistoryEntry('master',role,oldZone,'Masterlik yakunlandi');
            updates['users/'+target.uid+'/preMasterState']=null;
          }
        }
        // Stage 2 da Master yaratgan eski "Hodim"larni bir marta Elektromontyorga o'tkazamiz.
        if(canManageTarget(target,'edit') && role==='master' && finalZoneId){
          Object.keys(teamUsersCache).forEach(childUid=>{
            const child=teamUsersCache[childUid] || {};
            if(child.role==='employee' && child.createdBy===target.uid && !child.workZoneId){
              updates['users/'+childUid+'/role']='electrician';
              updates['users/'+childUid+'/roleLabel']=ROLE_DEFS.electrician.label;
              updates['users/'+childUid+'/level']=ROLE_DEFS.electrician.level;
              updates['users/'+childUid+'/permissions']=defaultPermissionsForRole('electrician');
              updates['users/'+childUid+'/workZoneId']=finalZoneId;
              updates['users/'+childUid+'/workZoneName']=zoneName;
              updates['users/'+childUid+'/region']=zoneName;
              updates['users/'+childUid+'/updatedAt']=Date.now();
              updates['users/'+childUid+'/updatedBy']=currentAccount.uid;
            }
          });
        }
        Object.keys(patch).forEach(key => { updates['users/'+editingTeamUid+'/'+key]=patch[key]; });
        await databaseRef.ref().update(updates);
        const updatedTarget=Object.assign({},target,patch,{uid:editingTeamUid});
        const genderChanged=normalizeGender(target.gender)!==normalizeGender(updatedTarget.gender);
        await safeSyncEmployeeTelegram(editingTeamUid,updatedTarget,{replaceDefaultPhoto:genderChanged && updatedTarget.telegramPhotoKind!=='custom',showError:true});
        for(const oldUid of Object.keys(replacementAffected)) await safeSyncEmployeeTelegram(oldUid,replacementAffected[oldUid],{showError:false});
        closeUserEditor();
      }
    }catch(e){
      editorMessage('error',friendlyAuthError(e));
      if(e && e.message && !String(e.message).startsWith('Firebase:')) editorMessage('error',e.message);
    }finally{setBusy(btn,false);}
  }

  async function toggleUserActive(uid){
    const raw=teamUsersCache[uid];
    if(!raw) return;
    const u=Object.assign({uid},raw);
    if(!canManageTarget(u,'deactivate')) return;
    const next=u.active===false;
    const text=next ? 'Ushbu foydalanuvchini qayta faollashtirasizmi?' : 'Ushbu foydalanuvchini bloklaysizmi? Login saqlanadi, lekin tizimga kira olmaydi. Keyin xohlasangiz qayta faollashtirish yoki butunlay o‘chirish mumkin.';
    if(!confirm(text)) return;
    const updates={};
    updates['users/'+uid+'/active']=next;
    updates['users/'+uid+'/updatedAt']=Date.now();
    updates['users/'+uid+'/updatedBy']=currentAccount.uid;
    if(u.login) updates['loginIndex/'+loginIndexKey(u.login)+'/active']=next;
    if(!next && u.role==='master' && u.workZoneId){
      const zone=getWorkZoneById(u.workZoneId);
      if(zone && zone.currentMasterUid===uid){
        updates['WorkZones/'+u.workZoneId+'/currentMasterUid']=null;
        updates['WorkZones/'+u.workZoneId+'/updatedAt']=Date.now();
        updates['WorkZones/'+u.workZoneId+'/updatedBy']=currentAccount.uid;
      }
    }
    await databaseRef.ref().update(updates);
    await safeSyncEmployeeTelegram(uid,Object.assign({},u,{active:next,updatedAt:updates['users/'+uid+'/updatedAt']}),{showError:true});
  }

  async function deleteUserPermanently(uid){
    const raw=teamUsersCache[uid];
    if(!raw) return;
    const u=Object.assign({uid},raw);
    if(!canManageTarget(u,'deactivate')) return;
    if(u.active!==false){
      alert('Butunlay o‘chirishdan oldin foydalanuvchini bloklang.');
      return;
    }
    const name=u.fullName || u.login || 'Foydalanuvchi';
    if(!confirm(`${name} tizim ro‘yxatidan butunlay o‘chiriladi.

Bu amalni ortga qaytarib bo‘lmaydi. Davom etasizmi?`)) return;
    const now=Date.now();
    const updates={};
    updates['DeletedUsers/'+uid]={
      uid,login:u.login||'',fullName:u.fullName||'',phone:u.phone||'',role:u.role||'',roleLabel:u.roleLabel||'',
      workZoneId:u.workZoneId||'',workZoneName:u.workZoneName||'',region:u.region||'',deletedAt:now,
      deletedBy:currentAccount.uid,deletedByName:currentAccount.fullName||currentAccount.login||'Admin'
    };
    updates['users/'+uid]=null;
    if(u.login) updates['loginIndex/'+loginIndexKey(u.login)]=null;
    Object.keys(teamWorkZonesCache || {}).forEach(zoneId=>{
      const z=teamWorkZonesCache[zoneId];
      if(z && z.currentMasterUid===uid){
        updates['WorkZones/'+zoneId+'/currentMasterUid']=null;
        updates['WorkZones/'+zoneId+'/updatedAt']=now;
        updates['WorkZones/'+zoneId+'/updatedBy']=currentAccount.uid;
      }
    });
    await deleteEmployeePost(u.telegramEmployeeMessageId);
    await databaseRef.ref().update(updates);
    if(selectedTeamUid===uid){
      selectedTeamUid=null;
      const box=byId('hetk-team-detail');
      if(box) box.innerHTML='<div class="hetk-team-empty"><i class="fas fa-user-times"></i><h4>Foydalanuvchi o‘chirildi</h4><p>Ro‘yxatdan boshqa hodimni tanlang.</p></div>';
    }
    alert('Foydalanuvchi tizim ro‘yxatidan o‘chirildi.');
  }

  function installLogoutButton(){
    const menu = byId('profile-more-menu');
    if(!menu || byId('hetk-profile-logout')) return;
    const btn = document.createElement('button');
    btn.id = 'hetk-profile-logout';
    btn.type = 'button';
    btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Tizimdan chiqish';
    btn.addEventListener('click', async () => {
      if(window.closeProfileModule) window.closeProfileModule();
      await auth.signOut();
    });
    menu.appendChild(btn);
  }

  function clearLoginFieldErrors(){
    ['hetk-login-field','hetk-login-password-field'].forEach(id=>{const el=byId(id);if(el) el.classList.remove('has-error');});
    ['hetk-login-error','hetk-login-password-error'].forEach(id=>{const el=byId(id);if(el) el.textContent='';});
  }

  function setLoginFieldError(which,text){
    const field=byId(which==='login'?'hetk-login-field':'hetk-login-password-field');
    const err=byId(which==='login'?'hetk-login-error':'hetk-login-password-error');
    if(field) field.classList.add('has-error');
    if(err) err.textContent=text||'';
    const input=byId(which==='login'?'hetk-edit-login':'hetk-login-current-password');
    if(input){input.focus(); try{input.scrollIntoView({behavior:'smooth',block:'center'});}catch(_e){}}
  }

  async function saveProfileChanges(){
    if(!currentAccount || !auth.currentUser) return;
    const name = String(byId('hetk-edit-name').value || '').trim();
    const phone = String(byId('hetk-edit-phone').value || '').trim();
    const gender = normalizeGender(byId('hetk-edit-gender') && byId('hetk-edit-gender').value);
    const oldLogin = normalizeLogin(currentAccount.login || '');
    const newLogin = normalizeLogin(byId('hetk-edit-login').value || '');
    const loginPassword = String(byId('hetk-login-current-password').value || '');
    const status = byId('hetk-profile-save-status');
    clearLoginFieldErrors();
    if(name.length < 3){ status.className='hetk-account-status error'; status.textContent='F.I.Sh ni to‘liq kiriting.'; return; }
    if(newLogin.length < 3){ status.className='hetk-account-status error'; status.textContent='Login kamida 3 ta belgidan iborat bo‘lsin.'; setLoginFieldError('login','Login kamida 3 ta belgidan iborat bo‘lsin.'); return; }
    const loginChanged = newLogin !== oldLogin;
    if(loginChanged && !loginPassword){ status.className='hetk-account-status error'; status.textContent='Login o‘zgargan. Hozirgi parolingizni kiriting.'; setLoginFieldError('password','Loginni saqlash uchun hozirgi parol majburiy.'); return; }
    const btn = byId('hetk-save-profile');
    setBusy(btn,true,'Saqlanmoqda...');
    try{
      const authEmail = String(auth.currentUser.email || currentAccount.authEmail || '');
      if(!authEmail) throw new Error('Ichki autentifikatsiya emaili topilmadi. Qayta kirib ko‘ring.');

      if(loginChanged){
        if(await loginAlreadyExists(newLogin, auth.currentUser.uid)) throw new Error('Bu login boshqa foydalanuvchida mavjud.');
        const credential = firebase.auth.EmailAuthProvider.credential(authEmail, loginPassword);
        await auth.currentUser.reauthenticateWithCredential(credential);
      }

      const now = Date.now();
      const oldGender=normalizeGender(currentAccount.gender);
      const patch = {fullName:name,phone,gender,login:newLogin,authEmail,updatedAt:now};
      const updates = {};
      updates['users/' + auth.currentUser.uid + '/fullName'] = name;
      updates['users/' + auth.currentUser.uid + '/phone'] = phone;
      updates['users/' + auth.currentUser.uid + '/gender'] = gender;
      updates['users/' + auth.currentUser.uid + '/login'] = newLogin;
      updates['users/' + auth.currentUser.uid + '/authEmail'] = authEmail;
      updates['users/' + auth.currentUser.uid + '/updatedAt'] = now;
      updates['loginIndex/' + loginIndexKey(newLogin)] = {uid:auth.currentUser.uid,login:newLogin,authEmail,active:currentAccount.active!==false,updatedAt:now};
      if(loginChanged && oldLogin) updates['loginIndex/' + loginIndexKey(oldLogin)] = null;
      await databaseRef.ref().update(updates);

      await auth.currentUser.updateProfile({displayName:name});
      currentAccount = Object.assign({},currentAccount,patch);
      currentAccount = Object.assign({},currentAccount,await safeSyncEmployeeTelegram(auth.currentUser.uid,currentAccount,{replaceDefaultPhoto:oldGender!==gender && currentAccount.telegramPhotoKind!=='custom',showError:true}));
      populateProfile(currentAccount);
      const newStatus = byId('hetk-profile-save-status');
      if(newStatus){
        newStatus.className='hetk-account-status success';
        newStatus.textContent=loginChanged ? 'Login va ma’lumotlar saqlandi. Keyingi kirishda yangi loginni ishlating.' : 'Ma’lumotlar saqlandi.';
      }
      const pwd=byId('hetk-login-current-password'); if(pwd) pwd.value='';
    }catch(e){
      const liveStatus=byId('hetk-profile-save-status') || status;
      const friendly=friendlyAuthError(e);
      liveStatus.className='hetk-account-status error'; liveStatus.textContent=friendly;
      if(loginChanged){
        if(e && ['auth/wrong-password','auth/invalid-credential','auth/invalid-login-credentials'].includes(e.code)) setLoginFieldError('password','Hozirgi parol noto‘g‘ri.');
        else if(String(friendly).toLowerCase().includes('login')) setLoginFieldError('login',friendly);
      }
    }finally{ setBusy(btn,false); }
  }

  function fileToCompressedBlob(file){
    return new Promise((resolve,reject) => {
      if(!file || !file.type.startsWith('image/')) return reject(new Error('Rasm faylini tanlang.'));
      if(file.size > 6 * 1024 * 1024) return reject(new Error('Rasm hajmi 6 MB dan katta bo‘lmasin.'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Rasm formati o‘qilmadi.'));
        img.onload = () => {
          const size = 320;
          const canvas = document.createElement('canvas');
          canvas.width=size;canvas.height=size;
          const ctx=canvas.getContext('2d');
          const scale=Math.max(size/img.width,size/img.height);
          const w=img.width*scale,h=img.height*scale;
          ctx.drawImage(img,(size-w)/2,(size-h)/2,w,h);
          canvas.toBlob(blob=>blob ? resolve(blob) : reject(new Error('Rasmni tayyorlab bo‘lmadi.')),'image/jpeg',0.82);
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoUpload(event){
    if(!currentAccount || !auth.currentUser) return;
    const file = event.target.files && event.target.files[0];
    if(!file) return;
    const status = byId('hetk-profile-save-status');
    if(status){status.className='hetk-account-status';status.textContent='Rasm tayyorlanmoqda...';}
    try{
      const photoBlob = await fileToCompressedBlob(file);
      currentAccount.updatedAt=Date.now();
      currentAccount = Object.assign({},currentAccount,await syncEmployeeTelegram(auth.currentUser.uid,currentAccount,{photoBlob}));
      currentAccount.photoData=null;
      populateProfile(currentAccount);
      const newStatus=byId('hetk-profile-save-status');
      if(newStatus){newStatus.className='hetk-account-status success';newStatus.textContent='Profil rasmi saqlandi.';}
    }catch(e){
      if(status){status.className='hetk-account-status error';status.textContent=e.message || 'Rasm saqlanmadi.';}
    }finally{ event.target.value=''; }
  }

  async function changePassword(){
    if(!auth.currentUser || !currentAccount) return;
    const currentPassword=byId('hetk-current-password').value;
    const newPassword=byId('hetk-new-password').value;
    const newPassword2=byId('hetk-new-password2').value;
    const status=byId('hetk-password-status');
    const btn=byId('hetk-change-password');
    if(!currentPassword){status.className='hetk-account-status error';status.textContent='Avval hozirgi parolingizni kiriting.';return;}
    if(newPassword.length<6){status.className='hetk-account-status error';status.textContent='Yangi parol kamida 6 ta belgidan iborat bo‘lsin.';return;}
    if(newPassword!==newPassword2){status.className='hetk-account-status error';status.textContent='Yangi parollar bir xil emas.';return;}
    if(currentPassword===newPassword){status.className='hetk-account-status error';status.textContent='Yangi parol eski paroldan farq qilishi kerak.';return;}
    setBusy(btn,true,'Yangilanmoqda...');
    try{
      const credential=firebase.auth.EmailAuthProvider.credential(String(auth.currentUser.email || currentAccount.authEmail || loginToEmail(currentAccount.login)),currentPassword);
      await auth.currentUser.reauthenticateWithCredential(credential);
      await auth.currentUser.updatePassword(newPassword);
      byId('hetk-current-password').value='';
      byId('hetk-new-password').value='';
      byId('hetk-new-password2').value='';
      status.className='hetk-account-status success';status.textContent='Parol muvaffaqiyatli almashtirildi.';
    }catch(e){status.className='hetk-account-status error';status.textContent=friendlyAuthError(e);}
    finally{setBusy(btn,false);}
  }

  function escapeHtml(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function escapeAttr(v){return escapeHtml(v);}

  async function handleSignedIn(user){
    try{
      currentAccount = await loadAccount(user);
      if(!currentAccount){
        await auth.signOut();
        setOverlayVisible(true);
        setMessage('error','Bu login uchun foydalanuvchi profili topilmadi. Administratorga murojaat qiling.');
        return;
      }
      currentAccount = await ensureLoginIndex(currentAccount, user);
      if(currentAccount.active === false){
        await auth.signOut();
        setOverlayVisible(true);
        setMessage('error','Bu foydalanuvchi bloklangan.');
        return;
      }
      if(currentUserLiveRef) currentUserLiveRef.off('value');
      currentUserLiveRef=databaseRef.ref('users/' + user.uid);
      currentUserLiveRef.on('value', async snap => {
        const live=snap.val();
        if(!live || live.active === false){
          if(auth.currentUser && auth.currentUser.uid === user.uid) await auth.signOut();
          return;
        }
        currentAccount=Object.assign({uid:user.uid},live);
        window.HETKAuth.currentUser=currentAccount;
        populateProfile(currentAccount);
        document.dispatchEvent(new CustomEvent('hetk-auth-user-updated',{detail:{user:currentAccount}}));
      });
      await databaseRef.ref('users/' + user.uid).update({lastLoginAt:Date.now()});
      if(!currentAccount.telegramEmployeeMessageId || currentAccount.photoData){
        currentAccount=Object.assign({},currentAccount,await safeSyncEmployeeTelegram(user.uid,currentAccount,{showError:false}));
      }
      populateProfile(currentAccount);
      window.HETKAuth.currentUser = currentAccount;
      setOverlayVisible(false);
      document.dispatchEvent(new CustomEvent('hetk-auth-ready',{detail:{user:currentAccount}}));
    }catch(e){
      setOverlayVisible(true);
      setMessage('error','Foydalanuvchi ma’lumotlarini yuklab bo‘lmadi: ' + friendlyAuthError(e));
    }
  }

  async function init(){
    buildAuthUI();
    bindAuthUI();
    setOverlayVisible(true);

    if(typeof firebase === 'undefined' || !firebase.apps || !firebase.apps.length){
      setMessage('error','Firebase yuklanmadi. app.js ichidagi Firebase ulanishini tekshirish kerak.');
      return;
    }
    if(typeof firebase.auth !== 'function'){
      setMessage('error','Firebase Authentication moduli yuklanmadi.');
      return;
    }
    auth = firebase.auth();
    databaseRef = firebase.database();
    await checkUsersExist();

    auth.onAuthStateChanged(async user => {
      clearMessage();
      if(user){
        if(creatingFirstAdmin) return;
        await handleSignedIn(user);
      }else{
        if(currentUserLiveRef){ currentUserLiveRef.off('value'); currentUserLiveRef=null; }
        currentAccount=null;
        window.HETKAuth.currentUser=null;
        document.dispatchEvent(new CustomEvent('hetk-auth-cleared'));
        setOverlayVisible(true);
        await checkUsersExist();
      }
    });
  }

  window.HETKAuth = {
    currentUser:null,
    roles:ROLE_DEFS,
    async getIdToken(forceRefresh){
      if(!auth || !auth.currentUser) throw new Error('AUTH_REQUIRED');
      return await auth.currentUser.getIdToken(!!forceRefresh);
    },
    getRoleLabel(role){return ROLE_DEFS[role] ? ROLE_DEFS[role].label : role;},
    getAccountRoleLabel(account){return getRoleLabel(account);},
    getWorkZones(){return teamWorkZonesCache;},
    canManageElementWorkZones(){return !!(this.currentUser && ['super_admin','director','chief_engineer'].includes(this.currentUser.role));},
    getSafetyGroup(account){return effectiveSafetyGroup(account||this.currentUser);},
    getPermitState(account){return permitState(account||this.currentUser);},
    canCreateRole(targetRole){
      const me=this.currentUser;
      return !!(me && (roleDef(me.role).createRoles || []).includes(targetRole));
    },
    hasPermission(permission){return hasPermission(permission,this.currentUser);},
    getAccessibleFolderIds(folderMap){return getAccessibleFolderIds(this.currentUser,folderMap || teamFoldersCache);},
    getVisibleFolderIds(folderMap){return getVisibleFolderIds(this.currentUser,folderMap || teamFoldersCache);},
    canAccessFolder(folderId,folderMap){return canAccessFolder(folderId,folderMap || teamFoldersCache,this.currentUser);},
    canSeeFolder(folderId,folderMap){return canSeeFolder(folderId,folderMap || teamFoldersCache,this.currentUser);},
    normalizeLogin,
    loginToEmail
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
