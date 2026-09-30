// ============================================
// ASCEND · Register (Student + Parent)
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { $ } from './utils.js';

/* ========== STATE ========== */
let selectedRole = 'student';

/* ========== DOM REFS ========== */
const form = document.getElementById('registerForm');
const alertBox = document.getElementById('alert');
const submitBtn = document.getElementById('submitBtn');
const registerSection = document.getElementById('registerSection');
const successSection = document.getElementById('successSection');

const roleOptions = document.querySelectorAll('.role-option');
const studentOnlyFields = document.getElementById('studentOnlyFields');

const fields = {
  full_name: document.getElementById('nameField'),
  email: document.getElementById('emailField'),
  phone: document.getElementById('phoneField'),
  governorate: document.getElementById('govField'),
  password: document.getElementById('passwordField'),
  parent_phone: document.getElementById('parentPhoneField')
};

/* ========== PATTERNS ========== */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^01[0125]\d{8}$/;

/* ========== ROLE PICKER ========== */
roleOptions.forEach(btn => {
  btn.addEventListener('click', () => {
    const role = btn.dataset.role;
    if (role === selectedRole) return;
    selectedRole = role;
    roleOptions.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (role === 'student') {
      studentOnlyFields.style.display = 'block';
    } else {
      studentOnlyFields.style.display = 'none';
      document.getElementById('school').value = '';
      document.getElementById('parent_phone').value = '';
    }
    clearErrors();
  });
});

/* ========== HELPERS ========== */
function clearErrors() {
  Object.values(fields).forEach(f => f?.classList.remove('has-error'));
  alertBox.classList.remove('show');
}

function setLoading(btn, loading, text) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner"></span><span>جارٍ إنشاء الحساب…</span>'
    : `<span>${text}</span>`;
}

function showAlert(msg, type = 'error') {
  alertBox.textContent = msg;
  alertBox.className = `alert alert-${type} show`;
}

/* ========== SUBMIT ========== */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const data = {
    full_name: form.full_name.value.trim(),
    email: form.email.value.trim(),
    phone: form.phone.value.trim(),
    governorate: form.governorate.value,
    password: form.password.value,
    school: form.school?.value.trim() || '',
    parent_phone: form.parent_phone?.value.trim() || '',
    role: selectedRole
  };

  /* ===== Validation ===== */
  let valid = true;
  if (data.full_name.length < 2) { fields.full_name?.classList.add('has-error'); valid = false; }
  if (!EMAIL_RE.test(data.email)) { fields.email?.classList.add('has-error'); valid = false; }
  if (!PHONE_RE.test(data.phone)) { fields.phone?.classList.add('has-error'); valid = false; }
  if (!data.governorate) { fields.governorate?.classList.add('has-error'); valid = false; }
  if (data.password.length < 8) { fields.password?.classList.add('has-error'); valid = false; }
  if (selectedRole === 'student' && data.parent_phone && !PHONE_RE.test(data.parent_phone)) {
    fields.parent_phone?.classList.add('has-error');
    valid = false;
  }
  if (!form.terms.checked) {
    showAlert('يجب الموافقة على الشروط وسياسة الخصوصية.');
    return;
  }
  if (!valid) return;

  /* ===== Submit ===== */
  setLoading(submitBtn, true);

  try {
    /* 1. Sign up */
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          phone: data.phone,
          governorate: data.governorate,
          school: data.school,
          parent_phone: data.parent_phone,
          role: data.role
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered')) {
        showAlert('هذا البريد الإلكتروني مسجّل بالفعل. جرّب تسجيل الدخول.');
      } else if (error.message.includes('password')) {
        showAlert('كلمة المرور غير قوية. استخدم 8 أحرف على الأقل.');
      } else {
        showAlert(error.message);
      }
      setLoading(submitBtn, false, 'إنشاء الحساب');
      return;
    }

    /* 2. Update profile */
    if (authData.user) {
      await new Promise(r => setTimeout(r, 800));
      try {
        await supabase.from('profiles').update({
          role: data.role,
          parent_phone: data.parent_phone || null
        }).eq('id', authData.user.id);
      } catch (err) { console.warn(err); }

      /* 3. Show success */
      registerSection.style.display = 'none';
      successSection.classList.add('show');
      successSection.innerHTML = `
        <div class="auth-success-icon" style="background:rgba(139,92,246,0.15);border-color:rgba(139,92,246,0.3);color:#A78BFA">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:40px;height:40px">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
        <h2>تم إنشاء حسابك!</h2>
        <p>هيتم توجيهك لتأكيد رقمك عبر Telegram</p>
        <div class="auth-success-note" style="background:rgba(139,92,246,0.1);border-color:rgba(139,92,246,0.3);color:#C4B5FD">
          ⏳ جاري التحويل...
        </div>
      `;
      window.scrollTo({ top: 0, behavior: 'smooth' });

      /* 4. Redirect to verify */
      setTimeout(() => {
        location.href = '/verify.html';
      }, 1500);
    }

  } catch (err) {
    console.error('[ASCEND] Register failed:', err);
    showAlert('تعذّر الاتصال بالخادم. تحقّق من الإنترنت.');
    setLoading(submitBtn, false, 'إنشاء الحساب');
  }
});

/* ========== LIVE VALIDATION ========== */
document.getElementById('phone')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
});

document.getElementById('parent_phone')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
});

/* ========== AUTO-FOCUS ========== */
window.addEventListener('load', () => {
  document.getElementById('full_name')?.focus();
});