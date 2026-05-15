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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[#E7E8EC]">
      {/* Telegram-style Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 blur-2xl bg-[#2AABEE]/20 rounded-full" />
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="relative">
            <circle cx="40" cy="40" r="40" fill="#2AABEE"/>
            {/* Paper plane / send icon like Telegram */}
            <path d="M55 25L45 55C44.7 55.8 43.6 56.1 43 55.5L35 48L30 50C29.5 50.2 29 49.8 29.1 49.3L32 38L52 24C52.5 23.6 53.1 24.1 52.9 24.7L46 42L55 25Z" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round"/>
            <path d="M32 38L44 28C44.3 27.7 44.7 28.1 44.4 28.4L35 48" fill="white" stroke="white" strokeWidth="0.5" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="mt-5 text-2xl font-bold text-black">
          Messages pull
        </h1>
        <p className="mt-1.5 text-sm text-[#707579]">Автоматическая отправка сообщений по расписанию</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg overflow-hidden border border-[#E0E0E0]">
        {/* Card Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-black text-center">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-black text-sm font-medium">Имя</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-11 bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] focus:ring-[#2AABEE]/20 rounded-xl text-black placeholder:text-[#9E9E9E]"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-black text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="h-11 bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] focus:ring-[#2AABEE]/20 rounded-xl text-black placeholder:text-[#9E9E9E]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-black text-sm font-medium">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Введите пароль'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11 bg-[#F0F2F5] border-[#E0E0E0] focus:border-[#2AABEE] focus:ring-[#2AABEE]/20 rounded-xl text-black placeholder:text-[#9E9E9E]"
            />
          </div>

          {error && (
            <div className="text-sm text-[#E53935] bg-[#E53935]/8 border border-[#E53935]/20 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#2AABEE] hover:bg-[#229ED9] text-white font-bold rounded-xl text-base"
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
          <div className="border-t border-[#E0E0E0] pt-4 text-center">
            <p className="text-sm text-[#707579]">
              {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
              {' '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-[#2AABEE] hover:text-[#229ED9] font-semibold hover:underline"
              >
                {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-[#9E9E9E]">
        Messages pull © {new Date().getFullYear()}
      </p>
    </div>
  );
}
