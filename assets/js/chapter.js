// ============================================
// ASCEND · Chapter Content Logic
// ============================================
import { supabase } from './supabase.js';
import { escapeHtml, getYouTubeId } from './utils.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

const params = new URLSearchParams(location.search);
const chapterId = params.get('id');

if (!chapterId) { location.href = '/dashboard.html'; throw new Error('No chapter id'); }

// Load Profile
async function loadProfile() {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  if (data) {
    document.querySelector('#userName').textContent = data.full_name;
    document.querySelector('#userAvatar').textContent = data.full_name.charAt(0);
  }
}
loadProfile();

// Load Chapter Content
async function loadChapter() {
  const container = document.querySelector('#chapterContentList');
  
  try {
    // 1. جلب بيانات الباب والمادة
    const { data: chapter, error: chErr } = await supabase
      .from('chapters')
      .select('*, subjects(name, slug, color)')
      .eq('id', chapterId)
      .single();

    if (chErr || !chapter) throw new Error('Chapter not found');

    // تحديث العناوين
    document.title = `${chapter.title} — ASCEND`;
    document.querySelector('#chapterTitle').textContent = chapter.title;
    document.querySelector('#breadcrumbSubject').textContent = chapter.subjects?.name || 'المادة';
    document.querySelector('#breadcrumbSubject').href = `/subject.html?slug=${chapter.subjects?.slug}`;
    document.querySelector('#breadcrumbChapter').textContent = chapter.title;
    document.body.style.setProperty('--subject-accent', chapter.subjects?.color || '#7C5CFF');

    // رسم الهيدر
    document.querySelector('#chapterHeader').innerHTML = `
      <div class="chapter-hero-banner">
        <div class="chapter-hero-icon">
          <svg viewBox="0 0 24 24"><path d="M4 4h6a2 2 0 012 2v14a2 2 0 00-2-2H4z"/><path d="M20 4h-6a2 2 0 00-2 2v14a2 2 0 012-2h6z"/></svg>
        </div>
        <div class="chapter-hero-info">
          <h1>${escapeHtml(chapter.title)}</h1>
          <p>محتوى الباب: فيديوهات، واجبات، امتحانات، وملفات PDF.</p>
        </div>
      </div>
    `;

    // 2. جلب المحتوى الخاص بالباب (من الجدول اللي عملناه)
    const { data: contents, error: contentErr } = await supabase
      .from('chapter_contents')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('order');

    // 3. جلب تقدم الطالب (شاف إيه)
    const { data: progress } = await supabase
      .from('content_progress')
      .select('content_id')
      .eq('user_id', user.id);

    const completedIds = new Set((progress || []).map(p => p.content_id));

    if (!contents || contents.length === 0) {
      container.innerHTML = `<div class="empty-state">لم يتم إضافة محتوى لهذا الباب بعد.</div>`;
      return;
    }

    // 4. رسم القائمة
    container.innerHTML = `
      <div class="lessons-list">
        ${contents.map((item, idx) => {
          const isCompleted = completedIds.has(item.id);
          
          // تحديد الأيقونة والزر حسب النوع
          let iconSvg = '';
          let actionBtn = '';
          let extraBadge = isCompleted ? `<span class="badge-completed">✓ تم</span>` : '';

          if (item.type === 'video') {
            iconSvg = `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
            actionBtn = `<button class="lesson-action-btn btn-watch" onclick="openVideo('${item.video_url}', ${item.id})">مشاهدة</button>`;
          } else if (item.type === 'quiz') {
            iconSvg = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
            actionBtn = `<a href="/quiz.html?id=${item.quiz_id}" class="lesson-action-btn btn-start">ابدأ الامتحان</a>`;
          } else if (item.type === 'homework') {
            iconSvg = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
            actionBtn = `<button class="lesson-action-btn btn-download" onclick="alert('سيتم فتح الواجب قريباً')">فتح الواجب</button>`;
          } else if (item.type === 'pdf') {
            iconSvg = `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
            actionBtn = `<a href="${item.pdf_url}" target="_blank" class="lesson-action-btn btn-download">تحميل PDF</a>`;
          }

          // "أنت هنا" لأول فيديو مش متشاف
          const isYouAreHere = (idx === 0 && !isCompleted && item.type === 'video') ? `<span class="badge-you-are-here">أنت هنا</span>` : '';

          return `
            <div class="lesson-row type-${item.type} ${isYouAreHere ? 'active' : ''}">
              ${isYouAreHere}
              <div class="lesson-icon-box">${iconSvg}</div>
              <div class="lesson-content-text">${escapeHtml(item.title)}</div>
              <div style="display:flex; align-items:center; gap:15px;">
                ${extraBadge}
                ${actionBtn}
              </div>
            </div>
          `;
        }).join('')}
      </div>
      
      <!-- نافذة الفيديو المنبثقة -->
      <div class="video-modal-overlay" id="videoModal" onclick="closeVideo(event)">
        <div class="video-modal-content" onclick="event.stopPropagation()">
          <button class="video-modal-close" onclick="closeVideo(event)">✕</button>
          <div id="videoIframeContainer" style="width:100%;height:100%;"></div>
        </div>
      </div>
    `;

  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="empty-state" style="color:#F85149">حدث خطأ أثناء تحميل الباب.</div>`;
  }
}

// دوال فتح وقفل الفيديو
window.openVideo = async (url, contentId) => {
  const videoId = getYouTubeId(url); // استخدام الدالة الذكية
  
  if (!videoId) {
    alert('رابط الفيديو غير صالح. تأكد من الرابط.');
    return;
  }

  const iframeContainer = document.getElementById('videoIframeContainer');
  iframeContainer.innerHTML = `<iframe width="100%" height="100%" src="https://www.youtube.com/embed/${videoId}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  
  document.getElementById('videoModal').classList.add('open');

  // تسجيل إن الطالب شاف الفيديو
  try {
    await supabase.from('content_progress').upsert({
      user_id: user.id,
      content_id: contentId,
      status: 'completed'
    }, { onConflict: 'user_id,content_id' });
  } catch (err) {
    console.error('Error saving progress:', err);
  }
};

window.closeVideo = (e) => {
  if (e) e.preventDefault();
  document.getElementById('videoModal').classList.remove('open');
  document.getElementById('videoIframeContainer').innerHTML = ''; // إيقاف الفيديو
};

// Sidebar
document.querySelector('#menuToggle')?.addEventListener('click', () => {
  document.querySelector('#sidebar')?.classList.toggle('open');
});

loadChapter();
