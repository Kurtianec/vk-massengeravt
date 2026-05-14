import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

const SEND_INTERVAL_SECONDS = 15; // 15 sec between sends to avoid VK anti-spam

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

    const body = await request.json();
    const { chatId, chatIds, messageText, scheduleType, scheduledAt, dayOfWeek, dayOfMonth, intervalMinutes, deletePrevious } = body;

    // Support both single chatId and multiple chatIds
    const targetChatIds: string[] = chatIds && chatIds.length > 0 ? chatIds : (chatId ? [chatId] : []);

    if (targetChatIds.length === 0 || !messageText || !scheduleType || !scheduledAt) {
      return NextResponse.json({ error: 'Заполните все обязательные поля и выберите хотя бы один чат' }, { status: 400 });
    }

    if (scheduleType === 'interval' && (!intervalMinutes || intervalMinutes < 1)) {
      return NextResponse.json({ error: 'Укажите интервал (минимум 1 минута)' }, { status: 400 });
    }

    // Verify all chats belong to the user
    const chats = await db.vkChat.findMany({
      where: { id: { in: targetChatIds } },
      include: { connection: true },
    });

    const validChatIds = new Set(
      chats.filter(c => c.connection.ownerId === user.id).map(c => c.id)
    );

    if (validChatIds.size === 0) {
      return NextResponse.json({ error: 'Чаты не найдены' }, { status: 404 });
    }

    // Parse the base scheduled time
    const baseTime = new Date(scheduledAt);

    // Create a task for each chat with a time offset (15 sec between each)
    const createdTasks = [];

    let offsetIndex = 0;
    for (const cId of targetChatIds) {
      if (!validChatIds.has(cId)) continue;

      // Each subsequent chat gets +15 seconds to avoid VK anti-spam
      const taskTime = new Date(baseTime.getTime() + offsetIndex * SEND_INTERVAL_SECONDS * 1000);

      const task = await db.scheduledTask.create({
        data: {
          chatId: cId,
          messageText,
          scheduleType,
          scheduledAt: taskTime,
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
      offsetIndex++;
    }

    return NextResponse.json({ tasks: createdTasks, count: createdTasks.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка создания задачи';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
