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
  const [authSlow, setAuthSlow] = useState(false);

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
    let redirected = false;

    const goToLogin = () => {
      if (!redirected) {
        redirected = true;
        window.location.replace('/login');
      }
    };

    const checkAuth = async () => {
      // Show "slow" indicator after 3 seconds
      const slowTimer = setTimeout(() => setAuthSlow(true), 3000);
      // Hard fallback: force redirect to login after 12 seconds no matter what
      const hardTimeout = setTimeout(goToLogin, 12000);

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch('/api/auth/session', { signal: controller.signal });
        clearTimeout(timeoutId);
        clearTimeout(slowTimer);
        clearTimeout(hardTimeout);

        const data = await res.json();
        if (data.authenticated && data.user) {
          setAuthUser(data.user);
        } else {
          goToLogin();
        }
      } catch {
        clearTimeout(slowTimer);
        clearTimeout(hardTimeout);
        goToLogin();
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

  // TIMEZONE FIX: convert local datetime to ISO so server stores correct UTC
  const handleCreateTask = async () => {
    if (selectedChatIdsForTask.length === 0 || !newTaskMessage || !newTaskScheduledAt) {
      toast({ title: 'Ошибка', description: 'Заполните все обязательные поля', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatIds: selectedChatIdsForTask,
          messageText: newTaskMessage,
          scheduleType: newTaskScheduleType,
          // TIMEZONE FIX: explicitly parse datetime-local as LOCAL time
          // new Date("YYYY-MM-DDTHH:mm") can be interpreted as UTC in some environments
          // So we manually construct a local Date to avoid any ambiguity
          scheduledAt: (() => {
            const [datePart, timePart] = newTaskScheduledAt.split('T');
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);
            return new Date(year, month - 1, day, hours, minutes).toISOString();
          })(),
          dayOfWeek: newTaskScheduleType === 'weekly' ? parseInt(newTaskDayOfWeek) : null,
          dayOfMonth: newTaskScheduleType === 'monthly' ? parseInt(newTaskDayOfMonth) : null,
          intervalMinutes: newTaskScheduleType === 'interval' ? parseInt(newTaskInterval) : null,
          deletePrevious: newTaskDeletePrevious,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const count = data.count || data.tasks?.length || 1;
        toast({ title: 'Задачи созданы', description: `${count} задач запланировано` });
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

  const openCreateDialog = (preselectedChatIds?: string[]) => {
    setSelectedChatIdsForTask(preselectedChatIds || selectedChats.map(c => c.id));
    setCreateDialogOpen(true);
  };

  const toggleChatInTask = (chatId: string) => {
    setSelectedChatIdsForTask(prev =>
      prev.includes(chatId)
        ? prev.filter(id => id !== chatId)
        : [...prev, chatId]
    );
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

  const getStatusIndicator = (status: string) => {
    switch (status) {
      case 'sent': return { dot: 'bg-emerald-500', label: 'Отправлено', cls: 'text-emerald-400' };
      case 'failed': return { dot: 'bg-red-500', label: 'Ошибка', cls: 'text-red-400' };
      case 'pending': return { dot: 'bg-amber-500', label: 'Ожидание', cls: 'text-amber-400' };
      case 'disabled': return { dot: 'bg-zinc-600', label: 'Отключено', cls: 'text-zinc-400' };
      default: return { dot: 'bg-zinc-500', label: status, cls: 'text-zinc-400' };
    }
  };

  const selectedChats = chats.filter(c => c.isSelected);
  const filteredChats = chatSearch
    ? chats.filter(c => c.title.toLowerCase().includes(chatSearch.toLowerCase()))
    : chats;

  // TIMEZONE FIX: getMinDateTime returns local time for the datetime picker
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  };

  const statsCards = [
    { label: 'Чатов', value: chats.length, icon: Users },
    { label: 'Выбрано', value: selectedChats.length, icon: CheckCircle },
    { label: 'Задач', value: tasks.length, icon: CalendarDays },
    { label: 'Отправлено', value: logs.filter(l => l.status === 'sent').length, icon: Send },
  ];

  // Loading state while checking auth
  if (authLoading) {
    return (
      <div className="h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center animate-pulse">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <path d="M7 10h2.5c.3 0 .5.2.6.4.4 1 1.2 2.8 2 3.2.3.2.4 0 .4-.3v-2c0-.7-.3-1.3-.3-1.3s-.2-.3-.5-.3c-.2 0-.3-.2-.2-.3.1-.2.4-.4.8-.4h2c.4 0 .7.3.7.7v3c0 .3.2.5.4.3.6-.4 1.5-2 2.1-3.3.1-.3.3-.4.5-.4h2.2c.4 0 .7.4.5.8-.8 1.5-2.1 3.5-2.7 4.1-.3.3-.2.6 0 .9.7.7 2 2.1 2.5 2.8.2.3.1.7-.3.7h-2.5c-.3 0-.5-.1-.7-.3-.5-.5-1.3-1.4-1.8-1.4-.2 0-.4.1-.4.5v.7c0 .3-.2.5-.5.5h-1.5c-2.5 0-4.5-3.5-5.8-6.5-.2-.3 0-.6.3-.6z" fill="white"/>
            </svg>
          </div>
          <p className="text-sm text-zinc-500">Загрузка...</p>
          {authSlow && (
            <button
              onClick={() => { window.location.href = '/login'; }}
              className="mt-2 text-xs text-violet-400 hover:text-violet-300 underline transition-colors"
            >
              Перейти к входу
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!authUser) {
    return null;
  }

  return (
    <div className="h-screen bg-[#09090b] flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #09090b 0%, #0f0f14 100%)' }}>
      {/* Header — Minimal Glass */}
      <header className="bg-zinc-950/60 backdrop-blur-xl z-50 border-b border-zinc-800/60 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold bg-gradient-to-r from-violet-400 to-violet-300 bg-clip-text text-transparent">
              VK Messages
            </h1>
          </div>
          <div className="flex items-center gap-1">
            {connected && (
              <Button
                variant="ghost"
                size="sm"
                onClick={runScheduler}
                className="text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/50 h-9 w-9 p-0 rounded-lg transition-all duration-200"
                title="Проверить расписание"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            )}

            {/* User dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800/50 transition-all duration-200">
                  <Avatar className="w-7 h-7 border border-zinc-800">
                    {connection?.userPhoto && connected ? (
                      <AvatarImage src={connection.userPhoto} />
                    ) : null}
                    <AvatarFallback className="bg-violet-500/10 text-violet-400 text-xs font-bold">
                      {connected && connection?.userName
                        ? connection.userName.charAt(0).toUpperCase()
                        : authUser.name?.charAt(0).toUpperCase() || authUser.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-zinc-300 text-sm font-medium hidden sm:block max-w-[120px] truncate">
                    {authUser.name || authUser.email.split('@')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500 hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-zinc-950/95 backdrop-blur-xl border-zinc-800">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-zinc-100">{authUser.name || authUser.email.split('@')[0]}</p>
                  <p className="text-xs text-zinc-500">{authUser.email}</p>
                </div>
                {connected && connection && (
                  <>
                    <DropdownMenuSeparator className="bg-zinc-800" />
                    <div className="px-2 py-1.5 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs text-zinc-500">ВК: {connection.userName}</span>
                    </div>
                  </>
                )}
                <DropdownMenuSeparator className="bg-zinc-800" />
                {authUser.role === 'admin' && (
                  <DropdownMenuItem onClick={() => window.location.href = '/admin'} className="text-violet-400 focus:text-violet-300 cursor-pointer">
                    <Shield className="w-4 h-4 mr-2" />
                    Админ-панель
                  </DropdownMenuItem>
                )}
                {connected && (
                  <DropdownMenuItem onClick={handleDisconnect} className="text-zinc-400 focus:text-red-400 cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Отключить ВК
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-300 cursor-pointer">
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
        {/* Stats row — Compact strip */}
        {connected && (
          <div className="flex items-center gap-2 mb-4 flex-shrink-0 p-2 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm">
            {statsCards.map((s, i) => (
              <div key={i} className="flex-1 flex items-center gap-2.5 px-3 py-1.5">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5 flex items-center justify-center flex-shrink-0">
                  <s.icon className="w-3.5 h-3.5 text-violet-400" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-semibold text-zinc-100 leading-tight">{s.value}</div>
                  <div className="text-[10px] text-zinc-500 leading-tight">{s.label}</div>
                </div>
                {i < statsCards.length - 1 && (
                  <div className="w-px h-6 bg-zinc-800/80 ml-auto flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-3 flex-1 min-h-0 flex flex-col">
          {/* Pill-style tabs */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-zinc-900/40 border border-zinc-800/60 backdrop-blur-sm flex-shrink-0">
            <TabsTrigger value="connect" className="gap-1.5 rounded-full px-4 py-2 text-xs font-medium data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/25 text-zinc-500 hover:text-zinc-300 transition-all duration-200">
              <Link2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Подключение</span>
            </TabsTrigger>
            <TabsTrigger value="chats" disabled={!connected} className="gap-1.5 rounded-full px-4 py-2 text-xs font-medium data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/25 text-zinc-500 hover:text-zinc-300 transition-all duration-200">
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Чаты</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" disabled={!connected} className="gap-1.5 rounded-full px-4 py-2 text-xs font-medium data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/25 text-zinc-500 hover:text-zinc-300 transition-all duration-200">
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Расписание</span>
            </TabsTrigger>
            <TabsTrigger value="logs" disabled={!connected} className="gap-1.5 rounded-full px-4 py-2 text-xs font-medium data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-violet-500/25 text-zinc-500 hover:text-zinc-300 transition-all duration-200">
              <Activity className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Логи</span>
            </TabsTrigger>
          </div>

          {/* ===== CONNECT TAB ===== */}
          <TabsContent value="connect" className="flex-1 min-h-0 overflow-y-auto mt-0">
            <div className="grid gap-4 md:grid-cols-5">
              <div className="md:col-span-3">
                <Card className="border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl shadow-xl shadow-violet-500/[0.03] rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2.5 text-zinc-100 text-base font-semibold">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5 flex items-center justify-center">
                        <Link2 className="w-4 h-4 text-violet-400" />
                      </div>
                      Подключение к ВКонтакте
                    </CardTitle>
                    <CardDescription className="text-zinc-500">
                      Введите токен доступа для подключения к вашему аккаунту
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {connected ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-4 p-4 bg-violet-500/5 rounded-xl border border-violet-500/10">
                          <Avatar className="w-12 h-12 border-2 border-violet-500/20 rounded-full">
                            {connection?.userPhoto && <AvatarImage src={connection.userPhoto} />}
                            <AvatarFallback className="bg-violet-500/10 text-violet-400 text-lg font-bold rounded-full">
                              {connection?.userName?.charAt(0) || 'VK'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-semibold text-zinc-100">{connection?.userName}</p>
                            <p className="text-xs text-zinc-500">ID: {connection?.userId}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-xs text-emerald-400 font-medium">Подключён</span>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleDisconnect}
                          className="w-full border-red-500/10 text-red-400 hover:bg-red-500/5 rounded-xl transition-all duration-200"
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
                              className="w-full h-12 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white font-semibold rounded-xl text-base gap-2 transition-all duration-200"
                            >
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <rect width="20" height="20" rx="4" fill="white" fillOpacity="0.2"/>
                                <path d="M5 7h1.8c.2 0 .4.1.4.3.3.7.9 2 1.4 2.3.2.1.3 0 .3-.2v-1.4c0-.5-.2-.9-.2-.9s-.1-.2-.3-.2c-.1 0-.2-.1-.1-.2.1-.1.3-.3.6-.3h1.4c.3 0 .5.2.5.5v2.1c0 .2.2.4.3.2.4-.3 1-1.4 1.5-2.4.1-.2.2-.3.4-.3h1.5c.3 0 .5.3.3.6-.6 1-1.5 2.5-1.9 2.9-.2.2-.1.4 0 .6.5.5 1.4 1.5 1.8 2 .2.2.1.5-.2.5h-1.8c-.2 0-.3-.1-.5-.2-.4-.4-.9-1-1.3-1-.2 0-.3.1-.3.4v.5c0 .2-.2.4-.4.4h-1c-1.8 0-3.2-2.5-4.1-4.6-.1-.2 0-.4.2-.4z" fill="white"/>
                              </svg>
                              {oauthConnecting ? 'Ожидание авторизации...' : 'Подключить через ВКонтакте'}
                            </Button>
                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-zinc-800" />
                              </div>
                              <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#09090b] px-2 text-zinc-600">или введите токен вручную</span>
                              </div>
                            </div>
                          </>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="token" className="text-zinc-300">Токен доступа</Label>
                          <Input
                            id="token"
                            type="password"
                            placeholder="vk1.a.xxx..."
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleConnect()}
                            className="h-11 border-zinc-800 bg-zinc-900/50 focus:border-violet-500 focus:ring-violet-500/20 rounded-xl text-zinc-100 placeholder:text-zinc-600"
                          />
                        </div>
                        <Button
                          onClick={handleConnect}
                          disabled={connecting}
                          className="w-full h-11 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all duration-200"
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
                <Card className="border-amber-500/10 bg-zinc-950/60 backdrop-blur-xl shadow-xl shadow-violet-500/[0.03] rounded-2xl">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-amber-200/90 text-base font-semibold">
                      <Info className="w-5 h-5 text-amber-400/80" />
                      Как получить токен
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-amber-200/70">
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                        <p className="leading-snug">Создайте Standalone-приложение на <a href="https://vk.com/editapp?act=create" target="_blank" rel="noopener noreferrer" className="text-violet-400 underline">vk.com/editapp</a></p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                        <p className="leading-snug">Получите токен через Implicit Flow с правами <code className="bg-zinc-900/60 px-1 rounded text-xs">messages</code></p>
                      </div>
                      <div className="flex gap-3">
                        <div className="w-6 h-6 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                        <p className="leading-snug">Скопируйте токен из адресной строки и вставьте в поле</p>
                      </div>
                    </div>
                    <Separator className="bg-amber-500/10" />
                    <div className="bg-zinc-900/40 p-3 rounded-xl">
                      <p className="text-xs text-amber-200/80">
                        <strong>Важно:</strong> Токен хранится локально и используется только для API ВКонтакте. Не передавайте его третьим лицам.
                      </p>
                    </div>
                    <div className="bg-zinc-900/40 p-3 rounded-xl space-y-1">
                      <p className="text-xs text-amber-200/80 font-semibold">Пример URL для получения токена:</p>
                      <code className="text-[10px] break-all leading-relaxed block text-amber-200/60">
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
            <Card className="border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl shadow-xl shadow-violet-500/[0.03] rounded-2xl h-full flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2.5 text-zinc-100 text-base font-semibold">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5 flex items-center justify-center">
                        <Users className="w-4 h-4 text-violet-400" />
                      </div>
                      Чаты ВКонтакте
                    </CardTitle>
                    <CardDescription className="mt-1 text-zinc-500">
                      {selectedChats.length > 0
                        ? `Выбрано ${selectedChats.length} из ${chats.length} чатов`
                        : 'Выберите чаты для отправки сообщений'
                      }
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchChats(true)}
                    disabled={loadingChats}
                    className="border-violet-500/20 text-violet-400 hover:bg-violet-500/5 rounded-xl transition-all duration-200"
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loadingChats ? 'animate-spin' : ''}`} />
                    Обновить
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 flex flex-col pt-0">
                {chats.length > 0 && (
                  <div className="mb-3 flex-shrink-0">
                    <Input
                      placeholder="Поиск чатов..."
                      value={chatSearch}
                      onChange={e => setChatSearch(e.target.value)}
                      className="h-9 border-zinc-800 bg-zinc-900/50 focus:border-violet-500 focus:ring-violet-500/20 rounded-xl text-zinc-100 placeholder:text-zinc-600"
                    />
                  </div>
                )}

                {loadingChats ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw className="w-5 h-5 animate-spin text-violet-400" />
                    <span className="ml-3 text-zinc-500">Загрузка чатов...</span>
                  </div>
                ) : chats.length === 0 ? (
                  <div className="text-center py-16 text-zinc-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Чаты не найдены</p>
                    <p className="text-xs mt-1 text-zinc-600">Нажмите &quot;Обновить&quot; для загрузки из ВКонтакте</p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-0.5">
                      {filteredChats.map(chat => (
                        <div
                          key={chat.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${
                            chat.isSelected
                              ? 'bg-violet-500/5 border border-violet-500/10'
                              : 'hover:bg-zinc-800/30 border border-transparent'
                          }`}
                          onClick={() => toggleChatSelection(chat.id, !chat.isSelected)}
                        >
                          <Avatar className="w-9 h-9 rounded-full">
                            {chat.photo && <AvatarImage src={chat.photo} />}
                            <AvatarFallback className={
                              chat.chatType === 'group'
                                ? 'bg-violet-500/10 text-violet-400 rounded-full'
                                : 'bg-violet-500/5 text-violet-300 rounded-full'
                            }>
                              {chat.chatType === 'group' ? (
                                <Users className="w-4 h-4" />
                              ) : (
                                <MessageSquare className="w-4 h-4" />
                              )}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-zinc-200 truncate">{chat.title}</p>
                            <p className="text-xs text-zinc-600">
                              {chat.chatType === 'group' ? 'Беседа' : 'ЛС'} · {chat.vkPeerId}
                            </p>
                          </div>
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                            chat.isSelected
                              ? 'bg-violet-600 border-violet-600'
                              : 'border-zinc-700'
                          }`}>
                            {chat.isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                {selectedChats.length > 0 && (
                  <div className="flex-shrink-0 mt-3 p-3 bg-violet-500/5 rounded-xl border border-violet-500/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-violet-400">
                      <CheckCircle className="w-4 h-4" />
                      <span className="font-medium">Выбрано {selectedChats.length} чат{selectedChats.length === 1 ? '' : selectedChats.length < 5 ? 'а' : 'ов'}</span>
                    </div>
                    <Button
                      onClick={() => { setActiveTab('tasks'); openCreateDialog(); }}
                      className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl h-9 transition-all duration-200"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Запланировать
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== TASKS TAB ===== */}
          <TabsContent value="tasks" className="flex-1 min-h-0 mt-0 overflow-y-auto">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-violet-400" />
                    Запланированные сообщения
                  </h2>
                  <p className="text-sm text-zinc-500">
                    {tasks.filter(t => t.isActive).length} активных · {tasks.length} всего
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={runScheduler}
                    className="border-violet-500/20 text-violet-400 hover:bg-violet-500/5 rounded-xl transition-all duration-200"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Проверить
                  </Button>
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl h-9 px-4 transition-all duration-200">
                        <Plus className="w-4 h-4 mr-2" />
                        Новая задача
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col bg-zinc-950/95 backdrop-blur-xl border-zinc-800 rounded-2xl">
                      <DialogHeader className="flex-shrink-0 bg-gradient-to-r from-violet-600 to-violet-500 -mx-6 -mt-6 px-6 pt-6 pb-4 rounded-t-2xl">
                        <DialogTitle className="text-white font-semibold">Новое запланированное сообщение</DialogTitle>
                        <DialogDescription className="text-white/60">
                          Настройте время и содержание сообщения
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
                        {/* Multi-chat selection — pill/chips style */}
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Чаты *</Label>
                          {selectedChats.length === 0 ? (
                            <p className="text-sm text-zinc-500 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
                              Сначала выберите чаты на вкладке &quot;Чаты&quot;
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-zinc-800/60 bg-zinc-900/30">
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedChatIdsForTask.length === selectedChats.length) {
                                    setSelectedChatIdsForTask([]);
                                  } else {
                                    setSelectedChatIdsForTask(selectedChats.map(c => c.id));
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                                  selectedChatIdsForTask.length === selectedChats.length
                                    ? 'bg-violet-600 text-white'
                                    : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60'
                                }`}
                              >
                                Все ({selectedChats.length})
                              </button>
                              {selectedChats.map(chat => (
                                <button
                                  key={chat.id}
                                  type="button"
                                  onClick={() => toggleChatInTask(chat.id)}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 max-w-[160px] ${
                                    selectedChatIdsForTask.includes(chat.id)
                                      ? 'bg-violet-600 text-white'
                                      : 'bg-zinc-800/60 text-zinc-400 hover:bg-zinc-700/60'
                                  }`}
                                >
                                  <span className="truncate">{chat.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {selectedChatIdsForTask.length > 0 && (
                            <p className="text-xs text-violet-400">Выбрано: {selectedChatIdsForTask.length} чат{selectedChatIdsForTask.length === 1 ? '' : selectedChatIdsForTask.length < 5 ? 'а' : 'ов'}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Текст сообщения *</Label>
                          <Textarea
                            placeholder="Введите текст сообщения..."
                            value={newTaskMessage}
                            onChange={e => setNewTaskMessage(e.target.value)}
                            rows={3}
                            className="max-h-32 overflow-y-auto border-zinc-800 bg-zinc-900/50 focus:border-violet-500 focus:ring-violet-500/20 rounded-xl text-zinc-100 placeholder:text-zinc-600"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-zinc-300">Тип расписания</Label>
                            <Select value={newTaskScheduleType} onValueChange={setNewTaskScheduleType}>
                              <SelectTrigger className="border-zinc-800 bg-zinc-900/50 rounded-xl text-zinc-100">
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
                          <div className="space-y-2">
                            <Label className="text-zinc-300">{newTaskScheduleType === 'interval' ? 'Начать с' : 'Дата и время'}</Label>
                            <Input
                              type="datetime-local"
                              value={newTaskScheduledAt}
                              onChange={e => setNewTaskScheduledAt(e.target.value)}
                              min={getMinDateTime()}
                              className="border-zinc-800 bg-zinc-900/50 focus:border-violet-500 rounded-xl text-zinc-100"
                            />
                          </div>
                        </div>
                        {newTaskScheduleType === 'interval' && (
                          <div className="space-y-2">
                            <Label className="text-zinc-300">Интервал отправки</Label>
                            <Select value={newTaskInterval} onValueChange={setNewTaskInterval}>
                              <SelectTrigger className="border-zinc-800 bg-zinc-900/50 rounded-xl text-zinc-100">
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
                        {newTaskScheduleType === 'weekly' && (
                          <div className="space-y-2">
                            <Label className="text-zinc-300">День недели</Label>
                            <Select value={newTaskDayOfWeek} onValueChange={setNewTaskDayOfWeek}>
                              <SelectTrigger className="border-zinc-800 bg-zinc-900/50 rounded-xl text-zinc-100"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DAYSOfWeek.map((day, i) => (
                                  <SelectItem key={i} value={String(i)}>{day}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        {newTaskScheduleType === 'monthly' && (
                          <div className="space-y-2">
                            <Label className="text-zinc-300">День месяца</Label>
                            <Select value={newTaskDayOfMonth} onValueChange={setNewTaskDayOfMonth}>
                              <SelectTrigger className="border-zinc-800 bg-zinc-900/50 rounded-xl text-zinc-100"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                                  <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="flex items-center justify-between p-3 bg-amber-500/5 rounded-xl border border-amber-500/10">
                          <div className="flex items-center gap-2">
                            <Trash className="w-4 h-4 text-amber-400/80" />
                            <div>
                              <Label className="text-sm font-medium text-amber-200/80 cursor-pointer">Удалить предыдущее</Label>
                              <p className="text-xs text-amber-400/50">Перед отправкой удалять прошлое сообщение</p>
                            </div>
                          </div>
                          <Switch
                            checked={newTaskDeletePrevious}
                            onCheckedChange={setNewTaskDeletePrevious}
                          />
                        </div>
                      </div>
                      <DialogFooter className="flex-shrink-0 pt-2 border-t border-zinc-800">
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)} className="rounded-xl border-zinc-800 text-zinc-300 hover:bg-zinc-800/50 transition-all duration-200">Отмена</Button>
                        <Button onClick={handleCreateTask} disabled={creating} className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl transition-all duration-200">
                          {creating ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                          {creating ? 'Создание...' : 'Запланировать'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {tasks.length === 0 ? (
                <Card className="border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl rounded-2xl">
                  <CardContent className="py-16 text-center text-zinc-500">
                    <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Нет запланированных сообщений</p>
                    <p className="text-xs mt-1 text-zinc-600">Нажмите &quot;Новая задача&quot; для создания</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-2">
                  {tasks.map(task => {
                    const statusInfo = getStatusIndicator(task.status);
                    return (
                      <Card key={task.id} className={`border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl rounded-2xl ${!task.isActive ? 'opacity-50' : ''} ${
                        task.status === 'sent' ? 'border-l-status-sent' :
                        task.status === 'pending' ? 'border-l-status-pending' :
                        task.status === 'failed' ? 'border-l-status-failed' :
                        'border-l-status-disabled'
                      }`}>
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <div className={`timeline-dot ${statusInfo.dot}`} />
                                  <span className={`text-xs font-medium ${statusInfo.cls}`}>{statusInfo.label}</span>
                                </div>
                                <Badge variant="outline" className="text-xs border-violet-500/20 text-violet-400 font-medium bg-violet-500/5">
                                  {SCHEDULE_LABELS[task.scheduleType] || task.scheduleType}
                                  {task.scheduleType === 'interval' && task.intervalMinutes
                                    ? ` — ${formatInterval(task.intervalMinutes)}`
                                    : ''}
                                </Badge>
                                {task.chat && (
                                  <Badge variant="secondary" className="text-xs font-medium bg-zinc-800/60 text-zinc-300">
                                    {task.chat.title}
                                  </Badge>
                                )}
                                {task.deletePrevious && (
                                  <Badge className="text-xs bg-amber-500/5 text-amber-400 border border-amber-500/10 font-medium">
                                    <Trash className="w-3 h-3 mr-1" />
                                    Удал. пред.
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-zinc-200 break-words line-clamp-2">{task.messageText}</p>
                              <div className="flex items-center gap-3 text-xs text-zinc-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(task.scheduledAt).toLocaleString('ru-RU')}
                                </span>
                                {task.lastSentAt && (
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    {new Date(task.lastSentAt).toLocaleString('ru-RU')}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5 flex-shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-zinc-500 hover:text-violet-400 hover:bg-violet-500/5 rounded-lg transition-all duration-200"
                                onClick={() => toggleTaskActive(task.id, !task.isActive)}
                                title={task.isActive ? 'Приостановить' : 'Активировать'}
                              >
                                {task.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-all duration-200"
                                onClick={() => deleteTask(task.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== LOGS TAB ===== */}
          <TabsContent value="logs" className="flex-1 min-h-0 mt-0">
            <Card className="border-zinc-800/60 bg-zinc-950/60 backdrop-blur-xl shadow-xl shadow-violet-500/[0.03] rounded-2xl h-full flex flex-col">
              <CardHeader className="pb-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2.5 text-zinc-100 text-base font-semibold">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/10 to-violet-500/5 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-violet-400" />
                      </div>
                      Журнал отправок
                    </CardTitle>
                    <CardDescription className="mt-1 text-zinc-500">
                      История отправленных сообщений и ошибок
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchLogs}
                    className="border-violet-500/20 text-violet-400 hover:bg-violet-500/5 rounded-xl transition-all duration-200"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Обновить
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 min-h-0 flex flex-col pt-0">
                {logs.length === 0 ? (
                  <div className="text-center py-16 text-zinc-500">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Журнал пуст</p>
                    <p className="text-xs mt-1 text-zinc-600">Записи появятся после отправки сообщений</p>
                  </div>
                ) : (
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="relative pl-5">
                      {/* Timeline line */}
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-800/60" />
                      <div className="space-y-3">
                        {logs.map(log => (
                          <div key={log.id} className="relative flex items-start gap-3">
                            {/* Timeline dot */}
                            <div className={`timeline-dot absolute left-[-13px] top-3 z-10 ${
                              log.status === 'sent' ? 'bg-emerald-500' : 'bg-red-500'
                            }`} />
                            <div className={`flex-1 p-2.5 rounded-xl border ${
                              log.status === 'sent'
                                ? 'bg-emerald-500/5 border-emerald-500/10'
                                : 'bg-red-500/5 border-red-500/10'
                            }`}>
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium text-zinc-200 truncate">
                                  {log.task?.chat?.title || 'Чат'}
                                </p>
                                <span className="text-[11px] text-zinc-600 whitespace-nowrap">
                                  {new Date(log.sentAt).toLocaleString('ru-RU')}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-500 mt-0.5 truncate">
                                {log.task?.messageText || '—'}
                              </p>
                              {log.error && (
                                <p className="text-xs text-red-400 mt-0.5">{log.error}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer — Minimal */}
      <footer className="bg-zinc-950/60 backdrop-blur-xl border-t border-zinc-800/60 flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-9 flex items-center justify-between text-[11px] text-zinc-600">
          <span>VK Messages</span>
          <span className="flex items-center gap-2">
            {connected ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-500">Подключён</span>
              </>
            ) : 'Не подключён'}
          </span>
        </div>
      </footer>
    </div>
  );
}
