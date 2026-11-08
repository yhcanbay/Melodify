package com.yhcanbay.melodify.downloads

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class DownloadInputTest {
    @Test
    fun preservesTurkishSearchAndTreatsOptionsAsQueryText() {
        assertEquals("şarkı Türkçe", DownloadInput.query("  şarkı Türkçe  "))
        assertEquals("--exec test", DownloadInput.query("--exec test"))
    }

    @Test
    fun rejectsEmptyLongOrControlContainingSearches() {
        listOf("", " ", "x".repeat(201), "şarkı\u0000test", "şarkı\ntest").forEach { value ->
            assertThrows(IllegalArgumentException::class.java) { DownloadInput.query(value) }
        }
        assertThrows(IllegalArgumentException::class.java) { DownloadInput.limit(0) }
        assertThrows(IllegalArgumentException::class.java) { DownloadInput.limit(11) }
    }

    @Test
    fun canonicalizesOnlyAllowedYoutubeSources() {
        val expected = "https://www.youtube.com/watch?v=BaW_jenozKc"
        assertEquals(expected, DownloadInput.canonicalUrl("https://youtu.be/BaW_jenozKc"))
        assertEquals(expected, DownloadInput.canonicalUrl("https://m.youtube.com/watch?v=BaW_jenozKc&list=ignored"))
    }

    @Test
    fun rejectsForeignHostsFilePathsCredentialsPortsAndMalformedIds() {
        listOf(
            "file:///data/private.mp3", "http://www.youtube.com/watch?v=BaW_jenozKc",
            "https://youtube.com.attacker.test/watch?v=BaW_jenozKc", "https://attacker.test/watch?v=BaW_jenozKc",
            "https://user@www.youtube.com/watch?v=BaW_jenozKc", "https://www.youtube.com:443/watch?v=BaW_jenozKc",
            "https://www.youtube.com/watch?v=../file", "https://youtu.be/BaW_jenozKc/other",
            "https://www.youtube.com/watch?v=BaW_jenozKc&v=BaW_jenozKc",
        ).forEach { value -> assertThrows(IllegalArgumentException::class.java) { DownloadInput.canonicalUrl(value) } }
    }
}
