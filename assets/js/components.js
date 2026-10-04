// ============================================
// ASCEND · Shared Components
// Nav + Footer + Theme Toggle
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { $, el, escapeHtml } from './utils.js';
import './theme.js'; // ⬅️ يشغّل Theme Manager تلقائياً

const CREATOR = 'Mohamed Hamouda';
const CREATOR_AR = 'محمد حموده';

// ═══════════════════════════════════════════
// بيانات التواصل
// ═══════════════════════════════════════════
const PHONE_DISPLAY = '01227907756';
const PHONE_INTL    = '2012227907756';
const WHATSAPP_URL  = `https://wa.me/${PHONE_INTL}?text=${encodeURIComponent('السلام عليكم، محتاج مساعدة في منصة ASCEND')}`;

const NAV_LINKS = [
  { href: '/#subjects', label: 'المواد' },
  { href: '/#features', label: 'المميزات' },
  { href: '/#faq',      label: 'الأسئلة' }
];

/* ---------- SVG Icons ---------- */
const BRAND_SVG = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 17L17 7M17 7H9M17 7v8"/>
  </svg>`;

const WA_SVG = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:14px;height:14px">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>`;

const THEME_TOGGLE_HTML = `
  <button class="theme-toggle" aria-label="تبديل الوضع" type="button">
    <svg class="icon-moon" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
    <svg class="icon-sun" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  </button>
`;

/* ============================================
   Render Nav
   ============================================ */
export async function renderNav({ auth = true } = {}) {
  const mount = document.getElementById('site-nav');
  if (!mount) return;

  const links = NAV_LINKS.map(l =>
    `<a href="${l.href}">${l.label}</a>`
  ).join('');

  let authBlock = `
    ${THEME_TOGGLE_HTML}
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
          ${THEME_TOGGLE_HTML}
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
        <div class="nav-brand-group">
          <a href="/" class="brand" aria-label="ASCEND - الصفحة الرئيسية">
            <span class="brand-mark">${BRAND_SVG}</span>
            ASCEND
          </a>
          <span class="nav-creator" title="من إنشاء محمد حموده">
            <span class="nav-creator-sep">by</span>
            <span class="nav-creator-name">Mohamed Hamouda</span>
          </span>
        </div>
        <div class="nav-menu">
          ${links}
          ${authBlock}
        </div>
      </div>
    </nav>
  `;

  // Wire up theme toggle
  mount.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      window.ASCEND_THEME?.toggle?.();
    });
  });
}

/* ============================================
   Render Footer
   ============================================ */
export function renderFooter() {
  const mount = document.getElementById('site-footer');
  if (!mount) return;
  const year = new Date().getFullYear();

  mount.innerHTML = `
    <footer role="contentinfo" class="footer">
      <div class="footer-grid">

        <div class="footer-brand">
          <a href="/" class="brand" aria-label="ASCEND">
            <span class="brand-mark">${BRAND_SVG}</span>
            ASCEND
          </a>
          <p>منصة تعليمية متكاملة لطلاب الصف الثالث الثانوي — شعبة علمي علوم. كل ما تحتاجه للتفوق في مكان واحد.</p>

          <div class="footer-credit">
            <div class="footer-credit-icon">
              <svg viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/></svg>
            </div>
            <div>
              <div class="footer-credit-label">من إنشاء</div>
              <div class="footer-credit-name">${CREATOR_AR}</div>
              <div class="footer-credit-en">${CREATOR}</div>
            </div>
          </div>

          <a href="${WHATSAPP_URL}" target="_blank" rel="noopener" class="footer-whatsapp">
            ${WA_SVG}
            <span>${PHONE_DISPLAY}</span>
          </a>
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
            <li><a href="/dashboard.html">لوحتي</a></li>
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
        <div class="footer-bottom-creator">
          <span>تصميم وتطوير</span>
          <strong>${CREATOR}</strong>
          <span>·</span>
          <strong>${CREATOR_AR}</strong>
        </div>
      </div>
    </footer>
  `;
}

/* ============================================
   SEO structured data
   ============================================ */
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
    telephone: '+20' + PHONE_INTL.slice(2),
    founder: {
      '@type': 'Person',
      name: CREATOR,
      alternateName: CREATOR_AR,
      telephone: '+20' + PHONE_INTL.slice(2)
    },
    creator: {
      '@type': 'Person',
      name: CREATOR,
      alternateName: CREATOR_AR
    }
  });
  document.head.appendChild(script);
      }
