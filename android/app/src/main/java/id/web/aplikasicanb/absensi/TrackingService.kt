package id.web.aplikasicanb.absensi

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import android.webkit.CookieManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

/**
 * Layanan pelacakan selama jam kerja (foreground service + notifikasi tetap,
 * transparan bagi karyawan). Mengirim posisi ke /api/employee/ping memakai
 * cookie sesi dari WebView. Berhenti SENDIRI begitu server menjawab
 * tracking=false (sudah absen pulang) atau sesi berakhir — privasi terjaga
 * dari dua sisi.
 */
class TrackingService : Service() {

    private val executor = Executors.newSingleThreadExecutor()
    private var fused: FusedLocationProviderClient? = null
    private var locationCallback: LocationCallback? = null
    @Volatile private var intervalMs: Long = 20_000L

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createChannel()
        ServiceCompat.startForeground(
            this,
            NOTIF_ID,
            buildNotification(),
            if (Build.VERSION.SDK_INT >= 29) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0
        )

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            stopSelf()
            return START_NOT_STICKY
        }

        if (locationCallback != null) return START_STICKY // sudah berjalan

        executor.execute {
            val me = apiGetJson("/api/employee/me")
            if (me == null || me.optString("status") != "BEKERJA") {
                stopSelf()
                return@execute
            }
            val interval = me.optJSONObject("settings")?.optInt("trackingIntervalS", 20) ?: 20
            intervalMs = interval.coerceAtLeast(5) * 1000L
            startLocationUpdates()
        }
        return START_STICKY
    }

    @SuppressLint("MissingPermission")
    private fun startLocationUpdates() {
        if (locationCallback != null) return
        val client = LocationServices.getFusedLocationProviderClient(this)
        fused = client
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .build()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation ?: return
                executor.execute { sendPing(location) }
            }
        }
        locationCallback = callback
        client.requestLocationUpdates(request, callback, Looper.getMainLooper())
    }

    private fun sendPing(location: Location) {
        val body = JSONObject()
            .put("lat", location.latitude)
            .put("lng", location.longitude)
            .put("acc", location.accuracy.toDouble())
        val response = apiPostJson("/api/employee/ping", body) ?: return
        val (code, json) = response
        val trackingStopped = json?.optBoolean("tracking", true) == false
        if (code == 401 || trackingStopped) {
            // absen pulang / sesi berakhir → hentikan total, notifikasi hilang
            stopSelf()
        }
    }

    // ==== HTTP kecil-kecilan dengan cookie sesi dari WebView ====

    private fun sessionCookie(): String? =
        try {
            CookieManager.getInstance().getCookie(BuildConfig.BASE_URL)
        } catch (_: Exception) {
            null
        }

    private fun apiGetJson(path: String): JSONObject? {
        val cookie = sessionCookie() ?: return null
        return try {
            val conn = URL(BuildConfig.BASE_URL + path).openConnection() as HttpURLConnection
            conn.requestMethod = "GET"
            conn.setRequestProperty("Cookie", cookie)
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            val text = conn.inputStream.bufferedReader().readText()
            conn.disconnect()
            JSONObject(text)
        } catch (_: Exception) {
            null
        }
    }

    private fun apiPostJson(path: String, body: JSONObject): Pair<Int, JSONObject?>? {
        val cookie = sessionCookie() ?: return Pair(401, null)
        return try {
            val conn = URL(BuildConfig.BASE_URL + path).openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Cookie", cookie)
            conn.connectTimeout = 15000
            conn.readTimeout = 15000
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
            val code = conn.responseCode
            val stream = if (code < 400) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.readText() ?: ""
            conn.disconnect()
            val json = try {
                JSONObject(text)
            } catch (_: Exception) {
                null
            }
            Pair(code, json)
        } catch (_: Exception) {
            null // jaringan putus — coba lagi di ping berikutnya
        }
    }

    // ==== Notifikasi wajib (transparansi ke karyawan) ====

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Pelacakan jam kerja",
                NotificationManager.IMPORTANCE_LOW
            )
            channel.description = "Aktif hanya antara absen masuk dan absen pulang"
            val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): android.app.Notification {
        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_track)
            .setContentTitle("Sedang bekerja — posisi terpantau")
            .setContentText("Berhenti otomatis saat Anda absen pulang.")
            .setOngoing(true)
            .setContentIntent(openApp)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    override fun onDestroy() {
        locationCallback?.let { fused?.removeLocationUpdates(it) }
        locationCallback = null
        executor.shutdown()
        super.onDestroy()
    }

    companion object {
        private const val CHANNEL_ID = "tracking"
        private const val NOTIF_ID = 1
    }
}
