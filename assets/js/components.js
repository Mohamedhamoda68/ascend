// ============================================
// ASCEND · Shared Components
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { $, el, escapeHtml } from './utils.js';

const CREATOR = 'Mohamed Hamouda';
const CREATOR_AR = 'محمد حمودة';

const NAV_LINKS = [
  { href: '/#subjects', label: 'المواد' },
  { href: '/#features', label: 'المميزات' },
  { href: '/#faq',      label: 'الأسئلة' }
];

/* ---------- Brand SVG ---------- */
const BRAND_SVG = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 17L17 7M17 7H9M17 7v8"/>
  </svg>`;

/* ---------- Sun Icon ---------- */
const ICON_SUN = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
  </svg>`;

/* ---------- Moon Icon ---------- */
const ICON_MOON = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
  </svg>`;

/* ============================================
   Theme Manager (shared with theme.js)
   ============================================ */
const THEME_KEY = 'ascend:theme';

function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch (e) {}
  return 'dark';
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {}
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) document.body.setAttribute('data-theme', theme);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', theme === 'light' ? '#F7F8FC' : '#050506');
  }

  /* Update every toggle button's icon */
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.innerHTML = theme === 'light' ? ICON_MOON : ICON_SUN;
    const label = theme === 'light' ? 'تبديل للوضع الداكن' : 'تبديل للوضع الفاتح';
    btn.setAttribute('aria-label', label);
  });
}

function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  saveTheme(next);
  applyTheme(next);
}

/* ✅ زر الثيم مع listener حقيقي */
function createThemeButton() {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'icon-btn theme-toggle';
  btn.setAttribute('data-theme-toggle', 'true');
  btn.setAttribute('aria-label', 'تبديل الوضع الليلي');

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleTheme();
  });

  return btn;
}

function initTheme() {
  applyTheme(getTheme());
}

/* ============================================
   Event Delegation (احتياطي)
   يشتغل حتى لو الزر اتحقن كـ HTML string
   ============================================ */
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-theme-toggle]');
  if (!btn) return;
  e.preventDefault();
  toggleTheme();
}, true); /* capture phase عشان يسبق أي listener تاني */

/* ---------- Render Nav ---------- */
export async function renderNav({ auth = true } = {}) {
  const mount = document.getElementById('site-nav');
  if (!mount) return;

  const links = NAV_LINKS.map(l =>
    `<a href="${l.href}">${l.label}</a>`
  ).join('');

  let authBlock = `
    <a href="/login.html" class="btn btn-ghost btn-sm">دخول</a>
    <a href="/register.html" class="btn btn-primary btn-sm">ابدأ مجانًا</a>
  `;

  if (auth) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles').select('full_name').eq('id', session.user.id).single();
        const initials = (profile?.full_name || '؟').trim().charAt(0);
        authBlock = `
          <a href="/dashboard.html" class="user-chip" aria-label="حسابي">
            <span class="user-chip-avatar">${escapeHtml(initials)}</span>
            <span class="user-chip-name">${escapeHtml(profile?.full_name || 'حسابي')}</span>
          </a>
        `;
      }
    } catch (_) { /* silent */ }
  }

  /* ✅ نبني الـ Nav */
  mount.innerHTML = `
    <nav class="nav" role="navigation" aria-label="التنقل الرئيسي">
      <div class="nav-inner">
        <a href="/" class="brand" aria-label="ASCEND - الصفحة الرئيسية">
          <span class="brand-mark">${BRAND_SVG}</span>
          ASCEND
        </a>
        <div class="nav-menu">
          ${links}
          <span class="theme-toggle-slot"></span>
          ${authBlock}
        </div>
      </div>
    </nav>
  `;

  /* ✅ نحط زر الثيم بـ DOM API عشان الـ listener يشتغل */
  const slot = mount.querySelector('.theme-toggle-slot');
  if (slot) {
    slot.replaceWith(createThemeButton());
  }

  /* ✅ نحدّث الأيقونة حسب الوضع الحالي */
  applyTheme(getTheme());
}

/* ---------- Render Footer ---------- */
export function renderFooter() {
  const mount = document.getElementById('site-footer');
  if (!mount) return;
  const year = new Date().getFullYear();
  mount.innerHTML = `
    <footer role="contentinfo">
      <div class="footer-grid">
        <div class="footer-brand">
          <a href="/" class="brand" aria-label="ASCEND">
            <span class="brand-mark">${BRAND_SVG}</span>
            ASCEND
          </a>
          <p>منصة تعليمية متكاملة لطلاب الصف الثالث الثانوي — شعبة علمي علوم. كل ما تحتاجه للتفوق في مكان واحد.</p>
          <div class="footer-credit">
            <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
            </svg>
            من إنشاء <strong>${CREATOR_AR}</strong>
          </div>
        </div>
        <div class="footer-col">
          <h4>المنصة</h4>
          <ul>
            <li><a href="/#subjects">المواد</a></li>
            <li><a href="/#features">المميزات</a></li>
            <li><a href="/#faq">الأسئلة الشائعة</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>الحساب</h4>
          <ul>
            <li><a href="/login.html">تسجيل الدخول</a></li>
            <li><a href="/register.html">إنشاء حساب</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>المزيد</h4>
          <ul>
            <li><a href="/privacy.html">سياسة الخصوصية</a></li>
            <li><a href="/terms.html">شروط الاستخدام</a></li>
            <li><a href="/contact.html">تواصل معنا</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div>© ${year} <strong>ASCEND</strong> · جميع الحقوق محفوظة</div>
        <div>تصميم وتطوير <strong>${CREATOR}</strong></div>
      </div>
    </footer>
  `;
}

/* ---------- SEO Structured Data ---------- */
export function injectStructuredData() {
  const existing = document.querySelector('script[type="application/ld+json"][data-ascend]');
  if (existing) return;
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-ascend', 'true');
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: 'ASCEND',
    alternateName: 'اصعد',
    url: 'https://ascend-gules-two.vercel.app',
    description: 'منصة تعليمية متكاملة لطلاب الصف الثالث الثانوي — شعبة علمي علوم',
    inLanguage: 'ar-EG',
    areaServed: 'EG',
    founder: { '@type': 'Person', name: CREATOR }
  });
  document.head.appendChild(script);
}

/* ---------- Init Theme ---------- */
initTheme(); 
