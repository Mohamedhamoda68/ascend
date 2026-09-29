// ============================================
// ASCEND · Mistakes Page
// ============================================
import { supabase } from './supabase.js';
import { escapeHtml } from './utils.js';

/* ========== AUTH ========== */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

/* ========== URL ========== */
const params = new URLSearchParams(location.search);
const subjectSlug = params.get('subject'); /* optional — لو مش موجود، عرض كل المواد */
const subjectId = params.get('subject_id') ? parseInt(params.get('subject_id'), 10) : null;

const root = document.getElementById('mistakesRoot');

/* ========== THEME ========== */
function initTheme() {
  const saved = localStorage.getItem('ascend:theme') || 'light';
  document.body.dataset.theme = saved;
  document.querySelectorAll('[data-theme-btn]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.themeBtn === saved);
    btn.addEventListener('click', () => {
      const t = btn.dataset.themeBtn;
      document.body.dataset.theme = t;
      localStorage.setItem('ascend:theme', t);
      document.querySelectorAll('[data-theme-btn]').forEach(b =>
        b.classList.toggle('active', b.dataset.themeBtn === t));
    });
  });
}

/* ========== PROFILE ========== */
async function loadProfile() {
  try {
    const { data: profile } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single();
    const av = document.getElementById('userAvatar');
    if (av) av.textContent = (profile?.full_name || '؟').trim().charAt(0);
  } catch (err) { console.error(err); }
}

/* ========== LOAD MISTAKES ========== */
async function loadMistakes() {
  try {
    /* 1. جلب المحاولات الناجحة */
    const { data: attempts, error: aErr } = await supabase
      .from('attempts')
      .select(`
        id, quiz_id, score, total_questions, answers, completed_at,
        quizzes (
          id, title, lesson_id,
          lessons (
            id, title,
            chapters (
              id, title, subject_id,
              subjects (id, name, slug, color)
            )
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (aErr) throw aErr;

    /* 2. تجميع الأسئلة الغلط */
    const mistakes = [];

    for (const attempt of attempts || []) {
      const quiz = attempt.quizzes;
      if (!quiz || !quiz.lessons) continue;

      const lesson = quiz.lessons;
      const chapter = lesson.chapters;
      if (!chapter) continue;

      const subject = chapter.subjects;

      /* فلتر المادة لو محدد */
      if (subjectId && subject?.id !== subjectId) continue;

      const detail = attempt.answers || {};

      /* جلب الأسئلة للـ quiz ده */
      const wrongQIds = Object.keys(detail).filter(qid => {
        const d = detail[qid];
        return d && d.selected && !d.is_correct;
      });

      if (wrongQIds.length === 0) continue;

      const { data: qs } = await supabase
        .from('questions')
        .select('*')
        .in('id', wrongQIds.map(id => parseInt(id, 10)));

      if (!qs) continue;

      for (const q of qs) {
        const d = detail[q.id];
        mistakes.push({
          question: q,
          userAnswer: d.selected,
          correctAnswer: d.correct || q.correct_answer,
          attemptId: attempt.id,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          chapterTitle: chapter.title,
          subjectName: subject?.name || '',
          subjectColor: subject?.color || '#10B981',
          subjectSlug: subject?.slug || '',
          date: attempt.completed_at
        });
      }
    }

    /* 3. حساب الإحصائيات */
    const totalWrong = mistakes.length;
    const uniqueLessons = new Set(mistakes.map(m => m.lessonId)).size;
    const uniqueSubjects = new Set(mistakes.map(m => m.subjectSlug)).size;

    renderMistakes(mistakes, { totalWrong, uniqueLessons, uniqueSubjects });

  } catch (err) {
    console.error('[ASCEND] Load mistakes failed:', err);
    root.innerHTML = `
      <div class="legend-quiz-card" style="text-align:center;padding:60px 24px">
        <div style="color:var(--ld-red);font-size:16px;margin-bottom:12px">تعذّر تحميل الغلطات</div>
        <a href="/dashboard.html" class="legend-back-btn">← الرجوع للوحة</a>
      </div>
    `;
  }
}

/* ========== RENDER ========== */
function renderMistakes(mistakes, stats) {
  const backHref = subjectSlug
    ? `/subject.html?slug=${subjectSlug}`
    : '/dashboard.html';

  if (mistakes.length === 0) {
    root.innerHTML = `
      <div class="legend-mistakes-empty">
        <div class="legend-mistakes-empty-icon">
          <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h2>ما شاء الله! مفيش غلطات</h2>
        <p>لحد دلوقتي كل امتحاناتك صح. كمّل كده 💪</p>
        <div style="margin-top:24px">
          <a href="${backHref}" class="legend-back-btn">
            <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
            الرجوع
          </a>
        </div>
      </div>
    `;
    return;
  }

  /* تجميع حسب الفصل */
  const byChapter = {};
  for (const m of mistakes) {
    const key = `${m.subjectSlug}::${m.chapterTitle}`;
    if (!byChapter[key]) {
      byChapter[key] = {
        subjectName: m.subjectName,
        subjectColor: m.subjectColor,
        subjectSlug: m.subjectSlug,
        chapterTitle: m.chapterTitle,
        lessons: new Set(),
        count: 0,
        items: []
      };
    }
    byChapter[key].lessons.add(m.lessonTitle);
    byChapter[key].count++;
    byChapter[key].items.push(m);
  }

  root.innerHTML = `
    <div class="legend-mistakes-header">
      <h1>
        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        غلطاتي
      </h1>
      <p>كل الأسئلة اللي أخطأت فيها — راجعها واصلح مستواك</p>
    </div>

    <div class="legend-mistakes-stats">
      <div class="legend-mistakes-stat">
        <div class="legend-mistakes-stat-value red">${stats.totalWrong}</div>
        <div class="legend-mistakes-stat-label">سؤال خاطئ</div>
      </div>
      <div class="legend-mistakes-stat">
        <div class="legend-mistakes-stat-value blue">${stats.uniqueLessons}</div>
        <div class="legend-mistakes-stat-label">درس فيه غلطات</div>
      </div>
      <div class="legend-mistakes-stat">
        <div class="legend-mistakes-stat-value green">${stats.uniqueSubjects}</div>
        <div class="legend-mistakes-stat-label">مواد فيها غلطات</div>
      </div>
    </div>

    ${Object.entries(byChapter).map(([key, chapter]) => `
      <div class="legend-mistakes-section">
        <div class="legend-mistakes-section-head">
          <div class="legend-mistakes-section-title">
            <span style="width:8px;height:8px;border-radius:50%;background:${escapeHtml(chapter.subjectColor)}"></span>
            ${escapeHtml(chapter.subjectName)} · ${escapeHtml(chapter.chapterTitle)}
          </div>
          <div class="legend-mistakes-section-badge">${chapter.count} غلطة</div>
        </div>

        ${Object.entries(groupByLesson(chapter.items)).map(([lessonTitle, items]) => `
          <a href="/lesson.html?id=${items[0].lessonId}" class="legend-mistakes-chapter">
            <div class="legend-mistakes-chapter-icon">
              <svg viewBox="0 0 24 24"><path d="M15 10l-4-2v8l4-2"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>
            </div>
            <div class="legend-mistakes-chapter-body">
              <div class="legend-mistakes-chapter-title">${escapeHtml(lessonTitle)}</div>
              <div class="legend-mistakes-chapter-meta">
                <span>${items.length} غلطة</span>
                <span class="dot"></span>
                <span>راجع الامتحان</span>
              </div>
            </div>
            <button class="legend-mistakes-chapter-action">راجع الغلطات</button>
          </a>
        `).join('')}
      </div>
    `).join('')}

    <div style="text-align:center;margin-top:32px">
      <a href="${backHref}" class="legend-back-btn">
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        الرجوع
      </a>
    </div>
  `;

  /* Click handlers على الزر */
  document.querySelectorAll('.legend-mistakes-chapter').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const href = el.getAttribute('href');
      location.href = href;
    });
  });
}

function groupByLesson(items) {
  const grouped = {};
  for (const item of items) {
    if (!grouped[item.lessonTitle]) grouped[item.lessonTitle] = [];
    grouped[item.lessonTitle].push(item);
  }
  return grouped;
}

/* ========== INIT ========== */
initTheme();
loadProfile();
loadMistakes();