package com.yhcanbay.melodify.data

import com.getcapacitor.JSObject

object MobileContract {
    const val VERSION = 1

    fun notImplemented(message: String): JSObject = JSObject().apply {
        put("state", "not-implemented")
        put("message", message)
    }
}
