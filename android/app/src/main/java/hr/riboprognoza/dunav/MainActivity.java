package hr.riboprognoza.dunav;

import android.app.DownloadManager;
import android.content.Context;
import android.database.Cursor;
import android.os.Bundle;
import android.os.Environment;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "RiboApkCleaner";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkCleanerPlugin.class);
        super.onCreate(savedInstanceState);
        cleanOldApkFiles();
    }

    @Override
    public void onResume() {
        super.onResume();
        cleanOldApkFiles();
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
}
