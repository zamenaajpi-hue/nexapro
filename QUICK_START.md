# ⚡ NEXA Messenger - Быстрый старт (5 минут)

## 🎯 3 платформы, 3 команды

### 1️⃣ WEB (Разработка)
```bash
npm install      # 1 раз
npm run dev      # Каждый раз
# Открыть: http://localhost:3000
```
✅ Готово за 30 сек!

---

### 2️⃣ DESKTOP (Windows/Mac/Linux)
```bash
npm run desktop  # Запустить
# или
npm run desktop:build  # Создать EXE файл
# Файлы в dist-desktop/ - готовы к распространению
```
✅ Готово за 1 мин!

---

### 3️⃣ ANDROID
```bash
npm run build
npx cap sync android
npx cap open android
# В Android Studio нажать Run (зеленая кнопка)
```
✅ Готово за 3 мин!

---

### 4️⃣ VPS (Production)
```bash
# На сервере:
bash deploy.sh

# Или вручную:
export VPS_IP='192.168.1.100'
export VPS_USER='root'
bash deploy.sh
```
✅ Готово за 5 мин!

---

## 📱 При первом запуске Android

**Приложение спросит адрес сервера:**
```
Введите адрес вашего NEXA сервера:
[               ]
```

**Примеры:**
- Локально: `http://192.168.1.100:3000`
- VPS: `https://nexa.example.com`

**Адрес сохранится** - не нужно вводить каждый раз!

---

## 🔧 Главные файлы

| Файл | Что это | Для чего |
|------|--------|---------|
| `src/App.tsx` | Главное приложение | Вся логика |
| `src/components/ServerConfigModal.tsx` | Модальное окно | Ввод адреса сервера на мобильном |
| `src/utils/apiConfig.ts` | Конфигурация API | Управление адресом сервера |
| `package.json` | Зависимости | npm install |
| `capacitor.config.ts` | Capacitor конфиг | Android/iOS |
| `electron-main.cjs` | Electron главный | Desktop приложение |
| `VPS_DEPLOYMENT.md` | Подробное руководство | Сервер пошагово |

---

## 📚 Документация

- **DEPLOYMENT_SUMMARY.md** - Полный обзор всех платформ
- **ANDROID_GUIDE.md** - Детали по Android
- **VPS_DEPLOYMENT.md** - Детали по серверу
- **README.md** - Общая информация

---

## 🚀 Получившиеся файлы

### Desktop
```
dist-desktop/
├── Nexa Messenger Setup 0.0.0.exe  (136 MB - установщик)
└── Nexa Messenger 0.0.0.exe         (136 MB - портативный)
```

### VPS
```
Автоматически запустится на:
http://your_vps_ip:3000
https://your_domain.com (после Nginx + SSL)
```

### Android
```
android/app/build/outputs/apk/debug/app-debug.apk (для тестирования)
android/app/build/outputs/apk/release/app-release.apk (для Play Store)
```

---

## ✅ Функции

- ✅ Личные чаты
- ✅ Групповые чаты
- ✅ Каналы
- ✅ **Голосовые звонки** (WebRTC)
- ✅ **Видео звонки** (WebRTC)
- ✅ Рингтон (MP3)
- ✅ Шифрование сообщений
- ✅ Истории (Stories)
- ✅ Аватары
- ✅ Кросс-платформа

---

## 🔐 Безопасность

- JWT токены для аутентификации
- E2E шифрование сообщений
- Admin панель для управления
- Безопасное хранение паролей

---

## 🐛 Быстрая отладка

```bash
# Логи веб приложения
F12 → Console

# Логи сервера (локально)
npm run dev  # Смотреть консоль

# Логи VPS
ssh root@vps_ip
pm2 logs nexa-backend

# Логи Desktop
Ctrl+Shift+I → Console

# Логи Android
adb logcat | grep -i nexa
```

---

## 💾 Сохраненные данные

**На каждом устройстве:**
- localStorage - адрес сервера, токены
- sessionStorage - временные данные
- SQLite (backend) - базы данных

---

## 🎯 Что дальше?

1. ✅ **Локально** - `npm run dev` и смотрите как работает
2. ✅ **Desktop** - `npm run desktop` на своем ПК
3. ✅ **VPS** - `bash deploy.sh` на свой сервер
4. ✅ **Android** - `npm run build && npx cap open android`

---

## 📞 Если что-то не работает

1. Проверьте что Node.js установлен: `node --version`
2. Переустановите зависимости: `npm install`
3. Посмотрите логи (F12, pm2 logs и т.д.)
4. Проверьте в документации (VPS_DEPLOYMENT.md, ANDROID_GUIDE.md)

---

## 🎊 Готово!

Все работает! Выбирайте платформу и начинайте использовать! 🚀

```
Web         → npm run dev
Desktop     → npm run desktop
VPS         → bash deploy.sh
Android     → npx cap open android
```

---

**Версия:** 1.0.0
**Дата:** 2024
**Статус:** ✅ Production Ready
