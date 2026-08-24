fetch("profile-container")
.then(res => res.text())
.then(html => {
    document.getElementById("profile-container").innerHTML = html;
});
