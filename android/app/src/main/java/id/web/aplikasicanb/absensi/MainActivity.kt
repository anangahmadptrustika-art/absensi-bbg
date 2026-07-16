package id.web.aplikasicanb.absensi

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast

/**
 * Pembungkus aplikasi web Absensi BBG.
 * Halaman web memanggil window.AbsensiNative.startTracking()/stopTracking()
 * saat karyawan absen masuk/pulang; pelacakan lalu dikerjakan TrackingService
 * (tetap berjalan meski layar mati atau aplikasi ditutup).
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private var pendingWebPermission: PermissionRequest? = null
    private var batteryDialogShown = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            setGeolocationEnabled(true)
        }

        val appHost = Uri.parse(BuildConfig.BASE_URL).host

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest
            ): Boolean {
                // tautan keluar (mis. OpenStreetMap) dibuka di browser biasa
                return if (request.url.host == appHost) {
                    false
                } else {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, request.url))
                    } catch (_: Exception) {
                    }
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                callback.invoke(origin, hasPermission(Manifest.permission.ACCESS_FINE_LOCATION), false)
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (hasPermission(Manifest.permission.CAMERA)) {
                        request.grant(request.resources)
                    } else {
                        pendingWebPermission = request
                        requestPermissions(arrayOf(Manifest.permission.CAMERA), REQ_CAMERA)
                    }
                }
            }
        }

        webView.addJavascriptInterface(NativeBridge(), "AbsensiNative")

        askInitialPermissions()
        webView.loadUrl(BuildConfig.BASE_URL)
    }

    /** Izin dasar diminta di awal supaya alur absen tidak terputus-putus. */
    private fun askInitialPermissions() {
        val wanted = mutableListOf<String>()
        if (!hasPermission(Manifest.permission.ACCESS_FINE_LOCATION)) {
            wanted += Manifest.permission.ACCESS_FINE_LOCATION
            wanted += Manifest.permission.ACCESS_COARSE_LOCATION
        }
        if (!hasPermission(Manifest.permission.CAMERA)) wanted += Manifest.permission.CAMERA
        if (Build.VERSION.SDK_INT >= 33 && !hasPermission(Manifest.permission.POST_NOTIFICATIONS)) {
            wanted += Manifest.permission.POST_NOTIFICATIONS
        }
        if (wanted.isNotEmpty()) requestPermissions(wanted.toTypedArray(), REQ_INITIAL)
    }

    /**
     * Untuk pelacakan saat layar mati, Android 10+ butuh izin lokasi
     * "Izinkan sepanjang waktu" + pengecualian penghemat baterai.
     */
    private fun ensureBackgroundTrackingAllowed() {
        if (Build.VERSION.SDK_INT >= 29 &&
            !hasPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        ) {
            Toast.makeText(
                this,
                "Pilih \"Izinkan sepanjang waktu\" agar pelacakan tetap jalan saat layar mati.",
                Toast.LENGTH_LONG
            ).show()
            requestPermissions(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), REQ_BACKGROUND)
        }
        if (!batteryDialogShown) {
            batteryDialogShown = true
            val pm = getSystemService(POWER_SERVICE) as PowerManager
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    startActivity(
                        Intent(
                            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            Uri.parse("package:$packageName")
                        )
                    )
                } catch (_: Exception) {
                }
            }
        }
    }

    private fun hasPermission(permission: String): Boolean =
        checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQ_CAMERA) {
            val req = pendingWebPermission
            pendingWebPermission = null
            if (req != null) {
                if (hasPermission(Manifest.permission.CAMERA)) req.grant(req.resources) else req.deny()
            }
        }
    }

    @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun startTracking() {
            runOnUiThread {
                ensureBackgroundTrackingAllowed()
                val intent = Intent(this@MainActivity, TrackingService::class.java)
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(intent) else startService(intent)
            }
        }

        @JavascriptInterface
        fun stopTracking() {
            runOnUiThread {
                stopService(Intent(this@MainActivity, TrackingService::class.java))
            }
        }
    }

    companion object {
        private const val REQ_INITIAL = 1
        private const val REQ_CAMERA = 2
        private const val REQ_BACKGROUND = 3
    }
}
