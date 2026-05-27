// =========================
// HETK MONITORING
// STAGE 1 + STAGE 2
// =========================

// =========================
// VARIABLES
// =========================

let map;

let currentMarker = null;

let currentLayer = "satellite";

// =========================
// MAP LAYERS
// =========================

const satelliteLayer = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"]
    }
);

const hybridLayer = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    {
        maxZoom: 20,
        subdomains: ["mt0", "mt1", "mt2", "mt3"]
    }
);

// =========================
// INIT MAP
// =========================

function initMap(){

    map = L.map("map",{
        zoomControl:false,
        attributionControl:true
    }).setView([41.3111,69.2797],7);

    satelliteLayer.addTo(map);

    // =========================
    // CUSTOM ZOOM
    // =========================

    L.control.zoom({
        position:"topleft"
    }).addTo(map);

    // =========================
    // MAP CLICK
    // =========================

    map.on("click", async function(e){

        const lat = e.latlng.lat;

        const lng = e.latlng.lng;

        // =========================
        // UPDATE PANEL
        // =========================

        updateCoordinates(lat,lng);

        // =========================
        // REMOVE OLD MARKER
        // =========================

        if(currentMarker){

            map.removeLayer(currentMarker);

        }

        // =========================
        // CREATE MARKER
        // =========================

        currentMarker = L.marker([lat,lng])
        .addTo(map);

        // =========================
        // GET ADDRESS
        // =========================

        await getAddress(lat,lng);

    });

    // =========================
    // HIDE LOADER
    // =========================

    setTimeout(()=>{

        document.getElementById("loader")
        .style.display = "none";

        map.invalidateSize();

    },1200);

}

// =========================
// UPDATE COORDINATES
// =========================

function updateCoordinates(lat,lng){

    document.getElementById("latitude")
    .innerText = lat.toFixed(6);

    document.getElementById("longitude")
    .innerText = lng.toFixed(6);

}

// =========================
// GET ADDRESS
// =========================

async function getAddress(lat,lng){

    try{

        const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

        const response =
        await fetch(url);

        const data =
        await response.json();

        const address =
        data.display_name || "Aniqlanmadi";

        document.getElementById("address")
        .innerText = address;

    }
    catch(error){

        console.log(error);

        document.getElementById("address")
        .innerText = "Manzil topilmadi";

    }

}

// =========================
// SEARCH LOCATION
// =========================

async function searchLocation(){

    const query =
    document.getElementById("searchInput")
    .value;

    if(!query) return;

    try{

        const url =
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;

        const response =
        await fetch(url);

        const data =
        await response.json();

        if(data.length > 0){

            const lat =
            parseFloat(data[0].lat);

            const lng =
            parseFloat(data[0].lon);

            map.setView([lat,lng],14);

            // =========================
            // REMOVE OLD MARKER
            // =========================

            if(currentMarker){

                map.removeLayer(currentMarker);

            }

            // =========================
            // NEW MARKER
            // =========================

            currentMarker =
            L.marker([lat,lng])
            .addTo(map);

            // =========================
            // UPDATE PANEL
            // =========================

            updateCoordinates(lat,lng);

            // =========================
            // GET ADDRESS
            // =========================

            await getAddress(lat,lng);

        }

    }
    catch(error){

        console.log(error);

    }

}

// =========================
// TOGGLE MAP LAYER
// =========================

function toggleLayer(){

    if(currentLayer === "satellite"){

        map.removeLayer(satelliteLayer);

        hybridLayer.addTo(map);

        currentLayer = "hybrid";

    }
    else{

        map.removeLayer(hybridLayer);

        satelliteLayer.addTo(map);

        currentLayer = "satellite";

    }

}

// =========================
// OPEN SIDEBAR
// =========================

function openSidebar(){

    document.getElementById("sidebar")
    .classList.add("active");

}

// =========================
// CLOSE SIDEBAR
// =========================

function closeSidebar(){

    document.getElementById("sidebar")
    .classList.remove("active");

}

// =========================
// COPY COORDINATES
// =========================

function copyCoordinates(){

    const lat =
    document.getElementById("latitude")
    .innerText;

    const lng =
    document.getElementById("longitude")
    .innerText;

    navigator.clipboard.writeText(
        `${lat}, ${lng}`
    );

}

// =========================
// SHARE LOCATION
// =========================

function shareLocation(){

    const lat =
    document.getElementById("latitude")
    .innerText;

    const lng =
    document.getElementById("longitude")
    .innerText;

    const url =
    `https://maps.google.com/?q=${lat},${lng}`;

    if(navigator.share){

        navigator.share({
            title:"Lokatsiya",
            text:url
        });

    }
    else{

        window.open(url);

    }

}

// =========================
// CURRENT LOCATION
// =========================

function getCurrentLocation(){

    if(!navigator.geolocation){

        alert("GPS qo‘llab-quvvatlanmaydi");

        return;

    }

    navigator.geolocation.getCurrentPosition(

        async function(position){

            const lat =
            position.coords.latitude;

            const lng =
            position.coords.longitude;

            // =========================
            // MOVE MAP
            // =========================

            map.setView([lat,lng],16);

            // =========================
            // REMOVE OLD MARKER
            // =========================

            if(currentMarker){

                map.removeLayer(currentMarker);

            }

            // =========================
            // NEW MARKER
            // =========================

            currentMarker =
            L.marker([lat,lng])
            .addTo(map);

            // =========================
            // UPDATE PANEL
            // =========================

            updateCoordinates(lat,lng);

            // =========================
            // ADDRESS
            // =========================

            await getAddress(lat,lng);

        },

        function(error){

            console.log(error);

            alert("GPS aniqlanmadi");

        }

    );

}

// =========================
// DRAG BOTTOM SHEET
// =========================

const bottomSheet =
document.getElementById("bottomSheet");

let startY = 0;

bottomSheet.addEventListener(

    "touchstart",

    function(e){

        startY =
        e.touches[0].clientY;

    }

);

bottomSheet.addEventListener(

    "touchmove",

    function(e){

        const currentY =
        e.touches[0].clientY;

        const diff =
        startY - currentY;

        // =========================
        // OPEN
        // =========================

        if(diff > 50){

            bottomSheet.style.maxHeight =
            "85vh";

        }

        // =========================
        // CLOSE
        // =========================

        if(diff < -50){

            bottomSheet.style.maxHeight =
            "52vh";

        }

    }

);

// =========================
// ENTER SEARCH
// =========================

document
.getElementById("searchInput")
.addEventListener(

    "keypress",

    function(e){

        if(e.key === "Enter"){

            searchLocation();

        }

    }

);

// =========================
// MAP RESIZE FIX
// =========================

window.addEventListener(

    "resize",

    function(){

        setTimeout(()=>{

            map.invalidateSize();

        },300);

    }

);

// =========================
// INIT
// =========================

window.onload = function(){

    initMap();

};
