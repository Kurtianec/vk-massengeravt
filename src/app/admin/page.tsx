'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Shield,
  Users,
  Trash2,
  Edit2,
  Mail,
  Key,
  User,
  Calendar,
  Search,
  Eye,
  EyeOff,
  Settings,
  Save,
  ExternalLink,
  Copy,
  Lock,
} from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  connections: {
    id: string;
    accessToken: string | null;
    userId: number | null;
    userName: string | null;
    userPhoto: string | null;
    isActive: boolean;
    createdAt: string;
    fullTokenAvailable: boolean;
  }[];
}

interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
}

export default function AdminPage() {
  const { toast } = useToast();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('users');

  // Edit form
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('user');
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordVisible, setEditPasswordVisible] = useState(false);

  // Token view
  const [fullToken, setFullToken] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);

  // Settings
  const [vkAppId, setVkAppId] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const res = await fetch('/api/auth/session', { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data.authenticated && data.user && data.user.role === 'admin') {
          setAuthUser(data.user);
        } else {
          window.location.href = '/';
        }
      } catch {
        window.location.href = '/login';
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось загрузить пользователей', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      setSettingsLoading(true);
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setVkAppId(data.settings?.vk_app_id || '');
      }
    } catch {
      // silent
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    if (authUser) {
      fetchUsers();
      fetchSettings();
    }
  }, [authUser]);

  const handleSaveSettings = async () => {
    try {
      setSettingsSaving(true);
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { vk_app_id: vkAppId } }),
      });
      if (res.ok) {
        toast({ title: 'Настройки сохранены', description: 'ID приложения ВК обновлён' });
      } else {
        const data = await res.json();
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить настройки', variant: 'destructive' });
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleEdit = (user: AdminUser) => {
    setSelectedUser(user);
    setEditName(user.name || '');
    setEditEmail(user.email);
    setEditRole(user.role);
    setEditPassword('');
    setEditPasswordVisible(false);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;
    try {
      const body: Record<string, string> = {
        name: editName,
        email: editEmail,
        role: editRole,
      };
      if (editPassword) body.password = editPassword;

      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Обновлено', description: 'Данные пользователя обновлены' });
        setEditDialogOpen(false);
        fetchUsers();
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось обновить', variant: 'destructive' });
    }
  };

  const handleDelete = (user: AdminUser) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast({ title: 'Удалено', description: 'Пользователь удалён' });
        setDeleteDialogOpen(false);
        fetchUsers();
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' });
    }
  };

  const handleViewToken = async (user: AdminUser) => {
    setSelectedUser(user);
    setTokenVisible(false);
    setTokenDialogOpen(true);
    setFullToken(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}?fullToken=1`);
      if (res.ok) {
        const data = await res.json();
        if (data.user?.connections?.[0]?.accessToken) {
          setFullToken(data.user.connections[0].accessToken);
        }
      }
    } catch {
      setFullToken(null);
    }
  };

  const filteredUsers = search
    ? users.filter(u =>
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.name && u.name.toLowerCase().includes(search.toLowerCase()))
      )
    : users;

  const oauthEnabled = !!vkAppId.trim();

  if (authLoading) {
    return (
      <div className="h-screen bg-[#0f0f11] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin h-8 w-8 text-[#8b5cf6]" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <p className="text-sm text-[#a1a1aa]">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!authUser) return null;

  return (
    <div className="min-h-screen bg-[#0f0f11] flex flex-col">
      {/* Header */}
      <header className="bg-[#1a1a1f]/80 backdrop-blur-md z-50 border-b border-[#2e2e35] flex-shrink-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = '/'}
              className="flex items-center gap-2 text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#8b5cf6]" />
              <h1 className="text-[#f5f5f7] font-bold text-lg leading-none">Админ-панель</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#8b5cf6]/20 text-[#8b5cf6] border-0 text-xs">
              <Shield className="w-3 h-3 mr-1" />
              Администратор
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
          <TabsList className="bg-[#1a1a1f] rounded-xl border border-[#2e2e35] h-11 p-1 w-full max-w-md grid grid-cols-2">
            <TabsTrigger value="users" className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-[#8b5cf6] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#a1a1aa]">
              <Users className="w-3.5 h-3.5" />
              Пользователи
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5 rounded-lg text-xs data-[state=active]:bg-[#8b5cf6] data-[state=active]:text-white data-[state=active]:shadow-sm text-[#a1a1aa]">
              <Settings className="w-3.5 h-3.5" />
              Настройки
            </TabsTrigger>
          </TabsList>

          {/* ===== USERS TAB ===== */}
          <TabsContent value="users" className="mt-4">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="bg-[#1a1a1f] rounded-xl px-4 py-3 flex items-center gap-3 border border-[#2e2e35]">
                <div className="w-9 h-9 rounded-lg bg-[#8b5cf6]/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-[#8b5cf6]" />
                </div>
                <div>
                  <div className="text-xl font-bold text-[#f5f5f7]">{users.length}</div>
                  <div className="text-[11px] text-[#a1a1aa]">Пользователей</div>
                </div>
              </div>
              <div className="bg-[#1a1a1f] rounded-xl px-4 py-3 flex items-center gap-3 border border-[#2e2e35]">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-[#f5f5f7]">{users.filter(u => u.role === 'admin').length}</div>
                  <div className="text-[11px] text-[#a1a1aa]">Администраторов</div>
                </div>
              </div>
              <div className="bg-[#1a1a1f] rounded-xl px-4 py-3 flex items-center gap-3 border border-[#2e2e35]">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Key className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-[#f5f5f7]">{users.filter(u => u.connections.length > 0).length}</div>
                  <div className="text-[11px] text-[#a1a1aa]">С ВК токеном</div>
                </div>
              </div>
              <div className="bg-[#1a1a1f] rounded-xl px-4 py-3 flex items-center gap-3 border border-[#2e2e35]">
                <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-violet-400" />
                </div>
                <div>
                  <div className="text-xl font-bold text-[#f5f5f7]">
                    {users.length > 0 ? new Date(users[0].createdAt).toLocaleDateString('ru') : '—'}
                  </div>
                  <div className="text-[11px] text-[#a1a1aa]">Последний рег.</div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a1a1aa]" />
                <Input
                  placeholder="Поиск по email или имени..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 h-11 border-[#2e2e35] bg-[#0f0f11] focus:border-[#8b5cf6] focus:ring-[#8b5cf6]/20 rounded-xl text-[#f5f5f7] placeholder:text-[#a1a1aa]"
                />
              </div>
            </div>

            {/* Users Table / Cards */}
            <div className="bg-[#1a1a1f] rounded-2xl border border-[#2e2e35] overflow-hidden">
              {/* Desktop table */}
              <div className="hidden md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2e2e35] bg-[#0f0f11]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">Пользователь</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">Email / Пароль</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">Роль</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">ВК Токен</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">Дата</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[#a1a1aa] uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="border-b border-[#2e2e35]/50 hover:bg-[#27272a] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] font-bold text-sm">
                              {u.name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm text-[#f5f5f7]">{u.name || 'Без имени'}</p>
                              <p className="text-xs text-[#a1a1aa]">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-[#a1a1aa]" />
                            <span className="text-xs text-[#a1a1aa]">••••••</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(u)}
                              className="h-6 px-2 text-xs text-[#8b5cf6] hover:text-[#a78bfa]"
                            >
                              Изменить
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {u.role === 'admin' ? (
                            <Badge className="bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 font-medium">
                              <Shield className="w-3 h-3 mr-1" />
                              Админ
                            </Badge>
                          ) : (
                            <Badge className="bg-[#27272a] text-[#a1a1aa] border border-[#2e2e35] font-medium">
                              Пользователь
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.connections.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span className="text-xs text-[#a1a1aa] font-mono">{u.connections[0].accessToken}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-[#a1a1aa]">Нет</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#a1a1aa]">
                          {new Date(u.createdAt).toLocaleDateString('ru', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {u.connections.length > 0 && (
                              <Button variant="ghost" size="sm" onClick={() => handleViewToken(u)} className="h-8 w-8 p-0 text-[#a1a1aa] hover:text-[#8b5cf6]" title="Токен">
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(u)} className="h-8 w-8 p-0 text-[#a1a1aa] hover:text-[#8b5cf6]" title="Редактировать">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {u.id !== authUser.id && (
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} className="h-8 w-8 p-0 text-[#a1a1aa] hover:text-red-400" title="Удалить">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden">
                <ScrollArea className="max-h-[calc(100vh-360px)]">
                  <div className="divide-y divide-[#2e2e35]/50">
                    {filteredUsers.map(u => (
                      <div key={u.id} className="p-4 hover:bg-[#27272a] transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] font-bold flex-shrink-0">
                              {u.name?.charAt(0)?.toUpperCase() || u.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm text-[#f5f5f7] truncate">{u.name || 'Без имени'}</p>
                                {u.role === 'admin' && <Shield className="w-3.5 h-3.5 text-[#8b5cf6] flex-shrink-0" />}
                              </div>
                              <p className="text-xs text-[#a1a1aa] truncate">{u.email}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="flex items-center gap-1 text-xs text-[#a1a1aa]">
                                  <Lock className="w-3 h-3" /> ••••
                                </span>
                                {u.connections.length > 0 ? (
                                  <span className="text-xs text-emerald-400 flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />ВК
                                  </span>
                                ) : (
                                  <span className="text-xs text-[#a1a1aa]">Без ВК</span>
                                )}
                                <span className="text-xs text-[#a1a1aa]">
                                  {new Date(u.createdAt).toLocaleDateString('ru')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {u.connections.length > 0 && (
                              <Button variant="ghost" size="sm" onClick={() => handleViewToken(u)} className="h-8 w-8 p-0 text-[#a1a1aa]">
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(u)} className="h-8 w-8 p-0 text-[#a1a1aa]">
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {u.id !== authUser.id && (
                              <Button variant="ghost" size="sm" onClick={() => handleDelete(u)} className="h-8 w-8 p-0 text-[#a1a1aa]">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {filteredUsers.length === 0 && (
                <div className="py-16 text-center text-[#a1a1aa]">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Пользователи не найдены</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ===== SETTINGS TAB ===== */}
          <TabsContent value="settings" className="mt-4">
            <div className="max-w-2xl space-y-6">
              {/* VK OAuth Settings */}
              <div className="bg-[#1a1a1f] rounded-2xl border border-[#2e2e35] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#2e2e35] bg-[#0f0f11]">
                  <h3 className="flex items-center gap-2 font-semibold text-[#f5f5f7]">
                    <div className="w-8 h-8 rounded-lg bg-[#8b5cf6]/10 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                        <rect width="20" height="20" rx="4" fill="#8b5cf6" fillOpacity="0.2"/>
                        <path d="M5 7h1.8c.2 0 .4.1.4.3.3.7.9 2 1.4 2.3.2.1.3 0 .3-.2v-1.4c0-.5-.2-.9-.2-.9s-.1-.2-.3-.2c-.1 0-.2-.1-.1-.2.1-.1.3-.3.6-.3h1.4c.3 0 .5.2.5.5v2.1c0 .2.2.4.3.2.4-.3 1-1.4 1.5-2.4.1-.2.2-.3.4-.3h1.5c.3 0 .5.3.3.6-.6 1-1.5 2.5-1.9 2.9-.2.2-.1.4 0 .6.5.5 1.4 1.5 1.8 2 .2.2.1.5-.2.5h-1.8c-.2 0-.3-.1-.5-.2-.4-.4-.9-1-1.3-1-.2 0-.3.1-.3.4v.5c0 .2-.2.4-.4.4h-1c-1.8 0-3.2-2.5-4.1-4.6-.1-.2 0-.4.2-.4z" fill="#8b5cf6"/>
                      </svg>
                    </div>
                    Подключение через ВКонтакте (OAuth)
                  </h3>
                  <p className="text-sm text-[#a1a1aa] mt-1">
                    Настройте автоматическое получение токена для пользователей
                  </p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[#f5f5f7] font-medium">ID приложения ВКонтакте</Label>
                    <Input
                      value={vkAppId}
                      onChange={e => setVkAppId(e.target.value)}
                      placeholder="Например: 12345678"
                      className="h-11 border-[#2e2e35] bg-[#0f0f11] focus:border-[#8b5cf6] focus:ring-[#8b5cf6]/20 rounded-xl text-[#f5f5f7] placeholder:text-[#a1a1aa]"
                    />
                    <p className="text-xs text-[#a1a1aa]">
                      Создайте Standalone-приложение на{' '}
                      <a href="https://vk.com/editapp?act=create" target="_blank" rel="noopener noreferrer" className="text-[#8b5cf6] hover:underline inline-flex items-center gap-0.5">
                        vk.com/editapp <ExternalLink className="w-3 h-3" />
                      </a>{' '}
                      и укажите его ID здесь
                    </p>
                  </div>

                  {oauthEnabled && (
                    <div className="bg-[#2d2b55] border border-[#8b5cf6]/20 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-sm font-medium text-[#f5f5f7]">OAuth авторизация включена</span>
                      </div>
                      <p className="text-xs text-[#a1a1aa]">
                        Пользователи смогут подключать ВКонтакте в один клик через кнопку &quot;Подключить через ВКонтакте&quot;.
                      </p>
                      <div className="bg-[#0f0f11]/60 rounded-lg p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-[#f5f5f7]">В настройках приложения ВК укажите:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-[#0f0f11] px-2 py-1 rounded border border-[#2e2e35] text-[#f5f5f7] flex-1 break-all select-all">
                            {typeof window !== 'undefined' ? `${window.location.origin}/vk-callback` : '/vk-callback'}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const url = `${window.location.origin}/vk-callback`;
                              navigator.clipboard.writeText(url);
                              toast({ title: 'Скопировано', description: 'Redirect URI скопирован' });
                            }}
                            className="h-7 w-7 p-0 text-[#8b5cf6]"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="text-[10px] text-[#a1a1aa]">
                          Раздел: Настройки → Открытые API → Адрес страницы авторизации
                        </p>
                      </div>
                    </div>
                  )}

                  {!oauthEnabled && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                      <p className="text-xs text-amber-300">
                        <strong>Без ID приложения</strong> пользователям придётся вручную получать и вставлять токен доступа. Укажите ID приложения, чтобы включить авторизацию в один клик.
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={handleSaveSettings}
                    disabled={settingsSaving}
                    className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white font-semibold rounded-xl h-10"
                  >
                    {settingsSaving ? (
                      <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                      </svg>
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    {settingsSaving ? 'Сохранение...' : 'Сохранить настройки'}
                  </Button>
                </div>
              </div>

              {/* Instructions card */}
              <div className="bg-[#1a1a1f] rounded-2xl border border-[#2e2e35] overflow-hidden">
                <div className="px-6 py-4 border-b border-[#2e2e35] bg-[#0f0f11]">
                  <h3 className="font-semibold text-[#f5f5f7] flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-[#8b5cf6]" />
                    Инструкция по настройке
                  </h3>
                </div>
                <div className="px-6 py-5 space-y-4 text-sm text-[#f5f5f7]">
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                    <div>
                      <p className="font-medium">Создайте приложение ВКонтакте</p>
                      <p className="text-xs text-[#a1a1aa] mt-0.5">
                        Перейдите на <a href="https://vk.com/editapp?act=create" target="_blank" rel="noopener noreferrer" className="text-[#8b5cf6] hover:underline">vk.com/editapp</a> и создайте Standalone-приложение
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                    <div>
                      <p className="font-medium">Настройте Redirect URI</p>
                      <p className="text-xs text-[#a1a1aa] mt-0.5">
                        В настройках приложения укажите адрес: <code className="bg-[#0f0f11] px-1.5 py-0.5 rounded text-[10px]">{'/vk-callback'}</code> вашего сайта
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#8b5cf6] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                    <div>
                      <p className="font-medium">Скопируйте ID приложения</p>
                      <p className="text-xs text-[#a1a1aa] mt-0.5">
                        Вставьте числовой ID приложения в поле выше и нажмите &quot;Сохранить&quot;
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">✓</div>
                    <div>
                      <p className="font-medium">Готово!</p>
                      <p className="text-xs text-[#a1a1aa] mt-0.5">
                        Теперь пользователи смогут подключать ВКонтакте в один клик
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[#1a1a1f] border-[#2e2e35]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#f5f5f7]">
              <Edit2 className="w-5 h-5 text-[#8b5cf6]" />
              Редактирование пользователя
            </DialogTitle>
            <DialogDescription className="text-[#a1a1aa]">
              Измените данные пользователя
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedUser && (
              <div className="flex items-center gap-3 p-3 bg-[#0f0f11] rounded-xl border border-[#2e2e35]">
                <div className="w-10 h-10 rounded-full bg-[#8b5cf6]/10 flex items-center justify-center text-[#8b5cf6] font-bold">
                  {selectedUser.name?.charAt(0)?.toUpperCase() || selectedUser.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#f5f5f7] truncate">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {selectedUser.role === 'admin' ? (
                      <Badge className="bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 text-[10px] py-0">
                        <Shield className="w-2.5 h-2.5 mr-0.5" />Админ
                      </Badge>
                    ) : (
                      <Badge className="bg-[#27272a] text-[#a1a1aa] border border-[#2e2e35] text-[10px] py-0">
                        Пользователь
                      </Badge>
                    )}
                    {selectedUser.connections.length > 0 && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-emerald-500" />ВК подключён
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[#f5f5f7]">Имя</Label>
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Имя пользователя"
                className="border-[#2e2e35] bg-[#0f0f11] focus:border-[#8b5cf6] rounded-xl text-[#f5f5f7]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#f5f5f7]">Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="border-[#2e2e35] bg-[#0f0f11] focus:border-[#8b5cf6] rounded-xl text-[#f5f5f7]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[#f5f5f7]">Роль</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="border-[#2e2e35] bg-[#0f0f11] rounded-xl text-[#f5f5f7]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Пользователь</SelectItem>
                  <SelectItem value="admin">Администратор</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[#f5f5f7] flex items-center gap-2">
                <Lock className="w-3.5 h-3.5" />
                Новый пароль
              </Label>
              <div className="relative">
                <Input
                  type={editPasswordVisible ? 'text' : 'password'}
                  value={editPassword}
                  onChange={e => setEditPassword(e.target.value)}
                  placeholder="Оставьте пустым, чтобы не менять"
                  className="border-[#2e2e35] bg-[#0f0f11] focus:border-[#8b5cf6] rounded-xl pr-10 text-[#f5f5f7]"
                />
                <button
                  type="button"
                  onClick={() => setEditPasswordVisible(!editPasswordVisible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a1a1aa] hover:text-[#f5f5f7]"
                >
                  {editPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-[#a1a1aa]">Минимум 6 символов. Текущий пароль неизвестен — только хранится хеш.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl border-[#2e2e35] text-[#f5f5f7] hover:bg-[#27272a]">
              Отмена
            </Button>
            <Button onClick={handleSaveEdit} className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl">
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm bg-[#1a1a1f] border-[#2e2e35]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <Trash2 className="w-5 h-5" />
              Удаление пользователя
            </DialogTitle>
            <DialogDescription className="text-[#a1a1aa]">
              Вы уверены, что хотите удалить пользователя <strong>{selectedUser?.email}</strong>?
              Все связанные данные (ВК подключения, чаты, задачи, логи) будут удалены безвозвратно.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl border-[#2e2e35] text-[#f5f5f7] hover:bg-[#27272a]">
              Отмена
            </Button>
            <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white rounded-xl">
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token View Dialog */}
      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-[#1a1a1f] border-[#2e2e35]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#f5f5f7]">
              <Key className="w-5 h-5 text-[#8b5cf6]" />
              VK Token — {selectedUser?.email}
            </DialogTitle>
            <DialogDescription className="text-[#a1a1aa]">
              Токен доступа ВКонтакте пользователя
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {fullToken ? (
              <div className="space-y-3">
                <div className="bg-[#0f0f11] border border-[#2e2e35] rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Label className="text-xs text-[#a1a1aa]">Токен доступа</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTokenVisible(!tokenVisible)}
                      className="h-7 px-2 text-xs text-[#8b5cf6]"
                    >
                      {tokenVisible ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                      {tokenVisible ? 'Скрыть' : 'Показать'}
                    </Button>
                  </div>
                  <p className="text-xs font-mono break-all text-[#f5f5f7] select-all">
                    {tokenVisible ? fullToken : fullToken.slice(0, 15) + '••••••••••••' + fullToken.slice(-8)}
                  </p>
                </div>
                {selectedUser?.connections?.[0] && (
                  <div className="flex items-center gap-4 text-xs text-[#a1a1aa]">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {selectedUser.connections[0].userName || 'Без имени'}
                    </span>
                    {selectedUser.connections[0].userId && (
                      <span>ID: {selectedUser.connections[0].userId}</span>
                    )}
                  </div>
                )}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-300">
                    <strong>Внимание:</strong> Не передавайте токен третьим лицам. Он предоставляет полный доступ к аккаунту ВКонтакте.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-[#a1a1aa]">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Токен не найден</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenDialogOpen(false)} className="rounded-xl border-[#2e2e35] text-[#f5f5f7] hover:bg-[#27272a]">
              Закрыть
            </Button>
            {fullToken && (
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(fullToken);
                  toast({ title: 'Скопировано', description: 'Токен скопирован в буфер обмена' });
                }}
                className="bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-xl"
              >
                Копировать
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
