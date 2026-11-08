package com.yhcanbay.melodify.library

import org.junit.Assert.*
import org.junit.Test

class LibraryRulesTest {
    @Test fun supportsDesktopAudioFormatsRegardlessOfCase() {
        listOf("aac", "flac", "m4a", "m4b", "mp3", "ogg", "oga", "opus", "wav", "webm").forEach {
            assertTrue(LibraryRules.isAudio("Türkçe Parça.${it.uppercase()}"))
        }
        listOf("cover.jpg", "playlist.json", "track.mp3.part", "mp3").forEach { assertFalse(LibraryRules.isAudio(it)) }
    }

    @Test fun ignoresHiddenAndPlaylistDirectories() {
        listOf("", " ", ".pending.mp3", ".cache", "Melodify-Playlists").forEach { assertFalse(LibraryRules.shouldVisit(it)) }
        assertTrue(LibraryRules.shouldVisit("Türkçe Müzik"))
    }

    @Test fun extractsOnlyValidTrailingYoutubeIdentity() {
        assertEquals("DTi8wZ1a1TA", LibraryRules.youtubeId("İsim [Live] [DTi8wZ1a1TA].mp3"))
        assertNull(LibraryRules.youtubeId("İsim [short].mp3"))
        assertNull(LibraryRules.youtubeId("[DTi8wZ1a1TA] başka.mp3"))
    }

    @Test fun distinguishesPermissionStorageAndMissingFolder() {
        assertEquals("revoked", LibraryRules.access(false, false, false))
        assertEquals("unmounted", LibraryRules.access(true, false, false))
        assertEquals("missing", LibraryRules.access(true, true, false))
        assertEquals("granted", LibraryRules.access(true, true, true))
    }
}
