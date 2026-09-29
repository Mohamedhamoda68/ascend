// ============================================
// ASCEND · Notifications
// ============================================
import { supabase } from './supabase.js';
import { escapeHtml, toast } from './utils.js';

/* ========== AUTH ========== */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

const root = document.getElementById('notifRoot');

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

/* ========== STATE ========== */
let allNotifs = [];
let currentFilter = 'all';

/* ========== ICONS ========== */
const ICONS = {
  new_video:    '<path d="M15 10l-4-2v8l4-2"/><rect x="2" y="6" width="20" height="12" rx="2"/>',
  new_quiz:     '<path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><circle cx="12" cy="12" r="10"/><path d="M12 17h.01"/>',
  new_homework: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
  certificate:  '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  success:      '<path d="M20 6L9 17l-5-5"/>',
  warning:      '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  info:         '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  system:       '<path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><circle cx="12" cy="12" r="10"/>',
  default:      '<path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>'
};

/* ========== TIME AGO ========== */
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'الآن';
  const m = Math.floor(seconds / 60);
  if (m < 60) return `منذ ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} ساعة`;
  const d = Math.floor(h / 24);
  if (d < 7) return `منذ ${d} يوم`;
  if (d < 30) return `منذ ${Math.floor(d / 7)} أسبوع`;
  if (d < 365) return `منذ ${Math.floor(d / 30)} شهر`;
  return `منذ ${Math.floor(d / 365)} سنة`;
}

/* ========== LOAD ========== */
async function loadNotifications() {
  try {
    /* إشعارات المستخدم + الإشعارات العامة (user_id = null) */
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    allNotifs = data || [];
    render();
  } catch (err) {
    console.error('[ASCEND] Notifications load failed:', err);
    root.innerHTML = `
      <div class="legend-notif-empty">
        <div class="legend-notif-empty-icon">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
        </div>
        <h2>تعذّر تحميل الإشعارات</h2>
        <p>حدّث الصفحة أو حاول مرة أخرى لاحقًا</p>
      </div>
    `;
  }
}

/* ========== RENDER ========== */
function render() {
  const unreadCount = allNotifs.filter(n => !n.is_read).length;

  let filtered = allNotifs;
  if (currentFilter === 'unread') filtered = allNotifs.filter(n => !n.is_read);
  else if (currentFilter === 'read') filtered = allNotifs.filter(n => n.is_read);

  root.innerHTML = `
    <div class="legend-notif-header">
      <h1>
        <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
        الإشعارات
        ${unreadCount > 0 ? `<span class="legend-notif-count">${unreadCount}</span>` : ''}
      </h1>
      <div class="legend-notif-actions">
        ${unreadCount > 0 ? `
          <button class="legend-notif-action" id="markAllRead">
            <svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
            تحديد الكل كمقروء
          </button>
        ` : ''}
      </div>
    </div>

    <div class="legend-notif-tabs">
      <button class="legend-notif-tab ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">
        الكل (${allNotifs.length})
      </button>
      <button class="legend-notif-tab ${currentFilter === 'unread' ? 'active' : ''}" data-filter="unread">
        غير مقروء (${unreadCount})
      </button>
      <button class="legend-notif-tab ${currentFilter === 'read' ? 'active' : ''}" data-filter="read">
        مقروء (${allNotifs.length - unreadCount})
      </button>
    </div>

    ${filtered.length === 0 ? `
      <div class="legend-notif-empty">
        <div class="legend-notif-empty-icon">
          <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
        </div>
        <h2>${currentFilter === 'all' ? 'مفيش إشعارات' : currentFilter === 'unread' ? 'مفيش إشعارات جديدة' : 'مفيش إشعارات مقروءة'}</h2>
        <p>هنبلغك أول ما يحصل أي جديد — متقلقش!</p>
      </div>
    ` : `
      <div class="legend-notif-list">
        ${filtered.map(n => renderItem(n)).join('')}
      </div>
    `}
  `;

  /* Events */
  document.querySelectorAll('.legend-notif-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentFilter = btn.dataset.filter;
      render();
    });
  });

  document.getElementById('markAllRead')?.addEventListener('click', markAllAsRead);

  document.querySelectorAll('.legend-notif-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.legend-notif-link')) return;
      const id = parseInt(item.dataset.id, 10);
      if (id) markAsRead(id);
    });
  });
}

/* ========== RENDER ITEM ========== */
function renderItem(n) {
  const type = n.type || 'default';
  const iconSvg = ICONS[type] || ICONS.default;
  const linkHref = n.link_url || null;

  return `
    <div class="legend-notif-item ${n.is_read ? '' : 'unread'}"
         data-id="${n.id}"
         data-type="${escapeHtml(type)}">
      <div class="legend-notif-icon">
        <svg viewBox="0 0 24 24">${iconSvg}</svg>
      </div>
      <div class="legend-notif-body">
        <div class="legend-notif-title">
          ${!n.is_read ? '<span class="dot-new"></span>' : ''}
          ${escapeHtml(n.title || 'إشعار')}
        </div>
        ${n.body ? `<div class="legend-notif-text">${escapeHtml(n.body)}</div>` : ''}
        <div class="legend-notif-time">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          ${timeAgo(n.created_at)}
        </div>
        ${linkHref ? `
          <a href="${escapeHtml(linkHref)}" class="legend-notif-link">
            <svg viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            اذهب
          </a>
        ` : ''}
      </div>
    </div>
  `;
}

/* ========== MARK AS READ ========== */
async function markAsRead(id) {
  const notif = allNotifs.find(n => n.id === id);
  if (!notif || notif.is_read) return;

  try {
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('id', id);
    notif.is_read = true;
    render();
  } catch (err) {
    console.error('[ASCEND] Mark read failed:', err);
  }
}

/* ========== MARK ALL AS READ ========== */
async function markAllAsRead() {
  const unreadIds = allNotifs.filter(n => !n.is_read).map(n => n.id);
  if (unreadIds.length === 0) return;

  try {
    await supabase.from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    allNotifs.forEach(n => { n.is_read = true; });
    render();
    toast('تم تحديد الكل كمقروء ✅', 'success');
  } catch (err) {
    console.error('[ASCEND] Mark all failed:', err);
    toast('تعذّر التحديث', 'error');
  }
}

/* ========== INIT ========== */
initTheme();
loadProfile();
loadNotifications();