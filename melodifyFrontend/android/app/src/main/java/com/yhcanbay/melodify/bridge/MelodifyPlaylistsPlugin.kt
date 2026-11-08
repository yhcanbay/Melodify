package com.yhcanbay.melodify.bridge

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.yhcanbay.melodify.data.MobileContract

@CapacitorPlugin(name = "MelodifyPlaylists")
class MelodifyPlaylistsPlugin : FoundationPlugin() {
    override fun snapshot() = JSObject().apply {
        put("availability", MobileContract.notImplemented("Çalma listeleri henüz kullanıma hazır değil."))
        put("playlists", JSArray())
    }

    @PluginMethod
    fun dispatch(call: PluginCall) = notReady(call)
}
