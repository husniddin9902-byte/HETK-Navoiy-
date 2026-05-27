// ======================================================
// HETK MONITORING SYSTEM
// PROFESSIONAL VERSION v3
// ======================================================

// ======================================================
// GLOBAL VARIABLES
// ======================================================

let map;
let miniMap;

let currentMarker = null;

let currentLayer = "satellite";

let bottomSheetExpanded = false;

let currentLatitude = 0;
let currentLongitude = 0;

// ======================================================
// MAP LAYERS
// ======================================================

const satelliteLayer = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    {
        maxZoom:20,
        subdomains:["mt0","mt1","mt2","mt3"]
    }
);

const hybridLayer = L.tileLayer(
    "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    {
        maxZoom:20,
        subdomains:["mt0","mt1","mt2","mt3"]
    }
);

// ======================================================
// INIT MAP
// ======================================================

function initMap(){

    map = L.map(
        "map",
        {
            zoomControl:false,
            attributionControl:true
        }
    ).setView(
        [41.3111,69.2797],
        7
    );

    satelliteLayer.addTo(map);

    // ==================================================
    // ZOOM CONTROL
    // ==================================================

    L.control.zoom({
        position:"topleft"
    }).addTo(map);

    // ==================================================
    // MAP CLICK
    // ==================================================

    map.on(
        "click",
        async function(e){

            const lat =
            e.latlng.lat;

            const lng =
            e.latlng.lng;

            currentLatitude = lat;
            currentLongitude = lng;

            // ==========================================
            // UPDATE PANEL
            // ==========================================

            updateCoordinates(
                lat,
                lng
            );

            // ==========================================
            // REMOVE OLD MARKER
            // ==========================================

            if(currentMarker){

                map.removeLayer(
                    currentMarker
                );

            }

            // ==========================================
            // CREATE MARKER
            // ==========================================

            currentMarker =
            L.marker([lat,lng])
            .addTo(map);

            // ==========================================
            // GET ADDRESS
            // ==========================================

            await getAddress(
                lat,
                lng
            );

        }
    );

    // ==================================================
    // LOADER HIDE
    // ==================================================

    setTimeout(()=>{

        document
        .getElementById("loader")
        .style.display = "none";

        map.invalidateSize();

    },1500);

}

// ======================================================
// MINI MAP
// ======================================================

function initMiniMap(){

    miniMap = L.map(
        "miniMap",
        {
            zoomControl:false,
            attributionControl:false
        }
    ).setView(
        [41.3111,69.2797],
        5
    );

    L.tileLayer(
        "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
        {
            maxZoom:20,
            subdomains:[
                "mt0",
                "mt1",
                "mt2",
                "mt3"
            ]
        }
    ).addTo(miniMap);

}

// ======================================================
// UPDATE COORDINATES
// ======================================================

function updateCoordinates(
    lat,
    lng
){

    document
    .getElementById("latitude")
    .innerText =
    lat.toFixed(6);

    document
    .getElementById("longitude")
    .innerText =
    lng.toFixed(6);

}

// ======================================================
// GET ADDRESS
// ======================================================

async function getAddress(
    lat,
    lng
){

    try{

        const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

        const response =
        await fetch(url);

        const data =
        await response.json();

        const address =
        data.display_name
        ||
        "Aniqlanmadi";

        document
        .getElementById("address")
        .innerText =
        address;

    }
    catch(error){

        console.log(error);

        document
        .getElementById("address")
        .innerText =
        "Manzil topilmadi";

    }

}

// ======================================================
// SEARCH LOCATION
// ======================================================

async function searchLocation(){

    const query =
    document
    .getElementById("searchInput")
    .value;

    if(!query){

        return;

    }

    try{

        const url =
        `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;

        const response =
        await fetch(url);

        const data =
        await response.json();

        if(data.length > 0){

            const lat =
            parseFloat(
                data[0].lat
            );

            const lng =
            parseFloat(
                data[0].lon
            );

            currentLatitude = lat;
            currentLongitude = lng;

            // ==========================================
            // MOVE MAP
            // ==========================================

            map.setView(
                [lat,lng],
                15
            );

            // ==========================================
            // REMOVE OLD MARKER
            // ==========================================

            if(currentMarker){

                map.removeLayer(
                    currentMarker
                );

            }

            // ==========================================
            // CREATE MARKER
            // ==========================================

            currentMarker =
            L.marker([lat,lng])
            .addTo(map);

            // ==========================================
            // UPDATE PANEL
            // ==========================================

            updateCoordinates(
                lat,
                lng
            );

            // ==========================================
            // ADDRESS
            // ==========================================

            await getAddress(
                lat,
                lng
            );

        }

    }
    catch(error){

        console.log(error);

    }

}

// ======================================================
// ENTER SEARCH
// ======================================================

document
.getElementById("searchInput")
.addEventListener(
    "keypress",
    function(e){

        if(
            e.key === "Enter"
        ){

            searchLocation();

        }

    }
);

// ======================================================
// TOGGLE LAYER
// ======================================================

function toggleLayer(){

    if(
        currentLayer ===
        "satellite"
    ){

        map.removeLayer(
            satelliteLayer
        );

        hybridLayer
        .addTo(map);

        currentLayer =
        "hybrid";

    }
    else{

        map.removeLayer(
            hybridLayer
        );

        satelliteLayer
        .addTo(map);

        currentLayer =
        "satellite";

    }

}

// ======================================================
// CURRENT LOCATION
// ======================================================

function getCurrentLocation(){

    if(
        !navigator.geolocation
    ){

        alert(
            "GPS qo‘llab-quvvatlanmaydi"
        );

        return;

    }

    navigator.geolocation
    .getCurrentPosition(

        async function(position){

            const lat =
            position.coords.latitude;

            const lng =
            position.coords.longitude;

            currentLatitude = lat;
            currentLongitude = lng;

            // ==========================================
            // MAP MOVE
            // ==========================================

            map.setView(
                [lat,lng],
                16
            );

            // ==========================================
            // REMOVE OLD MARKER
            // ==========================================

            if(currentMarker){

                map.removeLayer(
                    currentMarker
                );

            }

            // ==========================================
            // NEW MARKER
            // ==========================================

            currentMarker =
            L.marker([lat,lng])
            .addTo(map);

            // ==========================================
            // UPDATE
            // ==========================================

            updateCoordinates(
                lat,
                lng
            );

            // ==========================================
            // ADDRESS
            // ==========================================

            await getAddress(
                lat,
                lng
            );

        },

        function(error){

            console.log(error);

            alert(
                "GPS aniqlanmadi"
            );

        }

    );

}

// ======================================================
// OPEN SIDEBAR
// ======================================================

function openSidebar(){

    document
    .getElementById("sidebar")
    .classList.add("active");

    setTimeout(()=>{

        miniMap.invalidateSize();

    },300);

}

// ======================================================
// CLOSE SIDEBAR
// ======================================================

function closeSidebar(){

    document
    .getElementById("sidebar")
    .classList.remove("active");

}

// ======================================================
// COPY COORDINATES
// ======================================================

function copyCoordinates(){

    navigator.clipboard.writeText(
        `${currentLatitude}, ${currentLongitude}`
    );

}

// ======================================================
// SHARE LOCATION
// ======================================================

function shareLocation(){

    const url =
    `https://maps.google.com/?q=${currentLatitude},${currentLongitude}`;

    if(
        navigator.share
    ){

        navigator.share({

            title:"Lokatsiya",

            text:url

        });

    }
    else{

        window.open(url);

    }

}

// ======================================================
// DRAG BOTTOM SHEET
// ======================================================

const bottomSheet =
document.getElementById(
    "bottomSheet"
);

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

        // ==============================================
        // EXPAND
        // ==============================================

        if(diff > 50){

            bottomSheet.style.maxHeight =
            "88vh";

            bottomSheetExpanded =
            true;

        }

        // ==============================================
        // COLLAPSE
        // ==============================================

        if(diff < -50){

            bottomSheet.style.maxHeight =
            "52vh";

            bottomSheetExpanded =
            false;

        }

    }

);

// ======================================================
// SIDEBAR TABS
// ======================================================

const groupsTabBtn =
document.getElementById(
    "groupsTabBtn"
);

const mapTabBtn =
document.getElementById(
    "mapTabBtn"
);

const groupsPage =
document.getElementById(
    "groupsPage"
);

const mapPage =
document.getElementById(
    "mapPage"
);

// ======================================================
// GROUPS TAB
// ======================================================

groupsTabBtn.addEventListener(

    "click",

    function(){

        groupsTabBtn
        .classList.add("active");

        mapTabBtn
        .classList.remove("active");

        groupsPage
        .classList.add("active");

        mapPage
        .classList.remove("active");

    }

);

// ======================================================
// MAP TAB
// ======================================================

mapTabBtn.addEventListener(

    "click",

    function(){

        mapTabBtn
        .classList.add("active");

        groupsTabBtn
        .classList.remove("active");

        mapPage
        .classList.add("active");

        groupsPage
        .classList.remove("active");

        setTimeout(()=>{

            miniMap.invalidateSize();

        },300);

    }

);

// ======================================================
// TREE TOGGLE
// ======================================================

document
.querySelectorAll(".tree-title")
.forEach(

    function(title){

        title.addEventListener(

            "click",

            function(){

                const parent =
                this.parentElement;

                const children =
                parent.querySelector(
                    ".tree-children"
                );

                const toggle =
                this.querySelector(
                    ".tree-toggle"
                );

                if(!children){

                    return;

                }

                // ======================================
                // OPEN
                // ======================================

                if(
                    children.style.display
                    ===
                    "none"
                ){

                    children.style.display =
                    "block";

                    toggle.innerText =
                    "−";

                }

                // ======================================
                // CLOSE
                // ======================================

                else{

                    children.style.display =
                    "none";

                    toggle.innerText =
                    "+";

                }

            }

        );

    }

);

// ======================================================
// SIDEBAR SEARCH
// ======================================================

document
.getElementById("sidebarSearch")
.addEventListener(

    "input",

    function(){

        const value =
        this.value.toLowerCase();

        const items =
        document.querySelectorAll(
            ".tree-item"
        );

        items.forEach(

            function(item){

                const text =
                item.innerText
                .toLowerCase();

                if(
                    text.includes(value)
                ){

                    item.style.display =
                    "flex";

                }
                else{

                    item.style.display =
                    "none";

                }

            }

        );

    }

);

// ======================================================
// WINDOW RESIZE
// ======================================================

window.addEventListener(

    "resize",

    function(){

        setTimeout(()=>{

            map.invalidateSize();

            if(miniMap){

                miniMap.invalidateSize();

            }

        },300);

    }

);

// ======================================================
// INIT
// ======================================================

window.onload = function(){

    initMap();

    initMiniMap();

};
