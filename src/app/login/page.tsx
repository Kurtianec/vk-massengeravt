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
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(180deg, #edeef0 0%, #ffffff 100%)' }}
    >
      {/* VK Logo */}
      <div className="mb-8 flex flex-col items-center">
        <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="12" fill="#0077FF"/>
          <path d="M14 20h5c.6 0 1 .4 1.2.8.8 2 2.4 5.6 4 6.4.6.4.8 0 .8-.6v-4c0-1.4-.6-2.6-.6-2.6s-.4-.6-1-.6c-.4 0-.6-.4-.4-.6.2-.4.8-.8 1.6-.8h4c.8 0 1.4.6 1.4 1.4v6c0 .6.4 1 .8.6 1.2-.8 3-4 4.2-6.6.2-.6.6-.8 1-.8h4.4c.8 0 1.4.8 1 1.6-1.6 3-4.2 7-5.4 8.2-.6.6-.4 1.2 0 1.8 1.4 1.4 4 4.2 5 5.6.4.6.2 1.4-.6 1.4h-5c-.6 0-1-.2-1.4-.6-1-1-2.6-2.8-3.6-2.8-.4 0-.8.2-.8 1v1.4c0 .6-.4 1-1 1h-3c-5 0-9-7-11.6-13-.4-.6 0-1.2.6-1.2z" fill="white"/>
        </svg>
        <h1 className="mt-4 text-2xl font-bold text-[#222]">VK Messages</h1>
        <p className="mt-1 text-sm text-[#818c99]">Автоматическая отправка сообщений ВКонтакте</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-[#dce1e6] overflow-hidden">
        {/* Card Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-[#222] text-center">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#222] text-sm font-medium">Имя</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-11 border-[#dce1e6] focus:border-[#0077FF] focus:ring-[#0077FF]/20 rounded-xl text-[#222] placeholder:text-[#818c99]"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#222] text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="h-11 border-[#dce1e6] focus:border-[#0077FF] focus:ring-[#0077FF]/20 rounded-xl text-[#222] placeholder:text-[#818c99]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#222] text-sm font-medium">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Введите пароль'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11 border-[#dce1e6] focus:border-[#0077FF] focus:ring-[#0077FF]/20 rounded-xl text-[#222] placeholder:text-[#818c99]"
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#0077FF] hover:bg-[#0066dd] text-white font-semibold rounded-xl text-base"
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
          <div className="border-t border-[#dce1e6] pt-4 text-center">
            <p className="text-sm text-[#818c99]">
              {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
              {' '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-[#0077FF] hover:text-[#0066dd] font-semibold hover:underline"
              >
                {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-[#818c99]">
        VK Messages © {new Date().getFullYear()}
      </p>
    </div>
  );
}
