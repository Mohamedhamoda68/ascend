// ============================================
// ASCEND · Dashboard (Complete)
// ============================================
import { supabase } from './supabase.js';
import { $, escapeHtml, toast, cache } from './utils.js';

/* ============================================
   AUTH GUARD
   ============================================ */
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  location.href = '/login.html';
  throw new Error('No session');
}

const user = session.user;

/* ============================================
   LOAD PROFILE
   ============================================ */
let profile = null;
try {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) throw error;
  profile = data;
} catch (err) {
  console.error('[ASCEND] Profile load failed:', err);
  profile = {
    full_name: user.user_metadata?.full_name || 'طالب',
    role: 'student',
    status: 'pending',
    points: 0,
    streak: 0
  };
}

/* ============================================
   POPULATE USER INFO
   ============================================ */
const name = profile.full_name || 'طالب';
const initial = name.trim().charAt(0);

$('#userName').textContent = name;
$('#userAvatar').textContent = initial;
$('#userRole').textContent = profile.role === 'admin' ? 'مشرف' : 'طالب';
$('#greetName').textContent = name.split(' ')[0];
$('#statPoints').textContent = profile.points ?? 0;
$('#statStreak').textContent = profile.streak ?? 0;

/* Status */
const statusMap = {
  'active': 'مُفعّل',
  'pending': 'قيد المراجعة',
  'suspended': 'موقوف'
};
const statusEl = $('#statStatus');
statusEl.textContent = statusMap[profile.status] || '—';
if (profile.status !== 'active') {
  statusEl.classList.remove('success');
  $('#pendingBanner').style.display = 'flex';
}

/* ============================================
   ADMIN LINK
   ============================================ */
if (profile.role === 'admin') {
  const link = document.createElement('a');
  link.href = '/admin.html';
  link.className = 'sidebar-link';
  link.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9"/></svg>
    لوحة الإدارة
  `;
  document.querySelector('.sidebar-nav')?.appendChild(link);
}

/* ============================================
   LOAD SUBJECTS
   ============================================ */
const subjectsGrid = $('#subjectsGrid');

function renderSubjects(subs) {
  if (!subs || subs.length === 0) {
    subjectsGrid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        لا توجد مواد متاحة حاليًا.
      </div>
    `;
    return;
  }

  subjectsGrid.innerHTML = subs.map(s => {
    const teachers = (s.teachers || []).map(t => t.name).join(' · ');
    const initialLetter = (s.name || '?').trim().charAt(0);

    return `
      <a href="/subject.html?slug=${escapeHtml(s.slug)}" class="subject-card" style="--subject-accent:${escapeHtml(s.color || '#7C5CFF')}">
        <div class="subject-card-head">
          <div class="subject-card-mark">${escapeHtml(initialLetter)}</div>
          <div>
            <div class="subject-card-title">${escapeHtml(s.name)}</div>
            <div class="subject-card-meta">${escapeHtml(teachers || 'قريبًا')}</div>
          </div>
        </div>
        <div class="subject-card-progress">
          <div class="subject-card-progress-fill" style="width:0%"></div>
        </div>
        <div class="subject-card-foot">
          <span>التقدّم</span>
          <span>0%</span>
        </div>
      </a>
    `;
  }).join('');
}

try {
  let subs = cache.get('subjects');
  if (!subs) {
    const { data, error } = await supabase
      .from('subjects')
      .select('id, name, slug, color, icon, description, teachers(name)')
      .order('id');
    if (error) throw error;
    subs = data;
    cache.set('subjects', subs, 10 * 60 * 1000);
  }
  renderSubjects(subs);
  $('#statSubjects').textContent = subs.length;
} catch (err) {
  console.error('[ASCEND] Subjects load failed:', err);
  subjectsGrid.innerHTML = `
    <div class="empty-state" style="grid-column:1/-1;color:#F85149">
      تعذّر تحميل المواد. حدّث الصفحة.
    </div>
  `;
}

/* ============================================
   MISTAKES COUNT
   ============================================ */
async function loadMistakesCount() {
  try {
    const { data: ats } = await supabase
      .from('attempts')
      .select('answers')
      .eq('user_id', user.id)
      .eq('status', 'completed');

    let wrongCount = 0;
    (ats || []).forEach(a => {
      const detail = a.answers || {};
      Object.keys(detail).forEach(qid => {
        if (detail[qid] && detail[qid].selected && !detail[qid].is_correct) {
          wrongCount++;
        }
      });
    });

    const el = document.getElementById('mistakesCount');
    if (el) {
      el.textContent = wrongCount;
      if (wrongCount > 0) {
        el.style.background = 'rgba(248,81,73,0.15)';
        el.style.color = '#F87171';
      }
    }
  } catch (err) {
    console.warn('[ASCEND] Mistakes count failed:', err);
  }
}

/* ============================================
   NOTIFICATIONS COUNT
   ============================================ */
async function loadNotificationsCount() {
  try {
    const { data } = await supabase
      .from('notifications')
      .select('id')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .eq('is_read', false);

    const count = (data || []).length;

    const sidebarEl = document.getElementById('notifSidebarCount');
    if (sidebarEl) {
      sidebarEl.textContent = count;
      if (count > 0) {
        sidebarEl.style.background = 'rgba(16,185,129,0.15)';
        sidebarEl.style.color = '#34D399';
      }
    }

    const dotEl = document.getElementById('notifDot');
    if (dotEl) dotEl.style.display = count > 0 ? 'block' : 'none';
  } catch (err) {
    console.warn('[ASCEND] Notifications count failed:', err);
  }
}

/* ============================================
   LOAD ACTIVITIES
   ============================================ */
async function loadActivities() {
  const list = document.getElementById('activityList');
  if (!list) return;

  try {
    const { data: ats } = await supabase
      .from('attempts')
      .select('id, score, total_questions, completed_at, quizzes(title)')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(8);

    if (!ats || ats.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>
          <div>لا يوجد نشاط حتى الآن. ابدأ بأول فيديو!</div>
        </div>
      `;
      return;
    }

    list.innerHTML = ats.map(a => {
      const pct = Math.round((a.score / a.total_questions) * 100);
      const passed = pct >= 60;
      const iconClass = passed ? 'tested' : 'watched';
      const iconSvg = passed
        ? '<path d="M20 6L9 17l-5-5"/>'
        : '<path d="M18 6L6 18M6 6l12 12"/>';
      const title = a.quizzes?.title || 'اختبار';
      const xp = passed ? `+${pct}` : `${pct}%`;

      return `
        <div class="activity-item">
          <div class="activity-icon ${iconClass}">
            <svg viewBox="0 0 24 24">${iconSvg}</svg>
          </div>
          <div class="activity-body">
            <div class="activity-text">${escapeHtml(title)} · ${a.score}/${a.total_questions}</div>
            <div class="activity-time">${timeAgo(a.completed_at)}</div>
          </div>
          <div class="activity-xp">${xp}</div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.warn('[ASCEND] Activities load failed:', err);
  }
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'الآن';
  const m = Math.floor(s / 60);
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 30) return `منذ ${d} يوم`;
  if (d < 365) return `منذ ${Math.floor(d / 30)} شهر`;
  return `منذ ${Math.floor(d / 365)} سنة`;
}

/* ============================================
   SIDEBAR TOGGLE (محسّن)
   ============================================ */
const sidebarEl = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuToggle');

// 1) زر ☰ : يفتح ويقفل
menuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  sidebarEl?.classList.toggle('open');
});

// 2) الدوس خارج القائمة يقفلها
document.addEventListener('click', (e) => {
  if (!sidebarEl?.classList.contains('open')) return;
  if (sidebarEl.contains(e.target)) return;
  if (menuBtn?.contains(e.target)) return;
  sidebarEl.classList.remove('open');
});

// 3) الدوس على أي رابط في القائمة يقفلها
document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', () => {
    sidebarEl?.classList.remove('open');
  });
});

// 4) تكبير الشاشة يقفل القائمة (للكمبيوتر)
window.addEventListener('resize', () => {
  if (window.innerWidth > 1024) {
    sidebarEl?.classList.remove('open');
  }
});

// 5) زر ESC يقفل القائمة
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    sidebarEl?.classList.remove('open');
  }
});

/* ============================================
   NOTIFICATIONS BUTTON (TOP)
   ============================================ */
$('#notifBtn')?.addEventListener('click', () => {
  location.href = '/notifications.html';
});

/* ============================================
   LOGOUT
   ============================================ */
$('#logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  cache.clear('subjects');
  location.href = '/';
});

/* ============================================
   INIT
   ============================================ */
loadMistakesCount();
loadNotificationsCount();
loadActivities();
