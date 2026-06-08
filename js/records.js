// =========================================================================
// 我的成绩：KPI 概览 + 历史成绩 + 错题本管理
// =========================================================================
import { getResults, clearResults, getWrongIds, clearWrong, readCount } from './store.js';
import { startExam } from './exam.js';
import { h, fmtDate, fmtClock } from './util.js';

export async function renderRecords(app) {
  const results = getResults();
  const wrongN = getWrongIds().length;
  app.innerHTML = '';

  app.appendChild(h('div.section', null,
    h('div.eyebrow', null, '学习档案'),
    h('h2', null, '我的成绩'),
    h('p.text-muted', null, '记录保存在本浏览器本地（localStorage），用于追踪你的学习与考核进度。'),
  ));

  // KPI
  const rates = results.map(r => r.rate);
  const avg = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : 0;
  const best = rates.length ? Math.max(...rates) : 0;
  const passN = results.filter(r => r.pass).length;
  app.appendChild(h('div.kpi-row', null,
    kpi(results.length, '考核次数'),
    kpi(rates.length ? avg + '%' : '—', '平均正确率'),
    kpi(rates.length ? best + '%' : '—', '最高正确率'),
    kpi(passN, '合格次数'),
  ));

  // 错题本
  app.appendChild(h('div.card', { style: 'margin-bottom:24px;display:flex;align-items:center;gap:16px;flex-wrap:wrap' },
    h('div', { style: 'font-size:28px' }, '🔁'),
    h('div', { style: 'flex:1;min-width:180px' },
      h('div', { style: 'font-weight:800;color:var(--deep)' }, `错题本：${wrongN} 道`),
      h('div.text-muted', { style: 'font-size:13px' }, wrongN ? '针对薄弱题专项重练，答对后自动移出。' : '太棒了，当前没有待巩固的错题。'),
    ),
    h('div.btn-row', null,
      wrongN ? h('button.btn', { onclick: () => startExam({ scope: 'wrong', count: 'all', mode: 'practice', timed: false, title: '错题本重练' }) }, '开始错题重练') : null,
      wrongN ? h('button.btn.btn-ghost', { onclick: () => { if (confirm('确定清空错题本？')) { clearWrong(); renderRecords(app); } } }, '清空错题本') : null,
    ),
  ));

  // 历史成绩
  app.appendChild(h('div.section-head', null,
    h('h2', null, '历史考核记录'),
    results.length ? h('button.btn.btn-ghost.btn-sm', { onclick: () => { if (confirm('确定清空全部成绩记录？')) { clearResults(); renderRecords(app); } } }, '清空记录') : null,
  ));

  if (!results.length) {
    app.appendChild(h('div.empty-state', null,
      h('div.es-ic', null, '📊'),
      h('h3', null, '还没有考核记录'),
      h('p.text-muted', null, '完成第一场考核后，成绩会显示在这里。'),
      h('a.btn', { href: '#/exam' }, '去考核'),
    ));
    return;
  }

  app.appendChild(h('table.record-table', null,
    h('thead', null, h('tr', null,
      h('th', null, '时间'), h('th', null, '考核范围'), h('th', null, '得分'),
      h('th', null, '正确率'), h('th', null, '评级'), h('th', null, '用时'), h('th', null, '结果'))),
    h('tbody', null, ...results.map(r => h('tr', null,
      h('td', null, fmtDate(r.ts)),
      h('td', null, r.title),
      h('td.score-cell', null, `${r.correct}/${r.total}`),
      h('td', null, r.rate + '%'),
      h('td', null, r.grade),
      h('td', null, fmtClock(r.timeSpent || 0)),
      h('td', null, h('span', { class: 'badge ' + (r.pass ? 'badge-ok' : 'badge-err') }, r.pass ? '合格' : '不合格')),
    ))),
  ));

  app.appendChild(h('p.text-muted', { style: 'margin-top:18px;font-size:13px' }, `已读学习资料：${readCount()} 份`));
}

function kpi(num, lbl) {
  return h('div.kpi', null, h('div.k-num', null, String(num)), h('div.k-lbl', null, lbl));
}
