// =========================================================================
// 首页 / 仪表盘
// =========================================================================
import { loadQuestions, loadMaterials, questionsByModule } from './data.js';
import { getMyResults, getWrongIds, readCount } from './store.js';
import { startExam } from './exam.js';
import { h, fmtDate } from './util.js';

export async function renderHome(app) {
  const qd = await loadQuestions();
  const md = await loadMaterials();
  const results = getMyResults();
  const wrongN = getWrongIds().length;

  app.innerHTML = '';

  // ---------- Hero ----------
  const hero = h('section.hero', null,
    h('div.eyebrow', null, 'SIEMENS · SMART INFRASTRUCTURE'),
    h('h1', null, 'SI 渠道销售培训考核学习平台'),
    h('p', null, '面向西门子智能基础设施（SI）渠道销售伙伴的一站式学习与考核平台：覆盖数字化产品、销售技能、谈判沟通、职场软技能与财务知识，配套 EA / EP 全系产品资料，助力销售专家持续成长、以考促学。'),
    h('div.btn-row', null,
      h('button.btn.btn-lg', { onclick: () => startExam({ scope: 'all', count: 20, mode: 'exam', timed: true, title: '综合模拟考核' }) }, '🎯 开始综合考核'),
      h('a.btn.btn-lg.btn-ghost', { href: '#/library' }, '📚 浏览学习资料'),
    ),
    h('div.stat-row', null,
      stat(qd.meta.totalQuestions, '考核题目'),
      stat(qd.meta.totalCategories, '知识分类'),
      stat(qd.modules.length, '能力模块'),
      stat(md.meta.totalFiles, '学习资料'),
    ),
  );
  app.appendChild(hero);

  // ---------- 两大入口 ----------
  app.appendChild(h('section.section', null,
    h('div.grid.grid-2', null,
      h('div.card.card-hover.entry-card', { onclick: () => location.hash = '#/exam' },
        h('div.ec-icon', null, '📝'),
        h('h3', null, '考核中心'),
        h('p', null, `按模块或分类组卷，支持综合模拟考。单选 ${qd.meta.single} 题、多选 ${qd.meta.multiple} 题，自动判分、错题解析、计时闯关。`),
        h('span.ec-go', null, '进入考核 →'),
      ),
      h('div.card.card-hover.entry-card', { onclick: () => location.hash = '#/library' },
        h('div.ec-icon', null, '📖'),
        h('h3', null, '学习资料库'),
        h('p', null, `EA / EP 两大产品线、${md.meta.totalCategories} 个产品分类、${md.meta.totalFiles} 份销售资料，支持在线预览、下载与学习进度标记。`),
        h('span.ec-go', null, '查阅资料 →'),
      ),
    ),
  ));

  // ---------- 五大能力模块 ----------
  const modCards = qd.modules.map(m => {
    const n = questionsByModule(m.id).length;
    const cats = m.categories.length;
    return h('div.card.card-hover.mod-card', {
      onclick: () => startExam({ scope: 'module', moduleId: m.id, count: 'all', mode: 'practice', timed: false, title: m.name + ' · 专项练习' }),
      title: '点击开始本模块专项练习',
    },
      h('div.m-icon', null, m.icon),
      h('div', null,
        h('h4', null, m.name),
        h('p.m-desc', null, m.desc),
        h('div.m-meta', null, `${n} 题 · ${cats} 个分类`),
      ),
    );
  });
  app.appendChild(h('section.section', null,
    h('div.section-head', null, h('h2', null, '五大能力模块'), h('span.sub', null, '点击任一模块即可开始专项练习')),
    h('div.grid.grid-auto', null, ...modCards),
  ));

  // ---------- 学习概览 ----------
  const lastBlock = results.length
    ? h('div.card', null,
        h('div.section-head', null, h('h3.mb-0', null, '最近考核记录'), h('a.sub', { href: '#/records' }, '查看全部 →')),
        h('table.record-table', null,
          h('thead', null, h('tr', null, h('th', null, '时间'), h('th', null, '范围'), h('th', null, '得分'), h('th', null, '正确率'))),
          h('tbody', null, ...results.slice(0, 5).map(r =>
            h('tr', null,
              h('td', null, fmtDate(r.ts)),
              h('td', null, r.title),
              h('td.score-cell', { style: `color:${r.pass ? 'var(--ok)' : 'var(--err)'}` }, `${r.correct}/${r.total}`),
              h('td', null, r.rate + '%'),
            ))),
        ),
      )
    : h('div.card.empty-state', null,
        h('div.es-ic', null, '🚀'),
        h('h3', null, '还没有考核记录'),
        h('p.text-muted', null, '从一次综合考核或模块专项练习开始你的学习之旅吧。'),
        h('button.btn', { onclick: () => startExam({ scope: 'all', count: 20, mode: 'exam', timed: true, title: '综合模拟考核' }) }, '立即开始'),
      );

  app.appendChild(h('section.section', null,
    h('div.section-head', null, h('h2', null, '我的学习概览')),
    h('div.kpi-row', null,
      kpi(results.length, '已完成考核'),
      kpi(results.length ? Math.max(...results.map(r => r.rate)) + '%' : '—', '最高正确率'),
      kpi(wrongN, '待巩固错题'),
      kpi(readCount(), '已读资料'),
    ),
    lastBlock,
  ));
}

function stat(num, lbl) {
  return h('div.stat', null, h('div.num', null, String(num)), h('div.lbl', null, lbl));
}
function kpi(num, lbl) {
  return h('div.kpi', null, h('div.k-num', null, String(num)), h('div.k-lbl', null, lbl));
}
