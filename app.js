// =========================
// HETK Monitoring PRO v3
// =========================

// -------------------------
// GLOBAL VARIABLES
// -------------------------

let map;
let currentMarker = null;
let selectedLat = null;
let selectedLng = null;

let groups = JSON.parse(localStorage.getItem("hetk_groups")) || [];
let locations = JSON.parse(localStorage.getItem("hetk_locations")) || [];

let currentLayer = "satellite";

const markersLayer = L.layerGroup();

// -------------------------
// MAP LAYERS
// -------------------------

const satelliteLayer = L.tileLayer(
  "https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  {
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  }
);

const hybridLayer = L.tileLayer(
  "https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  {
    maxZoom: 20,
    subdomains: ["mt0", "mt1", "mt2", "mt3"],
  }
);

// -------------------------
// INIT MAP
// -------------------------

function initMap() {
  map = L.map("map", {
    zoomControl: false,
    attributionControl: true,
  }).setView([41.3111, 69.2797], 7);

  satelliteLayer.addTo(map);

  L.control.zoom({
    position: "topleft",
  }).addTo(map);

  markersLayer.addTo(map);

  setTimeout(() => {
    map.invalidateSize();
  }, 300);

  map.on("click", async function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    selectedLat = lat;
    selectedLng = lng;

    updateBottomPanel(lat, lng);

    if (currentMarker) {
      map.removeLayer(currentMarker);
    }

    currentMarker = L.marker([lat, lng]).addTo(map);

    await getAddress(lat, lng);

    openSaveModal();
  });

  renderSavedLocations();
}

// -------------------------
// MAP RESIZE FIX
// -------------------------

function refreshMap() {
  setTimeout(() => {
    map.invalidateSize();
  }, 400);
}

// -------------------------
// LAYER SWITCH
// -------------------------

function toggleLayer() {
  if (currentLayer === "satellite") {
    map.removeLayer(satelliteLayer);
    hybridLayer.addTo(map);
    currentLayer = "hybrid";
  } else {
    map.removeLayer(hybridLayer);
    satelliteLayer.addTo(map);
    currentLayer = "satellite";
  }
}

// -------------------------
// GET ADDRESS
// -------------------------

async function getAddress(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;

    const response = await fetch(url);

    const data = await response.json();

    const address =
      data.display_name || "Manzil topilmadi";

    document.getElementById("address").innerText = address;

    document.getElementById("modalAddress").value =
      address;

  } catch (error) {
    console.log(error);

    document.getElementById("address").innerText =
      "Aniqlanmadi";
  }
}

// -------------------------
// UPDATE PANEL
// -------------------------

function updateBottomPanel(lat, lng) {
  document.getElementById("latitude").innerText =
    lat.toFixed(6);

  document.getElementById("longitude").innerText =
    lng.toFixed(6);
}

// -------------------------
// SEARCH LOCATION
// -------------------------

async function searchLocation() {
  const query =
    document.getElementById("searchInput").value;

  if (!query) return;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}`;

    const response = await fetch(url);

    const data = await response.json();

    if (data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

      map.setView([lat, lng], 14);

      if (currentMarker) {
        map.removeLayer(currentMarker);
      }

      currentMarker = L.marker([lat, lng]).addTo(map);

      updateBottomPanel(lat, lng);

      await getAddress(lat, lng);
    }

  } catch (error) {
    console.log(error);
  }
}

// -------------------------
// GROUPS
// -------------------------

function saveGroup() {
  const name =
    document.getElementById("groupName").value;

  if (!name) return;

  groups.push(name);

  localStorage.setItem(
    "hetk_groups",
    JSON.stringify(groups)
  );

  renderGroups();

  document.getElementById("groupName").value = "";
}

function renderGroups() {
  const container =
    document.getElementById("groupsList");

  const select =
    document.getElementById("locationGroup");

  if (!container || !select) return;

  container.innerHTML = "";
  select.innerHTML = "";

  groups.forEach((group) => {
    const item = document.createElement("div");

    item.className = "group-item";

    item.innerHTML = `
      <span>${group}</span>
    `;

    container.appendChild(item);

    const option = document.createElement("option");

    option.value = group;
    option.innerText = group;

    select.appendChild(option);
  });
}

// -------------------------
// SAVE LOCATION
// -------------------------

function saveLocation() {
  const name =
    document.getElementById("locationName").value;

  const phone =
    document.getElementById("locationPhone").value;

  const note =
    document.getElementById("locationNote").value;

  const group =
    document.getElementById("locationGroup").value;

  if (!name || !selectedLat || !selectedLng)
    return;

  const item = {
    id: Date.now(),
    name,
    phone,
    note,
    group,
    lat: selectedLat,
    lng: selectedLng,
  };

  locations.push(item);

  localStorage.setItem(
    "hetk_locations",
    JSON.stringify(locations)
  );

  renderSavedLocations();

  closeSaveModal();

  clearModal();
}

// -------------------------
// RENDER MARKERS
// -------------------------

function renderSavedLocations() {
  markersLayer.clearLayers();

  locations.forEach((item) => {
    const marker = L.marker([
      item.lat,
      item.lng,
    ]).addTo(markersLayer);

    marker.bindPopup(`
      <div style="min-width:200px">
        <h3>${item.name}</h3>
        <p>${item.phone || ""}</p>
        <p>${item.note || ""}</p>
        <small>${item.group || ""}</small>
      </div>
    `);
  });
}

// -------------------------
// COPY COORDINATES
// -------------------------

function copyCoordinates() {
  const lat =
    document.getElementById("latitude").innerText;

  const lng =
    document.getElementById("longitude").innerText;

  navigator.clipboard.writeText(`${lat}, ${lng}`);
}

// -------------------------
// SHARE
// -------------------------

function shareLocation() {
  const lat =
    document.getElementById("latitude").innerText;

  const lng =
    document.getElementById("longitude").innerText;

  const url =
    `https://maps.google.com/?q=${lat},${lng}`;

  navigator.share({
    title: "Lokatsiya",
    text: url,
  });
}

// -------------------------
// MODAL
// -------------------------

function openSaveModal() {
  document
    .getElementById("saveModal")
    .classList.add("active");
}

function closeSaveModal() {
  document
    .getElementById("saveModal")
    .classList.remove("active");
}

// -------------------------
// CLEAR MODAL
// -------------------------

function clearModal() {
  document.getElementById("locationName").value = "";
  document.getElementById("locationPhone").value = "";
  document.getElementById("locationNote").value = "";
}

// -------------------------
// SIDEBAR
// -------------------------

function openSidebar() {
  document
    .getElementById("sidebar")
    .classList.add("active");

  refreshMap();
}

function closeSidebar() {
  document
    .getElementById("sidebar")
    .classList.remove("active");

  refreshMap();
}

// -------------------------
// INIT
// -------------------------

window.onload = () => {
  initMap();

  renderGroups();
};
