/**
 * VK Scheduler — Node.js compatible version
 * Runs as a separate process/container
 * Checks scheduled tasks every 60 seconds via the main app API
 */

const SCHEDULER_INTERVAL = parseInt(process.env.SCHEDULER_INTERVAL || '60000', 10);
const MAIN_APP_URL = process.env.MAIN_APP_URL || 'http://localhost:3000';
const SCHEDULER_PORT = parseInt(process.env.SCHEDULER_PORT || '3003', 10);

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
    console.error(`[${now}] Ошибка планировщика:`, error.message || error);
  }
}

// Simple HTTP health check server
import http from 'http';

const healthServer = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${SCHEDULER_PORT}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'running', interval: `${SCHEDULER_INTERVAL / 1000}s` }));
  } else if (url.pathname === '/trigger' && req.method === 'POST') {
    tick();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ triggered: true }));
  } else {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ service: 'vk-scheduler' }));
  }
});

healthServer.listen(SCHEDULER_PORT, () => {
  console.log(`VK Scheduler запущен на порту ${SCHEDULER_PORT}`);
  console.log(`Проверка задач каждые ${SCHEDULER_INTERVAL / 1000} сек...`);
  console.log(`Health check: http://localhost:${SCHEDULER_PORT}/health`);
});

// Initial tick
tick();

// Run scheduler at interval
const interval = setInterval(tick, SCHEDULER_INTERVAL);

// Graceful shutdown
function shutdown() {
  clearInterval(interval);
  healthServer.close();
  console.log('Планировщик остановлен');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
