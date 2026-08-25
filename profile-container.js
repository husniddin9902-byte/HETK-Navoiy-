const profileModal = document.getElementById("profile-container");
const closeProfileBtn = document.getElementById("close-profile");

function openProfile() {
    if (profileModal) {
        profileModal.style.display = "flex";
    }
}

function closeProfile() {
    if (profileModal) {
        profileModal.style.display = "none";
    }
}

if (closeProfileBtn) {
    closeProfileBtn.addEventListener("click", closeProfile);
}
