package hr.riboprognoza.dunav;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent != null ? intent.getAction() : "";
        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            Intent.ACTION_MY_PACKAGE_REPLACED.equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            Log.i(TAG, "Uređaj ponovno pokrenut (" + action + "). Pokrećem nadzor LiveChat poruka...");
            ChatNotificationHelper.createNotificationChannel(context);
            ChatAlarmReceiver.scheduleNextAlarm(context);

            try {
                Intent serviceIntent = new Intent(context, ChatBackgroundService.class);
                context.startService(serviceIntent);
            } catch (Exception ignored) {}
        }
    }
}
