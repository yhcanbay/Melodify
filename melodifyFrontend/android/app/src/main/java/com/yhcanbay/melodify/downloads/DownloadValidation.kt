package com.yhcanbay.melodify.downloads

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import com.getcapacitor.JSObject
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import org.json.JSONObject

object DownloadValidation {
    fun inspect(context: Context, file: File, work: File, cancellation: ToolCancellation): JSObject {
        val ffprobe = File(context.applicationInfo.nativeLibraryDir, "libffprobe.so")
        val result = ToolProcess.run(
            listOf(ffprobe.absolutePath, "-v", "error", "-show_format", "-show_streams", "-of", "json", file.absolutePath),
            EngineRuntime.environment(context), work, cancellation, 30,
        )
        check(result.exitCode == 0) { "MP3 doğrulanamadı: ${result.error.take(500)}" }
        val info = JSONObject(result.output)
        val streams = info.getJSONArray("streams")
        var mp3 = false
        var jpeg = false
        for (index in 0 until streams.length()) {
            val stream = streams.getJSONObject(index)
            if (stream.optString("codec_type") == "audio" && stream.optString("codec_name") == "mp3") mp3 = true
            if (stream.optString("codec_name") == "mjpeg" && stream.optJSONObject("disposition")?.optInt("attached_pic") == 1) jpeg = true
        }
        val format = info.getJSONObject("format")
        val tags = format.optJSONObject("tags") ?: JSONObject()
        val title = tags.optString("title").trim()
        val duration = format.optString("duration").toDoubleOrNull() ?: 0.0
        check(mp3 && jpeg && title.isNotEmpty() && duration.isFinite() && duration > 0) {
            "Çıktı MP3, JPG kapak, başlık veya süre doğrulamasını geçemedi."
        }
        val retriever = MediaMetadataRetriever()
        try {
            retriever.setDataSource(file.absolutePath)
            val picture = retriever.embeddedPicture
            check(picture != null && picture.size > 2 && picture[0] == 0xff.toByte() && picture[1] == 0xd8.toByte()) {
                "Android gömülü JPG kapağı okuyamadı."
            }
        } finally { retriever.release() }
        return JSObject().apply {
            put("title", title)
            put("artist", tags.optString("artist", ""))
            put("durationMs", (duration * 1000).toLong())
            put("hasEmbeddedJpeg", true)
            put("audioCodec", "mp3")
            put("sha256", file.inputStream().use(::hash))
        }
    }

    fun verifySaved(context: Context, uri: Uri, expectedHash: String) {
        val actual = context.contentResolver.openInputStream(uri)?.use(::hash)
        check(actual == expectedHash) { "Hedefteki dosyanın SHA-256 değeri kaynak MP3 ile uyuşmuyor." }
    }

    private fun hash(input: InputStream): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(65536)
        while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }
}
