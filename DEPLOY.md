# Развёртывание

## Сборка

```bash
NITRO_PRESET=node-server bun run build
```

Получается `.output/server/index.mjs` — самодостаточный Node-сервер.
Запуск: `PORT=3000 node .output/server/index.mjs`

По умолчанию (без `NITRO_PRESET`) собирается Cloudflare Worker — он не
запустится на обычном хостинге.

**Если сборка падает с `UNLOADABLE_DEPENDENCY` и «не удаётся найти путь»** —
это устаревший кеш, а не ошибка в коде:

```bash
rm -rf .output node_modules/.nitro node_modules/.vite
```

## Обязательно: сжатие на веб-сервере

Сервер Nitro отдаёт файлы **без gzip**. Если поставить его голым, страница
будет грузиться втрое дольше. Замерено на профиле мобильного Lighthouse:

| | без сжатия | со сжатием |
|---|---|---|
| Performance | 62 | 84 |
| Первая отрисовка | 5.8 с | 3.2 с |
| CSS по сети | 91 КБ | 13.6 КБ |

Перед приложением обязан стоять nginx со сжатием. Минимальный конфиг:

```nginx
gzip on;
gzip_types text/plain text/css application/javascript application/json image/svg+xml;
gzip_min_length 1024;
gzip_comp_level 6;

location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
}
```

`X-Forwarded-Host` и `X-Forwarded-Proto` не декоративные: из них
`originFromRequest` (`src/lib/site-urls.ts`) собирает адреса для
`sitemap.xml` и `robots.txt`. Без них там окажется `localhost`.

## Переменные окружения

| Переменная | Зачем | Без неё |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | доставка заявок с формы | форма отвечает 503 |
| `TELEGRAM_CHAT_ID` | куда слать заявки | то же |
| `VITE_SITE_URL` | адрес сайта для canonical, og:image, sitemap | берётся `https://itagent.ru` |

`VITE_SITE_URL` вшивается в бандл **на этапе сборки** — задавать её нужно
до `bun run build`, а не при запуске сервера.

## Проверка после деплоя

```bash
curl -I -H "Accept-Encoding: gzip" https://itagent.ru/   # ждём content-encoding: gzip
curl -s https://itagent.ru/sitemap.xml | head -5          # ждём свой домен, не localhost
```

И отправить тестовую заявку через форму — она должна дойти в Telegram.
