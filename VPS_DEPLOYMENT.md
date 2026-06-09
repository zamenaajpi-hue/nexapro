# 🚀 NEXA Messenger - VPS Deployment Guide

## 📋 Требования
- VPS с Ubuntu 20.04+ или CentOS 8+
- Node.js 18+
- SSH доступ к серверу
- Доменное имя или статический IP

## 🎯 План развертывания
1. Удалить старый репозиторий (если есть)
2. Загрузить и распаковать Backend код
3. Установить зависимости
4. Настроить переменные окружения
5. Запустить с PM2 для автозапуска
6. Настроить Nginx как reverse proxy
7. Настроить SSL сертификат (Let's Encrypt)

---

## 🔧 ЭТАП 1: Подготовка сервера

### 1.1 Подключитесь к серверу
```bash
ssh root@your_vps_ip
# или
ssh username@your_vps_ip
```

### 1.2 Обновите систему
```bash
apt update && apt upgrade -y
```

### 1.3 Установите Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
apt install -y nodejs
node --version  # Проверить версию
```

### 1.4 Установите PM2 (для автозапуска)
```bash
npm install -g pm2
pm2 startup
pm2 save
```

---

## 🗑️ ЭТАП 2: Удалить старый репозиторий

### 2.1 Найти старую папку
```bash
ls -la /home/
ls -la ~
# Обычно это может быть: ~/nexapro или ~/nexa-messenger или /var/www/nexa
```

### 2.2 Удалить старую папку (ОСТОРОЖНО!)
```bash
# Если сохранена база данных, сделайте бэкап:
cp -r /path/to/old/repo/prisma/dev.db ~/backup.db

# Удалить полностью
rm -rf /path/to/old/repo
# Пример:
rm -rf ~/nexapro
# или
rm -rf /var/www/nexa-messenger
```

### 2.3 Остановить старый процесс (если запущен)
```bash
pm2 list
pm2 kill process_id
# или
pm2 kill all
```

---

## 📦 ЭТАП 3: Загрузить Backend код

### Вариант A: Используя archiver (рекомендуется)

#### На вашем компьютере (Windows PowerShell):
```powershell
# Перейти в папку проекта
cd C:\Users\samso\OneDrive\Desktop\nexapro

# Создать архив только Backend части
Compress-Archive -Path @("src", "prisma", "package.json", "tsconfig.json", "server.ts", "vite.config.ts") -DestinationPath backend.zip

# Или используя 7-Zip
7z a -r backend.zip src\ prisma\ package.json tsconfig.json server.ts vite.config.ts

# Проверить что архив создан
Get-Item backend.zip
```

#### На сервере (SSH):
```bash
# Создать директорию для приложения
mkdir -p /var/www/nexa-messenger
cd /var/www/nexa-messenger

# Загрузить архив (используйте SFTP или SCP)
# На вашем компьютере откройте PowerShell и выполните:
# scp backend.zip user@vps_ip:/var/www/nexa-messenger/

# На сервере распаковать:
unzip backend.zip
ls -la  # Проверить что все распаковалось
```

### Вариант B: Прямая передача файлов (если SCP не работает)

#### На вашем компьютере:
1. Откройте WinSCP (https://winscp.net/)
2. Введите: Host = VPS IP, Username = root, Password = пароль
3. Connect
4. Перенесите файлы методом drag-and-drop

---

## ⚙️ ЭТАП 4: Установить зависимости

```bash
cd /var/www/nexa-messenger

# Установить dependencies
npm install

# Генерировать Prisma клиент
npx prisma generate

# Инициализировать базу данных
npx prisma db push

# (Опционально) Запустить seed для тестовых данных
# npx prisma db seed
```

---

## 🔐 ЭТАП 5: Настроить переменные окружения

### 5.1 Создать .env файл
```bash
cat > .env << 'EOF'
# Database
DATABASE_URL="file:./prisma/dev.db"

# Node environment
NODE_ENV="production"

# Server
PORT=3000
HOST="0.0.0.0"

# CORS для мобильного приложения
CORS_ORIGIN="*"

# JWT (создать случайный токен: openssl rand -base64 32)
JWT_SECRET="your_random_secret_key_here"
EOF
```

### 5.2 Проверить файл
```bash
cat .env
```

---

## 🚀 ЭТАП 6: Запустить приложение с PM2

### 6.1 Запустить через PM2
```bash
# Построить приложение
npm run build

# Запустить через PM2 (развертывание backend)
pm2 start dist/server.cjs --name "nexa-backend"

# Проверить статус
pm2 status
pm2 logs nexa-backend

# Сохранить процесс для автозапуска
pm2 save
```

### 6.2 Проверить что работает
```bash
curl http://localhost:3000/api/health
# Должно вернуть: {"status":"ok"}

# Или смотрите логи
pm2 logs nexa-backend
```

---

## 🌐 ЭТАП 7: Настроить Nginx Reverse Proxy

### 7.1 Установить Nginx
```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

### 7.2 Создать конфигурацию
```bash
cat > /etc/nginx/sites-available/nexa-messenger << 'EOF'
server {
    listen 80;
    server_name your_domain.com;  # Или IP адрес

    # Перенаправить HTTP на HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your_domain.com;

    # SSL сертификаты (добавить позже)
    ssl_certificate /etc/letsencrypt/live/your_domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your_domain.com/privkey.pem;

    # Оптимизация SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Размер буфера для больших запросов
    client_max_body_size 50M;

    # Основной proxy
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;

        # Headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket поддержка
        proxy_cache_bypass $http_upgrade;
    }

    # Socket.IO специальная обработка
    location /socket.io {
        proxy_pass http://localhost:3000/socket.io;
        proxy_http_version 1.1;
        proxy_buffering off;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Логи
    access_log /var/log/nginx/nexa-access.log;
    error_log /var/log/nginx/nexa-error.log;
}
EOF
```

### 7.3 Активировать конфигурацию
```bash
ln -s /etc/nginx/sites-available/nexa-messenger /etc/nginx/sites-enabled/
nginx -t  # Проверить синтаксис
systemctl reload nginx
```

---

## 🔒 ЭТАП 8: Настроить SSL (Let's Encrypt)

### 8.1 Установить Certbot
```bash
apt install -y certbot python3-certbot-nginx
```

### 8.2 Получить сертификат
```bash
certbot certonly --nginx -d your_domain.com
# Следуйте инструкциям, введите email

# Проверить что сертификат создан
ls /etc/letsencrypt/live/your_domain.com/
```

### 8.3 Обновить конфигурацию Nginx
```bash
# Обновить пути в конфигурации
sed -i 's/your_domain.com/your_domain.com/g' /etc/nginx/sites-available/nexa-messenger
nginx -t
systemctl reload nginx
```

### 8.4 Автоматическое обновление сертификата
```bash
certbot renew --dry-run  # Тест
systemctl enable certbot.timer
```

---

## ✅ ЭТАП 9: Проверка и тестирование

### 9.1 Проверить что все работает
```bash
# Проверить процесс
pm2 status
pm2 logs nexa-backend

# Проверить Nginx
systemctl status nginx

# Проверить порты
netstat -tulpn | grep 3000
netstat -tulpn | grep 80
netstat -tulpn | grep 443
```

### 9.2 Тестировать с браузера
```
https://your_domain.com
# Или
http://vps_ip:3000
```

### 9.3 Тестировать API
```bash
curl https://your_domain.com/api/health
curl https://your_domain.com/socket.io/
```

---

## 📱 ЭТАП 10: Подключить мобильное приложение

В мобильном приложении ввести:
```
https://your_domain.com
```

Или если используете IP:
```
http://vps_ip:3000
```

---

## 🔄 Управление приложением

### Просмотр логов
```bash
pm2 logs nexa-backend
pm2 logs -f  # Follow mode
```

### Перезагрузка
```bash
pm2 restart nexa-backend
pm2 reload nexa-backend  # Zero downtime
```

### Остановка
```bash
pm2 stop nexa-backend
```

### Удаление
```bash
pm2 delete nexa-backend
```

---

## 📊 Мониторинг

```bash
# Установить web dashboard
pm2 web  # Откроется на http://localhost:9615

# Или установить monit
apt install -y monit
```

---

## 🐛 Отладка

### Если порт 3000 уже используется
```bash
lsof -i :3000
kill -9 PID
```

### Если база данных повреждена
```bash
rm prisma/dev.db
npx prisma db push
```

### Если не работает Socket.IO
Проверить в логах:
```bash
pm2 logs nexa-backend | grep -i socket
```

---

## 🎉 Готово!

Приложение теперь доступно на:
- **Веб**: https://your_domain.com
- **API**: https://your_domain.com/api
- **Socket.IO**: wss://your_domain.com/socket.io/

Мобильное приложение подключается к: `https://your_domain.com`

---

## 📝 Быстрые команды для переиспользования

```bash
# 1. SSH подключение
ssh root@your_vps_ip

# 2. Перейти в папку
cd /var/www/nexa-messenger

# 3. Обновить код
# Загрузить новый архив и распаковать

# 4. Переустановить зависимости
npm install && npm run build

# 5. Перезагрузить приложение
pm2 restart nexa-backend

# 6. Проверить логи
pm2 logs nexa-backend

# 7. Проверить здоровье
curl https://your_domain.com/api/health
```

---

## ✨ Версия: 1.0.0
Последнее обновление: 2024
