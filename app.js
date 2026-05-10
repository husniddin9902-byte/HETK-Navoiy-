var map = L.map('map', { zoomControl: false }).setView([40.1031, 65.3739], 13); 

L.tileLayer('https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains:['mt0','mt1','mt2','mt3']
}).addTo(map);

var marker = L.marker([40.1031, 65.3739], { draggable: true }).addTo(map);

function updateUI(lat, lng, acc) {
    document.getElementById('latitude').innerText = lat.toFixed(6);
    document.getElementById('longitude').innerText = lng.toFixed(6);
    // Agar xatolik 20 metrdan ko'p bo'lsa, foydalanuvchiga bildirish
    let accText = acc > 50 ? `Aniqlik past: ${Math.round(acc)}m. Ochiqroq joyga chiqing.` : `Aniqlik: ${Math.round(acc)}m`;
    document.getElementById('accuracy-text').innerText = accText;
}

// ASOSIY YECHIM: Yuqori aniqlikni majburlash
const geoOptions = {
    enableHighAccuracy: true, // BU ENG MUHIMI: GPS datchigini yoqadi
    maximumAge: 0,            // Keshdan foydalanmaydi, har doim yangi nuqta so'raydi
    timeout: 30000            // GPS javobini 30 soniyagacha kutadi
};

function startTracking() {
    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(
            function(position) {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const acc = position.coords.accuracy;

                // Faqat aniqlik ma'lum bir darajaga yetganda xaritani markazlashtiramiz
                const newPos = new L.LatLng(lat, lng);
                marker.setLatLng(newPos);
                
                // Agar aniqlik 100 metrdan yaxshi bo'lsa, xaritani yaqinlashtiramiz
                if (acc < 100) {
                    map.setView(newPos, 18);
                } else {
                    map.panTo(newPos);
                }

                updateUI(lat, lng, acc);
            },
            function(error) {
                console.error("GPS Error: ", error);
            }, 
            geoOptions
        );
    }
}

// Sayt ochilishi bilan boshlash
startTracking();

document.getElementById('locate-btn').addEventListener('click', () => {
    location.reload(); 
});

document.getElementById('toggle-info').addEventListener('click', function() {
    document.getElementById('info-panel').classList.toggle('hidden');
});
                                                        
