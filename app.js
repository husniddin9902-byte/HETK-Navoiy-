// 1. Firebase Sozlamalari (O'zgarishsiz)
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

// 2. O'zgaruvchilar (Eski va Yangi birlashtirildi)
var map = L.map('map', { zoomControl: false }).setView([40.10, 65.81], 16);
var userMarker = null; 
var selectedMarker = null;
var lastPos = null;
var isUserInteracting = false; 
var isManualSelection = false; 
let currentFolders = {}; 
let activeFolderId = 'root'; 

// Google Satellit qatlami
L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

// --- 3. ESKI PANEL VA GPS FUNKSIYALARI (HAMMASI QAYTARILDI) ---

function updatePanelValues(lat, lng, acc = null, force = false) {
    if (isManualSelection && !force) return;
    const latEl = document.getElementById('latitude');
    const lngEl = document.getElementById('longitude');
    const accEl = document.getElementById('accuracy');
    if (latEl && lngEl) {
        latEl.innerText = lat.toFixed(6);
        lngEl.innerText = lng.toFixed(6);
    }
    if (accEl && acc !== null) accEl.innerText = acc;
}

function updateAddress(lat, lng, force = false) {
    if (isManualSelection && !force) return;
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
            if(document.getElementById('address')) document.getElementById('address').innerText = data.display_name || "Manzil topilmadi";
        }).catch(() => {
            if(document.getElementById('address')) document.getElementById('address').innerText = "Internetda xatolik";
        });
}

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
    if (!isUserInteracting) map.setView(newLatLng, 18);
    updatePanelValues(lat, lng, acc, false);
    updateAddress(lat, lng, false);
}

navigator.geolocation.watchPosition(onLocation, (e) => console.log(e), { enableHighAccuracy: true });

// --- 4. YANGI PAPKALAR TIZIMI (ESKILARGA XALAQIT BERMAYDI) ---

// UI elementlari ulanishi
const listBtn = document.getElementById('list-btn');
const listModal = document.getElementById('list-container');
const closeList = document.getElementById('close-list');
const openAddBtn = document.getElementById('open-add-folder');
const addFolderPanel = document.getElementById('add-folder-panel');
const cancelFolder = document.getElementById('cancel-folder');

if(listBtn) listBtn.addEventListener('click', () => { listModal.style.display = 'flex'; loadFolders(); });
if(closeList) closeList.addEventListener('click', () => { listModal.style.display = 'none'; });
if(openAddBtn) openAddBtn.addEventListener('click', () => { 
    addFolderPanel.classList.remove('hidden'); 
    updateParentSelect(); 
});
if(cancelFolder) cancelFolder.addEventListener('click', () => { addFolderPanel.classList.add('hidden'); });

// Hue slider dizayni uchun (Rasmda ko'rsatganingiz)
const hueSlider = document.getElementById('color-slider');
if(hueSlider) {
    hueSlider.addEventListener('input', (e) => {
        const color = `hsl(${e.target.value}, 100%, 50%)`;
        document.getElementById('color-preview').style.background = color;
    });
}

// Papkani saqlash
document.getElementById('save-folder').addEventListener('click', () => {
    const name = document.getElementById('new-group-name').value;
    const parentId = document.getElementById('parent-folder-select').value;
    const color = document.getElementById('color-preview').style.background || 'red';

    if (!name) return showToast("Nomini kiriting!");

    database.ref('Folders').push({
        name: name,
        parentId: parentId,
        color: color,
        createdAt: Date.now()
    }).then(() => {
        showToast("Papka yaratildi!");
        document.getElementById('new-group-name').value = "";
        addFolderPanel.classList.add('hidden');
    });
});

function loadFolders() {
    database.ref('Folders').on('value', (snapshot) => {
        currentFolders = snapshot.val() || {};
        renderTree('root', document.getElementById('tree-root'));
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
            <div class="folder-header" id="folder-${id}">
                <span class="toggle-btn" onclick="toggleFolderView('${id}')">+</span>
                <i class="fas fa-folder" style="color: ${folder.color}; margin-right: 8px;"></i>
                <span onclick="selectFolder('${id}')">${folder.name}</span>
            </div>
            <div id="children-${id}" class="folder-children" style="display: none;"></div>
        `;
        container.appendChild(item);
        renderTree(id, item.querySelector(`#children-${id}`));
    });
}

function toggleFolderView(id) {
    const childDiv = document.getElementById(`children-${id}`);
    const btn = document.querySelector(`#folder-${id} .toggle-btn`);
    if (childDiv.style.display === "none") {
        childDiv.style.display = "block";
        btn.innerText = "-";
    } else {
        childDiv.style.display = "none";
        btn.innerText = "+";
    }
}

function selectFolder(folderId) {
    activeFolderId = folderId;
    listModal.style.display = 'none';
    showToast(`${currentFolders[folderId].name} tanlandi`);
}

function updateParentSelect() {
    const select = document.getElementById('parent-folder-select');
    select.innerHTML = '<option value="root">Asosiy papka (Bosh)</option>';
    Object.keys(currentFolders).forEach(id => {
        const option = document.createElement('option');
        option.value = id;
        option.innerText = currentFolders[id].name;
        select.appendChild(option);
    });
}

// --- 5. SAQLASH VA NUSXA OLISH (O'ZGARISHSIZ QOLDI) ---

document.querySelector('.save-btn').addEventListener('click', function() {
    const currentLat = document.getElementById('latitude').innerText;
    const currentLng = document.getElementById('longitude').innerText;
    
    if (activeFolderId === 'root') return showToast("Oldin papka tanlang!");

    database.ref('TPs/' + Date.now()).set({
        lat: currentLat,
        lng: currentLng,
        folderId: activeFolderId,
        address: document.getElementById('address').innerText,
        time: new Date().toLocaleString()
    }).then(() => { showToast("Bazaga saqlandi!"); });
});

// Qolgan togglePanel, copyCoords va showToast funksiyalari kodingizda qanday bo'lsa shundayligicha qoldirilsin.
function togglePanel() {
    const panel = document.getElementById('panel');
    const icon = document.getElementById('toggle-icon');
    panel.classList.toggle('minimized');
    icon.style.transform = panel.classList.contains('minimized') ? 'rotate(0deg)' : 'rotate(180deg)';
}

function copyCoords() {
    const lat = document.getElementById('latitude').innerText;
    const lng = document.getElementById('longitude').innerText;
    const address = document.getElementById('address').innerText;
    const fullText = `Широта: ${lat}\nДолгота: ${lng}\nАдрес: ${address}`;
    navigator.clipboard.writeText(fullText).then(() => { showToast("Nusxalandi"); });
}

function showToast(m) {
    const t = document.createElement('div');
    t.innerText = m;
    t.style.cssText = "position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:black; color:white; padding:10px 20px; border-radius:20px; z-index:5000;";
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2000);
            }
                 
