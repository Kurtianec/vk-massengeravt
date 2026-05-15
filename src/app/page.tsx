'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  MessageSquare,
  Send,
  Clock,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Plus,
  CalendarDays,
  Link2,
  Users,
  Play,
  Pause,
  Activity,
  LogOut,
  Info,
  ChevronRight,
  Trash,
  User,
  ChevronDown,
  Shield,
} from 'lucide-react';

// Types
interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
}

interface VkConnection {
  id: string;
  userId?: number;
  userName?: string;
  userPhoto?: string;
  isActive: boolean;
}

interface VkChat {
  id: string;
  vkPeerId: number;
  title: string;
  photo?: string;
  chatType: string;
  isSelected: boolean;
  connectionId: string;
}

interface ScheduledTask {
  id: string;
  chatId: string;
  messageText: string;
  scheduleType: string;
  scheduledAt: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  intervalMinutes?: number | null;
  deletePrevious: boolean;
  lastMessageId?: number | null;
  isActive: boolean;
  lastSentAt?: string | null;
  status: string;
  chat?: VkChat & { connection?: { userName?: string } };
}

interface SendLogEntry {
  id: string;
  taskId: string;
  status: string;
  error?: string;
  sentAt: string;
  task?: {
    messageText: string;
    chat?: VkChat;
  };
}

const DAYSOfWeek = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const SCHEDULE_LABELS: Record<string, string> = {
  once: 'Один раз',
  interval: 'По интервалу',
  daily: 'Ежедневно',
  weekly: 'Еженедельно',
  monthly: 'Ежемесячно',
};

const INTERVAL_PRESETS = [
  { label: 'Каждые 30 мин', value: 30 },
  { label: 'Каждый час', value: 60 },
  { label: 'Каждые 2 часа', value: 120 },
  { label: 'Каждые 3 часа', value: 180 },
  { label: 'Каждые 4 часа', value: 240 },
  { label: 'Каждые 6 часов', value: 360 },
  { label: 'Каждые 8 часов', value: 480 },
  { label: 'Каждые 12 часов', value: 720 },
];

function formatInterval(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `каждые ${m} мин`;
  if (m === 0) return h === 1 ? 'каждый час' : `каждые ${h} ч`;
  return `каждые ${h} ч ${m} мин`;
}

export default function Home() {
  const { toast } = useToast();

  // Auth state
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App state
  const [connection, setConnection] = useState<VkConnection | null>(null);
  const [connected, setConnected] = useState(false);
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [loadingChats, setLoadingChats] = useState(false);
  const [chats, setChats] = useState<VkChat[]>([]);
  const [chatSearch, setChatSearch] = useState('');
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [logs, setLogs] = useState<SendLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState('connect');

  // New task form — multi-chat support
  const [selectedChatIdsForTask, setSelectedChatIdsForTask] = useState<string[]>([]);
  const [newTaskMessage, setNewTaskMessage] = useState('');
  const [newTaskScheduleType, setNewTaskScheduleType] = useState('once');
  const [newTaskScheduledAt, setNewTaskScheduledAt] = useState('');
  const [newTaskDayOfWeek, setNewTaskDayOfWeek] = useState('1');
  const [newTaskDayOfMonth, setNewTaskDayOfMonth] = useState('1');
  const [newTaskInterval, setNewTaskInterval] = useState('120');
  const [newTaskDeletePrevious, setNewTaskDeletePrevious] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [oauthAvailable, setOauthAvailable] = useState(false);
  const [oauthUrl, setOauthUrl] = useState('');
  const [oauthConnecting, setOauthConnecting] = useState(false);

  // OAuth message listener
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'vk-oauth-token' && event.data.accessToken) {
        setToken(event.data.accessToken);
        handleConnectWithToken(event.data.accessToken);
      } else if (event.data?.type === 'vk-oauth-error') {
        toast({
          title: 'Ошибка авторизации',
          description: event.data.errorDescription || event.data.error || 'Не удалось получить токен',
          variant: 'destructive',
        });
        setOauthConnecting(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Check OAuth availability
  useEffect(() => {
    if (authUser && !connected) {
      fetch('/api/vk/oauth-url')
        .then(res => res.json())
        .then(data => {
          if (data.available) {
            setOauthAvailable(true);
            setOauthUrl(data.oauthUrl);
          }
        })
        .catch(() => {});
    }
  }, [authUser, connected]);

  const handleConnectWithToken = async (tokenValue: string) => {
    setOauthConnecting(true);
    setConnecting(true);
    try {
      const res = await fetch('/api/vk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: tokenValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setConnected(true);
        setConnection(data.connection);
        setToken('');
        setActiveTab('chats');
        toast({ title: 'Подключено!', description: 'Аккаунт ВКонтакте успешно подключён' });
      } else {
        toast({ title: 'Ошибка подключения', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось подключиться', variant: 'destructive' });
    } finally {
      setConnecting(false);
      setOauthConnecting(false);
    }
  };

  const handleOAuthConnect = () => {
    if (!oauthUrl) return;
    setOauthConnecting(true);
    const width = 665;
    const height = 500;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    window.open(
      oauthUrl,
      'vk-oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,location=no,status=no`
    );
  };

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch('/api/auth/session', { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data.authenticated && data.user) {
          setAuthUser(data.user);
        } else {
          window.location.href = '/login';
        }
      } catch {
        window.location.href = '/login';
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login';
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось выйти', variant: 'destructive' });
    }
  };

  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch('/api/vk');
      const data = await res.json();
      setConnected(data.connected);
      if (data.connected && data.connection) {
        setConnection(data.connection);
      }
    } catch {
      setConnected(false);
    }
  }, []);

  const fetchChats = useCallback(async (refresh = false) => {
    if (!connected) return;
    setLoadingChats(true);
    try {
      const url = refresh ? '/api/chats?refresh=1' : '/api/chats';
      const res = await fetch(url);
      const data = await res.json();
      if (data.chats) {
        setChats(data.chats);
      }
      if (data.warning) {
        toast({ title: 'Внимание', description: data.warning, variant: 'destructive' });
      }
      if (data.error) {
        toast({ title: 'Ошибка загрузки чатов', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить чаты', variant: 'destructive' });
    } finally {
      setLoadingChats(false);
    }
  }, [connected, toast]);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      if (data.tasks) {
        setTasks(data.tasks);
      }
    } catch {
      // silent
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/logs');
      const data = await res.json();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (authUser) {
      checkConnection();
    }
  }, [authUser, checkConnection]);

  useEffect(() => {
    if (connected) {
      fetchChats();
      fetchTasks();
      fetchLogs();
    }
  }, [connected, fetchChats, fetchTasks, fetchLogs]);

  // Scheduler: poll every 30 seconds
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(async () => {
      try {
        await fetch('/api/scheduler', { method: 'POST' });
        fetchTasks();
        fetchLogs();
      } catch {
        // silent
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [connected, fetchTasks, fetchLogs]);

  const handleConnect = async () => {
    if (!token.trim()) {
      toast({ title: 'Ошибка', description: 'Введите токен доступа', variant: 'destructive' });
      return;
    }
    setConnecting(true);
    try {
      const res = await fetch('/api/vk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await res.json();
      if (res.ok) {
        setConnected(true);
        setConnection(data.connection);
        setToken('');
        setActiveTab('chats');
        toast({ title: 'Подключено!', description: 'Аккаунт ВКонтакте успешно подключён' });
      } else {
        toast({ title: 'Ошибка подключения', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось подключиться', variant: 'destructive' });
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/vk', { method: 'DELETE' });
      setConnected(false);
      setConnection(null);
      setChats([]);
      setTasks([]);
      setLogs([]);
      setActiveTab('connect');
      toast({ title: 'Отключено', description: 'Аккаунт ВКонтакте отключён' });
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось отключиться', variant: 'destructive' });
    }
  };

  const toggleChatSelection = async (chatId: string, isSelected: boolean) => {
    try {
      await fetch('/api/chats', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, isSelected }),
      });
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, isSelected } : c));
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось обновить чат', variant: 'destructive' });
    }
  };

  const handleCreateTask = async () => {
    if (selectedChatIdsForTask.length === 0 || !newTaskMessage || !newTaskScheduledAt) {
      toast({ title: 'Ошибка', description: 'Заполните все обязательные поля и выберите чаты', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const localScheduledAt = (() => {
        const [datePart, timePart] = newTaskScheduledAt.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes).toISOString();
      })();

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatIds: selectedChatIdsForTask,
          messageText: newTaskMessage,
          scheduleType: newTaskScheduleType,
          scheduledAt: localScheduledAt,
          dayOfWeek: newTaskScheduleType === 'weekly' ? parseInt(newTaskDayOfWeek) : null,
          dayOfMonth: newTaskScheduleType === 'monthly' ? parseInt(newTaskDayOfMonth) : null,
          intervalMinutes: newTaskScheduleType === 'interval' ? parseInt(newTaskInterval) : null,
          deletePrevious: newTaskDeletePrevious,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const count = data.count || data.tasks?.length || 1;
        const chatWord = count === 1 ? 'чат' : count < 5 ? 'чата' : 'чатов';
        toast({ title: 'Задачи созданы', description: `${count} задач для ${count} ${chatWord} запланировано (интервал 10 сек)` });
        setCreateDialogOpen(false);
        setSelectedChatIdsForTask([]);
        setNewTaskMessage('');
        setNewTaskScheduleType('once');
        setNewTaskScheduledAt('');
        setNewTaskInterval('120');
        setNewTaskDeletePrevious(false);
        fetchTasks();
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось создать задачу', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const toggleTaskActive = async (taskId: string, isActive: boolean) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      fetchTasks();
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось обновить задачу', variant: 'destructive' });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks();
      fetchLogs();
      toast({ title: 'Удалено', description: 'Задача удалена' });
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить задачу', variant: 'destructive' });
    }
  };

  const runScheduler = async () => {
    try {
      const res = await fetch('/api/scheduler', { method: 'POST' });
      const data = await res.json();
      fetchTasks();
      fetchLogs();
      if (data.sent > 0) {
        toast({ title: 'Отправлено', description: `${data.sent} сообщений отправлено` });
      } else {
        toast({ title: 'Проверка', description: 'Нет задач для отправки в данный момент' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Ошибка при проверке расписания', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-[#4FAE4E]/10 text-[#4FAE4E] border border-[#4FAE4E]/30 font-medium"><CheckCircle className="w-3 h-3 mr-1" />Отправлено</Badge>;
      case 'failed': return <Badge className="bg-[#E53935]/10 text-[#E53935] border border-[#E53935]/30 font-medium"><XCircle className="w-3 h-3 mr-1" />Ошибка</Badge>;
      case 'pending': return <Badge className="bg-[#F9A825]/10 text-[#F9A825] border border-[#F9A825]/30 font-medium"><Clock className="w-3 h-3 mr-1" />Ожидание</Badge>;
      case 'disabled': return <Badge variant="secondary" className="font-medium"><Pause className="w-3 h-3 mr-1" />Отключено</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const selectedChats = chats.filter(c => c.isSelected);
  const filteredChats = chatSearch
    ? chats.filter(c => c.title.toLowerCase().includes(chatSearch.toLowerCase()))
    : chats;

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const toggleChatInTask = (chatId: string) => {
    setSelectedChatIdsForTask(prev =>
      prev.includes(chatId)
        ? prev.filter(id => id !== chatId)
        : [...prev, chatId]
    );
  };

  const selectAllChatsForTask = () => {
    if (selectedChatIdsForTask.length === chats.length) {
      setSelectedChatIdsForTask([]);
    } else {
      setSelectedChatIdsForTask(chats.map(c => c.id));
    }
  };

  const openCreateDialog = (preselectedChatIds?: string[]) => {
    setSelectedChatIdsForTask(preselectedChatIds || selectedChats.map(c => c.id));
    setCreateDialogOpen(true);
  };

  const statsCards = [
    { label: 'Всего чатов', value: chats.length, icon: Users },
    { label: 'Выбрано', value: selectedChats.length, icon: CheckCircle },
    { label: 'Задач', value: tasks.length, icon: CalendarDays },
    { label: 'Отправлено', value: logs.filter(l => l.status === 'sent').length, icon: Send },
  ];

  // Loading state while checking auth
  if (authLoading) {
    return (
      <div className="h-screen bg-[#E7E8EC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-[#2AABEE]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <p className="text-sm text-[#707579]">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return null;
  }

  return (
    <div className="h-screen bg-[#E7E8EC] flex flex-col overflow-hidden">
      {/* Header — Telegram Style */}
      <header className="bg-white z-50 border-b border-[#E0E0E0] flex-shrink-0 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="14" fill="#2AABEE"/>
                <path d="M19.5 9L16 19.5C15.8 20 15.1 20.2 14.7 19.8L11.5 16.5L9.5 17.5C9.2 17.6 8.9 17.3 9 17L11 12L18.5 7.5C18.8 7.3 19.1 7.6 19 8L15.5 15L19.5 9Z" fill="white" stroke="white" strokeWidth="0.3" strokeLinejoin="round"/>
                <path d="M11 12L16.5 8.5C16.7 8.4 16.9 8.6 16.7 8.7L11.5 16.5" fill="white" stroke="white" strokeWidth="0.3" strokeLinejoin="round"/>
              </svg>
              <h1 className="text-black font-semibold text-[17px] leading-none hidden sm:block">Messages pull</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={runScheduler}
                className="text-[#707579] hover:text-[#2AABEE] hover:bg-[#2AABEE]/8 h-8 w-8 p-0"
                title="Проверить расписание"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}

            {/* User dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#F0F2F5] transition-colors">
                  <Avatar className="w-7 h-7">
                    {connection?.userPhoto && connected ? (
                      <AvatarImage src={connection.userPhoto} />
                    ) : null}
                    <AvatarFallback className="bg-[#2AABEE] text-white text-xs font-bold">
                      {connected && connection?.userName
                        ? connection.userName.charAt(0).toUpperCase()
                        : authUser.name?.charAt(0).toUpperCase() || authUser.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-black text-sm font-medium hidden sm:block max-w-[120px] truncate">
                    {authUser.name || authUser.email.split('@')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-[#707579] hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-black">{authUser.name || authUser.email.split('@')[0]}</p>
                  <p className="text-xs text-[#707579]">{authUser.email}</p>
                </div>
                {connected && connection && (
                  <>
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1.5 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#4FAE4E]" />
                      <span className="text-xs text-[#707579]">ВК: {connection.userName}</span>
                    </div>
                  </>
                )}
                <DropdownMenuSeparator />
                {authUser.role === 'admin' && (
                  <DropdownMenuItem onClick={() => window.location.href = '/admin'} className="text-[#2AABEE] focus:text-[#2AABEE] cursor-pointer">
                    <Shield className="w-4 h-4 mr-2" />
                    Админ-панель
                  </DropdownMenuItem>
                )}
                {connected && (
                  <DropdownMenuItem onClick={handleDisconnect} className="text-[#707579] focus:text-[#E53935] cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Отключить ВК
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout} className="text-[#E53935] focus:text-[#E53935] cursor-pointer">
                  <LogOut className="w-4 h-4 mr-2" />
                  Выйти из аккаунта
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 min-h-0 max-w-6xl mx-auto px-4 sm:px-6 py-4 w-full flex flex-col">
        {/* Stats row */}
        {connected && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 flex-shrink-0">
            {statsCards.map((s, i) => (
              <div key={i} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm border border-[#E0E0E0]">
                <div className="w-9 h-9 rounded-lg bg-[#2AABEE]/10 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-[#2AABEE]" />
                </div>
                <div>
                  <div className="text-xl font-bold text-black">{s.value}</div>
                  <div className="text-[11px] text-[#707579]">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-3 flex-1 min-h-0 flex flex-col">
          <TabsList className="bg-white rounded-xl shadow-sm border border-[#E0E0E0] h-11 p-1 w-full grid grid-cols-4 flex-shrink-0">
            <TabsTrigger value="connect" className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-[#2AABEE] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#707579]">
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Подключение</span>
            </TabsTrigger>
            <TabsTrigger value="chats" disabled={!connected} className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-[#2AABEE] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#707579]">
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Чаты</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" disabled={!connected} className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-[#2AABEE] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#707579]">
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Расписание</span>
            </TabsTrigger>
            <TabsTrigger value="logs" disabled={!connected} className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-[#2AABEE] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#707579]">
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Логи</span>
            </TabsTrigger>
          </TabsList>

          {/* ===== CONNECT TAB ===== */}
          <TabsContent value="connect" className="flex-1 min-h-0 overflow-y-auto mt-0">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-3">
                <Card className="bg-white border-[#E0E0E0] shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-black">
                      <div className="w-8 h-8 rounded-lg bg-[#2AABEE]/10 flex items-center justify-center">
                        <Link2 className="w-4 h-4 text-[#2AABEE]" />
                      </div>
                      Подключение к ВКонтакте
                    </CardTitle>
                    <CardDescription className="text-[#707579]">
                      Введите токен доступа для подключения к вашему аккаунту
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {connected ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-[#EFFDDE] rounded-xl border border-[#4FAE4E]/30">
                          <Avatar className="w-12 h-12 border-2 border-[#4FAE4E]/30 shadow-sm">
                            {connection?.userPhoto && <AvatarImage src={connection.userPhoto} />}
                            <AvatarFallback className="bg-[#2AABEE] text-white text-lg font-bold">
                              {connection?.userName?.charAt(0) || 'VK'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-bold text-black">{connection?.userName}</p>
                            <p className="text-xs text-[#707579]">ID: {connection?.userId}</p>
                          </div>
                          <Badge className="bg-[#4FAE4E]/10 text-[#4FAE4E] border border-[#4FAE4E]/30">
                            <div className="w-1.5 h-1.5 rounded-full bg-[#4FAE4E] mr-1.5" />
                            Подключён
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleDisconnect}
                          className="w-full border-[#E53935]/30 text-[#E53935] hover:bg-[#E53935]/8 rounded-xl"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Отключить аккаунт
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {oauthAvailable && (
                          <>
                            <Button
                              onClick={handleOAuthConnect}
                              disabled={oauthConnecting}
                              className="w-full h-12 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-semibold rounded-xl text-base gap-2"
                            >
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <circle cx="10" cy="10" r="10" fill="white" fillOpacity="0.2"/>
                                <path d="M5 7h1.8c.2 0 .4.1.4.3.3.7.9 2 1.4 2.3.2.1.3 0 .3-.2v-1.4c0-.5-.2-.9-.2-.9s-.1-.2-.3-.2c-.1 0-.2-.1-.1-.2.1-.1.3-.3.6-.3h1.4c.3 0 .5.2.5.5v2.1c0 .2.2.4.3.2.4-.3 1-1.4 1.5-2.4.1-.2.2-.3.4-.3h1.5c.3 0 .5.3.3.6-.6 1-1.5 2.5-1.9 2.9-.2.2-.1.4 0 .6.5.5 1.4 1.5 1.8 2 .2.2.1.5-.2.5h-1.8c-.2 0-.3-.1-.5-.2-.4-.4-.9-1-1.3-1-.2 0-.3.1-.3.4v.5c0 .2-.2.4-.4.4h-1c-1.8 0-3.2-2.5-4.1-4.6-.1-.2 0-.4.2-.4z" fill="white"/>
                              </svg>
                              {oauthConnecting ? 'Ожидание авторизации...' : 'Подключить через ВКонтакте'}
                            </Button>
                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-[#E0E0E0]" />
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-white px-2 text-[#707579]">или введите токен вручную</span>
                              </div>
                            </div>
                          </>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="token" className="text-black">Токен доступа</Label>
                          <Input
                            id="token"
                            type="password"
                            placeholder="vk1.a.xxx..."
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleConnect()}
                            className="h-11 bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] focus:ring-[#2AABEE]/20 rounded-xl text-black placeholder:text-[#9E9E9E]"
                          />
                        </div>
                        <Button
                          onClick={handleConnect}
                          disabled={connecting}
                          className="w-full h-11 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-semibold rounded-xl"
                        >
                          {connecting ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Link2 className="w-4 h-4 mr-2" />
                          )}
                          {connecting ? 'Подключение...' : 'Подключить'}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="md:col-span-2">
                <Card className="border-[#E0E0E0] bg-white shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-[#2AABEE] text-base">
                      <Info className="w-5 h-5 text-[#2AABEE]" />
                      Как получить токен
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-black">
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2AABEE] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                        <p className="leading-snug">Создайте Standalone-приложение на <a href="https://vk.com/editapp?act=create" target="_blank" rel="noopener noreferrer" className="text-[#2AABEE] underline">vk.com/editapp</a></p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2AABEE] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                        <p className="leading-snug">Получите токен через Implicit Flow с правами <code className="bg-[#2AABEE]/10 px-1 rounded text-xs text-[#2AABEE]">messages</code></p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-[#2AABEE] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                        <p className="leading-snug">Скопируйте токен из адресной строки и вставьте в поле</p>
                      </div>
                    </div>
                    <Separator className="bg-[#E0E0E0]" />
                    <div className="bg-[#F0F2F5] p-3 rounded-lg">
                      <p className="text-xs text-[#707579]">
                        <strong>Важно:</strong> Токен хранится локально и используется только для API ВКонтакте. Не передавайте его третьим лицам.
                      </p>
                    </div>
                    <div className="bg-[#F0F2F5] p-3 rounded-lg space-y-1">
                      <p className="text-xs text-[#707579] font-semibold">Пример URL для получения токена:</p>
                      <code className="text-[10px] break-all leading-relaxed block text-[#2AABEE]">
                        https://oauth.vk.com/authorize?client_id=ВАШ_ID&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=messages&response_type=token
                      </code>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ===== CHATS TAB ===== */}
          <TabsContent value="chats" className="flex-1 min-h-0 mt-0">
            <Card className="bg-white border-[#E0E0E0] shadow-sm h-full flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-black">
                      <div className="w-8 h-8 rounded-lg bg-[#2AABEE]/10 flex items-center justify-center">
                        <Users className="w-4 h-4 text-[#2AABEE]" />
                      </div>
                      Чаты ВКонтакте
                    </CardTitle>
                    <CardDescription className="mt-1 text-[#707579]">
                      {selectedChats.length > 0
                        ? `Выбрано ${selectedChats.length} из ${chats.length} чатов`
                        : 'Выберите чаты для отправки сообщений'
                      }
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedChats.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => openCreateDialog()}
                        className="bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-xl h-8 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Создать задачу
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchChats(true)}
                      disabled={loadingChats}
                      className="border-[#E0E0E0] text-[#2AABEE] hover:bg-[#2AABEE]/8 rounded-xl"
                    >
                      <RefreshCw className={`w-4 h-4 mr-2 ${loadingChats ? 'animate-spin' : ''}`} />
                      Обновить
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 flex flex-col pt-0">
                {chats.length > 0 && (
                  <div className="mb-3 flex-shrink-0 space-y-2">
                    <Input
                      placeholder="Поиск чатов..."
                      value={chatSearch}
                      onChange={e => setChatSearch(e.target.value)}
                      className="h-9 bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] focus:ring-[#2AABEE]/20 rounded-xl text-black placeholder:text-[#9E9E9E]"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const allSelected = selectedChats.length === chats.length;
                        chats.forEach(c => toggleChatSelection(c.id, !allSelected));
                      }}
                      className="w-full border-[#2AABEE]/30 text-[#2AABEE] hover:bg-[#2AABEE]/8 rounded-xl h-8 text-xs"
                    >
                      {selectedChats.length === chats.length ? 'Снять выделение со всех' : 'Выбрать все чаты'}
                    </Button>
                  </div>
                )}

                {loadingChats ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#2AABEE]" />
                    <span className="ml-3 text-[#707579]">Загрузка чатов...</span>
                  </div>
                ) : chats.length === 0 ? (
                  <div className="text-center py-16 text-[#707579]">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Чаты не найдены</p>
                    <p className="text-xs mt-1">Нажмите &quot;Обновить&quot; для загрузки из ВКонтакте</p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-1">
                      {filteredChats.map(chat => (
                        <div
                          key={chat.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                            chat.isSelected
                              ? 'bg-[#EFFDDE] border border-[#4FAE4E]/30'
                              : 'hover:bg-[#F0F2F5] border border-transparent'
                          }`}
                          onClick={() => toggleChatSelection(chat.id, !chat.isSelected)}
                        >
                          <Avatar className="w-10 h-10">
                            {chat.photo && <AvatarImage src={chat.photo} />}
                            <AvatarFallback className="bg-[#2AABEE]/10 text-[#2AABEE] font-bold text-sm">
                              {chat.title.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-black truncate">{chat.title}</p>
                            <p className="text-xs text-[#707579]">
                              {chat.chatType === 'group' ? 'Групповой чат' : chat.chatType === 'user' ? 'Личный чат' : chat.chatType}
                              {' '}· ID: {chat.vkPeerId}
                            </p>
                          </div>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                            chat.isSelected
                              ? 'bg-[#2AABEE] border-[#2AABEE]'
                              : 'border-[#C4C4C4]'
                          }`}>
                            {chat.isSelected && (
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TASKS TAB ===== */}
          <TabsContent value="tasks" className="flex-1 min-h-0 mt-0">
            <Card className="bg-white border-[#E0E0E0] shadow-sm h-full flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-2 text-black">
                    <div className="w-8 h-8 rounded-lg bg-[#2AABEE]/10 flex items-center justify-center">
                      <CalendarDays className="w-4 h-4 text-[#2AABEE]" />
                    </div>
                    Расписание
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => openCreateDialog()}
                    className="bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-xl h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Новая задача
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0">
                {tasks.length === 0 ? (
                  <div className="text-center py-16 text-[#707579]">
                    <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Нет запланированных задач</p>
                    <p className="text-xs mt-1">Создайте задачу для отправки сообщений по расписанию</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map(task => (
                      <div key={task.id} className={`p-3 rounded-xl border transition-all ${
                        task.isActive ? 'bg-white border-[#E0E0E0]' : 'bg-[#F0F2F5] border-[#E0E0E0]/50 opacity-60'
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusBadge(task.status)}
                              <Badge variant="outline" className="text-[10px] text-[#707579] border-[#E0E0E0]">
                                {SCHEDULE_LABELS[task.scheduleType] || task.scheduleType}
                              </Badge>
                            </div>
                            <p className="text-sm text-black font-medium line-clamp-2">{task.messageText}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-[#707579]">
                              {task.chat && (
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="w-3 h-3" />
                                  {task.chat.title}
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(task.scheduledAt).toLocaleString('ru')}
                              </span>
                              {task.intervalMinutes && (
                                <span>{formatInterval(task.intervalMinutes)}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleTaskActive(task.id, !task.isActive)}
                              className={`h-8 w-8 p-0 ${task.isActive ? 'text-[#4FAE4E] hover:text-[#4FAE4E]' : 'text-[#707579] hover:text-[#2AABEE]'}`}
                            >
                              {task.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTask(task.id)}
                              className="h-8 w-8 p-0 text-[#707579] hover:text-[#E53935]"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== LOGS TAB ===== */}
          <TabsContent value="logs" className="flex-1 min-h-0 mt-0">
            <Card className="bg-white border-[#E0E0E0] shadow-sm h-full flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <CardTitle className="flex items-center gap-2 text-black">
                  <div className="w-8 h-8 rounded-lg bg-[#2AABEE]/10 flex items-center justify-center">
                    <Activity className="w-4 h-4 text-[#2AABEE]" />
                  </div>
                  Логи отправки
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0">
                {logs.length === 0 ? (
                  <div className="text-center py-16 text-[#707579]">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Логи отправки пусты</p>
                    <p className="text-xs mt-1">Здесь появятся записи об отправленных сообщениях</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map(log => (
                      <div key={log.id} className="p-3 rounded-xl border bg-white border-[#E0E0E0]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          {getStatusBadge(log.status)}
                          <span className="text-xs text-[#707579]">
                            {new Date(log.sentAt).toLocaleString('ru')}
                          </span>
                        </div>
                        {log.task && (
                          <p className="text-sm text-black truncate">{log.task.messageText}</p>
                        )}
                        {log.task?.chat && (
                          <p className="text-xs text-[#707579] mt-1 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {log.task.chat.title}
                          </p>
                        )}
                        {log.error && (
                          <p className="text-xs text-[#E53935] mt-1">{log.error}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* ===== CREATE TASK DIALOG ===== */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="sm:max-w-lg bg-white max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-black">
                <div className="w-8 h-8 rounded-lg bg-[#2AABEE]/10 flex items-center justify-center">
                  <Plus className="w-4 h-4 text-[#2AABEE]" />
                </div>
                Новая задача
              </DialogTitle>
              <DialogDescription className="text-[#707579]">
                Создайте задачу для автоматической отправки сообщения
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Chat selection */}
              <div className="space-y-2">
                <Label className="text-black font-medium">Чаты ({selectedChatIdsForTask.length} выбрано)</Label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={selectAllChatsForTask}
                    className="flex-1 border-[#2AABEE]/30 text-[#2AABEE] hover:bg-[#2AABEE]/8 rounded-xl h-8 text-xs"
                  >
                    {selectedChatIdsForTask.length === chats.length ? 'Снять все' : 'Выбрать все'}
                  </Button>
                </div>
                <ScrollArea className="h-40 rounded-lg border border-[#E0E0E0]">
                  <div className="p-2 space-y-1">
                    {chats.map(chat => {
                      const isSelected = selectedChatIdsForTask.includes(chat.id);
                      return (
                        <div
                          key={chat.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-sm ${
                            isSelected ? 'bg-[#EFFDDE] text-black' : 'hover:bg-[#F0F2F5] text-[#707579]'
                          }`}
                          onClick={() => toggleChatInTask(chat.id)}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                            isSelected ? 'bg-[#2AABEE] border-[#2AABEE]' : 'border-[#C4C4C4]'
                          }`}>
                            {isSelected && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className="truncate">{chat.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              {/* Message text */}
              <div className="space-y-2">
                <Label className="text-black font-medium">Текст сообщения</Label>
                <Textarea
                  value={newTaskMessage}
                  onChange={e => setNewTaskMessage(e.target.value)}
                  placeholder="Введите текст сообщения..."
                  rows={3}
                  className="bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] focus:ring-[#2AABEE]/20 rounded-xl text-black placeholder:text-[#9E9E9E] resize-none"
                />
              </div>

              {/* Schedule type */}
              <div className="space-y-2">
                <Label className="text-black font-medium">Тип расписания</Label>
                <Select value={newTaskScheduleType} onValueChange={v => { setNewTaskScheduleType(v); if (v === 'once') setNewTaskDeletePrevious(false); }}>
                  <SelectTrigger className="bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] rounded-xl text-black">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Один раз</SelectItem>
                    <SelectItem value="interval">По интервалу</SelectItem>
                    <SelectItem value="daily">Ежедневно</SelectItem>
                    <SelectItem value="weekly">Еженедельно</SelectItem>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date/time */}
              <div className="space-y-2">
                <Label className="text-black font-medium">Дата и время отправки</Label>
                <Input
                  type="datetime-local"
                  value={newTaskScheduledAt}
                  onChange={e => setNewTaskScheduledAt(e.target.value)}
                  min={getMinDateTime()}
                  className="bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] focus:ring-[#2AABEE]/20 rounded-xl text-black"
                />
              </div>

              {/* Interval specific */}
              {newTaskScheduleType === 'interval' && (
                <div className="space-y-2">
                  <Label className="text-black font-medium">Интервал</Label>
                  <Select value={newTaskInterval} onValueChange={setNewTaskInterval}>
                    <SelectTrigger className="bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] rounded-xl text-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVAL_PRESETS.map(p => (
                        <SelectItem key={p.value} value={String(p.value)}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Weekly specific */}
              {newTaskScheduleType === 'weekly' && (
                <div className="space-y-2">
                  <Label className="text-black font-medium">День недели</Label>
                  <Select value={newTaskDayOfWeek} onValueChange={setNewTaskDayOfWeek}>
                    <SelectTrigger className="bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] rounded-xl text-black">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYSOfWeek.map((d, i) => (
                        <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Monthly specific */}
              {newTaskScheduleType === 'monthly' && (
                <div className="space-y-2">
                  <Label className="text-black font-medium">День месяца</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={newTaskDayOfMonth}
                    onChange={e => setNewTaskDayOfMonth(e.target.value)}
                    className="bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] focus:ring-[#2AABEE]/20 rounded-xl text-black"
                  />
                </div>
              )}

              {/* Delete previous */}
              {newTaskScheduleType !== 'once' && (
                <div className="flex items-center justify-between p-3 bg-[#F0F2F5] rounded-xl">
                  <div>
                    <Label className="text-black font-medium text-sm">Удалять предыдущее сообщение</Label>
                    <p className="text-xs text-[#707579] mt-0.5">Перед отправкой удалять сообщение из прошлого раза</p>
                  </div>
                  <Switch
                    checked={newTaskDeletePrevious}
                    onCheckedChange={setNewTaskDeletePrevious}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-xl border-[#E0E0E0] text-[#707579] hover:bg-[#F0F2F5]">
                Отмена
              </Button>
              <Button
                onClick={handleCreateTask}
                disabled={creating || selectedChatIdsForTask.length === 0 || !newTaskMessage || !newTaskScheduledAt}
                className="bg-[#2AABEE] hover:bg-[#229ED9] text-white rounded-xl"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Создать ({selectedChatIdsForTask.length})
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
