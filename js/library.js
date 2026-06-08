// =========================================================================
// 学习资料库：EA / EP 产品线分类浏览 + 搜索 + PDF 预览/下载 + 已读标记
// =========================================================================
import { loadMaterials } from './data.js';
import { isRead, toggleRead } from './store.js';
import { openPdf } from './app.js';
import { h, esc } from './util.js';

export async function renderLibrary(app) {
  const md = await loadMaterials();
  app.innerHTML = '';

  app.appendChild(h('div.section', null,
    h('div.eyebrow', null, '学习资料库'),
    h('h2', null, 'EA / EP 产品销售资料'),
    h('p.text-muted', null, `${md.meta.totalLines} 大产品线 · ${md.meta.totalCategories} 个产品分类 · ${md.meta.totalFiles} 份资料。点击「预览」在线查看，或下载到本地学习；标记已读可追踪学习进度。`),
  ));

  // 搜索栏
  const input = h('input', { type: 'search', placeholder: '🔍 搜索资料名称、产品型号或分类（如 GIS、3VA、断路器）…', oninput: () => render(input.value.trim()) });
  app.appendChild(h('div.search-bar', null, input));

  const container = h('div', null);
  app.appendChild(container);

  function render(kw = '') {
    const k = kw.toLowerCase();
    container.innerHTML = '';
    let shown = 0;

    md.lines.forEach(line => {
      const catBlocks = [];
      line.categories.forEach(cat => {
        const files = cat.files.filter(f =>
          !k ||
          f.title.toLowerCase().includes(k) ||
          cat.name.toLowerCase().includes(k) ||
          (cat.code || '').toLowerCase().includes(k) ||
          (cat.desc || '').toLowerCase().includes(k)
        );
        if (!files.length) return;
        shown += files.length;
        catBlocks.push(h('div.cat-block', null,
          h('div.cat-title', null,
            cat.code ? h('span.code', null, cat.code) : null,
            h('span', null, cat.name),
            cat.desc ? h('span.c-desc', null, '— ' + cat.desc) : null,
          ),
          h('div.grid.grid-2', null, ...files.map(f => fileCard(f, cat))),
        ));
      });
      if (!catBlocks.length) return;
      container.appendChild(h('div.line-block', null,
        h('div.line-head', null,
          h('span.l-icon', null, line.icon),
          h('div', null, h('h3', null, line.name), h('div.l-desc', null, line.desc)),
        ),
        ...catBlocks,
      ));
    });

    if (shown === 0) {
      container.appendChild(h('div.empty-state', null,
        h('div.es-ic', null, '🔍'), h('h3', null, '未找到匹配的资料'), h('p.text-muted', null, '换个关键词试试，例如「GIS」「MCCB」「数字化」。')));
    }
  }

  function fileCard(f, cat) {
    const read = isRead(f.file);
    const dot = h('span', { class: 'read-dot' + (read ? ' done' : ''), title: read ? '已读' : '未读' });
    const card = h('div.card.file-card', null,
      h('div.f-ic', null, 'PDF'),
      h('div.f-main', null,
        h('div.f-title', { title: f.title }, f.title),
        h('div.f-sub', null, `${cat.name} · ${f.sizeMB} MB`),
      ),
      h('div.f-actions', null,
        dot,
        h('button.btn.btn-sm', { onclick: () => openPdf(f.file, f.title) }, '预览'),
        h('a.btn.btn-sm.btn-ghost', { href: f.file, download: '' }, '下载'),
        h('button.btn.btn-sm.btn-ghost', {
          onclick: (e) => { const now = toggleRead(f.file); dot.className = 'read-dot' + (now ? ' done' : ''); e.target.textContent = now ? '✓ 已读' : '标为已读'; },
        }, read ? '✓ 已读' : '标为已读'),
      ),
    );
    return card;
  }

  render('');
}
