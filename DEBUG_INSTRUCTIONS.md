# Debug Instructions for Android APK

## What Changed
- Added on-screen debug logging (green text on black background)
- Logs appear in a terminal-like overlay if any errors occur
- Debug log shows initialization steps

## Installation

### Option 1: USB File Transfer (Windows Explorer)
```
1. Connect phone to PC with USB cable
2. Enable "File Transfer" mode on phone
3. Open File Explorer on PC
4. Navigate to: C:\Users\samso\OneDrive\Desktop\nexapro-debug-latest.apk
5. Copy file to phone storage
6. Disconnect USB
7. On phone: Open file manager → find nexapro-debug-latest.apk → tap to install
```

### Option 2: Using ADB (if available)
```powershell
adb install C:\Users\samso\OneDrive\Desktop\nexapro-debug-latest.apk
```

### Option 3: Cloud Sharing
1. Upload `nexapro-debug-latest.apk` to Google Drive
2. Download on phone
3. Tap to install

## After Installation

1. Launch NEXA Messenger app
2. **Look at the screen** - you should see:
   - Either: Green text logs on black background (initialization steps)
   - Or: Red error message with specific error

## Expected Log Output

If everything works:
```
[INIT] Page loaded at ...
[LOAD] Window load event fired
[App] Component rendering started
[App] Initializing store...
[App] Store initialized successfully
```

Then white screen should become the app UI.

## If You See an Error

Please screenshot the error message and share it. Common errors:
- `[ERROR] Root element not found` → HTML structure issue
- `[App] ERROR: Store initialization failed` → Zustand store issue
- `[ERROR] Socket initialization failed` → Socket.io issue
- `ReferenceError: X is not defined` → Missing import or initialization

## File Location
- **APK**: `C:\Users\samso\OneDrive\Desktop\nexapro-debug-latest.apk` (4.8 MB)
- **Source**: Built from latest code with debug logging

## Device Requirements
- Android 5.0 or higher
- Minimum 100MB free storage

## Next Steps
1. Install and run the app
2. Take a screenshot of any errors or logs visible
3. Share the screenshot for next debugging step
