// =========================================================================
// 应用入口：哈希路由 + 导航 + 学员身份 + HR 后台门控 + 全局 PDF 弹窗
// =========================================================================
import { renderHome } from './home.js';
import { renderExamSetup, renderExamRun, renderExamResult } from './exam.js';
import { renderLibrary } from './library.js';
import { renderRecords } from './records.js';
import { renderAdmin } from './admin.js';
import {
  getProfile, setProfile, hasProfile, DEPARTMENTS,
  isAdmin, unlockAdmin, ADMIN_PASSCODE,
} from './store.js';
import { h, esc } from './util.js';

const app = document.getElementById('app');

// ----- 路由表 -----
const routes = {
  ''        : () => renderHome(app),
  'home'    : () => renderHome(app),
  'exam'    : (sub) => sub === 'run' ? renderExamRun(app)
                     : sub === 'result' ? renderExamResult(app)
                     : renderExamSetup(app),
  'library' : () => renderLibrary(app),
  'records' : () => renderRecords(app),
  'admin'   : () => isAdmin() ? renderAdmin(app) : renderAdminGate(),
};

function currentParts() {
  const hash = location.hash.replace(/^#\/?/, '');
  return hash.split('/').filter(Boolean);
}

async function router() {
  const parts = currentParts();
  const top = parts[0] || 'home';
  const handler = routes[top] || routes['home'];
  setActiveNav(top);
  closeMobileNav();
  refreshChip();
  app.innerHTML = '<div class="loading">加载中…</div>';
  try {
    await handler(parts[1]);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="empty-state"><div class="es-ic">⚠️</div>
      <h3>页面加载出错</h3><p class="text-muted">${esc(err.message || err)}</p>
      <p><a class="btn btn-ghost" href="#/home">返回首页</a></p></div>`;
  }
  window.scrollTo(0, 0);
}

function setActiveNav(top) {
  document.querySelectorAll('#main-nav a').forEach(a => {
    a.classList.toggle('active', a.dataset.route === top);
  });
}

// ----- 移动端菜单 -----
const nav = document.getElementById('main-nav');
const toggle = document.getElementById('nav-toggle');
toggle?.addEventListener('click', () => nav.classList.toggle('open'));
function closeMobileNav() { nav?.classList.remove('open'); }

// =========================================================================
// 学员身份芯片 & 登记弹窗
// =========================================================================
const chip = document.getElementById('profile-chip');
chip?.addEventListener('click', () => openIdentityModal());

export function refreshChip() {
  const p = getProfile();
  if (isAdmin()) {
    chip.innerHTML = '🛡 HR 管理员';
    chip.classList.add('is-admin');
  } else {
    chip.classList.remove('is-admin');
    chip.innerHTML = (p && p.name) ? `👤 ${esc(p.name)} · ${esc(p.dept || '')}` : '👤 登记身份';
  }
}

function showModal(panel, { closable = true } = {}) {
  const backdrop = h('div.modal', { style: 'display:grid' });
  const inner = h('div.modal-mini', null, panel);
  backdrop.appendChild(h('div.modal-backdrop'));
  backdrop.appendChild(inner);
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  const close = () => { backdrop.remove(); document.body.style.overflow = ''; };
  if (closable) backdrop.querySelector('.modal-backdrop').addEventListener('click', close);
  return close;
}

export function openIdentityModal() {
  const p = getProfile() || { name: '', dept: DEPARTMENTS[0], empId: '' };
  const nameI = h('input.fld', { type: 'text', value: p.name || '', placeholder: '请输入姓名', maxlength: '20' });
  const deptS = h('select.fld', null, ...DEPARTMENTS.map(d => h('option', { value: d, selected: d === p.dept ? '' : null }, d)));
  const idI = h('input.fld', { type: 'text', value: p.empId || '', placeholder: '工号（选填）', maxlength: '20' });

  const panel = h('div.id-card', null,
    h('h3', null, '👤 学员身份登记'),
    h('p.text-muted', { style: 'margin-top:-4px' }, '登记后，你的考核成绩将归档到本人名下，便于 HR 统计与分析。'),
    field('姓名', nameI),
    field('所属销售区域', deptS),
    field('工号', idI),
    h('div.btn-row', { style: 'margin-top:18px' },
      h('button.btn', { onclick: () => {
        const name = nameI.value.trim();
        if (!name) { nameI.focus(); nameI.style.borderColor = 'var(--err)'; return; }
        setProfile({ name, dept: deptS.value, empId: idI.value.trim() });
        close(); refreshChip();
        router();
      } }, '保存身份'),
      h('button.btn.btn-ghost', { onclick: () => { setProfile({ name: '访客', dept: deptS.value }); close(); refreshChip(); router(); } }, '以访客身份浏览'),
    ),
  );
  const close = showModal(panel);
  setTimeout(() => nameI.focus(), 50);
}

function field(label, input) {
  return h('label.fld-row', null, h('span.fld-label', null, label), input);
}

// =========================================================================
// HR 管理后台 —— 口令门控
// =========================================================================
function renderAdminGate() {
  const pwd = h('input.fld', { type: 'password', placeholder: '请输入 HR 管理口令', autocomplete: 'off' });
  const msg = h('div', { style: 'color:var(--err);font-size:13px;height:18px' });
  const tryUnlock = () => {
    if (unlockAdmin(pwd.value)) { refreshChip(); renderAdmin(app); }
    else { msg.textContent = '口令不正确，请重试'; pwd.value = ''; pwd.focus(); }
  };
  pwd.addEventListener('keydown', e => { if (e.key === 'Enter') tryUnlock(); });

  app.innerHTML = '';
  app.appendChild(h('div.gate-wrap', null,
    h('div.gate-card', null,
      h('div.gate-ic', null, '🛡'),
      h('h2', null, 'HR 管理后台'),
      h('p.text-muted', null, '此区域面向西门子 HR / 培训管理员，用于查看与分析渠道销售团队的学习考核数据。'),
      field('管理口令', pwd),
      msg,
      h('button.btn', { style: 'width:100%', onclick: tryUnlock }, '进入后台'),
      h('div.gate-hint', null, `演示口令：`, h('code', null, ADMIN_PASSCODE)),
      h('a.btn.btn-ghost', { href: '#/home', style: 'width:100%;margin-top:8px' }, '返回学员端'),
    ),
  ));
  setTimeout(() => pwd.focus(), 50);
}

// =========================================================================
// 全局 PDF 弹窗（资料库调用）
// =========================================================================
const modal = document.getElementById('pdf-modal');
const frame = document.getElementById('pdf-frame');
const titleEl = document.getElementById('pdf-title');
const dlEl = document.getElementById('pdf-download');
const newtabEl = document.getElementById('pdf-newtab');

export function openPdf(file, title) {
  titleEl.textContent = title || '资料预览';
  frame.src = file;
  dlEl.href = file;
  newtabEl.href = file;
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
}
function closePdf() {
  modal.hidden = true;
  frame.src = 'about:blank';
  document.body.style.overflow = '';
}
modal.addEventListener('click', (e) => { if (e.target.matches('[data-close-modal]')) closePdf(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closePdf(); });

// ----- 启动 -----
document.getElementById('footer-year').textContent = new Date().getFullYear() + ' · 内部培训系统';
refreshChip();
window.addEventListener('hashchange', router);
router();

// 首次访问引导登记身份（非阻断，可选访客）
if (!hasProfile()) setTimeout(() => { if (!hasProfile()) openIdentityModal(); }, 400);
