#!/bin/bash
# Установка сайта на чистый сервер Ubuntu 24.04. Запускать от root:
#
#   ssh root@СЕРВЕР mkdir -p /srv/itagent             ← с ноутбука; без этого scp
#   scp -r deploy root@СЕРВЕР:/srv/itagent/              положит файлы не туда
#   ssh -t root@СЕРВЕР bash /srv/itagent/deploy/install.sh   ← -t: скрипт спросит пароль
#
# Что делает: nginx, Node 24, пользователь itagent, каталоги, файл
# с секретами, юниты systemd (сайт + ночная копия), срок журналов 30 дней,
# файрвол, сертификат Let's Encrypt (если домен уже смотрит на сервер).
#
# Повторный запуск безопасен: всё, что уже сделано, пропускается. Секреты
# спрашиваются один раз и живут в /etc/itagent/env — не в юните, который
# читается любым пользователем системы.
#
# Сам сайт (каталог .output) сюда НЕ входит: его выкладывает release.sh
# с ноутбука. Порядок: install.sh → release.sh → проверка по DEPLOY.md.
set -euo pipefail

DOMAIN="${DOMAIN:-itagent.ru}"
APP_DIR=/srv/itagent
DATA_DIR=/var/lib/itagent
BACKUP_DIR=/var/backups/itagent
ENV_FILE=/etc/itagent/env
DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Для проверки в контейнере, где нет systemd, сети наружу для сертификата
# и файрвола. На настоящем сервере эти переменные не задают.
SKIP_SYSTEMD="${SKIP_SYSTEMD:-0}"
SKIP_CERTBOT="${SKIP_CERTBOT:-0}"
SKIP_UFW="${SKIP_UFW:-0}"

say()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m    %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Запускать от root: sudo bash $0"; exit 1; }

# ── Пакеты ────────────────────────────────────────────────────────────────
say "Пакеты: nginx, certbot, sqlite3"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q nginx certbot python3-certbot-nginx sqlite3 curl ca-certificates gnupg ufw

# ── Node 24 ───────────────────────────────────────────────────────────────
# Именно 24: приложение хранит заявки через встроенный node:sqlite,
# которого нет в Node 18 из репозитория Ubuntu.
if node -v 2>/dev/null | grep -q '^v24\.'; then
  say "Node $(node -v) уже стоит"
else
  say "Node 24 из репозитория NodeSource"
  # Репозиторий подключается явно, а не через «curl | bash» от root.
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main" \
    > /etc/apt/sources.list.d/nodesource.list
  apt-get update -q
  apt-get install -y -q nodejs
  node -v | grep -q '^v24\.' || { echo "Node 24 не установился"; exit 1; }
fi

# ── Пользователь и каталоги ───────────────────────────────────────────────
say "Пользователь itagent и каталоги"
id -u itagent >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin itagent
mkdir -p "$APP_DIR" "$DATA_DIR/media" "$BACKUP_DIR" /etc/itagent
chown root:itagent "$APP_DIR"; chmod 750 "$APP_DIR"
chown -R itagent:itagent "$DATA_DIR" "$BACKUP_DIR"
chmod 750 "$DATA_DIR" "$BACKUP_DIR"

# Сценарий копий — в фиксированное место: юнит зовёт его оттуда и не
# зависит от того, куда владелец положил каталог deploy.
install -m 755 "$DEPLOY_DIR/itagent-backup.sh" /usr/local/sbin/itagent-backup.sh

# ── Секреты ───────────────────────────────────────────────────────────────
# Файл читает только root и группа itagent. Юнит подхватывает его через
# EnvironmentFile — в самом юните секретов нет.
if [ -f "$ENV_FILE" ]; then
  say "Секреты уже заданы: $ENV_FILE (чтобы поменять — отредактируйте файл и systemctl restart itagent)"
else
  say "Секреты → $ENV_FILE"
  # Переменная, заданная в окружении (даже пустой), не спрашивается —
  # так скрипт можно запускать без терминала. Не заданная — спрашивается,
  # а без терминала это ошибка, а не молчаливый пустой пароль.
  need_tty() { [ -t 0 ] || { echo "Переменная $1 не задана, а терминала нет — передайте её в окружении"; exit 1; }; }
  if [ -z "${ADMIN_PASSWORD+x}" ]; then
    need_tty ADMIN_PASSWORD
    while :; do
      read -r -s -p "Первый пароль в админку (не короче 8 символов): " ADMIN_PASSWORD; echo
      [ "${#ADMIN_PASSWORD}" -ge 8 ] && break
      warn "короче 8 символов — сервер его не примет"
    done
  fi
  [ "${#ADMIN_PASSWORD}" -ge 8 ] || { echo "ADMIN_PASSWORD короче 8 символов"; exit 1; }
  if [ -z "${TELEGRAM_BOT_TOKEN+x}" ]; then
    need_tty TELEGRAM_BOT_TOKEN
    read -r -s -p "Токен бота от BotFather (Enter — пока без Telegram): " TELEGRAM_BOT_TOKEN; echo
  fi
  if [ -z "${TELEGRAM_CHAT_ID+x}" ]; then
    need_tty TELEGRAM_CHAT_ID
    read -r -p "ID чата для уведомлений (Enter — пока без Telegram): " TELEGRAM_CHAT_ID
  fi
  umask 027
  cat > "$ENV_FILE" <<EOF
# Секреты сайта. Читает systemd (EnvironmentFile) при старте itagent.service.
# После смены: systemctl restart itagent
# HOST=127.0.0.1: приложение слушает только локально, снаружи — через nginx.
# Иначе порт 3000 доступен напрямую, мимо HTTPS и мимо проверки адресов.
HOST=127.0.0.1
PORT=3000
DATA_DIR=$DATA_DIR
ADMIN_PASSWORD=$ADMIN_PASSWORD
TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID=$TELEGRAM_CHAT_ID
EOF
  umask 022
  chown root:itagent "$ENV_FILE"; chmod 640 "$ENV_FILE"
  [ -n "$TELEGRAM_BOT_TOKEN" ] || warn "Telegram не задан: заявки будут только в админке. Впишите токен в $ENV_FILE позже."
fi

# ── nginx ─────────────────────────────────────────────────────────────────
say "nginx: сайт $DOMAIN"
NGINX_SITE=/etc/nginx/sites-available/itagent
if [ -f "$NGINX_SITE" ] && grep -q 'managed by Certbot' "$NGINX_SITE"; then
  # certbot уже дописал HTTPS-блок; перезапись шаблоном снесла бы его.
  warn "конфиг nginx уже с HTTPS от certbot — не трогаю"
else
  sed "s/__DOMAIN__/$DOMAIN/g" "$DEPLOY_DIR/nginx-itagent.conf" > "$NGINX_SITE"
fi
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/itagent
rm -f /etc/nginx/sites-enabled/default
nginx -t

# ── journald: журналы не дольше 30 дней ───────────────────────────────────
# Политика на сайте обещает это про все журналы; у journald по умолчанию
# срока нет. ForwardToSyslog=no — иначе тот же журнал дублируется в
# /var/log/syslog, где rsyslog держит его дольше месяца.
say "journald: хранить 30 дней"
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/itagent.conf <<'EOF'
[Journal]
MaxRetentionSec=30day
ForwardToSyslog=no
EOF

# ── Юниты ─────────────────────────────────────────────────────────────────
say "systemd: itagent.service, itagent-backup.timer"
install -m 644 "$DEPLOY_DIR/itagent.service" "$DEPLOY_DIR/itagent-backup.service" "$DEPLOY_DIR/itagent-backup.timer" /etc/systemd/system/

if [ "$SKIP_SYSTEMD" = "1" ]; then
  warn "SKIP_SYSTEMD=1: юниты скопированы, но не запущены"
else
  systemctl daemon-reload
  systemctl restart systemd-journald
  systemctl enable --now nginx
  systemctl reload nginx
  systemctl enable itagent-backup.timer
  systemctl start itagent-backup.timer
  systemctl enable itagent
  if [ -f "$APP_DIR/.output/server/index.mjs" ]; then
    systemctl restart itagent
  else
    warn "Сайта ещё нет в $APP_DIR/.output — выложите его: bash deploy/release.sh root@$DOMAIN (с ноутбука)"
  fi
fi

# ── Файрвол ───────────────────────────────────────────────────────────────
if [ "$SKIP_UFW" = "1" ]; then
  warn "SKIP_UFW=1: файрвол не трогали"
else
  say "ufw: только ssh и http/https"
  # Порт ssh — из живой конфигурации: на нестандартном порту правило
  # «OpenSSH» открыло бы 22 и закрыло бы владельцу доступ.
  SSH_PORT="$(sshd -T 2>/dev/null | awk '/^port /{print $2; exit}')"
  ufw allow "${SSH_PORT:-22}/tcp" >/dev/null
  ufw allow 'Nginx Full' >/dev/null
  ufw --force enable >/dev/null
fi

# ── Сертификат ────────────────────────────────────────────────────────────
# Только если домен уже смотрит сюда: иначе Let's Encrypt не сможет
# проверить владение, и попытка лишь потратит лимит запросов.
if [ "$SKIP_CERTBOT" = "1" ]; then
  warn "SKIP_CERTBOT=1: сертификат не запрашивали"
elif [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  say "Сертификат для $DOMAIN уже есть"
else
  # «|| true»: неразрешённый домен даёт getent ненулевой код, а под
  # pipefail это уронило бы скрипт вместо подсказки ниже.
  MY_IP="$(curl -fsS -4 https://api.ipify.org 2>/dev/null || true)"
  DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)"
  WWW_IP="$(getent ahostsv4 "www.$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)"
  if [ -n "$MY_IP" ] && [ "$MY_IP" = "$DOMAIN_IP" ]; then
    NAMES=(-d "$DOMAIN")
    if [ "$WWW_IP" = "$MY_IP" ]; then
      NAMES+=(-d "www.$DOMAIN")
    else
      warn "www.$DOMAIN пока не указывает сюда — сертификат только на $DOMAIN; www добавите потом: certbot --nginx -d $DOMAIN -d www.$DOMAIN --expand"
    fi
    say "Сертификат Let's Encrypt: ${NAMES[*]}"
    certbot --nginx "${NAMES[@]}" --non-interactive --agree-tos \
      --register-unsafely-without-email --redirect
    systemctl is-enabled --quiet certbot.timer 2>/dev/null || warn "certbot.timer выключен: сертификат не продлится сам"
  else
    warn "Домен $DOMAIN пока указывает на «${DOMAIN_IP:-ничего}», а этот сервер — ${MY_IP:-неизвестно}."
    warn "Когда DNS обновится, запустите: certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect"
  fi
fi

say "Готово. Дальше: с ноутбука bash deploy/release.sh root@$DOMAIN, затем проверка по DEPLOY.md"
