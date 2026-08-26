(function(){
  'use strict';

  const ROLE_DEFS = {
    super_admin: {
      label: 'Bosh administrator', level: 100,
      createRoles: ['director','chief_engineer','tb_engineer','pto_engineer','chief_dispatcher','master','adli_kard_engineer','dispatcher','employee'],
      canCreateUsers: true, canDeactivateUsers: true, canManagePermissions: true, canManageFolders: true
    },
    director: {
      label: 'Direktor', level: 90,
      createRoles: ['chief_engineer','tb_engineer','pto_engineer','chief_dispatcher','master','adli_kard_engineer','dispatcher','employee'],
      canCreateUsers: true, canDeactivateUsers: true, canManagePermissions: true, canManageFolders: true
    },
    chief_engineer: {
      label: 'Bosh / Asosiy muhandis', level: 85,
      createRoles: ['tb_engineer','pto_engineer','chief_dispatcher','master','adli_kard_engineer','dispatcher','employee'],
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
      createRoles: ['employee'],
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
  let userEditorMode = 'create';
  let editingTeamUid = null;
  let currentUserLiveRef = null;

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
    usersTeamRef=databaseRef.ref('users');
    foldersTeamRef=databaseRef.ref('Folders');
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
    const search=byId('hetk-team-search');
    if(search) search.addEventListener('input', renderTeamList);
    const add=byId('hetk-add-user');
    if(add) add.addEventListener('click', openCreateUserEditor);
    document.querySelectorAll('[data-close-user-editor]').forEach(el => el.addEventListener('click', closeUserEditor));
    const save=byId('hetk-user-save');
    if(save) save.addEventListener('click', saveUserEditor);
  }

  function getVisibleUsers(){
    const q=String((byId('hetk-team-search') && byId('hetk-team-search').value) || '').trim().toLowerCase();
    return Object.keys(teamUsersCache).map(uid => Object.assign({uid},teamUsersCache[uid] || {})).filter(canViewTarget).filter(u => {
      if(!q) return true;
      return [u.fullName,u.login,getRoleLabel(u),u.region].join(' ').toLowerCase().includes(q);
    }).sort((a,b) => {
      if(a.uid === currentAccount.uid) return -1;
      if(b.uid === currentAccount.uid) return 1;
      return Number(b.level||0)-Number(a.level||0) || String(a.fullName||'').localeCompare(String(b.fullName||''));
    });
  }

  function renderTeamList(){
    const box=byId('hetk-team-list');
    if(!box) return;
    const users=getVisibleUsers();
    const count=byId('hetk-team-count');
    if(count) count.textContent=users.length + ' ta foydalanuvchi';
    if(!users.length){
      box.innerHTML='<div class="hetk-team-no-users">Hozircha ko‘rinadigan hodimlar yo‘q.</div>';
      return;
    }
    box.innerHTML=users.map(u => {
      const roots=accountFolderRoots(u);
      const scope=u.rootAccess ? "Barcha hududlar" : (roots.length===1 ? (folderPath(roots[0]) || u.region || 'Hudud') : (roots.length ? roots.length+' ta hudud' : (u.region || 'Hudud biriktirilmagan')));
      const selected=selectedTeamUid===u.uid ? ' selected' : '';
      return `<button class="hetk-team-user${selected}" type="button" data-team-uid="${escapeAttr(u.uid)}">
        <span class="hetk-team-user-avatar">${u.photoData ? `<img src="${escapeAttr(u.photoData)}" alt="">` : '<i class="fas fa-user"></i>'}</span>
        <span class="hetk-team-user-main"><b>${escapeHtml(u.fullName || 'Nomsiz hodim')}</b><small>${escapeHtml(getRoleLabel(u))}</small><em><i class="fas fa-folder"></i> ${escapeHtml(scope)}</em></span>
        <span class="hetk-team-user-state ${u.active===false?'off':'on'}">${u.active===false?'Nofaol':'Faol'}</span>
      </button>`;
    }).join('');
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
        <div><span>Hudud</span><b>${escapeHtml(u.region || '—')}</b></div>
        <div><span>Yaratgan</span><b>${escapeHtml(u.createdByName || '—')}</b></div>
        <div><span>Oxirgi kirish</span><b>${u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</b></div>
      </div>
      ${(canEdit || canDeactivate) ? `<div class="hetk-team-detail-actions">
        ${canEdit ? '<button type="button" id="hetk-edit-team-user" class="primary"><i class="fas fa-user-shield"></i> Lavozim / papka ruxsatlari</button>' : ''}
        ${canDeactivate ? `<button type="button" id="hetk-toggle-team-user" class="${u.active===false?'restore':'danger'}"><i class="fas ${u.active===false?'fa-user-check':'fa-user-slash'}"></i> ${u.active===false?'Qayta faollashtirish':'O‘chirish / bloklash'}</button>` : ''}
      </div>` : '<div class="hetk-team-readonly"><i class="fas fa-lock"></i> Bu foydalanuvchini boshqarish huquqi yo‘q.</div>'}`;
    const edit=byId('hetk-edit-team-user');
    if(edit) edit.addEventListener('click', () => openEditUserEditor(uid));
    const toggle=byId('hetk-toggle-team-user');
    if(toggle) toggle.addEventListener('click', () => toggleUserActive(uid));
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

  function getAssignableRootIds(){
    if(!currentAccount) return [];
    if(currentAccount.rootAccess){
      return Object.keys(teamFoldersCache).filter(id => teamFoldersCache[id] && teamFoldersCache[id].parentId === 'root');
    }
    return normalizeSelectedFolderRoots(accountFolderRoots(currentAccount), teamFoldersCache);
  }

  function renderUserFolderPicker(selectedIds){
    const box=byId('hetk-user-folder-tree');
    if(!box) return;
    const selected=new Set(normalizeSelectedFolderRoots(selectedIds || [],teamFoldersCache));
    const accessible=new Set(getAccessibleFolderIds(currentAccount,teamFoldersCache));
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
          <input class="hetk-folder-pick-check" type="checkbox" value="${escapeAttr(id)}" ${selected.has(id)?'checked':''}>
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
    fillRoleOptions(getCreatableRoles()[0],true);
    renderUserFolderPicker([]);
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
    fillRoleOptions(u.role,canManageTarget(u,'role'));
    renderUserFolderPicker(accountFolderRoots(u));
    editorMessage('','');
    byId('hetk-user-editor').hidden=false;
    document.body.classList.add('hetk-user-editor-open');
  }

  function closeUserEditor(){
    const el=byId('hetk-user-editor');
    if(el) el.hidden=true;
    document.body.classList.remove('hetk-user-editor-open');
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
    const selectedRoots=normalizeSelectedFolderRoots(getEditorSelectedFolders(),teamFoldersCache);
    if(fullName.length<3) return editorMessage('error','F.I.Sh ni to‘liq kiriting.');
    if(userEditorMode==='create' && login.length<3) return editorMessage('error','Login kamida 3 ta belgidan iborat bo‘lsin.');
    if(!ROLE_DEFS[role]) return editorMessage('error','Lavozimni tanlang.');
    const myAccessible=new Set(getAccessibleFolderIds(currentAccount,teamFoldersCache));
    if(!selectedRoots.length) return editorMessage('error','Kamida bitta papka / hududni tanlang.');
    if(selectedRoots.some(id => !myAccessible.has(id))) return editorMessage('error','Sizga ruxsat berilmagan papkani biriktirib bo‘lmaydi.');
    if(userEditorMode==='create' && !getCreatableRoles().includes(role)) return editorMessage('error','Bu lavozimni yaratishga ruxsatingiz yo‘q.');
    const foldersObj={}; selectedRoots.forEach(id => foldersObj[id]=true);
    const def=roleDef(role);
    const patch={
      fullName,phone,role,roleLabel:def.label,level:def.level,region:buildRegionFromRoots(selectedRoots),rootAccess:false,folders:foldersObj,
      permissions:defaultPermissionsForRole(role),updatedAt:Date.now(),updatedBy:currentAccount.uid
    };
    setBusy(btn,true,userEditorMode==='create'?'Yaratilmoqda...':'Saqlanmoqda...');
    try{
      if(userEditorMode==='create'){
        const pass1=byId('hetk-user-password').value, pass2=byId('hetk-user-password2').value;
        if(pass1.length<6) throw new Error('Parol kamida 6 ta belgidan iborat bo‘lsin.');
        if(pass1!==pass2) throw new Error('Parollar bir xil emas.');
        const sec=secondaryAuth();
        let cred=null;
        try{
          cred=await sec.createUserWithEmailAndPassword(loginToEmail(login),pass1);
          const uid=cred.user.uid;
          const now=Date.now();
          const account=Object.assign({},patch,{
            uid,login,active:true,createdAt:now,createdBy:currentAccount.uid,createdByName:currentAccount.fullName || currentAccount.login || 'Admin',lastLoginAt:0,photoData:''
          });
          await databaseRef.ref('users/'+uid).set(account);
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
        }
        await databaseRef.ref('users/'+editingTeamUid).update(patch);
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
    const text=next ? 'Ushbu foydalanuvchini qayta faollashtirasizmi?' : 'Ushbu foydalanuvchini o‘chirish/bloklashni tasdiqlaysizmi? Login saqlanadi, lekin tizimga kira olmaydi.';
    if(!confirm(text)) return;
    await databaseRef.ref('users/'+uid).update({active:next,updatedAt:Date.now(),updatedBy:currentAccount.uid});
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
      if(currentUserLiveRef) currentUserLiveRef.off('value');
      currentUserLiveRef=databaseRef.ref('users/' + user.uid + '/active');
      currentUserLiveRef.on('value', async snap => {
        if(snap.val() === false && auth.currentUser && auth.currentUser.uid === user.uid){
          await auth.signOut();
        }
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
