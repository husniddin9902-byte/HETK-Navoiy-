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

// 2. O'zgaruvchilar
var map = L.map('map', { zoomControl: false }).setView([40.10, 65.81], 16);
var userMarker = null; 
var selectedMarker = null;
var lastPos = null;
var isUserInteracting = false; 
var isManualSelection = false; 
let currentFolders = {}; 
let activeFolderId = 'root'; 
let editingFolderId = null;
let activeMapMarkers = []; // Xaritadagi dinamik markerlarni nazorat qilish uchun massiv

// Google Satellit qatlami
L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

// 3. Panelni yangilovchi asosiy funksiya
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

// 4. Lokatsiyani aniqlash funksiyasi (GPS)
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

    if (!isUserInteracting) {
        map.setView(newLatLng, 18);
    }

    updatePanelValues(lat, lng, acc, false);
    updateAddress(lat, lng, false);
}

navigator.geolocation.watchPosition(onLocation, (e) => console.log(e), { enableHighAccuracy: true });

// 5. Xaritadan nuqta tanlash (Context Menu)
map.on('contextmenu', function(e) {
    if (selectedMarker) map.removeLayer(selectedMarker);

    isManualSelection = true; 
    selectedMarker = L.marker(e.latlng).addTo(map);
    
    var deleteBtn = `<div class="marker-delete-popup" onclick="resetToUserLocation()">
                        Удалить это местоположение?
                     </div>`;
    
    selectedMarker.bindPopup(deleteBtn, {
        closeButton: false, 
        offset: [0, -30],
        className: 'custom-popup'
    }).openPopup();

    updatePanelValues(e.latlng.lat, e.latlng.lng, null, true);
    updateAddress(e.latlng.lat, e.latlng.lng, true);
});

function resetToUserLocation() {
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
    }
    
    isManualSelection = false; 
    
    if (lastPos) {
        updatePanelValues(lastPos.lat, lastPos.lng, null, true);
        updateAddress(lastPos.lat, lastPos.lng, true);
    }
}

// 6. Xarita va Panel nazorati
map.on('movestart', function() { isUserInteracting = true; });

if(document.getElementById('locate-btn')) {
    document.getElementById('locate-btn').addEventListener('click', () => {
        isUserInteracting = false; 
        if (selectedMarker) {
            map.removeLayer(selectedMarker);
            selectedMarker = null;
        }
        isManualSelection = false; 

        if(lastPos) {
            map.setView([lastPos.lat, lastPos.lng], 18);
            updatePanelValues(lastPos.lat, lastPos.lng, null, true);
            updateAddress(lastPos.lat, lastPos.lng, true);
        }
    });
}

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

// 7. Saqlash va Nusxa olish
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

// PAPKALAR VA IERARXIYA MANTIQI
const listBtn = document.getElementById('list-btn');
const menuBtn = document.getElementById('menu-btn'); // 4 ta chiziqli menyu tugmasi
const listModal = document.getElementById('list-container');
const closeList = document.getElementById('close-list');
const openAddBtn = document.getElementById('open-add-folder');
const addFolderPanel = document.getElementById('add-folder-panel');
const cancelFolder = document.getElementById('cancel-folder');
const hueSlider = document.getElementById('color-slider');

// 2 va 3-rasmlar mosligi: Har ikkala tugma ham boshqaruv panelini ochadi
if(listBtn) listBtn.addEventListener('click', () => { listModal.style.display = 'flex'; loadFolders(); });
if(menuBtn) menuBtn.addEventListener('click', () => { listModal.style.display = 'flex'; loadFolders(); });
if(closeList) closeList.addEventListener('click', () => { listModal.style.display = 'none'; });

if(openAddBtn) openAddBtn.addEventListener('click', () => { 
    addFolderPanel.classList.remove('hidden'); 
    updateParentSelect('parent-folder-select'); 
});
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
        const color = `hsl(${hue}, 100%, 50%)`;

        if (!name) return showToast("Guruh nomini yozing!");

        database.ref('Folders').push({
            name: name,
            parentId: parentId,
            hue: hue,
            color: color,
            createdAt: Date.now()
        }).then(() => {
            showToast("Guruh yaratildi!");
            document.getElementById('new-group-name').value = "";
            addFolderPanel.classList.add('hidden');
        });
    });
}

function loadFolders() {
    database.ref('Folders').on('value', (snapshot) => {
        currentFolders = snapshot.val() || {};
        const treeRoot = document.getElementById('tree-root');
        if(treeRoot) renderTree('root', treeRoot);
        
        // YANGI QO'SHILGAN FUNKSIYA: Panellar yuklanganda daraxtsimon dropdownlarni ham qayta chizadi
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
                <span class="toggle-btn" style="width: 20px; text-align: center; font-size: 16px; display: inline-block;" onclick="event.stopPropagation(); toggleFolderView('${id}')">+</span>
                <i class="fas fa-folder" style="color: ${folder.color}; margin-right: 5px;"></i>
                <span style="flex-grow: 1; font-size: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block;">${folder.name}</span>
                <i class="fas fa-edit edit-icon" style="cursor: pointer;" onclick="event.stopPropagation(); openEditFolder('${id}', '${folder.name}', ${folder.hue || 0})"></i>
            </div>
            <div id="children-${id}" class="folder-children" style="display: none;"></div>
        `;
        container.appendChild(item);
        renderTree(id, item.querySelector(`#children-${id}`));
    });
}

// Yagona va to'g'rilangan selectFolder funksiyasi
window.selectFolder = function(id) {
    activeFolderId = id;
    
    document.querySelectorAll('.folder-header').forEach(el => {
        el.classList.remove('active-folder');
    });
    
    const currentFolderEl = document.getElementById(`folder-${id}`);
    if (currentFolderEl) {
        currentFolderEl.classList.add('active-folder');
    }
    
    showToast(`Tanlandi: ${currentFolders[id].name}`);
};

window.toggleFolderView = function(id) {
    const childDiv = document.getElementById(`children-${id}`);
    const btn = document.querySelector(`#folder-${id} .toggle-btn`);
    if (childDiv.style.display === "none") {
        childDiv.style.display = "block";
        btn.innerText = "-";
    } else {
        childDiv.style.display = "none";
        btn.innerText = "+";
    }
};

function updateParentSelect(selectId, excludeId = null) {
    const select = document.getElementById(selectId);
    if(!select) return;
    select.innerHTML = '<option value="root">Asosiy (Bosh guruh)</option>';
    Object.keys(currentFolders).forEach(id => {
        if (id !== excludeId) {
            const option = document.createElement('option');
            option.value = id;
            option.innerText = currentFolders[id].name;
            select.appendChild(option);
        }
    });
    
    // Asosiy select o'zgarganda dynamic daraxt dropdownlarni yangilaymiz
    refreshTreeDropdowns(excludeId);
}

window.addEventListener('load', function() {
    setTimeout(function() { map.invalidateSize(); }, 500);
});

function togglePanel() {
    const panel = document.getElementById('panel');
    const icon = document.getElementById('toggle-icon');
    panel.classList.toggle('minimized');
    icon.style.transform = panel.classList.contains('minimized') ? 'rotate(0deg)' : 'rotate(180deg)';
    setTimeout(() => { map.invalidateSize(); }, 400);
}

// KELISHILGAN TAB TIZIMI VA DINAMIK MARKERLAR FUNKSIYASI
const tabFolders = document.getElementById('tab-folders');
const tabItems = document.getElementById('tab-items');
const foldersSection = document.getElementById('folders-section');
const itemsSection = document.getElementById('items-section');
const searchContainerBox = document.getElementById('search-container-box');

if (tabFolders && tabItems) {
    tabFolders.addEventListener('click', () => {
        tabFolders.classList.add('active');
        tabItems.classList.remove('active');
        foldersSection.classList.add('active');
        itemsSection.classList.remove('active');
    });

    tabItems.addEventListener('click', () => {
        tabItems.classList.add('active');
        tabFolders.classList.remove('active');
        itemsSection.classList.add('active');
        foldersSection.classList.remove('active');
        
        // Tab yuklanganda elementlarni filterlab yuklash mantiqi
        loadFilteredPoints();
    });
}

// NUQTALARNI XARITADA O'Z RANGI BILAN CHIQARISH VA PANELNI YOPISH MANTIQI
function loadFilteredPoints() {
    const tpListContainer = document.getElementById('tp-list');
    if (!tpListContainer) return;
    
    tpListContainer.innerHTML = "<p style='color:gray; padding:15px; text-align:center;'>Yuklanmoqda...</p>";

    // Oldingi eski guruh markerlarini tozalash
    activeMapMarkers.forEach(m => map.removeLayer(m));
    activeMapMarkers = [];

    database.ref('TPs').once('value', (snapshot) => {
        const allPoints = snapshot.val() || {};
        tpListContainer.innerHTML = ""; 

        // Agar biror papka tanlangan bo'lsa filterlaydi, tanlanmagan bo'lsa hamma elementlarni oladi
        const keys = Object.keys(allPoints);
        const filteredKeys = activeFolderId === 'root' ? keys : keys.filter(key => allPoints[key].folderId === activeFolderId);

        if (filteredKeys.length === 0) {
            tpListContainer.innerHTML = "<p style='color:gray; padding:15px; text-align:center;'>Elementlar mavjud emas.</p>";
            return;
        }

        let bounds = [];

        filteredKeys.forEach(key => {
            const point = allPoints[key];
            const lat = parseFloat(point.lat);
            const lng = parseFloat(point.lng);
            const displayName = point.address.split(',')[0] || "Noma'lum element";

            if (!isNaN(lat) && !isNaN(lng)) {
                bounds.push([lat, lng]);

                // NUQTA RANGLARI FIREBASE'DAN OLINADI
                const pointFolderId = point.folderId;
                const folderColor = (currentFolders[pointFolderId] && currentFolders[pointFolderId].color) ? currentFolders[pointFolderId].color : '#ff4444';

                // Maxsus marker dizayni (Olingan o'z rangi bilan)
                const mIcon = L.divIcon({
                    className: 'custom-tp-marker',
                    html: `<i class="fas fa-map-marker-alt" style="color: ${folderColor}; font-size: 26px; text-shadow: 0 0 3px black;"></i>`,
                    iconSize: [26, 26],
                    iconAnchor: [13, 26]
                });

                const marker = L.marker([lat, lng], {icon: mIcon}).addTo(map);
                marker.bindPopup(`<b>${displayName}</b><br>${point.address}`);
                activeMapMarkers.push(marker);

                // Ro'yxat elementini yaratish
                const item = document.createElement('div');
                item.className = 'tp-item';
                item.style.cssText = `padding: 12px; margin: 6px 0; background: #00223a; border-radius: 8px; cursor: pointer; border-left: 4px solid ${folderColor}; color: white;`;
                
                item.innerHTML = `
                    <div style="font-weight: bold; font-size: 14px;">${displayName}</div>
                    <div style="color: #88a0b0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top:2px;">${point.address}</div>
                `;

                // Ro'yxatdagi aniq element bosilsa - boshqaruv paneli yopiladi, xarita markazlashadi
                item.addEventListener('click', () => {
                    if(listModal) listModal.style.display = 'none'; // Boshqaruv paneli yopiladi
                    map.setView([lat, lng], 18);
                    marker.openPopup();
                    updatePanelValues(lat, lng, null, true);
                    updateAddress(lat, lng, true);
                });

                item.setAttribute('data-search-name', displayName.toLowerCase() + point.address.toLowerCase());
                tpListContainer.appendChild(item);
            }
        });

        // Agar papka tanlangan bo'lsa xaritani o'sha guruh sohasiga avtomat markazlaydi
        if (bounds.length > 0 && activeFolderId !== 'root') {
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    });
}

// SIZ AYTGAN QIDIRUV TIZIMI MANTIQI
const elementSearchInput = document.getElementById('element-search');
if (elementSearchInput) {
    elementSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        document.querySelectorAll('.tp-item').forEach(item => {
            const searchStr = item.getAttribute('data-search-name') || '';
            item.style.display = searchStr.includes(query) ? 'block' : 'none';
        });
    });
}

// TAHRIRLASH VA O'ZGARTIRISH PANELI
const editColorSlider = document.getElementById('edit-color-slider');
const editColorPreview = document.getElementById('edit-color-preview');

if(editColorSlider) {
    editColorSlider.addEventListener('input', () => {
        editColorPreview.style.background = `hsl(${editColorSlider.value}, 100%, 50%)`;
    });
}

window.openEditFolder = function(id, name, hue) {
    editingFolderId = id;
    document.getElementById('edit-group-name').value = name;
    if(editColorSlider) {
        editColorSlider.value = hue || 0;
        editColorPreview.style.background = `hsl(${hue || 0}, 100%, 50%)`;
    }
    updateParentSelect('edit-parent-folder-select', id);
    if(currentFolders[id] && currentFolders[id].parentId) {
        document.getElementById('edit-parent-folder-select').value = currentFolders[id].parentId;
    }
    
    // Tahrirlash oynasi ochilganda ierarxik dropdownni ham yangilash
    refreshTreeDropdowns(id);
    document.getElementById('edit-folder-panel').classList.remove('hidden');
};

document.getElementById('delete-folder-btn').addEventListener('click', () => {
    if (confirm("Ushbu guruhni o'chirmoqchimisiz? Ichidagi barcha ma'lumotlar o'chib ketishi mumkin!")) {
        database.ref('Folders/' + editingFolderId).remove().then(() => {
            showToast("Guruh o'chirildi");
            document.getElementById('edit-folder-panel').classList.add('hidden');
        });
    }
});

// 489-qatordan boshlab faylning eng oxirigacha bo'lgan qism:

document.getElementById('update-folder-btn').addEventListener('click', () => {
    const newName = document.getElementById('edit-group-name').value;
    const newParentId = document.getElementById('edit-parent-folder-select').value;
    const newHue = editColorSlider ? editColorSlider.value : 0;

    if (newName.trim() === "") return alert("Nomini kiriting");

    database.ref('Folders/' + editingFolderId).update({
        name: newName,
        parentId: newParentId,
        hue: newHue,
        color: `hsl(${newHue}, 100%, 50%)`
    }).then(() => {
        showToast("Guruh yangilandi!");
        document.getElementById('edit-folder-panel').classList.add('hidden');
    });
});

// =========================================================================
// MUKAMMAL VERTIKAL DROPDOWN (XARX QANDAY CSS CHEKLOVINI BUZIB O'TADI)
// =========================================================================
function refreshTreeDropdowns(excludeId = null) {
    buildTreeInDiv('parent-folder-tree', 'parent-folder-select', excludeId);
    buildTreeInDiv('edit-parent-folder-tree', 'edit-parent-folder-select', excludeId);
}

function buildTreeInDiv(treeContainerId, nativeSelectId, excludeId = null) {
    const container = document.getElementById(treeContainerId);
    const nativeSelect = document.getElementById(nativeSelectId);
    if (!container || !nativeSelect) return;

    container.innerHTML = "";
    
    // Tashqi CSS aralashmasligi uchun konteyner stilini majburlaymiz
    container.style.cssText = "display: block !important; width: 100% !important; max-height: 250px !important; overflow-y: auto !important; overflow-x: hidden !important; box-sizing: border-box !important; float: none !important; position: relative !important; text-align: left !important;";

    // 1. Asosiy (Bosh guruh) variantini yaratish
    const rootRow = document.createElement('div');
    rootRow.style.cssText = "display: block !important; padding: 12px !important; cursor: pointer !important; color: white !important; font-size: 14px !important; border-radius: 6px !important; margin-bottom: 5px !important; width: 100% !important; box-sizing: border-box !important; background: rgba(255,255,255,0.03) !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;";
    rootRow.innerHTML = `<span style="color:#88a0b0; font-weight:bold; margin-right:8px;">•</span> <i class="fas fa-home" style="color:#88a0b0; margin-right:6px;"></i> Asosiy (Bosh guruh)`;
    
    if (nativeSelect.value === 'root' || !nativeSelect.value) {
        rootRow.style.setProperty('background', '#007AFF', 'important');
    }
    
    rootRow.addEventListener('click', () => {
        nativeSelect.value = 'root';
        refreshTreeDropdownSelection(container, 'root');
    });
    container.appendChild(rootRow);

    // 2. Guruhlarni chizish funksiyasi
    function appendChildrenNodes(parentId, level, targetBox) {
        const children = Object.keys(currentFolders).filter(id => currentFolders[id].parentId === parentId);
        
        children.forEach(id => {
            if (excludeId && id === excludeId) return; 

            const folder = currentFolders[id];
            const hasSubFolders = Object.keys(currentFolders).some(childId => currentFolders[childId].parentId === id);
            
            const rowWrapper = document.createElement('div');
            rowWrapper.style.cssText = "display: block !important; width: 100% !important; margin: 4px 0 !important; box-sizing: border-box !important; float: none !important;";

            const row = document.createElement('div');
            row.id = `tree-item-${treeContainerId}-${id}`;
            row.style.cssText = "display: block !important; padding: 12px !important; cursor: pointer !important; color: white !important; font-size: 14px !important; border-radius: 6px !important; width: 100% !important; box-sizing: border-box !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; float: none !important;";
            
            // Ichkarilik darajasini tartibli masofa orqali bildiramiz (ekrandan chiqmaydi)
            row.style.setProperty('padding-left', `${(level + 1) * 15}px`, 'important');

            // Bosh paneldagi kabi oddiy [+]/[-] matni
            const prefixIcon = hasSubFolders ? `<span class="dropdown-toggle-icon" style="display: inline-block !important; width: 18px !important; height: 18px !important; text-align: center !important; line-height: 16px !important; color: #88a0b0 !important; font-weight: bold !important; margin-right: 6px !important; cursor: pointer !important; background: rgba(255,255,255,0.1) !important; border-radius: 4px !important; font-size: 13px !important; vertical-align: middle !important;">+</span>` : `<span style="display: inline-block !important; width: 18px !important; text-align: center !important; color: #557080 !important; margin-right: 6px !important; vertical-align: middle !important;">•</span>`;

            row.innerHTML = `
                ${prefixIcon}
                <i class="fas fa-folder" style="color: ${folder.color} !important; margin-right: 6px !important; vertical-align: middle !important;"></i>
                <span style="vertical-align: middle !important;">${folder.name}</span>
            `;

            if (nativeSelect.value === id) {
                row.style.setProperty('background', '#007AFF', 'important');
            }

            rowWrapper.appendChild(row);

            row.addEventListener('click', () => {
                nativeSelect.value = id;
                refreshTreeDropdownSelection(container, id);
            });

            // Ichki guruhlar qutisi (mutlaqo mustaqil va pastdan ochiladigan blok)
            if (hasSubFolders) {
                const childBox = document.createElement('div');
                childBox.id = `tree-child-box-${treeContainerId}-${id}`;
                childBox.style.cssText = "display: none !important; width: 100% !important; box-sizing: border-box !important; float: none !important;";
                
                rowWrapper.appendChild(childBox);

                // Rekursiyani davom ettirish
                appendChildrenNodes(id, level + 1, childBox);

                const toggleIconNode = row.querySelector('.dropdown-toggle-icon');
                if (toggleIconNode) {
                    toggleIconNode.addEventListener('click', (event) => {
                        event.stopPropagation(); 
                        if (childBox.style.display === "none !important" || childBox.style.display === "none") {
                            childBox.style.setProperty('display', 'block', 'important');
                            toggleIconNode.innerText = "-";
                        } else {
                            childBox.style.setProperty('display', 'none', 'important');
                            toggleIconNode.innerText = "+";
                        }
                    });
                }
            }

            targetBox.appendChild(rowWrapper);
        });
    }

    appendChildrenNodes('root', 0, container);
}

function refreshTreeDropdownSelection(container, selectedId) {
    container.querySelectorAll('div[id^="tree-item-"]').forEach(el => {
        el.style.setProperty('background', 'transparent', 'important');
    });
    
    const targetDiv = container.querySelector(`[id$="-${selectedId}"]`);
    if (targetDiv) {
        targetDiv.style.setProperty('background', '#007AFF', 'important');
    } else if (selectedId === 'root') {
        const firstDiv = container.querySelector('div');
        if (firstDiv) firstDiv.style.setProperty('background', '#007AFF', 'important');
    }
      }
