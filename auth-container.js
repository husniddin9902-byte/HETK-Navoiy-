(function(){
  'use strict';

  const ROLE_DEFS = {
    super_admin: {
      label: 'Bosh administrator', level: 100,
      createRoles: ['director','chief_engineer','tb_engineer','pto_engineer','chief_dispatcher','master','adli_kard_engineer','dispatcher','electrician','employee'],
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
    tb_engineer: {
      label: 'TB muhandis', level: 75,
      createRoles: [], canCreateUsers: false, canDeactivateUsers: false, canManagePermissions: true, canManageFolders: false
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
        photoData: '',
        permissions: defaultPermissionsForRole('super_admin')
      };
      await databaseRef.ref('users/' + uid).set(account);
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
    if(account.roleLabel) return account.roleLabel;
    return ROLE_DEFS[account.role] ? ROLE_DEFS[account.role].label : (account.role || 'Hodim');
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
    applyAvatar(avatar, account.photoData);
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
            <div class="hetk-account-field"><label>Login</label><input id="hetk-edit-login" value="${escapeAttr(account.login || '')}" autocomplete="username" placeholder="Masalan: tojiev1"></div>
            <div class="hetk-account-field"><label>Loginni o‘zgartirish uchun hozirgi parol</label><input id="hetk-login-current-password" type="password" autocomplete="current-password" placeholder="Login o‘zgarmasa shart emas"></div>
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
      </div>`;

    const photoPreview = byId('hetk-account-photo-preview');
    applyAvatar(photoPreview, account.photoData);
    byId('hetk-account-photo-input').addEventListener('change', handlePhotoUpload);
    byId('hetk-save-profile').addEventListener('click', saveProfileChanges);
    byId('hetk-change-password').addEventListener('click', changePassword);
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
    pane.innerHTML=`
      <div class="hetk-team-wrap">
        <div class="hetk-team-toolbar">
          <div>
            <h3>Hodimlar va ruxsatlar</h3>
            <p>Lavozim, hudud va papkalarga kirish huquqlarini boshqarish.</p>
          </div>
          ${canCreate ? '<button id="hetk-add-user" class="hetk-team-add" type="button"><i class="fas fa-user-plus"></i><span>Yangi hodim / admin</span></button>' : ''}
        </div>
        ${canPerm && !canCreate ? '<div class="hetk-team-info"><i class="fas fa-shield-alt"></i> Sizga quyi lavozimdagi hodimlarning papka ruxsatlarini o‘zgartirish huquqi berilgan.</div>' : ''}
        <div class="hetk-team-layout">
          <section class="hetk-team-list-card">
            <div class="hetk-team-search"><i class="fas fa-search"></i><input id="hetk-team-search" placeholder="Hodimni qidirish..."></div>
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
              <div id="hetk-user-folder-tree" class="hetk-user-folder-tree"></div>
            </div>
          </div>
          <div class="hetk-user-editor-foot">
            <button type="button" class="hetk-user-cancel" data-close-user-editor>Bekor qilish</button>
            <button type="button" id="hetk-user-save" class="hetk-user-save"><i class="fas fa-save"></i> Saqlash</button>
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
    const add=byId('hetk-add-user');
    if(add) add.addEventListener('click', openCreateUserEditor);
    document.querySelectorAll('[data-close-user-editor]').forEach(el => el.addEventListener('click', closeUserEditor));
    const roleSelect=byId('hetk-user-role');
    if(roleSelect) roleSelect.addEventListener('change', () => refreshWorkZoneEditor());
    const zoneSelect=byId('hetk-user-workzone-select');
    if(zoneSelect) zoneSelect.addEventListener('change', () => handleWorkZoneSelectionChange());
    const save=byId('hetk-user-save');
    if(save) save.addEventListener('click', saveUserEditor);
  }

  function getVisibleUsers(){
    const q=String((byId('hetk-team-search') && byId('hetk-team-search').value) || '').trim().toLowerCase();
    return Object.keys(teamUsersCache).map(uid => Object.assign({uid},teamUsersCache[uid] || {})).filter(canViewTarget).filter(u => {
      if(!q) return true;
      const roots=accountFolderRoots(u);
      const paths=roots.map(id=>folderPath(id)).join(' ');
      return [u.fullName,u.login,getRoleLabel(u),u.region,u.workZoneName,paths].join(' ').toLowerCase().includes(q);
    }).sort((a,b) => {
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
      <span class="hetk-team-user-avatar">${u.photoData ? `<img src="${escapeAttr(u.photoData)}" alt="">` : '<i class="fas fa-user"></i>'}</span>
      <span class="hetk-team-user-main"><b>${escapeHtml(u.fullName || 'Nomsiz hodim')}</b><small>${escapeHtml(getRoleLabel(u))}</small><em>${escapeHtml(u.login || '')}</em></span>
      <span class="hetk-team-user-state ${u.active===false?'off':'on'}">${u.active===false?'Nofaol':'Faol'}</span>
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
    const chips=u.rootAccess ? '<span class="hetk-scope-chip root"><i class="fas fa-globe"></i> Barcha hududlar</span>' : (roots.length ? roots.map(id => `<span class="hetk-scope-chip"><i class="fas fa-folder"></i>${escapeHtml(folderPath(id) || (teamFoldersCache[id] && teamFoldersCache[id].name) || 'Papka')}</span>`).join('') : '<span class="hetk-scope-chip empty">Papka biriktirilmagan</span>');
    box.innerHTML=`
      <div class="hetk-team-detail-head">
        <span class="hetk-team-detail-avatar">${u.photoData ? `<img src="${escapeAttr(u.photoData)}" alt="">` : '<i class="fas fa-user"></i>'}</span>
        <div><h3>${escapeHtml(u.fullName || 'Nomsiz hodim')}</h3><p>${escapeHtml(getRoleLabel(u))}</p><span>${escapeHtml(u.login || '')}</span></div>
        <span class="hetk-detail-status ${u.active===false?'off':'on'}"><i></i>${u.active===false?'Nofaol':'Tizimda faol'}</span>
      </div>
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
      </div>` : '<div class="hetk-team-readonly"><i class="fas fa-lock"></i> Bu foydalanuvchini boshqarish huquqi yo‘q.</div>'}`;
    const edit=byId('hetk-edit-team-user');
    if(edit) edit.addEventListener('click', () => openEditUserEditor(uid));
    const toggle=byId('hetk-toggle-team-user');
    if(toggle) toggle.addEventListener('click', () => toggleUserActive(uid));
    const del=byId('hetk-delete-team-user');
    if(del) del.addEventListener('click', () => deleteUserPermanently(uid));
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
    const selected=new Set(normalizeSelectedFolderRoots(selectedIds || [],teamFoldersCache));
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
    function nodeHtml(id,level){
      if(!teamFoldersCache[id] || !accessible.has(id)) return '';
      const f=teamFoldersCache[id];
      const children=Object.keys(teamFoldersCache).filter(cid => teamFoldersCache[cid] && teamFoldersCache[cid].parentId===id && accessible.has(cid));
      return `<div class="hetk-folder-pick-node">
        <label class="hetk-folder-pick-row" style="--folder-level:${level}">
          <input class="hetk-folder-pick-check" type="checkbox" value="${escapeAttr(id)}" ${selected.has(id)?'checked':''} ${editorFolderLocked?'disabled':''}>
          <i class="fas fa-folder" style="color:${escapeAttr(f.color || '#1687ff')}"></i>
          <span>${escapeHtml(f.name || 'Papka')}</span>
          ${children.length ? '<small>'+children.length+' ta ichki</small>' : ''}
        </label>
        ${children.length ? `<div class="hetk-folder-pick-children">${children.map(cid => nodeHtml(cid,level+1)).join('')}</div>` : ''}
      </div>`;
    }
    box.innerHTML=roots.map(id => nodeHtml(id,0)).join('');
    box.querySelectorAll('.hetk-folder-pick-check').forEach(cb => cb.addEventListener('change', () => {
      if(cb.checked){
        const id=cb.value;
        box.querySelectorAll('.hetk-folder-pick-check:checked').forEach(other => {
          if(other===cb) return;
          let cur=id, guard=0;
          while(cur && cur!=='root' && teamFoldersCache[cur] && guard<100){
            cur=teamFoldersCache[cur].parentId;
            if(cur===other.value){ cb.checked=false; break; }
            guard++;
          }
        });
        if(cb.checked){
          box.querySelectorAll('.hetk-folder-pick-check:checked').forEach(other => {
            if(other===cb) return;
            let cur=other.value, guard=0;
            while(cur && cur!=='root' && teamFoldersCache[cur] && guard<100){
              cur=teamFoldersCache[cur].parentId;
              if(cur===cb.value){ other.checked=false; break; }
              guard++;
            }
          });
        }
      }
      updateSelectedFolderCount();
    }));
    updateSelectedFolderCount();
  }

  function getEditorSelectedFolders(){
    const box=byId('hetk-user-folder-tree');
    if(!box) return [];
    return Array.from(box.querySelectorAll('.hetk-folder-pick-check:checked')).map(cb => cb.value);
  }

  function updateSelectedFolderCount(){
    const el=byId('hetk-selected-folder-count');
    if(!el) return;
    const ids=getEditorSelectedFolders();
    el.textContent=ids.length + ' ta tanlangan';
  }

  function openCreateUserEditor(){
    if(!hasPermission('createUsers') || !getCreatableRoles().length) return;
    userEditorMode='create'; editingTeamUid=null;
    byId('hetk-user-editor-title').textContent='Yangi hodim / admin';
    byId('hetk-user-editor-subtitle').textContent='Faqat o‘zingizdan quyi lavozim va o‘zingiz ko‘ra oladigan papkalarni bera olasiz.';
    byId('hetk-user-fullname').value='';byId('hetk-user-fullname').readOnly=false;
    byId('hetk-user-phone').value='';byId('hetk-user-phone').readOnly=false;
    byId('hetk-user-login').value='';byId('hetk-user-login').readOnly=false;
    byId('hetk-user-password').value='';byId('hetk-user-password2').value='';
    document.querySelectorAll('.hetk-create-password').forEach(x => x.style.display='');
    editorFolderLimitRoots=null;editorFolderLocked=false;
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
    byId('hetk-user-login').value=u.login || '';byId('hetk-user-login').readOnly=true;
    document.querySelectorAll('.hetk-create-password').forEach(x => x.style.display='none');
    editorFolderLimitRoots=null;editorFolderLocked=false;
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
      fullName,phone,role,roleLabel:def.label,level:def.level,
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
      return confirm(`${z.name || 'U/J'} da hozir ${oldName} master.\n\nYangi master biriktirilsa avvalgi master bloklanadi. Davom etasizmi?`);
    };

    setBusy(btn,true,userEditorMode==='create'?'Yaratilmoqda...':'Saqlanmoqda...');
    try{
      if(userEditorMode==='create'){
        const pass1=byId('hetk-user-password').value, pass2=byId('hetk-user-password2').value;
        if(pass1.length<6) throw new Error('Parol kamida 6 ta belgidan iborat bo‘lsin.');
        if(pass1!==pass2) throw new Error('Parollar bir xil emas.');
        if(role==='master' && zone && !confirmMasterReplacement(zone,'')) throw new Error('Master almashtirish bekor qilindi.');
        const sec=secondaryAuth();
        let cred=null;
        try{
          cred=await sec.createUserWithEmailAndPassword(loginToEmail(login),pass1);
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
            if(zone.currentMasterUid && zone.currentMasterUid!==uid){
              updates['users/'+zone.currentMasterUid+'/active']=false;
              updates['users/'+zone.currentMasterUid+'/replacedAt']=now;
              updates['users/'+zone.currentMasterUid+'/replacedBy']=currentAccount.uid;
            }
          }
          const account=Object.assign({},patch,{
            uid,login,active:true,createdAt:now,createdBy:currentAccount.uid,
            createdByName:currentAccount.fullName || currentAccount.login || 'Admin',lastLoginAt:0,photoData:''
          });
          if(needsZone){account.workZoneId=finalZoneId;account.workZoneName=zoneName;account.region=zoneName;}
          updates['users/'+uid]=account;
          await databaseRef.ref().update(updates);
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
          }else{
            finalZoneId=zoneChoice;
            if(role==='master' && zone){
              updates['WorkZones/'+zone.id+'/currentMasterUid']=target.uid;
              updates['WorkZones/'+zone.id+'/updatedAt']=Date.now();
              updates['WorkZones/'+zone.id+'/updatedBy']=currentAccount.uid;
              if(!workZoneRoots(zone).length) updates['WorkZones/'+zone.id+'/folders']=foldersObj;
              if(zone.currentMasterUid && zone.currentMasterUid!==target.uid){
                updates['users/'+zone.currentMasterUid+'/active']=false;
                updates['users/'+zone.currentMasterUid+'/replacedAt']=Date.now();
                updates['users/'+zone.currentMasterUid+'/replacedBy']=currentAccount.uid;
              }
            }
          }
          patch.workZoneId=finalZoneId;patch.workZoneName=zoneName;patch.region=zoneName;
        }
        if(canManageTarget(target,'edit') && oldZone && target.role==='master' && (role!=='master' || finalZoneId!==target.workZoneId) && oldZone.currentMasterUid===target.uid){
          updates['WorkZones/'+oldZone.id+'/currentMasterUid']=null;
          updates['WorkZones/'+oldZone.id+'/updatedAt']=Date.now();
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
        updates['users/'+editingTeamUid]=patch;
        await databaseRef.ref().update(updates);
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
    if(!next && u.role==='master' && u.workZoneId){
      const zone=getWorkZoneById(u.workZoneId);
      if(zone && zone.currentMasterUid===uid){
        updates['WorkZones/'+u.workZoneId+'/currentMasterUid']=null;
        updates['WorkZones/'+u.workZoneId+'/updatedAt']=Date.now();
        updates['WorkZones/'+u.workZoneId+'/updatedBy']=currentAccount.uid;
      }
    }
    await databaseRef.ref().update(updates);
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
    Object.keys(teamWorkZonesCache || {}).forEach(zoneId=>{
      const z=teamWorkZonesCache[zoneId];
      if(z && z.currentMasterUid===uid){
        updates['WorkZones/'+zoneId+'/currentMasterUid']=null;
        updates['WorkZones/'+zoneId+'/updatedAt']=now;
        updates['WorkZones/'+zoneId+'/updatedBy']=currentAccount.uid;
      }
    });
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

  async function saveProfileChanges(){
    if(!currentAccount || !auth.currentUser) return;
    const name = String(byId('hetk-edit-name').value || '').trim();
    const phone = String(byId('hetk-edit-phone').value || '').trim();
    const oldLogin = normalizeLogin(currentAccount.login || '');
    const newLogin = normalizeLogin(byId('hetk-edit-login').value || '');
    const loginPassword = String(byId('hetk-login-current-password').value || '');
    const status = byId('hetk-profile-save-status');
    if(name.length < 3){ status.className='hetk-account-status error'; status.textContent='F.I.Sh ni to‘liq kiriting.'; return; }
    if(newLogin.length < 3){ status.className='hetk-account-status error'; status.textContent='Login kamida 3 ta belgidan iborat bo‘lsin.'; return; }
    const loginChanged = newLogin !== oldLogin;
    if(loginChanged && !loginPassword){ status.className='hetk-account-status error'; status.textContent='Loginni o‘zgartirish uchun hozirgi parolingizni kiriting.'; return; }
    const btn = byId('hetk-save-profile');
    setBusy(btn,true,'Saqlanmoqda...');
    let authEmailChanged = false;
    try{
      if(loginChanged){
        const credential = firebase.auth.EmailAuthProvider.credential(loginToEmail(oldLogin), loginPassword);
        await auth.currentUser.reauthenticateWithCredential(credential);
        await auth.currentUser.updateEmail(loginToEmail(newLogin));
        authEmailChanged = true;
      }
      const patch = {fullName:name,phone,login:newLogin,updatedAt:Date.now()};
      try{
        await databaseRef.ref('users/' + auth.currentUser.uid).update(patch);
      }catch(dbError){
        if(authEmailChanged){
          try{ await auth.currentUser.updateEmail(loginToEmail(oldLogin)); }catch(_rollbackError){}
        }
        throw dbError;
      }
      await auth.currentUser.updateProfile({displayName:name});
      currentAccount = Object.assign({},currentAccount,patch);
      populateProfile(currentAccount);
      const newStatus = byId('hetk-profile-save-status');
      if(newStatus){
        newStatus.className='hetk-account-status success';
        newStatus.textContent=loginChanged ? 'Ma’lumotlar va login saqlandi. Keyingi kirishda yangi loginni ishlating.' : 'Ma’lumotlar saqlandi.';
      }
      const pwd=byId('hetk-login-current-password'); if(pwd) pwd.value='';
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
    const newPassword2=byId('hetk-new-password2').value;
    const status=byId('hetk-password-status');
    const btn=byId('hetk-change-password');
    if(!currentPassword){status.className='hetk-account-status error';status.textContent='Avval hozirgi parolingizni kiriting.';return;}
    if(newPassword.length<6){status.className='hetk-account-status error';status.textContent='Yangi parol kamida 6 ta belgidan iborat bo‘lsin.';return;}
    if(newPassword!==newPassword2){status.className='hetk-account-status error';status.textContent='Yangi parollar bir xil emas.';return;}
    if(currentPassword===newPassword){status.className='hetk-account-status error';status.textContent='Yangi parol eski paroldan farq qilishi kerak.';return;}
    setBusy(btn,true,'Yangilanmoqda...');
    try{
      const credential=firebase.auth.EmailAuthProvider.credential(loginToEmail(currentAccount.login),currentPassword);
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
    getRoleLabel(role){return ROLE_DEFS[role] ? ROLE_DEFS[role].label : role;},
    getAccountRoleLabel(account){return getRoleLabel(account);},
    getWorkZones(){return teamWorkZonesCache;},
    canManageElementWorkZones(){return !!(this.currentUser && ['super_admin','director','chief_engineer'].includes(this.currentUser.role));},
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
