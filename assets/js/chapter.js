import { supabase } from './supabase.js';
import { escapeHtml } from './utils.js';

const urlParams = new URLSearchParams(location.search);
const chapterId = urlParams.get('id');

async function init() {
  // 1. جلب بيانات الباب (الغلاف)
  const { data: chapter } = await supabase.from('chapters').select('*').eq('id', chapterId).single();
  if (chapter && chapter.cover_image_url) {
    document.getElementById('chapterCover').style.backgroundImage = `url('${chapter.cover_image_url}')`;
  }

  // 2. جلب المحتوى
  const { data: contents } = await supabase.from('chapter_contents').select('*').eq('chapter_id', chapterId).order('id');

  const list = document.getElementById('lessonsList');
  
  if (!contents || contents.length === 0) {
    list.innerHTML = '<div class="loading-inline">لا يوجد محتوى في هذا الباب.</div>';
    return;
  }

  // تجميع بالعنوان
  const grouped = {};
  contents.forEach(item => {
    if (!grouped[item.title]) grouped[item.title] = [];
    grouped[item.title].push(item);
  });

  let html = '';
  for (const [title, items] of Object.entries(grouped)) {
    // استخراج عنوان فرعي (لو فيه فيديو أو ملف)
    let subTitle = 'محتوى الباب';
    if (items.some(i => i.type === 'video')) subTitle = 'مشاهدة الفيديو';
    else if (items.some(i => i.type === 'pdf')) subTitle = 'ملفات وملخصات';

    html += `
      <div class="lesson-card">
        <div class="lesson-header" onclick="window.location.href='/lesson.html?id=${items[0].id}'">
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
}

init();
