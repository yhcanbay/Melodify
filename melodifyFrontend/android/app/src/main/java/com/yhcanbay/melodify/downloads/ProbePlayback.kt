package com.yhcanbay.melodify.downloads

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import org.json.JSONObject

// Foreground-only offline proof; Media3/session/background playback is step 3.
object ProbePlayback {
    private val handler = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null
    private var requestedPlayback = false
    private val lock = Any()
    private var jobId: String? = null
    private var playing = false
    private var positionMs = 0
    private var durationMs = 0
    private var error: String? = null

    fun restore(saved: JSObject) {
        if (saved.getString("kind") != "probe") return
        handler.post {
            synchronized(lock) {
                jobId = if (saved.isNull("jobId")) null else saved.getString("jobId")
                positionMs = saved.optInt("positionMs", 0).coerceAtLeast(0)
                durationMs = saved.optInt("durationMs", 0).coerceAtLeast(0)
                playing = false
                error = null
            }
            DownloadEngine.signal(persist = false)
        }
    }

    fun snapshot(): JSObject = synchronized(lock) {
        JSObject().apply {
            put("jobId", jobId ?: JSONObject.NULL)
            put("isPlaying", playing)
            put("positionMs", positionMs)
            put("durationMs", durationMs)
            put("error", error ?: JSONObject.NULL)
        }
    }

    fun play(context: Context, id: String) {
        val uri = Uri.parse(DownloadEngine.output(id))
        handler.post {
            com.yhcanbay.melodify.playback.PlaybackState.engine?.pauseForProbe()
            player?.release()
            requestedPlayback = true
            val resumeAt = synchronized(lock) { if (jobId == id && positionMs < durationMs) positionMs else 0 }
            synchronized(lock) { jobId = id; playing = false; positionMs = resumeAt; durationMs = 0; error = null }
            val next = MediaPlayer()
            player = next
            try {
                next.setAudioAttributes(AudioAttributes.Builder().setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).setUsage(AudioAttributes.USAGE_MEDIA).build())
                next.setDataSource(context, uri)
                next.setOnPreparedListener {
                    if (player !== next || !requestedPlayback) return@setOnPreparedListener
                    if (resumeAt > 0) next.seekTo(resumeAt.coerceAtMost(next.duration))
                    next.start()
                    synchronized(lock) { playing = true; durationMs = next.duration }
                    DownloadEngine.signal()
                    tick(next)
                }
                next.setOnCompletionListener {
                    requestedPlayback = false
                    synchronized(lock) { playing = false; positionMs = durationMs }
                    DownloadEngine.signal()
                }
                next.setOnErrorListener { _, what, extra ->
                    requestedPlayback = false
                    synchronized(lock) { playing = false; error = "Android dosyayı oynatamadı ($what/$extra)." }
                    DownloadEngine.signal()
                    true
                }
                next.prepareAsync()
            } catch (failure: Exception) {
                next.release()
                player = null
                requestedPlayback = false
                synchronized(lock) { playing = false; error = failure.message ?: "Dosya oynatılamadı." }
                DownloadEngine.signal()
            }
        }
    }

    fun pause() {
        handler.post {
            requestedPlayback = false
            val current = player
            if (synchronized(lock) { playing }) current?.pause()
            synchronized(lock) { playing = false }
            DownloadEngine.signal()
        }
    }

    private fun tick(current: MediaPlayer) {
        if (player !== current || !synchronized(lock) { playing }) return
        synchronized(lock) { positionMs = current.currentPosition }
        DownloadEngine.signal()
        handler.postDelayed({ tick(current) }, 500)
    }
}
