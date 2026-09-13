const PLATFORMS = ['微信', '微博', '抖音', 'GitHub', '其他'];
const MAX_BODY_BYTES = 8192;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_PATTERN = /^https?:\/\/[^\s]+\.[^\s]{2,}$/i;

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

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === '/api/submit') {
      if (request.method !== 'POST') return fail(405, 'method not allowed');
      return handleSubmit(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
