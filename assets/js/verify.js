// ============================================
// ASCEND · Verify Phone via Telegram
// Created by Mohamed Hamouda
// ============================================

import { supabase } from './supabase.js';
import { $, escapeHtml } from './utils.js';

/* ========== TELEGRAM BOT ========== */
const TELEGRAM_BOT_USERNAME = 'ascend_platform_bot';

/* ========== AUTH ========== */
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  location.href = '/login.html';
  throw new Error('No session');
}
const user = session.user;

/* ========== STATE ========== */
let currentCode = null;
let pollingInterval = null;
let attempts = 0;
const MAX_ATTEMPTS = 90; /* 3 minutes */

/* ========== DOM ========== */
const steps = {
  1: $('#step1'),
  2: $('#step2'),
  3: $('#step3')
};

const phoneDisplay = $('#phoneDisplay');
const alertBox = $('#alert');
const confirmBtn = $('#confirmBtn');
const reopenBtn = $('#reopenTelegramBtn');
const backBtn = $('#backBtn');

/* ========== HELPERS ========== */
function showStep(num) {
  Object.entries(steps).forEach(([key, el]) => {
    if (el) el.classList.toggle('active', parseInt(key) === num);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showAlert(msg) {
  if (!alertBox) return;
  alertBox.textContent = msg;
  alertBox.className = 'alert alert-error show';
}

function clearAlert() {
  if (alertBox) alertBox.classList.remove('show');
}

function setLoading(btn, loading, text) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span><span>جارٍ التحضير…</span>'
    : `<span>${text}</span>`;
}

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function buildTelegramUrl(code) {
  return `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`;
}

/* ========== CHECK VERIFIED ========== */
async function checkVerified() {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('telegram_verified')
      .eq('id', user.id)
      .single();

    if (error) return false;
    return profile?.telegram_verified === true;
  } catch (err) {
    return false;
  }
}

/* ========== POLLING ========== */
function startPolling() {
  stopPolling();
  attempts = 0;

  pollingInterval = setInterval(async () => {
    attempts++;

    /* Time out */
    if (attempts > MAX_ATTEMPTS) {
      stopPolling();
      showAlert('انتهت مدة التحقق. حاول تاني.');
      showStep(1);
      return;
    }

    /* Check */
    const verified = await checkVerified();
    if (verified) {
      stopPolling();
      onVerified();
    }
  }, 2000); /* Every 2 seconds */
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/* ========== ON VERIFIED ========== */
function onVerified() {
  showStep(3);

  /* Save to localStorage (optional) */
  try {
    localStorage.setItem('ascend:verified', 'true');
  } catch (err) { /* ignore */ }

  /* Auto-redirect after 3 seconds */
  setTimeout(() => {
    location.href = '/dashboard.html';
  }, 3000);
}

/* ========== GET PHONE ========== */
async function loadProfile() {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('phone, telegram_verified, full_name')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    /* Already verified → step 3 */
    if (profile?.telegram_verified) {
      showStep(3);
      setTimeout(() => {
        location.href = '/dashboard.html';
      }, 2000);
      return;
    }

    /* Show phone */
    if (profile?.phone && phoneDisplay) {
      phoneDisplay.textContent = profile.phone;
    } else if (phoneDisplay) {
      phoneDisplay.textContent = '—';
    }

    /* Fallback to user metadata */
    if (!profile?.phone && phoneDisplay) {
      const metaPhone = user.user_metadata?.phone;
      if (metaPhone) phoneDisplay.textContent = metaPhone;
    }

  } catch (err) {
    console.error('[ASCEND] Profile load failed:', err);
  }
}

/* ========== CONFIRM BUTTON ========== */
confirmBtn?.addEventListener('click', async () => {
  clearAlert();

  /* Get phone */
  const phone = phoneDisplay?.textContent?.trim() || '';

  if (!phone || phone === '—') {
    showAlert('مفيش رقم تليفون في حسابك. تواصل مع الدعم.');
    return;
  }

  /* Validate Egyptian phone */
  const PHONE_RE = /^01[0125]\d{8}$/;
  if (!PHONE_RE.test(phone)) {
    showAlert('رقم التليفون غير صحيح. تواصل مع الدعم.');
    return;
  }

  setLoading(confirmBtn, true, 'تأكيد الرقم');

  try {
    /* 1. Generate code */
    const code = generateCode();
    currentCode = code;

    /* 2. Save to DB */
    const { error: insertErr } = await supabase
      .from('telegram_links')
      .insert({
        user_id: user.id,
        code: code,
        used: false
      });

    if (insertErr) throw insertErr;

    /* 3. Save to localStorage (for backup) */
    try {
      localStorage.setItem('ascend:pending:code', code);
    } catch (err) { /* ignore */ }

    /* 4. Open Telegram */
    const telegramUrl = buildTelegramUrl(code);
    window.open(telegramUrl, '_blank');

    /* 5. Show waiting step */
    showStep(2);

    /* 6. Start polling */
    startPolling();

  } catch (err) {
    console.error('[ASCEND] Confirm failed:', err);
    showAlert('تعذّر تجهيز الكود. حاول تاني.');
  }

  setLoading(confirmBtn, false, 'تأكيد الرقم');
});

/* ========== REOPEN TELEGRAM ========== */
reopenBtn?.addEventListener('click', () => {
  if (!currentCode) {
    showAlert('مفيش كود حالي. اضغط "رجوع" وحاول تاني.');
    return;
  }
  window.open(buildTelegramUrl(currentCode), '_blank');
});

/* ========== BACK BUTTON ========== */
backBtn?.addEventListener('click', () => {
  stopPolling();
  showStep(1);
  clearAlert();
});

/* ========== CHECK ON FOCUS ========== */
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && steps[2]?.classList.contains('active')) {
    const verified = await checkVerified();
    if (verified) {
      stopPolling();
      onVerified();
    }
  }
});

/* ========== INIT ========== */
(async function init() {
  showStep(1);
  await loadProfile();
})();