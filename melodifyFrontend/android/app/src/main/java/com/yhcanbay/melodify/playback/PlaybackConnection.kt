package com.yhcanbay.melodify.playback

import android.content.ComponentName
import android.content.Context
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import java.util.concurrent.CompletableFuture

@UnstableApi
object PlaybackConnection {
    private val handler = Handler(Looper.getMainLooper())
    private var controller: ListenableFuture<MediaController>? = null

    fun connect(context: Context): CompletableFuture<Unit> {
        val result = CompletableFuture<Unit>()
        handler.post {
            val future = controller ?: MediaController.Builder(context.applicationContext,
                SessionToken(context, ComponentName(context, PlaybackService::class.java))).buildAsync().also { controller = it }
            future.addListener({
                try { future.get(); check(PlaybackState.engine != null) { "Oynatıcı servisine bağlanılamadı." }; result.complete(Unit) }
                catch (failure: Exception) { if (controller === future) controller = null; result.completeExceptionally(failure) }
            }, ContextCompat.getMainExecutor(context))
        }
        return result
    }

    fun disconnect() { handler.post { controller?.let(MediaController::releaseFuture); controller = null } }

    fun debugSessionCommand(context: Context, command: String): CompletableFuture<Unit> = connect(context).thenCompose {
        val result = CompletableFuture<Unit>()
        handler.post {
            try {
                val current = requireNotNull(controller).get()
                when (command) {
                    "play" -> current.play()
                    "pause" -> current.pause()
                    "next" -> current.seekToNextMediaItem()
                    "previous" -> current.seekToPrevious()
                    else -> error("Komut geçersiz.")
                }
                result.complete(Unit)
            } catch (failure: Exception) { result.completeExceptionally(failure) }
        }
        result
    }
}
