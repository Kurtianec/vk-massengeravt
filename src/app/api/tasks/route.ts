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

    const { chatId, chatIds, messageText, scheduleType, scheduledAt, dayOfWeek, dayOfMonth, intervalMinutes, deletePrevious } = await request.json();

    // Support both single chatId and multiple chatIds
    const targetChatIds = chatIds && chatIds.length > 0 ? chatIds : (chatId ? [chatId] : []);

    if (targetChatIds.length === 0 || !messageText || !scheduleType || !scheduledAt) {
      return NextResponse.json({ error: 'Заполните все обязательные поля' }, { status: 400 });
    }

    if (scheduleType === 'interval' && (!intervalMinutes || intervalMinutes < 1)) {
      return NextResponse.json({ error: 'Укажите интервал (минимум 1 минута)' }, { status: 400 });
    }

    const createdTasks = [];
    for (const cid of targetChatIds) {
      // Verify the chat belongs to the user
      const chat = await db.vkChat.findUnique({
        where: { id: cid },
        include: { connection: true },
      });

      if (!chat || chat.connection.ownerId !== user.id) continue;

      const task = await db.scheduledTask.create({
        data: {
          chatId: cid,
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
      createdTasks.push(task);
    }

    if (createdTasks.length === 0) {
      return NextResponse.json({ error: 'Не удалось создать задачи. Проверьте выбранные чаты.' }, { status: 400 });
    }

    return NextResponse.json({ tasks: createdTasks, count: createdTasks.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка создания задачи';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
