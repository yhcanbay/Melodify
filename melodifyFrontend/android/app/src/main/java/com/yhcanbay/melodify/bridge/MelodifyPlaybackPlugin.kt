package com.yhcanbay.melodify.bridge

import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.yhcanbay.melodify.playback.PlaybackState
import com.yhcanbay.melodify.playback.PlaybackConnection
import com.yhcanbay.melodify.playback.PlaybackCommand
import com.getcapacitor.JSObject
import androidx.media3.common.util.UnstableApi
import com.yhcanbay.melodify.BuildConfig

@UnstableApi
@CapacitorPlugin(name = "MelodifyPlayback")
class MelodifyPlaybackPlugin : FoundationPlugin() {
    private var unsubscribe: (() -> Unit)? = null

    override fun load() {
        unsubscribe = PlaybackState.subscribe { notifyListeners("snapshotChanged", JSObject(), true) }
        PlaybackConnection.connect(context).exceptionally {
            PlaybackState.connectionFailed("Oynatıcı servisine bağlanılamadı. Uygulamayı yeniden aç veya bir parçayı tekrar seç.")
            Unit
        }
    }

    override fun snapshot() = PlaybackState.snapshot()

    @PluginMethod
    fun dispatch(call: PluginCall) {
        val command = try { PlaybackCommand.parse(call.data) }
        catch (failure: Exception) { call.reject(failure.message ?: "Komut geçersiz.", "INVALID_ARGUMENT"); return }
        PlaybackConnection.connect(context).thenCompose {
            requireNotNull(PlaybackState.engine).dispatch(command)
        }.whenComplete { _, failure ->
            if (failure == null) call.resolve()
            else call.reject(failure.cause?.message ?: failure.message ?: "Oynatıcı komutu uygulanamadı.", "PLAYBACK_FAILED")
        }
    }

    override fun handleOnDestroy() { unsubscribe?.invoke(); PlaybackConnection.disconnect() }

    @PluginMethod
    fun debugSessionCommand(call: PluginCall) {
        if (!BuildConfig.DEBUG) { call.reject("Yalnız geliştirme sürümünde kullanılabilir.", "NOT_AVAILABLE"); return }
        val command = call.data.opt("command") as? String
        if (command !in setOf("play", "pause", "next", "previous")) { call.reject("Komut geçersiz.", "INVALID_ARGUMENT"); return }
        PlaybackConnection.debugSessionCommand(context, command!!).whenComplete { _, failure ->
            if (failure == null) call.resolve()
            else call.reject(failure.message ?: "Medya oturumu komutu başarısız.", "PLAYBACK_FAILED")
        }
    }

    @PluginMethod
    fun debugStartBackgroundProbe(call: PluginCall) {
        if (!BuildConfig.DEBUG) { call.reject("Yalnız geliştirme sürümünde kullanılabilir.", "NOT_AVAILABLE"); return }
        val duration = call.data.opt("durationMs") as? Number
        if (duration == null || duration.toDouble() != duration.toLong().toDouble() || duration.toLong() !in 30000..1900000) {
            call.reject("Deneme süresi geçersiz.", "INVALID_ARGUMENT"); return
        }
        val engine = PlaybackState.engine
        if (engine == null) { call.reject("Önce bir parça seç.", "PLAYBACK_FAILED"); return }
        engine.startBackgroundProbe(duration.toLong()).whenComplete { report, failure ->
            if (failure == null) call.resolve(report)
            else call.reject(failure.message ?: "Deneme başlatılamadı.", "PLAYBACK_FAILED")
        }
    }
}
