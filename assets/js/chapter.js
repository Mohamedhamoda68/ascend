import { supabase } from './supabase.js';
import { escapeHtml, getYouTubeId } from './utils.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) location.href = '/login.html';

const urlParams = new URLSearchParams(location.search);
const chapterId = urlParams.get('id');

if (!chapterId) location.href = '/dashboard.html';

let allContents = [];
let activeVideoId = null;

async function init() {
  // جلب بيانات الباب
  const { data: chapter } = await supabase.from('chapters').select('*').eq('id', chapterId).single();
  if (chapter) {
    document.getElementById('pageTitle').textContent = chapter.title;
    document.getElementById('chapterTitle').textContent = `محتوى الباب: ${chapter.title}`;
  }

  // جلب المحتوى (فيديوهات، ملفات، إلخ)
  const { data: contents } = await supabase
    .from('chapter_contents')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('id');

  if (!contents || contents.length === 0) {
    document.getElementById('lessonsList').innerHTML = '<div class="empty-state">لا يوجد محتوى في هذا الباب.</div>';
    return;
  }

  allContents = contents;
  renderLessons();
}

function renderLessons() {
  const list = document.getElementById('lessonsList');
  
  // تجميع المحتوى حسب العنوان (عشان نعمل الأكورديون)
  // لو إنت مسجل كل فيديو وملف بنفس الاسم، هنعتبرهم درس واحد
  const grouped = {};
  allContents.forEach(item => {
    if (!grouped[item.title]) grouped[item.title] = [];
    grouped[item.title].push(item);
  });

  let html = '';
  let isFirst = true;

  for (const [title, items] of Object.entries(grouped)) {
    const isActive = isFirst ? 'active' : ''; // أول درس يفتح تلقائياً
    if (isFirst && items.length > 0) {
      const firstVideo = items.find(i => i.type === 'video');
      if (firstVideo) openVideo(firstVideo.video_url);
      isFirst = false;
    }

    html += `
      <div class="lesson-accordion ${isActive}">
        <div class="lesson-header" onclick="toggleAccordion(this)">
          <div class="lesson-title-wrap">
            <div class="lesson-icon">
              <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div>
            <div class="lesson-title-text">
              <h4>${escapeHtml(title)}</h4>
              <span>${items.length} عناصر</span>
            </div>
          </div>
          <div class="lesson-arrow">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" fill="none" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <div class="lesson-body">
          <div class="lesson-content-list">
            ${items.map(item => renderContentItem(item)).join('')}
          </div>
        </div>
      </div>
    `;
  }

  list.innerHTML = html;
}

function renderContentItem(item) {
  let icon = '';
  let btn = '';

  if (item.type === 'video') {
    icon = `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
    btn = `<button onclick="playVideo('${item.video_url}')" class="btn btn-primary btn-sm">مشاهدة</button>`;
  } else if (item.type === 'pdf') {
    icon = `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
    btn = `<a href="${item.pdf_url}" target="_blank" class="btn btn-ghost btn-sm">فتح الملف</a>`;
  } else if (item.type === 'homework') {
    icon = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
    btn = `<a href="${item.homework_desc}" target="_blank" class="btn btn-ghost btn-sm">فتح الواجب</a>`;
  } else if (item.type === 'quiz') {
    icon = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
    btn = `<a href="/quiz.html?id=${item.quiz_id}" class="btn btn-ghost btn-sm">أمتحن</a>`;
  }

  return `
    <div class="content-item-row">
      <div class="content-item-info">
        ${icon}
        <span>${escapeHtml(item.title)}</span>
      </div>
      ${btn}
    </div>
  `;
}

window.toggleAccordion = (header) => {
  const accordion = header.parentElement;
  // إغلاق الباقي (اختياري)
  document.querySelectorAll('.lesson-accordion').forEach(acc => {
    if (acc !== accordion) acc.classList.remove('active');
  });
  // فتح/قفل اللي إنت دوست عليه
  accordion.classList.toggle('active');
};

window.playVideo = (url) => {
  openVideo(url);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function openVideo(url) {
  const videoId = getYouTubeId(url);
  if (!videoId) return;

  const videoSection = document.getElementById('videoSection');
  videoSection.style.display = 'block';
  
  document.getElementById('videoContainer').innerHTML = `
    <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" allowfullscreen allow="autoplay"></iframe>
  `;

  activeVideoId = videoId;
}

// زرار "تحديد كمكتمل"
document.getElementById('markCompleteBtn').addEventListener('click', async () => {
  // هنا ممكن نسجل إنه خلص الفيديو في الداتابيز
  alert('تم تحديد الدرس كمكتمل! (هنربطها بالداتابيز في الخطوة الجاية)');
  document.getElementById('markCompleteBtn').innerHTML = '✓ تم';
  document.getElementById('markCompleteBtn').style.background = '#10B981';
});

init();
