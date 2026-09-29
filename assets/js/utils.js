// ============================================
// ASCEND · Utility Helpers
// ============================================

/* ---------- DOM helpers ---------- */
export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (typeof c === 'string') node.appendChild(document.createTextNode(c));
    else if (c) node.appendChild(c);
  });
  return node;
}

/* ---------- Escape HTML ---------- */
export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ---------- Cache with TTL ---------- */
export const cache = {
  set(key, value, ttlMs = 5 * 60 * 1000) {
    try {
      localStorage.setItem('ascend:' + key, JSON.stringify({
        value,
        expires: Date.now() + ttlMs
      }));
    } catch {}
  },
  get(key) {
    try {
      const raw = localStorage.getItem('ascend:' + key);
      if (!raw) return null;
      const { value, expires } = JSON.parse(raw);
      if (Date.now() > expires) { localStorage.removeItem('ascend:' + key); return null; }
      return value;
    } catch { return null; }
  },
  clear(key) {
    try { localStorage.removeItem('ascend:' + key); } catch {}
  }
};

/* ---------- Retry wrapper ---------- */
export async function withRetry(fn, { retries = 2, delay = 500 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      lastErr = err;
      if (i < retries) await new Promise(r => setTimeout(r, delay * (i + 1)));
    }
  }
  throw lastErr;
}

/* ---------- Arabic date ---------- */
export function formatDate(date) {
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric'
  }).format(new Date(date));
}

/* ---------- Toast notifications ---------- */
export function toast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = el('div', { id: 'toast-container', class: 'toast-container' });
    document.body.appendChild(container);
  }
  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>',
    error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>',
    info:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
  };
  const t = el('div', { class: `toast toast-${type}` });
  t.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;
  container.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

/* ---------- Debounce ---------- */
export function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}