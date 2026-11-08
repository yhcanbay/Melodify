package com.yhcanbay.melodify.bridge

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod

abstract class FoundationPlugin : Plugin() {
    protected abstract fun snapshot(): JSObject

    @PluginMethod
    fun getSnapshot(call: PluginCall) {
        call.resolve(snapshot())
    }

    protected fun notReady(call: PluginCall) {
        call.reject("Bu özellik henüz kullanıma hazır değil.", "NOT_IMPLEMENTED")
    }
}
