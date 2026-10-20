// ============================================
// ASCEND · Chapter Page Logic
// ============================================
import { supabase } from './supabase.js';
import { escapeHtml, getYouTubeId } from './utils.js';

const urlParams = new URLSearchParams(location.search);
const chapterId = urlParams.get('id');

async function init() {
  if (!chapterId) {
    document.getElementById('lessonsList').innerHTML = '<div class="loading-inline" style="color:red">خطأ: لم يتم تحديد الباب.</div>';
    return;
  }

  try {
    // 1. جلب بيانات الباب وصورة الغلاف
    const { data: chapter } = await supabase.from('chapters').select('*').eq('id', chapterId).single();
    if (chapter && chapter.cover_image_url) {
      document.getElementById('chapterCover').style.backgroundImage = `url('${chapter.cover_image_url}')`;
    }

    // 2. جلب محتوى الباب (فيديوهات، ملفات، إلخ)
    const { data: contents } = await supabase
      .from('chapter_contents')
      .select('*')
      .eq('chapter_id', chapterId)
      .order('id');

    const list = document.getElementById('lessonsList');
    
    if (!contents || contents.length === 0) {
      list.innerHTML = '<div class="loading-inline">لا يوجد محتوى في هذا الباب.</div>';
      return;
    }

    // 3. تجميع المحتوى تحت اسم الدرس (مثلاً: "الاسبوع الاول" يبقى فيه فيديو وملف وامتحان)
    const grouped = {};
    contents.forEach(item => {
      if (!grouped[item.title]) grouped[item.title] = [];
      grouped[item.title].push(item);
    });

    let html = '';
    for (const [title, items] of Object.entries(grouped)) {
      let subTitle = 'محتوى الباب';
      if (items.some(i => i.type === 'video')) subTitle = 'مشاهدة الفيديو';
      else if (items.some(i => i.type === 'pdf')) subTitle = 'ملفات وملخصات';

      html += `
        <div class="lesson-card" data-contents='${JSON.stringify(items).replace(/'/g, "&apos;")}'>
          <div class="lesson-header" onclick="toggleLesson(this)">
            <div class="lesson-info">
              <span class="lesson-title">${escapeHtml(title)}</span>
              <span class="lesson-subtitle">${subTitle}</span>
            </div>
            <div class="lesson-arrow">
              <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
            </div>
          </div>
        </div>
      `;
    }

    list.innerHTML = html;

  } catch (err) {
    console.error(err);
    document.getElementById('lessonsList').innerHTML = '<div class="loading-inline" style="color:red">حدث خطأ أثناء التحميل.</div>';
  }
}

// دالة فتح وقفل الدرس وعرض المحتوى اللي جواه
window.toggleLesson = (header) => {
  const card = header.parentElement;
  
  // اقفل أي كارت تاني مفتوح
  document.querySelectorAll('.lesson-card').forEach(c => {
    if (c !== card) c.classList.remove('open');
  });
  
  // افتح الكارت الحالي
  card.classList.toggle('open');

  // لو الكارت اتفتح ومفيهوش محتوى، نبنيه
  if (card.classList.contains('open') && !card.querySelector('.lesson-body')) {
    const contents = JSON.parse(card.dataset.contents || '[]');
    let contentHtml = '<div class="lesson-body"><div class="lesson-content">';
    
    contents.forEach(item => {
      let btn = '';
      if (item.type === 'video') {
        btn = `<button onclick="event.stopPropagation(); openVideo('${item.video_url}')" class="btn-action">مشاهدة</button>`;
      } else if (item.type === 'pdf') {
        btn = `<a href="${item.pdf_url}" target="_blank" class="btn-action secondary">فتح الملف</a>`;
      } else if (item.type === 'homework') {
        btn = `<a href="${item.homework_desc}" target="_blank" class="btn-action secondary">فتح الواجب</a>`;
      } else if (item.type === 'quiz') {
        btn = `<a href="/quiz.html?id=${item.quiz_id}" class="btn-action secondary">أمتحن</a>`;
      }

      contentHtml += `
        <div class="content-row">
          <div class="content-name">
            ${item.type === 'video' ? '▶ فيديو الشرح' : item.type === 'pdf' ? '📄 ملف مذكرة' : item.type === 'quiz' ? '❓ امتحان' : '📝 واجب'}
          </div>
          ${btn}
        </div>
      `;
    });
    
    contentHtml += '</div></div>';
    card.innerHTML += contentHtml;
  }
};

// تشغيل الفيديو في نافذة منبثقة
window.openVideo = (url) => {
  const videoId = getYouTubeId(url);
  if (!videoId) return alert('رابط الفيديو غير صالح');

  let modal = document.getElementById('videoModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'videoModal';
    modal.className = 'video-modal';
    modal.innerHTML = `
      <div class="video-modal-content">
        <button class="video-modal-close" onclick="document.getElementById('videoModal').style.display='none'; document.getElementById('videoIframe').src='';">✕ إغلاق</button>
        <iframe id="videoIframe" src="" allowfullscreen allow="autoplay"></iframe>
      </div>
    `;
    document.body.appendChild(modal);
  }

  document.getElementById('videoIframe').src = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  modal.style.display = 'flex';
};

init();
