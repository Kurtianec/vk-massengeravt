import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { isActive, status, messageText, scheduledAt, scheduleType, dayOfWeek, dayOfMonth, intervalMinutes, deletePrevious } = body;

    const updateData: Record<string, unknown> = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (status !== undefined) updateData.status = status;
    if (messageText !== undefined) updateData.messageText = messageText;
    if (scheduledAt !== undefined) updateData.scheduledAt = new Date(scheduledAt);
    if (scheduleType !== undefined) updateData.scheduleType = scheduleType;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;
    if (dayOfMonth !== undefined) updateData.dayOfMonth = dayOfMonth;
    if (intervalMinutes !== undefined) updateData.intervalMinutes = intervalMinutes;
    if (deletePrevious !== undefined) updateData.deletePrevious = deletePrevious;

    const task = await db.scheduledTask.update({
      where: { id },
      data: updateData,
      include: { chat: true },
    });

    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка обновления';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { id } = await params;

    await db.sendLog.deleteMany({ where: { taskId: id } });
    await db.scheduledTask.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка удаления';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
