package com.yhcanbay.melodify.bridge

import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import com.yhcanbay.melodify.library.LibraryState
import com.yhcanbay.melodify.library.LibraryRepository
import com.yhcanbay.melodify.library.CoverCache
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

@CapacitorPlugin(name = "MelodifyLibrary")
class MelodifyLibraryPlugin : FoundationPlugin() {
    private val pickerOpen = AtomicBoolean(false)
    private val covers = Executors.newSingleThreadExecutor()
    private var unsubscribe: (() -> Unit)? = null

    override fun load() {
        LibraryRepository.attach(context.applicationContext)
        unsubscribe = LibraryRepository.subscribe { notifyListeners("snapshotChanged", JSObject(), true) }
    }

    override fun snapshot() = LibraryState.snapshot()

    @PluginMethod
    fun pickFolder(call: PluginCall) {
        if (!pickerOpen.compareAndSet(false, true)) { call.reject("Kitaplık seçicisi zaten açık.", "PICKER_BUSY"); return }
        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            }
            startActivityForResult(call, intent, "librarySelected")
        } catch (failure: Exception) { pickerOpen.set(false); call.reject(failure.message ?: "Klasör seçici açılamadı.", "PICKER_FAILED") }
    }

    @ActivityCallback
    private fun librarySelected(call: PluginCall?, result: ActivityResult) {
        pickerOpen.set(false)
        if (call == null) return
        val data = result.data
        if (result.resultCode != Activity.RESULT_OK || data?.data == null) {
            call.resolve(JSObject().apply { put("canceled", true) })
            return
        }
        LibraryRepository.select(data.data!!, data.flags).whenComplete { folder, failure ->
            if (failure == null) call.resolve(JSObject().apply { put("canceled", false); put("folder", folder) })
            else call.reject(failure.cause?.message ?: failure.message ?: "Kitaplık okunamadı.", "LIBRARY_FAILED")
        }
    }

    @PluginMethod
    fun scan(call: PluginCall) {
        LibraryRepository.scan().whenComplete { snapshot, failure ->
            if (failure == null) call.resolve(snapshot)
            else call.reject(failure.cause?.message ?: failure.message ?: "Kitaplık yenilenemedi.", "LIBRARY_FAILED")
        }
    }

    @PluginMethod
    fun getCover(call: PluginCall) {
        val id = call.data.opt("trackId") as? String
        if (id == null || !Regex("^[a-f0-9-]{36}$").matches(id)) { call.reject("Parça kimliği geçersiz.", "INVALID_ARGUMENT"); return }
        covers.execute {
            try {
                val data = CoverCache.read(context.applicationContext, id)
                call.resolve(JSObject().apply {
                    put("uri", if (data == null) JSONObject.NULL else "content://${context.packageName}.covers/track/$id")
                })
            } catch (failure: Exception) { call.reject(failure.message ?: "Kapak okunamadı.", "COVER_FAILED") }
        }
    }

    override fun handleOnResume() { LibraryRepository.refreshAccess() }
    override fun handleOnDestroy() { unsubscribe?.invoke(); covers.shutdown() }
}
