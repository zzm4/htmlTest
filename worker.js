const PLATFORMS = ['微信', '微博', '抖音', 'GitHub', '其他'];
const MAX_BODY_BYTES = 8192;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_PATTERN = /^https?:\/\/[^\s]+\.[^\s]{2,}$/i;
const LIST_LIMIT = 100;
const MAX_KEYS_SCANNED = 5000;

async function passphrasesMatch(provided, expected) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

function parseRecord(raw) {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function fail(status, message) {
  return Response.json({ ok: false, error: message }, { status });
}

async function handleSubmit(request, env) {
  if (!env.REGISTRY) {
    return fail(500, 'storage not configured');
  }

  let payload;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return fail(413, 'payload too large');
    payload = JSON.parse(text);
  } catch {
    return fail(400, 'invalid json');
  }

  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return fail(400, 'invalid json');
  }

  // Honeypot: bots fill it, humans never see it. Pretend to accept, store nothing.
  if (payload.website) {
    return Response.json({ ok: true }, { status: 201 });
  }

  const accountName = String(payload.accountName ?? '').trim();
  const platform = String(payload.platform ?? '').trim();
  const email = String(payload.email ?? '').trim();
  const homepage = String(payload.homepage ?? '').trim();
  const remark = String(payload.remark ?? '').trim();

  if (!accountName || accountName.length > 40) return fail(400, 'invalid accountName');
  if (!PLATFORMS.includes(platform)) return fail(400, 'invalid platform');
  if (!EMAIL_PATTERN.test(email) || email.length > 80) return fail(400, 'invalid email');
  if (homepage && (!URL_PATTERN.test(homepage) || homepage.length > 200)) return fail(400, 'invalid homepage');
  if (remark.length > 200) return fail(400, 'invalid remark');

  const record = {
    accountName,
    platform,
    email,
    homepage,
    remark,
    submittedAt: new Date().toISOString(),
  };
  const key = `${Date.now()}-${crypto.randomUUID()}`;
  await env.REGISTRY.put(key, JSON.stringify(record), {
    metadata: { platform, submittedAt: record.submittedAt },
  });

  return Response.json({ ok: true }, { status: 201 });
}

async function handleEntries(request, env) {
  if (!env.REGISTRY) {
    return fail(500, 'storage not configured');
  }
  if (!env.REGISTRY_PASSPHRASE) {
    return fail(503, 'viewer not configured');
  }

  let payload;
  try {
    const text = await request.text();
    if (text.length > 512) return fail(413, 'payload too large');
    payload = JSON.parse(text);
  } catch {
    return fail(400, 'invalid json');
  }

  const passphrase = String((payload && payload.passphrase) ?? '');
  if (!passphrase || !(await passphrasesMatch(passphrase, env.REGISTRY_PASSPHRASE))) {
    return fail(403, 'invalid passphrase');
  }

  const keys = [];
  let cursor;
  do {
    const page = await env.REGISTRY.list({ limit: 1000, cursor });
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && keys.length < MAX_KEYS_SCANNED);

  const newest = keys
    .map((key) => ({
      name: key.name,
      submittedAt: (key.metadata && key.metadata.submittedAt) || '',
    }))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt) || b.name.localeCompare(a.name))
    .slice(0, LIST_LIMIT);

  const values = await Promise.all(newest.map(async (entry) => {
    const raw = await env.REGISTRY.get(entry.name);
    if (!raw) return null;
    const record = parseRecord(raw);
    if (!record) return null;
    return { ...record, submittedAt: record.submittedAt || entry.submittedAt };
  }));

  return new Response(
    JSON.stringify({ ok: true, total: keys.length, items: values.filter(Boolean) }),
    { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } },
  );
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/submit') {
      if (request.method !== 'POST') return fail(405, 'method not allowed');
      return handleSubmit(request, env);
    }

    if (pathname === '/api/entries') {
      if (request.method !== 'POST') return fail(405, 'method not allowed');
      return handleEntries(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
