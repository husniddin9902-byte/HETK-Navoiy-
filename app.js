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

// 2. Xaritani ishga tushirish
var map = L.map('map', { zoomControl: false }).setView([40.10, 65.81], 16);

L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);
// --- Yangilangan: Xaritadan nuqta tanlash mantiqi ---
var selectedMarker = null;

// Xaritani uzoq bosib turganda (Telefon va kompyuter uchun eng ma'qul yo'li)
map.on('contextmenu', function(e) {
    // 1. Agar avvalgi tomchi bo'lsa, uni o'chiramiz
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
    }

    // 2. Yangi marker qo'yamiz
    selectedMarker = L.marker(e.latlng).addTo(map);
    
    // 3. Popup oynasini ochamiz
    var deleteBtn = `<div class="marker-delete-popup" onclick="resetToUserLocation()">
                        Удалить это местоположение?
                     </div>`;
    
    selectedMarker.bindPopup(deleteBtn, {
        closeButton: false, 
        offset: [0, -30],
        className: 'custom-popup'
    }).openPopup();

    // 4. Panelni yangi nuqtaga moslaymiz
    updateMyPanel(e.latlng.lat, e.latlng.lng);
});

// O'chirish funksiyasi
function resetToUserLocation() {
    if (selectedMarker) {
        map.removeLayer(selectedMarker);
        selectedMarker = null;
    }
    
    // Rasmda ko'ringan lastPos o'zgaruvchisidan foydalanamiz
    if (lastPos) {
        updateMyPanel(lastPos.lat, lastPos.lng);
    }
}

// Panelni yangilovchi funksiya (IDlarni yana bir bor tekshiring)
function updateMyPanel(lat, lng) {
    var latEl = document.getElementById('lat-val'); 
    var lngEl = document.getElementById('lng-val'); 
    
    if(latEl && lngEl) {
        latEl.innerText = lat.toFixed(6);
        lngEl.innerText = lng.toFixed(6);
    }
}
// Marker uchun o'zgaruvchini boshida bo'sh qoldiramiz
var userMarker = null; 
var lastPos = null;
var isUserInteracting = false; 

// 3. Lokatsiyani aniqlash funksiyasi (KO'K NUQTA VA DOIRA BILAN)
function onLocation(p) {
    const lat = p.coords.latitude;
    const lng = p.coords.longitude;
    const acc = Math.round(p.coords.accuracy);
    lastPos = { lat: lat, lng: lng };
    
    var newLatLng = new L.LatLng(lat, lng);

    // Eski markerni olib tashlash
    if (userMarker) {
        map.removeLayer(userMarker);
    }

    // Rasmda ko'rsatilgan ko'k nuqta va shaffof doira (zona) ni yaratish
    var customIcon = L.divIcon({
        className: 'user-location-container',
        html: `
            <div style="
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 40px;
                height: 40px;
            ">
                <div style="
                    position: absolute;
                    width: 40px;
                    height: 40px;
                    background: rgba(0, 122, 255, 0.2); 
                    border: 1px solid rgba(0, 122, 255, 0.4);
                    border-radius: 50%;
                "></div>
                <div style="
                    width: 12px;
                    height: 12px;
                    background: #007AFF;
                    border: 2px solid white;
                    border-radius: 50%;
                    z-index: 2;
                    box-shadow: 0 0 5px rgba(0,0,0,0.3);
                "></div>
            </div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    userMarker = L.marker(newLatLng, { icon: customIcon }).addTo(map);

    if (!isUserInteracting) {
        map.setView(newLatLng, 18);
    }

    if(document.getElementById('latitude')) document.getElementById('latitude').innerText = lat.toFixed(6);
    if(document.getElementById('longitude')) document.getElementById('longitude').innerText = lng.toFixed(6);
    if(document.getElementById('accuracy')) document.getElementById('accuracy').innerText = acc;
    
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

navigator.geolocation.watchPosition(onLocation, (e) => console.log(e), { enableHighAccuracy: true });

// 4. Xarita nazorati
map.on('movestart', function() {
    isUserInteracting = true;
});

if(document.getElementById('locate-btn')) {
    document.getElementById('locate-btn').addEventListener('click', () => {
        isUserInteracting = false; 
        if(lastPos) map.setView([lastPos.lat, lastPos.lng], 18);
    });
}

// 5. Panelni ochish/yopish (O'ZGARIShSIZ QOLDI)
function togglePanel() {
    const panel = document.getElementById('panel');
    const icon = document.getElementById('toggle-icon');
    
    if(!panel || !icon) return;

    panel.classList.toggle('minimized');
    
    if (panel.classList.contains('minimized')) {
        icon.style.transform = 'rotate(0deg)'; 
        icon.className = 'fas fa-chevron-up';
    } else {
        icon.style.transform = 'rotate(180deg)';
        icon.className = 'fas fa-chevron-down';
    }
}

// 6. Chiroyli xabar (Toast) chiqarish funksiyasi (O'ZGARIShSIZ QOLDI)
function showToast(message) {
    const oldToast = document.querySelector('.toast-message');
    if (oldToast) oldToast.remove();

    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.innerText = message;
    
    toast.style.cssText = `
        position: fixed;
        bottom: 120px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.85);
        color: white;
        padding: 12px 25px;
        border-radius: 30px;
        font-size: 14px;
        z-index: 3000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.4);
        transition: opacity 0.5s;
        white-space: nowrap;
        pointer-events: none;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

// 7. Bazaga saqlash
document.querySelector('.save-btn').addEventListener('click', function() {
    if (lastPos) {
        database.ref('locations/' + Date.now()).set({
            lat: lastPos.lat,
            lng: lastPos.lng,
            time: new Date().toLocaleString(),
            address: document.getElementById('address').innerText
        }).then(() => {
            showToast("Bazaga saqlandi!");
        });
    } else {
        showToast("GPS kutilmoqda...");
    }
});

// 8. NUSXA OLISH (O'ZGARIShSIZ QOLDI)
function copyCoords() {
    if (!lastPos) {
        showToast("Joylashuv aniqlanmagan!");
        return;
    }

    const lat = lastPos.lat.toFixed(6);
    const lng = lastPos.lng.toFixed(6);
    const address = document.getElementById('address').innerText;
    
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const formattedTime = `${month} ${day}, ${year} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

    const fullText = `Широта: ${lat}\nДолгота: ${lng}\nАдрес: ${address}\nДата: ${formattedTime}\nGoogle Maps: ${googleMapsUrl}\nWaze: ${wazeUrl}`;

    navigator.clipboard.writeText(fullText).then(() => {
        showToast("Ma’lumot nusxalandi");
    }).catch(err => {
        console.error('Xatolik:', err);
    });
      }
