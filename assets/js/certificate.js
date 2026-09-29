// ============================================
// ASCEND · Certificate Page
// ============================================
import { supabase } from './supabase.js';
import { escapeHtml, toast } from './utils.js';

/* ========== AUTH ========== */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

/* ========== URL ========== */
const params = new URLSearchParams(location.search);
const subjectId = parseInt(params.get('subject'), 10);
const viewAll = params.get('all') === '1';

const root = document.getElementById('certRoot');

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
    const { data } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).single();
    const av = document.getElementById('userAvatar');
    if (av) av.textContent = (data?.full_name || '؟').trim().charAt(0);
    return data;
  } catch (err) { console.error(err); return null; }
}

/* ========== SERIAL GENERATOR ========== */
function generateSerial(subjectId, userId) {
  const str = `${subjectId}-${userId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  const code = Math.abs(hash).toString(36).toUpperCase().padStart(8, '0');
  return `AS-${new Date().getFullYear()}-${code.slice(0, 8)}`;
}

/* ========== SUBJECT COMPLETION CHECK ========== */
async function checkSubjectCompletion(subjectId) {
  /* 1. كل دروس المادة */
  const { data: chapters } = await supabase
    .from('chapters')
    .select('id, lessons(id)')
    .eq('subject_id', subjectId);

  if (!chapters) return { total: 0, completed: 0, quizzes: 0, avgScore: 0 };

  const allLessonIds = chapters.flatMap(c => (c.lessons || []).map(l => l.id));
  const totalLessons = allLessonIds.length;

  /* 2. الدروس المكتملة من localStorage */
  const key = `ascend:completed:${user.id}`;
  let completedLessons = [];
  try { completedLessons = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
  const completedInSubject = allLessonIds.filter(id => completedLessons.includes(id));

  /* 3. كل اختبارات المادة + المحاولات */
  const { data: quizzes } = await supabase
    .from('quizzes')
    .select('id, lesson_id, lessons(chapter_id, chapters(subject_id))');

  const subjectQuizzes = (quizzes || []).filter(q =>
    q.lessons?.chapters?.subject_id === subjectId
  );

  const { data: attempts } = await supabase
    .from('attempts')
    .select('quiz_id, score, total_questions, completed_at')
    .eq('user_id', user.id)
    .eq('status', 'completed');

  const subjectAttempts = (attempts || []).filter(a =>
    subjectQuizzes.some(q => q.id === a.quiz_id)
  );

  /* 4. متوسط الدرجات */
  let avgScore = 0;
  if (subjectAttempts.length > 0) {
    const totalPct = subjectAttempts.reduce((sum, a) =>
      sum + (a.score / a.total_questions) * 100, 0);
    avgScore = Math.round(totalPct / subjectAttempts.length);
  }

  /* 5. تاريخ آخر نشاط */
  let lastActivity = null;
  if (subjectAttempts.length > 0) {
    const dates = subjectAttempts.map(a => new Date(a.completed_at).getTime());
    lastActivity = new Date(Math.max(...dates));
  }

  return {
    total: totalLessons,
    completed: completedInSubject.length,
    quizzes: subjectAttempts.length,
    avgScore,
    lastActivity
  };
}

/* ========== LOAD ALL CERTIFICATES ========== */
async function loadAllCertificates() {
  const profile = await loadProfile();

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, slug, color, description')
    .order('id');

  if (!subjects) { renderEmptyAll(); return; }

  const earned = [];

  for (const subj of subjects) {
    const stat = await checkSubjectCompletion(subj.id);
    /* معيار الحصول على الشهادة: 80% من الدروس + 50% متوسط درجات */
    const lessonPct = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;
    if (lessonPct >= 80 && stat.avgScore >= 50) {
      earned.push({ subject: subj, stat });
    }
  }

  if (earned.length === 0) { renderEmptyAll(); return; }

  root.innerHTML = `
    <div class="certs-page-header">
      <h1>
        <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
        شهاداتي
      </h1>
      <p>احصل على شهادة إتمام لكل مادة تكملها</p>
    </div>

    <div class="certs-grid">
      ${earned.map(({ subject, stat }) => `
        <a href="/certificate.html?subject=${subject.id}" class="cert-card">
          <div class="cert-card-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
          </div>
          <div class="cert-card-title">${escapeHtml(subject.name)}</div>
          <div class="cert-card-meta">
            ${stat.completed} من ${stat.total} درس · متوسط ${stat.avgScore}%
          </div>
          <div class="cert-card-cta">
            عرض الشهادة
            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
          </div>
        </a>
      `).join('')}
    </div>

    <div class="certificate-actions" style="margin-top:32px">
      <a href="/dashboard.html" class="cert-btn ghost">
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        الرجوع للوحة
      </a>
    </div>
  `;
}

function renderEmptyAll() {
  root.innerHTML = `
    <div class="certs-empty">
      <div class="certs-empty-icon">
        <svg viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
      </div>
      <h2>لسه مفيش شهادات</h2>
      <p>كمّل الدروس وحل الاختبارات للحصول على شهادة إتمام المادة</p>
      <div style="margin-top:24px">
        <a href="/dashboard.html" class="cert-btn primary" style="display:inline-flex">
          <svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>
          ابدأ من المواد
        </a>
      </div>
    </div>
  `;
}

/* ========== SHOW SINGLE CERTIFICATE ========== */
async function loadCertificate() {
  const profile = await loadProfile();
  const studentName = profile?.full_name || 'طالب';

  /* 1. جلب المادة */
  const { data: subject } = await supabase
    .from('subjects')
    .select('*')
    .eq('id', subjectId)
    .single();

  if (!subject) { renderError('المادة غير موجودة'); return; }

  /* 2. فحص الإكمال */
  const stat = await checkSubjectCompletion(subjectId);
  const lessonPct = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0;

  if (lessonPct < 80) {
    renderError(
      `لم تكمل هذه المادة بعد — أكملت ${stat.completed} من ${stat.total} درس (${Math.round(lessonPct)}%)`
    );
    return;
  }

  /* 3. البيانات */
  const serial = generateSerial(subject.id, user.id);
  const today = new Date();
  const dateStr = today.toLocaleDateString('ar-EG', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  /* 4. Render */
  root.innerHTML = `
    <div class="certificate" id="certificateToPrint">
      <div class="certificate-mark">ASCEND</div>

      <div class="certificate-inner">

        <!-- Header -->
        <div class="certificate-header">
          <div class="certificate-brand">
            <div class="certificate-brand-mark">
              <svg viewBox="0 0 24 24"><path d="M7 17L17 7M17 7H9M17 7v8"/></svg>
            </div>
            ASCEND
          </div>
          <div class="certificate-serial">
            رقم التحقق
            <strong>${escapeHtml(serial)}</strong>
          </div>
        </div>

        <!-- Title -->
        <h1 class="certificate-title">شهادة إتمام</h1>
        <div class="certificate-subtitle">Certificate of Completion</div>

        <!-- Name -->
        <div class="certificate-present">تُمنح هذه الشهادة إلى</div>
        <div class="certificate-name">${escapeHtml(studentName)}</div>

        <!-- Description -->
        <p class="certificate-desc">
          لإتمامه بنجاح مادة <strong>${escapeHtml(subject.name)}</strong> في منصة ASCEND،
          بعد إكمال <strong>${stat.completed}</strong> درسًا وتجاوز الاختبارات المقررة
          بمتوسط درجات <strong>${stat.avgScore}%</strong>.
        </p>

        <!-- Stats -->
        <div class="certificate-stats">
          <div class="certificate-stat">
            <div class="certificate-stat-value green">${stat.completed}</div>
            <div class="certificate-stat-label">درس مُكتمل</div>
          </div>
          <div class="certificate-stat">
            <div class="certificate-stat-value">${stat.quizzes}</div>
            <div class="certificate-stat-label">اختبار مُنجز</div>
          </div>
          <div class="certificate-stat">
            <div class="certificate-stat-value">${stat.avgScore}%</div>
            <div class="certificate-stat-label">متوسط الدرجات</div>
          </div>
        </div>

        <!-- Footer -->
        <div class="certificate-footer">
          <div class="certificate-signature">
            <div class="certificate-signature-line"></div>
            <div class="certificate-signature-name">Mohamed Hamouda</div>
            <div class="certificate-signature-role">مؤسس المنصة</div>
          </div>

          <div class="certificate-seal">
            <div class="certificate-seal-inner">
              <svg viewBox="0 0 24 24"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>
              <div>معتمدة</div>
            </div>
          </div>

          <div class="certificate-date">
            <div class="certificate-date-value">${escapeHtml(dateStr)}</div>
            <div class="certificate-date-label">تاريخ الإصدار</div>
          </div>
        </div>

      </div>
    </div>

    <div class="certificate-actions">
      <button class="cert-btn primary" id="printBtn">
        <svg viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        طباعة / حفظ PDF
      </button>
      <a href="/certificate.html?all=1" class="cert-btn ghost">
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        كل الشهادات
      </a>
      <a href="/subject.html?slug=${escapeHtml(subject.slug)}" class="cert-btn ghost">
        <svg viewBox="0 0 24 24"><path d="M3 12l9-9 9 9M5 10v10h14V10"/></svg>
        الرجوع للمادة
      </a>
    </div>
  `;

  document.getElementById('printBtn')?.addEventListener('click', () => {
    window.print();
  });

  document.title = `شهادة ${subject.name} — ASCEND`;
}

/* ========== ERROR ========== */
function renderError(msg) {
  root.innerHTML = `
    <div class="legend-cert-error">
      <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      <h2>${escapeHtml(msg)}</h2>
      <p>كمّل دروس المادة أولاً للحصول على الشهادة</p>
      <a href="/dashboard.html" class="cert-btn primary" style="display:inline-flex">
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        الرجوع للوحة
      </a>
    </div>
  `;
}

/* ========== INIT ========== */
initTheme();
if (viewAll || !subjectId) {
  loadAllCertificates();
} else {
  loadCertificate();
}