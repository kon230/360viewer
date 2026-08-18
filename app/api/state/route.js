import { del, list, put } from '@vercel/blob';
import { NextResponse } from 'next/server';

// Shared editor state (camera positions/names/markers) lives in a single
// JSON blob so every visitor's page load sees the latest saved edits,
// instead of each browser only seeing its own localStorage copy.
const STATE_PATH = 'state/cameras.json';

export async function GET() {
  try {
    const { blobs } = await list({ prefix: STATE_PATH, limit: 1 });
    const blob = blobs.find((b) => b.pathname === STATE_PATH);
    if (!blob) {
      return NextResponse.json({ cameras: null });
    }
    const res = await fetch(blob.url, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ cameras: null });
    const data = await res.json();
    return NextResponse.json({ cameras: Array.isArray(data?.cameras) ? data.cameras : null });
  } catch (err) {
    // No Blob store connected yet (e.g. local dev before setup) — the
    // client falls back to the built-in defaults.
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
    // Overwrite semantics differ across @vercel/blob versions (some need
    // `allowOverwrite`, older ones reject writing an existing pathname
    // outright) — deleting the previous blob first keeps this working
    // either way.
    try {
      const { blobs } = await list({ prefix: STATE_PATH, limit: 1 });
      const existing = blobs.find((b) => b.pathname === STATE_PATH);
      if (existing) await del(existing.url);
    } catch (cleanupErr) {
      // Non-fatal: fall through and try the write anyway.
    }
    await put(STATE_PATH, JSON.stringify({ cameras: body.cameras }), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      cacheControlMaxAge: 0,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}
