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
    'Bir U/J ga ko‘p papka, bitta papkaga bir nechta U/J biriktirish mumkin.':'К одному У/Ж можно закрепить несколько папок, а к одной папке — несколько У/Ж.',

    // Xabarlar va profil
    'Xabarlar markazi':'Центр сообщений','Hududdagi o‘zgarishlar, tasdiqlashlar va shaxsiy yozishmalar.':'Изменения на территории, согласования и личная переписка.',
    'Barchasini o‘qildi qilish':'Отметить всё прочитанным','Bildirishnomalar':'Уведомления','Tasdiqlashlar':'Согласования',
    'Qabul qilingan va yuborilgan xabarlar.':'Полученные и отправленные сообщения.','Yangi xabar yozish':'Новое сообщение','Panelni yopish':'Закрыть панель',
    'Xabarlar yo‘q':'Сообщений нет','Yangi xabarlar shu yerda chiqadi.':'Новые сообщения появятся здесь.',
    'XTB · I guruh':'ЭБ · I группа','Imtihon muddatlari kiritilmagan':'Сроки экзаменов не указаны',

    // Yuqori tugmalar
    'Himoya vositalari':'Средства защиты','Naryadlar':'Наряды','Hisob, sinov va nazorat':'Учёт, испытания и контроль',

    // Chop etish
    'Tanlangan manba':'Выбранный источник','1. Formatni tanlang':'1. Выберите формат','2. Ma’lumotlarni tanlang':'2. Выберите данные',
    '3. Rasmlar':'3. Изображения','4. Qog‘oz':'4. Бумага','Rasmsiz':'Без изображений','Asosiy rasm':'Основное изображение',
    'Barcha rasmlar':'Все изображения','A4 tik':'A4 книжная','A4 yotiq':'A4 альбомная','Ko‘rinish oldindan':'Предварительный вид',
    'Ko‘rib chiqish':'Предпросмотр','Faylni tayyorlash':'Подготовить файл','Chop etishdan oldin ko‘rish':'Предпросмотр перед печатью',
    '1-papka (Fider)':'1-я папка (Фидер)','Nomi':'Название','Quvvati':'Мощность','Mahalla':'Махалля','Texnik holati':'Техническое состояние',
    'Koordinata':'Координаты','Ishga tushirilgan':'Введён в эксплуатацию','Ta’mirlar':'Ремонты','Balans hisoblagich':'Балансовый счётчик',
    'Konsentrator':'Концентратор','Xususiy korxona':'Частное предприятие','Korxona vakili':'Представитель предприятия',
    'Korxona telefoni':'Телефон предприятия','Yaratilgan sana':'Дата создания','Oxirgi tahrir':'Последнее изменение',

    // Tezkor va bosh administrator statistikasi
    'Tezkor statistika':'Краткая статистика','Jami element':'Всего элементов','ETK balansi':'Баланс ЭТК','Xususiy balans':'Частный баланс',
    'Hozir onlayn':'Сейчас онлайн','Ustalik joylari kesimida':'По мастерским участкам','Bu hududda U/J topilmadi.':'На этой территории У/Ж не найден.',
    'Bosh administrator statistikasi':'Статистика главного администратора','Elementlar, U/J lar va tizimdan foydalanish ko‘rsatkichlari.':'Показатели элементов, У/Ж и использования системы.',
    'Jami hodim':'Всего сотрудников','Hozirgi aniq son':'Текущее точное количество','TP/KTP umumiy quvvati':'Общая мощность ТП/КТП',
    'Barcha element quvvati kiritilgan':'Мощность указана для всех элементов','Onlayn':'Онлайн','So‘nggi 2,5 daqiqa':'За последние 2,5 минуты',
    'Faol vaqt':'Активное время','Balans tarkibi':'Структура баланса','U/J kesimida':'По У/Ж','Test statistikasini nolga qaytarish':'Сбросить тестовую статистику',
    'Faqat kirishlar va faol vaqt tarixi o‘chadi. Elementlar, hodimlar, U/J va onlayn holat o‘chmaydi.':'Удалится только история входов и активного времени. Элементы, сотрудники, У/Ж и онлайн-статус сохранятся.',
    'Kodni o‘rnatish':'Установить код','Nolga qaytarish':'Сбросить',

    // Himoya vositalari
    'Vositalar':'Средства','Ombor':'Склад','Me’yor':'Норма','Hisobot':'Отчёт','Tarix':'История',
    'Vosita turi bo‘yicha alohida statistika':'Статистика по отдельному виду средства защиты',
    'Tanlangan bitta himoya vositasining kirimi, ombor qoldig‘i, foydalanilishi va arxivi ko‘rsatiladi.':'Показаны поступление, остаток на складе, использование и архив выбранного средства защиты.',
    'Barcha himoya vositalari — umumiy':'Все средства защиты — сводно','Barcha viloyatlar':'Все области','Barcha tumanlar':'Все районы',
    'Jami kirim':'Всего поступило','Foydalanishda':'В эксплуатации','Viloyat omborida':'На областном складе','Arxivda':'В архиве',
    'Barcha himoya vositalari':'Все средства защиты','Barcha turlar jamlanmasi · nazorat talab qiladigan: 0 ta':'Все виды сводно · требуют контроля: 0',
    'Bo‘linmalar kesimi':'По подразделениям','Tumanlar kesimi':'По районам','Viloyatlar kesimi':'По областям',
    'Me’yoriy ta’minot nazorati':'Контроль нормативного обеспечения',
    'U/J va dispetcherliklar respublika bo‘yicha belgilangan ikkita yagona me’yor bilan solishtiriladi. Qurilish brigadasiga me’yor qo‘llanmaydi.':'У/Ж и диспетчерские сравниваются с двумя едиными нормативами по республике. Для строительной бригады норматив не применяется.',
    'Umumiy me’yorlar':'Общие нормативы','U/J va dispetcherlik':'У/Ж и диспетчерские','Faqat U/J':'Только У/Ж','Faqat dispetcherlik':'Только диспетчерские',
    'Tekshirilgan bo‘linma':'Проверено подразделений','Me’yori to‘liq':'Норма полностью обеспечена','Jami yetishmaydi':'Всего не хватает',
    'Belgilangan me’yor':'Установленная норма','Faol va arxiv holati':'Активные и архивные','Vositalar bo‘yicha ta’minot':'Обеспечение по средствам',
    'mavjud':'имеется','kam':'не хватает','Nazorat talab qiladi':'Требует контроля','Vosita turi':'Вид средства','Mavjud':'Имеется',
    'Barcha bo‘linmalar':'Все подразделения','Amalda':'Действует','10 kun ichida':'В течение 10 дней',
    'Vosita biriktirish':'Закрепить средство','Ko‘p vositani birdan berish':'Выдать несколько средств сразу','Omborga kirim':'Поступление на склад',
    'Viloyat omboriga kirim':'Поступление на областной склад','Sinov natijasi':'Результат испытания','Uzaytirish yoki almashtirish':'Продлить или заменить',
    'Vositalar bo‘yicha qoldiq':'Остатки по средствам','Har bir vosita turi bitta satrda ko‘rsatiladi.':'Каждый вид средства показан отдельной строкой.',

    // Kirish nazorati
    'Kirish va qurilmalar nazorati':'Контроль входов и устройств','Kim, qachon, qaysi qurilma va GPS joylashuvdan kirganini kuzatish.':'Контроль того, кто, когда, с какого устройства и GPS-местоположения вошёл.',
    'Hozir saytda':'Сейчас на сайте','Bugungi kirishlar':'Входы сегодня','Foydalanuvchilar':'Пользователи','Qurilmalar':'Устройства',
    'Oxirgi 24 soat':'Последние 24 часа','Oxirgi 7 kun':'Последние 7 дней','Oxirgi 30 kun':'Последние 30 дней','Oxirgi 90 kun':'Последние 90 дней',
    'Barcha tarix':'Вся история','Tanaffusda':'Неактивен','Chiqib ketgan':'Вышел','Kirishlar yuklanmoqda...':'Загрузка истории входов...',
    'Hodim, login, hudud yoki qurilma...':'Сотрудник, логин, территория или устройство...','HODIM':'СОТРУДНИК','KIRGAN VAQT':'ВРЕМЯ ВХОДА',
    'QURILMA':'УСТРОЙСТВО','KIRISH JOYI':'МЕСТО ВХОДА','SAYTDA BO‘LGAN':'ВРЕМЯ НА САЙТЕ','HOLATI':'СТАТУС',

    // Qidiruv va filtr
    'Qidiruv turi':'Тип поиска','Xususiy bo‘lsa':'Для частного объекта','Korxona (F/X) nomi':'Название предприятия (Ф/Х)',
    'Egasining telefoni':'Телефон владельца','Egasining ism-sharifi':'Ф.И.О. владельца','Hisoblagich raqami':'Номер счётчика',
    'Barcha maydonlarda':'Во всех полях','Filtr':'Фильтр','Filtr tanlanmagan':'Фильтр не выбран','Hammasi':'Все',
    'ETK balansda':'На балансе ЭТК','Xususiy balansda':'На частном балансе','Oxirgi yangilangan':'Последнее обновление',
    'Oxirgi 1 sutka':'Последние сутки','Oxirgi izoh':'Последнее примечание','Oxirgi 1 soat':'Последний час','Oxirgi 24 soat':'Последние 24 часа',
    'Izoh mavjud':'Есть примечание',"Izoh yo'q":'Нет примечания',"Ikki tomonlama ta'minlangan":'Двустороннее питание','Ha':'Да',"Yo'q":'Нет',
    'Quvvat':'Мощность','Boshqa...':'Другое...','🟢 A’lo':'🟢 Отличное',"🟢 A'lo":'🟢 Отличное','🟡 Qoniqarli':'🟡 Удовлетворительное','🔴 Avariya holatida':'🔴 Аварийное состояние',
    'Tozalash':'Очистить','Qo‘llash':'Применить',"Qo'llash":'Применить'
  };

  const RU_PATTERNS=[
    [/^(\d+) ta element$/,(_,n)=>`${n} элементов`],
    [/^(\d+) ta xabar$/,(_,n)=>`${n} сообщений`],
    [/^(\d+) ta U\/J$/,(_,n)=>`${n} У/Ж`],
    [/^(\d+) ta bo‘linma$/,(_,n)=>`${n} подразделений`],
    [/^Jami (\d+)$/,(_,n)=>`Всего ${n}`],
    [/^Xususiy (\d+)$/,(_,n)=>`Частный ${n}`],
    [/^(\d+) ta faol$/,(_,n)=>`${n} активных`],
    [/^(\d+) ta jami$/,(_,n)=>`Всего ${n}`],
    [/^(\d+) hodim · (\d+) kirish$/,(_,a,b)=>`${a} сотрудников · ${b} входов`],
    [/^(\d+) soat (\d+) daq\.?$/,(_,h,m)=>`${h} ч ${m} мин`],
    [/^(\d+) daqiqa$/,(_,n)=>`${n} минут`],
    [/^Barcha turlar jamlanmasi · nazorat talab qiladigan: (\d+) ta$/,(_,n)=>`Все виды сводно · требуют контроля: ${n}`],
    [/^(\d{4}-\d{2}) faolligi$/,(_,date)=>`Активность за ${date}`],
    [/^Tanlangan oyda yaratilgan elementlar: (\d+)$/,(_,n)=>`Элементы, созданные в выбранном месяце: ${n}`],
    [/^(.*) — (\d+) turdagi vosita kam$/,(_,name,n)=>`${name} — не хватает средств ${n} видов`]
  ];

  let language=LANGUAGES.includes(localStorage.getItem(STORAGE_LANGUAGE))?localStorage.getItem(STORAGE_LANGUAGE):'uz';
  let fontSize=FONT_SCALES[localStorage.getItem(STORAGE_FONT)]?localStorage.getItem(STORAGE_FONT):'normal';
  const originalText=new WeakMap();
  const originalPlaceholder=new WeakMap();
  const fontState=new Map();
  let observer=null;
  let renderQueued=false;
  let appInfo={phone:'',telegram:''};
  let appInfoRef=null;
  let contactNotice='';

  function tr(value){
    const text=String(value==null?'':value);
    if(language!=='ru')return text;
    if(RU[text])return RU[text];
    const decorated=text.match(/^([^\p{L}\p{N}]+)(.+)$/u);
    if(decorated && RU[decorated[2]])return decorated[1]+RU[decorated[2]];
    for(const row of RU_PATTERNS){if(row[0].test(text))return text.replace(row[0],row[1]);}
    return text;
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
    ['title','aria-label'].forEach(attrName=>{
      if(!el.hasAttribute(attrName))return;
      const dataName=attrName==='title'?'hetkOriginalTitle':'hetkOriginalAria';
      let source=el.dataset[dataName];
      const current=el.getAttribute(attrName)||'';
      if(!source || (language==='ru' && current!==tr(source))){source=current;el.dataset[dataName]=source;}
      el.setAttribute(attrName,language==='ru'?tr(source):source);
    });
  }

  function translatableElements(root){
    const selector='button,label,option,legend,summary,h1,h2,h3,h4,h5,h6,p,small,span,strong,b,th,td,input[placeholder],textarea[placeholder],[title],[aria-label],.header-title,#search-type-panel div,#filter-panel div,.hetk-profile-muted,.hetk-team-count';
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

  function esc(value){
    return String(value==null?'':value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function isSuperAdmin(){
    const user=window.HETKAuth&&window.HETKAuth.currentUser;
    return !!(user && user.role==='super_admin');
  }

  function telegramLink(value){
    let raw=String(value||'').trim();
    if(!raw)return '';
    raw=raw.replace(/^https?:\/\/(www\.)?t\.me\//i,'').replace(/^t\.me\//i,'').replace(/^@/,'').replace(/^\/+|\/+$/g,'');
    if(!/^[A-Za-z0-9_]{5,64}$/.test(raw))return '';
    return 'https://t.me/'+raw;
  }

  function telegramLabel(value){
    const link=telegramLink(value);
    return link?'@'+link.split('/').pop():'';
  }

  function phoneLink(value){
    const clean=String(value||'').replace(/[^\d+]/g,'');
    return clean.length>=7?'tel:'+clean:'';
  }

  function startAppInfo(){
    if(appInfoRef || typeof firebase==='undefined' || !firebase.apps || !firebase.apps.length)return;
    try{
      appInfoRef=firebase.database().ref('SystemSettings/appInfo');
      appInfoRef.on('value',snapshot=>{
        appInfo=Object.assign({phone:'',telegram:''},snapshot.val()||{});
        const open=document.getElementById('hetk-ui-settings-overlay');
        if(open && !open.hidden && open.dataset.showAbout==='1')renderDialog(true,open.dataset.editAbout==='1');
      },error=>console.warn('Dastur aloqa ma’lumotlari yuklanmadi:',error&&error.message));
    }catch(error){console.warn('Dastur aloqa ma’lumotlari ulanmagan:',error&&error.message);}
  }

  function stopAppInfo(){
    if(appInfoRef){appInfoRef.off();appInfoRef=null;}
  }

  function labels(){
    return language==='ru'?{
      settings:'Настройки',about:'О программе',title:'Настройки интерфейса',language:'Язык интерфейса',
      font:'Размер шрифта',note:'Названия папок, элементов, У/Ж и сотрудников не переводятся.',
      close:'Закрыть',aboutTitle:'О программе HETK Monitoring',aboutText:'Единая система управления объектами электросетей, сотрудниками, средствами защиты, допусками и уведомлениями.',
      version:'Версия интерфейса: 1.0 · 2026',suggestions:'Связь с автором программы: предложения и замечания',
      phone:'Телефон',telegram:'Telegram',notSet:'Не указано',editContact:'Изменить контакты',saveContact:'Сохранить контакты',
      contactHelp:'Эти данные видят все сотрудники. Изменять их может только главный администратор.',
      phoneHint:'Например: +998 90 123 45 67',telegramHint:'Например: @username или t.me/username',saved:'Контактные данные сохранены.'
    }:{
      settings:'Sozlamalar',about:'Dastur haqida',title:'Interfeys sozlamalari',language:'Interfeys tili',
      font:'Shrift o‘lchami',note:'Papka, element, U/J va hodimlarning nomlari tarjima qilinmaydi.',
      close:'Yopish',aboutTitle:'HETK Monitoring dasturi haqida',aboutText:'Elektr tarmoq obyektlari, hodimlar, himoya vositalari, ruxsatnomalar va bildirishnomalarni yagona tizimda boshqarish uchun yaratilgan.',
      version:'Interfeys versiyasi: 1.0 · 2026',suggestions:'Dastur muallifi bilan aloqa: taklif yoki e’tirozlar uchun',
      phone:'Telefon',telegram:'Telegram',notSet:'Kiritilmagan',editContact:'Aloqa ma’lumotlarini tahrirlash',saveContact:'Aloqa ma’lumotlarini saqlash',
      contactHelp:'Bu ma’lumotlarni barcha hodimlar ko‘radi. Faqat Bosh administrator o‘zgartira oladi.',
      phoneHint:'Masalan: +998 90 123 45 67',telegramHint:'Masalan: @username yoki t.me/username',saved:'Aloqa ma’lumotlari saqlandi.'
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
      .hetk-ui-about-contact{display:grid;gap:9px;margin-top:14px;padding-top:13px;border-top:1px solid #e3ebf1}.hetk-ui-about-contact>h5{margin:0;color:#234a65;font-size:12px}.hetk-ui-contact-row{display:grid;grid-template-columns:34px minmax(0,1fr);gap:9px;align-items:center;padding:9px 10px;border-radius:10px;background:#f3f8fc}.hetk-ui-contact-row>i{width:34px;height:34px;display:flex;align-items:center;justify-content:center;border-radius:9px;background:#dff0ff;color:#0878dc}.hetk-ui-contact-row span{display:block;color:#8295a4;font-size:9px;margin-bottom:2px}.hetk-ui-contact-row b,.hetk-ui-contact-row a{color:#21445d;font-size:11px;font-weight:800;text-decoration:none;overflow-wrap:anywhere}.hetk-ui-contact-row a:hover{text-decoration:underline;color:#0878dc}.hetk-ui-contact-edit{width:100%;min-height:40px;border:1px solid #bdd9ee;border-radius:9px;background:#eaf5ff;color:#0874ce;font-weight:800;cursor:pointer}.hetk-ui-contact-help{font-size:9px!important;color:#8193a0!important}.hetk-ui-contact-form{display:grid;gap:10px;margin-top:12px}.hetk-ui-contact-form label{display:grid;gap:5px;color:#587184;font-size:10px;font-weight:800}.hetk-ui-contact-form input{box-sizing:border-box;width:100%;height:42px;border:1px solid #d4e1ea;border-radius:9px;background:#fbfdff;color:#213f55;padding:0 11px;outline:none}.hetk-ui-contact-form input:focus{border-color:#1687ff;box-shadow:0 0 0 2px rgba(22,135,255,.1)}.hetk-ui-contact-actions{display:flex;gap:8px}.hetk-ui-contact-actions button{flex:1;min-height:40px;border:0;border-radius:9px;font-weight:800;cursor:pointer}.hetk-ui-contact-actions .cancel{background:#eaf0f4;color:#587184}.hetk-ui-contact-actions .save{background:#1687ff;color:#fff}.hetk-ui-contact-status{min-height:15px;font-size:9px;color:#198754}.hetk-ui-contact-status.error{color:#c43d3d}
      .hetk-ui-settings-foot{display:flex;justify-content:flex-end;padding:13px 18px;border-top:1px solid #dce6ed}.hetk-ui-settings-done{min-height:42px;padding:0 22px;border:0;border-radius:10px;background:#1687ff;color:#fff;font-weight:800;cursor:pointer}
      .hetk-profile-more-menu button i{width:22px;color:#1687ff}
      @media(max-width:540px){.hetk-ui-font-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.hetk-ui-settings-overlay{align-items:flex-end;padding:0}.hetk-ui-settings-card{width:100%;max-height:88vh;border-radius:18px 18px 0 0}}
    `;
    document.head.appendChild(style);
  }

  function aboutContactHtml(l,editAbout){
    const phone=String(appInfo.phone||'').trim();
    const telegram=String(appInfo.telegram||'').trim();
    if(editAbout && isSuperAdmin())return `<div class="hetk-ui-contact-form">
      <label>${l.phone}<input id="hetk-ui-contact-phone" value="${esc(phone)}" inputmode="tel" placeholder="${l.phoneHint}"></label>
      <label>${l.telegram}<input id="hetk-ui-contact-telegram" value="${esc(telegram)}" placeholder="${l.telegramHint}"></label>
      <div id="hetk-ui-contact-status" class="hetk-ui-contact-status"></div>
      <div class="hetk-ui-contact-actions"><button type="button" class="cancel" data-ui-contact-cancel>${l.close}</button><button type="button" class="save" data-ui-contact-save><i class="fas fa-save"></i> ${l.saveContact}</button></div>
    </div>`;
    const telHref=phoneLink(phone),tgHref=telegramLink(telegram),tgLabel=telegramLabel(telegram);
    return `<div class="hetk-ui-about-contact"><h5>${l.suggestions}</h5>${contactNotice?`<div class="hetk-ui-contact-status">${esc(contactNotice)}</div>`:''}
      <div class="hetk-ui-contact-row"><i class="fas fa-phone"></i><div><span>${l.phone}</span>${telHref?`<a href="${esc(telHref)}">${esc(phone)}</a>`:`<b>${l.notSet}</b>`}</div></div>
      <div class="hetk-ui-contact-row"><i class="fab fa-telegram"></i><div><span>${l.telegram}</span>${tgHref?`<a href="${esc(tgHref)}" target="_blank" rel="noopener noreferrer">${esc(tgLabel)}</a>`:`<b>${l.notSet}</b>`}</div></div>
      ${isSuperAdmin()?`<button type="button" class="hetk-ui-contact-edit" data-ui-contact-edit><i class="fas fa-pen"></i> ${l.editContact}</button><p class="hetk-ui-contact-help">${l.contactHelp}</p>`:''}
    </div>`;
  }

  async function saveAppInfo(){
    const status=document.getElementById('hetk-ui-contact-status');
    const button=document.querySelector('[data-ui-contact-save]');
    const phone=String((document.getElementById('hetk-ui-contact-phone')||{}).value||'').trim();
    const telegram=String((document.getElementById('hetk-ui-contact-telegram')||{}).value||'').trim();
    const l=labels();
    if(!isSuperAdmin()){if(status){status.className='hetk-ui-contact-status error';status.textContent='Ruxsat yo‘q.';}return;}
    if(phone && !phoneLink(phone)){if(status){status.className='hetk-ui-contact-status error';status.textContent=language==='ru'?'Введите правильный номер телефона.':'Telefon raqamini to‘g‘ri kiriting.';}return;}
    if(telegram && !telegramLink(telegram)){if(status){status.className='hetk-ui-contact-status error';status.textContent=language==='ru'?'Введите имя Telegram в формате @username.':'Telegram manzilini @username ko‘rinishida kiriting.';}return;}
    if(button)button.disabled=true;
    try{
      const user=window.HETKAuth.currentUser;
      const payload={phone:phone.slice(0,40),telegram:telegramLabel(telegram),updatedAt:Date.now(),updatedBy:user.uid,updatedByName:user.fullName||user.login||'Bosh administrator'};
      await firebase.database().ref('SystemSettings/appInfo').set(payload);
      appInfo=payload;
      contactNotice=l.saved;
      renderDialog(true,false);
    }catch(error){
      if(status){status.className='hetk-ui-contact-status error';status.textContent=(error&&error.message)||'Saqlanmadi.';}
    }finally{if(button)button.disabled=false;}
  }

  function renderDialog(showAbout,editAbout){
    const l=labels();
    let overlay=document.getElementById('hetk-ui-settings-overlay');
    if(!overlay){overlay=document.createElement('div');overlay.id='hetk-ui-settings-overlay';overlay.className='hetk-ui-settings-overlay';overlay.dataset.hetkNoTranslate='1';document.body.appendChild(overlay);}
    overlay.dataset.showAbout=showAbout?'1':'0';overlay.dataset.editAbout=editAbout?'1':'0';
    overlay.innerHTML=`<section class="hetk-ui-settings-card" role="dialog" aria-modal="true">
      <header class="hetk-ui-settings-head"><h3><i class="fas fa-sliders-h"></i> ${l.title}</h3><button class="hetk-ui-settings-close" type="button" data-ui-close aria-label="${l.close}"><i class="fas fa-times"></i></button></header>
      <div class="hetk-ui-settings-body">
        <section class="hetk-ui-setting-group"><h4>${l.language}</h4><div class="hetk-ui-choice-grid"><button class="hetk-ui-choice ${language==='uz'?'active':''}" data-ui-language="uz">O‘zbekcha</button><button class="hetk-ui-choice ${language==='ru'?'active':''}" data-ui-language="ru">Русский</button></div></section>
        <section class="hetk-ui-setting-group"><h4>${l.font}</h4><div class="hetk-ui-choice-grid hetk-ui-font-grid">${Object.keys(FONT_SCALES).map(key=>`<button class="hetk-ui-choice ${fontSize===key?'active':''}" data-ui-font="${key}">${fontLabels[language][key]}</button>`).join('')}</div></section>
        <p class="hetk-ui-settings-note"><i class="fas fa-circle-info"></i> ${l.note}</p>
        ${showAbout?`<section class="hetk-ui-about"><h4>${l.aboutTitle}</h4><p>${l.aboutText}</p><small>${l.version}</small>${aboutContactHtml(l,!!editAbout)}</section>`:''}
      </div><footer class="hetk-ui-settings-foot"><button class="hetk-ui-settings-done" type="button" data-ui-close>${l.close}</button></footer>
    </section>`;
    overlay.hidden=false;
    overlay.querySelectorAll('[data-ui-close]').forEach(btn=>btn.addEventListener('click',()=>{overlay.hidden=true;}));
    overlay.addEventListener('click',event=>{if(event.target===overlay)overlay.hidden=true;},{once:true});
    overlay.querySelectorAll('[data-ui-language]').forEach(btn=>btn.addEventListener('click',()=>setLanguage(btn.dataset.uiLanguage,showAbout)));
    overlay.querySelectorAll('[data-ui-font]').forEach(btn=>btn.addEventListener('click',()=>setFontSize(btn.dataset.uiFont,showAbout)));
    const edit=overlay.querySelector('[data-ui-contact-edit]');if(edit)edit.addEventListener('click',()=>{contactNotice='';renderDialog(true,true);});
    const cancel=overlay.querySelector('[data-ui-contact-cancel]');if(cancel)cancel.addEventListener('click',()=>renderDialog(true,false));
    const save=overlay.querySelector('[data-ui-contact-save]');if(save)save.addEventListener('click',saveAppInfo);
  }

  function ensureMenu(){
    const menu=document.getElementById('profile-more-menu');
    if(!menu)return;
    let settings=document.getElementById('hetk-ui-settings-button');
    if(!settings){settings=document.createElement('button');settings.id='hetk-ui-settings-button';settings.type='button';settings.addEventListener('click',()=>{closeMenu();renderDialog(false);});menu.prepend(settings);}
    let about=document.getElementById('hetk-ui-about-button');
    if(!about){about=document.createElement('button');about.id='hetk-ui-about-button';about.type='button';about.addEventListener('click',()=>{closeMenu();renderDialog(true,false);});settings.after(about);}
    const l=labels();
    settings.innerHTML=`<i class="fas fa-sliders-h"></i> ${l.settings}`;
    about.innerHTML=`<i class="fas fa-circle-info"></i> ${l.about}`;
  }

  function setLanguage(next,showAbout){
    if(!LANGUAGES.includes(next))return;
    language=next;localStorage.setItem(STORAGE_LANGUAGE,next);
    applyInterface(document);ensureMenu();renderDialog(!!showAbout,false);
    document.dispatchEvent(new CustomEvent('hetk-language-changed',{detail:{language}}));
  }

  function setFontSize(next,showAbout){
    if(!FONT_SCALES[next])return;
    if(fontSize!=='normal')applyFont(document);
    fontSize=next;localStorage.setItem(STORAGE_FONT,next);
    applyFont(document);renderDialog(!!showAbout,false);
    document.dispatchEvent(new CustomEvent('hetk-font-size-changed',{detail:{fontSize,scale:FONT_SCALES[next]}}));
  }

  function queueApply(nodes){
    if(renderQueued)return;renderQueued=true;
    requestAnimationFrame(()=>{renderQueued=false;nodes.forEach(node=>{if(node&&node.isConnected)applyInterface(node);});ensureMenu();});
  }

  function init(){
    ensureStyle();ensureMenu();applyInterface(document);
    if(window.HETKAuth&&window.HETKAuth.currentUser)startAppInfo();
    document.addEventListener('hetk-auth-ready',startAppInfo);
    document.addEventListener('hetk-auth-user-updated',startAppInfo);
    document.addEventListener('hetk-auth-cleared',stopAppInfo);
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
