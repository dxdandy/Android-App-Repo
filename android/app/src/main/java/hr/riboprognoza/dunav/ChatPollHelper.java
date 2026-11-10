package hr.riboprognoza.dunav;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.PowerManager;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Pomoćna klasa za direktnu provjeru novih poruka u Google Cloud Firestore bazi
 * Radi 100% u pozadini i kada je aplikacija potpuno ugašena.
 */
public class ChatPollHelper {
    private static final String TAG = "ChatPollHelper";
    public static final String PREFS_NAME = "RiboChatPrefs";
    public static final String KEY_DEVICE_ID = "device_id";
    public static final String KEY_LAST_NOTIFIED_ID = "last_notified_id";
    public static final String KEY_LAST_NOTIFIED_TIME = "last_notified_time";
    public static final String KEY_IN_CHAT = "in_chat";

    // Izravni Google Cloud Firestore REST API endpoint za kolekciju chat_messages
    private static final String FIRESTORE_QUERY_URL = 
        "https://firestore.googleapis.com/v1/projects/titanium-domain-wv4kj/databases/ai-studio-hrvatskiradnipro-badf4099-cdd8-4a4a-b90c-6a3aea6c7b94/documents:runQuery?key=AIzaSyBi1UlCC2YRgTGweaLuu52YE1F5xZGG5ho";

    // Strukturirani Firestore upit: dohvati zadnju (1) najnoviju poruku poredanu silazno po createdAt
    private static final String QUERY_PAYLOAD = 
        "{\"structuredQuery\":{\"from\":[{\"collectionId\":\"chat_messages\"}],\"orderBy\":[{\"field\":{\"fieldPath\":\"createdAt\"},\"direction\":\"DESCENDING\"}],\"limit\":1}}";

    public static synchronized void checkAndNotify(Context context) {
        if (context == null) return;

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String myDeviceId = prefs.getString(KEY_DEVICE_ID, "");
            String lastNotifiedId = prefs.getString(KEY_LAST_NOTIFIED_ID, "");
            long lastNotifiedTime = prefs.getLong(KEY_LAST_NOTIFIED_TIME, 0);
            boolean inChat = prefs.getBoolean(KEY_IN_CHAT, false);

            URL url = new URL(FIRESTORE_QUERY_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setConnectTimeout(6500);
            conn.setReadTimeout(6500);
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
            conn.setRequestProperty("Accept", "application/json");

            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = QUERY_PAYLOAD.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = conn.getResponseCode();
            if (responseCode == 200) {
                BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder response = new StringBuilder();
                String inputLine;
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();

                JSONArray results = new JSONArray(response.toString());
                if (results.length() > 0) {
                    JSONObject item = results.getJSONObject(0);
                    if (item.has("document")) {
                        JSONObject doc = item.getJSONObject("document");
                        JSONObject fields = doc.getJSONObject("fields");

                        String msgId = fields.has("id") ? fields.getJSONObject("id").optString("stringValue", "") : "";
                        String senderDeviceId = fields.has("deviceId") ? fields.getJSONObject("deviceId").optString("stringValue", "") : "";
                        String senderName = fields.has("userName") ? fields.getJSONObject("userName").optString("stringValue", "Ribič") : "Ribič";
                        String text = fields.has("text") ? fields.getJSONObject("text").optString("stringValue", "") : "";
                        
                        long createdAt = 0;
                        if (fields.has("createdAt")) {
                            JSONObject cat = fields.getJSONObject("createdAt");
                            createdAt = cat.optLong("integerValue", 0);
                        }

                        if (msgId.isEmpty()) {
                            conn.disconnect();
                            return;
                        }

                        // Ako je korisnik trenutno u otvorenom prozoru chata, samo tiho ažuriraj zadnju viđenu poruku
                        if (inChat) {
                            if (!msgId.equals(lastNotifiedId)) {
                                prefs.edit()
                                    .putString(KEY_LAST_NOTIFIED_ID, msgId)
                                    .putLong(KEY_LAST_NOTIFIED_TIME, createdAt > 0 ? createdAt : System.currentTimeMillis())
                                    .apply();
                            }
                            conn.disconnect();
                            return;
                        }

                        // Ako nikada prije nismo spremili ID zadnje poruke:
                        // Ako je poruka stara više od 90 sekundi, zabilježi je kao početno stanje bez stare obavijesti
                        if (lastNotifiedTime == 0 && lastNotifiedId.isEmpty()) {
                            long ageMs = createdAt > 0 ? Math.abs(System.currentTimeMillis() - createdAt) : 999999L;
                            if (ageMs > 90000L || (!myDeviceId.isEmpty() && senderDeviceId.equalsIgnoreCase(myDeviceId))) {
                                prefs.edit()
                                    .putString(KEY_LAST_NOTIFIED_ID, msgId)
                                    .putLong(KEY_LAST_NOTIFIED_TIME, createdAt > 0 ? createdAt : System.currentTimeMillis())
                                    .apply();
                                conn.disconnect();
                                return;
                            }
                        }

                        // Provjeri je li poruka nova i nije od ovog istog uređaja
                        boolean isNew = !msgId.equals(lastNotifiedId);
                        boolean isFromOther = myDeviceId.isEmpty() || !senderDeviceId.equalsIgnoreCase(myDeviceId);

                        if (isNew && isFromOther) {
                            Log.i(TAG, "Nova poruka pronađena u pozadini od: " + senderName + " (" + msgId + ")");
                            prefs.edit()
                                .putString(KEY_LAST_NOTIFIED_ID, msgId)
                                .putLong(KEY_LAST_NOTIFIED_TIME, createdAt > 0 ? createdAt : System.currentTimeMillis())
                                .apply();

                            // Prikaži glasnu zvučnu, skočnu i Lockscreen obavijest s ikonom udice
                            ChatNotificationHelper.showNotification(context, senderName, text, msgId);
                        } else if (isNew) {
                            // Poruka je od nas samih - samo spremi ID kao zadnju viđenu
                            prefs.edit()
                                .putString(KEY_LAST_NOTIFIED_ID, msgId)
                                .putLong(KEY_LAST_NOTIFIED_TIME, createdAt > 0 ? createdAt : System.currentTimeMillis())
                                .apply();
                        }
                    }
                }
            }
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "Greška pri provjeri Firestore poruka: " + e.getMessage());
        }
    }
}
