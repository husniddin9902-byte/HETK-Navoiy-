// 1. Firebase Sozlamalari
const firebaseConfig = {
  apiKey: "AIzaSyBFOoT_ZhvE1tT1Qglh5GjPPhs8ZsyRWoc",
  authDomain: "energo-monitoring.firebaseapp.com",
  databaseURL: "https://energo-monitoring-default-rtdb.firebaseio.com",
  projectId: "energo-monitoring",
  storageBucket: "energo-monitoring.firebasestorage.app",
  messagingSenderId: "514032923022",
  appId: "1:514032923022:web:fe2f57b81a30d0c2fd74df"
};

firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 2. Asosiy O'zgaruvchilar
var map = L.map('map', { zoomControl: false }).setView([40.10, 65.81], 16);
var userMarker = null; 
var selectedMarker = null;
var lastPos = null;
var isUserInteracting = false; 
var isManualSelection = false; 
let currentFolders = {}; 
let activeFolderId = 'root'; 
let editingFolderId = null;
let activeMapMarkers = []; 

// Google Sun'iy Yo'ldosh Qatlami
L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

// 3. Panel Qiymatlarini Yangilash
function updatePanelValues(lat, lng, acc = null, force = false) {
    if (isManualSelection && !force) return;
    const latEl = document.getElementById('latitude');
    const lngEl = document.getElementById('longitude');
    const accEl = document.getElementById('accuracy');
    if (latEl && lngEl) {
        latEl.innerText = lat.toFixed(6);
        lngEl.innerText = lng.toFixed(6);
    }
    if (accEl && acc !== null) {
        accEl.innerText = acc;
    }
}

// 4. Nominatim Manzilni Aniqlash
function updateAddress(lat, lng, force = false) {
    if (isManualSelection && !force) return;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
            if(document.getElementById('address')) {
                document.getElementById('address').innerText = data.display_name || "Manzil topilmadi";
            }
        }).catch(() => {
            if(document.getElementById('address')) document.getElementById('address').innerText = "Internetda xatolik";
        });
}

// 5. GPS Lokatsiyani Kuzatish
function onLocation(p) {
    const lat = p.coords.latitude;
    const lng = p.coords.longitude;
    const acc = Math.round(p.coords.accuracy);
    lastPos = { lat: lat, lng: lng };
    var newLatLng = new L.LatLng(lat, lng);

    if (userMarker) { map.removeLayer(userMarker); }

    var customIcon = L.divIcon({
        className: 'user-location-container',
        html: `<div style="position: relative; display: flex; align-items: center; justify-content: center; width: 40px; height: 40px;">
                <div style="position: absolute; width: 40px; height: 40px; background: rgba(0, 122, 255, 0.2); border: 1px solid rgba(0, 122, 255, 0.4); border-radius: 50%;"></div>
                <div style="width: 12px; height: 12px; background: #007AFF; border: 2px solid white; border-radius: 50%; z-index: 2; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>
            </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    userMarker = L.marker(newLatLng, { icon: customIcon }).addTo(map);
    if (!isUserInteracting) { map.setView(newLatLng, 18); }
    updatePanelValues(lat, lng, acc, false);
    updateAddress(lat, lng, false);
}
navigator.geolocation.watchPosition(onLocation, (e) => console.log(e), { enableHighAccuracy: true });

 // 6. Xaritani Bosgandagi Hodisalar
map.on('contextmenu', function(e) {
    if (selectedMarker) map.removeLayer(selectedMarker);
    isManualSelection = true; 
    selectedMarker = L.marker(e.latlng).addTo(map);
    var deleteBtn = `<div class="marker-delete-popup" onclick="resetToUserLocation()">Удалить bu joyni?</div>`;
    selectedMarker.bindPopup(deleteBtn, { closeButton: false, offset: [0, -30], className: 'custom-popup' }).openPopup();
    updatePanelValues(e.latlng.lat, e.latlng.lng, null, true);
    updateAddress(e.latlng.lat, e.latlng.lng, true);
});

function resetToUserLocation() {
    if (selectedMarker) { map.removeLayer(selectedMarker); selectedMarker = null; }
    isManualSelection = false; 
    if (lastPos) {
        updatePanelValues(lastPos.lat, lastPos.lng, null, true);
        updateAddress(lastPos.lat, lastPos.lng, true);
    }
}

map.on('movestart', function() { isUserInteracting = true; });

if(document.getElementById('locate-btn')) {
    document.getElementById('locate-btn').addEventListener('click', () => {
        isUserInteracting = false; 
        if (selectedMarker) { map.removeLayer(selectedMarker); selectedMarker = null; }
        isManualSelection = false; 
        if(lastPos) {
            map.setView([lastPos.lat, lastPos.lng], 18);
            updatePanelValues(lastPos.lat, lastPos.lng, null, true);
            updateAddress(lastPos.lat, lastPos.lng, true);
        }
    });
}

// 7. Toast va Saqlash Mantiqi
function showToast(message) {
    const oldToast = document.querySelector('.toast-message');
    if (oldToast) oldToast.remove();
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerText = message;
    toast.style.cssText = `position: fixed; bottom: 120px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.85); color: white; padding: 12px 25px; border-radius: 30px; font-size: 14px; z-index: 3000; box-shadow: 0 4px 15px rgba(0,0,0,0.4); transition: opacity 0.5s; white-space: nowrap; pointer-events: none;`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2000);
}

document.querySelector('.save-btn').addEventListener('click', function() {
    const currentLat = document.getElementById('latitude').innerText;
    const currentLng = document.getElementById('longitude').innerText;
    const addr = document.getElementById('address').innerText;
    if (activeFolderId === 'root') return showToast("Avval papka tanlang!");
    database.ref('TPs/' + Date.now()).set({
        lat: currentLat,
        lng: currentLng,
        address: addr,
        folderId: activeFolderId,
        time: new Date().toLocaleString()
    }).then(() => { showToast("Guruhga saqlandi!"); });
});

function copyCoords() {
    const lat = document.getElementById('latitude').innerText;
    const lng = document.getElementById('longitude').innerText;
    const address = document.getElementById('address').innerText;
    const fullText = `Широта: ${lat}\nДолгота: ${lng}\nАдрес: ${address}\nGoogle Maps: http://maps.google.com/?q=${lat},${lng}`;
    navigator.clipboard.writeText(fullText).then(() => { showToast("Ma’lumot nusxalandi"); });
}

// 8. Papkalarni Boshqarish Paneli
const listBtn = document.getElementById('list-btn');
const menuBtn = document.getElementById('menu-btn'); 
const listModal = document.getElementById('list-container');
const closeList = document.getElementById('close-list');
const openAddBtn = document.getElementById('open-add-folder');
const addFolderPanel = document.getElementById('add-folder-panel');
const cancelFolder = document.getElementById('cancel-folder');
const hueSlider = document.getElementById('color-slider');

if(listBtn) listBtn.addEventListener('click', () => { listModal.style.display = 'flex'; loadFolders(); });
if(menuBtn) menuBtn.addEventListener('click', () => { listModal.style.display = 'flex'; loadFolders(); });
if(closeList) closeList.addEventListener('click', () => { listModal.style.display = 'none'; });
if(openAddBtn) openAddBtn.addEventListener('click', () => { addFolderPanel.classList.remove('hidden'); updateParentSelect('parent-folder-select'); });
if(cancelFolder) cancelFolder.addEventListener('click', () => { addFolderPanel.classList.add('hidden'); });

if(hueSlider) {
    hueSlider.addEventListener('input', (e) => {
        const color = `hsl(${e.target.value}, 100%, 50%)`;
        const preview = document.getElementById('color-preview');
        if(preview) preview.style.background = color;
    });
}

const saveFolderBtn = document.getElementById('save-folder');
if(saveFolderBtn) {
    saveFolderBtn.addEventListener('click', () => {
        const name = document.getElementById('new-group-name').value;
        const parentId = document.getElementById('parent-folder-select').value;
        const hue = hueSlider ? hueSlider.value : 0;
        if (!name) return showToast("Guruh nomini yozing!");
        database.ref('Folders').push({
            name: name, parentId: parentId, hue: hue, color: `hsl(${hue}, 100%, 50%)`, createdAt: Date.now()
        }).then(() => {
            showToast("Guruh yaratildi!");
            document.getElementById('new-group-name').value = "";
            addFolderPanel.classList.add('hidden');
        });
    });
          }

// 9. Guruhlar Daraxtini Chizish
function loadFolders() {
    database.ref('Folders').on('value', (snapshot) => {
        currentFolders = snapshot.val() || {};
        const treeRoot = document.getElementById('tree-root');
        if(treeRoot) renderTree('root', treeRoot);
        refreshTreeDropdowns();
    });
}

function renderTree(parentId, container) {
    container.innerHTML = "";
    const children = Object.keys(currentFolders).filter(id => currentFolders[id].parentId === parentId);
    children.forEach(id => {
        const folder = currentFolders[id];
        const item = document.createElement('div');
        item.className = 'folder-item';
        item.innerHTML = `
            <div class="folder-header" id="folder-${id}" onclick="selectFolder('${id}')">
                <span class="toggle-btn" style="width:20px; text-align:center; display:inline-block;" onclick="event.stopPropagation(); toggleFolderView('${id}')">+</span>
                <i class="fas fa-folder" style="color: ${folder.color}; margin-right: 5px;"></i>
                <span style="flex-grow:1; font-size:16px;">${folder.name}</span>
                <i class="fas fa-edit edit-icon" onclick="event.stopPropagation(); openEditFolder('${id}', '${folder.name}', ${folder.hue || 0})"></i>
            </div>
            <div id="children-${id}" class="folder-children" style="display: none;"></div>
        `;
        container.appendChild(item);
        renderTree(id, item.querySelector(`#children-${id}`));
    });
}

window.selectFolder = function(id) {
    activeFolderId = id;
    document.querySelectorAll('.folder-header').forEach(el => el.classList.remove('active-folder'));
    if (document.getElementById(`folder-${id}`)) document.getElementById(`folder-${id}`).classList.add('active-folder');
    showToast(`Tanlandi: ${currentFolders[id].name}`);
};

window.toggleFolderView = function(id) {
    const childDiv = document.getElementById(`children-${id}`);
    const btn = document.querySelector(`#folder-${id} .toggle-btn`);
    if (childDiv.style.display === "none") { childDiv.style.display = "block"; btn.innerText = "-"; } 
    else { childDiv.style.display = "none"; btn.innerText = "+"; }
};

function updateParentSelect(selectId, excludeId = null) {
    const select = document.getElementById(selectId); if(!select) return;
    select.innerHTML = '<option value="root">Asosiy (Bosh guruh)</option>';
    Object.keys(currentFolders).forEach(id => {
        if (id !== excludeId) {
            const option = document.createElement('option'); option.value = id; option.innerText = currentFolders[id].name; select.appendChild(option);
        }
    });
}

function refreshTreeDropdowns(excludeId = null) {
    const addDropdown = document.getElementById('add-tree-dropdown');
    const editDropdown = document.getElementById('edit-tree-dropdown');
    if(addDropdown) buildTreeDropdown('root', addDropdown, 'parent-folder-select', excludeId);
    if(editDropdown) buildTreeDropdown('root', editDropdown, 'edit-parent-folder-select', excludeId);
}

function buildTreeDropdown(parentId, container, targetSelectId, excludeId, level = 0) {
    if(level === 0) container.innerHTML = `<div onclick="selectDropdownNode('root', '${targetSelectId}', this)" style="padding-left:10px;">Asosiy (Bosh guruh)</div>`;
    const children = Object.keys(currentFolders).filter(id => currentFolders[id].parentId === parentId && id !== excludeId);
    children.forEach(id => {
        const node = document.createElement('div'); node.style.paddingLeft = `${(level + 1) * 15}px`;
        node.innerHTML = `<i class="fas fa-folder" style="color:${currentFolders[id].color};"></i> ${currentFolders[id].name}`;
        node.onclick = (e) => { e.stopPropagation(); selectDropdownNode(id, targetSelectId, node); };
        container.appendChild(node);
        buildTreeDropdown(id, container, targetSelectId, excludeId, level + 1);
    });
}

function selectDropdownNode(id, selectId, element) {
    const select = document.getElementById(selectId); if(select) select.value = id;
    element.parentNode.querySelectorAll('div').forEach(el => el.classList.remove('selected-tree-node'));
    element.classList.add('selected-tree-node');
}

// 10. Tahrirlash va O'chirish Mantiqi
const editColorSlider = document.getElementById('edit-color-slider');
const editColorPreview = document.getElementById('edit-color-preview');
if(editColorSlider && editColorPreview) {
    editColorSlider.addEventListener('input', () => { editColorPreview.style.background = `hsl(${editColorSlider.value}, 100%, 50%)`; });
}

window.openEditFolder = function(id, name, hue) {
    editingFolderId = id; document.getElementById('edit-group-name').value = name;
    if(editColorSlider) { editColorSlider.value = hue || 0; editColorPreview.style.background = `hsl(${hue || 0}, 100%, 50%)`; }
    updateParentSelect('edit-parent-folder-select', id);
    if(currentFolders[id] && currentFolders[id].parentId) { document.getElementById('edit-parent-folder-select').value = currentFolders[id].parentId; }
    refreshTreeDropdowns(id); document.getElementById('edit-folder-panel').classList.remove('hidden');
};

document.getElementById('delete-folder-btn').addEventListener('click', () => {
    if (confirm("Guruh o'chirilsinmi?")) {
        database.ref('Folders/' + editingFolderId).remove().then(() => { showToast("O'chirildi"); document.getElementById('edit-folder-panel').classList.add('hidden'); });
    }
});

document.getElementById('update-folder-btn').addEventListener('click', () => {
    const newName = document.getElementById('edit-group-name').value;
    const newParentId = document.getElementById('edit-parent-folder-select').value;
    const newHue = editColorSlider ? editColorSlider.value : 0;
    if (!newName) return showToast("Nomini kiriting");
    database.ref('Folders/' + editingFolderId).update({ name: newName, parentId: newParentId, hue: newHue, color: `hsl(${newHue}, 100%, 50%)` }).then(() => {
        showToast("Yangilandi!"); document.getElementById('edit-folder-panel').classList.add('hidden');
    });
});

// 11. Panelni Buklash Va Tablar (Tuzatilgan qismi)
function togglePanel() {
    const panel = document.getElementById('panel'); const icon = document.getElementById('toggle-icon');
    if(panel) panel.classList.toggle('minimized');
    if(icon && panel) icon.style.transform = panel.classList.contains('minimized') ? 'rotate(0deg)' : 'rotate(180deg)';
    setTimeout(() => { if (typeof map !== 'undefined' && map) map.invalidateSize(); }, 400);
}
window.addEventListener('load', () => { setTimeout(() => { if (typeof map !== 'undefined' && map) map.invalidateSize(); }, 500); });

const tabFolders = document.getElementById('tab-folders'); const tabItems = document.getElementById('tab-items');
const foldersSection = document.getElementById('folders-section'); const itemsSection = document.getElementById('items-section');
if (tabFolders && tabItems) {
    tabFolders.addEventListener('click', () => { tabFolders.classList.add('active'); tabItems.classList.remove('active'); foldersSection.classList.add('active'); itemsSection.classList.remove('active'); });
    tabItems.addEventListener('click', () => { tabItems.classList.add('active'); tabFolders.classList.remove('active'); itemsSection.classList.add('active'); foldersSection.classList.remove('active'); loadFilteredPoints(); });
}

function loadFilteredPoints() {
    const tpListContainer = document.getElementById('tp-list'); if (!tpListContainer) return;
    tpListContainer.innerHTML = "<p style='color:gray; text-align:center;'>Yuklanmoqda...</p>";
    if (typeof activeMapMarkers !== 'undefined') activeMapMarkers.forEach(m => map.removeLayer(m));
    activeMapMarkers = [];

    database.ref('TPs').once('value', (snapshot) => {
        const allPoints = snapshot.val() || {}; tpListContainer.innerHTML = "";
        const keys = Object.keys(allPoints);
        const filteredKeys = activeFolderId === 'root' ? keys : keys.filter(key => allPoints[key].folderId === activeFolderId);
        if (filteredKeys.length === 0) { tpListContainer.innerHTML = "<p style='color:gray; text-align:center;'>Element yo'q</p>"; return; }
        
        let bounds = [];
        filteredKeys.forEach(key => {
            const point = allPoints[key]; const lat = parseFloat(point.lat); const lng = parseFloat(point.lng);
            const displayName = point.address.split(',')[0] || "Element";
            if (!isNaN(lat) && !isNaN(lng)) {
                bounds.push([lat, lng]);
                const folderColor = (currentFolders[point.folderId] && currentFolders[point.folderId].color) ? currentFolders[point.folderId].color : '#ff4444';
                const marker = L.marker([lat, lng], {icon: L.divIcon({className:'custom-tp-marker', html:`<i class="fas fa-map-marker-alt" style="color:${folderColor}; font-size:26px;"></i>`, iconSize:[26,26], iconAnchor:[13,26]})}).addTo(map);
                marker.bindPopup(`<b>${displayName}</b><br>${point.address}`); activeMapMarkers.push(marker);
                
                const item = document.createElement('div'); item.className = 'tp-item'; item.style.cssText = `padding:12px; margin:6px 0; background:#00223a; border-radius:8px; cursor:pointer; border-left:4px solid ${folderColor}; color:white;`;
                item.innerHTML = `<div><b>${displayName}</b></div><div style="color:#88a0b0; font-size:11px; overflow:hidden; text-overflow:ellipsis;">${point.address}</div>`;
                item.addEventListener('click', () => { if(document.getElementById('list-container')) document.getElementById('list-container').style.display='none'; map.setView([lat, lng], 18); marker.openPopup(); updatePanelValues(lat, lng, null, true); updateAddress(lat, lng, true); });
                item.setAttribute('data-search-name', displayName.toLowerCase() + point.address.toLowerCase()); tpListContainer.appendChild(item);
            }
        });
        if (bounds.length > 0 && activeFolderId !== 'root') map.fitBounds(bounds, { padding: [50, 50] });
    });
}

const elementSearchInput = document.getElementById('element-search');
if (elementSearchInput) {
    elementSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.tp-item').forEach(item => { item.style.display = item.getAttribute('data-search-name').includes(query) ? 'block' : 'none'; });
    });
}

// Tizimni ilk bor yurgizish
loadFolders();
                                                                                                                                                                                                                                        
