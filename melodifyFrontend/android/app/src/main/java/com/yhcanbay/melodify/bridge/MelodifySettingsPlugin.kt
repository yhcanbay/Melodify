package com.yhcanbay.melodify.bridge

import android.os.Build
import android.app.Activity
import android.content.Intent
import androidx.activity.result.ActivityResult
import com.getcapacitor.annotation.ActivityCallback
import androidx.activity.OnBackPressedCallback
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.yhcanbay.melodify.BuildConfig
import com.yhcanbay.melodify.data.MobileContract
import com.yhcanbay.melodify.downloads.EngineRuntime
import com.yhcanbay.melodify.downloads.DownloadEngine
import com.yhcanbay.melodify.library.DownloadDestination
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.Executors
import org.json.JSONObject

@CapacitorPlugin(name = "MelodifySettings")
class MelodifySettingsPlugin : FoundationPlugin() {
    private val toolWorker = Executors.newSingleThreadExecutor()
    private val folderPickerOpen = AtomicBoolean(false)
    private val backCallback = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() {
            notifyListeners("backRequested", JSObject())
        }
    }

    override fun load() {
        activity.runOnUiThread {
            activity.onBackPressedDispatcher.addCallback(activity, backCallback)
        }
    }

    override fun snapshot() = JSObject().apply {
        put("availability", JSObject().apply {
            put("state", "available")
            put("message", "Android bağlantısı hazır.")
        })
        put("protocolVersion", MobileContract.VERSION)
        put("platform", "android")
        put("appVersion", BuildConfig.VERSION_NAME)
        put("androidApi", Build.VERSION.SDK_INT)
        put("supportedAbis", JSArray(Build.SUPPORTED_ABIS))
        put("downloadFolder", DownloadDestination.selected(context) ?: JSONObject.NULL)
        put("cookiesImported", false)
        put("tools", EngineRuntime.tools())
        put("toolStatus", EngineRuntime.status)
        put("toolError", EngineRuntime.error ?: JSONObject.NULL)
    }

    @PluginMethod
    fun setBackNavigation(call: PluginCall) {
        val enabled = call.data.opt("enabled")
        if (enabled !is Boolean) {
            call.reject("Geri gezinme durumu geçersiz.", "INVALID_ARGUMENT")
            return
        }
        activity.runOnUiThread {
            backCallback.isEnabled = enabled
            call.resolve()
        }
    }

    @PluginMethod
    fun debugRequestBack(call: PluginCall) {
        if (!BuildConfig.DEBUG) { call.reject("Yalnız geliştirme sürümünde kullanılabilir.", "NOT_AVAILABLE"); return }
        activity.runOnUiThread {
            if (!backCallback.isEnabled || !activity.hasWindowFocus()) {
                call.reject("Melodify önde ve geri gezinme etkin olmalı.", "APP_NOT_FOREGROUND")
                return@runOnUiThread
            }
            activity.onBackPressedDispatcher.onBackPressed()
            call.resolve()
        }
    }

    override fun handleOnResume() {
        notifyListeners("foreground", JSObject())
    }

    override fun handleOnDestroy() {
        activity.runOnUiThread { backCallback.remove() }
        toolWorker.shutdown()
    }

    @PluginMethod
    fun initializeTools(call: PluginCall) {
        toolWorker.execute {
            try {
                EngineRuntime.prepare(context.applicationContext)
                call.resolve()
            } catch (failure: Exception) {
                call.reject(failure.message ?: "Araçlar hazırlanamadı.", "ENGINE_PREPARATION_FAILED")
            }
            notifyListeners("snapshotChanged", JSObject())
        }
    }

    @PluginMethod
    fun pickDownloadFolder(call: PluginCall) {
        if (DownloadEngine.busy()) { call.reject("Klasör değiştirmeden önce çalışan işlemi tamamlayın veya iptal edin.", "ENGINE_BUSY"); return }
        if (!folderPickerOpen.compareAndSet(false, true)) { call.reject("Klasör seçici zaten açık.", "PICKER_BUSY"); return }
        try {
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT_TREE).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
            }
            startActivityForResult(call, intent, "downloadFolderSelected")
        } catch (failure: Exception) {
            folderPickerOpen.set(false)
            call.reject(failure.message ?: "Klasör seçici açılamadı.", "PICKER_FAILED")
        }
    }

    @ActivityCallback
    private fun downloadFolderSelected(call: PluginCall?, result: ActivityResult) {
        folderPickerOpen.set(false)
        if (call == null) return
        if (result.resultCode != Activity.RESULT_OK || result.data?.data == null) {
            call.resolve(JSObject().apply { put("canceled", true) })
            return
        }
        try {
            val data = result.data!!
            val folder = DownloadDestination.remember(context, data.data!!, data.flags)
            call.resolve(JSObject().apply { put("canceled", false); put("folder", folder) })
            notifyListeners("snapshotChanged", JSObject())
        } catch (failure: Exception) {
            call.reject(failure.message ?: "Klasör erişimi kaydedilemedi.", "FOLDER_ACCESS_FAILED")
        }
    }

    @PluginMethod
    fun importCookies(call: PluginCall) = notReady(call)

    @PluginMethod
    fun deleteCookies(call: PluginCall) = notReady(call)

    @PluginMethod
    fun updateTools(call: PluginCall) = notReady(call)

    @PluginMethod
    fun exportLibrary(call: PluginCall) = notReady(call)

    @PluginMethod
    fun importLibrary(call: PluginCall) = notReady(call)
}
