// =========================================================================
// 考核引擎：组卷设置 / 答题运行 / 判分结果
// =========================================================================
import { loadQuestions, questionsById } from './data.js';
import { addResult, addWrong, removeWrong, getWrongIds, getProfile } from './store.js';
import { h, esc, shuffle, sampleN, letter, fmtClock, arrEq, scrollTop } from './util.js';

const PASS_RATE = 60;              // 合格线
let examState = null;              // 当前进行中的考试
let _timerId = null;

// ---------------------------------------------------------------------------
// 准备题目：按 shuffle 标记打乱选项并重映射答案下标
// ---------------------------------------------------------------------------
function prepare(q) {
  const order = q.shuffle ? shuffle([...q.options.keys()]) : [...q.options.keys()];
  const options = order.map(i => q.options[i]);
  const answer = q.answer.map(a => order.indexOf(a)).sort((a, b) => a - b);
  return { ...q, options, answer };
}

// ---------------------------------------------------------------------------
// 启动一场考试（供首页/设置页调用），随后跳转到运行视图
// opts: { scope:'all'|'module'|'category'|'wrong', moduleId, category, count, mode, timed, title }
// ---------------------------------------------------------------------------
export async function startExam(opts) {
  const qd = await loadQuestions();
  let pool;
  if (opts.scope === 'module') pool = qd.questions.filter(q => q.module === opts.moduleId);
  else if (opts.scope === 'category') pool = qd.questions.filter(q => q.category === opts.category);
  else if (opts.scope === 'wrong') pool = questionsById(getWrongIds());
  else pool = qd.questions;                       // 'all' 综合题库

  if (!pool || pool.length === 0) {
    alert('该范围暂无可用题目。');
    return;
  }
  const count = (opts.count === 'all' || !opts.count) ? pool.length : Math.min(opts.count, pool.length);
  const picked = sampleN(pool, count).map(prepare);

  examState = {
    title: opts.title || '考核',
    mode: opts.mode || 'exam',     // 'exam' | 'practice'
    timed: !!opts.timed,
    questions: picked,
    answers: picked.map(() => []), // 每题已选下标数组
    checked: new Set(),            // 练习模式中已确认的题
    current: 0,
    startTs: Date.now(),
    result: null,
    opts,                          // 保存原始配置，供"再考一次"复用
  };
  location.hash = '#/exam/run';
}

// ---------------------------------------------------------------------------
// 设置页
// ---------------------------------------------------------------------------
export async function renderExamSetup(app) {
  const qd = await loadQuestions();
  const wrongN = getWrongIds().length;

  const state = { scope: 'all', moduleId: qd.modules[0].id, category: null, count: 20, mode: 'exam', timed: true };

  app.innerHTML = '';
  const wrap = h('div.exam-setup', null);
  app.appendChild(h('div.section', null,
    h('div.eyebrow', null, '考核中心'),
    h('h2', null, '组卷设置'),
    h('p.text-muted', null, '自定义考核范围、题量与模式，开始你的专家测试。'),
    wrap,
  ));

  function poolFor() {
    if (state.scope === 'module') return qd.questions.filter(q => q.module === state.moduleId);
    if (state.scope === 'category') return state.category ? qd.questions.filter(q => q.category === state.category) : [];
    if (state.scope === 'wrong') return getWrongIds();
    return qd.questions;
  }

  function render() {
    wrap.innerHTML = '';
    const pool = poolFor();
    const poolN = Array.isArray(pool) ? pool.length : 0;

    // 1) 范围
    wrap.appendChild(group('1 · 选择考核范围',
      h('div.choice-grid', null,
        scopeCard('all', '🎯 综合题库', `${qd.questions.length} 题 · 全部分类`),
        scopeCard('module', '🧩 按能力模块', `${qd.modules.length} 个模块专项`),
        scopeCard('category', '📑 按知识分类', `${qd.meta.totalCategories} 个细分专题`),
        scopeCard('wrong', '🔁 错题本重练', wrongN ? `${wrongN} 道待巩固` : '暂无错题'),
      )));

    // 2) 动态二级选择
    if (state.scope === 'module') {
      wrap.appendChild(group('2 · 选择模块',
        h('div.choice-grid', null, ...qd.modules.map(m => {
          const n = qd.questions.filter(q => q.module === m.id).length;
          return pickCard(state.moduleId === m.id, `${m.icon} ${m.name}`, `${n} 题`, () => { state.moduleId = m.id; render(); });
        }))));
    } else if (state.scope === 'category') {
      const byMod = qd.modules.map(m => ({
        m, cats: qd.categories.filter(c => c.module === m.id),
      }));
      const blocks = byMod.map(({ m, cats }) => h('div', { style: 'margin-bottom:14px' },
        h('div.eyebrow', { style: 'margin-bottom:8px' }, `${m.icon} ${m.name}`),
        h('div.choice-grid', null, ...cats.map(c =>
          pickCard(state.category === c.name, c.name, `${c.count} 题`, () => { state.category = c.name; render(); })))));
      wrap.appendChild(group('2 · 选择分类', ...blocks));
    } else if (state.scope === 'wrong') {
      wrap.appendChild(group('2 · 错题本',
        h('div.card', { style: 'background:#f3f9f9;border-color:#d5ecec' },
          wrongN
            ? h('div', null, h('b', null, `共 ${wrongN} 道错题`), h('span.text-muted', null, '　将随机抽取下方设定的题量进行重练，答对后自动移出错题本。'))
            : h('div.text-muted', null, '错题本为空 —— 先完成一次考核，答错的题会自动收集到这里。'))));
    }

    // 3) 题量
    const counts = [10, 20, 30].filter(n => n < poolN);
    counts.push('all');
    wrap.appendChild(group('3 · 题量',
      h('div.seg', null, ...counts.map(c => {
        const label = c === 'all' ? `全部 (${poolN})` : `${c} 题`;
        const active = (c === 'all' && state.count === 'all') || state.count === c;
        return h('button', { class: active ? 'active' : '', onclick: () => { state.count = c; render(); } }, label);
      }))));

    // 4) 模式
    wrap.appendChild(group('4 · 考核模式',
      h('div.choice-grid', null,
        pickCard(state.mode === 'exam', '📝 考试模式', '交卷后统一判分与解析', () => { state.mode = 'exam'; render(); }),
        pickCard(state.mode === 'practice', '💡 练习模式', '每题作答后即时显示解析', () => { state.mode = 'practice'; render(); }),
      )));

    // 5) 计时
    wrap.appendChild(group('5 · 计时',
      h('div.seg', null,
        h('button', { class: state.timed ? 'active' : '', onclick: () => { state.timed = true; render(); } }, '⏱ 开启计时'),
        h('button', { class: !state.timed ? 'active' : '', onclick: () => { state.timed = false; render(); } }, '关闭计时'),
      )));

    // 开始按钮
    const canStart = poolN > 0;
    wrap.appendChild(h('div.btn-row', { style: 'margin-top:8px' },
      h('button.btn.btn-lg', { disabled: !canStart ? '' : null, onclick: () => {
        if (!canStart) return;
        startExam({
          scope: state.scope, moduleId: state.moduleId, category: state.category,
          count: state.count, mode: state.mode, timed: state.timed,
          title: titleFor(state, qd),
        });
      } }, '🚀 开始考核'),
      h('a.btn.btn-lg.btn-ghost', { href: '#/home' }, '返回首页'),
    ));
  }

  function scopeCard(scope, title, sub) {
    return h('div', { class: 'choice' + (state.scope === scope ? ' selected' : ''), onclick: () => {
      state.scope = scope;
      if (scope === 'category' && !state.category) state.category = qd.categories[0].name;
      render();
    } }, h('div.c-title', null, title), h('div.c-sub', null, sub));
  }
  render();
}

function titleFor(state, qd) {
  if (state.scope === 'module') return (qd.modules.find(m => m.id === state.moduleId)?.name || '模块') + ' 专项考核';
  if (state.scope === 'category') return state.category + ' 专题';
  if (state.scope === 'wrong') return '错题本重练';
  return '综合模拟考核';
}

function group(label, ...children) {
  return h('div.opt-group', null, h('label.opt-label', null, label), ...children);
}
function pickCard(active, title, sub, onclick) {
  return h('div', { class: 'choice' + (active ? ' selected' : ''), onclick },
    h('div.c-title', null, title), sub ? h('div.c-sub', null, sub) : null);
}

// ---------------------------------------------------------------------------
// 运行视图
// ---------------------------------------------------------------------------
export function renderExamRun(app) {
  if (!examState) { location.hash = '#/exam'; return; }
  clearInterval(_timerId);

  function update() { draw(app); }

  function draw() {
    const st = examState;
    const i = st.current;
    const q = st.questions[i];
    const selected = st.answers[i];
    const isPractice = st.mode === 'practice';
    const isChecked = st.checked.has(i);
    const showFeedback = isPractice && isChecked;

    app.innerHTML = '';
    const root = h('div.exam-runtime', null);

    // 顶部条
    const answeredCount = st.answers.filter(a => a.length).length;
    root.appendChild(h('div.exam-topbar', null,
      h('span.et-title', null, st.title),
      h('span.badge', { class: 'badge ' + (q.type === 'multiple' ? 'badge-multi' : 'badge-single') },
        q.type === 'multiple' ? '多选题' : '单选题'),
      h('span.text-muted', null, q.category),
      h('span.et-spacer'),
      st.timed ? h('span.et-timer', { id: 'exam-timer' }, fmtClock(elapsed())) : null,
      h('span.text-muted', null, `已答 ${answeredCount}/${st.questions.length}`),
    ));

    // 题卡
    const optionEls = q.options.map((opt, oi) => {
      const isSel = selected.includes(oi);
      const cls = ['option'];
      if (showFeedback) {
        cls.push('disabled');
        if (q.answer.includes(oi)) cls.push('correct');
        else if (isSel) cls.push('wrong');
      } else if (isSel) cls.push('selected');
      return h('div', {
        class: cls.join(' '),
        onclick: showFeedback ? null : () => choose(i, oi, q.type),
      },
        h('div.opt-key', null, letter(oi)),
        h('div.opt-text', { html: esc(opt) }),
      );
    });

    const qcard = h('div.q-card', null,
      h('div.q-meta', null,
        h('span.q-index', null, `第 ${i + 1} / ${st.questions.length} 题`),
        q.type === 'multiple' ? h('span.text-muted', null, '（多选，可选多项）') : null,
      ),
      h('div.q-text', { html: esc(q.question) }),
      h('div.options', null, ...optionEls),
      showFeedback ? feedbackBlock(q, selected) : null,
      runtimeNav(i, st, isPractice, isChecked, update),
    );
    root.appendChild(qcard);

    // 答题卡
    root.appendChild(answerSheet(st, update));

    app.appendChild(root);

    // 计时器
    if (st.timed) {
      clearInterval(_timerId);
      _timerId = setInterval(() => {
        const el = document.getElementById('exam-timer');
        if (el) el.textContent = fmtClock(elapsed());
        else clearInterval(_timerId);
      }, 1000);
    }
  }

  function choose(qi, oi, type) {
    const cur = examState.answers[qi];
    if (type === 'multiple') {
      const idx = cur.indexOf(oi);
      if (idx >= 0) cur.splice(idx, 1); else cur.push(oi);
      cur.sort((a, b) => a - b);
    } else {
      examState.answers[qi] = [oi];
    }
    draw();
  }

  draw();
}

function elapsed() { return Math.floor((Date.now() - examState.startTs) / 1000); }

function feedbackBlock(q, selected) {
  const correct = arrEq(selected.slice().sort((a, b) => a - b), q.answer);
  const ansLetters = q.answer.map(letter).join('、');
  const yourLetters = selected.length ? selected.map(letter).join('、') : '未作答';
  return h('div', null,
    h('div.answer-line', null,
      correct ? h('span.ok', null, '✓ 回答正确') : h('span.err', null, '✗ 回答错误'),
      h('span.text-muted', null, `　正确答案：${ansLetters}　|　你的选择：${yourLetters}`),
    ),
    q.explanation ? h('div.explain', null, h('div.ex-head', null, '解析'), h('div', { html: esc(q.explanation) })) : null,
  );
}

function runtimeNav(i, st, isPractice, isChecked, update) {
  const last = st.questions.length - 1;
  const left = i > 0
    ? h('button.btn.btn-ghost', { onclick: () => { st.current--; update(); } }, '← 上一题')
    : h('span');

  let right;
  if (isPractice && !isChecked) {
    right = h('button.btn', {
      onclick: () => {
        if (!st.answers[i].length) { alert('请先作答'); return; }
        st.checked.add(i); update();
      },
    }, '确认作答');
  } else if (i < last) {
    right = h('button.btn', { onclick: () => { st.current++; update(); } }, '下一题 →');
  } else {
    right = h('button.btn.btn-accent', { onclick: () => submitExam() }, '✓ 交卷并查看成绩');
  }
  return h('div.q-nav-row', null, left, right);
}

function answerSheet(st, update) {
  const cells = st.questions.map((q, idx) => {
    const cls = ['sheet-cell'];
    if (idx === st.current) cls.push('current');
    if (st.mode === 'practice' && st.checked.has(idx)) {
      const ok = arrEq(st.answers[idx].slice().sort((a, b) => a - b), q.answer);
      cls.push(ok ? 'correct' : 'wrong');
    } else if (st.answers[idx].length) cls.push('answered');
    return h('div', { class: cls.join(' '), onclick: () => { st.current = idx; update(); } }, String(idx + 1));
  });
  const legend = h('div.sheet-legend', null,
    h('span', null, h('i', { style: 'background:#e1f3f3' }), '已答'),
    h('span', null, h('i', { style: 'background:#fff;border:1px solid var(--line)' }), '未答'),
  );
  return h('aside.answer-sheet', null,
    h('h4', null, '答题卡'),
    h('div.sheet-grid', null, ...cells),
    legend,
    h('button.btn.btn-accent', { style: 'width:100%;margin-top:14px', onclick: () => submitExam() }, '交卷'),
  );
}

// ---------------------------------------------------------------------------
// 交卷判分
// ---------------------------------------------------------------------------
function submitExam() {
  const st = examState;
  const unanswered = st.answers.filter(a => !a.length).length;
  if (unanswered > 0 && st.mode === 'exam') {
    if (!confirm(`还有 ${unanswered} 题未作答，确定交卷？`)) return;
  }
  clearInterval(_timerId);

  let correct = 0;
  const review = st.questions.map((q, i) => {
    const sel = st.answers[i].slice().sort((a, b) => a - b);
    const ok = arrEq(sel, q.answer);
    if (ok) { correct++; removeWrong(q.id); }
    else { addWrong(q); }
    return { q, sel, ok };
  });

  const total = st.questions.length;
  const rate = Math.round((correct / total) * 100);
  const pass = rate >= PASS_RATE;
  const grade = rate >= 90 ? '优秀' : rate >= 80 ? '良好' : rate >= PASS_RATE ? '合格' : '不合格';
  const timeSpent = elapsed();

  // 学员身份 + 逐题明细（供 HR 后台做部门/薄弱点/难题分析）
  const prof = getProfile() || {};
  const detail = review.map(({ q, ok }) => ({ id: q.id, category: q.category, module: q.module, correct: ok }));
  const ts = Date.now();
  const id = 'r' + ts + '-' + Math.random().toString(36).slice(2, 7);

  const result = { id, ts, title: st.title, total, correct, rate, pass, grade, timeSpent, mode: st.mode, review };
  st.result = result;
  addResult({ id, ts, name: prof.name || '', dept: prof.dept || '', empId: prof.empId || '', title: st.title, total, correct, rate, pass, grade, timeSpent, mode: st.mode, detail });

  location.hash = '#/exam/result';
}

// ---------------------------------------------------------------------------
// 结果视图
// ---------------------------------------------------------------------------
export function renderExamResult(app) {
  if (!examState || !examState.result) {
    app.innerHTML = `<div class="empty-state"><div class="es-ic">📄</div>
      <h3>暂无可显示的成绩</h3><p class="text-muted">请先完成一场考核。</p>
      <p class="btn-row" style="justify-content:center">
      <a class="btn" href="#/exam">去考核</a>
      <a class="btn btn-ghost" href="#/records">查看历史成绩</a></p></div>`;
    return;
  }
  const r = examState.result;
  app.innerHTML = '';

  // 成绩头部
  app.appendChild(h(`div.result-hero.${r.pass ? 'pass' : 'fail'}`, null,
    h('div', null, r.pass ? '🎉 恭喜通过' : '继续加油'),
    h('div.result-score', null, String(r.rate), h('small', null, '%')),
    h('div.result-grade', null, `评级：${r.grade}　|　${r.title}`),
    h('div.result-meta', null,
      h('div', null, h('b', null, `${r.correct}/${r.total}`), '答对题数'),
      h('div', null, h('b', null, fmtClock(r.timeSpent)), '用时'),
      h('div', null, h('b', null, `${r.total - r.correct}`), '错题（已入错题本）'),
    ),
  ));

  // 操作
  app.appendChild(h('div.btn-row', { style: 'margin-bottom:24px' },
    h('button.btn', { onclick: () => restartSame() }, '🔄 再考一次'),
    r.total - r.correct > 0 ? h('button.btn.btn-accent', { onclick: () => startExam({ scope: 'wrong', count: 'all', mode: 'practice', timed: false, title: '错题本重练' }) }, '🔁 立即重练错题') : null,
    h('a.btn.btn-ghost', { href: '#/exam' }, '换个范围'),
    h('a.btn.btn-ghost', { href: '#/records' }, '我的成绩'),
  ));

  // 逐题回顾
  app.appendChild(h('div.section-head', null, h('h2', null, '答题回顾'), h('span.sub', null, '红色为错题，已自动收入错题本')));
  const list = h('div', null);
  r.review.forEach((item, idx) => {
    const { q, sel, ok } = item;
    list.appendChild(h(`div.review-q.${ok ? 'ok' : 'bad'}`, null,
      h('div.q-meta', null,
        h('span', { style: `font-weight:800;color:${ok ? 'var(--ok)' : 'var(--err)'}` }, `${idx + 1}. ${ok ? '✓' : '✗'}`),
        h('span.badge', { class: 'badge ' + (q.type === 'multiple' ? 'badge-multi' : 'badge-single') }, q.type === 'multiple' ? '多选' : '单选'),
        h('span.text-muted', null, q.category),
      ),
      h('div', { style: 'font-weight:600;margin:4px 0 8px', html: esc(q.question) }),
      h('div.options', null, ...q.options.map((opt, oi) => {
        const cls = ['option', 'disabled'];
        if (q.answer.includes(oi)) cls.push('correct');
        else if (sel.includes(oi)) cls.push('wrong');
        return h('div', { class: cls.join(' ') }, h('div.opt-key', null, letter(oi)), h('div.opt-text', { html: esc(opt) }));
      })),
      q.explanation ? h('div.explain', null, h('div.ex-head', null, '解析'), h('div', { html: esc(q.explanation) })) : null,
    ));
  });
  app.appendChild(list);
}

function restartSame() {
  if (!examState || !examState.opts) { location.hash = '#/exam'; return; }
  startExam(examState.opts);   // 用相同配置重新组卷
}
