package com.yhcanbay.melodify.playback

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.yhcanbay.melodify.data.MelodifyDatabase
import com.yhcanbay.melodify.data.PlaybackRecoveryEntity
import com.yhcanbay.melodify.data.TrackEntity
import com.yhcanbay.melodify.BuildConfig
import com.yhcanbay.melodify.downloads.ProbePlayback
import com.yhcanbay.melodify.library.LibraryScanner
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.UUID
import org.json.JSONObject

@UnstableApi
class NativePlayback(private val context: Context, private val player: ExoPlayer) {
    private val handler = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private var queue = emptyList<TrackEntity>()
    private var repeat = "off"
    private var shuffled = false
    private var restoring = true
    private var error: String? = null
    private var lastPersist = 0L
    private var backgroundProbe: String? = null
    private var probeTransitions = 0
    private var lastProbeLog = 0L
    private var probeStop: Runnable? = null
    @Volatile private var closed = false

    private val listener = object : Player.Listener {
        override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
            if (backgroundProbe != null) { probeTransitions++; logProbe("transition") }
        }
        override fun onEvents(player: Player, events: Player.Events) { publish(persist = !restoring) }
        override fun onPlayerError(failure: PlaybackException) {
            error = when (failure.errorCode) {
                PlaybackException.ERROR_CODE_IO_NO_PERMISSION -> "Parçaya erişim izni kayboldu. Kitaplık klasörünü yeniden seç."
                PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND -> "Ses dosyası bulunamadı. Kitaplığı yeniden tara."
                else -> "Parça çalınamadı: ${failure.errorCodeName}"
            }
            publish()
        }
    }
    private val tick = object : Runnable {
        override fun run() {
            if (closed) return
            publish(persist = player.isPlaying && android.os.SystemClock.elapsedRealtime() - lastPersist >= 2000)
            if (backgroundProbe != null && android.os.SystemClock.elapsedRealtime() - lastProbeLog >= 2000) logProbe("tick")
            handler.postDelayed(this, 500)
        }
    }

    init {
        player.addListener(listener)
        publish(persist = false)
        worker.execute {
            try {
                val dao = MelodifyDatabase.get(context).melodify()
                val record = dao.playbackRecovery("current")
                val saved = record?.let { JSONObject(it.payload) }?.takeIf { it.optString("kind") == "media3" }
                val tracks = saved?.optJSONArray("trackIds")?.let { ids ->
                    (0 until ids.length()).mapNotNull { dao.track(ids.getString(it)) }
                } ?: emptyList()
                handler.post {
                    if (closed) return@post
                    if (saved != null && tracks.isNotEmpty()) {
                        queue = tracks
                        repeat = saved.optString("repeat").takeIf { it in setOf("off", "once", "one") } ?: "off"
                        shuffled = saved.optBoolean("shuffle", false)
                        player.volume = saved.optDouble("volume", 1.0).toFloat().coerceIn(0f, 1f)
                        val index = tracks.indexOfFirst { it.id == saved.optString("currentTrackId") }.coerceAtLeast(0)
                        rebuild(index, saved.optLong("positionMs", 0).coerceAtLeast(0), false, saved.optInt("oncePass", 0))
                    }
                    restoring = false
                    publish(persist = false)
                }
            } catch (failure: Exception) { handler.post { restoring = false; error = "Oynatıcı kaydı okunamadı: ${failure.message}"; publish(persist = false) } }
        }
        handler.post(tick)
    }

    fun dispatch(command: PlaybackCommand): CompletableFuture<Unit> {
        val result = CompletableFuture<Unit>()
        if (closed) { result.completeExceptionally(IllegalStateException("Oynatıcı kapandı.")); return result }
        worker.execute {
            try {
                val dao = MelodifyDatabase.get(context).melodify()
                val selected = if (command.type == "loadQueue") command.ids.map { id ->
                    val track = dao.track(id) ?: kotlin.error("Parça kitaplıkta bulunamadı.")
                    require(!track.missing) { "Kuyrukta bulunamayan dosya var. Kitaplığı yeniden tara." }
                    val library = dao.library(track.libraryId) ?: kotlin.error("Kitaplık kaydı bulunamadı.")
                    require(LibraryScanner(context).access(library) == "granted") { "Kitaplığa erişilemiyor. Klasörü yeniden seç." }
                    track
                } else null
                val orderedLibrary = if (command.type == "setShuffle" && !command.enabled) {
                    dao.selectedLibrary()?.let { library ->
                        if (LibraryScanner(context).access(library) == "granted") dao.tracks(library.id).filter { !it.missing } else null
                    }
                } else null
                handler.post {
                    try {
                        check(!closed) { "Oynatıcı kapandı." }
                        apply(command, selected, orderedLibrary)
                        result.complete(Unit)
                    } catch (failure: Exception) { result.completeExceptionally(failure) }
                }
            } catch (failure: Exception) { result.completeExceptionally(failure) }
        }
        return result
    }

    private fun apply(command: PlaybackCommand, selected: List<TrackEntity>?, orderedLibrary: List<TrackEntity>?) {
        when (command.type) {
            "loadQueue" -> {
                ProbePlayback.pause()
                queue = requireNotNull(selected)
                shuffled = false
                error = null
                rebuild(queue.indexOfFirst { it.id == command.trackId }, 0, true)
            }
            "play" -> {
                check(queue.isNotEmpty()) { "Önce bir parça seç." }
                ProbePlayback.pause()
                error = null
                if (player.playbackState == Player.STATE_ENDED) player.seekTo(0)
                if (player.playbackState == Player.STATE_IDLE) player.prepare()
                player.play()
            }
            "pause" -> player.pause()
            "next" -> next()
            "previous" -> previous()
            "seek" -> player.seekTo(command.positionMs.coerceAtMost(duration().takeIf { it > 0 } ?: command.positionMs))
            "selectTrack" -> {
                val index = queue.indexOfFirst { it.id == command.trackId }
                require(index >= 0) { "Parça kuyrukta bulunamadı." }
                seekLogical(index, 0, true)
            }
            "setRepeat" -> {
                val index = currentIndex()
                val position = player.currentPosition.coerceAtLeast(0)
                repeat = requireNotNull(command.mode)
                rebuild(index, position, player.playWhenReady)
            }
            "setVolume" -> player.volume = command.volume
            "reorder" -> {
                QueueRules.validateOrder(queue.map { it.id }, command.ids)
                val current = currentTrack()?.id
                val position = player.currentPosition.coerceAtLeast(0)
                val pass = oncePass()
                queue = command.ids.map { id -> queue.first { it.id == id } }
                rebuild(queue.indexOfFirst { it.id == current }.coerceAtLeast(0), position, player.playWhenReady, pass)
            }
            "setShuffle" -> {
                val current = currentTrack()
                val position = player.currentPosition.coerceAtLeast(0)
                val pass = oncePass()
                queue = if (command.enabled) {
                    if (current == null) queue.shuffled() else listOf(current) + queue.filter { it.id != current.id }.shuffled()
                } else {
                    require(!orderedLibrary.isNullOrEmpty()) { "Sıralanabilecek erişilebilir kitaplık bulunamadı." }
                    orderedLibrary
                }
                shuffled = command.enabled
                val index = queue.indexOfFirst { it.id == current?.id }
                // A different selected library can replace the queue only through this explicit command.
                rebuild(index.coerceAtLeast(0), if (index >= 0) position else 0, player.playWhenReady, if (index >= 0) pass else 0)
            }
        }
        publish()
    }

    fun next() { if (queue.isNotEmpty()) seekLogical(QueueRules.manualNext(currentIndex(), queue.size), 0, player.playWhenReady) }

    fun pauseForProbe() { player.pause(); publish() }

    fun startBackgroundProbe(durationMs: Long): CompletableFuture<JSObject> {
        val result = CompletableFuture<JSObject>()
        handler.post {
            try {
                check(BuildConfig.DEBUG && !closed && queue.isNotEmpty()) { "Deneme için önce bir parça seç." }
                require(durationMs in 30000..1900000) { "Deneme süresi geçersiz." }
                probeStop?.let(handler::removeCallbacks)
                val id = UUID.randomUUID().toString()
                val index = currentIndex()
                backgroundProbe = id
                probeTransitions = 0
                repeat = "one"
                ProbePlayback.pause()
                rebuild(index, 0, true)
                logProbe("start")
                val stop = Runnable {
                    if (backgroundProbe == id) {
                        player.pause()
                        logProbe("stopped")
                        backgroundProbe = null
                        repeat = "off"
                        player.repeatMode = Player.REPEAT_MODE_OFF
                        publish()
                    }
                }
                probeStop = stop
                handler.postDelayed(stop, durationMs)
                result.complete(JSObject().apply { put("probeId", id); put("durationMs", durationMs) })
            } catch (failure: Exception) { result.completeExceptionally(failure) }
        }
        return result
    }

    private fun logProbe(phase: String) {
        if (!BuildConfig.DEBUG) return
        lastProbeLog = android.os.SystemClock.elapsedRealtime()
        Log.i("MelodifyPlayback", JSONObject().apply {
            put("probeId", backgroundProbe ?: JSONObject.NULL); put("phase", phase)
            put("elapsedMs", lastProbeLog); put("interactive", context.getSystemService(PowerManager::class.java).isInteractive)
            put("isPlaying", player.isPlaying); put("positionMs", player.currentPosition.coerceAtLeast(0))
            put("transitions", probeTransitions); put("trackId", currentTrack()?.id ?: JSONObject.NULL)
        }.toString())
    }

    fun previous() { if (queue.isNotEmpty()) seekLogical(QueueRules.manualPrevious(currentIndex(), queue.size, player.currentPosition), 0, player.playWhenReady) }

    fun selectPhysical(index: Int, position: Long) {
        if (index >= 0 && queue.isNotEmpty()) seekLogical(QueueRules.logicalIndex(index, repeat).coerceIn(queue.indices), position.coerceAtLeast(0), player.playWhenReady)
    }

    private fun seekLogical(index: Int, position: Long, play: Boolean) {
        error = null
        player.seekTo(QueueRules.physicalIndex(index, repeat), position)
        if (player.playbackState == Player.STATE_IDLE) player.prepare()
        player.playWhenReady = play
        publish()
    }

    private fun rebuild(index: Int, position: Long, play: Boolean, pass: Int = 0) {
        player.repeatMode = if (repeat == "one") Player.REPEAT_MODE_ONE else Player.REPEAT_MODE_OFF
        player.shuffleModeEnabled = false
        if (queue.isEmpty()) { player.clearMediaItems(); return }
        val byId = queue.associateBy { it.id }
        val items = QueueRules.physicalOrder(queue.map { it.id }, repeat).map { mediaItem(byId.getValue(it)) }
        player.setMediaItems(items, QueueRules.physicalIndex(index.coerceIn(queue.indices), repeat, pass), position)
        player.prepare()
        player.playWhenReady = play
    }

    private fun mediaItem(track: TrackEntity): MediaItem = MediaItem.Builder().setMediaId(track.id).setUri(track.contentUri)
        .setMediaMetadata(MediaMetadata.Builder().setTitle(track.title).setArtist(track.artist ?: "Bilinmeyen sanatçı")
            .setArtworkUri(Uri.parse("content://${context.packageName}.covers/track/${track.id}"))
            .setIsPlayable(true).setMediaType(MediaMetadata.MEDIA_TYPE_MUSIC).build()).build()

    private fun currentIndex() = QueueRules.logicalIndex(player.currentMediaItemIndex.coerceAtLeast(0), repeat).coerceAtMost((queue.size - 1).coerceAtLeast(0))
    private fun currentTrack() = queue.getOrNull(currentIndex())
    private fun oncePass() = if (repeat == "once") player.currentMediaItemIndex.coerceAtLeast(0) % 2 else 0
    private fun duration() = player.duration.takeIf { it != C.TIME_UNSET && it >= 0 } ?: 0

    private fun publish(persist: Boolean = true) {
        if (closed) return
        val state = JSObject().apply {
            put("availability", JSObject().apply { put("state", "available"); put("message", "Android medya oynatıcısı") })
            put("queue", JSArray().apply { queue.forEach { put(trackJson(it)) } })
            put("currentTrackId", currentTrack()?.id ?: JSONObject.NULL)
            put("isPlaying", player.isPlaying)
            put("positionMs", player.currentPosition.coerceAtLeast(0))
            put("durationMs", duration())
            put("repeat", repeat); put("shuffle", shuffled); put("volume", player.volume)
            put("error", error ?: JSONObject.NULL); put("restoring", restoring)
            put("repeatPass", oncePass())
        }
        PlaybackState.publish(state)
        if (persist && !restoring) {
            lastPersist = android.os.SystemClock.elapsedRealtime()
            val recovery = JSONObject().apply {
                put("kind", "media3"); put("trackIds", JSArray(queue.map { it.id }))
                put("currentTrackId", currentTrack()?.id ?: JSONObject.NULL)
                put("positionMs", player.currentPosition.coerceAtLeast(0)); put("repeat", repeat)
                put("shuffle", shuffled); put("volume", player.volume); put("oncePass", oncePass())
            }.toString()
            worker.execute {
                try { MelodifyDatabase.get(context).melodify().savePlaybackRecovery(PlaybackRecoveryEntity(payload = recovery, updatedAt = System.currentTimeMillis())) }
                catch (failure: Exception) { handler.post { error = "Oynatıcı kaydı yazılamadı: ${failure.message}"; publish(persist = false) } }
            }
        }
    }

    fun close() {
        player.pause()
        publish()
        closed = true
        handler.removeCallbacks(tick)
        probeStop?.let(handler::removeCallbacks)
        player.removeListener(listener)
        worker.shutdown()
    }

    private fun trackJson(track: TrackEntity) = JSObject().apply {
        put("id", track.id); put("libraryId", track.libraryId); put("contentUri", track.contentUri)
        put("fileName", track.fileName); put("relativePath", track.relativePath); put("title", track.title)
        put("artist", track.artist ?: JSONObject.NULL); put("durationMs", track.durationMs ?: JSONObject.NULL)
        put("youtubeId", track.youtubeId ?: JSONObject.NULL); put("access", if (track.missing) "missing" else "available")
        put("modifiedTimeMs", track.modifiedTimeMs); put("sizeBytes", track.sizeBytes)
    }
}
