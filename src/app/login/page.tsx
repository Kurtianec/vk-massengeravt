'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, name };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        window.location.href = '/';
      } else {
        setError(data.error || 'Произошла ошибка');
      }
    } catch {
      setError('Не удалось подключиться к серверу');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(180deg, #09090b 0%, #0f0f14 100%)' }}
    >
      {/* Decorative glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-500/[0.04] rounded-full blur-[120px] pointer-events-none" />

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center relative">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-xl shadow-violet-500/20">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M7 10h2.5c.3 0 .5.2.6.4.4 1 1.2 2.8 2 3.2.3.2.4 0 .4-.3v-2c0-.7-.3-1.3-.3-1.3s-.2-.3-.5-.3c-.2 0-.3-.2-.2-.3.1-.2.4-.4.8-.4h2c.4 0 .7.3.7.7v3c0 .3.2.5.4.3.6-.4 1.5-2 2.1-3.3.1-.3.3-.4.5-.4h2.2c.4 0 .7.4.5.8-.8 1.5-2.1 3.5-2.7 4.1-.3.3-.2.6 0 .9.7.7 2 2.1 2.5 2.8.2.3.1.7-.3.7h-2.5c-.3 0-.5-.1-.7-.3-.5-.5-1.3-1.4-1.8-1.4-.2 0-.4.1-.4.5v.7c0 .3-.2.5-.5.5h-1.5c-2.5 0-4.5-3.5-5.8-6.5-.2-.3 0-.6.3-.6z" fill="white"/>
          </svg>
        </div>
        <h1 className="mt-4 text-2xl font-bold text-zinc-50">VK Messages</h1>
        <p className="mt-1 text-sm text-zinc-500">Автоматическая отправка сообщений ВКонтакте</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl shadow-2xl shadow-violet-500/[0.03] overflow-hidden relative">
        {/* Card Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-xl font-semibold text-zinc-50 text-center">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-zinc-300 text-sm font-medium">Имя</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-11 border-zinc-800 bg-zinc-900/50 focus:border-violet-500 focus:ring-violet-500/20 rounded-xl text-zinc-50 placeholder:text-zinc-600"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-zinc-300 text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="h-11 border-zinc-800 bg-zinc-900/50 focus:border-violet-500 focus:ring-violet-500/20 rounded-xl text-zinc-50 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-zinc-300 text-sm font-medium">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Введите пароль'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11 border-zinc-800 bg-zinc-900/50 focus:border-violet-500 focus:ring-violet-500/20 rounded-xl text-zinc-50 placeholder:text-zinc-600"
            />
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 text-white font-semibold rounded-xl text-base transition-all duration-200"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                {mode === 'login' ? 'Вход...' : 'Регистрация...'}
              </span>
            ) : (
              mode === 'login' ? 'Войти' : 'Зарегистрироваться'
            )}
          </Button>
        </form>

        {/* Switch Mode */}
        <div className="px-6 pb-6 pt-0">
          <div className="border-t border-zinc-800/80 pt-4 text-center">
            <p className="text-sm text-zinc-500">
              {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
              {' '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-violet-400 hover:text-violet-300 font-semibold hover:underline transition-colors"
              >
                {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 flex items-center gap-3 text-xs text-zinc-600">
        <a href="/download" className="text-violet-400 hover:text-violet-300 hover:underline transition-colors">Скачать проект</a>
        <span>·</span>
        <span>VK Messages © {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
