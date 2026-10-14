'use strict';
const $ = id => document.getElementById(id);
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

// Въпросите се зареждат от db.json (в closed въпросите първият отговор е верният – показват се разбъркани).
const SUBJ = { mat: 'Математика', bel: 'БЕЛ' };
const TIME = { closed: 60, open: 120, m2: 600 }; // секунди: затворен 1 мин, отворен 2 мин, модул 2 – 10 мин
const M1_CLOSED = 10, M1_OPEN = 5, M2_COUNT = 5;  // модул 1 = 15 задачи, модул 2 = 5 задачи (общо 20)

// [дума, верен отговор, грешен, грешен]
const WORDS = [
  ['айдук', 'хайдутин, разбойник', 'вид пискюл на фес', 'стар казан за ракия'],
  ['дерибей', 'местен феодален господар', 'дървен мост', 'вид зимнина'],
  ['чеверме', 'печено на шиш цяло агне', 'тракийски танц', 'стара каруца'],
  ['чорбаджия', 'богат първенец в селото', 'готвач на чорби', 'ученик от трети клас'],
  ['конак', 'турска административна сграда', 'дървен стол', 'вид баница'],
  ['каймакам', 'управител на околия', 'каймак на кафе', 'стар занаятчия'],
  ['заптие', 'турски полицай', 'запетая', 'вид облекло'],
  ['башибозук', 'нередовна войска', 'вид турски сладкиш', 'лош човек'],
  ['еснаф', 'сдружение на занаятчии', 'мързелив човек', 'вид търговец на коне'],
  ['гайтани', 'плетени шнурове за украса', 'гайди', 'вид гайка'],
  ['яхър', 'обори за конете', 'вид манджа', 'дървена лъжица'],
  ['синия', 'ниска кръгла маса за хранене', 'синя боя', 'вид коприна'],
  ['чикрик', 'уред за предене и навиване', 'вид птица', 'дървена порта'],
  ['ханджар', 'дълъг двоен нож или кама', 'хазяин на хан', 'вид ограда'],
  ['софра', 'сложена маса за ядене', 'куфар за дрехи', 'вид шиш'],
  ['гюле', 'железно оръдейно гюле', 'вид цвете', 'голяма купа'],
  ['кесия', 'торбичка за пари', 'вид чанта', 'памучна кърпа'],
  ['сермиа', 'стока или паричен капитал', 'вид услуга', 'съндък за инструменти']
];
const bad = [
  'Сериозно ли? Това го учат в 4. клас, ама сигурно си бил зает да скролваш TikTok.',
  'Родителите ти плащат ли за частни уроци, или хвърлят парите на вятъра?',
  'Грешно. Калкулаторът в телефона ти плаче от срам.',
  'Баба ти би го решила със затворени очи, докато меси питка.',
  'Уверено и грешно – идеалната комбинация за НВО.'
];
const good = ['Вярно. Сигурно е късмет.', 'Познал си. Не се главозамайвай.', 'Правилно… но не го казвай на никого, ще ми развалиш репутацията.'];
const FRUIT = ['ябълки', 'круши', 'сливи', 'дини', 'картофи', 'кисели краставички', 'слончета'];

let DB, Q, subj, mod, i, score, rage, tl, tid, ft, hadRight, typos, muted = false;
let want = false, st = 'ok', tapped = false, unlocked = false, priming = false, chk, cht, chaseCb;
let inQuiz = false;
let fsWarnings = 0;

// ---------- Чичко Професор ----------
function say(t) {
  const a = $('avatar');
  $('bubble').textContent = t;
  a.textContent = pick(['🧐', '😒', '🙄', '🤨', '😏']);
  a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake');
}
function bump(n) {
  rage = Math.min(100, rage + n);
  $('rageBar').style.width = rage + '%';
  document.body.classList.toggle('angry', rage >= 70);
  if (rage >= 100) {
    rage = 0;
    $('rageBar').style.width = '0%';
    document.body.classList.remove('angry');
    endChase();
    say(pick([
      'Ех, съжалявам те вече... толкова опити и пак нищо. Мъка! Ето, чистим барометъра и ти давам нов шанс на същия въпрос.',
      'Сърцето ми се къса да те гледам как се мъчиш с тоя плейър. Поемаме си въздух, нулираме бара и пробваш пак!',
      'Жалко ми е за теб, наистина! Оставям те на мира с музиката – ето ти въпроса наново, дано този път имаш повече късмет.'
    ]));
    setTimeout(showQ, 4500);
  }
}
function panel(id) { ['card', 'captcha', 'result'].forEach(p => $(p).hidden = p !== id); }
function lock(v) { document.querySelectorAll('#answers button,#free input,#free button').forEach(e => e.disabled = v); }
function btn(text, fn, cls) {
  const b = document.createElement('button');
  b.textContent = text; b.onclick = fn; if (cls) b.className = cls;
  return b;
}

// ---------- Чалга (локален файл chalga.mp3) ----------
const SND = $('chalga');
const UNLOCK_EV = ['pointerdown', 'mousedown', 'touchend', 'click', 'keydown'];

function applyMute() { SND.muted = priming || muted; }
function paint() {
  $('musicBox').classList.toggle('idle', st !== 'ok');
  $('mbNote').textContent = st === 'tap' ? '🎵 Натисни ме, за да пусна чалгата!'
    : st === 'fail' ? '⚠️ Звукът не тръгна (има ли chalga.mp3 до index.html?). Натисни ме, за да продължиш'
    : '🎵 Чалга! Натисни ме, за да спра';
  $('mbHit').setAttribute('aria-label', st === 'tap' ? 'Натисни плейъра, за да пусне музиката'
    : st === 'fail' ? 'Звукът не тръгна. Натисни плейъра, за да продължиш' : 'Натисни плейъра, за да спре музиката');
}
function stuck() {
  if (!want) return;
  st = SND.error || tapped ? 'fail' : 'tap'; paint();
}
function play(fromStart) {
  applyMute(); SND.volume = 1;
  if (SND.error) SND.load();
  if (fromStart) { try { SND.currentTime = 0; } catch (e) {} }
  let p; try { p = SND.play(); } catch (e) { p = Promise.reject(e); }
  if (p && p.catch) p.catch(err => { if (!(err && err.name === 'AbortError')) stuck(); });
}
function arm() {
  clearTimeout(chk);
  chk = setTimeout(() => { if (want && SND.currentTime === 0) stuck(); }, 3000);
}
function music(on) {
  want = on; clearTimeout(chk);
  if (on) {
    st = 'ok'; tapped = false; $('mpFill').style.width = '0'; paint();
    play(true); arm();
  } else {
    SND.pause(); try { SND.currentTime = 0; } catch (e) {}
  }
}
SND.addEventListener('playing', () => { if (want) { st = 'ok'; paint(); } });
SND.addEventListener('timeupdate', () => { if (want && SND.duration) $('mpFill').style.width = (SND.currentTime / SND.duration * 100) + '%'; });
SND.addEventListener('error', () => { if (want) stuck(); });

function unlock() {
  if (unlocked || priming || want) return;
  if (navigator.userActivation && !navigator.userActivation.isActive) return;
  priming = true; applyMute();
  const end = ok => {
    priming = false;
    if (ok) { unlocked = true; UNLOCK_EV.forEach(e => document.removeEventListener(e, unlock, true)); }
    if (!want) { SND.pause(); try { SND.currentTime = 0; } catch (e) {} }
    applyMute();
  };
  let p; try { p = SND.play(); } catch (e) { p = Promise.reject(e); }
  p && p.then ? p.then(() => end(true), () => end(false)) : end(true);
}
UNLOCK_EV.forEach(e => document.addEventListener(e, unlock, { capture: true, passive: true }));
$('mute').onclick = () => {
  say(pick([
    'Спри звука? Да не би да преча на тишината в празната ти глава?',
    'Бутонът за спиране на звука е декоративен – точно като дипломата ти за НВО.',
    'Натискай колкото искаш. Чалгата е за душата!',
    'Опитваш се да го спреш? На НВО няма бутон за заглушаване на съдбата.',
    'Наивно е да мислиш, че този бутон работи.'
  ]));
};

// ---------- Плейърът, който бяга ----------
const DODGE_R = 110, COOLDOWN = 450;
const TAUNTS = ['Мръдна ли? Мръдна. 😏', 'Твърде бавен си.', 'Не си и помисляй.', 'Почти. Не.', 'Тук ли бях? Вече не.', 'Мишката ти има ли батерия?', 'Ха! Опитай пак.', 'Така ли ще вземеш НВО?'];
let ptr = null, lastDodge = 0, lastTaunt = 0, dodges = 0;
function placeX(away) {
  const x = $('musicBox'), w = (x.offsetWidth || 280), h = (x.offsetHeight || 190);
  const maxX = Math.max(0, innerWidth - w - 8), maxY = Math.max(0, innerHeight - h - 8);
  let best = null, bd = -1;
  for (let k = 0; k < (away && ptr ? 14 : 1); k++) {
    const c = { x: 8 + Math.random() * maxX, y: 8 + Math.random() * maxY };
    const d = ptr ? Math.hypot(c.x + w / 2 - ptr.x, c.y + h / 2 - ptr.y) : 0;
    if (d > bd) { bd = d; best = c; }
  }
  x.style.left = best.x + 'px'; x.style.top = best.y + 'px';
}
function dodge() {
  const x = $('musicBox');
  lastDodge = performance.now(); dodges++;
  placeX(true);
  if (lastDodge - lastTaunt > 3500 && Math.random() < .5) { lastTaunt = lastDodge; say(pick(TAUNTS)); }
  bump(1.6);
}
function hop() {
  if (st === 'ok') placeX(true); else placeX(false);
  if (want && st === 'ok' && SND.paused && !SND.error) play(false);
  clearInterval(cht); cht = setInterval(hop, 500 + Math.random() * 600 - Math.min(250, dodges * 15));
}
function nearBox(e) {
  const r = $('musicBox').getBoundingClientRect();
  return e.clientX > r.left - DODGE_R && e.clientX < r.right + DODGE_R && e.clientY > r.top - DODGE_R && e.clientY < r.bottom + DODGE_R;
}
document.addEventListener('pointermove', e => {
  ptr = { x: e.clientX, y: e.clientY };
  if (!want || st !== 'ok' || $('musicBox').hidden) return;
  if (nearBox(e) && performance.now() - lastDodge > COOLDOWN) dodge();
}, { passive: true });
$('mbHit').addEventListener('pointerdown', e => {
  ptr = { x: e.clientX, y: e.clientY };
});
function chase(cb) {
  chaseCb = cb; dodges = 0; lastDodge = performance.now();
  const x = $('musicBox');
  x.hidden = false;
  placeX(true); clearInterval(cht); cht = setInterval(hop, 900);
  music(true);
}
function endChase() {
  clearInterval(cht); music(false);
  $('musicBox').hidden = true;
}
$('mbHit').onclick = () => {
  if (st === 'tap') {
    tapped = true; st = 'ok'; paint(); play(true); arm();
    return;
  }
  const cb = chaseCb; chaseCb = null;
  endChase();
  say('Хванат! Музиката спря. Ако знаеше и отговора, щеше да е още по-хубаво.');
  if (cb) setTimeout(cb, 1200);
};

// Защити срещу излизане от фокус, табове и клавишни комбинации по време на теста
let focusWarnings = 0;

document.addEventListener('visibilitychange', () => {
  if (inQuiz && document.hidden) {
    score = Math.max(0, score - 2);
    const counterEl = $('counter');
    if (counterEl && counterEl.textContent && SUBJ && SUBJ[subj]) {
      counterEl.textContent = `${SUBJ[subj]} · Модул ${mod} · Задача ${i + 1}/${Q.length} (Верни: ${score})`;
    }
    say('Опит за превключване на таб или минимизиране! Санкция: -2 точки!');
    bump(5);
  }
});

window.addEventListener('blur', () => {
  if (inQuiz) {
    score = Math.max(0, score - 2);
    const counterEl = $('counter');
    if (counterEl && counterEl.textContent && SUBJ && SUBJ[subj]) {
      counterEl.textContent = `${SUBJ[subj]} · Модул ${mod} · Задача ${i + 1}/${Q.length} (Верни: ${score})`;
    }
    say('Загуби фокус на прозореца (кликна горе или в друг прозорец)! Санкция: -2 точки!');
    bump(5);
  }
});

document.addEventListener('keydown', e => {
  if (!inQuiz) return;
  // Блокиране на клавишни комбинации за превключване, излизане, девелопърски инструменти
  if (
    e.key === 'F11' || 
    e.key === 'Escape' || 
    (e.altKey && e.key === 'Tab') || 
    (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
    (e.ctrlKey && (e.key === 'u' || e.key === 'U' || e.key === 'r' || e.key === 'R'))
  ) {
    e.preventDefault();
    say('Хей! Опит за забранена клавишна комбинация на НВО!'); // без bump(): иначе спамът пълни бара и дава безплатен refresh на въпроса
  }
});

document.addEventListener('fullscreenchange', () => {
  if (inQuiz && !document.fullscreenElement) {
    fsWarnings++;
    if (fsWarnings <= 2) {
      say(`Предупреждение ${fsWarnings}/2: Излезе от цял екран! При следващо излизане ще губиш точки! Кликни където и да е, за да влезеш пак.`);
    } else {
      score = Math.max(0, score - 1);
      const counterEl = $('counter');
      if (counterEl && counterEl.textContent && SUBJ && SUBJ[subj]) {
        counterEl.textContent = `${SUBJ[subj]} · Модул ${mod} · Задача ${i + 1}/${Q.length} (Верни: ${score})`;
      }
      say('Отново излезе от цял екран! Наказание: -1 точка от резултата. Кликни където и да е, за да влезеш пак.');
    }
  }
});

document.addEventListener('click', () => {
  if (inQuiz && !document.fullscreenElement) {
    try {
      document.documentElement.requestFullscreen().catch(() => {});
    } catch(e) {}
  }
});

// ---------- Меню: предмет → модул ----------
async function loadDb() {
  if (DB) return DB;
  try {
    const r = await fetch('db.json');
    if (!r.ok) throw new Error('db.json');
    DB = await r.json();
  } catch (e) {
    if (!window.DB_DATA) throw e;
    DB = window.DB_DATA;
  }
  return DB;
}
function intro() {
  inQuiz = false; fsWarnings = 0;
  clearInterval(tid); clearTimeout(ft); chaseCb = null; endChase();
  i = 0; score = 0; rage = 0; bump(0); panel('card');
  $('counter').textContent = ''; $('timer').textContent = '';
  $('free').hidden = true;
  $('question').textContent = 'Пробно НВО – избери предмет';
  $('answers').replaceChildren(
    btn('📐 Математика', () => pickModule('mat')),
    btn('📖 Български език и литература (БЕЛ)', () => pickModule('bel'))
  );
  say('Здравей, бъдещ гений! Аз съм Чичко Професор и ще ти помогна. Много.');
  loadDb().catch(() => {});
}
function pickModule(s) {
  subj = s;
  $('question').textContent = `${SUBJ[s]} – избери модул`;
  $('answers').replaceChildren(
    btn(`Модул 1 – ${M1_CLOSED + M1_OPEN} задачи (затворени 1 мин., отворени 2 мин.)`, () => begin(1)),
    btn(`Модул 2 – ${M2_COUNT} задачи (по 10 мин.)`, () => begin(2)),
    btn('← Назад', intro)
  );
  say('Модул 1 или модул 2? Все едно – и в двата ще се изложиш.');
}
function begin(m) {
  mod = m;
  inQuiz = true;
  fsWarnings = 0;
  try {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  } catch (e) {}
  loadDb().then(db => {
    const pool = db.filter(q => q.subject === subj && q.module === mod);
    const take = (t, n) => shuffle(pool.filter(q => q.type === t)).slice(0, n);
    Q = mod === 1 ? [...take('closed', M1_CLOSED), ...take('open', M1_OPEN)] : take('open', M2_COUNT);
    Q = shuffle(Q).map(q => ({ ...q, time: mod === 2 ? TIME.m2 : q.type === 'open' ? TIME.open : TIME.closed }));
    i = 0; score = 0; showQ();
  }).catch(() => {
    $('question').textContent = 'Не мога да заредя db.json. Увери се, че db.json и db.js са в същата папка.';
    $('answers').replaceChildren(btn('← Назад', intro));
  });
}

// ---------- Поток на играта ----------
function showQ() {
  const q = Q[i];
  panel('card');
  $('counter').textContent = `${SUBJ[subj]} · Модул ${mod} · Задача ${i + 1}/${Q.length} (Верни: ${score})`;
  $('question').textContent = q.q;
  $('free').hidden = q.type !== 'open';
  $('freeInput').value = ''; hadRight = false; typos = 0;
  $('answers').replaceChildren();
  if (q.type === 'closed') {
    const opts = [];
    shuffle(q.a.map((t, k) => [t, k === 0])).forEach(([t, ok]) => {
      const b = btn(t, () => { b.classList.add(ok ? 'ok' : 'no'); finish(ok); });
      opts.push([b, ok]);
      $('answers').append(b);
    });
    // ТОТО: случаен отговор – ако е верен, продължава; ако не, следва бягащият плейър
    $('answers').append(btn('🎰 Играй на ТОТО', () => {
      const [b, ok] = pick(opts);
      b.classList.add(ok ? 'ok' : 'no');
      finish(ok, ok ? 'ТОТО печели! Късметлия. Утре играй и на лотарията.' : 'ТОТО не ти провървя. Късметът не пише НВО вместо теб.');
    }));
  }
  lock(false);
  say(pick(['Давай, давай. Часовникът тиктака.', 'Лесна е. Ама за те бо – не знам.', 'Ако не знаеш, познавай. Така или иначе ще ти се подиграя.']));
  countdown(q.time);
}

function countdown(sec) {
  clearInterval(tid); tl = sec; tick();
  tid = setInterval(() => {
    tl--; tick();
    if (tl <= 0) { clearInterval(tid); finish(false, 'Времето изтече! Малко музика да ти раздвижи мозъка.'); }
  }, 1000);
}
function tick() {
  const m = Math.floor(tl / 60), s = String(tl % 60).padStart(2, '0');
  $('timer').textContent = `⏱ ${m}:${s}`;
  $('timer').className = tl <= 10 ? 'low' : '';
}

function next() { i++; i < Q.length ? captcha() : result(); }

function finish(ok, msg) {
  clearInterval(tid); clearTimeout(ft); lock(true);
  if (ok) {
    score++;
    say(msg || pick(good));
    setTimeout(next, 2200);
  } else {
    bump(12);
    say((msg || pick(bad)) + ' Музиката спира само ако хванеш бягащия плейър и го натиснеш.');
    chase(next);
  }
}

// ---------- Проверка на слуха (звукова капча) ----------
const AC = window.AudioContext || window.webkitAudioContext;
let capCtx = null, capOsc = [], capTok = 0, capT;
function stopBeeps() {
  capTok++; clearTimeout(capT);
  capOsc.forEach(o => { try { o.stop(); } catch (e) {} });
  capOsc = [];
}
function playBeeps(n) {
  stopBeeps();
  const tok = capTok;
  if (!capCtx) capCtx = new AC();
  const go = () => {
    if (tok !== capTok) return;
    const t0 = capCtx.currentTime + 0.15;
    for (let k = 0; k < n; k++) {
      const o = capCtx.createOscillator(), g = capCtx.createGain(), t = t0 + k * 0.6;
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.02);
      g.gain.setValueAtTime(0.5, t + 0.28);
      g.gain.linearRampToValueAtTime(0, t + 0.32);
      o.connect(g); g.connect(capCtx.destination);
      o.start(t); o.stop(t + 0.35);
      capOsc.push(o);
    }
  };
  capCtx.resume().then(go, go);
}

// ---------- Капча от ада ----------
function captcha() {
  stopBeeps();
  panel('captcha');
  const box = $('capBox');
  box.replaceChildren();
  say('Първо докажи, че не си робот. Роботите, за разлика от теб, са чели Вазов.');
  let mode = Math.random();
  if (!AC && mode >= 0.75) mode = Math.random() * 0.75;
  if (mode < 0.25) {
    const [w, ...o] = pick(WORDS);
    $('capQ').textContent = `Какво означава архаизмът „${w}“?`;
    shuffle(o.map((t, k) => [t, k === 0])).forEach(([t, ok]) => box.append(btn(t, () => ok ? showQ() : fail())));
  } else if (mode < 0.5) {
    const capPrompts = [
      ['Маркирай всички баби, които викат „Едно време какви домати имаше!“:', '👵', ['👴', '🧒', '📱', '🍲', '🧶', '📺', '🎮']],
      ['Избери всички филии с лютеница и сирене:', '🍞', ['🍕', '🍔', '🌮', '🍩', '🥐', '🍦', '🍣']],
      ['Посочи всички двойки в бележника:', '2️⃣', ['5️⃣', '6️⃣', '4️⃣', '💯', '⭐', '🥇', '🏆']],
      ['Маркирай всички моменти, когато майка ти казва „Махни се от тоя компютър!“:', '🖥️', ['📚', '🚴', '⚽', '🎒', '🎨', '🎸', '🧹']],
      ['Избери всички празни джобове преди джобните:', '👖', ['💰', '💳', '💎', '🪙', '💵', '🎁', '👑']],
      ['Маркирай всички ученици, които преписват в задната редица:', '🙈', ['🤓', '🎓', '✍️', '📖', '💻', '💡', '🏆']],
      ['Посочи всички чаши с топло кафе за учителката по математика:', '☕', ['🧃', '🥤', '🍼', '🍧', '🍺', '🧊', '🍹']],
      ['Избери всички скъсани кецове от часовете по физическо:', '👟', ['👞', '👠', '👡', '👢', '👑', '💍', '🕶️']]
    ];
    const [title, target, decoysList] = pick(capPrompts);
    $('capQ').textContent = title;
    const g = 2 + Math.floor(Math.random() * 2);
    const decoys = Array.from({ length: 9 - g }, () => pick(decoysList));
    const grid = document.createElement('div');
    grid.className = 'grid';
    shuffle([...Array(g).fill(target), ...decoys]).forEach(e => grid.append(btn(e, ev => ev.currentTarget.classList.toggle('sel'), 'tile')));
    box.append(grid, btn('Потвърждавам, че съм човек', () => {
      [...grid.children].every(b => b.classList.contains('sel') === (b.textContent === target)) ? showQ() : fail();
    }));
  } else if (mode < 0.75) {
    const mathCaps = [
      { q: 'Колко прави 2 + 2 · 2 ? (Роботите си мислят, че е 8)', ok: '6', bad: ['8', '4', '16'] },
      { q: 'Колко дни има февруари в невисокосна година?', ok: '28', bad: ['29', '30', '31'] },
      { q: 'Кой е главният град на България?', ok: 'София', bad: ['Пловдив', 'Варна', 'Дубай'] },
      { q: 'Колко е 10 на степен 0?', ok: '1', bad: ['0', '10', '00'] },
      { q: 'Кое число е четно?', ok: '42', bad: ['13', '27', '99'] },
      { q: 'Колко ъгъла има правилен шестоъгълник?', ok: '6', bad: ['5', '8', '4'] },
      { q: 'Кое е най-малкото двуцифрено число?', ok: '10', bad: ['1', '99', '11'] },
      { q: 'Коя е първата буква в българската азбука?', ok: 'А', bad: ['Б', 'Я', 'Z'] },
      { q: 'Колко минути има в един час?', ok: '60', bad: ['100', '50', '24'] }
    ];
    const item = pick(mathCaps);
    $('capQ').textContent = item.q;
    shuffle([item.ok, ...item.bad]).forEach(ans => {
      box.append(btn(ans, () => ans === item.ok ? showQ() : fail()));
    });
  } else {
    const n = 2 + Math.floor(Math.random() * 5); // 2–6 сигнала
    $('capQ').textContent = 'Чуй сигналите и избери колко пъти звъннаха. Роботите нямат уши!';
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (let k = 1; k <= 6; k++) grid.append(btn(String(k), () => {
      stopBeeps();
      if (k === n) { showQ(); return; }
      score = Math.max(0, score - 2);
      document.querySelectorAll('#capBox button').forEach(b => b.disabled = true);
      say('Грешно! Да не си заглушил таба? Санкция: -2 точки. Включи звука – ето нова капча.');
      setTimeout(captcha, 1500);
    }, 'tile'));
    box.append(btn('🔊 Пусни сигналите', () => playBeeps(n)), grid);
    capT = setTimeout(() => playBeeps(n), 500);
  }
}
function fail() {
  document.querySelectorAll('#capBox button').forEach(b => b.disabled = true);
  say(pick(['Грешка. Робот ли си, или просто не четеш?', 'Не. Ето ти нова капча, може пък този път.', 'Дори роботите се справят по-добре. Нова капча!']));
  setTimeout(captcha, 1500);
}

// ---------- Проверка на свободни отговори ----------
const norm = s => s.toLowerCase().replace(/[„“"'.,!?;:()]/g, ' ').replace(/\s+/g, ' ').trim();
function numOf(s) {
  const m = s.replace(/(\d)[\s ](?=\d{3}(\D|$))/g, '$1').replace(/,/g, '.').match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : NaN;
}
function isRight(q, val) {
  if (q.subject === 'mat') {
    const n = numOf(val);
    return !isNaN(n) && q.accept.some(a => Math.abs(numOf(a) - n) < 1e-9);
  }
  const n = norm(val);
  if (q.accept) return q.accept.some(a => norm(a) === n);
  const toks = n.split(' ');
  return q.keys.every(g => g.some(a => {
    a = a.toLowerCase();
    return a.includes(' ') ? n.includes(a) : a.length < 3 ? toks.includes(a) : toks.some(t => t.startsWith(a));
  }));
}

// ---------- Тихи правописни грешки ----------
const SWAP = { 'ъ': 'а', 'а': 'ъ', 'е': 'и', 'и': 'е', 'о': 'у', 'у': 'о', 'з': 'с', 'с': 'з', 'д': 'т', 'т': 'д', 'б': 'п', 'п': 'б', 'в': 'ф', 'ф': 'в', 'г': 'к', 'к': 'г', 'ж': 'ш', 'ш': 'ж' };
const DSWAP = { '0': '9', '1': '2', '2': '1', '3': '2', '4': '5', '5': '4', '6': '5', '7': '8', '8': '7', '9': '8' }; // съседна клавишна цифра
function typo(str) {
  const spots = [];
  [...str.matchAll(/[а-яА-Я]+/g)].forEach(m => {
    if (m[0].length < 3) return;
    for (let k = 1; k < m[0].length; k++) if (SWAP[m[0][k].toLowerCase()]) spots.push(m.index + k);
  });
  [...str.matchAll(/\d/g)].forEach(m => spots.push(m.index));
  if (!spots.length) return str;
  const p = pick(spots), ch = str[p];
  if (DSWAP[ch]) return str.slice(0, p) + DSWAP[ch] + str.slice(p + 1);
  const r = SWAP[ch.toLowerCase()];
  return str.slice(0, p) + (ch === ch.toLowerCase() ? r : r.toUpperCase()) + str.slice(p + 1);
}
$('freeInput').oninput = () => {
  clearTimeout(ft);
  ft = setTimeout(() => {
    const inp = $('freeInput'), q = Q[i];
    if (!q || typos >= 2 || Math.random() > .3) return;
    const t = typo(inp.value);
    if (t === inp.value) return;
    if (isRight(q, inp.value)) hadRight = true;
    const pos = inp.selectionStart;
    inp.value = t; typos++;
    try { inp.setSelectionRange(pos, pos); } catch (e) {}
  }, 1200);
};
$('freeBtn').onclick = () => {
  clearTimeout(ft);
  const inp = $('freeInput'), q = Q[i];
  let val = inp.value.trim();
  if (!val) return;
  if (q.unit && !/[A-Za-zА-Яа-я%°²³]/.test(val)) {
    const f = pick(FRUIT);
    say(pick([
      `„${val}“ какво? ${f[0].toUpperCase() + f.slice(1)} ли? Мерните единици не растат по дърветата – напиши ги.`,
      `${val} ябълки? Круши? Слончета? В математиката числото без мерна единица е като пътуване без билет.`,
      `Само „${val}“? А ако са ${f}? Напиши мерната единица, не гадай на публиката.`
    ]));
    inp.focus();
    return;
  }
  if (typos < 2 && Math.random() < .3) {
    const t = typo(val);
    if (t !== val) { if (isRight(q, val)) hadRight = true; val = t; inp.value = t; }
  }
  const ok = isRight(q, val);
  finish(ok, ok ? undefined : hadRight
    ? `Правописна грешка! Написаното е „${val}“, а не каквото си си мислел. Внимавай какво пишеш.`
    : undefined);
};

// ---------- Край ----------
function result() {
  panel('result');
  $('score').textContent = `${score} / ${Q.length}`;
  const p = score / Q.length;
  $('verdict').textContent = p >= .8 ? 'Подозрително добре. Преписвал си, нали?'
    : p >= .4 ? 'Средна работа. Точно толкова, колкото очаквах.'
    : 'Предлагам да започнеш подготовката за НВО през 2031.';
  say('Резултатите са готови. Седни. Или не – все ми е едно.');
}
$('again').onclick = intro;

intro();
