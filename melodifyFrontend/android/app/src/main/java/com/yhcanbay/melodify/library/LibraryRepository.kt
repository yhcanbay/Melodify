package com.yhcanbay.melodify.library

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.yhcanbay.melodify.data.LibraryEntity
import com.yhcanbay.melodify.data.MelodifyDatabase
import com.yhcanbay.melodify.data.TrackEntity
import java.util.UUID
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

object LibraryRepository {
    private val worker = Executors.newSingleThreadExecutor()
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private val initialized = AtomicBoolean(false)
    private val busy = AtomicBoolean(false)
    private val lock = Any()
    private lateinit var appContext: Context
    private var current: LibraryEntity? = null
    private var tracks: List<TrackEntity> = emptyList()
    private var scanning = false
    private var error: String? = null

    fun attach(context: Context) {
        appContext = context.applicationContext
        if (initialized.compareAndSet(false, true)) {
            operation {
                val dao = MelodifyDatabase.get(appContext).melodify()
                val library = dao.selectedLibrary()
                if (library != null) {
                    val access = LibraryScanner(appContext).access(library)
                    val updated = library.copy(access = access)
                    dao.saveLibrary(updated)
                    synchronized(lock) { current = updated; tracks = dao.tracks(library.id) }
                }
            }
        }
    }

    fun subscribe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }

    fun snapshot(): JSObject = synchronized(lock) {
        JSObject().apply {
            put("availability", JSObject().apply { put("state", "available"); put("message", "Seçilen klasörün kalıcı kitaplık indeksi.") })
            put("folder", current?.let(::folderJson) ?: JSONObject.NULL)
            put("scanning", scanning)
            put("error", error ?: JSONObject.NULL)
            put("tracks", JSArray().apply { tracks.forEach { put(trackJson(it)) } })
        }
    }

    fun select(uri: Uri, grantedFlags: Int): CompletableFuture<JSObject> = operation {
        require(uri.scheme == "content" && DocumentsContract.isTreeUri(uri)) { "Geçerli bir kitaplık klasörü seçin." }
        val flags = grantedFlags and (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
        require(flags == (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)) { "Kitaplık için okuma ve yazma izni gerekli." }
        appContext.contentResolver.takePersistableUriPermission(uri, flags)
        val root = DocumentsContract.buildDocumentUriUsingTree(uri, DocumentsContract.getTreeDocumentId(uri))
        val name = appContext.contentResolver.query(root, arrayOf(DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use {
            if (it.moveToFirst()) it.getString(0) else null
        } ?: kotlin.error("Kitaplık klasörü okunamadı.")
        val dao = MelodifyDatabase.get(appContext).melodify()
        val old = dao.libraryByUri(uri.toString())
        val library = LibraryEntity(old?.id ?: UUID.randomUUID().toString(), uri.toString(), name, true, "granted", old?.scannedAt)
        dao.selectLibrary(library)
        synchronized(lock) { current = library; tracks = dao.tracks(library.id) }
        signal()
        scanIndex(library)
    }.thenApply { folderJson(synchronized(lock) { current!! }) }

    fun scan(): CompletableFuture<JSObject> = operation {
        val library = synchronized(lock) { current } ?: kotlin.error("Önce kitaplık klasörünü seçin.")
        scanIndex(library)
    }.thenApply { snapshot() }

    fun refreshAccess() {
        if (busy.get() || !this::appContext.isInitialized) return
        operation {
            val library = synchronized(lock) { current } ?: return@operation
            val access = LibraryScanner(appContext).access(library)
            val updated = library.copy(access = access)
            MelodifyDatabase.get(appContext).melodify().saveLibrary(updated)
            synchronized(lock) { current = updated }
        }
    }

    fun track(id: String): TrackEntity? = MelodifyDatabase.get(appContext).melodify().track(id)

    fun library(id: String): LibraryEntity? = MelodifyDatabase.get(appContext).melodify().library(id)

    private fun scanIndex(library: LibraryEntity) {
        val scanner = LibraryScanner(appContext)
        val access = scanner.access(library)
        val dao = MelodifyDatabase.get(appContext).melodify()
        if (access != "granted") {
            val updated = library.copy(access = access)
            dao.saveLibrary(updated)
            synchronized(lock) { current = updated }
            return
        }
        val index = scanner.scan(library, dao.tracks(library.id))
        dao.replaceIndex(library, index)
        val updated = dao.selectedLibrary()
        synchronized(lock) { current = updated; tracks = dao.tracks(library.id) }
    }

    private fun operation(action: () -> Unit): CompletableFuture<Unit> {
        if (!busy.compareAndSet(false, true)) return CompletableFuture<Unit>().apply { completeExceptionally(IllegalStateException("Kitaplık işlemi zaten sürüyor.")) }
        synchronized(lock) { scanning = true; error = null }
        signal()
        return CompletableFuture.supplyAsync({
            try { action() }
            catch (failure: Exception) {
                synchronized(lock) { error = failure.message ?: "Kitaplık okunamadı. Son kayıt korundu." }
                throw failure
            } finally {
                busy.set(false)
                synchronized(lock) { scanning = false }
                signal()
            }
        }, worker)
    }

    private fun signal() { listeners.forEach { it() } }

    private fun folderJson(library: LibraryEntity) = JSObject().apply {
        put("id", library.id); put("treeUri", library.treeUri); put("name", library.name); put("access", library.access)
    }

    private fun trackJson(track: TrackEntity) = JSObject().apply {
        put("id", track.id); put("libraryId", track.libraryId); put("contentUri", track.contentUri)
        put("fileName", track.fileName); put("relativePath", track.relativePath); put("title", track.title)
        put("artist", track.artist ?: JSONObject.NULL); put("durationMs", track.durationMs ?: JSONObject.NULL)
        put("youtubeId", track.youtubeId ?: JSONObject.NULL); put("access", if (track.missing) "missing" else "available")
        put("modifiedTimeMs", track.modifiedTimeMs); put("sizeBytes", track.sizeBytes)
    }
}
