import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    // Get user's VK connections
    const connections = await db.vkConnection.findMany({
      where: { ownerId: user.id },
      select: { id: true },
    });
    const connectionIds = connections.map(c => c.id);

    const logs = await db.sendLog.findMany({
      where: {
        task: {
          chat: {
            connectionId: { in: connectionIds },
          },
        },
      },
      include: {
        task: {
          include: {
            chat: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
