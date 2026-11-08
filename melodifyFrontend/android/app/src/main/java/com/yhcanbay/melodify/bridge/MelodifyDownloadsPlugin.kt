package com.yhcanbay.melodify.bridge

import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.yhcanbay.melodify.downloads.DownloadState
import com.yhcanbay.melodify.downloads.DownloadEngine
import com.yhcanbay.melodify.downloads.DownloadInput
import com.yhcanbay.melodify.downloads.ProbePlayback
import com.getcapacitor.JSObject
import com.yhcanbay.melodify.downloads.ProcessCancellationProbe
import com.yhcanbay.melodify.BuildConfig
import java.util.concurrent.Executors

@CapacitorPlugin(name = "MelodifyDownloads")
class MelodifyDownloadsPlugin : FoundationPlugin() {
    private val diagnosticWorker = Executors.newSingleThreadExecutor()
    private var unsubscribe: (() -> Unit)? = null

    override fun load() {
        DownloadEngine.attach(context.applicationContext)
        unsubscribe = DownloadEngine.subscribe { notifyListeners("snapshotChanged", JSObject()) }
    }
    override fun snapshot() = DownloadState.snapshot()

    @PluginMethod
    fun search(call: PluginCall) {
        try {
            val query = call.data.opt("query") as? String ?: throw IllegalArgumentException("Arama metni gerekli.")
            val suppliedLimit = call.data.opt("limit")
            val limit = if (suppliedLimit == null) 5 else {
                require(suppliedLimit is Number && suppliedLimit.toDouble().isFinite() && suppliedLimit.toDouble() == suppliedLimit.toInt().toDouble()) { "Sonuç sayısı tam sayı olmalı." }
                suppliedLimit.toInt()
            }
            DownloadEngine.search(DownloadInput.query(query), DownloadInput.limit(limit)).whenComplete { results, failure ->
                if (failure == null) call.resolve(JSObject().apply { put("results", results) })
                else call.reject(failure.cause?.message ?: failure.message ?: "Arama tamamlanamadı.", "SEARCH_FAILED")
            }
        } catch (failure: Exception) {
            call.reject(failure.message ?: "Arama başlatılamadı.", "INVALID_ARGUMENT")
        }
    }

    @PluginMethod
    fun enqueue(call: PluginCall) {
        try {
            val source = call.data.opt("sourceUrl") as? String ?: throw IllegalArgumentException("Kaynak bağlantısı gerekli.")
            val target = call.data.opt("targetFolderId") as? String ?: throw IllegalArgumentException("Hedef klasör gerekli.")
            val id = DownloadEngine.enqueue(source, target)
            call.resolve(JSObject().apply { put("jobId", id) })
        } catch (failure: Exception) { call.reject(failure.message ?: "İndirme başlatılamadı.", "DOWNLOAD_REJECTED") }
    }

    @PluginMethod
    fun cancel(call: PluginCall) {
        try {
            val id = call.data.opt("jobId") as? String ?: throw IllegalArgumentException("İş kimliği gerekli.")
            DownloadEngine.cancel(id)
            call.resolve()
        } catch (failure: Exception) { call.reject(failure.message ?: "İndirme iptal edilemedi.", "CANCEL_FAILED") }
    }

    @PluginMethod
    fun cancelSearch(call: PluginCall) { DownloadEngine.cancelSearch(); call.resolve() }

    @PluginMethod
    fun playProbe(call: PluginCall) {
        try {
            val id = call.data.opt("jobId") as? String ?: throw IllegalArgumentException("İş kimliği gerekli.")
            ProbePlayback.play(context.applicationContext, id)
            call.resolve()
        } catch (failure: Exception) { call.reject(failure.message ?: "Dosya açılamadı.", "PLAYBACK_FAILED") }
    }

    @PluginMethod
    fun pauseProbe(call: PluginCall) { ProbePlayback.pause(); call.resolve() }

    @PluginMethod
    fun enqueueCancellationProbe(call: PluginCall) {
        if (!BuildConfig.DEBUG) { call.reject("Bu kontrol yalnızca geliştirme sürümünde kullanılabilir.", "DEBUG_ONLY"); return }
        try {
            val phase = call.data.opt("phase") as? String
            require(phase in setOf("downloading", "converting")) { "Geçersiz deneme aşaması." }
            val target = call.data.opt("targetFolderId") as? String ?: throw IllegalArgumentException("Hedef klasör gerekli.")
            val source = "https://www.youtube.com/watch?v=DTi8wZ1a1TA"
            val id = DownloadEngine.enqueue(source, target, phase == "converting")
            call.resolve(JSObject().apply { put("jobId", id) })
        } catch (failure: Exception) { call.reject(failure.message ?: "İptal denemesi başlatılamadı.", "PROBE_FAILED") }
    }

    @PluginMethod
    fun retry(call: PluginCall) = notReady(call)

    @PluginMethod
    fun verifyCancellation(call: PluginCall) {
        if (!BuildConfig.DEBUG) {
            call.reject("Bu kontrol yalnızca geliştirme sürümünde kullanılabilir.", "DEBUG_ONLY")
            return
        }
        if (DownloadEngine.busy()) { call.reject("Önce çalışan işlemi tamamlayın veya iptal edin.", "ENGINE_BUSY"); return }
        diagnosticWorker.execute {
            try {
                call.resolve(ProcessCancellationProbe.verify(context.applicationContext))
            } catch (failure: Exception) {
                val reason = failure.cause?.message ?: failure.message ?: failure.javaClass.simpleName
                call.reject("Alt süreç iptali doğrulanamadı: $reason", "CANCELLATION_CHECK_FAILED")
            }
        }
    }

    override fun handleOnPause() { DownloadEngine.cancelActive(); ProbePlayback.pause() }

    override fun handleOnDestroy() { unsubscribe?.invoke(); diagnosticWorker.shutdown() }
}
