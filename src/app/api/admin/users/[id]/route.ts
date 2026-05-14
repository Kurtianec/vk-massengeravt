import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { hashPassword } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    const { id } = await params;
    const url = new URL(request.url);
    const showFullToken = url.searchParams.get('fullToken') === '1';

    const targetUser = await db.user.findUnique({
      where: { id },
      include: {
        connections: {
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
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    // Return full or masked token based on query param
    const resultUser = {
      ...targetUser,
      passwordHash: undefined,
      connections: targetUser.connections.map(c => ({
        ...c,
        accessToken: showFullToken
          ? c.accessToken
          : c.accessToken
            ? c.accessToken.slice(0, 15) + '...' + c.accessToken.slice(-8)
            : null,
        fullTokenAvailable: !!c.accessToken,
      })),
    };

    return NextResponse.json({ user: resultUser });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, email, role, password } = body;

    // Don't allow admin to demote themselves
    if (id === user.id && role === 'user') {
      return NextResponse.json({ error: 'Нельзя снять себе права администратора' }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    // Check email uniqueness if changing
    if (email && email !== targetUser.email) {
      const existing = await db.user.findUnique({ where: { email } });
      if (existing) {
        return NextResponse.json({ error: 'Email уже занят' }, { status: 400 });
      }
    }

    const updateData: {
      name?: string | null;
      email?: string;
      role?: string;
      passwordHash?: string;
    } = {};
    if (name !== undefined) updateData.name = name || null;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'Пароль должен содержать минимум 6 символов' }, { status: 400 });
      }
      updateData.passwordHash = await hashPassword(password);
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        role: updated.role,
        createdAt: updated.createdAt,
      },
    });
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
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Доступ запрещён' }, { status: 403 });
    }

    const { id } = await params;

    // Don't allow admin to delete themselves
    if (id === user.id) {
      return NextResponse.json({ error: 'Нельзя удалить свой аккаунт' }, { status: 400 });
    }

    const targetUser = await db.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    // Cascade delete will handle connections, chats, tasks, logs
    await db.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка удаления';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
