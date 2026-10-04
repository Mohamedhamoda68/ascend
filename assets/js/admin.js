// ============================================
// ASCEND · Admin Panel (Complete)
// Students + Parents + Photo Questions
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { $, $$, escapeHtml, toast } from './utils.js';

/* ============================================
   AUTH GUARD
   ============================================ */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

const { data: myProfile, error: profileErr } = await supabase
  .from('profiles').select('full_name, role').eq('id', user.id).single();

if (profileErr || myProfile?.role !== 'admin') {
  toast('غير مصرّح بالدخول', 'error');
  setTimeout(() => location.href = '/dashboard.html', 1200);
  throw new Error('Not admin');
}

document.getElementById('adminName').textContent = myProfile.full_name || 'المشرف';
document.getElementById('adminAvatar').textContent = (myProfile.full_name || '؟').trim().charAt(0);

/* ============================================
   GLOBAL STATE
   ============================================ */
let studentsCache = [];
let parentsCache = [];
let subjectsCache = [];
let currentChapterSubject = null;
let uploadedQuestionImageUrl = null;

/* ============================================
   TABS
   ============================================ */
const TAB_TITLES = {
  overview: 'لوحة التحكم',
  students: 'الطلاب',
  parents: 'أولياء الأمور',
  subjects: 'المواد والمدرسين',
  chapters: 'الفصول والدروس',
  videos: 'الفيديوهات',
  library: 'المكتبة',
  quizzes: 'الاختبارات',
  homework: 'الواجبات',
  teachers: 'المدرسين',
  notifications: 'الإشعارات',
  certificates: 'الشهادات'
};

$$('.sidebar-link[data-tab]').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    $$('.sidebar-link[data-tab]').forEach(t => t.classList.remove('active'));
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`panel-${target}`)?.classList.add('active');
    document.getElementById('pageTitle').textContent = TAB_TITLES[target] || '';

    // قفل القائمة الجانبية على الموبايل
    const sidebarEl = document.getElementById('sidebar');
    sidebarEl?.classList.remove('open', 'active', 'show');

    if (target === 'students') loadStudents();
    if (target === 'parents') loadParents();
    if (target === 'teachers') loadTeachers();
    if (target === 'videos') loadVideos();
    if (target === 'subjects') loadSubjectsAdmin();
    if (target === 'chapters') loadChaptersAdmin();
    if (target === 'library') loadLibraryAdmin();
    if (target === 'quizzes') loadQuizzesAdmin();
    if (target === 'homework') loadHomeworkAdmin();
    if (target === 'notifications') loadSentNotifications();
    if (target === 'certificates') loadCertificatesAdmin();
    if (target === 'overview') loadStats();
  });
});

/* ============================================
   OVERVIEW STATS
   ============================================ */
async function loadStats() {
  const [students, parents, pending, videos] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'parent'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('videos').select('*', { count: 'exact', head: true })
  ]);

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
  el('statStudents', students.count ?? 0);
  el('statParents', parents.count ?? 0);
  el('statPending', pending.count ?? 0);
  el('statVideos', videos.count ?? 0);
}

/* ============================================
   STUDENTS
   ============================================ */
async function loadStudents() {
  const tbody = document.getElementById('studentsBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-inline">جاري التحميل…</td></tr>';

  const { data, error } = await supabase
    .from('profiles').select('*').eq('role', 'student')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="color:#F85149">تعذّر التحميل</td></tr>';
    return;
  }

  studentsCache = data || [];
  renderStudentsTable(studentsCache);
}

async function renderStudentsTable(list) {
  const tbody = document.getElementById('studentsBody');

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">لا يوجد طلاب</div></td></tr>';
    return;
  }

  const parentIds = [...new Set(list.filter(s => s.parent_id).map(s => s.parent_id))];
  let parentMap = {};
  if (parentIds.length > 0) {
    const { data: parents } = await supabase
      .from('profiles').select('id, full_name').in('id', parentIds);
    (parents || []).forEach(p => { parentMap[p.id] = p.full_name; });
  }

  tbody.innerHTML = list.map(s => {
    const statusPill = {
      'active': '<span class="pill pill-success">مُفعّل</span>',
      'pending': '<span class="pill pill-warning">قيد المراجعة</span>',
      'suspended': '<span class="pill pill-danger">موقوف</span>'
    }[s.status] || '<span class="pill pill-neutral">—</span>';

    const parentCell = s.parent_id && parentMap[s.parent_id]
      ? `<span class="pill pill-accent">${escapeHtml(parentMap[s.parent_id])}</span>`
      : '<span class="cell-muted" style="font-size:11.5px">—</span>';

    return `
      <tr>
        <td class="cell-name">${escapeHtml(s.full_name || '—')}</td>
        <td class="cell-muted">${escapeHtml(s.email || '—')}</td>
        <td class="cell-muted">${escapeHtml(s.phone || '—')}</td>
        <td class="cell-muted">${escapeHtml(s.governorate || '—')}</td>
        <td>${parentCell}</td>
        <td>${statusPill}</td>
        <td>
          <div class="row-actions">
            ${s.status !== 'active' ? `
              <button class="row-btn" title="تفعيل" onclick="toggleStudent('${s.id}','active')">
                <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </button>` : ''}
            ${s.status !== 'suspended' ? `
              <button class="row-btn danger" title="إيقاف" onclick="toggleStudent('${s.id}','suspended')">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
              </button>` : ''}
            <button class="row-btn danger" title="حذف" onclick="deleteStudent('${s.id}')">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.toggleStudent = async (id, newStatus) => {
  const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
  if (error) { toast('تعذّر التحديث', 'error'); return; }
  toast(newStatus === 'active' ? 'تم التفعيل ✅' : 'تم الإيقاف', 'success');
  loadStudents(); loadStats();
};

window.deleteStudent = async (id) => {
  if (!confirm('متأكد من حذف هذا الطالب؟')) return;
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) { toast('تعذّر الحذف', 'error'); return; }
  toast('تم الحذف', 'success');
  loadStudents(); loadStats();
};

/* ============================================
   PARENTS
   ============================================ */
async function loadParents() {
  const tbody = document.getElementById('parentsBody');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-inline">جاري التحميل…</td></tr>';

  const { data, error } = await supabase
    .from('profiles').select('*').eq('role', 'parent')
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state" style="color:#F85149">تعذّر التحميل</td></tr>';
    return;
  }

  const parentIds = (data || []).map(p => p.id);
  let childCount = {};
  if (parentIds.length > 0) {
    const { data: children } = await supabase
      .from('profiles').select('parent_id').in('parent_id', parentIds);
    (children || []).forEach(c => {
      childCount[c.parent_id] = (childCount[c.parent_id] || 0) + 1;
    });
  }

  parentsCache = (data || []).map(p => ({ ...p, childrenCount: childCount[p.id] || 0 }));
  renderParentsTable(parentsCache);
}

function renderParentsTable(list) {
  const tbody = document.getElementById('parentsBody');

  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state">لا يوجد أولياء أمور</div></td></tr>';
    return;
  }

  tbody.innerHTML = list.map(p => {
    const statusPill = {
      'active': '<span class="pill pill-success">مُفعّل</span>',
      'pending': '<span class="pill pill-warning">قيد المراجعة</span>',
      'suspended': '<span class="pill pill-danger">موقوف</span>'
    }[p.status] || '<span class="pill pill-neutral">—</span>';

    const childrenBadge = p.childrenCount > 0
      ? `<span class="pill pill-accent">${p.childrenCount} ${p.childrenCount === 1 ? 'طالب' : 'طلاب'}</span>`
      : '<span class="cell-muted" style="font-size:11.5px">لا يوجد</span>';

    return `
      <tr>
        <td class="cell-name">${escapeHtml(p.full_name || '—')}</td>
        <td class="cell-muted">${escapeHtml(p.email || '—')}</td>
        <td class="cell-muted">${escapeHtml(p.phone || '—')}</td>
        <td class="cell-muted">${escapeHtml(p.governorate || '—')}</td>
        <td>${childrenBadge}</td>
        <td>${statusPill}</td>
        <td>
          <div class="row-actions">
            ${p.status !== 'active' ? `
              <button class="row-btn" title="تفعيل" onclick="toggleParent('${p.id}','active')">
                <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
              </button>` : ''}
            ${p.status !== 'suspended' ? `
              <button class="row-btn danger" title="إيقاف" onclick="toggleParent('${p.id}','suspended')">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>
              </button>` : ''}
            <button class="row-btn danger" title="حذف" onclick="deleteParent('${p.id}')">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.toggleParent = async (id, newStatus) => {
  const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
  if (error) { toast('تعذّر التحديث', 'error'); return; }
  toast(newStatus === 'active' ? 'تم التفعيل ✅' : 'تم الإيقاف', 'success');
  loadParents(); loadStats();
};

window.deleteParent = async (id) => {
  if (!confirm('متأكد من حذف هذا الحساب؟ سيتم فصل أولاده.')) return;
  const { error } = await supabase.from('profiles').delete().eq('id', id);
  if (error) { toast('تعذّر الحذف', 'error'); return; }
  toast('تم الحذف', 'success');
  loadParents(); loadStats();
};

/* ============================================
   SUBJECTS + TEACHERS
   ============================================ */
async function loadSubjectsAdmin() {
  const grid = document.getElementById('subjectsAdminGrid');
  grid.innerHTML = '<div class="loading-inline">جاري التحميل…</div>';

  const { data, error } = await supabase
    .from('subjects').select('*, teachers(id, name)').order('id');

  if (error || !data) {
    grid.innerHTML = '<div class="empty-state" style="color:#F85149">تعذّر التحميل</div>';
    return;
  }

  subjectsCache = data;

  grid.innerHTML = data.map(s => {
    const teachers = s.teachers || [];
    return `
      <div class="stat-card" style="margin-bottom:12px">
        <div class="stat-card-head">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:36px;height:36px;border-radius:10px;background:${escapeHtml(s.color)}20;border:1px solid ${escapeHtml(s.color)}40;display:grid;place-items:center;color:${escapeHtml(s.color)};font-weight:700;font-size:16px">${escapeHtml(s.name.charAt(0))}</div>
            <div>
              <div style="font-size:14px;color:var(--fg);font-weight:600">${escapeHtml(s.name)}</div>
              <div class="cell-muted" style="font-size:12px">${teachers.length} مدرس</div>
            </div>
          </div>
          <button class="row-btn" onclick="openAddTeacher(${s.id})" title="إضافة مدرس">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:6px">
          ${teachers.length === 0
            ? '<span class="cell-muted" style="font-size:12px">لا يوجد مدرسون</span>'
            : teachers.map(t => `
                <span class="pill pill-neutral">
                  ${escapeHtml(t.name)}
                  <button onclick="removeTeacher(${t.id})" style="margin-right:6px;color:var(--fg-4);background:none;border:none;cursor:pointer;font-size:16px;line-height:1">×</button>
                </span>
              `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

window.removeTeacher = async (id) => {
  if (!confirm('إزالة هذا المدرس؟')) return;
  const { error } = await supabase.from('teachers').delete().eq('id', id);
  if (error) { toast('تعذّر الإزالة', 'error'); return; }
  toast('تمت الإزالة', 'success');
  loadSubjectsAdmin();
};

async function loadTeachers() {
  const tbody = document.getElementById('teachersBody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-inline">جاري التحميل…</td></tr>';

  const { data, error } = await supabase
    .from('teachers').select('*, subjects(name, color)').order('subject_id');

  if (error || !data) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state" style="color:#F85149">تعذّر التحميل</td></tr>';
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">لا يوجد مدرسون</div></td></tr>';
    return;
  }

  tbody.innerHTML = data.map(t => `
    <tr>
      <td class="cell-name">${escapeHtml(t.name)}</td>
      <td>
        <span class="pill pill-neutral" style="background:${escapeHtml(t.subjects?.color || '#7C5CFF')}20;color:${escapeHtml(t.subjects?.color || '#7C5CFF')}">
          ${escapeHtml(t.subjects?.name || '—')}
        </span>
      </td>
      <td class="cell-muted">${escapeHtml(t.bio || '—')}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn danger" onclick="removeTeacher(${t.id})" title="حذف">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.openAddTeacher = (subjectId) => {
  document.getElementById('teacherSubjectId').value = subjectId;
  document.getElementById('teacherName').value = '';
  document.getElementById('teacherBio').value = '';
  document.getElementById('modalTeacher').classList.add('open');
  setTimeout(() => document.getElementById('teacherName').focus(), 100);
};

document.getElementById('saveTeacherBtn')?.addEventListener('click', async () => {
  const subjectId = parseInt(document.getElementById('teacherSubjectId').value, 10);
  const name = document.getElementById('teacherName').value.trim();
  const bio = document.getElementById('teacherBio').value.trim();
  const err = document.getElementById('teacherError');
  err.classList.remove('show');

  if (!name || name.length < 2) {
    err.textContent = 'اسم المدرس مطلوب';
    err.classList.add('show');
    return;
  }

  const btn = document.getElementById('saveTeacherBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ الحفظ…</span>';

  const { error } = await supabase.from('teachers').insert({ subject_id: subjectId, name, bio });

  btn.disabled = false;
  btn.innerHTML = '<span>حفظ</span>';

  if (error) { err.textContent = error.message; err.classList.add('show'); return; }

  toast('تم إضافة المدرس ✅', 'success');
  closeModal('modalTeacher');
  loadSubjectsAdmin();
  loadTeachers();
});

/* ============================================
   CHAPTERS + LESSONS
   ============================================ */
async function loadChaptersAdmin() {
  const picker = document.getElementById('chaptersSubjectPicker');
  picker.innerHTML = '<div class="loading-inline">جاري التحميل…</div>';

  if (subjectsCache.length === 0) {
    const { data } = await supabase.from('subjects').select('*').order('id');
    subjectsCache = data || [];
  }

  picker.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${subjectsCache.map(s => `
        <button class="btn ${currentChapterSubject?.id === s.id ? 'btn-primary' : 'btn-ghost'}"
                onclick="selectChapterSubject(${s.id})">
          ${escapeHtml(s.name)}
        </button>
      `).join('')}
    </div>
  `;

  if (currentChapterSubject) {
    loadChaptersForSubject(currentChapterSubject.id);
  }
}

window.selectChapterSubject = (id) => {
  currentChapterSubject = subjectsCache.find(s => s.id === id);
  loadChaptersAdmin();
};

async function loadChaptersForSubject(subjectId) {
  const content = document.getElementById('chaptersContent');
  const list = document.getElementById('chaptersList');
  content.style.display = 'block';
  document.getElementById('chaptersContentTitle').textContent = `فصول ${currentChapterSubject.name}`;

  list.innerHTML = '<div class="loading-inline">جاري التحميل…</div>';

  const { data, error } = await supabase
    .from('chapters')
    .select('id, title, "order", lessons(id, title, "order")')
    .eq('subject_id', subjectId)
    .order('order');

  if (error || !data) {
    list.innerHTML = '<div class="empty-state" style="color:#F85149">تعذّر التحميل</div>';
    return;
  }

  if (data.length === 0) {
    list.innerHTML = '<div class="empty-state">لا يوجد فصول في هذه المادة</div>';
    return;
  }

  list.innerHTML = data.map((ch, idx) => {
    const lessons = (ch.lessons || []).sort((a, b) => (a.order || 0) - (b.order || 0));
    return `
      <div class="stat-card" style="margin-bottom:12px">
        <div class="stat-card-head">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;border-radius:8px;background:rgba(124,92,255,0.15);border:1px solid rgba(124,92,255,0.3);display:grid;place-items:center;color:var(--accent-fg);font-weight:700">${idx + 1}</div>
            <div>
              <div style="font-size:14px;color:var(--fg);font-weight:600">${escapeHtml(ch.title)}</div>
              <div class="cell-muted" style="font-size:12px">${lessons.length} درس</div>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="row-btn" onclick="openAddLesson(${ch.id})" title="إضافة درس">
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button class="row-btn danger" onclick="deleteChapter(${ch.id})" title="حذف الفصل">
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
            </button>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px">
          ${lessons.length === 0
            ? '<span class="cell-muted" style="font-size:12px">لا يوجد دروس</span>'
            : lessons.map((l, i) => `
                <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg);border-radius:8px">
                  <span class="cell-muted" style="font-size:12px;min-width:24px">${i + 1}.</span>
                  <span style="flex:1;font-size:13px;color:var(--fg-2)">${escapeHtml(l.title)}</span>
                  <button class="row-btn danger" onclick="deleteLesson(${l.id})" title="حذف">
                    <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              `).join('')
          }
        </div>
      </div>
    `;
  }).join('');
}

window.openAddChapter = () => {
  if (!currentChapterSubject) { toast('اختر مادة أولًا', 'info'); return; }
  document.getElementById('chapterSubjectId').value = currentChapterSubject.id;
  document.getElementById('chapterTitle').value = '';
  document.getElementById('modalChapter').classList.add('open');
  setTimeout(() => document.getElementById('chapterTitle').focus(), 100);
};

document.getElementById('saveChapterBtn')?.addEventListener('click', async () => {
  const subjectId = parseInt(document.getElementById('chapterSubjectId').value, 10);
  const title = document.getElementById('chapterTitle').value.trim();
  const err = document.getElementById('chapterError');
  err.classList.remove('show');

  if (!title || title.length < 2) {
    err.textContent = 'اسم الفصل مطلوب';
    err.classList.add('show');
    return;
  }

  const { count } = await supabase
    .from('chapters').select('*', { count: 'exact', head: true }).eq('subject_id', subjectId);

  const { error } = await supabase.from('chapters').insert({
    subject_id: subjectId, title, order: (count || 0) + 1
  });

  if (error) { err.textContent = error.message; err.classList.add('show'); return; }

  toast('تم إضافة الفصل ✅', 'success');
  closeModal('modalChapter');
  loadChaptersForSubject(subjectId);
});

window.deleteChapter = async (id) => {
  if (!confirm('حذف هذا الفصل وكل دروسه؟')) return;
  const { error } = await supabase.from('chapters').delete().eq('id', id);
  if (error) { toast('تعذّر الحذف', 'error'); return; }
  toast('تم الحذف', 'success');
  if (currentChapterSubject) loadChaptersForSubject(currentChapterSubject.id);
};

window.openAddLesson = (chapterId) => {
  document.getElementById('lessonChapterId').value = chapterId;
  document.getElementById('lessonTitle').value = '';
  document.getElementById('modalLesson').classList.add('open');
  setTimeout(() => document.getElementById('lessonTitle').focus(), 100);
};

document.getElementById('saveLessonBtn')?.addEventListener('click', async () => {
  const chapterId = parseInt(document.getElementById('lessonChapterId').value, 10);
  const title = document.getElementById('lessonTitle').value.trim();
  const err = document.getElementById('lessonError');
  err.classList.remove('show');

  if (!title || title.length < 2) {
    err.textContent = 'اسم الدرس مطلوب';
    err.classList.add('show');
    return;
  }

  const { count } = await supabase
    .from('lessons').select('*', { count: 'exact', head: true }).eq('chapter_id', chapterId);

  const { error } = await supabase.from('lessons').insert({
    chapter_id: chapterId, title, order: (count || 0) + 1
  });

  if (error) { err.textContent = error.message; err.classList.add('show'); return; }

  toast('تم إضافة الدرس ✅', 'success');
  closeModal('modalLesson');
  if (currentChapterSubject) loadChaptersForSubject(currentChapterSubject.id);
});

window.deleteLesson = async (id) => {
  if (!confirm('حذف هذا الدرس؟')) return;
  const { error } = await supabase.from('lessons').delete().eq('id', id);
  if (error) { toast('تعذّر الحذف', 'error'); return; }
  toast('تم الحذف', 'success');
  if (currentChapterSubject) loadChaptersForSubject(currentChapterSubject.id);
};

/* ============================================
   VIDEOS
   ============================================ */
async function loadVideos() {
  const tbody = document.getElementById('videosBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-inline">جاري التحميل…</td></tr>';

  const { data, error } = await supabase
    .from('videos')
    .select('*, teachers(name), lessons(title, chapters(title, subjects(name)))')
    .order('created_at', { ascending: false });

  if (error || !data) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="color:#F85149">تعذّر التحميل</td></tr>';
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">لا يوجد فيديوهات</div></td></tr>';
    return;
  }

  tbody.innerHTML = data.map(v => {
    const subject = v.lessons?.chapters?.subjects?.name || '—';
    const chapter = v.lessons?.chapters?.title || '—';
    const lesson = v.lessons?.title || '—';
    const teacher = v.teachers?.name
      ? escapeHtml(v.teachers.name)
      : '<span style="color:#EF4444;font-size:12px">— غير محدد —</span>';

    return `
    <tr>
      <td class="cell-name">${escapeHtml(v.title)}</td>
      <td class="cell-muted">${escapeHtml(subject)}</td>
      <td class="cell-muted">${teacher}</td>
      <td class="cell-muted">${escapeHtml(chapter)} · ${escapeHtml(lesson)}</td>
      <td class="cell-muted">${escapeHtml(v.youtube_id)}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn danger" onclick="deleteVideo(${v.id})" title="حذف">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `}).join('');
}

window.deleteVideo = async (id) => {
  if (!confirm('حذف هذا الفيديو؟')) return;
  const { error } = await supabase.from('videos').delete().eq('id', id);
  if (error) { toast('تعذّر الحذف', 'error'); return; }
  toast('تم الحذف', 'success');
  loadVideos(); loadStats();
};

window.openAddVideo = async () => {
  document.getElementById('videoTitle').value = '';
  document.getElementById('videoYoutubeId').value = '';
  document.getElementById('videoDesc').value = '';
  document.getElementById('videoError').classList.remove('show');

  const subjectSelect = document.getElementById('videoSubjectId');
  subjectSelect.innerHTML = '<option value="">— اختر مادة —</option>';

  if (subjectsCache.length === 0) {
    const { data } = await supabase.from('subjects').select('*').order('id');
    subjectsCache = data || [];
  }

  subjectsCache.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    subjectSelect.appendChild(opt);
  });

  document.getElementById('videoTeacherId').innerHTML = '<option value="">— اختر مادة أولاً —</option>';
  document.getElementById('videoLessonId').innerHTML = '<option value="">— اختر مادة أولاً —</option>';

  subjectSelect.onchange = async () => {
    const subjectId = parseInt(subjectSelect.value, 10);
    const teacherSelect = document.getElementById('videoTeacherId');
    const lessonSelect = document.getElementById('videoLessonId');

    if (!subjectId) {
      teacherSelect.innerHTML = '<option value="">— اختر مادة أولاً —</option>';
      lessonSelect.innerHTML = '<option value="">— اختر مادة أولاً —</option>';
      return;
    }

    teacherSelect.innerHTML = '<option value="">جاري التحميل…</option>';
    const { data: teachers } = await supabase
      .from('teachers').select('id, name').eq('subject_id', subjectId).order('id');

    teacherSelect.innerHTML = '<option value="">— اختر مدرس —</option>';
    (teachers || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      teacherSelect.appendChild(opt);
    });

    lessonSelect.innerHTML = '<option value="">جاري التحميل…</option>';
    const { data: chapters } = await supabase
      .from('chapters')
      .select('id, title, "order", lessons(id, title, "order")')
      .eq('subject_id', subjectId)
      .order('order');

    lessonSelect.innerHTML = '<option value="">— اختر درس —</option>';
    (chapters || []).forEach(ch => {
      const lessons = (ch.lessons || []).sort((a, b) => (a.order || 0) - (b.order || 0));
      lessons.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.id;
        opt.textContent = `${ch.title} · ${l.title}`;
        lessonSelect.appendChild(opt);
      });
    });
  };

  document.getElementById('modalVideo').classList.add('open');
};

document.getElementById('saveVideoBtn')?.addEventListener('click', async () => {
  const subjectId = parseInt(document.getElementById('videoSubjectId').value, 10);
  const teacherId = parseInt(document.getElementById('videoTeacherId').value, 10);
  const lessonId = parseInt(document.getElementById('videoLessonId').value, 10);
  const title = document.getElementById('videoTitle').value.trim();
  const youtubeId = document.getElementById('videoYoutubeId').value.trim();
  const description = document.getElementById('videoDesc').value.trim();
  const err = document.getElementById('videoError');
  err.classList.remove('show');

  if (!subjectId) { err.textContent = 'اختر المادة'; err.classList.add('show'); return; }
  if (!teacherId) { err.textContent = 'اختر المدرس'; err.classList.add('show'); return; }
  if (!lessonId) { err.textContent = 'اختر الدرس'; err.classList.add('show'); return; }
  if (!title) { err.textContent = 'العنوان مطلوب'; err.classList.add('show'); return; }
  if (!youtubeId || youtubeId.length !== 11) { err.textContent = 'YouTube ID لازم 11 حرف'; err.classList.add('show'); return; }

  const btn = document.getElementById('saveVideoBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ الحفظ…</span>';

  const { error } = await supabase.from('videos').insert({
    lesson_id: lessonId,
    teacher_id: teacherId,
    title,
    youtube_id: youtubeId,
    description
  });

  btn.disabled = false;
  btn.innerHTML = '<span>حفظ</span>';

  if (error) { err.textContent = error.message; err.classList.add('show'); return; }

  toast('تم إضافة الفيديو ✅', 'success');
  closeModal('modalVideo');
  loadVideos(); loadStats();
});

/* ============================================
   LIBRARY (PDF)
   ============================================ */
async function loadLibraryAdmin() {
  const tbody = document.getElementById('libraryBody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading-inline">جاري التحميل…</td></tr>';

  const { data, error } = await supabase
    .from('library').select('*, subjects(name)').order('created_at', { ascending: false });

  if (error || !data) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state" style="color:#F85149">تعذّر التحميل</td></tr>';
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state">لا يوجد ملفات PDF</div></td></tr>';
    return;
  }

  tbody.innerHTML = data.map(f => `
    <tr>
      <td class="cell-name">${escapeHtml(f.title)}</td>
      <td class="cell-muted">${escapeHtml(f.subjects?.name || '—')}</td>
      <td class="cell-muted">${f.file_size ? (f.file_size / 1024 / 1024).toFixed(2) + ' MB' : '—'}</td>
      <td class="cell-muted">${f.downloads || 0}</td>
      <td>
        <div class="row-actions">
          <a href="${escapeHtml(f.file_url)}" target="_blank" class="row-btn" title="عرض">
            <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </a>
          <button class="row-btn danger" onclick="deletePdf(${f.id})" title="حذف">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.deletePdf = async (id) => {
  if (!confirm('حذف هذا الملف؟')) return;
  const { error } = await supabase.from('library').delete().eq('id', id);
  if (error) { toast('تعذّر الحذف', 'error'); return; }
  toast('تم الحذف', 'success');
  loadLibraryAdmin();
};

window.openAddPdf = async () => {
  document.getElementById('pdfTitle').value = '';
  document.getElementById('pdfDescription').value = '';
  document.getElementById('pdfFile').value = '';
  document.getElementById('pdfError').classList.remove('show');
  document.getElementById('pdfProgress').style.display = 'none';

  const select = document.getElementById('pdfSubject');
  select.innerHTML = '<option value="">— اختر مادة —</option>';

  if (subjectsCache.length === 0) {
    const { data } = await supabase.from('subjects').select('*').order('id');
    subjectsCache = data || [];
  }

  subjectsCache.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    select.appendChild(opt);
  });

  document.getElementById('modalPdf').classList.add('open');
};

document.getElementById('savePdfBtn')?.addEventListener('click', async () => {
  const subjectId = parseInt(document.getElementById('pdfSubject').value, 10);
  const title = document.getElementById('pdfTitle').value.trim();
  const description = document.getElementById('pdfDescription').value.trim();
  const file = document.getElementById('pdfFile').files[0];
  const err = document.getElementById('pdfError');
  err.classList.remove('show');

  if (!subjectId) { err.textContent = 'اختر المادة'; err.classList.add('show'); return; }
  if (!title) { err.textContent = 'العنوان مطلوب'; err.classList.add('show'); return; }
  if (!file) { err.textContent = 'اختر ملف PDF'; err.classList.add('show'); return; }
  if (file.size > 50 * 1024 * 1024) { err.textContent = 'حجم الملف كبير (حد أقصى 50 MB)'; err.classList.add('show'); return; }

  const btn = document.getElementById('savePdfBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ الرفع…</span>';

  const progressWrap = document.getElementById('pdfProgress');
  progressWrap.style.display = 'block';

  try {
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const { error: uploadErr } = await supabase.storage
      .from('library-files').upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage.from('library-files').getPublicUrl(fileName);

    const { error: insertErr } = await supabase.from('library').insert({
      subject_id: subjectId, title, description,
      file_url: urlData.publicUrl, file_size: file.size
    });

    if (insertErr) throw insertErr;

    toast('تم رفع الملف ✅', 'success');
    closeModal('modalPdf');
    loadLibraryAdmin();
  } catch (e) {
    console.error(e);
    err.textContent = e.message || 'تعذّر الرفع';
    err.classList.add('show');
  }

  btn.disabled = false;
  btn.innerHTML = '<span>رفع الملف</span>';
  progressWrap.style.display = 'none';
});

/* ============================================
   QUIZZES
   ============================================ */
async function loadQuizzesAdmin() {
  const tbody = document.getElementById('quizzesBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-inline">جاري التحميل…</td></tr>';

  const { data, error } = await supabase
    .from('quizzes')
    .select('*, lessons(title), questions(id)')
    .order('created_at', { ascending: false });

  if (error || !data) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state" style="color:#F85149">تعذّر التحميل</td></tr>';
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">لا يوجد اختبارات</div></td></tr>';
    return;
  }

  tbody.innerHTML = data.map(q => `
    <tr>
      <td class="cell-name">${escapeHtml(q.title)}</td>
      <td class="cell-muted">${escapeHtml(q.lessons?.title || '—')}</td>
      <td class="cell-muted">${(q.questions || []).length}</td>
      <td class="cell-muted">${q.time_limit_minutes || 10} د</td>
      <td class="cell-muted">${q.passing_score || 60}%</td>
      <td>
        <div class="row-actions">
          <button class="row-btn" onclick="openAddQuestion(${q.id})" title="إضافة سؤال">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button class="row-btn danger" onclick="deleteQuiz(${q.id})" title="حذف">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.deleteQuiz = async (id) => {
  if (!confirm('حذف هذا الاختبار وكل أسئلته؟')) return;
  const { error } = await supabase.from('quizzes').delete().eq('id', id);
  if (error) { toast('تعذّر الحذف', 'error'); return; }
  toast('تم الحذف', 'success');
  loadQuizzesAdmin();
};

window.openAddQuiz = async () => {
  document.getElementById('quizTitle').value = '';
  document.getElementById('quizDescription').value = '';
  document.getElementById('quizTime').value = 10;
  document.getElementById('quizPass').value = 60;
  document.getElementById('quizError').classList.remove('show');
  document.getElementById('modalQuiz').classList.add('open');
  await loadLessonsIntoSelect('#quizLessonId');
};

document.getElementById('saveQuizBtn')?.addEventListener('click', async () => {
  const lessonId = parseInt(document.getElementById('quizLessonId').value, 10);
  const title = document.getElementById('quizTitle').value.trim();
  const description = document.getElementById('quizDescription').value.trim();
  const timeLimit = parseInt(document.getElementById('quizTime').value, 10);
  const passingScore = parseInt(document.getElementById('quizPass').value, 10);
  const err = document.getElementById('quizError');
  err.classList.remove('show');

  if (!lessonId) { err.textContent = 'اختر الدرس'; err.classList.add('show'); return; }
  if (!title) { err.textContent = 'العنوان مطلوب'; err.classList.add('show'); return; }

  const btn = document.getElementById('saveQuizBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ الحفظ…</span>';

  const { error } = await supabase.from('quizzes').insert({
    lesson_id: lessonId, title, description,
    time_limit_minutes: timeLimit, passing_score: passingScore
  });

  btn.disabled = false;
  btn.innerHTML = '<span>حفظ</span>';

  if (error) { err.textContent = error.message; err.classList.add('show'); return; }

  toast('تم إضافة الاختبار ✅', 'success');
  closeModal('modalQuiz');
  loadQuizzesAdmin();
});

/* ============================================
   ADD QUESTION (PHOTO-FIRST)
   ============================================ */
window.openAddQuestion = (quizId) => {
  document.getElementById('questionQuizId').value = quizId;
  document.getElementById('questionText').value = '';
  document.getElementById('questionImage').value = '';
  document.getElementById('qOptionA').value = '';
  document.getElementById('qOptionB').value = '';
  document.getElementById('qOptionC').value = '';
  document.getElementById('qOptionD').value = '';
  document.getElementById('qCorrect').value = 'a';
  document.getElementById('questionError').classList.remove('show');

  uploadedQuestionImageUrl = null;
  document.getElementById('questionImagePreview').style.display = 'none';
  document.getElementById('questionImagePreviewImg').src = '';
  document.getElementById('questionImageDropContent').style.display = 'block';

  document.querySelectorAll('.answer-choice').forEach(b => b.classList.remove('selected'));
  const firstBtn = document.querySelector('.answer-choice[data-answer="a"]');
  if (firstBtn) firstBtn.classList.add('selected');

  document.getElementById('modalQuestion').classList.add('open');
};

document.querySelectorAll('.answer-choice').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.answer-choice').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    document.getElementById('qCorrect').value = btn.dataset.answer;
  });
});

document.getElementById('questionImageFile')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  await handleImageUpload(file);
  e.target.value = '';
});

const dropZone = document.getElementById('questionImageDrop');
if (dropZone) {
  dropZone.addEventListener('click', () => {
    document.getElementById('questionImageFile').click();
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      await handleImageUpload(file);
    }
  });
}

async function handleImageUpload(file) {
  if (file.size > 5 * 1024 * 1024) {
    toast('حجم الصورة كبير (5 MB max)', 'error');
    return;
  }

  const uploadingEl = document.getElementById('questionImageUploading');
  if (uploadingEl) uploadingEl.style.display = 'block';

  try {
    const ext = file.name.split('.').pop().toLowerCase();
    const fileName = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('quiz-images').upload(fileName, file, { cacheControl: '3600', upsert: false });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage.from('quiz-images').getPublicUrl(fileName);
    uploadedQuestionImageUrl = urlData.publicUrl;

    document.getElementById('questionImagePreviewImg').src = uploadedQuestionImageUrl;
    document.getElementById('questionImagePreview').style.display = 'block';
    document.getElementById('questionImageDropContent').style.display = 'none';
    document.getElementById('questionImage').value = '';

    toast('تم رفع الصورة ✅', 'success');
  } catch (err) {
    console.error(err);
    toast('تعذّر رفع الصورة: ' + err.message, 'error');
  } finally {
    if (uploadingEl) uploadingEl.style.display = 'none';
  }
}

document.getElementById('removeQuestionImage')?.addEventListener('click', () => {
  uploadedQuestionImageUrl = null;
  document.getElementById('questionImagePreview').style.display = 'none';
  document.getElementById('questionImageDropContent').style.display = 'block';
  document.getElementById('questionImage').value = '';
  document.getElementById('questionImagePreviewImg').src = '';
});

document.getElementById('questionImage')?.addEventListener('input', (e) => {
  const url = e.target.value.trim();
  if (url && url.startsWith('http')) {
    uploadedQuestionImageUrl = null;
    document.getElementById('questionImagePreviewImg').src = url;
    document.getElementById('questionImagePreview').style.display = 'block';
    document.getElementById('questionImageDropContent').style.display = 'none';
  } else if (!url) {
    document.getElementById('questionImagePreview').style.display = 'none';
    document.getElementById('questionImageDropContent').style.display = 'block';
  }
});

document.getElementById('saveQuestionBtn')?.addEventListener('click', async () => {
  const quizId = parseInt(document.getElementById('questionQuizId').value, 10);
  const text = document.getElementById('questionText').value.trim();
  const imageUrlInput = document.getElementById('questionImage').value.trim();
  const finalImageUrl = uploadedQuestionImageUrl || imageUrlInput || null;
  const a = document.getElementById('qOptionA').value.trim();
  const b = document.getElementById('qOptionB').value.trim();
  const c = document.getElementById('qOptionC').value.trim();
  const d = document.getElementById('qOptionD').value.trim();
  const correct = document.getElementById('qCorrect').value;
  const err = document.getElementById('questionError');
  err.classList.remove('show');

  if (!finalImageUrl && !text) {
    err.textContent = '❌ محتاج صورة أو نص السؤال';
    err.classList.add('show');
    return;
  }
  if (!a || !b || !c || !d) {
    err.textContent = '❌ كل الخيارات مطلوبة';
    err.classList.add('show');
    return;
  }

  const btn = document.getElementById('saveQuestionBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ الحفظ…</span>';

  const { count } = await supabase.from('questions')
    .select('*', { count: 'exact', head: true }).eq('quiz_id', quizId);

  const { error } = await supabase.from('questions').insert({
    quiz_id: quizId,
    question_text: text || '—',
    image_url: finalImageUrl,
    option_a: a, option_b: b, option_c: c, option_d: d,
    correct_answer: correct,
    order: (count || 0) + 1
  });

  btn.disabled = false;
  btn.innerHTML = '<span>حفظ السؤال</span>';

  if (error) { err.textContent = error.message; err.classList.add('show'); return; }

  toast('تم إضافة السؤال ✅', 'success');

  document.getElementById('questionText').value = '';
  document.getElementById('questionImage').value = '';
  document.getElementById('qOptionA').value = '';
  document.getElementById('qOptionB').value = '';
  document.getElementById('qOptionC').value = '';
  document.getElementById('qOptionD').value = '';
  document.getElementById('qCorrect').value = 'a';

  uploadedQuestionImageUrl = null;
  document.getElementById('questionImagePreview').style.display = 'none';
  document.getElementById('questionImageDropContent').style.display = 'block';
  document.getElementById('questionImagePreviewImg').src = '';

  document.querySelectorAll('.answer-choice').forEach(b => b.classList.remove('selected'));
  const firstBtn = document.querySelector('.answer-choice[data-answer="a"]');
  if (firstBtn) firstBtn.classList.add('selected');

  loadQuizzesAdmin();
});

/* ============================================
   HOMEWORK
   ============================================ */
async function loadHomeworkAdmin() {
  const tbody = document.getElementById('homeworkBody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-inline">جاري التحميل…</td></tr>';

  const { data, error } = await supabase
    .from('homework').select('*, lessons(title)').order('created_at', { ascending: false });

  if (error || !data) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state" style="color:#F85149">تعذّر التحميل</td></tr>';
    return;
  }

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">لا يوجد واجبات</div></td></tr>';
    return;
  }

  tbody.innerHTML = data.map(h => `
    <tr>
      <td class="cell-name">${escapeHtml(h.title)}</td>
      <td class="cell-muted">${escapeHtml(h.lessons?.title || '—')}</td>
      <td class="cell-muted">${h.file_url ? '✓ مرفق' : '—'}</td>
      <td>
        <div class="row-actions">
          <button class="row-btn danger" onclick="deleteHomework(${h.id})" title="حذف">
            <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.deleteHomework = async (id) => {
  if (!confirm('حذف هذا الواجب؟')) return;
  const { error } = await supabase.from('homework').delete().eq('id', id);
  if (error) { toast('تعذّر الحذف', 'error'); return; }
  toast('تم الحذف', 'success');
  loadHomeworkAdmin();
};

window.openAddHomework = async () => {
  document.getElementById('homeworkTitle').value = '';
  document.getElementById('homeworkDescription').value = '';
  document.getElementById('homeworkFile').value = '';
  document.getElementById('homeworkError').classList.remove('show');
  document.getElementById('modalHomework').classList.add('open');
  await loadLessonsIntoSelect('#homeworkLessonId');
};

document.getElementById('saveHomeworkBtn')?.addEventListener('click', async () => {
  const lessonId = parseInt(document.getElementById('homeworkLessonId').value, 10);
  const title = document.getElementById('homeworkTitle').value.trim();
  const description = document.getElementById('homeworkDescription').value.trim();
  const file = document.getElementById('homeworkFile').files[0];
  const err = document.getElementById('homeworkError');
  err.classList.remove('show');

  if (!lessonId) { err.textContent = 'اختر الدرس'; err.classList.add('show'); return; }
  if (!title) { err.textContent = 'العنوان مطلوب'; err.classList.add('show'); return; }

  const btn = document.getElementById('saveHomeworkBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ الحفظ…</span>';

  let fileUrl = null;

  if (file) {
    try {
      const fileName = `homework-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const { error: uploadErr } = await supabase.storage.from('library-files').upload(fileName, file);
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('library-files').getPublicUrl(fileName);
        fileUrl = urlData.publicUrl;
      }
    } catch (e) { console.warn(e); }
  }

  const { error } = await supabase.from('homework').insert({
    lesson_id: lessonId, title, description, file_url: fileUrl, is_active: true
  });

  btn.disabled = false;
  btn.innerHTML = '<span>حفظ</span>';

  if (error) { err.textContent = error.message; err.classList.add('show'); return; }

  toast('تم إضافة الواجب ✅', 'success');
  closeModal('modalHomework');
  loadHomeworkAdmin();
});

/* ============================================
   NOTIFICATIONS
   ============================================ */
document.getElementById('sendNotifBtn')?.addEventListener('click', async () => {
  const title = document.getElementById('notifTitle').value.trim();
  const body = document.getElementById('notifBody').value.trim();
  const type = document.getElementById('notifType').value;
  const link = document.getElementById('notifLink').value.trim();
  const toAll = document.getElementById('notifAll').checked;

  if (!title) { toast('العنوان مطلوب', 'error'); return; }

  const btn = document.getElementById('sendNotifBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ الإرسال…</span>';

  try {
    if (toAll) {
      const { error } = await supabase.from('notifications').insert({
        user_id: null, title, body, type, link_url: link || null
      });
      if (error) throw error;
    } else {
      const { data: students } = await supabase.from('profiles').select('id').eq('role', 'student');
      const rows = (students || []).map(s => ({
        user_id: s.id, title, body, type, link_url: link || null
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from('notifications').insert(rows);
        if (error) throw error;
      }
    }

    toast('تم إرسال الإشعار ✅', 'success');
    document.getElementById('notifTitle').value = '';
    document.getElementById('notifBody').value = '';
    document.getElementById('notifLink').value = '';
    loadSentNotifications();
  } catch (e) {
    console.error(e);
    toast('تعذّر الإرسال: ' + e.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '<span>إرسال الإشعار</span>';
});

async function loadSentNotifications() {
  const list = document.getElementById('sentNotificationsList');
  list.innerHTML = '<div class="loading-inline">جاري التحميل…</div>';

  const { data, error } = await supabase
    .from('notifications').select('*').is('user_id', null)
    .order('created_at', { ascending: false }).limit(20);

  if (error || !data || data.length === 0) {
    list.innerHTML = '<div class="empty-state">لا يوجد إشعارات مُرسلة</div>';
    return;
  }

  list.innerHTML = data.map(n => `
    <div class="stat-card" style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
        <div style="flex:1">
          <div style="font-size:14px;color:var(--fg);font-weight:600;margin-bottom:4px">${escapeHtml(n.title)}</div>
          <div class="cell-muted" style="font-size:13px">${escapeHtml(n.body || '—')}</div>
          <div class="cell-muted" style="font-size:11.5px;margin-top:6px">${new Date(n.created_at).toLocaleString('ar-EG')}</div>
        </div>
        <button class="row-btn danger" onclick="deleteNotification(${n.id})" title="حذف">
          <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

window.deleteNotification = async (id) => {
  if (!confirm('حذف هذا الإشعار؟')) return;
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  if (error) { toast('تعذّر الحذف', 'error'); return; }
  toast('تم الحذف', 'success');
  loadSentNotifications();
};

/* ============================================
   CERTIFICATES
   ============================================ */
async function loadCertificatesAdmin() {
  const tbody = document.getElementById('certificatesBody');
  tbody.innerHTML = '<tr><td colspan="4" class="loading-inline">جاري التحميل…</td></tr>';

  const { data: attempts } = await supabase
    .from('attempts')
    .select('user_id, score, total_questions, completed_at, profiles(full_name)')
    .eq('status', 'completed');

  if (!attempts || attempts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">لا يوجد شهادات</div></td></tr>';
    const el = document.getElementById('statCertificates');
    if (el) el.textContent = 0;
    return;
  }

  const grouped = {};
  attempts.forEach(a => {
    const name = a.profiles?.full_name || 'طالب';
    if (!grouped[name]) grouped[name] = { count: 0, total: 0, last: a.completed_at };
    grouped[name].count++;
    grouped[name].total += (a.score / a.total_questions) * 100;
    if (new Date(a.completed_at) > new Date(grouped[name].last)) grouped[name].last = a.completed_at;
  });

  const rows = Object.entries(grouped).map(([name, data]) => ({
    name, count: data.count, avg: Math.round(data.total / data.count), last: data.last
  }));

  const statEl = document.getElementById('statCertificates');
  if (statEl) statEl.textContent = rows.length;

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td class="cell-name">${escapeHtml(r.name)}</td>
      <td class="cell-muted">${r.count} اختبار</td>
      <td class="cell-muted">${r.avg}%</td>
      <td class="cell-muted">${new Date(r.last).toLocaleDateString('ar-EG')}</td>
    </tr>
  `).join('');
}

/* ============================================
   HELPER: LOAD LESSONS INTO SELECT
   ============================================ */
async function loadLessonsIntoSelect(selector) {
  const select = document.querySelector(selector);
  if (!select) return;
  select.innerHTML = '<option value="">جاري التحميل…</option>';

  const { data } = await supabase
    .from('lessons')
    .select('id, title, chapters(title, subjects(name))')
    .order('id');

  if (!data || data.length === 0) {
    select.innerHTML = '<option value="">لا يوجد دروس</option>';
    return;
  }

  select.innerHTML = '<option value="">— اختر درس —</option>' + data.map(l => `
    <option value="${l.id}">
      ${escapeHtml(l.chapters?.subjects?.name || '')} · ${escapeHtml(l.chapters?.title || '')} · ${escapeHtml(l.title)}
    </option>
  `).join('');
}

/* ============================================
   SEARCH
   ============================================ */
document.getElementById('studentSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { renderStudentsTable(studentsCache); return; }
  const filtered = studentsCache.filter(s =>
    (s.full_name || '').toLowerCase().includes(q) ||
    (s.email || '').toLowerCase().includes(q) ||
    (s.phone || '').includes(q)
  );
  renderStudentsTable(filtered);
});

document.getElementById('parentSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!q) { renderParentsTable(parentsCache); return; }
  const filtered = parentsCache.filter(p =>
    (p.full_name || '').toLowerCase().includes(q) ||
    (p.email || '').toLowerCase().includes(q) ||
    (p.phone || '').includes(q)
  );
  renderParentsTable(filtered);
});

/* ============================================
   MODAL HELPERS
   ============================================ */
window.closeModal = (id) => {
  document.getElementById(id)?.classList.remove('open');
};

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    $$('.modal-overlay').forEach(m => m.classList.remove('open'));
  }
});

$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

/* ============================================
   LOGOUT + SIDEBAR TOGGLE (محسّن)
   ============================================ */
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.href = '/';
});

const sidebarEl = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuToggle');

menuBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  sidebarEl?.classList.toggle('open');
  sidebarEl?.classList.toggle('active');
  sidebarEl?.classList.toggle('show');
});

// إغلاق عند الدوس خارج القائمة
document.addEventListener('click', (e) => {
  const isOpen = sidebarEl?.classList.contains('open')
              || sidebarEl?.classList.contains('active')
              || sidebarEl?.classList.contains('show');
  if (!isOpen) return;
  if (sidebarEl.contains(e.target)) return;
  if (menuBtn?.contains(e.target)) return;
  sidebarEl.classList.remove('open', 'active', 'show');
});

// إغلاق عند الدوس على أي رابط
document.querySelectorAll('.sidebar-link').forEach(link => {
  link.addEventListener('click', () => {
    sidebarEl?.classList.remove('open', 'active', 'show');
  });
});

// إغلاق بزر ESC
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    sidebarEl?.classList.remove('open', 'active', 'show');
  }
});

/* ============================================
   INIT
   ============================================ */
loadStats();
