const SCHEDULER_PORT = 3003;
const MAIN_APP_URL = 'http://localhost:3000';

async function tick() {
  try {
    const res = await fetch(`${MAIN_APP_URL}/api/scheduler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    const now = new Date().toLocaleTimeString('ru-RU');
    if (data.sent > 0 || data.failed > 0) {
      console.log(`[${now}] Отправлено: ${data.sent}, Ошибок: ${data.failed}`);
    }
  } catch (error) {
    const now = new Date().toLocaleTimeString('ru-RU');
    console.error(`[${now}] Ошибка планировщика:`, error);
  }
}

// Run scheduler every 60 seconds
console.log(`VK Scheduler запущен на порту ${SCHEDULER_PORT}`);
console.log('Проверка задач каждую минуту...');

// Initial tick
tick();

const interval = setInterval(tick, 60000);

// Simple health check server
const server = Bun.serve({
  port: SCHEDULER_PORT,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      return Response.json({ status: 'running', interval: '60s' });
    }
    if (url.pathname === '/trigger' && req.method === 'POST') {
      tick();
      return Response.json({ triggered: true });
    }
    return Response.json({ service: 'vk-scheduler' });
  },
});

console.log(`Health check: http://localhost:${SCHEDULER_PORT}/health`);

// Graceful shutdown
process.on('SIGINT', () => {
  clearInterval(interval);
  server.stop();
  console.log('Планировщик остановлен');
  process.exit(0);
});
