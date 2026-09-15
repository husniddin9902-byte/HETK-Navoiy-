(function(){
  'use strict';

  const STORAGE_LANGUAGE='hetk-ui-language';
  const STORAGE_FONT='hetk-ui-font-size';
  const LANGUAGES=['uz','ru'];
  const FONT_SCALES={small:.92,normal:1,large:1.15,xlarge:1.3};
  const fontLabels={
    uz:{small:'Kichik',normal:'Odatiy',large:'Katta',xlarge:'Juda katta'},
    ru:{small:'Мелкий',normal:'Обычный',large:'Крупный',xlarge:'Очень крупный'}
  };

  const RU={
    'Boshqaruv paneli':'Панель управления','Guruhlar':'Группы','Xarita':'Карта','Joylashuvni saqlash':'Сохранить местоположение',
    'Profil':'Профиль','Profilni yopish':'Закрыть профиль','O‘quv markazi':'Учебный центр',"O'quv markazi":'Учебный центр',
    'Hodimlar':'Сотрудники','Xabarlar':'Сообщения','Fayllar':'Файлы',"Shaxsiy ma'lumotlar":'Личные данные',
    'Kirish nazorati':'Контроль входа','Faol':'Активен','Tizimdan chiqish':'Выйти из системы',
    'Sozlamalar':'Настройки','Dastur haqida':'О программе','Saqlash':'Сохранить','O‘chirish':'Удалить',"O'chirish":'Удалить',
    'Tahrirlash':'Изменить','Bekor qilish':'Отмена','Yopish':'Закрыть','Orqaga':'Назад','Kirish':'Войти','Joylashuv qo‘shish':'Добавить местоположение','Joylashuvni tahrirlash':'Редактировать местоположение',
    'Yangilash':'Обновить','Qo‘shish':'Добавить',"Qo'shish":'Добавить','Qidirish':'Поиск','Filtrlash':'Фильтр',
    'Barchasi':'Все','Barcha holatlar':'Все статусы','Barcha bo‘linmalar':'Все подразделения','Barcha ruxsatnomalar':'Все допуски',
    'Yangi hodim / admin':'Новый сотрудник / администратор','Hodimni tanlang':'Выберите сотрудника',
    'Hodimlar va ruxsatlar':'Сотрудники и права доступа','Lavozim':'Должность','Hudud':'Территория',
    'Telefon':'Телефон','Jinsi':'Пол','Erkak':'Мужчина','Ayol':'Женщина','Login':'Логин','Parol':'Пароль','Kenglik:':'Широта:','Uzunlik:':'Долгота:','Manzil:':'Адрес:','Balans:':'Баланс:',
    'Papka / hudud ruxsati':'Доступ к папке / территории','Ustalik joyi (U/J)':'Мастерский участок (У/Ж)',
    'U/J larni boshqarish':'Управление У/Ж','Tizimda faol':'Активен в системе','Bloklash':'Заблокировать',
    'Blokdan chiqarish':'Разблокировать','Vaqtinchalik o‘rinbosar':'Временный заместитель',
    'Vaqtincha topshirish':'Временно передать','Tugash sanasi noma’lum':'Дата окончания неизвестна',
    'Boshlanish sanasi':'Дата начала','Tugash sanasi':'Дата окончания','Asos':'Основание','Izoh':'Примечание',
    'Mehnat ta’tili':'Трудовой отпуск','Xizmat safari':'Командировка','Boshqa sabab':'Другая причина',
    'Umumiy ro‘yxat':'Общий список','Vositalarga qaytish':'Вернуться к средствам','Ro‘yxatga qo‘shish':'Добавить в список',
    'Faol vositalar':'Активные средства','Barcha holatlar':'Все статусы','Muddati o‘tgan':'Срок истёк',
    'Navbatdan tashqari':'Внеочередное','Sinovda':'На испытании','Omborga qaytarilgan':'Возвращено на склад',
    'Yaroqsiz / arxiv':'Непригодное / архив','Hisobot':'Отчёт','Statistika':'Статистика','Chop etish':'Печать',
    'Elementni tanlang':'Выберите элемент','Yuklanmoqda...':'Загрузка...','Ma’lumot topilmadi':'Данные не найдены',
    'Hodimni qidirish...':'Поиск сотрудника...','Papka nomini qidirish...':'Поиск папки...',
    'Element nomi bo‘yicha qidirish...':'Поиск по названию элемента...',"Element nomi bo'yicha qidirish...":'Поиск по названию элемента...','Vosita nomini qidirish':'Поиск средства',
    'Vosita yoki inventar raqami':'Средство или инвентарный номер','U/J yoki hudud nomini yozing...':'Введите У/Ж или территорию...',
    'Naryad raqami, element yoki ish bo‘yicha qidirish':'Поиск по наряду, элементу или работе',
    'Ma’lumot va ruxsatlarni ko‘rish uchun chap tomondan hodimni tanlang.':'Выберите сотрудника слева, чтобы просмотреть данные и права доступа.',
    'Lavozim, hudud va papkalarga kirish huquqlarini boshqarish.':'Управление должностями, территориями и доступом к папкам.',
    'Tanlangan papka va uning ichidagi barcha pastki papkalar ko‘rinadi.':'Будут видны выбранная папка и все вложенные папки.',
    'Master va elektromontyor doim bitta U/J ga bog‘lanadi.':'Мастер и электромонтёр всегда закрепляются за одним У/Ж.',
    'Bir U/J ga ko‘p papka, bitta papkaga bir nechta U/J biriktirish mumkin.':'К одному У/Ж можно закрепить несколько папок, а к одной папке — несколько У/Ж.'
  };

  let language=LANGUAGES.includes(localStorage.getItem(STORAGE_LANGUAGE))?localStorage.getItem(STORAGE_LANGUAGE):'uz';
  let fontSize=FONT_SCALES[localStorage.getItem(STORAGE_FONT)]?localStorage.getItem(STORAGE_FONT):'normal';
  const originalText=new WeakMap();
  const originalPlaceholder=new WeakMap();
  const fontState=new Map();
  let observer=null;
  let renderQueued=false;

  function tr(value){
    const text=String(value==null?'':value);
    return language==='ru' && RU[text] ? RU[text] : text;
  }

  function translateTextNode(node){
    if(!node || node.nodeType!==3) return;
    const current=node.nodeValue||'';
    const trimmed=current.trim();
    if(!trimmed) return;
    let source=originalText.get(node);
    if(!source || (language==='ru' && current.trim()!==tr(source))){
      source=trimmed;
      originalText.set(node,source);
    }
    const next=language==='ru'?tr(source):source;
    if(next!==trimmed)node.nodeValue=current.replace(trimmed,next);
  }

  function translateElement(el){
    if(!el || el.nodeType!==1 || el.closest('[data-hetk-no-translate]')) return;
    Array.from(el.childNodes).forEach(node=>{if(node.nodeType===3)translateTextNode(node);});
    if((el.tagName==='INPUT'||el.tagName==='TEXTAREA') && el.hasAttribute('placeholder')){
      let source=originalPlaceholder.get(el);
      const current=el.getAttribute('placeholder')||'';
      if(!source || (language==='ru' && current!==tr(source))){source=current;originalPlaceholder.set(el,source);}
      el.setAttribute('placeholder',language==='ru'?tr(source):source);
    }
  }

  function translatableElements(root){
    const selector='button,label,option,h1,h2,h3,h4,h5,h6,p,small,input[placeholder],textarea[placeholder],.hetk-profile-tab span,.hetk-profile-muted,.hetk-team-count';
    const rows=[];
    if(root.nodeType===1 && root.matches && root.matches(selector))rows.push(root);
    if(root.querySelectorAll)rows.push(...root.querySelectorAll(selector));
    return rows;
  }

  function fontElements(root){
    const selector='button,input,select,textarea,label,p,small,span,h1,h2,h3,h4,h5,h6,td,th';
    const rows=[];
    if(root.nodeType===1 && root.matches && root.matches(selector))rows.push(root);
    if(root.querySelectorAll)rows.push(...root.querySelectorAll(selector));
    return rows;
  }

  function applyFont(root){
    const scale=FONT_SCALES[fontSize]||1;
    if(scale===1){
      if(root===document){
        fontState.forEach((state,el)=>{
          if(state.inline)el.style.setProperty('font-size',state.inline,state.priority||'');
          else el.style.removeProperty('font-size');
        });
        fontState.clear();
      }
      return;
    }
    fontElements(root).forEach(el=>{
      if(el.closest('.leaflet-container,[data-hetk-no-font-scale]') || el.matches('i,.fas,.far,.fab'))return;
      if(!fontState.has(el)){
        const computed=parseFloat(getComputedStyle(el).fontSize)||14;
        fontState.set(el,{base:computed,inline:el.style.getPropertyValue('font-size'),priority:el.style.getPropertyPriority('font-size')});
      }
      const state=fontState.get(el);
      el.style.setProperty('font-size',Math.min(30,state.base*scale).toFixed(2)+'px','important');
    });
  }

  function applyInterface(root){
    translatableElements(root).forEach(translateElement);
    applyFont(root);
    document.documentElement.lang=language==='ru'?'ru':'uz';
  }

  function closeMenu(){
    const menu=document.getElementById('profile-more-menu');
    const btn=document.getElementById('profile-more');
    if(menu)menu.hidden=true;
    if(btn)btn.setAttribute('aria-expanded','false');
  }

  function labels(){
    return language==='ru'?{
      settings:'Настройки',about:'О программе',title:'Настройки интерфейса',language:'Язык интерфейса',
      font:'Размер шрифта',note:'Названия папок, элементов, У/Ж и сотрудников не переводятся.',
      close:'Закрыть',aboutTitle:'О программе HETK Monitoring',aboutText:'Единая система управления объектами электросетей, сотрудниками, средствами защиты, допусками и уведомлениями.',
      version:'Версия интерфейса: 1.0 · 2026'
    }:{
      settings:'Sozlamalar',about:'Dastur haqida',title:'Interfeys sozlamalari',language:'Interfeys tili',
      font:'Shrift o‘lchami',note:'Papka, element, U/J va hodimlarning nomlari tarjima qilinmaydi.',
      close:'Yopish',aboutTitle:'HETK Monitoring dasturi haqida',aboutText:'Elektr tarmoq obyektlari, hodimlar, himoya vositalari, ruxsatnomalar va bildirishnomalarni yagona tizimda boshqarish uchun yaratilgan.',
      version:'Interfeys versiyasi: 1.0 · 2026'
    };
  }

  function ensureStyle(){
    if(document.getElementById('hetk-ui-settings-style'))return;
    const style=document.createElement('style');
    style.id='hetk-ui-settings-style';
    style.textContent=`
      .hetk-ui-settings-overlay{position:fixed;inset:0;z-index:2100000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,18,32,.68);backdrop-filter:blur(4px)}
      .hetk-ui-settings-overlay[hidden]{display:none}.hetk-ui-settings-card{width:min(520px,100%);max-height:calc(100vh - 32px);overflow:auto;border-radius:18px;background:#f7fafc;color:#173248;box-shadow:0 24px 70px rgba(0,0,0,.35);font-family:Arial,Helvetica,sans-serif}
      .hetk-ui-settings-head{display:flex;align-items:center;justify-content:space-between;padding:17px 18px;background:#00233b;color:#fff}.hetk-ui-settings-head h3{margin:0;font-size:18px}.hetk-ui-settings-close{width:38px;height:38px;border:0;border-radius:50%;background:#16425e;color:#fff;cursor:pointer}
      .hetk-ui-settings-body{padding:18px;display:grid;gap:18px}.hetk-ui-setting-group h4{margin:0 0 9px;font-size:13px;color:#557086}.hetk-ui-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.hetk-ui-font-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
      .hetk-ui-choice{min-height:48px;border:1px solid #d7e3ec;border-radius:11px;background:#fff;color:#35546b;font-weight:800;cursor:pointer}.hetk-ui-choice.active{border-color:#1687ff;background:#eaf5ff;color:#0872d1;box-shadow:0 0 0 2px rgba(22,135,255,.1)}
      .hetk-ui-settings-note{margin:0;padding:11px;border-radius:10px;background:#edf4f8;color:#657f92;font-size:11px;line-height:1.5}.hetk-ui-about{padding:15px;border:1px solid #dbe7ef;border-radius:13px;background:#fff}.hetk-ui-about h4{margin:0 0 7px;color:#173b55}.hetk-ui-about p{margin:0;color:#607b8e;line-height:1.55;font-size:12px}.hetk-ui-about small{display:block;margin-top:9px;color:#8a9da9}
      .hetk-ui-settings-foot{display:flex;justify-content:flex-end;padding:13px 18px;border-top:1px solid #dce6ed}.hetk-ui-settings-done{min-height:42px;padding:0 22px;border:0;border-radius:10px;background:#1687ff;color:#fff;font-weight:800;cursor:pointer}
      .hetk-profile-more-menu button i{width:22px;color:#1687ff}
      @media(max-width:540px){.hetk-ui-font-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hetk-ui-settings-overlay{align-items:flex-end;padding:0}.hetk-ui-settings-card{width:100%;max-height:88vh;border-radius:18px 18px 0 0}}
    `;
    document.head.appendChild(style);
  }

  function renderDialog(showAbout){
    const l=labels();
    let overlay=document.getElementById('hetk-ui-settings-overlay');
    if(!overlay){overlay=document.createElement('div');overlay.id='hetk-ui-settings-overlay';overlay.className='hetk-ui-settings-overlay';overlay.dataset.hetkNoTranslate='1';document.body.appendChild(overlay);}
    overlay.innerHTML=`<section class="hetk-ui-settings-card" role="dialog" aria-modal="true">
      <header class="hetk-ui-settings-head"><h3><i class="fas fa-sliders-h"></i> ${l.title}</h3><button class="hetk-ui-settings-close" type="button" data-ui-close aria-label="${l.close}"><i class="fas fa-times"></i></button></header>
      <div class="hetk-ui-settings-body">
        <section class="hetk-ui-setting-group"><h4>${l.language}</h4><div class="hetk-ui-choice-grid"><button class="hetk-ui-choice ${language==='uz'?'active':''}" data-ui-language="uz">O‘zbekcha</button><button class="hetk-ui-choice ${language==='ru'?'active':''}" data-ui-language="ru">Русский</button></div></section>
        <section class="hetk-ui-setting-group"><h4>${l.font}</h4><div class="hetk-ui-choice-grid hetk-ui-font-grid">${Object.keys(FONT_SCALES).map(key=>`<button class="hetk-ui-choice ${fontSize===key?'active':''}" data-ui-font="${key}">${fontLabels[language][key]}</button>`).join('')}</div></section>
        <p class="hetk-ui-settings-note"><i class="fas fa-circle-info"></i> ${l.note}</p>
        ${showAbout?`<section class="hetk-ui-about"><h4>${l.aboutTitle}</h4><p>${l.aboutText}</p><small>${l.version}</small></section>`:''}
      </div><footer class="hetk-ui-settings-foot"><button class="hetk-ui-settings-done" type="button" data-ui-close>${l.close}</button></footer>
    </section>`;
    overlay.hidden=false;
    overlay.querySelectorAll('[data-ui-close]').forEach(btn=>btn.addEventListener('click',()=>{overlay.hidden=true;}));
    overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.hidden=true;},{once:true});
    overlay.querySelectorAll('[data-ui-language]').forEach(btn=>btn.addEventListener('click',()=>setLanguage(btn.dataset.uiLanguage,showAbout)));
    overlay.querySelectorAll('[data-ui-font]').forEach(btn=>btn.addEventListener('click',()=>setFontSize(btn.dataset.uiFont,showAbout)));
  }

  function ensureMenu(){
    const menu=document.getElementById('profile-more-menu');
    if(!menu)return;
    let settings=document.getElementById('hetk-ui-settings-button');
    if(!settings){settings=document.createElement('button');settings.id='hetk-ui-settings-button';settings.type='button';settings.addEventListener('click',()=>{closeMenu();renderDialog(false);});menu.prepend(settings);}
    let about=document.getElementById('hetk-ui-about-button');
    if(!about){about=document.createElement('button');about.id='hetk-ui-about-button';about.type='button';about.addEventListener('click',()=>{closeMenu();renderDialog(true);});settings.after(about);}
    const l=labels();
    settings.innerHTML=`<i class="fas fa-sliders-h"></i> ${l.settings}`;
    about.innerHTML=`<i class="fas fa-circle-info"></i> ${l.about}`;
  }

  function setLanguage(next,showAbout){
    if(!LANGUAGES.includes(next))return;
    language=next;localStorage.setItem(STORAGE_LANGUAGE,next);
    applyInterface(document);ensureMenu();renderDialog(!!showAbout);
    document.dispatchEvent(new CustomEvent('hetk-language-changed',{detail:{language}}));
  }

  function setFontSize(next,showAbout){
    if(!FONT_SCALES[next])return;
    if(fontSize!=='normal')applyFont(document);
    fontSize=next;localStorage.setItem(STORAGE_FONT,next);
    applyFont(document);renderDialog(!!showAbout);
    document.dispatchEvent(new CustomEvent('hetk-font-size-changed',{detail:{fontSize,scale:FONT_SCALES[next]}}));
  }

  function queueApply(nodes){
    if(renderQueued)return;renderQueued=true;
    requestAnimationFrame(()=>{renderQueued=false;nodes.forEach(node=>{if(node&&node.isConnected)applyInterface(node);});ensureMenu();});
  }

  function init(){
    ensureStyle();ensureMenu();applyInterface(document);
    observer=new MutationObserver(records=>{
      const nodes=[];records.forEach(record=>{
        if(record.type==='characterData' && record.target.parentElement)nodes.push(record.target.parentElement);
        record.addedNodes.forEach(node=>{
          if(node.nodeType===1)nodes.push(node);
          else if(node.nodeType===3 && node.parentElement)nodes.push(node.parentElement);
        });
      });
      if(nodes.length)queueApply(nodes);
    });
    observer.observe(document.body,{childList:true,characterData:true,subtree:true});
  }

  window.HETKUISettings={getLanguage:()=>language,getFontSize:()=>fontSize,setLanguage,setFontSize,tr};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
