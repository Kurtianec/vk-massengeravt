import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateToken, getUserInfo } from '@/lib/vk';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { accessToken } = await request.json();

    if (!accessToken || typeof accessToken !== 'string') {
      return NextResponse.json({ error: 'Токен доступа обязателен' }, { status: 400 });
    }

    const valid = await validateToken(accessToken);
    if (!valid) {
      return NextResponse.json({ error: 'Недействительный токен доступа ВКонтакте. Проверьте правильность токена и наличие прав messages.' }, { status: 400 });
    }

    const users = await getUserInfo(accessToken);
    const userInfo = Array.isArray(users) ? users[0] : users;

    // Deactivate existing connections for this user
    await db.vkConnection.updateMany({
      where: { ownerId: user.id, isActive: true },
      data: { isActive: false },
    });

    const connection = await db.vkConnection.create({
      data: {
        accessToken,
        userId: userInfo?.id,
        userName: userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : 'Пользователь ВК',
        userPhoto: userInfo?.photo_100,
        isActive: true,
        ownerId: user.id,
      },
    });

    return NextResponse.json({ connection });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка подключения';
    console.error('VK connect error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const connection = await db.vkConnection.findFirst({
      where: { ownerId: user.id, isActive: true },
    });

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      connection: {
        id: connection.id,
        userId: connection.userId,
        userName: connection.userName,
        userPhoto: connection.userPhoto,
        isActive: connection.isActive,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    await db.vkConnection.updateMany({
      where: { ownerId: user.id, isActive: true },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
