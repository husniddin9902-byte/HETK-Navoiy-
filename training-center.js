(function(){
  'use strict';

  const REPUBLIC_ROLES=new Set(['super_admin','republic_tb_engineer']);
  const REGIONAL_TB_ROLES=new Set(['regional_tb_chief','regional_tb_operations_engineer','regional_tb_engineer','regional_fire_safety_engineer']);
  const TEST_CREATOR_ROLES=new Set([...REPUBLIC_ROLES,...REGIONAL_TB_ROLES,'tb_engineer']);
  const MIN_NOTICE_MS=2*60*60*1000;
  const CHAPTER_RETRY_LOCK_MS=60*60*1000;
  const ANSWER_REVIEW_PER_QUESTION_MS=60*1000;
  const AUDIENCE_ROLE_ORDER=['regional_director','district_director','regional_chief_engineer','district_chief_engineer','regional_energy_flow_deputy','regional_capital_construction_deputy','regional_deputy_chief_engineer','regional_special_department_head','regional_secret_mobilization_engineer','regional_hr_head','regional_training_specialist','regional_hr_engineer','regional_press_secretary','regional_tb_chief','regional_tb_operations_engineer','regional_tb_engineer','regional_fire_safety_engineer','tb_engineer','network_maintenance_engineer','document_technician','askue_sales_deputy','energy_flow_control_engineer','askue_group_head','askue_group_engineer','askue_group_operator','askue_group_electrician','pto_engineer','chief_dispatcher','dispatcher','tchb_electrician','tchb_driver','driver','tractor_operator','master','electrician','duty_electrician','accountant','contract_service_engineer','execution_discipline_inspector','warehouse_manager','gardener','cleaner','guard'];
  const UI={
    uz:{home:'Asosiy',books:'O‘quv materiallari',tests:'Testlar',results:'Natijalar',create:'Test yaratish',profile:'Profil',language:'O‘zbekcha',continue:'O‘qishni davom ettirish',openBook:'Kitobni ochish',enterTest:'Testga kirish',result:'Natija',back:'Testlarga qaytish',saveDraft:'Qoralama saqlash',schedule:'Testni rejalashtirish',next:'Keyingi savol',previous:'Oldingi savol',finish:'Testni yakunlash',question:'savol',rank:'o‘rin',selected:'Tanlangan',all:'Barchasi',districts:'Hududlar / tumanlar',positions:'Qatnashadigan lavozimlar',testLanguage:'Test tili',uzbek:'O‘zbekcha',russian:'Ruscha',bilingual:'Ikki tilda',source:'Manba (ixtiyoriy)',explanation:'Javobga tushuntirish (ixtiyoriy)',description:'Test haqida izoh',audienceRequired:'Kamida bitta hudud va bitta lavozimni tanlang.'},
    ru:{home:'Главная',books:'Учебные материалы',tests:'Тесты',results:'Результаты',create:'Создать тест',profile:'Профиль',language:'Русский',continue:'Продолжить чтение',openBook:'Открыть книгу',enterTest:'Начать тест',result:'Результат',back:'Вернуться к тестам',saveDraft:'Сохранить черновик',schedule:'Запланировать тест',next:'Следующий вопрос',previous:'Предыдущий вопрос',finish:'Завершить тест',question:'вопрос',rank:'место',selected:'Выбрано',all:'Все',districts:'Регионы / районы',positions:'Должности участников',testLanguage:'Язык теста',uzbek:'Узбекский',russian:'Русский',bilingual:'Два языка',source:'Источник (необязательно)',explanation:'Пояснение к ответу (необязательно)',description:'Описание теста',audienceRequired:'Выберите хотя бы один регион и одну должность.'}
  };
  const RU_TEXT={
    'Bosh sahifa':'Главная','Natijalarim':'Мои результаты','Yangi test yaratish':'Создать новый тест','Yaratgan testlarim':'Мои тесты','Asosiy ma’lumotlar':'Основные сведения','Test nomi *':'Название теста *','Ko‘rinishi *':'Вид объявления *','Oldindan ko‘rinadi':'Видно заранее','Boshlanguncha yashirin':'Скрыто до начала','Kimlar qatnashadi?':'Кто участвует?','Qamrov *':'Охват *','Butun respublika':'Вся республика','Tanlangan hududlar':'Выбранные регионы','Boshlanish vaqti *':'Время начала *','Test davomiyligi *':'Продолжительность *','Har xodimga savollar soni *':'Число вопросов каждому','daqiqa':'минут','Savollar banki':'Банк вопросов','Savol qo‘shish':'Добавить вопрос','Savol matni *':'Текст вопроса *','Jonli testni birdan boshlash mumkin emas.':'Нельзя запускать онлайн-тест сразу.','Testlar markazi':'Центр тестирования','Barcha testlar':'Все тесты','Jonli':'Идёт сейчас','Rejalashtirilgan':'Запланирован','Yakunlangan':'Завершён','Kitoblar kutubxonasi':'Библиотека','Tilni tanlang, onlayn o‘qing yoki audio shaklida tinglang.':'Выберите язык, читайте онлайн или слушайте аудио.','Natijalarim':'Мои результаты','O‘rtacha natija':'Средний результат','Topshirilgan test':'Пройдено тестов','Muvaffaqiyatli':'Успешно','Keyingi onlayn test':'Следующий онлайн-тест','Tezkor bo‘limlar':'Быстрые разделы','Mavjud kitob':'Доступно книг','Onlayn test':'Онлайн-тест','Topshirilgan':'Пройдено','Test haqida izoh *':'Описание теста *','Hudud tanlanmagan':'Регион не выбран','Lavozim tanlanmagan':'Должность не выбрана','Qatnashchilar hudud va lavozim bo‘yicha tanlanadi.':'Участники выбираются по региону и должности.','Mening testlarim':'Мои тесты','Yangi test':'Новый тест','Statistika':'Статистика','Bekor qilish':'Отменить','Qoralama':'Черновик','Ishtirok etmadi':'Не участвовал','qolgan vaqt':'осталось','boshlanadi':'начало','TEST NATIJASI':'РЕЗУЛЬТАТ ТЕСТА','Sizning javobingiz:':'Ваш ответ:','To‘g‘ri javob:':'Правильный ответ:','Manba:':'Источник:'
  };
  const state={books:{},tests:{},results:{},access:{},statisticsPeriods:{},adminSecurity:{},questionBanks:{},practiceAttempts:{},liveAttempts:{},practiceLoaded:false,practiceDeadline:0,practicePreview:null,createdListOpen:false,examSubmitting:false,testFilter:'all',examShuffleSeed:0,examConfirmed:{},examReview:null,examReviewDeadline:0,createdFilter:'all',createdSearch:'',answerDetails:{},bookProgress:{},bookProgressLoaded:false,rankUsers:{},rankProgress:{},rankLoaded:false,rankLoading:false,rankError:'',rankDone:0,rankTotal:0,rankOwner:'',rankSearch:'',rankFolder:'all',rankBook:'all',rankSort:'chapters',rankSelected:'',rankPanel:'current',rankMobileDetail:false,rankLoadAt:0,chapterQuiz:null,bookFilter:'all',activeTab:'home',activeTestId:'',activeBookId:'',activeChapterId:'',activeTopicId:'',activeAudioTopicId:'',readerEdition:localStorage.getItem('hetkReaderEdition')==='cyrillic'?'cyrillic':'latin',booksLoaded:false,booksRealtime:false,testsLoaded:false,resultsLoaded:false,bookDraft:null,bookAdminBookId:'',bookAdminChapterId:'',bookAdminTopicId:'',topicEdition:'latin',topicDraft:null,topicDraftKey:'',topicDraftCache:{},topicRemovedMedia:[],pendingTopicAudioParts:null,listeners:[],timer:null,questionDrafts:[],editorDraft:null,editingTestId:'',lang:localStorage.getItem('hetkTrainingLang')==='ru'?'ru':'uz',examIndex:0,examAnswers:{},examQuestions:[],adminPinFailures:0,adminPinLockedUntil:0,ttsPreview:null,ttsParts:[],ttsGenerating:false,ttsContextKey:'',pendingChapterAudio:null,pendingChapterAudioParts:null,chapterTestDraft:null,chapterTestDraftKey:'',readerMode:'read',readerTheme:localStorage.getItem('hetkReaderTheme')||'dark',readerFont:Number(localStorage.getItem('hetkReaderFont')||19),ttsOnline:null,ttsChecking:false,ttsVoices:[{id:'navoiy',name:'Navoiy — asosiy ovoz'}],mediaObjectUrls:{},mediaLoadPromises:{},archiveJson:{},bookAdminNewMode:false,bookAdminNewChapterMode:false,richEditorCleanup:null,noteEditorCleanup:null};

  const DEFAULT_TTS_DICTIONARY=`TCHB = tezkor chiqish brigadasi
YOTQ = yopiq taqsimlovchi qurilma
OTQ = ochiq taqsimlovchi qurilma
AHL = aloqa havo liniyasi
AKL = aloqa kabel liniyasi
QMQ = qurilish me’yorlari va qoidalari
MTX = muhandis-texnik xodimlar
TQ = taqsimlovchi qurilma
HL = havo liniyasi
KL = kabel liniyasi`;

  function db(){return window.firebase&&firebase.database?firebase.database():null;}
  function me(){return window.HETKAuth&&window.HETKAuth.currentUser?window.HETKAuth.currentUser:null;}
  function uid(){const a=me(),u=firebase.auth().currentUser;return (a&&a.uid)||(u&&u.uid)||'';}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','>':'&gt;','<':'&lt;','"':'&quot;',"'":'&#39;'}[c]));}
  function tr(key){return (UI[state.lang]&&UI[state.lang][key])||(UI.uz[key])||key;}
  function localized(value,base){if(!value)return '';const suffix=state.lang==='ru'?'Ru':'Uz';return value[base+suffix]||value[base]||value[base+'Uz']||value[base+'Ru']||'';}
  function avatarUrl(account){const shown=document.querySelector('.hetk-profile-avatar img');if(shown&&shown.src)return shown.src;const a=account||{};return a.photoUrl||a.photoData||a.avatarUrl||(String(a.gender||'').toLowerCase()==='female'||String(a.gender||'').toLowerCase()==='ayol'?'profile-default-female.png':'profile-default-male.png');}
  function roleLabel(role){const roles=window.HETKAuth&&window.HETKAuth.roles||{};return roles[role]&&roles[role].label||role;}
  function applyUiLanguage(root){if(state.lang!=='ru'||!root)return;const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(node=>{const raw=node.nodeValue,trim=raw.trim(),translated=RU_TEXT[trim];if(translated)node.nodeValue=raw.replace(trim,translated);});root.querySelectorAll('[placeholder]').forEach(el=>{const map={'Kitob nomini qidiring...':'Поиск книги...','Masalan: Texnika xavfsizligi sinovi':'Например: Проверка знаний по безопасности','Testning maqsadi, mavzusi va xodim uchun ko‘rsatma':'Цель, тема теста и инструкция для сотрудника','Savolni kiriting...':'Введите вопрос...','Kitob, qoida, band yoki havola':'Книга, правило, пункт или ссылка','Nima uchun shu javob to‘g‘ri ekanini qisqa tushuntiring':'Кратко объясните правильный ответ'};if(map[el.placeholder])el.placeholder=map[el.placeholder];});}
  function canCreate(){const a=me();return !!(a&&(a.rootAccess||TEST_CREATOR_ROLES.has(a.role)));}
  function isSuperAdmin(){const a=me();return !!(a&&(a.rootAccess||a.role==='super_admin'));}
  function isRepublic(){const a=me();return !!(a&&(a.rootAccess||REPUBLIC_ROLES.has(a.role)));}
  // Reytingni faqat TB (MMQ/XT) xodimlari va bosh administrator ko'radi.
  const READING_AUDIT_ROLES=new Set(['super_admin','republic_tb_engineer','regional_tb_chief','regional_tb_operations_engineer','regional_tb_engineer','regional_fire_safety_engineer','tb_engineer']);
  function canViewReadingRanking(){const a=me();return !!(a&&(a.rootAccess||READING_AUDIT_ROLES.has(a.role)));}
  function ownRoots(){const a=me()||{};return Object.keys(a.folders||{}).filter(k=>a.folders[k]);}
  function folderMap(){return window.currentFolders||window.folders||{};}
  function folderName(id){const f=folderMap()[id]||{};return f.name||f.title||id;}
  function folderParent(id){const f=folderMap()[id]||{};return String(f.parentId||f.parent||f.parentKey||'root');}
  function isFolderInside(id,ancestor){let cursor=String(id||''),guard=0;ancestor=String(ancestor||'');while(cursor&&cursor!=='root'&&guard++<100){if(cursor===ancestor)return true;cursor=folderParent(cursor);}return false;}
  function regionOptions(){const map=folderMap(),ids=Object.keys(map),roots=ids.filter(id=>folderParent(id)==='root'),children=ids.filter(id=>roots.includes(folderParent(id)));const candidates=children.length?children:roots;return candidates.map(id=>({id,name:folderName(id)})).sort((a,b)=>a.name.localeCompare(b.name,'uz'));}
  function resultRegionId(result){const folders=Object.keys((result&&result.folderIds)||{}),regions=regionOptions();for(const region of regions){if(folders.some(id=>isFolderInside(id,region.id)))return region.id;}return folders[0]||'';}
  function currentStatisticsStart(result){const year=new Date().getFullYear(),regionId=resultRegionId(result);return Number((((state.statisticsPeriods[regionId]||{})[year]||{}).startAt)||new Date(year,0,1).getTime());}
  function isCurrentAnnualResult(result){if(!result||!result.submittedAt)return false;const year=new Date().getFullYear(),submitted=new Date(Number(result.submittedAt));return submitted.getFullYear()===year&&Number(result.submittedAt)>=currentStatisticsStart(result);}
  async function hashPin(pin,salt){const bytes=new TextEncoder().encode(`${salt}:${pin}`),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  function audienceFolderOptions(){
    const map=folderMap(),roots=ownRoots(),a=me()||{},ids=[];
    if(a.rootAccess||a.role==='super_admin'||a.role==='republic_tb_engineer'){
      Object.keys(map).filter(id=>map[id]&&String(map[id].parentId||'root')==='root').forEach(id=>ids.push(id));
    }else{
      roots.forEach(root=>{ids.push(root);Object.keys(map).filter(id=>String((map[id]||{}).parentId||'')===String(root)).forEach(id=>ids.push(id));});
    }
    return [...new Set(ids)].filter(id=>map[id]).map(id=>({id,name:folderName(id)})).sort((x,y)=>x.name.localeCompare(y.name,'uz'));
  }
  function audienceRolesHtml(selected){const picked=new Set(selected||[]);return AUDIENCE_ROLE_ORDER.filter(role=>window.HETKAuth&&window.HETKAuth.roles&&window.HETKAuth.roles[role]).map(role=>`<label class="hetk-training-choice"><input type="checkbox" name="audienceRoles" value="${esc(role)}" ${picked.has(role)?'checked':''}><span>${esc(roleLabel(role))}</span></label>`).join('');}
  function audienceFoldersHtml(selected){const picked=new Set(selected||[]);return audienceFolderOptions().map(item=>`<label class="hetk-training-choice"><input type="checkbox" name="audienceFolders" value="${esc(item.id)}" ${picked.has(item.id)?'checked':''}><span>${esc(item.name)}</span></label>`).join('');}
  function audienceText(test){const folders=Object.keys(test.audienceFolders||{}).map(folderName),roles=Object.keys(test.audienceRoles||{}).map(roleLabel);const location=test.scope==='republic'?(state.lang==='ru'?'Вся республика':'Butun respublika'):(folders.length?folders.join(', '):(state.lang==='ru'?'Мой регион':'Mening hududim'));const jobs=roles.length?roles.join(', '):tr('all');return `${location} · ${jobs}`;}
  function now(){return Date.now();}
  function pad(n){return String(n).padStart(2,'0');}
  function localInput(ms){const d=new Date(ms);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;}
  function fmt(ms){if(!ms)return '—';return new Intl.DateTimeFormat('uz-UZ',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ms));}
  function durationText(ms){const sec=Math.max(0,Math.ceil(ms/1000)),m=Math.floor(sec/60),s=sec%60;return `${pad(m)}:${pad(s)}`;}
  function statusOf(t){const n=now();if(t.status==='draft')return 'draft';if(t.status==='cancelled')return 'cancelled';if(n<t.startAt)return 'scheduled';if(n>=t.endAt)return 'finished';return 'live';}
  function statusLabel(s){return ({draft:'Qoralama',scheduled:'Rejalashtirilgan',live:'Jonli',finished:'Yakunlangan',cancelled:'Bekor qilingan'})[s]||s;}
  function statusIcon(s){return ({draft:'fa-pen-ruler',scheduled:'fa-clock',live:'fa-circle-play',finished:'fa-circle-check',cancelled:'fa-ban'})[s]||'fa-file';}
  function testVisible(t){
    if(!t)return false;
    const a=me()||{};
    if(t.createdBy===uid()||a.rootAccess||a.role==='super_admin')return true;
    if(t.status==='draft')return t.announcementMode==='visible';
    if(state.access[t.id])return true;
    const status=statusOf(t);
    if(t.scope==='republic')return true;
    const mine=new Set(ownRoots());
    return Object.keys(t.audienceFolders||{}).some(id=>mine.has(id)||(window.HETKAuth&&window.HETKAuth.canSeeFolder&&window.HETKAuth.canSeeFolder(id,window.currentFolders||{})));
  }
  function seeded(seed){let h=2166136261;for(let i=0;i<seed.length;i++){h^=seed.charCodeAt(i);h=Math.imul(h,16777619);}return()=>{h+=0x6D2B79F5;let x=h;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return((x^x>>>14)>>>0)/4294967296;};}
  function shuffled(list,seed){const out=list.slice(),rnd=seeded(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
  function normalizedCorrectIndex(q){
    const options=q.options||[];
    const raw=q.correctIndex??q.correctAnswerIndex??q.answerIndex??q.correctAnswer??q.answer;
    if(typeof raw==='number'&&Number.isInteger(raw)&&raw>=0&&raw<options.length)return raw;
    if(typeof raw==='string'){
      const v=raw.trim();if(/^[A-Da-d]$/.test(v))return v.toUpperCase().charCodeAt(0)-65;
      if(/^\d+$/.test(v)){const n=Number(v);if(n>=0&&n<options.length)return n;}
      const i=options.findIndex(x=>String(x).trim()===v);if(i>=0)return i;
    }
    return null;
  }
  function questionSet(t){const bank=state.questionBanks[t.id]||t.questions||{},all=Object.entries(bank).map(([id,q])=>({...q,id,correctIndex:normalizedCorrectIndex(q)}));const count=Math.min(t.status==='draft'?all.length:(Number(t.questionLimit)||all.length),all.length);return shuffled(all,`${t.id}:${uid()}:${state.examShuffleSeed||0}`).slice(0,count).map(q=>({...q,options:shuffled((q.options||[]).map((text,index)=>({text,index})),`${t.id}:${uid()}:${state.examShuffleSeed||0}:${q.id}`)}));}
  function toast(text,type){const host=document.querySelector('#hetk-training-overlay .hetk-training-toast');if(!host)return;host.className=`hetk-training-toast is-show ${type||''}`;host.textContent=text;clearTimeout(host._t);host._t=setTimeout(()=>host.className='hetk-training-toast',3800);}
  function empty(icon,title,text){return `<div class="hetk-training-empty"><i class="fas ${icon}"></i><h3>${esc(title)}</h3><p>${esc(text)}</p></div>`;}

  function shell(){
    const a=me()||{};
    return `<div class="hetk-training-shell" role="dialog" aria-modal="true" aria-labelledby="hetk-training-title">
      <header class="hetk-training-head"><div class="hetk-training-head-icon"><i class="fas fa-graduation-cap"></i></div><div class="hetk-training-head-copy"><h2 id="hetk-training-title">${state.lang==='ru'?'Учебный центр':'O‘quv markazi'}</h2><p>${state.lang==='ru'?'Знания, тестирование и контроль квалификации':'Bilim, sinov va malaka nazorati'}</p></div><div class="hetk-training-person"><img src="${esc(avatarUrl(a))}" alt=""><span><b>${esc(a.fullName||a.login||'Hodim')}</b><small>${esc(a.roleLabel||roleLabel(a.role)||'')}</small></span></div><button class="hetk-training-head-action" type="button" data-training-language><i class="fas fa-language"></i><span>${tr('language')}</span></button><button class="hetk-training-close" type="button" data-training-close aria-label="Yopish"><i class="fas fa-times"></i></button></header>
      <div class="hetk-training-layout"><nav class="hetk-training-side" aria-label="O‘quv markazi bo‘limlari">${navButton('home','fa-house',tr('home'))}${navButton('books','fa-book-open',tr('books'))}${navButton('tests','fa-clipboard-check',tr('tests'))}${navButton('results','fa-chart-column',tr('results'))}${canViewReadingRanking()?navButton('readingRank','fa-ranking-star','Xodimlar reytingi'):''}${isSuperAdmin()?navButton('bookAdmin','fa-book-medical','Kitob yaratish'):''}${canCreate()?navButton('manage','fa-square-plus',tr('create')):''}</nav><main class="hetk-training-main"><div class="hetk-training-content" data-training-content>${renderActive()}</div></main></div>
      <nav class="hetk-training-mobile-nav">${navButton('home','fa-house',tr('home'))}${navButton('books','fa-book-open',tr('books'))}${navButton('tests','fa-clipboard-check',tr('tests'))}${navButton('results','fa-chart-column',tr('results'))}${canViewReadingRanking()?navButton('readingRank','fa-ranking-star','Reyting'):''}${isSuperAdmin()?navButton('bookAdmin','fa-book-medical','Kitob'):''}${canCreate()?navButton('manage','fa-plus',tr('create')):''}</nav><div class="hetk-training-toast" role="status" aria-live="polite"></div>
    </div>`;
  }
  function navButton(tab,icon,label){const active=state.activeTab===tab||(tab==='results'&&state.activeTab==='annual'),locked=!!state.activeBookId;return `<button class="hetk-training-nav ${active?'is-active':''} ${locked?'is-reader-locked':''}" type="button" data-training-tab="${tab}" ${locked?'disabled aria-disabled="true"':''}><i class="fas ${icon}"></i><span>${label}</span></button>`;}
  function renderActive(){if(state.activeTestId)return renderTest();if(state.activeBookId)return renderBookReader();if(state.activeTab==='readingRank')return canViewReadingRanking()?renderReadingRank():empty('fa-lock','Ruxsat yo‘q','Bu bo‘lim faqat TB muhandisi va bosh administratorga ochiq.');if(state.activeTab==='books')return renderBooks();if(state.activeTab==='bookAdmin')return renderBookAdmin();if(state.activeTab==='tests')return renderTests();if(state.activeTab==='results')return renderResults();if(state.activeTab==='annual')return renderAnnualStatistics();if(state.activeTab==='manage')return state.createdListOpen?renderCreated():renderManage();return renderHome();}
  function repaint(){closeBookNoteViewer();const o=document.getElementById('hetk-training-overlay'),content=o&&o.querySelector('[data-training-content]');if(!content)return;if(typeof state.richEditorCleanup==='function'){state.richEditorCleanup();state.richEditorCleanup=null;}const shellEl=o.querySelector('.hetk-training-shell');if(shellEl){shellEl.classList.toggle('is-book-reader',!!state.activeBookId);shellEl.classList.toggle('is-book-editing',state.activeTab==='bookAdmin');}content.innerHTML=renderActive();o.querySelectorAll('[data-training-tab]').forEach(b=>b.classList.toggle('is-active',(b.dataset.trainingTab===state.activeTab||(b.dataset.trainingTab==='results'&&state.activeTab==='annual'))&&!state.activeTestId));applyUiLanguage(content);bindDynamic();const bookForm=content.querySelector('[data-book-form]');if(bookForm)enhanceBookRichEditor(bookForm);bindAudioTopicTools(content);const filter=content.querySelector('[data-test-filter]');if(filter){filter.value=state.testFilter;filter.dispatchEvent(new Event('change',{bubbles:false}));content.querySelectorAll('[data-test-card]').forEach(c=>c.hidden=(state.testFilter!=='all'&&c.dataset.status!==state.testFilter));}if(content.querySelector('.hetk-v13-read-only')&&state.activeBookId&&state.activeChapterId)recordChapterOpen();}
  function visibleTests(){return Object.entries(state.tests).map(([id,t])=>({...t,id})).filter(testVisible).sort((a,b)=>(b.startAt||0)-(a.startAt||0));}
  function isPractice(t){return t&&t.status==='draft'&&t.announcementMode==='visible';}
  function canPractice(t){return isPractice(t)||!!(t&&t.status==='draft'&&(t.createdBy===uid()||isSuperAdmin()));}
  function myResult(testId){const t=state.tests[testId];if(t&&t.status==='draft')return null;return state.results[testId]&&state.results[testId][uid()]||null;}
  function liveHistory(testId,employeeId){const group=state.liveAttempts[testId]||{};return Object.values(employeeId?{[employeeId]:group[employeeId]}:group).flatMap(v=>Object.values(v||{})).filter(r=>r&&r.submittedAt).sort((a,b)=>b.submittedAt-a.submittedAt);}
  function practiceHistory(testId,employeeId){const group=state.practiceAttempts[testId]||{};return Object.values(employeeId?{[employeeId]:group[employeeId]}:group).flatMap(v=>Object.values(v||{})).filter(r=>r&&r.submittedAt).sort((a,b)=>b.submittedAt-a.submittedAt);}
  function lastPractice(testId,employeeId){return practiceHistory(testId,employeeId)[0]||null;}

  function isIndustryBook(book){return !!(book&&book.bookType==='industry');}
  function chapterProgress(bookId,chapterId){return (((state.bookProgress||{})[bookId]||{}).chapters||{})[chapterId]||{};}
  // V32: bobni ochish — bu bobni to‘liq o‘qib bo‘lish yoki test topshirish emas.
  // Har bir bob uchun bir marta yoziladi; har qayta chizishda Firebase so‘rovi ketmaydi.
  const chapterOpenPending=new Set();
  function recordChapterOpen(){
    const accountId=uid(),bookId=state.activeBookId,chapterId=state.activeChapterId;
    if(!accountId||!bookId||!chapterId||!state.bookProgressLoaded||state.bookProgressUid!==accountId||!db())return;
    const book=state.books[bookId],chapter=book&&book.chapters&&book.chapters[chapterId];
    if(!chapter||(!isSuperAdmin()&&(book.published!==true||chapter.published!==true)))return;
    const bookProgress=(state.bookProgress||{})[bookId]||{};
    if(bookProgress.readChapters&&bookProgress.readChapters[chapterId])return;
    const key=[accountId,bookId,chapterId].join(':');
    if(chapterOpenPending.has(key))return;
    chapterOpenPending.add(key);
    const path=`TrainingBookProgress/${accountId}/${bookId}/readChapters/${chapterId}`;
    db().ref(path).transaction(old=>old||{openedAt:firebase.database.ServerValue.TIMESTAMP},undefined,false)
      .then(result=>{
        if(!result.committed&&!result.snapshot.exists())return;
        if(uid()!==accountId)return;
        state.bookProgress[bookId]=state.bookProgress[bookId]||{};
        state.bookProgress[bookId].readChapters=state.bookProgress[bookId].readChapters||{};
        state.bookProgress[bookId].readChapters[chapterId]=result.snapshot.val()||{openedAt:Date.now()};
      })
      .catch(err=>console.warn('Bob ochilganini qayd etib bo‘lmadi:',err&&err.message||err))
      .finally(()=>chapterOpenPending.delete(key));
  }

  function chapterTestQuestions(ch){const saved=ch&&ch.chapterTest||{},rows=Array.isArray(saved.questions)?saved.questions:Object.values(saved.questions||{});return rows.filter(q=>q&&q.text&&Array.isArray(q.options)&&q.options.length>=2);}
  function chapterPassed(bookId,chapterId,ch){return !chapterTestQuestions(ch).length||chapterProgress(bookId,chapterId).passed===true;}
  function chapterUnlocked(bookId,chapters,index){if(isIndustryBook(state.books[bookId])||isSuperAdmin()||index<=0)return true;const previous=chapters[index-1];return !!(previous&&chapterPassed(bookId,previous[0],previous[1]));}
  function bookProgressSummary(bookId,book){const chapters=chapterEntries(book).filter(([,c])=>isSuperAdmin()||c.published===true),passed=chapters.filter(([id,c])=>chapterPassed(bookId,id,c)&&chapterTestQuestions(c).length).length,total=chapters.filter(([,c])=>chapterTestQuestions(c).length).length;return {passed,total,percent:total?Math.round(passed/total*100):0};}

  // V37: HETK reytingi bob ochilganini qayd etilgan ma'lumotdan hisoblaydi.
  // O'qilgan vaqt, sahifa soni va bobning ichki % progressi bu bazada mavjud emas.
  let rankRequestToken=0;
  function rankChapterRows(book,progress){return chapterEntries(book).filter(([id,c])=>c&&(c.published===true||!!(progress.readChapters||{})[id]||Number(((progress.chapters||{})[id]||{}).attempts)>0||((progress.chapters||{})[id]||{}).passed===true));}
  function rankStamp(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:0;}
  function rankUserLocation(user){
    const map=folderMap();const ids=Object.keys(user&&user.folders||{}).filter(id=>user.folders[id]&&map[id]);
    // U/J va kichik papkalardan ko'ra tuman/shahar papkasini tanlashga harakat qilamiz.
    const ordered=ids.slice().sort((a,b)=>{const depth=id=>{let n=0,c=id;while(map[c]&&n<30){n++;c=folderParent(c);if(c==='root')break;}return n;};return depth(b)-depth(a);});
    const district=ordered.find(id=>/(?:sh\.?et|res|tuman|shahar|district)/i.test(folderName(id)))||ordered[0];
    return district?{id:district,name:folderName(district)}:{id:'',name:user&&user.region||'Hudud ko‘rsatilmagan'};
  }
  function rankBookEntries(employeeId){
    const record=state.rankProgress[employeeId]||{},out=[];
    Object.entries(record).forEach(([bookId,progress])=>{
      const book=state.books[bookId];if(!book||!progress||typeof progress!=='object')return;
      const chapters=rankChapterRows(book,progress);if(!chapters.length)return;
      const read=progress.readChapters||{},tests=progress.chapters||{};
      let opened=0,passed=0,attempts=0,lastAt=0,current=null;
      const items=chapters.map(([chapterId,ch],order)=>{
        const open=read[chapterId],test=tests[chapterId]||{};
        const wasOpened=!!(open&&typeof open==='object'),wasTested=Number(test.attempts)>0||test.passed===true;
        const openAt=rankStamp(open&&open.openedAt),testAt=rankStamp(test.lastAttemptAt||test.completedAt);
        if(wasOpened)opened++;
        if(test.passed===true)passed++;
        attempts+=Math.max(0,Number(test.attempts)||0);
        const time=Math.max(openAt,testAt);if(time>lastAt){lastAt=time;current={id:chapterId,title:ch.titleUz||ch.title||'Bob',order:Number(ch.order)||order+1};}
        return {id:chapterId,order:Number(ch.order)||order+1,title:ch.titleUz||ch.title||'Bob',opened:wasOpened,passed:test.passed===true,attempts:Number(test.attempts)||0,openedAt:openAt,testAt};
      });
      // Avvalgi V32 yozuvida readChapters yo'q, lekin bob testi bo'lsa ham xodim ko'rinsin.
      if(!opened&&!attempts&&!passed)return;
      if(!current){const last=items.filter(x=>x.opened||x.attempts||x.passed).pop();if(last)current={id:last.id,title:last.title,order:last.order};}
      out.push({id:bookId,title:book.titleUz||book.title||'Nomsiz kitob',opened,passed,attempts,total:chapters.length,lastAt,current,chapters:items,percent:Math.round(opened/chapters.length*100)});
    });
    return out.sort((a,b)=>b.lastAt-a.lastAt||b.opened-a.opened);
  }
  function rankEmployeeRows(){
    return Object.entries(state.rankUsers).filter(([,user])=>user&&user.active!==false).map(([employeeId,user])=>{
      const books=rankBookEntries(employeeId),opened=books.reduce((s,b)=>s+b.opened,0),passed=books.reduce((s,b)=>s+b.passed,0),total=books.reduce((s,b)=>s+b.total,0),lastAt=Math.max(0,...books.map(b=>b.lastAt));
      const picked=state.rankBook==='all'?books:books.filter(b=>b.id===state.rankBook);
      const pickedOpened=picked.reduce((s,b)=>s+b.opened,0),pickedPassed=picked.reduce((s,b)=>s+b.passed,0),pickedTotal=picked.reduce((s,b)=>s+b.total,0);
      const area=rankUserLocation(user);
      return {id:employeeId,user,books,opened,passed,total,lastAt,area,picked,pickedOpened,pickedPassed,pickedTotal,percent:pickedTotal?Math.round(pickedOpened/pickedTotal*100):0};
    }).filter(r=>r.books.length&&r.picked.length).filter(r=>{
      if(state.rankFolder!=='all'){
        const ids=Object.keys(r.user.folders||{}).filter(id=>r.user.folders[id]);
        if(!ids.some(id=>isFolderInside(id,state.rankFolder)))return false;
      }
      const query=state.rankSearch.trim().toLocaleLowerCase('uz');
      return !query||[r.user.fullName,r.user.login,r.area.name,roleLabel(r.user.role)].some(value=>String(value||'').toLocaleLowerCase('uz').includes(query));
    }).sort((a,b)=>{
      if(state.rankSort==='recent')return b.lastAt-a.lastAt||b.pickedOpened-a.pickedOpened;
      if(state.rankSort==='books')return b.picked.length-a.picked.length||b.pickedOpened-a.pickedOpened;
      if(state.rankSort==='percent')return b.percent-a.percent||b.pickedOpened-a.pickedOpened;
      return b.pickedOpened-a.pickedOpened||b.pickedPassed-a.pickedPassed||b.lastAt-a.lastAt;
    });
  }
  async function loadReadingRanking(force=false){
    if(!canViewReadingRanking()||!db())return;
    const owner=uid();if(!owner)return;
    if(state.rankOwner!==owner){state.rankUsers={};state.rankProgress={};state.rankLoaded=false;state.rankOwner=owner;state.rankSelected='';state.rankMobileDetail=false;}
    if(state.rankLoading)return;
    if(!force&&state.rankLoaded&&Date.now()-state.rankLoadAt<120000)return;
    const token=++rankRequestToken;state.rankLoading=true;state.rankLoaded=false;state.rankError='';state.rankDone=0;state.rankTotal=0;
    if(state.activeTab==='readingRank')repaint();
    try{
      const [_,usersSnapshot]=await Promise.all([loadBooksOnce(),window.HETKData&&window.HETKData.readUsers?window.HETKData.readUsers(force):Promise.reject(new Error('Xodimlar indeksi mavjud emas'))]);
      if(token!==rankRequestToken||uid()!==owner)return;
      if(!state.booksLoaded)throw Error('Kitoblar yuklanmadi. Qayta urinib ko‘ring.');
      const users=usersSnapshot.val()||{};
      state.rankUsers=Object.fromEntries(Object.entries(users).filter(([,u])=>u&&u.active!==false));
      const ids=Object.keys(state.rankUsers);state.rankTotal=ids.length;
      // Ma'lumotni boshqa lavozimga ochmaymiz, Firebase'dagi har bir xodim yo'li o'qiladi.
      // Bitta root o'qish taqiqlangan; indeksdan topilgan xodimlar cheklangan.
      const found={};let failed=0;
      for(let i=0;i<ids.length;i+=12){
        if(token!==rankRequestToken||uid()!==owner||state.activeTab!=='readingRank')return;
        await Promise.all(ids.slice(i,i+12).map(async id=>{
          try{const snap=await db().ref(`TrainingBookProgress/${id}`).once('value');if(snap.exists())found[id]=snap.val()||{};}
          catch(err){failed++;console.warn('O‘qish tarixi o‘qilmadi:',id,err&&err.code||err);}
        }));
        state.rankDone=Math.min(i+12,ids.length);state.rankProgress=found;
        if(state.activeTab==='readingRank'&&((i+12)%48===0||i+12>=ids.length))repaint();
      }
      if(failed)state.rankError=`${failed} ta xodimning o‘qish qaydini olishda ruxsat yoki tarmoq xatosi yuz berdi. Natija to‘liq emas.`;
      state.rankLoaded=true;state.rankLoadAt=Date.now();
    }catch(err){state.rankError='Xodimlar yoki kitoblar yuklanmadi: '+(err&&err.message||err);}
    finally{if(token===rankRequestToken){state.rankLoading=false;if(state.activeTab==='readingRank')repaint();}}
  }
  function rankOptions(){
    const folders=new Set();Object.values(state.rankUsers).forEach(user=>Object.keys(user&&user.folders||{}).forEach(id=>{if(user.folders[id]&&folderMap()[id])folders.add(id);}));
    const ordered=[...folders].sort((a,b)=>folderName(a).localeCompare(folderName(b),'uz'));
    return {folders:ordered,books:Object.entries(state.books).filter(([,b])=>b&&b.published===true).map(([id,b])=>({id,title:b.titleUz||b.title||'Kitob'})).sort((a,b)=>a.title.localeCompare(b.title,'uz'))};
  }
  function rankBar(percent){return `<span class="hetk-rank-bar" aria-label="${percent}%"><i style="width:${Math.max(0,Math.min(100,percent))}%"></i></span>`;}
  function rankAvatar(name){return esc(String(name||'X').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase());}
  function rankListHTML(rows){
    if(!rows.length)return `<div class="hetk-rank-no-rows">${state.rankLoading?'O‘qish qaydlari yuklanmoqda...':'Tanlangan filtr bo‘yicha kitob ochgan xodim topilmadi.'}</div>`;
    return rows.map((r,i)=>`<button class="hetk-rank-person ${r.id===state.rankSelected?'selected':''}" type="button" data-rank-employee="${esc(r.id)}"><span class="hetk-rank-position ${i<3?'medal':''}">${i+1}</span><span class="hetk-rank-avatar">${rankAvatar(r.user.fullName||r.user.login)}</span><span class="hetk-rank-person-name"><b>${esc(r.user.fullName||r.user.login||'Xodim')}</b><small>${esc(r.area.name)}</small></span><span class="hetk-rank-person-result"><strong>${r.pickedOpened} bob</strong><small>${r.picked.length} ta kitob</small></span><i class="fas fa-chevron-right" aria-hidden="true"></i></button>`).join('');
  }
  function rankDetailHTML(employee){
    if(!employee)return `<div class="hetk-rank-no-detail"><i class="fas fa-user-check"></i><h3>Xodimni tanlang</h3><p>Qaysi kitob va boblar ochilganini shu yerda ko‘rasiz.</p></div>`;
    const book=employee.books.find(b=>b.id===state.rankDetailBook)||employee.picked[0]||employee.books[0];
    const current=book&&book.current,allChapters=book&&book.chapters||[],recent=employee.books.flatMap(b=>b.chapters.filter(c=>c.openedAt||c.testAt).map(c=>({bookTitle:b.title,title:c.title,order:c.order,at:Math.max(c.openedAt,c.testAt),passed:c.passed}))).sort((a,b)=>b.at-a.at);
    const name=employee.user.fullName||employee.user.login||'Xodim';
    return `<div class="hetk-rank-detail-view"><div class="hetk-rank-mobile-back"><button type="button" data-rank-back><i class="fas fa-arrow-left"></i> Reytingga qaytish</button></div><header class="hetk-rank-user-header"><span class="hetk-rank-big-avatar">${rankAvatar(name)}</span><div class="hetk-rank-user-identity"><h3>${esc(name)}</h3><p><i class="fas fa-location-dot"></i> ${esc(employee.area.name)}</p><p><i class="fas fa-briefcase"></i> ${esc(employee.user.roleLabel||roleLabel(employee.user.role))}</p></div><div class="hetk-rank-total"><small>Qayd etilgan ochiq boblar</small><strong>${employee.opened} <span>bob</span></strong>${rankBar(employee.total?Math.round(employee.opened/employee.total*100):0)}<small>${employee.books.length} ta kitob · ${employee.passed} ta bob testi o‘tilgan</small></div></header><nav class="hetk-rank-tabs" aria-label="Xodimning o‘qish ko‘rsatkichlari">${[['current','Hozirgi kitob','fa-book-open'],['chapters','Ochilgan boblar','fa-list-check'],['history','O‘qish tarixi','fa-clock-rotate-left'],['books','O‘qiyotgan kitoblar','fa-layer-group']].map(([id,label,icon])=>`<button type="button" class="${state.rankPanel===id?'active':''}" data-rank-panel="${id}"><i class="fas ${icon}"></i> ${label}</button>`).join('')}</nav>
      ${state.rankPanel==='history'?`<section class="hetk-rank-detail-card"><h4>So‘nggi qayd etilgan faollik</h4>${recent.length?recent.slice(0,60).map(c=>`<div class="hetk-rank-chapter-row"><i class="fas ${c.passed?'fa-circle-check':'fa-clock'}"></i><span><b>${esc(c.order+'-bob. '+c.title)}</b><small>${esc(c.bookTitle)}</small></span><time>${fmt(c.at)}</time></div>`).join(''):'<p>Vaqt ko‘rsatkichi yozilmagan.</p>'}</section>`:state.rankPanel==='books'?`<section class="hetk-rank-detail-card"><h4>O‘qish boshlangan kitoblar (${employee.books.length})</h4>${employee.books.map(b=>`<button type="button" class="hetk-rank-book-row" data-rank-book="${esc(b.id)}"><span class="hetk-rank-cover-icon"><i class="fas fa-book"></i></span><span><b>${esc(b.title)}</b><small>${b.opened}/${b.total} ta bob ochilgan · ${b.passed} ta bob testi o‘tilgan</small>${rankBar(b.percent)}</span><strong>${b.percent}%</strong><i class="fas fa-chevron-right"></i></button>`).join('')}</section>`:state.rankPanel==='chapters'?`<section class="hetk-rank-detail-card"><div class="hetk-rank-chapters-head"><h4>Boblar holati</h4><select data-rank-detail-book aria-label="Kitobni tanlash">${employee.books.map(b=>`<option value="${esc(b.id)}" ${b.id===book.id?'selected':''}>${esc(b.title)}</option>`).join('')}</select></div>${allChapters.map(c=>`<div class="hetk-rank-chapter-row"><i class="fas ${c.passed?'fa-check-circle':c.opened?'fa-book-open':'fa-circle'} ${c.opened||c.passed?'is-recorded':''}"></i><span><b>${esc(c.order+'-bob. '+c.title)}</b><small>${c.passed?'Bob testi o‘tilgan':c.opened?'Bob ochilgan':'Ochilishi qayd etilmagan'}</small></span>${c.openedAt||c.testAt?`<time>${fmt(Math.max(c.openedAt,c.testAt))}</time>`:''}</div>`).join('')}</section>`:`<div class="hetk-rank-current-book"><span class="hetk-rank-cover"><i class="fas fa-book-open"></i></span><div><h4>${esc(book.title)}</h4><span class="hetk-rank-pill">So‘nggi qayd etilgan kitob</span><p>${current?esc(current.order+'-bob. '+current.title):'Bob ma’lumoti yo‘q'}</p><small>Ochilgan boblar: ${book.opened}/${book.total}</small>${rankBar(book.percent)}<div class="hetk-rank-small-meta"><span>${book.passed} ta bob testi o‘tilgan</span><span>Oxirgi qayd: ${fmt(book.lastAt)}</span></div></div></div><section class="hetk-rank-detail-card"><h4>Boblar (${book.opened}/${book.total} ochilgan)</h4>${book.chapters.map(c=>`<div class="hetk-rank-chapter-row"><i class="fas ${c.passed?'fa-check-circle':c.opened?'fa-book-open':'fa-circle'} ${c.opened||c.passed?'is-recorded':''}"></i><span><b>${esc(c.order+'-bob. '+c.title)}</b><small>${c.passed?'Test o‘tilgan':c.opened?'Ochilgan':'Qayd yo‘q'}</small></span></div>`).join('')}</section><section class="hetk-rank-detail-card"><h4>Boshqa kitoblar</h4>${employee.books.map(b=>`<button type="button" class="hetk-rank-book-row ${b.id===book.id?'selected':''}" data-rank-book="${esc(b.id)}"><span class="hetk-rank-cover-icon"><i class="fas fa-book"></i></span><span><b>${esc(b.title)}</b><small>${b.opened}/${b.total} bob</small>${rankBar(b.percent)}</span><strong>${b.percent}%</strong></button>`).join('')}</section>`}</div>`;
  }
  function renderReadingRank(){
    if(!canViewReadingRanking())return empty('fa-lock','Ruxsat yo‘q','Bo‘lim faqat TB muhandisi va bosh administrator uchun.');
    const opts=rankOptions(),rows=rankEmployeeRows();
    let selected=rows.find(x=>x.id===state.rankSelected);
    if(!selected&&rows.length){selected=rows[0];state.rankSelected=selected.id;state.rankDetailBook='';}
    const status=state.rankLoading?`${state.rankDone}/${state.rankTotal||'…'} ta xodim tekshirilmoqda. Ro‘yxat yangilanmoqda…`:state.rankLoaded?'Faqat kitobni ochgan yoki bob testidan o‘tgan xodimlar ko‘rsatiladi.':'Ma’lumotlar yuklanmoqda…';
    return `<section class="hetk-reading-rank ${state.rankMobileDetail?'is-detail-mobile':''}"><div class="hetk-rank-heading"><div><h2><i class="fas fa-ranking-star"></i> Xodimlar reytingi</h2><p>Ko‘proq bob ochgan xodim yuqorida turadi. Bu o‘qishni tugatganlik bahosi emas.</p></div><div class="hetk-rank-hint"><i class="fas fa-circle-info"></i><span>${esc(status)}</span></div></div>
    <div class="hetk-rank-filters"><label><span>Hudud</span><select data-rank-filter="folder"><option value="all">Barcha ruxsat etilgan hududlar</option>${opts.folders.map(id=>`<option value="${esc(id)}" ${state.rankFolder===id?'selected':''}>${esc(folderName(id))}</option>`).join('')}</select></label><label><span>Kitob</span><select data-rank-filter="book"><option value="all">Barcha kitoblar</option>${opts.books.map(b=>`<option value="${esc(b.id)}" ${state.rankBook===b.id?'selected':''}>${esc(b.title)}</option>`).join('')}</select></label><label><span>Saralash usuli</span><select data-rank-filter="sort">${[['chapters','Ko‘p bob ochganlar'],['books','Ko‘p kitob ochganlar'],['percent','Yuqori foiz'],['recent','So‘nggi faollik']].map(([k,v])=>`<option value="${k}" ${state.rankSort===k?'selected':''}>${v}</option>`).join('')}</select></label><button type="button" data-rank-reset><i class="fas fa-rotate-right"></i> Filtrlarni tozalash</button><button type="button" data-rank-refresh title="Ma’lumotlarni yangilash"><i class="fas fa-arrows-rotate"></i></button></div>
    ${state.rankError?`<p class="hetk-rank-error" role="alert"><i class="fas fa-triangle-exclamation"></i> ${esc(state.rankError)}</p>`:''}
    <div class="hetk-rank-split"><aside class="hetk-rank-list-pane"><div class="hetk-rank-list-head"><strong data-rank-count>Jami: ${rows.length} nafar xodim</strong><label><i class="fas fa-search"></i><input type="search" data-rank-search placeholder="Xodimni izlash..." value="${esc(state.rankSearch)}" autocomplete="off" aria-label="Xodimni izlash"></label></div><div class="hetk-rank-list" data-rank-list>${rankListHTML(rows)}</div></aside><div class="hetk-rank-detail-pane" data-rank-detail>${rankDetailHTML(selected)}</div></div><p class="hetk-rank-disclaimer">Reyting bob ochilganligi qaydlari asosida hisoblanadi. Kitobni ochish uning to‘liq o‘qilganini anglatmaydi. V32 dan oldingi yozilmagan boblar hisobga kirmaydi.</p></section>`;
  }
  function renderHome(){
    const tests=visibleTests(),live=tests.filter(t=>statusOf(t)==='live'&&!myResult(t.id)),next=tests.filter(t=>statusOf(t)==='scheduled').sort((a,b)=>a.startAt-b.startAt)[0];
    const resultList=Object.values(state.results).map(group=>group&&group[uid()]).filter(isCurrentAnnualResult),passed=resultList.filter(r=>r.percent>=70).length,firstBook=Object.values(state.books)[0]||{};
    return `<section class="hetk-training-welcome"><div><span>${state.lang==='ru'?'ПРОДОЛЖИТЬ':'DAVOM ETTIRISH'}</span><h3>${esc(localized(firstBook,'title')||(state.lang==='ru'?'Правила безопасности в электроустановках':'Elektr qurilmalarida xavfsizlik qoidalari'))}</h3><p>${esc(localized(firstBook,'description')||(state.lang==='ru'?'Читайте материал, слушайте аудио и проходите контрольные тесты.':'Materialni o‘qing, audio tinglang va nazorat testlarini yeching.'))}</p><button type="button" data-go="books"><i class="fas fa-book-open"></i> ${tr('continue')}</button></div><i class="fas fa-shield-halved"></i></section>
      <section class="hetk-training-kpis"><div><i class="fas fa-book"></i><b>${Object.keys(state.books).length}</b><span>Mavjud kitob</span></div><div><i class="fas fa-circle-play"></i><b>${live.length}</b><span>Jonli test</span></div><div><i class="fas fa-clipboard-check"></i><b>${resultList.length}</b><span>Topshirilgan</span></div><div><i class="fas fa-award"></i><b>${passed}</b><span>Muvaffaqiyatli</span></div></section>
      ${live.length?`<section class="hetk-training-live-call"><div><span><i class="fas fa-tower-broadcast"></i> HOZIR JONLI</span><h3>${esc(live[0].title)}</h3><p>Test ${fmt(live[0].endAt)} da yopiladi. Kech kirgan xodimga qo‘shimcha vaqt berilmaydi.</p></div><button type="button" data-open-test="${live[0].id}">Testga kirish</button></section>`:''}
      ${next?`<section class="hetk-training-next"><div class="hetk-training-next-icon"><i class="fas fa-clock"></i></div><div><span>Keyingi onlayn test</span><h3>${esc(next.announcementMode==='hidden'?'Yashirin onlayn test':next.title)}</h3><p>${fmt(next.startAt)} · ${next.durationMinutes} daqiqa · ${next.questionLimit||next.totalQuestions||0} savol</p></div><strong data-countdown="${next.startAt}">${durationText(next.startAt-now())}</strong></section>`:''}
      <div class="hetk-training-section-title"><h3>Tezkor bo‘limlar</h3></div><section class="hetk-training-actions"><button type="button" data-go="books"><i class="fas fa-book-open"></i><b>Kitoblar</b><span>Onlayn o‘qing yoki audio tinglang</span></button><button type="button" data-go="tests"><i class="fas fa-list-check"></i><b>Mustaqil testlar</b><span>Rejalashtirilgan va oddiy sinovlar</span></button><button type="button" data-go="results"><i class="fas fa-ranking-star"></i><b>Reytingim</b><span>Natijalar va egallagan o‘rin</span></button>${canCreate()?'<button type="button" data-go="manage"><i class="fas fa-circle-plus"></i><b>Test yaratish</b><span>Viloyat yoki respublika uchun</span></button>':''}</section>`;
  }
  function renderBooks(){
    if(!state.booksLoaded)return empty('fa-spinner','Kitoblar yuklanmoqda','Faqat shu bo‘lim ochilgani uchun kitoblar hozir yuklanmoqda.');
    const all=Object.entries(state.books).sort((a,b)=>(b[1].updatedAt||0)-(a[1].updatedAt||0));
    const books=all.filter(([id,b])=>isSuperAdmin()||b.published===true);
    const adminPanel=isSuperAdmin()?`<section class="hetk-book-visibility-manager"><div class="hetk-visibility-head"><div><span>BOSH ADMINISTRATOR</span><h4>Kitoblar ko‘rinishini boshqarish</h4><p>Yangi kitob va yangi boblar avtomatik yashirin turadi. Tayyor bo‘lganda shu yerdan xodimlarga ochasiz.</p></div><button type="button" data-go="bookAdmin"><i class="fas fa-plus"></i> Yangi kitob</button></div><div class="hetk-visibility-list">${all.length?all.map(([id,b])=>{const ch=chapterEntries(b),visible=ch.filter(x=>x[1].published===true).length;return `<article><div class="hetk-visibility-book"><i class="fas fa-book"></i><div><b>${esc(b.titleUz||'Nomsiz kitob')}</b><small>${ch.length} bob · ${visible} tasi xodimga ochiq</small></div></div><button type="button" class="hetk-visibility-toggle ${b.published?'is-on':''}" data-toggle-book-visibility="${id}" aria-pressed="${b.published?'true':'false'}"><i class="fas ${b.published?'fa-eye':'fa-eye-slash'}"></i><span>${b.published?'Kitob ko‘rinadi':'Kitob yashirin'}</span></button><button type="button" class="hetk-visibility-edit" data-edit-admin-book="${id}"><i class="fas fa-pen"></i></button><div class="hetk-visibility-chapters">${ch.length?ch.map(([cid,c])=>`<button type="button" class="${c.published===true?'is-on':''}" data-toggle-chapter-visibility="${id}:${cid}" ${b.published!==true?'disabled':''}><span>${Number(c.order)||'•'}-bob</span><i class="fas ${c.published===true?'fa-eye':'fa-eye-slash'}"></i></button>`).join(''):'<small>Bob yo‘q</small>'}</div></article>`}).join(''):'<p class="hetk-book-no-chapter">Hali kitob yaratilmagan.</p>'}</div></section>`:'';
    return `${adminPanel}<div class="hetk-training-page-head"><div><h3>${isSuperAdmin()?'Kutubxona ko‘rinishi':'Kitoblar kutubxonasi'}</h3><p>${isSuperAdmin()?'Xodimlarga ochilgan kitoblar va tayyor materiallar.':'Tilni tanlang, onlayn o‘qing yoki audio shaklida tinglang.'}</p></div><label><i class="fas fa-search"></i><input type="search" autocomplete="off" data-book-search placeholder="Kitob nomini qidiring..."></label></div><div class="hetk-v12-book-filters"><button type="button" data-book-filter="all" class="${state.bookFilter==='all'?'active':''}">Barchasi</button><button type="button" data-book-filter="training" class="${state.bookFilter==='training'?'active':''}">O‘quv kitoblari</button><button type="button" data-book-filter="industry" class="${state.bookFilter==='industry'?'active':''}">Sohaga oid kitoblar</button></div><div class="hetk-training-books">${books.length?books.filter(([,b])=>state.bookFilter==='all'||(b.bookType||'training')===state.bookFilter).map(([id,b])=>{const progress=bookProgressSummary(id,b),count=chapterEntries(b).filter(x=>isSuperAdmin()||x[1].published===true).length;return `<article class="hetk-training-book-card" data-book-card data-search="${esc((b.titleUz||b.title||'').toLowerCase())}"><h4 title="${esc(b.titleUz||b.title||'Nomsiz kitob')}">${esc(b.titleUz||b.title||'Nomsiz kitob')}</h4><div class="hetk-training-book-cover">${bookCoverMarkup(b,b.titleUz||'Kitob muqovasi')}<span>${esc(b.category||'Qo‘llanma')}</span></div><div class="hetk-training-book-info"><span class="hetk-v12-type-tag">${isIndustryBook(b)?'Sohaga oid · Testsiz':'O‘quv kitobi · Bob nazorati'}</span><p>${esc(b.descriptionUz||'Onlayn o‘qish va audio dars mavjud.')}</p><div><span><i class="fas fa-layer-group"></i> ${count} bob</span><span><i class="fas fa-headphones"></i> Audio</span></div>${progress.total?`<div class="hetk-book-user-progress"><span><i style="width:${progress.percent}%"></i></span><small>${progress.passed}/${progress.total} bob testi · ${progress.percent}%</small></div>`:''}<button type="button" data-open-book="${id}">Kitobni ochish</button></div></article>`;}).join(''):empty('fa-book','Ko‘rinadigan kitob yo‘q',isSuperAdmin()?'Yuqoridagi boshqaruvdan tayyor kitobni xodimlarga oching.':'Administrator kitobni ochgandan keyin shu yerda ko‘rinadi.')}</div>`;
  }
  function chapterEntries(book){return Object.entries((book&&book.chapters)||{}).sort((a,b)=>(Number(a[1].order)||0)-(Number(b[1].order)||0));}
  function nextChapterOrder(book){const rows=chapterEntries(book);return rows.length?Math.max(...rows.map(x=>Number(x[1].order)||0))+1:1;}
  function chapterStatus(ch){if(!ch)return 'Yangi';if(chapterHasAudio(ch))return 'Audio tayyor';if(ch.ttsTextUz)return 'TTS matni tayyor';if(ch.sourceTextUz)return 'Asl matn tayyor';return 'Boshlanmagan';}
  function currentAdminBook(){return state.bookAdminBookId&&state.books[state.bookAdminBookId]||null;}
  function currentAdminChapter(book){if(!book)return null;return state.bookAdminChapterId&&book.chapters&&book.chapters[state.bookAdminChapterId]||null;}
  function bookCoverMarkup(book,alt){if(book&&book.coverFileId&&book.coverStorage==='training-media')return `<img data-training-media-file="${esc(book.coverFileId)}" alt="${esc(alt||'Kitob muqovasi')}">`;if(book&&book.coverUrl)return `<img src="${esc(book.coverUrl)}" alt="${esc(alt||'Kitob muqovasi')}">`;return '<i class="fas fa-book-open"></i>';}
  function chapterAudioParts(ch){
    if(!ch)return [];
    let parts=[];
    if(Array.isArray(ch.audioParts))parts=ch.audioParts;
    else if(ch.audioParts&&typeof ch.audioParts==='object')parts=Object.values(ch.audioParts);
    parts=parts.filter(x=>x&&x.fileId).sort((a,b)=>(Number(a.partNumber||a.order)||0)-(Number(b.partNumber||b.order)||0));
    if(!parts.length&&ch.audio&&ch.audio.fileId)parts=[{...ch.audio,partNumber:1}];
    return parts;
  }
  function chapterHasAudio(ch){return chapterAudioParts(ch).length>0;}
  function audioPartUrl(part){return part&&part.fileId&&part.storage!=='training-media'?`${LEGACY_TELEGRAM_WORKER}/telegram/file?file_id=${encodeURIComponent(part.fileId)}`:'';}
  function audioPartAttrs(part){if(!part||!part.fileId)return '';const size=`data-media-size="${Number(part.size)||0}"`;return part.storage==='training-media'?`data-training-media-file="${esc(part.fileId)}" ${size}`:`src="${esc(audioPartUrl(part))}" ${size}`;}
  function audioLoadingMarkup(index){return `<small class="hetk-media-loading ${index?'is-waiting':''}" data-media-loading><span>${index?'Navbatda':'Yuklanmoqda: 0%'}</span><i><b style="width:0%"></b></i></small>`;}
  function renderChapterAudioList(ch,context){
    const parts=chapterAudioParts(ch),total=parts.length;if(!total)return '';
    return `<div class="hetk-chapter-audio-list ${context==='admin'?'is-admin':''}" data-audio-playlist>${parts.map((part,i)=>`<article><div><b><i class="fas fa-volume-high"></i> ${total===1?'Bob audiosi':`${i+1}-audio qism`}</b><small>${part.size?mediaSize(part.size):''}</small></div>${context==='admin'?'<button type="button" class="hetk-v24-preview-audio" data-v24-audio-preview><i class="fas fa-play"></i> Eshitib ko‘rish</button>':''}<audio controls controlsList="nodownload" oncontextmenu="return false" preload="none" data-playlist-index="${i}" ${audioPartAttrs(part)}></audio>${audioLoadingMarkup(i)}</article>`).join('')}</div>`;
  }
  function topicEntries(ch){return Object.entries((ch&&ch.topics)||{}).sort((a,b)=>(Number(a[1].order)||0)-(Number(b[1].order)||0));}
  function topicAudioParts(topic){let parts=topic&&topic.audioParts||[];if(!Array.isArray(parts)&&parts&&typeof parts==='object')parts=Object.values(parts);return (parts||[]).filter(x=>x&&x.fileId).sort((a,b)=>(Number(a.partNumber)||0)-(Number(b.partNumber)||0));}
  function topicTitle(topic,edition){return String(edition==='cyrillic'?(topic.titleCyrillic||topic.titleLatin):(topic.titleLatin||topic.titleCyrillic)||'Mavzu');}
  function topicBlocks(topic,edition){const ed=(topic&&topic.editions&&topic.editions[edition])||{};return Array.isArray(ed.blocks)?ed.blocks:Object.values(ed.blocks||{});}
  function plainTextToRichHtml(text){return String(text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\r\n?/g,'\n').split('\n').map(line=>`<div>${line||'<br>'}</div>`).join('');}
  function safeRichHtml(html){
    const source=String(html||'').trim();if(!source)return '';
    const doc=new DOMParser().parseFromString(`<div>${source}</div>`,'text/html'),root=doc.body.firstElementChild,allowed=new Set(['DIV','P','BR','H1','H2','H3','B','STRONG','I','EM','U','UL','OL','LI','SPAN','BUTTON','FONT','FIGURE','FIGCAPTION','IMG']);
    [...root.querySelectorAll('*')].forEach(el=>{if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return;}[...el.attributes].forEach(a=>{const ok=a.name==='data-training-media-file'||a.name==='data-book-note'||a.name==='data-book-note-image'||a.name==='title'||a.name==='tabindex'||a.name==='role'||a.name==='alt'||a.name==='class'||a.name==='style'||(el.tagName==='FONT'&&(a.name==='color'||a.name==='size'));if(!ok)el.removeAttribute(a.name);});if(el.hasAttribute('style')){const style=el.style,keep=[];if(style.textAlign)keep.push(`text-align:${style.textAlign}`);if(style.color)keep.push(`color:${style.color}`);if(style.fontSize)keep.push(`font-size:${style.fontSize}`);if(el.tagName==='IMG'&&/^\d{1,3}%$/.test(style.maxWidth))keep.push(`max-width:${style.maxWidth}`);el.setAttribute('style',keep.join(';'));}if(el.tagName==='IMG'&&!el.getAttribute('data-training-media-file'))el.remove();});return root.innerHTML;
  }
  function chapterRichHtml(ch){const html=safeRichHtml(ch&&ch.sourceHtmlUz);if(html)return html;const text=ch&&ch.sourceTextUz||'';if(!String(text).trim()&&topicEntries(ch).length)return '';return plainTextToRichHtml(text||'Matn kiritilmagan.');}
  function renderContentBlocks(topic,edition){const blocks=topicBlocks(topic,edition);if(!blocks.length)return `<p class="hetk-topic-empty">Bu nashr uchun matn kiritilmagan.</p>`;return `<div class="hetk-topic-content-blocks">${blocks.map(block=>{if(block.type==='image'&&block.fileId)return `<figure class="layout-${esc(block.layout||'auto')}"><img style="max-width:${Math.max(20,Math.min(100,Number(block.width)||100))}%" data-training-media-file="${esc(block.fileId)}" alt="${esc(block.caption||'Mavzu rasmi')}">${block.caption?`<figcaption>${esc(block.caption)}</figcaption>`:''}</figure>`;if(block.type==='heading')return `<h3 style="text-align:${esc(block.align||'left')};color:${esc(!block.color||block.color==='#123c55'?'inherit':block.color)}">${block.html?safeRichHtml(block.html):esc(block.text||'')}</h3>`;return `<p style="font-size:${Math.max(14,Math.min(28,Number(block.fontSize)||19))}px;text-align:${esc(block.align||'left')};color:${esc(!block.color||block.color==='#183b50'?'inherit':block.color)}">${block.html?safeRichHtml(block.html):esc(block.text||'').replace(/\n/g,'<br>')}</p>`;}).join('')}</div>`;}
  function renderTopicAudioList(topic){const parts=topicAudioParts(topic);if(!parts.length)return `<div class="hetk-topic-no-audio"><i class="fas fa-volume-xmark"></i> Bu mavzu audiosi tayyorlanmagan.</div>`;return `<div class="hetk-chapter-audio-list" data-audio-playlist>${parts.map((part,i)=>`<article><div><b><i class="fas fa-volume-high"></i> ${parts.length===1?'Mavzu audiosi':`${i+1}-audio qism`}</b><small>${part.size?mediaSize(part.size):''}</small></div><button type="button" class="hetk-v24-preview-audio" data-v24-audio-preview><i class="fas fa-play"></i> Eshitib ko‘rish</button><audio controls controlsList="nodownload" oncontextmenu="return false" preload="none" data-playlist-index="${i}" ${audioPartAttrs(part)}></audio>${audioLoadingMarkup(i)}</article>`).join('')}</div>`;}
  function renderChapterTopicAudio(topics,edition){let index=0;const sections=topics.map(([,topic],topicIndex)=>{const parts=topicAudioParts(topic);if(!parts.length)return '';const between=topic.interludeText||topic.interludeImage&&topic.interludeImage.fileId?`<div class="hetk-audio-interlude">${topic.interludeText?`<div class="hetk-audio-interlude-text">${esc(topic.interludeText).replace(/\n/g,'<br>')}</div>`:''}${topic.interludeImage&&topic.interludeImage.fileId?`<img data-training-media-file="${esc(topic.interludeImage.fileId)}" alt="${esc(topicTitle(topic,edition))} rasmi">`:''}</div>`:'';return `<section class="hetk-topic-playlist-section"><h3><span>${topicIndex+1}</span>${esc(topicTitle(topic,edition))}</h3>${parts.map((part,partIndex)=>{const current=index++;return `<article><div><b>${partIndex+1}-qism</b><small>${mediaSize(part.size||0)}</small></div><div class="hetk-sequential-audio"><audio controls controlsList="nodownload" oncontextmenu="return false" preload="none" data-training-media-file="${esc(part.fileId||'')}" data-media-size="${Number(part.size)||0}" data-playlist-index="${current}"></audio>${audioLoadingMarkup(current)}</div></article>`;}).join('')}${between}</section>`;}).join('');return sections?`<div class="hetk-topic-full-playlist" data-audio-playlist>${sections}</div>`:'<div class="hetk-training-empty">Bu bob mavzulariga audio hali yuklanmagan.</div>';}
  // Birinchi mavzu alohida nusxa emas: bobning tarixiy sourceHtml/sourceText maydonlari.
  // Shu yo‘l bilan 1–4-boblarning yozuvlari va audio havolalari ko‘chirilmaydi.
  const PRIMARY_BOOK_TOPIC='__chapter__';
  function normalizedBookText(value){return String(value||'').replace(/\s+/g,' ').trim().toLocaleLowerCase();}
  function plainTopicText(topic){return topicBlocks(topic,'latin').filter(block=>block.type!=='image').map(block=>{
    const node=document.createElement('div');node.innerHTML=block.html?safeRichHtml(block.html):esc(block.text||'');return node.textContent||'';
  }).join(' ');}
  function isDuplicateLegacyTopic(ch,topic){
    // Display-only legacy compatibility: do not delete/merge Firebase data or audio.
    const base=document.createElement('div');base.innerHTML=chapterRichHtml(ch);
    const a=normalizedBookText(base.textContent),b=normalizedBookText(plainTopicText(topic));
    if(b.length<80||!a||topicBlocks(topic,'latin').some(block=>block.type==='image'))return false;
    return a===b||a.includes(b);
  }
  function renderChapterTopicsAsText(ch){
    const topics=topicEntries(ch).filter(([,topic])=>isSuperAdmin()||topic.published!==false);
    return topics.filter(([,topic])=>!isDuplicateLegacyTopic(ch,topic)).map(([,topic])=>
      `<section class="hetk-v24-topic-text" aria-label="${esc(topicTitle(topic,state.readerEdition))}">${renderContentBlocks(topic,state.readerEdition)}</section>`
    ).join('');
  }
  function renderChapterAudioSelector(ch){
    const topics=topicEntries(ch).filter(([,topic])=>(isSuperAdmin()||topic.published!==false)&&!isDuplicateLegacyTopic(ch,topic));
    const hasChapter=chapterHasAudio(ch);
    const choices=[...(hasChapter?[[PRIMARY_BOOK_TOPIC,'1-mavzu — bobning boshlang‘ich qismi',chapterAudioParts(ch)]]:[]),...topics.map(([id,topic],i)=>[id,`${i+2}-mavzu. ${topicTitle(topic,state.readerEdition)}`,topicAudioParts(topic)])];
    const available=choices.filter(([, ,parts])=>parts.length);
    if(!available.length)return '<div class="hetk-v12-no-audio">Bu bobda audio mavjud emas.</div>';
    if(!available.some(([id])=>id===state.activeAudioTopicId))state.activeAudioTopicId=available[0][0];
    const current=available.find(([id])=>id===state.activeAudioTopicId)||available[0];
    // Buttons avoid the native select closing when the reader rerenders on click.
    const selector=choices.length>1?`<div class="hetk-v20-audio-select hetk-v22-audio-picker" role="group" aria-label="Tinglash uchun bo‘lim"><strong>Tinglash uchun bo‘lim</strong><div class="hetk-v22-audio-options">${choices.map(([id,title,parts])=>`<button type="button" data-v22-audio-choice="${esc(id)}" class="${id===current[0]?'on':''}" aria-pressed="${id===current[0]?'true':'false'}" ${parts.length?'':'disabled'}>${esc(title)}${parts.length?'':' · audio mavjud emas'}</button>`).join('')}</div></div>`:'';
    return `<div class="hetk-v20-audio-container">${selector}${renderUnifiedBookAudio(current[2],current[1],current[0])}</div>`;
  }

  function renderChapterGate(bookId,chapters,index,ch){
    const questions=chapterTestQuestions(ch),progress=chapterProgress(bookId,chapters[index][0]),next=chapters[index+1];
    if(!questions.length)return next?`<section class="hetk-chapter-gate is-open"><i class="fas fa-arrow-right"></i><div><b>Bu bobda nazorat testi belgilanmagan</b><span>Keyingi bobga o‘tishingiz mumkin.</span></div><button type="button" data-reader-open-next>Keyingi bob</button></section>`:'';
    if(progress.passed)return `<section class="hetk-chapter-gate is-passed"><i class="fas fa-circle-check"></i><div><b>Bob testi bajarilgan — ${Number(progress.percent)||0}%</b><span>${next?'Keyingi bob ochildi.':'Kitobning oxirgi bobini yakunladingiz.'}</span></div>${next?'<button type="button" data-reader-open-next>Keyingi bobga o‘tish</button>':''}</section>`;
    const lockUntil=Number(progress.lockUntil)||0,lockLeft=lockUntil-now();
    if(lockLeft>0)return `<section class="hetk-chapter-gate is-retry-locked"><i class="fas fa-hourglass-half"></i><div><b>Test vaqtincha yopildi — bobni yana o‘qib chiqing</b><span>Qayta test ishlashgacha: <strong data-chapter-lock-countdown="${lockUntil}">${durationText(lockLeft)}</strong></span><small>Oxirgi natija: ${Number(progress.percent)||0}% · urinishlar: ${Number(progress.attempts)||1}</small></div><button type="button" disabled>Test yopiq</button></section>`;
    const seconds=questions.reduce((sum,q)=>sum+Math.max(30,Math.min(600,Number(q.timeSeconds)||90)),0),pass=Number((ch.chapterTest||{}).passPercent)||70;
    return `<section class="hetk-chapter-gate"><i class="fas fa-lock"></i><div><b>Keyingi bob uchun nazorat testi</b><span>${questions.length} ta savol · ${Math.ceil(seconds/60)} daqiqagacha · o‘tish normasi ${pass}%</span>${progress.attempts?`<small>Oxirgi natija: ${Number(progress.percent)||0}% · urinishlar: ${Number(progress.attempts)||1}</small>`:''}</div><button type="button" data-start-chapter-quiz>Testni boshlash</button></section>`;
  }
  function renderChapterQuiz(bookId,chapterId,ch){
    const quiz=state.chapterQuiz,questions=chapterTestQuestions(ch);if(!quiz||quiz.bookId!==bookId||quiz.chapterId!==chapterId)return '';
    if(quiz.result){const r=quiz.result;return `<section class="hetk-chapter-quiz-result ${r.passed?'passed':'failed'}"><i class="fas ${r.passed?'fa-trophy':'fa-book-open-reader'}"></i><h2>${r.passed?'Norma bajarildi':'Talab bajarilmadi'}</h2><strong>${r.percent}%</strong><p>${r.correct}/${r.total} ta to‘g‘ri · talab ${r.passPercent}%</p>${r.passed?'<small>Keyingi bob ochildi.</small>':`<div class="hetk-chapter-retry-message"><b>Bobni yana o‘qib chiqing</b><span>Qayta urinishgacha: <strong data-chapter-lock-countdown="${r.lockUntil}">${durationText(Math.max(0,r.lockUntil-now()))}</strong></span></div>`}<footer><button type="button" data-close-chapter-quiz>${r.passed?'Bobga qaytish':'O‘qishga qaytish'}</button></footer></section>`;}
    const index=Math.max(0,Math.min(quiz.index,questions.length-1)),q=questions[index],selected=quiz.answers[index],left=Math.max(0,quiz.deadlineAt-now());
    return `<section class="hetk-chapter-quiz"><header><div><span>BOB NAZORATI</span><h2>${index+1}/${questions.length}-savol</h2></div><strong data-chapter-quiz-countdown="${quiz.deadlineAt}">${durationText(left)}</strong></header><div class="hetk-chapter-quiz-progress"><i style="width:${Math.round((index+1)/questions.length*100)}%"></i></div><article><h3>${esc(q.text)}</h3>${q.options.map((option,oi)=>`<label><input type="radio" name="chapterQuizAnswer" value="${oi}" ${Number(selected)===oi?'checked':''}><span>${esc(option)}</span></label>`).join('')}</article><footer><small>Vaqt tugasa javobsiz keyingi savolga o‘tadi.</small><button type="button" data-chapter-quiz-next>${index===questions.length-1?'Testni yakunlash':'Keyingi savol'}</button></footer></section>`;
  }

  function renderUnifiedBookAudio(parts,label,audioTopicId="__chapter__"){
    return `<section class="hetk-v12-player" data-v12-player data-v12-book="${esc(state.activeBookId)}" data-v12-chapter="${esc(state.activeChapterId)}" data-v12-topic="${esc(audioTopicId)}">
      <div class="hetk-v12-player-icon"><i class="fas fa-headphones"></i></div><span class="hetk-v12-eyebrow">AUDIOKITOB</span><h2>${esc(label)}</h2><p>${parts.length} ta qism · uzluksiz tinglash</p>
      <div class="hetk-v12-player-core"><div class="hetk-v12-player-progress"><input type="range" min="0" max="1000" value="0" data-v12-seek aria-label="Audio vaqtini o‘zgartirish"><div><span data-v12-current>00:00</span><span data-v12-duration>--:--</span></div></div>
      <div class="hetk-v12-player-actions"><button type="button" data-v12-back aria-label="15 soniya orqaga"><i class="fas fa-rotate-left"></i><small>15</small></button><button type="button" class="hetk-v12-main-play" data-v12-play aria-label="Ijro etish"><i class="fas fa-play"></i></button><button type="button" data-v12-forward aria-label="15 soniya oldinga"><i class="fas fa-rotate-right"></i><small>15</small></button></div>
      <div class="hetk-v12-player-options"><label>Tezlik <select data-v12-speed><option value="0.75">0.75×</option><option value="1" selected>1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label><label><input type="checkbox" data-v12-autonext checked> Keyingi qismga avtomatik o‘tish</label></div></div>
      <div class="hetk-v12-parts"><h3>Audio qismlari</h3>${parts.map((part,i)=>`<button type="button" data-v12-part="${i}" ${i===0?'class="active"':''}><i class="fas fa-volume-high"></i><span>${i+1}-qism</span><small>${part.size?mediaSize(part.size):''}</small></button>`).join('')}</div>
      <audio preload="none" controlsList="nodownload" oncontextmenu="return false" data-v12-audio aria-label="Audiokitob ijrosi"></audio>
      <script type="application/json" data-v12-parts>${JSON.stringify(parts.map(x=>({fileId:x.fileId,storage:x.storage,size:x.size}))).replace(/</g,'\u003c')}</script>
      <p class="hetk-v12-protected"><i class="fas fa-shield-halved"></i> Materiallar faqat tizimda tinglash uchun.</p>
    </section>`;
  }
  function bindUnifiedBookPlayers(root){
    (root||document).querySelectorAll('[data-v12-player]').forEach(player=>{
      if(player.dataset.bound)return;player.dataset.bound='1';
      const audio=player.querySelector('[data-v12-audio]'),parts=JSON.parse(player.querySelector('[data-v12-parts]').textContent),seek=player.querySelector('[data-v12-seek]'),play=player.querySelector('[data-v12-play]'),buttons=[...player.querySelectorAll('[data-v12-part]')];
      const key=`hetkAudioResume:${uid()}:${player.dataset.v12Book}:${player.dataset.v12Chapter}:${player.dataset.v12Topic||"__chapter__"}`;
      let index=0,loading=false,lastSave=0,token=0;
      const fmt=t=>{t=Math.max(0,Math.floor(Number(t)||0));return `${Math.floor(t/60).toString().padStart(2,'0')}:${(t%60).toString().padStart(2,'0')}`;};
      const save=()=>{try{localStorage.setItem(key,JSON.stringify({index,time:audio.currentTime||0}));}catch(_){}};
      const update=()=>{const duration=Number.isFinite(audio.duration)?audio.duration:0;seek.value=duration?Math.round(audio.currentTime/duration*1000):0;player.querySelector('[data-v12-current]').textContent=fmt(audio.currentTime);player.querySelector('[data-v12-duration]').textContent=duration?fmt(duration):'--:--';play.innerHTML=`<i class="fas fa-${audio.paused?'play':'pause'}"></i>`;buttons.forEach((b,i)=>b.classList.toggle('active',i===index));};
      const open=async(i,autoplay,time=0)=>{if(i<0||i>=parts.length)return;const current=++token;index=i;loading=true;audio.pause();audio.removeAttribute('src');audio.load();update();play.disabled=true;
        try{const part=parts[i];let url;if(part.storage==='training-media')url=await trainingMediaObjectUrl(part.fileId);else url=audioPartUrl(part);if(current!==token)return;audio.src=url;audio.load();audio.playbackRate=Number(player.querySelector('[data-v12-speed]').value)||1;
          if(time>0){audio.addEventListener('loadedmetadata',()=>{if(current===token&&Number.isFinite(audio.duration))audio.currentTime=Math.min(time,Math.max(0,audio.duration-0.2));},{once:true});}
          if(autoplay)await audio.play();}catch(err){if(current===token)toast('Audio yuklanmadi: '+err.message,'error');}finally{if(current===token){loading=false;play.disabled=false;update();}}};
      play.addEventListener('click',async()=>{if(loading)return;if(!audio.src){await open(index,true);return;}if(audio.paused)await audio.play().catch(()=>{});else audio.pause();update();});
      player.querySelector('[data-v12-back]').addEventListener('click',()=>{audio.currentTime=Math.max(0,audio.currentTime-15);update();});
      player.querySelector('[data-v12-forward]').addEventListener('click',()=>{audio.currentTime=Math.min(audio.duration||0,audio.currentTime+15);update();});
      player.querySelector('[data-v12-speed]').addEventListener('change',e=>{audio.playbackRate=Number(e.target.value)||1;});
      seek.addEventListener('change',()=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(seek.value)/1000;update();save();});
      buttons.forEach((b,i)=>b.addEventListener('click',()=>open(i,true)));
      audio.addEventListener('timeupdate',()=>{update();if(Date.now()-lastSave>15000){lastSave=Date.now();save();}});
      audio.addEventListener('pause',()=>{update();save();});
      audio.addEventListener('play',update);
      audio.addEventListener('ended',()=>{save();if(index+1<parts.length&&player.querySelector('[data-v12-autonext]').checked)open(index+1,true);});
      let saved=null;try{saved=JSON.parse(localStorage.getItem(key)||'null');}catch(_){}if(saved&&Number.isInteger(saved.index)&&saved.index>=0&&saved.index<parts.length)open(saved.index,false,Number(saved.time)||0);else update();
    });
  }

  function renderBookReader(){
    const book=state.books[state.activeBookId];
    if(!book||(!isSuperAdmin()&&book.published!==true)){state.activeBookId='';return renderBooks();}
    const chapters=chapterEntries(book).filter(([id,c])=>isSuperAdmin()||c.published===true);
    if(!state.activeChapterId&&chapters.length)state.activeChapterId=chapters[0][0];
    let idx=Math.max(0,chapters.findIndex(x=>x[0]===state.activeChapterId));
    if(!chapterUnlocked(state.activeBookId,chapters,idx)){idx=Math.max(0,chapters.findIndex((row,i)=>chapterUnlocked(state.activeBookId,chapters,i)&&!chapterPassed(state.activeBookId,row[0],row[1])));state.activeChapterId=(chapters[idx]||chapters[0]||[])[0]||'';}
    const row=chapters[idx]||chapters[0],ch=row&&row[1];
    const topicAudioReady=topicEntries(ch).some(([,t])=>topicAudioParts(t).length),mode=state.readerMode==='listen'&&(chapterHasAudio(ch)||topicAudioReady)?'listen':'read';
    const theme=state.readerTheme||'dark',font=Math.max(15,Math.min(28,Number(state.readerFont)||19));
    const chapterLabel=(c)=>{const order=Number(c&&c.order)||'';let title=String(c&&c.titleUz||'Bob').trim();const re=new RegExp('^'+order+'\\s*[-–—.]?\\s*bob\\s*[.:-]?\\s*','i');title=title.replace(re,'').trim();return title&&title.toLowerCase()!=='bob'?`${order}-bob. ${title}`:`${order}-bob`;};
    const opts=chapters.map(([id,c],i)=>{const unlocked=chapterUnlocked(state.activeBookId,chapters,i),passed=chapterPassed(state.activeBookId,id,c)&&chapterTestQuestions(c).length;return `<option value="${id}" ${id===state.activeChapterId?'selected':''} ${unlocked?'':'disabled'}>${passed?'✓ ':unlocked?'':'🔒 '}${esc(chapterLabel(c))}</option>`;}).join('');
    const label=ch?chapterLabel(ch):'Bob';
    const hasTopics=topicEntries(ch).length>0;
    const textPane=`<article class="hetk-v11-page" style="--reader-font:${font}px"><h1>${esc(label)}</h1><div class="hetk-v11-text hetk-rich-book-text">${chapterRichHtml(ch)}${renderChapterTopicsAsText(ch)}</div><footer><span>${esc(label)}</span><span>${idx+1} / ${chapters.length}</span><span>${esc(book.titleUz||'Kitob')} | HETK O‘quv markazi</span></footer></article>`;
    const audioPane=renderChapterAudioSelector(ch);
    const quizActive=!!(state.chapterQuiz&&state.chapterQuiz.bookId===state.activeBookId&&state.chapterQuiz.chapterId===row[0]);
    const searchBar=`<div class="hetk-v13-searchbar" role="search"><label class="hetk-v13-search-field"><i class="fas fa-search" aria-hidden="true"></i><input type="search" data-reader-search placeholder="Bob matnidan qidirish..." autocomplete="off" aria-label="Bob matnidan qidirish"></label><span class="hetk-v13-search-count" data-reader-search-count aria-live="polite">So‘z kiriting</span><button type="button" data-reader-search-prev title="Oldingi natija" aria-label="Oldingi natija"><i class="fas fa-chevron-up"></i></button><button type="button" data-reader-search-next title="Keyingi natija" aria-label="Keyingi natija"><i class="fas fa-chevron-down"></i></button><button type="button" data-reader-search-clear title="Qidiruvni tozalash" aria-label="Qidiruvni tozalash"><i class="fas fa-times"></i></button><button type="button" data-reader-fullscreen title="Matnni kengaytirish" aria-label="Matnni kengaytirish"><i class="fas fa-expand"></i></button></div>`;
    const reading=mode==='listen'?`<div class="hetk-v13-audio-only">${audioPane}</div>`:`<div class="hetk-v13-read-only">${searchBar}${textPane}</div>`;
    const body=quizActive?renderChapterQuiz(state.activeBookId,row[0],ch):`${reading}${isIndustryBook(book)?'':renderChapterGate(state.activeBookId,chapters,idx,ch)}`;
    const nextLocked=idx>=chapters.length-1||!chapterUnlocked(state.activeBookId,chapters,idx+1);
    const bookTitle=book.titleUz||'Nomsiz kitob',longTitle=bookTitle.length>34;
    return `<div class="hetk-v11-reader hetk-v12-reader hetk-v13-reader ${quizActive?'is-quiz':mode==='listen'?'is-listening':'is-reading'} theme-${theme}"><header><div class="reader-topline"><button type="button" data-back-books><i class="fas fa-arrow-left"></i> Kitoblarga qaytish</button><b class="reader-book-title ${longTitle?'is-marquee':''}" title="${esc(bookTitle)}"><span class="reader-title-track"><span>${esc(bookTitle)}</span>${longTitle?`<span aria-hidden="true">${esc(bookTitle)}</span>`:''}</span></b></div><div class="reader-controls"><div class="chapter"><span>Bob:</span><select data-reader-select>${opts}</select><button type="button" data-reader-prev ${idx<=0?'disabled':''}>‹</button><button type="button" data-reader-next ${nextLocked?'disabled title="Avval bob testidan o‘ting"':''}>›</button></div><div class="modes"><button class="${mode==='read'?'on':''}" data-reader-mode="read"><i class="fas fa-book-open"></i> Matnni o‘qish</button>${chapterHasAudio(ch)||topicAudioReady?`<button class="${mode==='listen'?'on':''}" data-reader-mode="listen"><i class="fas fa-headphones"></i> Audio tinglash</button>`:''}</div></div></header>${!quizActive&&mode==='read'?`<div class="tools"><span>Shrift:</span><button data-reader-font="-1">A−</button><button data-reader-font="0">A</button><button data-reader-font="1">A+</button><span>Fon:</span><button class="dot paper ${theme==='paper'?'on':''}" data-reader-theme="paper"></button><button class="dot light ${theme==='light'?'on':''}" data-reader-theme="light"></button><button class="dot dark ${theme==='dark'?'on':''}" data-reader-theme="dark"></button></div>`:''}<div class="body">${body}</div></div>`;
  }
  // V13: qidiruv faqat yuklangan bob DOM matnida ishlaydi; Firebase so‘rovi yo‘q.
  const readerSearch={marks:[],index:-1};
  function clearReaderHighlights(){
    for(const mark of readerSearch.marks){if(mark.isConnected){const parent=mark.parentNode;mark.replaceWith(document.createTextNode(mark.textContent||''));parent&&parent.normalize();}}
    readerSearch.marks=[];readerSearch.index=-1;document.querySelector('#hetk-training-overlay')?.classList.remove('hetk-v15-search-active');
  }
  function readerSearchStatus(message){const node=document.querySelector('#hetk-training-overlay [data-reader-search-count]');if(node)node.textContent=message;}
  function focusReaderMatch(index){
    const marks=readerSearch.marks;if(!marks.length)return;
    readerSearch.index=(index+marks.length)%marks.length;
    marks.forEach((m,i)=>m.classList.toggle('is-current',i===readerSearch.index));
    marks[readerSearch.index].scrollIntoView({block:'center',behavior:'smooth'});
    readerSearchStatus(`${readerSearch.index+1} / ${marks.length} natija`);document.querySelector('#hetk-training-overlay')?.classList.add('hetk-v15-search-active');
  }
  function runReaderSearch(value){
    clearReaderHighlights();const query=String(value||'').trim();if(!query){readerSearchStatus('So‘z kiriting');return;}
    const host=document.querySelector('#hetk-training-overlay .hetk-v13-read-only .hetk-rich-book-text');if(!host)return;
    const nodes=[];const walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT,{acceptNode(n){return n.nodeValue&&n.nodeValue.trim()&&n.parentElement&&!n.parentElement.closest('script,style,mark')?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT;}});
    while(walker.nextNode())nodes.push(walker.currentNode);
    const needle=query.toLocaleLowerCase('uz');let count=0;
    for(const node of nodes){const original=node.nodeValue;const lower=original.toLocaleLowerCase('uz');let pos=0,found=lower.indexOf(needle,pos);if(found<0)continue;
      const fragment=document.createDocumentFragment();
      while(found>=0&&count<500){if(found>pos)fragment.appendChild(document.createTextNode(original.slice(pos,found)));
        const mark=document.createElement('mark');mark.className='hetk-v13-search-hit';mark.textContent=original.slice(found,found+query.length);fragment.appendChild(mark);readerSearch.marks.push(mark);count++;pos=found+query.length;found=lower.indexOf(needle,pos);
      }
      if(pos<original.length)fragment.appendChild(document.createTextNode(original.slice(pos)));
      node.replaceWith(fragment);if(count>=500)break;
    }
    if(count)focusReaderMatch(0);else readerSearchStatus('Natija topilmadi');
  }
  function startChapterQuiz(){
    const book=state.books[state.activeBookId],ch=book&&book.chapters&&book.chapters[state.activeChapterId],questions=chapterTestQuestions(ch),progress=chapterProgress(state.activeBookId,state.activeChapterId),lockUntil=Number(progress.lockUntil)||0;if(!questions.length)return toast('Bu bob uchun test yaratilmagan.','error');if(lockUntil>now())return toast(`Test vaqtincha yopiq. Bobni yana o‘qib chiqing. Qolgan vaqt: ${durationText(lockUntil-now())}`,'error');
    state.chapterQuiz={bookId:state.activeBookId,chapterId:state.activeChapterId,index:0,answers:{},startedAt:now(),deadlineAt:now()+Math.max(30,Math.min(600,Number(questions[0].timeSeconds)||90))*1000,result:null};repaint();
  }
  function captureChapterQuizAnswer(){if(!state.chapterQuiz)return;const input=document.querySelector('#hetk-training-overlay input[name="chapterQuizAnswer"]:checked');if(input)state.chapterQuiz.answers[state.chapterQuiz.index]=Number(input.value);}
  async function advanceChapterQuiz(automatic){
    const quiz=state.chapterQuiz;if(!quiz||quiz.submitting)return;const book=state.books[quiz.bookId],ch=book&&book.chapters&&book.chapters[quiz.chapterId],questions=chapterTestQuestions(ch);if(!questions.length)return;
    captureChapterQuizAnswer();if(quiz.index<questions.length-1){quiz.index++;quiz.deadlineAt=now()+Math.max(30,Math.min(600,Number(questions[quiz.index].timeSeconds)||90))*1000;repaint();return;}
    quiz.submitting=true;let correct=0;questions.forEach((q,i)=>{const selected=Object.prototype.hasOwnProperty.call(quiz.answers,i)?Number(quiz.answers[i]):null;if(selected===Number(q.correctIndex))correct++;});const percent=Math.round(correct/questions.length*100),passPercent=Number((ch.chapterTest||{}).passPercent)||70,passed=percent>=passPercent,old=chapterProgress(quiz.bookId,quiz.chapterId),finishedAt=Date.now(),lockUntil=passed?0:finishedAt+CHAPTER_RETRY_LOCK_MS,payload={bookId:quiz.bookId,chapterId:quiz.chapterId,uid:uid(),percent,passed,correctCount:correct,questionCount:questions.length,attempts:(Number(old.attempts)||0)+1,lastAttemptAt:firebase.database.ServerValue.TIMESTAMP,completedAt:passed?(old.completedAt||firebase.database.ServerValue.TIMESTAMP):null,lockUntil:lockUntil||null};
    try{await db().ref(`TrainingBookProgress/${uid()}/${quiz.bookId}/chapters/${quiz.chapterId}`).set(payload);state.bookProgress[quiz.bookId]=state.bookProgress[quiz.bookId]||{chapters:{}};state.bookProgress[quiz.bookId].chapters=state.bookProgress[quiz.bookId].chapters||{};state.bookProgress[quiz.bookId].chapters[quiz.chapterId]={...payload,lastAttemptAt:finishedAt,completedAt:passed?(old.completedAt||finishedAt):null,lockUntil};quiz.submitting=false;quiz.result={percent,passed,correct,total:questions.length,passPercent,lockUntil,automatic:!!automatic};repaint();}catch(err){quiz.submitting=false;toast('Bob testi natijasi saqlanmadi: '+err.message,'error');}
  }
  function openNextReaderChapter(){const book=state.books[state.activeBookId],chapters=chapterEntries(book).filter(([,c])=>isSuperAdmin()||c.published===true),index=chapters.findIndex(([id])=>id===state.activeChapterId);if(chapters[index+1]&&chapterUnlocked(state.activeBookId,chapters,index+1)){state.activeChapterId=chapters[index+1][0];state.readerMode='read';state.chapterQuiz=null;repaint();}}

  async function getIdToken(force){if(window.HETKAuth&&typeof window.HETKAuth.getIdToken==='function')return window.HETKAuth.getIdToken(!!force);const u=firebase.auth().currentUser;if(!u)throw new Error('AUTH_REQUIRED');return u.getIdToken(!!force);}
  const LEGACY_TELEGRAM_WORKER='https://hetk-telegram.husniddin-99-02.workers.dev';
  const TRAINING_TELEGRAM_WORKER='https://hetk-training-media.husniddin-99-02.workers.dev';
  const TRAINING_MEDIA_MAX_BYTES=18*1024*1024;
  const TTS_TARGET_CHARS=2000;
  const TTS_MIN_CHARS=1400;
  const TTS_MAX_CHARS=2200;
  const TTS_REQUEST_BITRATE=48000;
  function mediaSize(bytes){return `${(Number(bytes||0)/1024/1024).toFixed(1)} MB`;}
  function estimateTtsBytes(text,speed){const chars=String(text||'').replace(/\s+/g,' ').trim().length,seconds=chars/(13*Math.max(.5,Number(speed)||1));return Math.ceil(seconds*(TTS_REQUEST_BITRATE/8));}
  function sentenceUnits(text){
    const clean=String(text||'').replace(/\s+/g,' ').trim();if(!clean)return [];
    if(typeof Intl!=='undefined'&&Intl.Segmenter){try{return [...new Intl.Segmenter('uz',{granularity:'sentence'}).segment(clean)].map(x=>x.segment.trim()).filter(Boolean);}catch(_){}}
    return (clean.match(/[^.!?…]+(?:[.!?…]+[”"')\]]*|$)/g)||[clean]).map(x=>x.trim()).filter(Boolean);
  }
  function splitWordsWithoutCutting(text,maxChars){
    const words=String(text||'').trim().split(/\s+/).filter(Boolean),out=[];let current='';
    for(const word of words){if(word.length>maxChars)throw new Error(`Juda uzun, bo‘shliqsiz so‘z topildi (${word.length} belgi). So‘zni tekshiring.`);const next=current?`${current} ${word}`:word;if(next.length<=maxChars)current=next;else{if(current)out.push(current);current=word;}}
    if(current)out.push(current);return out;
  }
  function splitParagraphForTts(paragraph,maxChars){
    if(paragraph.length<=maxChars)return [paragraph];const sentences=sentenceUnits(paragraph),out=[];let current='';
    for(const sentence of sentences){const units=sentence.length<=maxChars?[sentence]:splitWordsWithoutCutting(sentence,maxChars);for(const unit of units){const next=current?`${current} ${unit}`:unit;if(next.length<=maxChars)current=next;else{if(current)out.push(current);current=unit;}}}
    if(current)out.push(current);return out;
  }
  function splitTextForTts(text,maxChars){
    const limit=Math.max(600,Number(maxChars)||TTS_MAX_CHARS),clean=String(text||'').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
    if(!clean)return [];
    const count=Math.max(1,Math.ceil(clean.length/TTS_TARGET_CHARS)),parts=[];let rest=clean;
    for(let index=0;index<count-1;index++){
      const left=count-index,target=Math.min(limit,Math.max(TTS_MIN_CHARS,Math.round(rest.length/left))),low=Math.min(target,Math.max(600,Math.round(target*.78))),high=Math.min(limit,Math.max(target,Math.round(target*1.10)));
      let cut=-1,best=Infinity;
      const sentenceRe=/[.!?…][”"')\]]*(?:\s+|\n+)/g;let m;
      while((m=sentenceRe.exec(rest))&&m.index<high){const pos=m.index+m[0].length;if(pos>=low){const score=Math.abs(pos-target);if(score<best){best=score;cut=pos;}}}
      if(cut<0){for(let pos=Math.min(high,rest.length-1);pos>=low;pos--){if(/\s/.test(rest[pos])){cut=pos+1;break;}}}
      if(cut<0){for(let pos=Math.min(limit,rest.length-1);pos>0;pos--){if(/\s/.test(rest[pos])){cut=pos+1;break;}}}
      if(cut<=0||cut>=rest.length)break;
      parts.push(rest.slice(0,cut).trim());rest=rest.slice(cut).trim();
    }
    if(rest)parts.push(rest);
    if(parts.some(p=>p.length>limit)){const safe=[];for(const part of parts)safe.push(...splitParagraphForTts(part,limit));return safe;}
    return parts;
  }
  function ttsPlan(text,speed){const parts=splitTextForTts(text,TTS_MAX_CHARS),estimated=parts.reduce((n,p)=>n+estimateTtsBytes(p,speed),0);return {parts,estimated};}
  function revokeTtsParts(){for(const part of state.ttsParts||[]){if(part.url)URL.revokeObjectURL(part.url);}state.ttsParts=[];state.ttsPreview=null;state.pendingChapterAudio=null;state.pendingChapterAudioParts=null;}
  function initTtsPartsPanel(plan){const host=document.querySelector('#hetk-training-overlay [data-tts-parts]');if(!host)return;host.innerHTML=`<div class="hetk-tts-parts-summary" data-tts-parts-summary><b><i class="fas fa-layer-group"></i> ${plan.parts.length} ta qism rejalashtirildi</b><span>${plan.parts.reduce((n,p)=>n+p.length,0).toLocaleString('uz-UZ')} belgi · taxminan ${mediaSize(plan.estimated)}</span></div><div class="hetk-tts-parts-list" data-tts-parts-list data-audio-playlist></div>`;}
  function updateTtsPartsSummary(text){const el=document.querySelector('#hetk-training-overlay [data-tts-parts-summary]');if(el)el.innerHTML=text;}
  function appendTtsPartPreview(part){
    const list=document.querySelector('#hetk-training-overlay [data-tts-parts-list]');if(!list)return;const index=state.ttsParts.length-1,article=document.createElement('article');article.dataset.generatedTtsPart=String(index);article.innerHTML=`<div class="hetk-tts-part-head"><span><i class="fas fa-circle-check"></i><b>${index+1}-audio qism tayyor</b></span><small>${part.text.length.toLocaleString('uz-UZ')} belgi · ${mediaSize(part.blob.size)}</small></div><audio controls controlsList="nodownload" oncontextmenu="return false" preload="metadata" data-playlist-index="${index}"></audio><em data-part-upload-state>Eshitib ko‘rishingiz mumkin</em>`;const audio=article.querySelector('audio');audio.src=part.url;list.appendChild(article);bindAudioPlaylists(article.parentElement);if(Number(list.dataset.waitingNext)===index){delete list.dataset.waitingNext;audio.play().catch(()=>{});}
  }
  function updateTtsTextMetrics(form){
    const textarea=form&&form.querySelector('[name="ttsText"]'),box=form&&form.querySelector('[data-tts-metrics]');if(!textarea||!box)return;const text=textarea.value.trim();if(!text){box.textContent='Matn kiritilganda qismlar va taxminiy hajm shu yerda ko‘rsatiladi.';return;}
    try{const speed=(form.querySelector('[name="speed"]')||{}).value||1,plan=ttsPlan(text,speed);box.innerHTML=`<b>${text.length.toLocaleString('uz-UZ')} belgi</b> · ${plan.parts.length} ta audio qism · 48 kbpsda taxminan ${mediaSize(plan.estimated)}. Har bir tayyor fayl alohida 18 MB bo‘yicha tekshiriladi.`;}catch(err){box.textContent=err.message;}
  }
  async function trainingMediaUpload(file,kind,bookId,chapterId,caption,purpose){
    if(!file||!file.size)throw new Error('Fayl topilmadi');
    if(file.size>TRAINING_MEDIA_MAX_BYTES)throw new Error(`Fayl ${mediaSize(file.size)}. Har bir media 18 MB dan oshmasligi kerak.`);
    const body=new FormData();body.append('file',file);body.append('kind',kind);body.append('bookId',bookId||'new-book');body.append('chapterId',chapterId||'book-cover');body.append('caption',caption||'HETK O‘quv markazi');if(purpose)body.append('purpose',purpose);
    let token=await getIdToken(false),res=await fetch(`${TRAINING_TELEGRAM_WORKER}/admin/upload`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});
    if(res.status===401){token=await getIdToken(true);res=await fetch(`${TRAINING_TELEGRAM_WORKER}/admin/upload`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});}
    const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok||!data.media)throw new Error(data.error||data.telegramError||'O‘quv markazi media kanaliga yuklanmadi');
    return {...data.media,storage:'training-media'};
  }
  async function trainingMediaReplace(file,kind,messageId,caption,testId){
    if(!file||!file.size)throw new Error('Fayl topilmadi');if(file.size>TRAINING_MEDIA_MAX_BYTES)throw new Error(`Fayl ${mediaSize(file.size)}. 18 MB dan oshmasligi kerak.`);
    const body=new FormData();body.append('file',file);body.append('kind',kind||'document');body.append('messageId',String(messageId||''));body.append('caption',caption||'HETK O‘quv markazi');if(testId){body.append('purpose','test-archive');body.append('testId',testId);}
    let token=await getIdToken(false),res=await fetch(`${TRAINING_TELEGRAM_WORKER}/admin/replace`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});
    if(res.status===401){token=await getIdToken(true);res=await fetch(`${TRAINING_TELEGRAM_WORKER}/admin/replace`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body});}
    const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok||!data.media)throw new Error(data.telegramError||data.error||'Telegram posti yangilanmadi');return {...data.media,storage:'training-media'};
  }
  async function trainingMediaDelete(messageId){
    const id=Number(messageId);if(!Number.isInteger(id)||id<=0)return false;
    let token=await getIdToken(false),res=await fetch(`${TRAINING_TELEGRAM_WORKER}/admin/delete`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messageId:id})});
    if(res.status===401){token=await getIdToken(true);res=await fetch(`${TRAINING_TELEGRAM_WORKER}/admin/delete`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({messageId:id})});}
    const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.error||'Eski audio media kanalidan o‘chirilmadi');
    return true;
  }
  async function cleanupReplacedAudio(oldParts,newParts){
    // Never remove a Telegram post still used by another chapter, topic or book.
    const nextIds=new Set((newParts||[]).map(p=>String(p&&p.fileId||'')).filter(Boolean));
    const old=(oldParts||[]).filter(p=>p&&p.storage==='training-media'&&Number(p.messageId)>0&&p.fileId&&!nextIds.has(String(p.fileId)));
    if(!old.length)return {deleted:0,retained:0,failed:0};
    let books;
    try{books=(await db().ref('TrainingBooks').once('value')).val()||{};}
    catch(error){console.warn('Audio tozalash: ishlatilayotgan fayllarni tekshirib bo‘lmadi:',error);return {deleted:0,retained:old.length,failed:0};}
    const usedIds=new Set(),usedMessages=new Set();
    const mark=part=>{if(part&&part.fileId)usedIds.add(String(part.fileId));if(part&&Number(part.messageId)>0)usedMessages.add(Number(part.messageId));};
    Object.values(books).forEach(book=>Object.values(book&&book.chapters||{}).forEach(ch=>{
      (Array.isArray(ch.audioParts)?ch.audioParts:Object.values(ch.audioParts||{})).forEach(mark);mark(ch.audio);
      Object.values(ch.topics||{}).forEach(topic=>{
        (Array.isArray(topic.audioParts)?topic.audioParts:Object.values(topic.audioParts||{})).forEach(mark);
      });
    }));
    let deleted=0,retained=0,failed=0;
    for(const item of old){
      if(usedIds.has(String(item.fileId))||usedMessages.has(Number(item.messageId))){retained++;continue;}
      try{await trainingMediaDelete(item.messageId);deleted++;}
      catch(error){failed++;console.warn('Eski audio tozalanmadi:',error);}
    }
    return {deleted,retained,failed};
  }
  async function trainingMediaObjectUrl(fileId){
    if(state.mediaObjectUrls[fileId])return state.mediaObjectUrls[fileId];
    let token=await getIdToken(false),res=await fetch(`${TRAINING_TELEGRAM_WORKER}/media/${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${token}`}});
    if(res.status===401){token=await getIdToken(true);res=await fetch(`${TRAINING_TELEGRAM_WORKER}/media/${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${token}`}});}
    if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||'Media fayli ochilmadi');}
    const url=URL.createObjectURL(await res.blob());state.mediaObjectUrls[fileId]=url;return url;
  }
  async function trainingMediaObjectUrlWithProgress(fileId,onProgress){
    if(state.mediaObjectUrls[fileId]){if(onProgress)onProgress(100,0,0);return state.mediaObjectUrls[fileId];}
    if(state.mediaLoadPromises[fileId]){const cached=await state.mediaLoadPromises[fileId];if(onProgress)onProgress(100,0,0);return cached;}
    const task=(async()=>{
      let token=await getIdToken(false),res=await fetch(`${TRAINING_TELEGRAM_WORKER}/media/${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${token}`}});
      if(res.status===401){token=await getIdToken(true);res=await fetch(`${TRAINING_TELEGRAM_WORKER}/media/${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${token}`}});}
      if(!res.ok){const data=await res.json().catch(()=>({}));throw new Error(data.error||'Audio fayli ochilmadi');}
      const total=Math.max(0,Number(res.headers.get('content-length')||0));
      if(!res.body||!res.body.getReader){const blob=await res.blob();if(onProgress)onProgress(100,blob.size,blob.size);const url=URL.createObjectURL(blob);state.mediaObjectUrls[fileId]=url;return url;}
      const reader=res.body.getReader(),chunks=[];let loaded=0;
      while(true){const row=await reader.read();if(row.done)break;chunks.push(row.value);loaded+=row.value.byteLength;if(onProgress)onProgress(total?Math.min(99,Math.round(loaded/total*100)):null,loaded,total);}
      const blob=new Blob(chunks,{type:res.headers.get('content-type')||'audio/mpeg'}),url=URL.createObjectURL(blob);state.mediaObjectUrls[fileId]=url;if(onProgress)onProgress(100,blob.size,total||blob.size);return url;
    })();
    state.mediaLoadPromises[fileId]=task;
    try{return await task;}finally{delete state.mediaLoadPromises[fileId];}
  }
  function safeArchiveName(value){return String(value||'test').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,70)||'test';}
  async function jsonContentHash(value){const bytes=new TextEncoder().encode(JSON.stringify(value)),digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');}
  async function uploadTrainingJson(value,fileName,caption,bookId,chapterId){
    const text=JSON.stringify(value,null,2),file=new File([text],safeArchiveName(fileName)+'.json',{type:'application/json'});
    const media=await trainingMediaUpload(file,'document',bookId||'training-tests',chapterId||'question-bank',caption,'test-archive');
    state.archiveJson[media.fileId]=value;
    return {...media,storage:'training-media',format:'json',fileName:file.name,recordCount:Array.isArray(value.questions)?value.questions.length:Object.keys(value.questions||{}).length,archivedAt:Date.now()};
  }
  async function saveContentJson(value,fileName,caption,bookId,chapterId,oldArchive){
    // Never replace/delete the live archive before its Firebase pointer is committed.
    const file=new File([JSON.stringify(value,null,2)],safeArchiveName(fileName)+'.json',{type:'application/json'});
    const media=await trainingMediaUpload(file,'document',bookId,chapterId,caption,'content-archive');
    state.archiveJson[media.fileId]=value;
    return {...media,storage:'training-media',format:'json',fileName:file.name,archivedAt:Date.now(),archiveKind:'book-topic-content'};
  }
  async function readTrainingJson(archive){
    const fileId=archive&&archive.fileId;if(!fileId)throw new Error('Telegram arxiv fayli topilmadi');
    if(state.archiveJson[fileId])return state.archiveJson[fileId];
    let data;
    if(archive.archiveKind==='standalone-test'&&archive.testId){let token=await getIdToken(false),res=await fetch(`${TRAINING_TELEGRAM_WORKER}/test-archive/${encodeURIComponent(archive.testId)}/${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${token}`}});if(res.status===401){token=await getIdToken(true);res=await fetch(`${TRAINING_TELEGRAM_WORKER}/test-archive/${encodeURIComponent(archive.testId)}/${encodeURIComponent(fileId)}`,{headers:{Authorization:`Bearer ${token}`}});}if(!res.ok){const error=await res.json().catch(()=>({}));throw new Error(error.error||'Test arxivi ochilmadi');}data=await res.json();}
    else{const url=await trainingMediaObjectUrl(fileId),res=await fetch(url);if(!res.ok)throw new Error('Telegram arxiv fayli ochilmadi');data=await res.json();}
    state.archiveJson[fileId]=data;return data;
  }
  async function hydrateBookTestArchives(books){
    const jobs=[];Object.values(books||{}).forEach(book=>Object.values((book&&book.chapters)||{}).forEach(ch=>{const test=ch&&ch.chapterTest,archive=test&&test.archive;if(!archive||!archive.fileId||test.questions)return;jobs.push(async()=>{const data=await readTrainingJson(archive);test.questions=Array.isArray(data.questions)?data.questions:Object.values(data.questions||{});});}));
    for(let i=0;i<jobs.length;i+=5)await Promise.all(jobs.slice(i,i+5).map(job=>job().catch(err=>console.warn('Bob testi Telegramdan yuklanmadi:',err))));
  }
  async function hydrateBookTopicArchives(books){
    const jobs=[];Object.values(books||{}).forEach(book=>Object.values((book&&book.chapters)||{}).forEach(ch=>Object.values((ch&&ch.topics)||{}).forEach(topic=>{const archive=topic&&topic.contentArchive;if(!archive||!archive.fileId||topic.editions)return;jobs.push(async()=>{const data=await readTrainingJson(archive);topic.editions=data.editions||{latin:{blocks:[]},cyrillic:{blocks:[]}};topic.ttsText=data.ttsText||topic.ttsText||'';topic.interludeText=data.interludeText||topic.interludeText||'';topic.interludeImage=data.interludeImage||topic.interludeImage||null;});})));
    for(let i=0;i<jobs.length;i+=4)await Promise.all(jobs.slice(i,i+4).map(job=>job().catch(err=>console.warn('Mavzu matni Telegramdan yuklanmadi:',err))));
  }
  function audioProgressNote(audio){return audio&&audio.parentElement&&audio.parentElement.querySelector('[data-media-loading]');}
  function updateAudioProgress(audio,percent,loaded,total,text){
    const note=audioProgressNote(audio);if(!note)return;const label=note.querySelector('span'),bar=note.querySelector('b'),expected=Math.max(Number(total)||0,Number(audio.dataset.mediaSize)||0),calculated=expected&&loaded?Math.min(99,Math.round(loaded/expected*100)):null,value=Number.isFinite(percent)?Math.max(0,Math.min(100,percent)):calculated;
    note.classList.remove('is-waiting','is-error','is-ready');
    if(value===100)note.classList.add('is-ready');
    if(label)label.textContent=text||(value===null?`Yuklanmoqda: ${(loaded/1024/1024).toFixed(1)} MB`:`Yuklanmoqda: ${value}%`);
    if(bar)bar.style.width=(value===null?12:value)+'%';
  }
  async function loadAudioElement(audio,autoplay){
    if(!audio)return false;
    if(audio.dataset.mediaReady==='1'){
      updateAudioProgress(audio,100,0,0,'100% — tinglashga tayyor');
      if(autoplay)await audio.play().catch(()=>{});return true;
    }
    if(!audio._hetkLoadPromise){
      audio.dataset.mediaReady='loading';updateAudioProgress(audio,0,0,0,'Yuklanmoqda: 0%');
      audio._hetkLoadPromise=(async()=>{
        try{
          const fileId=audio.dataset.trainingMediaFile;
          if(fileId)audio.src=await trainingMediaObjectUrlWithProgress(fileId,(percent,loaded,total)=>updateAudioProgress(audio,percent,loaded,total));
          else if(audio.getAttribute('src'))audio.load();
          else throw new Error('Audio manzili topilmadi');
          audio.load();audio.dataset.mediaReady='1';updateAudioProgress(audio,100,0,0,'100% — tinglashga tayyor');return true;
        }catch(err){audio.dataset.mediaReady='error';const note=audioProgressNote(audio);if(note){note.classList.add('is-error');const label=note.querySelector('span');if(label)label.textContent='Audio ochilmadi: '+err.message;}return false;}
      })();
    }
    const ready=await audio._hetkLoadPromise;audio._hetkLoadPromise=null;if(autoplay&&ready)await audio.play().catch(()=>{});return ready;
  }
  async function hydrateTrainingMedia(){
    const nodes=[...document.querySelectorAll('#hetk-training-overlay [data-training-media-file]:not(audio)')];
    await Promise.all(nodes.map(async el=>{if(el.dataset.mediaReady==='1')return;el.dataset.mediaReady='loading';try{el.src=await trainingMediaObjectUrl(el.dataset.trainingMediaFile);el.dataset.mediaReady='1';}catch(err){el.dataset.mediaReady='error';}}));bindAudioPlaylists(document);
  }
  function bindAudioPlaylists(root){
    (root||document).querySelectorAll('[data-audio-playlist]').forEach(list=>{
      const audios=[...list.querySelectorAll('audio')];if(!audios.length)return;
      audios.forEach((audio,index)=>{
        if(audio.dataset.playlistBound==='1')return;audio.dataset.playlistBound='1';
        audio.addEventListener('pointerdown',()=>{if(audio.dataset.mediaReady!=='1')loadAudioElement(audio,false);},{passive:true});audio.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&audio.dataset.mediaReady!=='1')loadAudioElement(audio,false);});
        audio.addEventListener('play',()=>{audios.forEach(other=>{if(other!==audio&&!other.paused)other.pause();});const next=audios[index+1];if(next)loadAudioElement(next,false);});
        audio.addEventListener('ended',async()=>{const next=audios[index+1];if(next)await loadAudioElement(next,true);else list.dataset.waitingNext=String(index+1);});
      });
      // Mavzu tanlanganda audio yuklanmaydi; faqat tinglash bosilganda yuklanadi.
    });
  }
  async function uploadBookCover(file){
    if(!file)return null;return trainingMediaUpload(file,'cover',state.bookAdminBookId||'new-book','cover','HETK O‘quv markazi — kitob muqovasi');
  }
  async function requestTtsBlob(text,voice,speed){
    const res=await fetch('http://127.0.0.1:8765/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice,speed:Number(speed)||1,format:'mp3',bitrate:'48k',mono:true,max_bytes:TRAINING_MEDIA_MAX_BYTES})});
    if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error||`TTS server xatosi: ${res.status}`);}return res.blob();
  }
  async function generateSafeTtsText(text,voice,speed,onReady,depth){
    const blob=await requestTtsBlob(text,voice,speed);if(blob.size<=TRAINING_MEDIA_MAX_BYTES){await onReady({text,blob});return;}
    if((depth||0)>=6||text.length<600)throw new Error(`Audio ${mediaSize(blob.size)} bo‘ldi va xavfsiz bo‘lib bo‘linmadi.`);
    let smaller=splitTextForTts(text,Math.max(300,Math.floor(text.length*.55)));if(smaller.length<2)smaller=splitWordsWithoutCutting(text,Math.max(300,Math.floor(text.length*.55)));
    if(smaller.length<2)throw new Error(`Audio ${mediaSize(blob.size)} bo‘ldi. Matnda bo‘lish uchun gap yoki bo‘shliq topilmadi.`);
    for(const sub of smaller)await generateSafeTtsText(sub,voice,speed,onReady,(depth||0)+1);
  }
  async function previewTts(){
    const form=document.querySelector('#hetk-training-overlay [data-book-form]');if(!form||state.ttsGenerating)return;const fd=new FormData(form),text=String(fd.get('ttsText')||'').trim();if(!text)return toast('Avval TTS matnini kiriting.','error');
    const voice=String(fd.get('voice')||'navoiy'),speed=String(fd.get('speed')||'1'),btn=form.querySelector('[data-tts-preview]'),up=form.querySelector('[data-tts-upload]');let plan;
    try{plan=ttsPlan(text,speed);}catch(err){return toast(err.message,'error');}
    revokeTtsParts();state.ttsContextKey=`chapter:${state.bookAdminBookId||'new-book'}:${state.bookAdminChapterId||'new-chapter'}`;state.ttsGenerating=true;initTtsPartsPanel(plan);const textarea=form.querySelector('[name="ttsText"]');if(textarea)textarea.readOnly=true;if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Audiolar yaratilmoqda...';}if(up)up.disabled=true;
    try{
      for(let i=0;i<plan.parts.length;i++){
        updateTtsPartsSummary(`<b><i class="fas fa-wave-square"></i> ${i+1}/${plan.parts.length}-qism yaratilmoqda</b><span>Tayyor qismlarni pastda darhol eshitishingiz mumkin.</span>`);
        await generateSafeTtsText(plan.parts[i],voice,speed,async ready=>{const part={...ready,url:URL.createObjectURL(ready.blob),voice,speed};state.ttsParts.push(part);appendTtsPartPreview(part);},0);
      }
      state.ttsPreview={parts:state.ttsParts.slice(),text,voice,speed};const totalBytes=state.ttsParts.reduce((n,p)=>n+p.blob.size,0);updateTtsPartsSummary(`<b><i class="fas fa-circle-check"></i> ${state.ttsParts.length} ta audio qism tayyor</b><span>Jami ${mediaSize(totalBytes)} · har bir qism 18 MB dan kichik.</span>`);if(up){up.disabled=false;up.innerHTML='<i class="fas fa-cloud-arrow-up"></i> Barcha audiolarni yuklash';}toast(`${state.ttsParts.length} ta audio qism tayyor.`,'success');
    }catch(err){const connection=/Failed to fetch|NetworkError|Load failed/i.test(String(err&&err.message));updateTtsPartsSummary(`<b><i class="fas fa-triangle-exclamation"></i> Yaratish to‘xtadi</b><span>${esc(err.message||err)}</span>`);toast((connection?'TTS server bilan aloqa yo‘q. ':'Audio yaratilmadi: ')+(err.message||err),'error');}
    finally{state.ttsGenerating=false;if(textarea)textarea.readOnly=false;if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-headphones"></i> Barcha audiolarni yaratish';}}
  }
  async function uploadChapterAudio(){
    if(!isSuperAdmin())return toast('Ruxsat yo‘q.','error');const form=document.querySelector('#hetk-training-overlay [data-book-form]'),parts=state.ttsParts||[];if(!form||!parts.length)return toast('Avval “Barcha audiolarni yaratish”ni bosing.','error');if(state.ttsContextKey!==`chapter:${state.bookAdminBookId||'new-book'}:${state.bookAdminChapterId||'new-chapter'}`)return toast('Bu audio boshqa mavzuga tegishli. 1-mavzu audiosini alohida yarating.','error');
    if(state.ttsGenerating||!state.ttsPreview)return toast('Audio yaratish hali tugamagan. Yuklashdan oldin barcha qismlar tayyor bo‘lsin.','warning');
    const fd=new FormData(form),bookType=fd.get('bookType')==='industry'?'industry':'training',title=String(fd.get('title')||'Nomsiz kitob').trim(),chapterTitle=String(fd.get('chapterTitle')||'Bob').trim(),btn=form.querySelector('[data-tts-upload]'),uploadedParts=[];if(btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Audiolar yuklanmoqda...';}
    try{
      for(let i=0;i<parts.length;i++){
        const part=parts[i],row=form.querySelector(`[data-generated-tts-part="${i}"] [data-part-upload-state]`);if(row)row.textContent=`${i+1}/${parts.length}-qism yuklanmoqda...`;
        if(part.blob.size>TRAINING_MEDIA_MAX_BYTES)throw new Error(`${i+1}-qism ${mediaSize(part.blob.size)}. 18 MB dan katta.`);
        if(part.uploaded){uploadedParts.push(part.uploaded);if(row)row.textContent='Media kanaliga yuklangan';continue;}
        const type=part.blob.type||'audio/wav',ext=type.includes('mpeg')?'mp3':type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'wav',file=new File([part.blob],`hetk-${Date.now()}-${i+1}.${ext}`,{type}),kind=/audio\/(mpeg|mp4|x-m4a|ogg)/i.test(type)?'audio':'document';
        const uploaded=await trainingMediaUpload(file,kind,state.bookAdminBookId||'new-book',state.bookAdminChapterId||'new-chapter',`HETK O‘quv markazi — ${title} — ${chapterTitle} — ${i+1}/${parts.length}-qism`),saved={...uploaded,voice:part.voice,speed:part.speed,partNumber:i+1,textLength:part.text.length,uploadedAt:Date.now()};part.uploaded=saved;uploadedParts.push(saved);if(row)row.textContent='Media kanaliga yuklandi';
      }
      state.pendingChapterAudioParts=uploadedParts;state.pendingChapterAudio=uploadedParts[0]||null;const totalBytes=uploadedParts.reduce((n,p)=>n+Number(p.size||0),0),st=form.querySelector('[data-audio-status]');if(st)st.innerHTML=`<i class="fas fa-circle-check"></i><span><b>${uploadedParts.length} ta audio media kanaliga yuklandi — ${mediaSize(totalBytes)}</b><small>Oxirida “O‘zgarishlarni saqlash”ni bosing.</small></span>`;if(btn)btn.innerHTML='<i class="fas fa-check"></i> Barcha audiolar yuklandi';toast('Barcha audio qismlar media kanaliga yuklandi.','success');
    }catch(err){if(btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-cloud-arrow-up"></i> Qolgan audiolarni yuklash';}toast('Audio yuklanmadi: '+err.message,'error');}
  }
  function ensureChapterTestDraft(bookId,chapterId,ch){
    const key=`${bookId||'new'}:${chapterId||'new'}`;
    if(state.chapterTestDraftKey!==key){
      const saved=ch&&ch.chapterTest||{};
      const qs=Array.isArray(saved.questions)?saved.questions:Object.values(saved.questions||{});
      state.chapterTestDraft={passPercent:Number(saved.passPercent)||70,questions:qs.length?qs.map(q=>({text:q.text||'',options:(q.options||['','','','']).slice(0,4),correctIndex:Number(q.correctIndex)||0,explanation:q.explanation||'',source:q.source||'',timeSeconds:Math.max(30,Math.min(600,Number(q.timeSeconds)||90))})):[{text:'',options:['','','',''],correctIndex:0,explanation:'',source:'',timeSeconds:90}]};
      state.chapterTestDraftKey=key;
    }
    return state.chapterTestDraft;
  }
  function syncChapterTestDraft(){
    const form=document.querySelector('#hetk-training-overlay [data-book-form]');if(!form||!state.chapterTestDraft)return;
    const pass=form.querySelector('[name="chapterPassPercent"]');if(pass)state.chapterTestDraft.passPercent=Math.max(1,Math.min(100,Number(pass.value)||70));
    document.querySelectorAll('#hetk-training-overlay [data-chapter-question-index]').forEach(row=>{const i=Number(row.dataset.chapterQuestionIndex),q=state.chapterTestDraft.questions[i]||{text:'',options:['','','',''],correctIndex:0,explanation:'',source:'',timeSeconds:90};q.text=(row.querySelector('[data-chq-text]')||{}).value||'';q.options=[...row.querySelectorAll('[data-chq-option]')].map(x=>x.value);const right=row.querySelector('input[type="radio"]:checked');q.correctIndex=right?Number(right.value):0;q.explanation=(row.querySelector('[data-chq-explanation]')||{}).value||'';q.source=(row.querySelector('[data-chq-source]')||{}).value||'';q.timeSeconds=Math.max(30,Math.min(600,Number((row.querySelector('[data-chq-time]')||{}).value)||90));state.chapterTestDraft.questions[i]=q;});
  }
  function chapterQuestionEditor(q,index,total){return `<article class="hetk-training-question" data-chapter-question-index="${index}"><header><b>${index+1}-savol</b>${total>1?'<button type="button" data-remove-chapter-question aria-label="Savolni o‘chirish"><i class="fas fa-trash"></i></button>':''}</header><label>Savol matni *<textarea data-chq-text rows="3" placeholder="Bob bo‘yicha savolni kiriting...">${esc(q.text||'')}</textarea></label><div class="hetk-chapter-question-time"><label>Bu savol uchun vaqt <span><input data-chq-time type="number" min="30" max="600" step="10" value="${Math.max(30,Math.min(600,Number(q.timeSeconds)||90))}"> soniya</span><small>Uzun matnli savol uchun vaqtni ko‘paytirishingiz mumkin.</small></label></div><div class="hetk-training-options">${(q.options||['','','','']).map((o,i)=>`<label><input type="radio" name="chapter_correct_${index}" value="${i}" ${Number(q.correctIndex)===i?'checked':''}><span>${String.fromCharCode(65+i)}</span><input data-chq-option="${i}" autocomplete="off" value="${esc(o)}" placeholder="${i+1}-javob varianti"></label>`).join('')}</div><div class="hetk-training-question-extra"><label>Manba (ixtiyoriy)<input data-chq-source value="${esc(q.source||'')}" placeholder="Kitob, bob, band yoki havola"></label><label>Javobga tushuntirish (ixtiyoriy)<textarea data-chq-explanation rows="2" placeholder="Nima uchun shu javob to‘g‘ri?">${esc(q.explanation||'')}</textarea></label></div></article>`;}
  function voiceOptions(selected){const voices=state.ttsVoices&&state.ttsVoices.length?state.ttsVoices:[{id:'navoiy',name:'Navoiy — asosiy ovoz'}];return voices.map(v=>`<option value="${esc(v.id)}" ${String(v.id)===String(selected)?'selected':''}>${esc(v.name||v.label||v.id)}</option>`).join('');}
  function parseTtsDictionary(value){return String(value||'').split(/\r?\n/).map(line=>{const at=line.indexOf('=');return at>0?[line.slice(0,at).trim(),line.slice(at+1).trim()]:null;}).filter(row=>row&&row[0]&&row[1]);}
  function normalizeUzbekTtsText(text,dictionaryText){
    let out=String(text||'').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ');
    const words=parseTtsDictionary(dictionaryText||DEFAULT_TTS_DICTIONARY).sort((a,b)=>b[0].length-a[0].length);
    words.forEach(([short,full])=>{const safe=short.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');out=out.replace(new RegExp(`(^|[^A-Za-zА-Яа-яЁёʻʼ‘’'])(${safe})(?=$|[^A-Za-zА-Яа-яЁёʻʼ‘’'])`,'gi'),(match,prefix)=>prefix+full);});
    out=out.replace(/(\d+(?:[.,]\d+)?)\s*kV\s*\/\s*m\b/gi,'$1 kilovolt metrga').replace(/(\d+(?:[.,]\d+)?)\s*kV\s*gacha\b/gi,'$1 kilovoltgacha').replace(/(\d+(?:[.,]\d+)?)\s*kV\s*li\b/gi,'$1 kilovoltli').replace(/(\d+(?:[.,]\d+)?)\s*kV\b/gi,'$1 kilovolt').replace(/(\d+(?:[.,]\d+)?)\s*V\s*dan\b/g,'$1 voltdan').replace(/(\d+(?:[.,]\d+)?)\s*V\s*gacha\b/g,'$1 voltgacha').replace(/(\d+(?:[.,]\d+)?)\s*V\b/g,'$1 volt').replace(/(\d+(?:[.,]\d+)?)\s*km\b/gi,'$1 kilometr').replace(/(\d+(?:[.,]\d+)?)\s*m\b/g,'$1 metr');
    return out.replace(/\n{3,}/g,'\n\n').trim();
  }
  const TTS_START_COMMAND=`cd /d C:\\HETK-TTS\nvenv\\Scripts\\activate\ncd navoiy-tts\npython hetk_tts_server.py`;
  function ttsStatusHtml(){
    if(state.ttsChecking||state.ttsOnline===null)return `<div class="hetk-tts-server-status is-checking" data-tts-server-status><div class="hetk-tts-status-head"><span><i class="fas fa-spinner fa-spin"></i><b>Navoiy TTS tekshirilmoqda...</b></span><button type="button" data-tts-recheck><i class="fas fa-rotate"></i> Qayta tekshirish</button></div></div>`;
    if(state.ttsOnline)return `<div class="hetk-tts-server-status is-online" data-tts-server-status><div class="hetk-tts-status-head"><span><i class="fas fa-circle-check"></i><b>Navoiy TTS tayyor</b><small>Ovozlashtirishni boshlashingiz mumkin.</small></span><button type="button" data-tts-recheck><i class="fas fa-rotate"></i> Qayta tekshirish</button></div></div>`;
    return `<div class="hetk-tts-server-status is-offline" data-tts-server-status><div class="hetk-tts-status-head"><span><i class="fas fa-circle-xmark"></i><b>Navoiy TTS o‘chiq</b><small>Kerakli paytda CMD ochib quyidagi buyruqlarni kiriting.</small></span><button type="button" data-tts-recheck><i class="fas fa-rotate"></i> Qayta tekshirish</button></div><pre data-tts-command>${esc(TTS_START_COMMAND)}</pre><div class="hetk-tts-command-actions"><button type="button" data-tts-copy><i class="fas fa-copy"></i> Kodni nusxalash</button><small>O‘chirish uchun TTS ishlayotgan CMD oynasida <b>Ctrl + C</b> bosing.</small></div></div>`;
  }
  async function checkTtsStatus(){
    if(state.ttsChecking)return;state.ttsChecking=true;updateTtsStatusBox();
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);
    try{const res=await fetch('http://127.0.0.1:8765/',{method:'GET',cache:'no-store',signal:controller.signal});state.ttsOnline=!!res.ok;if(state.ttsOnline){try{const vr=await fetch('http://127.0.0.1:8765/api/voices',{cache:'no-store'});if(vr.ok){const vd=await vr.json(),rows=Array.isArray(vd)?vd:(vd.voices||[]);if(rows.length)state.ttsVoices=rows.map(v=>typeof v==='string'?{id:v,name:v}:{id:v.id||v.voice||v.name,name:v.label||v.name||v.id});}}catch(_){}}}
    catch(_){state.ttsOnline=false;}finally{clearTimeout(timer);state.ttsChecking=false;updateTtsStatusBox();}
  }
  function updateTtsStatusBox(){const box=document.querySelector('#hetk-training-overlay [data-tts-server-status]');if(box)box.outerHTML=ttsStatusHtml();const preview=document.querySelector('#hetk-training-overlay [data-tts-preview]');if(preview)preview.disabled=state.ttsOnline!==true;const voice=document.querySelector('#hetk-training-overlay select[name="voice"]');if(voice){const selected=voice.value;voice.innerHTML=voiceOptions(selected);if([...voice.options].some(o=>o.value===selected))voice.value=selected;}}
  function blankTextBlock(type){return type==='heading'?{type:'heading',text:'',align:'left',color:'#123c55',fontSize:24}:{type:'paragraph',text:'',align:'left',color:'#183b50',fontSize:19};}
  function cacheCurrentTopicDraft(){
    if(!state.topicDraft||!state.topicDraftKey)return;
    syncTopicDraft();
    const visible=document.querySelector('#hetk-training-overlay [data-topic-published]');
    if(visible)state.topicDraft.published=visible.checked;
    state.topicDraftCache[state.topicDraftKey]=state.topicDraft;
  }
  function canNavigateFromAudio(){
    if(state.ttsGenerating){toast('Navoiy TTS hozir ovoz yaratmoqda. Jarayon tugagach o‘ting.','warning');return false;}
    if(state.ttsParts.length&&!window.confirm('Hali saqlanmagan audio qismlari bor. Davom etsangiz ular yo‘qoladi. Avval kerakli mavzuni saqlash tavsiya etiladi. Davom etasizmi?'))return false;
    return true;
  }
  // V25 — atomic topic removal. The automatic first topic is the chapter itself and is never removed here.
  function openDeleteBookTopicDialog(topicId){
    if(!isSuperAdmin())return toast('Mavzuni o‘chirish huquqi yo‘q.','error');
    if(!topicId||topicId===PRIMARY_BOOK_TOPIC||topicId==='__new__')return toast('Avtomatik 1-mavzuni bu yerda o‘chirib bo‘lmaydi.','warning');
    if(state.ttsGenerating)return toast('Ovozlashtirish tugamaguncha mavzuni o‘chirib bo‘lmaydi.','warning');
    const bookId=state.bookAdminBookId,chapterId=state.bookAdminChapterId;
    const chapter=state.books[bookId]?.chapters?.[chapterId],topic=chapter?.topics?.[topicId];
    if(!topic)return toast('Tanlangan mavzu topilmadi. Oynani yangilang.','error');
    const modalRoot=document.getElementById('hetk-training-overlay');if(!modalRoot)return;
    modalRoot.querySelector('.hetk-v25-delete-overlay')?.remove();
    const index=topicEntries(chapter).findIndex(([id])=>id===topicId),number=index>=0?index+2:2;
    const name=topic.titleLatin||topic.titleCyrillic||'Nomsiz mavzu',count=topicAudioParts(topic).length;
    const modal=document.createElement('div');modal.className='hetk-v25-delete-overlay';
    modal.innerHTML=`<section class="hetk-v25-delete-dialog" role="alertdialog" aria-modal="true" aria-labelledby="hetk-v25-delete-title" aria-describedby="hetk-v25-delete-desc"><div class="hetk-v25-delete-symbol"><i class="fas fa-trash-can"></i></div><h3 id="hetk-v25-delete-title">Mavzuni butunlay o‘chirish</h3><p id="hetk-v25-delete-desc"><b>${esc(number)}-mavzu: ${esc(name)}</b></p><div class="hetk-v25-delete-details"><span><i class="fas fa-file-lines"></i> Mavzu matni va rasmlari</span><span><i class="fas fa-headphones"></i> ${count} ta audio qism</span><span><i class="fas fa-box-archive"></i> Mavzuning Telegram JSON arxivi</span></div><p class="hetk-v25-delete-warning"><i class="fas fa-triangle-exclamation"></i> Bu amal ortga qaytarilmaydi. Boshqa mavzular va avtomatik 1-mavzu saqlanadi. Keyingi mavzular raqami suriladi. Umumiy yoki eski bog‘lanishi noma’lum media fayllar xavfsizlik uchun saqlanadi.</p><div class="hetk-v25-delete-status" data-v25-delete-status aria-live="polite" hidden></div><footer><button type="button" class="hetk-v25-delete-cancel" data-v25-delete-cancel>Bekor qilish</button><button type="button" class="hetk-v25-delete-confirm" data-v25-delete-confirm><i class="fas fa-trash-can"></i> Ha, mavzuni o‘chirish</button></footer></section>`;
    modalRoot.appendChild(modal);
    const cancel=modal.querySelector('[data-v25-delete-cancel]'),confirm=modal.querySelector('[data-v25-delete-confirm]'),status=modal.querySelector('[data-v25-delete-status]');
    let inProgress=false;const previousFocus=document.activeElement;
    const close=()=>{if(inProgress)return;document.removeEventListener('keydown',onKeydown,true);modal.remove();if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});};
    const onKeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}};
    document.addEventListener('keydown',onKeydown,true);
    modal.addEventListener('click',e=>{if(e.target===modal)close();if(e.target.closest('[data-v25-delete-cancel]'))close();});
    confirm.addEventListener('click',async()=>{
      if(inProgress)return;
      if(!canNavigateFromAudio())return;
      cacheCurrentTopicDraft();
      inProgress=true;cancel.disabled=true;confirm.disabled=true;confirm.innerHTML='<i class="fas fa-spinner fa-spin"></i> O‘chirilmoqda...';
      status.hidden=false;status.textContent='Firebase ma’lumotlari o‘chirilmoqda va qolgan mavzular tartiblanmoqda...';
      try{
        const result=await deleteBookTopic(bookId,chapterId,topicId,topic);
        document.removeEventListener('keydown',onKeydown,true);modal.remove();
        toast(result.failed?`Mavzu o‘chirildi. Telegramda ${result.failed} ta faylni tozalab bo‘lmadi.`:result.retained?`Mavzu o‘chirildi. ${result.retained} ta umumiy yoki tekshirib bo‘lmaydigan media fayl saqlab qolindi.`:'Mavzu to‘liq o‘chirildi. Qolgan mavzular qayta raqamlandi.',result.failed||result.retained?'warning':'success');
      }catch(err){
        inProgress=false;cancel.disabled=false;confirm.disabled=false;
        confirm.innerHTML='<i class="fas fa-rotate-right"></i> Qayta urinish';
        status.textContent='O‘chirish tugallanmadi: '+err.message;
        toast('Mavzu o‘chirish xatosi: '+err.message,'error');
      }
    });
    cancel.focus({preventScroll:true});
  }
  function collectDeletedTopicMedia(topic){
    const items=new Map();
    const mark=(item,type)=>{
      if(!item||item.storage!=='training-media'||!item.fileId||!Number.isInteger(Number(item.messageId))||Number(item.messageId)<=0)return;
      const id=String(item.messageId);if(!items.has(id))items.set(id,{fileId:String(item.fileId),messageId:Number(item.messageId),type});
    };
    topicAudioParts(topic).forEach(item=>mark(item,'audio'));
    mark(topic.contentArchive,'archive');mark(topic.interludeImage,'image');
    for(const edition of Object.values(topic.editions||{})){
      for(const block of Array.isArray(edition?.blocks)?edition.blocks:Object.values(edition?.blocks||{})){
        if(block&&block.type==='image')mark(block,'image');
      }
    }
    return [...items.values()];
  }
  function countUntrackedDeletedTopicMedia(topic,items){
    // Some old inline note images stored only Telegram file_id, not message_id; they cannot safely be deleted by the Worker.
    const known=new Set(items.map(x=>String(x.fileId)));
    const untracked=new Set();
    const check=entry=>{if(entry&&entry.fileId&&!known.has(String(entry.fileId)))untracked.add(String(entry.fileId));};
    topicAudioParts(topic).forEach(check);
    check(topic.contentArchive);check(topic.interludeImage);
    for(const edition of Object.values(topic.editions||{})){
      for(const block of Array.isArray(edition?.blocks)?edition.blocks:Object.values(edition?.blocks||{})){
        if(block?.type==='image')check(block);
        for(const match of String(block?.html||'').matchAll(/data-book-note-image=["']([^"']+)["']/g)){
          if(!known.has(match[1]))untracked.add(match[1]);
        }
      }
    }
    return untracked.size;
  }
  async function cleanupDeletedTopicMedia(topic){
    const items=collectDeletedTopicMedia(topic),untracked=countUntrackedDeletedTopicMedia(topic,items);
    if(!items.length)return {deleted:0,retained:untracked,failed:0};
    let currentBooks;
    try{currentBooks=(await db().ref('TrainingBooks').once('value')).val()||{};}
    catch(error){console.warn('Mavzu mediasi tozalash: foydalanilayotgan fayllarni tekshirib bo‘lmadi:',error);return {deleted:0,retained:items.length+untracked,failed:0};}
    // Include hydrated archives in the existing in-memory books (inline images live inside Telegram JSON).
    const remoteText=JSON.stringify(currentBooks),hydratedText=JSON.stringify(state.books);
    let archivesUnknown=false;
    for(const book of Object.values(state.books||{}))for(const chapter of Object.values(book.chapters||{}))for(const other of Object.values(chapter.topics||{})){
      if(other.contentArchive?.fileId&&!other.editions)archivesUnknown=true;
    }
    let deleted=0,retained=untracked,failed=0;
    for(const item of items){
      // File IDs are opaque and typically unique; a match anywhere in remaining live content means retain.
      const referenced=remoteText.includes(JSON.stringify(item.fileId))||hydratedText.includes(JSON.stringify(item.fileId))||
        (item.type==='image'&&archivesUnknown);
      if(referenced){retained++;continue;}
      try{await trainingMediaDelete(item.messageId);deleted++;}
      catch(error){failed++;console.warn('Mavzuga tegishli Telegram fayli o‘chirilmadi:',error);}
    }
    return {deleted,retained,failed};
  }
  async function deleteBookTopic(bookId,chapterId,topicId,expectedTopic){
    if(!isSuperAdmin()||!bookId||!chapterId||!topicId||topicId===PRIMARY_BOOK_TOPIC||topicId==='__new__')throw new Error('Mavzuni o‘chirishga ruxsat yo‘q.');
    const chapter=state.books[bookId]?.chapters?.[chapterId];if(!chapter?.topics?.[topicId])throw new Error('Mavzu allaqachon o‘chirilgan.');
    const topicsRef=db().ref(`TrainingBooks/${bookId}/chapters/${chapterId}/topics`);
    let conflict=false;
    const stamp=Number(expectedTopic.updatedAt)||0;
    const archiveId=String(expectedTopic.contentArchive?.fileId||'');
    const result=await topicsRef.transaction(all=>{
      if(!all||!all[topicId]){conflict=true;return;}
      const target=all[topicId];
      if((Number(target.updatedAt)||0)!==stamp||String(target.contentArchive?.fileId||'')!==archiveId){conflict=true;return;}
      const rest=Object.entries(all).filter(([id])=>id!==topicId).sort((a,b)=>(Number(a[1]?.order)||0)-(Number(b[1]?.order)||0)||a[0].localeCompare(b[0]));
      const updated={};rest.forEach(([id,topic],index)=>{updated[id]={...topic,order:index+2};});
      return updated;
    },undefined,false);
    if(!result.committed)throw new Error(conflict?'Mavzu boshqa qurilmada o‘zgargan yoki o‘chirilgan. Oynani yangilang.':'Firebase mavzuni o‘chirishni tasdiqlamadi.');
    const verify=(await topicsRef.once('value')).val()||{};
    if(verify[topicId])throw new Error('Mavzuning o‘chirilgani Firebase tomonidan tasdiqlanmadi.');
    const sorted=Object.entries(verify).sort((a,b)=>(Number(a[1]?.order)||0)-(Number(b[1]?.order)||0));
    if(sorted.some(([,t],i)=>Number(t.order)!==i+2))throw new Error('Mavzular tartibi Firebase tomonidan tasdiqlanmadi.');
    const before=chapter.topics;
    const oldTopicPosition=topicEntries(chapter).findIndex(([id])=>id===topicId);
    const previousSelected=state.bookAdminTopicId;
    const updated={};for(const [id,topic] of Object.entries(verify)){
      const old=before[id];
      updated[id]=(old&&old.contentArchive?.fileId===topic.contentArchive?.fileId)?{...old,...topic}:{...topic};
    }
    chapter.topics=updated;
    for(const key of Object.keys(state.topicDraftCache||{})){
      if(key===`${bookId}:${chapterId}:${topicId}`){delete state.topicDraftCache[key];continue;}
      if(key.startsWith(`${bookId}:${chapterId}:`)){
        const cachedId=key.slice(`${bookId}:${chapterId}:`.length);
        if(updated[cachedId]&&state.topicDraftCache[key])state.topicDraftCache[key].order=Number(updated[cachedId].order)||state.topicDraftCache[key].order;
      }
    }
    state.topicDraftKey='';state.topicDraft=null;
    state.bookAdminTopicId=previousSelected===topicId?(sorted[Math.min(Math.max(0,oldTopicPosition),sorted.length-1)]?.[0]||PRIMARY_BOOK_TOPIC):previousSelected;
    state.pendingTopicAudioParts=null;state.topicRemovedMedia=[];
    revokeTtsParts();
    // Firebase removal is committed before deleting media; never delete files on a failed transaction.
    const cleanup=await cleanupDeletedTopicMedia(expectedTopic);
    repaint();
    return cleanup;
  }
  function switchAdminTopic(id){
    if(!canNavigateFromAudio())return;
    cacheCurrentTopicDraft();
    state.bookAdminTopicId=id;
    state.topicDraftKey='';state.topicDraft=null;
    state.topicRemovedMedia=[];state.pendingTopicAudioParts=null;
    revokeTtsParts();repaint();
  }
  function ensureTopicDraft(bookId,chapterId,ch){
    const topics=topicEntries(ch),wantsNew=state.bookAdminTopicId==='__new__',topicId=wantsNew?'':state.bookAdminTopicId&&topics.some(([id])=>id===state.bookAdminTopicId)?state.bookAdminTopicId:(topics[0]||[])[0]||'',topic=topicId&&ch&&ch.topics&&ch.topics[topicId],key=`${bookId||'new'}:${chapterId||'new'}:${wantsNew?'new':topicId||'new'}`;
    if(state.topicDraftKey!==key){if(state.topicDraftCache[key]){state.topicDraft=state.topicDraftCache[key];state.topicDraftKey=key;return state.topicDraft;}const legacyText='',legacyTts='';state.bookAdminTopicId=wantsNew?'__new__':topicId;state.topicDraft={id:topicId,titleLatin:topic&&topic.titleLatin||'',titleCyrillic:topic&&topic.titleCyrillic||'',order:Number(topic&&topic.order)||Math.max(1,...topics.map(([,t])=>Number(t.order)||0))+1,published:topic?topic.published!==false:true,editions:{latin:{blocks:topicBlocks(topic,'latin').length?topicBlocks(topic,'latin').map(x=>({...x})):(legacyText?[{type:'paragraph',text:legacyText,align:'left',color:'#183b50',fontSize:19}]:[blankTextBlock('paragraph')])},cyrillic:{blocks:topicBlocks(topic,'cyrillic').length?topicBlocks(topic,'cyrillic').map(x=>({...x})):[blankTextBlock('paragraph')]}},ttsText:topic&&topic.ttsText||legacyTts,voice:topic&&topic.ttsVoice||'navoiy',speed:String(topic&&topic.ttsSpeed||'1'),audioParts:topicAudioParts(topic),contentArchive:topic&&topic.contentArchive||null};state.topicDraftKey=key;state.topicDraftCache[key]=state.topicDraft;state.topicRemovedMedia=[];state.pendingTopicAudioParts=null;}
    return state.topicDraft;
  }
  function syncTopicDraft(){const host=document.querySelector('#hetk-training-overlay [data-topic-studio]'),draft=state.topicDraft;if(!host||!draft)return;const titleLatin=host.querySelector('[name="topicTitleLatin"]'),titleCyrillic=host.querySelector('[name="topicTitleCyrillic"]'),tts=host.querySelector('[name="topicTtsText"]'),voice=host.querySelector('[name="topicVoice"]'),speed=host.querySelector('[name="topicSpeed"]');if(titleLatin)draft.titleLatin=titleLatin.value;if(titleCyrillic)draft.titleCyrillic=titleCyrillic.value;if(tts)draft.ttsText=tts.value;if(voice)draft.voice=voice.value;if(speed)draft.speed=speed.value;const between=host.querySelector('[name="topicInterludeText"]');if(between)draft.interludeText=between.value;const blocks=[];host.querySelectorAll('[data-topic-block]').forEach(row=>{const old=(draft.editions[state.topicEdition].blocks||[])[Number(row.dataset.topicBlock)]||{},type=row.dataset.blockType||old.type||'paragraph';if(type==='image')blocks.push({...old,type,caption:(row.querySelector('[data-block-caption]')||{}).value||'',layout:(row.querySelector('[data-block-layout]')||{}).value||'auto',width:Number((row.querySelector('[data-block-width]')||{}).value)||100});else blocks.push({...old,type,text:(row.querySelector('[data-block-rich]')?.innerText||row.querySelector('[data-block-text]')?.value||''),html:row.querySelector('[data-block-rich]')?safeRichHtml(row.querySelector('[data-block-rich]').innerHTML):(old.html||''),fontSize:Number((row.querySelector('[data-block-size]')||{}).value)||19,color:(row.querySelector('[data-block-color]')||{}).value||'#183b50',align:(row.querySelector('[data-block-align]')||{}).value||'left'});});draft.editions[state.topicEdition].blocks=blocks;}
  function topicBlockEditor(block,index){const tools=`<div class="hetk-block-actions"><button type="button" data-move-topic-block="up" title="Yuqoriga"><i class="fas fa-arrow-up"></i></button><button type="button" data-move-topic-block="down" title="Pastga"><i class="fas fa-arrow-down"></i></button><button type="button" data-remove-topic-block title="O‘chirish"><i class="fas fa-trash"></i></button></div>`;if(block.type==='image')return `<article class="hetk-content-block image" data-topic-block="${index}" data-block-type="image">${tools}<div class="hetk-block-image-preview">${block.fileId?`<img data-training-media-file="${esc(block.fileId)}" alt="Rasm">`:'<i class="fas fa-image"></i>'}</div><label>Rasmni almashtirish<input type="file" accept="image/*" data-topic-image-file></label><div class="hetk-block-grid"><label>Joylashuvi<select data-block-layout><option value="auto" ${block.layout==='auto'?'selected':''}>Avtomatik</option><option value="left" ${block.layout==='left'?'selected':''}>Chapda</option><option value="right" ${block.layout==='right'?'selected':''}>O‘ngda</option><option value="full" ${block.layout==='full'?'selected':''}>To‘liq kenglikda</option></select></label><label>Rasm kengligi (%)<input type="number" data-block-width min="20" max="100" value="${Math.max(20,Math.min(100,Number(block.width)||100))}"></label><label>Rasm izohi<input data-block-caption value="${esc(block.caption||'')}" placeholder="Rasm yoki sxema izohi"></label></div></article>`;return `<article class="hetk-content-block text" data-topic-block="${index}" data-block-type="${esc(block.type||'paragraph')}">${tools}<div class="hetk-block-toolbar"><select data-block-size><option value="16" ${Number(block.fontSize)===16?'selected':''}>16 px</option><option value="19" ${Number(block.fontSize||19)===19?'selected':''}>19 px</option><option value="22" ${Number(block.fontSize)===22?'selected':''}>22 px</option><option value="26" ${Number(block.fontSize)===26?'selected':''}>26 px</option></select><input type="color" data-block-color value="${esc(block.color||'#183b50')}" title="Matn rangi"><select data-block-align><option value="left" ${block.align==='left'?'selected':''}>Chap</option><option value="center" ${block.align==='center'?'selected':''}>Markaz</option><option value="right" ${block.align==='right'?'selected':''}>O‘ng</option></select></div><div class="hetk-v15-block-rich-tools"><button type="button" data-topic-format="bold" title="Qalin"><b>B</b></button><button type="button" data-topic-format="italic" title="Qiya"><i>I</i></button><button type="button" data-topic-format="underline" title="Tagiga chizish"><u>U</u></button><button type="button" data-topic-note title="Belgilangan matnga izoh biriktirish"><i class="fas fa-comment-dots"></i> Izoh</button><button type="button" data-topic-note-image><i class="fas fa-image"></i> Rasmli izoh</button><input type="file" accept="image/*" data-topic-note-file hidden></div><div class="hetk-v15-block-rich" data-block-rich contenteditable="true" spellcheck="true" data-placeholder="Matn kiriting...">${block.html?safeRichHtml(block.html):esc(block.text||'').replace(/\n/g,'<br>')}</div></article>`;}
  function renderTopicStudio(book,ch){
    const allTopics=topicEntries(ch),archivedTopics=allTopics.filter(([,t])=>isDuplicateLegacyTopic(ch,t)),topics=allTopics.filter(([,t])=>!isDuplicateLegacyTopic(ch,t)),canEdit=!!(book&&ch),isPrimary=(!state.bookAdminTopicId||state.bookAdminTopicId===PRIMARY_BOOK_TOPIC);
    const extraSelected=state.bookAdminTopicId==='__new__'||(state.bookAdminTopicId&&state.bookAdminTopicId!==PRIMARY_BOOK_TOPIC&&allTopics.some(([id])=>id===state.bookAdminTopicId));
    const draft=extraSelected?ensureTopicDraft(state.bookAdminBookId,state.bookAdminChapterId,ch):null;
    const blocks=draft&&draft.editions[state.topicEdition].blocks||[];
    const extraEditor=!canEdit?'':!extraSelected?`<div class="hetk-v24-primary-help"><i class="fas fa-circle-check"></i><div><b>1-mavzu tanlangan</b><p>Bu bobning birinchi matni va audiosi yuqoridagi 1-mavzu muharririda saqlanadi. Ularni tahrirlash uchun «1-mavzu matniga o‘tish» tugmasidan foydalaning. Keyingi mavzular bu yerdan qo‘shiladi.</p><button type="button" class="hetk-training-secondary" data-admin-primary-topic><i class="fas fa-arrow-up"></i> 1-mavzu matniga o‘tish</button></div></div>`:`<div class="hetk-topic-editor"><div class="hetk-topic-editions"><button type="button" class="${state.topicEdition==='latin'?'on':''}" data-topic-edition="latin">Lotincha nashr</button><button type="button" class="${state.topicEdition==='cyrillic'?'on':''}" data-topic-edition="cyrillic">Кириллча нашр</button></div><div class="hetk-block-grid"><label>Lotincha mavzu nomi<input name="topicTitleLatin" value="${esc(draft.titleLatin)}" placeholder="Masalan: Ish joyini tayyorlash"></label><label>Кириллча мавзу номи<input name="topicTitleCyrillic" value="${esc(draft.titleCyrillic)}" placeholder="Мавзу номини киритинг"></label></div><div class="hetk-content-block-list">${blocks.map(topicBlockEditor).join('')}</div><div class="hetk-add-blocks"><button type="button" data-add-topic-block="paragraph"><i class="fas fa-paragraph"></i> Abzas</button><button type="button" data-add-topic-block="heading"><i class="fas fa-heading"></i> Sarlavha</button><button type="button" data-add-topic-block="image"><i class="fas fa-image"></i> Rasm</button></div><details class="hetk-topic-audio" open><summary><i class="fas fa-headphones"></i> Shu mavzuning audiosi</summary><label>Audio uchun matn<textarea name="topicTtsText" rows="7" placeholder="Shu mavzuning ovozlashtiriladigan matni...">${esc(draft.ttsText||'')}</textarea></label><div class="hetk-tts-controls"><label>Ovoz<select name="topicVoice">${voiceOptions(draft.voice)}</select></label><label>Tezlik<select name="topicSpeed"><option value="0.9" ${draft.speed==='0.9'?'selected':''}>0.9</option><option value="1" ${draft.speed==='1'?'selected':''}>1.0</option><option value="1.1" ${draft.speed==='1.1'?'selected':''}>1.1</option></select></label><button type="button" data-topic-tts-preview><i class="fas fa-wave-square"></i> Mavzu audiosini yaratish</button></div><div class="hetk-tts-normalize-row"><button type="button" data-topic-tts-normalize><i class="fas fa-wand-magic-sparkles"></i> TTS matnini tayyorlash</button><span>Kitob lug‘ati asosida</span></div><div class="hetk-tts-parts" data-topic-tts-parts></div><div class="hetk-topic-saved-audio"><b>Saqlangan audio — eshitib tekshirish</b>${draft.audioParts.length?renderTopicAudioList(draft):'<p>Hali audio saqlanmagan. Matnni audiosiz ham saqlashingiz mumkin.</p>'}</div><p class="hetk-topic-audio-note">Yangi audio to‘liq yuklanib, Firebase tasdiqlagach, aynan shu mavzuning eski audiosi Telegramdan tozalanadi. Boshqa mavzular o‘zgarmaydi.</p></details><footer><label class="hetk-topic-visible"><input type="checkbox" data-topic-published ${draft.published?'checked':''}> Xodimlarga ko‘rinsin</label>${draft.id?`<button type="button" class="hetk-v25-delete-topic-wide" data-delete-book-topic="${esc(draft.id)}"><i class="fas fa-trash-can"></i> Mavzuni to‘liq o‘chirish</button>`:''}<button type="button" class="primary" data-save-topic><i class="fas fa-floppy-disk"></i> Mavzuni alohida saqlash</button></footer></div>`;
    return `<section class="hetk-book-studio-card hetk-topic-studio" data-topic-studio><div class="hetk-book-card-title"><h4><span>4</span> Bob ichidagi mavzular</h4><button type="button" class="hetk-training-secondary" data-new-topic ${canEdit?'':'disabled'}><i class="fas fa-plus"></i> Yangi mavzu</button></div><p class="hetk-book-help"><i class="fas fa-layer-group"></i> Har bir bobda avtomatik 1-mavzu bor. U bobning eski matn va audio maydonlarini ishlatadi — hech narsa ko‘chirilmaydi yoki yo‘qolmaydi. Yangi mavzular mustaqil matn va audio sifatida saqlanadi.</p>${!canEdit?'<div class="hetk-topic-workspace"><aside><b>Mavzular</b><button type="button" class="on" data-admin-primary-topic><span>1</span><div><b>1-mavzu — bob boshlanishi</b><small>Hali saqlanmagan · yuqorida matn va audio tahriri bor</small></div></button></aside><div class="hetk-topic-first-save">1-mavzu avtomatik ochildi. Uning matnini va xohlasangiz audiosini yuqoridagi maydonlarga kiriting. Bobni saqlagandan keyin qo‘shimcha mavzular qo‘shish mumkin.</div></div>':`<div class="hetk-topic-workspace"><aside><b>Mavzular</b><button type="button" class="${isPrimary?'on':''}" data-admin-primary-topic><span>1</span><div><b>1-mavzu — bob boshlanishi</b><small>${chapterAudioParts(ch).length} ta audio qism · bobning asl matni</small></div></button>${topics.map(([id,t],i)=>`<div class="hetk-v25-topic-row"><button type="button" class="hetk-v25-topic-pick ${id===state.bookAdminTopicId?'on':''}" data-admin-topic="${esc(id)}"><span>${i+2}</span><div><b>${esc(t.titleLatin||t.titleCyrillic||'Nomsiz mavzu')}</b><small>${topicAudioParts(t).length} audio · ${t.published===false?'Yashirin':'Ko‘rinadi'}</small></div></button><button type="button" class="hetk-v25-topic-delete" data-delete-book-topic="${esc(id)}" title="Mavzuni matni va audiosi bilan butunlay o‘chirish" aria-label="${i+2}-mavzuni to‘liq o‘chirish"><i class="fas fa-trash-can"></i></button></div>`).join('')}${archivedTopics.length?`<details class="hetk-v24-legacy-topics" ${archivedTopics.some(([id])=>id===state.bookAdminTopicId)?'open':''}><summary><i class="fas fa-box-archive"></i> Eski takror nusxalar (${archivedTopics.length})</summary><small>Matn 1-mavzuda mavjud. Bu nusxalar va audiolari o‘chirilmagan.</small>${archivedTopics.map(([id,t])=>`<div class="hetk-v25-topic-row"><button type="button" data-admin-topic="${esc(id)}" class="hetk-v25-topic-pick ${id===state.bookAdminTopicId?'on':''}"><i class="fas fa-file-audio"></i><div><b>${esc(t.titleLatin||'Eski nusxa')}</b><small>${topicAudioParts(t).length} audio</small></div></button><button type="button" class="hetk-v25-topic-delete" data-delete-book-topic="${esc(id)}" title="Eski takror mavzuni to‘liq o‘chirish" aria-label="Eski takror mavzuni o‘chirish"><i class="fas fa-trash-can"></i></button></div>`).join('')}</details>`:''}${state.bookAdminTopicId==='__new__'?`<button type="button" class="on" data-admin-topic="__new__"><span>${topics.length+2}</span><div><b>Yangi mavzu (saqlanmagan)</b><small>Matn yoki rasm kiriting</small></div></button>`:''}</aside>${extraEditor}</div>`}</section>`;
  }
  function renderAudioTopicStudio(book,ch){
    const topics=topicEntries(ch),draft=ensureTopicDraft(state.bookAdminBookId,state.bookAdminChapterId,ch),canEdit=!!(book&&ch),stored=draft.id&&ch&&ch.topics&&ch.topics[draft.id]||{};
    if(draft.interludeText===undefined)draft.interludeText=stored.interludeText||'';if(draft.interludeImage===undefined)draft.interludeImage=stored.interludeImage||null;
    return `<section class="hetk-book-studio-card hetk-topic-studio hetk-audio-topic-studio" data-topic-studio><div class="hetk-book-card-title"><h4><span>3</span> Audio mavzular</h4><button type="button" class="hetk-training-secondary" data-new-topic ${canEdit?'':'disabled'}><i class="fas fa-plus"></i> Audio mavzu qo‘shish</button></div><p class="hetk-book-help"><i class="fas fa-headphones"></i> Har bir mavzuni alohida audio qilib saqlashingiz mumkin. Keyingi mavzuni keyinroq qo‘shsangiz ham oldingi audio saqlanib qoladi.</p>${!canEdit?'<div class="hetk-topic-first-save">Avval kitob va bobni saqlang, keyin audio mavzu yarating.</div>':`<div class="hetk-topic-workspace"><aside><b>Audio mavzular</b>${topics.length?topics.map(([id,t],i)=>`<button type="button" class="${id===state.bookAdminTopicId?'on':''}" data-admin-topic="${id}"><span>${i+1}</span><div><b>${esc(t.titleLatin||t.titleCyrillic||'Nomsiz mavzu')}</b><small>${topicAudioParts(t).length} audio · ${t.published===false?'Yashirin':'Ko‘rinadi'}</small></div></button>`).join(''):'<p>Hali audio mavzu yaratilmagan.</p>'}</aside><div class="hetk-topic-editor"><label class="hetk-audio-topic-title">Mavzu nomi<input name="topicTitleLatin" value="${esc(draft.titleLatin)}" placeholder="Masalan: Ish joyini tayyorlash"></label><input name="topicTitleCyrillic" type="hidden" value="${esc(draft.titleCyrillic)}"><div class="hetk-topic-audio"><label>Audio uchun matn<textarea name="topicTtsText" rows="12" placeholder="Faqat shu mavzuga tegishli matnni kiriting...">${esc(draft.ttsText||'')}</textarea></label><div class="hetk-tts-normalize-row"><button type="button" data-topic-tts-normalize><i class="fas fa-wand-magic-sparkles"></i> TTS matnini tayyorlash</button><span>Qisqartmalar va o‘lchov birliklari shu kitob lug‘ati bo‘yicha ochiladi.</span></div><div class="hetk-tts-controls"><label>Ovoz<select name="topicVoice">${voiceOptions(draft.voice)}</select></label><label>Tezlik<select name="topicSpeed"><option value="0.9" ${draft.speed==='0.9'?'selected':''}>0.9</option><option value="1" ${draft.speed==='1'?'selected':''}>1.0</option><option value="1.1" ${draft.speed==='1.1'?'selected':''}>1.1</option></select></label><button type="button" data-topic-tts-preview><i class="fas fa-wave-square"></i> Mavzu audiosini yaratish</button></div><div class="hetk-tts-parts" data-topic-tts-parts></div>${draft.audioParts.length?renderTopicAudioList(draft):''}</div><details class="hetk-audio-between" open><summary><i class="fas fa-photo-film"></i> Shu audio bilan keyingi audio orasidagi material</summary><label>Qisqa matn yoki izoh<textarea name="topicInterludeText" rows="5" placeholder="Audio tugagach ko‘rinadigan matn...">${esc(draft.interludeText||'')}</textarea></label><div class="hetk-audio-between-image">${draft.interludeImage&&draft.interludeImage.fileId?`<img data-training-media-file="${esc(draft.interludeImage.fileId)}" alt="Audio oralig‘idagi rasm">`:'<i class="fas fa-image"></i><span>Rasm tanlanmagan</span>'}</div><label class="hetk-audio-between-upload"><i class="fas fa-image"></i> Rasm tanlash<input type="file" accept="image/*" data-topic-interlude-image hidden></label></details><footer><label class="hetk-topic-visible"><input type="checkbox" data-topic-published ${draft.published?'checked':''}> Xodimlarga ko‘rinsin</label>${draft.id?`<button type="button" class="hetk-v25-delete-topic-wide" data-delete-book-topic="${esc(draft.id)}"><i class="fas fa-trash-can"></i> Mavzuni to‘liq o‘chirish</button>`:''}<button type="button" class="primary" data-save-topic><i class="fas fa-floppy-disk"></i> Mavzu va audioni saqlash</button></footer></div></div>`}</section>`;
  }
  // V15: matn, rasm va audio bir mavzuda. Audio-only ko‘rinish asl muharrirni bosib ketmasin.
  function bindAudioTopicTools(root){const studio=root&&root.querySelector('.hetk-topic-studio'),audioBox=studio&&studio.querySelector('.hetk-topic-audio');if(studio&&audioBox&&!studio.querySelector('[data-tts-server-status]'))audioBox.insertAdjacentHTML('beforebegin',ttsStatusHtml());const normalize=root&&root.querySelector('[data-topic-tts-normalize]');if(normalize&&!normalize.dataset.bound){normalize.dataset.bound='1';normalize.addEventListener('click',()=>{syncTopicDraft();const book=currentAdminBook(),area=root.querySelector('[name="topicTtsText"]');if(!area||!area.value.trim())return toast('Avval audio matnini kiriting.','error');area.value=normalizeUzbekTtsText(area.value,book&&book.ttsDictionaryText||DEFAULT_TTS_DICTIONARY);area.dispatchEvent(new Event('input',{bubbles:true}));toast('Audio matni TTS uchun tayyorlandi.','success');});}const input=root&&root.querySelector('[data-topic-interlude-image]');if(input&&!input.dataset.bound){input.dataset.bound='1';input.addEventListener('change',async()=>{const file=input.files&&input.files[0];if(!file||!state.topicDraft)return;if(file.size>TRAINING_MEDIA_MAX_BYTES){input.value='';return toast('Rasm 18 MB dan katta.','error');}try{toast('Oraliq rasm Telegramga yuklanmoqda...');const uploaded=await trainingMediaUpload(file,'image',state.bookAdminBookId,state.bookAdminTopicId||'new-topic','HETK O‘quv markazi — audio oralig‘i rasmi');state.topicDraft.interludeImage=uploaded;repaint();toast('Rasm audio oralig‘iga qo‘shildi. Mavzuni saqlang.','success');}catch(err){toast('Rasm yuklanmadi: '+err.message,'error');}});}}
  async function previewTopicTts(){const host=document.querySelector('#hetk-training-overlay [data-topic-studio]'),draft=state.topicDraft;if(!host||!draft||state.ttsGenerating)return;syncTopicDraft();const text=String(draft.ttsText||'').trim();if(!text)return toast('Mavzu uchun audio matnini kiriting.','error');let plan;try{plan=ttsPlan(text,draft.speed);}catch(err){return toast(err.message,'error');}revokeTtsParts();state.ttsGenerating=true;state.ttsContextKey=`topic:${state.bookAdminBookId}:${state.bookAdminChapterId}:${draft.id||'new'}`;const box=host.querySelector('[data-topic-tts-parts]');if(box)box.innerHTML=`<div class="hetk-tts-parts-summary"><b>${plan.parts.length} ta qism yaratiladi</b><span>Tayyor qismlar darhol ko‘rinadi.</span></div><div class="hetk-tts-parts-list" data-audio-playlist></div>`;try{for(let i=0;i<plan.parts.length;i++)await generateSafeTtsText(plan.parts[i],draft.voice,draft.speed,async ready=>{const part={...ready,url:URL.createObjectURL(ready.blob),voice:draft.voice,speed:draft.speed};state.ttsParts.push(part);const list=host.querySelector('[data-topic-tts-parts] .hetk-tts-parts-list'),index=state.ttsParts.length-1;if(list){const article=document.createElement('article');article.innerHTML=`<div class="hetk-tts-part-head"><span><i class="fas fa-circle-check"></i><b>${index+1}-audio tayyor</b></span><small>${mediaSize(part.blob.size)}</small></div><audio controls preload="metadata" data-playlist-index="${index}"></audio>`;article.querySelector('audio').src=part.url;list.appendChild(article);bindAudioPlaylists(list);}});toast(`${state.ttsParts.length} ta mavzu audiosi tayyor. “Mavzuni saqlash”ni bosing.`,'success');}catch(err){toast('Mavzu audiosi yaratilmadi: '+err.message,'error');}finally{state.ttsGenerating=false;}}
  async function previewTopicTtsWithProgress(){
    const host=document.querySelector('#hetk-training-overlay [data-topic-studio]'),draft=state.topicDraft,button=host&&host.querySelector('[data-topic-tts-preview]');if(!host||!draft)return;if(state.ttsGenerating)return toast('Audio hozir yaratilmoqda. Jarayon tugashini kuting.','warning');syncTopicDraft();const text=String(draft.ttsText||'').trim();if(!text)return toast('Mavzu uchun audio matnini kiriting.','error');let plan;try{plan=ttsPlan(text,draft.speed);}catch(err){return toast(err.message,'error');}
    revokeTtsParts();state.ttsGenerating=true;state.ttsContextKey=`topic:${state.bookAdminBookId}:${state.bookAdminChapterId}:${draft.id||'new'}`;if(button){button.disabled=true;button.classList.add('is-generating');button.setAttribute('aria-busy','true');button.innerHTML=`<i class="fas fa-spinner fa-spin"></i> 0/${plan.parts.length} audio yaratilmoqda`;}const box=host.querySelector('[data-topic-tts-parts]');if(box)box.innerHTML=`<div class="hetk-tts-parts-summary is-generating"><b><i class="fas fa-spinner fa-spin"></i> Audio yaratish boshlandi</b><span data-topic-progress>0/${plan.parts.length} qism tayyor · oynani yopmang</span></div><div class="hetk-tts-progress-track"><i data-topic-progress-bar style="width:0%"></i></div><div class="hetk-tts-parts-list" data-audio-playlist></div>`;
    try{for(let i=0;i<plan.parts.length;i++)await generateSafeTtsText(plan.parts[i],draft.voice,draft.speed,async ready=>{const part={...ready,url:URL.createObjectURL(ready.blob),voice:draft.voice,speed:draft.speed};state.ttsParts.push(part);const done=state.ttsParts.length,progress=host.querySelector('[data-topic-progress]'),bar=host.querySelector('[data-topic-progress-bar]'),list=host.querySelector('[data-topic-tts-parts] .hetk-tts-parts-list');if(button)button.innerHTML=`<i class="fas fa-spinner fa-spin"></i> ${done}/${plan.parts.length} audio yaratilmoqda`;if(progress)progress.textContent=`${done}/${plan.parts.length} qism tayyor · ${Math.round(done/plan.parts.length*100)}%`;if(bar)bar.style.width=`${Math.round(done/plan.parts.length*100)}%`;if(list){const index=done-1,article=document.createElement('article');article.innerHTML=`<div class="hetk-tts-part-head"><span><i class="fas fa-circle-check"></i><b>${index+1}-audio tayyor</b></span><small>${mediaSize(part.blob.size)}</small></div><audio controls preload="metadata" data-playlist-index="${index}"></audio>`;article.querySelector('audio').src=part.url;list.appendChild(article);bindAudioPlaylists(list);}});state.ttsPreview={kind:'topic',context:state.ttsContextKey,partCount:state.ttsParts.length};const summary=host.querySelector('.hetk-tts-parts-summary');if(summary){summary.classList.remove('is-generating');summary.classList.add('is-complete');summary.innerHTML=`<b><i class="fas fa-circle-check"></i> ${state.ttsParts.length} ta audio tayyor</b><span>Audio qismlarini eshitib ko‘ring, keyin “Mavzu va audioni saqlash”ni bosing.</span>`;}toast(`${state.ttsParts.length} ta mavzu audiosi tayyor. “Mavzuni saqlash”ni bosing.`,'success');}catch(err){const summary=host.querySelector('.hetk-tts-parts-summary');if(summary){summary.classList.remove('is-generating');summary.classList.add('is-error');summary.innerHTML=`<b><i class="fas fa-circle-exclamation"></i> Audio yaratish to‘xtadi</b><span>${esc(err.message)}</span>`;}toast('Mavzu audiosi yaratilmadi: '+err.message,'error');}finally{state.ttsGenerating=false;if(button){button.disabled=false;button.classList.remove('is-generating');button.removeAttribute('aria-busy');button.innerHTML='<i class="fas fa-wave-square"></i> Mavzu audiosini qayta yaratish';}}
  }
  previewTopicTts=previewTopicTtsWithProgress;
  async function saveTopic(){if(!isSuperAdmin())return toast('Ruxsat yo‘q.','error');if(state.ttsGenerating)return toast('Audio yaratilmoqda. Tayyor bo‘lguncha saqlamang.','warning');if(state.ttsParts.length&&(!state.ttsPreview||state.ttsPreview.kind!=='topic'||state.ttsPreview.context!==state.ttsContextKey))return toast('Mavzu audiosi hali to‘liq yaratilmagan. Qayta yarating yoki tayyor bo‘lishini kuting.','error');syncTopicDraft();const draft=state.topicDraft,book=state.books[state.bookAdminBookId],ch=book&&book.chapters&&book.chapters[state.bookAdminChapterId];if(!draft||!book||!ch)return toast('Avval kitob va bobni saqlang.','error');if(!draft.titleLatin.trim()&&!draft.titleCyrillic.trim())return toast('Mavzu nomini kiriting.','error');const topicId=draft.id||db().ref(`TrainingBooks/${state.bookAdminBookId}/chapters/${state.bookAdminChapterId}/topics`).push().key,stamp=Date.now(),content={schema:'hetk-book-audio-topic-v2',bookId:state.bookAdminBookId,chapterId:state.bookAdminChapterId,topicId,editions:draft.editions,ttsText:draft.ttsText,interludeText:draft.interludeText||'',interludeImage:draft.interludeImage||null,updatedAt:stamp,updatedBy:uid()};let archive;try{
      const unchangedSource=ch.topics&&ch.topics[topicId];
      const oldContent=unchangedSource&&unchangedSource.contentArchive;
      const oldHash=oldContent&&oldContent.contentHash||'';
      const contentHash=await jsonContentHash({editions:draft.editions,ttsText:draft.ttsText,interludeText:draft.interludeText||'',interludeImage:draft.interludeImage||null});
      if(oldContent&&oldContent.fileId&&contentHash===oldHash){archive=oldContent;}
      else{
        toast('Mavzu matni Telegram kanaliga saqlanmoqda...');
        archive=await saveContentJson(content,`mavzu-${draft.titleLatin||draft.titleCyrillic}-${topicId}`,`HETK O‘quv markazi — MAVZU\n${book.titleUz||''}\n${draft.titleLatin||draft.titleCyrillic}`,state.bookAdminBookId,state.bookAdminChapterId,draft.contentArchive);
        archive={...archive,contentHash};
      }
    }catch(err){return toast('Mavzu matni saqlanmadi: '+err.message,'error');}

    const oldTopic=ch.topics&&ch.topics[topicId]||{},oldAudio=topicAudioParts(oldTopic);let storedAudio=state.pendingTopicAudioParts||draft.audioParts||oldAudio,replacingAudio=state.ttsParts.length>0&&state.ttsContextKey===`topic:${state.bookAdminBookId}:${state.bookAdminChapterId}:${draft.id||'new'}`;
    if(replacingAudio){storedAudio=[];try{for(let i=0;i<state.ttsParts.length;i++){const part=state.ttsParts[i],type=part.blob.type||'audio/wav',ext=type.includes('mpeg')?'mp3':type.includes('ogg')?'ogg':'wav',file=new File([part.blob],`hetk-topic-${Date.now()}-${i+1}.${ext}`,{type}),kind=/audio\/(mpeg|ogg)/i.test(type)?'audio':'document',uploaded=await trainingMediaUpload(file,kind,state.bookAdminBookId,topicId,`HETK O‘quv markazi — ${draft.titleLatin||draft.titleCyrillic} — ${i+1}/${state.ttsParts.length}`);storedAudio.push({...uploaded,voice:part.voice,speed:part.speed,partNumber:i+1,textLength:part.text.length,uploadedAt:stamp});}}catch(err){return toast('Mavzu audiosi Telegramga yuklanmadi: '+err.message,'error');}}
    const meta={id:topicId,order:Number(draft.order)||topicEntries(ch).length+1,titleLatin:draft.titleLatin.trim(),titleCyrillic:draft.titleCyrillic.trim(),published:!!((document.querySelector('[data-topic-published]')||{}).checked),contentArchive:archive,audioParts:storedAudio,ttsVoice:draft.voice,ttsSpeed:draft.speed,interludeText:draft.interludeText||'',interludeImage:draft.interludeImage||null,updatedAt:stamp,createdAt:oldTopic.createdAt||stamp};try{
      const topicRef=db().ref(`TrainingBooks/${state.bookAdminBookId}/chapters/${state.bookAdminChapterId}/topics/${topicId}`);
      await topicRef.set(meta);
      const verified=(await topicRef.once('value')).val()||{};
      if(String((verified.contentArchive||{}).fileId||'')!==String(archive.fileId||''))throw new Error('Mavzu matn arxivi tasdiqlanmadi.');
      if(replacingAudio){
        const actual=topicAudioParts(verified);
        if(actual.length!==storedAudio.length||actual.some((part,i)=>String(part.fileId)!==String(storedAudio[i].fileId)))throw new Error('Mavzuning yangi audio manzillari tasdiqlanmadi.');
      }
      ch.topics=ch.topics||{};ch.topics[topicId]={...verified,editions:draft.editions,ttsText:draft.ttsText};
      if(draft.contentArchive&&draft.contentArchive.messageId&&draft.contentArchive.messageId!==archive.messageId){try{await trainingMediaDelete(draft.contentArchive.messageId);}catch(e){console.warn('Eski mavzu arxivini o‘chirish amalga oshmadi:',e);}}
      const cleanup=replacingAudio&&oldAudio.length?await cleanupReplacedAudio(oldAudio,storedAudio):null;
      // Inline images are not deleted: another note may reference the same media file.
      delete state.topicDraftCache[state.topicDraftKey];state.bookAdminTopicId=topicId;state.topicDraftKey='';state.topicRemovedMedia=[];revokeTtsParts();
      toast(cleanup&&(cleanup.failed||cleanup.retained)?`Mavzu saqlandi. ${cleanup.failed} audio o‘chmadi; ${cleanup.retained} ta audio hali boshqa joyda ishlatilmoqda.`:'Mavzu va uning audiosi muvaffaqiyatli saqlandi.','success');
      repaint();
    }catch(err){toast('Mavzu Firebase ko‘rsatkichiga saqlanmadi: '+err.message,'error');}}
  async function uploadTopicImage(input){const file=input&&input.files&&input.files[0],row=input&&input.closest('[data-topic-block]');if(!file||!row||!state.topicDraft)return;if(file.size>TRAINING_MEDIA_MAX_BYTES){input.value='';return toast('Rasm 18 MB dan katta.','error');}syncTopicDraft();const index=Number(row.dataset.topicBlock),block=state.topicDraft.editions[state.topicEdition].blocks[index];try{toast('Rasm Telegram media kanaliga yuklanmoqda...');const uploaded=await trainingMediaUpload(file,'image',state.bookAdminBookId,state.bookAdminTopicId||'new-topic',`HETK O‘quv markazi — mavzu rasmi`);if(block.messageId)state.topicRemovedMedia.push(block.messageId);Object.assign(block,{fileId:uploaded.fileId,messageId:uploaded.messageId,storage:uploaded.storage,mimeType:uploaded.mimeType,size:uploaded.size,fileName:uploaded.fileName});repaint();toast('Rasm matn orasiga qo‘shildi. Mavzuni saqlang.','success');}catch(err){toast('Rasm yuklanmadi: '+err.message,'error');}}
  function enhanceBookRichEditor(form){
    if(typeof state.richEditorCleanup==='function'){state.richEditorCleanup();state.richEditorCleanup=null;}
    // Bobning birinchi matni doim 1-mavzu. Keyingi mavzular mavjud bo'lsa ham uning TTS/audio muharriri yashirilmaydi.
    const source=form&&form.querySelector('textarea[name="sourceText"]');if(!source||source.dataset.richReady==='1')return;source.dataset.richReady='1';source.hidden=true;const sourceField=source.closest('label');if(sourceField)sourceField.hidden=true;
    const hidden=document.createElement('textarea');hidden.name='sourceHtml';hidden.hidden=true;hidden.value=safeRichHtml((currentAdminChapter(currentAdminBook())||{}).sourceHtmlUz)||plainTextToRichHtml(source.value);source.after(hidden);
    const wrap=document.createElement('div');wrap.className='hetk-rich-editor-wrap';wrap.innerHTML=`<div class="hetk-rich-editor-label">1-mavzu — matn (bobning boshlang‘ich qismi) *</div><div class="hetk-rich-toolbar"><button type="button" data-rich-command="bold" title="Qalin"><b>B</b></button><button type="button" data-rich-command="italic" title="Qiya"><i>I</i></button><button type="button" data-rich-command="underline" title="Tagiga chizish"><u>U</u></button><select data-rich-block title="Matn turi"><option value="div">Oddiy matn</option><option value="h2">Katta sarlavha</option><option value="h3">Kichik sarlavha</option></select><select data-rich-size title="Shrift"><option value="3">16 px</option><option value="4" selected>19 px</option><option value="5">22 px</option><option value="6">26 px</option><option value="7">32 px</option></select><input type="color" data-rich-color value="#172f3f" title="Matn rangi"><button type="button" data-rich-command="justifyLeft" title="Chap"><i class="fas fa-align-left"></i></button><button type="button" data-rich-command="justifyCenter" title="Markaz"><i class="fas fa-align-center"></i></button><button type="button" data-rich-command="justifyRight" title="O‘ng"><i class="fas fa-align-right"></i></button><button type="button" data-rich-note title="Belgilangan so‘zga izoh biriktirish"><i class="fas fa-comment-dots"></i> Izoh</button><button type="button" class="image" data-rich-image><i class="fas fa-image"></i> Rasm qo‘shish</button><input type="file" accept="image/*" data-rich-image-file hidden></div><div class="hetk-rich-editor" contenteditable="true" spellcheck="true" data-rich-editor>${hidden.value}</div><small class="hetk-rich-hint">Enter, bo‘sh qator va ketma-ket probellar kitobda ham saqlanadi. Rasm kursor turgan joyga qo‘shiladi.</small>`;if(sourceField)sourceField.after(wrap);else source.before(wrap);
    const editor=wrap.querySelector('[data-rich-editor]'),sync=()=>{hidden.value=safeRichHtml(editor.innerHTML);source.value=editor.innerText.replace(/\u00a0/g,' ');};let savedRange=null;
    const floating=document.createElement('div');floating.className='hetk-rich-selection-tools';floating.hidden=true;floating.innerHTML=`<button type="button" data-float-command="bold" title="Qalin"><b>B</b></button><button type="button" data-float-command="italic" title="Qiya"><i>I</i></button><button type="button" data-float-command="underline" title="Tagiga chizish"><u>U</u></button><select data-float-size title="Shrift o‘lchami"><option value="3">16</option><option value="4" selected>19</option><option value="5">22</option><option value="6">26</option><option value="7">32</option></select><label title="Matn rangi"><i class="fas fa-palette"></i><input type="color" data-float-color value="#172f3f"></label><button type="button" data-float-note title="Izoh qo‘shish"><i class="fas fa-comment-medical"></i></button><button type="button" data-float-note-image title="Rasmli izoh"><i class="fas fa-image"></i></button>`;wrap.appendChild(floating);
    const scrollHost=editor.closest('.hetk-training-main');
    const preserveEditorScroll=()=>{const top=scrollHost?scrollHost.scrollTop:0,left=scrollHost?scrollHost.scrollLeft:0;return()=>{if(scrollHost){scrollHost.scrollTop=top;scrollHost.scrollLeft=left;}};};
    const restore=()=>{if(!savedRange)return false;const resetScroll=preserveEditorScroll();try{editor.focus({preventScroll:true});}catch(_){editor.focus();}const s=getSelection();s.removeAllRanges();s.addRange(savedRange);resetScroll();return true;};
    const placeFloating=()=>{const s=getSelection();if(!s||!s.rangeCount||s.isCollapsed||!editor.contains(s.anchorNode)||!editor.contains(s.focusNode)){floating.hidden=true;return;}savedRange=s.getRangeAt(0).cloneRange();const rect=savedRange.getBoundingClientRect();if(!rect.width&&!rect.height){floating.hidden=true;return;}floating.hidden=false;const width=floating.offsetWidth||230,height=floating.offsetHeight||45,above=rect.top-height-9,top=above>=8?above:Math.min(innerHeight-height-8,rect.bottom+9);floating.style.left=Math.max(8,Math.min(innerWidth-width-8,rect.left+rect.width/2-width/2))+'px';floating.style.top=Math.max(8,top)+'px';};
    const remember=()=>{const s=getSelection();if(s&&s.rangeCount&&editor.contains(s.anchorNode)){savedRange=s.getRangeAt(0).cloneRange();placeFloating();}};
    editor.addEventListener('keyup',()=>{remember();sync();});editor.addEventListener('mouseup',()=>setTimeout(remember,0));editor.addEventListener('touchend',()=>setTimeout(remember,80));editor.addEventListener('input',sync);editor.addEventListener('scroll',()=>{floating.hidden=true;});
    const applyCommand=(command,value)=>{const resetScroll=preserveEditorScroll();if(!restore())return;document.execCommand(command,false,value==null?null:value);resetScroll();sync();remember();};
    wrap.querySelectorAll('[data-rich-command]').forEach(btn=>btn.addEventListener('mousedown',e=>e.preventDefault()));
    wrap.querySelectorAll('[data-rich-command]').forEach(btn=>btn.addEventListener('click',()=>applyCommand(btn.dataset.richCommand,null)));
    wrap.querySelector('[data-rich-block]').addEventListener('change',e=>applyCommand('formatBlock',e.target.value));
    wrap.querySelector('[data-rich-size]').addEventListener('change',e=>applyCommand('fontSize',e.target.value));
    wrap.querySelector('[data-rich-color]').addEventListener('input',e=>applyCommand('foreColor',e.target.value));
    floating.querySelectorAll('[data-float-command],[data-float-note],[data-float-note-image]').forEach(btn=>{btn.addEventListener('mousedown',e=>e.preventDefault());});
    floating.querySelectorAll('[data-float-command]').forEach(btn=>{btn.addEventListener('click',()=>applyCommand(btn.dataset.floatCommand,null));});
    floating.querySelector('[data-float-size]').addEventListener('change',e=>applyCommand('fontSize',e.target.value));
    floating.querySelector('[data-float-color]').addEventListener('input',e=>applyCommand('foreColor',e.target.value));
    floating.querySelector('[data-float-note]')?.addEventListener('click',()=>{if(savedRange){openBookNoteEditor({editor,range:savedRange.cloneRange(),preferImage:false,onSync:sync});}});
    floating.querySelector('[data-float-note-image]')?.addEventListener('click',()=>{if(savedRange){openBookNoteEditor({editor,range:savedRange.cloneRange(),preferImage:true,onSync:sync});}});
    const scrollHandler=()=>{floating.hidden=true;};
    const outsideClickHandler=e=>{if(floating.contains(e.target)||wrap.querySelector('.hetk-rich-toolbar')?.contains(e.target)||editor.contains(e.target))return;savedRange=null;floating.hidden=true;const s=getSelection();if(s&&s.rangeCount&&(editor.contains(s.anchorNode)||editor.contains(s.focusNode)))s.removeAllRanges();};
    const outsideTouchHandler=e=>{if(floating.contains(e.target)||wrap.querySelector('.hetk-rich-toolbar')?.contains(e.target)||editor.contains(e.target))return;savedRange=null;floating.hidden=true;};
    document.addEventListener('click',outsideClickHandler);document.addEventListener('touchstart',outsideTouchHandler,{passive:true});addEventListener('scroll',scrollHandler,true);
    state.richEditorCleanup=()=>{document.removeEventListener('click',outsideClickHandler);document.removeEventListener('touchstart',outsideTouchHandler);removeEventListener('scroll',scrollHandler,true);if(floating.isConnected)floating.remove();};
    wrap.querySelector('[data-rich-note]')?.addEventListener('mousedown',e=>e.preventDefault());
    wrap.querySelector('[data-rich-note]')?.addEventListener('click',()=>{if(savedRange){editor.focus();const selection=window.getSelection();selection.removeAllRanges();selection.addRange(savedRange);}attachSelectedBookNote(editor);sync();});
    editor.addEventListener('click',e=>{const note=e.target.closest('[data-book-note],[data-book-note-image]');if(note){e.preventDefault();e.stopPropagation();openBookNoteEditor({editor,node:note,preferImage:!!note.getAttribute('data-book-note-image'),onSync:sync});return;}const img=e.target.closest('figure img');if(!img)return;const figure=img.closest('figure');const choice=window.prompt('Rasm: kenglik (20–100), chap, o‘ng, markaz yoki o‘chirish deb yozing:',String(img.style.maxWidth||'100').replace('%',''));if(choice===null)return;const v=choice.trim().toLowerCase();if(v==='o‘chirish'||v==='ochirish'||v==='delete'){if(window.confirm('Rasmni matndan olib tashlaysizmi?'))figure.remove();}else if(['chap','left','o‘ng','ong','right','markaz','center'].includes(v)){figure.className='layout-'+(v==='chap'||v==='left'?'left':v==='o‘ng'||v==='ong'||v==='right'?'right':'auto');}else if(/^\d{2,3}$/.test(v)){img.style.maxWidth=Math.max(20,Math.min(100,Number(v)))+'%';}sync();});
    const fileInput=wrap.querySelector('[data-rich-image-file]');wrap.querySelector('[data-rich-image]').addEventListener('click',()=>{remember();fileInput.click();});fileInput.addEventListener('change',async()=>{const file=fileInput.files&&fileInput.files[0];if(!file)return;if(file.size>TRAINING_MEDIA_MAX_BYTES){fileInput.value='';return toast('Rasm 18 MB dan katta.','error');}try{toast('Rasm Telegram media kanaliga yuklanmoqda...');const uploaded=await trainingMediaUpload(file,'image',state.bookAdminBookId||'new-book',state.bookAdminChapterId||'new-chapter','HETK O‘quv markazi — kitob matni rasmi');editor.focus();if(savedRange){const s=getSelection();s.removeAllRanges();s.addRange(savedRange);}document.execCommand('insertHTML',false,`<figure class="layout-full"><img data-training-media-file="${esc(uploaded.fileId)}" alt="Kitob rasmi"><figcaption>Rasm izohini shu yerga yozing</figcaption></figure><div><br></div>`);sync();hydrateTrainingMedia(editor);toast('Rasm kursor turgan joyga qo‘shildi.','success');}catch(err){toast('Rasm yuklanmadi: '+err.message,'error');}finally{fileInput.value='';}});sync();
  }
  function renderBookAdmin(){
    if(!isSuperAdmin())return empty('fa-lock','Ruxsat yo‘q','Bu bo‘lim faqat Bosh administrator uchun.');
    if(!state.booksLoaded)return empty('fa-spinner fa-spin','Kitoblar yuklanmoqda','Kitob boshqaruvi faqat shu bo‘lim ochilganda yuklanadi.');
    const all=Object.entries(state.books).sort((a,b)=>(b[1].updatedAt||0)-(a[1].updatedAt||0));
    if(!state.bookAdminNewMode&&!state.bookAdminBookId&&all.length)state.bookAdminBookId=all[0][0];
    const book=currentAdminBook(),chapters=chapterEntries(book);
    if(book&&!state.bookAdminNewChapterMode&&!state.bookAdminChapterId&&chapters.length)state.bookAdminChapterId=chapters[chapters.length-1][0];
    const ch=currentAdminChapter(book),order=ch?(Number(ch.order)||1):nextChapterOrder(book);
    const contextBook=state.bookAdminBookId||'new-book',contextChapter=state.bookAdminChapterId||'new-chapter';if(state.ttsContextKey&&!([`chapter:${contextBook}:${contextChapter}`,`topic:${contextBook}:${contextChapter}:`].some(prefix=>state.ttsContextKey===prefix||state.ttsContextKey.startsWith(prefix)))){revokeTtsParts();state.ttsContextKey='';}
    const d={bookType:book&&book.bookType||'training',title:book&&book.titleUz||'',description:book&&book.descriptionUz||'',category:book&&book.category||'Qo‘llanma',coverUrl:book&&book.coverUrl||'',ttsDictionary:book&&book.ttsDictionaryText||DEFAULT_TTS_DICTIONARY,published:!!(book&&book.published),chapterTitle:ch&&ch.titleUz||`${order}-bob`,sourceText:ch&&ch.sourceTextUz||'',ttsText:ch&&ch.ttsTextUz||'',voice:ch&&ch.ttsVoice||'navoiy',speed:ch&&ch.ttsSpeed||'1'};
    const chapterTest=ensureChapterTestDraft(state.bookAdminBookId,state.bookAdminChapterId,ch);
    const ready=chapters.filter(x=>chapterHasAudio(x[1])).length;
    return `<div class="hetk-book-admin-head"><div><span>AUDIOKITOB STUDIYASI</span><h3>${book?esc(book.titleUz||'Nomsiz kitob'):'Yangi kitob'}</h3><p>${book?`${chapters.length} ta bob · ${ready} ta audio tayyor`:'Kitob ma’lumotlarini kiriting va birinchi bobni yarating.'}</p></div><button type="button" data-new-admin-book><i class="fas fa-plus"></i> Yangi kitob</button></div>
    <div class="hetk-book-workspace">
      <aside class="hetk-book-switcher"><div class="hetk-book-switcher-title"><b>Kitobni tanlang</b><small>Istalgan vaqtda boshqa kitobga o‘ting</small></div><select data-admin-book-select><option value="">+ Yangi kitob</option>${all.map(([id,b])=>`<option value="${id}" ${id===state.bookAdminBookId?'selected':''}>${esc(b.titleUz||'Nomsiz kitob')}</option>`).join('')}</select>
      ${book?`<div class="hetk-book-progress-card"><div><span>Tayyorlanish holati</span><b>${chapters.length?Math.round(ready/chapters.length*100):0}%</b></div><div class="hetk-book-progress"><i style="width:${chapters.length?Math.round(ready/chapters.length*100):0}%"></i></div><small>${ready}/${chapters.length} bob audiosi tayyor</small></div><div class="hetk-chapter-list"><header><b>Boblar</b><button type="button" data-new-admin-chapter><i class="fas fa-plus"></i></button></header>${chapters.length?chapters.map(([id,c])=>`<button type="button" class="${id===state.bookAdminChapterId?'is-active':''}" data-admin-chapter="${id}"><span>${Number(c.order)||'•'}</span><div><b>${esc(c.titleUz||'Nomsiz bob')}</b><small>${chapterStatus(c)} · ${c.published===true?'Ko‘rinadi':'Yashirin'}</small></div><i class="fas fa-chevron-right"></i></button>`).join(''):'<p class="hetk-book-no-chapter">Hali bob yaratilmagan.</p>'}</div>`:''}</aside>
      <form class="hetk-book-studio" data-book-form>
        <input type="hidden" name="bookId" value="${esc(state.bookAdminBookId||'')}"><input type="hidden" name="chapterId" value="${esc(state.bookAdminChapterId||'')}"><input type="hidden" name="chapterOrder" value="${order}">
        <section class="hetk-book-studio-card hetk-book-meta-card"><h4><span>1</span> Kitob ma’lumotlari</h4><div class="hetk-book-meta-layout"><div class="hetk-book-cover-editor"><div class="hetk-cover-preview">${bookCoverMarkup(book,'Muqova')}</div><label class="hetk-cover-file-button"><i class="fas fa-image"></i><span>Muqova rasmini tanlash</span><input type="file" accept="image/*" data-cover-file></label><small>Rasm to‘liq ko‘rinadi. Fayl 18 MB dan oshmasin.</small></div><div class="hetk-training-form-grid hetk-book-meta-fields"><label class="wide">Kitob nomi *<input name="title" required maxlength="180" value="${esc(d.title)}" placeholder="Masalan: Elektr qurilmalarida xavfsizlik qoidalari"></label><label>Kitob turi<select name="bookType"><option value="training" ${d.bookType==='training'?'selected':''}>O‘quv kitobi — bob testi bilan</option><option value="industry" ${d.bookType==='industry'?'selected':''}>Sohaga oid kitob — testsiz</option></select></label><label>Tur / bo‘lim<input name="category" maxlength="80" value="${esc(d.category)}" placeholder="Qo‘llanma"></label><label class="wide">Qisqa izoh<textarea name="description" rows="5" maxlength="700" placeholder="Kitob haqida qisqa ma’lumot">${esc(d.description)}</textarea></label></div></div></section>
        <section class="hetk-book-studio-card"><div class="hetk-book-card-title"><h4><span>2</span> Bob sarlavhasi va 1-mavzu matni</h4>${book?`<em>${order}-bob ustida ishlayapsiz</em>`:''}</div><div class="hetk-training-form-grid"><label class="wide">Bob sarlavhasi *<input name="chapterTitle" required maxlength="180" value="${esc(d.chapterTitle)}" placeholder="${order}-bob. Umumiy qoidalar"></label><label class="wide">1-mavzu matni (bob matni)<textarea name="sourceText" rows="5" placeholder="Bu bobning birinchi mavzusi. Keyingi mavzularni + Yangi mavzu orqali qo‘shing.">${esc(d.sourceText)}</textarea></label></div><p class="hetk-book-help"><i class="fas fa-book-open"></i> Har bir bobning boshlang‘ich matni avtomatik 1-mavzu bo‘ladi. Tayyor kitobni o‘qishda «1-mavzu» degan ortiqcha sarlavha chiqmaydi. Eski boblarning matni saqlanadi.</p></section>
        <section class="hetk-book-studio-card"><h4><span>3</span> 1-mavzu audiosi</h4>${ttsStatusHtml()}<div class="hetk-training-form-grid"><label class="wide">TTS matni *<textarea name="ttsText" rows="9" placeholder="110 kV → 110 kilovolt kabi ovozga moslashtirilgan matn...">${esc(d.ttsText)}</textarea><small>1-mavzu uchun matn. Qolgan mavzularning audiosi o‘z tahrirlash oynasida alohida yaratiladi. Har qism 18 MB dan kichik bo‘lishi tekshiriladi.</small></label></div><details class="hetk-tts-dictionary"><summary><i class="fas fa-spell-check"></i><span><b>Shu kitobning qisqartmalar lug‘ati</b><small>Yangi qisqartmalarni saytning o‘zida qo‘shish yoki o‘zgartirish</small></span><i class="fas fa-chevron-down"></i></summary><label>Har qatorga: <b>qisqartma = qanday o‘qilishi</b><textarea name="ttsDictionary" rows="8" spellcheck="false">${esc(d.ttsDictionary)}</textarea></label><small>Masalan: ATS = avtomatik telefon stansiyasi. Bu lug‘at faqat shu kitob uchun saqlanadi.</small></details><div class="hetk-tts-text-metrics" data-tts-metrics>Matn kiritilganda qismlar va taxminiy hajm shu yerda ko‘rsatiladi.</div><div class="hetk-tts-normalize-row"><button type="button" data-tts-normalize><i class="fas fa-wand-magic-sparkles"></i> TTS matnini tayyorlash</button><span>O‘lchov birliklari avtomatik ochiladi, boshqa qisqartmalar yuqoridagi lug‘atdan olinadi.</span></div><div class="hetk-tts-controls"><label>Ovoz<select name="voice">${voiceOptions(d.voice)}</select></label><label>Tezlik<select name="speed"><option value="0.9" ${d.speed==='0.9'?'selected':''}>0.9 — sekinroq</option><option value="1" ${d.speed==='1'?'selected':''}>1.0 — odatiy</option><option value="1.1" ${d.speed==='1.1'?'selected':''}>1.1 — tezroq</option></select></label><button type="button" data-tts-preview><i class="fas fa-headphones"></i> Barcha audiolarni yaratish</button><button type="button" class="hetk-tts-upload" data-tts-upload ${state.ttsParts.length?'':'disabled'}><i class="fas fa-cloud-arrow-up"></i> Barcha audiolarni yuklash</button></div><div class="hetk-tts-local-note"><i class="fas fa-computer"></i><div><b>Navoiy TTS lokal ulanishi</b><span>Qismlar taxminan 2 000 belgi atrofida muvozanatli tayyorlanadi. Juda qisqa 30–40 soniyalik bo‘laklar qolib ketmasligi uchun matn qismlarga tengroq taqsimlanadi; har bir tayyor fayl 18 MB bo‘yicha alohida tekshiriladi.</span></div></div><div class="hetk-tts-parts" data-tts-parts></div><div class="hetk-audio-upload-status ${chapterHasAudio(ch)?'is-saved':''}" data-audio-status>${chapterHasAudio(ch)?`<i class="fas fa-circle-check"></i><span><b>1-mavzuda ${chapterAudioParts(ch).length} ta audio qism saqlangan</b><small>Quyida hammasini eshitishingiz mumkin. Yangi qismlarni yuklasangiz, saqlashda shu bobning audiolari yangilanadi.</small></span>`:'<i class="fas fa-circle-info"></i><span><b>1-mavzu audiosi hali saqlanmagan</b><small>Barcha audiolarni yarating, eshitib ko‘ring va keyin yuklang.</small></span>'}</div>${chapterHasAudio(ch)?renderChapterAudioList(ch,'admin'):''}</section>
        ${renderTopicStudio(book,ch)}
        <section class="hetk-book-studio-card hetk-v12-test-editor" ${d.bookType==='industry'?'hidden':''}><div class="hetk-book-card-title"><h4><span>5</span> Bob testi</h4><em>${chapterTest.questions.length} ta savol</em></div><p class="hetk-book-help"><i class="fas fa-list-check"></i> Xodim bobni o‘qib yoki tinglab bo‘lgach shu testni yechadi. O‘tish foiziga yetmasa keyingi bob ochilmaydi.</p><div class="hetk-training-form-grid"><label>O‘tish bali (%)<input name="chapterPassPercent" type="number" min="1" max="100" value="${chapterTest.passPercent||70}"></label></div><div data-chapter-question-list>${chapterTest.questions.map((q,i)=>chapterQuestionEditor(q,i,chapterTest.questions.length)).join('')}</div><button type="button" class="hetk-training-secondary" data-add-chapter-question><i class="fas fa-plus"></i> Savol qo‘shish</button></section>
        ${book&&ch?`<section class="hetk-chapter-visibility-note"><i class="fas ${ch.published===true?'fa-eye':'fa-eye-slash'}"></i><div><b>${ch.published===true?'Bu bob xodimlarga ochilgan':'Bu bob hozir xodimlardan yashirin'}</b><span>Bob ko‘rinishini “O‘quv materiallari” bo‘limidagi boshqaruvdan alohida yoqasiz.</span></div></section>`:''}
        <footer><div><i class="fas fa-gauge-high"></i> Matn, bob va audio faqat kerak bo‘lganda yuklanadigan qilib quriladi.</div><button type="button" class="hetk-training-secondary" data-cancel-book-edit><i class="fas fa-xmark"></i> Bekor qilish</button>${book?'<button type="button" class="hetk-training-secondary" data-new-admin-chapter><i class="fas fa-plus"></i> Yangi bob</button>':''}<button class="primary" type="submit"><i class="fas fa-floppy-disk"></i> ${book&&ch?'O‘zgarishlarni saqlash':'Kitob va bobni saqlash'}</button></footer>
      </form></div>`;
  }

  function renderTests(){
    const tests=visibleTests().filter(t=>t.status!=='draft'||t.createdBy===uid()||isSuperAdmin()||(t.announcementMode==='visible'&&t.status==='draft'));
    return `<div class="hetk-training-page-head"><div><h3>Testlar markazi</h3><p>Jonli, rejalashtirilgan va yakunlangan mustaqil testlar.</p></div><div class="hetk-v8-filters"><input type="search" data-test-search placeholder="Test nomi bo‘yicha qidirish..."><select data-test-filter><option value="all">Barcha testlar</option><option value="live">Jonli</option><option value="scheduled">Rejalashtirilgan</option><option value="finished">Yakunlangan</option><option value="draft">Qoralamalar</option></select></div></div><div class="hetk-training-test-list hetk-v8-test-list">${tests.length?tests.map(testCard).join(''):empty('fa-clipboard-question','Test topilmadi','Siz uchun e’lon qilingan yoki boshlanayotgan test hozircha yo‘q.')}</div>`;
  }
  function rankOf(testId,targetUid){const rows=Object.values(state.results[testId]||{}).sort((a,b)=>(b.percent-a.percent)||((a.submittedAt||0)-(b.submittedAt||0)));const index=rows.findIndex(r=>r.uid===targetUid);return index<0?0:index+1;}
  function testCard(t){const status=statusOf(t),r=myResult(t.id),q=t.questionLimit||t.totalQuestions||0;const statusText={draft:'Qoralama',live:'Jonli',scheduled:'Rejalashtirilgan',finished:'Yakunlangan',cancelled:'Bekor qilingan'}[status]||status;return `<article class="hetk-v8-test-row" data-test-card data-status="${status}"><div class="hetk-v8-status ${status}">${statusText}</div><div class="hetk-v8-test-info"><b>${esc(t.title)}</b><small>${esc(t.category||t.topic||'Umumiy')} · ${q} savol · ${q} daqiqa · ${t.announcementMode==='hidden'?'Yashirin':'Ko‘rinadigan'}</small></div><div class="hetk-v8-test-score">${r?`${r.percent}%`:'—'}</div><button class="primary" type="button" data-open-test="${t.id}">${status==='draft'?'Mashq qilish':status==='live'?'Testga kirish':'Ko‘rish'} <i class="fas fa-arrow-right"></i></button></article>`;}

  function renderResults(){
    const rows=[];Object.entries(state.results).forEach(([testId,group])=>{const r=group&&group[uid()],t=state.tests[testId];if(r&&t)rows.push({testId,...r,title:t.title,rank:rankOf(testId,uid())});});rows.sort((a,b)=>(b.submittedAt||0)-(a.submittedAt||0));const annualRows=rows.filter(isCurrentAnnualResult),avg=annualRows.length?Math.round(annualRows.reduce((s,r)=>s+(r.percent||0),0)/annualRows.length):0;const practiceRows=Object.keys(state.practiceAttempts).flatMap(id=>practiceHistory(id,uid()).map(r=>({...r,title:(state.tests[id]||{}).title||'Mashq testi'}))).sort((a,b)=>b.submittedAt-a.submittedAt);
    return `<div class="hetk-training-page-head"><div><h3>Natijalarim</h3><p>${new Date().getFullYear()}-yil ko‘rsatkichlari va oldingi testlar tarixi.</p></div>${isSuperAdmin()?'<button class="hetk-training-secondary" type="button" data-annual-statistics><i class="fas fa-calendar-rotate"></i> Yillik statistikani boshqarish</button>':''}</div><section class="hetk-training-result-summary"><div><span>Joriy yil o‘rtachasi</span><b>${avg}%</b></div><div><span>Joriy yilda topshirilgan</span><b>${annualRows.length}</b></div><div><span>Joriy yilda muvaffaqiyatli</span><b>${annualRows.filter(r=>r.percent>=70).length}</b></div></section><div class="hetk-training-results">${rows.length?rows.map(r=>`<article><div><h4>${esc(r.title)}</h4><p>${fmt(r.submittedAt)} · ${r.correctCount}/${r.questionCount} to‘g‘ri</p></div><b>${r.percent}%</b><span>${r.rank?`${r.rank}-o‘rin`:'—'}</span><button type="button" data-open-test="${r.testId}">Ko‘rish</button></article>`).join(''):empty('fa-chart-simple','Natija hali yo‘q','Birinchi testni topshirganingizdan keyin natijalar shu yerda saqlanadi.')}</div>${practiceRows.length?`<section class="hetk-training-practice-history"><h3>Qoralama testlar — barcha urinishlarim (${practiceRows.length})</h3>${practiceRows.map((r,i)=>`<article><div><b>${esc(r.title.length>65?r.title.slice(0,65)+'…':r.title)}</b><small><i class="fas fa-clock"></i> ${fmt(r.submittedAt)} · <i class="fas fa-check-circle"></i> ${r.correctCount}/${r.questionCount} to‘g‘ri</small></div><strong>${r.percent}%</strong></article>`).join('')}</section>`:''}`;
  }

  function renderAnnualStatistics(){
    if(!isSuperAdmin())return empty('fa-lock','Ruxsat yo‘q','Yillik statistikani faqat bosh administrator boshqaradi.');
    const year=new Date().getFullYear(),regions=regionOptions(),pinReady=!!(state.adminSecurity&&state.adminSecurity.pinHash);
    return `<button class="hetk-training-back" type="button" data-back-results><i class="fas fa-arrow-left"></i> Natijalarga qaytish</button><div class="hetk-training-page-head"><div><h3>Yillik statistikani boshqarish</h3><p>Kitoblar, boblar, audio va eski natijalar o‘chmaydi. Tanlangan viloyatning yangi hisob davri noldan boshlanadi.</p></div></div>${!pinReady?`<form class="hetk-training-admin-card" data-pin-setup><h4><i class="fas fa-key"></i> Himoya kodini yaratish</h4><p>Birinchi foydalanish uchun 6 xonali maxsus kod belgilang.</p><div class="hetk-training-admin-fields"><label>Yangi kod<input name="newPin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label><label>Kodni takrorlang<input name="confirmPin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label></div><button class="primary" type="submit"><i class="fas fa-floppy-disk"></i> Kodni saqlash</button></form>`:`<form class="hetk-training-admin-card danger" data-annual-reset><h4><i class="fas fa-calendar-rotate"></i> ${year}-yil hisobini yangidan boshlash</h4><p>Oldingi ma’lumotlar tarixda qoladi. Faqat tanlangan viloyatning joriy yil ko‘rsatkichlari shu vaqtdan boshlab hisoblanadi.</p><div class="hetk-training-admin-fields"><label>Viloyat<select name="regionId" required><option value="">Viloyatni tanlang</option>${regions.map(r=>`<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('')}</select></label><label>6 xonali himoya kodi<input name="pin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" required></label></div><label class="hetk-training-confirm"><input name="confirmed" type="checkbox" required> Tanlangan viloyat statistikasi noldan boshlanishini tasdiqlayman</label><button class="danger-button" type="submit"><i class="fas fa-rotate-left"></i> Statistikani noldan boshlash</button></form><form class="hetk-training-admin-card" data-pin-change><h4><i class="fas fa-key"></i> Himoya kodini almashtirish</h4><div class="hetk-training-admin-fields three"><label>Amaldagi kod<input name="oldPin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" required></label><label>Yangi kod<input name="newPin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label><label>Yangi kodni takrorlang<input name="confirmPin" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label></div><button class="primary" type="submit">Kodni almashtirish</button></form>`}`;
  }

  function renderManage(){
    if(!canCreate())return empty('fa-lock','Ruxsat yo‘q','Test yaratish faqat viloyat va respublika TB mas’ullariga beriladi.');
    if(!state.questionDrafts.length)state.questionDrafts=[blankQuestion()];const minStart=now()+MIN_NOTICE_MS,d=state.editorDraft||{title:'',description:'',testLanguage:'uz',announcementMode:'visible',scope:isRepublic()?'republic':'regional',startAt:localInput(minStart+15*60*1000),durationMinutes:30,questionLimit:state.questionDrafts.length,audienceFolders:[],audienceRoles:[]};
    return `<div class="hetk-training-page-head"><div><h3>Yangi test yaratish</h3><p>Onlayn test kamida 2 soat oldin rejalashtiriladi.</p></div><button class="hetk-training-secondary" type="button" data-show-created>Yaratgan testlarim</button></div><form class="hetk-training-editor" data-test-form>
      <section><h4><span>1</span> Asosiy ma’lumotlar</h4><div class="hetk-training-form-grid"><label>Test nomi *<input name="title" required maxlength="120" autocomplete="off" value="${esc(d.title)}" placeholder="Masalan: Texnika xavfsizligi sinovi"></label><label>${tr('testLanguage')} *<select name="testLanguage"><option value="uz" ${d.testLanguage==='uz'?'selected':''}>${tr('uzbek')}</option><option value="ru" ${d.testLanguage==='ru'?'selected':''}>${tr('russian')}</option><option value="both" ${d.testLanguage==='both'?'selected':''}>${tr('bilingual')}</option></select></label><label>Ko‘rinishi *<select name="announcementMode"><option value="visible" ${d.announcementMode==='visible'?'selected':''}>Oldindan ko‘rinadi</option><option value="hidden" ${d.announcementMode==='hidden'?'selected':''}>Boshlanguncha yashirin</option></select></label><label class="wide">${tr('description')} *<textarea name="description" maxlength="800" rows="3" required placeholder="Testning maqsadi, mavzusi va xodim uchun ko‘rsatma">${esc(d.description)}</textarea></label></div></section>
      <section><h4><span>2</span> Kimlar qatnashadi?</h4><div class="hetk-training-form-grid"><label>Qamrov *<select name="scope" data-training-scope>${isRepublic()?`<option value="republic" ${d.scope==='republic'?'selected':''}>Butun respublika</option>`:''}<option value="regional" ${d.scope==='regional'?'selected':''}>Tanlangan hududlar</option></select></label><label>Boshlanish vaqti *<input name="startAt" type="datetime-local" required min="${localInput(minStart)}" value="${esc(d.startAt||localInput(minStart+15*60*1000))}"></label><label>Test davomiyligi *<div class="hetk-training-input-suffix"><input name="durationMinutes" type="number" min="5" max="240" value="${Number(d.durationMinutes)||30}" required><span>daqiqa</span></div></label><label>Har xodimga savollar soni *<input name="questionLimit" type="number" min="1" value="${Math.min(Number(d.questionLimit)||state.questionDrafts.length,state.questionDrafts.length)}" required></label></div>
      <div class="hetk-training-audience" data-audience-picker><div><header><b>${tr('districts')}</b><button type="button" data-check-all="audienceFolders">${tr('all')}</button></header><div class="hetk-training-choice-grid">${audienceFoldersHtml(d.audienceFolders)||'<span>Hududlar yuklanmadi</span>'}</div></div><div><header><b>${tr('positions')}</b><button type="button" data-check-all="audienceRoles">${tr('all')}</button></header><div class="hetk-training-choice-grid">${audienceRolesHtml(d.audienceRoles)}</div></div></div>
      <div class="hetk-training-audience-summary" data-audience-summary><i class="fas fa-users"></i><span>Qatnashchilar hudud va lavozim bo‘yicha tanlanadi.</span></div><div class="hetk-training-rule"><i class="fas fa-shield-halved"></i><div><b>Jonli testni birdan boshlash mumkin emas.</b><span>Boshlanish vaqti hozirgi vaqtdan kamida 2 soat keyin bo‘lishi shart. Kech kirgan xodimga qo‘shimcha vaqt berilmaydi.</span></div></div></section>
      <section><div class="hetk-training-question-head"><h4><span>3</span> Savollar banki</h4><button type="button" data-add-question><i class="fas fa-plus"></i> Savol qo‘shish</button></div><p class="hetk-training-question-note">Savollar va variantlar har bir xodimga aralash tartibda beriladi. Manba va tushuntirish faqat test yakunida ko‘rinadi.</p><div data-question-list>${state.questionDrafts.map(questionEditor).join('')}</div><button type="button" class="hetk-training-add-bottom" data-add-question><i class="fas fa-plus"></i> Yangi savol qo‘shish</button></section>
      <div class="hetk-training-form-error" data-test-error role="alert" hidden></div><footer><div><i class="fas fa-eye"></i> Yakunlagach <b>har bir savol uchun 1 daqiqadan umumiy ko‘rish vaqti</b> beriladi</div><button type="button" data-save-draft>${tr('saveDraft')}</button><button class="primary" type="submit"><i class="fas fa-calendar-check"></i> ${tr('schedule')}</button></footer></form>`;
  }
  function blankQuestion(){return {text:'',options:['','','',''],correctIndex:0,source:'',explanation:''};}
  function questionEditor(q,index){return `<article class="hetk-training-question" data-question-index="${index}"><header><b>${index+1}-${tr('question')}</b>${state.questionDrafts.length>1?'<button type="button" data-remove-question aria-label="Savolni o‘chirish"><i class="fas fa-trash"></i></button>':''}</header><label>Savol matni *<textarea data-q-text rows="2" required placeholder="Savolni kiriting...">${esc(q.text)}</textarea></label><div class="hetk-training-options">${q.options.map((o,i)=>`<label><input type="radio" name="correct_${index}" value="${i}" ${Number(q.correctIndex)===i?'checked':''}><span>${String.fromCharCode(65+i)}</span><textarea data-q-option="${i}" rows="2" required placeholder="${i+1}-javob varianti">${esc(o)}</textarea></label>`).join('')}</div><div class="hetk-training-question-extra"><label>${tr('source')}<input data-q-source autocomplete="off" value="${esc(q.source||'')}" placeholder="Kitob, qoida, band yoki havola"></label><label>${tr('explanation')}<textarea data-q-explanation rows="2" placeholder="Nima uchun shu javob to‘g‘ri ekanini qisqa tushuntiring">${esc(q.explanation||'')}</textarea></label></div></article>`;}
  function renderCreated(){const mine=Object.entries(state.tests).map(([id,t])=>({...t,id})).filter(t=>t.createdBy===uid()||isSuperAdmin()).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));return `<div class="hetk-training-page-head"><div><h3>Men yaratgan testlar</h3><p>Qoralamalar, rejalashtirilgan va yakunlangan sinovlar.</p></div><button class="hetk-training-secondary" type="button" data-new-test><i class="fas fa-plus"></i> Yangi test</button></div><div class="hetk-training-test-list">${mine.length?mine.map(t=>testCard(t).replace('</article>',`<div class="hetk-training-owner-actions"><button type="button" data-ranking="${t.id}">Statistika</button>${statusOf(t)==='draft'&&(t.createdBy===uid())?`<button type="button" data-toggle-draft="${t.id}">${t.announcementMode==='visible'?'Yashirish':'Hammaga ochish'}</button><button type="button" data-edit-test="${t.id}"><i class="fas fa-pen"></i> Tahrirlash</button>`:''}${statusOf(t)==='scheduled'?`<button type="button" data-cancel-test="${t.id}">Bekor qilish</button>`:''}</div></article>`)).join(''):empty('fa-file-circle-plus','Test yaratmagansiz','Yangi test tugmasi orqali birinchi testni yarating.')}</div>`;}

  function renderTest(){
    const t=state.tests[state.activeTestId];if(!t)return empty('fa-triangle-exclamation','Test topilmadi','Test o‘chirilgan yoki sizda ko‘rish huquqi yo‘q.');const status=statusOf(t),result=myResult(t.id);
    if(t.status==='draft'&&state.practicePreview&&state.practicePreview.testId===t.id){const x=state.practicePreview;return `<section class="hetk-training-result-hero"><div class="hetk-training-result-ring"><span>${x.percent}%</span></div><div><span>MASHQ NATIJASI</span><h3>${esc(t.title)}</h3><p>${x.correctCount}/${x.questionCount} to‘g‘ri · ${fmt(x.submittedAt)}</p><button type="button" class="hetk-training-secondary" data-back-tests>Yopish</button><button type="button" class="primary" data-retry-practice>Qayta ishlash</button></div></section>${renderPracticeReview()}`;}if(t.status!=='draft'&&result&&!state.retryLive)return renderTestResult(t,result);if(status==='scheduled')return `<button class="hetk-training-back" type="button" data-back-tests><i class="fas fa-arrow-left"></i> Testlarga qaytish</button>${empty('fa-clock',t.title,`Test ${fmt(t.startAt)} da boshlanadi. Savollar boshlanish vaqtigacha ochilmaydi.`)}`;if(status==='finished')return `<button class="hetk-training-back" type="button" data-back-tests><i class="fas fa-arrow-left"></i> Testlarga qaytish</button>${empty('fa-lock',t.title,'Test yakunlangan. Belgilangan vaqtda kirmagan xodim testni qayta yecha olmaydi.')}`;if(status!=='live'&&!canPractice(t))return `<button class="hetk-training-back" type="button" data-back-tests><i class="fas fa-arrow-left"></i> Testlarga qaytish</button>${empty('fa-file-pen',t.title,'Bu test hali e’lon qilinmagan.')}`;
    const questions=state.examQuestions.length?state.examQuestions:questionSet(t);if(!questions.length)return empty('fa-spinner fa-spin','Savollar yuklanmoqda','Test savollari xavfsiz bazadan olinmoqda.');state.examQuestions=questions;state.examIndex=Math.max(0,Math.min(state.examIndex,questions.length-1));const q=questions[state.examIndex],selected=state.examAnswers[q.id],confirmed=!!state.examConfirmed[q.id],pending=questions.filter(x=>!state.examConfirmed[x.id]).length;return `<div class="hetk-training-exam-head"><button class="hetk-training-back" type="button" data-back-tests><i class="fas fa-arrow-left"></i></button><div><span>${status==='draft'?'MASHQ TESTI':'ONLAYN TEST'}</span><h3>${esc(t.title)}</h3><p>${state.examIndex+1}/${questions.length}-${tr('question')} · ${esc(t.description||'')}</p></div><strong data-exam-countdown="${status==='draft'?state.practiceDeadline:t.endAt}">${durationText((status==='draft'?state.practiceDeadline:t.endAt)-now())}</strong></div><div class="hetk-training-exam-progress"><span style="width:${Math.round(Object.keys(state.examConfirmed).length/questions.length*100)}%"></span></div><form class="hetk-training-exam hetk-training-exam-one" data-exam-form><article data-exam-question="${q.id}" data-correct="${q.correctIndex}"><h4><span>${state.examIndex+1}</span>${esc(q.text)}</h4><div>${q.options.map(o=>`<label><input type="radio" name="answer_${q.id}" value="${o.index}" ${Number(selected)===Number(o.index)?'checked':''} ${confirmed?'disabled':''}><span>${esc(o.text)}</span></label>`).join('')}</div></article><footer class="hetk-exam-actions"><button class="hetk-training-secondary" type="button" data-exam-prev ${state.examIndex===0?'disabled':''}><i class="fas fa-arrow-left"></i> Oldingi</button><button class="hetk-training-secondary" type="button" data-exam-skip ${state.examIndex>=questions.length-1?'disabled':''}>O‘tkazib yuborish</button><button class="hetk-training-secondary" type="button" data-exam-pending>Javobsizlar (${pending})</button><button class="hetk-exam-accept" type="button" data-exam-confirm ${confirmed?'disabled':''}>${confirmed?'✓ Javob qabul qilingan':'✓ Javobni qabul qilish'}</button><button class="primary" type="button" data-exam-next>${tr('next')} <i class="fas fa-arrow-right"></i></button><button class="hetk-exam-finish" type="button" data-exam-finish>Testni yakunlash</button></footer><p class="hetk-exam-note">Tasdiqlangan javob o‘zgarmaydi. Javobsiz savollarga qaytishingiz mumkin.</p></form>`;
  }
  function renderPracticeReview(){const data=state.examReview||{},items=Object.values(data),until=state.examReviewDeadline;if(!items.length||Date.now()>=until)return '<div class="hetk-training-review-closed">Ko‘rib chiqish vaqti tugadi. Faqat natija saqlanadi.</div>';return `<div class="hetk-training-review-alert"><b>Javoblarni ko‘rib chiqish</b><strong data-review-countdown="${until}">${durationText(until-now())}</strong></div><section class="hetk-training-review">${items.map((a,i)=>`<article class="${a.correct?'correct':'wrong'}"><h4>${i+1}. ${esc(a.question)}</h4><p>Sizning javobingiz: <b>${esc(a.selectedText||'Javob berilmagan')}</b></p><p>To‘g‘ri javob: <b>${esc(a.correctText)}</b></p>${a.explanation?`<p>${esc(a.explanation)}</p>`:''}</article>`).join('')}</section>`;}
  function renderTestResult(t,r){
    const answers=state.examReview&&state.examReviewDeadline>Date.now()?state.examReview:(state.answerDetails[t.id]||{}),entries=Object.values(answers),detailsUntil=(r.submittedAt||now())+(r.questionCount||entries.length)*ANSWER_REVIEW_PER_QUESTION_MS,canReview=entries.length&&now()<detailsUntil;
    const rank=rankOf(t.id,uid())||r.rank||0;return `<button class="hetk-training-back" type="button" data-back-tests><i class="fas fa-arrow-left"></i> ${tr('back')}</button><section class="hetk-training-result-hero"><div class="hetk-training-result-ring"><span>${r.percent}%</span></div><div><span>TEST NATIJASI</span><h3>${esc(t.title)}</h3><p>${r.correctCount}/${r.questionCount} ta to‘g‘ri · ${rank?`${rank}-${tr('rank')} · `:''}${fmt(r.submittedAt)} · ${Math.max(1,liveHistory(t.id,uid()).length)} urinish</p>${statusOf(t)==='live'?`<button type="button" class="primary" data-retry-live>Qayta ishlash</button>`:''}</div></section>${canReview?`<div class="hetk-training-review-alert"><i class="fas fa-hourglass-half"></i><div><b>${entries.length} ta savol javobini ko‘rish uchun umumiy vaqt</b><span>Vaqt tugaguncha istalgan savolni qayta-qayta ko‘rishingiz mumkin.</span></div><strong data-review-countdown="${detailsUntil}">${durationText(detailsUntil-now())}</strong></div><section class="hetk-training-review">${entries.map((answer,index)=>`<article class="${answer.correct?'correct':'wrong'}"><h4><span>${index+1}</span>${esc(answer.question)}</h4><p>Sizning javobingiz: <b>${esc(answer.selectedText||'Javob berilmagan')}</b></p><p>To‘g‘ri javob: <b>${esc(answer.correctText)}</b></p>${answer.explanation?`<p class="hetk-training-answer-explanation"><i class="fas fa-circle-info"></i> ${esc(answer.explanation)}</p>`:''}${answer.source?`<p class="hetk-training-answer-source"><i class="fas fa-book"></i> Manba: ${esc(answer.source)}</p>`:''}</article>`).join('')}</section>`:`<div class="hetk-training-review-closed"><i class="fas fa-eye-slash"></i><div><b>Barcha javoblarni ko‘rish vaqti tugagan</b><span>Natijangiz saqlandi, ammo savollar va javoblar endi ko‘rsatilmaydi.</span></div></div>`}`;
  }

  function ensureOverlay(){let o=document.getElementById('hetk-training-overlay');if(o)return o;o=document.createElement('div');o.id='hetk-training-overlay';o.className='hetk-training-overlay';o.setAttribute('aria-hidden','true');document.body.appendChild(o);o.addEventListener('mousedown',e=>{if(e.target.closest('[data-topic-format],[data-topic-note],[data-float-note],[data-float-note-image]'))e.preventDefault();});o.addEventListener('mouseover',e=>{if(window.matchMedia('(hover:hover)').matches){const note=e.target.closest('[data-book-note]');if(note&&!note.closest('[contenteditable]'))showBookNote(note);}});o.addEventListener('click',handleClick);o.addEventListener('submit',handleSubmit);o.addEventListener('input',handleInput);o.addEventListener('change',handleChange);return o;}
  function open(){if(state.rankOwner&&state.rankOwner!==uid()){rankRequestToken++;state.rankOwner='';state.rankUsers={};state.rankProgress={};state.rankLoaded=false;}const o=ensureOverlay();state.activeTab='home';state.activeTestId='';o.innerHTML=shell();applyUiLanguage(o);o.classList.add('is-open');o.setAttribute('aria-hidden','false');document.body.classList.add('hetk-training-open');listen();bindDynamic();}
  function close(){rankRequestToken++;state.rankLoading=false;const o=document.getElementById('hetk-training-overlay');if(!o)return;closeBookNoteViewer();if(state.activeTab==='bookAdmin'&&!canNavigateFromAudio())return;if(typeof state.noteEditorCleanup==='function'){state.noteEditorCleanup();state.noteEditorCleanup=null;}o.classList.remove('is-open');o.setAttribute('aria-hidden','true');document.body.classList.remove('hetk-training-open');stopListeners();}
  function stopListeners(){state.listeners.forEach(({ref,fn})=>ref.off('value',fn));state.listeners=[];state.booksRealtime=false;clearInterval(state.timer);state.timer=null;}
  function onValue(path,cb){const ref=db().ref(path),fn=s=>cb(s.val()||{});ref.on('value',fn,e=>toast('Ma’lumot yuklanmadi: '+e.message,'error'));state.listeners.push({ref,fn});}
  function listen(){stopListeners();if(!db()){toast('Firebase ulanmagan.','error');return;}state.timer=setInterval(()=>{updateTimes();updateChapterQuizTime();},1000);}
  function updateChapterQuizTime(){const quiz=state.chapterQuiz,el=document.querySelector('#hetk-training-overlay [data-chapter-quiz-countdown]');if(!quiz||quiz.result||!el)return;const left=quiz.deadlineAt-now();el.textContent=durationText(left);if(left<=0)advanceChapterQuiz(true);}
  async function loadBooksOnce(){if(state.booksLoaded)return;try{const snap=await db().ref('TrainingBooks').once('value');state.books=snap.val()||{};await Promise.all([hydrateBookTestArchives(state.books),hydrateBookTopicArchives(state.books)]);state.booksLoaded=true;}catch(e){toast('Kitoblar yuklanmadi: '+e.message,'error');}}
  async function loadBookProgress(){const accountId=uid();if(!accountId||(state.bookProgressLoaded&&state.bookProgressUid===accountId))return;try{const snap=await db().ref(`TrainingBookProgress/${accountId}`).once('value');if(uid()!==accountId)return;state.bookProgress=snap.val()||{};state.bookProgressUid=accountId;state.bookProgressLoaded=true;}catch(e){toast('Kitobdagi natijalar yuklanmadi: '+e.message,'error');}}
  function startBooksRealtime(){if(state.booksRealtime||!db())return;const ref=db().ref('TrainingBooks'),fn=async snap=>{const books=snap.val()||{};await Promise.all([hydrateBookTestArchives(books),hydrateBookTopicArchives(books)]);state.books=books;state.booksLoaded=true;if(state.activeTab==='books'||state.activeTab==='bookAdmin'||state.activeBookId)repaint();};ref.on('value',fn,e=>toast('Kitoblar jonli yangilanmadi: '+e.message,'error'));state.listeners.push({ref,fn});state.booksRealtime=true;}
  async function loadTestsOnce(){if(state.testsLoaded)return;try{const t=await db().ref('TrainingTests').once('value');state.tests=t.val()||{};state.testsLoaded=true;}catch(e){toast('Testlar yuklanmadi: '+e.message,'error');return;}const [r,a]=await Promise.allSettled([db().ref('TrainingResults').once('value'),db().ref(`TrainingTestAccessByUser/${uid()}`).once('value')]);if(r.status==='fulfilled'){state.results=r.value.val()||{};state.resultsLoaded=true;}else toast('Natijalar yuklanmadi: '+r.reason.message,'error');if(a.status==='fulfilled')state.access=a.value.val()||{};await loadPracticeAttempts();repaint();}
  async function loadPracticeAttempts(){if(state.practiceLoaded)return;state.practiceLoaded=true;const tests=visibleTests();for(let i=0;i<tests.length;i+=10){await Promise.all(tests.slice(i,i+10).map(async t=>{const mine=t.createdBy===uid()||isSuperAdmin(),path=mine?t.id:`${t.id}/${uid()}`;for(const [node,key] of [['TrainingPracticeAttempts','practiceAttempts'],['TrainingLiveAttempts','liveAttempts']]){try{const snap=await db().ref(`${node}/${path}`).once('value'),data=snap.val()||{};state[key][t.id]=mine?data:{[uid()]:data};}catch(err){console.warn('Test urinishlari yuklanmadi',t.id,err);}}}));}}
  async function ensureTabData(tab){if(tab==='books'||tab==='bookAdmin'){await Promise.all([loadBooksOnce(),loadBookProgress()]);startBooksRealtime();}if(tab==='readingRank'&&canViewReadingRanking()){await loadReadingRanking();startBooksRealtime();}if(tab==='tests'||tab==='results'||tab==='manage'||tab==='annual')await loadTestsOnce();}
  async function loadQuestionBank(testId){if(state.questionBanks[testId])return;try{const test=state.tests[testId]||{};if(test.questionArchive&&test.questionArchive.fileId){const data=await readTrainingJson(test.questionArchive),rows=Array.isArray(data.questions)?data.questions:Object.values(data.questions||{});state.questionBanks[testId]=rows.reduce((out,q,i)=>(out[`q${i+1}`]=q,out),{});}else{const snap=await db().ref(`TrainingQuestionBanks/${testId}`).once('value');state.questionBanks[testId]=snap.val()||{};}repaint();}catch(err){toast('Savollar Telegram arxividan ochilmadi: '+err.message,'error');}}
  async function loadAnswerDetails(testId){if(state.answerDetails[testId])return;try{const snap=await db().ref(`TrainingResultAnswers/${testId}/${uid()}`).once('value');state.answerDetails[testId]=snap.val()||{};repaint();}catch(err){toast('Javoblar ochilmadi: '+err.message,'error');}}
  function updateTimes(){let refresh=false;document.querySelectorAll('#hetk-training-overlay [data-countdown]').forEach(el=>{const left=Number(el.dataset.countdown)-now();el.textContent=durationText(left);if(left<=0&&el.dataset.expiredHandled!=='1'){el.dataset.expiredHandled='1';if(state.activeTestId&&state.tests[state.activeTestId]&&state.tests[state.activeTestId].status!=='draft')refresh=true;}});document.querySelectorAll('#hetk-training-overlay [data-exam-countdown]').forEach(el=>{const left=Number(el.dataset.examCountdown)-now();el.textContent=durationText(left);if(left<=0&&state.examQuestions.length&&!state.examSubmitting)submitExam(null,true);});document.querySelectorAll('#hetk-training-overlay [data-review-countdown]').forEach(el=>{const left=Number(el.dataset.reviewCountdown)-now();el.textContent=durationText(left);if(left<=0&&el.dataset.reviewExpired!=='1'){el.dataset.reviewExpired='1';refresh=true;}});document.querySelectorAll('#hetk-training-overlay [data-chapter-lock-countdown]').forEach(el=>{const left=Number(el.dataset.chapterLockCountdown)-now();el.textContent=durationText(Math.max(0,left));if(left<=0)refresh=true;});if(refresh)repaint();}
  // V15: havolali izohlar matnda saqlanadi, audio va TTS sozlamalariga ta'sir qilmaydi.
  function cleanupNoteEditor(){
    const root=document.querySelector('#hetk-training-overlay');
    root&&root.querySelector('.hetk-v15-note-editor')?.remove();
    if(typeof state.noteEditorCleanup==='function'){try{state.noteEditorCleanup();}catch(_){ }state.noteEditorCleanup=null;}
  }
  function attachSelectedBookNote(editor,options={}){
    const selection=window.getSelection();
    if(!editor||!selection||!selection.rangeCount||selection.isCollapsed||!editor.contains(selection.anchorNode)||!editor.contains(selection.focusNode))return toast('Avval izoh biriktiriladigan matnni belgilang.','warning');
    openBookNoteEditor({editor,range:selection.getRangeAt(0).cloneRange(),preferImage:false,onSync:options.onSync||null});
  }
  function openBookNoteEditor({editor,range=null,node=null,preferImage=false,onSync=null}={}){
    if(!editor)return;
    const root=document.querySelector('#hetk-training-overlay');if(!root)return;
    cleanupNoteEditor();
    const target=node||null;
    let workRange=null;
    if(target){
      workRange=document.createRange();workRange.selectNodeContents(target);
    }else if(range&&editor.contains(range.commonAncestorContainer)){
      workRange=range.cloneRange();
    }
    const label=(target?target.textContent:(workRange&&workRange.toString()))||'';
    const trimmedLabel=label.trim();
    if(!target&&!trimmedLabel)return toast('Matnni belgilang.','warning');
    const currentNote=target?(target.getAttribute('data-book-note')||''):'';
    const currentImage=target?(target.getAttribute('data-book-note-image')||''):'';
    const popup=document.createElement('section');
    popup.className='hetk-v15-note-editor';
    popup.innerHTML=`<div class="hetk-v15-note-editor-head"><div><strong>${target?'Izohni tahrirlash':'Matnga izoh biriktirish'}</strong><small>${target?'Izoh matni va rasmni o‘zgartirishingiz mumkin':'Belgilangan matnga izoh, rasm yoki ikkisini ham biriktiring'}</small></div><button type="button" class="close" data-note-editor-close aria-label="Yopish">×</button></div><div class="hetk-v15-note-editor-body"><label class="hetk-v15-note-label"><span>Belgilangan matn</span><div class="hetk-v15-note-selected">${esc(trimmedLabel||'Tanlangan matn')}</div></label><label class="hetk-v15-note-label"><span>Izoh matni</span><textarea data-note-editor-text rows="4" placeholder="Masalan: shu bandga oid qo‘shimcha tushuntirish kiriting...">${esc(currentNote)}</textarea></label><div class="hetk-v15-note-upload"><div><span>Izoh rasmi</span><small>Kompyuterda sichqoncha olib borganda, telefonda bosilganda ko‘rinadi.</small></div><div class="actions"><button type="button" data-note-editor-pick><i class="fas fa-image"></i> ${currentImage?'Rasmni almashtirish':'Rasm qo‘shish'}</button>${currentImage?'<button type="button" class="danger" data-note-editor-remove-image><i class="fas fa-trash"></i> Rasmni olib tashlash</button>':''}</div><input type="file" accept="image/*" data-note-editor-file hidden><div class="hetk-v15-note-preview ${currentImage?'has-image':''}" data-note-editor-preview>${currentImage?`<img data-training-media-file="${esc(currentImage)}" alt="Izoh rasmi">`:'<div class="placeholder"><i class="fas fa-image"></i><span>Hozircha rasm biriktirilmagan</span></div>'}</div></div><div class="hetk-v15-note-actions"><button type="button" class="secondary" data-note-editor-cancel>Bekor qilish</button>${target?'<button type="button" class="danger" data-note-editor-delete>Izohni o‘chirish</button>':''}<button type="button" class="primary" data-note-editor-save>${preferImage?'Rasmli izohni saqlash':'Saqlash'}</button></div></div>`;
    root.appendChild(popup);
    hydrateTrainingMedia(popup);
    const textField=popup.querySelector('[data-note-editor-text]');
    const preview=popup.querySelector('[data-note-editor-preview]');
    const fileInput=popup.querySelector('[data-note-editor-file]');
    let pendingFile=null,removeImage=false,currentImageId=currentImage||'';
    const renderPreview=src=>{
      if(src==='__removed__'){preview.classList.remove('has-image');preview.innerHTML='<div class="placeholder"><i class="fas fa-image"></i><span>Rasm olib tashlanadi</span></div>';return;}
      if(src instanceof File){const url=URL.createObjectURL(src);preview.classList.add('has-image');preview.innerHTML=`<img src="${url}" alt="Yangi izoh rasmi">`;preview._tempUrl&&URL.revokeObjectURL(preview._tempUrl);preview._tempUrl=url;return;}
      if(typeof src==='string'&&src){preview.classList.add('has-image');preview.innerHTML=`<img data-training-media-file="${esc(src)}" alt="Izoh rasmi">`;hydrateTrainingMedia(preview);return;}
      preview.classList.remove('has-image');preview.innerHTML='<div class="placeholder"><i class="fas fa-image"></i><span>Hozircha rasm biriktirilmagan</span></div>';
    };
    const closePopup=()=>{if(typeof state.noteEditorCleanup==='function'){try{state.noteEditorCleanup();}catch(_){ }state.noteEditorCleanup=null;}if(preview._tempUrl)URL.revokeObjectURL(preview._tempUrl);popup.remove();};
    const anchorRect=(target||workRange).getBoundingClientRect();
    const popupRect=()=>{const r=popup.getBoundingClientRect(),left=Math.max(10,Math.min(window.innerWidth-r.width-10,anchorRect.left+(anchorRect.width/2)-(r.width/2))),top=Math.max(14,Math.min(window.innerHeight-r.height-14,anchorRect.bottom+14));popup.style.left=left+'px';popup.style.top=top+'px';};
    requestAnimationFrame(()=>{popupRect();if(preferImage)popup.querySelector('[data-note-editor-pick]')?.focus();else textField?.focus();textField?.setSelectionRange(textField.value.length,textField.value.length);});
    const saveNode=async()=>{
      const noteText=(textField.value||'').trim();
      if(!noteText&&!currentImageId&&!pendingFile&&!removeImage)return toast('Kamida izoh matni yoki rasm bo‘lishi kerak.','warning');
      let finalImage=currentImageId;
      if(removeImage){finalImage='';}
      if(pendingFile){
        if(pendingFile.size>TRAINING_MEDIA_MAX_BYTES)return toast('Rasm 18 MB dan katta.','error');
        try{
          toast('Izoh rasmi media kanaliga yuklanmoqda...');
          const uploaded=await trainingMediaUpload(pendingFile,'image',state.bookAdminBookId||'new-book',state.bookAdminTopicId||state.bookAdminChapterId||'new-chapter','HETK — matnga biriktirilgan izoh rasmi');
          finalImage=uploaded.fileId;
        }catch(err){return toast('Rasm yuklanmadi: '+err.message,'error');}
      }
      try{
        let noteNode=target;
        if(!noteNode){
          noteNode=document.createElement('span');
          noteNode.className='hetk-v15-book-note';
          noteNode.setAttribute('tabindex','0');
          noteNode.setAttribute('role','button');
          noteNode.title='Izohni ochish';
          noteNode.textContent=trimmedLabel;
          workRange.deleteContents();
          workRange.insertNode(noteNode);
        }
        noteNode.className='hetk-v15-book-note';
        noteNode.setAttribute('tabindex','0');
        noteNode.setAttribute('role','button');
        noteNode.title='Izohni ochish';
        if(noteText)noteNode.setAttribute('data-book-note',noteText);else noteNode.removeAttribute('data-book-note');
        if(finalImage)noteNode.setAttribute('data-book-note-image',finalImage);else noteNode.removeAttribute('data-book-note-image');
        if(!noteText&&!finalImage){noteNode.replaceWith(document.createTextNode(noteNode.textContent||trimmedLabel));}
        if(onSync)onSync();
        editor.dispatchEvent(new Event('input',{bubbles:true}));
        toast(target?'Izoh yangilandi.':'Izoh biriktirildi.','success');
        closePopup();
      }catch(err){toast('Izoh saqlanmadi: '+err.message,'error');}
    };
    popup.addEventListener('click',e=>{
      if(e.target.closest('[data-note-editor-close],[data-note-editor-cancel]')){closePopup();return;}
      if(e.target.closest('[data-note-editor-pick]')){fileInput.click();return;}
      if(e.target.closest('[data-note-editor-remove-image]')){pendingFile=null;removeImage=true;currentImageId='';renderPreview('__removed__');popup.querySelector('[data-note-editor-remove-image]')?.remove();const pick=popup.querySelector('[data-note-editor-pick]');if(pick)pick.innerHTML='<i class="fas fa-image"></i> Rasm qo‘shish';return;}
      if(e.target.closest('[data-note-editor-delete]')){if(!target)return;target.replaceWith(document.createTextNode(target.textContent||''));if(onSync)onSync();editor.dispatchEvent(new Event('input',{bubbles:true}));toast('Izoh o‘chirildi.','success');closePopup();return;}
      if(e.target.closest('[data-note-editor-save]')){saveNode();return;}
    });
    fileInput.addEventListener('change',()=>{const file=fileInput.files&&fileInput.files[0];if(!file)return;pendingFile=file;removeImage=false;renderPreview(file);const actions=popup.querySelector('.hetk-v15-note-upload .actions');if(actions&&!actions.querySelector('[data-note-editor-remove-image]')){const btn=document.createElement('button');btn.type='button';btn.className='danger';btn.setAttribute('data-note-editor-remove-image','');btn.innerHTML='<i class="fas fa-trash"></i> Rasmni olib tashlash';actions.appendChild(btn);}const pick=popup.querySelector('[data-note-editor-pick]');if(pick)pick.innerHTML='<i class="fas fa-image"></i> Rasmni almashtirish';});
    const outside=e=>{if(popup.contains(e.target))return;const active=window.getSelection();if(active&&active.rangeCount&&editor.contains(active.anchorNode)&&editor.contains(active.focusNode))return;closePopup();};
    document.addEventListener('mousedown',outside,true);
    const reposition=()=>popup.isConnected&&popupRect();
    addEventListener('resize',reposition);addEventListener('scroll',reposition,true);
    state.noteEditorCleanup=()=>{document.removeEventListener('mousedown',outside,true);removeEventListener('resize',reposition);removeEventListener('scroll',reposition,true);if(preview._tempUrl)URL.revokeObjectURL(preview._tempUrl);};
  }
  // Izohdagi surat faqat izoh oynasi DOM ga qo‘shilgandan SO‘NG yuklanishi kerak.
  // Oldingi kodda hydrateTrainingMedia() oynani qo‘shishdan oldin chaqirilgan;
  // natijada rasm qidiruvda topilmagan va "Izoh rasmi" singan belgisi chiqqan.
  async function loadBookNoteImage(popup,forceRetry=false){
    if(!popup||!popup.isConnected)return;
    const fileId=popup.dataset.noteImage,photo=popup.querySelector('[data-book-note-preview]'),status=popup.querySelector('[data-book-note-image-status]');
    if(!fileId||!photo||!status)return;
    const request=(Number(popup.dataset.imageRequest)||0)+1;
    popup.dataset.imageRequest=String(request);
    photo.hidden=true;
    const zoomBtn=popup.querySelector('[data-v27-open-viewer]');if(zoomBtn)zoomBtn.disabled=true;
    status.hidden=false;
    status.innerHTML='<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Rasm yuklanmoqda...</span>';
    try{
      // Qayta urinishda eskirgan blob URL ishlatilmaydi, lekin boshqa joyda ochiq
      // bo‘lgan rasmning mavjud object URL i bekor qilinmaydi.
      if(forceRetry)delete state.mediaObjectUrls[fileId];
      const url=await trainingMediaObjectUrl(fileId);
      if(!popup.isConnected||popup.dataset.imageRequest!==String(request))return;
      photo.onload=()=>{
        if(!popup.isConnected||popup.dataset.imageRequest!==String(request))return;
        photo.hidden=false;
        status.hidden=true;
        const btn=popup.querySelector('[data-v27-open-viewer]');if(btn)btn.disabled=false;
        positionBookNote(popup);
      };
      photo.onerror=()=>{
        if(!popup.isConnected||popup.dataset.imageRequest!==String(request))return;
        photo.hidden=true;
        status.hidden=false;
        status.innerHTML='<i class="fas fa-image" aria-hidden="true"></i><span>Rasm ochilmadi.</span><button type="button" data-retry-book-note-image><i class="fas fa-rotate-right" aria-hidden="true"></i> Qayta yuklash</button>';
      };
      photo.src=url;
    }catch(err){
      if(!popup.isConnected||popup.dataset.imageRequest!==String(request))return;
      photo.hidden=true;
      status.hidden=false;
      status.innerHTML='<i class="fas fa-triangle-exclamation" aria-hidden="true"></i><span>Rasm yuklanmadi: '+esc(err&&err.message||'Noma’lum xato')+'</span><button type="button" data-retry-book-note-image><i class="fas fa-rotate-right" aria-hidden="true"></i> Qayta yuklash</button>';
    }
  }
  // V27: izohdagi rasmni o‘qish uchun kattalashtirish. O‘quvchi matni o‘zgarmaydi.
  function positionBookNote(popup){
    if(!popup||!popup.isConnected)return;
    const node=popup._bookNoteAnchor;
    if(!node||!node.isConnected)return;
    if(window.matchMedia('(max-width:640px)').matches){
      popup.style.left='50%';popup.style.top='50%';return;
    }
    const rect=node.getBoundingClientRect(),width=popup.offsetWidth||330,height=popup.offsetHeight||120;
    const vw=window.innerWidth,vh=window.innerHeight;
    const x=Math.max(12,Math.min(vw-width-12,rect.left));
    const y=rect.bottom+12+height<=vh-12?rect.bottom+12:
      rect.top-12-height>=12?rect.top-12:Math.max(12,Math.min(vh-height-12,rect.bottom+12));
    popup.style.left=x+'px';popup.style.top=y+'px';
  }
  function closeBookNoteViewer(){
    const root=document.querySelector('#hetk-training-overlay');
    const viewer=root&&root.querySelector('.hetk-v27-image-viewer');
    if(viewer&&typeof viewer._close==='function')viewer._close();
    else viewer?.remove();
  }
  function openBookNoteViewer(popup){
    if(!popup||!popup.isConnected)return;
    const preview=popup.querySelector('[data-book-note-preview]');
    if(!preview||!preview.complete||!preview.naturalWidth){toast('Rasm yuklanishini kuting.','warning');return;}
    const root=document.querySelector('#hetk-training-overlay');if(!root)return;
    closeBookNoteViewer();
    const viewer=document.createElement('div');
    viewer.className='hetk-v27-image-viewer';viewer.setAttribute('role','dialog');
    viewer.setAttribute('aria-modal','true');viewer.setAttribute('aria-label','Izoh rasmini kattalashtirib ko‘rish');viewer.tabIndex=-1;
    viewer.innerHTML=`<div class="hetk-v27-viewer-head"><div class="hetk-v27-viewer-name"><i class="fas fa-image" aria-hidden="true"></i><span>Izoh rasmi <small>Kattalashtirish va surish</small></span></div><div class="hetk-v27-viewer-tools"><button type="button" data-v27-zoom-out title="Kichraytirish" aria-label="Kichraytirish"><i class="fas fa-minus"></i></button><output data-v27-zoom-label aria-live="off">100%</output><button type="button" data-v27-zoom-in title="Kattalashtirish" aria-label="Kattalashtirish"><i class="fas fa-plus"></i></button><button type="button" class="fit" data-v27-fit title="Rasmni ekranga moslash"><i class="fas fa-expand-arrows-alt"></i><span>Sig‘dirish</span></button><button type="button" class="close" data-v27-close title="Yopish" aria-label="Rasm oynasini yopish"><i class="fas fa-times"></i></button></div></div><div class="hetk-v27-viewer-stage" data-v27-stage aria-label="Rasm. Kattalashtirgach surishingiz mumkin"><img draggable="false" alt="Kattalashtirilgan izoh rasmi" data-v27-photo></div><div class="hetk-v27-viewer-foot"><i class="fas fa-hand-pointer" aria-hidden="true"></i><span>Kompyuterda: g‘ildirak bilan kattalashtiring, sichqoncha bilan suring. Telefonda: ikki barmoq bilan kattalashtiring va suring.</span></div>`;
    root.appendChild(viewer);
    const stage=viewer.querySelector('[data-v27-stage]'),photo=viewer.querySelector('[data-v27-photo]');
    const zoomLabel=viewer.querySelector('[data-v27-zoom-label]');
    const naturalWidth=preview.naturalWidth,naturalHeight=preview.naturalHeight;
    const pointers=new Map();
    let zoom=1,panX=0,panY=0,closed=false;
    const LIMIT=12;
    const baseScale=()=>Math.min(stage.clientWidth/naturalWidth,stage.clientHeight/naturalHeight);
    const update=()=>{
      if(closed||!stage.isConnected)return;
      zoom=Math.max(1,Math.min(LIMIT,zoom));
      const actualScale=baseScale()*zoom;
      const maxX=Math.max(0,(naturalWidth*actualScale-stage.clientWidth)/2);
      const maxY=Math.max(0,(naturalHeight*actualScale-stage.clientHeight)/2);
      panX=Math.max(-maxX,Math.min(maxX,panX));panY=Math.max(-maxY,Math.min(maxY,panY));
      photo.style.width=naturalWidth+'px';photo.style.height=naturalHeight+'px';
      photo.style.transform=`translate(-50%,-50%) translate(${panX}px,${panY}px) scale(${actualScale})`;
      zoomLabel.textContent=Math.round(zoom*100)+'%';
      viewer.querySelector('[data-v27-zoom-out]').disabled=zoom<=1.001;
      viewer.querySelector('[data-v27-zoom-in]').disabled=zoom>=LIMIT-.001;
      stage.classList.toggle('is-zoomed',zoom>1.001);
    };
    const zoomTo=(value,x=null,y=null)=>{
      const next=Math.max(1,Math.min(LIMIT,value)),previous=zoom;
      if(x!==null&&y!==null&&previous){
        const r=stage.getBoundingClientRect(),pointX=x-r.left-r.width/2,pointY=y-r.top-r.height/2,k=next/previous;
        panX=pointX-(pointX-panX)*k;panY=pointY-(pointY-panY)*k;
      }else if(next<=1.001){panX=0;panY=0;}
      zoom=next;update();
    };
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
    const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    const handlePointerDown=e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      e.preventDefault();try{stage.setPointerCapture?.(e.pointerId);}catch(_){ }
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    };
    const handlePointerMove=e=>{
      if(!pointers.has(e.pointerId))return;
      const old=new Map(pointers);
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size>=2){
        const keys=[...pointers.keys()].slice(0,2),before=[old.get(keys[0]),old.get(keys[1])],after=[pointers.get(keys[0]),pointers.get(keys[1])];
        if(before[0]&&before[1]){
          const prevDist=distance(before[0],before[1]),nextDist=distance(after[0],after[1]);
          const oldCenter=midpoint(before[0],before[1]),newCenter=midpoint(after[0],after[1]);
          panX+=newCenter.x-oldCenter.x;panY+=newCenter.y-oldCenter.y;
          if(prevDist>0)zoomTo(zoom*nextDist/prevDist,newCenter.x,newCenter.y);else update();
        }
      }else{
        const prev=old.get(e.pointerId);if(!prev)return;
        panX+=e.clientX-prev.x;panY+=e.clientY-prev.y;update();
      }
    };
    const handlePointerUp=e=>{pointers.delete(e.pointerId);try{stage.releasePointerCapture?.(e.pointerId);}catch(_){}};
    const handleWheel=e=>{e.preventDefault();zoomTo(zoom*(e.deltaY<0?1.25:1/1.25),e.clientX,e.clientY);};
    const handleDouble=e=>{e.preventDefault();zoomTo(zoom>1.5?1:2.5,e.clientX,e.clientY);};
    const handleKeyboard=e=>{
      if(closed||!viewer.isConnected)return;
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeViewer();return;}
      if(e.key==='+'||e.key==='='){e.preventDefault();zoomTo(zoom*1.25);}
      else if(e.key==='-'||e.key==='_'){e.preventDefault();zoomTo(zoom/1.25);}
      else if(e.key==='0'){e.preventDefault();zoomTo(1);}
      else if(e.key==='ArrowUp'||e.key==='ArrowDown'||e.key==='ArrowLeft'||e.key==='ArrowRight'){
        e.preventDefault();const step=72;if(e.key==='ArrowUp')panY+=step;if(e.key==='ArrowDown')panY-=step;if(e.key==='ArrowLeft')panX+=step;if(e.key==='ArrowRight')panX-=step;update();
      }
    };
    const resize=()=>update();
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(resize):null;
    const closeViewer=()=>{
      if(closed)return;closed=true;observer?.disconnect();window.removeEventListener('resize',resize);
      document.removeEventListener('keydown',handleKeyboard,true);
      viewer.remove();
      if(popup.isConnected)popup.querySelector('[data-v27-open-viewer]')?.focus({preventScroll:true});
    };
    viewer._close=closeViewer;
    stage.addEventListener('pointerdown',handlePointerDown);
    stage.addEventListener('pointermove',handlePointerMove);
    stage.addEventListener('pointerup',handlePointerUp);
    stage.addEventListener('pointercancel',handlePointerUp);
    stage.addEventListener('wheel',handleWheel,{passive:false});
    stage.addEventListener('dblclick',handleDouble);
    viewer.addEventListener('click',e=>{
      e.stopPropagation();
      if(e.target.closest('[data-v27-close]')){closeViewer();return;}
      if(e.target.closest('[data-v27-zoom-in]')){zoomTo(zoom*1.5);return;}
      if(e.target.closest('[data-v27-zoom-out]')){zoomTo(zoom/1.5);return;}
      if(e.target.closest('[data-v27-fit]')){zoomTo(1);return;}
    });
    document.addEventListener('keydown',handleKeyboard,true);
    window.addEventListener('resize',resize);
    observer?.observe(stage);
    photo.src=preview.currentSrc||preview.src;
    update();viewer.focus({preventScroll:true});
  }
  function showBookNote(node){
    const root=document.querySelector('#hetk-training-overlay');if(!root||!node)return;
    let popup=root.querySelector('.hetk-v15-note-popup');
    // Hover hodisasi bir xil matnda qayta-qayta ishlashi mumkin.
    // Mavjud oynani buzib qayta yaratmaymiz, ayniqsa surat yuklanayotganida.
    if(popup&&popup._bookNoteAnchor===node)return;
    if(popup)popup.remove();
    popup=document.createElement('div');popup.className='hetk-v15-note-popup';
    popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Kitob matniga biriktirilgan izoh');
    popup._bookNoteAnchor=node;
    const note=node.getAttribute('data-book-note')||'';
    const file=node.getAttribute('data-book-note-image')||'';
    popup.innerHTML='<button type="button" data-close-book-note aria-label="Izohni yopish">×</button>';
    if(note){const content=document.createElement('div');content.className='hetk-v15-note-body';content.textContent=note;popup.appendChild(content);}
    if(file){
      popup.dataset.noteImage=file;
      const media=document.createElement('div');media.className='hetk-v15-note-media';
      const img=document.createElement('img');img.setAttribute('data-book-note-preview','');img.alt='Izoh rasmi';img.setAttribute('tabindex','0');img.setAttribute('role','button');img.setAttribute('aria-label','Rasmni kattalashtirib ko‘rish');img.hidden=true;
      img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openBookNoteViewer(popup);}});
      const status=document.createElement('div');status.className='hetk-v15-note-image-status';status.setAttribute('data-book-note-image-status','');
      media.appendChild(img);media.appendChild(status);popup.appendChild(media);
      const actions=document.createElement('div');actions.className='hetk-v27-preview-actions';
      actions.innerHTML='<button type="button" data-v27-open-viewer disabled title="Rasmni kattalashtirib ko‘rish"><i class="fas fa-expand" aria-hidden="true"></i> Kattalashtirib ko‘rish</button>';
      popup.appendChild(actions);
    }
    root.appendChild(popup); // Dastlab sahifaga joylanadi, keyin rasm yuklanadi.
    positionBookNote(popup);
    if(file)loadBookNoteImage(popup);
  }
  function handleClick(e){
    const openNoteViewer=e.target.closest('[data-v27-open-viewer],[data-book-note-preview]');
    if(openNoteViewer){e.preventDefault();e.stopPropagation();openBookNoteViewer(openNoteViewer.closest('.hetk-v15-note-popup'));return;}
    const retryNoteImage=e.target.closest('[data-retry-book-note-image]');
    if(retryNoteImage){e.preventDefault();loadBookNoteImage(retryNoteImage.closest('.hetk-v15-note-popup'),true);return;}
    if(e.target.closest('[data-close-book-note]')){e.target.closest('.hetk-v15-note-popup')?.remove();return;}
    const bookNote=e.target.closest('[data-book-note],[data-book-note-image]');if(bookNote&&bookNote.closest('[contenteditable]')){openBookNoteEditor({editor:bookNote.closest('[contenteditable]'),node:bookNote,preferImage:!!bookNote.getAttribute('data-book-note-image')});return;}if(bookNote&&!bookNote.closest('[contenteditable]')){showBookNote(bookNote);return;}
    const imageNote=e.target.closest('[data-topic-note-image]');if(imageNote){const row=imageNote.closest('[data-topic-block]'),editor=row?.querySelector('[data-block-rich]'),selection=window.getSelection();if(!editor||!selection||selection.isCollapsed||!editor.contains(selection.anchorNode)||!editor.contains(selection.focusNode))return toast('Avval rasm biriktiriladigan matnni belgilang.','warning');openBookNoteEditor({editor,range:selection.getRangeAt(0).cloneRange(),preferImage:true});return;}
    const topicNote=e.target.closest('[data-topic-note]');if(topicNote){const row=topicNote.closest('[data-topic-block]');attachSelectedBookNote(row?.querySelector('[data-block-rich]'));return;}
    const topicFormat=e.target.closest('[data-topic-format]');if(topicFormat){const editor=topicFormat.closest('[data-topic-block]')?.querySelector('[data-block-rich]');if(editor){editor.focus();document.execCommand(topicFormat.dataset.topicFormat,false,null);editor.dispatchEvent(new Event('input',{bubbles:true}));}return;}
    const readerTopic=e.target.closest('[data-reader-topic]');if(readerTopic){state.activeTopicId=readerTopic.dataset.readerTopic;repaint();return;}
    const readerEdition=e.target.closest('[data-reader-edition]');if(readerEdition){state.readerEdition=readerEdition.dataset.readerEdition==='cyrillic'?'cyrillic':'latin';localStorage.setItem('hetkReaderEdition',state.readerEdition);repaint();return;}
    if(e.target.closest('[data-cancel-book-edit]')){if(!canNavigateFromAudio())return;state.bookAdminNewMode=false;state.bookAdminNewChapterMode=false;state.bookDraft=null;state.topicDraft=null;state.topicDraftKey='';state.topicDraftCache={};state.chapterTestDraft=null;state.chapterTestDraftKey='';revokeTtsParts();state.activeTab='books';repaint();return;}
    if(e.target.closest('[data-new-topic]')){
      e.preventDefault();switchAdminTopic('__new__');return;
    }
    if(e.target.closest('[data-admin-primary-topic]')){e.preventDefault();if(state.bookAdminTopicId!==PRIMARY_BOOK_TOPIC){switchAdminTopic(PRIMARY_BOOK_TOPIC);}requestAnimationFrame(()=>{const target=document.querySelector('#hetk-training-overlay .hetk-rich-editor-wrap')||document.querySelector('#hetk-training-overlay [name="sourceText"]');if(target){target.scrollIntoView({behavior:'smooth',block:'center'});}});return;}
    const deleteBookTopicButton=e.target.closest('[data-delete-book-topic]');if(deleteBookTopicButton){e.preventDefault();e.stopPropagation();openDeleteBookTopicDialog(deleteBookTopicButton.dataset.deleteBookTopic);return;}
    const adminTopic=e.target.closest('[data-admin-topic]');if(adminTopic){
      e.preventDefault();switchAdminTopic(adminTopic.dataset.adminTopic);return;
    }
    const topicEdition=e.target.closest('[data-topic-edition]');if(topicEdition){syncTopicDraft();state.topicEdition=topicEdition.dataset.topicEdition==='cyrillic'?'cyrillic':'latin';repaint();return;}
    const addTopicBlock=e.target.closest('[data-add-topic-block]');if(addTopicBlock){syncTopicDraft();const type=addTopicBlock.dataset.addTopicBlock||'paragraph',blocks=state.topicDraft.editions[state.topicEdition].blocks;blocks.push(type==='image'?{type:'image',layout:'auto',caption:''}:blankTextBlock(type));repaint();return;}
    const removeTopicBlock=e.target.closest('[data-remove-topic-block]');if(removeTopicBlock){syncTopicDraft();const row=removeTopicBlock.closest('[data-topic-block]'),blocks=state.topicDraft.editions[state.topicEdition].blocks,index=Number(row.dataset.topicBlock),removed=blocks[index];if(removed&&removed.messageId)state.topicRemovedMedia.push(removed.messageId);blocks.splice(index,1);repaint();return;}
    const moveTopicBlock=e.target.closest('[data-move-topic-block]');if(moveTopicBlock){syncTopicDraft();const row=moveTopicBlock.closest('[data-topic-block]'),blocks=state.topicDraft.editions[state.topicEdition].blocks,index=Number(row.dataset.topicBlock),next=moveTopicBlock.dataset.moveTopicBlock==='up'?index-1:index+1;if(next>=0&&next<blocks.length)[blocks[index],blocks[next]]=[blocks[next],blocks[index]];repaint();return;}
    if(e.target.closest('[data-topic-tts-preview]')){if(state.ttsOnline!==true)return toast('Avval Navoiy TTS serverini yoqing.','error');previewTopicTts();return;}
    if(e.target.closest('[data-save-topic]')){saveTopic();return;}
    if(e.target.closest('[data-start-chapter-quiz]')){startChapterQuiz();return;}
    if(e.target.closest('[data-chapter-quiz-next]')){advanceChapterQuiz(false);return;}
    if(e.target.closest('[data-retry-chapter-quiz]')){startChapterQuiz();return;}
    if(e.target.closest('[data-close-chapter-quiz]')){state.chapterQuiz=null;repaint();return;}
    if(e.target.closest('[data-reader-open-next]')){openNextReaderChapter();return;}
    if(e.target.closest('[data-tts-normalize]')){const form=e.target.closest('[data-book-form]'),source=form&&form.querySelector('[name="sourceText"]'),tts=form&&form.querySelector('[name="ttsText"]'),dictionary=form&&form.querySelector('[name="ttsDictionary"]');if(!source||!source.value.trim())return toast('Avval asl matnni kiriting.','error');tts.value=normalizeUzbekTtsText(source.value,dictionary&&dictionary.value);tts.dispatchEvent(new Event('input',{bubbles:true}));toast('TTS matni tayyorlandi. Qisqartmalar kitob lug‘ati bo‘yicha ochildi.','success');return;}
    if(e.target.closest('[data-reader-search-next]')){focusReaderMatch(readerSearch.index+1);return;}
    if(e.target.closest('[data-reader-search-prev]')){focusReaderMatch(readerSearch.index-1);return;}
    if(e.target.closest('[data-reader-search-clear]')){const field=document.querySelector('#hetk-training-overlay [data-reader-search]');if(field){field.value='';field.focus();}clearReaderHighlights();readerSearchStatus('So‘z kiriting');return;}
    if(e.target.closest('[data-reader-fullscreen]')){const reader=document.querySelector('#hetk-training-overlay .hetk-v13-reader');if(reader){reader.classList.toggle('is-expanded');const btn=reader.querySelector('[data-reader-fullscreen]');if(btn){btn.title=reader.classList.contains('is-expanded')?'Oddiy ko‘rinish':'Matnni kengaytirish';btn.innerHTML=reader.classList.contains('is-expanded')?'<i class="fas fa-compress"></i>':'<i class="fas fa-expand"></i>';}}return;}
    if(state.activeTab==='readingRank'){
      const person=e.target.closest('[data-rank-employee]');if(person){state.rankSelected=person.dataset.rankEmployee;state.rankDetailBook='';state.rankPanel='current';state.rankMobileDetail=true;repaint();return;}
      if(e.target.closest('[data-rank-back]')){state.rankMobileDetail=false;repaint();return;}
      const panel=e.target.closest('[data-rank-panel]');if(panel){state.rankPanel=panel.dataset.rankPanel;repaint();return;}
      const book=e.target.closest('[data-rank-book]');if(book){state.rankDetailBook=book.dataset.rankBook;state.rankPanel='current';repaint();return;}
      if(e.target.closest('[data-rank-reset]')){state.rankFolder='all';state.rankBook='all';state.rankSort='chapters';state.rankSearch='';state.rankSelected='';state.rankMobileDetail=false;repaint();return;}
      if(e.target.closest('[data-rank-refresh]')){state.rankMobileDetail=false;loadReadingRanking(true);return;}
    }
    if(e.target===e.currentTarget||e.target.closest('[data-training-close]'))return close();const bookVis=e.target.closest('[data-toggle-book-visibility]');if(bookVis){toggleBookVisibility(bookVis.dataset.toggleBookVisibility);return;}const chapterVis=e.target.closest('[data-toggle-chapter-visibility]');if(chapterVis){const parts=chapterVis.dataset.toggleChapterVisibility.split(':');toggleChapterVisibility(parts[0],parts[1]);return;}const editBook=e.target.closest('[data-edit-admin-book]');if(editBook){state.bookAdminBookId=editBook.dataset.editAdminBook;state.bookAdminChapterId='';state.activeTab='bookAdmin';repaint();return;}if(e.target.closest('[data-new-admin-book]')){if(!canNavigateFromAudio())return;if(!confirm('Yangi kitob yaratishga o‘tasizmi? Saqlanmagan o‘zgarishlar yo‘qoladi.'))return;state.bookAdminNewMode=true;state.bookAdminNewChapterMode=true;state.bookAdminBookId='';state.bookAdminChapterId='';state.pendingChapterAudio=null;state.ttsPreview=null;state.chapterTestDraftKey='';state.chapterTestDraft=null;repaint();return;}if(e.target.closest('[data-new-admin-chapter]')){if(!canNavigateFromAudio())return;if(!state.bookAdminBookId)return toast('Avval kitobni saqlang.','error');state.bookAdminNewMode=false;state.bookAdminNewChapterMode=true;state.bookAdminChapterId='';state.bookAdminTopicId=PRIMARY_BOOK_TOPIC;state.topicDraftKey='';state.topicDraft=null;state.pendingChapterAudio=null;state.ttsPreview=null;state.chapterTestDraftKey='';state.chapterTestDraft=null;repaint();return;}const chapterPick=e.target.closest('[data-admin-chapter]');if(chapterPick){if(!canNavigateFromAudio())return;state.bookAdminNewMode=false;state.bookAdminNewChapterMode=false;state.bookAdminChapterId=chapterPick.dataset.adminChapter;state.bookAdminTopicId=PRIMARY_BOOK_TOPIC;state.topicDraftKey='';state.topicDraft=null;state.pendingChapterAudio=null;state.ttsPreview=null;state.chapterTestDraftKey='';state.chapterTestDraft=null;repaint();return;}if(e.target.closest('[data-training-language]')){captureEditorDraft();syncDrafts();state.lang=state.lang==='uz'?'ru':'uz';localStorage.setItem('hetkTrainingLang',state.lang);const o=document.getElementById('hetk-training-overlay');o.innerHTML=shell();applyUiLanguage(o);bindDynamic();return;}const tab=e.target.closest('[data-training-tab]');if(tab){if(state.activeTab==='readingRank'&&tab.dataset.trainingTab!=='readingRank'){rankRequestToken++;state.rankLoading=false;}state.activeTab=tab.dataset.trainingTab;state.activeTestId='';repaint();ensureTabData(state.activeTab).then(repaint);return;}const go=e.target.closest('[data-go]');if(go){state.activeTab=go.dataset.go;repaint();ensureTabData(state.activeTab).then(repaint);return;}if(e.target.closest('[data-annual-statistics]')){state.activeTab='annual';repaint();return;}if(e.target.closest('[data-back-results]')){state.activeTab='results';repaint();return;}if(e.target.closest('[data-back-books]')){state.activeBookId='';state.activeChapterId='';state.readerMode='read';state.activeTab='books';repaint();return;}const readerChapter=e.target.closest('[data-reader-chapter]');if(readerChapter){state.activeChapterId=readerChapter.dataset.readerChapter;state.activeAudioTopicId='';state.readerMode='read';repaint();return;}const bookFilter=e.target.closest('[data-book-filter]');if(bookFilter){state.bookFilter=bookFilter.dataset.bookFilter;repaint();return;}const audioTopic=e.target.closest('[data-v22-audio-choice]');if(audioTopic){if(!audioTopic.disabled&&state.activeAudioTopicId!==audioTopic.dataset.v22AudioChoice){state.activeAudioTopicId=audioTopic.dataset.v22AudioChoice;repaint();}return;}const readerMode=e.target.closest('[data-reader-mode]');if(readerMode){state.readerMode=readerMode.dataset.readerMode==='listen'?'listen':'read';repaint();return;}const rprev=e.target.closest('[data-reader-prev]'),rnext=e.target.closest('[data-reader-next]');if(rprev||rnext){const book=state.books[state.activeBookId],chs=chapterEntries(book).filter(([id,c])=>isSuperAdmin()||c.published===true),i=chs.findIndex(x=>x[0]===state.activeChapterId),ni=rprev?i-1:i+1;if(chs[ni]&&chapterUnlocked(state.activeBookId,chs,ni)){state.activeChapterId=chs[ni][0];state.activeAudioTopicId='';state.readerMode='read';repaint();}return;}const rfont=e.target.closest('[data-reader-font]');if(rfont){const d=Number(rfont.dataset.readerFont);state.readerFont=d===0?19:Math.max(15,Math.min(28,(Number(state.readerFont)||19)+d));localStorage.setItem('hetkReaderFont',state.readerFont);repaint();return;}const rtheme=e.target.closest('[data-reader-theme]');if(rtheme){state.readerTheme=rtheme.dataset.readerTheme;localStorage.setItem('hetkReaderTheme',state.readerTheme);repaint();return;}const openBook=e.target.closest('[data-open-book]');if(openBook){state.activeBookId=openBook.dataset.openBook;state.activeChapterId='';state.activeAudioTopicId='';state.readerMode='read';repaint();return;}    const savedAudioPreview=e.target.closest('[data-v24-audio-preview]');if(savedAudioPreview){const audio=savedAudioPreview.closest('article')?.querySelector('audio');if(!audio)return;const icon=savedAudioPreview.querySelector('i');savedAudioPreview.disabled=true;if(icon)icon.className='fas fa-spinner fa-spin';loadAudioElement(audio,true).then(ok=>{if(ok){savedAudioPreview.innerHTML='<i class="fas fa-check"></i> Tayyor — tinglang';if(audio.paused)toast('Audio yuklandi. Pleyerdagi ▶ tugmasini bosing.','success');}else savedAudioPreview.innerHTML='<i class="fas fa-rotate-right"></i> Qayta urinish';}).finally(()=>{savedAudioPreview.disabled=false;});return;}if(e.target.closest('[data-tts-recheck]')){checkTtsStatus();return;}if(e.target.closest('[data-tts-copy]')){navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(TTS_START_COMMAND).then(()=>toast('TTS kodi nusxalandi.','success')).catch(()=>toast('Kodni nusxalab bo‘lmadi.','error')):toast('Kodni qo‘lda belgilang va nusxalang.','error');return;}if(e.target.closest('[data-tts-normalize]')){const form=e.target.closest('[data-book-form]'),source=form&&form.querySelector('[name="sourceText"]'),tts=form&&form.querySelector('[name="ttsText"]');if(!source||!source.value.trim())return toast('Avval asl matnni kiriting.','error');tts.value=normalizeUzbekTtsText(source.value);tts.dispatchEvent(new Event('input',{bubbles:true}));toast('TTS matni tayyorlandi. Qisqartmalar va o‘lchov birliklarini ko‘zdan kechiring.','success');return;}if(e.target.closest('[data-tts-preview]')){if(state.ttsOnline!==true)return toast('Avval Navoiy TTS serverini yoqing va “Qayta tekshirish”ni bosing.','error');previewTts();return;}if(e.target.closest('[data-tts-upload]')){uploadChapterAudio();return;}if(e.target.closest('[data-retry-live]')){state.examQuestions=[];state.examAnswers={};state.examConfirmed={};state.examIndex=0;state.answerDetails[state.activeTestId]=null;state.retryLive=true;repaint();return;}if(e.target.closest('[data-retry-practice]')){state.practicePreview=null;state.examQuestions=[];state.examAnswers={};state.examConfirmed={};state.examIndex=0;state.examShuffleSeed=Date.now();const t=state.tests[state.activeTestId];state.practiceDeadline=Date.now()+Math.max(1,Number(t.questionLimit)||Number(t.totalQuestions)||1)*60000;repaint();return;}const openTest=e.target.closest('[data-open-test]');if(openTest){state.activeTestId=openTest.dataset.openTest;state.examIndex=0;state.examAnswers={};state.examConfirmed={};state.examQuestions=[];state.practicePreview=null;state.retryLive=false;state.examShuffleSeed=Date.now();repaint();const t=state.tests[state.activeTestId];if(t&&(statusOf(t)==='live'||canPractice(t))){if(t.status==='draft')state.practiceDeadline=Date.now()+Math.max(1,Number(t.questionLimit)||Number(t.totalQuestions)||1)*60000;loadQuestionBank(t.id);}if(myResult(state.activeTestId))loadAnswerDetails(state.activeTestId);return;}if(e.target.closest('[data-back-tests]')){state.activeTestId='';state.activeTab='tests';state.examIndex=0;state.examAnswers={};state.practicePreview=null;state.retryLive=false;repaint();return;}if(e.target.closest('[data-exam-confirm]')){captureExamAnswer();const q=state.examQuestions[state.examIndex];if(!q||!Object.prototype.hasOwnProperty.call(state.examAnswers,q.id))return toast('Avval javobni belgilang.','error');state.examConfirmed[q.id]=true;const next=state.examQuestions.findIndex((item,i)=>i>state.examIndex&&!state.examConfirmed[item.id]);if(next>=0)state.examIndex=next;else{const first=state.examQuestions.findIndex(item=>!state.examConfirmed[item.id]);if(first>=0)state.examIndex=first;else{repaint();toast('Barcha savollar qabul qilindi. Testni yakunlashingiz mumkin.','success');return;}}repaint();return;}if(e.target.closest('[data-exam-pending]')){captureExamAnswer();const index=state.examQuestions.findIndex(q=>!state.examConfirmed[q.id]);if(index<0)return toast('Barcha savollarga javob tasdiqlangan.','success');state.examIndex=index;repaint();return;}if(e.target.closest('[data-exam-skip]')){{let i=state.examIndex+1;while(i<state.examQuestions.length&&state.examConfirmed[state.examQuestions[i].id])i++;if(i>=state.examQuestions.length){i=state.examQuestions.findIndex(q=>!state.examConfirmed[q.id]);if(i<0)return toast('Barcha savollar tasdiqlangan. Testni yakunlang.','success');}state.examIndex=i;}repaint();return;}if(e.target.closest('[data-exam-prev]')){captureExamAnswer();{let i=state.examIndex-1;while(i>=0&&state.examConfirmed[state.examQuestions[i].id])i--;if(i<0)return toast('Oldinda javobsiz savol yo‘q.','warning');state.examIndex=i;}repaint();return;}if(e.target.closest('[data-exam-next]')){captureExamAnswer();{let i=state.examIndex+1;while(i<state.examQuestions.length&&state.examConfirmed[state.examQuestions[i].id])i++;if(i>=state.examQuestions.length){i=state.examQuestions.findIndex(q=>!state.examConfirmed[q.id]);if(i<0)return toast('Barcha savollar tasdiqlangan. Testni yakunlang.','success');}state.examIndex=i;}repaint();return;}if(e.target.closest('[data-exam-finish]')){captureExamAnswer();submitExam(null,false);return;}const all=e.target.closest('[data-check-all]');if(all){const name=all.dataset.checkAll,boxes=[...document.querySelectorAll(`#hetk-training-overlay input[name="${name}"]`)],checked=boxes.every(x=>x.checked);boxes.forEach(x=>x.checked=!checked);updateAudienceSummary();return;}if(e.target.closest('[data-add-chapter-question]')){syncChapterTestDraft();state.chapterTestDraft.questions.push({text:'',options:['','','',''],correctIndex:0,explanation:''});repaint();return;}const chRemove=e.target.closest('[data-remove-chapter-question]');if(chRemove){syncChapterTestDraft();const row=chRemove.closest('[data-chapter-question-index]');state.chapterTestDraft.questions.splice(Number(row.dataset.chapterQuestionIndex),1);repaint();return;}if(e.target.closest('[data-add-question]')){captureEditorDraft();syncDrafts();state.questionDrafts.push(blankQuestion());repaint();requestAnimationFrame(()=>{const rows=document.querySelectorAll('#hetk-training-overlay [data-question-index]');const last=rows[rows.length-1];if(last){last.scrollIntoView({behavior:'smooth',block:'start'});const field=last.querySelector('[data-q-text]');if(field)field.focus({preventScroll:true});}});return;}const remove=e.target.closest('[data-remove-question]');if(remove){captureEditorDraft();syncDrafts();state.questionDrafts.splice(Number(remove.closest('[data-question-index]').dataset.questionIndex),1);repaint();return;}if(e.target.closest('[data-show-created]')){state.createdListOpen=true;repaint();return;}if(e.target.closest('[data-new-test]')){state.createdListOpen=false;state.editingTestId='';state.editorDraft=null;state.questionDrafts=[blankQuestion()];repaint();return;}const toggle=e.target.closest('[data-toggle-draft]');if(toggle){toggleDraftVisibility(toggle.dataset.toggleDraft);return;}const edit=e.target.closest('[data-edit-test]');if(edit){openDraftForEditing(edit.dataset.editTest);return;}const draft=e.target.closest('[data-save-draft]');if(draft){saveTest(draft.closest('form'),true);return;}const cancel=e.target.closest('[data-cancel-test]');if(cancel)cancelTest(cancel.dataset.cancelTest);const rank=e.target.closest('[data-ranking]');if(rank)showRanking(rank.dataset.ranking);
  }
  async function toggleBookVisibility(bookId){
    if(!isSuperAdmin())return toast('Ruxsat yo‘q.','error');
    const book=state.books[bookId];if(!book)return;
    const next=book.published!==true;
    try{await db().ref(`TrainingBooks/${bookId}/published`).set(next);book.published=next;book.updatedAt=Date.now();toast(next?'Kitob xodimlarga ochildi.':'Kitob xodimlardan yashirildi.','success');repaint();}catch(err){toast('Holat o‘zgarmadi: '+err.message,'error');}
  }
  async function toggleChapterVisibility(bookId,chapterId){
    if(!isSuperAdmin())return toast('Ruxsat yo‘q.','error');
    const book=state.books[bookId],ch=book&&book.chapters&&book.chapters[chapterId];if(!ch)return;
    if(book.published!==true)return toast('Avval kitobni xodimlarga oching.','error');
    const next=ch.published!==true;
    try{await db().ref(`TrainingBooks/${bookId}/chapters/${chapterId}/published`).set(next);ch.published=next;toast(next?'Bob xodimlarga ochildi.':'Bob xodimlardan yashirildi.','success');repaint();}catch(err){toast('Bob holati o‘zgarmadi: '+err.message,'error');}
  }
  function handleInput(e){if(state.activeTab==='readingRank'&&e.target.matches('[data-rank-search]')){state.rankSearch=e.target.value;const rows=rankEmployeeRows(),list=document.querySelector('#hetk-training-overlay [data-rank-list]'),count=document.querySelector('#hetk-training-overlay [data-rank-count]');if(list)list.innerHTML=rankListHTML(rows);if(count)count.textContent=`Jami: ${rows.length} nafar xodim`;return;}if(e.target.matches('[data-reader-search]')){runReaderSearch(e.target.value);return;}if(e.target.matches('textarea[data-q-option]')){e.target.style.height='auto';e.target.style.height=Math.max(48,e.target.scrollHeight+3)+'px';}if(e.target.closest('[data-topic-studio]'))syncTopicDraft();if(e.target.closest('[data-chapter-question-list]')||e.target.name==='chapterPassPercent')syncChapterTestDraft();if(e.target.name==='ttsText'){const form=e.target.closest('[data-book-form]');updateTtsTextMetrics(form);if(state.ttsParts.length&&!state.ttsGenerating){revokeTtsParts();const host=form&&form.querySelector('[data-tts-parts]'),up=form&&form.querySelector('[data-tts-upload]');if(host)host.innerHTML='';if(up)up.disabled=true;}}if(e.target.matches('[data-book-search]')){const q=e.target.value.trim().toLowerCase();document.querySelectorAll('[data-book-card]').forEach(c=>c.hidden=!c.dataset.search.includes(q));}if(e.target.closest('[data-question-list]'))syncDrafts();if(e.target.closest('[data-test-form]'))captureEditorDraft();if(e.target.matches('[data-test-search]')){const q=e.target.value.toLocaleLowerCase();document.querySelectorAll('[data-test-card]').forEach(c=>c.hidden=!c.textContent.toLocaleLowerCase().includes(q)||(state.testFilter!=='all'&&c.dataset.status!==state.testFilter));}}
  async function saveBookDraft(form){
    if(!isSuperAdmin())return toast('Ruxsat yo‘q.','error');
    if(state.ttsGenerating)return toast('Audio yaratilmoqda. Tayyor bo‘lguncha saqlamang.','warning');
    if(state.ttsParts.length&&state.ttsContextKey.startsWith('chapter:')&&!state.ttsPreview)return toast('Audio hali to‘liq yaratilmagan. Iltimos, avval ovozlashtirishni tugating.','error');
    const fd=new FormData(form),bookType=fd.get('bookType')==='industry'?'industry':'training',title=String(fd.get('title')||'').trim(),chapterTitle=String(fd.get('chapterTitle')||'').trim(),sourceText=String(fd.get('sourceText')||'').trim(),sourceHtml=safeRichHtml(fd.get('sourceHtml')||''),ttsText=String(fd.get('ttsText')||'').trim();
    if(!title||!chapterTitle)return toast('Kitob nomi va bob sarlavhasini kiriting.','error');
    if(state.ttsParts.length&&state.ttsContextKey.startsWith('topic:'))return toast('Boshqa mavzu uchun yangi audio yaratilgan. Avval o‘sha mavzuni alohida saqlang.','warning');
    let bookId=String(fd.get('bookId')||'').trim(),chapterId=String(fd.get('chapterId')||'').trim();
    if(!bookId)bookId=db().ref('TrainingBooks').push().key;
    const oldBook=state.books[bookId]||{},oldChapters=oldBook.chapters||{};let coverUrl=oldBook.coverUrl||'',coverFileId=oldBook.coverFileId||'',coverMessageId=oldBook.coverMessageId||'',coverStorage=oldBook.coverStorage||'';const coverInput=form.querySelector('[data-cover-file]'),coverFile=coverInput&&coverInput.files&&coverInput.files[0];if(coverFile){if(coverFile.size>TRAINING_MEDIA_MAX_BYTES)return toast(`Muqova ${mediaSize(coverFile.size)}. 18 MB dan katta fayl yuklanmaydi.`,'error');try{toast('Muqova O‘quv markazi media kanaliga yuklanmoqda...');const uploaded=await uploadBookCover(coverFile);coverUrl='';coverFileId=uploaded.fileId;coverMessageId=uploaded.messageId;coverStorage=uploaded.storage;}catch(err){return toast('Muqova saqlanmadi: '+err.message,'error');}}
    const order=Number(fd.get('chapterOrder'))||nextChapterOrder(oldBook);
    if(!chapterId)chapterId=db().ref(`TrainingBooks/${bookId}/chapters`).push().key;
    const oldChapter=oldChapters[chapterId]||{},oldAudioParts=chapterAudioParts(oldChapter),stamp=Date.now();
    syncChapterTestDraft();const ct=bookType==='industry'?{passPercent:70,questions:[]}:state.chapterTestDraft||{passPercent:70,questions:[]};const cleanQuestions=(ct.questions||[]).map(q=>({text:String(q.text||'').trim(),options:(q.options||[]).map(x=>String(x||'').trim()),correctIndex:Number(q.correctIndex)||0,explanation:String(q.explanation||'').trim(),source:String(q.source||'').trim(),timeSeconds:Math.max(30,Math.min(600,Number(q.timeSeconds)||90))})).filter(q=>q.text&&q.options.length===4&&q.options.every(Boolean)),previousTestArchive=(oldChapter.chapterTest||{}).archive||null;let chapterTest={passPercent:Number(ct.passPercent)||70,questionCount:cleanQuestions.length,updatedAt:stamp};
    if(cleanQuestions.length){
      try{
        const archiveBody={schema:'hetk-training-test-v1',kind:'book-chapter-test',bookId,bookTitle:title,chapterId,chapterTitle,passPercent:chapterTest.passPercent,questions:cleanQuestions,createdAt:stamp,createdBy:uid(),createdByName:(me()||{}).fullName||(me()||{}).login||''},contentHash=await jsonContentHash({passPercent:chapterTest.passPercent,questions:cleanQuestions});
        const archive=previousTestArchive&&previousTestArchive.fileId&&previousTestArchive.contentHash===contentHash?previousTestArchive:await uploadTrainingJson(archiveBody,`kitob-${title}-${chapterTitle}-${chapterId}`,`HETK O‘quv markazi — KITOB TESTI\n${title}\n${chapterTitle}\n${cleanQuestions.length} ta savol`,bookId,chapterId);
        chapterTest.archive={...archive,contentHash,archiveKind:'book-chapter-test',bookId,chapterId};
      }catch(err){return toast('Bob testi Telegram arxiviga saqlanmadi: '+err.message,'error');}
    }

    // Tahrirlashda yangi TTS audiolari yaratilgan bo‘lsa, saqlash tugmasining o‘zi
    // ularni media kanaliga yuklaydi. Eski audio faqat yangi qismlar Firebase'ga
    // muvaffaqiyatli yozilib, qayta tekshirilgandan keyin Telegramdan o‘chiriladi.
    const generatedParts=Array.isArray(state.ttsParts)?state.ttsParts:[];
    // A topic TTS must NEVER overwrite the chapter's first-topic audio.
    const expectedChapterContext=`chapter:${state.bookAdminBookId||'new-book'}:${state.bookAdminChapterId||'new-chapter'}`;
    const replacingAudio=generatedParts.length>0&&state.ttsContextKey===expectedChapterContext;
    let storedAudioParts=[];
    if(replacingAudio){
      try{
        const uploadedParts=[];
        toast(`${generatedParts.length} ta yangi audio saqlanmoqda...`);
        for(let i=0;i<generatedParts.length;i++){
          const part=generatedParts[i];
          if(!part||!part.blob)throw new Error(`${i+1}-qism audio topilmadi`);
          if(part.blob.size>TRAINING_MEDIA_MAX_BYTES)throw new Error(`${i+1}-qism ${mediaSize(part.blob.size)}. 18 MB dan katta.`);
          if(part.uploaded&&part.uploaded.fileId){uploadedParts.push(part.uploaded);continue;}
          const type=part.blob.type||'audio/wav',ext=type.includes('mpeg')?'mp3':type.includes('mp4')?'m4a':type.includes('ogg')?'ogg':'wav',file=new File([part.blob],`hetk-${Date.now()}-${i+1}.${ext}`,{type}),kind=/audio\/(mpeg|mp4|x-m4a|ogg)/i.test(type)?'audio':'document';
          const uploaded=await trainingMediaUpload(file,kind,bookId,chapterId,`HETK O‘quv markazi — ${title} — ${chapterTitle} — ${i+1}/${generatedParts.length}-qism`),saved={...uploaded,voice:part.voice,speed:part.speed,partNumber:i+1,textLength:part.text.length,uploadedAt:Date.now()};
          part.uploaded=saved;uploadedParts.push(saved);
        }
        storedAudioParts=uploadedParts;
        state.pendingChapterAudioParts=uploadedParts;
        state.pendingChapterAudio=uploadedParts[0]||null;
      }catch(err){return toast('Yangi audio saqlanmadi. Eski audio o‘z joyida qoldi: '+err.message,'error');}
    }else storedAudioParts=state.pendingChapterAudioParts||oldAudioParts;

    const storedAudio=storedAudioParts[0]||state.pendingChapterAudio||oldChapter.audio||null;
    const chapter={...oldChapter,id:chapterId,titleUz:chapterTitle,sourceTextUz:sourceText,sourceHtmlUz:sourceHtml,ttsTextUz:ttsText,ttsVoice:String(fd.get('voice')||'navoiy'),ttsSpeed:String(fd.get('speed')||'1'),order,published:oldChapter.published===true,audio:storedAudio,audioParts:storedAudioParts,testId:oldChapter.testId||'',chapterTest,updatedAt:stamp};
    const localChapter={...chapter,chapterTest:{...chapterTest,questions:cleanQuestions}},localChapters={...oldChapters,[chapterId]:localChapter},persistedChapters=Object.fromEntries(Object.entries(localChapters).map(([id,item])=>{const savedTest=item&&item.chapterTest||{},cleanTopics=Object.fromEntries(Object.entries(item&&item.topics||{}).map(([topicId,topic])=>{const {editions,ttsText,...topicMeta}=topic||{};return [topicId,topicMeta];})),cleanItem={...item,topics:cleanTopics};if(!savedTest.archive||!savedTest.archive.fileId){const {questions,...testMeta}=savedTest;return [id,{...cleanItem,chapterTest:testMeta}];}const {questions,...testMeta}=savedTest;return [id,{...cleanItem,chapterTest:testMeta}];}));
    const payload={...oldBook,id:bookId,bookType,titleUz:title,descriptionUz:String(fd.get('description')||'').trim(),category:String(fd.get('category')||'Qo‘llanma').trim(),ttsDictionaryText:String(fd.get('ttsDictionary')||DEFAULT_TTS_DICTIONARY).trim(),coverUrl,coverFileId,coverMessageId,coverStorage,published:oldBook.published===true,createdBy:oldBook.createdBy||uid(),createdAt:oldBook.createdAt||stamp,updatedAt:stamp,chapters:persistedChapters};
    try{
      // Do not overwrite the whole book: topics may have been saved independently by another editor.
      // Firebase multi-path update preserves every sibling chapter and every topic ID.
      const bookRef=db().ref(`TrainingBooks/${bookId}`);
      const updates={};
      for(const [key,value] of Object.entries(payload)){
        if(key!=='chapters')updates[key]=value;
      }
      for(const [key,value] of Object.entries(chapter)){
        if(key==='topics')continue; // Topic metadata is owned exclusively by saveTopic().
        if(key==='chapterTest')continue;
        updates[`chapters/${chapterId}/${key}`]=value;
      }
      updates[`chapters/${chapterId}/chapterTest`]=persistedChapters[chapterId].chapterTest;
      await bookRef.update(updates);
      const verifySnap=await db().ref(`TrainingBooks/${bookId}/chapters/${chapterId}`).once('value'),verified=verifySnap.val()||{},verifiedParts=chapterAudioParts(verified);
      if(replacingAudio&&(verifiedParts.length!==storedAudioParts.length||verifiedParts.some((part,i)=>String(part.fileId)!==String(storedAudioParts[i].fileId))))throw new Error('Firebase tekshiruvida yangi audio manzillari mos kelmadi');
      if(chapterTest.archive&&chapterTest.archive.fileId&&String((((verified.chapterTest||{}).archive||{}).fileId)||'')!==String(chapterTest.archive.fileId))throw new Error('Firebase tekshiruvida yangi test arxivi topilmadi');
      const freshBookSnap=await bookRef.once('value');
      const freshBook=freshBookSnap.val()||payload;
      await hydrateBookTopicArchives({[bookId]:freshBook});
      await hydrateBookTestArchives({[bookId]:freshBook});
      state.books[bookId]=freshBook;state.booksLoaded=true;state.bookAdminBookId=bookId;state.bookAdminChapterId=chapterId;state.bookAdminNewMode=false;state.bookAdminNewChapterMode=false;

      let deleteFailed=0,testArchiveDeleteFailed=false,cleanupRetained=0;
      if(replacingAudio&&oldAudioParts.length){
        const cleanup=await cleanupReplacedAudio(oldAudioParts,storedAudioParts);
        deleteFailed=cleanup.failed;cleanupRetained=cleanup.retained;
      }
      const currentTestMessageId=Number((chapterTest.archive||{}).messageId)||0,previousTestMessageId=Number((previousTestArchive||{}).messageId)||0;
      if(previousTestMessageId&&previousTestMessageId!==currentTestMessageId){try{await trainingMediaDelete(previousTestMessageId);}catch(err){testArchiveDeleteFailed=true;console.warn('Eski bob testi Telegramdan o‘chirilmadi:',err);}}

      const savedCount=verifiedParts.length;
      revokeTtsParts();state.ttsContextKey='';state.chapterTestDraftKey='';state.chapterTestDraft=null;
      if(replacingAudio){
        if(deleteFailed||testArchiveDeleteFailed)toast(`Saqlandi: ${savedCount} ta yangi audio biriktirildi.${deleteFailed?` ${deleteFailed} ta eski audio o‘chmadi.`:''}${testArchiveDeleteFailed?' Eski test JSON posti o‘chmadi.':''}`,'warning');
        else toast(`Saqlandi. ${savedCount} ta yangi audio biriktirildi. ${cleanupRetained?'Boshqa joyda ishlatilayotgan eski audio saqlandi.':'Eski audio postlari xavfsiz almashtirildi.'}`,'success');
      }else if(testArchiveDeleteFailed)toast('Bob testi saqlandi, ammo eski Telegram JSON posti o‘chmadi.','warning');
      else toast(cleanQuestions.length?'Saqlandi. Bob testi yangilandi, eski Telegram JSON posti o‘chirildi.':'Saqlandi. Eski bob testi Telegram arxividan o‘chirildi.','success');
      repaint();
    }catch(err){toast('Kitob saqlanmadi: '+err.message,'error');}
  }


  function captureExamAnswer(){const q=state.examQuestions[state.examIndex];if(!q||state.examConfirmed[q.id])return;const selected=document.querySelector(`#hetk-training-overlay input[name="answer_${q.id}"]:checked`);if(selected)state.examAnswers[q.id]=Number(selected.value);}
  function updateAudienceSummary(){const box=document.querySelector('#hetk-training-overlay [data-audience-summary] span');if(!box)return;const folders=[...document.querySelectorAll('#hetk-training-overlay input[name="audienceFolders"]:checked')].map(x=>x.nextElementSibling&&x.nextElementSibling.textContent||x.value),roles=[...document.querySelectorAll('#hetk-training-overlay input[name="audienceRoles"]:checked')].map(x=>x.nextElementSibling&&x.nextElementSibling.textContent||x.value),scope=(document.querySelector('#hetk-training-overlay [data-training-scope]')||{}).value;box.textContent=`${scope==='republic'?'Butun respublika':folders.length?folders.join(', '):'Hudud tanlanmagan'} · ${roles.length?roles.join(', '):'Lavozim tanlanmagan'}`;}
  function handleChange(e){if(state.activeTab==='readingRank'){const filter=e.target.closest('[data-rank-filter]');if(filter){if(filter.dataset.rankFilter==='folder')state.rankFolder=filter.value;else if(filter.dataset.rankFilter==='book')state.rankBook=filter.value;else state.rankSort=filter.value;state.rankSelected='';state.rankDetailBook='';state.rankMobileDetail=false;repaint();return;}if(e.target.matches('[data-rank-detail-book]')){state.rankDetailBook=e.target.value;repaint();return;}}if(e.target.matches('[data-topic-note-file]')){return;}
if(e.target.matches('[data-topic-image-file]')){uploadTopicImage(e.target);return;}if(e.target.closest('[data-topic-studio]'))syncTopicDraft();if(e.target.matches('[data-reader-audio-topic]')){state.activeAudioTopicId=e.target.value;repaint();return;}if(e.target.matches('[data-reader-select]')){state.activeChapterId=e.target.value;state.activeTopicId='';state.activeAudioTopicId='';state.readerMode='read';repaint();return;}if(e.target.closest('[data-chapter-question-list]')||e.target.name==='chapterPassPercent')syncChapterTestDraft();if(e.target.matches('[name="bookType"]')){const section=e.target.closest('form')?.querySelector('.hetk-v12-test-editor');if(section)section.hidden=e.target.value==='industry';return;}if(e.target.matches('[data-admin-book-select]')){if(!canNavigateFromAudio()){e.target.value=state.bookAdminBookId||'';return;}state.bookAdminNewMode=!e.target.value;state.bookAdminNewChapterMode=!e.target.value;state.bookAdminBookId=e.target.value;state.bookAdminChapterId='';state.pendingChapterAudio=null;state.ttsPreview=null;state.chapterTestDraftKey='';state.chapterTestDraft=null;repaint();return;}if(e.target.matches('[data-cover-file]')){const f=e.target.files&&e.target.files[0],box=document.querySelector('#hetk-training-overlay .hetk-cover-preview');if(f&&f.size>TRAINING_MEDIA_MAX_BYTES){e.target.value='';return toast(`Muqova ${mediaSize(f.size)}. 18 MB dan katta fayl tanlanmaydi.`,'error');}if(f&&box){const u=URL.createObjectURL(f);box.innerHTML=`<img src="${u}" alt="Muqova ko‘rinishi">`;box.dataset.pendingCover='1';}return;}if(e.target.matches('[data-test-filter]')){state.testFilter=e.target.value;document.querySelectorAll('[data-test-card]').forEach(c=>c.hidden=state.testFilter!=='all'&&c.dataset.status!==state.testFilter);}if(e.target.closest('[data-question-list]'))syncDrafts();if(e.target.closest('[data-test-form]'))captureEditorDraft();if(e.target.matches('[data-test-search]')){const q=e.target.value.toLocaleLowerCase();document.querySelectorAll('[data-test-card]').forEach(c=>c.hidden=!c.textContent.toLocaleLowerCase().includes(q)||(state.testFilter!=='all'&&c.dataset.status!==state.testFilter));}if(e.target.closest('[data-exam-form]'))captureExamAnswer();if(e.target.matches('[data-training-scope]')||e.target.name==='audienceFolders'||e.target.name==='audienceRoles')updateAudienceSummary();}
  function bindDynamic(){const count=document.querySelector('#hetk-training-overlay input[name="questionLimit"]');if(count)count.max=String(state.questionDrafts.length);const bookForm=document.querySelector('#hetk-training-overlay [data-book-form]');if(bookForm){updateTtsTextMetrics(bookForm);const speed=bookForm.querySelector('[name="speed"]');if(speed&&speed.dataset.metricsBound!=='1'){speed.dataset.metricsBound='1';speed.addEventListener('change',()=>updateTtsTextMetrics(bookForm));}setTimeout(checkTtsStatus,0);}bindAudioPlaylists(document);bindUnifiedBookPlayers(document);setTimeout(hydrateTrainingMedia,0);}
  function captureEditorDraft(){const form=document.querySelector('#hetk-training-overlay [data-test-form]');if(!form)return;const fd=new FormData(form);state.editorDraft={title:String(fd.get('title')||''),description:String(fd.get('description')||''),testLanguage:String(fd.get('testLanguage')||'uz'),announcementMode:String(fd.get('announcementMode')||'visible'),scope:String(fd.get('scope')||'regional'),startAt:String(fd.get('startAt')||''),durationMinutes:Number(fd.get('durationMinutes'))||30,questionLimit:Number(fd.get('questionLimit'))||state.questionDrafts.length,audienceFolders:fd.getAll('audienceFolders'),audienceRoles:fd.getAll('audienceRoles')};}
  function syncDrafts(){document.querySelectorAll('#hetk-training-overlay [data-question-index]').forEach(row=>{const i=Number(row.dataset.questionIndex),q=state.questionDrafts[i]||blankQuestion();q.text=(row.querySelector('[data-q-text]')||{}).value||'';q.options=[...row.querySelectorAll('[data-q-option]')].map(x=>x.value);q.source=(row.querySelector('[data-q-source]')||{}).value||'';q.explanation=(row.querySelector('[data-q-explanation]')||{}).value||'';const right=row.querySelector('input[type="radio"]:checked');q.correctIndex=right?Number(right.value):0;state.questionDrafts[i]=q;});}
  async function handleSubmit(e){if(e.target.matches('[data-book-form]')){e.preventDefault();if(state.bookAdminTopicId==='__new__'&&state.topicDraft&&(state.topicDraft.titleLatin||state.topicDraft.titleCyrillic||state.topicDraft.editions?.latin?.blocks?.some(b=>b.text||b.html||b.fileId))){return toast('Yangi mavzu hali saqlanmagan. Avval mavzu ichidagi «Mavzuni alohida saqlash» tugmasini bosing.','warning');}await saveBookDraft(e.target);return;}if(e.target.matches('[data-test-form]')){e.preventDefault();saveTest(e.target,false);}if(e.target.matches('[data-exam-form]')){e.preventDefault();submitExam(e.target,false);}if(e.target.matches('[data-pin-setup]')){e.preventDefault();setupStatisticsPin(e.target);}if(e.target.matches('[data-pin-change]')){e.preventDefault();changeStatisticsPin(e.target);}if(e.target.matches('[data-annual-reset]')){e.preventDefault();startAnnualStatisticsPeriod(e.target);}}

  function randomSalt(){const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');}
  async function setupStatisticsPin(form){
    if(!isSuperAdmin())return toast('Faqat bosh administrator kod yarata oladi.','error');const fd=new FormData(form),pin=String(fd.get('newPin')||''),confirmPin=String(fd.get('confirmPin')||'');if(!/^\d{6}$/.test(pin))return toast('Kod aynan 6 ta raqamdan iborat bo‘lsin.','error');if(pin!==confirmPin)return toast('Takroriy kod mos kelmadi.','error');const salt=randomSalt(),pinHash=await hashPin(pin,salt),a=me()||{};try{await db().ref('TrainingAdminSecurity/statisticsPin').set({pinHash,salt,updatedAt:firebase.database.ServerValue.TIMESTAMP,updatedBy:uid(),updatedByName:a.fullName||a.login||''});toast('Yillik statistika uchun himoya kodi yaratildi.','success');}catch(err){toast('Kod saqlanmadi: '+err.message,'error');}
  }
  async function verifyStatisticsPin(pin){
    if(Date.now()<state.adminPinLockedUntil){toast('Kod 5 daqiqaga bloklangan. Keyinroq urinib ko‘ring.','error');return false;}const security=state.adminSecurity||{};if(!security.pinHash||!security.salt){toast('Avval himoya kodini yarating.','error');return false;}const entered=await hashPin(String(pin||''),security.salt);if(entered===security.pinHash){state.adminPinFailures=0;return true;}state.adminPinFailures++;if(state.adminPinFailures>=3){state.adminPinFailures=0;state.adminPinLockedUntil=Date.now()+5*60*1000;toast('Kod 3 marta noto‘g‘ri kiritildi. 5 daqiqaga bloklandi.','error');}else toast(`Kod noto‘g‘ri. ${3-state.adminPinFailures} ta urinish qoldi.`,'error');return false;
  }
  async function changeStatisticsPin(form){
    if(!isSuperAdmin())return toast('Faqat bosh administrator kodni almashtira oladi.','error');const fd=new FormData(form),oldPin=String(fd.get('oldPin')||''),newPin=String(fd.get('newPin')||''),confirmPin=String(fd.get('confirmPin')||'');if(!await verifyStatisticsPin(oldPin))return;if(!/^\d{6}$/.test(newPin))return toast('Yangi kod aynan 6 ta raqamdan iborat bo‘lsin.','error');if(newPin!==confirmPin)return toast('Yangi kodlar mos kelmadi.','error');const salt=randomSalt(),pinHash=await hashPin(newPin,salt),a=me()||{};try{await db().ref('TrainingAdminSecurity/statisticsPin').set({pinHash,salt,updatedAt:firebase.database.ServerValue.TIMESTAMP,updatedBy:uid(),updatedByName:a.fullName||a.login||''});form.reset();toast('Himoya kodi almashtirildi.','success');}catch(err){toast('Kod almashtirilmadi: '+err.message,'error');}
  }
  async function startAnnualStatisticsPeriod(form){
    if(!isSuperAdmin())return toast('Faqat bosh administrator statistik yilni yangilaydi.','error');const fd=new FormData(form),regionId=String(fd.get('regionId')||''),pin=String(fd.get('pin')||''),year=String(new Date().getFullYear());if(!regionId)return toast('Viloyatni tanlang.','error');if(!fd.get('confirmed'))return toast('Tasdiqlash katagiga belgi qo‘ying.','error');if(!await verifyStatisticsPin(pin))return;if(!confirm(`${folderName(regionId)} bo‘yicha ${year}-yil statistikasi hozirgi vaqtdan noldan boshlansinmi? Eski natijalar o‘chmaydi.`))return;const a=me()||{},auditId=db().ref('TrainingAdminAudit').push().key,stamp=firebase.database.ServerValue.TIMESTAMP,period={year,regionId,regionName:folderName(regionId),startAt:stamp,resetAt:stamp,resetBy:uid(),resetByName:a.fullName||a.login||''},audit={action:'annual_statistics_period_started',year,regionId,regionName:folderName(regionId),actorUid:uid(),actorName:a.fullName||a.login||'',createdAt:stamp};try{await db().ref().update({[`TrainingStatisticsPeriods/${regionId}/${year}`]:period,[`TrainingAdminAudit/${auditId}`]:audit});form.reset();toast(`${folderName(regionId)} statistikasi yangi davr uchun noldan boshlandi. Eski natijalar saqlandi.`,'success');}catch(err){toast('Statistika yangilanmadi: '+err.message,'error');}
  }

  function showTestFormError(message,questionIndex){
    const form=document.querySelector('#hetk-training-overlay [data-test-form]');
    const host=form&&form.querySelector('[data-test-error]');
    if(host){host.hidden=false;host.textContent=message;host.scrollIntoView({behavior:'smooth',block:'center'});}
    if(Number.isInteger(questionIndex)){
      const row=form&&form.querySelector(`[data-question-index="${questionIndex}"]`);
      if(row){row.classList.add('hetk-training-invalid-question');row.scrollIntoView({behavior:'smooth',block:'center'});}
    }
    toast(message,'error');
  }
  async function toggleDraftVisibility(id){const t=state.tests[id];if(!t||t.status!=='draft'||(t.createdBy!==uid()&&!isSuperAdmin()))return toast('Ruxsat yo‘q.','error');const next=t.announcementMode==='visible'?'hidden':'visible';try{await db().ref(`TrainingTests/${id}/announcementMode`).set(next);t.announcementMode=next;toast(next==='visible'?'Qoralama hammaga ochildi.':'Qoralama yashirildi.','success');const c=document.querySelector('[data-training-content]');if(c){c.innerHTML=renderCreated();applyUiLanguage(c);bindDynamic();}}catch(err){toast('Holat saqlanmadi: '+err.message,'error');}}
  async function openDraftForEditing(id){
    const test=state.tests[id];if(!test||(test.createdBy!==uid()&&!isSuperAdmin())||statusOf(test)!=='draft')return toast('Faqat o‘zingizning qoralamangizni tahrirlashingiz mumkin.','error');
    await loadQuestionBank(id);
    const bank=state.questionBanks[id];if(!bank||!Object.keys(bank).length)return toast('Telegram arxividan savollar yuklanmadi. Eski test o‘zgartirilmadi.','error');
    state.questionDrafts=Object.values(bank).map(q=>({text:q.text||'',options:[...(q.options||['','','',''])],correctIndex:Number(q.correctIndex)||0,source:q.source||'',explanation:q.explanation||''}));
    state.editingTestId=id;state.createdListOpen=false;
    state.editorDraft={title:test.title||'',description:test.description||'',testLanguage:test.testLanguage||'uz',announcementMode:test.announcementMode||'visible',scope:test.scope||'regional',startAt:localInput(now()+MIN_NOTICE_MS+15*60000),durationMinutes:test.durationMinutes||state.questionDrafts.length,questionLimit:test.questionLimit||state.questionDrafts.length,audienceFolders:Object.keys(test.audienceFolders||{}),audienceRoles:Object.keys(test.audienceRoles||{})};
    const content=document.querySelector('#hetk-training-overlay [data-training-content]');if(content){content.innerHTML=renderManage();applyUiLanguage(content);bindDynamic();content.scrollTop=0;}
  }
  async function saveTest(form,draft){
    if(!canCreate())return toast('Test yaratish huquqi yo‘q.','error');syncDrafts();const errorBox=form.querySelector('[data-test-error]');if(errorBox){errorBox.hidden=true;errorBox.textContent='';}form.querySelectorAll('.hetk-training-invalid-question').forEach(el=>el.classList.remove('hetk-training-invalid-question'));const fd=new FormData(form),bookType=fd.get('bookType')==='industry'?'industry':'training',title=String(fd.get('title')||'').trim(),description=String(fd.get('description')||'').trim(),startAt=new Date(fd.get('startAt')).getTime(),duration=Number(fd.get('durationMinutes')),limit=Number(fd.get('questionLimit'));
    const scope=String(fd.get('scope')||'regional'),folderIds=fd.getAll('audienceFolders'),roleIds=fd.getAll('audienceRoles');
    if(!title)return showTestFormError('Test nomini kiriting.');if(!description)return showTestFormError('Test haqida izoh kiriting.');if(!state.questionDrafts.length)return toast('Kamida bitta savol kiriting.','error');for(let i=0;i<state.questionDrafts.length;i++){const q=state.questionDrafts[i];if(!q.text.trim()||q.options.some(x=>!x.trim()))return showTestFormError(`${i+1}-savol va barcha javoblarini to‘ldiring.`,i);}if(!draft&&scope!=='republic'&&(!folderIds.length||!roleIds.length))return toast(tr('audienceRequired'),'error');if(!draft&&scope==='republic'&&!roleIds.length)return toast('Kamida bitta lavozimni tanlang.','error');if(!draft&&startAt<now()+MIN_NOTICE_MS)return toast('Onlayn test kamida 2 soat oldin rejalashtirilishi kerak.','error');if(!draft&&(!duration||duration<5))return toast('Test davomiyligini kiriting.','error');if(!draft&&(limit<1||limit>state.questionDrafts.length))return showTestFormError('Savollar soni bankdagi savollar sonidan oshmasin.');
    const previousId=draft?state.editingTestId:'',previousTest=previousId&&state.tests[previousId];const ref=previousTest?db().ref(`TrainingTests/${previousId}`):db().ref('TrainingTests').push(),id=ref.key,a=me()||{},questions={};state.questionDrafts.forEach((q,i)=>questions[`q${i+1}`]={text:q.text.trim(),options:q.options.map(x=>x.trim()),correctIndex:q.correctIndex,source:String(q.source||'').trim(),explanation:String(q.explanation||'').trim()});
    try{
      const archiveBody={schema:'hetk-training-test-v1',kind:'standalone-test',testId:id,title,description,testLanguage:fd.get('testLanguage')||'uz',questionLimit:limit,questions:Object.values(questions),createdAt:Date.now(),createdBy:previousTest?previousTest.createdBy:uid(),createdByName:previousTest?previousTest.createdByName:(a.fullName||a.login||''),createdByRole:previousTest?previousTest.createdByRole:(a.role||'')};
      const oldArchive=previousTest&&previousTest.questionArchive;
      const caption=`HETK O‘quv markazi — TEST SAVOLLARI\n${title}\n${state.questionDrafts.length} ta savol`;
      let questionArchive;
      if(oldArchive&&oldArchive.fileId){
        if(!Number(oldArchive.messageId))throw new Error('Eski Telegram xabar raqami topilmadi. Dublikat yaratmaslik uchun saqlash to‘xtatildi.');
        const file=new File([JSON.stringify(archiveBody,null,2)],safeArchiveName(`test-${title}-${id}`)+'.json',{type:'application/json'});
        const media=await trainingMediaReplace(file,'document',oldArchive.messageId,caption,id);
        if(Number(media.messageId)&&Number(media.messageId)!==Number(oldArchive.messageId))throw new Error('Telegram eski xabarni joyida almashtirmadi. Tekshirish zarur.');
        questionArchive={...media,messageId:oldArchive.messageId,storage:'training-media',format:'json',fileName:file.name,recordCount:archiveBody.questions.length,archivedAt:Date.now()};
        state.archiveJson[media.fileId]=archiveBody;
      }else questionArchive=await uploadTrainingJson(archiveBody,`test-${title}-${id}`,caption,id,'question-bank');
      const payload={id,title,description,testLanguage:fd.get('testLanguage')||'uz',announcementMode:fd.get('announcementMode')||'visible',scope,audienceFolders:folderIds.reduce((o,k)=>(o[k]=true,o),{}),audienceRoles:roleIds.reduce((o,k)=>(o[k]=true,o),{}),startAt:draft?0:startAt,endAt:draft?0:startAt+duration*60000,durationMinutes:duration||30,questionLimit:draft?state.questionDrafts.length:limit,totalQuestions:state.questionDrafts.length,answerReviewSecondsPerQuestion:30,status:draft?'draft':'scheduled',questionStorage:'telegram',questionArchive:{...questionArchive,archiveKind:'standalone-test',testId:id},createdAt:previousTest?previousTest.createdAt:firebase.database.ServerValue.TIMESTAMP,updatedAt:firebase.database.ServerValue.TIMESTAMP,createdBy:previousTest?previousTest.createdBy:uid(),createdByName:previousTest?previousTest.createdByName:(a.fullName||a.login||''),createdByRole:previousTest?previousTest.createdByRole:(a.role||'')};
      await db().ref(`TrainingTests/${id}`).set(payload);state.tests[id]={...payload,createdAt:previousTest?previousTest.createdAt:Date.now()};state.questionBanks[id]=questions;const noticeCount=draft?0:await notifyScheduledTest(payload);state.editorDraft=null;state.editingTestId='';state.createdListOpen=true;state.questionDrafts=[blankQuestion()];toast(draft?'Qoralama Telegram arxiviga saqlandi.':noticeCount?`Test Telegramga saqlandi va rejalashtirildi. ${noticeCount} nafar xodim ogohlantirildi.`:'Test Telegramga saqlandi, ammo xodimlarga ogohlantirish yuborilmadi.',noticeCount||draft?'success':'error');setTimeout(()=>{const c=document.querySelector('[data-training-content]');c.innerHTML=renderCreated();applyUiLanguage(c);bindDynamic();},300);
    }catch(err){toast('Test Telegram arxiviga saqlanmadi: '+err.message,'error');}
  }
  async function notifyScheduledTest(test){
    const recipients=new Map(),allowedRoles=new Set(Object.keys(test.audienceRoles||{}));
    const accept=(id,user)=>{if(!id||id===uid())return;if(user&&user.active===false)return;if(allowedRoles.size&&(!user||!allowedRoles.has(user.role)))return;recipients.set(id,user||{});};
    if(test.scope==='republic'){
      try{const snap=await db().ref('users').once('value');snap.forEach(child=>accept(child.key,child.val()||{}));}catch(err){console.warn('Respublika xodimlari olinmadi:',err);}
    }else{
      for(const rootId of Object.keys(test.audienceFolders||{})){try{const snap=await db().ref(`UsersByAncestor/${rootId}`).once('value');snap.forEach(child=>accept(child.key,child.val()||{}));}catch(err){console.warn('Hudud xodimlari olinmadi:',rootId,err);}}
    }
    try{
      const noticeId=db().ref('UserNotifications').push().key,hidden=test.announcementMode==='hidden',payload={id:noticeId,kind:'activity',action:'training_test_scheduled',read:false,title:hidden?'Yashirin onlayn test rejalashtirildi':`${test.title} testi rejalashtirildi`,commentText:`Boshlanish: ${fmt(test.startAt)}. Davomiyligi: ${test.durationMinutes} daqiqa. Test boshlangach kechikkan vaqt qaytarilmaydi.`,createdAt:Date.now(),expiresAt:test.endAt+30*24*60*60*1000},updates={};
      recipients.forEach((user,id)=>{updates[`UserNotifications/${id}/${noticeId}`]=payload;updates[`TrainingTestAccess/${test.id}/${id}`]={uid:id,fullName:user.fullName||user.login||'',role:user.role||'',roleLabel:user.roleLabel||roleLabel(user.role),folders:user.folders||{},notifiedAt:Date.now()};updates[`TrainingTestAccessByUser/${id}/${test.id}`]=true;});await db().ref().update(updates);
      if(window.HETKPush&&typeof window.HETKPush.safeSendToUsers==='function'){try{await window.HETKPush.safeSendToUsers([...recipients.keys()],'notifications',payload.title,payload.commentText,{action:'training_test_scheduled',testId:test.id});}catch(err){console.warn('Push yuborilmadi:',err);}}
      return recipients.size;
    }catch(err){console.warn('Test ogohlantirishi yuborilmadi:',err);return 0;}
  }
  async function cancelTest(id){const t=state.tests[id];if(!t||t.createdBy!==uid())return toast('Bu testni bekor qilish huquqi yo‘q.','error');if(!confirm('Rejalashtirilgan test bekor qilinsinmi?'))return;try{await db().ref(`TrainingTests/${id}/status`).set('cancelled');toast('Test bekor qilindi.','success');}catch(err){toast(err.message,'error');}}
  async function submitExam(form,automatic){if(state.examSubmitting)return;state.examSubmitting=true;try{
    const t=state.tests[state.activeTestId];if(!t||(statusOf(t)!=='live'&&!canPractice(t)))return toast('Test vaqti tugagan.','error');captureExamAnswer();if(!automatic&&!confirm('Testni yakunlaysizmi? Javobsiz savollar noto‘g‘ri hisoblanadi. Keyin javoblarni o‘zgartirib bo‘lmaydi.'))return;const questions=state.examQuestions.length?state.examQuestions:questionSet(t),answers={};if(!questions.length)return toast('Savollar yuklanmagan. Test yakunlanmadi.','error');if(questions.some(q=>q.correctIndex===null||!Number.isInteger(Number(q.correctIndex))))return toast('Test savollarining to‘g‘ri javob kaliti topilmadi. Natija saqlanmadi. Testni yaratuvchi savollarni tekshirishi kerak.','error');let correct=0;questions.forEach(q=>{const selected=state.examConfirmed[q.id]&&Object.prototype.hasOwnProperty.call(state.examAnswers,q.id)?Number(state.examAnswers[q.id]):null,correctIndex=Number(q.correctIndex),ok=selected!==null&&Number.isInteger(correctIndex)&&selected===correctIndex;if(ok)correct++;if(selected===null)return;answers[q.id]={question:q.text,selectedIndex:selected,selectedText:selected===null?'':q.options.find(o=>o.index===selected)?.text||'',correctText:q.options.find(o=>o.index===Number(q.correctIndex))?.text||'',correct:ok,source:q.source||'',explanation:q.explanation||''};});const percent=Math.round(correct/questions.length*100),submittedAt=Date.now(),payload={uid:uid(),fullName:(me()||{}).fullName||(me()||{}).login||'',testId:t.id,questionCount:questions.length,correctCount:correct,percent,submittedAt,automatic:!!automatic,folderIds:ownRoots().reduce((o,k)=>(o[k]=true,o),{}),role:(me()||{}).role||''};try{if(t.status==='draft'){
      if(!isSuperAdmin()&&isPractice(t)){
        const attemptId=db().ref(`TrainingPracticeAttempts/${t.id}/${uid()}`).push().key;
        await db().ref(`TrainingPracticeAttempts/${t.id}/${uid()}/${attemptId}`).set({...payload,attemptId});
        state.practiceAttempts[t.id]=state.practiceAttempts[t.id]||{};
        state.practiceAttempts[t.id][uid()]=state.practiceAttempts[t.id][uid()]||{};
        state.practiceAttempts[t.id][uid()][attemptId]={...payload,attemptId};
      }
      state.practicePreview={testId:t.id,percent,correctCount:correct,questionCount:questions.length,submittedAt};state.examReview=answers;state.examReviewDeadline=submittedAt+Object.keys(answers).length*ANSWER_REVIEW_PER_QUESTION_MS;state.examQuestions=[];state.examAnswers={};state.examConfirmed={};state.practiceDeadline=0;
      toast(isSuperAdmin()||!isPractice(t)?`Sinov yakunlandi: ${percent}%. Sinov urinishlari tarixga yozilmadi.`:`Natija: ${percent}%. Urinish tarixga saqlandi.`,'success');repaint();return;
    }
    const attemptId=db().ref(`TrainingLiveAttempts/${t.id}/${uid()}`).push().key;await db().ref().update({[`TrainingResults/${t.id}/${uid()}`]:payload,[`TrainingResultAnswers/${t.id}/${uid()}`]:answers,[`TrainingLiveAttempts/${t.id}/${uid()}/${attemptId}`]:{...payload,attemptId}});state.liveAttempts[t.id]=state.liveAttempts[t.id]||{};state.liveAttempts[t.id][uid()]=state.liveAttempts[t.id][uid()]||{};state.liveAttempts[t.id][uid()][attemptId]={...payload,attemptId};state.results[t.id]=state.results[t.id]||{};state.results[t.id][uid()]=payload;state.examReview=answers;state.examReviewDeadline=submittedAt+Object.keys(answers).length*ANSWER_REVIEW_PER_QUESTION_MS;state.retryLive=false;state.answerDetails[t.id]=answers;toast(automatic?'Vaqt tugadi. Javoblaringiz saqlandi.':'Test natijasi saqlandi.','success');repaint();}catch(err){toast('Natija saqlanmadi: '+err.message,'error');}
  }finally{state.examSubmitting=false;}
  }
  async function showRanking(testId){const t=state.tests[testId];if(!t||(t.createdBy!==uid()&&!isSuperAdmin()))return toast('Statistikani faqat test yaratuvchisi ko‘radi.','error');const group=t.status==='draft'?Object.fromEntries(Object.keys(state.practiceAttempts[testId]||{}).map(k=>[k,lastPractice(testId,k)]).filter(x=>x[1])):state.results[testId]||{},rows=Object.values(group).sort((a,b)=>(b.percent-a.percent)||((a.submittedAt||0)-(b.submittedAt||0))),access={};try{const snap=await db().ref(`TrainingTestAccess/${testId}`).once('value');snap.forEach(child=>access[child.key]=child.val()||{});}catch(_){}const completed=new Set(rows.map(r=>r.uid)),absentRows=Object.values(access).filter(a=>!completed.has(a.uid));const total=t.status==='draft'?rows.length:(Object.keys(access).length||rows.length),absent=t.status==='draft'?0:absentRows.length,content=document.querySelector('[data-training-content]');state.createdListOpen=true;content.innerHTML=`<div class="hetk-training-page-head"><div><h3>${esc(t.title)} — statistika</h3><p>Biriktirilgan: ${total} nafar · Topshirgan: ${rows.length} nafar · Qatnashmagan: ${absent} nafar.</p></div><button class="hetk-training-secondary" type="button" data-show-created>Ortga</button></div><div class="hetk-training-ranking-layout"><div><h3>Reyting</h3><div class="hetk-training-ranking">${rows.length?rows.map((r,i)=>`<article><b>${i+1}</b><div><h4>${esc(r.fullName||'Hodim')}</h4><p>${esc(roleLabel(r.role)||'')} · ${r.correctCount}/${r.questionCount} to‘g‘ri · ${fmt(r.submittedAt)}${t.status==='draft'?` · ${practiceHistory(testId,r.uid).length} urinish`:` · ${Math.max(1,liveHistory(testId,r.uid).length)} urinish`}</p>${t.status==='draft'?`<details><summary>Barcha urinishlar</summary>${practiceHistory(testId,r.uid).map((h,i)=>`<div>${i+1}. ${fmt(h.submittedAt)} — ${h.correctCount}/${h.questionCount} (${h.percent}%)</div>`).join('')}</details>`:liveHistory(testId,r.uid).length?`<details><summary>Jonli urinishlar tarixi</summary>${liveHistory(testId,r.uid).map((h,i)=>`<div>${i+1}. ${fmt(h.submittedAt)} — ${h.correctCount}/${h.questionCount} (${h.percent}%)</div>`).join('')}</details>`:''}</div><strong>${r.percent}%</strong></article>`).join(''):empty('fa-users-slash','Natija yo‘q','Bu testni hali hech kim topshirmagan.')}</div></div><aside class="hetk-training-absent"><h3>${t.status==='draft'?'Mashq statistikasi':'Qatnashmaganlar'}</h3>${t.status==='draft'?`<p>Jami urinishlar: ${practiceHistory(testId).length}</p>`:''}${t.status!=='draft'&&absentRows.length?absentRows.map(a=>`<div><b>${esc(a.fullName||'Hodim')}</b><span>${esc(a.roleLabel||roleLabel(a.role)||'')}</span></div>`).join(''):'<p>Qatnashmagan xodim yo‘q.</p>'}</aside></div>`;applyUiLanguage(content);}

  document.addEventListener('click',e=>{const b=e.target&&e.target.closest?e.target.closest('#profile-training'):null;if(b){e.preventDefault();open();}},true);document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});window.HETKTraining={open,close,canCreate,statusOf};
})();
