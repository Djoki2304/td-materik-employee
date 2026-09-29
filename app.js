(() => {
'use strict';
const L = window.Logic;
const $ = (s, r = document) => r.querySelector(s);
const LS_EMP = 'tdme.employeeId';

// Пароль Firebase Auth = сам PIN (минимум 6 цифр, без префикса) — так задаёт его
// приложение администратора при создании/смене входа сотрудника (см. sync.js: ensureEmployeeAuth).
const PIN_LEN = 6;

const nf = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WD_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const fmtShort = s => { const [, m, d] = s.split('-').map(Number); return d + ' ' + MONTHS[m - 1]; };
const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return MONTHS_NOM[m - 1] + ' ' + y; };
const initials = n => n.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
const hue = n => { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const avatar = n => `<div class="avatar" style="background:hsl(${hue(n)} 55% 38%)">${esc(initials(n))}</div>`;
const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k === 1 ? a : k > 1 && k < 5 ? b : c; };
const days = n => n + ' ' + plural(n, 'день', 'дня', 'дней');
const ST = { w: { label: 'Вышел', short: '✓', cls: 'ok' }, a: { label: 'Прогул', short: '✕', cls: 'bad' },
  o: { label: 'Выходной', short: '–', cls: 'off' }, s: { label: 'Больничный', short: 'Б', cls: 'warn' }, v: { label: 'Отпуск', short: 'О', cls: 'info' } };
const PAY_TYPES = { pay: 'Выплата зарплаты', adv: 'Аванс', bonus: 'Премия', fine: 'Штраф' };

let CFG = { shopName: 'ТД Материк', currency: '₽', logo: null };
const money = n => nf.format(Math.round((n || 0) * 100) / 100) + ' ' + (CFG.currency || '₽');
const logoSrc = () => CFG.logo || 'icons/icon-192.png';

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================= Вход ================= */
let directory = [];
let pickedEmployeeId = null;
let pinBuf = '';
let loginErr = '';

async function loadDirectory() {
  const snap = await db.collection('directory').get();
  // authEmail пуст, пока администратор не задал PIN этому сотруднику — таким нечем входить, скрываем их
  directory = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.authEmail)
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

function renderPicker() {
  const el = $('#lock'); el.hidden = false;
  el.innerHTML = `<img src="${logoSrc()}" alt="" style="width:88px;height:88px;border-radius:20px;object-fit:cover">
    <h2 style="margin:0">${esc(CFG.shopName)}</h2><div class="sub">Выберите себя, чтобы войти</div>
    <div class="picker">${directory.map(e => `<button data-act="pick" data-id="${e.id}">${avatar(e.name)}<b>${esc(e.name)}</b></button>`).join('') ||
      '<div class="sub" style="grid-column:1/-1;text-align:center">Список пуст — обратитесь к администратору</div>'}</div>`;
}

function renderPinPad() {
  const emp = directory.find(e => e.id === pickedEmployeeId);
  const el = $('#lock'); el.hidden = false;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
  el.innerHTML = `<button class="back-link" data-act="backToPicker">‹ Назад</button>
    ${avatar(emp.name)}<h2 style="margin:0">${esc(emp.name)}</h2><div class="sub">Введите PIN</div>
    <div class="dots" id="dots">${'<i></i>'.repeat(PIN_LEN)}</div>
    <div class="login-err">${esc(loginErr)}</div>
    <div class="keys">${keys.map(k => k ? `<button data-act="key" data-k="${k}">${k}</button>` : '<button class="ghost" disabled></button>').join('')}</div>`;
}

async function pressKey(k) {
  if (k === '⌫') pinBuf = pinBuf.slice(0, -1);
  else if (pinBuf.length < PIN_LEN) pinBuf += k;
  [...document.querySelectorAll('#dots i')].forEach((d, i) => d.classList.toggle('on', i < pinBuf.length));
  if (pinBuf.length === PIN_LEN) {
    const emp = directory.find(e => e.id === pickedEmployeeId);
    const pin = pinBuf; pinBuf = '';
    try {
      await auth.signInWithEmailAndPassword(emp.authEmail, pin);
      localStorage.setItem(LS_EMP, pickedEmployeeId);
      loginErr = '';
    } catch (e) {
      loginErr = 'Неверный PIN, попробуйте ещё раз';
      const d = $('#dots');
      if (d) { d.classList.add('shake'); setTimeout(() => d.classList.remove('shake'), 350); }
      renderPinPad();
    }
  }
}

/* ================= Данные кабинета (реальное время) ================= */
let employeeId = null;
let unsubs = [];
let emp = null, positions = [], attMap = {}, payments = [];
let ui = { month: L.today().slice(0, 7) };

function detachAll() { unsubs.forEach(u => u()); unsubs = []; }

// Firestore хранит табель как {status, rate} (см. Cloud.setAttendance в приложении администратора),
// а logic.js (общий файл с той же логикой) ожидает короткие имена {s, r} — переводим здесь.
function fakeS() {
  const att = {};
  for (const d in attMap) att[d] = { s: attMap[d].status, r: attMap[d].rate };
  return { employees: emp ? [emp] : [], positions, att: { [employeeId]: att },
    payments: payments.map(p => Object.assign({ empId: employeeId }, p)) };
}

function attachListeners() {
  detachAll();
  unsubs.push(db.collection('config').doc('public').onSnapshot(doc => {
    if (doc.exists) CFG = Object.assign(CFG, doc.data());
    renderApp();
  }, () => {}));
  unsubs.push(db.collection('positions').onSnapshot(snap => {
    positions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderApp();
  }, () => {}));
  unsubs.push(db.collection('employees').doc(employeeId).onSnapshot(doc => {
    emp = doc.exists ? { id: doc.id, ...doc.data() } : null;
    renderApp();
  }, () => toast('Не удалось загрузить данные')));
  unsubs.push(db.collection('employees').doc(employeeId).collection('attendance').onSnapshot(snap => {
    attMap = {};
    snap.forEach(d => { attMap[d.id] = d.data(); });
    renderApp();
  }, () => {}));
  unsubs.push(db.collection('employees').doc(employeeId).collection('payments').onSnapshot(snap => {
    payments = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ? b.createdAt.toMillis() : 0) - (a.createdAt ? a.createdAt.toMillis() : 0));
    renderApp();
  }, () => {}));
}

function posName() {
  if (!emp) return '';
  const p = positions.find(x => x.id === emp.positionId);
  return p ? p.name : 'Без должности';
}
function schedLabel() {
  if (!emp || emp.schedule === 'free' || !L.SCHEDULES[emp.schedule]) return 'Свободный';
  return emp.schedule;
}

function renderApp() {
  if (!emp) { $('#view').innerHTML = `<div class="card empty" style="margin-top:40px">Загрузка…</div>`; return; }
  const tdy = L.today();
  const S = fakeS();
  const bal = L.balanceOf(S, employeeId, tdy);
  const due = L.dueInfo(S, emp, tdy, CFG.payEvery || 5);
  const ym = ui.month;
  const monthRows = L.monthReport(S, ym, tdy);
  const mrow = monthRows.find(r => r.emp.id === employeeId);

  let html = `<div class="brand"><img src="${logoSrc()}"><div><b>${esc(CFG.shopName)}</b><small>Кабинет сотрудника</small></div></div>
    <h1 style="font-size:22px">${esc(emp.name)}</h1>
    <div class="sub" style="margin-bottom:12px">${esc(posName())} · график ${esc(schedLabel())}</div>`;

  html += `<div class="stat-grid">
    <div class="stat"><div class="k">К выплате сейчас</div><div class="v" style="${bal < 0 ? 'color:var(--bad)' : ''}">${money(bal)}</div></div>
    <div class="stat"><div class="k">${due.monthly ? 'Оклад в месяц' : 'Дней без выплаты'}</div>
      <div class="v">${due.monthly ? money(L.rateOf(emp, positions)) : due.days}</div></div>
    <div class="stat"><div class="k">Отработано в ${monthLabel(ym).toLowerCase()}</div><div class="v">${mrow ? mrow.days : 0} дн.</div></div>
    <div class="stat"><div class="k">Начислено за месяц</div><div class="v">${money(mrow ? mrow.earned : 0)}</div></div>
  </div>`;

  html += `<h3>Ближайшие дни по графику</h3><div class="weekrow">` + Array.from({ length: 7 }, (_, i) => {
    const d = L.addDays(tdy, i), p = L.planned(emp, d), rec = (attMap[d] || {}).status;
    const cls = rec ? ST[rec].cls : (p === true ? 'plan' : p === false ? 'offp' : '');
    const g = rec ? ST[rec].short : (p === false ? '·' : '');
    return `<div class="wd ${d === tdy ? 'ok' : ''}"><small>${WD_SHORT[L.weekday(d)]} ${+d.slice(8)}</small><b class="cell ${cls}" style="margin:2px auto 0">${g}</b></div>`;
  }).join('') + '</div>';

  html += `<div class="navbar" style="margin-top:20px"><button class="iconbtn" data-act="month" data-d="-1">‹</button>
    <div class="lbl">${monthLabel(ym)}<small>Табель</small></div><button class="iconbtn" data-act="month" data-d="1">›</button></div>`;
  html += monthCalendar(ym, tdy);

  const paid = payments.filter(p => p.date.slice(0, 7) === ym);
  html += `<h3>История выплат и штрафов</h3>`;
  html += paid.length ? `<div class="card pad" style="padding-top:4px;padding-bottom:4px">` + paid.map(p => {
    const sign = p.type === 'bonus' ? 'plus' : p.type === 'fine' ? 'minus' : '';
    return `<div class="hist"><div class="grow"><b>${esc(PAY_TYPES[p.type] || p.type)}</b> · ${fmtShort(p.date)}
      ${p.note ? `<div class="sub">${esc(p.note)}</div>` : ''}</div>
      <div class="amt ${sign}">${p.type === 'bonus' ? '+' : p.type === 'fine' ? '−' : ''}${money(p.amount)}</div></div>`;
  }).join('') + '</div>' : `<div class="card empty">За этот месяц записей нет</div>`;

  html += `<div class="logout-row"><button data-act="logout">Выйти</button></div>`;
  $('#view').innerHTML = html;
}

function monthCalendar(ym, tdy) {
  const [y, m] = ym.split('-').map(Number), n = L.daysInMonth(y, m);
  const dates = Array.from({ length: n }, (_, i) => ym + '-' + L.pad2(i + 1));
  const cells = dates.map(d => {
    const rec = attMap[d];
    let cls = '', g = '';
    if (rec) { cls = rec.status; g = ST[rec.status] ? ST[rec.status].short : ''; }
    else { const p = L.planned(emp, d); cls = p === true ? 'plan' : p === false ? 'offp' : ''; if (p === false) g = '·'; }
    return `<div style="text-align:center"><div class="sub" style="font-size:10px">${+d.slice(8)}</div>
      <button class="cell ${cls} ${d === tdy ? 'today' : ''}" style="margin-top:2px" disabled>${g}</button></div>`;
  }).join('');
  return `<div class="card pad"><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px">${cells}</div></div>
    <div class="legend">${Object.entries(ST).map(([k, v]) => `<span><span class="cell ${k}">${v.short}</span>${v.label}</span>`).join('')}</div>`;
}

/* ================= Push-подписка (Web Push) ================= */
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const base64safe = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64safe);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
async function setupPush() {
  try {
    if (!VAPID_PUBLIC_KEY || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (localStorage.getItem('tdme.pushDone') === employeeId) return;
    const reg = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    const json = sub.toJSON();
    await db.collection('employees').doc(employeeId).collection('pushSubscriptions').add({
      endpoint: json.endpoint, keys: json.keys, createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    localStorage.setItem('tdme.pushDone', employeeId);
  } catch (e) { /* без push приложение всё равно полностью работает */ }
}

/* ================= Запуск ================= */
async function boot() {
  $('#lock').hidden = false;
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  try {
    const cfgDoc = await db.collection('config').doc('public').get();
    if (cfgDoc.exists) CFG = Object.assign(CFG, cfgDoc.data());
  } catch (e) {}

  auth.onAuthStateChanged(async user => {
    if (user) {
      employeeId = localStorage.getItem(LS_EMP);
      if (!employeeId) { await auth.signOut(); return; }
      $('#lock').hidden = true;
      attachListeners();
      setupPush();
    } else {
      detachAll(); employeeId = null; emp = null;
      $('#view').innerHTML = '';
      await loadDirectory();
      renderPicker();
    }
  });
}

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-act]');
  if (!el) return;
  ev.preventDefault();
  const d = el.dataset;
  if (d.act === 'pick') { pickedEmployeeId = d.id; pinBuf = ''; loginErr = ''; renderPinPad(); }
  else if (d.act === 'backToPicker') { pickedEmployeeId = null; renderPicker(); }
  else if (d.act === 'key') pressKey(d.k);
  else if (d.act === 'month') { ui.month = L.addMonths(ui.month, +d.d); renderApp(); }
  else if (d.act === 'logout') { localStorage.removeItem(LS_EMP); auth.signOut(); }
});

boot();
})();
