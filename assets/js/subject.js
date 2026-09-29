// ============================================
// ASCEND · Subject Page
// ============================================
import { supabase } from './supabase.js';
import { $, escapeHtml, cache } from './utils.js';

/* ---------- Null-safe helpers ---------- */
function setText(sel, val) {
  const el = document.querySelector(sel);
  if (el) el.textContent = val;
}

/* ---------- Auth guard ---------- */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }

const user = session.user;

/* ---------- Get subject slug from URL ---------- */
const params = new URLSearchParams(location.search);
const slug = params.get('slug');

if (!slug) {
  location.href = '/dashboard.html';
  throw new Error('No slug');
}

/* ---------- Load user profile ---------- */
try {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const name = profile?.full_name || 'طالب';
  setText('#userName', name);
  setText('#userAvatar', name.trim().charAt(0));
} catch (err) {
  console.error('[ASCEND] Profile load failed:', err);
  setText('#userName', 'طالب');
  setText('#userAvatar', '؟');
}

/* ---------- Load subject ---------- */
async function loadSubject() {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*, teachers(name)')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      showError('لم يتم العثور على المادة');
      return;
    }

    renderSubjectHero(data);
    renderMistakesButton(data);
    document.title = `${data.name} — ASCEND`;

    await loadChapters(data.id);
  } catch (err) {
    console.error('[ASCEND] Load subject failed:', err);
    showError('تعذّر تحميل المادة');
  }
}

/* ---------- Render subject hero ---------- */
function renderSubjectHero(s) {
  const teachers = (s.teachers || []).map(t => t.name).join(' · ');
  const initial = (s.name || '?').trim().charAt(0);

  const heroEl = document.querySelector('#subjectHero');
  if (!heroEl) return;

  heroEl.innerHTML = `
    <div class="subject-hero" style="--subject-accent:${escapeHtml(s.color || '#7C5CFF')}">
      <div class="subject-hero-inner">
        <div class="subject-hero-mark">${escapeHtml(initial)}</div>
        <div class="subject-hero-body">
          <div class="subject-hero-tag">مادة دراسية</div>
          <h1 class="subject-hero-title">${escapeHtml(s.name)}</h1>
          <div class="subject-hero-teacher">أ. ${escapeHtml(teachers || 'قريبًا')}</div>
          <p class="subject-hero-desc">${escapeHtml(s.description || '')}</p>
          <div class="subject-hero-stats">
            <div>
              <div class="subject-hero-stat-lbl">الفصول</div>
              <div class="subject-hero-stat-val" id="heroChaptersCount">—</div>
            </div>
            <div>
              <div class="subject-hero-stat-lbl">الدروس</div>
              <div class="subject-hero-stat-val" id="heroLessonsCount">—</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  setText('#breadcrumbSubject', s.name);
}

/* ---------- Mistakes button ---------- */
function renderMistakesButton(subject) {
  const heroEl = document.querySelector('#subjectHero');
  if (!heroEl) return;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:20px;display:flex;gap:10px;flex-wrap:wrap';
  wrap.innerHTML = `
    <a href="/mistakes.html?subject=${escapeHtml(subject.slug)}&subject_id=${subject.id}"
       style="display:inline-flex;align-items:center;gap:8px;padding:12px 22px;border-radius:12px;
       background:rgba(248,81,73,0.1);color:#FCA5A5;border:1px solid rgba(248,81,73,0.3);
       font-size:13.5px;font-weight:600;text-decoration:none;font-family:inherit;
       transition:all 180ms"
       onmouseover="this.style.background='rgba(248,81,73,0.18)'"
       onmouseout="this.style.background='rgba(248,81,73,0.1)'">
      <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;stroke-width:2.2;fill:none;stroke-linecap:round;stroke-linejoin:round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
      غلطاتي في ${escapeHtml(subject.name)}
    </a>
  `;
  heroEl.appendChild(wrap);
}

/* ---------- Load chapters + lessons ---------- */
async function loadChapters(subjectId) {
  const container = document.querySelector('#chaptersList');
  if (!container) return;

  container.innerHTML = '<div class="loading-inline">جاري تحميل الفصول…</div>';

  try {
    const { data, error } = await supabase
      .from('chapters')
      .select('id, title, "order", lessons(id, title, "order")')
      .eq('subject_id', subjectId)
      .order('order');

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4z"/><path d="M20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z"/></svg>
          <div>لم يتم إضافة فصول هذه المادة بعد.</div>
        </div>
      `;
      return;
    }

    const totalLessons = data.reduce((sum, c) => sum + (c.lessons?.length || 0), 0);
    setText('#heroChaptersCount', data.length);
    setText('#heroLessonsCount', totalLessons);
    setText('#chaptersCount', `${data.length} فصول · ${totalLessons} درس`);

    container.innerHTML = data.map((ch, idx) => {
      const lessons = (ch.lessons || []).sort((a, b) => (a.order || 0) - (b.order || 0));
      const lessonsCount = lessons.length;

      return `
        <div class="chapter" data-chapter="${ch.id}">
          <div class="chapter-head" onclick="toggleChapter(${ch.id})">
            <div class="chapter-num">${idx + 1}</div>
            <div class="chapter-body">
              <div class="chapter-title">${escapeHtml(ch.title)}</div>
              <div class="chapter-meta">${lessonsCount} ${lessonsCount === 1 ? 'درس' : 'دروس'}</div>
            </div>
            <div class="chapter-toggle"></div>
          </div>
          <div class="chapter-lessons">
            ${lessonsCount === 0
              ? '<div class="empty-state" style="padding:24px">لا يوجد دروس في هذا الفصل بعد</div>'
              : lessons.map((l, i) => `
                <a class="lesson-item" href="/lesson.html?id=${l.id}">
                  <div class="lesson-icon">
                    <svg viewBox="0 0 24 24"><path d="M15 10l-4-2v8l4-2"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>
                  </div>
                  <div class="lesson-body">
                    <div class="lesson-title">${escapeHtml(l.title)}</div>
                    <div class="lesson-meta">الدرس ${i + 1}</div>
                  </div>
                  <div class="lesson-arrow">
                    <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
                  </div>
                </a>
              `).join('')
            }
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('[ASCEND] Load chapters failed:', err);
    container.innerHTML = `
      <div class="empty-state" style="color:#F85149">
        تعذّر تحميل الفصول. حدّث الصفحة.
      </div>
    `;
  }
}

/* ---------- Toggle chapter ---------- */
window.toggleChapter = (id) => {
  const chapter = document.querySelector(`[data-chapter="${id}"]`);
  if (!chapter) return;
  chapter.classList.toggle('open');
};

/* ---------- Error ---------- */
function showError(msg) {
  const heroEl = document.querySelector('#subjectHero');
  if (heroEl) heroEl.innerHTML = '';

  const listEl = document.querySelector('#chaptersList');
  if (listEl) {
    listEl.innerHTML = `
      <div class="empty-state" style="color:#F85149">${escapeHtml(msg)}</div>
    `;
  }
}

/* ---------- Sidebar toggle ---------- */
document.querySelector('#menuToggle')?.addEventListener('click', () => {
  document.querySelector('#sidebar')?.classList.toggle('open');
});

/* ---------- Logout ---------- */
document.querySelector('#logoutBtn')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  cache.clear('subjects');
  location.href = '/';
});

/* ---------- Init ---------- */
loadSubject();