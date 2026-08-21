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
    await loadNearbyMahallasFromOverpass(lat, lng);
    await loadMahallasFromNearbyTP(lat, lng); 
}


async function loadMahallasFromInternet(lat,lng){
    try{
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=uz`
        );
        const data = await response.json();
        console.log(data);

         const address = data.address || {};
const mahallaName =
    address.neighbourhood ||
    address.suburb ||
    address.quarter ||
    address.village ||
    address.hamlet ||
    null;
if(mahallaName){
    foundMahallas.push({
        name: mahallaName,
        distance: 0
    });
}
         
    }catch(err){
        console.error(err);
        showToast("Internet orqali mahalla topilmadi");
    }
}

async function loadNearbyMahallasFromOverpass(lat,lng){
    try{
        const query = `
[out:json][timeout:20];
(
node["place"](around:${MAHALLA_RADIUS},${lat},${lng});
way["place"](around:${MAHALLA_RADIUS},${lat},${lng});
relation["place"](around:${MAHALLA_RADIUS},${lat},${lng});
);
out center;
`;
        const response = await fetch(
            "https://overpass.kumi.systems/api/interpreter",
            {
                method:"POST",
                body:query
            }
        );
        const data = await response.json();
        console.log("OVERPASS:", data);
    }catch(err){
        console.error("OVERPASS ERROR:", err);
        
    }
}

async function loadMahallasFromNearbyTP(lat,lng){
   const snapshot =
await database.ref("TPs").once("value");

const allPoints =
snapshot.val() || {};

const nearbyPoints = [];
Object.values(allPoints).forEach(point => {
    const tpLat = Number(point.lat);
    const tpLng = Number(point.lng);
    if(isNaN(tpLat) || isNaN(tpLng)){
        return;
    }
    const distance =
        calculateDistance(
            lat,
            lng,
            tpLat,
            tpLng
        );
    if(distance <= TP_RADIUS){
        nearbyPoints.push({
    point: point,
    distance: distance
});
    }
});
    
const uniqueMahallas = {};
nearbyPoints.forEach(item => {
    const mahalla =
        item.point.primaryMahalla;
    if(!mahalla) return;
    if(
        !uniqueMahallas[mahalla] ||
        item.distance < uniqueMahallas[mahalla]
    ){
        uniqueMahallas[mahalla] =
            item.distance;
    }
});
    
    
uniqueMahallas.forEach(name => {
    if(
        !foundMahallas.some(
            x => x.name === name
        )
    ){
        foundMahallas.push({
            name: name,
            distance: null
        });
    }
});
renderMahallaList();
}

function calculateDistance(lat1,lng1,lat2,lng2){

    const R = 6371000;

    const dLat =
        (lat2-lat1)*Math.PI/180;

    const dLng =
        (lng2-lng1)*Math.PI/180;

    const a =
        Math.sin(dLat/2)*
        Math.sin(dLat/2)+
        Math.cos(lat1*Math.PI/180)*
        Math.cos(lat2*Math.PI/180)*
        Math.sin(dLng/2)*
        Math.sin(dLng/2);

    return R*2*Math.atan2(
        Math.sqrt(a),
        Math.sqrt(1-a)
    );

}
