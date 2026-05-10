var map = L.map('map', { zoomControl: false }).setView([40.1031, 65.3739], 13); 

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

// Marker (ham suriladigan, ham avtomatik o'zgaradigan)
var marker = L.marker([40.1031, 65.3739], { draggable: true }).addTo(map);

function updateUI(lat, lng, acc) {
    document.getElementById('latitude').innerText = lat.toFixed(6);
    document.getElementById('longitude').innerText = lng.toFixed(6);
    if(acc) {
        document.getElementById('accuracy-text').innerText = "Aniqlik: " + Math.round(acc) + " metr";
    }
}

// 1. DOIMIY KUZATUV (Eng aniq usul)
function startPreciseTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            function(position) {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;
                var acc = position.coords.accuracy;

                var newPos = new L.LatLng(lat, lng);
                
                // Markerni yangi joyga ko'chirish
                marker.setLatLng(newPos);
                
                // Agar aniqlik yaxshi bo'lsa (yoki birinchi marta bo'lsa) xaritani o'sha yerga qaratish
                if (acc < 100) { 
                    map.setView(newPos, 18);
                } else {
                    map.panTo(newPos);
                }

                updateUI(lat, lng, acc);
            },
            function(error) {
                console.log("GPS xatosi: " + error.message);
            },
            {
                enableHighAccuracy: true, // GPS datchigini majburlash
                maximumAge: 0,           // Keshni ishlatmaslik
                timeout: 27000           // Kutish vaqti
            }
        );
    }
}

// Marker qo'lda surilsa ham koordinata o'zgaradi
marker.on('dragend', function (e) {
    var pos = marker.getLatLng();
    updateUI(pos.lat, pos.lng, null);
});

// Nishon tugmasi bosilsa
document.getElementById('locate-btn').addEventListener('click', function() {
    startPreciseTracking();
});

// Sayt ochilishi bilan boshlash
startPreciseTracking();

document.getElementById('toggle-info').addEventListener('click', function() {
    document.getElementById('info-panel').classList.toggle('hidden');
});
