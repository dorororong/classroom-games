'use strict';

// ---------- 게임 정의 ----------
const GAMES = {
  body: {
    title: '몸으로 말해요', badge: '몸', kind: 'speed',
    tagline: '말·소리 없이 몸짓으로만 설명',
    // 속담과 단어는 섞지 않고 묶음을 골라 따로 출제한다
    sets: [['word', '단어', x => x.cat !== '속담'], ['proverb', '속담', x => x.cat === '속담']],
    rules: [
      '설명하는 사람만 화면을 보고, 같은 팀은 화면을 등지고 앉아요.',
      '말·소리·입모양·글자 쓰기 없이 몸짓으로만 설명해요. 카테고리는 먼저 알려줘도 돼요.',
      '원래 단어·속담 그대로 말해야 정답. 막히면 패스하고 다음 문제로 넘어가요.',
    ],
  },
  same: {
    title: '이구동성', badge: '4', kind: 'shout',
    tagline: '네 명이 한 글자씩 동시에 외치기',
    rules: [
      '진행자가 네 명에게 첫째~넷째 글자를 한 명씩 따로 보여 줘요. 글자 카드를 누르면 그 글자만 보여요.',
      '‘하나, 둘, 셋!’ 신호에 맞춰 네 명이 자기 글자를 동시에 외쳐요. 2~3번까지 다시 외쳐도 돼요.',
      '다른 팀이 원래 단어를 맞혀요. 정답을 공개한 뒤 맞힌 팀을 누르면 1점씩 올라가요.',
    ],
  },
  english: {
    title: '영어로 설명하기', badge: 'En', kind: 'speed',
    tagline: '한국어 제시어를 영어로만 설명',
    rules: [
      '설명하는 사람만 화면을 보고, 한국어 제시어를 영어로만 설명해요.',
      '팀원은 한국어로 정답을 외쳐요.',
      '제시어에 해당하는 영어 단어를 그대로 말하거나 한국어를 쓰면 반칙 → 패스 처리해요.',
      '영어 설명 예시는 진행자 참고용이에요. 정답 판정 기준이 아니니 학생에게 보여 주지 마세요.',
    ],
  },
};
const LEVELS = ['쉬움', '보통', '어려움'];
const TIMES = [[30, '30초'], [60, '60초'], [90, '90초'], [0, '자유']];
const LIMITS = [[5, '5개'], [10, '10개'], [15, '15개'], [20, '20개'], [0, '제한 없음']];   // 모둠 하나가 받는 문제 수
const MAX_TEAMS = 8;
const KEY = 'classroom-games-v3';   // v3: 제시어 id 가 번호에서 제시어 글자로 바뀜

const $app = document.getElementById('app');
let DATA = null;
let S = load();
let R = null;           // 진행 중인 라운드. 점수·출제 기록은 누를 때마다 S 에 바로 저장한다
let screen = 'home';
let arg = null;         // 화면별 인자 (설정 화면의 게임, 목록 화면의 탭)

// ---------- 저장 ----------
function defaults() {
  const pref = time => ({ offCats: [], offLevels: [], time, max: 0, hold: false });
  return {
    teams: [1, 2, 3, 4].map(n => ({ name: n + '팀', score: 0 })),
    turn: 0,
    sound: true,
    status: {},         // 제시어 id → 'used'(사용) | 'hold'(보류·패스). 없으면 미사용
    prefs: { body: { ...pref(60), set: 'word' }, same: pref(0), english: pref(60) },
  };
}
function load() {
  const d = defaults();
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.teams) && s.teams.length) {
      const prefs = {};
      for (const g in d.prefs) prefs[g] = { ...d.prefs[g], ...(s.prefs && s.prefs[g]) };
      return { ...d, ...s, prefs, turn: Math.min(s.turn || 0, s.teams.length - 1) };
    }
  } catch (e) { /* 저장소를 못 쓰면 기본값으로 */ }
  return d;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 사생활 보호 모드 등 */ }
}

// ---------- 도우미 ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const catsOf = (g, list = DATA[g]) => [...new Set(list.map(x => x.cat))];
function setItems(g) {
  const set = GAMES[g].sets && GAMES[g].sets.find(s => s[0] === S.prefs[g].set);
  return set ? DATA[g].filter(set[2]) : DATA[g];
}
const unusedCount = g => DATA[g].filter(x => !S.status[x.id]).length;
const team = i => S.teams[i] || { name: '?', score: 0 };
const fmt = sec => Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');

function pool(g) {
  const p = S.prefs[g];
  return setItems(g).filter(x => !p.offCats.includes(x.cat) && !p.offLevels.includes(x.level) &&
    (!S.status[x.id] || (p.hold && S.status[x.id] === 'hold')));
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function sizeClass(word) {
  const n = word.length;
  return n <= 3 ? 'w-xl' : n <= 6 ? 'w-l' : n <= 9 ? 'w-m' : 'w-s';
}

const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  full: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  sound: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM16 9a4 4 0 010 6M18.5 6.5a7.5 7.5 0 010 11"/></svg>',
  mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM17 9l5 6M22 9l-5 6"/></svg>',
};
const iconBtn = (act, icon, label, extra = '') =>
  `<button class="icon-btn" data-act="${act}" aria-label="${label}" title="${label}" ${extra}>${ICON[icon]}</button>`;
function toolButtons() {
  const fs = document.fullscreenEnabled
    ? iconBtn('fullscreen', 'full', document.fullscreenElement ? '전체화면 끝내기' : '전체화면') : '';
  return iconBtn('sound', S.sound ? 'sound' : 'mute', S.sound ? '소리 끄기' : '소리 켜기') + fs;
}

// ---------- 소리 (파일 없이 Web Audio) ----------
let ac = null;
function beep(freq, dur = 0.12, type = 'sine', vol = 0.2, delay = 0) {
  if (!S.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const v = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    v.gain.setValueAtTime(vol, t);
    v.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(v).connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) { /* 소리는 없어도 진행된다 */ }
}
const SFX = {
  ok: () => { beep(784, 0.1); beep(1175, 0.2, 'sine', 0.2, 0.09); },
  pass: () => beep(330, 0.18, 'triangle', 0.25),
  tick: () => beep(1000, 0.05, 'square', 0.06),
  count: () => beep(660, 0.12, 'sine', 0.22),
  go: () => beep(988, 0.35, 'sine', 0.25),
  end: () => { beep(440, 0.25, 'sawtooth', 0.15); beep(330, 0.5, 'sawtooth', 0.15, 0.25); },
};

// ---------- 화면 꺼짐 방지 ----------
let lock = null;
async function wake(on) {
  try {
    if (on && 'wakeLock' in navigator && !lock) {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) {
      await lock.release();
      lock = null;
    }
  } catch (e) { /* 지원하지 않는 브라우저 */ }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && R && screen === 'play') wake(true);
});

// ---------- 타이머 ----------
// R.ms 는 흘러간 시간. R.time 이 0 이면 자유 모드라 위로 센다
function timerStart() {
  R.paused = false;
  R.mark = Date.now();
  clearInterval(R.iv);
  R.iv = setInterval(tick, 100);
}
function timerStop() {
  if (!R.paused) R.ms += Date.now() - R.mark;
  R.paused = true;
  clearInterval(R.iv);
}
function timerSec() {
  const ms = R.ms + (R.paused ? 0 : Date.now() - R.mark);
  return R.time ? Math.max(0, Math.ceil(R.time - ms / 1000)) : Math.floor(ms / 1000);
}
function tick() {
  const sec = timerSec();
  if (sec === R.shown) return;
  R.shown = sec;
  const el = document.getElementById('timer');
  if (el) {
    el.textContent = fmt(sec);
    el.classList.toggle('low', !!R.time && sec <= 10);
  }
  if (R.time && sec <= 5 && sec > 0) SFX.tick();
  if (R.time && sec === 0) timeUp();
}
function timeUp() {
  timerStop();
  SFX.end();
  if (R.kind === 'speed') endRound('시간 종료!');
  else reveal();
}

// 3·2·1 같은 카운트다운. 화면 위에 덮어 쓰고 끝나면 done
function countdown(labels, done, gap = 800) {
  clearTimeout(R.cd);
  let i = 0;
  const step = () => {
    if (i === labels.length) {
      R.countText = '';
      done();
      return;
    }
    R.countText = labels[i];
    (i === labels.length - 1 ? SFX.go : SFX.count)();
    render();
    i++;
    R.cd = setTimeout(step, gap);
  };
  step();
}

// ---------- 스피드 라운드 (몸으로 말해요 · 영어로 설명하기) ----------
// 문제 수를 정하면 모둠마다 그 개수만 뽑아 두고, 패스한 문제는 그 안에서 맨 뒤로 돌려 다시 낸다
function startSpeed(g) {
  const max = S.prefs[g].max;
  const deck = shuffle(pool(g)).slice(0, max || undefined);
  if (!deck.length) return;
  stopRound();
  R = {
    game: g, kind: 'speed', team: S.turn, deck, cur: null, results: [],
    time: S.prefs[g].time, max, total: deck.length, ms: 0, paused: true, hidden: false, hint: false, countText: '',
  };
  screen = 'play';
  wake(true);
  countdown(['3', '2', '1'], () => {
    nextWord();
    if (R.cur) timerStart();
    render();
  });
}
function nextWord() {
  R.cur = R.deck.shift() || null;
  R.hint = false;
  if (!R.cur) endRound(R.max ? `${R.total}문제 모두 정답!` : '출제할 제시어를 모두 썼어요');
}
function answer(ok) {
  if (!R || !R.cur || R.paused || R.countText) return;
  R.results.push({ item: R.cur, ok, prev: S.status[R.cur.id] });
  S.status[R.cur.id] = ok ? 'used' : 'hold';
  if (ok) team(R.team).score++;
  save();
  (ok ? SFX.ok : SFX.pass)();
  if (!ok && R.max) R.deck.push(R.cur);
  nextWord();
  render();
}
function undo() {
  if (!R || R.kind !== 'speed' || R.countText) return;
  const r = R.results.pop();
  if (!r) return;
  if (r.prev) S.status[r.item.id] = r.prev; else delete S.status[r.item.id];
  if (r.ok) team(R.team).score--;
  if (!r.ok && R.max) {   // 패스로 맨 뒤에 넣어 둔 것을 빼낸다
    const i = R.deck.lastIndexOf(r.item);
    if (i >= 0) R.deck.splice(i, 1);
    if (R.cur === r.item) R.cur = null;
  }
  if (R.cur) R.deck.unshift(R.cur);
  R.cur = r.item;
  save();
  render();
}
function togglePause() {
  if (!R || R.countText || (R.kind === 'speed' && !R.cur)) return;
  if (R.paused) timerStart(); else timerStop();
  render();
}
function endRound(reason) {
  timerStop();
  clearTimeout(R.cd);
  R.reason = reason;
  if (R.kind === 'speed' && R.results.length) {   // 한 문제도 안 풀고 끝내면 차례를 넘기지 않는다
    S.turn = (R.team + 1) % S.teams.length;
    save();
  }
  wake(false);
  screen = 'summary';
  render();
}
function flipResult(i) {
  const r = R.results[i];
  if (!r) return;
  r.ok = !r.ok;
  S.status[r.item.id] = r.ok ? 'used' : 'hold';
  team(R.team).score += r.ok ? 1 : -1;
  save();
  render();
}
function stopRound() {
  if (!R) return;
  clearInterval(R.iv);
  clearTimeout(R.cd);
  R = null;
  wake(false);
}

// ---------- 이구동성 ----------
function startShout() {
  const deck = shuffle(pool('same'));
  if (!deck.length) return;
  stopRound();
  R = { game: 'same', kind: 'shout', deck, log: [], time: S.prefs.same.time, countText: '' };
  screen = 'play';
  wake(true);
  nextShout();
}
function nextShout() {
  if (R.cur) R.log.push({ item: R.cur, teams: [...R.awarded], skipped: R.phase === 'prep' });
  clearInterval(R.iv);
  Object.assign(R, {
    cur: R.deck.shift() || null, phase: 'prep', flipped: [false, false, false, false],
    answer: false, shouts: 0, awarded: new Set(), ms: 0, paused: true, shown: null,
  });
  if (!R.cur) { endRound('출제할 제시어를 모두 썼어요'); return; }
  render();
}
function shout() {
  if (!R || R.phase !== 'prep' || R.countText) return;
  R.flipped = [false, false, false, false];
  R.answer = false;
  countdown(['하나', '둘', '셋!'], () => {
    R.shouts++;
    if (R.time && R.paused) timerStart();
    render();
  }, 750);
}
function skipShout() {
  if (!R || R.phase !== 'prep' || R.countText) return;
  S.status[R.cur.id] = 'hold';
  save();
  SFX.pass();
  nextShout();
}
function reveal() {
  if (!R || R.phase !== 'prep') return;
  clearTimeout(R.cd);
  R.countText = '';
  timerStop();
  R.phase = 'reveal';
  S.status[R.cur.id] = 'used';
  save();
  render();
}
function award(i) {
  if (!R || R.phase !== 'reveal' || !S.teams[i]) return;
  if (R.awarded.has(i)) { R.awarded.delete(i); S.teams[i].score--; } else { R.awarded.add(i); S.teams[i].score++; SFX.ok(); }
  save();
  render();
}
function endShout() {
  if (R.cur && R.phase === 'reveal') R.log.push({ item: R.cur, teams: [...R.awarded] });
  R.cur = null;
  endRound('이구동성 끝');
}

// ---------- 화면 그리기 ----------
function go(to, a = null) {
  if (to !== 'play' && to !== 'summary') stopRound();
  screen = to;
  arg = a;
  render();
  window.scrollTo(0, 0);
}

function render() {
  const g = (screen === 'play' || screen === 'summary') && R ? R.game : screen === 'setup' ? arg : '';
  document.body.dataset.game = g;
  document.body.dataset.screen = screen;
  const html = { home: viewHome, setup: viewSetup, play: viewPlay, summary: viewSummary, words: viewWords, score: viewScore }[screen];
  $app.innerHTML = html ? html() : '';
  fitWord();
}

// 제시어를 남은 자리에 들어가는 가장 큰 글씨로 맞춘다. 줄바꿈은 띄어쓰기에서만 (속담은 여러 줄)
function fitWord() {
  const el = document.querySelector('.word');
  if (!el) return;
  const stage = el.parentElement;
  const kids = [...stage.children];
  const gap = parseFloat(getComputedStyle(stage).rowGap) || 0;
  const maxW = stage.clientWidth;
  const maxH = stage.clientHeight - kids.reduce((h, c) => h + (c === el ? 0 : c.offsetHeight), 0) - gap * (kids.length - 1);
  let lo = 16;
  let hi = Math.max(lo + 1, Math.min(maxW, maxH, 420));
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    el.style.fontSize = mid + 'px';
    if (el.scrollWidth <= maxW && el.offsetHeight <= maxH) lo = mid; else hi = mid;
  }
  el.style.fontSize = lo + 'px';
}
window.addEventListener('resize', fitWord);
if (document.fonts) document.fonts.ready.then(fitWord);   // 웹폰트가 늦게 오면 글자 폭이 달라진다

function topbar(title, left = iconBtn('home', 'back', '처음으로')) {
  return `<header class="topbar">${left}<h1 class="topbar-title">${title}</h1><div class="tools">${toolButtons()}</div></header>`;
}

function viewHome() {
  const cards = Object.entries(GAMES).map(([g, G]) => `
    <button class="game-card" data-act="setup" data-g="${g}" data-game="${g}">
      <span class="game-badge">${G.badge}</span>
      <span class="game-name">${G.title}</span>
      <span class="game-tag">${G.tagline}</span>
      <span class="game-left">남은 제시어 <b>${unusedCount(g)}</b> / ${DATA[g].length}</span>
    </button>`).join('');
  const teams = S.teams.map((t, i) => `
    <li class="${i === S.turn ? 'is-turn' : ''}"><span>${esc(t.name)}</span><b>${t.score}</b></li>`).join('');
  return `
  <section class="screen home">
    <header class="home-head">
      <div><h1>교실 게임</h1><p class="muted">스케치북 없이 화면 하나로 진행해요</p></div>
      <div class="tools">${toolButtons()}</div>
    </header>
    <div class="game-grid">${cards}</div>
    <section class="panel">
      <div class="panel-head"><h2>팀 점수</h2><button class="link" data-act="go" data-to="score">점수판 · 팀 설정</button></div>
      <ol class="mini-board">${teams}</ol>
    </section>
    <nav class="home-links">
      <button class="btn ghost" data-act="go" data-to="words">제시어 목록</button>
      <button class="btn ghost" data-act="reset">새 게임 (초기화)</button>
    </nav>
    <p class="foot muted">점수와 출제 기록은 이 브라우저에 저장돼요. 새로고침해도 이어서 할 수 있어요.</p>
  </section>`;
}

function chips(group, items, offList, counts) {
  const all = offList.length === 0;
  return `<div class="chips" role="group">
    <button class="chip" aria-pressed="${all}" data-act="chip" data-group="${group}" data-v="">전체</button>
    ${items.map(v => `<button class="chip" aria-pressed="${!all && !offList.includes(v)}" data-act="chip" data-group="${group}" data-v="${esc(v)}">${esc(v)}${counts ? `<small>${counts[v]}</small>` : ''}</button>`).join('')}
  </div>`;
}

function viewSetup() {
  const g = arg;
  const G = GAMES[g];
  const p = S.prefs[g];
  const items = setItems(g);
  const cats = catsOf(g, items);
  const unused = {};
  for (const x of items) if (!S.status[x.id]) unused[x.cat] = (unused[x.cat] || 0) + 1;
  for (const c of cats) unused[c] = unused[c] || 0;
  const levels = LEVELS.filter(l => items.some(x => x.level === l));
  const holdN = items.filter(x => S.status[x.id] === 'hold').length;
  const sets = G.sets ? `
    <div class="segs sets">${G.sets.map(([k, label, test]) =>
      `<button class="seg" aria-pressed="${p.set === k}" data-act="set" data-k="${k}">${label}
        <small>${DATA[g].filter(x => test(x) && !S.status[x.id]).length}개</small></button>`).join('')}</div>` : '';
  const n = pool(g).length;
  const times = TIMES.map(([t, label]) =>
    `<button class="seg" aria-pressed="${p.time === t}" data-act="time" data-t="${t}">${label}</button>`).join('');
  const turn = G.kind === 'speed' ? `
    <h3>이번 차례</h3>
    <div class="chips">${S.teams.map((t, i) =>
      `<button class="chip" aria-pressed="${i === S.turn}" data-act="turn" data-i="${i}">${esc(t.name)}</button>`).join('')}</div>` : '';
  const startLabel = G.kind === 'speed' ? `${esc(team(S.turn).name)} 시작` : '시작';
  return `
  <section class="screen setup">
    ${topbar(G.title)}
    <ul class="rules">${G.rules.map(r => `<li>${r}</li>`).join('')}</ul>
    ${sets}
    ${cats.length > 1 ? `<h3>카테고리 <small class="muted">숫자는 남은 제시어</small></h3>
    ${chips('cat', cats, p.offCats, unused)}` : ''}
    <h3>난이도</h3>
    ${chips('level', levels, p.offLevels)}
    <h3>${G.kind === 'speed' ? '제한시간' : '문제당 제한시간'}</h3>
    <div class="segs">${times}</div>
    ${G.kind === 'speed' ? `<h3>문제 수 <small class="muted">모둠마다 이만큼만 출제 · 패스한 문제는 뒤로 돌아가 다시 나와요</small></h3>
    <div class="segs">${LIMITS.map(([m, label]) =>
      `<button class="seg" aria-pressed="${p.max === m}" data-act="max" data-m="${m}">${label}</button>`).join('')}</div>` : ''}
    ${G.kind === 'shout' ? '<p class="hint muted">‘하나, 둘, 셋!’을 처음 외친 뒤부터 시간이 흘러요.</p>' : ''}
    ${turn}
    <label class="check"><input type="checkbox" data-act="hold" ${p.hold ? 'checked' : ''}>
      <span>패스했던 제시어도 다시 출제 <small class="muted">${holdN}개</small></span></label>
    <div class="start-bar">
      <span class="pool-n">출제 가능 <b>${n}</b>개</span>
      ${n ? `<button class="btn primary big" data-act="start">${startLabel}</button>`
        : `<button class="btn big" data-act="go" data-to="words" data-tab="${g}">남은 제시어가 없어요 · 기록 보기</button>`}
    </div>
  </section>`;
}

function viewPlay() {
  return R.kind === 'speed' ? viewSpeed() : viewShout();
}

function overlay() {
  if (R.countText) return `<div class="overlay count"><span>${R.countText}</span></div>`;
  return '';
}

function viewSpeed() {
  const G = GAMES[R.game];
  const got = R.results.filter(r => r.ok).length;
  const x = R.cur;
  let stage;
  if (!x) {
    stage = '<p class="muted">준비…</p>';
  } else if (R.paused) {
    stage = `<button class="paused" data-act="pause"><b>일시정지</b><span>눌러서 계속</span></button>`;
  } else if (R.hidden) {
    stage = `<button class="covered" data-act="hide"><b>제시어 가림</b><span>눌러서 보기</span></button>`;
  } else {
    const extra = R.game === 'english'
      ? `<div class="hint-box">${R.hint
          ? `<p lang="en">${esc(x.hint)}</p><button class="link" data-act="hint">예시 숨기기</button>`
          : `<button class="link" data-act="hint">영어 설명 예시 보기 (진행자용)</button>`}</div>`
      : `<p class="judge muted">판정: ${esc(x.judge)}</p>`;
    stage = `
      <div class="tags"><span class="tag">${esc(x.cat)}</span><span class="tag lv">${x.level}</span></div>
      <p class="word ${sizeClass(x.word)}">${esc(x.word)}</p>
      ${extra}`;
  }
  return `
  <section class="screen play">
    <header class="topbar">
      ${iconBtn('end', 'close', '라운드 끝내기')}
      <div class="round-info"><span>${esc(team(R.team).name)}</span><b>+${got}</b>${R.max ? `<small>정답 ${got} / ${R.total}</small>` : ''}</div>
      <div class="tools">${toolButtons()}</div>
    </header>
    <button id="timer" class="timer ${R.time && timerSec() <= 10 ? 'low' : ''}" data-act="pause" title="눌러서 일시정지">${fmt(timerSec())}</button>
    <div class="stage">${stage}</div>
    <div class="controls">
      <div class="sub-controls">
        <button class="btn ghost" data-act="undo" ${R.results.length ? '' : 'disabled'}>되돌리기</button>
        <button class="btn ghost" data-act="hide">${R.hidden ? '제시어 보기' : '제시어 가리기'}</button>
      </div>
      <div class="main-controls">
        <button class="btn pass huge" data-act="pass">패스</button>
        <button class="btn ok huge" data-act="ok">정답</button>
      </div>
      <p class="keys muted">키보드 · 리모컨: → 정답 · ← 패스 · Space 일시정지 · H 가리기 · Z 되돌리기</p>
    </div>
    ${overlay()}
  </section>`;
}

function viewShout() {
  const x = R.cur;
  const head = `
    <header class="topbar">
      ${iconBtn('end', 'close', '이구동성 끝내기')}
      <div class="round-info"><span>이구동성</span><small>남은 ${R.deck.length + 1}개</small></div>
      <div class="tools">${toolButtons()}</div>
    </header>`;
  const tags = `<div class="tags"><span class="tag">${esc(x.cat)}</span><span class="tag lv">${x.level}</span></div>`;
  const timer = R.time ? `<div id="timer" class="timer small ${timerSec() <= 10 ? 'low' : ''}">${fmt(timerSec())}</div>` : '';

  if (R.phase === 'reveal') {
    const teams = S.teams.map((t, i) => `
      <button class="team-btn" aria-pressed="${R.awarded.has(i)}" data-act="award" data-i="${i}">
        <span>${esc(t.name)}</span><b>${t.score}</b></button>`).join('');
    return `
    <section class="screen play shout">
      ${head}
      <div class="stage">
        ${tags}
        <div class="letters open">${x.chars.map(c => `<span>${esc(c)}</span>`).join('')}</div>
        <p class="word-sub">${esc(x.word)}</p>
      </div>
      <div class="controls">
        <p class="label">맞힌 팀을 누르세요 <small class="muted">여러 팀 가능 · 다시 누르면 취소</small></p>
        <div class="team-grid">${teams}</div>
        <button class="btn primary big" data-act="next-shout">다음 문제</button>
      </div>
    </section>`;
  }

  const cards = x.chars.map((c, i) => `
    <button class="letter-card ${R.flipped[i] ? 'is-open' : ''}" data-act="flip" data-i="${i}" aria-label="${i + 1}번째 글자">
      <small>${i + 1}번</small><span>${R.flipped[i] ? esc(c) : '?'}</span></button>`).join('');
  return `
  <section class="screen play shout">
    ${head}
    <div class="stage">
      ${tags}
      <button class="answer-peek" data-act="peek">${R.answer ? `<b>${esc(x.word)}</b>` : '진행자: 정답 확인하기'}</button>
      <p class="label muted">카드를 눌러 한 명씩 자기 글자만 보여 주세요</p>
      <div class="letters">${cards}</div>
      ${timer}
    </div>
    <div class="controls">
      <button class="btn shout-btn huge" data-act="shout">하나, 둘, 셋! ${R.shouts ? `<small>${R.shouts}번 외침</small>` : ''}</button>
      <div class="main-controls">
        <button class="btn pass" data-act="skip">건너뛰기</button>
        <button class="btn primary" data-act="reveal">정답 공개</button>
      </div>
      <p class="keys muted">키보드: Space 하나·둘·셋 · 1~4 글자 카드 · Enter 정답 공개/다음</p>
    </div>
    ${overlay()}
  </section>`;
}

function viewSummary() {
  const G = GAMES[R.game];
  let body;
  if (R.kind === 'speed') {
    const got = R.results.filter(r => r.ok).length;
    // 같은 제시어가 패스 뒤 다시 나왔을 수 있으니 제시어마다 마지막 결과 한 줄
    const last = new Map();
    R.results.forEach((r, i) => last.set(r.item.id, i));
    const rows = [...last.values()].map(i => [R.results[i], i]).map(([r, i]) => `
      <li><button class="result ${r.ok ? 'is-ok' : 'is-pass'}" data-act="flip-result" data-i="${i}">
        <span>${esc(r.item.word)}</span><b>${r.ok ? '정답' : '패스'}</b></button></li>`).join('');
    const next = team(S.turn);
    body = `
      <p class="sum-team">${esc(team(R.team).name)}</p>
      <p class="sum-score">+${got}<small>점</small></p>
      <p class="muted">${last.size}문제 중 ${got}개 정답 · 결과를 누르면 정답↔패스가 바뀌어요</p>
      <ol class="results">${rows || '<li class="muted">푼 문제가 없어요</li>'}</ol>
      <div class="sum-actions">
        ${pool(R.game).length ? `<button class="btn primary big" data-act="start-next">다음 차례: ${esc(next.name)} 시작</button>` : '<p class="muted">출제 가능한 제시어가 없어요.</p>'}
        <div class="row">
          <button class="btn" data-act="setup" data-g="${R.game}">설정 바꾸기</button>
          <button class="btn" data-act="go" data-to="score">점수판</button>
        </div>
      </div>`;
  } else {
    const rows = R.log.map(l => `
      <li><div class="result ${l.teams.length ? 'is-ok' : 'is-pass'}"><span>${esc(l.item.word)}</span>
        <b>${l.skipped ? '건너뜀' : l.teams.length ? l.teams.map(i => esc(team(i).name)).join(', ') : '못 맞힘'}</b></div></li>`).join('');
    body = `
      <p class="sum-team">이구동성</p>
      <p class="muted">${R.log.length}문제 진행</p>
      <ol class="results">${rows || '<li class="muted">진행한 문제가 없어요</li>'}</ol>
      <div class="sum-actions">
        ${pool('same').length ? '<button class="btn primary big" data-act="start-next">이어서 하기</button>' : ''}
        <div class="row">
          <button class="btn" data-act="setup" data-g="same">설정 바꾸기</button>
          <button class="btn" data-act="go" data-to="score">점수판</button>
        </div>
      </div>`;
  }
  return `
  <section class="screen summary">
    ${topbar(G.title)}
    <p class="reason">${esc(R.reason || '')}</p>
    ${body}
  </section>`;
}

const STATUS_LABEL = { '': '미사용', used: '사용', hold: '보류' };
function viewWords() {
  const g = GAMES[arg] ? arg : 'body';
  const tabs = Object.entries(GAMES).map(([k, G]) =>
    `<button class="seg" aria-pressed="${k === g}" data-act="tab" data-g="${k}">${G.title}</button>`).join('');
  const groups = catsOf(g).map(c => {
    const items = DATA[g].filter(x => x.cat === c).map(x => {
      const st = S.status[x.id] || '';
      const sub = g === 'english' ? `<small lang="en">${esc(x.hint)}</small>` : '';
      return `<li><div class="w"><span>${esc(x.word)}</span>${sub}</div><span class="lv">${x.level}</span>
        <button class="st st-${st || 'new'}" data-act="cycle" data-id="${esc(x.id)}">${STATUS_LABEL[st]}</button></li>`;
    }).join('');
    return `<section class="word-group"><h3>${esc(c)}</h3><ul class="word-list">${items}</ul></section>`;
  }).join('');
  const cnt = s => DATA[g].filter(x => (S.status[x.id] || '') === s).length;
  return `
  <section class="screen words">
    ${topbar('제시어 목록')}
    <div class="segs tabs">${tabs}</div>
    <p class="muted">미사용 ${cnt('')} · 사용 ${cnt('used')} · 보류 ${cnt('hold')} — 상태를 누르면 미사용 → 사용 → 보류 순서로 바뀌어요.
      ${g === 'english' ? '영어 예시는 진행자 참고용이니 학생에게 화면을 보여 줄 때 주의하세요.' : ''}</p>
    <button class="btn ghost" data-act="clear-status" data-g="${g}">${GAMES[g].title} 출제 기록 지우기</button>
    ${groups}
  </section>`;
}

function viewScore() {
  const rows = S.teams.map((t, i) => `
    <li class="${i === S.turn ? 'is-turn' : ''}">
      <input class="team-name" value="${esc(t.name)}" data-team="${i}" aria-label="${i + 1}번째 팀 이름" maxlength="12">
      <button class="step" data-act="score" data-i="${i}" data-d="-1" aria-label="${esc(t.name)} 1점 빼기">−</button>
      <b class="score">${t.score}</b>
      <button class="step" data-act="score" data-i="${i}" data-d="1" aria-label="${esc(t.name)} 1점 더하기">+</button>
      <button class="del" data-act="del-team" data-i="${i}" aria-label="${esc(t.name)} 삭제" ${S.teams.length <= 2 ? 'disabled' : ''}>${ICON.close}</button>
    </li>`).join('');
  return `
  <section class="screen scoreboard">
    ${topbar('점수판')}
    <ol class="board">${rows}</ol>
    <div class="row">
      <button class="btn" data-act="add-team" ${S.teams.length >= MAX_TEAMS ? 'disabled' : ''}>팀 추가</button>
      <button class="btn" data-act="zero">점수 모두 0점</button>
    </div>
    <p class="muted">팀 이름은 눌러서 바로 고칠 수 있어요. 테두리가 진한 팀이 다음 차례예요.</p>
  </section>`;
}

// ---------- 동작 ----------
const ACT = {
  home: () => go('home'),
  go: d => go(d.to, d.tab || null),
  setup: d => go('setup', d.g),
  tab: d => { arg = d.g; render(); },
  sound: () => { S.sound = !S.sound; save(); render(); },
  fullscreen: () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    if (p && p.catch) p.catch(() => {});
  },
  chip: d => {
    const g = arg;
    const p = S.prefs[g];
    const key = d.group === 'cat' ? 'offCats' : 'offLevels';
    const all = d.group === 'cat' ? catsOf(g, setItems(g)) : LEVELS;
    if (!d.v) p[key] = [];
    else if (p[key].length === 0) p[key] = all.filter(v => v !== d.v);     // 전체 상태에서 누르면 그것만
    else {
      p[key] = p[key].includes(d.v) ? p[key].filter(v => v !== d.v) : [...p[key], d.v];
      if (all.every(v => p[key].includes(v))) p[key] = [];                 // 하나도 안 남으면 전체로
    }
    save();
    render();
  },
  set: d => { S.prefs[arg].set = d.k; S.prefs[arg].offCats = []; save(); render(); },
  time: d => { S.prefs[arg].time = +d.t; save(); render(); },
  max: d => { S.prefs[arg].max = +d.m; save(); render(); },
  turn: d => { S.turn = +d.i; save(); render(); },
  start: () => (GAMES[arg].kind === 'speed' ? startSpeed(arg) : startShout()),
  'start-next': () => (R.kind === 'speed' ? startSpeed(R.game) : startShout()),
  ok: () => answer(true),
  pass: () => answer(false),
  undo,
  pause: togglePause,
  hide: () => { R.hidden = !R.hidden; render(); },
  hint: () => { R.hint = !R.hint; render(); },
  end: () => (R.kind === 'speed' ? endRound('라운드를 끝냈어요') : endShout()),
  'flip-result': d => flipResult(+d.i),
  flip: d => { R.flipped[+d.i] = !R.flipped[+d.i]; render(); },
  peek: () => { R.answer = !R.answer; render(); },
  shout,
  skip: skipShout,
  reveal,
  award: d => award(+d.i),
  'next-shout': nextShout,
  cycle: d => {
    const order = ['', 'used', 'hold'];
    const next = order[(order.indexOf(S.status[d.id] || '') + 1) % 3];
    if (next) S.status[d.id] = next; else delete S.status[d.id];
    save();
    render();
  },
  'clear-status': d => {
    if (!confirm(`${GAMES[d.g].title} 제시어를 모두 ‘미사용’으로 되돌릴까요?`)) return;
    for (const x of DATA[d.g]) delete S.status[x.id];
    save();
    render();
  },
  score: d => { S.teams[+d.i].score += +d.d; save(); render(); },
  'add-team': () => {
    if (S.teams.length >= MAX_TEAMS) return;
    S.teams.push({ name: (S.teams.length + 1) + '팀', score: 0 });
    save();
    render();
  },
  'del-team': d => {
    const i = +d.i;
    if (S.teams.length <= 2 || !confirm(`${S.teams[i].name}을(를) 삭제할까요?`)) return;
    S.teams.splice(i, 1);
    if (S.turn > i) S.turn--;
    if (S.turn >= S.teams.length) S.turn = 0;
    save();
    render();
  },
  zero: () => {
    if (!confirm('모든 팀 점수를 0점으로 바꿀까요?')) return;
    S.teams.forEach(t => { t.score = 0; });
    S.turn = 0;
    save();
    render();
  },
  reset: () => {
    if (!confirm('새 게임을 시작할까요?\n팀 점수가 0점이 되고, 세 게임의 출제 기록이 모두 지워져요.\n(팀 이름과 설정은 그대로)')) return;
    S.teams.forEach(t => { t.score = 0; });
    S.turn = 0;
    S.status = {};
    save();
    render();
  },
};

$app.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.type === 'checkbox') return;
  const fn = ACT[el.dataset.act];
  if (fn) fn(el.dataset, el);
});
$app.addEventListener('change', e => {
  if (e.target.dataset.act === 'hold') { S.prefs[arg].hold = e.target.checked; save(); render(); }
});
$app.addEventListener('input', e => {
  const i = e.target.dataset.team;
  if (i !== undefined) { S.teams[+i].name = e.target.value.trim() || (+i + 1) + '팀'; save(); }
});
document.addEventListener('fullscreenchange', render);

// 키보드 · 프레젠테이션 리모컨(PageDown/PageUp, 화면 가림 버튼은 B 나 . 을 보낸다). ㅗㅠㅋ 는 한글 입력 상태의 H B Z
document.addEventListener('keydown', e => {
  if (screen !== 'play' || !R || e.target.tagName === 'INPUT' || e.altKey || e.metaKey) return;
  const k = e.key;
  let act = null;
  if (R.kind === 'speed') {
    if (['ArrowRight', 'PageDown', 'Enter'].includes(k)) act = 'ok';
    else if (['ArrowLeft', 'PageUp'].includes(k)) act = 'pass';
    else if (k === ' ') act = 'pause';
    else if (/^[hHbBㅗㅠ.]$/.test(k)) act = 'hide';
    else if (/^[zZㅋ]$/.test(k) || k === 'Backspace') act = 'undo';
  } else if (R.phase === 'prep') {
    if (k === ' ') act = 'shout';
    else if (k === 'Enter' || k === 'PageDown') act = 'reveal';
    else if (/^[1-4]$/.test(k)) { e.preventDefault(); ACT.flip({ i: +k - 1 }); return; }
  } else if (k === 'Enter' || k === 'PageDown' || k === ' ') act = 'next-shout';
  if (k === 'Escape') act = 'end';
  if (!act) return;
  e.preventDefault();
  if (e.ctrlKey && act !== 'undo') return;
  ACT[act]({});
});

// ---------- 시작 ----------
fetch('data/words.json')
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(d => {
    DATA = d;
    const ids = new Set(Object.values(d).flat().map(x => x.id));
    for (const id in S.status) if (!ids.has(id)) delete S.status[id];  // 엑셀에서 지운 제시어 기록 정리
    render();
  })
  .catch(() => {
    $app.innerHTML = `<p class="loading">제시어 파일(data/words.json)을 불러오지 못했어요.<br>
      파일을 더블클릭해서 연 경우라면 GitHub Pages 주소나 <code>python -m http.server</code> 로 열어 주세요.</p>`;
  });
