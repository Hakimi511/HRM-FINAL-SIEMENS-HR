// =========================================================================
// 通用工具函数
// =========================================================================

/** 创建 DOM 元素的简易工厂：h('div.cls#id', {attr}, ...children) */
export function h(spec, props, ...children) {
  const m = spec.match(/^([a-z0-9]+)/i);
  const tag = m ? m[1] : 'div';
  const el = document.createElement(tag);
  const idM = spec.match(/#([\w-]+)/);
  if (idM) el.id = idM[1];
  const cls = [...spec.matchAll(/\.([\w-]+)/g)].map(x => x[1]);
  if (cls.length) el.className = cls.join(' ');
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = (el.className + ' ' + v).trim();
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v);
    }
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

/** HTML 转义，防止题目/选项中的特殊字符破坏渲染 */
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Fisher–Yates 洗牌（返回新数组） */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 从数组中随机取 n 个 */
export function sampleN(arr, n) {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

/** 选项序号 -> 字母 A/B/C... */
export function letter(i) { return String.fromCharCode(65 + i); }

/** 秒数 -> mm:ss */
export function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 时间戳 -> 本地可读 */
export function fmtDate(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** 两个数组（已排序）是否相等 */
export function arrEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** 滚动到顶部 */
export function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
