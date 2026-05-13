const VK_API = 'https://api.vk.com/method';
const VK_VERSION = '5.199';

interface VkApiParams {
  method: string;
  params: Record<string, string | number | undefined>;
  accessToken: string;
}

interface VkApiResponse<T> {
  response?: T;
  error?: {
    error_code: number;
    error_msg: string;
    request_params?: Array<{ key: string; value: string }>;
  };
}

export async function vkApi<T>({ method, params, accessToken }: VkApiParams): Promise<T> {
  const url = new URL(`${VK_API}/${method}`);
  url.searchParams.set('access_token', accessToken);
  url.searchParams.set('v', VK_VERSION);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    const data: VkApiResponse<T> = await res.json();

    if (data.error) {
      const errDetail = data.error.request_params
        ? ` | Params: ${data.error.request_params.map(p => `${p.key}=${p.value}`).join(', ')}`
        : '';
      throw new Error(`VK API Error [${data.error.error_code}]: ${data.error.error_msg}${errDetail}`);
    }

    return data.response as T;
  } finally {
    clearTimeout(timeout);
  }
}

export interface VkUserInfo {
  id: number;
  first_name: string;
  last_name: string;
  photo_100?: string;
}

export interface VkConversation {
  peer: {
    id: number;
    type: string;
    local_id?: number;
  };
  chat_settings?: {
    title: string;
    members_count?: number;
    photo?: {
      photo_100: string;
    };
  };
  can_write?: {
    allowed: boolean;
  };
}

export interface VkConversationItem {
  conversation: VkConversation;
  last_message?: {
    id: number;
    text: string;
    peer_id: number;
  };
}

export interface VkProfile {
  id: number;
  first_name: string;
  last_name: string;
  photo_100?: string;
  online?: number;
}

export interface VkGroup {
  id: number;
  name: string;
  photo_100?: string;
}

export interface ConversationsResult {
  count: number;
  items: VkConversationItem[];
  profiles?: VkProfile[];
  groups?: VkGroup[];
}

export async function getUserInfo(accessToken: string): Promise<VkUserInfo[]> {
  return vkApi<VkUserInfo[]>({
    method: 'users.get',
    params: { fields: 'photo_100' },
    accessToken,
  });
}

export async function getConversations(
  accessToken: string,
  count: number = 50,
  offset: number = 0
): Promise<ConversationsResult> {
  return vkApi<ConversationsResult>({
    method: 'messages.getConversations',
    params: {
      count,
      offset,
      filter: 'all',
      extended: 1,
    },
    accessToken,
  });
}

export async function sendMessage(
  accessToken: string,
  peerId: number,
  message: string
): Promise<number> {
  // VK API messages.send returns {"response": 12345} where 12345 IS the message_id directly
  const res = await vkApi<number>({
    method: 'messages.send',
    params: {
      peer_id: peerId,
      message,
      random_id: Math.floor(Math.random() * 2147483647),
    },
    accessToken,
  });

  return res;
}

export async function deleteMessage(
  accessToken: string,
  messageId: number,
  peerId?: number,
  deleteForAll: boolean = true
): Promise<boolean> {
  interface DeleteResponse {
    [key: string]: number;
  }

  const params: Record<string, string | number | undefined> = {
    message_ids: messageId,
    delete_for_all: deleteForAll ? 1 : 0,
  };

  // VK API requires peer_id for group chats to properly delete messages
  if (peerId !== undefined) {
    params.peer_id = peerId;
  }

  const res = await vkApi<DeleteResponse>({
    method: 'messages.delete',
    params,
    accessToken,
  });

  // VK returns { "messageId": 1 } on success (1 = deleted)
  return Object.values(res).some(v => v === 1);
}

export async function validateToken(accessToken: string): Promise<boolean> {
  try {
    await getUserInfo(accessToken);
    return true;
  } catch {
    return false;
  }
}
