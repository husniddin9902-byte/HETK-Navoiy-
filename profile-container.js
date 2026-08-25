(function(){ 
    'use strict';

    function getModal(){
        return document.getElementById('profile-container');
    }

    function setProfileOpen(open){
        const modal = getModal();
        if(!modal) return;
        modal.style.display = open ? 'flex' : 'none';
        modal.setAttribute('aria-hidden', open ? 'false' : 'true');
        document.body.classList.toggle('hetk-profile-open', open);

        if(!open){
            const moreMenu = document.getElementById('profile-more-menu');
            const moreBtn = document.getElementById('profile-more');
            if(moreMenu) moreMenu.hidden = true;
            if(moreBtn) moreBtn.setAttribute('aria-expanded', 'false');
        }
    }

    function activateTab(tabName){
        document.querySelectorAll('.hetk-profile-tab').forEach(btn => {
            const active = btn.dataset.profileTab === tabName;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        document.querySelectorAll('.hetk-profile-pane').forEach(pane => {
            const active = pane.dataset.profilePane === tabName;
            pane.classList.toggle('active', active);
            pane.hidden = !active;
        });
    }

    function bindProfileEvents(){
        const modal = getModal();
        const menuBtn = document.getElementById('menu-btn');
        const closeBtn = document.getElementById('profile-close');
        const moreBtn = document.getElementById('profile-more');
        const moreMenu = document.getElementById('profile-more-menu');
        const moreClose = document.getElementById('profile-more-close');

        if(!modal || !menuBtn){
            console.error('Profil: #profile-container yoki #menu-btn topilmadi.');
            return;
        }

        if(menuBtn.dataset.profileBound === '1') return;
        menuBtn.dataset.profileBound = '1';

        menuBtn.addEventListener('click', function(){
            setProfileOpen(true);
        });

        if(closeBtn){
            closeBtn.addEventListener('click', function(){
                setProfileOpen(false);
            });
        }

        if(moreClose){
            moreClose.addEventListener('click', function(){
                setProfileOpen(false);
            });
        }

        if(moreBtn && moreMenu){
            moreBtn.addEventListener('click', function(event){
                event.stopPropagation();
                const willOpen = moreMenu.hidden;
                moreMenu.hidden = !willOpen;
                moreBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
        }

        document.querySelectorAll('.hetk-profile-tab').forEach(btn => {
            btn.addEventListener('click', function(){
                activateTab(btn.dataset.profileTab);
            });
        });

        document.querySelectorAll('.profile-tree-toggle').forEach(btn => {
            btn.addEventListener('click', function(){
                const node = btn.closest('.hetk-profile-tree-node');
                if(!node) return;
                const collapsed = node.classList.toggle('is-collapsed');
                btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
            });
        });

        document.querySelectorAll('.profile-employee-row').forEach(row => {
            row.addEventListener('click', function(){
                document.querySelectorAll('.profile-employee-row').forEach(item => item.classList.remove('is-selected'));
                row.classList.add('is-selected');

                const name = row.dataset.name || row.dataset.role || "Xodim ma'lumoti";
                const role = row.dataset.role || '—';
                const region = row.dataset.region || '—';
                const nameEl = document.getElementById('profile-detail-name');
                const roleEl = document.getElementById('profile-detail-role');
                const regionEl = document.getElementById('profile-detail-region');
                if(nameEl) nameEl.textContent = name;
                if(roleEl) roleEl.textContent = role;
                if(regionEl) regionEl.textContent = region;
            });
        });

        modal.addEventListener('click', function(event){
            if(event.target === modal) setProfileOpen(false);
        });

        document.addEventListener('click', function(event){
            if(moreMenu && moreBtn && !moreMenu.hidden && !moreMenu.contains(event.target) && !moreBtn.contains(event.target)){
                moreMenu.hidden = true;
                moreBtn.setAttribute('aria-expanded', 'false');
            }
        });

        document.addEventListener('keydown', function(event){
            if(event.key === 'Escape' && modal.style.display !== 'none'){
                setProfileOpen(false);
            }
        });

        activateTab('employees');
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', bindProfileEvents);
    } else {
        bindProfileEvents();
    }

    window.openProfileModule = function(){ setProfileOpen(true); };
    window.closeProfileModule = function(){ setProfileOpen(false); };
})();
