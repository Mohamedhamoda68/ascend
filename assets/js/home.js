// ============================================
// ASCEND · Home Page Logic
// ============================================
import { supabase } from './supabase.js';
import { renderNav, renderFooter, injectStructuredData } from './components.js';
import { cache, escapeHtml, toast, withRetry } from './utils.js';

/* ---------- Init shared UI ---------- */
injectStructuredData();
await renderNav();
renderFooter();

/* ---------- Subjects loader with cache ---------- */
const grid = document.getElementById('subjectsGrid');

function renderSkeleton() {
  grid.innerHTML = Array.from({ length: 5 }).map(() => `
    <div class="subject" style="pointer-events:none">
      <div class="subject-head">
        <div class="skeleton" style="width:42px;height:42px;border-radius:10px"></div>
        <div style="flex:1">
          <div class="skeleton skeleton-line w-40"></div>
          <div class="skeleton skeleton-line w-60" style="height:11px;margin-top:6px"></div>
        </div>
      </div>
      <div class="skeleton skeleton-line w-80"></div>
      <div class="skeleton skeleton-line w-60"></div>
    </div>
  `).join('');
}

function renderSubjects(subs) {
  grid.innerHTML = subs.map(s => {
    const teachers = (s.teachers || []).map(t => t.name).join(' · ');
    const initial = (s.name || '?').trim().charAt(0);
    return `
      <article class="subject" style="--subject-accent:${escapeHtml(s.color || '#7C5CFF')}">
        <div class="subject-head">
          <div class="subject-mark" aria-hidden="true">${escapeHtml(initial)}</div>
          <div>
            <h3>${escapeHtml(s.name)}</h3>
            <div class="meta">${escapeHtml(teachers || 'قريبًا')}</div>
          </div>
        </div>
        <p>${escapeHtml(s.description || '')}</p>
      </article>
    `;
  }).join('');
}

function renderError(msg) {
  grid.innerHTML = `
    <div style="grid-column:1/-1;text-align:center;padding:48px 0">
      <p style="color:#F85149;font-size:14px;margin-bottom:12px">${escapeHtml(msg)}</p>
      <button class="btn btn-ghost btn-sm" id="retryBtn">إعادة المحاولة</button>
    </div>
  `;
  document.getElementById('retryBtn').onclick = loadSubjects;
}

async function loadSubjects() {
  /* Try cache first */
  const cached = cache.get('subjects');
  if (cached) {
    renderSubjects(cached);
    return;
  }

  renderSkeleton();

  try {
    const data = await withRetry(async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, slug, color, icon, description, teachers(name)')
        .order('id');
      if (error) throw error;
      return data;
    }, { retries: 2 });

    if (!data || data.length === 0) {
      renderError('لا توجد مواد متاحة حاليًا.');
      return;
    }

    cache.set('subjects', data, 10 * 60 * 1000); // 10 min
    renderSubjects(data);
  } catch (err) {
    console.error('[ASCEND] Failed to load subjects:', err);
    renderError('تعذّر تحميل المواد. تحقّق من اتصالك بالإنترنت.');
  }
}

await loadSubjects();

/* ---------- FAQ Accordion (ARIA + multi-open) ---------- */
document.querySelectorAll('.faq-item').forEach(item => {
  const btn = item.querySelector('.faq-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const isOpen = item.getAttribute('aria-expanded') === 'true';
    item.setAttribute('aria-expanded', String(!isOpen));
  });
});