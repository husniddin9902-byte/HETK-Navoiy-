// "Bismillahir Rohmanir Rohim" — "Mehribon va Rahmli Alloh nomi bilan boshlayman" 
// =========================
// MAHALLA MODULI
// =========================

let foundMahallas = [];

const MAHALLA_RADIUS = 10000; // Internet qidiruvi (10 km)

const TP_RADIUS = 5000; // TP larni tekshirish (5 km)

async function loadNearbyMahallas(){
    foundMahallas = [];
    const lat = Number(inputLatitude.value);
    const lng = Number(inputLongitude.value);
    if(!lat || !lng){
        showToast("Koordinata topilmadi");
        return;
    }
    await loadMahallasFromInternet(lat,lng);
}
