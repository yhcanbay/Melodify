package com.yhcanbay.melodify.playback

import org.json.JSONObject

data class PlaybackCommand(
    val type: String, val ids: List<String> = emptyList(), val trackId: String? = null,
    val positionMs: Long = 0, val mode: String? = null, val enabled: Boolean = false, val volume: Float = 1f,
) {
    companion object {
        private val uuid = Regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")
        fun parse(json: JSONObject): PlaybackCommand {
            val type = json.opt("type") as? String ?: error("Oynatıcı komutu gerekli.")
            return when (type) {
                "loadQueue" -> {
                    val tracks = json.optJSONArray("tracks") ?: error("Kuyruk gerekli.")
                    require(tracks.length() in 1..10000) { "Kuyruk 1–10000 parça içermeli." }
                    val ids = (0 until tracks.length()).map { tracks.getJSONObject(it).getString("id") }
                    require(ids.all(uuid::matches) && ids.distinct().size == ids.size) { "Parça kimlikleri geçersiz." }
                    val start = json.opt("startTrackId") as? String
                    require(start != null && start in ids) { "Başlangıç parçası kuyrukta olmalı." }
                    PlaybackCommand(type, ids, start)
                }
                "selectTrack" -> {
                    val id = json.opt("trackId") as? String
                    require(id != null && uuid.matches(id)) { "Parça kimliği geçersiz." }
                    PlaybackCommand(type, trackId = id)
                }
                "reorder" -> {
                    val values = json.optJSONArray("trackIds") ?: error("Parça sırası gerekli.")
                    require(values.length() in 1..10000)
                    val ids = (0 until values.length()).map { values.getString(it) }
                    require(ids.all(uuid::matches)) { "Parça kimlikleri geçersiz." }
                    PlaybackCommand(type, ids)
                }
                "seek" -> {
                    val value = json.opt("positionMs") as? Number ?: error("Konum gerekli.")
                    val position = value.toDouble()
                    require(position.isFinite() && position >= 0 && position <= Int.MAX_VALUE && position % 1 == 0.0) { "Konum geçersiz." }
                    PlaybackCommand(type, positionMs = value.toLong())
                }
                "setVolume" -> {
                    val volume = (json.opt("volume") as? Number)?.toDouble() ?: error("Ses düzeyi gerekli.")
                    require(volume.isFinite() && volume in 0.0..1.0) { "Ses düzeyi geçersiz." }
                    PlaybackCommand(type, volume = volume.toFloat())
                }
                "setRepeat" -> {
                    val mode = json.opt("mode") as? String
                    require(mode in setOf("off", "once", "one")) { "Tekrar modu geçersiz." }
                    PlaybackCommand(type, mode = mode)
                }
                "setShuffle" -> PlaybackCommand(type, enabled = json.opt("enabled") as? Boolean ?: error("Karıştırma tercihi gerekli."))
                "play", "pause", "previous", "next" -> PlaybackCommand(type)
                else -> error("Bilinmeyen oynatıcı komutu.")
            }
        }
    }
}
