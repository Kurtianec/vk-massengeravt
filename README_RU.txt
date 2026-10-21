VORTEX AI CLOUD V3 (NEXT.JS) — установка с телефона

ВАЖНО: архив — полный проект вместо старого сайта. Если старый проект нужен, сначала сделайте копию! Не складывайте новые файлы поверх старого приложения (возможны конфликты).

1. В GitHub создайте новую ветку или очистите содержимое своего репозитория, если ничего сохранять не нужно, и загрузите файлы этого архива С СОХРАНЕНИЕМ ПАПОК. В корне нужны: package.json, app/, lib/.
2. Vercel -> Existing Project -> Settings -> General -> Framework Preset: Next.js; Root Directory: ./; Production Branch: main. Проверьте, что деплой успешен.
3. Зарегистрируйтесь на https://console.upstash.com/ -> Redis -> Create Database -> FREE. Скопируйте REST URL и REST TOKEN.
4. В Vercel -> Project -> Settings -> Environment Variables добавьте для Production:
CRON_SECRET = случайная длинная строка (не отправляйте никому)
TELEGRAM_BOT_TOKEN = токен BotFather
TELEGRAM_CHAT_ID = числовой ID чата, предварительно нажмите Start в Telegram-боте
UPSTASH_REDIS_REST_URL = REST URL Upstash
UPSTASH_REDIS_REST_TOKEN = REST TOKEN Upstash
SIGNAL_THRESHOLD = 65 (можно поставить 50, 55, 70 и т. д.)
После изменений нажмите Deployments -> Redeploy (production).
5. cron-job.org -> Cronjobs -> Create cronjob. Сделайте ШЕСТЬ заданий, каждое повторять every 15 minutes; URL каждого:
https://ВАШ-ДОМЕН.vercel.app/api/scan?batch=0
https://ВАШ-ДОМЕН.vercel.app/api/scan?batch=1
https://ВАШ-ДОМЕН.vercel.app/api/scan?batch=2
https://ВАШ-ДОМЕН.vercel.app/api/scan?batch=3
https://ВАШ-ДОМЕН.vercel.app/api/scan?batch=4
https://ВАШ-ДОМЕН.vercel.app/api/scan?batch=5
Для всех: Request Method GET; Custom header X-Cron-Secret со значением CRON_SECRET.
Для уменьшения пиков нагрузки задания лучше сместить на 0, 2, 4, 6, 8, 10 минут внутри каждого 15-минутного окна.
6. Создайте СЕДЬМОЕ задание /api/report, запускаемое каждый час, с тем же заголовком.
7. После первого запуска откройте Execution history в cron-job.org: успешный вызов возвращает JSON {"ok":true,...}. При HTTP 502 читайте поле error (может быть 403 Bybit).
8. Регулировка порога: измените SIGNAL_THRESHOLD в Vercel -> Environment Variables и Redeploy. Порог в этой версии НЕ изменяется через Telegram.

Особенности: по 25 монет в 6 партиях (в сумме 150), топ по обороту за 24ч. Только закрытые 15-минутные свечи. OI берётся из Bybit history напрямую. TP/SL отслеживаются при следующих проверках, горизонт 12ч, при попадании TP и SL в одну свечу результат AMBIGUOUS. Отчёт показывает статистику за 30 дней (если она накоплена). Достоверность торговой стратегии не подтверждена бэктестом. Ни один сигнал не равен вероятности прибыли.

Возможные ограничения: API Bybit может возвращать 403 с IP Vercel. Тогда эта платформа не подходит для источника Bybit без разрешённого серверного региона. Бесплатные тарифы Vercel/Upstash ограничены по использованию. Не публикуйте токены ни в GitHub, ни в Telegram.
