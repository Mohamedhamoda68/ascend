// ============================================
// ASCEND · Quiz (Legend + Full Results + Review)
// ============================================
import { supabase } from './supabase.js';
import { escapeHtml, toast } from './utils.js';

/* ========== AUTH ========== */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

/* ========== URL ========== */
const params = new URLSearchParams(location.search);
const lessonId = parseInt(params.get('lesson'), 10);
if (!lessonId) { location.href = '/dashboard.html'; throw new Error('No lesson id'); }

/* ========== STATE ========== */
let quiz = null;
let questions = [];
let answers = {};
let currentIndex = 0;
let timerInterval = null;
let timeLeft = 0;
let attempts = [];
let inProgressAttempt = null;
let saveInterval = null;
let lastAttempt = null; /* آخر محاولة للعرض */

const root = document.getElementById('quizRoot');

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

/* ========== LOAD QUIZ ========== */
async function loadQuiz() {
  try {
    const { data: quizzes, error: qErr } = await supabase
      .from('quizzes').select('*')
      .eq('lesson_id', lessonId).eq('is_active', true).limit(1);
    if (qErr) throw qErr;
    if (!quizzes || quizzes.length === 0) { showEmpty('لا يوجد اختبار لهذا الدرس'); return; }
    quiz = quizzes[0];

    const { data: qs, error: qsErr } = await supabase
      .from('questions').select('*').eq('quiz_id', quiz.id).order('order');
    if (qsErr) throw qsErr;
    if (!qs || qs.length === 0) { showEmpty('لا توجد أسئلة'); return; }
    questions = qs;

    const { data: ats } = await supabase
      .from('attempts').select('*')
      .eq('quiz_id', quiz.id).eq('user_id', user.id)
      .order('completed_at', { ascending: false });
    attempts = ats || [];

    const { data: prog } = await supabase
      .from('attempt_progress').select('*')
      .eq('quiz_id', quiz.id).eq('user_id', user.id).maybeSingle();
    inProgressAttempt = prog;

    renderAttemptsList();
  } catch (err) {
    console.error('[ASCEND] Load failed:', err);
    showEmpty('تعذّر تحميل الاختبار');
  }
}

function showEmpty(msg) {
  root.innerHTML = `
    <div class="legend-quiz-card" style="text-align:center;padding:60px 24px">
      <svg viewBox="0 0 24 24" style="width:48px;height:48px;stroke:var(--ld-red);stroke-width:1.5;fill:none;margin:0 auto 16px">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
      <div style="font-size:16px;margin-bottom:8px">${escapeHtml(msg)}</div>
      <a href="/lesson.html?id=${lessonId}" style="color:var(--ld-green);font-weight:600;text-decoration:none">← الرجوع للدرس</a>
    </div>
  `;
}

/* ========== ATTEMPTS LIST ========== */
function renderAttemptsList() {
  const hasAttempts = attempts.length > 0;
  const hasProgress = !!inProgressAttempt;

  root.innerHTML = `
    <div class="legend-attempts-page">
      <div class="legend-attempts-header">
        <h2>${escapeHtml(quiz.title)}</h2>
        <p>${escapeHtml(quiz.description || 'اختبار قصير')}</p>
      </div>

      ${hasProgress ? `
        <div class="legend-resume-banner">
          <div class="legend-resume-icon">
            <svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg>
          </div>
          <div class="legend-resume-body">
            <div class="legend-resume-title">لديك اختبار غير مكتمل</div>
            <div class="legend-resume-sub">${Object.keys(inProgressAttempt.answers || {}).length} من ${questions.length} سؤال تم حله</div>
          </div>
          <button class="legend-resume-btn" id="resumeBtn">استكمال</button>
        </div>
      ` : ''}

      ${hasAttempts ? `
        <div class="legend-attempts-table-wrap">
          <table class="legend-attempts-table">
            <thead>
              <tr>
                <th>السريال</th>
                <th>تاريخ الدخول</th>
                <th>الوقت المستهلك</th>
                <th>مرات فتح الامتحان</th>
                <th>إجمالي الدرجات</th>
                <th>الأسئلة المحلولة</th>
                <th>النتيجة</th>
              </tr>
            </thead>
            <tbody>
              ${attempts.map((a, idx) => {
                const pct = Math.round((a.score / a.total_questions) * 100);
                const passed = pct >= (quiz.passing_score || 60);
                const date = new Date(a.completed_at);
                const serial = 1000000 + a.id;
                return `
                  <tr>
                    <td>${serial}</td>
                    <td>${date.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
                      <div style="font-size:11px;color:var(--ld-text-3)">${date.toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'})}</div>
                    </td>
                    <td>${Math.round((a.time_spent_seconds || 0) / 60)} دقيقة</td>
                    <td>مرة واحدة</td>
                    <td>${a.total_questions}</td>
                    <td>${a.total_questions}</td>
                    <td>
                      <button class="legend-result-btn ${passed ? 'pass' : 'fail'}" data-attempt="${a.id}">
                        عرض النتيجة
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="legend-no-attempts">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <div>لا توجد محاولات سابقة</div>
          <p>ابدأ الاختبار الأول!</p>
        </div>
      `}

      <div class="legend-new-exam-wrap">
        <button class="legend-new-exam-btn" id="newExamBtn">
          ${hasAttempts ? 'افتح اختبار جديد' : 'ابدأ الاختبار'}
        </button>
      </div>
    </div>
  `;

  document.getElementById('newExamBtn')?.addEventListener('click', startFresh);
  document.getElementById('resumeBtn')?.addEventListener('click', resumeExam);

  document.querySelectorAll('.legend-result-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.attempt, 10);
      const attempt = attempts.find(a => a.id === id);
      if (attempt) showAttemptResult(attempt);
    });
  });
}

/* ========== START / RESUME ========== */
async function startFresh() {
  if (inProgressAttempt) {
    try {
      await supabase.from('attempt_progress').delete()
        .eq('quiz_id', quiz.id).eq('user_id', user.id);
    } catch (e) { console.warn(e); }
  }
  answers = {};
  currentIndex = 0;
  timeLeft = (quiz.time_limit_minutes || 10) * 60;
  await saveProgress();
  renderQuizUI();
  startTimer();
  startAutoSave();
}

function resumeExam() {
  if (!inProgressAttempt) return;
  answers = inProgressAttempt.answers || {};
  currentIndex = inProgressAttempt.current_index || 0;
  timeLeft = inProgressAttempt.time_left_seconds || (quiz.time_limit_minutes || 10) * 60;
  renderQuizUI();
  startTimer();
  startAutoSave();
  toast('تم استكمال الامتحان', 'success');
}

/* ========== SAVE ========== */
async function saveProgress() {
  try {
    await supabase.from('attempt_progress').upsert({
      quiz_id: quiz.id, user_id: user.id,
      answers, current_index: currentIndex,
      time_left_seconds: timeLeft,
      updated_at: new Date().toISOString()
    }, { onConflict: 'quiz_id,user_id' });
  } catch (err) { console.warn(err); }
}

function startAutoSave() {
  clearInterval(saveInterval);
  saveInterval = setInterval(() => { if (timeLeft > 0) saveProgress(); }, 5000);
}

/* ========== QUIZ UI ========== */
function renderQuizUI() {
  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / total) * 100;

  root.innerHTML = `
    <div class="legend-quiz-top">
      <div class="legend-stat-box">
        <div class="legend-stat-label">الوقت المتبقي :</div>
        <div class="legend-stat-value timer" id="timerBox">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span id="timerValue">--:--</span>
        </div>
      </div>
      <div class="legend-stat-box"><div class="legend-stat-label">الأسئلة</div><div class="legend-stat-value">${total}</div></div>
      <div class="legend-stat-box"><div class="legend-stat-label">محلول</div><div class="legend-stat-value green" id="answeredCount">${answeredCount}</div></div>
      <div class="legend-stat-box"><div class="legend-stat-label">غير محلول</div><div class="legend-stat-value red" id="unansweredCount">${total - answeredCount}</div></div>
    </div>

    <div class="legend-progress"><div class="legend-progress-fill" id="progressFill" style="width:${progress}%"></div></div>

    <div class="legend-actions-row">
      <button class="legend-btn-row red" id="endBtn">
        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        إنهاء الاختبار
      </button>
      <button class="legend-btn-row outline" id="reviewBtn">
        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        مراجعة الإجابات
      </button>
      <button class="legend-btn-row yellow" id="continueBtn">
        <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        استكمال الاختبار لاحقًا
      </button>
    </div>

    <div class="legend-numbers-card">
      <div class="legend-numbers-head"><span>الأسئلة</span><span id="currentOfTotal">${currentIndex + 1} / ${total}</span></div>
      <div class="legend-numbers" id="numbersGrid">
        ${questions.map((q, i) => `<button class="legend-num${i === currentIndex ? ' active' : ''}${answers[q.id] ? ' answered' : ''}" data-index="${i}">${i + 1}</button>`).join('')}
      </div>
      <div class="legend-markers">
        <span class="legend-marker"><span class="legend-marker-dot green"></span> محلول</span>
        <span class="legend-marker"><span class="legend-marker-dot red"></span> مفتوح</span>
        <span class="legend-marker"><span class="legend-marker-dot gray"></span> لم يُفتح</span>
      </div>
    </div>

    <div class="legend-question-card" id="questionCard"></div>

    <div class="legend-prevnext">
      <button class="legend-btn-pn prev" id="prevBtn" ${currentIndex === 0 ? 'disabled' : ''}>
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> السابق
      </button>
      <button class="legend-btn-pn next" id="nextBtn" ${currentIndex === total - 1 ? 'disabled' : ''}>
        التالي <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  `;

  renderQuestion();

  document.querySelectorAll('.legend-num').forEach(btn => {
    btn.addEventListener('click', () => { currentIndex = parseInt(btn.dataset.index, 10); saveProgress(); renderQuizUI(); });
  });
  document.getElementById('prevBtn')?.addEventListener('click', () => { if (currentIndex > 0) { currentIndex--; saveProgress(); renderQuizUI(); } });
  document.getElementById('nextBtn')?.addEventListener('click', () => { if (currentIndex < questions.length - 1) { currentIndex++; saveProgress(); renderQuizUI(); } });
  document.getElementById('endBtn')?.addEventListener('click', () => {
    const unanswered = questions.filter(q => !answers[q.id]).length;
    if (unanswered > 0 && !confirm(`فيه ${unanswered} سؤال لم تجاوب عليه. إنهاء الاختبار؟`)) return;
    finishQuiz(false);
  });
  document.getElementById('reviewBtn')?.addEventListener('click', showPreSubmitReview);
  document.getElementById('continueBtn')?.addEventListener('click', async () => {
    await saveProgress();
    toast('تم الحفظ', 'info');
    setTimeout(() => location.href = `/lesson.html?id=${lessonId}`, 900);
  });
}

/* ========== RENDER QUESTION (Legend Style) ========== */
function renderQuestion() {
  const q = questions[currentIndex];

  const options = [
    { key: 'a', text: q.option_a, letter: 'أ' },
    { key: 'b', text: q.option_b, letter: 'ب' },
    { key: 'c', text: q.option_c, letter: 'ج' },
    { key: 'd', text: q.option_d, letter: 'د' }
  ];

  const card = document.getElementById('questionCard');
  if (!card) return;

  card.innerHTML = `
    <!-- Question Header -->
    <div class="q-head">
      <div class="q-number">${currentIndex + 1}</div>
      <div class="q-text">${escapeHtml(q.question_text)}</div>
    </div>

    <!-- Options -->
    <div class="q-options">
      ${options.map(o => `
        <button class="q-option${answers[q.id] === o.key ? ' selected' : ''}" data-key="${o.key}">
          <span class="q-radio"></span>
          <span class="q-option-text">${o.letter} - ${escapeHtml(o.text)}</span>
          <span class="q-letter">${o.letter}</span>
        </button>
      `).join('')}
    </div>

    <!-- Image Viewer -->
    ${q.image_url ? `
      <div class="q-image-section">
        <button class="q-view-image-btn" id="viewImageBtn">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          عرض الصورة
        </button>
        <div class="q-image-dim">📐 صورة توضيحية</div>
      </div>
    ` : ''}
  `;

  /* Options click */
  card.querySelectorAll('.q-option').forEach(btn => {
    btn.addEventListener('click', () => {
      answers[q.id] = btn.dataset.key;
      card.querySelectorAll('.q-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      updateStats();
      updateNumbersGrid();
    });
  });

  /* Image viewer */
  document.getElementById('viewImageBtn')?.addEventListener('click', () => {
    openImageZoom(q.image_url);
  });

  updateTimerDisplay();
}

/* ========== IMAGE ZOOM MODAL ========== */
function openImageZoom(imageUrl) {
  /* Remove existing modal */
  document.getElementById('imageZoomModal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'imageZoomModal';
  modal.className = 'image-zoom-modal';
  modal.innerHTML = `
    <div class="image-zoom-overlay"></div>
    <div class="image-zoom-content">
      <button class="image-zoom-close" aria-label="إغلاق">
        <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
      <div class="image-zoom-toolbar">
        <button class="image-zoom-btn" id="zoomIn">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M11 8v6M8 11h6"/></svg>
        </button>
        <button class="image-zoom-btn" id="zoomOut">
          <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35M8 11h6"/></svg>
        </button>
        <button class="image-zoom-btn" id="zoomReset">
          <svg viewBox="0 0 24 24"><path d="M1 4v6h6M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
        </button>
      </div>
      <div class="image-zoom-wrapper">
        <img id="zoomImage" src="${escapeHtml(imageUrl)}" alt="صورة السؤال">
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  let scale = 1;
  const img = document.getElementById('zoomImage');

  document.getElementById('zoomIn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    scale = Math.min(scale + 0.25, 3);
    img.style.transform = `scale(${scale})`;
  });

  document.getElementById('zoomOut')?.addEventListener('click', (e) => {
    e.stopPropagation();
    scale = Math.max(scale - 0.25, 0.5);
    img.style.transform = `scale(${scale})`;
  });

  document.getElementById('zoomReset')?.addEventListener('click', (e) => {
    e.stopPropagation();
    scale = 1;
    img.style.transform = 'scale(1)';
  });

  /* Close handlers */
  const close = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 250);
  };

  modal.querySelector('.image-zoom-close')?.addEventListener('click', close);
  modal.querySelector('.image-zoom-overlay')?.addEventListener('click', close);

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', escHandler);
    }
  });

  /* Show */
  requestAnimationFrame(() => modal.classList.add('show'));
}
function updateStats() {
  const total = questions.length;
  const answered = Object.keys(answers).length;
  const a = document.getElementById('answeredCount');
  const u = document.getElementById('unansweredCount');
  const p = document.getElementById('progressFill');
  if (a) a.textContent = answered;
  if (u) u.textContent = total - answered;
  if (p) p.style.width = `${(answered / total) * 100}%`;
}
function updateNumbersGrid() {
  document.querySelectorAll('.legend-num').forEach((btn, i) => {
    btn.classList.toggle('answered', !!answers[questions[i].id]);
  });
}

/* ========== TIMER ========== */
function startTimer() {
  clearInterval(timerInterval);
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--; updateTimerDisplay();
    if (timeLeft <= 0) { clearInterval(timerInterval); finishQuiz(true); }
  }, 1000);
}
function updateTimerDisplay() {
  const el = document.getElementById('timerValue');
  const box = document.getElementById('timerBox');
  if (!el) return;
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  el.textContent = `${String(m).padStart(2, '0')} : ${String(s).padStart(2, '0')}`;
  if (box) {
    box.classList.remove('warning', 'danger');
    if (timeLeft <= 30) box.classList.add('danger');
    else if (timeLeft <= 120) box.classList.add('warning');
  }
}

/* ========== PRE-SUBMIT REVIEW ========== */
function showPreSubmitReview() {
  clearInterval(timerInterval);

  root.innerHTML = `
    <div class="legend-presubmit-head">
      <h2>مراجعة الإجابات</h2>
      <p>تأكد من إجاباتك قبل تسليم الاختبار</p>
    </div>

    <div class="legend-presubmit-list">
      ${questions.map((q, i) => {
        const userAns = answers[q.id] || null;
        const options = [
          { key: 'a', text: q.option_a }, { key: 'b', text: q.option_b },
          { key: 'c', text: q.option_c }, { key: 'd', text: q.option_d }
        ];
        const userText = userAns ? options.find(o => o.key === userAns)?.text : null;
        return `
          <div class="legend-presubmit-item ${userAns ? 'answered' : 'unanswered'}" data-qid="${q.id}" data-index="${i}">
            <div class="legend-presubmit-item-head">
              <span class="legend-presubmit-num">${i + 1}</span>
              <span class="legend-presubmit-label">${userAns ? 'تم الحل' : 'لم يتم الحل'}</span>
            </div>
            <div class="legend-presubmit-item-body">
              <div class="legend-presubmit-text">${escapeHtml(q.question_text)}</div>
              ${userText ? `
                <div class="legend-presubmit-answer">
                  <span class="legend-presubmit-answer-label">الإجابة المختارة :</span>
                  <span class="legend-presubmit-answer-value">${userAns.toUpperCase()} — ${escapeHtml(userText)}</span>
                </div>
              ` : `
                <div class="legend-presubmit-answer empty">
                  <span class="legend-presubmit-answer-label">الإجابة المختارة :</span>
                  <span class="legend-presubmit-answer-value">لم يتم الإجابة</span>
                </div>
              `}
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <div class="legend-presubmit-actions">
      <button class="legend-btn-pn prev" id="backToQuizBtn">
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> الرجوع للأسئلة
      </button>
      <button class="legend-btn-pn next" id="submitFinalBtn" style="background:var(--ld-red)">
        تسليم الاختبار نهائيًا
        <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
  `;

  document.getElementById('backToQuizBtn')?.addEventListener('click', () => { renderQuizUI(); startTimer(); });
  document.getElementById('submitFinalBtn')?.addEventListener('click', () => {
    const unanswered = questions.filter(q => !answers[q.id]).length;
    if (unanswered > 0 && !confirm(`فيه ${unanswered} سؤال لم تجاوب عليه. تسليم نهائي؟`)) return;
    finishQuiz(false);
  });
  document.querySelectorAll('.legend-presubmit-item').forEach(item => {
    item.addEventListener('click', () => { currentIndex = parseInt(item.dataset.index, 10); renderQuizUI(); startTimer(); });
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ========== FINISH ========== */
async function finishQuiz(timeUp = false) {
  clearInterval(timerInterval);
  clearInterval(saveInterval);

  let correct = 0;
  const answersDetail = {};
  questions.forEach(q => {
    const userAns = answers[q.id] || null;
    const isCorrect = userAns === q.correct_answer;
    if (isCorrect) correct++;
    answersDetail[q.id] = { selected: userAns, correct: q.correct_answer, is_correct: isCorrect };
  });

  const total = questions.length;
  const scorePercent = Math.round((correct / total) * 100);
  const passed = scorePercent >= (quiz.passing_score || 60);
  const timeSpent = (quiz.time_limit_minutes || 10) * 60 - Math.max(0, timeLeft);

  try { await supabase.from('attempt_progress').delete().eq('quiz_id', quiz.id).eq('user_id', user.id); } catch (e) {}

  try {
    const { data } = await supabase.from('attempts').insert({
      quiz_id: quiz.id, user_id: user.id,
      score: correct, total_questions: total,
      answers: answersDetail, time_spent_seconds: timeSpent, status: 'completed'
    }).select().single();
    lastAttempt = data;
  } catch (err) { console.error(err); }

  renderResult({ correct, total, scorePercent, passed, timeUp, timeSpent, answersDetail });
}

/* ========== RESULT ========== */
function renderResult({ correct, total, scorePercent, passed, timeUp, timeSpent, answersDetail }) {
  const passing = quiz.passing_score || 60;
  window.__lastAnswers = answersDetail || null;

  root.innerHTML = `
    <div class="legend-result-card">
      <svg class="legend-result-flask" viewBox="0 0 100 130" fill="none">
        <path d="M40 10h20v45l20 50a10 10 0 01-9 15H29a10 10 0 01-9-15l20-50V10z" fill="#10B981" opacity="0.15"/>
        <path d="M40 10h20v45l20 50a10 10 0 01-9 15H29a10 10 0 01-9-15l20-50V10z" stroke="#10B981" stroke-width="2"/>
        <path d="M35 55h30v50a10 10 0 01-10 10H45a10 10 0 01-10-10V55z" fill="#10B981" opacity="0.3"/>
        <rect x="36" y="6" width="28" height="8" rx="2" fill="#10B981"/>
        <rect x="42" y="0" width="16" height="6" rx="2" fill="#10B981" opacity="0.5"/>
      </svg>

      <div class="legend-result-percentage ${passed ? '' : 'fail'}">${scorePercent}<small>%</small></div>
      <div class="legend-result-fraction">${correct} درجة من ${total} درجة</div>

      <div class="legend-result-bar-wrap">
        <div class="legend-result-bar">
          <div class="legend-result-bar-fill ${passed ? '' : 'fail'}" style="width:${scorePercent}%"></div>
          <div class="legend-result-bar-marker" style="right:${passing}%"></div>
        </div>
      </div>
      <div class="legend-result-bar-label">حد النجاح ${passing}%</div>

      <div class="legend-result-stats">
        <div class="legend-result-stat"><div class="legend-result-stat-value">${total}</div><div class="legend-result-stat-label">الأسئلة</div></div>
        <div class="legend-result-stat"><div class="legend-result-stat-value">${total}</div><div class="legend-result-stat-label">المحلولة</div></div>
        <div class="legend-result-stat"><div class="legend-result-stat-value green">${correct}</div><div class="legend-result-stat-label">الصحيحة</div></div>
        <div class="legend-result-stat"><div class="legend-result-stat-value red">${total - correct}</div><div class="legend-result-stat-label">الخاطئة</div></div>
      </div>

      <div class="legend-result-review">
        <button class="legend-review-btn" id="reviewFinalBtn">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          مراجعة الإجابات
        </button>
      </div>

      <div class="legend-result-secondary">
        <a href="/quiz.html?lesson=${lessonId}" class="legend-result-secondary-btn">
          <svg viewBox="0 0 24 24"><path d="M1 4v6h6M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
          إعادة الاختبار
        </a>
        <a href="/lesson.html?id=${lessonId}" class="legend-result-secondary-btn">
          <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
          الرجوع للدرس
        </a>
      </div>
    </div>
  `;

  document.getElementById('reviewFinalBtn')?.addEventListener('click', () => {
    showFinalReview(window.__lastAnswers);
  });
}

/* ========== SHOW ATTEMPT FROM LIST ========== */
function showAttemptResult(attempt) {
  const answersDetail = attempt.answers || {};
  const correct = attempt.score;
  const total = attempt.total_questions;
  const scorePercent = Math.round((correct / total) * 100);
  const passed = scorePercent >= (quiz.passing_score || 60);

  window.__lastAnswers = answersDetail;
  renderResult({ correct, total, scorePercent, passed, timeUp: false, timeSpent: attempt.time_spent_seconds || 0, answersDetail });
}

/* ============================================
   FINAL REVIEW — يعرض الصح والغلط
   ============================================ */
function showFinalReview(answersDetail) {
  const detail = answersDetail || {};
  let correctCount = 0;
  let wrongCount = 0;

  questions.forEach(q => {
    const d = detail[q.id];
    if (d && d.is_correct) correctCount++;
    else if (d) wrongCount++;
  });

  root.innerHTML = `
    <div class="legend-review-header">
      <h2>
        <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        مراجعة الإجابات
      </h2>
      <div class="legend-review-summary">
        <span class="legend-review-summary-item green">✓ ${correctCount} صحيحة</span>
        <span class="legend-review-summary-item red">✗ ${wrongCount} خاطئة</span>
      </div>
    </div>

    ${questions.map((q, i) => {
      const d = detail[q.id] || {};
      const userAns = d.selected || null;
      const correctAns = d.correct || q.correct_answer;
      const isCorrect = userAns === correctAns;

      const options = [
        { key: 'a', text: q.option_a }, { key: 'b', text: q.option_b },
        { key: 'c', text: q.option_c }, { key: 'd', text: q.option_d }
      ];
      const userLabel = userAns ? userAns.toUpperCase() : '—';
      const correctLabel = correctAns.toUpperCase();

      return `
        <div class="legend-review-card ${isCorrect ? 'correct' : 'wrong'}">
          <div class="legend-review-head">
            <div class="legend-review-tags">
              <span class="legend-review-tag points">درجة واحدة</span>
              <span class="legend-review-tag ${isCorrect ? 'correct' : 'wrong'}">
                ${isCorrect ? 'إجابة صحيحة' : 'إجابة خاطئة'}
              </span>
            </div>

            <div class="legend-answer-compare">
              <div class="legend-answer-compare-item ${isCorrect ? 'correct' : 'wrong'}">
                <span class="legend-answer-compare-label">إجابتك :</span>
                <span class="legend-answer-compare-value">${escapeHtml(userLabel)}</span>
              </div>
              ${!isCorrect ? `
                <div class="legend-answer-compare-item right">
                  <span class="legend-answer-compare-label">الإجابة الصحيحة :</span>
                  <span class="legend-answer-compare-value">${escapeHtml(correctLabel)}</span>
                </div>
              ` : ''}
            </div>

            <div class="legend-review-num">
              <span class="legend-review-num-circle">${i + 1}</span>
            </div>
          </div>

          <div class="legend-review-body">
            <div>
              <div class="legend-review-question">${escapeHtml(q.question_text)}</div>
              ${q.image_url ? `<img src="${escapeHtml(q.image_url)}" alt="" class="legend-question-image" style="margin-top:16px">` : ''}
            </div>

            <div class="legend-review-options">
              ${options.map(o => {
                const isUser = userAns === o.key;
                const isCorrectOpt = correctAns === o.key;
                let cls = '';
                if (isCorrectOpt) cls = 'correct';
                else if (isUser && !isCorrect) cls = 'wrong';

                return `
                  <div class="legend-review-option ${cls}">
                    <span class="legend-review-option-letter">${o.key.toUpperCase()}</span>
                    <span>${escapeHtml(o.text)}</span>
                    ${isCorrectOpt ? `<span class="legend-review-option-mark">
                      <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>الصحيحة
                    </span>` : ''}
                    ${isUser && !isCorrectOpt ? `<span class="legend-review-option-mark">
                      <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>إجابتك
                    </span>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('')}

    <div class="legend-review-footer">
      <a href="/quiz.html?lesson=${lessonId}" class="legend-review-back">
        <svg viewBox="0 0 24 24"><path d="M1 4v6h6M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
        إعادة الاختبار
      </a>
      <a href="/lesson.html?id=${lessonId}" class="legend-review-back">
        <svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
        الرجوع للدرس
      </a>
    </div>
  `;

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ========== INIT ========== */
initTheme();
loadProfile();
loadQuiz();