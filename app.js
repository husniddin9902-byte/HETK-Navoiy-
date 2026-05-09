var map = L.map('map', { zoomControl: false }).setView([40.1031, 65.3739], 13); 

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker;

// ASOSIY FUNKSIYA: Doimiy kuzatuv (WatchPosition)
function startTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            function(position) {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;
                var accuracy = position.coords.accuracy;

                console.log("Aniqlik: " + accuracy + " metr");

                // Agar aniqlik 100 metrdan ko'p bo'lsa, GPS hali yaxshi ushlamagan bo'ladi
                var newLatLng = new L.LatLng(lat, lng);

                if (marker) {
                    marker.setLatLng(newLatLng);
                } else {
                    marker = L.marker(newLatLng).addTo(map);
                }

                // Xaritani faqat birinchi marta yoki tugma bosilganda markazga oladi
                // map.setView(newLatLng, 18); 

                document.getElementById('latitude').innerText = lat.toFixed(6);
                document.getElementById('longitude').innerText = lng.toFixed(6);
                
                // Manzilni yangilash
                updateAddress(lat, lng);
            },
            function(error) {
                console.log("Xatolik: " + error.message);
            },
            {
                enableHighAccuracy: true, // GPS-ni majburlash
                maximumAge: 0,           // Keshdan foydalanmaslik
                timeout: 10000           // Har 10 soniyada yangilash
            }
        );
    }
}

function updateAddress(lat, lng) {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
            document.getElementById('address').innerText = data.display_name;
        });
}

// Tugma bosilganda xaritani nuqtaga qaytarish
document.getElementById('locate-btn').addEventListener('click', function() {
    if (marker) {
        map.setView(marker.getLatLng(), 18);
    } else {
        startTracking();
    }
});

// Sayt ochilishi bilan kuzatishni boshlash
startTracking();

document.getElementById('toggle-info').addEventListener('click', function() {
    var panel = document.getElementById('info-panel');
    panel.classList.toggle('hidden');
    this.querySelector('i').classList.toggle('fa-chevron-up');
    this.querySelector('i').classList.toggle('fa-chevron-down');
});
