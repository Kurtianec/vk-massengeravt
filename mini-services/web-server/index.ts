import { spawn, ChildProcess } from 'child_process';

let nextServer: ChildProcess | null = null;
let isShuttingDown = false;

function startNextServer() {
  if (isShuttingDown) return;
  
  console.log('[web-server] Starting Next.js...');
  
  nextServer = spawn('node', [
    '/home/z/my-project/node_modules/.bin/next', 
    'dev', 
    '-p', 
    '3000'
  ], {
    cwd: '/home/z/my-project',
    env: { ...process.env, PORT: '3000', NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  nextServer.stdout?.on('data', (data: Buffer) => {
    process.stdout.write(data);
  });

  nextServer.stderr?.on('data', (data: Buffer) => {
    process.stderr.write(data);
  });

  nextServer.on('exit', (code) => {
    console.log(`[web-server] Next.js exited (${code}), restarting in 5s...`);
    nextServer = null;
    if (!isShuttingDown) {
      setTimeout(startNextServer, 5000);
    }
  });

  nextServer.on('error', (err) => {
    console.error(`[web-server] Error: ${err.message}`);
    nextServer = null;
    if (!isShuttingDown) {
      setTimeout(startNextServer, 5000);
    }
  });
}

startNextServer();

// Health check on port 3001
const server = Bun.serve({
  port: 3001,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/health') {
      return Response.json({
        status: 'running',
        nextServer: nextServer ? 'running' : 'restarting',
        nextPid: nextServer?.pid || null,
      });
    }
    if (url.pathname === '/restart' && req.method === 'POST') {
      if (nextServer) {
        nextServer.kill('SIGTERM');
        return Response.json({ message: 'Restarting Next.js...' });
      }
      startNextServer();
      return Response.json({ message: 'Starting Next.js...' });
    }
    return Response.json({ service: 'web-server-manager' });
  },
});

console.log('[web-server] Manager running on port 3001');

process.on('SIGINT', () => {
  isShuttingDown = true;
  if (nextServer) nextServer.kill('SIGTERM');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  isShuttingDown = true;
  if (nextServer) nextServer.kill('SIGTERM');
  server.stop();
  process.exit(0);
});
