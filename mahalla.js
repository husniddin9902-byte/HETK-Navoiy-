// "Bismillahir Rohmanir Rohim" — "Mehribon va Rahmli Alloh nomi bilan boshlayman" 
// =========================
// MAHALLA MODULI
// =========================

let foundMahallas = [];

const MAHALLA_RADIUS = 10000; // Internet qidiruvi (10 km)

const TP_RADIUS = 5000; // TP larni tekshirish (5 km)

async function loadNearbyMahallas(lat, lng){
    foundMahallas = [];
    if(!lat || !lng){
        showToast("Koordinata topilmadi");
        return;
    }
    console.log("Koordinata:", lat, lng);
    await loadMahallasFromInternet(lat, lng);
}


async function loadMahallasFromInternet(lat,lng){
    try{
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=uz`
        );
        const data = await response.json();
        console.log(data);
    }catch(err){
        console.error(err);
        showToast("Internet orqali mahalla topilmadi");
    }
}

