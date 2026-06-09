// =========================================================================
// HR 管理后台：销售团队学习考核数据分析驾驶舱
// 数据来源：本机考核记录 + 导入的学员成绩 + 演示数据（纯前端，无后端）
// =========================================================================
import {
  getResults, clearResults, seedDemo, clearDemo, hasDemo,
  importResults, exportResults, lockAdmin,
} from './store.js';
import { loadQuestions } from './data.js';
import { h, esc, fmtDate, fmtClock, avg, downloadJSON, downloadFile, toCSV } from './util.js';
import { refreshChip } from './app.js';

export async function renderAdmin(app) {
  const qd = await loadQuestions();
  const results = getResults();
  app.innerHTML = '';

  // ---------- 顶部标题 + 操作 ----------
  app.appendChild(h('div.admin-head', null,
    h('div', null,
      h('div.eyebrow', null, 'SIEMENS · HR ANALYTICS'),
      h('h2', { style: 'margin:2px 0' }, '🛡 HR 管理后台 · 学习考核分析'),
      h('p.text-muted', { style: 'margin:0' }, '面向渠道销售团队的培训数据驾驶舱：掌握学习进度、定位薄弱环节、辅助培训决策。'),
    ),
    h('div.btn-row', null,
      h('button.btn.btn-ghost.btn-sm', { onclick: () => { lockAdmin(); refreshChip(); location.hash = '#/home'; } }, '🔒 退出后台'),
    ),
  ));

  // ---------- 数据管理条 ----------
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      const n = importResults(obj);
      alert(`导入成功，新增 ${n} 条成绩记录。`);
      renderAdmin(app);
    } catch (err) { alert('导入失败：' + err.message); }
    fileInput.value = '';
  });

  app.appendChild(h('div.card.toolbar', null,
    h('span.toolbar-label', null, '📦 数据管理'),
    hasDemo()
      ? h('button.btn.btn-ghost.btn-sm', { onclick: () => { clearDemo(); renderAdmin(app); } }, '清除演示数据')
      : h('button.btn.btn-sm', { onclick: () => { seedDemo(qd); renderAdmin(app); } }, '✨ 载入演示数据'),
    h('button.btn.btn-ghost.btn-sm', { onclick: () => fileInput.click() }, '⬆ 导入学员成绩'),
    h('button.btn.btn-ghost.btn-sm', { onclick: () => exportCSV(results) }, '⬇ 导出 CSV 报表'),
    h('button.btn.btn-ghost.btn-sm', { onclick: () => downloadJSON(`SI培训成绩备份_${today()}.json`, exportResults(false)) }, '⬇ 导出 JSON 备份'),
    results.length ? h('button.btn.btn-ghost.btn-sm', { onclick: () => { if (confirm('确定清空全部成绩数据（含导入与演示）？')) { clearResults(); renderAdmin(app); } } }, '清空全部') : null,
    fileInput,
  ));

  if (!results.length) {
    app.appendChild(h('div.empty-state', null,
      h('div.es-ic', null, '📊'),
      h('h3', null, '暂无学习考核数据'),
      h('p.text-muted', null, '点击「✨ 载入演示数据」可一键查看后台全部分析效果；正式使用时，学员在「我的成绩」导出，HR 在此导入即可汇总。'),
      h('button.btn', { onclick: () => { seedDemo(qd); renderAdmin(app); } }, '✨ 载入演示数据'),
    ));
    return;
  }

  // ---------- 计算 ----------
  const trainees = byTrainee(results);
  const depts = byDept(results);
  const mods = moduleMastery(results, qd);
  const cats = categoryMastery(results);
  const hard = hardest(results, qd);
  const passRate = Math.round(results.filter(r => r.pass).length / results.length * 100);
  const overallAvg = avg(results.map(r => r.rate || 0));

  // ---------- KPI ----------
  app.appendChild(h('div.kpi-row', null,
    kpi(trainees.length, '参训学员'),
    kpi(results.length, '考核次数'),
    kpi(overallAvg + '%', '平均正确率'),
    kpi(passRate + '%', '整体合格率'),
  ));

  // ---------- 概览：合格率环 + 部门对比 ----------
  app.appendChild(h('div.grid.grid-2.admin-grid', null,
    panel('整体达标情况', null,
      h('div.ring-wrap', null,
        ring(passRate, '合格率'),
        h('div.ring-legend', null,
          legendItem('var(--ok)', `合格 ${results.filter(r => r.pass).length} 次`),
          legendItem('var(--line)', `不合格 ${results.filter(r => !r.pass).length} 次`),
          h('div.text-muted', { style: 'font-size:12.5px;margin-top:6px' }, `合格线 60% · 平均 ${overallAvg}%`),
        ),
      ),
    ),
    panel('各销售区域平均正确率', '按部门聚合，识别区域间能力差异',
      h('div.bars', null, ...depts.map(d => bar(d.dept, d.avg, { sub: `${d.people}人 · ${d.exams}次` }))),
    ),
  ));

  // ---------- 知识薄弱点（模块） ----------
  app.appendChild(panel('🎯 知识薄弱点分析（按能力模块）', '正确率越低 = 越需要加强培训；红色为低于 70% 的薄弱模块',
    h('div.bars', null, ...mods.map(m => bar(`${m.icon} ${m.name}`, m.rate, { sub: `${m.total} 次作答`, danger: m.rate < 70 }))),
    mods.length ? h('div.insight', null, '💡 培训建议：优先针对 ',
      h('b', null, mods.filter(m => m.rate < 70).map(m => m.name).join('、') || mods[0].name),
      ' 安排专项辅导与复训。') : null,
  ));

  // ---------- 薄弱知识分类 Top + 难题排行 ----------
  app.appendChild(h('div.grid.grid-2.admin-grid', null,
    panel('最薄弱知识分类 Top 8', '细分到具体专题',
      h('table.record-table', null,
        h('thead', null, h('tr', null, h('th', null, '知识分类'), h('th', null, '正确率'), h('th', null, '作答数'))),
        h('tbody', null, ...cats.slice(0, 8).map(c => h('tr', null,
          h('td', null, c.category),
          h('td', null, h('span', { class: 'rate-tag ' + rateCls(c.rate) }, c.rate + '%')),
          h('td', null, String(c.total)),
        ))),
      ),
    ),
    panel('🔥 难题排行 Top 8', '全员错得最多的题目（作答≥3次）',
      hard.length ? h('div.hard-list', null, ...hard.map((x, i) => h('div.hard-item', null,
        h('span.hard-rank', null, String(i + 1)),
        h('div', { style: 'flex:1;min-width:0' },
          h('div.hard-q', { title: x.q ? x.q.question : '' }, x.q ? x.q.question : ('题目#' + x.id)),
          h('div.text-muted', { style: 'font-size:12px' }, `${x.category} · 作答 ${x.total} 次`),
        ),
        h('span', { class: 'rate-tag ' + rateCls(x.rate) }, x.rate + '%'),
      ))) : h('p.text-muted', null, '暂无足够作答样本。'),
    ),
  ));

  // ---------- 排行榜 ----------
  const top = trainees.filter(t => t.name !== '(未登记)').slice().sort((a, b) => b.avg - a.avg).slice(0, 5);
  if (top.length) {
    app.appendChild(panel('🏆 学员排行榜（按平均正确率）', null,
      h('div.lead-row', null, ...top.map((t, i) => h('div.lead-card', null,
        h('div', { class: 'lead-medal m' + i }, i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1)),
        h('div.lead-name', null, esc(t.name)),
        h('div.text-muted', { style: 'font-size:12px' }, esc(t.dept)),
        h('div.lead-score', null, t.avg + '%'),
      ))),
    ));
  }

  // ---------- 学员明细表 ----------
  app.appendChild(h('div.section-head', { style: 'margin-top:30px' },
    h('h3', { style: 'margin:0' }, '👥 学员学习明细'),
    h('span.sub', null, `共 ${trainees.length} 名学员`),
  ));
  const sorted = trainees.slice().sort((a, b) => b.avg - a.avg);
  app.appendChild(h('div.table-scroll', null,
    h('table.record-table', null,
      h('thead', null, h('tr', null,
        h('th', null, '排名'), h('th', null, '姓名'), h('th', null, '区域'),
        h('th', null, '考核次数'), h('th', null, '平均正确率'), h('th', null, '最高'),
        h('th', null, '合格次数'), h('th', null, '最近活跃'), h('th', null, '状态'))),
      h('tbody', null, ...sorted.map((t, i) => h('tr', null,
        h('td', null, String(i + 1)),
        h('td', { style: 'font-weight:700' }, esc(t.name)),
        h('td', null, esc(t.dept || '—')),
        h('td', null, String(t.exams)),
        h('td', null, h('span', { class: 'rate-tag ' + rateCls(t.avg) }, t.avg + '%')),
        h('td', null, t.best + '%'),
        h('td', null, `${t.pass}/${t.exams}`),
        h('td', null, t.lastTs ? fmtDate(t.lastTs) : '—'),
        h('td', null, h('span', { class: 'badge ' + (t.avg >= 80 ? 'badge-ok' : t.avg >= 60 ? 'badge-petrol' : 'badge-err') },
          t.avg >= 80 ? '优秀' : t.avg >= 60 ? '达标' : '待提升')),
      ))),
    ),
  ));

  app.appendChild(h('p.text-muted', { style: 'margin-top:18px;font-size:12.5px' },
    '数据来源：本机考核记录 + 导入的学员成绩 + 演示数据。本平台为纯前端原型，正式部署可对接企业 LMS / 数据库实现集中统计。'));
}

// =========================================================================
// 计算函数
// =========================================================================
function byTrainee(results) {
  const map = new Map();
  for (const r of results) {
    const key = r.name || '(未登记)';
    if (!map.has(key)) map.set(key, { name: key, dept: r.dept || '', empId: r.empId || '', exams: 0, rates: [], best: 0, pass: 0, lastTs: 0 });
    const t = map.get(key);
    t.exams++; t.rates.push(r.rate || 0); t.best = Math.max(t.best, r.rate || 0);
    if (r.pass) t.pass++;
    if ((r.ts || 0) > t.lastTs) { t.lastTs = r.ts || 0; t.dept = r.dept || t.dept; }
  }
  return [...map.values()].map(t => ({ ...t, avg: avg(t.rates) }));
}

function byDept(results) {
  const map = new Map();
  for (const r of results) {
    const d = r.dept || '(未分组)';
    if (!map.has(d)) map.set(d, { dept: d, names: new Set(), exams: 0, rates: [], pass: 0 });
    const m = map.get(d);
    if (r.name) m.names.add(r.name);
    m.exams++; m.rates.push(r.rate || 0); if (r.pass) m.pass++;
  }
  return [...map.values()].map(m => ({
    dept: m.dept, people: m.names.size, exams: m.exams, avg: avg(m.rates),
    passRate: m.exams ? Math.round(m.pass / m.exams * 100) : 0,
  })).sort((a, b) => b.avg - a.avg);
}

function moduleMastery(results, qd) {
  const tally = {}; qd.modules.forEach(m => tally[m.id] = { correct: 0, total: 0 });
  for (const r of results) for (const d of (r.detail || [])) {
    if (tally[d.module]) { tally[d.module].total++; if (d.correct) tally[d.module].correct++; }
  }
  return qd.modules.map(m => ({
    id: m.id, name: m.name, icon: m.icon, ...tally[m.id],
    rate: tally[m.id].total ? Math.round(tally[m.id].correct / tally[m.id].total * 100) : 0,
  })).filter(x => x.total > 0).sort((a, b) => a.rate - b.rate);
}

function categoryMastery(results) {
  const tally = {};
  for (const r of results) for (const d of (r.detail || [])) {
    const t = tally[d.category] || (tally[d.category] = { correct: 0, total: 0 });
    t.total++; if (d.correct) t.correct++;
  }
  return Object.entries(tally).map(([category, t]) => ({
    category, total: t.total, rate: Math.round(t.correct / t.total * 100),
  })).sort((a, b) => a.rate - b.rate);
}

function hardest(results, qd, minAttempts = 3, topN = 8) {
  const tally = {};
  for (const r of results) for (const d of (r.detail || [])) {
    const t = tally[d.id] || (tally[d.id] = { correct: 0, total: 0, category: d.category });
    t.total++; if (d.correct) t.correct++;
  }
  const qmap = new Map(qd.questions.map(q => [q.id, q]));
  return Object.entries(tally).map(([id, t]) => ({
    id: +id, ...t, rate: Math.round(t.correct / t.total * 100), q: qmap.get(+id),
  })).filter(x => x.total >= minAttempts).sort((a, b) => a.rate - b.rate).slice(0, topN);
}

// =========================================================================
// 渲染辅助
// =========================================================================
function kpi(num, lbl) { return h('div.kpi', null, h('div.k-num', null, String(num)), h('div.k-lbl', null, lbl)); }

function panel(title, sub, ...children) {
  return h('div.card.panel', null,
    h('div.panel-head', null, h('h3', null, title), sub ? h('span.panel-sub', null, sub) : null),
    ...children,
  );
}

function bar(label, value, opts = {}) {
  const pct = Math.max(2, Math.min(100, value));
  return h('div.bar-row', null,
    h('div.bar-label', { title: label }, label, opts.sub ? h('span.bar-sub', null, opts.sub) : null),
    h('div.bar-track', null, h('i', { class: 'bar-fill' + (opts.danger ? ' danger' : ''), style: `width:${pct}%` })),
    h('div.bar-val', null, value + '%'),
  );
}

function ring(pct, label) {
  return h('div.ring', { style: `background: conic-gradient(var(--petrol) ${pct * 3.6}deg, var(--bg-soft) 0deg)` },
    h('div.ring-hole', null, h('div.ring-num', null, pct + '%'), h('div.ring-lbl', null, label)));
}
function legendItem(color, text) { return h('div.lg-item', null, h('i', { style: `background:${color}` }), text); }

function rateCls(rate) { return rate >= 80 ? 'ok' : rate >= 60 ? 'mid' : 'bad'; }

function today() { return new Date().toISOString().slice(0, 10); }

function exportCSV(results) {
  const rows = results.map(r => ({
    时间: fmtDate(r.ts), 姓名: r.name || '', 区域: r.dept || '', 工号: r.empId || '',
    考核范围: r.title || '', 题数: r.total, 答对: r.correct, 正确率: (r.rate || 0) + '%',
    评级: r.grade || '', 是否合格: r.pass ? '合格' : '不合格', 用时秒: r.timeSpent || 0,
  }));
  downloadFile(`SI培训成绩报表_${today()}.csv`, toCSV(rows), 'text/csv');
}
