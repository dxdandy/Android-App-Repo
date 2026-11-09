package hr.riboprognoza.dunav;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final int PERMISSION_REQUEST_POST_NOTIFICATIONS = 101;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkCleanerPlugin.class);
        registerPlugin(ChatNativeNotifierPlugin.class);
        super.onCreate(savedInstanceState);

        // 1. Zaštita: vraćanje na lokalne assete ako je prethodno došlo do krive navigacije
        resetWebViewToLocalAssetsIfNeeded();

        // 2. Kreiraj kanal visoke važnosti za zvučne i vizualne obavijesti s ikonom udice
        ChatNotificationHelper.createNotificationChannel(this);

        // 3. Traži runtime dozvolu za prikaz obavijesti na Android 13+ (API 33+)
        requestNotificationPermissionNative();

        // 4. Pokreni pozadinsku službu i zakaži periodički alarm za provjeru poruka
        startChatBackgroundMonitoring();

        // 5. Očisti privremene instalacijske datoteke
        cleanOldApkFiles();

        // 6. Ako je aplikacija otvorena klikom na obavijest s Lockscreena ili statusne trake, otvori LiveChat
        handleNotificationIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleNotificationIntent(intent);
    }

    private void handleNotificationIntent(Intent intent) {
        try {
            if (intent != null && intent.getBooleanExtra("openChat", false)) {
                intent.removeExtra("openChat");
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    this.bridge.getWebView().postDelayed(() -> {
                        try {
                            this.bridge.getWebView().evaluateJavascript(
                                "try { localStorage.setItem('ribo_pending_open_chat_on_resume', 'true'); window.dispatchEvent(new Event('focus')); } catch(e){}",
                                null
                            );
                        } catch (Exception ignored) {}
                    }, 400);
                }
            }
        } catch (Exception ignored) {}
    }

    private void requestNotificationPermissionNative() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    this,
                    new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                    PERMISSION_REQUEST_POST_NOTIFICATIONS
                );
            }
        }
    }

    private void startChatBackgroundMonitoring() {
        try {
            // Pokreni trajni servis
            Intent serviceIntent = new Intent(this, ChatBackgroundService.class);
            startService(serviceIntent);
        } catch (Exception e) {
            Log.w(TAG, "Pokretanje ChatBackgroundService: " + e.getMessage());
        }

        try {
            // Zakaži AlarmManager buđenje (radi čak i kada je aplikacija ugašena)
            ChatAlarmReceiver.scheduleNextAlarm(this);
        } catch (Exception e) {
            Log.w(TAG, "Zakazivanje alarma: " + e.getMessage());
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        resetWebViewToLocalAssetsIfNeeded();
        cleanOldApkFiles();
        startChatBackgroundMonitoring();
    }

    @Override
    public void onPause() {
        super.onPause();
        try {
            getSharedPreferences(ChatPollHelper.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(ChatPollHelper.KEY_IN_CHAT, false)
                .apply();
        } catch (Exception ignored) {}
        startChatBackgroundMonitoring();
    }

    @Override
    public void onStop() {
        super.onStop();
        try {
            getSharedPreferences(ChatPollHelper.PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putBoolean(ChatPollHelper.KEY_IN_CHAT, false)
                .apply();
        } catch (Exception ignored) {}
        startChatBackgroundMonitoring();
    }

    private void resetWebViewToLocalAssetsIfNeeded() {
        try {
            if (this.bridge != null && this.bridge.getWebView() != null) {
                String currentUrl = this.bridge.getWebView().getUrl();
                if (currentUrl != null && (currentUrl.contains("run.app") || currentUrl.contains("not found"))) {
                    Log.w(TAG, "Detektiran neispravan URL (" + currentUrl + "). Vraćanje na https://localhost/index.html");
                    this.bridge.getWebView().clearHistory();
                    this.bridge.getWebView().loadUrl("https://localhost/index.html");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Greška u resetWebViewToLocalAssetsIfNeeded: " + e.getMessage());
        }
    }

    /**
     * Automatski pronalazi i briše instalacijske APK datoteke aplikacije (RiboPrognoza*.apk)
     * s uređaja nakon ažuriranja kako ne bi zauzimale korisničku memoriju.
     */
    public int cleanOldApkFiles() {
        int deletedCount = 0;
        try {
            // 1. Čišćenje internog cache direktorija
            deletedCount += deleteApksInDirectory(getCacheDir());

            // 2. Čišćenje vanjskog cache direktorija aplikacije
            deletedCount += deleteApksInDirectory(getExternalCacheDir());

            // 3. Čišćenje privatnog downloads direktorija aplikacije
            deletedCount += deleteApksInDirectory(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS));

            // 4. Čišćenje javnog Downloads direktorija za sve datoteke RiboPrognoza*.apk
            File publicDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            if (publicDownloads != null && publicDownloads.exists() && publicDownloads.isDirectory()) {
                File[] files = publicDownloads.listFiles();
                if (files != null) {
                    for (File f : files) {
                        if (f.isFile()) {
                            String name = f.getName().toLowerCase();
                            if ((name.startsWith("riboprognoza") || name.startsWith("ribo_prognoza") || name.startsWith("app-release"))
                                    && name.endsWith(".apk")) {
                                try {
                                    if (f.delete()) {
                                        deletedCount++;
                                        Log.i(TAG, "Uspješno obrisana stara APK instalacijska datoteka: " + f.getName());
                                    }
                                } catch (Exception e) {
                                    Log.w(TAG, "Nemoguće obrisati APK datoteku " + f.getName() + ": " + e.getMessage());
                                }
                            }
                        }
                    }
                }
            }

            // 5. Uklanjanje preko Android DownloadManagera (automatski uklanja zadatak i datoteku)
            DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            if (dm != null) {
                DownloadManager.Query query = new DownloadManager.Query();
                try (Cursor cursor = dm.query(query)) {
                    if (cursor != null) {
                        int idCol = cursor.getColumnIndex(DownloadManager.COLUMN_ID);
                        int titleCol = cursor.getColumnIndex(DownloadManager.COLUMN_TITLE);
                        int localUriCol = cursor.getColumnIndex(DownloadManager.COLUMN_LOCAL_URI);

                        while (cursor.moveToNext()) {
                            long id = idCol != -1 ? cursor.getLong(idCol) : -1;
                            String title = titleCol != -1 ? cursor.getString(titleCol) : "";
                            String localUri = localUriCol != -1 ? cursor.getString(localUriCol) : "";

                            boolean isRiboApk = (title != null && title.toLowerCase().contains("riboprognoza")) ||
                                                (localUri != null && localUri.toLowerCase().contains("riboprognoza"));

                            if (isRiboApk && id != -1) {
                                int removed = dm.remove(id);
                                if (removed > 0) {
                                    deletedCount++;
                                    Log.i(TAG, "DownloadManager: Uspješno uklonjen instalacijski download (ID " + id + ")");
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Greška pri pretraživanju DownloadManagera: " + e.getMessage());
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Greška u automatskom čišćenju APK-ova: " + e.getMessage());
        }

        Log.i(TAG, "Ukupno očišćeno starih instalacijskih datoteka: " + deletedCount);
        return deletedCount;
    }

    private int deleteApksInDirectory(File dir) {
        if (dir == null || !dir.exists() || !dir.isDirectory()) return 0;
        int count = 0;
        File[] files = dir.listFiles();
        if (files == null) return 0;
        for (File f : files) {
            if (f.isDirectory()) {
                count += deleteApksInDirectory(f);
            } else if (f.getName().toLowerCase().endsWith(".apk")) {
                try {
                    if (f.delete()) {
                        count++;
                        Log.i(TAG, "Obrisan APK iz direktorija: " + f.getAbsolutePath());
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Greška pri brisanju APK " + f.getName() + ": " + e.getMessage());
                }
            }
        }
        return count;
    }

    /**
     * Capacitor dodatak za pozivanje automatskog čišćenja izravno iz JavaScript sučelja
     */
    @CapacitorPlugin(name = "ApkCleaner")
    public static class ApkCleanerPlugin extends Plugin {
        @PluginMethod
        public void cleanApks(PluginCall call) {
            try {
                MainActivity activity = (MainActivity) getActivity();
                int deleted = 0;
                if (activity != null) {
                    deleted = activity.cleanOldApkFiles();
                }
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("deletedCount", deleted);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Greška pri čišćenju APK datoteka: " + e.getMessage());
            }
        }
    }

    /**
     * Capacitor dodatak za upravljanje nativnim pozadinskim obavijestima o LiveChat porukama
     */
    @CapacitorPlugin(name = "ChatNativeNotifier")
    public static class ChatNativeNotifierPlugin extends Plugin {
        @PluginMethod
        public void setDeviceId(PluginCall call) {
            try {
                String deviceId = call.getString("deviceId", "");
                if (deviceId != null && !deviceId.trim().isEmpty()) {
                    getContext().getSharedPreferences(ChatPollHelper.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit()
                        .putString(ChatPollHelper.KEY_DEVICE_ID, deviceId.trim())
                        .apply();
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("Greška pri spremanju deviceId: " + e.getMessage());
            }
        }

        @PluginMethod
        public void setInChat(PluginCall call) {
            try {
                boolean inChat = Boolean.TRUE.equals(call.getBoolean("inChat", false));
                getContext().getSharedPreferences(ChatPollHelper.PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putBoolean(ChatPollHelper.KEY_IN_CHAT, inChat)
                    .apply();
                call.resolve();
            } catch (Exception e) {
                call.reject("Greška pri postavljanju inChat statusa: " + e.getMessage());
            }
        }

        @PluginMethod
        public void setLastSeenMessage(PluginCall call) {
            try {
                String messageId = call.getString("messageId", "");
                Long createdAt = call.getLong("createdAt", System.currentTimeMillis());
                if (messageId != null && !messageId.trim().isEmpty()) {
                    getContext().getSharedPreferences(ChatPollHelper.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit()
                        .putString(ChatPollHelper.KEY_LAST_NOTIFIED_ID, messageId.trim())
                        .putLong(ChatPollHelper.KEY_LAST_NOTIFIED_TIME, createdAt != null ? createdAt : System.currentTimeMillis())
                        .apply();
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("Greška pri spremanju zadnje poruke: " + e.getMessage());
            }
        }

        @PluginMethod
        public void checkNow(PluginCall call) {
            try {
                new Thread(() -> {
                    ChatPollHelper.checkAndNotify(getContext());
                }).start();
                call.resolve();
            } catch (Exception e) {
                call.reject("Greška: " + e.getMessage());
            }
        }

        @PluginMethod
        public void clearNotifications(PluginCall call) {
            try {
                ChatNotificationHelper.clearAllNotifications(getContext());
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Greška pri brisanju obavijesti: " + e.getMessage());
            }
        }

        @PluginMethod
        public void sendTestNotification(PluginCall call) {
            try {
                String title = call.getString("title", "Test Ribič");
                String text = call.getString("text", "Ovo je testna obavijest s ikonom udice!");
                ChatNotificationHelper.showNotification(getContext(), title, text, "test_" + System.currentTimeMillis());
                JSObject ret = new JSObject();
                ret.put("success", true);
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Greška pri slanju testne obavijesti: " + e.getMessage());
            }
        }
    }
}
