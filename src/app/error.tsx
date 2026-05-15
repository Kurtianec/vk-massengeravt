'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(180deg, #09090b 0%, #0f0f14 100%)' }}
    >
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-xl shadow-violet-500/20 mb-6">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M7 10h2.5c.3 0 .5.2.6.4.4 1 1.2 2.8 2 3.2.3.2.4 0 .4-.3v-2c0-.7-.3-1.3-.3-1.3s-.2-.3-.5-.3c-.2 0-.3-.2-.2-.3.1-.2.4-.4.8-.4h2c.4 0 .7.3.7.7v3c0 .3.2.5.4.3.6-.4 1.5-2 2.1-3.3.1-.3.3-.4.5-.4h2.2c.4 0 .7.4.5.8-.8 1.5-2.1 3.5-2.7 4.1-.3.3-.2.6 0 .9.7.7 2 2.1 2.5 2.8.2.3.1.7-.3.7h-2.5c-.3 0-.5-.1-.7-.3-.5-.5-1.3-1.4-1.8-1.4-.2 0-.4.1-.4.5v.7c0 .3-.2.5-.5.5h-1.5c-2.5 0-4.5-3.5-5.8-6.5-.2-.3 0-.6.3-.6z" fill="white"/>
        </svg>
      </div>

      <h1 className="text-xl font-bold text-zinc-100 mb-2">Что-то пошло не так</h1>
      <p className="text-sm text-zinc-500 mb-6 text-center max-w-md">
        Произошла ошибка при загрузке приложения. Проверьте настройки базы данных и переменные окружения на Vercel.
      </p>

      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 h-10 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all duration-200 text-sm"
        >
          Попробовать снова
        </button>
        <a
          href="/login"
          className="px-5 h-10 border border-zinc-700 hover:border-zinc-500 text-zinc-300 font-medium rounded-xl transition-all duration-200 text-sm flex items-center"
        >
          Войти
        </a>
      </div>

      {error.message && (
        <div className="mt-6 p-4 bg-zinc-900/40 rounded-xl border border-zinc-800/60 max-w-md w-full">
          <p className="text-xs text-red-400 break-all">{error.message}</p>
        </div>
      )}
    </div>
  );
}
