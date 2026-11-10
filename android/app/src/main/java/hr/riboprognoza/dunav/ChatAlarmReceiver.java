package hr.riboprognoza.dunav;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.SystemClock;
import android.util.Log;
import java.util.concurrent.Executors;

/**
 * Prijamnik alarma koji budi uređaj i provjerava Firestore čak i kada je aplikacija potpuno ugašena.
 * Koristi goAsync() kako Android sustav ne bi ugasio proces prije završetka mrežnog upita.
 */
public class ChatAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "ChatAlarmReceiver";
    // Pričuvni interval bez prisilnog buđenja procesora (sprječava Samsung/Android "Frequent wakeups" upozorenje)
    public static final int ALARM_INTERVAL_MS = 3 * 60 * 1000;

    @Override
    public void onReceive(Context context, Intent intent) {
        // 1. Zakaži idući pričuvni ciklus
        scheduleNextAlarm(context);

        // 2. Održavaj pozadinski servis aktivnim
        try {
            Intent serviceIntent = new Intent(context, ChatBackgroundService.class);
            context.startService(serviceIntent);
        } catch (Exception ignored) {}

        // 3. Koristi goAsync() kako Android ne bi prekinuo mrežni upit
        final PendingResult pendingResult = goAsync();
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                ChatPollHelper.checkAndNotify(context.getApplicationContext());
            } catch (Exception e) {
                Log.w(TAG, "Greška u ChatAlarmReceiver provjeri: " + e.getMessage());
            } finally {
                try {
                    pendingResult.finish();
                } catch (Exception ignored) {}
            }
        });
    }

    public static void scheduleNextAlarm(Context context) {
        if (context == null) return;
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent alarmIntent = new Intent(context, ChatAlarmReceiver.class);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, 7771, alarmIntent, flags);

            long triggerAtMillis = SystemClock.elapsedRealtime() + ALARM_INTERVAL_MS;

            // Koristimo ELAPSED_REALTIME (bez _WAKEUP zastavice i bez setExactAndAllowWhileIdle)
            // kako sustav nikada ne bi prijavio "Frequent wakeups / Česta buđenja"!
            alarmManager.set(AlarmManager.ELAPSED_REALTIME, triggerAtMillis, pendingIntent);
        } catch (Exception e) {
            Log.w(TAG, "Nemoguće zakazati alarm za chat: " + e.getMessage());
        }
    }
}
