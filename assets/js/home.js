// ============================================
// ASCEND · Home Page Logic
// Created by Mohamed Hamouda | محمد حموده
// ============================================

import { supabase } from './supabase.js';
import { renderNav, renderFooter, injectStructuredData } from './components.js';
import { escapeHtml, withRetry, cache } from './utils.js';

/* ============================================
   0) SAFE INIT (بيشتغل حتى لو في error)
   ============================================ */
async function safeInit() {
  // Nav + Footer (مع حماية من الأخطاء)
  try {
    injectStructuredData();
  } catch (e) { console.warn('[ASCEND] injectStructuredData failed:', e); }

  try {
    await renderNav();
  } catch (e) { console.error('[ASCEND] renderNav failed:', e); }

  try {
    renderFooter();
  } catch (e) { console.warn('[ASCEND] renderFooter failed:', e); }

  // Main content
  try {
    await Promise.all([
      loadSubjects(),
      loadCounts()
    ]);
  } catch (e) { console.error('[ASCEND] load failed:', e); }

  // UI enhancements (كلها مستقلة — لو واحدة فشلت مش بتأثر على التانية)
  const uiInits = [
    initFAQ, initSmoothScroll, initStickyNav, initProgressBar,
    initBackToTop, initLazyImages, initScrollReveal,
    initTypingEffect, initParallax, initPrefetch, consoleBranding
  ];

  uiInits.forEach(fn => {
    try { fn(); } catch (e) { console.warn('[ASCEND] UI init failed:', fn.name, e); }
  });
}

/* ============================================
   1) STATE
   ============================================ */
const State = {
  subjects: [],
  counts: { subjects: 0, chapters: 0, lessons: 0 },
  isLoaded: false,
  scrollY: 0
};

/* ============================================
   2) HELPERS
   ============================================ */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const on = (el, evt, fn, opts) => el?.addEventListener(evt, fn, opts);

function throttle(fn, limit = 100) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

function animateNumber(el, target, duration = 1200) {
  if (!el) return;
  const startTime = performance.now();
  const easing = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const value = Math.floor(easing(progress) * target);
    el.textContent = value.toLocaleString('ar-EG');
    if (progress < 1) requestAnimationFrame(frame);
    else el.textContent = target.toLocaleString('ar-EG');
  }
  requestAnimationFrame(frame);
}

/* ============================================
   3) ELEMENTS
   ============================================ */
const grid = $('#subjectsGrid');
const elSubjects = $('#heroStatSubjects');
const elChapters = $('#heroStatChapters');
const elLessons  = $('#heroStatLessons');

/* ============================================
   4) SKELETON
   ============================================ */
function renderSkeleton() {
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 5 }).map(() => `
    <div class="subject skeleton-card">
      <div class="subject-head">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex:1">
          <div class="skeleton skeleton-line" style="width:40%"></div>
          <div class="skeleton skeleton-line" style="width:60%;height:11px;margin-top:6px"></div>
        </div>
      </div>
      <div class="skeleton skeleton-line" style="width:90%;margin-top:14px"></div>
      <div class="skeleton skeleton-line" style="width:70%"></div>
    </div>
  `).join('');
}

/* ============================================
   5) RENDER SUBJECTS
   ============================================ */
function renderSubjects(subjects) {
  if (!grid) return;

  if (!subjects || subjects.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px 0">
        <p style="color:var(--fg-4);font-size:14px;margin-bottom:12px">لا توجد مواد متاحة حاليًا.</p>
        <button class="btn btn-ghost btn-sm" id="retrySubjects">إعادة المحاولة</button>
      </div>
    `;
    on($('#retrySubjects'), 'click', () => loadSubjects(true));
    return;
  }

  grid.innerHTML = subjects.map((s, i) => {
    const teachers = (s.teachers || []).map(t => t.name).join(' · ');
    const initial = (s.name || '?').trim().charAt(0);
    const accent = s.color || '#8B5CF6';

    return `
      <a href="/register.html"
         class="subject"
         data-index="${i}"
         style="--subject-accent:${escapeHtml(accent)}">
        <div class="subject-head">
          <div class="subject-icon"><span>${escapeHtml(initial)}</span></div>
          <div>
            <h3>${escapeHtml(s.name)}</h3>
            <div class="meta">${escapeHtml(teachers || 'قريبًا')}</div>
          </div>
        </div>
        <p>${escapeHtml(s.description || '')}</p>
      </a>
    `;
  }).join('');

  observeSubjectCards();
}

/* ============================================
   6) SCROLL REVEAL
   ============================================ */
function observeSubjectCards() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  $$('.subject[data-index]').forEach((el, i) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = `opacity 0.5s ease ${i * 0.08}s, transform 0.5s ease ${i * 0.08}s`;
    observer.observe(el);
  });
}

/* ============================================
   7) LOAD SUBJECTS
   ============================================ */
async function loadSubjects(force = false) {
  if (State.isLoaded && !force) return;
  if (!grid) return;

  if (!force && cache?.get) {
    const cached = cache.get('subjects');
    if (cached && cached.length > 0) {
      State.subjects = cached;
      State.counts.subjects = cached.length;
      renderSubjects(cached);
      animateNumber(elSubjects, cached.length);
      State.isLoaded = true;
      return;
    }
  }

  renderSkeleton();

  try {
    const data = await withRetry(async () => {
      const { data, error } = await supabase
        .from('subjects')
        .select('id, name, slug, color, description, teachers(name)')
        .order('id');
      if (error) throw error;
      return data || [];
    }, { retries: 2 });

    State.subjects = data;
    State.counts.subjects = data.length;
    renderSubjects(data);
    animateNumber(elSubjects, data.length);
    if (cache?.set) cache.set('subjects', data, 10 * 60 * 1000);
    State.isLoaded = true;
  } catch (err) {
    console.error('[ASCEND] Subjects failed:', err);
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px 0">
        <p style="color:#F85149;font-size:14px;margin-bottom:12px">تعذّر تحميل المواد. تحقّق من اتصالك.</p>
        <button class="btn btn-ghost btn-sm" id="retrySubjects2">إعادة المحاولة</button>
      </div>
    `;
    on($('#retrySubjects2'), 'click', () => loadSubjects(true));
  }
}

/* ============================================
   8) LOAD COUNTS
   ============================================ */
async function loadCounts() {
  try {
    const [ch, ls] = await Promise.all([
      supabase.from('chapters').select('*', { count: 'exact', head: true }),
      supabase.from('lessons').select('*', { count: 'exact', head: true })
    ]);
    State.counts.chapters = ch.count ?? 0;
    State.counts.lessons = ls.count ?? 0;
    animateNumber(elChapters, State.counts.chapters, 1400);
    animateNumber(elLessons, State.counts.lessons, 1600);
  } catch (err) {
    console.error('[ASCEND] Counts failed:', err);
  }
}

/* ============================================
   9) FAQ ACCORDION (شغال مضمون)
   ============================================ */
function initFAQ() {
  const items = $$('.faq-item');
  if (!items.length) return;

  items.forEach(item => {
    const btn = item.querySelector('.faq-btn');
    const content = item.querySelector('.faq-content');
    if (!btn || !content) return;

    // لو الزر عنده listener قديم، نشيله الأول
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);

    newBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const isOpen = item.getAttribute('aria-expanded') === 'true';

      // اقفل الكل
      items.forEach(other => {
        if (other !== item) {
          other.setAttribute('aria-expanded', 'false');
          const c = other.querySelector('.faq-content');
          if (c) c.style.maxHeight = '0';
        }
      });

      // بدّل الحالي
      if (isOpen) {
        item.setAttribute('aria-expanded', 'false');
        content.style.maxHeight = '0';
      } else {
        item.setAttribute('aria-expanded', 'true');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
}

/* ============================================
   10) SMOOTH SCROLL
   ============================================ */
function initSmoothScroll() {
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const top = target.getBoundingClientRect().top + window.pageYOffset - 80;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });
}

/* ============================================
   11) STICKY NAV
   ============================================ */
function initStickyNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const handle = throttle(() => {
    nav.classList.toggle('nav-scrolled', window.scrollY > 20);
  }, 80);
  window.addEventListener('scroll', handle, { passive: true });
}

/* ============================================
   12) PROGRESS BAR
   ============================================ */
function initProgressBar() {
  const bar = document.createElement('div');
  bar.style.cssText = `position:fixed;top:0;left:0;height:3px;background:linear-gradient(90deg,#7C5CFF,#06B6D4,#F59E0B);width:0%;z-index:9999;transition:width 0.1s linear;pointer-events:none;`;
  document.body.appendChild(bar);
  const update = throttle(() => {
    const st = window.pageYOffset;
    const dh = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = dh > 0 ? `${(st / dh) * 100}%` : '0%';
  }, 30);
  window.addEventListener('scroll', update, { passive: true });
}

/* ============================================
   13) BACK TO TOP
   ============================================ */
function initBackToTop() {
  const btn = document.createElement('button');
  btn.setAttribute('aria-label', 'العودة للأعلى');
  btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`;
  btn.style.cssText = `position:fixed;bottom:100px;left:24px;width:44px;height:44px;border-radius:50%;border:1px solid rgba(124,92,255,0.3);background:rgba(124,92,255,0.1);color:#7C5CFF;cursor:pointer;display:grid;place-items:center;opacity:0;pointer-events:none;transition:all 0.3s ease;z-index:998;backdrop-filter:blur(8px);`;
  btn.querySelector('svg').style.cssText = 'width:18px;height:18px;';
  on(btn, 'click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  document.body.appendChild(btn);

  const toggle = throttle(() => {
    const show = window.scrollY > 400;
    btn.style.opacity = show ? '1' : '0';
    btn.style.pointerEvents = show ? 'auto' : 'none';
    btn.style.transform = show ? 'translateY(0)' : 'translateY(10px)';
  }, 100);
  window.addEventListener('scroll', toggle, { passive: true });
}

/* ============================================
   14) LAZY IMAGES
   ============================================ */
function initLazyImages() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        observer.unobserve(img);
      }
    });
  }, { rootMargin: '100px' });
  $$('img[data-src]').forEach(img => observer.observe(img));
}

/* ============================================
   15) SCROLL REVEAL
   ============================================ */
function initScrollReveal() {
  if (!('IntersectionObserver' in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -60px 0px' });

  $$('.section, .cta, .bento-item').forEach(el => {
    if (!el.classList.contains('revealed')) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(24px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
      observer.observe(el);
    }
  });
}

/* ============================================
   16) TYPING EFFECT
   ============================================ */
function initTypingEffect() {
  const el = document.querySelector('.hero h1 em');
  if (!el) return;
  const text = el.textContent.trim();
  if (!text) return;
  el.textContent = '';
  el.style.minHeight = '1.2em';

  const cursor = document.createElement('span');
  cursor.textContent = '|';
  cursor.style.cssText = 'color:#7C5CFF;font-weight:300;';
  el.appendChild(cursor);

  if (!document.getElementById('typing-blink-style')) {
    const style = document.createElement('style');
    style.id = 'typing-blink-style';
    style.textContent = '@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}';
    document.head.appendChild(style);
  }
  cursor.style.animation = 'blink 1s infinite';

  let i = 0;
  function type() {
    if (i < text.length) {
      el.insertBefore(document.createTextNode(text.charAt(i)), cursor);
      i++;
      setTimeout(type, 60);
    } else {
      setTimeout(() => { cursor.style.opacity = '0'; }, 1500);
    }
  }
  setTimeout(type, 400);
}

/* ============================================
   17) PARALLAX
   ============================================ */
function initParallax() {
  const bg = document.querySelector('.hero-bg');
  if (!bg) return;
  const handle = throttle(() => {
    const y = window.scrollY;
    if (y < window.innerHeight) bg.style.transform = `translateY(${y * 0.3}px)`;
  }, 16);
  window.addEventListener('scroll', handle, { passive: true });
}

/* ============================================
   18) PREFETCH
   ============================================ */
function initPrefetch() {
  const links = $$('a[href^="/"]');
  const prefetched = new Set();
  links.forEach(link => {
    link.addEventListener('mouseenter', () => {
      const href = link.getAttribute('href');
      if (!href || prefetched.has(href)) return;
      if (href.startsWith('/#') || href === '/') return;
      prefetched.add(href);
      const l = document.createElement('link');
      l.rel = 'prefetch';
      l.href = href;
      document.head.appendChild(l);
    }, { once: true });
  });
}

/* ============================================
   19) CONSOLE BRANDING
   ============================================ */
function consoleBranding() {
  const s1 = 'background:#7C5CFF;color:#fff;padding:8px 16px;border-radius:6px;font-weight:700;font-size:14px;';
  const s2 = 'background:#050506;color:#fff;padding:8px 16px;border-radius:6px;font-size:12px;';
  console.log('%cASCEND ↗', s1);
  console.log('%cمن إنشاء محمد حموده · Mohamed Hamouda', s2);
}

/* ============================================
   20) START
   ============================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeInit);
} else {
  safeInit();
}

/* ============================================
   21) EXPORTS (for testing)
   ============================================ */
export { loadSubjects, loadCounts, State };
