import { get, put } from '@vercel/blob';
import { NextResponse } from 'next/server';

// Shared editor state (camera positions/names/markers) lives in a single
// JSON blob so every visitor's page load sees the latest saved edits,
// instead of each browser only seeing its own localStorage copy.
//
// Public Blob URLs sit behind a CDN cache with a 60-second minimum TTL, so a
// plain `fetch(blob.url)` right after a save can return stale data. `get()`
// with `useCache: false` reads straight from origin storage instead,
// guaranteeing the read reflects the latest write.
const STATE_PATH = 'state/cameras.json';

export async function GET() {
  try {
    const result = await get(STATE_PATH, { access: 'public', useCache: false });
    if (!result?.stream) {
      return NextResponse.json({ cameras: null });
    }
    const text = await new Response(result.stream).text();
    const data = JSON.parse(text);
    return NextResponse.json({ cameras: Array.isArray(data?.cameras) ? data.cameras : null });
  } catch (err) {
    // No Blob store connected yet (e.g. local dev before setup), or the
    // state file doesn't exist yet — the client falls back to defaults.
    return NextResponse.json({ cameras: null });
  }
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!Array.isArray(body?.cameras)) {
    return NextResponse.json({ error: 'cameras must be an array' }, { status: 400 });
  }
  try {
    await put(STATE_PATH, JSON.stringify({ cameras: body.cameras }), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
