package com.yhcanbay.melodify.library

import java.util.Locale

object LibraryRules {
    val audioExtensions = setOf(".aac", ".flac", ".m4a", ".m4b", ".mp3", ".ogg", ".oga", ".opus", ".wav", ".webm")

    fun shouldVisit(name: String): Boolean = name.isNotBlank() && !name.startsWith('.') &&
        !name.equals("melodify-playlists", ignoreCase = true)

    fun isAudio(name: String): Boolean {
        val extension = name.substringAfterLast('.', "").lowercase(Locale.ROOT)
        return extension.isNotEmpty() && ".$extension" in audioExtensions
    }

    fun youtubeId(name: String): String? = Regex("\\[([A-Za-z0-9_-]{11})]\\.[^.]+$").find(name)?.groupValues?.get(1)

    fun access(hasPermission: Boolean, mounted: Boolean, documentExists: Boolean): String = when {
        !hasPermission -> "revoked"
        !mounted -> "unmounted"
        !documentExists -> "missing"
        else -> "granted"
    }
}
