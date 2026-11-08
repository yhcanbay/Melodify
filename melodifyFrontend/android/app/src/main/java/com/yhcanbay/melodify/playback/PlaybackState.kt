package com.yhcanbay.melodify.playback

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import java.util.concurrent.CopyOnWriteArraySet
import org.json.JSONObject

object PlaybackState {
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    @Volatile private var cached = initial().toString()
    @Volatile var engine: NativePlayback? = null

    fun snapshot() = JSObject(cached)

    fun publish(snapshot: JSObject) { cached = snapshot.toString(); listeners.forEach { it() } }

    fun connectionFailed(message: String) { publish(snapshot().apply { put("restoring", false); put("error", message) }) }

    fun subscribe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }

    private fun initial(): JSObject = JSObject().apply {
        put("availability", JSObject().apply { put("state", "available"); put("message", "Native oynatıcı hazırlanıyor.") })
        put("queue", JSArray())
        put("currentTrackId", JSONObject.NULL)
        put("isPlaying", false)
        put("positionMs", 0)
        put("durationMs", 0)
        put("repeat", "off")
        put("shuffle", false)
        put("volume", 1.0)
        put("error", JSONObject.NULL)
        put("restoring", true)
        put("repeatPass", 0)
    }
}
