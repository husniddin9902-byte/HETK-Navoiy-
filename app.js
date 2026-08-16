// "Bismillahir Rohmanir Rohim" — "Mehribon va Rahmli Alloh nomi bilan boshlayman" 
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
let isSaving = false;

// ===============================
// Performance Cache
// ===============================
let folderPathCache = {};
let folderIndex = {};
let tpIndex = {};

function showSaveLoader(percent,text){
document
.getElementById("save-loader")
.classList.remove("hidden");
document
.getElementById("save-progress-fill")
.style.width = percent + "%";
document
.getElementById("save-progress-percent")
.innerText = percent + "%";
document
.getElementById("save-loader-text")
.innerText = text;
}
function hideSaveLoader(){
document
.getElementById("save-loader")
.classList.add("hidden");
}

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

// Agar element oynasi ochiq bo'lsa koordinatani unga ham yozamiz

    inputLatitude.value = e.latlng.lat.toFixed(6);
    inputLongitude.value = e.latlng.lng.toFixed(6);

  
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


//====================================================
// MAHALLA MODULI
//====================================================
let foundMahallas = [];
let selectedMahallas = [];
let primaryMahalla = null;

// Mahallalarni ekranga chiqarish
function renderMahallaList(){
    const container =
        document.getElementById("mahalla-found-items");
    container.innerHTML = "";

    // TEST MA'LUMOTLARI
    foundMahallas = [
        {
            name:"Paxtakor",
            distance:1.2
        },
        {
            name:"Galabek",
            distance:4.9
        },
        {
            name:"Mustaqillik",
            distance:8.9
        }
    ];
    foundMahallas.forEach((m,index)=>{
        container.innerHTML += `
<div
class="mahalla-item"
onclick="toggleMahalla(${index})"
style="
display:flex;
justify-content:space-between;
align-items:center;
padding:10px 0;
border-bottom:1px solid rgba(255,255,255,.05);
cursor:pointer;
">
<div>
<span
style="
font-size:18px;
margin-right:10px;
">
${selectedMahallas.some(x => x.name === m.name) ? "●" : "○"}
</span>
<b>${m.name}</b>

${selectedMahallas.some(x =>
    x.name === m.name && x.isPrimary
)
?
`<span
onclick="event.stopPropagation();setPrimaryMahalla('${m.name}')"
style="
margin-left:10px;
color:#00d4ff;
font-size:12px;
font-weight:bold;
cursor:pointer;
">
📍 Manzil
</span>`
:
""
}


</div>
<div
style="
display:flex;
flex-direction:column;
gap:8px;
">
<span
style="
color:#88a0b0;
font-size:13px;
">
${m.distance} km
</span>
</div>
</div>
`;
    });
}


// Biriktirilganlarni chiqarish
function renderSelectedMahallas(){
    const container =
        document.getElementById("mahalla-selected-items");
    if(!container){
        return;
    }
    container.innerHTML = "";
    selectedMahallas.forEach(item=>{
        container.innerHTML += `
<div
style="
display:flex;
justify-content:space-between;
align-items:center;
padding:8px 12px;
margin-bottom:8px;
background:#001a2c;
border-radius:8px;
">

<div>
🏘 ${item.name}
${item.isPrimary
?
'<span style="margin-left:8px;color:#00bfff;">📍</span>'
:
''}
</div>
<div
style="
color:#ff5555;
cursor:pointer;
font-size:18px;
font-weight:bold;
"
onclick="removeMahalla('${item.name}')">
✖
</div>
</div>
`;
    });
}

function toggleMahalla(index){
    const mahalla = foundMahallas[index];
    const existingIndex =
        selectedMahallas.findIndex(
            x => x.name === mahalla.name
        );
    if(existingIndex >= 0){
        // Olib tashlash
        selectedMahallas.splice(existingIndex,1);
    }else{
        // Qo'shish
        selectedMahallas.push({
            name: mahalla.name,
            distance: mahalla.distance,
            isPrimary:false
        });
    }
    renderMahallaList();
    renderSelectedMahallas();
}

function setPrimaryMahalla(name){
    selectedMahallas.forEach(x=>{
        x.isPrimary = false;
    });
    const item =
        selectedMahallas.find(x=>x.name===name);
    if(item){
        item.isPrimary = true;
    }
    renderMahallaList();
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
 loadFilteredPoints();
    searchState.folderId = id;
    refreshSearchResults();
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



// ===============================
// Qidiruv tizimi
// ===============================

const elementSearchInput = document.getElementById("element-search");

const searchState = {
    folderId: "root",
    text: "",
    results: []
};

const filterState = {
    balance: "none",
    responsible: "none",
    created: "none",
    updated: "none",
    comment: "none",
    dual: "none",
    power: "none",
    status: "none"
};

let appliedFilterState = { ...filterState };

function resetFilters() {

    filterState.balance = "none";
    filterState.responsible = "none";
    filterState.created = "none";
    filterState.updated = "none";
    filterState.comment = "none";
    filterState.dual = "none";
    filterState.power = "none";
    filterState.status = "none";
}

// Qidiruv inputi
if (elementSearchInput) {
    elementSearchInput.addEventListener("input", function () {
        searchState.text = this.value.trim();
        refreshSearchResults();
    });
}

// 🔑 Qidiruv turi kodi
   const searchTypeBtn = document.getElementById("search-type-btn");
const searchTypeMenu = document.getElementById("search-type-menu");
const applySearchType = document.getElementById("apply-search-type");
const cancelSearchType = document.getElementById("cancel-search-type");
let currentSearchType = "name";

function getSearchTypeName() {
    switch (currentSearchType) {
        case "name": return "Nomi";
        case "address": return "Manzil";
        case "responsible": return "Javobgar shaxs";
        case "note": return "Izohi ";
        case "company": return "Korxona (F/X) nomi ";
        case "phone": return "Egasining telefoni";
        case "owner": return "Egasining ism-sharifi";
        case "meter": return "Hisoblagich raqami";
        case "all": return "Barcha maydonlarda";
        default: return "Nomi";
    }
}

let tempSearchType = "name";
if (searchTypeBtn && searchTypeMenu) {
    searchTypeBtn.onclick = function (e) {
        e.stopPropagation();
        tempSearchType = currentSearchType;
        const radio = document.querySelector(
            `input[name="searchType"][value="${currentSearchType}"]`
        );

        if (radio) radio.checked = true;
        searchTypeMenu.style.display = "block";
    };
    cancelSearchType.onclick = function () {
        searchTypeMenu.style.display = "none";
    };
    applySearchType.onclick = function () {
        const selected = document.querySelector(
            'input[name="searchType"]:checked'
        );
      
        if (selected) {
    currentSearchType = selected.value;
}

searchTypeMenu.style.display = "none";

// Agar qidiruv matni yozilgan bo'lsa, darhol natijani yangilash
if (searchState.text !== "") {
    refreshSearchResults();
}
    };
    document.addEventListener("click", function (e) {
        if (
            !searchTypeMenu.contains(e.target) &&
            !searchTypeBtn.contains(e.target)
        ) {
         
            searchTypeMenu.style.display = "none";
        }
    });
//  updateFilterCount();
}

 // ===============================
// Filtr paneli
// ===============================
const filterBtn = document.getElementById("filter-btn");
const filterMenu = document.getElementById("filter-menu");
const applyFilterBtn = document.getElementById("apply-filter");
const cancelFilterBtn = document.getElementById("cancel-filter");
const clearFilterBtn = document.getElementById("clear-filter");
const filterCount = document.getElementById("filter-count");

// Balans dropdown
const balanceSelected = document.getElementById("balance-selected");
const balanceSelectedText = document.getElementById("balance-selected-text");
const balanceOptions = document.getElementById("balance-options");

// Mas'ul shaxs dropdown
const responsibleSelected = document.getElementById("responsible-selected");
const responsibleSelectedText = document.getElementById("responsible-selected-text");
const responsibleOptions = document.getElementById("responsible-options");

// Oxirgi yangilangan dropdown
const updatedSelected = document.getElementById("updated-selected");
const updatedSelectedText = document.getElementById("updated-selected-text");
const updatedOptions = document.getElementById("updated-options");

// Yaratilgan sana dropdown
const createdSelected = document.getElementById("created-selected");
const createdSelectedText = document.getElementById("created-selected-text");
const createdOptions = document.getElementById("created-options");

// Oxirgi izoh dropdown
const commentSelected = document.getElementById("comment-selected");
const commentSelectedText = document.getElementById("comment-selected-text");
const commentOptions = document.getElementById("comment-options");

// Ikki tomonlama ta'minlangan dropdown
const dualSelected = document.getElementById("dual-selected");
const dualSelectedText = document.getElementById("dual-selected-text");
const dualOptions = document.getElementById("dual-options");

// Quvvat dropdown
const powerSelected = document.getElementById("power-selected");
const powerSelectedText = document.getElementById("power-selected-text");
const powerOptions = document.getElementById("power-options");

// Texnik holati dropdown
const statusSelected =
document.getElementById("status-selected");
const statusSelectedText =
document.getElementById("status-selected-text");
const statusOptions =
document.getElementById("status-options");


function updateFilterCount() {
    let count = 0;
    Object.values(appliedFilterState).forEach(value => {
        if (value !== "none") {
            count++;
        }
    });
    if (count === 0) {
        filterCount.style.display = "none";
    } else {
        filterCount.style.display = "flex";
        filterCount.textContent = count;
    }
}

function setFilterDropdown(
    optionClass,
    value,
    selectedTextElement
){
    document.querySelectorAll("." + optionClass).forEach(option => {
        option.classList.remove("active");
        if (option.dataset.value === value) {
            option.classList.add("active");
            selectedTextElement.textContent =
                option.querySelector("span").textContent;
        }
    });
}

// filtir menyusi birini ochsa ikkinchisini yopish uchun.
function closeAllFilterDropdowns() {
    balanceOptions.style.display = "none";
    responsibleOptions.style.display = "none";
    updatedOptions.style.display = "none";
    createdOptions.style.display = "none";
    commentOptions.style.display = "none";
    dualOptions.style.display = "none";
    powerOptions.style.display = "none";
    statusOptions.style.display = "none";

}

function initFilterDropdown(
    optionClass,
    stateKey,
    selectedTextElement,
    optionsContainer
){
    document.querySelectorAll("." + optionClass).forEach(option => {
        option.onclick = function () {
            const value = this.dataset.value;
            document.querySelectorAll("." + optionClass).forEach(x => {
                x.classList.remove("active");
            });
            this.classList.add("active");
            filterState[stateKey] = value;
            selectedTextElement.textContent =
                this.querySelector("span").textContent;
            optionsContainer.style.display = "none";
        };
    });
}

if (filterBtn && filterMenu) {
    filterBtn.onclick = function (e) {
        e.stopPropagation();
        filterMenu.style.display = "block";
    };

 balanceSelected.onclick = function (e) {
    e.stopPropagation();

    const isOpen = balanceOptions.style.display === "block";
    closeAllFilterDropdowns();
    balanceOptions.style.display = isOpen ? "none" : "block";
};

  
  responsibleSelected.onclick = function (e) {
    e.stopPropagation();

    const isOpen = responsibleOptions.style.display === "block";
    closeAllFilterDropdowns();
    responsibleOptions.style.display = isOpen ? "none" : "block";
};

  updatedSelected.onclick = function (e) {
    e.stopPropagation();

    const isOpen = updatedOptions.style.display === "block";
    closeAllFilterDropdowns();
    updatedOptions.style.display = isOpen ? "none" : "block";
};

  createdSelected.onclick = function (e) {
    e.stopPropagation();

    const isOpen = createdOptions.style.display === "block";
    closeAllFilterDropdowns();
    createdOptions.style.display = isOpen ? "none" : "block";
};

 commentSelected.onclick = function (e) {
    e.stopPropagation();

    const isOpen = commentOptions.style.display === "block";
    closeAllFilterDropdowns();
    commentOptions.style.display = isOpen ? "none" : "block";
};

dualSelected.onclick = function (e) {
    e.stopPropagation();

    const isOpen = dualOptions.style.display === "block";
    closeAllFilterDropdowns();
    dualOptions.style.display = isOpen ? "none" : "block";
};
  
powerSelected.onclick = function (e) {
    e.stopPropagation();

    const isOpen = powerOptions.style.display === "block";
    closeAllFilterDropdowns();
    powerOptions.style.display = isOpen ? "none" : "block";
};

  statusSelected.onclick = function (e) {
    e.stopPropagation();

    const isOpen = statusOptions.style.display === "block";
    closeAllFilterDropdowns();
    statusOptions.style.display = isOpen ? "none" : "block";
};
  
  
  initFilterDropdown(
    "balance-option",
    "balance",
    balanceSelectedText,
    balanceOptions
);

  initFilterDropdown(
    "responsible-option",
    "responsible",
    responsibleSelectedText,
    responsibleOptions
);

initFilterDropdown(
    "updated-option",
    "updated",
    updatedSelectedText,
    updatedOptions
);

initFilterDropdown(
    "created-option",
    "created",
    createdSelectedText,
    createdOptions
);

initFilterDropdown(
    "comment-option",
    "comment",
    commentSelectedText,
    commentOptions
);

initFilterDropdown(
    "dual-option",
    "dual",
    dualSelectedText,
    dualOptions
);

initFilterDropdown(
    "power-option",
    "power",
    powerSelectedText,
    powerOptions
);

 initFilterDropdown(
"status-option",
"status",
statusSelectedText,
statusOptions
);

    cancelFilterBtn.onclick = function () {

    Object.assign(filterState, appliedFilterState);

    setFilterDropdown(
        "balance-option",
        filterState.balance,
        balanceSelectedText
    );

    setFilterDropdown(
        "responsible-option",
        filterState.responsible,
        responsibleSelectedText
    );

    setFilterDropdown(
        "created-option",
        filterState.created,
        createdSelectedText
    );

    setFilterDropdown(
        "updated-option",
        filterState.updated,
        updatedSelectedText
    );

    setFilterDropdown(
        "comment-option",
        filterState.comment,
        commentSelectedText
    );

    setFilterDropdown(
        "dual-option",
        filterState.dual,
        dualSelectedText
    );

    setFilterDropdown(
        "power-option",
        filterState.power,
        powerSelectedText
    );

      setFilterDropdown(
    "status-option",
    filterState.status,
    statusSelectedText
);
      

    updateFilterCount();
filterMenu.style.display = "none";
};

applyFilterBtn.onclick = function () {
    appliedFilterState = { ...filterState };
    updateFilterCount();
    filterMenu.style.display = "none";
    refreshSearchResults();
};

clearFilterBtn.onclick = function () {
    Object.keys(filterState).forEach(key => {
        filterState[key] = "none";
    });
    setFilterDropdown(
        "balance-option",
        "none",
        balanceSelectedText
    );
    setFilterDropdown(
        "responsible-option",
        "none",
        responsibleSelectedText
    );
    setFilterDropdown(
        "created-option",
        "none",
        createdSelectedText
    );
    setFilterDropdown(
        "updated-option",
        "none",
        updatedSelectedText
    );
    setFilterDropdown(
        "comment-option",
        "none",
        commentSelectedText
    );
    setFilterDropdown(
        "dual-option",
        "none",
        dualSelectedText
    );
    setFilterDropdown(
        "power-option",
        "none",
        powerSelectedText
    );

  setFilterDropdown(
    "status-option",
    "none",
    statusSelectedText
);
  
  updateFilterCount();
};
  
   document.addEventListener("click", function (e) {
    if (
        !filterMenu.contains(e.target) &&
        !filterBtn.contains(e.target)
    ) {
        balanceOptions.style.display = "none";
        responsibleOptions.style.display = "none";
        updatedOptions.style.display = "none";
        createdOptions.style.display = "none";
        commentOptions.style.display = "none";
        dualOptions.style.display = "none";
        powerOptions.style.display = "none";
      statusOptions.style.display = "none";
      filterMenu.style.display = "none";
    }
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

// 1. Telegram Bot Sozlamalari (Orqa fonda 0 xarajat va bepul limit bilan rasmlarni saqlash uchun)
const TELEGRAM_BOT_TOKEN = "8992286638:AAFPqW8OuFnBe-u6WZqqxiL1h3nhlIz48Qg"; // Bot tokeningizni shu yerga yozasiz
const TELEGRAM_CHAT_ID = "-1003934340914"; // Maxfiy kanal yoki guruh IDsini yozasiz
const TELEGRAM_ARCHIVE_CHAT_ID = "-1003885366930";
const TELEGRAM_DELETED_CHAT_ID = "-1004441090522";

async function deleteTelegramMessages(messageIds){
if(!messageIds || !messageIds.length) return;
for(const messageId of messageIds){
try{
await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_ARCHIVE_CHAT_ID,
message_id: messageId
})
}
);
}catch(err){
console.error(
"Telegram delete error:",
err
);
}
}
}

async function getTelegramFileUrl(fileId){
try{
const response = await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
);
const result = await response.json();
if(!result.ok){
return null;
}
return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${result.result.file_path}`;
}catch(err){
console.error(err);
return null;
}
}

let currentUploadedImageUrl = ""; // Telegramdan kelgan rasm linkini vaqtincha saqlash uchun
let editingElementId = null; // Tahrirlash rejimi uchun element IDsi
let originalElementData = null;
let returnToElementPanel = false;
let previewState = {
    active: false,
    mode: null,          // "create" | "edit"
    editingElementId: null,
    mapCenter: null,
    mapZoom: null
};

// 2. Global Element Kiritish Oynasini Boshqarish Elementlari
const elementManagePanel = document.getElementById('element-manage-panel');
const elementMainForm = document.getElementById('element-main-form');
const inputLatitude = document.getElementById('input-latitude');
const inputLongitude = document.getElementById('input-longitude');
const showOnMapBtn =
document.getElementById("show-on-map-btn");
const returnElementBtn =
document.getElementById("return-element-btn");

if(showOnMapBtn){
showOnMapBtn.addEventListener("click",function(e){

  if(listModal){
    listModal.style.display = "none";
}
document.getElementById("list-container").style.display = "none";
  
e.preventDefault();
previewState.active = true;
previewState.mode =
editingElementId ? "edit" : "create";
previewState.editingElementId =
editingElementId;
elementManagePanel.classList.add("hidden");

// Preview Mode
document.getElementById("panel").style.display = "none";
if(listModal){
    listModal.style.display = "none";
}
const locateBtn = document.getElementById("locate-btn");
if(locateBtn){
    locateBtn.style.display = "none";
}
const menuBtn = document.getElementById("menu-btn");
if(menuBtn){
    menuBtn.style.display = "none";
}
  
if(returnElementBtn){
    returnElementBtn.style.display="block";
}
const lat=parseFloat(inputLatitude.value);
const lng=parseFloat(inputLongitude.value);
if(!isNaN(lat) && !isNaN(lng)){
    if(selectedMarker){
        map.removeLayer(selectedMarker);
    }
    selectedMarker = L.marker([lat,lng]).addTo(map);
    map.setView([lat,lng],18);
}
map.invalidateSize();
});
}

if(returnElementBtn){
returnElementBtn.addEventListener("click",function(){
    returnElementBtn.style.display = "none";
 document.getElementById("panel").style.display = "";
    const locateBtn = document.getElementById("locate-btn");
    if(locateBtn){
        locateBtn.style.display = "";
    }
    const menuBtn = document.getElementById("menu-btn");
    if(menuBtn){
        menuBtn.style.display = "";
    }
    elementManagePanel.classList.remove("hidden");
});
}

const inputElementName = document.getElementById('input-element-name');
const inputElementAddress = document.getElementById('input-element-address');

const inputPowerSelect =
document.getElementById("input-power-select");
const customPowerBox =
document.getElementById("custom-power-box");
const inputCustomPower =
document.getElementById("input-custom-power");

//const inputElementPhone = document.getElementById('input-element-phone');
const inputResponsiblePerson =
document.getElementById('input-responsible-person');
const inputResponsiblePhone =
document.getElementById('input-responsible-phone');
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

// Mahalla biriktirish uchun
const btnOpenMahallaPanel =
document.getElementById("btn-open-mahalla-panel");
const mahallaPanel =
document.getElementById("mahalla-panel");
const closeMahallaPanel =
document.getElementById("close-mahalla-panel");
const cancelMahallaPanel =
document.getElementById("cancel-mahalla-panel");


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

const multiSourceToggle = document.getElementById("input-multi-source-toggle");
const sourceModeText = document.getElementById("source-mode-text");
const primaryFolderContainer = document.getElementById("primary-folder-container");

multiSourceToggle.addEventListener("change", function () {

    if (this.checked) {
        sourceModeText.textContent = "Ko'p manbali";
        sourceModeText.style.color = "#ff9800";
        primaryFolderContainer.style.display = "block";
    } else {
        sourceModeText.textContent = "Oddiy bir";
        sourceModeText.style.color = "#00c853";
        primaryFolderContainer.style.display = "none";
    }

});
  
}

function updatePowerInput() {
    if (!inputPowerSelect) return;
    if (inputPowerSelect.value === "other") {
        customPowerBox.style.display = "block";
    } else {
        customPowerBox.style.display = "none";
        inputCustomPower.value = "";
    }
}
if (inputPowerSelect) {
    inputPowerSelect.addEventListener("change", updatePowerInput);
}

if (inputCustomPower) {
    inputCustomPower.addEventListener("wheel", function(e) {
        e.preventDefault();
    }, { passive: false });
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
// 6. Rasm yuklash va uni orqa fonda xarajatsiz Telegram Botga yuborish mantiqi

let selectedFiles=[];
let mainImageIndex = 0;
let existingImages=[];
let uploadedTelegramImages=[];

function renderMultiImagePreview(){
const previewContainer=document.getElementById('multi-image-preview');
if(!previewContainer)return;
previewContainer.innerHTML='';
existingImages.forEach((img,index)=>{
const box=document.createElement('div');
box.className='multi-image-box';
// box.innerHTML=`<img src="${img.url}"> 
box.innerHTML=`

<img src="${img.url}"
style="width:100%;height:100%;object-fit:cover;">

style="width:100%;height:100%;object-fit:cover;">
<div class="main-image-badge">
${mainImageIndex===index ? '⭐ Asosiy' : ''}
</div>
<button type="button"
class="set-main-image"
data-index="${index}">
${mainImageIndex===index ? '⭐' : '☆'}
</button>
<button type="button"
class="existing-image-remove"
data-index="${index}">
×
</button>
`;
previewContainer.appendChild(box);
});
selectedFiles.forEach((file,index)=>{
const reader=new FileReader();
reader.onload=function(e){
const box=document.createElement('div');
box.className='multi-image-box';
box.innerHTML=`
<img src="${e.target.result}">
<div class="main-image-badge">
${mainImageIndex === (existingImages.length + index)
? '⭐ Asosiy' : ''}
</div>
<button
type="button"
class="set-main-image"
data-index="${existingImages.length + index}">
${mainImageIndex === (existingImages.length + index)
? '⭐'
: '☆'}
</button>
<button
type="button"
class="multi-image-remove"
data-index="${index}">
×
</button>
`;
  
previewContainer.appendChild(box);
};
reader.readAsDataURL(file);
});
previewContainer.onclick=function(e){
  if(e.target.classList.contains('set-main-image')){
mainImageIndex =
parseInt(e.target.dataset.index);
document
.querySelectorAll('.main-image-badge')
.forEach(x => x.innerHTML = '');
document
.querySelectorAll('.set-main-image')
.forEach(x => x.innerHTML = '☆');
const currentStar = e.target;
currentStar.innerHTML = '⭐';
const badge =
currentStar.parentElement
.querySelector('.main-image-badge');
if(badge){
badge.innerHTML = '⭐ Asosiy';
}
return;
}
if(e.target.classList.contains('existing-image-remove')){
const index=parseInt(e.target.dataset.index);
existingImages.splice(index,1);
renderMultiImagePreview();
imageStatusText.innerText=
`${existingImages.length + selectedFiles.length} ta rasm`;
return;
}
if(e.target.classList.contains('multi-image-remove')){
const index=parseInt(e.target.dataset.index);
selectedFiles.splice(index,1);
renderMultiImagePreview();
imageStatusText.innerText=
`${existingImages.length + selectedFiles.length} ta rasm`;
return;
}
};
}
if(elementImageInput){
elementImageInput.setAttribute('multiple','multiple');
elementImageInput.addEventListener('change',function(e){
const files=Array.from(e.target.files);
  if(
existingImages.length +
selectedFiles.length +
files.length > 5
){
alert(
"⚠️ Maksimal 5 ta rasm yuklash mumkin!"
);
return;
}
if(!files.length)return;
files.forEach(file=>{
if(file.type.startsWith('image/')){
selectedFiles.push(file);
}
});
imageStatusText.innerText=
`+ Rasm qo'shish (${selectedFiles.length})`;
imageStatusText.style.color="#34C759";
renderMultiImagePreview();
this.value="";
});
}
if(removeImageBtn){
removeImageBtn.addEventListener('click',function(e){
e.preventDefault();
selectedFiles=[];
existingImages=[];
uploadedTelegramImages=[];
renderMultiImagePreview();
currentUploadedImageUrl="";
elementImagePreview.src="";
elementImagePreview.classList.add('hidden');
removeImageBtn.classList.add('hidden');
imageStatusText.innerText="Rasm";
imageStatusText.style.color="#88a0b0";
elementImageInput.value="";
});
}

// =====================================
// TELEGRAM UCHUN PAPKA YO'LINI YIG'ISH
// =====================================
function getFolderPath(folderId){
    const path = [];
    let currentId = folderId;
    while(
        currentId &&
        currentFolders[currentId] &&
        currentId !== 'root'
    ){
        path.unshift(currentFolders[currentId].name);
        currentId = currentFolders[currentId].parentId;
    }
    return path.join(' / ');
}

function formatDate(timestamp){
if(!timestamp) return "-";
const d = new Date(timestamp);
const day =
String(d.getDate()).padStart(2,"0");
const month =
String(d.getMonth()+1).padStart(2,"0");
const year =
d.getFullYear();
const hour =
String(d.getHours()).padStart(2,"0");
const minute =
String(d.getMinutes()).padStart(2,"0");
const second =
String(d.getSeconds()).padStart(2,"0");
return `${day}.${month}.${year}, ${hour}:${minute}:${second}`;
}

// 7. Element Formasi uchun daraxtsimon Multiselect (Many-to-Many fiderlar tanlash) dropdown chizish
function renderElementTreeDropdown() {
    const dropdownContainer = document.getElementById('element-parent-folder-tree');
    if (!dropdownContainer) return;

    dropdownContainer.innerHTML = "";
    const selectedFoldersInput = document.getElementById('element-selected-folders');

function refreshPrimaryFolderList() {
    const box = document.getElementById("primary-folder-container");
    if (!box) return;
    const isMulti =
        document.getElementById("input-multi-source-toggle").checked;
    if (!isMulti) {
        box.innerHTML = "";
        return;
    }
    const selected =
        selectedFoldersInput.value
            ? selectedFoldersInput.value.split(",").filter(Boolean)
            : [];
    if (selected.length === 0) {
        box.innerHTML = "";
        return;
    }
    let html = `
        <div style="margin:10px 0 6px;font-weight:bold;color:#fff;">
            Asosiy ta'minot manbai
        </div>
    `;
    selected.forEach((id,index)=>{
        const folder=currentFolders[id];
        if(!folder) return;
        html += `
        <label style="
            display:flex;
            align-items:center;
            gap:8px;
            margin:6px 0;
            cursor:pointer;
            color:white;
        ">
            <input
                type="radio"
                name="primary-folder"
                value="${id}"
                ${index===0 ? "checked":""}
            >
            <i class="fas fa-folder"
               style="color:${folder.color};"></i>

            ${folder.name}
        </label>
        `;
    });
    box.innerHTML = html;
}
  
    // Avvaldan tanlangan fiderlar massivi (Tahrirlash rejimi uchun)
    let selectedArray = selectedFoldersInput.value ? selectedFoldersInput.value.split(',') : [];

    function buildNode(parentId, level, targetBox) {
        const folders = Object.keys(currentFolders).filter(id => currentFolders[id].parentId === parentId);
        
        folders.forEach(id => {
            const folder = currentFolders[id];
            const isChecked = selectedArray.includes(id) ? "checked" : "";
            const hasSubFolders = Object.keys(currentFolders).some(childId => currentFolders[childId].parentId === id);
            
            // Har bir element va uning bolalari uchun umumiy wrapper quti
            const nodeWrapper = document.createElement('div');
            nodeWrapper.style.cssText = "margin: 4px 0; width: 100%; display: block;";

            // Qator dizayni
            const row = document.createElement('div');
            row.style.cssText = `display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 6px; transition: background 0.2s;`;
            row.style.paddingLeft = `${level * 12}px`; // Ichkariga surilish masofasi
            row.style.background = selectedArray.includes(id) ? "rgba(0,122,255,0.15)" : "transparent";

            // Ochilib yopilish belgisi dynamic yaratiladi
           const toggleSign = hasSubFolders
    ? `<button type="button"
        class="elem-tree-toggle"
        style="
        width:20px;
        height:20px;
        display:flex;
        align-items:center;
        justify-content:center;
        color:#88a0b0;
        font-weight:bold;
        cursor:pointer;
        background:rgba(255,255,255,0.07);
        border:none;
        border-radius:4px;
        font-size:13px;
        user-select:none;
        padding:0;
        ">
        +
       </button>`
    : `<span style="width: 20px; text-align: center; color: #4b6575; font-size: 12px;">•</span>`;

            row.innerHTML = `
                ${toggleSign}
                <input type="checkbox" value="${id}" ${isChecked} class="element-folder-checkbox" style="width:18px; height:18px; cursor:pointer; margin: 0; flex-shrink: 0;">
                <i class="fas fa-folder" style="color: ${folder.color}; font-size:15px; flex-shrink: 0;"></i>
                <span style="font-size:14px; color:white; cursor:pointer; user-select:none; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex-grow: 1;">${folder.name}</span>
            `;

            // Checkbox o'zgarganda input elementga yozish mantiqi
            const checkbox = row.querySelector('.element-folder-checkbox');
            checkbox.addEventListener('change', function() {
              
                let currentSelected = selectedFoldersInput.value ? selectedFoldersInput.value.split(',') : [];
                
              if (this.checked) {

    // Oddiy bir rejimi bo'lsa faqat bitta papka tanlanadi
    const isMultiSource = document.getElementById("input-multi-source-toggle").checked;

if (!isMultiSource) {
    
        document
            .querySelectorAll("#element-parent-folder-tree .element-folder-checkbox")
            .forEach(cb => {
                if (cb !== this) {
                    cb.checked = false;
                    const r = cb.closest(".tree-node-row");
                    if (r) {
                        r.style.background = "transparent";
                    }
                }
            });
        currentSelected = [];
    }
    if (!currentSelected.includes(this.value)) {
        currentSelected.push(this.value);
    }
    row.style.background = "rgba(0,122,255,0.15)";
} else {
                    currentSelected = currentSelected.filter(v => v !== this.value);
                    row.style.background = "transparent";
                }
                selectedFoldersInput.value = currentSelected.filter(Boolean).join(',');
              refreshPrimaryFolderList();
            });

            // Matn (Guruh nomi) bosilganda ham checkbox belgilansin
            row.querySelector('span').addEventListener('click', () => {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            });

            nodeWrapper.appendChild(row);

            // Agar ichki guruhlar bo'lsa, ularni zichlab yashirin qutiga (childBox) solamiz
            if (hasSubFolders) {
                const childBox = document.createElement('div');
                childBox.className = "tree-child-container";
                childBox.style.cssText = "display: none; border-left: 1px dashed rgba(255,255,255,0.12); margin-top: 2px;";
                childBox.style.marginLeft = `${(level * 16) + 10}px`; // Chiziq to'g'ri tushishi uchun surish
                
                nodeWrapper.appendChild(childBox);

                // Rekursiya: Bolalarini o'zidan bitta katta level bilan yangi childBox ichiga soladi
                buildNode(id, level + 1, childBox);

                // [+] yoki [-] bosilganda ochilish va yopilish hodisasi
                const toggleBtn = row.querySelector('.elem-tree-toggle');
                if (toggleBtn) {
                   toggleBtn.addEventListener('click', (event) => {

    event.preventDefault();
    event.stopPropagation();

    if (childBox.style.display === "none") {
        childBox.style.display = "block";
        toggleBtn.innerText = "-";
        toggleBtn.style.background = "rgba(0,122,255,0.2)";
        toggleBtn.style.color = "#007AFF";
    } else {
        childBox.style.display = "none";
        toggleBtn.innerText = "+";
        toggleBtn.style.background = "rgba(255,255,255,0.07)";
        toggleBtn.style.color = "#88a0b0";
    }
});
                }
            }

            targetBox.appendChild(nodeWrapper);
        });
    }

    // Eng yuqori (Bosh guruh - root) elementlardan daraxtni yopiq holda yaratishni boshlaymiz
    buildNode('root', 0, dropdownContainer);
  refreshPrimaryFolderList();
}

// 8. Elementni Firebase Realtime Database'ga Saqlash va Tahrirlash (Many-to-Many tizimda)
if (elementMainForm) {
    elementMainForm.addEventListener('submit', async function(e) {
        e.preventDefault();

if(isSaving){
return;
}
isSaving = true;
showSaveLoader(
10,
"Ma'lumotlar tekshirilmoqda..."
);
      
        const selectedFolders = document.getElementById('element-selected-folders').value;
        if (!selectedFolders){
hideSaveLoader();
isSaving = false;
return showToast(
"Kamida bitta fiderni (guruh) belgilang!"
);
}

        const folderIdsArray = selectedFolders.split(',').filter(Boolean);

uploadedTelegramImages=[];
if(selectedFiles.length > 10){
hideSaveLoader();
isSaving = false;
showToast(
"10 tadan ortiq rasm yuborib bo'lmaydi!"
);
return;
}
      
const primaryFolderId =
document.querySelector('input[name="primary-folder"]:checked')?.value
|| folderIdsArray[0];

const folderPath =
getFolderPath(primaryFolderId);

const dualText =
folderIdsArray.length > 1
? "\n🔀 Qo'shimcha ta'minot mavjud"
: "";
      
//const folderPath = selectedFolders;

      const createdDate =
formatDate(
originalElementData?.createdAt ||
Date.now()
);
const updatedDate =
formatDate(Date.now());
const updatedBy = "Admin";
      
      const tpTag =
inputElementName.value.replace(/\s+/g,'');

const primaryFolderPath =
getFolderPath(primaryFolderId);

const additionalFolderPaths =
folderIdsArray
.filter(id => id !== primaryFolderId)
.map(id => `📂 ${getFolderPath(id)}`)
.join('\n\n');

const folderSection =
additionalFolderPaths
? `📂 Asosiy ta'minot

${primaryFolderPath}

🔀 Qo'shimcha ta'minotlar

${additionalFolderPaths}`
: `📂 ${primaryFolderPath}`;
      
const caption =
`⚡ HETK Monitoring

📍 ${inputElementName.value}     ⚡ Quvvati: ${inputPowerSelect.value === "other"
? inputCustomPower.value
: inputPowerSelect.value} kVA

${inputBalanceToggle.checked ? '🔴 XUSUSIY' : '🔵 ETK'}

${folderSection}

📍 Manzil:
${inputElementAddress.value || "-"}

📌 Kenglik (Latitude): ${inputLatitude.value}

📌 Uzunlik (Longitude): ${inputLongitude.value}

🚗 Navigatsiya:
https://maps.google.com/?q=${inputLatitude.value},${inputLongitude.value}

🕒 Yaratilgan:
${createdDate}

✏️ Oxirgi tahrir:
${updatedDate}

👤 Tahrirlagan:
${updatedBy}

👤 Javobgar shaxs:
${inputResponsiblePerson.value || "-"}

📱 Javobgar telefon:
${inputResponsiblePhone.value || "-"}

${inputBalanceToggle.checked ? `

🏢 Korxona:
${inputOwnerFirm.value || "-"}

👤 Korxona vakili:
${inputOwnerName.value || "-"}

☎️ Korxona telefoni:
${inputOwnerPhone.value || "-"}

🔢 Hisoblagich:
${inputMeterNumber.value || "-"}
` : ""}

🔎 Qidiruv teglari

#${tpTag}
#${inputBalanceToggle.checked ? 'XUSUSIY' : 'ETK'}`;
      
let albumMessageIds = [];
let mainTelegramMessageId = null;      
const media = [];
//return;
for(const file of selectedFiles){
const formData = new FormData();
formData.append(
"chat_id",
TELEGRAM_ARCHIVE_CHAT_ID
);
formData.append("photo", file);
const sendResponse = await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
{
method:"POST",
body:formData
}
);
const sendResult =
await sendResponse.json();
if(!sendResult.ok){
showToast("Telegramga rasm yuborishda xatolik!");
return;
}
const photoArray =
sendResult.result.photo;
const fileId =
photoArray[photoArray.length-1].file_id;
const messageId =
sendResult.result.message_id;
  
media.push({
type:"photo",
media:fileId
});
const imageUrl =
await getTelegramFileUrl(fileId);
  
uploadedTelegramImages.push({
fileId:fileId,
messageId:messageId,
url:imageUrl
});
}
   
     if(media.length && !editingElementId) {
media[0].caption = caption
const albumResponse = await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_ARCHIVE_CHAT_ID,
media: media
})
}
);
const albumResult =
await albumResponse.json();

 albumMessageIds =
albumResult.result
? albumResult.result.map(x => x.message_id)
: albumResult.map(x => x.message_id);
  archiveAlbumMessageIds = albumMessageIds;
console.log(albumResult);
console.log("ALBUM OK");
}
       for(const img of uploadedTelegramImages){
if(img.messageId){
try{
await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_ARCHIVE_CHAT_ID,
message_id: img.messageId
})
}
);
}catch(err){
console.error(
"Delete temp photo error:",
err
);
}
}
}


let mainImage = null;
const allImages = [
...existingImages,
...uploadedTelegramImages
];

let tpPageLink = "";

const mainCaption =
`⚡️ HETK Monitoring
📍 ${inputElementName.value}   ⚡ Quvvati: ${inputPowerSelect.value === "other"
? inputCustomPower.value
: inputPowerSelect.value} kVA
                                           
${inputBalanceToggle.checked ? '🔴 XUSUSIY' : '🔵 ETK'}
📂 ${folderPath}${dualText}
📍 Manzil:
${inputElementAddress.value || "-"}
🚗 Navigatsiya:
https://maps.google.com/?q=${inputLatitude.value},${inputLongitude.value}
🕒 Yaratilgan:
${createdDate}
✏️ Oxirgi tahrir:
${updatedDate}
👤 Tahrirlagan shaxs:
Admin
🔎 Qidiruv teglari

#${tpTag}
#${inputBalanceToggle.checked ? 'XUSUSIY' : 'ETK'}

📖 Qo'shimcha ma'lumot mavjud`;
      
 mainImage = allImages[mainImageIndex];
if(
mainImage &&
mainImage.fileId &&
!editingElementId
){

const mainResponse = await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_CHAT_ID,
photo: mainImage.fileId,
caption: mainCaption
})
}
);

const mainResult = await mainResponse.json();
if(mainResult.ok){
mainTelegramMessageId =
mainResult.result.message_id;
console.log("MAIN POST OK");
}else{
console.error(mainResult);
}
}

    
        // Saqlanadigan obyekt strukturasi
        const elementData = {
            name: inputElementName.value,
            lat: inputLatitude.value,
            lng: inputLongitude.value,
            address: inputElementAddress.value,
 
power:
inputPowerSelect.value === "other"
? Number(inputCustomPower.value)
: Number(inputPowerSelect.value),
          
           responsiblePerson:
inputResponsiblePerson.value,

responsiblePhone:
inputResponsiblePhone.value,

          status:
document.querySelector(
'input[name="input-status"]:checked'
)?.value || "excellent",
          
            note: inputElementNote.value,
          images: [...existingImages, ...uploadedTelegramImages],
          mainImageIndex: mainImageIndex,
          
  telegramMainMessageId:
mainTelegramMessageId ||
originalElementData?.telegramMainMessageId,

telegramArchiveMessageIds:
albumMessageIds.length
? albumMessageIds
: originalElementData?.telegramArchiveMessageIds,
          
            isPrivate: inputBalanceToggle.checked,
          
            // Many-to-Many: fiderlarni obyekt ichida saqlash (qidirish oson bo'lishi uchun)
           folders: folderIdsArray.reduce((acc, id) => ({ ...acc, [id]: true }), {}),

primaryFolderId:
document.querySelector('input[name="primary-folder"]:checked')?.value
|| folderIdsArray[0],

// Eski kodlar buzilmasligi uchun birinchi fiderni standart folderId ga ham yozib qo'yamiz
folderId: folderIdsArray[0],
            
            // Xususiy fieldlar agar o'chiq bo'lsa bo'sh ketadi
            ownerFirm: inputBalanceToggle.checked ? inputOwnerFirm.value : "",
            ownerName: inputBalanceToggle.checked ? inputOwnerName.value : "",
            ownerPhone: inputBalanceToggle.checked ? inputOwnerPhone.value : "",
            meterNumber: inputBalanceToggle.checked ? inputMeterNumber.value : "",
       
          createdAt:
originalElementData?.createdAt ||
Date.now(),
          updatedAt: Date.now(), updatedBy: updatedBy,
        };
      
let needTelegramRepost = false;
     if(editingElementId && originalElementData){ 
if(
originalElementData.name !== elementData.name ||
originalElementData.address !== elementData.address ||
originalElementData.lat !== elementData.lat ||
originalElementData.lng !== elementData.lng ||
originalElementData.phone !== elementData.phone ||
originalElementData.folderId !== elementData.folderId ||
originalElementData.mainImageIndex !== elementData.mainImageIndex ||

originalElementData.isPrivate !== elementData.isPrivate ||

originalElementData.responsiblePerson !== elementData.responsiblePerson ||
originalElementData.responsiblePhone !== elementData.responsiblePhone ||

originalElementData.ownerFirm !== elementData.ownerFirm ||
originalElementData.ownerName !== elementData.ownerName ||
originalElementData.ownerPhone !== elementData.ownerPhone ||
originalElementData.meterNumber !== elementData.meterNumber ||

originalElementData.note !== elementData.note
){
needTelegramRepost = true;
}

}

let needArchiveCaptionEdit = false;
if(editingElementId && originalElementData){
if(
originalElementData.name !== elementData.name ||
originalElementData.address !== elementData.address ||
originalElementData.phone !== elementData.phone ||
originalElementData.power !== elementData.power ||
originalElementData.note !== elementData.note ||
originalElementData.power !== elementData.power ||
originalElementData.folderId !== elementData.folderId ||
originalElementData.lat !== elementData.lat ||
originalElementData.lng !== elementData.lng ||

originalElementData.isPrivate !== elementData.isPrivate ||

originalElementData.responsiblePerson !== elementData.responsiblePerson ||
originalElementData.responsiblePhone !== elementData.responsiblePhone ||

originalElementData.ownerFirm !== elementData.ownerFirm ||
originalElementData.ownerName !== elementData.ownerName ||
originalElementData.ownerPhone !== elementData.ownerPhone ||
originalElementData.meterNumber !== elementData.meterNumber
){
needArchiveCaptionEdit = true;
}
}      
let needArchiveRebuild = false;
if(
editingElementId &&
originalElementData &&
(
selectedFiles.length > 0 ||
existingImages.length !== (originalElementData.images || []).length
)
){
needArchiveRebuild = true;
}
         
       if (!editingElementId) {
          
    // Yangi element yaratish holati
    elementData.createdAt = Date.now();
   const newRef =
database.ref('TPs').push();
const tpId = newRef.key;
       elementData.tpId = tpId;
         
newRef.set(elementData).then(() => {
        showSaveLoader(100,"Yakunlanmoqda...");
        setTimeout(()=>{
            hideSaveLoader();
            isSaving = false;
            showToast("Yangi element muvaffaqiyatli saqlandi!");
            elementManagePanel.classList.add('hidden');
            resetToUserLocation();

            if(document.getElementById('tab-items').classList.contains('active')){
                loadFilteredPoints();
            }
        },500);
    });
} else {
         
   // Mavjud elementni yangilash holati
 /* if(
    needTelegramRepost &&
    originalElementData &&
    originalElementData.telegramArchiveMessageIds
){
    await deleteTelegramMessages(
        originalElementData.telegramArchiveMessageIds
    );
} */

         
console.log(elementData);

if(
needArchiveCaptionEdit &&
originalElementData?.telegramArchiveMessageIds?.length
){
try{
const editResponse = await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_ARCHIVE_CHAT_ID,
message_id:
originalElementData.telegramArchiveMessageIds[0],
caption: caption
})
}
);
const editResult =
await editResponse.json();
console.log(
"ARCHIVE EDIT RESULT:",
editResult
);
}catch(err){
console.error(
"ARCHIVE EDIT ERROR:",
err
);
}
}

if(
needArchiveCaptionEdit &&
originalElementData?.telegramMainMessageId
){
try{
const mainEditResponse = await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_CHAT_ID,
message_id:
originalElementData.telegramMainMessageId,
caption: mainCaption
})
}
);
const mainEditResult =
await mainEditResponse.json();
console.log(
"MAIN EDIT RESULT:",
mainEditResult
);
}catch(err){
console.error(
"MAIN EDIT ERROR:",
err
);
}
}

if(
needTelegramRepost &&
originalElementData?.telegramMainMessageId
){
const mainImage =
elementData.images[
elementData.mainImageIndex
];
if(mainImage?.fileId){
try{
const mediaResponse = await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageMedia`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_CHAT_ID,
message_id:
originalElementData.telegramMainMessageId,
media:{
type:"photo",
media: mainImage.fileId,
caption: mainCaption
}
})
}
);
const mediaResult =
await mediaResponse.json();
console.log(
"MAIN MEDIA RESULT:",
mediaResult
);
}catch(err){
console.error(
"MAIN MEDIA ERROR:",
err
);
}
}
}
         
         if(
needArchiveRebuild &&
originalElementData?.telegramArchiveMessageIds?.length
){
await deleteTelegramMessages(
originalElementData.telegramArchiveMessageIds
);

           const archiveMedia = [];
for(const img of elementData.images){
if(img.fileId){
archiveMedia.push({
type:"photo",
media:img.fileId
});
}
}
if(archiveMedia.length){
archiveMedia[0].caption = caption;
const rebuildResponse = await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_ARCHIVE_CHAT_ID,
media: archiveMedia
})
}
);
const rebuildResult =
await rebuildResponse.json();
  elementData.telegramArchiveMessageIds =
rebuildResult.result.map(
x => x.message_id
);
console.log(
"ARCHIVE REBUILD RESULT:",
rebuildResult
);
}

}
         
    database.ref('TPs/' + editingElementId).update(elementData).then(() => {
        showSaveLoader(100,"Yakunlanmoqda...");
        setTimeout(()=>{
            hideSaveLoader();
            isSaving = false;
            showToast("Element ma'lumotlari yangilandi!");
            console.log("UPDATE OK");

            elementManagePanel.classList.add('hidden');
            editingElementId = null;

            if(document.getElementById('tab-items').classList.contains('active')){
                loadFilteredPoints();
            }
        },500);
    });

}
    });
}


// Elementni o'chirish tugmasi mantiqi
if (deleteElementBtn) {
    deleteElementBtn.addEventListener('click', async function() {
       if (
editingElementId &&
confirm(
"⚠️ DIQQAT!\n\nMa'lumotlar 30 kun davomida arxivda saqlanadi.\n\nTiklash uchun administratorga murojaat qiling!.\n\nElement o'chirilsinmi?"
)
) {

  const folderIdsArray =
originalElementData.folders
? Object.keys(originalElementData.folders)
: [originalElementData.folderId];

const primaryFolderId =
originalElementData.primaryFolderId ||
originalElementData.folderId ||
folderIdsArray[0];

const primaryFolderPath =
getFolderPath(primaryFolderId);

const additionalFolderPaths =
folderIdsArray
.filter(id => id !== primaryFolderId)
.map(id => `📂 ${getFolderPath(id)}`)
.join("\n\n");

const folderSection =
additionalFolderPaths
? `📂 Asosiy ta'minot

${primaryFolderPath}

🔀 Qo'shimcha ta'minotlar

${additionalFolderPaths}`
: `📂 ${primaryFolderPath}`;
         
 const deletedCaption =
`❌ TP O'CHIRILDI

📍 ${originalElementData.name || "-"}    ⚡ Quvvati: ${originalElementData.power || "-"} kVA

${originalElementData.isPrivate ? "🔴 XUSUSIY" : "🔵 ETK"}

${folderSection}

📍 Manzil:
${originalElementData.address || "-"}

📌 Kenglik:
${originalElementData.lat || "-"}

📌 Uzunlik:
${originalElementData.lng || "-"}

👨‍🔧 Mas'ul shaxs:
${originalElementData.responsiblePerson || "-"}

📱 Mas'ul telefon:
${originalElementData.responsiblePhone || "-"}

${originalElementData.isPrivate ? `

🏢 Korxona:
${originalElementData.ownerFirm || "-"}

👤 Korxona vakili:
${originalElementData.ownerName || "-"}

☎️ Korxona telefoni:
${originalElementData.ownerPhone || "-"}

🔢 Hisoblagich:
${originalElementData.meterNumber || "-"}
` : ""}

📝 Izoh:
${originalElementData.note || "-"}

🕒 Yaratilgan:
${originalElementData.createdAt
? new Date(originalElementData.createdAt).toLocaleString("uz-UZ")
: "-"}

✏️ Oxirgi tahrir:
${originalElementData.updatedAt
? new Date(originalElementData.updatedAt).toLocaleString("uz-UZ")
: "-"}

🗑 O'chirilgan:
${new Date().toLocaleString("uz-UZ")}

🆔 Element ID:
${editingElementId}`;
    
const deletedMedia = [];
for(const img of originalElementData.images || []){
if(img.fileId){
deletedMedia.push({
type:"photo",
media: img.fileId
});
}
}
if(deletedMedia.length){
deletedMedia[0].caption = deletedCaption;
await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMediaGroup`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_DELETED_CHAT_ID,
media: deletedMedia
})
}
);
}else{
await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_DELETED_CHAT_ID,
text: deletedCaption
})
}
);
}

         if(originalElementData.telegramMainMessageId){
await fetch(
`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`,
{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
chat_id: TELEGRAM_CHAT_ID,
message_id:
originalElementData.telegramMainMessageId
})
}
);
}
if(
originalElementData.telegramArchiveMessageIds &&
originalElementData.telegramArchiveMessageIds.length
){
await deleteTelegramMessages(
originalElementData.telegramArchiveMessageIds
);
}
         
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
  selectedFiles=[];
  existingImages=[];
uploadedTelegramImages=[];

document.getElementById('multi-image-preview').innerHTML='';
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

// TP tegishli bo'lgan boshqa papkalarni tayyorlash
let otherFoldersHtml = "";
              const isMobile = window.innerWidth < 768;

const otherFoldersIndent = isMobile ? "22px" : "30px";
const otherFoldersFontSize = isMobile ? "12px" : "13px";
const otherFoldersGap = isMobile ? "2px" : "3px";
              
if (tp.folders) {
    Object.keys(tp.folders).forEach(otherFolderId => {
        // Hozir ochiq turgan papkani qayta ko'rsatmaymiz
        if (otherFolderId === folderId) return;
        const folder = currentFolders[otherFolderId];
        if (!folder) return;
        otherFoldersHtml += `
<div style="
    display:flex;
    align-items:flex-start;
    gap:6px;
    margin-top:${otherFoldersGap};
    margin-left:${otherFoldersIndent};
    font-size:${otherFoldersFontSize};
    color:${folder.color};
    line-height:1.35;
    max-width:100%;
">

    <span style="
        flex-shrink:0;
        margin-top:1px;
    ">
        ↳
    </span>

    <span style="
        flex:1;
        min-width:0;
        overflow-wrap:anywhere;
        word-break:break-word;
    ">
        ${getFolderPath(otherFolderId)}
    </span>

</div>
`;
    });
}
              
                tpRow.innerHTML = `
    <div style="
        display:flex;
        align-items:center;
        width:100%;
    ">
        <i class="fas fa-bolt"
           style="
                color:${iconColor};
                margin-right:8px;
                font-size:13px;
                flex-shrink:0;
           ">
        </i>

        <span style="
            flex:1;
            min-width:0;
            font-size:14px;
            color:#e0e0e0;
            white-space:nowrap;
            overflow:hidden;
            text-overflow:ellipsis;
        ">
            ${tp.name || "TP"}
        </span>

        <i class="fas fa-pencil-alt element-edit-pencil-icon"
           style="
                color:#88a0b0;
                font-size:12px;
                padding:4px;
                cursor:pointer;
                opacity:.6;
                flex-shrink:0;
           "
           onclick="event.stopPropagation(); openEditElement('${tpId}')">
        </i>
    </div>

   ${
    otherFoldersHtml
        ? `<div style="margin-top:4px;">
                ${otherFoldersHtml}
           </div>`
        : ""
}
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
   originalElementData = JSON.parse(JSON.stringify(tp));
      
        resetElementForm();
        editingElementId = tpId;
        document.getElementById('element-panel-title').innerText = "Редактировать местоположение";
        deleteElementBtn.classList.remove('hidden');

        // Ma'lumotlarni formaga yuklaymiz
        inputElementName.value = tp.name || "";
        inputLatitude.value = tp.lat;
        inputLongitude.value = tp.lng;
        inputElementAddress.value = tp.address || "";

// Quvvatni yuklash
const standardPowers = [
25,40,63,100,160,250,315,400,
630,1000,1250,1600,2000,2500
];
if (standardPowers.includes(Number(tp.power))) {
    inputPowerSelect.value = String(tp.power);
    customPowerBox.style.display = "none";
    inputCustomPower.value = "";
} else if (tp.power) {
    inputPowerSelect.value = "other";
    customPowerBox.style.display = "block";
    inputCustomPower.value = tp.power;
} else {
    inputPowerSelect.value = "250";
    customPowerBox.style.display = "none";
    inputCustomPower.value = "";
}
      
       inputResponsiblePerson.value =
tp.responsiblePerson || "";

inputResponsiblePhone.value =
tp.responsiblePhone || "";
        inputElementNote.value = tp.note || "";

// Texnik holatini yuklash
const status =
    tp.status || "excellent";

document.querySelector(
    'input[name="input-status"][value="' + status + '"]'
).checked = true;
      
        // Many-to-Many fiderlar ro'yxatini yuklash
        let folderIds = [];
        if (tp.folders) {
            folderIds = Object.keys(tp.folders);
        } else if (tp.folderId) {
            folderIds = [tp.folderId];
        }
        document.getElementById('element-selected-folders').value = folderIds.join(',');

const multiSourceToggle =
    document.getElementById("input-multi-source-toggle");

const sourceModeText =
    document.getElementById("source-mode-text");

const primaryFolderContainer =
    document.getElementById("primary-folder-container");

if (folderIds.length > 1) {
    multiSourceToggle.checked = true;
    sourceModeText.textContent = "Ko'p manbali";
    sourceModeText.style.color = "#ff9800";
    primaryFolderContainer.style.display = "block";
} else {
    multiSourceToggle.checked = false;
    sourceModeText.textContent = "Oddiy bir";
    sourceModeText.style.color = "#00c853";
    primaryFolderContainer.style.display = "none";
}
      
      // Rasm mavjudligini tekshirish 
      if(tp.images && tp.images.length){
existingImages = tp.images || [];
mainImageIndex =
tp.mainImageIndex || 0;
    
renderMultiImagePreview();
imageStatusText.innerText =
`${tp.images.length} ta rasm`;
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

// Element tanlangan papka ichidami?
function isPointInsideFolder(pointFolderId, selectedFolderId){
    if(selectedFolderId==="root") return true;
    let current = pointFolderId;
    while(current){
        if(current===selectedFolderId){
            return true;
        }
        const folder = currentFolders[current];
        if(!folder) break;
        current = folder.parentId;
    }
    return false;
}

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


// qidiruv tizim funksiyalari
function buildFolderTree(){
    const tree = {};
    Object.keys(currentFolders).forEach(folderId=>{
        const folder = currentFolders[folderId];
        tree[folderId]={
            id:folderId,
            name:folder.name,
            color:folder.color,
            parentId:folder.parentId,
            children:[],
            items:[]
        };
    });
    Object.values(tree).forEach(folder=>{
        if(
            folder.parentId &&
            folder.parentId!=="root" &&
            tree[folder.parentId]
        ){
            tree[folder.parentId]
                .children
                .push(folder);
        }
    });
    return tree;
}

function attachResultsToTree(tree, results){
    results.forEach(tp=>{
        const folderId =
            tp.primaryFolderId ||
            tp.folderId ||
            Object.keys(tp.folders || {})[0];
        if(tree[folderId]){
            tree[folderId].items.push(tp);
        }
    });
}

function renderSearchTree(tree){
    let html = "";
  const renderedTPs = new Set();
  
    function renderNode(node, level, treePrefix = "", isLast = true){
        const hasChildren = node.children.some(child =>
            child.items.length || child.children.length
        );
        if(node.items.length===0 && !hasChildren){
            return;
        }

        const countText =
            node.items.length > 0
                ? ` (${node.items.length})`
                : "";

        html += `
<div class="search-folder"
     data-folder-id="${node.id}"
     onclick="
selectFolder('${node.id}');
updateSearchHighlight();
"
     style="
        padding-left:${level*22}px;
        cursor:pointer;
        position:relative;
        margin:2px 0;
        border-radius:6px;
        padding-top:4px;
        padding-bottom:4px;
        padding-right:6px;
        background:${activeFolderId===node.id ? "rgba(0,122,255,.20)" : "transparent"};
        color:${activeFolderId===node.id ? "#4FC3FF" : (node.color || "#ffffff")};
">

${
level>0
? `<span style="
position:absolute;
left:${(level-1)*22+8}px;
top:-8px;
bottom:-8px;
border-left:1px dashed rgba(255,255,255,.25);
"></span>`
: ""
}

<span style="color:${node.color || '#ffffff'};">📁</span>
<span style="color:${activeFolderId===node.id ? '#4FC3FF' : (node.color || '#ffffff')};">
    ${node.name}${countText}
</span>
</div>
`;
        node.items.forEach(tp=>{
if (!tp.id) {
    tp.id = tp.tpId || tp.firebaseKey || "";
}
          const tpId = tp.id;
          tp.__index = tp;
if (renderedTPs.has(tpId)) {
    return;
}
renderedTPs.add(tpId);
          
           let otherFoldersHtml = "";

const isMobile = window.innerWidth < 768;
const otherFoldersIndent = isMobile ? "22px" : "30px";
const otherFoldersFontSize = isMobile ? "12px" : "13px";
const otherFoldersGap = isMobile ? "2px" : "3px";

if (tp.folders) {
    Object.keys(tp.folders).forEach(otherFolderId => {

        // Qidiruv natijasida chiqarilgan papkani takrorlamaymiz
        if (otherFolderId === node.id) return;

        const folder = currentFolders[otherFolderId];
        if (!folder) return;

        otherFoldersHtml += `
<div style="
    display:flex;
    align-items:flex-start;
    gap:6px;
    margin-top:${otherFoldersGap};
    margin-left:${otherFoldersIndent};
    font-size:${otherFoldersFontSize};
    color:${folder.color};
    line-height:1.35;
    max-width:100%;
">
    <span style="flex-shrink:0;margin-top:1px;">↳</span>

    <span style="
        flex:1;
        min-width:0;
        overflow-wrap:anywhere;
        word-break:break-word;
    ">
        ${getFolderPath(otherFolderId)}
    </span>
</div>`;
    });
}

html += `
<div class="search-item"
    data-id="${tp.id || ''}"
     data-folder-id="${node.id}"
    onclick="openSearchResult(this)"
     style="
        padding-left:${(level+1)*22}px;
        margin:2px 0;
        cursor:pointer;
">
  <div style="
display:flex;
justify-content:space-between;
align-items:center;
">

<div>
    <i class="fas fa-bolt"
       style="
           color:${tp.isPrivate ? '#ff4444' : '#1e88e5'};
           margin-right:6px;
           font-size:15px;
       ">
    </i>

    ${tp.name}
</div>

<div class="search-item-actions"
     style="
display:flex;
gap:10px;
font-size:15px;
opacity:0;
transition:.2s;
">

<i class="far fa-file-alt"
   title="Element kartasi"
   onclick="event.stopPropagation(); showElementModal();"
   style="cursor:pointer;">
</i>

<i class="fas fa-edit"
   title="Tahrirlash"
  onclick="event.stopPropagation();openEditElement('${tp.id}')"
   style="cursor:pointer;">
</i>

</div>

</div>

    ${
        otherFoldersHtml
            ? `<div style="margin-top:4px;">${otherFoldersHtml}</div>`
            : ""
    }
</div>`;
        });
        node.children.forEach((child,index)=>{
            const last = index === node.children.length - 1;
            const nextPrefix =
                treePrefix +
                (level===0 ? "" : (isLast ? "    " : "│   "));

            renderNode(
                child,
                level+1,
                nextPrefix,
                last
            );
        });
    }

    Object.values(tree)
        .filter(n => n.parentId === "root")
        .forEach(root => {
            if(root.items.length===0 && root.children.length===0){
                return;
            }
            renderNode(root,0);
        });
    return html;
}
let selectedSearchItem = null;
let currentTP = null;

window.openSearchResult = function(item){
    document.querySelectorAll(".search-item").forEach(el=>{
        el.classList.remove("selected");
    });
    item.classList.add("selected");
    selectedSearchItem = item;
    const id = item.dataset.id;
    currentTP = searchState.results.find(tp => tp.id === id) || null;
};

function updateSearchHighlight(){
    document.querySelectorAll(".search-folder").forEach(folder=>{
        const id = folder.dataset.folderId;
        if(id===activeFolderId){
            folder.style.background="rgba(0,122,255,.20)";
            folder.style.color="#4FC3FF";
        }else{
            folder.style.background="transparent";
            folder.style.color="#ffffff";
        }
    });

    const ids = getAllChildFolderIds(activeFolderId);
    ids.push(activeFolderId);
    document.querySelectorAll(".search-item").forEach(item=>{
        const folder = item.closest(".search-folder");
        if(!folder) return;
        const folderId = folder.dataset.folderId;
        if(ids.includes(folderId)){
            item.style.background="rgba(0,122,255,.10)";
        }else{
            item.style.background="transparent";
        }
    });
}

function isPointInSelectedFolder(tp) {
    if (activeFolderId === "root") {
        return true;
    }
    const allowedFolderIds = getAllChildFolderIds(activeFolderId);
    allowedFolderIds.push(activeFolderId);
    const tpFolders = tp.folders
        ? Object.keys(tp.folders)
        : (
            tp.primaryFolderId
                ? [tp.primaryFolderId]
                : (
                    tp.folderId
                        ? [tp.folderId]
                        : []
                )
        );
    return tpFolders.some(id => allowedFolderIds.includes(id));
}

// Natijalarni yangilash

function filterVisiblePoints(allTPs) {
    const text = searchState.text.trim().toLowerCase();
  
   const found = [];
  
    Object.entries(allTPs).forEach(([firebaseKey, tp]) => {
    tp.id = firebaseKey;


    if (!isPointInSelectedFolder(tp)) {
        return;
    }

    const q = text;
    let matched = false;

    switch (currentSearchType) {
        case "name":
            matched = (tp.name || "").toLowerCase().includes(q);
            break;

        case "address":
            matched = (tp.address || "").toLowerCase().includes(q);
            break;

        case "responsible":
            matched = (tp.responsiblePerson || "").toLowerCase().includes(q);
            break;

        case "note":
            matched = (tp.note || "").toLowerCase().includes(q);
            break;

        case "company":
            matched = (tp.ownerFirm || "").toLowerCase().includes(q);
            break;

        case "phone":
            matched = (tp.ownerPhone || "").toLowerCase().includes(q);
            break;

        case "owner":
            matched = (tp.ownerName || "").toLowerCase().includes(q);
            break;

        case "meter":
            matched = (tp.meterNumber || "").toLowerCase().includes(q);
            break;

        case "all":
            matched =
                (tp.name || "").toLowerCase().includes(q) ||
                (tp.address || "").toLowerCase().includes(q) ||
                (tp.responsiblePerson || "").toLowerCase().includes(q) ||
                (tp.note || "").toLowerCase().includes(q) ||
                (tp.ownerFirm || "").toLowerCase().includes(q) ||
                (tp.ownerPhone || "").toLowerCase().includes(q) ||
                (tp.ownerName || "").toLowerCase().includes(q) ||
                (tp.meterNumber || "").toLowerCase().includes(q);
            break;
    }

    if (text !== "" && !matched) {
        return;
    }

  found.push(tp); 
      });
    return found;
}


function refreshSearchResults(){
    searchState.folderId = activeFolderId;
    const resultsBox = document.getElementById("search-results");
    const foldersBox = document.getElementById("folders-section");
    const text = searchState.text.trim();
  
 const hasFilter =
    filterState.balance !== "none" ||
    filterState.created !== "none" ||
    filterState.updated !== "none" ||
    filterState.comment !== "none" ||
    filterState.dual !== "none" ||
    filterState.power !== "none" ||
    filterState.status !== "none";

  const isSearching =
    text !== "" || hasFilter;

 if (text === "" && !hasFilter) {
    resultsBox.style.display = "none";
    resultsBox.innerHTML = "";
   showFoldersTab();
    return;
}
  
    if(searchState.folderId==="root"){
        resultsBox.style.display="block";
        foldersBox.style.display="block";
        resultsBox.innerHTML=`
            <div class="search-info">
                ⚠ Qidiruvni boshlash uchun avval papkani tanlang.
            </div>
        `;
        return;
    }

    database.ref("TPs").once("value",(snapshot)=>{
        const allTPs = snapshot.val() || {};
        const found = [];
      
        const allowedFolderIds = getAllChildFolderIds(searchState.folderId);
        allowedFolderIds.push(searchState.folderId);
      Object.entries(allTPs).forEach(([firebaseKey, tp]) => {
    tp.id = firebaseKey;

          if (!isPointInSelectedFolder(tp)) {
    return;
}
         
          const q = text.toLowerCase();
let matched = false;
switch (currentSearchType) {
    case "name":
        matched = (tp.name || "").toLowerCase().includes(q);
        break;

    case "address":
        matched = (tp.address || "").toLowerCase().includes(q);
        break;

    case "responsible":
        matched = (tp.responsiblePerson || "").toLowerCase().includes(q);
        break;

    case "note":
        matched = (tp.note || "").toLowerCase().includes(q);
        break;

    case "company":
        matched = (tp.ownerFirm || "").toLowerCase().includes(q);
        break;

    case "phone":
        matched = (tp.ownerPhone || "").toLowerCase().includes(q);
        break;

    case "owner":
        matched = (tp.ownerName || "").toLowerCase().includes(q);
        break;

    case "meter":
        matched = (tp.meterNumber || "").toLowerCase().includes(q);
        break;

    case "all":
        matched =
            (tp.name || "").toLowerCase().includes(q) ||
            (tp.address || "").toLowerCase().includes(q) ||
            (tp.responsiblePerson || "").toLowerCase().includes(q) ||
            (tp.note || "").toLowerCase().includes(q) ||
            (tp.ownerFirm || "").toLowerCase().includes(q) ||
            (tp.ownerPhone || "").toLowerCase().includes(q) ||
            (tp.ownerName || "").toLowerCase().includes(q) ||
            (tp.meterNumber || "").toLowerCase().includes(q);
        break;
}

if (text !== "" && !matched) {
    return;
}

// Keyingi barcha filtrlar shu yerga ulanadi
          
// Balans filtri
if (filterState.balance !== "all") {
    if (filterState.balance === "etk" && tp.isPrivate) {
        return;
    }
    if (filterState.balance === "private" && !tp.isPrivate) {
        return;
    }
}

       // Yaratilgan sana filtri
if (filterState.created !== "none") {
    if (!tp.createdAt) {
        return;
    }
    const createdDate = new Date(tp.createdAt);
    const now = new Date();
    const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
    if (diffDays > Number(filterState.created)) {
        return;
    }
}   

// Oxirgi yangilangan filtri
if (filterState.updated !== "none") {
    if (!tp.updatedAt) {
        return;
    }

    const updatedDate = new Date(tp.updatedAt);
    const now = new Date();
    const diffDays = (now - updatedDate) / (1000 * 60 * 60 * 24);
    if (diffDays > Number(filterState.updated)) {
        return;
    }
}

// Quvvat filtri
if (filterState.power !== "none") {
    if (!tp.power) {
        return;
    }
    if (filterState.power === "other") {
        const standartPowers = [
            "25", "40", "63", "100", "160",
            "250", "315", "400", "630",
            "1000", "1250", "1600",
            "2000", "2500"
        ];
        if (standartPowers.includes(String(tp.power))) {
            return;
        }
    } else {
        if (String(tp.power) !== String(filterState.power)) {
            return;
        }
    }
}

// Texnik holati filtri
// Texnik holati filtri
if (filterState.status !== "none") {
    if ((tp.status || "") !== filterState.status) {
        return;
    }
}
        
// Ikki tomonlama ta'minlangan filtri
if (filterState.dual !== "none") {
    const folderCount = tp.folders
        ? Object.keys(tp.folders).length
        : (tp.folderId ? 1 : 0);
    if (filterState.dual === "yes" && folderCount < 2) {
        return;
    }
    if (filterState.dual === "no" && folderCount !== 1) {
        return;
    }
}
          
   found.push({
    ...tp,
    id: tp.id
});
        });

    
window.__lastFilteredPoints = found;

searchState.results = found;
searchState.resultIds = new Set(
    found.map(tp => tp.tpId || tp.id)
);
      
        const folderTree = buildFolderTree();
        attachResultsToTree(folderTree, searchState.results);
        resultsBox.style.display="block";
foldersBox.style.display="none";
      
      resultsBox.innerHTML = `
    <div class="search-info">
        🔑 ${getSearchTypeName()} • Topildi: ${found.length} ta element
    </div>
    ${renderSearchTree(folderTree)}
`;


if (currentPanelTab === "map") {
    loadFilteredPoints();
}   
    });
}

// 3. SIZ AYTGAN ASOSIY SCADA MANTIQI: Xaritada filtrlash, Birlashish va Miltillovchi markerlar (Override)
function loadFilteredPoints() {
  
    const tpListContainer = document.getElementById('tp-list');
    if (!tpListContainer) return;
    
    tpListContainer.innerHTML = "<p style='color:gray; padding:15px; text-align:center;'>Yuklanmoqda...</p>";

    // Eski markerlarni xaritadan butunlay tozalash
    activeMapMarkers.forEach(m => map.removeLayer(m));
    activeMapMarkers = [];

    database.ref('TPs').once('value', (snapshot) => {

const useSearchResults =
    searchState.text.trim() !== "" ||
    filterState.balance !== "none" ||
    filterState.created !== "none" ||
    filterState.updated !== "none" ||
    filterState.comment !== "none" ||
    filterState.dual !== "none" ||
    filterState.power !== "none";
       
        const allPoints = snapshot.val() || {};

const sourcePoints = useSearchResults
    ? searchState.results
    : Object.values(allPoints);
      
        tpListContainer.innerHTML = ""; 

        let bounds = [];
        const displayedPointsMap = new Map(); // Ona papkada bitta nuqtani bir marta chizish (dublikat oldini olish) uchun

      

        // Tanlangan guruh va uning pastki fiderlari IDlari ro'yxati
        const allowedFolderIds = activeFolderId === 'root' ? [] : getAllChildFolderIds(activeFolderId);

      
// Tez tekshirish uchun Set
const allowedFolderSet = new Set(allowedFolderIds);
      
        sourcePoints.forEach(point => {
           
            const lat = parseFloat(point.lat);
            const lng = parseFloat(point.lng);

            if (isNaN(lat) || isNaN(lng)) return;

            // Element tegishli bo'lgan barcha fiderlar massivi
            let tpFoldersArr = point.folders ? Object.keys(point.folders) : (point.folderId ? [point.folderId] : []);

         
if (!useSearchResults && !isPointInSelectedFolder(point)) {
    return;
}

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

if (isBlinking) {
    markerDiv.classList.add('blinking-marker-icon');
    markerDiv.style.setProperty('--fider-color-1', primaryColor);
    markerDiv.style.setProperty('--fider-color-2', secondaryColor);
}

markerDiv.innerHTML = `
<div style="
width:52px;
height:52px;
display:flex;
align-items:flex-end;
justify-content:center;
">
<i class="fas fa-map-marker-alt"
style="
font-size:52px;
color:${primaryColor};
line-height:52px;
text-shadow:0 0 6px black;
"></i>
</div>`;

const mIcon = L.divIcon({
    className: 'custom-leaflet-tp-wrapper',
    html: markerDiv,
    iconSize: [52,52],
    iconAnchor: [26,52]
});

const marker = L.marker([lat, lng], {
    icon: mIcon
}).addTo(map);
            
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
           if(point.images && point.images.length){

popupHtml += `<div style="margin-top:8px;
display:flex;
gap:5px;
overflow-x:auto;">`;

point.images.forEach(img=>{
popupHtml += `
<img src="${img.url}"
style="
width:90px;
height:90px;
object-fit:cover;
border-radius:6px;
cursor:pointer;"
onclick="window.open('${img.url}','_blank')">
`;
});

popupHtml += `</div>`;
}

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

// 🔥 BAZANI PANELNI OCHMASDAN ORQA FONDA YUKLASH (YAKUNIY KOD)
document.addEventListener('DOMContentLoaded', () => {
    console.log("Tizim yuklanmoqda...");

    // 1. Kodingiz ichidagi guruhlarni yuklaydigan funksiyalarni panelni ochmasdan, xotirada to'g'ridan-to'g'ri chaqiramiz
    const coreFunctions = ['loadGroups', 'fetchGroups', 'listenToGroups', 'loadUserGroups', 'listenToGroupsData', 'loadFolders'];
    coreFunctions.forEach(fName => {
        if (typeof window[fName] === "function") {
            try { window[fName](); } catch(e) {}
        }
    });

    // 2. KAFOLAT: Agar tizimda boshqaruv paneli ochilib ketadigan bo'lsa, uni srazi yopib qo'yamiz
    const listContainer = document.getElementById('list-container');
    if (listContainer) {
        listContainer.style.display = 'none'; // Uni vizual yashiramiz
    }

    // 3. 1.5 sekund "Baza yuklanmoqda..." oynasi turadi (baza xotiraga ma'lumotlarni to'liq yuklaydi)
    setTimeout(() => {
        // Yuklanish oynasini o'chiramiz va xodim shundoq toza Glavniy ekranda (Xaritada) qoladi
        const loader = document.getElementById('app-loader');
        if (loader) {
            loader.style.display = 'none';
        }
        
        // Panel 100% yopiq turishi shart
        if (listContainer) {
            listContainer.style.display = 'none';
        }
        
        console.log("Yuklanish tugadi. Faqat toza Glavniy ekran faol!");
    }, 1500); // 1.5 sekund Firebase'dan guruhlar kelib tushishi uchun ideal vaqt
});                                                 

// =========================================================================
// BOSHQRUV PANELIDAGI ICHKI XARITA MANTIQI (GLAVNIYGA TA'SIR QILMAYDI)
// =========================================================================
var panelMap = null;
var panelMarkersArray = [];


// =========================================================================
// UNIVERSAL ICHKI XARITA: FAQAT "XARITA" TABI BOSILGANDA ISHLAYDI
// =========================================================================
const panelTabFolders = document.getElementById('tab-folders');
const panelTabItems = document.getElementById('tab-items');
const panelSecFolders = document.getElementById('folders-section');
const panelSecItems = document.getElementById('items-section');

// ======================================================
// PANEL TAB BOSHQARUVI (MARKAZIY)
// ======================================================

let currentPanelTab = "folders";
function showFoldersTab() {
    currentPanelTab = "folders";

  const text = searchState.text.trim();

const hasFilter =
    filterState.balance !== "none" ||
    filterState.created !== "none" ||
    filterState.updated !== "none" ||
    filterState.comment !== "none" ||
    filterState.dual !== "none" ||
    filterState.power !== "none" ||
    filterState.status !== "none";
  
    if (panelTabFolders) panelTabFolders.classList.add("active");
    if (panelTabItems) panelTabItems.classList.remove("active");

    if (panelSecFolders) panelSecFolders.style.display = "block";
if (panelSecItems) panelSecItems.style.display = "none";

if (text !== "" || hasFilter) {
    refreshSearchResults();
}
}

function showMapTab() {
    currentPanelTab = "map";
    if (panelTabItems) panelTabItems.classList.add("active");
    if (panelTabFolders) panelTabFolders.classList.remove("active");

    if (panelSecFolders) panelSecFolders.style.display = "none";
    if (panelSecItems) panelSecItems.style.display = "block";

const resultsBox = document.getElementById("search-results");
if (resultsBox) {
    resultsBox.style.display = "none";
}
  
    if (panelInternalMap) {
        setTimeout(() => {
            panelInternalMap.invalidateSize();
        }, 50);
    }
      // Yangi xarita tizimi
   // if (typeof loadFilteredPoints === "function") {
   //     loadFilteredPoints();
   //  }
}

// 1. "Guruhlar" bo'limi bosilganda (Xarita butunlay yo'qoladi, ro'yxat pastgacha ochiladi)
if (panelTabFolders) {
    panelTabFolders.addEventListener('click', () => {
        showFoldersTab();
    });
}

// 2. "Xarita" bo'limi bosilganda (Panel ichida universal to'liq xarita ochiladi)
var panelInternalMap = null;
var panelInternalMarkers = [];

if (panelTabItems) {
    panelTabItems.addEventListener('click', () => {
        
      showMapTab();
  
      
        // Ichki xaritani bir marta yaratib olamiz
        if (!panelInternalMap) {
            panelInternalMap = L.map('panel-map', { zoomControl: true }).setView([40.10, 65.81], 14);
            
            L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
            }).addTo(panelInternalMap);
        }

        // Har safar bosilganda eski markerlarni tozalash
        panelInternalMarkers.forEach(m => panelInternalMap.removeLayer(m));
        panelInternalMarkers = [];

        // Bazadan faqat tanlangan guruh ma'lumotlarini filtrlash
        database.ref('TPs').once('value', (snapshot) => {
            const allPoints = snapshot.val() || {};

// MANA SHUNI QO'YING

          let filteredKeys;

const useSearchResults =
    searchState.text.trim() !== "" ||
    filterState.balance !== "none" ||
    filterState.created !== "none" ||
    filterState.updated !== "none" ||
    filterState.comment !== "none" ||
    filterState.dual !== "none" ||
    filterState.power !== "none";

if (useSearchResults) {

    const resultAddresses = new Set(
        searchState.results.map(tp =>
            `${tp.lat}|${tp.lng}|${tp.address}`
        )
    );

    filteredKeys = Object.keys(allPoints).filter(key => {
        const point = allPoints[key];

        return resultAddresses.has(
            `${point.lat}|${point.lng}|${point.address}`
        );
    });

} else {
    const keys = Object.keys(allPoints);
    filteredKeys = activeFolderId === "root"
        ? keys
        : keys.filter(key => isPointInSelectedFolder(allPoints[key]));
}
            
            let bounds = [];

            filteredKeys.forEach(key => {
                const point = allPoints[key];
                const lat = parseFloat(point.lat);
                const lng = parseFloat(point.lng);
                const displayName = point.address.split(',')[0] || "Element";

                if (!isNaN(lat) && !isNaN(lng)) {
                    bounds.push([lat, lng]);
                    
                    // Guruh rangini aniqlash
                    const folderColor = (currentFolders[point.folderId] && currentFolders[point.folderId].color) ? currentFolders[point.folderId].color : '#ff4444';

                    // Marker dizayni (O'z rangi bilan)
                    const pIcon = L.divIcon({
                        className: 'panel-internal-marker',
                        html: `<i class="fas fa-map-marker-alt" style="color: ${folderColor}; font-size: 24px; text-shadow: 0 0 3px black;"></i>`,
                        iconSize: [24, 24],
                        iconAnchor: [12, 24]
                    });

                    const marker = L.marker([lat, lng], { icon: pIcon }).addTo(panelInternalMap);
                    marker.bindPopup(`<b>${displayName}</b><br>${point.address}`);
                    panelInternalMarkers.push(marker);
                }
            });

            // Universal o'lchamlarni yangilab, markerlarga markazlashtirish (Yaqinlashtirish)
            setTimeout(() => {
                if (panelInternalMap) {
                    panelInternalMap.invalidateSize();
                    if (bounds.length > 0) {
                        panelInternalMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
                    }
                }
            }, 300);
        });
    });
}


// modul 📄

let elementModal = null;
function createElementModal(){
    if(document.getElementById("element-modal-overlay")){
        return;
    }
    document.body.insertAdjacentHTML("beforeend",`

<div id="element-modal-overlay"
style="
display:none;
position:fixed;
inset:0;
background:rgba(0,0,0,.45);
z-index:999999;
">

<div id="element-modal"
style="
position:absolute;
left:50%;
top:50%;
transform:translate(-50%,-50%);
width:850px;
max-width:95%;
height:620px;
background:#0f2235;
border-radius:14px;
overflow:hidden;
">

<div id="element-header"
style="
height:60px;
display:flex;
align-items:center;
justify-content:space-between;
padding:0 18px;
background:#173854;
color:#fff;
">

<div
style="
display:flex;
align-items:center;
gap:18px;
font-size:18px;
">

<span id="detail-short-folder">
📂 Papka
</span>

<span id="detail-title">

<i
id="detail-icon"
class="fas fa-bolt"
style="
margin-right:6px;
color:#1e88e5;
">
</i>

<span id="detail-title-text">
Element
</span>

</span>
</div>
<span
id="close-element-modal"
style="
cursor:pointer;
font-size:24px;
color:white;
">✕</span>
</div>
<div
id="detail-folder-path"
style="
padding:8px 18px;
background:#102b42;
color:#8fb7d8;
font-size:13px;
border-bottom:1px solid rgba(255,255,255,.08);
">
📂 Papka yo'li
</div>

<div id="element-modal-content"
style="
height:calc(100% - 50px);
display:grid;
grid-template-columns:135px 1fr;
background:#0f2235;
color:white;
">

<!-- CHAP TOMON -->

<div style="
border-right:1px solid rgba(255,255,255,.08);
padding:10px;
display:flex;
flex-direction:column;
">

<div id="element-preview"
style="
height:100px;
border-radius:10px;
background:#173854;
display:flex;
align-items:center;
justify-content:center;
font-size:18px;
position:relative;
">

<div id="preview-image"
style="
display:flex;
align-items:center;
justify-content:center;
width:100%;
height:100%;
text-align:center;
line-height:1.3;
font-size:13px;
color:#d8d8d8;
padding:6px;
box-sizing:border-box;
">
📷<br>Rasm mavjud emas
</div>

<div id="preview-zoom"
onclick="openImageGallery()"
style="
position:absolute;
right:8px;
bottom:6px;
top:auto;
width:24px;
height:24px;
border-radius:50%;
background:rgba(0,0,0,.55);
display:flex;
align-items:center;
justify-content:center;
cursor:pointer;
font-size:14px;
">
🔍
</div>
</div>

 <div
id="detail-navigation"
style="
margin-top:12px;
padding:10px 12px;
background:#1a2f45;
color:white;
border:1px solid rgba(255,255,255,.08);
border-radius:8px;
cursor:pointer;
font-weight:600;
display:none;
">
🚗 Navigatsiya
</div>

<div
id="detail-created-block"
style="
margin-top:10px;
padding:10px 12px;
background:#1a2f45;
color:white;
border:1px solid rgba(255,255,255,.08);
border-radius:8px;
display:none;
">
<div style="font-weight:bold;">🕒 Yaratilgan</div>
<div id="detail-created-date"></div>
<div id="detail-created-user"></div>
</div>

<div
id="detail-updated-block"
style="
margin-top:10px;
padding:10px 12px;
background:#1a2f45;
color:white;
border:1px solid rgba(255,255,255,.08);
border-radius:8px;
display:none;
">
<div style="font-weight:bold;">✏️ Oxirgi tahrir</div>
<div id="detail-updated-date"></div>
<div id="detail-updated-user"></div>
</div>

</div>

<!-- O'NG TOMON -->

<div style="
padding:22px;
overflow:auto;
">

<div style="margin-bottom:18px;">

<div
style="
font-size:13px;
color:#88a0b0;
margin-bottom:6px;
">
Texnik holati
</div>

<div
style="
display:flex;
justify-content:space-between;
align-items:center;
">

<div
id="detail-status"
style="
display:none;
font-size:18px;
font-weight:bold;
color:#fff;
">
Holati 🟢
</div>

<div
id="detail-power"
style="
display:none;
font-size:26px;
font-weight:bold;
color:#ffd54f;
">
⚡ 160
</div>

</div>

</div>

<div id="detail-address"
style="margin-bottom:12px;">
📍 Manzil
</div>


<div id="detail-owner"
style="margin-bottom:12px;">
👤 Javobgar
</div>

<div id="detail-phone"
style="margin-bottom:12px;">
📞 Telefon
</div>

<div
id="detail-other-feeders"
style="
display:none;
margin-top:18px;
margin-bottom:18px;
padding-top:14px;
border-top:1px solid rgba(255,255,255,.08);
">
<div
style="
font-weight:bold;
margin-bottom:10px;
">
🔌 Boshqa manbalari
</div>
<div id="detail-other-feeders-list"></div>
</div>

<div
id="detail-private-block"
style="
display:none;
margin-top:18px;
padding-top:18px;
border-top:1px solid rgba(255,255,255,.08);
">

<div
id="detail-firm"
style="margin-bottom:12px;display:none;">
🏢 Korxona
</div>

<div
id="detail-firm-owner"
style="margin-bottom:12px;display:none;">
👤 Vakili
</div>

<div
id="detail-firm-phone"
style="margin-bottom:12px;display:none;">
☎️ Korxona telefoni
</div>

<div
id="detail-meter"
style="display:none;">
🔢 Hisoblagich
</div>

</div>

<button id="edit-element-btn"
style="
width:100%;
height:46px;
border:none;
border-radius:8px;
background:#ff9800;
color:white;
font-size:16px;
cursor:pointer;
">

✏️ Tahrirlash

</button>

</div>

</div>
</div>
</div>
`);
    document
        .getElementById("close-element-modal")
        .onclick = closeElementModal;
    document
        .getElementById("element-modal-overlay")
        .onclick=function(e){
        if(e.target.id==="element-modal-overlay"){
            closeElementModal();
        }
    };
}

 // Mahalla panelini ochish
btnOpenMahallaPanel.onclick = function () {
    renderMahallaList();
    mahallaPanel.classList.remove("hidden");
};

// X tugmasi
closeMahallaPanel.onclick = function () {
    mahallaPanel.classList.add("hidden");
};

// Bekor qilish
cancelMahallaPanel.onclick = function () {
    mahallaPanel.classList.add("hidden");
};

async  function showElementModal(){
    if(!currentTP){
        showToast("Avval elementni tanlang!");
        return;
    }
    createElementModal();
  
  document.getElementById("detail-short-folder").textContent =
    "📂 " + (
        currentFolders[currentTP.primaryFolderId]?.name ||
        currentFolders[currentTP.folderId]?.name ||
        "-"
    );
document.getElementById("detail-icon").setAttribute(
    "style",
    "color:" + (currentTP.isPrivate ? "#ff4444" : "#1e88e5") +
    ";margin-right:6px;"
);

document.getElementById("detail-title-text").textContent =
    currentTP.name || "-";
  
document.getElementById("detail-folder-path").textContent =
    "📂 " + getFolderPath(
        currentTP.primaryFolderId || currentTP.folderId
    );
  
  
// document.getElementById("detail-name").textContent =
 //   currentTP.name || "-";

document.getElementById("detail-power").textContent =
    "⚡ " + (currentTP.power || "-");


// ===== HOLATI =====
const statusElement =
    document.getElementById("detail-status");
statusElement.style.display =
    currentTP.status ? "block" : "none";
if(currentTP.status){
    let statusIcon = "🟢";
    if(currentTP.status === "satisfactory"){
        statusIcon = "🟡";
    }
    if(currentTP.status === "emergency"){
        statusIcon = "🔴";
    }
    statusElement.textContent =
        "Holati " + statusIcon;
}

  
// ===== QUVVAT =====
document.getElementById("detail-power").style.display =
    currentTP.power ? "inline-block" : "none";

if(currentTP.power){
    document.getElementById("detail-power").textContent =
        "⚡ " + currentTP.power;
}

// ===== MANZIL =====
document.getElementById("detail-address").style.display =
    currentTP.address ? "block" : "none";

if(currentTP.address){
    document.getElementById("detail-address").textContent =
        "📍 " + currentTP.address;
}

// ===== JAVOBGAR =====
document.getElementById("detail-owner").style.display =
    currentTP.responsiblePerson ? "block" : "none";

if(currentTP.responsiblePerson){
    document.getElementById("detail-owner").textContent =
        "👤 " + currentTP.responsiblePerson;
}

// ===== TELEFON =====
document.getElementById("detail-phone").style.display =
    currentTP.responsiblePhone ? "block" : "none";

if(currentTP.responsiblePhone){
    document.getElementById("detail-phone").textContent =
        "📞 " + currentTP.responsiblePhone;
}

 
// ===== BOSHQA MANBALARI =====
const otherFeedersBlock =
    document.getElementById("detail-other-feeders");
const otherFeedersList =
    document.getElementById("detail-other-feeders-list");
otherFeedersList.innerHTML = "";

  const otherFolders =
    currentTP.folders
        ? Object.keys(currentTP.folders)
              .filter(id => id != currentTP.primaryFolderId)
        : [];


if(otherFolders.length){
    otherFeedersBlock.style.display = "block";
    otherFolders.forEach(folderId=>{
    const folder = currentFolders[folderId];
    if(!folder) return;
    const div = document.createElement("div");
    div.style.marginBottom = "10px";
    div.innerHTML =
        "📂 " + getFolderPath(folderId);
    otherFeedersList.appendChild(div);
});
   
}else{
    otherFeedersBlock.style.display = "none";
}  
  
  // ===== XUSUSIY BLOK =====
const privateBlock =
    document.getElementById("detail-private-block");
if(currentTP.isPrivate){
    privateBlock.style.display = "block";
    document.getElementById("detail-firm").textContent =
        "🏢 " + (currentTP.ownerFirm || "-");
    document.getElementById("detail-firm-owner").textContent =
        "👤 " + (currentTP.ownerName || "-");
    document.getElementById("detail-firm-phone").textContent =
        "☎️ " + (currentTP.ownerPhone || "-");
    document.getElementById("detail-meter").textContent =
        "🔢 " + (currentTP.meterNumber || "-");
}else{
    privateBlock.style.display = "none";
}

// ===== KORXONA NOMI =====
document.getElementById("detail-firm").style.display =
    currentTP.ownerFirm ? "block" : "none";

document.getElementById("detail-firm").textContent =
    "🏢 " + (currentTP.ownerFirm || "");

// ===== KORXONA VAKILI =====
document.getElementById("detail-firm-owner").style.display =
    currentTP.ownerName ? "block" : "none";

document.getElementById("detail-firm-owner").textContent =
    "👤 " + (currentTP.ownerName || "");

// ===== KORXONA TELEFONI =====
document.getElementById("detail-firm-phone").style.display =
    currentTP.ownerPhone ? "block" : "none";

document.getElementById("detail-firm-phone").textContent =
    "☎️ " + (currentTP.ownerPhone || "");

// ===== HISOBLAGICH =====
document.getElementById("detail-meter").style.display =
    currentTP.meterNumber ? "block" : "none";

document.getElementById("detail-meter").textContent =
    "🔢 " + (currentTP.meterNumber || "");  
  
const preview = document.getElementById("preview-image");
if (
    currentTP.images &&
    currentTP.images.length
){
    const imageUrl = await getTelegramFileUrl(
      currentTP.images[0].fileId
    );
    if(imageUrl){
        preview.innerHTML = `
<img
src="${imageUrl}"
style="
width:100%;
height:100%;
object-fit:cover;
object-position:50% 25%;
border-radius:8px;
">
`;
    }else{
        preview.innerHTML="📷<br>Rasm mavjud emas";
    }
}else{ 
    preview.innerHTML="📷<br>Rasm mavjud emas";
}


// tahrirlashlar modulda
  document.getElementById("detail-created-block").style.display =
    currentTP.createdAt ? "block" : "none";

document.getElementById("detail-updated-block").style.display =
    currentTP.updatedAt ? "block" : "none";
  
function formatDate(ts){
    if(!ts) return "-";
    const d = new Date(Number(ts));
    const dd = String(d.getDate()).padStart(2,"0");
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2,"0");
    const mi = String(d.getMinutes()).padStart(2,"0");
    return {
        date:`${dd}.${mm}.${yy}`,
        time:`${hh}:${mi}`
    };
}
const created = formatDate(currentTP.createdAt);
const updated = formatDate(currentTP.updatedAt);

document.getElementById("detail-created-date").innerHTML =
`${created.date}<br>${created.time}`;

document.getElementById("detail-created-user").textContent =
currentTP.createdBy || "-";

document.getElementById("detail-updated-date").innerHTML =
`${updated.date}<br>${updated.time}`;

document.getElementById("detail-updated-user").textContent =
currentTP.updatedBy || "-";
 
 
const nav = document.getElementById("detail-navigation");
if(currentTP.lat && currentTP.lng){
    nav.style.display = "block";
    nav.onclick = function(){
        window.open(
            `https://maps.google.com/?q=${currentTP.lat},${currentTP.lng}`,
            "_blank"
        );
    };
}else{
    nav.style.display = "none";
}
  
    document
        .getElementById("element-modal-overlay")
        .style.display = "block";
}
function closeElementModal(){
    const modal=document.getElementById("element-modal-overlay");
    if(modal){
        modal.style.display="none";
    }
}

let imageGalleryModal = null;
let galleryImages = [];
let galleryIndex = 0;
let galleryTP = null;

function createImageGallery(){
    if(document.getElementById("image-gallery-overlay")){
        return;
    }
    document.body.insertAdjacentHTML("beforeend",`
<div id="image-gallery-overlay"
style="
display:none;
position:fixed;
inset:0;
background:rgba(0,0,0,.88);
z-index:1000000;
">
<div
id="image-gallery-modal"
style="
position:absolute;
left:50%;
top:50%;
transform:translate(-50%,-50%);
width:min(96vw,1600px);
height:min(96vh,950px);
display:flex;
flex-direction:column;
background:#0f2235;
border-radius:12px;
overflow:hidden;
">

<div
id="gallery-header"
style="
background:#173854;
padding:12px 18px;
color:white;
transition:.3s;
">

<div
style="
display:flex;
align-items:center;
justify-content:space-between;
">

<div
style="
display:flex;
align-items:center;
gap:20px;
font-size:20px;
font-weight:bold;
">

<span id="gallery-folder-name">
📂 Papka
</span>

<span id="gallery-element-name">
⚡ Element
</span>

</div>

<span
id="close-image-gallery"
style="
font-size:34px;
cursor:pointer;
line-height:1;
">
✕
</span>

</div>

<div
id="gallery-counter"
style="
margin-top:8px;
text-align:right;
font-size:16px;
color:#cfd8dc;
">
1 / 1
</div>

</div>

<div
style="
flex:1;
display:flex;
align-items:center;
justify-content:space-between;
padding:0 15px;
">


<div
style="
flex:1;
position:relative;
display:flex;
align-items:center;
justify-content:center;
overflow:hidden;
height:100%;
width:100%;
">

<div
id="gallery-prev"
style="
position:absolute;
left:18px;
top:50%;
transform:translateY(-50%);
width:56px;
height:56px;
border-radius:50%;
background:rgba(0,0,0,.45);
color:white;
font-size:34px;
display:flex;
align-items:center;
justify-content:center;
cursor:pointer;
user-select:none;
z-index:5;
transition:.3s;
">
❮
</div>

<div
id="gallery-image-container"
style="
width:100%;
height:100%;
display:flex;
align-items:center;
justify-content:center;
padding:12px;
box-sizing:border-box;
flex:1;
">
Rasm yuklanmoqda...
</div>

<div
id="gallery-next"
style="
position:absolute;
right:18px;
top:50%;
transform:translateY(-50%);
width:56px;
height:56px;
border-radius:50%;
background:rgba(0,0,0,.45);
color:white;
font-size:34px;
display:flex;
align-items:center;
justify-content:center;
cursor:pointer;
user-select:none;
z-index:5;
transition:.3s;
">
❯
</div>

</div>

</div>
</div>
</div>
`);
   document
    .getElementById("close-image-gallery")
    .onclick = closeImageGallery;

document.getElementById("gallery-prev").onclick = previousGalleryImage;
document.getElementById("gallery-next").onclick = nextGalleryImage;

document
    .getElementById("image-gallery-overlay")
    .onclick = function(e){

    showGalleryControls();

    if(e.target.id==="image-gallery-overlay"){
        closeImageGallery();
    }

};

// document.addEventListener("mousemove", showGalleryControls);
// document.addEventListener("touchstart", showGalleryControls);

}

function closeImageGallery(){
    document.onmousemove = null;
    document.ontouchstart = null;
    document.onclick = null;
    document
        .getElementById("image-gallery-overlay")
        .style.display = "none";
}

let galleryHideTimer = null;

function showGalleryControls(){
  
    document.getElementById("gallery-header").style.opacity = "1";
    document.getElementById("gallery-prev").style.opacity = "1";
    document.getElementById("gallery-next").style.opacity = "1";
    document.getElementById("gallery-prev").style.pointerEvents = "auto";
    document.getElementById("gallery-next").style.pointerEvents = "auto";
    clearTimeout(galleryHideTimer);
    galleryHideTimer = setTimeout(hideGalleryControls,3000);
}

function hideGalleryControls(){
    document.getElementById("gallery-header").style.opacity = "0";
    document.getElementById("gallery-prev").style.opacity = "0";
    document.getElementById("gallery-next").style.opacity = "0";
    document.getElementById("gallery-prev").style.pointerEvents = "none";
    document.getElementById("gallery-next").style.pointerEvents = "none";
}

async function openImageGallery(){
    createImageGallery();

document.getElementById("gallery-folder-name").textContent =
    "📂 " + (
        currentFolders[currentTP.primaryFolderId]?.name ||
        currentFolders[currentTP.folderId]?.name ||
        "-"
    );
  
document.getElementById("gallery-element-name").innerHTML =
    `<i class="fas fa-bolt"
        style="
            color:${currentTP.isPrivate ? "#ff4444" : "#1e88e5"};
            margin-right:6px;
        ">
     </i>${currentTP.name || "-"}`;

document.getElementById("gallery-counter").textContent =
    `1 / ${currentTP.images.length}`;
  
    const container =
        document.getElementById("gallery-image-container");
    container.innerHTML = "Rasm yuklanmoqda...";
    if(
        !currentTP ||
        !currentTP.images ||
        !currentTP.images.length
    ){
        container.innerHTML = "📷 Rasm mavjud emas";
        document
            .getElementById("image-gallery-overlay")
            .style.display = "block";
        return;
    }
    galleryTP = currentTP; 
galleryImages = currentTP.images;
galleryIndex = 0;

await loadGalleryImage();
  
    document
        .getElementById("image-gallery-overlay")
        .style.display = "block"; 

  showGalleryControls();
  document.onmousemove = showGalleryControls;
  document.ontouchstart = showGalleryControls;
  document.onclick = showGalleryControls;
}

async function loadGalleryImage(){
    const container =
        document.getElementById("gallery-image-container");
    const img = galleryImages[galleryIndex];
    const imageUrl = await getTelegramFileUrl(img.fileId);
    if(!imageUrl){
        container.innerHTML = "❌ Rasm yuklanmadi";
        return;
    }
    container.innerHTML = `
<img
src="${imageUrl}"
style="
display:block;
max-width:100%;
max-height:100%;
width:auto;
height:auto;
object-fit:contain;
border-radius:10px;
">
`;
    document.getElementById("gallery-counter").textContent =
        `${galleryIndex+1} / ${galleryImages.length}`;
}

async function nextGalleryImage(){
    if(galleryIndex >= galleryImages.length - 1){
        return;
    }
    galleryIndex++;
    await loadGalleryImage();
    showGalleryControls();
}
async function previousGalleryImage(){
    if(galleryIndex <= 0){
        return;
    }
    galleryIndex--;
    await loadGalleryImage();
    showGalleryControls();
}
