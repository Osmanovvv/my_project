# Production smoke-test

Скрипт проверяет только опубликованный HTTPS и не вызывает Telegram Bot API:

```bash
node deploy/production-smoke.mjs https://itagent.ru
```

Он подтверждает:

- `/miniapp` отвечает `200` по HTTPS;
- обычный браузер без Telegram session получает `401` от Mini App API;
- `/api/telegram/health` отвечает `200`, окружение — `production`, секреты не
  выдаются;
- webhook отвечает `405` на GET и `403` на POST без secret.

После первого реального тестового сообщения повторите health-проверку с контролем
активности webhook:

```bash
node deploy/production-smoke.mjs https://itagent.ru --require-webhook-activity
```

## Ручной сценарий 10.9

Используйте одного заранее разрешённого контрольного Telegram user ID:

1. Откройте общего бота и отправьте `/start`.
2. Откройте Mini App из кнопки меню; убедитесь, что она загружается по HTTPS,
   показывает профиль и не даёт доступа к чужим обращениям.
3. В боте создайте заявку через `/request` и подтвердите согласие.
4. Проверьте, что заявка появилась в админке и в операторском private-чате.
5. Оператор отправляет ответ через `/admin → диалог → Ответить → предпросмотр →
   Подтвердить`; ответ должен прийти в чат контрольного клиента.
6. Повторите открытие Mini App и убедитесь, что история и статус принадлежат
   этому Telegram-профилю.

## Проверка логов 10.10

```bash
systemctl is-active --quiet itagent
journalctl -u itagent -n 100 --no-pager
curl -fsS https://itagent.ru/api/telegram/health
```

В логах должны быть только статусы доставки, окружение, ID технических записей
и коды ошибок. Токен, webhook secret и содержимое клиентской переписки там быть
не должны.
