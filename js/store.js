// =========================================================================
// 本地存储层（localStorage）
// 学员档案 / 考试成绩(含逐题明细) / 错题本 / 资料进度 / 管理员 / 导入导出 / 演示数据
// 纯前端无后端：跨设备数据通过「导出/导入」在 HR 端汇总
// =========================================================================
const K_RESULTS = 'siemens_si_results';
const K_WRONG   = 'siemens_si_wrong';
const K_READ    = 'siemens_si_read';
const K_PROFILE = 'siemens_si_profile';
const K_ADMIN   = 'siemens_si_admin';        // sessionStorage

export const ADMIN_PASSCODE = 'siemens2025'; // 演示口令（前端原型，非真实鉴权）

export const DEPARTMENTS = ['华东区', '华南区', '华北区', '华中区', '西南区', '东北区', '西北区'];

function load(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
  catch { return fallback; }
}
function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* 隐私模式忽略 */ }
}

// ---------------- 学员档案 ----------------
export function getProfile() { return load(K_PROFILE, null); }
export function hasProfile() { const p = getProfile(); return !!(p && p.name); }
export function setProfile(p) {
  const prev = getProfile() || {};
  const merged = { name: '', dept: DEPARTMENTS[0], empId: '', ...prev, ...p, updatedAt: Date.now() };
  save(K_PROFILE, merged);
  return merged;
}
export function clearProfile() { try { localStorage.removeItem(K_PROFILE); } catch {} }

// ---------------- 管理员（前端口令门控，仅原型演示用） ----------------
export function isAdmin() { try { return sessionStorage.getItem(K_ADMIN) === '1'; } catch { return false; } }
export function unlockAdmin(code) {
  if (String(code).trim() === ADMIN_PASSCODE) { try { sessionStorage.setItem(K_ADMIN, '1'); } catch {} return true; }
  return false;
}
export function lockAdmin() { try { sessionStorage.removeItem(K_ADMIN); } catch {} }

// ---------------- 考试成绩 ----------------
export function getResults() { return load(K_RESULTS, []); }

export function addResult(rec) {
  const list = getResults();
  if (!rec.id) rec.id = 'r' + rec.ts + '-' + Math.random().toString(36).slice(2, 7);
  list.unshift(rec);                      // 最新在前
  save(K_RESULTS, list.slice(0, 2000));   // 上限提高以容纳多学员汇总
  return rec;
}
export function clearResults() { save(K_RESULTS, []); }

/** 仅当前学员的成绩 */
export function getMyResults() {
  const p = getProfile();
  const name = p && p.name ? p.name : null;
  return getResults().filter(r => (name ? r.name === name : !r.name));
}

// ---------------- 错题本 ----------------
export function getWrong() { return load(K_WRONG, {}); }
export function addWrong(question) {
  const w = getWrong();
  w[question.id] = { id: question.id, category: question.category, module: question.module, ts: Date.now() };
  save(K_WRONG, w);
}
export function removeWrong(id) { const w = getWrong(); delete w[id]; save(K_WRONG, w); }
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

// ---------------- 导出 / 导入（HR 汇总用） ----------------
export function exportResults(onlyMine = false) {
  const data = onlyMine ? getMyResults() : getResults();
  return {
    app: '西门子SI渠道销售培训考核平台',
    type: 'results-export',
    version: 1,
    exportedAt: Date.now(),
    count: data.length,
    results: data,
  };
}

/** 合并导入成绩（按 id 去重）。返回新增条数 */
export function importResults(payload) {
  let incoming = [];
  if (Array.isArray(payload)) incoming = payload;
  else if (payload && Array.isArray(payload.results)) incoming = payload.results;
  else throw new Error('文件格式不正确：未找到 results 数组');

  const list = getResults();
  const seen = new Set(list.map(r => r.id).filter(Boolean));
  let added = 0;
  for (const r of incoming) {
    if (!r || typeof r !== 'object') continue;
    if (!r.id) r.id = 'r' + (r.ts || Date.now()) + '-' + Math.random().toString(36).slice(2, 7);
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    list.push(r);
    added++;
  }
  list.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  save(K_RESULTS, list.slice(0, 5000));
  return added;
}

// ---------------- 演示数据（让 HR 后台开箱即满） ----------------
const DEMO_SURNAMES = '王李张刘陈杨赵黄周吴徐孙马朱胡郭何高林郑'.split('');
const DEMO_GIVEN = ['伟','芳','娜','秀英','敏','静','磊','强','军','洋','勇','艳','杰','涛','明','超','霞','平','刚','桂英','建国','晓东','文博','嘉怡','子涵'];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randint(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

/** 生成演示数据：基于真实题库，按模块抽题并按学员水平判对错 */
export function seedDemo(qdata) {
  const questions = qdata.questions;
  const modules = qdata.modules;
  const byModule = {};
  modules.forEach(m => byModule[m.id] = questions.filter(q => q.module === m.id));

  const N = 16;                              // 演示学员数
  const usedNames = new Set();
  const results = [];
  const now = Date.now();

  for (let i = 0; i < N; i++) {
    let name;
    do { name = rand(DEMO_SURNAMES) + rand(DEMO_GIVEN); } while (usedNames.has(name));
    usedNames.add(name);
    const dept = rand(DEPARTMENTS);
    const skill = 0.60 + Math.random() * 0.36;       // 个人水平 0.60~0.96
    const attempts = randint(1, 4);

    for (let a = 0; a < attempts; a++) {
      // 随机选一个模块或综合
      const useAll = Math.random() < 0.35;
      const pool = useAll ? questions : (byModule[rand(modules).id] || questions);
      const title = useAll ? '综合模拟考核' : (modules.find(m => pool[0] && m.id === pool[0].module)?.name + ' 专项考核') || '专项考核';
      const total = Math.min(randint(10, 20), pool.length);
      // 抽题
      const picked = pool.slice().sort(() => Math.random() - 0.5).slice(0, total);
      const detail = picked.map(q => {
        // 多选更难
        const p = skill * (q.type === 'multiple' ? 0.9 : 1) - (Math.random() * 0.06);
        return { id: q.id, category: q.category, module: q.module, correct: Math.random() < p };
      });
      const correct = detail.filter(d => d.correct).length;
      const rate = Math.round(correct / total * 100);
      const pass = rate >= 60;
      const grade = rate >= 90 ? '优秀' : rate >= 80 ? '良好' : rate >= 60 ? '合格' : '不合格';
      const ts = now - randint(0, 45) * 86400000 - randint(0, 86400) * 1000; // 过去45天内
      results.push({
        id: 'demo-' + i + '-' + a + '-' + Math.random().toString(36).slice(2, 6),
        ts, name, dept, title, total, correct, rate, pass, grade,
        timeSpent: randint(180, 1200), mode: 'exam', demo: true, detail,
      });
    }
  }
  // 合并进现有成绩
  const list = getResults().filter(r => !r.demo);   // 先清除旧演示
  save(K_RESULTS, [...results, ...list].sort((a, b) => b.ts - a.ts).slice(0, 5000));
  return results.length;
}

export function clearDemo() {
  const list = getResults().filter(r => !r.demo);
  save(K_RESULTS, list);
}
export function hasDemo() { return getResults().some(r => r.demo); }
