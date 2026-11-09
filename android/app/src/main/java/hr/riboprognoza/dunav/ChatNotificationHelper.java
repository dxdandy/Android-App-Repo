package hr.riboprognoza.dunav;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Pomoćna klasa za prikaz obavijesti s ikonicom udice i zvukom
 * Konfigurirana za maksimalni prioritet:
 * - Zvučna obavijest i vibracija
 * - Skočna obavijest na vrhu ekrana (Heads-Up)
 * - Prikaz ikone udice i poruke na zaključanom zaslonu (Lockscreen & Always-On Display)
 * - Automatsko buđenje zaslona pri dolasku poruke kada je aplikacija ugašena
 */
public class ChatNotificationHelper {
    public static final String CHANNEL_ID = "ribo_chat_sms_channel_v5";
    private static final String TAG = "ChatNotificationHelper";

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                NotificationManager manager = context.getSystemService(NotificationManager.class);
                if (manager != null) {
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "RiboPrognoza LiveChat Poruke",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    channel.setDescription("Zvučne, skočne i Lockscreen obavijesti s ikonom udice za nove poruke");
                    channel.enableLights(true);
                    channel.setLightColor(Color.parseColor("#0891b2"));
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{0, 300, 150, 300});
                    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                    channel.setShowBadge(true);

                    // Standardni ton obavijesti usklađen sa sistemskim nivoom glasnoće zvuka obavijesti korisnika
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                        .build();
                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    channel.setSound(soundUri, audioAttributes);

                    manager.createNotificationChannel(channel);
                }
            } catch (Exception e) {
                Log.w(TAG, "Greška pri kreiranju notification kanala: " + e.getMessage());
            }
        }
    }

    /**
     * Uklanja sve aktivne obavijesti i resetira badge/brojač ikone aplikacije
     */
    public static void clearAllNotifications(Context context) {
        try {
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            notificationManager.cancelAll();
            Log.i(TAG, "Uspješno poništene sve chat obavijesti i resetiran sistemski bedž.");
        } catch (Exception e) {
            Log.w(TAG, "Greška pri resetiranju obavijesti: " + e.getMessage());
        }
    }

    public static void showNotification(Context context, String senderName, String messageText, String messageId) {
        try {
            createNotificationChannel(context);

            // Upali zaslon na zaključanom mobitelu kako bi korisnik odmah vidio obavijest na Lockscreenu
            try {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    PowerManager.WakeLock screenLock = pm.newWakeLock(
                        PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ACQUIRE_CAUSES_WAKEUP | PowerManager.ON_AFTER_RELEASE,
                        "RiboPrognoza:ChatScreenWake"
                    );
                    screenLock.acquire(5000);
                }
            } catch (Exception ignored) {}

            Intent intent = new Intent(context, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.putExtra("openChat", true);
            intent.putExtra("messageId", messageId);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }

            int notifId = (int) (System.currentTimeMillis() % 100000);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, notifId, intent, flags);

            Uri defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            String displayName = (senderName != null && !senderName.trim().isEmpty()) ? senderName.trim() : "Ribič";
            String displayBody = (messageText != null && !messageText.trim().isEmpty()) ? messageText.trim() : "Nova poruka u LiveChatu";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_hook)
                .setColor(Color.parseColor("#0891b2"))
                .setContentTitle("🎣 LiveChat: " + displayName)
                .setContentText(displayBody)
                .setTicker("🎣 " + displayName + ": " + displayBody)
                .setStyle(new NotificationCompat.BigTextStyle()
                    .setBigContentTitle("🎣 LiveChat: " + displayName)
                    .bigText(displayBody))
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSound(defaultSound)
                .setVibrate(new long[]{0, 400, 150, 400})
                .setDefaults(Notification.DEFAULT_ALL)
                .setFullScreenIntent(pendingIntent, true)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(context);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (androidx.core.content.ContextCompat.checkSelfPermission(context, android.Manifest.permission.POST_NOTIFICATIONS)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "Nema POST_NOTIFICATIONS dozvole za slanje obavijesti.");
                    return;
                }
            }

            notificationManager.notify(notifId, builder.build());
            Log.i(TAG, "Uspješno poslana SMS/Lockscreen obavijest s ikonom udice od: " + displayName);
        } catch (Exception e) {
            Log.e(TAG, "Greška pri prikazu obavijesti: " + e.getMessage());
        }
    }
}
