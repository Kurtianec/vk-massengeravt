import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, COOKIE_NAME } from '@/lib/auth';

export const maxDuration = 10;

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const payload = verifySessionToken(token);
    if (!payload) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Try to verify user exists in DB, but don't crash if DB is unavailable
    try {
      const { db } = await import('@/lib/db');
      const user = await db.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, name: true, role: true },
      });

      if (!user) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
      }

      return NextResponse.json({ authenticated: true, user });
    } catch (dbError) {
      // DB unavailable — trust the JWT token as fallback
      console.error('DB unavailable during session check, using token fallback');
      return NextResponse.json({
        authenticated: true,
        user: { id: payload.id, email: payload.email, role: payload.role },
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    console.error('Session check error:', message);
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 });
  }
}
