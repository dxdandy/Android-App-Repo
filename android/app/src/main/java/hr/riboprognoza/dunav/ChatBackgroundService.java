package hr.riboprognoza.dunav;

import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class ChatBackgroundService extends Service {
    private static final String TAG = "ChatBackgroundService";
    private ExecutorService executor;
    private volatile boolean isRunning = false;

    @Override
    public void onCreate() {
        super.onCreate();
        executor = Executors.newSingleThreadExecutor();
        isRunning = true;
        startPollingLoop();
        Log.i(TAG, "ChatBackgroundService pokrenut.");
    }

    private void startPollingLoop() {
        if (executor == null || executor.isShutdown()) {
            executor = Executors.newSingleThreadExecutor();
        }
        executor.execute(() -> {
            while (isRunning) {
                try {
                    ChatPollHelper.checkAndNotify(getApplicationContext(), true);
                    Thread.sleep(1500);
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    Log.w(TAG, "Greška u pozadinskom osluškivanju: " + e.getMessage());
                    try {
                        Thread.sleep(4000);
                    } catch (InterruptedException ignored) {}
                }
            }
        });
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!isRunning) {
            isRunning = true;
            startPollingLoop();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (executor != null) {
            executor.shutdownNow();
        }
        super.onDestroy();
        Log.i(TAG, "ChatBackgroundService zaustavljen.");
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
