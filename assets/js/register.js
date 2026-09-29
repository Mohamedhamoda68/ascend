// ============================================
// ASCEND · Register (Student + Parent)
// Created by Mohamed Hamouda
// ============================================
import { supabase } from './supabase.js';
import { $, escapeHtml } from './utils.js';

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
const parentPhoneField = document.getElementById('parentPhoneField');
const schoolField = document.getElementById('schoolField');

const fields = {
  full_name: document.getElementById('nameField'),
  email: document.getElementById('emailField'),
  phone: document.getElementById('phoneField'),
  governorate: document.getElementById('govField'),
  password: document.getElementById('passwordField'),
  parent_phone: parentPhoneField
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

    /* Toggle active state */
    roleOptions.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    /* Show/hide student-only fields */
    if (role === 'student') {
      studentOnlyFields.style.display = 'block';
    } else {
      studentOnlyFields.style.display = 'none';
      /* Clear student-only fields */
      document.getElementById('school').value = '';
      document.getElementById('parent_phone').value = '';
    }

    /* Clear errors */
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

  if (data.full_name.length < 2) {
    fields.full_name?.classList.add('has-error');
    valid = false;
  }

  if (!EMAIL_RE.test(data.email)) {
    fields.email?.classList.add('has-error');
    valid = false;
  }

  if (!PHONE_RE.test(data.phone)) {
    fields.phone?.classList.add('has-error');
    valid = false;
  }

  if (!data.governorate) {
    fields.governorate?.classList.add('has-error');
    valid = false;
  }

  if (data.password.length < 8) {
    fields.password?.classList.add('has-error');
    valid = false;
  }

  /* Parent phone validation (student only, optional) */
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

    /* 2. Update profile with role + parent_phone */
    if (authData.user) {
      /* Wait a bit for trigger to create profile */
      await new Promise(r => setTimeout(r, 800));

      const updateData = {
        role: data.role,
        parent_phone: data.parent_phone || null
      };

      /* Try update */
      try {
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', authData.user.id);
      } catch (err) {
        console.warn('Profile update failed:', err);
      }

      /* 3. Link parent to student if parent_phone matches */
      if (data.role === 'student' && data.parent_phone) {
        try {
          const { data: parentProfile } = await supabase
            .from('profiles')
            .select('id')
            .eq('phone', data.parent_phone)
            .eq('role', 'parent')
            .maybeSingle();

          if (parentProfile) {
            await supabase
              .from('profiles')
              .update({ parent_id: parentProfile.id })
              .eq('id', authData.user.id);
          }
        } catch (err) {
          console.warn('Parent link failed:', err);
        }
      }
    }

    /* 4. Show success */
    registerSection.style.display = 'none';
    successSection.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('[ASCEND] Register failed:', err);
    showAlert('تعذّر الاتصال بالخادم. تحقّق من الإنترنت.');
    setLoading(submitBtn, false, 'إنشاء الحساب');
  }
});

/* ========== LIVE INPUT ========== */
document.getElementById('phone')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
});

document.getElementById('parent_phone')?.addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '').slice(0, 11);
});

document.getElementById('email')?.addEventListener('blur', () => {
  const emailField = document.getElementById('email');
  if (emailField.value && !EMAIL_RE.test(emailField.value.trim())) {
    fields.email?.classList.add('has-error');
  } else {
    fields.email?.classList.remove('has-error');
  }
});

/* ========== AUTO-FOCUS ========== */
window.addEventListener('load', () => {
  document.getElementById('full_name')?.focus();
});