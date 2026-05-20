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
// MUKAMMAL SIZ AYTGAN IERARXIK JUMLADAN DARAXTSIMON DROPDOWNLAR MANTIQI
// =========================================================================
// =========================================================================
// MUKAMMAL IERARXIK DARAXTSIMON DROPDOWNLAR MANTIQI (TUGLAR TO'G'RI ISHLAYDI)
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

    // 1. Asosiy (Bosh guruh) variantini yaratish
    const rootRow = document.createElement('div');
    rootRow.style.cssText = "display:flex; align-items:center; padding:8px; cursor:pointer; color:white; font-size:14px; border-radius:6px;";
    rootRow.innerHTML = `<span style="width:20px; text-align:center; color:#88a0b0; font-weight:bold; margin-right:5px;">•</span><i class="fas fa-home" style="color:#88a0b0; margin-right:8px;"></i> Asosiy (Bosh guruh)`;
    
    if (nativeSelect.value === 'root' || !nativeSelect.value) {
        rootRow.style.background = "#007AFF";
    }
    
    rootRow.addEventListener('click', () => {
        nativeSelect.value = 'root';
        refreshTreeDropdownSelection(container, 'root');
    });
    container.appendChild(rootRow);

    // 2. To'g'ri ierarxik rekursiya funksiyasi
    function appendChildrenNodes(parentId, level, targetBox) {
        const children = Object.keys(currentFolders).filter(id => currentFolders[id].parentId === parentId);
        
        children.forEach(id => {
            if (excludeId && id === excludeId) return; // O'zini o'ziga ichki guruh qilishni cheklash

            const folder = currentFolders[id];
            const hasSubFolders = Object.keys(currentFolders).some(childId => currentFolders[childId].parentId === id);
            
            const rowWrapper = document.createElement('div');
            rowWrapper.style.margin = "2px 0";

            const row = document.createElement('div');
            row.id = `tree-item-${treeContainerId}-${id}`;
            row.style.cssText = `display:flex; align-items:center; padding:8px; cursor:pointer; color:white; font-size:14px; border-radius:6px;`;
            row.style.paddingLeft = `${(level + 1) * 16}px`;

            // Farzandi bor guruhlarga dynamic [+] aks holda nuqta [•]
            const prefixIcon = hasSubFolders ? `<span class="dropdown-toggle-icon" style="width:20px; text-align:center; color:#88a0b0; font-weight:bold; margin-right:5px; cursor:pointer; background:rgba(255,255,255,0.05); border-radius:4px;">+</span>` : `<span style="width:20px; text-align:center; color:#557080; margin-right:5px;">•</span>`;

            row.innerHTML = `
                ${prefixIcon}
                <i class="fas fa-folder" style="color: ${folder.color}; margin-right:8px;"></i>
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${folder.name}</span>
            `;

            if (nativeSelect.value === id) {
                row.style.background = "#007AFF";
            }

            rowWrapper.appendChild(row);

            // Guruh tanlanishi mantiqi
            row.addEventListener('click', () => {
                nativeSelect.value = id;
                refreshTreeDropdownSelection(container, id);
            });

            // Agar ichki guruhlari bo'lsa, ularni yashirin qutiga (childBox) joylash
            if (hasSubFolders) {
                const childBox = document.createElement('div');
                childBox.id = `tree-child-box-${treeContainerId}-${id}`;
                childBox.style.display = "none"; // BOSHIDA HAMMASI ZICX VA YASHIRIN TURADI
                childBox.style.borderLeft = "1px dashed rgba(255,255,255,0.1)";
                childBox.style.marginLeft = `${(level + 1) * 10}px`;
                
                rowWrapper.appendChild(childBox);

                // Rekursiv ravishda bolalarini shu yashirin qutiga voris qilib biriktiramiz
                appendChildrenNodes(id, level + 1, childBox);

                // [+] yoki [-] bosilganda ochilish/yopilish hodisasi
                const toggleIconNode = row.querySelector('.dropdown-toggle-icon');
                if (toggleIconNode) {
                    toggleIconNode.addEventListener('click', (event) => {
                        event.stopPropagation(); // Satr bosilib ketishini to'xtatadi
                        if (childBox.style.display === "none") {
                            childBox.style.display = "block";
                            toggleIconNode.innerText = "-";
                        } else {
                            childBox.style.display = "none";
                            toggleIconNode.innerText = "+";
                        }
                    });
                }
            }

            // Elementni target qutiga qo'shish
            targetBox.appendChild(rowWrapper);
        });
    }

    // Eng yuqori darajadagi guruhlarni (root) asosiy konteynerga chizish
    appendChildrenNodes('root', 0, container);
}

// Tanlangan guruhni ko'k rang bilan belgilash funksiyasi
function refreshTreeDropdownSelection(container, selectedId) {
    container.querySelectorAll('div[id^="tree-item-"]').forEach(el => {
        el.style.background = "transparent";
    });
    
    const targetDiv = container.querySelector(`[id$="-${selectedId}"]`);
    
    if (targetDiv) {
        targetDiv.style.background = "#007AFF";
    } else if (selectedId === 'root') {
        const firstDiv = container.querySelector('div');
        if (firstDiv) firstDiv.style.background = "#007AFF";
    }
}

// =========================================================================
// ⚡ YANGI: ELEMENTLARNI (TP) BOSHQARISH, TELEGRAM VA SCADA MANTIQLARI BLOKI
// =========================================================================

// 1. Telegram Bot Sozlamalari (Orqa fonda 0 xarajat va bepul limit bilan rasmlarni saqlash uchun)
const TELEGRAM_BOT_TOKEN = "8992286638:AAFPqW8OuFnBe-u6WZqqxiL1h3nhlIz48Qg"; // Bot tokeningizni shu yerga yozasiz
const TELEGRAM_CHAT_ID = "-1003934340914"; // Maxfiy kanal yoki guruh IDsini yozasiz
let currentUploadedImageUrl = ""; // Telegramdan kelgan rasm linkini vaqtincha saqlash uchun
let editingElementId = null; // Tahrirlash rejimi uchun element IDsi

// 2. Global Element Kiritish Oynasini Boshqarish Elementlari
const elementManagePanel = document.getElementById('element-manage-panel');
const elementMainForm = document.getElementById('element-main-form');
const inputLatitude = document.getElementById('input-latitude');
const inputLongitude = document.getElementById('input-longitude');
const inputElementName = document.getElementById('input-element-name');
const inputElementAddress = document.getElementById('input-element-address');
const inputElementPhone = document.getElementById('input-element-phone');
const inputElementNote = document.getElementById('input-element-note');
const inputBalanceToggle = document.getElementById('input-balance-toggle');
const balanceStatusText = document.getElementById('balance-status-text');
const privateOwnerInfoBlock = document.getElementById('private-owner-info-block');

// Xususiy TP inputlari
const inputOwnerFirm = document.getElementById('input-owner-firm');
const inputOwnerName = document.getElementById('input-owner-name');
const inputOwnerPhone = document.getElementById('input-owner-phone');
const inputMeterNumber = document.getElementById('input-meter-number');

// Rasm elementlari
const elementImageInput = document.getElementById('element-image-input');
const elementImagePreview = document.getElementById('element-image-preview');
const imageIconPlaceholder = document.getElementById('image-icon-placeholder');
const imageStatusText = document.getElementById('image-status-text');
const removeImageBtn = document.getElementById('remove-image-btn');
const deleteElementBtn = document.getElementById('delete-element-btn');

// 3. "Save Location" tugmasi bosilganda formani ochish mantiqi (Plus knopka shartmas!)
document.querySelector('.save-btn').addEventListener('click', function() {
    // Joriy paneldagi textlardan koordinatalarni ajratib olamiz
    const currentLat = parseFloat(document.getElementById('latitude').innerText);
    const currentLng = parseFloat(document.getElementById('longitude').innerText);
    const currentAddr = document.getElementById('address').innerText;

    if (isNaN(currentLat) || isNaN(currentLng) || currentLat === 0) {
        return showToast("Koordinata aniqlanmadi!");
    }

    // Formani tozalab yangi kiritish rejimiga o'tkazamiz
    resetElementForm();
    editingElementId = null;
    document.getElementById('element-panel-title').innerText = "Добавить местоположение";
    deleteElementBtn.classList.add('hidden');

    // Qiymatlarni kiritamiz
    inputLatitude.value = currentLat;
    inputLongitude.value = currentLng;
    inputElementAddress.value = currentAddr;

    // Guruhlar daraxt dropdownini dynamic chizamiz
    renderElementTreeDropdown();

    // Panelni ochamiz
    elementManagePanel.classList.remove('hidden');
});

// 4. Balans turi o'zgarganda (Tumbler switch bosilganda) yashirin bloklarni boshqarish
if (inputBalanceToggle) {
    inputBalanceToggle.addEventListener('change', function() {
        if (this.checked) {
            balanceStatusText.innerText = "Xususiy";
            balanceStatusText.style.color = "#ff4444";
            privateOwnerInfoBlock.classList.remove('hidden');
            // Maydonlarni to'ldirish majburiy bo'ladi
            togglePrivateFieldsRequired(true);
        } else {
            balanceStatusText.innerText = "ЕТК";
            balanceStatusText.style.color = "#007AFF";
            privateOwnerInfoBlock.classList.add('hidden');
            togglePrivateFieldsRequired(false);
        }
    });
}

function togglePrivateFieldsRequired(isRequired) {
    inputOwnerFirm.required = isRequired;
    inputOwnerName.required = isRequired;
}

// 5. Siz aytgan eng muhim mantiq: Koordinatalar qo'lda o'zgartirilganda dynamic adresni aniqlash
if (inputLatitude && inputLongitude) {
    const triggerGeocoding = debounce(() => {
        const lat = parseFloat(inputLatitude.value);
        const lng = parseFloat(inputLongitude.value);
        
        if (!isNaN(lat) && !isNaN(lng)) {
            inputElementAddress.value = "Yangi manzil aniqlanmoqda...";
            
            // OpenStreetMap Reverse Geocoding API
                    // 734-qator: OpenStreetMap so'roviga o'zbek tili &accept-language=uz qo'shildi
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=uz`)
            .then(res => res.json())
            .then(data => {
                inputElementAddress.value = data.display_name || "Manzil topilmadi";
                
                // ⚡ YANGI: Matn so'z o'rtasidan bo'linib, xunuk bo'lib ketmasligi uchun stillar
                inputElementAddress.style.wordBreak = "keep-all";
                inputElementAddress.style.overflowWrap = "break-word";
                inputElementAddress.style.whiteSpace = "normal";

                // Agar xaritada marker bo'lsa uni yangi koordinataga suramiz
                if (selectedMarker) {
                    selectedMarker.setLatLng([lat, lng]);
                } else {
                    isManualSelection = true;
                    selectedMarker = L.marker([lat, lng]).addTo(map);
                }
                map.setView([lat, lng], 17);
            }).catch(() => {
                inputElementAddress.value = "Internetda xatolik yuz berdi";
            });
          
        }
    }, 1000); // Foydalanuvchi yozib bo'lishini 1 sekund kutadi

    inputLatitude.addEventListener('input', triggerGeocoding);
    inputLongitude.addEventListener('input', triggerGeocoding);
}

// Debounce funksiyasi - har bir harfda serverga so'rov yuborib qotib qolmasligi uchun
function debounce(func, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => func.apply(this, args), delay);
    };
}

// 6. Rasm yuklash va uni orqa fonda xarajatsiz Telegram Botga yuborish mantiqi
if (elementImageInput) {
    elementImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Vizual yuklanish holati
        imageStatusText.innerText = "Yuklanmoqda...";
        imageStatusText.style.color = "#ffcc00";

        const formData = new FormData();
        formData.append("chat_id", TELEGRAM_CHAT_ID);
        formData.append("photo", file);

        // Telegram API orqali rasmni yuborib doimiy Link olish
        fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(result => {
            if (result.ok) {
                // Telegram kanaldagi eng oxirgi kichik o'lchamli rasm linkini olamiz (Tez yuklanishi uchun)
                const photos = result.result.photo;
                const fileId = photos[photos.length - 1].file_id;
                
                // File ID orqali to'g'ridan-to'g'ri URL manzilini olamiz
                fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`)
                .then(r => r.json())
                .then(fResult => {
                    if (fResult.ok) {
                        currentUploadedImageUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fResult.result.file_path}`;
                        
                        // Ekrandagi preview rasm elementini yangilash
                        elementImagePreview.src = currentUploadedImageUrl;
                        elementImagePreview.classList.remove('hidden');
                        removeImageBtn.classList.remove('hidden');
                        imageStatusText.innerText = "Yuklandi";
                        imageStatusText.style.color = "#34C759";
                    }
                });
            } else {
                imageStatusText.innerText = "Xatolik!";
                showToast("Rasm yuklashda xatolik yuz berdi");
            }
        })
        .catch(() => {
            imageStatusText.innerText = "Ulanish xatosi";
            showToast("Telegram bot bilan aloqa yo'q");
        });
    });
}

// Yuklangan rasmni formadan olib tashlash
if (removeImageBtn) {
    removeImageBtn.addEventListener('click', function(e) {
        e.preventDefault();
        currentUploadedImageUrl = "";
        elementImagePreview.src = "";
        elementImagePreview.classList.add('hidden');
        removeImageBtn.classList.add('hidden');
        imageStatusText.innerText = "Rasm";
        imageStatusText.style.color = "#88a0b0";
        elementImageInput.value = "";
    });
}

// 7. Element Formasi uchun daraxtsimon Multiselect (Many-to-Many fiderlar tanlash) dropdown chizish
function renderElementTreeDropdown() {
    const dropdownContainer = document.getElementById('element-parent-folder-tree');
    if (!dropdownContainer) return;

    dropdownContainer.innerHTML = "";
    const selectedFoldersInput = document.getElementById('element-selected-folders');
    // Avvaldan tanlangan fiderlar massivi (Tahrirlash rejimi uchun)
    let selectedArray = selectedFoldersInput.value ? selectedFoldersInput.value.split(',') : [];

    function buildNode(parentId, level) {
        const folders = Object.keys(currentFolders).filter(id => currentFolders[id].parentId === parentId);
        
        folders.forEach(id => {
            const folder = currentFolders[id];
            const isChecked = selectedArray.includes(id) ? "checked" : "";
            
            const row = document.createElement('div');
            row.style.paddingLeft = `${level * 15}px`;
            row.style.display = "flex";
            row.style.alignItems = "center";
            row.style.gap = "8px";
            row.style.background = selectedArray.includes(id) ? "rgba(0,122,255,0.1)" : "transparent";

            row.innerHTML = `
                <input type="checkbox" value="${id}" ${isChecked} class="element-folder-checkbox" style="width:16px; height:16px; cursor:pointer;">
                <i class="fas fa-folder" style="color: ${folder.color}; font-size:14px;"></i>
                <span style="font-size:13px; color:white;">${folder.name}</span>
            `;

            // Checkbox o'zgarganda massivni dynamic yangilash
            const checkbox = row.querySelector('.element-folder-checkbox');
            checkbox.addEventListener('change', function() {
                let currentSelected = selectedFoldersInput.value ? selectedFoldersInput.value.split(',') : [];
                if (this.checked) {
                    if (!currentSelected.includes(this.value)) currentSelected.push(this.value);
                    row.style.background = "rgba(0,122,255,0.1)";
                } else {
                    currentSelected = currentSelected.filter(v => v !== this.value);
                    row.style.background = "transparent";
                }
                selectedFoldersInput.value = currentSelected.filter(Boolean).join(',');
            });

            dropdownContainer.appendChild(row);
            buildNode(id, level + 1);
        });
    }

    buildNode('root', 0);
}

// 8. Elementni Firebase Realtime Database'ga Saqlash va Tahrirlash (Many-to-Many tizimda)
if (elementMainForm) {
    elementMainForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const selectedFolders = document.getElementById('element-selected-folders').value;
        if (!selectedFolders) return showToast("Kamida bitta fiderni (guruh) belgilang!");

        const folderIdsArray = selectedFolders.split(',').filter(Boolean);

        // Saqlanadigan obyekt strukturasi
        const elementData = {
            name: inputElementName.value,
            lat: inputLatitude.value,
            lng: inputLongitude.value,
            address: inputElementAddress.value,
            phone: inputElementPhone.value,
            note: inputElementNote.value,
            imageUrl: currentUploadedImageUrl,
            isPrivate: inputBalanceToggle.checked,
            // Many-to-Many: fiderlarni obyekt ichida saqlash (qidirish oson bo'lishi uchun)
            folders: folderIdsArray.reduce((acc, id) => ({ ...acc, [id]: true }), {}),
            // Eski kodlar buzilmasligi uchun birinchi fiderni standart folderId ga ham yozib qo'yamiz
            folderId: folderIdsArray[0], 
            
            // Xususiy fieldlar agar o'chiq bo'lsa bo'sh ketadi
            ownerFirm: inputBalanceToggle.checked ? inputOwnerFirm.value : "",
            ownerName: inputBalanceToggle.checked ? inputOwnerName.value : "",
            ownerPhone: inputBalanceToggle.checked ? inputOwnerPhone.value : "",
            meterNumber: inputBalanceToggle.checked ? inputMeterNumber.value : "",
            updatedAt: Date.now()
        };

        if (!editingElementId) {
            // Yangi element yaratish holati
            elementData.createdAt = Date.now();
            database.ref('TPs').push(elementData).then(() => {
                showToast("Yangi element muvaffaqiyatli saqlandi!");
                elementManagePanel.classList.add('hidden');
                resetToUserLocation();
                if(document.getElementById('tab-items').classList.contains('active')) loadFilteredPoints();
            });
        } else {
            // Mavjud elementni yangilash holati
            database.ref('TPs/' + editingElementId).update(elementData).then(() => {
                showToast("Element ma'lumotlari yangilandi!");
                elementManagePanel.classList.add('hidden');
                editingElementId = null;
                if(document.getElementById('tab-items').classList.contains('active')) loadFilteredPoints();
            });
        }
    });
}

// Elementni o'chirish tugmasi mantiqi
if (deleteElementBtn) {
    deleteElementBtn.addEventListener('click', function() {
        if (editingElementId && confirm("Ushbu elementni (TP) butunlay o'chirib tashlamoqchimisiz?")) {
            database.ref('TPs/' + editingElementId).remove().then(() => {
                showToast("Element o'chirib tashlandi!");
                elementManagePanel.classList.add('hidden');
                editingElementId = null;
                if(document.getElementById('tab-items').classList.contains('active')) loadFilteredPoints();
            });
        }
    });
}

// Formani tozalash funksiyasi
function resetElementForm() {
    elementMainForm.reset();
    currentUploadedImageUrl = "";
    elementImagePreview.src = "";
    elementImagePreview.classList.add('hidden');
    removeImageBtn.classList.add('hidden');
    imageStatusText.innerText = "Rasm";
    imageStatusText.style.color = "#88a0b0";
    balanceStatusText.innerText = "ЕТК";
    balanceStatusText.style.color = "#007AFF";
    privateOwnerInfoBlock.classList.add('hidden');
    document.getElementById('element-selected-folders').value = "";
}


// =========================================================================
// 🔄 ESKI FUNKSIYALARNI INTEGRATSIYA QILISH VA SCADA ANIMATSIYALARI (OVERRIDE)
// =========================================================================

// 1. ESKI renderTree funksiyasini tahrirlash (✏️ Qalamcha bosilganda TP elementlarini ham ochish imkoni)
// Guruhlar bo'limida har bir fiderning ostiga unga biriktirilgan TPlarni ketma-ket joylashtiramiz.
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
                <span style="flex-grow: 1; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block;">${folder.name}</span>
                <i class="fas fa-edit edit-icon" style="cursor: pointer;" onclick="event.stopPropagation(); openEditFolder('${id}', '${folder.name}', ${folder.hue || 0})"></i>
            </div>
            <div id="children-${id}" class="folder-children" style="display: none; padding-left: 15px;"></div>
        `;
        container.appendChild(item);
        
        const childContainer = item.querySelector(`#children-${id}`);
        
        // Dynamic ravishda shu fiderga tegishli TPlarni bazadan olib daraxt ostiga qo'shish
        renderElementsInTree(id, childContainer);
        
        renderTree(id, childContainer);
    });
}

// Guruhlar ichida TPlarni chiroyli ketma-ketlikda qalamcha (✏️) bilan chizish funksiyasi
function renderElementsInTree(folderId, childContainer) {
    database.ref('TPs').once('value', (snapshot) => {
        const allPoints = snapshot.val() || {};
        Object.keys(allPoints).forEach(tpId => {
            const tp = allPoints[tpId];
            
            // Ko'p tomonlama bog'liqlikni tekshirish (folders massivi yoki eski folderId)
            const isBelongsToFolder = (tp.folders && tp.folders[folderId]) || (tp.folderId === folderId);
            
            if (isBelongsToFolder) {
                const tpRow = document.createElement('div');
                tpRow.style.cssText = "display:flex; align-items:center; padding: 6px 8px; margin: 2px 0; cursor:pointer; border-radius:4px; transition: background 0.2s;";
                tpRow.className = "tp-tree-row-item";
                
                // Balans turiga qarab ikonka rangi
                const iconColor = tp.isPrivate ? "#ff4444" : "#007AFF";
                
                tpRow.innerHTML = `
                    <i class="fas fa-bolt" style="color: ${iconColor}; margin-right: 8px; font-size:13px;"></i>
                    <span style="font-size:14px; color:#e0e0e0; flex-grow:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${tp.name || "TP"}</span>
                    <i class="fas fa-pencil-alt element-edit-pencil-icon" style="color:#88a0b0; font-size:12px; padding:4px; cursor:pointer; opacity:0.6;" onclick="event.stopPropagation(); openEditElement('${tpId}')"></i>
                `;

                // Hoverda va bosilganda stil berish
                tpRow.addEventListener('mouseenter', () => tpRow.style.background = "rgba(255,255,255,0.05)");
                tpRow.addEventListener('mouseleave', () => tpRow.style.background = "transparent");
                
                // TP bosilsa xaritada focus bo'lish mantiqi
                tpRow.addEventListener('click', () => {
                    if(listModal) listModal.style.display = 'none';
                    const lat = parseFloat(tp.lat);
                    const lng = parseFloat(tp.lng);
                    map.setView([lat, lng], 18);
                    
                    // Xaritada markerini topib popup ochish
                    activeMapMarkers.forEach(m => {
                        if (m.getLatLng().lat === lat && m.getLatLng().lng === lng) {
                            m.openPopup();
                        }
                    });
                    updatePanelValues(lat, lng, null, true);
                    updateAddress(lat, lng, true);
                });

                childContainer.appendChild(tpRow);
            }
        });
    });
}

// 2. Elementni tahrirlash uchun oynani ochish funksiyasi (✏️ Bosilganda hamma ma'lumot yuklanadi)
  window.openEditElement = function(tpId) {
    database.ref('TPs/' + tpId).once('value', (snapshot) => {
        const tp = snapshot.val();
        if (!tp) return;

        resetElementForm();
        editingElementId = tpId;
        document.getElementById('element-panel-title').innerText = "Редактировать местоположение";
        deleteElementBtn.classList.remove('hidden');

        // Ma'lumotlarni formaga yuklaymiz
        inputElementName.value = tp.name || "";
        inputLatitude.value = tp.lat;
        inputLongitude.value = tp.lng;
        inputElementAddress.value = tp.address || "";
        inputElementPhone.value = tp.phone || "";
        inputElementNote.value = tp.note || "";

        // Many-to-Many fiderlar ro'yxatini yuklash
        let folderIds = [];
        if (tp.folders) {
            folderIds = Object.keys(tp.folders);
        } else if (tp.folderId) {
            folderIds = [tp.folderId];
        }
        document.getElementById('element-selected-folders').value = folderIds.join(',');

        // Rasm mavjudligini tekshirish
        if (tp.imageUrl) {
            currentUploadedImageUrl = tp.imageUrl;
            elementImagePreview.src = tp.imageUrl;
            elementImagePreview.classList.remove('hidden');
            removeImageBtn.classList.remove('hidden');
            imageStatusText.innerText = "Yuklangan";
            imageStatusText.style.color = "#34C759";
        }

        // Balans holati (Tumbler)
        if (tp.isPrivate) {
            inputBalanceToggle.checked = true;
            balanceStatusText.innerText = "Xususiy";
            balanceStatusText.style.color = "#ff4444";
            privateOwnerInfoBlock.classList.remove('hidden');
            togglePrivateFieldsRequired(true);

            // Xususiy fieldlar ma'lumotlari
            inputOwnerFirm.value = tp.ownerFirm || "";
            inputOwnerName.value = tp.ownerName || "";
            inputOwnerPhone.value = tp.ownerPhone || "";
            inputMeterNumber.value = tp.meterNumber || "";
        } else {
            inputBalanceToggle.checked = false;
        }

        // Guruh daraxtini dropdown ichida qayta chizish (Belgilangan fiderlarni galochka qilish uchun)
        renderElementTreeDropdown();

        // Oynani ko'rsatish
        elementManagePanel.classList.remove('hidden');
    });
};

// 3. SIZ AYTGAN ASOSIY SCADA MANTIQI: Xaritada filtrlash, Birlashish va Miltillovchi markerlar (Override)
function loadFilteredPoints() {
    const tpListContainer = document.getElementById('tp-list');
    if (!tpListContainer) return;
    
    tpListContainer.innerHTML = "<p style='color:gray; padding:15px; text-align:center;'>Yuklanmoqda...</p>";

    // Eski markerlarni xaritadan butunlay tozalash
    activeMapMarkers.forEach(m => map.removeLayer(m));
    activeMapMarkers = [];

    database.ref('TPs').once('value', (snapshot) => {
        const allPoints = snapshot.val() || {};
        tpListContainer.innerHTML = ""; 

        let bounds = [];
        const displayedPointsMap = new Map(); // Ona papkada bitta nuqtani bir marta chizish (dublikat oldini olish) uchun

        // Bola guruhlarni (fiderlarni) recursively yig'ish funksiyasi (Ona papka bosilganda hamma pastidagilarni ko'rish uchun)
        function getAllChildFolderIds(parentId) {
            let ids = [parentId];
            Object.keys(currentFolders).forEach(id => {
                if (currentFolders[id].parentId === parentId) {
                    ids = ids.concat(getAllChildFolderIds(id));
                }
            });
            return ids;
        }

        // Tanlangan guruh va uning pastki fiderlari IDlari ro'yxati
        const allowedFolderIds = activeFolderId === 'root' ? [] : getAllChildFolderIds(activeFolderId);

        Object.keys(allPoints).forEach(key => {
            const point = allPoints[key];
            const lat = parseFloat(point.lat);
            const lng = parseFloat(point.lng);

            if (isNaN(lat) || isNaN(lng)) return;

            // Element tegishli bo'lgan barcha fiderlar massivi
            let tpFoldersArr = point.folders ? Object.keys(point.folders) : (point.folderId ? [point.folderId] : []);

            // FILTRLASH ssenariylari:
            let isVisible = false;
            if (activeFolderId === 'root') {
                isVisible = true; // Hamma elementlar ko'rinadi
            } else {
                // Agar tanlangan fiderlar ro'yxatida elementning kamida bitta fideri bo'lsa xaritaga chiqadi
                isVisible = tpFoldersArr.some(id => allowedFolderIds.includes(id));
            }

            if (!isVisible) return;

            // 📍 DUBLIKAT NUQTALARNI OLDINI OLISH VA SCADA MILTILLASH MANTIQI
            const coordKey = `${lat.toFixed(6)}_${lng.toFixed(6)}`;

            if (displayedPointsMap.has(coordKey)) {
                // Agar ona papka ochilganda ushbu koordinatada rasm allaqachon chizilgan bo'lsa, uni miltillovchi ro'yxatga olamiz
                const existingMarkerObj = displayedPointsMap.get(coordKey);
                existingMarkerObj.associatedFolders = [...existingMarkerObj.associatedFolders, ...tpFoldersArr];
                return; 
            }

            bounds.push([lat, lng]);
            const displayName = point.name || point.address.split(',')[0] || "TP";

            // Markerning standart fider rangini aniqlash
            const primaryFolderId = tpFoldersArr[0];
            const primaryColor = (currentFolders[primaryFolderId] && currentFolders[primaryFolderId].color) ? currentFolders[primaryFolderId].color : '#007AFF';

            // Xususiy yoki ETK ekanligiga qarab sarlavha tayyorlash
            const balanceBadge = point.isPrivate ? `<span style="color:#ff4444; font-weight:bold;">[Xususiy - ${point.ownerFirm || ''}]</span>` : `<span style="color:#007AFF; font-weight:bold;">[ЕТК balansi]</span>`;

            // Maxsus divIcon marker yaratish
            const markerDiv = document.createElement('div');
            markerDiv.className = 'custom-tp-marker';
            
            // Agar element 1 tadan ko'p fiderga ulangan bo'lsa va ona papka ochiq bo'lsa dynamic CSS o'zgaruvchilarni biriktiramiz (Blinking uchun)
            if (tpFoldersArr.length > 1) {
                markerDiv.classList.add('blinking-marker-icon');
                const secondFolderId = tpFoldersArr[1];
                const secondaryColor = (currentFolders[secondFolderId] && currentFolders[secondFolderId].color) ? currentFolders[secondFolderId].color : '#34C759';
                markerDiv.style.setProperty('--fider-color-1', primaryColor);
                markerDiv.style.setProperty('--fider-color-2', secondaryColor);
            }

            markerDiv.innerHTML = `<i class="fas fa-map-marker-alt" style="color: ${primaryColor}; font-size: 28px; text-shadow: 0 0 4px black;"></i>`;

            const mIcon = L.divIcon({
                className: 'custom-leaflet-tp-wrapper',
                html: markerDiv,
                iconSize: [28, 28],
                iconAnchor: [14, 28]
            });

            const marker = L.marker([lat, lng], {icon: mIcon}).addTo(map);
            
            // Popup oynasida barcha muhandislik va schotchik ma'lumotlarini chiroyli chiqarish
            let popupHtml = `
                <div style="color:white; background:#001a2c; padding:10px; border-radius:8px; border:1px solid rgba(255,255,255,0.1); min-width:200px;">
                    <b style="font-size:15px; color:#fff; display:block; margin-bottom:4px;">⚡ ${displayName}</b>
                    ${balanceBadge}<br>
                    <span style="font-size:12px; color:#88a0b0; display:block; margin-top:5px;"><b>Адрес:</b> ${point.address}</span>
            `;
            if (point.isPrivate) {
                popupHtml += `
                    <div style="border-top:1px dashed rgba(255,255,255,0.1); margin-top:6px; padding-top:6px; font-size:11px; color:#ffcc00;">
                        👤 <b>Egasining ismi:</b> ${point.ownerName || '-'}<br>
                        📞 <b>Tel:</b> ${point.ownerPhone || '-'}<br>
                        🔢 <b>Hisoblagich №:</b> ${point.meterNumber || '-'}
                    </div>
                `;
            }
            if (point.imageUrl) {
                popupHtml += `<div style="margin-top:8px; text-align:center;"><img src="${point.imageUrl}" style="width:100%; max-height:100px; border-radius:6px; object-fit:cover; cursor:pointer;" onclick="window.open('${point.imageUrl}', '_blank')"></div>`;
            }
            popupHtml += `</div>`;

            marker.bindPopup(popupHtml, { className: 'custom-popup-scada' });
            activeMapMarkers.push(marker);

            // Obyektimizni xaritaga (Map) saqlaymiz (keyingi dublikat daxldorliklarni tekshirish uchun)
            displayedPointsMap.set(coordKey, { marker: marker, associatedFolders: tpFoldersArr });

            // Pastki ro'yxat elementini (Tab items) yaratish va bo'yash
            const item = document.createElement('div');
            item.className = 'tp-item';
            item.style.cssText = `padding: 12px; margin: 6px 0; background: #00223a; border-radius: 8px; cursor: pointer; border-left: 4px solid ${primaryColor}; color: white;`;
            
            item.innerHTML = `
                <div style="font-weight: bold; font-size: 14px; display:flex; justify-content:space-between; align-items:center;">
                    <span>⚡ ${displayName}</span> 
                    <span style="font-size:10px; opacity:0.6;">${point.isPrivate ? 'Xususiy' : 'ETK'}</span>
                </div>
                <div style="color: #88a0b0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top:2px;">${point.address}</div>
            `;

            // Ro'yxat elementi bosilganda xaritani focus qilib yopish
            item.addEventListener('click', () => {
                if(listModal) listModal.style.display = 'none';
                map.setView([lat, lng], 18);
                marker.openPopup();
                updatePanelValues(lat, lng, null, true);
                updateAddress(lat, lng, true);
            });

            item.setAttribute('data-search-name', displayName.toLowerCase() + point.address.toLowerCase());
            tpListContainer.appendChild(item);
        });

        // Agar biror papka ichiga kirilgan bo'lsa, xaritani shundoq o'sha fiderlar hududiga o'tkazish
        if (bounds.length > 0 && activeFolderId !== 'root') {
            map.fitBounds(bounds, { padding: [50, 50] });
        }

        if (tpListContainer.innerHTML === "") {
            tpListContainer.innerHTML = "<p style='color:gray; padding:15px; text-align:center;'>Elementlar mavjud emas.</p>";
        }
    });
                             }

// 🔥 BAZANI TO'G'RIDAN-TO'G'RI CHAQIRISH VA GLAVNIY EKRANNI OCHISH (YAKUNIY YECHIM)
document.addEventListener('DOMContentLoaded', () => {
    console.log("Tizim yuklanishi boshlandi...");

    // 1-QADAMDA TOPILGAN ASL FUNKSIYA NOMINI SHU YERDA CHAQIRING:
    // Agar koddagi nomi boshqacha bo'lsa (masalan loadGroupsData), quyidagilar o'rniga o'sha nomni yozing
    if (typeof loadGroups === "function") loadGroups();
    if (typeof fetchGroups === "function") fetchGroups();
    if (typeof listenToGroups === "function") listenToGroups();
    if (typeof loadUserGroups === "function") loadUserGroups();

    // 1.5 sekund "Baza yuklanmoqda..." oynasi turadi (baza xotiraga guruhlarni to'liq yuklaydi)
    setTimeout(() => {
        // Yuklanish oynasini o'chiramiz
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.display = 'none';
        }
        
        // Boshqaruv paneli mutlaqo yopiq va daxlsiz holatda qolishi shart!
        const adminPanel = document.getElementById('admin-panel') || document.querySelector('.sidebar') || document.getElementById('dashboard');
        if (adminPanel) {
            adminPanel.classList.remove('active');
            adminPanel.style.display = 'none'; 
        }

        console.log("Yuklanish tugadi. Faqat toza Glavniy ekran faol!");
    }, 1500); 
});
