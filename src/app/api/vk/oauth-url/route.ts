import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    // Get the VK App ID from settings
    const setting = await db.setting.findUnique({ where: { key: 'vk_app_id' } });

    if (!setting || !setting.value) {
      return NextResponse.json({ available: false });
    }

    const appId = setting.value;

    // Build the redirect URI — use the request origin or a configured value
    const origin = request.headers.get('host') || 'localhost:3000';
    const protocol = request.headers.get('x-forwarded-proto') || (origin.includes('localhost') ? 'http' : 'https');
    const redirectUri = `${protocol}://${origin}/vk-callback`;

    const oauthUrl = `https://oauth.vk.com/authorize?client_id=${appId}&display=page&redirect_uri=${encodeURIComponent(redirectUri)}&scope=messages&response_type=token&v=5.199`;

    return NextResponse.json({
      available: true,
      oauthUrl,
      appId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
