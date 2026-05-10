var map = L.map('map', { zoomControl: false }).setView([40.1031, 65.3739], 13); 

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker = L.marker([40.1031, 65.3739], { draggable: true }).addTo(map);
var lastValidPos = null;
var isUserInteracting = false; // Foydalanuvchi xaritani ko'rayotganini bildiradi

// Xaritani kimdir ushlasa yoki sursa, avtomatik sakrashni to'xtatamiz
map.on('movestart', function() {
    isUserInteracting = true;
});

function updateUI(lat, lng, acc) {
    document.getElementById('latitude').innerText = lat.toFixed(6);
    document.getElementById('longitude').innerText = lng.toFixed(6);
    document.getElementById('accuracy-text').innerText = "Aniqlik: " + Math.round(acc) + "m";
}

function startTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const acc = position.coords.accuracy;
                const currentPos = L.latLng(lat, lng);

                // FILTR: 500 metrdan uzoqqa asossiz sakrashni bloklaymiz
                if (lastValidPos) {
                    const distance = currentPos.distanceTo(lastValidPos);
                    if (distance > 500 && acc > 50) return; 
                }

                lastValidPos = currentPos;
                marker.setLatLng(currentPos);
                
                // ENG MUHIM JOYI: 
                // Agar foydalanuvchi xaritani surmayotgan bo'lsa va aniqlik yaxshi bo'lsa - markazga oladi
                if (!isUserInteracting && acc < 100) {
                    map.setView(currentPos, 18);
                }
                
                updateUI(lat, lng, acc);
            },
            function(error) { console.log("GPS Error"); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );
    }
}

// "Nishon" tugmasi bosilganda - avtomatik kuzatuvni qayta yoqamiz va xaritani sizga qaytaramiz
document.getElementById('locate-btn').addEventListener('click', () => {
    isUserInteracting = false; 
    if (lastValidPos) {
        map.setView(lastValidPos, 18);
    } else {
        location.reload();
    }
});

marker.on('dragend', function (e) {
    var pos = marker.getLatLng();
    updateUI(pos.lat, pos.lng, 0);
});

document.getElementById('toggle-info').addEventListener('click', () => {
    document.getElementById('info-panel').classList.toggle('hidden');
});

startTracking();
