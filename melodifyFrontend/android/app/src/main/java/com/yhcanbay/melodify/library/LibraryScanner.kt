package com.yhcanbay.melodify.library

import android.content.Context
import android.net.Uri
import android.os.Environment
import android.os.storage.StorageManager
import android.provider.DocumentsContract
import com.yhcanbay.melodify.data.LibraryEntity
import com.yhcanbay.melodify.data.TrackEntity
import java.io.IOException
import java.util.ArrayDeque
import java.util.UUID

class LibraryScanner(private val context: Context) {
    private data class Folder(val id: String, val path: String)
    private data class Document(val id: String, val parentId: String, val name: String, val path: String, val modified: Long, val size: Long)

    fun access(library: LibraryEntity): String {
        val tree = Uri.parse(library.treeUri)
        val permission = context.contentResolver.persistedUriPermissions.any { it.uri == tree && it.isReadPermission }
        if (!permission) return "revoked"
        if (!mounted(tree)) return "unmounted"
        val root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
        return try {
            val exists = context.contentResolver.query(root, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID), null, null, null)?.use { it.moveToFirst() }
                ?: throw IOException("Klasör sağlayıcısı geçici olarak yanıt vermiyor.")
            LibraryRules.access(true, true, exists)
        } catch (_: SecurityException) { "revoked" }
        catch (_: java.io.FileNotFoundException) { if (mounted(tree)) "missing" else "unmounted" }
    }

    private fun mounted(tree: Uri): Boolean {
        if (tree.authority != "com.android.externalstorage.documents") return true
        val volumeId = DocumentsContract.getTreeDocumentId(tree).substringBefore(':')
        val manager = context.getSystemService(StorageManager::class.java)
        val volume = manager.storageVolumes.firstOrNull { if (volumeId == "primary") it.isPrimary else it.uuid.equals(volumeId, true) }
        return volume != null && volume.state in setOf(Environment.MEDIA_MOUNTED, Environment.MEDIA_MOUNTED_READ_ONLY)
    }

    fun scan(library: LibraryEntity, previous: List<TrackEntity>): List<TrackEntity> {
        val tree = Uri.parse(library.treeUri)
        val folders = ArrayDeque<Folder>()
        folders.add(Folder(DocumentsContract.getTreeDocumentId(tree), ""))
        val visited = hashSetOf<String>()
        val documents = mutableListOf<Document>()
        val columns = arrayOf(
            DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE, DocumentsContract.Document.COLUMN_FLAGS,
            DocumentsContract.Document.COLUMN_LAST_MODIFIED, DocumentsContract.Document.COLUMN_SIZE,
        )
        while (folders.isNotEmpty()) {
            val folder = folders.removeFirst()
            if (!visited.add(folder.id)) continue
            val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, folder.id)
            val cursor = context.contentResolver.query(children, columns, null, null, null)
                ?: throw IOException("Alt klasör okunamadı. Mevcut kitaplık indeksi korundu.")
            cursor.use {
                while (it.moveToNext()) {
                    val id = it.getString(0)
                    val name = it.getString(1) ?: continue
                    if (!LibraryRules.shouldVisit(name)) continue
                    val path = if (folder.path.isEmpty()) name else "${folder.path}/$name"
                    if (it.getString(2) == DocumentsContract.Document.MIME_TYPE_DIR) {
                        folders.add(Folder(id, path))
                    } else if (LibraryRules.isAudio(name) && (it.getInt(3) and DocumentsContract.Document.FLAG_VIRTUAL_DOCUMENT) == 0) {
                        documents.add(Document(id, folder.id, name, path, if (it.isNull(4)) 0 else it.getLong(4), if (it.isNull(5)) 0 else it.getLong(5)))
                    }
                }
            }
        }
        val oldByDocument = previous.associateBy { it.documentId }
        val oldByYoutube = previous.filter { it.youtubeId != null }.groupBy { it.youtubeId }
        val documentIds = documents.mapTo(hashSetOf()) { it.id }
        val reused = hashSetOf<String>()
        return documents.map { document ->
            val youtube = LibraryRules.youtubeId(document.name)
            val moved = oldByYoutube[youtube]?.singleOrNull()?.takeIf { it.documentId !in documentIds && it.sizeBytes == document.size && it.id !in reused }
            val old = oldByDocument[document.id] ?: moved
            val id = old?.id ?: UUID.randomUUID().toString()
            reused.add(id)
            TrackEntity(
                id, library.id, document.id, document.parentId,
                DocumentsContract.buildDocumentUriUsingTree(tree, document.id).toString(),
                document.name, document.path, document.name.substringBeforeLast('.'),
                old?.artist, old?.durationMs, youtube, document.modified, document.size, false,
            )
        }
    }
}
