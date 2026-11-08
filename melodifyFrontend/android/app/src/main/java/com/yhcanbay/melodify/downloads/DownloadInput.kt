package com.yhcanbay.melodify.downloads

import java.net.URI
import java.util.Locale

object DownloadInput {
    private val videoId = Regex("^[A-Za-z0-9_-]{11}$")

    fun query(value: String): String {
        val query = value.trim()
        require(query.isNotEmpty() && query.length <= 200 && query.none { it.isISOControl() }) {
            "Arama metni 1–200 karakter olmalı ve kontrol karakteri içermemeli."
        }
        return query
    }

    fun limit(value: Int): Int {
        require(value in 1..10) { "Arama sonuç sayısı 1–10 arasında olmalı." }
        return value
    }

    fun canonicalUrl(value: String): String {
        val uri = runCatching { URI(value) }.getOrNull()
        require(uri != null && uri.scheme == "https" && uri.rawUserInfo == null && uri.port == -1) {
            "Geçerli bir HTTPS YouTube bağlantısı gerekli."
        }
        val host = uri.host?.lowercase(Locale.ROOT)
        val id = when {
            host == "youtu.be" -> uri.path.removePrefix("/")
            host in setOf("youtube.com", "www.youtube.com", "m.youtube.com") && uri.path == "/watch" ->
                uri.rawQuery?.split('&')?.singleOrNull { it.startsWith("v=") }?.removePrefix("v=")
            else -> null
        }
        require(id != null && videoId.matches(id)) { "Geçerli bir YouTube video kimliği gerekli." }
        return "https://www.youtube.com/watch?v=$id"
    }
}
