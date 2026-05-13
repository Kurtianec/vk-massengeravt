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

    const tasks = await db.scheduledTask.findMany({
      where: {
        chat: {
          connectionId: { in: connectionIds },
        },
      },
      include: {
        chat: {
          include: {
            connection: {
              select: { id: true, userName: true },
            },
          },
        },
        logs: {
          orderBy: { sentAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return NextResponse.json({ tasks });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { chatId, messageText, scheduleType, scheduledAt, dayOfWeek, dayOfMonth, intervalMinutes, deletePrevious } = await request.json();

    if (!chatId || !messageText || !scheduleType || !scheduledAt) {
      return NextResponse.json({ error: 'Заполните все обязательные поля' }, { status: 400 });
    }

    if (scheduleType === 'interval' && (!intervalMinutes || intervalMinutes < 1)) {
      return NextResponse.json({ error: 'Укажите интервал (минимум 1 минута)' }, { status: 400 });
    }

    // Verify the chat belongs to the user
    const chat = await db.vkChat.findUnique({
      where: { id: chatId },
      include: { connection: true },
    });

    if (!chat || chat.connection.ownerId !== user.id) {
      return NextResponse.json({ error: 'Чат не найден' }, { status: 404 });
    }

    const task = await db.scheduledTask.create({
      data: {
        chatId,
        messageText,
        scheduleType,
        scheduledAt: new Date(scheduledAt),
        dayOfWeek: dayOfWeek ?? null,
        dayOfMonth: dayOfMonth ?? null,
        intervalMinutes: scheduleType === 'interval' ? intervalMinutes : null,
        deletePrevious: deletePrevious === true,
        status: 'pending',
        isActive: true,
      },
      include: {
        chat: true,
      },
    });

    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка создания задачи';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
