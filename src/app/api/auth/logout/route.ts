import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, destroySession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  destroySession(req);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(req, res);
  return res;
}
