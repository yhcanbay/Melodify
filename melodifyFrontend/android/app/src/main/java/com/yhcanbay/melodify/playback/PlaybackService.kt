package com.yhcanbay.melodify.playback

import android.app.PendingIntent
import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.yhcanbay.melodify.MainActivity

@UnstableApi
class PlaybackService : MediaSessionService() {
    private var session: MediaSession? = null
    private lateinit var engine: NativePlayback

    override fun onCreate() {
        super.onCreate()
        val player = ExoPlayer.Builder(this).build().apply {
            setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true)
            setHandleAudioBecomingNoisy(true)
            setWakeMode(C.WAKE_MODE_LOCAL)
        }
        engine = NativePlayback(applicationContext, player)
        PlaybackState.engine = engine
        val activity = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        session = MediaSession.Builder(this, SessionPlayer(player, engine)).setSessionActivity(activity).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? {
        val trusted = controllerInfo.packageName == packageName || controllerInfo.isTrusted ||
            session?.isMediaNotificationController(controllerInfo) == true
        return if (trusted) session else null
    }

    override fun onDestroy() {
        engine.close()
        if (PlaybackState.engine === engine) PlaybackState.engine = null
        session?.run { player.release(); release() }
        session = null
        super.onDestroy()
    }
}
