// ============================================
// ASCEND · Shared Components
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { $, el, escapeHtml } from './utils.js';

const CREATOR = 'Mohamed Hamouda';
const CREATOR_AR = 'محمد حموده';

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

  mount.innerHTML = `
    <nav class="nav" role="navigation" aria-label="التنقل الرئيسي">
      <div class="nav-inner">
        <a href="/" class="brand" aria-label="ASCEND - الصفحة الرئيسية">
          <span class="brand-mark">${BRAND_SVG}</span>
          ASCEND
          <span class="brand-credit">by ${CREATOR}</span>
        </a>
        <div class="nav-menu">
          ${links}
          ${authBlock}
        </div>
      </div>
    </nav>
  `;
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
            <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
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
        <div>تصميم وتطوير <strong>${CREATOR}</strong> · ${CREATOR_AR}</div>
      </div>
    </footer>
  `;
}

/* ---------- SEO structured data ---------- */
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
    url: 'https://ascend-platform.com',
    description: 'منصة تعليمية متكاملة لطلاب الصف الثالث الثانوي — شعبة علمي علوم',
    inLanguage: 'ar-EG',
    areaServed: 'EG',
    founder: {
      '@type': 'Person',
      name: CREATOR,
      alternateName: CREATOR_AR
    },
    creator: {
      '@type': 'Person',
      name: CREATOR,
      alternateName: CREATOR_AR
    }
  });
  document.head.appendChild(script);
}