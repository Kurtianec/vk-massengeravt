# Развертывание VK Messages на хостинге

Полное руководство по деплою проекта на VPS/VDS хостинг.

---

## Содержание

1. [Требования к серверу](#1-требования-к-серверу)
2. [Вариант A: Docker (рекомендуется)](#2-вариант-a-docker-рекомендуется)
3. [Вариант B: Ручная установка (без Docker)](#3-вариант-b-ручная-установка-без-docker)
4. [Настройка VK OAuth](#4-настройка-vk-oauth)
5. [Настройка HTTPS](#5-настройка-https)
6. [Перенос базы данных](#6-перенос-базы-данных)
7. [Обновление приложения](#7-обновление-приложения)
8. [Решение проблем](#8-решение-проблем)

---

## 1. Требования к серверу

**Минимальные:**
- VPS/VDS с Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- 1 CPU, 1 GB RAM, 10 GB SSD
- Публичный IP-адрес

**Рекомендуемые хостинги (Россия):**
- [Timeweb Cloud](https://timeweb.cloud/) — от 199 руб/мес
- [Reg.ru VPS](https://www.reg.ru/vps/) — от 199 руб/мес
- [Beget VPS](https://beget.com/ru/vps) — от 269 руб/мес
- [Aeza](https://aeza.net/) — от 179 руб/мес
- [Selectel](https://selectel.ru/) — от 369 руб/мес

---

## 2. Вариант A: Docker (рекомендуется)

### Шаг 1: Подготовка сервера

```bash
# Подключитесь к серверу по SSH
ssh root@YOUR_SERVER_IP

# Обновите систему
apt update && apt upgrade -y

# Установите Docker и Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
apt install -y docker-compose-plugin

# Проверьте установку
docker --version
docker compose version
```

### Шаг 2: Загрузка проекта на сервер

**Способ 1: Через Git (если проект на GitHub)**
```bash
# Установите git
apt install -y git

# Клонируйте репозиторий
cd /opt
git clone https://github.com/YOUR_USERNAME/vk-messages.git
cd vk-messages
```

**Способ 2: Через SCP (загрузка архива с компьютера)**
```bash
# На вашем компьютере — запакуйте проект
cd /home/z/my-project
tar -czf vk-messages.tar.gz \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=db/*.db \
  --exclude=download \
  --exclude=*.log \
  --exclude=server.pid \
  .

# Загрузите на сервер
scp vk-messages.tar.gz root@YOUR_SERVER_IP:/opt/

# На сервере — распакуйте
cd /opt
mkdir -p vk-messages
tar -xzf vk-messages.tar.gz -C vk-messages
cd vk-messages
```

**Способ 3: Через rsync (самый удобный)**
```bash
# На вашем компьютере
rsync -avz --progress \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=download \
  --exclude='*.log' \
  --exclude=server.pid \
  /home/z/my-project/ root@YOUR_SERVER_IP:/opt/vk-messages/
```

### Шаг 3: Настройка окружения

```bash
cd /opt/vk-messages

# Создайте .env файл из шаблона
cp .env.production .env

# Отредактируйте .env — ОБЯЗАТЕЛЬНО смените SESSION_SECRET!
nano .env
```

**Содержимое .env:**
```env
DATABASE_URL=file:/app/data/vk-messages.db
SESSION_SECRET=<ВАШ_СЛУЧАЙНЫЙ_КЛЮЧ>
NODE_ENV=production
```

Генерация случайного ключа:
```bash
openssl rand -hex 32
# Вставьте результат в SESSION_SECRET
```

### Шаг 4: Сборка и запуск

```bash
cd /opt/vk-messages

# Соберите Docker-образ (первый раз ~3-5 минут)
docker compose build

# Запустите все сервисы
docker compose up -d

# Проверьте статус
docker compose ps

# Посмотрите логи
docker compose logs -f app
```

Приложение будет доступно по адресу: `http://YOUR_SERVER_IP`

### Шаг 5: Перенос существующей базы данных (если есть)

Если у вас уже есть база данных с пользователями и задачами:

```bash
# Скопируйте файл БД с вашего компьютера на сервер
scp /home/z/my-project/db/custom.db root@YOUR_SERVER_IP:/tmp/custom.db

# Скопируйте БД внутрь Docker-контейнера
docker compose cp /tmp/custom.db app:/app/data/vk-messages.db

# Перезапустите приложение
docker compose restart app
```

### Полезные команды Docker

```bash
# Остановить все сервисы
docker compose down

# Перезапустить
docker compose restart

# Пересобрать после изменения кода
docker compose build --no-cache
docker compose up -d

# Логи конкретного сервиса
docker compose logs -f app        # Основное приложение
docker compose logs -f scheduler  # Планировщик
docker compose logs -f nginx      # Nginx

# Зайти в контейнер
docker compose exec app sh
```

---

## 3. Вариант B: Ручная установка (без Docker)

### Шаг 1: Установка Node.js

```bash
# Установите Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Проверьте
node --version   # v20.x.x
npm --version    # 10.x.x
```

### Шаг 2: Установка pm2 (менеджер процессов)

```bash
npm install -g pm2
```

### Шаг 3: Загрузка проекта

См. Шаг 2 из Docker-варианта (загрузка файлов на сервер).

### Шаг 4: Установка зависимостей и сборка

```bash
cd /opt/vk-messages

# Установите зависимости
npm install

# Сгенерируйте Prisma клиент
npx prisma generate

# Соберите проект
npm run build
```

### Шаг 5: Настройка окружения

```bash
# Создайте .env
cat > .env << 'EOF'
DATABASE_URL=file:/opt/vk-messages/data/vk-messages.db
SESSION_SECRET=<ВАШ_СЛУЧАЙНЫЙ_КЛЮЧ>
NODE_ENV=production
EOF

# Создайте директорию для данных
mkdir -p data

# Генерация ключа
openssl rand -hex 32
```

### Шаг 6: Запуск через pm2

```bash
cd /opt/vk-messages

# Запуск основного приложения
pm2 start .next/standalone/server.js \
  --name vk-messages \
  --node-args="--max-old-space-size=512" \
  -- --port 3000

# Запуск планировщика
pm2 start mini-services/scheduler/scheduler-node.mjs \
  --name vk-scheduler

# Сохраните конфигурацию pm2 (автозапуск при перезагрузке)
pm2 save
pm2 startup

# Проверьте статус
pm2 status
pm2 logs
```

### Шаг 7: Настройка Nginx

```bash
# Установите Nginx
apt install -y nginx

# Создайте конфигурацию
cat > /etc/nginx/sites-available/vk-messages << 'EOF'
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
EOF

# Активируйте сайт
ln -s /etc/nginx/sites-available/vk-messages /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Проверьте конфигурацию
nginx -t

# Перезапустите Nginx
systemctl restart nginx
```

---

## 4. Настройка VK OAuth

Чтобы работала авторизация через ВК (получение токена в один клик):

1. Перейдите на [VK для разработчиков](https://dev.vk.com/)
2. Создайте приложение (тип: **Standalone-приложение**)
3. В настройках приложения укажите:
   - **Адрес сайта**: `https://your-domain.com`
   - **Базовый домен**: `your-domain.com`
   - **Redirect URI**: `https://your-domain.com/vk-callback`
4. Скопируйте **ID приложения**
5. В админке VK Messages (раздел «Настройки») вставьте ID приложения

Теперь пользователи смогут получать VK-токен одним нажатием кнопки.

---

## 5. Настройка HTTPS

### Вариант A: Certbot (бесплатный Let's Encrypt)

```bash
# Установите Certbot
apt install -y certbot python3-certbot-nginx

# Получите сертификат
certbot --nginx -d your-domain.com

# Автоматическое обновление уже настроено в certbot timer
# Проверьте:
systemctl status certbot.timer
```

### Вариант B: Cloudflare (проще)

1. Зарегистрируйтесь на [Cloudflare](https://www.cloudflare.com/)
2. Добавьте ваш домен
3. Измените NS-записи домена на Cloudflare
4. Включите режим **Proxied** (оранжевое облако)
5. SSL/TLS → установите режим **Full**
6. Cloudflare автоматически добавит HTTPS

---

## 6. Перенос базы данных

### Экспорт с текущего сервера

```bash
# SQLite — просто скопируйте файл
cp /home/z/my-project/db/custom.db ./vk-messages-backup.db

# Или через rsync
rsync -avz /home/z/my-project/db/custom.db root@NEW_SERVER:/tmp/
```

### Импорт на новый сервер

**Для Docker:**
```bash
docker compose cp /tmp/custom.db app:/app/data/vk-messages.db
docker compose restart app
```

**Для pm2:**
```bash
cp /tmp/custom.db /opt/vk-messages/data/vk-messages.db
pm2 restart vk-messages
```

---

## 7. Обновление приложения

### Docker

```bash
cd /opt/vk-messages

# Загрузите новую версию кода (git pull / rsync)
git pull  # или rsync

# Пересоберите и перезапустите
docker compose build
docker compose up -d

# Данные в volume сохранятся!
```

### pm2

```bash
cd /opt/vk-messages

# Загрузите новую версию кода
git pull  # или rsync

# Установите новые зависимости (если есть)
npm install

# Сгенерируйте Prisma клиент
npx prisma generate

# Примените миграции (если есть изменения схемы)
npx prisma db push

# Пересоберите
npm run build

# Перезапустите
pm2 restart vk-messages
pm2 restart vk-scheduler
```

---

## 8. Решение проблем

### Приложение не загружается

```bash
# Проверьте, запущен ли контейнер/процесс
docker compose ps          # Docker
pm2 status                 # pm2

# Посмотрите логи
docker compose logs -f app # Docker
pm2 logs vk-messages       # pm2
```

### Ошибка «Cannot connect to server»

1. Проверьте, что порт 3000 слушается:
   ```bash
   curl http://localhost:3000/api/auth/session
   ```

2. Проверьте Nginx:
   ```bash
   nginx -t
   systemctl status nginx
   ```

3. Проверьте防火墙:
   ```bash
   ufw status
   ufw allow 80/tcp
   ufw allow 443/tcp
   ```

### Планировщик не отправляет сообщения

```bash
# Проверьте, что планировщик запущен
docker compose logs -f scheduler    # Docker
pm2 logs vk-scheduler               # pm2

# Проверьте здоровье планировщика
curl http://localhost:3003/health

# Ручной запуск проверки задач
curl -X POST http://localhost:3003/trigger
```

### Проблемы с VK OAuth

1. Убедитесь, что в VK-приложении правильно указан Redirect URI: `https://your-domain.com/vk-callback`
2. Проверьте, что HTTPS работает корректно (VK OAuth требует HTTPS для production)
3. Убедитесь, что ID приложения указан в настройках админки

### Сброс пароля администратора

Если забыли пароль, подключитесь к серверу и выполните:

```bash
# Docker
docker compose exec app sh
# Внутри контейнера:
node -e "
const crypto = require('crypto');
const salt = crypto.randomBytes(16).toString('hex');
const key = crypto.scryptSync('newpassword', salt, 64).toString('hex');
console.log(salt + ':' + key);
"
# Затем обновите БД через SQLite

# pm2 — просто обновите через SQLite
apt install -y sqlite3
sqlite3 /opt/vk-messages/data/vk-messages.db
UPDATE User SET passwordHash = 'НОВЫЙ_ХЕШ' WHERE email = 'admin@example.com';
```

---

## Архитектура деплоя

```
Интернет → [Nginx :80/:443] → [Next.js App :3000] → [SQLite /app/data/vk-messages.db]
                                    ↑
                          [Scheduler :3003] (каждые 60 сек POST /api/scheduler)
```

## Файлы для деплоя

| Файл | Назначение |
|------|-----------|
| `Dockerfile` | Сборка Docker-образа приложения |
| `docker-compose.yml` | Оркестрация: app + scheduler + nginx |
| `.dockerignore` | Исключения при сборке Docker |
| `nginx.conf` | Конфигурация reverse proxy |
| `.env.production` | Шаблон переменных окружения |
| `mini-services/scheduler/scheduler-node.mjs` | Планировщик (Node.js версия для Docker) |
