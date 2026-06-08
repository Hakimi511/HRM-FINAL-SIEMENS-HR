// =========================================================================
// 应用入口：哈希路由 + 导航 + 全局 PDF 弹窗
// =========================================================================
import { renderHome } from './home.js';
import { renderExamSetup, renderExamRun, renderExamResult } from './exam.js';
import { renderLibrary } from './library.js';
import { renderRecords } from './records.js';

const app = document.getElementById('app');

// ----- 路由表 -----
// 形如 #/exam/run  -> ['exam','run']
const routes = {
  ''        : () => renderHome(app),
  'home'    : () => renderHome(app),
  'exam'    : (sub) => sub === 'run' ? renderExamRun(app)
                     : sub === 'result' ? renderExamResult(app)
                     : renderExamSetup(app),
  'library' : () => renderLibrary(app),
  'records' : () => renderRecords(app),
};

function currentParts() {
  const hash = location.hash.replace(/^#\/?/, '');   // 去掉 #/ 前缀
  return hash.split('/').filter(Boolean);
}

async function router() {
  const parts = currentParts();
  const top = parts[0] || 'home';
  const handler = routes[top] || routes['home'];
  setActiveNav(top);
  closeMobileNav();
  app.innerHTML = '<div class="loading">加载中…</div>';
  try {
    await handler(parts[1]);
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="empty-state"><div class="es-ic">⚠️</div>
      <h3>页面加载出错</h3><p class="text-muted">${err.message || err}</p>
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
modal.addEventListener('click', (e) => {
  if (e.target.matches('[data-close-modal]')) closePdf();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closePdf(); });

// 暴露给非模块脚本（备用）
window.__openPdf = openPdf;

// ----- 启动 -----
document.getElementById('footer-year').textContent = new Date().getFullYear() + ' · 内部培训系统';
window.addEventListener('hashchange', router);
router();
