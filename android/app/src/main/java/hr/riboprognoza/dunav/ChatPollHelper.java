package hr.riboprognoza.dunav;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import org.json.JSONObject;

public class ChatPollHelper {
    private static final String TAG = "ChatPollHelper";
    public static final String PREFS_NAME = "RiboChatPrefs";
    public static final String KEY_DEVICE_ID = "device_id";
    public static final String KEY_LAST_NOTIFIED_ID = "last_notified_id";
    public static final String KEY_IN_CHAT = "in_chat";
    private static final String CLOUD_URL = "https://ais-pre-w265pmwlescn6ezxznnwhn-294488753863.europe-west2.run.app";

    public static void checkAndNotify(Context context, boolean waitForNew) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String myDeviceId = prefs.getString(KEY_DEVICE_ID, "");
            String lastNotifiedId = prefs.getString(KEY_LAST_NOTIFIED_ID, "");
            boolean inChat = prefs.getBoolean(KEY_IN_CHAT, false);

            if (inChat) {
                // Korisnik je aktivno unutar chata, nemoj ga ometati sistemskim obavijestima
                return;
            }

            StringBuilder urlBuilder = new StringBuilder(CLOUD_URL);
            urlBuilder.append("/api/chat/poll?deviceId=").append(URLEncoder.encode(myDeviceId, "UTF-8"));
            urlBuilder.append("&lastSeenId=").append(URLEncoder.encode(lastNotifiedId, "UTF-8"));
            urlBuilder.append("&wait=").append(waitForNew ? "true" : "false");
            urlBuilder.append("&t=").append(System.currentTimeMillis());

            URL url = new URL(urlBuilder.toString());
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(waitForNew ? 22000 : 8000);
            conn.setRequestProperty("Accept", "application/json");

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();

                JSONObject json = new JSONObject(response.toString());
                boolean hasNew = json.optBoolean("hasNew", false);
                if (hasNew && json.has("message")) {
                    JSONObject msg = json.getJSONObject("message");
                    String msgId = msg.optString("id", "");
                    String senderDeviceId = msg.optString("deviceId", "");
                    String senderName = msg.optString("userName", "Ribič");
                    String text = msg.optString("text", "");

                    // Provjeri da poruka nije od ovog istog uređaja i da nije već prikazana
                    if (!msgId.isEmpty() && !msgId.equals(lastNotifiedId) && !senderDeviceId.equalsIgnoreCase(myDeviceId)) {
                        prefs.edit().putString(KEY_LAST_NOTIFIED_ID, msgId).apply();
                        ChatNotificationHelper.showNotification(context, senderName, text, msgId);
                    }
                }
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.d(TAG, "Poll provjera: " + e.getMessage());
        }
    }
}
