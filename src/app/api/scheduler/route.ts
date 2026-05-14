import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendMessage, deleteMessage } from '@/lib/vk';

export async function POST() {
  try {
    const now = new Date();

    // Find all active tasks that are due
    const tasks = await db.scheduledTask.findMany({
      where: {
        isActive: true,
        status: 'pending',
      },
      include: {
        chat: {
          include: {
            connection: true,
          },
        },
      },
    });

    const results: { taskId: string; status: string; error?: string }[] = [];

    for (const task of tasks) {
      const shouldSend = shouldSendNow(task, now);

      if (!shouldSend) continue;

      try {
        const connection = task.chat.connection;
        if (!connection?.accessToken) {
          results.push({ taskId: task.id, status: 'failed', error: 'Нет подключения к ВК' });
          continue;
        }

        // Delete previous message if flag is set and we have a message ID
        if (task.deletePrevious && task.lastMessageId) {
          try {
            await deleteMessage(connection.accessToken, task.lastMessageId, task.chat.vkPeerId);
          } catch (delErr) {
            // Non-fatal: log but continue sending
            console.warn(`Failed to delete previous message ${task.lastMessageId}:`, delErr instanceof Error ? delErr.message : delErr);
          }
        }

        const messageId = await sendMessage(connection.accessToken, task.chat.vkPeerId, task.messageText);

        // Log success
        await db.sendLog.create({
          data: {
            taskId: task.id,
            status: 'sent',
          },
        });

        // Update task
        if (task.scheduleType === 'once') {
          await db.scheduledTask.update({
            where: { id: task.id },
            data: { status: 'sent', isActive: false, lastSentAt: now, lastMessageId: messageId },
          });
        } else {
          await db.scheduledTask.update({
            where: { id: task.id },
            data: { lastSentAt: now, lastMessageId: messageId },
          });
        }

        results.push({ taskId: task.id, status: 'sent' });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Ошибка отправки';

        await db.sendLog.create({
          data: {
            taskId: task.id,
            status: 'failed',
            error: errorMsg,
          },
        });

        // For interval tasks, don't disable on failure — keep retrying
        if (task.scheduleType === 'interval') {
          await db.scheduledTask.update({
            where: { id: task.id },
            data: { lastSentAt: now },
          });
        } else {
          await db.scheduledTask.update({
            where: { id: task.id },
            data: { status: 'failed' },
          });
        }

        results.push({ taskId: task.id, status: 'failed', error: errorMsg });
      }
    }

    return NextResponse.json({
      checked: tasks.length,
      sent: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка планировщика';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function shouldSendNow(
  task: {
    scheduleType: string;
    scheduledAt: Date;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
    intervalMinutes: number | null;
    lastSentAt: Date | null;
  },
  now: Date
): boolean {
  const scheduled = new Date(task.scheduledAt);

  switch (task.scheduleType) {
    case 'once': {
      // Send if the scheduled time has passed (with 5-minute tolerance for multi-chat offset)
      return now >= scheduled && now.getTime() - scheduled.getTime() < 300000;
    }

    case 'interval': {
      if (!task.intervalMinutes || task.intervalMinutes < 1) return false;

      // First send: when the initial scheduled time has been reached
      if (!task.lastSentAt) {
        return now >= scheduled;
      }

      // Subsequent sends: check if enough time has passed since last send
      const minutesSinceLast = (now.getTime() - task.lastSentAt.getTime()) / (1000 * 60);
      return minutesSinceLast >= task.intervalMinutes;
    }

    case 'daily': {
      // Check if the time matches (HH:MM)
      const schedH = scheduled.getHours();
      const schedM = scheduled.getMinutes();
      const nowH = now.getHours();
      const nowM = now.getMinutes();

      if (schedH !== nowH || schedM !== nowM) return false;

      // Don't send if already sent in the last 23 hours
      if (task.lastSentAt) {
        const hoursSinceLast = (now.getTime() - task.lastSentAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < 23) return false;
      }

      return true;
    }

    case 'weekly': {
      if (task.dayOfWeek === null) return false;

      const schedH = scheduled.getHours();
      const schedM = scheduled.getMinutes();
      const nowH = now.getHours();
      const nowM = now.getMinutes();

      if (schedH !== nowH || schedM !== nowM) return false;
      if (now.getDay() !== task.dayOfWeek) return false;

      if (task.lastSentAt) {
        const hoursSinceLast = (now.getTime() - task.lastSentAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < 167) return false;
      }

      return true;
    }

    case 'monthly': {
      if (task.dayOfMonth === null) return false;

      const schedH = scheduled.getHours();
      const schedM = scheduled.getMinutes();
      const nowH = now.getHours();
      const nowM = now.getMinutes();

      if (schedH !== nowH || schedM !== nowM) return false;
      if (now.getDate() !== task.dayOfMonth) return false;

      if (task.lastSentAt) {
        const hoursSinceLast = (now.getTime() - task.lastSentAt.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLast < 720) return false;
      }

      return true;
    }

    default:
      return false;
  }
}
