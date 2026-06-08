#!/bin/bash
# NEXA Messenger - VPS Deploy Script
# Автоматизирует загрузку backend на VPS

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 NEXA Messenger - VPS Deploy${NC}"
echo ""

# Проверить переменные
if [ -z "$VPS_IP" ] || [ -z "$VPS_USER" ]; then
    echo -e "${RED}❌ Требуются переменные окружения:${NC}"
    echo "   export VPS_IP='your_vps_ip'"
    echo "   export VPS_USER='root'"
    exit 1
fi

VPS_PATH="/var/www/nexa-messenger"

echo -e "${YELLOW}📋 Конфигурация:${NC}"
echo "   VPS IP: $VPS_IP"
echo "   VPS User: $VPS_USER"
echo "   Remote Path: $VPS_PATH"
echo ""

# Шаг 1: Подготовка архива
echo -e "${YELLOW}📦 1. Создание архива...${NC}"
zip -r backend.zip \
    src/ \
    prisma/ \
    public/ \
    package.json \
    package-lock.json \
    tsconfig.json \
    server.ts \
    vite.config.ts \
    electron-main.cjs \
    electron-preload.js \
    .env.example

echo -e "${GREEN}✓ Архив создан: backend.zip${NC}"
echo ""

# Шаг 2: Загрузка на сервер
echo -e "${YELLOW}🌐 2. Загрузка на сервер...${NC}"
scp -r backend.zip "${VPS_USER}@${VPS_IP}:${VPS_PATH}/" || {
    echo -e "${RED}❌ Ошибка загрузки. Проверьте SSH доступ.${NC}"
    exit 1
}
echo -e "${GREEN}✓ Архив загружен${NC}"
echo ""

# Шаг 3: Распаковка и установка
echo -e "${YELLOW}⚙️  3. Распаковка и установка на сервере...${NC}"
ssh "${VPS_USER}@${VPS_IP}" << 'DEPLOY'
    set -e
    cd /var/www/nexa-messenger
    
    # Остановить текущее приложение
    pm2 stop nexa-backend 2>/dev/null || true
    pm2 delete nexa-backend 2>/dev/null || true
    
    # Создать backup
    mkdir -p backup
    cp -r node_modules backup/node_modules-$(date +%s) 2>/dev/null || true
    cp prisma/dev.db backup/dev.db-$(date +%s) 2>/dev/null || true
    
    # Распаковать новый код
    unzip -o backend.zip
    rm backend.zip
    
    # Установить зависимости
    npm install
    
    # Обновить БД
    npx prisma generate
    npx prisma db push --skip-generate
    
    # Построить приложение
    npm run build
    
    # Запустить с PM2
    pm2 start dist/server.cjs --name "nexa-backend"
    pm2 save
    pm2 status
    
    echo "✓ Развертывание завершено!"
DEPLOY

echo -e "${GREEN}✓ Приложение развернуто и запущено${NC}"
echo ""

# Шаг 4: Проверка
echo -e "${YELLOW}🔍 4. Проверка подключения...${NC}"
sleep 3

# Попытаться подключиться к API
if curl -s "http://${VPS_IP}:3000/api/health" | grep -q "ok"; then
    echo -e "${GREEN}✓ API работает!${NC}"
    echo "   URL: http://${VPS_IP}:3000"
else
    echo -e "${YELLOW}⚠️  API может быть недоступна через порт 3000 (может быть за Nginx)${NC}"
    echo "   Проверьте логи: ssh ${VPS_USER}@${VPS_IP} 'pm2 logs nexa-backend'"
fi

echo ""
echo -e "${GREEN}🎉 Развертывание завершено!${NC}"
echo ""
echo -e "${YELLOW}Следующие шаги:${NC}"
echo "1. Проверить логи: pm2 logs nexa-backend"
echo "2. Если нужен Nginx + SSL, смотрите VPS_DEPLOYMENT.md"
echo "3. Подключите мобильное приложение к: http://${VPS_IP}:3000"
echo ""
echo -e "${YELLOW}Очистить архив локально:${NC}"
echo "   rm backend.zip"
