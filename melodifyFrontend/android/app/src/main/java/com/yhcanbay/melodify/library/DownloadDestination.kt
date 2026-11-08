package com.yhcanbay.melodify.library

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import com.getcapacitor.JSObject
import com.yhcanbay.melodify.downloads.ToolCancellation
import java.io.File
import java.util.UUID

object DownloadDestination {
    private const val preferencesName = "melodify-download-probe"

    fun selected(context: Context): JSObject? {
        val preferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
        val stored = preferences.getString("treeUri", null) ?: return null
        val uri = Uri.parse(stored)
        val granted = context.contentResolver.persistedUriPermissions.any {
            it.uri == uri && it.isReadPermission && it.isWritePermission
        }
        return JSObject().apply {
            put("id", preferences.getString("folderId", ""))
            put("treeUri", stored)
            put("name", preferences.getString("name", "İndirme klasörü"))
            put("access", if (granted) "granted" else "revoked")
        }
    }

    fun remember(context: Context, uri: Uri, flags: Int): JSObject {
        require(uri.scheme == "content" && DocumentsContract.isTreeUri(uri)) { "Geçerli bir klasör seçin." }
        val accessFlags = flags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        require(accessFlags == (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)) {
            "Klasör için okuma ve yazma erişimi gerekli."
        }
        context.contentResolver.takePersistableUriPermission(uri, accessFlags)
        val root = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
        val name = context.contentResolver.query(root, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use {
            if (it.moveToFirst()) it.getString(0) else null
        } ?: "İndirme klasörü"
        val preferences = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)
        val id = if (preferences.getString("treeUri", null) == uri.toString()) {
            preferences.getString("folderId", null) ?: UUID.randomUUID().toString()
        } else UUID.randomUUID().toString()
        check(preferences.edit().putString("treeUri", uri.toString()).putString("folderId", id).putString("name", name).commit()) {
            "Klasör seçimi kaydedilemedi."
        }
        return selected(context) ?: error("Klasör seçimi okunamadı.")
    }

    fun save(context: Context, targetId: String, source: File, cancellation: ToolCancellation): Uri {
        val folder = selected(context) ?: error("Önce indirme klasörünü seçin.")
        require(folder.getString("id") == targetId && folder.getString("access") == "granted") {
            "İndirme klasörüne erişilemiyor. Klasörü yeniden seçin."
        }
        val tree = Uri.parse(folder.getString("treeUri"))
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
        val duplicate = context.contentResolver.query(children, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use {
            var exists = false
            while (it.moveToNext()) if (it.getString(0).equals(source.name, ignoreCase = true)) { exists = true; break }
            exists
        } ?: false
        check(!duplicate) { "Hedefte bu isimde bir dosya zaten var; mevcut dosya değiştirilmedi." }
        cancellation.throwIfCanceled()
        val root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
        val pending = DocumentsContract.createDocument(context.contentResolver, root, "audio/mpeg", ".melodify-${UUID.randomUUID()}.part")
            ?: error("Hedef klasörde dosya oluşturulamadı.")
        try {
            context.contentResolver.openOutputStream(pending, "w")?.use { output ->
                source.inputStream().use { input ->
                    val buffer = ByteArray(65536)
                    while (true) {
                        cancellation.throwIfCanceled()
                        val count = input.read(buffer)
                        if (count < 0) break
                        output.write(buffer, 0, count)
                    }
                    output.flush()
                }
            } ?: error("Hedef dosya yazma için açılamadı.")
            cancellation.throwIfCanceled()
            return DocumentsContract.renameDocument(context.contentResolver, pending, source.name)
                ?: error("Tamamlanan dosya adlandırılamadı.")
        } catch (failure: Exception) {
            // The user's permission excludes deletion in the selected folder.
            throw IllegalStateException("Kaydetme tamamlanamadı; hedefteki yarım dosya otomatik silinmedi. ${failure.message}", failure)
        }
    }
}
