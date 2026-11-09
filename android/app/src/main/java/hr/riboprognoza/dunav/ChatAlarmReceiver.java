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
    public static final int ALARM_INTERVAL_MS = 15 * 1000; // Provjera svakih 15 sekundi

    @Override
    public void onReceive(Context context, Intent intent) {
        // 1. Odmah zakaži idući alarm kako niz nikada ne bi bio prekinut
        scheduleNextAlarm(context);

        // 2. Pokušaj održati pozadinski servis aktivnim
        try {
            Intent serviceIntent = new Intent(context, ChatBackgroundService.class);
            context.startService(serviceIntent);
        } catch (Exception ignored) {}

        // 3. Koristi goAsync() kako Android ne bi uspavao proces dok traje HTTPS upit prema Firestoreu
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

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pendingIntent);
                } catch (SecurityException se) {
                    // Fallback za uređaje s restrikcijom egzaktnih alarma (Android 12/13/14+)
                    alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                alarmManager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (Exception e) {
            Log.w(TAG, "Nemoguće zakazati alarm za chat: " + e.getMessage());
        }
    }
}
