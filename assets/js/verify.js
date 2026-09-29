// ============================================
// ASCEND · Verify Phone via Telegram
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { $, escapeHtml, toast } from './utils.js';

/* ⚠️ غيّر الـ username ده لو غيّرته */
const TELEGRAM_BOT_USERNAME = 'ascend_platform_bot';

/* ========== AUTH ========== */
const { data: { session } } = await supabase.auth.getSession();
if (!session) { location.href = '/login.html'; throw new Error('No session'); }
const user = session.user;

/* ========== STATE ========== */
let currentCode = null;
let currentPhone = null;
let checkInterval = null;

/* ========== HELPERS ========== */
function showStep(num) {
  document.querySelectorAll('.verify-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${num}`)?.classList.add('active');
}

function showAlert(msg, type = 'error') {
  const box = document.getElementById('alert1');
  box.textContent = msg;
  box.className = `alert alert-${type} show`;
}

function clearAlert() {
  document.getElementById('alert1').classList.remove('show');
}

function setLoading(btn, loading, text) {
  btn.disabled = loading;
  if (loading) {
    btn.innerHTML = '<span class="spinner"></span><span>جارٍ الإرسال…</span>';
  } else {
    btn.innerHTML = `<span>${text}</span>`;
  }
}

/* ========== GENERATE CODE ========== */
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/* ========== SEND CODE ========== */
document.getElementById('sendCodeBtn')?.addEventListener('click', async () => {
  clearAlert();

  const phone = document.getElementById('phone').value.trim();
  const PHONE_RE = /^01[0125]\d{8}$/;

  if (!PHONE_RE.test(phone)) {
    showAlert('رقم تليفون غير صحيح (11 رقم، يبدأ بـ 01)');
    return;
  }

  const btn = document.getElementById('sendCodeBtn');
  setLoading(btn, true);

  try {
    /* 1. Generate code */
    const code = generateCode();

    /* 2. Save to DB */
    const { error: insertErr } = await supabase
      .from('telegram_links')
      .insert({
        user_id: user.id,
        code: code,
        used: false
      });

    if (insertErr) throw insertErr;

    /* 3. Update profile with phone */
    await supabase
      .from('profiles')
      .update({ phone })
      .eq('id', user.id);

    currentCode = code;
    currentPhone = phone;

    /* 4. Show code + open Telegram button */
    document.getElementById('codeValue').textContent = code;

    const telegramUrl = `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`;
    document.getElementById('openTelegramBtn').href = telegramUrl;

    showStep(2);

    /* 5. Start polling */
    startPolling();

  } catch (err) {
    console.error('[ASCEND] Send code failed:', err);
    showAlert('تعذّر إرسال الكود. حاول تاني.');
  }

  setLoading(btn, false, 'إرسال الكود على Telegram');
});

/* ========== POLLING (CHECK IF VERIFIED) ========== */
function startPolling() {
  if (checkInterval) clearInterval(checkInterval);

  let attempts = 0;
  const maxAttempts = 60; // 60 seconds

  checkInterval = setInterval(async () => {
    attempts++;

    if (attempts > maxAttempts) {
      clearInterval(checkInterval);
      return;
    }

    const verified = await checkVerification();
    if (verified) {
      clearInterval(checkInterval);
      onVerified();
    }
  }, 2000); // Check every 2 seconds
}

async function checkVerification() {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_verified, telegram_chat_id')
      .eq('id', user.id)
      .single();

    return profile?.telegram_verified === true;
  } catch (err) {
    return false;
  }
}

/* ========== MANUAL CHECK ========== */
document.getElementById('checkVerifiedBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('checkVerifiedBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span><span>جارٍ التحقق…</span>';

  const verified = await checkVerification();

  if (verified) {
    clearInterval(checkInterval);
    onVerified();
  } else {
    btn.disabled = false;
    btn.innerHTML = '<span>✓ فعلت التحقق، تابع</span>';
    toast('لسه مستنيين تأكيد من Telegram', 'info');
  }
});

/* ========== ON VERIFIED ========== */
function onVerified() {
  showStep(3);
  toast('تم التحقق بنجاح ✅', 'success');
}

/* ========== BACK ========== */
document.getElementById('backBtn')?.addEventListener('click', () => {
  if (checkInterval) clearInterval(checkInterval);
  showStep(1);
  clearAlert();
});

/* ========== PHONE INPUT ========== */
document.getElementById('phone')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
});

/* ========== INIT ========== */
(async function init() {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('telegram_verified, phone')
      .eq('id', user.id)
      .single();

    /* Already verified → show success */
    if (profile?.telegram_verified) {
      showStep(3);
      return;
    }

    /* Pre-fill phone if exists */
    if (profile?.phone) {
      document.getElementById('phone').value = profile.phone;
    }

    showStep(1);
  } catch (err) {
    console.error(err);
    showStep(1);
  }
})();