# 🚀 Бесплатный деплой VK Messages на Vercel + Supabase

Полная пошаговая инструкция. **Все сервисы бесплатные!**

---

## Что вам понадобится

| Сервис | Назначение | Бесплатный тариф |
|--------|-----------|-----------------|
| **GitHub** | Хранение кода | Безлимитный |
| **Vercel** | Хостинг Next.js | 100 ГБ трафика/мес |
| **Supabase** | PostgreSQL база данных | 500 МБ, 2 проекта |

---

## Шаг 1: Создайте аккаунт на GitHub

Если у вас ещё нет GitHub:
1. Перейдите на https://github.com/signup
2. Зарегистрируйтесь (бесплатно)

---

## Шаг 2: Загрузите проект на GitHub

### Способ A: Через GitHub Desktop (проще для новичков)

1. Скачайте [GitHub Desktop](https://desktop.github.com/)
2. Откройте программу → **Sign in** с вашим аккаунтом
3. Нажмите **Create new repository**
4. Имя: `vk-messages`
5. **Local path**: выберите папку проекта
6. Нажмите **Create repository**
7. Нажмите **Publish repository**

### Способ B: Через командную строку

```bash
# Установите git (если нет)
# Windows: https://git-scm.com/download/win

# Перейдите в папку проекта
cd /путь/к/vk-messages

# Инициализируйте git
git init
git add .
git commit -m "Initial commit"

# Создайте репозиторий на github.com, затем:
git remote add origin https://github.com/ВАШ_ЛОГИН/vk-messages.git
git branch -M main
git push -u origin main
```

### ⚠ Важно: Создайте .gitignore

Убедитесь, что файл `.gitignore` содержит:

```
node_modules
.next
.env
.env.local
*.db
*.db-journal
*.log
server.pid
download/
```

---

## Шаг 3: Создайте базу данных Supabase

1. Перейдите на https://supabase.com/
2. Нажмите **Start your project** → авторизуйтесь через GitHub
3. Нажмите **New Project**
4. Заполните:
   - **Name**: `vk-messages`
   - **Database Password**: придумайте надёжный пароль и **сохраните его!**
   - **Region**: выберите ближайший (Frankfurt для Европы)
5. Нажмите **Create new project** (создание займёт ~2 минуты)

### Получите строку подключения

1. В Supabase перейдите: **Settings** → **Database**
2. Прокрутите до **Connection string** → выберите **URI**
3. Скопируйте строку вида:
   ```
   postgresql://postgres.xxxx:xxxx@aws-0-region.pooler.supabase.com:6543/postgres
   ```
4. **Важно**: замените `[YOUR-PASSWORD]` на ваш пароль от БД
5. Добавьте `?pgbouncer=true` в конец строки (для serverless):
   ```
   postgresql://postgres.xxxx:ВAШ_ПАРОЛЬ@aws-0-region.pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

---

## Шаг 4: Задеплойте на Vercel

1. Перейдите на https://vercel.com/
2. Нажмите **Sign Up** → авторизуйтесь через GitHub
3. Нажмите **Add New...** → **Project**
4. Выберите ваш репозиторий `vk-messages`
5. **Настройки деплоя** (ВАЖНО!):

   | Поле | Значение |
   |------|----------|
   | **Framework Preset** | Next.js |
   | **Build Command** | `prisma generate && next build` |
   | **Output Directory** | `.next` |
   | **Install Command** | `npm install` |

6. **Environment Variables** — добавьте переменные:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | Строка подключения из Supabase (с ?pgbouncer=true) |
   | `SESSION_SECRET` | Случайная строка (см. ниже) |

   Генерация SESSION_SECRET:
   ```bash
   # На Mac/Linux:
   openssl rand -hex 32
   
   # Или используйте любой генератор паролей — минимум 32 символа
   ```

7. Нажмите **Deploy** 🎉

Деплой займёт 2-5 минут. После завершения Vercel даст вам URL вида:
`https://vk-messages-xxxx.vercel.app`

---

## Шаг 5: Инициализируйте базу данных

После первого деплоя нужно создать таблицы в Supabase:

### Способ A: Через Supabase Dashboard (рекомендуется)

1. В Supabase перейдите: **SQL Editor**
2. Скопируйте содержимое файла `prisma/migrations/20240101000000_init_postgresql/migration.sql` из вашего проекта
3. Вставьте в SQL Editor и нажмите **Run**
4. Таблицы созданы!

### Способ B: Через Prisma (если установлен локально)

```bash
# Установите переменную окружения
export DATABASE_URL="postgresql://postgres.xxxx:ПАРОЛЬ@..."

# Примените миграцию
npx prisma migrate deploy
```

---

## Шаг 6: Создайте администратора

### Через Supabase Dashboard

1. В Supabase перейдите: **Table Editor** → **User**
2. Нажмите **Insert row**
3. Заполните:
   - `email`: ваш email
   - `passwordHash`: хеш пароля (см. ниже)
   - `name`: ваше имя
   - `role`: `admin`

**Получение хеша пароля:**

Откройте консоль браузера (F12) на вашем сайте и выполните:
```javascript
// Этот скрипт сгенерирует хеш для пароля "admin123"
async function genHash() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode('admin123'), 'PBKDF2', false, ['deriveBits']);
  // Используйте API регистрации вместо ручного хеширования
}
```

**Проще:** Используйте страницу регистрации на сайте!
1. Откройте `https://ваш-сайт.vercel.app/login`
2. Зарегистрируйтесь с email и паролем
3. Первый зарегистрированный пользователь автоматически становится администратором

---

## Шаг 7: Настройте VK OAuth (опционально)

Чтобы пользователи могли получать VK-токен одним кликом:

1. Перейдите на [VK для разработчиков](https://dev.vk.com/)
2. Создайте приложение (тип: **Standalone-приложение**)
3. В настройках приложения укажите:
   - **Адрес сайта**: `https://ваш-сайт.vercel.app`
   - **Базовый домен**: `ваш-сайт.vercel.app`
   - **Redirect URI**: `https://ваш-сайт.vercel.app/vk-callback`
4. Скопируйте **ID приложения**
5. Войдите в VK Messages как администратор → **Настройки** → вставьте ID приложения

---

## 🎉 Готово!

Ваш сайт доступен по адресу: `https://ваш-сайт.vercel.app`

### Что работает из коробки:
- ✅ Регистрация и авторизация пользователей
- ✅ Подключение VK через токен
- ✅ Выбор чатов и бесед
- ✅ Создание отложенных сообщений (разовые, ежедневные, еженедельные, ежемесячные, интервал)
- ✅ Автоматическая отправка по расписанию (через Vercel Cron — каждую минуту)
- ✅ Удаление предыдущего сообщения перед отправкой нового
- ✅ Логи отправки
- ✅ Админ-панель (управление пользователями, настройками)

---

## Свой домен (опционально)

Если у вас есть свой домен:

1. В Vercel: **Settings** → **Domains** → добавьте ваш домен
2. У вашего регистратора домена добавьте DNS-запись:
   - **CNAME**: `www` → `cname.vercel-dns.com`
   - **A**: `@` → `76.76.21.21`
3. Подождите распространения DNS (до 24 часов)
4. HTTPS настраивается автоматически (бесплатный SSL от Vercel)

---

## Лимиты бесплатных тарифов

### Vercel (Hobby)
- 100 ГБ трафика в месяц
- Serverless функции: 10 сек таймаут
- Cron-задачи: 1 раз в минуту (подходит для нашего планировщика)
- **Для небольшого проекта более чем достаточно!**

### Supabase (Free)
- 500 МБ база данных
- 1 ГБ файлов (не используем)
- 50 000 MAU (активных пользователей в месяц)
- **Для персонального использования — с головой!**

---

## Обновление приложения

1. Внесите изменения в код
2. Загрузите на GitHub (`git push`)
3. Vercel **автоматически** пересоберёт и задеплоит проект!
4. Миграции БД (если изменили схему):
   ```bash
   npx prisma migrate dev --name имя_миграции  # локально
   git push  # Vercel задеплоит, но миграцию нужно применить вручную
   ```

---

## Решение проблем

### Ошибка 500 при загрузке сайта
- Проверьте, что `DATABASE_URL` правильно указана в Vercel
- Проверьте, что таблицы созданы в Supabase (SQL Editor → migration.sql)
- Посмотрите логи: Vercel Dashboard → ваш проект → **Deployments** → **Logs**

### Планировщик не отправляет сообщения
- Проверьте Vercel Dashboard → **Cron Jobs** — должны быть видны вызовы `/api/scheduler`
- Vercel cron может иметь задержку до 1 минуты
- Проверьте, что VK-токен активен

### Ошибка «Prisma Client could not be generated»
- Убедитесь, что `postinstall` скрипт в package.json: `"prisma generate"`
- В Vercel: Settings → Build Command должно быть: `prisma generate && next build`

### Supabase «too many connections»
- Используйте connection pooling: добавьте `?pgbouncer=true` к `DATABASE_URL`
- Supabase free tier имеет лимит ~60 одновременных подключений

---

## Архитектура на бесплатном хостинге

```
Пользователь
     ↓
[Vercel CDN/Edge] → [Next.js Serverless Functions]
                           ↓
                    [Supabase PostgreSQL]
                           ↑
              [Vercel Cron — каждую минуту]
                    POST /api/scheduler
```

---

## Файлы, изменённые для Vercel

| Файл | Что изменилось |
|------|---------------|
| `prisma/schema.prisma` | `sqlite` → `postgresql` |
| `next.config.ts` | Убран `output: "standalone"` (Vercel сам управляет сборкой) |
| `package.json` | Добавлен `postinstall: "prisma generate"`, `build` теперь включает `prisma generate` |
| `vercel.json` | Cron-задача: вызов `/api/scheduler` каждую минуту |
| `prisma/seed.ts` | Скрипт инициализации БД (создание админа) |
| `prisma/migrations/` | SQL-миграция для PostgreSQL |
