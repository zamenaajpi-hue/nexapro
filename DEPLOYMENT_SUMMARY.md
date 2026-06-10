# 📲 NEXA Messenger - Полное руководство

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-18%2B-green)
![Electron](https://img.shields.io/badge/electron-42-blue)
![React](https://img.shields.io/badge/react-19-blue)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🎯 Что это?

**NEXA Messenger** - полнофункциональное приложение для шифрованного обмена сообщениями с поддержкой:
- 💬 Личные чаты и группы
- 🎥 Голосовые и видео звонки (WebRTC)
- 📱 Кросс-платформенность (Web, Desktop, Android)
- 🔐 Шифрование сообщений
- 📡 Real-time синхронизация (Socket.io)

---

## 🚀 Быстрый старт

### 1️⃣ Веб версия (разработка)
```bash
# Установить зависимости
npm install

# Запустить на localhost:3000
npm run dev

# Открыть http://localhost:3000 в браузере
```

### 2️⃣ Desktop (Electron)
```bash
# Запустить Electron приложение
npm run desktop

# Создать установщик EXE
npm run desktop:build

# Файлы будут в dist-desktop/
```

### 3️⃣ Android (Capacitor)
```bash
# Построить веб версию
npm run build

# Синхронизировать с Android
npx cap sync android

# Открыть в Android Studio
npx cap open android

# Запустить на эмуляторе или устройстве (через Android Studio)
```

### 4️⃣ VPS сервер (для продакшена)
```bash
# Смотри VPS_DEPLOYMENT.md для детальной инструкции
# Или используй автоматический скрипт:
export VPS_IP='your_server_ip'
export VPS_USER='root'
bash deploy.sh
```

---

## 📋 Структура проекта

```
nexapro/
├── src/                          # React приложение
│   ├── components/              # UI компоненты
│   │   ├── modals/             # Диалоговые окна
│   │   ├── sidebar/            # Боковая панель
│   │   └── ServerConfigModal.tsx # Новая конфигурация сервера
│   ├── pages/                  # Страницы (Auth, Chat)
│   ├── server/                 # Express backend
│   │   ├── controllers/        # API контроллеры
│   │   ├── middlewares/        # Middleware (auth, admin)
│   │   ├── socket/             # Socket.io обработчики
│   │   └── services/           # Бизнес логика
│   ├── utils/
│   │   ├── api.ts             # API клиент
│   │   ├── apiConfig.ts       # Конфигурация сервера
│   │   ├── callSounds.ts      # Звуки звонков
│   │   ├── e2ee.ts            # Шифрование
│   │   └── avatarGenerator.ts # Генератор аватаров
│   └── App.tsx                # Главный компонент
├── prisma/                     # ORM схема
│   └── schema.prisma          # База данных
├── public/                     # Статические файлы
│   └── sounds/                # Аудио файлы
├── android/                    # Android приложение (Capacitor)
├── electron-main.cjs          # Electron главный процесс
├── electron-preload.js        # Electron preload
├── package.json               # Dependencies
├── vite.config.ts             # Vite конфигурация
├── capacitor.config.ts        # Capacitor конфигурация
└── docs/
    ├── VPS_DEPLOYMENT.md      # Развертывание на сервер
    ├── ANDROID_GUIDE.md       # Гайд по Android
    └── README.md              # Этот файл
```

---

## ✨ Основные функции

### 🔐 Безопасность
- End-to-End шифрование сообщений
- Безопасная аутентификация
- Admin панель для управления

### 💬 Чаты
- Личные сообщения
- Групповые чаты
- Каналы для трансляции
- Истории (Stories) как в Instagram

### 🎥 Звонки
- Голосовые звонки (peer-to-peer)
- Видео звонки (WebRTC)
- Автоматический рингтон (MP3)
- Синхронизированный таймер
- Поддержка мобильных устройств

### 📱 Кросс-платформенность
- **Веб**: React 19 + Vite
- **Desktop**: Electron 42 (Windows/Mac/Linux)
- **Mobile**: Capacitor (iOS/Android)
- **Backend**: Express.js + Socket.io

---

## 🔧 Технологический стек

### Frontend
- **React 19** - UI фреймворк
- **Vite 6** - Build tool
- **TypeScript** - Типизация
- **Zustand** - State management
- **Socket.io Client** - Real-time

### Backend
- **Express.js 4** - HTTP сервер
- **Socket.io 4** - WebSocket сервер
- **Prisma 6** - ORM
- **SQLite** - База данных

### Desktop
- **Electron 42** - Desktop приложение

### Mobile
- **Capacitor** - Cross-platform mobile

### Media
- **WebRTC** - Голосовые/видео звонки
- **Web Audio API** - Синтез звуков

---

## 🌐 Развертывание

### Локально (разработка)
```bash
npm run dev
# URL: http://localhost:3000
```

### Desktop (EXE)
```bash
npm run desktop:build
# Готовые файлы в dist-desktop/
# - Nexa Messenger Setup 0.0.0.exe (установщик)
# - Nexa Messenger 0.0.0.exe (портативный)
```

### VPS (Production)
Смотрите **VPS_DEPLOYMENT.md** для полной инструкции:
```bash
bash deploy.sh
```

### Android (APK)
Смотрите **ANDROID_GUIDE.md** для подробной инструкции:
```bash
npm run build
npx cap sync android
npx cap open android
# Собрать APK в Android Studio
```

---

## 📱 Конфигурация сервера для мобильного

При первом запуске мобильного приложения появляется экран для ввода адреса сервера:

- **Локальный тест**: `http://192.168.1.100:3000`
- **VPS сервер**: `https://your-domain.com`
- **С портом**: `https://api.example.com:8080`

Адрес сохраняется и используется для всех запросов!

---

## 🔄 API Endpoints

### Аутентификация
- `POST /api/auth/register` - Регистрация
- `POST /api/auth/login` - Вход
- `GET /api/auth/me` - Текущий пользователь
- `POST /api/auth/logout` - Выход

### Чаты
- `GET /api/chats` - Получить все чаты
- `POST /api/chats` - Создать чат
- `POST /api/messages` - Отправить сообщение
- `GET /api/messages/:chatId` - История сообщений

### Каналы
- `GET /api/channels` - Все каналы
- `POST /api/channels` - Создать канал
- `POST /api/channels/:id/join` - Присоединиться

### Группы
- `GET /api/groups` - Все группы
- `POST /api/groups` - Создать группу
- `POST /api/groups/:id/members` - Добавить участника

---

## 🎮 WebRTC звонки

### Как работает
1. Нажимаете на кнопку "Звонок"
2. На другом устройстве слышны звуки рингтона (MP3)
3. Принимаете вызов - устанавливается P2P соединение
4. Звонок активен - таймер начинает отсчет
5. Заканчиваете вызов - оба видят финальное время

### Отладка звонков
```javascript
// В консоли браузера (F12)
// Смотрите логи WebRTC
[WebRTC] Setting up peer connection...
[WebRTC] Adding track: audio enabled: true
[WebRTC] Received remote track: audio

// Смотрите логи API
[API] GET /api/auth/me
[API] GET /api/chats
```

---

## 📊 Database Schema

### Users
```sql
CREATE TABLE "User" (
  id String @id
  nickname String
  avatar String
  isOnline Boolean
  isAdmin Boolean
  createdAt DateTime
)
```

### Messages
```sql
CREATE TABLE "Message" (
  id String @id
  content String
  senderId String
  chatId String
  encryptedKey String
  createdAt DateTime
)
```

Полная схема: **prisma/schema.prisma**

---

## 🔑 Переменные окружения

Создайте `.env` файл:
```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# Node environment
NODE_ENV="development"

# Server
PORT=3000
HOST="0.0.0.0"

# JWT Secret
JWT_SECRET="ваш_случайный_ключ_здесь"

# CORS
CORS_ORIGIN="*"
```

---

## 🐛 Отладка

### Веб версия
```bash
# DevTools (F12)
# Console для логов
# Network для API запросов
# Application для localStorage
```

### Desktop версия
```bash
# Включить DevTools: Ctrl+Shift+I
# Смотреть логи процесса
pm2 logs (если запущено через PM2)
```

### Mobile версия
```bash
# Использовать Chrome Remote Debugging
adb devices
chrome://inspect
```

---

## 📦 Build команды

```bash
# Development
npm run dev                    # Запустить локально
npm run desktop              # Запустить Electron

# Production
npm run build                # Построить веб версию
npm run desktop:build        # Построить EXE установщик

# Очистка
npm run clean                # Удалить dist папки

# Lint и типизация
npm run lint                 # Проверить типы

# VPS
bash deploy.sh              # Развернуть на VPS
```

---

## 🆘 Часто задаваемые вопросы

**Q: Звонки не работают?**
A: Проверьте что оба пользователя подключены к серверу и микрофон разрешен в настройках браузера/приложения.

**Q: Как сменить адрес сервера на мобильном?**
A: Очистите кэш приложения (Settings → Apps → Nexa Messenger → Storage → Clear Cache) или отредактируйте localStorage через DevTools.

**Q: Как заменить рингтон?**
A: Замените файл `public/sounds/phone-call-ringtone.mp3` на ваш MP3 файл.

**Q: Как запустить на своем VPS?**
A: Смотрите **VPS_DEPLOYMENT.md** для пошаговой инструкции.

---

## 📞 Support

- GitHub Issues: [Сообщить об ошибке]
- Email: support@nexa.local
- Documentation: Смотрите папку `docs/`

---

## 📝 Версии

- **v1.0.0** (Текущая)
  - ✅ Полная поддержка WebRTC звонков
  - ✅ Мобильная конфигурация сервера
  - ✅ Desktop EXE установщик
  - ✅ VPS развертывание

---

## 📄 Лицензия

MIT License - свободно используйте и модифицируйте!

---

## 🎉 Готово к использованию!

Все готово для:
- ✅ Разработки локально
- ✅ Запуска на Desktop (Windows/Mac/Linux)
- ✅ Развертывания на VPS
- ✅ Использования на Android/iOS

Выбирайте платформу и начинайте! 🚀
