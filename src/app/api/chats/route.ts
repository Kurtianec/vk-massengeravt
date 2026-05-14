import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getConversations } from '@/lib/vk';
import type { VkProfile, VkGroup } from '@/lib/vk';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

// GET /api/chats — returns chats from DB (fast, no VK API call)
// Query param: ?refresh=1 — fetches fresh data from VK API
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
      return NextResponse.json({ error: 'Нет подключения к ВК' }, { status: 400 });
    }

    // Check if this is a refresh request
    const url = new URL(request.url);
    const shouldRefresh = url.searchParams.get('refresh') === '1';

    if (shouldRefresh) {
      // Fetch from VK API and update DB
      try {
        const conversationsData = await getConversations(connection.accessToken, 50, 0);

        if (conversationsData?.items?.length) {
          // Build lookup maps for profiles and groups
          const profileMap = new Map<number, VkProfile>();
          const groupMap = new Map<number, VkGroup>();

          if (conversationsData.profiles) {
            for (const p of conversationsData.profiles) {
              profileMap.set(p.id, p);
            }
          }
          if (conversationsData.groups) {
            for (const g of conversationsData.groups) {
              groupMap.set(-g.id, g);
            }
          }

          // Get existing chats for selection state
          const existingChats = await db.vkChat.findMany({
            where: { connectionId: connection.id },
          });
          const existingMap = new Map(existingChats.map(c => [c.vkPeerId, c]));

          // Upsert each chat
          for (const item of conversationsData.items) {
            if (!item?.conversation) continue;
            const conv = item.conversation;
            const peerId = conv.peer.id;
            const peerType = conv.peer.type;

            let title = '';
            let photo: string | null = null;
            let chatType = 'dm';

            if (peerType === 'chat' && conv.chat_settings) {
              title = conv.chat_settings.title || `Беседа ${conv.peer.local_id}`;
              photo = conv.chat_settings.photo?.photo_100 || null;
              chatType = 'group';
            } else if (peerType === 'user') {
              const profile = profileMap.get(peerId);
              if (profile) {
                title = `${profile.first_name} ${profile.last_name}`;
                photo = profile.photo_100 || null;
              } else {
                title = `Пользователь #${peerId}`;
              }
              chatType = 'dm';
            } else if (peerType === 'group') {
              const group = groupMap.get(peerId);
              if (group) {
                title = group.name;
                photo = group.photo_100 || null;
              } else {
                title = `Сообщество #${Math.abs(peerId)}`;
              }
              chatType = 'group';
            } else {
              title = `Диалог #${peerId}`;
            }

            const existing = existingMap.get(peerId);
            const isSelected = existing?.isSelected ?? false;

            try {
              await db.vkChat.upsert({
                where: {
                  vkPeerId_connectionId: {
                    vkPeerId: peerId,
                    connectionId: connection.id,
                  },
                },
                create: {
                  vkPeerId: peerId,
                  title,
                  photo,
                  chatType,
                  isSelected,
                  connectionId: connection.id,
                },
                update: {
                  title,
                  photo,
                  chatType,
                },
              });
            } catch (upsertError) {
              console.error(`Failed to upsert chat ${peerId}:`, upsertError);
            }
          }
        }
      } catch (apiError) {
        const errMsg = apiError instanceof Error ? apiError.message : 'VK API недоступен';
        console.error('VK API error in chats refresh:', errMsg);
        // Return existing DB data even on API error
        const existingChats = await db.vkChat.findMany({
          where: { connectionId: connection.id },
          orderBy: { title: 'asc' },
        });
        if (existingChats.length > 0) {
          return NextResponse.json({ chats: existingChats, warning: errMsg });
        }
        return NextResponse.json({ error: `Не удалось загрузить чаты: ${errMsg}` }, { status: 500 });
      }
    }

    // Always return chats from DB (fast, no external API calls)
    const allChats = await db.vkChat.findMany({
      where: { connectionId: connection.id },
      orderBy: { title: 'asc' },
    });

    return NextResponse.json({ chats: allChats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка загрузки чатов';
    console.error('Chats API fatal error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 });
    }

    const { chatId, isSelected } = await request.json();

    const chat = await db.vkChat.update({
      where: { id: chatId },
      data: { isSelected },
    });

    return NextResponse.json({ chat });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
