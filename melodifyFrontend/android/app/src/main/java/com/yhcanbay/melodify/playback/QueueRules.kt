package com.yhcanbay.melodify.playback

object QueueRules {
    fun physicalOrder(ids: List<String>, repeat: String): List<String> =
        if (repeat == "once") ids.flatMap { listOf(it, it) } else ids.toList()

    fun logicalIndex(physical: Int, repeat: String): Int = if (repeat == "once") physical / 2 else physical

    fun physicalIndex(logical: Int, repeat: String, pass: Int = 0): Int =
        if (repeat == "once") logical * 2 + pass.coerceIn(0, 1) else logical

    fun manualNext(current: Int, count: Int): Int = if (count == 0) 0 else (current + 1).mod(count)

    fun manualPrevious(current: Int, count: Int, positionMs: Long): Int = when {
        count == 0 -> 0
        positionMs > 3000 -> current
        else -> (current - 1).mod(count)
    }

    fun validateOrder(current: List<String>, requested: List<String>) {
        require(requested.size == current.size && requested.toSet().size == requested.size && requested.toSet() == current.toSet()) {
            "Sıralama mevcut kuyruğun tüm parçalarını tam bir kez içermeli."
        }
    }
}
