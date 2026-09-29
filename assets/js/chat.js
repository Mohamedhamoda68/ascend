// ============================================
// ASCEND · Smart Assistant (Pre-made Responses)
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { escapeHtml } from './utils.js';

/* ========== WHATSAPP NUMBER ========== */
/* ⚠️ بدّل الرقم ده برقمك */
const WHATSAPP_NUMBER = '01556388566';
const WHATSAPP_MESSAGE = 'أهلاً، محتاج مساعدة في منصة ASCEND';

/* ========== CHAT TREE ========== */
const CHAT_TREE = {

  /* ---------- ROOT ---------- */
  root: {
    message: 'أهلًا بيك 👋<br>أنا المساعد الذكي لمنصة <strong>ASCEND</strong>.<br><br>اختار من القائمة تحت اللي محتاج مساعدة فيه:',
    options: [
      { text: '🎓 إزاي أسجّل حساب؟', goto: 'register' },
      { text: '🔐 مشكلة في تسجيل الدخول', goto: 'login' },
      { text: '📚 إزاي أذاكر في المنصة؟', goto: 'study' },
      { text: '✍️ إزاي أحل امتحان؟', goto: 'quiz' },
      { text: '📄 المكتبة (PDF) مش شغالة', goto: 'library' },
      { text: '🎓 إزاي أحصل على شهادة؟', goto: 'certificate' },
      { text: '🔔 الإشعارات مش بتيجي', goto: 'notifications' },
      { text: '💬 تواصل مع الدعم', goto: 'support' },
      { text: '❓ سؤال تاني', goto: 'other' }
    ]
  },

  /* ---------- REGISTER ---------- */
  register: {
    message: `للتسجيل في المنصة:<br><br>
    <strong>1.</strong> افتح صفحة "إنشاء حساب"<br>
    <strong>2.</strong> املأ البيانات (الاسم، الإيميل، رقم الهاتف، المحافظة)<br>
    <strong>3.</strong> اختر كلمة مرور قوية (8 أحرف على الأقل)<br>
    <strong>4.</strong> وافق على الشروط<br>
    <strong>5.</strong> اضغط "إنشاء الحساب"<br><br>
    ⏳ بعد التسجيل، حسابك هيبقى <strong>"قيد المراجعة"</strong> ويتم تفعيله خلال 24 ساعة.<br><br>
    هل ده جاوب على سؤالك؟`,
    options: [
      { text: '✅ تمام، شكرًا', goto: 'thanks' },
      { text: '❌ الحساب لسه مش مفعّل', goto: 'pending' },
      { text: '🔙 رجوع للقائمة', goto: 'root' },
      { text: '💬 محتاج الدعم', goto: 'support' }
    ]
  },

  pending: {
    message: `لو حسابك لسه <strong>"قيد المراجعة"</strong>:<br><br>
    <strong>1.</strong> استنى لحد 24 ساعة<br>
    <strong>2.</strong> الإدارة بتراجع البيانات يدويًا<br>
    <strong>3.</strong> لو عدّيت 24 ساعة، تواصل مع الدعم مباشرة<br><br>
    ⚠️ <strong>ملاحظة:</strong> تأكد إنك مشترك في القناة على يوتيوب — ده بيُسرّع التفعيل.`,
    options: [
      { text: '💬 تواصل مع الدعم', goto: 'support' },
      { text: '🔙 رجوع للقائمة', goto: 'root' }
    ]
  },

  /* ---------- LOGIN ---------- */
  login: {
    message: `لو مش قادر تسجّل دخول، جرّب الحلول دي:<br><br>
    <strong>1.</strong> تأكد إن الإيميل والباسورد صح<br>
    <strong>2.</strong> اعمل <strong>تحديث</strong> للصفحة (Ctrl + Shift + R)<br>
    <strong>3.</strong> امسح الكوكيز من المتصفح<br>
    <strong>4.</strong> جرّب متصفح تاني (Chrome)<br>
    <strong>5.</strong> لو نسيت الباسورد، اضغط "نسيت كلمة المرور"<br><br>
    لو لسه فيه مشكلة؟`,
    options: [
      { text: '✅ اشتغل، شكرًا', goto: 'thanks' },
      { text: '❌ نسيت كلمة المرور', goto: 'forgot' },
      { text: '❌ الحساب موقوف', goto: 'suspended' },
      { text: '🔙 رجوع للقائمة', goto: 'root' }
    ]
  },

  forgot: {
    message: `لإعادة تعيين كلمة المرور:<br><br>
    <strong>1.</strong> اضغط "نسيت كلمة المرور" في صفحة الدخول<br>
    <strong>2.</strong> اكتب إيميلك<br>
    <strong>3.</strong> هتوصلك رسالة على الإيميل فيها رابط<br>
    <strong>4.</strong> اضغط الرابط واكتب باسورد جديد<br><br>
    ⚠️ شوف مجلد <strong>Spam</strong> لو الرسالة مش ظاهرة.`,
    options: [
      { text: '✅ تمام', goto: 'thanks' },
      { text: '❌ الرسالة مش بتيجي', goto: 'support' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  suspended: {
    message: `لو حسابك <strong>موقوف</strong>، ده بيحصل لـ:<br><br>
    • مخالفة شروط الاستخدام<br>
    • عدم دفع الاشتراك (لو مدفوع)<br>
    • إساءة استخدام المنصة<br><br>
    <strong>لحل المشكلة:</strong><br>
    تواصل مع الدعم وهنراجع حالة حسابك.`,
    options: [
      { text: '💬 تواصل مع الدعم', goto: 'support' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  /* ---------- STUDY ---------- */
  study: {
    message: `إزاي تذاكر في المنصة؟<br><br>
    <strong>1.</strong> من لوحتك، اختر المادة اللي عايز تذاكرها<br>
    <strong>2.</strong> اختر الفصل → الدرس<br>
    <strong>3.</strong> اتفرج على الفيديو<br>
    <strong>4.</strong> اضغط "أكملت الدرس" بعد ما تخلص<br>
    <strong>5.</strong> حل الاختبار لو موجود<br>
    <strong>6.</strong> حمّل الملازم PDF من المكتبة<br><br>
    💡 <strong>نصيحة:</strong> ذاكر كل يوم عشان تحافظ على الـ Streak!`,
    options: [
      { text: '✅ تمام', goto: 'thanks' },
      { text: '❓ الفيديو مش بيفتح', goto: 'video' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  video: {
    message: `لو الفيديو مش بيفتح:<br><br>
    <strong>1.</strong> تأكد من اتصالك بالإنترنت<br>
    <strong>2.</strong> حدّث الصفحة<br>
    <strong>3.</strong> جرّب متصفح تاني<br>
    <strong>4.</strong> امسح الكاش<br>
    <strong>5.</strong> الفيديو ممكن ميكونش مضاف للدرس ده لسه`,
    options: [
      { text: '✅ اشتغل', goto: 'thanks' },
      { text: '❌ لسه مش شغال', goto: 'support' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  /* ---------- QUIZ ---------- */
  quiz: {
    message: `إزاي تحل امتحان؟<br><br>
    <strong>1.</strong> افتح الدرس<br>
    <strong>2.</strong> اضغط "ابدأ الاختبار"<br>
    <strong>3.</strong> جاوب على الأسئلة (الوقت محدد)<br>
    <strong>4.</strong> اضغط "إنهاء الاختبار"<br>
    <strong>5.</strong> هتشوف نتيجتك فورًا<br>
    <strong>6.</strong> اضغط "مراجعة الإجابات" عشان تشوف غلطاتك<br><br>
    💡 لو خرجت في النص، تقدر <strong>تستكمل الاختبار</strong> بعدين!`,
    options: [
      { text: '✅ تمام', goto: 'thanks' },
      { text: '❓ الوقت خلص بسرعة', goto: 'quiz_time' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  quiz_time: {
    message: `لو الوقت خلص:<br><br>
    • الوقت بتحدده الإدارة لكل امتحان<br>
    • تقدر تتدرب على الأسئلة قبل الامتحان<br>
    • لو الوقت قليل، تواصل مع الدعم لطلب زيادة الوقت`,
    options: [
      { text: '💬 تواصل مع الدعم', goto: 'support' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  /* ---------- LIBRARY ---------- */
  library: {
    message: `لو المكتبة (PDF) مش شغالة:<br><br>
    <strong>1.</strong> تأكد إنك مسجّل دخول<br>
    <strong>2.</strong> جرّب تحديث الصفحة<br>
    <strong>3.</strong> الملفات بتفتح في تبويب جديد<br>
    <strong>4.</strong> لو الملف مش موجود، سيتم إضافته قريبًا<br><br>
    ⚠️ <strong>ملاحظة:</strong> التحميل على الموبايل ممكن يحتاج تطبيق قارئ PDF.`,
    options: [
      { text: '✅ تمام', goto: 'thanks' },
      { text: '❌ لسه مش شغال', goto: 'support' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  /* ---------- CERTIFICATE ---------- */
  certificate: {
    message: `إزاي تحصل على شهادة؟<br><br>
    <strong>المتطلبات:</strong><br>
    • إكمال <strong>80%</strong> من دروس المادة<br>
    • متوسط درجات اختباراتك <strong>50%</strong> أو أكتر<br><br>
    <strong>الخطوات:</strong><br>
    <strong>1.</strong> من الـ Sidebar، اضغط "شهاداتي"<br>
    <strong>2.</strong> هتلاقي كل الشهادات اللي استحقتها<br>
    <strong>3.</strong> اضغط على الشهادة عشان تشوفها<br>
    <strong>4.</strong> اضغط "طباعة / حفظ PDF"<br><br>
    💡 كل شهادة ليها <strong>رقم تحقق فريد</strong>.`,
    options: [
      { text: '✅ تمام', goto: 'thanks' },
      { text: '❌ الشهادة مش ظاهرة', goto: 'cert_missing' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  cert_missing: {
    message: `لو الشهادة مش ظاهرة:<br><br>
    • تأكد إنك أكملت <strong>80% من الدروس</strong><br>
    • تأكد إن <strong>متوسط اختباراتك 50%+</strong><br>
    • الشهادة بتظهر تلقائيًا بعد تحقيق الشروط<br>
    • لو الشروط متحققة والشهادة مش ظاهرة، تواصل مع الدعم`,
    options: [
      { text: '💬 تواصل مع الدعم', goto: 'support' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  /* ---------- NOTIFICATIONS ---------- */
  notifications: {
    message: `إزاي تشوف الإشعارات؟<br><br>
    <strong>1.</strong> من الـ Sidebar، اضغط "الإشعارات"<br>
    <strong>2.</strong> هتلاقي كل الإشعارات<br>
    <strong>3.</strong> تقدر تفلتر (الكل / غير مقروء / مقروء)<br>
    <strong>4.</strong> اضغط على أي إشعار عشان يتقرا<br><br>
    ⚠️ لو مفيش إشعارات، ده معناه إن مفيش جديد لسه.`,
    options: [
      { text: '✅ تمام', goto: 'thanks' },
      { text: '🔙 رجوع', goto: 'root' }
    ]
  },

  /* ---------- SUPPORT ---------- */
  support: {
    message: `تمام، هحولك للدعم مباشرة 👇<br><br>
    اضغط على الزر الأخضر عشان تفتح محادثة WhatsApp مع فريق الدعم.<br><br>
    <strong>هتلاقينا موجودين من 10 ص إلى 10 م</strong>`,
    options: [
      { text: '💬 تواصل مع الدعم على WhatsApp', whatsapp: true },
      { text: '🔙 رجوع للقائمة', goto: 'root' }
    ]
  },

  /* ---------- OTHER ---------- */
  other: {
    message: `لو عندك سؤال تاني، ممكن:<br><br>
    • تسأل عن أي ميزة في المنصة<br>
    • تتواصل مع الدعم مباشرة<br>
    • تتفرج على المواد المتاحة<br><br>
    إيه اللي تحب تسأل عنه؟`,
    options: [
      { text: '💬 تواصل مع الدعم', goto: 'support' },
      { text: '📚 المواد', goto: 'study' },
      { text: '🔙 رجوع للقائمة الرئيسية', goto: 'root' }
    ]
  },

  /* ---------- THANKS ---------- */
  thanks: {
    message: `العفو! 😊<br><br>
    لو محتاج أي مساعدة تانية، أنا موجود 24/7.<br><br>
    <strong>بالتوفيق في دراستك! 🎓</strong>`,
    options: [
      { text: '🔙 القائمة الرئيسية', goto: 'root' },
      { text: '💬 تواصل مع الدعم', goto: 'support' }
    ]
  }
};

/* ========== STATE ========== */
const chatBody = document.getElementById('chatBody');
const chatOptions = document.getElementById('chatOptions');
let isTyping = false;

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

/* ========== ADD MESSAGE ========== */
function addMessage(text, sender = 'bot') {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${sender}`;

  const avatarSvg = sender === 'bot'
    ? '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm9 0a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"/></svg>'
    : '👤';

  msg.innerHTML = `
    <div class="chat-msg-avatar">${avatarSvg}</div>
    <div class="chat-msg-bubble">${text}</div>
  `;

  chatBody.appendChild(msg);
  chatBody.scrollTop = chatBody.scrollHeight;
}

/* ========== TYPING INDICATOR ========== */
function showTyping() {
  const typing = document.createElement('div');
  typing.className = 'chat-msg bot';
  typing.id = 'typingIndicator';
  typing.innerHTML = `
    <div class="chat-msg-avatar">
      <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2z"/></svg>
    </div>
    <div class="typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  chatBody.appendChild(typing);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function hideTyping() {
  const typing = document.getElementById('typingIndicator');
  if (typing) typing.remove();
}

/* ========== RENDER OPTIONS ========== */
function renderOptions(options) {
  chatOptions.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'chat-option';

    if (opt.whatsapp) {
      btn.classList.add('whatsapp');
      btn.innerHTML = `
        <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
        ${escapeHtml(opt.text)}
      `;
      btn.addEventListener('click', openWhatsApp);
    } else if (opt.goto) {
      btn.innerHTML = `${escapeHtml(opt.text)}`;
      if (opt.goto === 'root') {
        btn.classList.add('back');
        btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg> ${escapeHtml(opt.text)}`;
      }
      btn.addEventListener('click', () => {
        addMessage(opt.text.replace(/^[^\s]+\s/, ''), 'user');
        goto(opt.goto);
      });
    }

    chatOptions.appendChild(btn);
  });

  chatOptions.scrollTop = 0;
}

/* ========== GOTO NODE ========== */
function goto(nodeKey, isUser = true) {
  if (isTyping) return;
  isTyping = true;
  chatOptions.innerHTML = '';

  const node = CHAT_TREE[nodeKey];
  if (!node) {
    addMessage('عذرًا، فيه مشكلة. حاول تاني.', 'bot');
    isTyping = false;
    return;
  }

  showTyping();

  setTimeout(() => {
    hideTyping();
    addMessage(node.message, 'bot');
    renderOptions(node.options || []);
    isTyping = false;
  }, 800);
}

/* ========== WHATSAPP ========== */
function openWhatsApp() {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  window.open(url, '_blank');
}

/* ========== INIT ========== */
function init() {
  initTheme();

  setTimeout(() => {
    goto('root', false);
  }, 300);
}

init();