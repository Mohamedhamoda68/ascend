// ============================================
// ASCEND · Library Page
// ============================================
import { supabase } from './supabase.js';
import { escapeHtml, toast } from './utils.js';

/* ========== AUTH ========== */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

const root = document.getElementById('libRoot');

/* ========== STATE ========== */
let allFiles = [];
let allSubjects = [];
let currentFilter = 'all';

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
  } catch (e) { console.error(e); }
}

/* ========== FORMAT HELPERS ========== */
function formatSize(bytes) {
  if (!bytes) return '—';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
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

/* ========== LOAD ========== */
async function loadLibrary() {
  try {
    /* المواد */
    const { data: subjects } = await supabase
      .from('subjects')
      .select('id, name, color')
      .order('id');
    allSubjects = subjects || [];

    /* الملفات */
    const { data: files, error } = await supabase
      .from('library')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    allFiles = files || [];

    render();
  } catch (err) {
    console.error('[ASCEND] Library load failed:', err);
    root.innerHTML = `
      <div class="legend-lib-empty">
        <div class="legend-lib-empty-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        </div>
        <h2>تعذّر تحميل المكتبة</h2>
        <p>حدّث الصفحة أو حاول لاحقًا</p>
      </div>
    `;
  }
}

/* ========== RENDER ========== */
function render() {
  let filtered = allFiles;
  if (currentFilter !== 'all') {
    filtered = allFiles.filter(f => f.subject_id === currentFilter);
  }

  const subjectsWithFiles = allSubjects.filter(s =>
    allFiles.some(f => f.subject_id === s.id)
  );

  root.innerHTML = `
    <div class="legend-lib-header">
      <h1>
        <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
        المكتبة
      </h1>
      <p>الملازم والمراجعات والملفات التعليمية — كلها في مكان واحد</p>
    </div>

    ${subjectsWithFiles.length > 0 ? `
      <div class="legend-lib-filters">
        <button class="legend-lib-filter ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">
          <span class="dot" style="--filter-color:#10B981"></span>
          الكل (${allFiles.length})
        </button>
        ${subjectsWithFiles.map(s => `
          <button class="legend-lib-filter ${currentFilter === s.id ? 'active' : ''}" data-filter="${s.id}">
            <span class="dot" style="--filter-color:${escapeHtml(s.color || '#3B82F6')}"></span>
            ${escapeHtml(s.name)} (${allFiles.filter(f => f.subject_id === s.id).length})
          </button>
        `).join('')}
      </div>
    ` : ''}

    ${filtered.length === 0 ? `
      <div class="legend-lib-empty">
        <div class="legend-lib-empty-icon">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
        </div>
        <h2>${currentFilter === 'all' ? 'المكتبة فاضية' : 'مفيش ملفات في المادة دي'}</h2>
        <p>هيتم إضافة الملفات قريبًا — تابعنا!</p>
      </div>
    ` : `
      <div class="legend-lib-grid">
        ${filtered.map(f => renderCard(f)).join('')}
      </div>
    `}
  `;

  /* Filters */
  document.querySelectorAll('.legend-lib-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.filter;
      currentFilter = val === 'all' ? 'all' : parseInt(val, 10);
      render();
    });
  });
}

/* ========== CARD ========== */
function renderCard(file) {
  const subject = allSubjects.find(s => s.id === file.subject_id);
  const accent = subject?.color || '#3B82F6';

  return `
    <div class="legend-pdf-card" style="--pdf-accent:${escapeHtml(accent)}">
      <div class="legend-pdf-top">
        <div class="legend-pdf-icon">
          <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M9 15v-3h2a1 1 0 011 1v1a1 1 0 01-1 1H9zM14 15v-3h3M14 13.5h2"/></svg>
        </div>
        <div class="legend-pdf-body">
          <div class="legend-pdf-title">${escapeHtml(file.title)}</div>
          ${subject ? `<span class="legend-pdf-subject">${escapeHtml(subject.name)}</span>` : ''}
        </div>
      </div>

      ${file.description ? `<div class="legend-pdf-desc">${escapeHtml(file.description)}</div>` : ''}

      <div class="legend-pdf-meta">
        ${file.file_size ? `
          <span class="legend-pdf-meta-item">
            <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
            ${formatSize(file.file_size)}
          </span>
        ` : ''}
        <span class="legend-pdf-meta-item">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          ${timeAgo(file.created_at)}
        </span>
        <span class="legend-pdf-meta-item">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          ${file.downloads || 0}
        </span>
      </div>

      <div class="legend-pdf-actions">
        <a href="${escapeHtml(file.file_url)}" target="_blank" rel="noopener" class="legend-pdf-btn" data-download="${file.id}">
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
          تحميل
        </a>
        <a href="${escapeHtml(file.file_url)}" target="_blank" rel="noopener" class="legend-pdf-btn secondary" title="عرض">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </a>
      </div>
    </div>
  `;
}

/* ========== TRACK DOWNLOAD ============ */
async function trackDownload(id) {
  try {
    const file = allFiles.find(f => f.id === id);
    if (!file) return;
    const newCount = (file.downloads || 0) + 1;
    await supabase.from('library').update({ downloads: newCount }).eq('id', id);
    file.downloads = newCount;
  } catch (e) { console.warn(e); }
}

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-download]');
  if (!btn) return;
  const id = parseInt(btn.dataset.download, 10);
  if (id) trackDownload(id);
});

/* ========== INIT ========== */
initTheme();
loadProfile();
loadLibrary();