# 📱 NEXA Messenger - Android Deployment Guide

## 🎯 Что получится
При запуске Android приложение будет показывать экран для ввода адреса вашего VPS сервера. Это позволит пользователю подключиться к любому серверу.

## ✨ Новые функции
- ✅ Экран настройки сервера при первом запуске
- ✅ Сохранение адреса в хранилище устройства
- ✅ Автоматическая проверка подключения
- ✅ Поддержка как локальных (192.168.x.x) так и удаленных (domain.com) адресов
- ✅ Полная поддержка WebRTC звонков

## 🚀 Быстрый старт

### 1. Проверьте зависимости
```bash
npm ls @capacitor/core @capacitor/android @ionic/react
```

### 2. Установите зависимости если нужно
```bash
npm install
npx cap install android
```

### 3. Обновите код на устройстве
```bash
npm run build
npx cap sync
```

### 4. Откройте в Android Studio
```bash
npx cap open android
```

### 5. В Android Studio
1. **Select device or emulator** в верхнем toolbar
2. **Click Run** (зеленая кнопка Play)
3. Подождите компиляции и развертывания

## 📝 Что происходит при запуске

1. **Первый запуск**: Появляется экран "Настройка сервера"
   - Пользователь вводит адрес сервера
   - Приложение проверяет подключение
   - Адрес сохраняется для следующих запусков

2. **Последующие запуски**: Приложение автоматически подключается к сохраненному серверу

3. **Смена сервера**: Очистите кэш приложения в настройках Android или отредактируйте localStorage через DevTools

## 🔧 Примеры адресов сервера

### Локальная сеть (для тестирования)
```
http://192.168.1.100:3000
```

### VPS сервер
```
https://nexa.yourdomain.com
https://api.yourdomain.com:3000
```

### С портом
```
http://server.local:3000
https://example.com:8080
```

## 🐛 Отладка

### В DevTools (Chrome Remote Debugging)
```bash
adb devices
adb shell input keyevent 82  # Open Developer Menu
```

### Посмотреть логи
```bash
adb logcat | grep -i "nexa\|webrtc\|api"
```

### Очистить localStorage
```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## 📦 Создание APK для распределения

### Debug APK (для тестирования)
```bash
npm run build
npx cap sync
npx cap build android
```
APK будет в: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK (для Play Store)
```bash
cd android
./gradlew assembleRelease
```
APK будет в: `android/app/build/outputs/apk/release/app-release.apk`

## 🔐 Безопасность

### Для продакшена
1. Используйте HTTPS (не HTTP)
2. Установите правильные CORS headers на сервере
3. Используйте доменное имя (не IP адреса)
4. Включите certificate pinning для критичных данных

### CORS конфигурация на сервере (Express)
```javascript
app.use(cors({
  origin: ['https://yourdomain.com', 'http://localhost:3000'],
  credentials: true,
}));
```

## 📱 Поддерживаемые функции на Android

- ✅ Аутентификация (регистрация/вход)
- ✅ Чаты и сообщения
- ✅ Голосовые звонки (WebRTC)
- ✅ Видеозвонки (WebRTC)
- ✅ Звуковые уведомления
- ✅ Отправка файлов
- ✅ Истории (Stories)
- ✅ Группы и каналы

## ⚠️ Известные ограничения

- WebRTC звонки требуют одной локальной сети или открытого интернета
- Если оба пользователя за разными NAT, может потребоваться TURN сервер
- Убедитесь что микрофон/камера не отключены в настройках Android

## 🆘 Проблемы и решения

### "Не удается подключиться к серверу"
- Проверьте IP адрес сервера
- Убедитесь что порт открыт (3000)
- Проверьте firewall правила

### "Звонки не работают"
- Включите микрофон в настройках приложения
- Проверьте что оба пользователя подключены к серверу
- Если оба за NAT, может потребоваться TURN сервер

### "Экран конфигурации не появляется"
- Очистите app cache: Settings → Apps → Nexa Messenger → Storage → Clear Cache
- Перестартуйте приложение
- Удалите app и переустановите

## 📊 Мониторинг

### Смотрите логи WebRTC
```
[WebRTC] Setting up peer connection...
[WebRTC] Adding track: audio enabled: true
[WebRTC] Received remote track: audio
```

### Смотрите логи API
```
[API] GET /api/auth/me
[API] GET /api/chats
```

## 🎓 Дополнительное

Все компоненты автоматически работают на мобильных устройствах потому что:
- Capacitor предоставляет WebView с полной поддержкой WebAPI
- WebRTC полностью поддерживается Chromium (который используется в Capacitor)
- Socket.io работает через WebSocket
- localStorage доступен для сохранения конфигурации

Никакие изменения в коде не требуются - все уже совместимо! 🚀
