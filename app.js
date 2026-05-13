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

// 2. Xaritani ishga tushirish (Google Satellite bilan)
var map = L.map('map', { zoomControl: false }).setView([40.10, 65.81], 16);

L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}',{
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker = L.marker([40.10, 65.81]).addTo(map);
var lastPos = null;
var isUserInteracting = false; 

// 3. Lokatsiyani aniqlash funksiyasi
function onLocation(p) {
    const lat = p.coords.latitude;
    const lng = p.coords.longitude;
    const acc = Math.round(p.coords.accuracy);
    lastPos = { lat: lat, lng: lng };
    
    var newLatLng = new L.LatLng(lat, lng);
    marker.setLatLng(newLatLng);

    // Foydalanuvchi xaritaga tegmagan bo'lsa, avtomatik markazlashtirish
    if (!isUserInteracting) {
        map.setView(newLatLng, 18);
    }

    // Ekrandagi ma'lumotlarni yangilash
    if(document.getElementById('latitude')) document.getElementById('latitude').innerText = lat.toFixed(6);
    if(document.getElementById('longitude')) document.getElementById('longitude').innerText = lng.toFixed(6);
    if(document.getElementById('accuracy')) document.getElementById('accuracy').innerText = acc;
    
    // Reverse Geocoding - Manzilni aniqlash
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

// GPS kuzatishni yoqish
navigator.geolocation.watchPosition(onLocation, (e) => console.log(e), { enableHighAccuracy: true });

// 4. Xarita nazorati (Foydalanuvchi xaritani sursa avto-center o'chadi)
map.on('movestart', function() {
    isUserInteracting = true;
});

// Nishon (Locate) tugmasi - Bosilganda avto-center qayta yoqiladi
if(document.getElementById('locate-btn')) {
    document.getElementById('locate-btn').addEventListener('click', () => {
        isUserInteracting = false; 
        if(lastPos) map.setView([lastPos.lat, lastPos.lng], 18);
    });
}

// 5. Panelni ochish/yopish (Strelka va Klass effekti bilan)
function togglePanel() {
    const panel = document.getElementById('panel');
    const icon = document.getElementById('toggle-icon');
    
    if(!panel || !icon) return;

    panel.classList.toggle('minimized');
    
    if (panel.classList.contains('minimized')) {
        icon.style.transform = 'rotate(0deg)'; 
        icon.className = 'fas fa-chevron-up'; // Yopiq turganda tepaga
    } else {
        icon.style.transform = 'rotate(180deg)';
        icon.className = 'fas fa-chevron-down'; // Ochiq turganda pastga
    }
}

// 6. Bazaga saqlash funksiyasi
document.querySelector('.save-btn').addEventListener('click', function() {
    if (lastPos) {
        database.ref('locations/' + Date.now()).set({
            lat: lastPos.lat,
            lng: lastPos.lng,
            time: new Date().toLocaleString(),
            address: document.getElementById('address').innerText
        }).then(() => {
            alert("Bazaga muvaffaqiyatli saqlandi!");
        });
    } else {
        alert("GPS ma'lumoti kutilmoqda...");
    }
});

// 7. NUSXA OLISH FUNKSIYASI (Siz so'ragan formatda)
function copyCoords() {
    if (!lastPos) {
        alert("Joylashuv aniqlanmagan!");
        return;
    }

    const lat = lastPos.lat.toFixed(6);
    const lng = lastPos.lng.toFixed(6);
    const address = document.getElementById('address').innerText;
    
    // Vaqtni formatlash: May 13, 2026 08:46:12 PM
    const now = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[now.getMonth()];
    const day = now.getDate();
    const year = now.getFullYear();
    
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedTime = `${month} ${day}, ${year} ${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

    // Xarita havolalari
    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
    const wazeUrl = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;

    // SIZ SO'RAGAN MATN FORMATI
    const fullText = `Широта: ${lat}
Долгота: ${lng}
Адрес: ${address}
Дата: ${formattedTime}
Google Maps: ${googleMapsUrl}
Waze: ${wazeUrl}`;

    // Clipboardga (operativ xotiraga) nusxa olish
    navigator.clipboard.writeText(fullText).then(() => {
        alert("Barcha ma'lumotlar nusxalandi!");
    }).catch(err => {
        console.error('Nusxa olishda xatolik:', err);
    });
}
