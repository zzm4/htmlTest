const form = document.getElementById('profile-form');
const result = document.getElementById('result');
const resultList = document.getElementById('result-list');
const resetBtn = document.getElementById('reset-btn');
const editBtn = document.getElementById('edit-btn');
const remark = document.getElementById('remark');
const remarkCount = document.getElementById('remark-count');
const banner = document.getElementById('submit-banner');
const submitBtn = form.querySelector('button[type="submit"]');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_PATTERN = /^https?:\/\/[^\s]+\.[^\s]{2,}/i;

const FIELDS = [
  { id: 'account-name', label: '账号名称', required: true },
  { id: 'platform', label: '所属平台', required: true },
  { id: 'email', label: '联系邮箱', required: true, kind: 'email' },
  { id: 'homepage', label: '主页链接', required: false, kind: 'url' },
  { id: 'remark', label: '备注', required: false },
];

function setError(field, message) {
  const wrapper = document.getElementById(field.id).closest('.field');
  wrapper.classList.toggle('invalid', Boolean(message));
  wrapper.querySelector('.error').textContent = message || '';
}

function setBanner(message) {
  banner.hidden = !message;
  banner.textContent = message || '';
}

function validateField(field) {
  const raw = document.getElementById(field.id).value.trim();

  if (!raw) {
    return field.required ? `请填写${field.label}` : '';
  }
  if (field.kind === 'email' && !EMAIL_PATTERN.test(raw)) {
    return '邮箱格式不正确，请检查后重试';
  }
  if (field.kind === 'url' && !URL_PATTERN.test(raw)) {
    return '链接需以 http:// 或 https:// 开头';
  }
  return '';
}

function collectPayload() {
  return {
    website: document.getElementById('website').value,
    accountName: document.getElementById('account-name').value.trim(),
    platform: document.getElementById('platform').value,
    email: document.getElementById('email').value.trim(),
    homepage: document.getElementById('homepage').value.trim(),
    remark: document.getElementById('remark').value.trim(),
  };
}

function showResult() {
  resultList.replaceChildren();

  for (const field of FIELDS) {
    const value = document.getElementById(field.id).value.trim();
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const detail = document.createElement('dd');

    term.textContent = field.label;
    detail.textContent = value || '未填写';
    if (!value) detail.classList.add('empty');

    row.append(term, detail);
    resultList.append(row);
  }

  form.hidden = true;
  result.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setBanner('');

  let firstInvalid = null;
  for (const field of FIELDS) {
    const message = validateField(field);
    setError(field, message);
    if (message && !firstInvalid) firstInvalid = field.id;
  }

  if (firstInvalid) {
    document.getElementById(firstInvalid).focus();
    return;
  }

  submitBtn.disabled = true;
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collectPayload()),
    });

    if (response.status === 400) {
      setBanner('提交的内容未通过校验，请检查后重试');
      return;
    }
    if (!response.ok) {
      setBanner('服务暂时不可用，请稍后重试');
      return;
    }
    showResult();
  } catch {
    setBanner('网络异常，提交未成功，请检查网络后重试');
  } finally {
    submitBtn.disabled = false;
  }
});

for (const field of FIELDS) {
  const input = document.getElementById(field.id);
  input.addEventListener('blur', () => setError(field, validateField(field)));
  input.addEventListener('input', () => {
    if (input.closest('.field').classList.contains('invalid')) {
      setError(field, validateField(field));
    }
  });
}

remark.addEventListener('input', () => {
  remarkCount.textContent = String(remark.value.length);
});

resetBtn.addEventListener('click', () => {
  form.reset();
  remarkCount.textContent = '0';
  setBanner('');
  for (const field of FIELDS) setError(field, '');
  document.getElementById('account-name').focus();
});

editBtn.addEventListener('click', () => {
  result.hidden = true;
  form.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
