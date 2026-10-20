import { supabase } from './supabase.js';
import { escapeHtml, getYouTubeId } from './utils.js';

const { data: { session } } = await supabase.auth.getSession();
if (!session) location.href = '/login.html';

const urlParams = new URLSearchParams(location.search);
const chapterId = urlParams.get('id');

if (!chapterId) location.href = '/dashboard.html';

async function init() {
  // جلب بيانات الباب
  const { data: chapter } = await supabase.from('chapters').select('*').eq('id', chapterId).single();
  if (chapter) {
    document.getElementById('pageTitle').textContent = chapter.title;
    document.getElementById('coverTitle').textContent = chapter.title;
    document.title = chapter.title;
    
    if (chapter.cover_image_url) {
      document.getElementById('chapterCover').style.backgroundImage = `url('${chapter.cover_image_url}')`;
    }
  }

  // جلب محتوى الباب
  const { data: contents } = await supabase
    .from('chapter_contents')
    .select('*')
    .eq('chapter_id', chapterId)
    .order('id');

  if (!contents || contents.length === 0) {
    document.getElementById('lessonsList').innerHTML = '<div class="empty-state">لا يوجد محتوى في هذا الباب.</div>';
    return;
  }

  renderLessons(contents);
}

function renderLessons(contents) {
  const list = document.getElementById('lessonsList');
  
  // تجميع المحتوى بالعنوان (مثلاً كل الفيديوهات والملفات اللي اسمها "المحاضرة الأولى" تبقى في كارت واحد)
  const grouped = {};
  contents.forEach(item => {
    if (!grouped[item.title]) grouped[item.title] = [];
    grouped[item.title].push(item);
  });

  let html = '';

  for (const [title, items] of Object.entries(grouped)) {
    // محتوى الكارت
    const contentHtml = items.map(item => {
      let icon = '';
      let btn = '';

      if (item.type === 'video') {
        icon = `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
        btn = `<button onclick="playVideo('${item.video_url}')" class="btn-action">مشاهدة</button>`;
      } else if (item.type === 'pdf') {
        icon = `<svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
        btn = `<a href="${item.pdf_url}" target="_blank" class="btn-action secondary">فتح الملف</a>`;
      } else if (item.type === 'homework') {
        icon = `<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path></svg>`;
        btn = `<a href="${item.homework_desc}" target="_blank" class="btn-action secondary">فتح الواجب</a>`;
      } else if (item.type === 'quiz') {
        icon = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path></svg>`;
        btn = `<a href="/quiz.html?id=${item.quiz_id}" class="btn-action secondary">أمتحن</a>`;
      }

      return `
        <div class="content-row">
          <div class="content-name">${icon} ${item.type === 'video' ? 'فيديو الشرح' : item.type === 'pdf' ? 'ملف مذكرة' : item.type === 'quiz' ? 'امتحان' : 'واجب'}</div>
          ${btn}
        </div>
      `;
    }).join('');

    // الكارت نفسه
    html += `
      <div class="lesson-card">
        <div class="lesson-header" onclick="toggleLesson(this)">
          <div class="lesson-info">
            <div class="lesson-icon">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>
            </div>
            <div class="lesson-title">
              <h4>${escapeHtml(title)}</h4>
              <span>${items.length} عناصر</span>
            </div>
          </div>
          <div class="lesson-arrow">
            <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </div>
        </div>
        <div class="lesson-body">
          <div class="lesson-content">
            ${contentHtml}
          </div>
        </div>
      </div>
    `;
  }

  list.innerHTML = html;
}

// فتح وقفل الكارت
window.toggleLesson = (header) => {
  const card = header.parentElement;
  card.classList.toggle('open');
};

// تشغيل الفيديو لما تدوس "مشاهدة"
window.playVideo = (url) => {
  const videoId = getYouTubeId(url);
  if (!videoId) {
    alert('رابط الفيديو غير صالح');
    return;
  }

  const videoSection = document.getElementById('videoSection');
  videoSection.style.display = 'block';
  
  document.getElementById('videoContainer').innerHTML = `
    <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" allowfullscreen allow="autoplay"></iframe>
  `;

  // نسكرل لأعلى عشان الفيديو يبان
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

init();
