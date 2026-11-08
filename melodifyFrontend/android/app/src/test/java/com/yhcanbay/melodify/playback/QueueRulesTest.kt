package com.yhcanbay.melodify.playback

import org.junit.Assert.*
import org.junit.Test

class QueueRulesTest {
    @Test fun onceRepeatsEachTrackTwiceThenEnds() {
        val physical = QueueRules.physicalOrder(listOf("A", "B"), "once")
        assertEquals(listOf("A", "A", "B", "B"), physical)
        assertEquals(listOf(0, 0, 1, 1), physical.indices.map { QueueRules.logicalIndex(it, "once") })
        assertEquals(2, QueueRules.physicalIndex(1, "once"))
        assertEquals(3, QueueRules.physicalIndex(1, "once", 1))
    }

    @Test fun manualSkippingWrapsAndPreviousUsesThreeSecondThreshold() {
        assertEquals(0, QueueRules.manualNext(1, 2))
        assertEquals(1, QueueRules.manualPrevious(0, 2, 3000))
        assertEquals(0, QueueRules.manualPrevious(0, 2, 3001))
        assertEquals(0, QueueRules.manualNext(0, 1))
    }

    @Test fun repeatOffAndOneKeepCanonicalOrder() {
        for (mode in listOf("off", "one")) assertEquals(listOf("A", "B"), QueueRules.physicalOrder(listOf("A", "B"), mode))
    }

    @Test fun reorderRejectsMissingDuplicateAndUnrelatedTracks() {
        QueueRules.validateOrder(listOf("A", "B"), listOf("B", "A"))
        for (invalid in listOf(listOf("A"), listOf("A", "A"), listOf("B", "C"))) {
            assertThrows(IllegalArgumentException::class.java) { QueueRules.validateOrder(listOf("A", "B"), invalid) }
        }
    }
}
