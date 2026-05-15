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
      style={{ background: 'linear-gradient(180deg, #0d0d1a 0%, #1a0a2e 50%, #0d0d1a 100%)' }}
    >
      {/* Cyberpunk Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="relative">
          <div className="absolute inset-0 blur-xl bg-[#00f0ff]/30 rounded-full" />
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none" className="relative">
            <rect width="64" height="64" rx="14" fill="#141428" stroke="#00f0ff" strokeWidth="2"/>
            {/* Message/chat icon like Telegram */}
            <path d="M16 20h32c2.2 0 4 1.8 4 4v16c0 2.2-1.8 4-4 4H28l-6 5v-5h-6c-2.2 0-4-1.8-4-4V24c0-2.2 1.8-4 4-4z" fill="none" stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 28h20M22 34h14" stroke="#ff00e5" strokeWidth="2" strokeLinecap="round"/>
            {/* Small send arrow */}
            <path d="M42 30l6 3-6 3" stroke="#00f0ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 className="mt-5 text-3xl font-bold text-[#e0e0ff]" style={{ textShadow: '0 0 20px #00f0ff66' }}>
          Messages pull
        </h1>
        <p className="mt-2 text-sm text-[#7a7aaa]">Автоматическая отправка сообщений по расписанию</p>
      </div>

      {/* Auth Card */}
      <div className="w-full max-w-sm bg-[#141428] rounded-2xl shadow-lg border border-[#2a2a4a] overflow-hidden neon-border-cyan">
        {/* Card Header */}
        <div className="px-6 pt-6 pb-2">
          <h2 className="text-xl font-bold text-[#e0e0ff] text-center">
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[#e0e0ff] text-sm font-medium">Имя</Label>
              <Input
                id="name"
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-11 bg-[#1a1a35] border-[#2a2a4a] focus:border-[#00f0ff] focus:ring-[#00f0ff]/20 rounded-xl text-[#e0e0ff] placeholder:text-[#7a7aaa]"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#e0e0ff] text-sm font-medium">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="h-11 bg-[#1a1a35] border-[#2a2a4a] focus:border-[#00f0ff] focus:ring-[#00f0ff]/20 rounded-xl text-[#e0e0ff] placeholder:text-[#7a7aaa]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#e0e0ff] text-sm font-medium">Пароль</Label>
            <Input
              id="password"
              type="password"
              placeholder={mode === 'register' ? 'Минимум 6 символов' : 'Введите пароль'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11 bg-[#1a1a35] border-[#2a2a4a] focus:border-[#00f0ff] focus:ring-[#00f0ff]/20 rounded-xl text-[#e0e0ff] placeholder:text-[#7a7aaa]"
            />
          </div>

          {error && (
            <div className="text-sm text-[#ff2d55] bg-[#ff2d55]/10 border border-[#ff2d55]/30 rounded-xl px-4 py-2.5">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-[#00f0ff] hover:bg-[#00c8d6] text-[#0d0d1a] font-bold rounded-xl text-base neon-glow-cyan"
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
          <div className="border-t border-[#2a2a4a] pt-4 text-center">
            <p className="text-sm text-[#7a7aaa]">
              {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
              {' '}
              <button
                type="button"
                onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
                className="text-[#00f0ff] hover:text-[#00c8d6] font-semibold hover:underline"
              >
                {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-[#7a7aaa]">
        Messages pull © {new Date().getFullYear()}
      </p>
    </div>
  );
}
