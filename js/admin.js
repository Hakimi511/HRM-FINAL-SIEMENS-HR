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
    h('button.btn.btn-ghost.btn-sm', { onclick: () => exportSummaryCSV(byTrainee(results), qd) }, '⬇ 导出员工汇总(CSV)'),
    h('button.btn.btn-ghost.btn-sm', { onclick: () => exportDeptCSV(byDept(results), results, qd) }, '⬇ 导出区域诊断(CSV)'),
    h('button.btn.btn-ghost.btn-sm', { onclick: () => exportCSV(results) }, '⬇ 导出逐次成绩(CSV)'),
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
        h('div.text-muted', { style: 'font-size:11.5px' }, `${esc(t.empId || '—')} · ${esc(t.dept)}`),
        h('div.lead-score', null, t.avg + '%'),
      ))),
    ));
  }

  // ---------- 区域学习诊断（按大区聚合，点击查看详情） ----------
  app.appendChild(h('div.section-head', { style: 'margin-top:30px' },
    h('h3', { style: 'margin:0' }, '📍 区域学习诊断'),
    h('span.sub', null, `共 ${depts.length} 个区域 · 点击任一行查看该区域的薄弱点与培训建议`),
  ));
  app.appendChild(h('div.table-scroll', null,
    h('table.record-table', null,
      h('thead', null, h('tr', null,
        h('th', null, '排名'), h('th', null, '销售区域'), h('th', null, '学员数'),
        h('th', null, '考核次数'), h('th', null, '平均正确率'), h('th', null, '合格率'),
        h('th', null, '最薄弱能力模块'), h('th', null, '最近活跃'), h('th', null, '操作'))),
      h('tbody', null, ...depts.map((d, i) => {
        const det = deptDetail(results, d.dept, qd);
        const weak = det.weakMod;
        return h('tr', { class: 'row-click', onclick: () => showDeptDetail(det, qd) },
          h('td', null, String(i + 1)),
          h('td', { style: 'font-weight:700;color:var(--petrol-darker)' }, esc(d.dept)),
          h('td', null, String(d.people)),
          h('td', null, String(d.exams)),
          h('td', null, h('span', { class: 'rate-tag ' + rateCls(d.avg) }, d.avg + '%')),
          h('td', null, h('span', { class: 'rate-tag ' + rateCls(d.passRate) }, d.passRate + '%')),
          h('td', null, weak
            ? h('span', { class: 'badge ' + (weak.rate < 70 ? 'badge-err' : 'badge-petrol') },
                `${weak.icon} ${weak.name} ${weak.rate}%`)
            : '—'),
          h('td', null, d.lastTs ? fmtDate(d.lastTs) : '—'),
          h('td', null, h('button.btn.btn-ghost.btn-sm', { onclick: (e) => { e.stopPropagation(); showDeptDetail(det, qd); } }, '查看详情')),
        );
      })),
    ),
  ));

  // ---------- 学员明细表（按工号汇总） ----------
  app.appendChild(h('div.section-head', { style: 'margin-top:30px' },
    h('h3', { style: 'margin:0' }, '👥 学员学习明细（按工号汇总）'),
    h('span.sub', null, `共 ${trainees.length} 名学员 · 点击任一行查看个人答题详情`),
  ));
  app.appendChild(h('p.text-muted', { style: 'font-size:12.5px;margin:-6px 0 10px' },
    '💡 工号唯一标识每位学员，避免重名混淆；点「复制」即可复制工号，在 Teams 中查找该员工建立联系。'));
  const sorted = trainees.slice().sort((a, b) => b.avg - a.avg);
  app.appendChild(h('div.table-scroll', null,
    h('table.record-table', null,
      h('thead', null, h('tr', null,
        h('th', null, '排名'), h('th', null, '工号'), h('th', null, '姓名'), h('th', null, '区域'),
        h('th', null, '考核次数'), h('th', null, '平均正确率'), h('th', null, '最高'),
        h('th', null, '合格次数'), h('th', null, '最近活跃'), h('th', null, '状态'), h('th', null, '操作'))),
      h('tbody', null, ...sorted.map((t, i) => h('tr', { class: 'row-click', onclick: () => showTraineeDetail(t, qd) },
        h('td', null, String(i + 1)),
        h('td', { style: 'font-weight:700;color:var(--petrol-darker)' }, t.empId || '—'),
        h('td', { style: 'font-weight:700' }, esc(t.name)),
        h('td', null, esc(t.dept || '—')),
        h('td', null, String(t.exams)),
        h('td', null, h('span', { class: 'rate-tag ' + rateCls(t.avg) }, t.avg + '%')),
        h('td', null, t.best + '%'),
        h('td', null, `${t.pass}/${t.exams}`),
        h('td', null, t.lastTs ? fmtDate(t.lastTs) : '—'),
        h('td', null, h('span', { class: 'badge ' + (t.avg >= 80 ? 'badge-ok' : t.avg >= 60 ? 'badge-petrol' : 'badge-err') },
          t.avg >= 80 ? '优秀' : t.avg >= 60 ? '达标' : '待提升')),
        h('td', null, t.empId
          ? h('button.btn.btn-ghost.btn-sm', { onclick: (e) => { e.stopPropagation(); copyText(t.empId); } }, '复制')
          : '—'),
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
  // 以工号为唯一键聚合（避免重名）；无工号则退回用姓名
  const map = new Map();
  for (const r of results) {
    const key = r.empId || r.name || '(未登记)';
    if (!map.has(key)) map.set(key, { key, name: r.name || '(未登记)', empId: r.empId || '', dept: r.dept || '', exams: 0, rates: [], best: 0, pass: 0, lastTs: 0, mod: {} });
    const t = map.get(key);
    t.exams++; t.rates.push(r.rate || 0); t.best = Math.max(t.best, r.rate || 0);
    if (r.pass) t.pass++;
    if ((r.ts || 0) > t.lastTs) { t.lastTs = r.ts || 0; t.dept = r.dept || t.dept; t.name = r.name || t.name; }
    for (const d of (r.detail || [])) {   // 逐题明细 → 各模块掌握度（个人详情用）
      const m = t.mod[d.module] || (t.mod[d.module] = { c: 0, t: 0 });
      m.t++; if (d.correct) m.c++;
    }
  }
  return [...map.values()].map(t => ({ ...t, avg: avg(t.rates) }));
}

function byDept(results) {
  const map = new Map();
  for (const r of results) {
    const d = r.dept || '(未分组)';
    if (!map.has(d)) map.set(d, { dept: d, names: new Set(), empIds: new Set(), exams: 0, rates: [], pass: 0, lastTs: 0 });
    const m = map.get(d);
    if (r.empId) m.empIds.add(r.empId); else if (r.name) m.names.add(r.name);
    m.exams++; m.rates.push(r.rate || 0); if (r.pass) m.pass++;
    if ((r.ts || 0) > m.lastTs) m.lastTs = r.ts || 0;
  }
  return [...map.values()].map(m => ({
    dept: m.dept,
    people: (m.empIds.size || m.names.size),
    exams: m.exams, avg: avg(m.rates),
    passRate: m.exams ? Math.round(m.pass / m.exams * 100) : 0,
    lastTs: m.lastTs,
  })).sort((a, b) => b.avg - a.avg);
}

// 计算某大区的细化诊断（薄弱模块、薄弱分类、难题、学员排名）
function deptDetail(allResults, deptName, qd) {
  const rs = allResults.filter(r => (r.dept || '(未分组)') === deptName);
  const mods = moduleMastery(rs, qd);
  const cats = categoryMastery(rs);
  const hard = hardest(rs, qd, 2, 5);
  const trainees = byTrainee(rs).sort((a, b) => b.avg - a.avg);
  const passN = rs.filter(r => r.pass).length;
  return {
    dept: deptName,
    exams: rs.length,
    passN,
    passRate: rs.length ? Math.round(passN / rs.length * 100) : 0,
    avg: avg(rs.map(r => r.rate || 0)),
    lastTs: rs.reduce((m, r) => Math.max(m, r.ts || 0), 0),
    people: trainees.length,
    mods, cats, hard, trainees,
    weakMod: mods.length ? mods[0] : null,             // 模块按 rate 升序，第一个最弱
  };
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
    时间: fmtDate(r.ts), 工号: r.empId || '', 姓名: r.name || '', 区域: r.dept || '',
    考核范围: r.title || '', 题数: r.total, 答对: r.correct, 正确率: (r.rate || 0) + '%',
    评级: r.grade || '', 是否合格: r.pass ? '合格' : '不合格', 用时秒: r.timeSpent || 0,
  }));
  downloadFile(`SI逐次成绩报表_${today()}.csv`, toCSV(rows), 'text/csv');
}

// 员工汇总报表：每人一行（工号优先）+ 各能力模块正确率，便于 HR 详细分析
function exportSummaryCSV(trainees, qd) {
  const rows = trainees.slice().sort((a, b) => b.avg - a.avg).map(t => {
    const row = {
      工号: t.empId || '', 姓名: t.name || '', 区域: t.dept || '',
      考核次数: t.exams, 平均正确率: t.avg + '%', 最高正确率: t.best + '%',
      合格次数: `${t.pass}/${t.exams}`,
      状态: t.avg >= 80 ? '优秀' : t.avg >= 60 ? '达标' : '待提升',
      最近活跃: t.lastTs ? fmtDate(t.lastTs) : '',
    };
    qd.modules.forEach(m => {
      const x = t.mod[m.id];
      row[m.name] = (x && x.t) ? Math.round(x.c / x.t * 100) + '%' : '—';
    });
    return row;
  });
  downloadFile(`SI员工学习汇总_${today()}.csv`, toCSV(rows), 'text/csv');
}

// 个人答题详情弹窗：工号（可复制）+ 各能力模块掌握度
function showTraineeDetail(t, qd) {
  const modBars = qd.modules.map(m => {
    const x = t.mod[m.id]; if (!x || !x.t) return null;
    const rate = Math.round(x.c / x.t * 100);
    return bar(`${m.icon} ${m.name}`, rate, { sub: `${x.t} 题`, danger: rate < 70 });
  }).filter(Boolean);

  const panel = h('div.id-card', { style: 'width:min(560px,94vw)' },
    h('h3', { style: 'margin-bottom:6px' }, `👤 ${esc(t.name)}`),
    h('div.detail-id', null,
      h('span.text-muted', null, '工号　'),
      h('b', { style: 'color:var(--petrol-darker);font-size:15px' }, t.empId || '（未填写）'),
      t.empId ? h('button.btn.btn-ghost.btn-sm', { style: 'margin-left:10px', onclick: () => copyText(t.empId) }, '复制工号') : null,
    ),
    h('p.text-muted', { style: 'margin:8px 0 12px;font-size:13px' },
      `区域：${esc(t.dept || '—')}　|　考核 ${t.exams} 次　|　平均 ${t.avg}%　|　最高 ${t.best}%　|　合格 ${t.pass}/${t.exams}`),
    h('div.panel-head', null, h('h3', { style: 'font-size:14px;margin:0' }, '各能力模块答题情况')),
    modBars.length ? h('div.bars', { style: 'margin-top:8px' }, ...modBars)
      : h('p.text-muted', null, '该学员暂无逐题明细数据（可能为导入的汇总记录）。'),
    h('div.btn-row', { style: 'margin-top:18px' }, h('button.btn', { onclick: () => close() }, '关闭')),
  );
  const close = miniModal(panel);
}

function miniModal(panel) {
  const back = h('div.modal', { style: 'display:grid' });
  back.appendChild(h('div.modal-backdrop'));
  back.appendChild(h('div.modal-mini', null, panel));
  document.body.appendChild(back);
  document.body.style.overflow = 'hidden';
  const close = () => { back.remove(); document.body.style.overflow = ''; };
  back.querySelector('.modal-backdrop').addEventListener('click', close);
  return close;
}

// 大区学习诊断详情弹窗：聚合该区员工的能力模块/分类/难题/排名/培训建议
function showDeptDetail(det, qd) {
  const modBars = det.mods.map(m => bar(`${m.icon} ${m.name}`, m.rate, { sub: `${m.total} 次作答`, danger: m.rate < 70 }));
  const weakMods = det.mods.filter(m => m.rate < 70);
  const advice = weakMods.length
    ? `建议优先针对「${weakMods.map(m => m.name).join('、')}」安排专项培训与复训`
    : (det.mods.length ? `各能力模块整体表现良好，可考虑加强「${det.mods[0].name}」巩固训练` : '该区域暂无逐题明细数据');
  const topGood = det.trainees.filter(t => t.exams > 0).slice(0, 3);
  const topBad  = det.trainees.filter(t => t.exams > 0 && t.avg < 75).slice(-3).reverse();

  const panel = h('div.id-card', { style: 'width:min(820px,96vw);max-height:88vh;overflow-y:auto' },
    h('h3', { style: 'margin:0 0 4px' }, `📍 ${esc(det.dept)} · 学习诊断`),
    h('p.text-muted', { style: 'margin:0 0 12px;font-size:13px' },
      `学员 ${det.people} 人 ｜ 考核 ${det.exams} 次 ｜ 平均 ${det.avg}% ｜ 合格率 ${det.passRate}%（${det.passN}/${det.exams}）｜ 最近活跃 ${det.lastTs ? fmtDate(det.lastTs) : '—'}`),

    h('div.kpi-row', { style: 'margin:0 0 14px' },
      kpi(det.people, '学员'),
      kpi(det.exams, '考核次数'),
      kpi(det.avg + '%', '平均正确率'),
      kpi(det.passRate + '%', '合格率'),
    ),

    h('div.panel-head', null, h('h3', { style: 'font-size:14px;margin:0' }, '🎯 能力模块掌握度'),
      h('span.panel-sub', null, '红色为低于 70% 的薄弱模块')),
    modBars.length ? h('div.bars', { style: 'margin:6px 0 6px' }, ...modBars)
      : h('p.text-muted', null, '暂无逐题明细数据。'),
    h('div.insight', { style: 'margin:6px 0 14px' }, '💡 ', advice),

    h('div.grid.grid-2.admin-grid', { style: 'margin-bottom:14px' },
      h('div', null,
        h('div.panel-head', null, h('h3', { style: 'font-size:14px;margin:0' }, '📚 薄弱知识分类 Top 6')),
        det.cats.length ? h('table.record-table', null,
          h('thead', null, h('tr', null, h('th', null, '知识分类'), h('th', null, '正确率'), h('th', null, '作答数'))),
          h('tbody', null, ...det.cats.slice(0, 6).map(c => h('tr', null,
            h('td', null, c.category),
            h('td', null, h('span', { class: 'rate-tag ' + rateCls(c.rate) }, c.rate + '%')),
            h('td', null, String(c.total)),
          ))),
        ) : h('p.text-muted', null, '暂无分类数据。'),
      ),
      h('div', null,
        h('div.panel-head', null, h('h3', { style: 'font-size:14px;margin:0' }, '🔥 本区难题 Top 5'),
          h('span.panel-sub', null, '本大区错得最多的题（≥2次作答）')),
        det.hard.length ? h('div.hard-list', { style: 'margin-top:6px' }, ...det.hard.map((x, i) => h('div.hard-item', null,
          h('span.hard-rank', null, String(i + 1)),
          h('div', { style: 'flex:1;min-width:0' },
            h('div.hard-q', { title: x.q ? x.q.question : '' }, x.q ? x.q.question : ('题目#' + x.id)),
            h('div.text-muted', { style: 'font-size:12px' }, `${x.category} · 作答 ${x.total} 次`),
          ),
          h('span', { class: 'rate-tag ' + rateCls(x.rate) }, x.rate + '%'),
        ))) : h('p.text-muted', null, '暂无足够样本。'),
      ),
    ),

    h('div.grid.grid-2.admin-grid', null,
      h('div', null,
        h('div.panel-head', null, h('h3', { style: 'font-size:14px;margin:0;color:var(--ok)' }, '🌟 表现优秀（Top 3）')),
        topGood.length ? h('div.lead-row', { style: 'margin-top:6px' }, ...topGood.map((t, i) => h('div.lead-card', null,
          h('div', { class: 'lead-medal m' + i }, i < 3 ? ['🥇', '🥈', '🥉'][i] : (i + 1)),
          h('div.lead-name', null, esc(t.name)),
          h('div.text-muted', { style: 'font-size:11.5px' }, esc(t.empId || '—')),
          h('div.lead-score', null, t.avg + '%'),
        ))) : h('p.text-muted', null, '—'),
      ),
      h('div', null,
        h('div.panel-head', null, h('h3', { style: 'font-size:14px;margin:0;color:var(--err)' }, '⚠ 待提升（≤75%）')),
        topBad.length ? h('div.lead-row', { style: 'margin-top:6px' }, ...topBad.map(t => h('div.lead-card', null,
          h('div.lead-name', null, esc(t.name)),
          h('div.text-muted', { style: 'font-size:11.5px' }, esc(t.empId || '—')),
          h('div.lead-score', { style: 'color:var(--err)' }, t.avg + '%'),
          t.empId ? h('button.btn.btn-ghost.btn-sm', { style: 'margin-top:6px', onclick: () => copyText(t.empId) }, '复制工号') : null,
        ))) : h('p.text-muted', null, '本区无待提升学员，状态良好。'),
      ),
    ),

    h('div.btn-row', { style: 'margin-top:18px;justify-content:flex-end' },
      h('button.btn.btn-ghost', { onclick: () => exportSingleDeptCSV(det, qd) }, '⬇ 导出本区诊断'),
      h('button.btn', { onclick: () => close() }, '关闭'),
    ),
  );
  const close = miniModal(panel);
}

// 区域诊断汇总 CSV：每行一个大区 + 各模块正确率 + 最薄弱模块
function exportDeptCSV(depts, results, qd) {
  const rows = depts.map(d => {
    const det = deptDetail(results, d.dept, qd);
    const row = {
      销售区域: d.dept, 学员数: d.people, 考核次数: d.exams,
      平均正确率: d.avg + '%', 合格率: d.passRate + '%',
      最薄弱模块: det.weakMod ? `${det.weakMod.name}(${det.weakMod.rate}%)` : '—',
      最近活跃: d.lastTs ? fmtDate(d.lastTs) : '',
    };
    qd.modules.forEach(m => {
      const x = det.mods.find(mm => mm.id === m.id);
      row[m.name] = (x && x.total) ? x.rate + '%' : '—';
    });
    row['薄弱分类Top3'] = det.cats.slice(0, 3).map(c => `${c.category}(${c.rate}%)`).join(' | ');
    return row;
  });
  downloadFile(`SI区域学习诊断_${today()}.csv`, toCSV(rows), 'text/csv');
}

// 单个大区的详细诊断（弹窗里的导出按钮）
function exportSingleDeptCSV(det, qd) {
  const lines = [];
  lines.push(['销售区域', det.dept]);
  lines.push(['学员数', det.people]);
  lines.push(['考核次数', det.exams]);
  lines.push(['平均正确率', det.avg + '%']);
  lines.push(['合格率', det.passRate + '% (' + det.passN + '/' + det.exams + ')']);
  lines.push([]);
  lines.push(['能力模块', '正确率', '作答数']);
  qd.modules.forEach(m => {
    const x = det.mods.find(mm => mm.id === m.id);
    lines.push([m.name, (x && x.total) ? x.rate + '%' : '—', x ? x.total : 0]);
  });
  lines.push([]);
  lines.push(['薄弱知识分类', '正确率', '作答数']);
  det.cats.slice(0, 8).forEach(c => lines.push([c.category, c.rate + '%', c.total]));
  lines.push([]);
  lines.push(['学员', '工号', '考核次数', '平均正确率', '最高', '合格次数']);
  det.trainees.forEach(t => lines.push([t.name, t.empId || '', t.exams, t.avg + '%', t.best + '%', t.pass + '/' + t.exams]));

  const csv = '﻿' + lines.map(row => row.map(v => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');
  downloadFile(`SI${det.dept}学习诊断_${today()}.csv`, csv, 'text/csv');
}

function copyText(txt) {
  const ok = () => toast('已复制工号：' + txt + '（可粘贴到 Teams 搜索）');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(txt).then(ok).catch(() => fallbackCopy(txt, ok));
  } else fallbackCopy(txt, ok);
}
function fallbackCopy(txt, cb) {
  const ta = document.createElement('textarea');
  ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  try { document.execCommand('copy'); } catch {}
  ta.remove(); if (cb) cb();
}
function toast(msg) {
  const el = h('div.toast', null, msg);
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 1800);
}
