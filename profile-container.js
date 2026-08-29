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
        if(!tabName) return;
        document.querySelectorAll('.hetk-profile-tab').forEach(btn => {
            const active = btn.dataset.profileTab === tabName;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        document.querySelectorAll('.hetk-profile-pane').forEach(pane => {
            const active = pane.dataset.profilePane === tabName;
            pane.classList.toggle('active', active);
            pane.hidden = !active;
            pane.style.display = active ? '' : 'none';
        });
    }

    function bindProfileEvents(){
        const modal = getModal();
        const menuBtn = document.getElementById('menu-btn');
        const closeBtn = document.getElementById('profile-close');
        const moreBtn = document.getElementById('profile-more');
        const moreMenu = document.getElementById('profile-more-menu');
        const moreClose = document.getElementById('profile-more-close');

        if(!modal){
            console.error('Profil: #profile-container topilmadi.');
            return;
        }

        // Tablar qayta chizilsa ham ishlaydigan ishonchli delegatsiya.
        if(document.documentElement.dataset.profileTabCaptureBound !== '1'){
            document.documentElement.dataset.profileTabCaptureBound = '1';
            document.addEventListener('click', function(event){
                const tab = event.target && event.target.closest ? event.target.closest('.hetk-profile-tab') : null;
                if(!tab) return;
                event.preventDefault();
                activateTab(tab.dataset.profileTab);
            }, true);
        }

        if(menuBtn && document.documentElement.dataset.profileCaptureBound !== '1'){
            document.documentElement.dataset.profileCaptureBound = '1';
            document.addEventListener('click', function(event){
                const trigger = event.target && event.target.closest ? event.target.closest('#menu-btn') : null;
                if(trigger) setProfileOpen(true);
            }, true);
        }

        // Qolgan hodisalar faqat bir marta ulanadi; tab delegatsiyasi bundan mustaqil.
        if(modal.dataset.profileModalBound === '1') return;
        modal.dataset.profileModalBound = '1';

        if(menuBtn){
            menuBtn.addEventListener('click', function(){ setProfileOpen(true); });
        }

        if(closeBtn) closeBtn.addEventListener('click', function(){ setProfileOpen(false); });
        if(moreClose) moreClose.addEventListener('click', function(){ setProfileOpen(false); });

        if(moreBtn && moreMenu){
            moreBtn.addEventListener('click', function(event){
                event.stopPropagation();
                const willOpen = moreMenu.hidden;
                moreMenu.hidden = !willOpen;
                moreBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
        }

        document.querySelectorAll('.profile-tree-toggle').forEach(btn => {
            btn.addEventListener('click', function(){
                const node = btn.closest('.hetk-profile-tree-node');
                if(!node) return;
                const collapsed = node.classList.toggle('is-collapsed');
                btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
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
            if(event.key === 'Escape' && modal.style.display !== 'none') setProfileOpen(false);
        });

        const current = document.querySelector('.hetk-profile-tab.active');
        activateTab(current ? current.dataset.profileTab : 'employees');
    }

    if(document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', bindProfileEvents);
    } else {
        bindProfileEvents();
    }

    window.openProfileModule = function(){ setProfileOpen(true); };
    window.closeProfileModule = function(){ setProfileOpen(false); };
    window.activateProfileTab = activateTab;
})();
