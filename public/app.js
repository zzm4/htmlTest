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

const entriesPass = document.getElementById('entries-pass');
const entriesBtn = document.getElementById('entries-btn');
const entriesBanner = document.getElementById('entries-banner');
const entriesList = document.getElementById('entries-list');
const entriesMeta = document.getElementById('entries-meta');
const entryCards = document.getElementById('entry-cards');
const entriesEmpty = document.getElementById('entries-empty');
const entriesRefresh = document.getElementById('entries-refresh');

function setEntriesBanner(message) {
  entriesBanner.hidden = !message;
  entriesBanner.textContent = message || '';
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function appendEntryField(list, label, value, href) {
  const term = document.createElement('dt');
  const detail = document.createElement('dd');
  term.textContent = label;

  if (!value) {
    detail.textContent = '未填写';
    detail.classList.add('empty');
  } else if (href) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = value;
    detail.append(link);
  } else {
    detail.textContent = value;
  }

  list.append(term, detail);
}

function renderEntries(items, total) {
  entryCards.replaceChildren();
  entriesEmpty.hidden = items.length > 0;

  for (const item of items) {
    const card = document.createElement('li');
    card.className = 'entry';

    const head = document.createElement('div');
    head.className = 'entry-head';
    const name = document.createElement('strong');
    name.textContent = item.accountName || '未填写';
    head.append(name);

    if (item.platform) {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = item.platform;
      head.append(tag);
    }

    if (item.submittedAt) {
      const time = document.createElement('time');
      time.className = 'entry-time';
      time.dateTime = item.submittedAt;
      time.textContent = formatTime(item.submittedAt);
      head.append(time);
    }

    const body = document.createElement('dl');
    body.className = 'entry-body';
    appendEntryField(body, '联系邮箱', item.email, '');
    const homepage = String(item.homepage || '');
    appendEntryField(body, '主页链接', homepage, URL_PATTERN.test(homepage) ? homepage : '');
    appendEntryField(body, '备注', item.remark, '');

    card.append(head, body);
    entryCards.append(card);
  }

  entriesMeta.textContent = `共 ${total} 条，显示最新 ${items.length} 条`;
  entriesList.hidden = false;
}

async function loadEntries() {
  const passphrase = entriesPass.value;
  if (!passphrase.trim()) {
    setEntriesBanner('请先输入查看口令');
    entriesPass.focus();
    return;
  }

  entriesBtn.disabled = true;
  entriesRefresh.disabled = true;
  setEntriesBanner('');

  try {
    const response = await fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    });

    if (response.status === 403) {
      setEntriesBanner('口令不正确，请重试');
      return;
    }
    if (response.status === 503) {
      setEntriesBanner('查看功能尚未配置，请联系站长');
      return;
    }
    if (!response.ok) {
      setEntriesBanner('服务暂时不可用，请稍后重试');
      return;
    }

    const data = await response.json();
    renderEntries(Array.isArray(data.items) ? data.items : [], data.total ?? 0);
  } catch {
    setEntriesBanner('网络异常，未能加载列表，请检查网络后重试');
  } finally {
    entriesBtn.disabled = false;
    entriesRefresh.disabled = false;
  }
}

entriesBtn.addEventListener('click', loadEntries);
entriesRefresh.addEventListener('click', loadEntries);
entriesPass.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    loadEntries();
  }
});
