// ============================================
// ASCEND · Planner Logic
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { toast } from './utils.js';

/* ============================================
   CONSTANTS
   ============================================ */
const STORAGE_KEY = 'ascend:planner';
const AR_DAYS = [
  { id: 'saturday',  name: 'السبت',    idx: 6, emoji: '🌅' },
  { id: 'sunday',    name: 'الأحد',    idx: 0, emoji: '🌞' },
  { id: 'monday',    name: 'الاثنين',  idx: 1, emoji: '🌙' },
  { id: 'tuesday',   name: 'الثلاثاء', idx: 2, emoji: '⭐' },
  { id: 'wednesday', name: 'الأربعاء', idx: 3, emoji: '☀️' },
  { id: 'thursday',  name: 'الخميس',   idx: 4, emoji: '🌤️' },
  { id: 'friday',    name: 'الجمعة',   idx: 5, emoji: '🎉' }
];

/* ============================================
   STATE
   ============================================ */
let Data = {
  plans: {},      // { lessonId: { day, startHour, hours, completedAt, grade } }
  picked: {},     // { lessonId: true } - دروس مختارة بدون موعد
  timer: null,    // { lessonId, remainingSeconds, totalSeconds, paused }
  streak: 0,
  lastActive: null,
  totalMinutes: 0
};

let Subjects = [];   // من Supabase

/* ============================================
   LOCAL STORAGE
   ============================================ */
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      Data = { ...Data, ...p };
    }
  } catch (e) { console.warn('loadData err', e); }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Data));
  } catch (e) { console.warn('saveData err', e); }
}

/* ============================================
   LOAD SUBJECTS FROM SUPABASE
   ============================================ */
async function loadSubjects() {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, color, chapters(id, title, lessons(id, title, order))')
      .order('name');

    if (error) throw error;

    Subjects = (data || []).map(s => {
      const lessons = [];
      (s.chapters || []).forEach(ch => {
        (ch.lessons || []).forEach(l => {
          lessons.push({
            id: l.id,
            title: l.title,
            chapter: ch.title,
            subjectId: s.id,
            subjectName: s.name,
            color: s.color
          });
        });
      });
      return { ...s, lessons };
    });

    console.log('[planner] Loaded subjects:', Subjects.length);
  } catch (e) {
    console.error('[planner] loadSubjects err', e);
    Subjects = [];
  }
}

/* ============================================
   RENDER FORM OPTIONS
   ============================================ */
function renderSubjectOptions() {
  const sel = document.getElementById('pfSubject');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- اختر المادة --</option>' +
    Subjects.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

function renderLessonOptions(subjectId) {
  const sel = document.getElementById('pfLesson');
  if (!sel) return;

  if (!subjectId) {
    sel.innerHTML = '<option value="">-- اختر المادة أولا --</option>';
    sel.disabled = true;
    return;
  }

  const sub = Subjects.find(s => s.id === subjectId);
  if (!sub || !sub.lessons.length) {
    sel.innerHTML = '<option value="">-- لا توجد دروس --</option>';
    sel.disabled = true;
    return;
  }

  sel.disabled = false;
  sel.innerHTML = '<option value="">-- اختر الدرس --</option>' +
    sub.lessons.map(l => {
      const scheduled = Data.plans[l.id] ? ' 📅' : '';
      return `<option value="${l.id}">${l.title}${scheduled}</option>`;
    }).join('');
}

/* ============================================
   ADD LESSON TO PLAN
   ============================================ */
function addPlan() {
  const subjectId = document.getElementById('pfSubject').value;
  const lessonId = document.getElementById('pfLesson').value;
  const day = document.getElementById('pfDay').value;
  const startHour = parseInt(document.getElementById('pfHour').value, 10);
  const hours = parseInt(document.getElementById('pfDuration').value, 10);

  if (!lessonId) {
    toast('⚠️ اختر الدرس الأول', 'error');
    return;
  }

  if (Data.plans[lessonId]) {
    toast('⚠️ الدرس موجود في الجدول بالفعل', 'error');
    return;
  }

  Data.plans[lessonId] = {
    day,
    startHour,
    hours,
    addedAt: Date.now()
  };
  delete Data.picked[lessonId];

  saveData();
  renderAll();
  toast('✅ تمت الإضافة للجدول', 'success');
}

/* ============================================
   RENDER PENDING
   ============================================ */
function renderPending() {
  const block = document.getElementById('pendingBlock');
  const list = document.getElementById('pendingList');
  if (!block || !list) return;

  const pending = [];
  Object.keys(Data.picked).forEach(lessonId => {
    if (Data.plans[lessonId]) return;
    const sub = Subjects.find(s => s.lessons.some(l => l.id === lessonId));
    if (!sub) return;
    const lesson = sub.lessons.find(l => l.id === lessonId);
    pending.push({ lesson, subject: sub });
  });

  if (!pending.length) {
    block.style.display = 'none';
    return;
  }

  block.style.display = '';
  list.innerHTML = pending.map(p => `
    <div class="pending-item">
      <span class="pending-item-text">${p.lesson.title}</span>
      <button data-pending="${p.lesson.id}">📅 حدد موعد</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-pending]').forEach(btn => {
    btn.addEventListener('click', () => {
      const lessonId = btn.getAttribute('data-pending');
      const sub = Subjects.find(s => s.lessons.some(l => l.id === lessonId));
      if (!sub) return;
      document.getElementById('pfSubject').value = sub.id;
      renderLessonOptions(sub.id);
      setTimeout(() => {
        document.getElementById('pfLesson').value = lessonId;
        document.getElementById('planner-form')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
  });
}

/* ============================================
   RENDER WEEK GRID
   ============================================ */
function renderWeekGrid() {
  const grid = document.getElementById('weekGrid');
  if (!grid) return;

  const todayIdx = new Date().getDay();
  let totalLessons = 0;
  let totalHours = 0;

  grid.innerHTML = AR_DAYS.map(day => {
    const dayLessons = [];
    Object.keys(Data.plans).forEach(lessonId => {
      const plan = Data.plans[lessonId];
      if (plan.day !== day.id) return;
      const sub = Subjects.find(s => s.lessons.some(l => l.id === lessonId));
      if (!sub) return;
      const lesson = sub.lessons.find(l => l.id === lessonId);
      dayLessons.push({ lesson, plan, subject: sub });
    });

    dayLessons.sort((a, b) => a.plan.startHour - b.plan.startHour);
    const isToday = day.idx === todayIdx;
    const dayHours = dayLessons.reduce((a, x) => a + (x.plan.hours || 2), 0);
    totalLessons += dayLessons.length;
    totalHours += dayHours;

    const lessonsHTML = dayLessons.length
      ? dayLessons.map(item => renderLessonCard(item)).join('')
      : '<div class="day-body-empty">فاضي — استرح 🌴</div>';

    return `
      <div class="day-block ${isToday ? 'today' : ''}">
        <div class="day-head">
          <span>${day.emoji} ${day.name} ${isToday ? '<span class="today-badge">اليوم</span>' : ''}</span>
          <span class="count-badge">${dayLessons.length} درس • ${dayHours}س</span>
        </div>
        <div class="day-body">${lessonsHTML}</div>
      </div>
    `;
  }).join('');

  const totalEl = document.getElementById('weekTotal');
  if (totalEl) totalEl.textContent = `${totalLessons} درس • ${totalHours} ساعة`;

  // Attach events
  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      const lessonId = btn.getAttribute('data-lesson');
      if (action === 'start') startTimer(lessonId);
      else if (action === 'complete') markComplete(lessonId);
      else if (action === 'delete') deletePlan(lessonId);
    });
  });
}

/* ============================================
   RENDER LESSON CARD
   ============================================ */
function renderLessonCard({ lesson, plan, subject }) {
  const done = !!plan.completedAt;
  const isActive = Data.timer && Data.timer.lessonId === lesson.id;
  const startH = plan.startHour;
  const endH = startH + plan.hours;

  const fmt = h => {
    const period = h < 12 ? 'ص' : 'م';
    const h12 = h === 0 ? 12 : (h > 12 ? h - 12 : h);
    return h12 + ':00 ' + period;
  };

  const gradeHTML = plan.grade != null
    ? `<span class="grade-pill">✓ ${plan.grade}/100</span>`
    : '';

  return `
    <div class="lesson-card ${done ? 'done' : ''} ${isActive ? 'active' : ''}">
      <div class="lesson-time">
        <div class="time-main">${fmt(startH)} — ${fmt(endH)}</div>
        <div class="time-dur">${plan.hours} ${plan.hours === 1 ? 'ساعة' : 'ساعات'}</div>
      </div>
      <div class="lesson-body">
        <div class="lesson-title">${lesson.title}</div>
        <div class="lesson-meta">
          <span class="subject-pill">${subject.name}</span>
          ${lesson.chapter ? `<span>${lesson.chapter}</span>` : ''}
          ${gradeHTML}
        </div>
      </div>
      <div class="lesson-actions">
        ${done
          ? `<button data-action="delete" data-lesson="${lesson.id}">🗑️ إزالة</button>`
          : `<button class="btn-start" data-action="start" data-lesson="${lesson.id}">🚀 ابدأ</button>
             <button class="btn-complete" data-action="complete" data-lesson="${lesson.id}">✅ خلّصت</button>
             <button data-action="delete" data-lesson="${lesson.id}">🗑️</button>`}
      </div>
    </div>
  `;
}

/* ============================================
   TIMER
   ============================================ */
let timerInterval = null;

function startTimer(lessonId) {
  if (Data.timer) {
    if (!confirm('في درس تاني بيتذاكر. توقفه؟')) return;
    stopTimer(false);
  }

  const plan = Data.plans[lessonId];
  if (!plan) return;

  const sub = Subjects.find(s => s.lessons.some(l => l.id === lessonId));
  if (!sub) return;
  const lesson = sub.lessons.find(l => l.id === lessonId);

  const totalSeconds = (plan.hours || 2) * 3600;

  Data.timer = {
    lessonId,
    lessonTitle: lesson.title,
    subjectName: sub.name,
    totalSeconds,
    remainingSeconds: totalSeconds,
    paused: false
  };

  saveData();
  updateTimerBanner();
  startTimerLoop();
  renderAll();
  toast('⏱️ بدأ المؤقت — ركّز 💪', 'success');
}

function startTimerLoop() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (!Data.timer || Data.timer.paused) return;
    Data.timer.remainingSeconds--;
    if (Data.timer.remainingSeconds <= 0) {
      Data.timer.remainingSeconds = 0;
      updateTimerBanner();
      clearInterval(timerInterval);
      onTimerComplete();
      return;
    }
    updateTimerBanner();
  }, 1000);
}

function updateTimerBanner() {
  const banner = document.getElementById('timerBanner');
  if (!banner) return;

  if (!Data.timer) {
    banner.style.display = 'none';
    return;
  }

  banner.style.display = '';
  document.getElementById('tbTitle').textContent = Data.timer.lessonTitle;
  document.getElementById('tbSub').textContent = Data.timer.subjectName;

  const h = Math.floor(Data.timer.remainingSeconds / 3600);
  const m = Math.floor((Data.timer.remainingSeconds % 3600) / 60);
  const s = Data.timer.remainingSeconds % 60;
  document.getElementById('tbTime').textContent =
    String(h).padStart(2, '0') + ':' +
    String(m).padStart(2, '0') + ':' +
    String(s).padStart(2, '0');

  const pauseBtn = document.getElementById('tbPause');
  if (pauseBtn) pauseBtn.textContent = Data.timer.paused ? '▶️ استمر' : '⏸️ إيقاف';
}

function togglePauseTimer() {
  if (!Data.timer) return;
  Data.timer.paused = !Data.timer.paused;
  updateTimerBanner();
}

function onTimerComplete() {
  // صوت
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.5);
    osc.start();
    osc.stop(ctx.currentTime + 1.5);
  } catch (e) {}

  const lessonId = Data.timer?.lessonId;
  if (!lessonId) return;

  const total = Data.timer.totalSeconds;
  const remaining = Data.timer.remainingSeconds;
  const minutes = Math.round((total - remaining) / 60);
  Data.totalMinutes = (Data.totalMinutes || 0) + minutes;

  const plan = Data.plans[lessonId];
  if (plan) {
    plan.completedAt = Date.now();
  }

  Data.timer = null;
  saveData();
  updateTimerBanner();
  renderAll();

  // اسأل عن الدرجة
  const grade = prompt('🎉 خلّصت! اكتب درجتك من 100 (اتركها فاضية لو مش امتحنت)');
  if (grade && !isNaN(parseFloat(grade))) {
    const g = parseFloat(grade);
    if (g >= 0 && g <= 100) {
      Data.plans[lessonId].grade = g;
      saveData();
      renderAll();
      toast(`✅ تم تسجيل ${g}/100`, 'success');
    }
  } else {
    toast('🎉 أحسنت! تم تسجيل الدرس', 'success');
  }
}

function stopTimer(save = true) {
  if (!Data.timer) return;

  if (save) {
    const total = Data.timer.totalSeconds;
    const remaining = Data.timer.remainingSeconds;
    const minutes = Math.round((total - remaining) / 60);
    Data.totalMinutes = (Data.totalMinutes || 0) + minutes;
    saveData();
  }

  Data.timer = null;
  if (timerInterval) clearInterval(timerInterval);
  updateTimerBanner();
  renderAll();
}

/* ============================================
   MARK COMPLETE / DELETE
   ============================================ */
function markComplete(lessonId) {
  const plan = Data.plans[lessonId];
  if (!plan) return;

  plan.completedAt = Date.now();
  saveData();
  renderAll();
  toast('✅ أحسنت!', 'success');
}

function deletePlan(lessonId) {
  if (!confirm('حذف الدرس من الجدول؟')) return;
  delete Data.plans[lessonId];
  saveData();
  renderAll();
  toast('🗑️ تم الحذف', 'success');
}

/* ============================================
   STATS
   ============================================ */
function renderStats() {
  const totalPlans = Object.keys(Data.plans).length;
  const donePlans = Object.values(Data.plans).filter(p => p.completedAt).length;
  const hours = Math.round((Data.totalMinutes || 0) / 60 * 10) / 10;

  document.getElementById('pstatDone').textContent = donePlans;
  document.getElementById('pstatScheduled').textContent = totalPlans;
  document.getElementById('pstatHours').textContent = hours;
  document.getElementById('pstatStreak').textContent = Data.streak || 0;
}

/* ============================================
   CHECK UPCOMING
   ============================================ */
function checkUpcoming() {
  const area = document.getElementById('notifArea');
  if (!area) return;
  area.innerHTML = '';

  const now = new Date();
  const todayDay = AR_DAYS.find(d => d.idx === now.getDay());
  if (!todayDay) return;

  const currentHour = now.getHours() + now.getMinutes() / 60;
  const upcoming = [];
  const overdue = [];

  Object.keys(Data.plans).forEach(lessonId => {
    const plan = Data.plans[lessonId];
    if (plan.day !== todayDay.id || plan.completedAt) return;

    const sub = Subjects.find(s => s.lessons.some(l => l.id === lessonId));
    if (!sub) return;
    const lesson = sub.lessons.find(l => l.id === lessonId);

    const start = plan.startHour;
    const end = start + plan.hours;

    if (start - currentHour <= 1 && end > currentHour) {
      upcoming.push({ lesson, plan });
    } else if (end <= currentHour) {
      overdue.push({ lesson, plan });
    }
  });

  upcoming.forEach(({ lesson, plan }) => {
    const h12 = plan.startHour === 0 ? 12 : (plan.startHour > 12 ? plan.startHour - 12 : plan.startHour);
    const period = plan.startHour < 12 ? 'ص' : 'م';
    const banner = document.createElement('div');
    banner.className = 'notif-banner upcoming';
    banner.innerHTML = `
      <div class="nb-icon">🔔</div>
      <div class="nb-content">
        <div class="nb-title">موعدك جاي حالاً!</div>
        <div class="nb-sub">${lesson.title} • ${h12}:00 ${period}</div>
      </div>
      <button data-notif-start="${lesson.id}">🚀 ابدأ</button>
    `;
    area.appendChild(banner);
  });

  if (overdue.length) {
    const banner = document.createElement('div');
    banner.className = 'notif-banner overdue';
    banner.innerHTML = `
      <div class="nb-icon">⚠️</div>
      <div class="nb-content">
        <div class="nb-title">فايتك ${overdue.length} درس النهاردة</div>
        <div class="nb-sub">${overdue.map(x => x.lesson.title).join(' • ')}</div>
      </div>
    `;
    area.appendChild(banner);
  }

  area.querySelectorAll('[data-notif-start]').forEach(btn => {
    btn.addEventListener('click', () => {
      startTimer(btn.getAttribute('data-notif-start'));
    });
  });
}

/* ============================================
   RENDER ALL
   ============================================ */
function renderAll() {
  renderStats();
  renderPending();
  renderWeekGrid();
  checkUpcoming();
}

/* ============================================
   INIT
   ============================================ */
async function init() {
  console.log('%c📅 ASCEND Planner', 'color:#7C5CFF;font-weight:bold;font-size:14px');

  loadData();

  // Load subjects from Supabase
  await loadSubjects();
  renderSubjectOptions();

  // Form listeners
  document.getElementById('pfSubject')?.addEventListener('change', e => {
    renderLessonOptions(e.target.value);
  });

  document.getElementById('pfAdd')?.addEventListener('click', addPlan);

  // Timer controls
  document.getElementById('tbPause')?.addEventListener('click', togglePauseTimer);
  document.getElementById('tbFinish')?.addEventListener('click', () => {
    if (Data.timer) {
      Data.timer.remainingSeconds = 0;
      onTimerComplete();
    }
  });

  // Sidebar toggle
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  }

  // Resume timer if active
  if (Data.timer && !Data.timer.paused) {
    startTimerLoop();
  }
  updateTimerBanner();

  renderAll();
  setInterval(checkUpcoming, 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
