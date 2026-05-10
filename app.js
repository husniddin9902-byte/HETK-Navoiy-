var map = L.map('map', { zoomControl: false }).setView([40.1031, 65.3739], 13); 

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker;

function startTracking() {
    if (navigator.geolocation) {
        // watchPosition — bu doimiy va real vaqtda kuzatish
        navigator.geolocation.watchPosition(
            function(position) {
                var lat = position.coords.latitude;
                var lng = position.coords.longitude;
                var acc = position.coords.accuracy; // Aniqlik (metrda)

                document.getElementById('latitude').innerText = lat.toFixed(6);
                document.getElementById('longitude').innerText = lng.toFixed(6);
                document.getElementById('accuracy-text').innerText = "Aniqlik: " + Math.round(acc) + " metr";

                var newPos = new L.LatLng(lat, lng);
                
                if (!marker) {
                    marker = L.marker(newPos).addTo(map);
                    map.setView(newPos, 18);
                } else {
                    marker.setLatLng(newPos);
                }
            },
            function(error) {
                console.log("Xato: " + error.message);
            },
            {
                enableHighAccuracy: true, // GPS datchigini majburan ishlatish
                maximumAge: 0,           // Keshdan ma'lumot olmaslik
                timeout: 10000           // 10 soniya kutish
            }
        );
    }
}

document.getElementById('locate-btn').addEventListener('click', () => {
    if (marker) map.setView(marker.getLatLng(), 18);
});

document.getElementById('toggle-info').addEventListener('click', function() {
    document.getElementById('info-panel').classList.toggle('hidden');
});

startTracking();
