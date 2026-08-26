(function(){
  'use strict';

  const ROLE_DEFS = {
    super_admin:   { label: 'Bosh administrator', level: 100, canManageUsers: true },
    viloyat_admin: { label: 'Viloyat administratori', level: 80, canManageUsers: true },
    tuman_admin:   { label: 'Tuman administratori', level: 60, canManageUsers: true },
    master:        { label: 'Master', level: 40, canManageUsers: false },
    operator:      { label: 'Operator', level: 30, canManageUsers: false },
    muhandis:      { label: 'Muhandis', level: 30, canManageUsers: false }
  };

  let auth = null;
  let databaseRef = null;
  let currentAccount = null;
  let usersExist = true;
  let creatingFirstAdmin = false;

  function byId(id){ return document.getElementById(id); }

  function normalizeLogin(value){
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^\.+|\.+$/g, '');
  }

  function loginToEmail(login){
    return normalizeLogin(login) + '@hetk.local';
  }

  function friendlyAuthError(error){
    const code = error && error.code ? error.code : '';
    if(code === 'auth/operation-not-allowed') return "Firebase Authentication'da Email/Password usulini yoqish kerak.";
    if(code === 'auth/invalid-login-credentials' || code === 'auth/wrong-password' || code === 'auth/user-not-found' || code === 'auth/invalid-credential') return 'Login yoki parol noto‘g‘ri.';
    if(code === 'auth/weak-password') return 'Parol kamida 6 ta belgidan iborat bo‘lsin.';
    if(code === 'auth/email-already-in-use') return 'Bu login avval yaratilgan.';
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
      await auth.signInWithEmailAndPassword(loginToEmail(login), password);
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
      const cred = await auth.createUserWithEmailAndPassword(loginToEmail(login), pass1);
      const uid = cred.user.uid;
      const now = Date.now();
      const account = {
        uid,
        login,
        fullName,
        role: 'super_admin',
        roleLabel: ROLE_DEFS.super_admin.label,
        level: ROLE_DEFS.super_admin.level,
        region: "O'zbekiston",
        phone: '',
        active: true,
        rootAccess: true,
        folders: {},
        createdBy: uid,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
        photoData: ''
      };
      await databaseRef.ref('users/' + uid).set(account);
      await cred.user.updateProfile({displayName: fullName});
      usersExist = true;
      currentAccount = account;
      populateProfile(account);
      window.HETKAuth.currentUser = account;
      setOverlayVisible(false);
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
    if(account.roleLabel) return account.roleLabel;
    return ROLE_DEFS[account.role] ? ROLE_DEFS[account.role].label : (account.role || 'Hodim');
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
    if(regionEl) regionEl.textContent = account.region || 'Hudud biriktirilmagan';
    const avatar = document.querySelector('.hetk-profile-avatar');
    applyAvatar(avatar, account.photoData);
    renderPersonalEditor(account);
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
          <div><h3>${escapeHtml(account.fullName || 'F.I.Sh')}</h3><p>${escapeHtml(roleLabel)} · ${escapeHtml(account.region || 'Hudud biriktirilmagan')}</p></div>
        </div>
        <div class="hetk-account-body">
          <div class="hetk-account-grid">
            <div class="hetk-account-field"><label>F.I.Sh</label><input id="hetk-edit-name" value="${escapeAttr(account.fullName || '')}"></div>
            <div class="hetk-account-field"><label>Telefon</label><input id="hetk-edit-phone" value="${escapeAttr(account.phone || '')}" placeholder="+998 ..."></div>
            <div class="hetk-account-field"><label>Login</label><input value="${escapeAttr(account.login || '')}" readonly></div>
            <div class="hetk-account-field"><label>Lavozim</label><input value="${escapeAttr(roleLabel)}" readonly></div>
            <div class="hetk-account-field"><label>Hudud</label><input value="${escapeAttr(account.region || '')}" readonly></div>
            <div class="hetk-account-field"><label>Holati</label><input value="${account.active === false ? 'Nofaol' : 'Faol'}" readonly></div>
          </div>
          <div class="hetk-account-actions"><button id="hetk-save-profile" class="hetk-account-btn primary" type="button"><i class="fas fa-save"></i> Saqlash</button></div>
          <div class="hetk-account-status" id="hetk-profile-save-status"></div>

          <div class="hetk-account-password">
            <h4><i class="fas fa-key"></i> Parolni almashtirish</h4>
            <div class="hetk-account-grid">
              <div class="hetk-account-field"><label>Hozirgi parol</label><input id="hetk-current-password" type="password" autocomplete="current-password"></div>
              <div class="hetk-account-field"><label>Yangi parol</label><input id="hetk-new-password" type="password" autocomplete="new-password" placeholder="Kamida 6 ta belgi"></div>
            </div>
            <div class="hetk-account-actions"><button id="hetk-change-password" class="hetk-account-btn light" type="button"><i class="fas fa-lock"></i> Parolni yangilash</button></div>
            <div class="hetk-account-status" id="hetk-password-status"></div>
          </div>
        </div>
      </div>`;

    const photoPreview = byId('hetk-account-photo-preview');
    applyAvatar(photoPreview, account.photoData);
    byId('hetk-account-photo-input').addEventListener('change', handlePhotoUpload);
    byId('hetk-save-profile').addEventListener('click', saveProfileChanges);
    byId('hetk-change-password').addEventListener('click', changePassword);
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

  async function saveProfileChanges(){
    if(!currentAccount || !auth.currentUser) return;
    const name = String(byId('hetk-edit-name').value || '').trim();
    const phone = String(byId('hetk-edit-phone').value || '').trim();
    const status = byId('hetk-profile-save-status');
    if(name.length < 3){ status.className='hetk-account-status error'; status.textContent='F.I.Sh ni to‘liq kiriting.'; return; }
    const btn = byId('hetk-save-profile');
    setBusy(btn,true,'Saqlanmoqda...');
    try{
      const patch = {fullName:name,phone,updatedAt:Date.now()};
      await databaseRef.ref('users/' + auth.currentUser.uid).update(patch);
      await auth.currentUser.updateProfile({displayName:name});
      currentAccount = Object.assign({},currentAccount,patch);
      populateProfile(currentAccount);
      const newStatus = byId('hetk-profile-save-status');
      if(newStatus){newStatus.className='hetk-account-status success';newStatus.textContent='Ma’lumotlar saqlandi.';}
    }catch(e){
      status.className='hetk-account-status error'; status.textContent=friendlyAuthError(e);
    }finally{ setBusy(btn,false); }
  }

  function fileToCompressedDataUrl(file){
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
          resolve(canvas.toDataURL('image/jpeg',0.82));
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
      const photoData = await fileToCompressedDataUrl(file);
      await databaseRef.ref('users/' + auth.currentUser.uid).update({photoData,updatedAt:Date.now()});
      currentAccount.photoData = photoData;
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
    const status=byId('hetk-password-status');
    const btn=byId('hetk-change-password');
    if(!currentPassword){status.className='hetk-account-status error';status.textContent='Hozirgi parolni kiriting.';return;}
    if(newPassword.length<6){status.className='hetk-account-status error';status.textContent='Yangi parol kamida 6 ta belgidan iborat bo‘lsin.';return;}
    setBusy(btn,true,'Yangilanmoqda...');
    try{
      const credential=firebase.auth.EmailAuthProvider.credential(loginToEmail(currentAccount.login),currentPassword);
      await auth.currentUser.reauthenticateWithCredential(credential);
      await auth.currentUser.updatePassword(newPassword);
      byId('hetk-current-password').value='';byId('hetk-new-password').value='';
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
      if(currentAccount.active === false){
        await auth.signOut();
        setOverlayVisible(true);
        setMessage('error','Bu foydalanuvchi bloklangan.');
        return;
      }
      await databaseRef.ref('users/' + user.uid).update({lastLoginAt:Date.now()});
      populateProfile(currentAccount);
      window.HETKAuth.currentUser = currentAccount;
      setOverlayVisible(false);
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
        currentAccount=null;
        window.HETKAuth.currentUser=null;
        setOverlayVisible(true);
        await checkUsersExist();
      }
    });
  }

  window.HETKAuth = {
    currentUser:null,
    roles:ROLE_DEFS,
    getRoleLabel(role){return ROLE_DEFS[role] ? ROLE_DEFS[role].label : role;},
    canCreateRole(targetRole){
      const me=this.currentUser;
      const target=ROLE_DEFS[targetRole];
      return !!(me && target && Number(me.level||0) > target.level);
    },
    normalizeLogin,
    loginToEmail
  };

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
