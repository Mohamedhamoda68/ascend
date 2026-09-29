// ============================================
// ASCEND · Parent Dashboard
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { $, escapeHtml, toast } from './utils.js';

/* ========== AUTH GUARD ========== */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

let currentProfile = null;
let childrenData = [];

/* ========== HELPERS ========== */
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

function getCompleted(uid) {
  try {
    return JSON.parse(localStorage.getItem(`ascend:completed:${uid}`) || '[]');
  } catch { return []; }
}

/* ========== LOAD PROFILE ========== */
async function loadProfile() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    /* Verify parent role */
    if (data.role !== 'parent' && data.role !== 'admin') {
      console.warn('[ASCEND] Not a parent role — redirecting');
      /* Allow admin to view */
      if (data.role !== 'admin') {
        location.href = '/dashboard.html';
        return;
      }
    }

    currentProfile = data;

    const name = data.full_name || 'ولي أمر';
    document.getElementById('userName').textContent = name;
    document.getElementById('userAvatar').textContent = name.trim().charAt(0);

  } catch (err) {
    console.error('[ASCEND] Profile load failed:', err);
    toast('تعذّر تحميل بيانات الحساب', 'error');
  }
}

/* ========== LOAD CHILDREN ========== */
async function loadChildren() {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('parent_id', user.id)
      .eq('role', 'student')
      .order('created_at', { ascending: false });

    if (error) throw error;

    /* For each child, load their attempts */
    const enriched = await Promise.all((data || []).map(async (child) => {
      /* Attempts */
      const { data: attempts } = await supabase
        .from('attempts')
        .select('*')
        .eq('user_id', child.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(50);

      const list = attempts || [];
      const totalAttempts = list.length;

      let totalScore = 0;
      let passedCount = 0;
      let totalTime = 0;

      list.forEach(a => {
        const pct = (a.score / a.total_questions) * 100;
        totalScore += pct;
        if (pct >= 60) passedCount++;
        totalTime += a.time_spent_seconds || 0;
      });

      const avgScore = totalAttempts > 0 ? Math.round(totalScore / totalAttempts) : 0;
      const passRate = totalAttempts > 0 ? Math.round((passedCount / totalAttempts) * 100) : 0;

      return {
        ...child,
        totalAttempts,
        avgScore,
        passRate,
        passedCount,
        totalTime,
        recent: list.slice(0, 5)
      };
    }));

    childrenData = enriched;
    render();

  } catch (err) {
    console.error('[ASCEND] Load children failed:', err);
    renderError('تعذّر تحميل بيانات الطلاب');
  }
}

/* ========== RENDER ========== */
function render() {
  const root = document.getElementById('contentRoot');

  if (childrenData.length === 0) {
    root.innerHTML = `
      <div class="parent-head">
        <h1>
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          لوحة المتابعة
        </h1>
        <p>تابع تقدم أبنائك على المنصة</p>
      </div>

      <div class="parent-empty">
        <div class="parent-empty-icon">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
        </div>
        <h2>لسه مضفتش أبناء</h2>
        <p>ضيف ابنك برقم تليفونه عشان تتابع تقدمه في الفيديوهات والاختبارات والواجبات</p>
        <button class="child-action-btn primary" style="display:inline-flex;max-width:220px;margin:0 auto" onclick="openAddChild()">
          <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          إضافة طالب
        </button>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="parent-head">
      <h1>
        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        لوحة المتابعة
      </h1>
      <p>بتتابع <strong>${childrenData.length}</strong> ${childrenData.length === 1 ? 'طالب' : 'طلاب'} على المنصة</p>
    </div>

    <div class="children-grid">
      ${childrenData.map(c => renderChildCard(c)).join('')}
    </div>
  `;
}

/* ========== RENDER CHILD CARD ========== */
function renderChildCard(child) {
  const initial = (child.full_name || '؟').trim().charAt(0);
  const statusMap = {
    'active': { cls: 'active', label: 'مُفعّل' },
    'pending': { cls: 'pending', label: 'قيد المراجعة' },
    'suspended': { cls: 'suspended', label: 'موقوف' }
  };
  const status = statusMap[child.status] || { cls: 'pending', label: '—' };

  /* Progress = avg score percentage (rough) */
  const progress = Math.min(child.avgScore, 100);

  return `
    <div class="child-card" data-child-id="${child.id}">
      <div class="child-head">
        <div class="child-avatar">${escapeHtml(initial)}</div>
        <div class="child-info">
          <div class="child-name">${escapeHtml(child.full_name || 'طالب')}</div>
          <div class="child-meta">
            <span class="child-status ${status.cls}">${status.label}</span>
            <span class="dot"></span>
            <span>${escapeHtml(child.governorate || '—')}</span>
          </div>
        </div>
      </div>

      <div class="child-stats">
        <div class="child-stat">
          <div class="child-stat-value pink">${child.totalAttempts}</div>
          <div class="child-stat-label">اختبار</div>
        </div>
        <div class="child-stat">
          <div class="child-stat-value gold">${child.avgScore}%</div>
          <div class="child-stat-label">متوسط</div>
        </div>
        <div class="child-stat">
          <div class="child-stat-value green">${child.points || 0}</div>
          <div class="child-stat-label">نقاط</div>
        </div>
      </div>

      <div class="child-progress">
        <div class="child-progress-head">
          <span>نسبة النجاح</span>
          <span>${child.passRate}%</span>
        </div>
        <div class="child-progress-bar">
          <div class="child-progress-fill" style="width:${progress}%"></div>
        </div>
      </div>

      <div class="child-actions">
        <button class="child-action-btn primary" onclick="openChildDetails('${child.id}')">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          عرض التفاصيل
        </button>
      </div>
    </div>
  `;
}

/* ========== OPEN CHILD DETAILS ========== */
window.openChildDetails = (childId) => {
  const child = childrenData.find(c => c.id === childId);
  if (!child) return;

  document.getElementById('childDetailsTitle').textContent = `تفاصيل ${child.full_name}`;

  const body = document.getElementById('childDetailsBody');

  const recentHTML = (child.recent || []).length === 0
    ? '<div class="loading-inline" style="padding:20px">لا يوجد نشاط بعد</div>'
    : child.recent.map(a => {
        const pct = Math.round((a.score / a.total_questions) * 100);
        const passed = pct >= 60;
        return `
          <div class="activity-item">
            <div class="activity-icon ${passed ? 'pass' : 'fail'}">
              <svg viewBox="0 0 24 24">
                ${passed ? '<path d="M20 6L9 17l-5-5"/>' : '<path d="M18 6L6 18M6 6l12 12"/>'}
              </svg>
            </div>
            <div class="activity-body">
              <div class="activity-text">اختبار · ${a.score}/${a.total_questions}</div>
              <div class="activity-time">${timeAgo(a.completed_at)}</div>
            </div>
            <div class="activity-score ${passed ? 'pass' : 'fail'}">${pct}%</div>
          </div>
        `;
      }).join('');

  const minutes = Math.round((child.totalTime || 0) / 60);

  body.innerHTML = `
    <div class="details-header">
      <div class="details-avatar">${escapeHtml((child.full_name || '؟').charAt(0))}</div>
      <div class="details-info">
        <h3>${escapeHtml(child.full_name || 'طالب')}</h3>
        <p>${escapeHtml(child.email || '')}</p>
      </div>
    </div>

    <div class="details-section">
      <div class="details-section-title">الأداء العام</div>
      <div class="details-grid">
        <div class="details-item">
          <div class="details-item-label">إجمالي الاختبارات</div>
          <div class="details-item-value pink">${child.totalAttempts}</div>
        </div>
        <div class="details-item">
          <div class="details-item-label">الاختبارات الناجحة</div>
          <div class="details-item-value green">${child.passedCount}</div>
        </div>
        <div class="details-item">
          <div class="details-item-label">متوسط الدرجات</div>
          <div class="details-item-value gold">${child.avgScore}%</div>
        </div>
        <div class="details-item">
          <div class="details-item-label">نسبة النجاح</div>
          <div class="details-item-value pink">${child.passRate}%</div>
        </div>
        <div class="details-item">
          <div class="details-item-label">النقاط</div>
          <div class="details-item-value gold">${child.points || 0}</div>
        </div>
        <div class="details-item">
          <div class="details-item-label">وقت المذاكرة</div>
          <div class="details-item-value green">${minutes} د</div>
        </div>
      </div>
    </div>

    <div class="details-section">
      <div class="details-section-title">آخر النشاطات</div>
      <div class="activity-list">
        ${recentHTML}
      </div>
    </div>
  `;

  document.getElementById('modalChildDetails').classList.add('open');
};

/* ========== ADD CHILD ========== */
window.openAddChild = () => {
  document.getElementById('childPhone').value = '';
  document.getElementById('addChildError').classList.remove('show');
  document.getElementById('addChildSuccess').classList.remove('show');
  document.getElementById('modalAddChild').classList.add('open');
  setTimeout(() => document.getElementById('childPhone').focus(), 100);
};

document.getElementById('saveAddChildBtn')?.addEventListener('click', async () => {
  const phone = document.getElementById('childPhone').value.trim();
  const errBox = document.getElementById('addChildError');
  const successBox = document.getElementById('addChildSuccess');

  errBox.classList.remove('show');
  successBox.classList.remove('show');

  /* Validate phone */
  const PHONE_RE = /^01[0125]\d{8}$/;
  if (!PHONE_RE.test(phone)) {
    errBox.textContent = 'رقم تليفون غير صحيح (11 رقم، يبدأ بـ 01)';
    errBox.classList.add('show');
    return;
  }

  const btn = document.getElementById('saveAddChildBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ البحث…</span>';

  try {
    /* Find student by phone */
    const { data: students, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', phone)
      .eq('role', 'student');

    if (error) throw error;

    if (!students || students.length === 0) {
      errBox.textContent = '❌ مفيش طالب مسجل بالرقم ده. تأكد إن ابنك سجّل على المنصة بنفس الرقم.';
      errBox.classList.add('show');
      btn.disabled = false;
      btn.innerHTML = '<span>ربط الطالب</span>';
      return;
    }

    const student = students[0];

    /* Check if already linked */
    if (student.parent_id === user.id) {
      errBox.textContent = 'هذا الطالب مربوط بحسابك بالفعل';
      errBox.classList.add('show');
      btn.disabled = false;
      btn.innerHTML = '<span>ربط الطالب</span>';
      return;
    }

    /* Check if linked to another parent */
    if (student.parent_id && student.parent_id !== user.id) {
      errBox.textContent = '❌ هذا الطالب مربوط بحساب ولي أمر تاني.';
      errBox.classList.add('show');
      btn.disabled = false;
      btn.innerHTML = '<span>ربط الطالب</span>';
      return;
    }

    /* Link */
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ parent_id: user.id })
      .eq('id', student.id);

    if (updateErr) throw updateErr;

    successBox.textContent = `✅ تم ربط ${student.full_name} بحسابك بنجاح`;
    successBox.classList.add('show');

    setTimeout(() => {
      closeModal('modalAddChild');
      loadChildren();
    }, 1200);

  } catch (err) {
    console.error('[ASCEND] Add child failed:', err);
    errBox.textContent = 'تعذّر ربط الطالب. حاول تاني.';
    errBox.classList.add('show');
  }

  btn.disabled = false;
  btn.innerHTML = '<span>ربط الطالب</span>';
});

/* ========== ERROR RENDER ========== */
function renderError(msg) {
  const root = document.getElementById('contentRoot');
  root.innerHTML = `
    <div class="parent-empty">
      <div class="parent-empty-icon">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
      </div>
      <h2>${escapeHtml(msg)}</h2>
      <p>حدّث الصفحة أو حاول لاحقًا</p>
    </div>
  `;
}

/* ========== MODAL HELPERS ========== */
window.closeModal = (id) => {
  document.getElementById(id)?.classList.remove('open');
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
  }
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

/* ========== EVENTS ========== */
document.getElementById('menuToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

const logout = async () => {
  await supabase.auth.signOut();
  location.href = '/';
};

document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});

document.getElementById('logoutBtn2')?.addEventListener('click', logout);

document.getElementById('addChildBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  openAddChild();
});

/* Phone input filter */
document.getElementById('childPhone')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
});

/* ========== INIT ========== */
(async function init() {
  await loadProfile();
  await loadChildren();
})();