// ============================================
// ASCEND · Lesson Page — Final Version
// ============================================
import { supabase } from './supabase.js';
import { escapeHtml, toast, cache } from './utils.js';

/* ========== AUTH ========== */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

/* ========== URL ========== */
const params = new URLSearchParams(location.search);
const lessonId = parseInt(params.get('id'), 10);
if (!lessonId) { location.href = '/dashboard.html'; throw new Error('No lesson id'); }

/* ========== STATE ========== */
const COMPLETED_KEY = `ascend:completed:${user.id}`;
let lessonData = null;
let siblings = [];
let videos = [];
let quiz = null;

/* ========== HELPERS ========== */
function getCompleted() {
  try { return JSON.parse(localStorage.getItem(COMPLETED_KEY) || '[]'); }
  catch { return []; }
}
function markCompleted(id) {
  const list = getCompleted();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(list));
  }
}
function isCompleted(id) { return getCompleted().includes(id); }

/* ========== LOAD PROFILE ========== */
async function loadProfile() {
  try {
    const { data } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single();
    const name = data?.full_name || 'طالب';
    const av = document.getElementById('userAvatar');
    const nm = document.getElementById('userName');
    if (av) av.textContent = name.trim().charAt(0);
    if (nm) nm.textContent = name;
  } catch (err) { console.error(err); }
}

/* ========== LOAD LESSON ========== */
async function loadLesson() {
  try {
    /* 1. Lesson + Chapter + Subject */
    const { data: lesson, error: lessonErr } = await supabase
      .from('lessons')
      .select('id, title, "order", chapters(id, title, subject_id, subjects(id, name, slug, color))')
      .eq('id', lessonId)
      .single();

    if (lessonErr || !lesson) {
      console.error('[ASCEND] Lesson not found:', lessonErr);
      showError('لم يتم العثور على الدرس');
      return;
    }

    lessonData = lesson;
    console.log('[ASCEND] Lesson loaded:', lesson.title);

    /* 2. Videos */
    const { data: vids } = await supabase
      .from('videos')
      .select('id, title, youtube_id, description')
      .eq('lesson_id', lessonId)
      .order('id');
    videos = vids || [];
    console.log('[ASCEND] Videos:', videos.length, videos[0]?.youtube_id);

    /* 3. Sibling lessons */
    const { data: sibs } = await supabase
      .from('lessons')
      .select('id, title, "order"')
      .eq('chapter_id', lesson.chapters.id)
      .order('order');
    siblings = sibs || [];

    /* 4. Quiz */
    try {
      const { data: quizzes } = await supabase
        .from('quizzes')
        .select('id, title, questions(id)')
        .eq('lesson_id', lessonId)
        .eq('is_active', true)
        .limit(1);

      if (quizzes && quizzes.length > 0 && (quizzes[0].questions || []).length > 0) {
        quiz = quizzes[0];
        console.log('[ASCEND] Quiz found:', quiz.title);
      }
    } catch (e) { console.warn('[ASCEND] Quiz:', e); }

    /* 5. Render */
    renderLesson();
    document.title = `${lesson.title} — ASCEND`;

  } catch (err) {
    console.error('[ASCEND] Load failed:', err);
    showError('تعذّر تحميل الدرس');
  }
}

/* ========== RENDER LESSON ========== */
function renderLesson() {
  const lesson = lessonData;
  const subject = lesson.chapters.subjects;
  const chapter = lesson.chapters;

  /* Breadcrumb */
  const bcSubj = document.getElementById('breadcrumbSubject');
  const bcChap = document.getElementById('breadcrumbChapter');
  if (bcSubj) bcSubj.innerHTML = `<a href="/subject.html?slug=${escapeHtml(subject.slug)}">${escapeHtml(subject.name)}</a>`;
  if (bcChap) bcChap.textContent = chapter.title;

  /* Title */
  document.getElementById('lessonTitle').textContent = lesson.title;
  document.getElementById('lessonMeta').textContent = `${subject.name} · ${chapter.title}`;

  /* Video */
  renderVideo();

  /* Description */
  renderDescription();

  /* Actions */
  renderActions();

  /* Sidebar */
  renderSidebar();
}

/* ========== VIDEO ========== */
function renderVideo() {
  const wrap = document.getElementById('videoWrap');
  if (!wrap) return;

  if (videos.length === 0 || !videos[0].youtube_id) {
    wrap.innerHTML = `
      <div class="video-placeholder">
        <div>
          <svg viewBox="0 0 24 24"><path d="M15 10l-4-2v8l4-2"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>
          <p>
            <strong>لا يوجد فيديو لهذا الدرس بعد</strong>
            سيتم إضافة الشرح قريبًا.
          </p>
        </div>
      </div>
    `;
    return;
  }

  const video = videos[0];
  const ytId = video.youtube_id.trim();

  console.log('[ASCEND] Loading video:', ytId);

  wrap.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${escapeHtml(ytId)}?rel=0&modestbranding=1&playsinline=1"
      title="${escapeHtml(video.title)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
      style="width:100%;height:100%;border:0;display:block"
    ></iframe>
  `;
}

/* ========== DESCRIPTION ========== */
function renderDescription() {
  const el = document.getElementById('lessonDescription');
  if (!el) return;

  const desc = videos[0]?.description || '';
  if (desc && desc.trim()) {
    el.innerHTML = desc.split('\n').filter(p => p.trim())
      .map(p => `<p>${escapeHtml(p)}</p>`).join('');
  } else {
    el.innerHTML = '<p style="color:var(--fg-4)">لا يوجد وصف متاح لهذا الدرس.</p>';
  }
}

/* ========== ACTIONS ========== */
function renderActions() {
  const left = document.getElementById('actionsLeft');
  if (!left) return;
  left.innerHTML = '';

  /* Complete Button */
  const completeBtn = document.createElement('button');
  completeBtn.className = 'btn-complete';

  if (isCompleted(lessonId)) {
    completeBtn.classList.add('completed');
    completeBtn.disabled = true;
    completeBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
      <span>تم إكمال الدرس</span>
    `;
  } else {
    completeBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
      <span>أكملت الدرس</span>
    `;
    completeBtn.addEventListener('click', handleComplete);
  }
  left.appendChild(completeBtn);

  /* Quiz Button */
  if (quiz) {
    const quizBtn = document.createElement('a');
    quizBtn.href = `/quiz.html?lesson=${lessonId}`;
    quizBtn.className = 'btn-complete';
    quizBtn.style.background = 'linear-gradient(180deg, #06B6D4 0%, #0891B2 100%)';
    quizBtn.style.boxShadow = '0 1px 0 rgba(255,255,255,0.15) inset, 0 8px 24px -8px rgba(6,182,212,0.6)';
    quizBtn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
      <span>ابدأ الاختبار</span>
    `;
    left.appendChild(quizBtn);
  }

  /* Nav Buttons */
  const idx = siblings.findIndex(s => s.id === lessonId);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (prevBtn) {
    if (prev) {
      prevBtn.classList.remove('disabled');
      prevBtn.href = `/lesson.html?id=${prev.id}`;
    } else {
      prevBtn.classList.add('disabled');
      prevBtn.removeAttribute('href');
    }
  }

  if (nextBtn) {
    if (next) {
      nextBtn.classList.remove('disabled');
      nextBtn.href = `/lesson.html?id=${next.id}`;
    } else {
      nextBtn.classList.add('disabled');
      nextBtn.removeAttribute('href');
    }
  }
}

/* ========== COMPLETE HANDLER ========== */
function handleComplete() {
  if (isCompleted(lessonId)) return;
  markCompleted(lessonId);

  const btn = document.querySelector('.btn-complete');
  if (btn) {
    btn.classList.add('completed');
    btn.disabled = true;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
      <span>تم إكمال الدرس</span>
    `;
  }
  toast('تم إكمال الدرس ✅', 'success');
}

/* ========== SIDEBAR ========== */
function renderSidebar() {
  const list = document.getElementById('lessonsMiniList');
  if (!list) return;

  if (siblings.length === 0) {
    list.innerHTML = '<div class="loading-inline" style="padding:24px">لا يوجد دروس</div>';
    return;
  }

  list.innerHTML = siblings.map((s, i) => {
    const isCurrent = s.id === lessonId;
    const done = isCompleted(s.id);
    return `
      <a class="lessons-mini-item${isCurrent ? ' current' : ''}" href="/lesson.html?id=${s.id}" data-id="${s.id}">
        <span class="lessons-mini-num">${String(i + 1).padStart(2, '0')}</span>
        <span class="lessons-mini-title">${escapeHtml(s.title)}</span>
        ${done ? '<div class="lessons-mini-done"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></div>' : ''}
      </a>
    `;
  }).join('');

  setTimeout(() => {
    list.querySelector('.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 200);
}

/* ========== ERROR ========== */
function showError(msg) {
  const wrap = document.getElementById('videoWrap');
  if (wrap) {
    wrap.innerHTML = `
      <div class="video-placeholder">
        <div>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <p><strong>${escapeHtml(msg)}</strong></p>
        </div>
      </div>
    `;
  }
  const list = document.getElementById('lessonsMiniList');
  if (list) list.innerHTML = '<div class="loading-inline" style="padding:24px">—</div>';
}

/* ========== EVENTS ========== */
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  cache.clear('subjects');
  location.href = '/';
});

/* ========== INIT ========== */
(async function init() {
  await loadProfile();
  await loadLesson();
})();