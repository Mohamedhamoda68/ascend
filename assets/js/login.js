// ============================================
// ASCEND · Login
// Created by Mohamed Hamouda
// ============================================

import { supabase } from './supabase.js';
import { $ } from './utils.js';

/* ========== DOM ========== */
const loginSection = $('#loginSection');
const rolePickerSection = $('#rolePickerSection');
const form = $('#loginForm');
const alertBox = $('#alert');
const submitBtn = $('#submitBtn');
const emailField = $('#emailField');
const passwordField = $('#passwordField');
const backToLoginBtn = $('#backToLoginBtn');

/* ========== PATTERNS ========== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ========== HELPERS ========== */
function clearErrors() {
  emailField?.classList.remove('has-error');
  passwordField?.classList.remove('has-error');
  alertBox?.classList.remove('show');
}

function showAlert(msg, type = 'error') {
  if (!alertBox) return;
  alertBox.textContent = msg;
  alertBox.className = `alert alert-${type} show`;
}

function setLoading(btn, loading, text) {
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span><span>جارٍ التحقق…</span>'
    : `<span>${text}</span>`;
}

function showRolePicker() {
  loginSection.style.display = 'none';
  rolePickerSection.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showLoginForm() {
  rolePickerSection.style.display = 'none';
  loginSection.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ========== SUBMIT ========== */
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const email = form.email.value.trim();
  const password = form.password.value;

  /* Validation */
  let valid = true;
  if (!EMAIL_RE.test(email)) { emailField.classList.add('has-error'); valid = false; }
  if (!password || password.length < 6) { passwordField.classList.add('has-error'); valid = false; }
  if (!valid) return;

  setLoading(submitBtn, true);

  try {
    /* 1. Sign in */
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes('Invalid login')) {
        showAlert('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      } else if (error.message.includes('Email not confirmed')) {
        showAlert('يرجى تأكيد بريدك الإلكتروني أولًا.');
      } else {
        showAlert('حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.');
      }
      setLoading(submitBtn, false, 'تسجيل الدخول');
      return;
    }

    /* 2. Get profile */
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, roles, status, telegram_verified')
      .eq('id', data.user.id)
      .single();

    /* 3. Get roles array (fallback to single role) */
    let userRoles = profile?.roles || [];
    if (userRoles.length === 0) {
      userRoles = [profile?.role || 'student'];
    }

    /* 4. Check account status */
    const status = profile?.status || 'pending';

    if (status === 'pending') {
      /* If phone not verified → go to verify page */
      if (!profile?.telegram_verified) {
        location.href = '/verify.html';
        return;
      }
      showAlert('حسابك قيد المراجعة. سيتم تفعيله قريبًا.', 'info');
      await supabase.auth.signOut();
      setLoading(submitBtn, false, 'تسجيل الدخول');
      return;
    }

    if (status === 'suspended') {
      showAlert('حسابك موقوف. تواصل مع الإدارة.', 'error');
      await supabase.auth.signOut();
      setLoading(submitBtn, false, 'تسجيل الدخول');
      return;
    }

    /* 5. Redirect based on roles */
    if (userRoles.length > 1) {
      /* Multi-role → show picker */
      setLoading(submitBtn, false, 'تسجيل الدخول');
      showRolePicker();
      return;
    }

    /* Single role → direct redirect */
    const singleRole = userRoles[0];

    if (singleRole === 'admin') {
      location.href = '/admin.html';
    } else if (singleRole === 'parent') {
      location.href = '/parent.html';
    } else {
      location.href = '/dashboard.html';
    }

  } catch (err) {
    console.error('[ASCEND] Login error:', err);
    showAlert('تعذّر الاتصال بالخادم. تحقّق من الإنترنت.');
    setLoading(submitBtn, false, 'تسجيل الدخول');
  }
});

/* ========== ROLE PICKER ========== */
document.querySelectorAll('.role-option').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    if (target) {
      location.href = target;
    }
  });
});

/* ========== BACK TO LOGIN ========== */
backToLoginBtn?.addEventListener('click', async () => {
  /* Sign out before going back */
  await supabase.auth.signOut();
  showLoginForm();

  /* Clear password */
  if (form?.password) form.password.value = '';
});

/* ========== LIVE VALIDATION ========== */
form?.email?.addEventListener('blur', () => {
  if (form.email.value && !EMAIL_RE.test(form.email.value.trim())) {
    emailField.classList.add('has-error');
  } else {
    emailField.classList.remove('has-error');
  }
});

/* ========== AUTO-FOCUS ========== */
window.addEventListener('load', () => {
  form?.email?.focus();
});