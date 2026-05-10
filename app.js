// 1. Firebase Konfiguratsiyasi
const firebaseConfig = {
  apiKey: "AIzaSyBFOoT_ZhvE1tT1Qglh5GjPPhs8ZsyRWoc",
  authDomain: "energo-monitoring.firebaseapp.com",
  databaseURL: "https://energo-monitoring-default-rtdb.firebaseio.com",
  projectId: "energo-monitoring",
  storageBucket: "energo-monitoring.firebasestorage.app",
  messagingSenderId: "514032923022",
  appId: "1:514032923022:web:fe2f57b81a30d0c2fd74df",
  measurementId: "G-DCH7TPJJSL"
};

// Firebase-ni ishga tushirish
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// 2. Xaritani sozlash
var map = L.map('map', { zoomControl: false }).setView([40.1031, 65.3739], 13); 

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

// Sizning asosiy ko'k markeringiz
var marker = L.marker([40.1031, 65.3739], { draggable: true }).addTo(map);

var lastValidPos = null;
var isUserInteracting = false;

// 3. Foydalanuvchi interaksiyasi
map.on('movestart', () => isUserInteracting = true);

function updateUI(lat, lng, acc) {
    document.getElementById('latitude').innerText = lat.toFixed(6);
    document.getElementById('longitude').innerText = lng.toFixed(6);
    if(document.getElementById('accuracy-text')) {
        document.getElementById('accuracy-text').innerText = "Aniqlik: " + Math.round(acc) + "m";
    }
}

// 4. GPS Kuzatuv
function startTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const acc = position.coords.accuracy;
                const currentPos = L.latLng(lat, lng);

                // Filtr: Katta sakrashlarni oldini olish
                if (lastValidPos) {
                    const distance = currentPos.distanceTo(lastValidPos);
                    if (distance > 500 && acc > 50) return; 
                }

                lastValidPos = currentPos;
                marker.setLatLng(currentPos);
                
                if (!isUserInteracting && acc < 100) {
                    map.setView(currentPos, 18);
                }
                updateUI(lat, lng, acc);
            },
            (error) => console.log("GPS Error"),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
        );
    }
}

// 5. SAQLASH (Firebase-ga yuborish)
document.querySelector('.save-btn').addEventListener('click', function() {
    if (lastValidPos) {
        const timestamp = new Date().getTime();
        
        database.ref('locations/' + timestamp).set({
            latitude: lastValidPos.lat,
            longitude: lastValidPos.lng,
            time: new Date().toLocaleString(),
            staff: "Navoiy_HETK_Xodimi" // Bu yerga xodim ismini qo'shish mumkin
        }).then(() => {
            alert("Joylashuv onlayn bazaga muvaffaqiyatli saqlandi!");
        }).catch((err) => {
            alert("Xatolik yuz berdi: " + err.message);
        });
    } else {
        alert("GPS hali nuqtangizni aniqlagani yo'q!");
    }
});

// 6. BAZADAGI NUQTALARNI XARITADA KO'RISH
database.ref('locations/').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        Object.values(data).forEach(loc => {
            // Saqlangan nuqtalar uchun yashil markerlar
            L.marker([loc.latitude, loc.longitude], {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41]
                })
            }).addTo(map).bindPopup(`<b>Saqlangan vaqt:</b><br>${loc.time}`);
        });
    }
});

// Nishon tugmasi
document.getElementById('locate-btn').addEventListener('click', () => {
    isUserInteracting = false; 
    if (lastValidPos) map.setView(lastValidPos, 18);
});

startTracking();
                    
