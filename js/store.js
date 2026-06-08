// =========================================================================
// 本地存储层（localStorage）：考试成绩、错题本、资料学习进度
// 纯前端无后端，数据保存在浏览器本地
// =========================================================================
const K_RESULTS = 'siemens_si_results';
const K_WRONG   = 'siemens_si_wrong';
const K_READ    = 'siemens_si_read';

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式忽略 */ }
}

// ---------------- 考试成绩 ----------------
export function getResults() { return load(K_RESULTS, []); }

export function addResult(rec) {
  const list = getResults();
  list.unshift(rec);                 // 最新在前
  save(K_RESULTS, list.slice(0, 100)); // 仅保留最近100条
  return rec;
}

export function clearResults() { save(K_RESULTS, []); }

// ---------------- 错题本 ----------------
// 以题目 id 为键存储错题快照
export function getWrong() { return load(K_WRONG, {}); }

export function addWrong(question) {
  const w = getWrong();
  w[question.id] = { id: question.id, category: question.category, module: question.module, ts: Date.now() };
  save(K_WRONG, w);
}

export function removeWrong(id) {
  const w = getWrong();
  delete w[id];
  save(K_WRONG, w);
}

export function getWrongIds() { return Object.keys(getWrong()).map(Number); }
export function clearWrong() { save(K_WRONG, {}); }

// ---------------- 资料学习进度 ----------------
export function getRead() { return load(K_READ, {}); }
export function isRead(file) { return !!getRead()[file]; }
export function markRead(file) { const r = getRead(); r[file] = Date.now(); save(K_READ, r); }
export function toggleRead(file) {
  const r = getRead();
  if (r[file]) delete r[file]; else r[file] = Date.now();
  save(K_READ, r);
  return !!r[file];
}
export function readCount() { return Object.keys(getRead()).length; }
