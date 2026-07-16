import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireAdmin, unauthorized } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = requireAdmin(req);
  if (!session) return unauthorized();
  const admin = getDb()
    .prepare('SELECT id, username FROM admins WHERE id = ?')
    .get(session.ref_id) as { id: number; username: string } | undefined;
  if (!admin) return unauthorized();
  return NextResponse.json({ ok: true, admin });
}
