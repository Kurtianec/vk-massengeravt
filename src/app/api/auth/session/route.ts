import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export const maxDuration = 10; // Vercel function timeout in seconds

export async function GET(request: NextRequest) {
  try {
    // Race the DB query against a 5-second timeout
    // This prevents the page from hanging forever if DB is unreachable on Vercel
    const user = await Promise.race([
      getAuthenticatedUser(request),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 5000)
      ),
    ]);

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    console.error('Session check error:', message);
    return NextResponse.json({ authenticated: false, error: message }, { status: 500 });
  }
}
