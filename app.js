'use strict';

// ============================================================
// Storage
// ============================================================

const STORAGE_KEY = 'health_records_v1';

function getRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function saveRecords(r) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(r));
}

function getDayRecord(key) {
  return getRecords()[key] || {};
}

function patchDayRecord(key, updates) {
  const all = getRecords();
  all[key] = { ...(all[key] || {}), ...updates };
  saveRecords(all);
  return all[key];
}

// ============================================================
// Date helpers (JST)
// ============================================================

function getTodayKey() {
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const p = fmt.formatToParts(new Date());
  return `${p.find(x => x.type === 'year').value}-` +
         `${p.find(x => x.type === 'month').value}-` +
         `${p.find(x => x.type === 'day').value}`;
}

function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateToKey(date) {
  return `${date.getFullYear()}-` +
         `${String(date.getMonth() + 1).padStart(2, '0')}-` +
         `${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(key, days) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + days);
  return dateToKey(d);
}

function formatDateJP(key) {
  const d = keyToDate(key);
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${wd}）`;
}

// ============================================================
// URL params  /?weight=54.2&fat=28.1
// ============================================================

function handleURLParams() {
  const p = new URLSearchParams(location.search);
  const weightStr = p.get('weight');
  const fatStr    = p.get('fat');
  if (!weightStr && !fatStr) return;

  const updates = {};
  const w = parseFloat(weightStr);
  const f = parseFloat(fatStr);
  if (weightStr && !isNaN(w)) updates.weight = w;
  if (fatStr    && !isNaN(f)) updates.fat    = f;
  if (!Object.keys(updates).length) return;

  patchDayRecord(getTodayKey(), updates);
  history.replaceState({}, '', location.pathname);

  let msg = '体重を記録しました⚖️';
  if (updates.weight && updates.fat) {
    msg = `体重 ${updates.weight}kg・体脂肪率 ${updates.fat}% を記録しました⚖️`;
  } else if (updates.weight) {
    msg = `体重 ${updates.weight}kg を記録しました⚖️`;
  } else {
    msg = `体脂肪率 ${updates.fat}% を記録しました⚖️`;
  }
  showToast(msg);
}

// ============================================================
// Toast
// ============================================================

let _toastTimer = null;

function showToast(msg, ms = 3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// ============================================================
// Encouragement messages
// ============================================================

const MSG = {
  noAlcohol : ['お酒なしの日！🌿', 'からだが喜んでる◎', 'お酒なしえらい！🌿'],
  hadAlcohol: ['記録したことが大事◎', '飲んだ日も記録できてえらい', 'そんな日もあります🌙', 'からだのこと気にしてえらい◎'],
  general   : ['今日もおつかれさま🌙', '記録できてえらい！', 'よく覚えてたね◎', 'ゆっくり休んでね🍵', '自分を大切にしてる証拠◎', 'そっと記録できてよかった🌿'],
};

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function buildEncouragement(rec) {
  const all3 = rec.alcohol !== undefined && rec.snack !== undefined && rec.exercise !== undefined;

  if (all3) {
    if (rec.alcohol === 'none' && rec.exercise === 'yes')
      return rand(['お酒なし＆体も動かした！最高◎🌿', 'お酒なしで体も動かして、からだ喜んでる🌿']);
    if (rec.alcohol === 'none')   return rand(MSG.noAlcohol);
    if (rec.alcohol === 'more')   return rand(MSG.hadAlcohol);
    return rand(MSG.general);
  }

  if (rec.alcohol === 'more') return rand(MSG.hadAlcohol);
  if (rec.alcohol === 'none') return rand([...MSG.noAlcohol, ...MSG.general]);
  return rand(MSG.general);
}

// ============================================================
// Today tab
// ============================================================

let selectedKey;

function initTodayTab() {
  selectedKey = getTodayKey();

  document.getElementById('prev-day').addEventListener('click', () => {
    selectedKey = shiftDate(selectedKey, -1);
    renderToday();
  });
  document.getElementById('next-day').addEventListener('click', () => {
    if (selectedKey >= getTodayKey()) return;
    selectedKey = shiftDate(selectedKey, 1);
    renderToday();
  });
  document.getElementById('today-jump').addEventListener('click', () => {
    selectedKey = getTodayKey();
    renderToday();
  });

  document.querySelectorAll('.choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.closest('.button-group').dataset.category;
      patchDayRecord(selectedKey, { [category]: btn.dataset.value });
      renderToday();
      if (navigator.vibrate) navigator.vibrate(8);
    });
  });

  document.getElementById('export-btn').addEventListener('click', exportData);
  renderToday();
}

function relativeLabel(key, today) {
  const diff = Math.round((keyToDate(today) - keyToDate(key)) / 86400000);
  if (diff === 0) return '今日';
  if (diff === 1) return 'きのう';
  if (diff === 2) return 'おととい';
  return '';
}

function renderToday() {
  const today = getTodayKey();
  const rec = getDayRecord(selectedKey);

  const rel = relativeLabel(selectedKey, today);
  document.getElementById('date-display').textContent =
    rel ? `${formatDateJP(selectedKey)}・${rel}` : formatDateJP(selectedKey);
  document.getElementById('next-day').disabled = selectedKey >= today;
  document.getElementById('today-jump').classList.toggle('hidden', selectedKey === today);

  document.querySelectorAll('.button-group').forEach(group => {
    const val = rec[group.dataset.category];
    group.querySelectorAll('.choice-btn').forEach(btn =>
      btn.classList.toggle('selected', btn.dataset.value === val));
  });

  const msgEl = document.getElementById('encourage-msg');
  const hasAny = rec.alcohol !== undefined || rec.snack !== undefined || rec.exercise !== undefined;
  if (hasAny) {
    msgEl.textContent = buildEncouragement(rec);
    msgEl.classList.remove('hidden');
  } else {
    msgEl.classList.add('hidden');
  }

  renderMetrics(rec);
}

function renderMetrics(rec) {
  const el = document.getElementById('body-metrics');
  const parts = [];
  if (rec.weight != null) parts.push(`体重 ${rec.weight}kg`);
  if (rec.fat    != null) parts.push(`体脂肪率 ${rec.fat}%`);
  if (parts.length) {
    el.querySelector('.metrics-text').textContent = '⚖️ ' + parts.join('　');
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
  }
}

// ============================================================
// Export
// ============================================================

function exportData() {
  const blob = new Blob([JSON.stringify(getRecords(), null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `health-records-${getTodayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============================================================
// Charts
// ============================================================

let _weekChart = null;
let _weightChart = null;

function renderCharts() {
  renderWeeklyChart();
  renderWeightChart();
}

function getWeeklyStats() {
  const records = getRecords();
  const today   = getTodayKey();
  const sunday  = shiftDate(today, -keyToDate(today).getDay()); // this week's Sun

  return [3, 2, 1, 0].map(w => {
    const start = shiftDate(sunday, -7 * w);
    let noAlc = 0, noSnack = 0, moved = 0;

    for (let d = 0; d < 7; d++) {
      const k = shiftDate(start, d);
      if (k > today) continue;
      const r = records[k];
      if (!r) continue;
      if (r.alcohol  === 'none') noAlc++;
      if (r.snack    === 'none') noSnack++;
      if (r.exercise === 'yes')  moved++;
    }

    const date = keyToDate(start);
    return { label: `${date.getMonth() + 1}/${date.getDate()}〜`, noAlc, noSnack, moved };
  });
}

function renderWeeklyChart() {
  const data = getWeeklyStats();
  const ctx  = document.getElementById('weekly-chart').getContext('2d');
  _weekChart?.destroy();

  _weekChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(w => w.label),
      datasets: [
        { label: 'お酒なし',    data: data.map(w => w.noAlc),   backgroundColor: '#8ecf8e', borderRadius: 5 },
        { label: '間食なし',    data: data.map(w => w.noSnack), backgroundColor: '#f5c87a', borderRadius: 5 },
        { label: '体を動かした', data: data.map(w => w.moved),   backgroundColor: '#85b8d8', borderRadius: 5 },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { font: { size: 11 }, padding: 10, boxWidth: 12, boxHeight: 10 } },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: 7,
          ticks: { stepSize: 1, font: { size: 11 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        x: { ticks: { font: { size: 11 } }, grid: { display: false } },
      },
    },
  });
}

function getWeightPoints() {
  const records = getRecords();
  const today   = getTodayKey();
  const points  = [];

  for (let i = 29; i >= 0; i--) {
    const k = shiftDate(today, -i);
    const r = records[k];
    if (r && (r.weight != null || r.fat != null)) {
      const d = keyToDate(k);
      points.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, weight: r.weight ?? null, fat: r.fat ?? null });
    }
  }
  return points;
}

function renderWeightChart() {
  const points  = getWeightPoints();
  const canvas  = document.getElementById('weight-chart');
  const noData  = document.getElementById('no-weight-data');

  if (!points.length) {
    canvas.style.display = 'none';
    noData.classList.remove('hidden');
    return;
  }

  canvas.style.display = '';
  noData.classList.add('hidden');

  const hasW = points.some(p => p.weight != null);
  const hasF = points.some(p => p.fat    != null);

  const datasets = [];
  if (hasW) datasets.push({
    label: '体重(kg)', data: points.map(p => p.weight),
    borderColor: '#7aafcf', backgroundColor: 'rgba(122,175,207,0.08)',
    tension: 0.4, spanGaps: true, pointRadius: 4, pointBackgroundColor: '#7aafcf',
    yAxisID: 'y',
  });
  if (hasF) datasets.push({
    label: '体脂肪率(%)', data: points.map(p => p.fat),
    borderColor: '#e8926a', backgroundColor: 'rgba(232,146,106,0.08)',
    tension: 0.4, spanGaps: true, pointRadius: 4, pointBackgroundColor: '#e8926a',
    yAxisID: hasW ? 'y2' : 'y',
  });

  _weightChart?.destroy();

  _weightChart = new Chart(document.getElementById('weight-chart').getContext('2d'), {
    type: 'line',
    data: { labels: points.map(p => p.label), datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { font: { size: 11 }, padding: 10, boxWidth: 12, boxHeight: 10 } } },
      scales: {
        y: {
          display: hasW,
          ticks: { font: { size: 11 }, callback: v => v + 'kg' },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
        y2: {
          display: hasF && hasW,
          position: 'right',
          ticks: { font: { size: 11 }, callback: v => v + '%' },
          grid: { display: false },
        },
        x: {
          ticks: { font: { size: 10 }, maxRotation: 45, autoSkip: true, maxTicksLimit: 10 },
          grid: { display: false },
        },
      },
    },
  });
}

// ============================================================
// Monthly tab
// ============================================================

function getMonthStats(year, month) {
  const records = getRecords();
  const y = String(year);
  const m = String(month).padStart(2, '0');
  const start = `${y}-${m}-01`;
  const end   = `${y}-${m}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;

  let noAlc = 0, moved = 0, recorded = 0;
  for (const [k, r] of Object.entries(records)) {
    if (k < start || k > end) continue;
    if (r.alcohol !== undefined || r.snack !== undefined || r.exercise !== undefined) {
      recorded++;
      if (r.alcohol  === 'none') noAlc++;
      if (r.exercise === 'yes')  moved++;
    }
  }
  return { noAlc, moved, recorded };
}

function renderMonthly() {
  const today  = getTodayKey();
  const d      = keyToDate(today);
  const yr     = d.getFullYear();
  const mo     = d.getMonth() + 1;
  let pyr = yr, pmo = mo - 1;
  if (pmo === 0) { pmo = 12; pyr--; }

  const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  document.getElementById('monthly-title').textContent = `${MONTHS[mo - 1]}のまとめ`;

  const curr = getMonthStats(yr, mo);
  const prev = getMonthStats(pyr, pmo);
  const cont = document.getElementById('monthly-content');

  if (!curr.recorded) {
    cont.innerHTML = `<div class="monthly-empty">
      <p>まだ今月の記録がありません🌱</p>
      <p>「今日」タブから記録してみてください</p>
    </div>`;
    return;
  }

  const comment = buildMonthlyComment(curr, prev);

  cont.innerHTML = `<div class="monthly-card">
    <div class="monthly-stat">
      <span class="stat-icon">🌿</span>
      <span class="stat-label">お酒なしの日</span>
      <span class="stat-count">${curr.noAlc}</span>
      <span class="stat-unit">日</span>
    </div>
    <div class="monthly-stat">
      <span class="stat-icon">🚶</span>
      <span class="stat-label">体を動かした日</span>
      <span class="stat-count">${curr.moved}</span>
      <span class="stat-unit">日</span>
    </div>
    <div class="monthly-stat">
      <span class="stat-icon">📝</span>
      <span class="stat-label">記録した日</span>
      <span class="stat-count">${curr.recorded}</span>
      <span class="stat-unit">日</span>
    </div>
    <div class="monthly-comment">${comment}</div>
  </div>`;
}

function buildMonthlyComment(curr, prev) {
  if (!prev.recorded) return '記録を続けると、来月には変化が見えてくるかも🌿';

  const da = curr.noAlc - prev.noAlc;
  const de = curr.moved - prev.moved;

  if (da > 0 && de > 0)
    return `先月よりお酒なしの日が${da}日、体を動かした日も${de}日増えてます🌿`;
  if (da > 0) return `先月よりお酒なしの日が${da}日増えてます🌿`;
  if (de > 0) return `先月より体を動かした日が${de}日増えてます◎`;
  if (da < 0 || de < 0) return 'そういう月もあります。記録できているだけで十分◎';
  return '先月とほぼ同じペース。コンスタントに続けてるね◎';
}

// ============================================================
// Tab navigation
// ============================================================

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
}

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(s =>
    s.classList.toggle('active', s.id === `tab-${name}`));

  if (name === 'chart')   renderCharts();
  if (name === 'monthly') renderMonthly();
}

// ============================================================
// Service Worker
// ============================================================

function registerSW() {
  if ('serviceWorker' in navigator)
    navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ============================================================
// Boot
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  registerSW();
  handleURLParams();
  initTabs();
  initTodayTab();
});
