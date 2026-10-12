'use strict';
const $ = id => document.getElementById(id);
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

// Първият отговор (c:0) е верният – показват се разбъркани.
const Q = [
  { t: 'Колко е 3/4 + 1/8?', a: ['7/8', '4/12', '1/2', '5/4'] },
  { t: 'Решете уравнението 2x − 7 = 15. Колко е x?', a: ['11', '4', '22', '8'] },
  { t: 'Колко процента е числото 18 от числото 72?', a: ['25%', '18%', '36%', '40%'] },
  { t: 'Кой ред съдържа правилно написана дума?', a: ['безспорно', 'беспорно', 'безпорно', 'бесспорно'] },
  { t: 'Напиши фамилията на автора на „Под игото“.', free: 1 }
];
// [дума, верен отговор, грешен, грешен]
const WORDS = [
  ['айдук', 'хайдутин, разбойник', 'вид пискюл на фес', 'стар казан за ракия'],
  ['дерибей', 'местен феодален господар', 'дървен мост', 'вид зимнина'],
  ['чеверме', 'печено на шиш цяло агне', 'тракийски танц', 'стара каруца'],
  ['чорбаджия', 'богат първенец в селото', 'готвач на чорби', 'ученик от трети клас']
];
const bad = [
  'Сериозно ли? Това го учат в 4. клас, ама сигурно си бил зает да скролваш TikTok.',
  'Родителите ти плащат ли за частни уроци, или хвърлят парите на вятъра?',
  'Грешно. Калкулаторът в телефона ти плаче от срам.',
  'Баба ти би го решила със затворени очи, докато меси питка.',
  'Уверено и грешно – идеалната комбинация за НВО.'
];
const good = ['Вярно. Сигурно е късмет.', 'Познал си. Не се главозамайвай.', 'Правилно… но не го казвай на никого, ще ми развалиш репутацията.'];

let i, score, rage, tl, tid, ft, hadRight, ac, master, mt, muted = false;

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
}
function panel(id) { ['card', 'captcha', 'result'].forEach(p => $(p).hidden = p !== id); }
function lock(v) { document.querySelectorAll('#answers button,#free input,#free button').forEach(e => e.disabled = v); }
function btn(text, fn, cls) {
  const b = document.createElement('button');
  b.textContent = text; b.onclick = fn; if (cls) b.className = cls;
  return b;
}

// ---------- Звук (синтезиран – без външни файлове) ----------
function audio() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      master = ac.createGain();
      master.gain.value = muted ? 0 : .3; // умерена сила заради слуха; вдигни при нужда
      master.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (e) { ac = null; }
}
function tone(f, d, type = 'sawtooth', v = .5) {
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
  o.type = type; o.frequency.value = f; l.frequency.value = 7; lg.gain.value = f * .02; // дразнещо вибрато
  l.connect(lg); lg.connect(o.frequency); o.connect(g); g.connect(master);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.start(t); l.start(t); o.stop(t + d); l.stop(t + d);
}
function music(on) { // ориенталска гама + дундуркащ бас = „чалга“ от ада
  clearInterval(mt);
  if (!on) return;
  audio(); if (!ac) return;
  const sc = [0, 1, 4, 5, 7, 8, 10, 12]; let n = 3, s = 0;
  mt = setInterval(() => {
    n = Math.max(0, Math.min(7, n + Math.floor(Math.random() * 5) - 2));
    tone(220 * 2 ** (sc[n] / 12), .22);
    if (s % 2 === 0) tone(90, .15, 'sine', .9);
    if (s % 4 === 3) tone(1800, .04, 'square', .2);
    s++;
  }, 230);
}
$('mute').onclick = () => {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : .3;
  $('mute').textContent = muted ? '🔊 Върни звука' : '🔇 Спри звука';
};

// ---------- Поток на играта ----------
function intro() {
  i = 0; score = 0; rage = 0; bump(0); panel('card');
  $('counter').textContent = ''; $('timer').textContent = '';
  $('question').textContent = 'Пробно НВО за 7. клас – БЕЛ и математика';
  $('free').hidden = $('giveUp').hidden = true;
  $('answers').replaceChildren(btn('Започвам (с бодро сърце)', () => { audio(); showQ(); }));
  say('Здравей, бъдещ гений! Аз съм Чичко Професор и ще ти помогна. Много.');
}

function showQ() {
  const q = Q[i];
  panel('card');
  $('counter').textContent = `Задача ${i + 1}/${Q.length}`;
  $('question').textContent = q.t;
  $('giveUp').hidden = true;
  $('free').hidden = !q.free;
  $('freeInput').value = ''; hadRight = false;
  $('answers').replaceChildren();
  if (!q.free) {
    shuffle(q.a.map((t, k) => [t, k === 0])).forEach(([t, ok]) => {
      const b = btn(t, () => { b.classList.add(ok ? 'ok' : 'no'); finish(ok); });
      $('answers').append(b);
    });
  }
  lock(false);
  say(pick(['Давай, давай. Часовникът тиктака.', 'Лесна е. Ама за теб – не знам.', 'Ако не знаеш, познавай. Така или иначе ще ти се подиграя.']));
  countdown();
}

function countdown() {
  clearInterval(tid); tl = 20; tick();
  tid = setInterval(() => { tl--; tick(); if (tl <= 0) { clearInterval(tid); punish(); } }, 1000);
}
function tick() { $('timer').textContent = '⏱ ' + tl + ' с'; $('timer').className = tl <= 5 ? 'low' : ''; }

function punish() { // изненадващо наказание
  lock(true); $('giveUp').hidden = false; music(true); bump(8);
  say('Времето изтече! Малко музика да ти раздвижи мозъка. Спира само ако си признаеш.');
}
$('giveUp').onclick = () => { music(false); $('giveUp').hidden = true; finish(false, 'Поне си честен. Това е първото ти постижение днес.'); };

function finish(ok, msg) {
  clearInterval(tid); lock(true);
  if (ok) score++; else bump(12);
  say(msg || pick(ok ? good : bad));
  setTimeout(() => { i++; i < Q.length ? captcha() : result(); }, 2200);
}

// ---------- Капча от ада ----------
function captcha() {
  panel('captcha');
  const box = $('capBox');
  box.replaceChildren();
  say('Първо докажи, че не си робот. Роботите, за разлика от теб, са чели Вазов.');
  if (Math.random() < .5) {
    const [w, ...o] = pick(WORDS);
    $('capQ').textContent = `Какво означава „${w}“?`;
    shuffle(o.map((t, k) => [t, k === 0])).forEach(([t, ok]) => box.append(btn(t, () => ok ? showQ() : fail())));
  } else {
    $('capQ').textContent = 'Кликни върху всички снимки, на които баба ти обяснява защо в наше време всичко е било по-хубаво.';
    const g = 2 + Math.floor(Math.random() * 2);
    const decoys = Array.from({ length: 9 - g }, () => pick(['👴', '🧒', '📱', '🍲', '🧶', '📺', '🎮']));
    const grid = document.createElement('div');
    grid.className = 'grid';
    shuffle([...Array(g).fill('👵'), ...decoys]).forEach(e => grid.append(btn(e, ev => ev.currentTarget.classList.toggle('sel'), 'tile')));
    box.append(grid, btn('Потвърждавам, че съм човек', () => {
      [...grid.children].every(b => b.classList.contains('sel') === (b.textContent === '👵')) ? showQ() : fail();
    }));
  }
}
function fail() {
  document.querySelectorAll('#capBox button').forEach(b => b.disabled = true);
  bump(6);
  say(pick(['Грешка. Робот ли си, или просто не четеш?', 'Не. Ето ти нова капча, може пък този път.', 'Дори роботите се справят по-добре. Нова капча!']));
  setTimeout(captcha, 1500);
}

// ---------- Гадна автокорекция ----------
const mess = w => w.replace(/в/gi, 'ф').replace(/ъ/gi, 'а').replace(/щ/gi, 'шт').replace(/и/gi, 'ы');
const SHAME = 'Ти пак ли ще се излагаш пред националната комисия?';
$('freeInput').oninput = () => {
  clearTimeout(ft);
  ft = setTimeout(() => {
    const inp = $('freeInput');
    if (/вазов/i.test(inp.value)) hadRight = true;
    const p = inp.value.split(' ');
    p.push(mess(p.pop()));
    inp.value = p.join(' ');
    bump(4); say('Поправих те в последния момент. ' + SHAME);
  }, 1100);
};
$('freeBtn').onclick = () => {
  clearTimeout(ft);
  const inp = $('freeInput');
  const right = hadRight || /вазов/i.test(inp.value);
  inp.value = inp.value.split(' ').map(mess).join(' ');
  finish(false, (right ? 'Беше вярно, докато автокорекцията не се намеси. ' : 'Грешно. А дори да беше вярно – щях да го „поправя“. ') + SHAME);
};

// ---------- Край ----------
function result() {
  panel('result');
  $('score').textContent = `${score} / ${Q.length}`;
  $('verdict').textContent = score >= 4 ? 'Подозрително добре. Преписвал си, нали?'
    : score >= 2 ? 'Средна работа. Точно толкова, колкото очаквах.'
    : 'Предлагам да започнеш подготовката за НВО през 2031.';
  say('Резултатите са готови. Седни. Или не – все ми е едно.');
}
$('again').onclick = intro;

intro();