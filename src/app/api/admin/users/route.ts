import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    const users = await db.user.findMany({
      include: {
        connections: {
          where: { isActive: true },
          select: {
            id: true,
            accessToken: true,
            userId: true,
            userName: true,
            userPhoto: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Mask tokens for security in the list view
    const maskedUsers = users.map(u => ({
      ...u,
      passwordHash: undefined,
      connections: u.connections.map(c => ({
        ...c,
        accessToken: c.accessToken
          ? c.accessToken.slice(0, 10) + '...' + c.accessToken.slice(-6)
          : null,
        fullTokenAvailable: !!c.accessToken,
      })),
    }));

    return NextResponse.json({ users: maskedUsers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
