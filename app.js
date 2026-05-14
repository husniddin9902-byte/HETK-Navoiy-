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
var isManualSelection = false; // GPS panelni yangilashini nazorat qilish uchun

// Google Satellit qatlami
L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

// 3. Lokatsiyani aniqlash funksiyasi (GPS)
function onLocation(p) {
    const lat = p.coords.latitude;
    const lng = p.coords.longitude;
    const acc = Math.round(p.coords.accuracy);
    
    // GPS koordinatalarini har doim xotirada yangilab boramiz
    lastPos = { lat: lat, lng: lng };
    
    var newLatLng = new L.LatLng(lat, lng);

    // Ko'k nuqtani yangilash
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

    // --- MUHIM: Agar foydalanuvchi xaritadan nuqta tanlamagan bo'lsa, panelni GPS bilan yangila ---
    if (!isManualSelection) {
        updatePanelValues(lat, lng, acc);
        updateAddress(lat, lng);
    }
}

navigator.geolocation.watchPosition(onLocation, (e) => console.log(e), { enableHighAccuracy: true });

// 4. Xaritadan nuqta tanlash (Long Press / ContextMenu)
map.on('contextmenu', function(e) {
    if (selectedMarker) map.removeLayer(selectedMarker);

    isManualSelection = true; // GPS endi panelni yangilamaydi
    selectedMarker = L.marker(e.latlng).addTo(map);
    
    var deleteBtn = `<div class="marker-delete-popup" onclick="resetToUserLocation()">
                        Удалить это местоположение?
                     </div>`;
    
    selectedMarker.bindPopup(deleteBtn, {
        closeButton: false, 
        offset: [0, -30],
        className: 'custom-popup'
    }).openPopup();

    // Panelni tanlangan nuqtaga qarab yangilaymiz
    updatePanelValues(e.latlng.lat, e.latlng.lng);
    updateAddress(e.latlng.lat, e.latlng.lng);
});

// Nuqtani o'chirish va GPS holatiga qaytish
function resetToUserLocation() {
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
    }
    
    isManualSelection = false; // GPSga yana ruxsat beramiz
    
    if (lastPos) {
        updatePanelValues(lastPos.lat, lastPos.lng);
        updateAddress(lastPos.lat, lastPos.lng);
    }
}

// 5. Yordamchi funksiyalar (Panel va Adres uchun)
function updatePanelValues(lat, lng, acc = null) {
    if(document.getElementById('latitude')) document.getElementById('latitude').innerText = lat.toFixed(6);
    if(document.getElementById('longitude')) document.getElementById('longitude').innerText = lng.toFixed(6);
    if(acc !== null && document.getElementById('accuracy')) {
        document.getElementById('accuracy').innerText = acc;
    }
}

function updateAddress(lat, lng) {
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

// 6. Xarita va Panel nazorati
map.on('movestart', function() { isUserInteracting = true; });

if(document.getElementById('locate-btn')) {
    document.getElementById('locate-btn').addEventListener('click', () => {
        isUserInteracting = false; 
        if(lastPos) map.setView([lastPos.lat, lastPos.lng], 18);
    });
}

function togglePanel() {
    const panel = document.getElementById('panel');
    const icon = document.getElementById('toggle-icon');
    if(!panel || !icon) return;

    panel.classList.toggle('minimized');
    icon.style.transform = panel.classList.contains('minimized') ? 'rotate(0deg)' : 'rotate(180deg)';
    icon.className = panel.classList.contains('minimized') ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
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

// 7. Bazaga saqlash
document.querySelector('.save-btn').addEventListener('click', function() {
    // Hozirgi paneldagi koordinatalarni olish (GPS yoki tanlangan marker)
    const currentLat = document.getElementById('latitude').innerText;
    const currentLng = document.getElementById('longitude').innerText;

    database.ref('locations/' + Date.now()).set({
        lat: currentLat,
        lng: currentLng,
        time: new Date().toLocaleString(),
        address: document.getElementById('address').innerText
    }).then(() => {
        showToast("Bazaga saqlandi!");
    });
});

// 8. NUSXA OLISH
function copyCoords() {
    const lat = document.getElementById('latitude').innerText;
    const lng = document.getElementById('longitude').innerText;
    const address = document.getElementById('address').innerText;
    
    const fullText = `Широта: ${lat}\nДолгота: ${lng}\nАдрес: ${address}\nGoogle Maps: https://www.google.com/maps?q=${lat},${lng}`;

    navigator.clipboard.writeText(fullText).then(() => {
        showToast("Ma’lumot nusxalandi");
    });
}
