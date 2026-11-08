package com.yhcanbay.melodify.downloads

import android.content.Context
import android.os.SystemClock
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.yausername.youtubedl_android.YoutubeDLRequest
import com.yhcanbay.melodify.library.DownloadDestination
import com.yhcanbay.melodify.data.DownloadJobStore
import com.yhcanbay.melodify.data.MelodifyDatabase
import java.io.File
import java.util.UUID
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import org.json.JSONObject

// Step 1 deliberately runs one foreground operation. Persistent queue/service follows later.
object DownloadEngine {
    private data class Active(val id: String, val kind: String, val cancellation: ToolCancellation)
    private data class Job(
        val id: String, val sourceUrl: String, val targetFolderId: String,
        var title: String, var stage: String = "preparing", var progress: Double? = null,
        var error: String? = null, var outputUri: String? = null, var validation: JSObject? = null,
    )

    private val lock = Any()
    private val worker = Executors.newSingleThreadExecutor()
    private val initialized = AtomicBoolean(false)
    @Volatile private var restored = false
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private val jobs = linkedMapOf<String, Job>()
    private var active: Active? = null
    private var searchQuery = ""
    private var searchStatus = "idle"
    private var searchError: String? = null
    private var searchResults = JSArray()
    private var lastSignal = 0L
    private var persistenceError: String? = null
    private lateinit var appContext: Context

    fun attach(context: Context) {
        appContext = context.applicationContext
        if (initialized.compareAndSet(false, true)) worker.execute {
            try {
                val saved = DownloadJobStore.load(appContext)
                synchronized(lock) {
                    saved.forEach { json ->
                        val job = Job(
                            json.getString("id") ?: error("İş kimliği eksik."),
                            json.getString("sourceUrl") ?: error("Kaynak eksik."),
                            json.getString("targetFolderId") ?: error("Hedef eksik."),
                            json.getString("title") ?: "Parça", json.getString("stage") ?: "interrupted",
                            if (json.isNull("progress")) null else json.getDouble("progress"),
                            if (json.isNull("error")) null else json.getString("error"),
                            if (json.isNull("outputUri")) null else json.getString("outputUri"),
                            if (json.isNull("validation")) null else JSObject(json.getJSONObject("validation").toString()),
                        )
                        jobs.putIfAbsent(job.id, job)
                    }
                }
                val recovery = MelodifyDatabase.get(appContext).melodify().playbackRecovery("probe")
                if (recovery != null) ProbePlayback.restore(JSObject(recovery.payload))
            } catch (failure: Exception) { synchronized(lock) { persistenceError = "Kalıcı kayıt okunamadı: ${failure.message}" } }
            finally { restored = true }
            signal(persist = false)
        }
    }
    fun subscribe(listener: () -> Unit): () -> Unit { listeners.add(listener); return { listeners.remove(listener) } }
    fun busy() = synchronized(lock) { active != null }

    fun snapshot(): JSObject = synchronized(lock) {
        JSObject().apply {
            put("availability", JSObject().apply {
                put("state", "available")
                put("message", if (EngineRuntime.status == "ready") "İlk indirme denemesi hazır. İşlem boyunca uygulamayı açık tutun." else "Önce Ayarlar'dan indirme araçlarını doğrulayın.")
            })
            put("engineReady", EngineRuntime.status == "ready")
            put("persistenceError", persistenceError ?: JSONObject.NULL)
            put("search", JSObject().apply {
                put("query", searchQuery)
                put("state", searchStatus)
                put("error", searchError ?: JSONObject.NULL)
                put("results", searchResults)
            })
            put("jobs", JSArray().apply {
                jobs.values.forEach { job -> put(JSObject().apply {
                    put("id", job.id)
                    put("sourceUrl", job.sourceUrl)
                    put("targetFolderId", job.targetFolderId)
                    put("title", job.title)
                    put("stage", job.stage)
                    put("progress", job.progress ?: JSONObject.NULL)
                    put("error", job.error ?: JSONObject.NULL)
                    put("outputUri", job.outputUri ?: JSONObject.NULL)
                    put("validation", job.validation ?: JSONObject.NULL)
                }) }
            })
            put("probePlayback", ProbePlayback.snapshot())
        }
    }

    fun search(value: String, limit: Int): CompletableFuture<JSArray> {
        val query = DownloadInput.query(value)
        val count = DownloadInput.limit(limit)
        val operation = reserve("search")
        synchronized(lock) {
            searchQuery = query; searchStatus = "searching"; searchError = null; searchResults = JSArray()
        }
        signal()
        return CompletableFuture.supplyAsync({
            try {
                val work = workspace(operation.id)
                val request = YoutubeDLRequest("ytsearch$count:$query")
                    .addOption("--flat-playlist").addOption("--dump-single-json").addOption("--skip-download").addOption("--no-progress")
                val result = EngineRuntime.execute(appContext, request, work, operation.cancellation)
                check(result.exitCode == 0) { friendlyError(result.error) }
                val info = JSONObject(result.output)
                val entries = info.optJSONArray("entries") ?: JSArray()
                val results = JSArray()
                for (index in 0 until entries.length()) {
                    val entry = entries.optJSONObject(index) ?: continue
                    val id = entry.optString("id")
                    if (!Regex("^[A-Za-z0-9_-]{11}$").matches(id)) continue
                    val seconds = entry.optDouble("duration", 0.0).takeIf { it.isFinite() && it >= 0 }?.toLong() ?: 0L
                    val thumbnails = entry.optJSONArray("thumbnails")
                    val thumbnail = thumbnails?.optJSONObject(thumbnails.length() - 1)?.optString("url") ?: ""
                    results.put(JSObject().apply {
                        put("id", id)
                        put("title", entry.optString("title", id))
                        put("uploader", entry.optString("uploader", entry.optString("channel", "")))
                        put("durationText", if (seconds > 0) "${seconds / 60}:${(seconds % 60).toString().padStart(2, '0')}" else "—")
                        put("webpageUrl", "https://www.youtube.com/watch?v=$id")
                        put("thumbnailUrl", if (thumbnail.startsWith("https://")) thumbnail else "")
                    })
                }
                operation.cancellation.throwIfCanceled()
                synchronized(lock) { searchResults = results; searchStatus = "completed" }
                results
            } catch (failure: Exception) {
                synchronized(lock) {
                    searchStatus = if (operation.cancellation.isCanceled()) "canceled" else "failed"
                    searchError = if (operation.cancellation.isCanceled()) null else friendlyError(failure.message ?: "")
                }
                throw failure
            } finally { finish(operation) }
        }, worker)
    }

    fun enqueue(source: String, targetId: String, slowConversionProbe: Boolean = false): String {
        val url = DownloadInput.canonicalUrl(source)
        val folder = DownloadDestination.selected(appContext)
        require(folder != null && folder.getString("id") == targetId && folder.getString("access") == "granted") {
            "Önce yazılabilir bir indirme klasörü seçin."
        }
        val operation = reserve("download")
        val job = Job(operation.id, url, targetId, "Parça hazırlanıyor")
        synchronized(lock) { jobs[job.id] = job }
        signal()
        worker.execute {
            try {
                val work = workspace(operation.id)
                val request = YoutubeDLRequest(url)
                    .addOption("--no-playlist").addOption("--extract-audio")
                    .addOption("--audio-format", "mp3").addOption("--audio-quality", "0")
                    .addOption("--embed-thumbnail").addOption("--convert-thumbnails", "jpg")
                    .addOption("--write-thumbnail").addOption("--add-metadata")
                    .addOption("--no-overwrites").addOption("--newline")
                    .addOption("--progress-template", "download:MELODIFY_PROGRESS:%(progress._percent_str)s")
                    .addOption("-o", File(work, "%(title)s [%(id)s].%(ext)s").absolutePath)
                if (slowConversionProbe) request.addOption("--postprocessor-args", "ExtractAudio+ffmpeg_i:-re")
                update(job) { stage = "downloading" }
                val result = EngineRuntime.execute(appContext, request, work, operation.cancellation) { line ->
                    when {
                        line.contains("MELODIFY_PROGRESS:") -> {
                            val percent = Regex("MELODIFY_PROGRESS:\\s*([0-9.]+)%").find(line)?.groupValues?.get(1)?.toDoubleOrNull()
                            if (percent != null) update(job, false) { progress = percent.coerceIn(0.0, 100.0) }
                        }
                        line.startsWith("[ExtractAudio]") || line.startsWith("[Metadata]") || line.startsWith("[EmbedThumbnail]") -> update(job) { stage = "converting" }
                    }
                }
                check(result.exitCode == 0) { friendlyError(result.error) }
                operation.cancellation.throwIfCanceled()
                val outputs = work.listFiles()?.filter { it.isFile && it.extension.equals("mp3", true) } ?: emptyList()
                check(outputs.size == 1) { "İndirme tam olarak bir MP3 üretmedi." }
                val output = outputs.single()
                check(output.canonicalFile.parentFile == work.canonicalFile && output.length() > 0) { "İndirme çıktı yolu geçersiz." }
                val validation = DownloadValidation.inspect(appContext, output, work, operation.cancellation)
                val validatedTitle = validation.getString("title") ?: error("Doğrulanan parça başlığı eksik.")
                val expectedHash = validation.getString("sha256") ?: error("Doğrulanan dosya hash değeri eksik.")
                update(job) { stage = "saving"; title = validatedTitle; this.validation = validation; progress = 100.0 }
                val uri = DownloadDestination.save(appContext, targetId, output, operation.cancellation)
                DownloadValidation.verifySaved(appContext, uri, expectedHash)
                update(job) { stage = "completed"; outputUri = uri.toString() }
            } catch (failure: Exception) {
                update(job) {
                    stage = if (operation.cancellation.isCanceled()) "canceled" else "failed"
                    error = if (failure is CancellationException) null else friendlyError(failure.message ?: "")
                }
            } finally { finish(operation) }
        }
        return job.id
    }

    fun cancel(jobId: String) {
        val operation = synchronized(lock) {
            val running = active
            require(running != null && running.kind == "download" && running.id == jobId) { "Bu indirme artık çalışmıyor." }
            jobs[jobId]?.stage = "canceling"
            running
        }
        operation.cancellation.cancel()
        signal()
    }

    fun cancelSearch() {
        val operation = synchronized(lock) { active?.takeIf { it.kind == "search" } }
        operation?.cancellation?.cancel()
    }

    fun cancelActive() { synchronized(lock) { active }?.cancellation?.cancel() }

    fun output(jobId: String): String = synchronized(lock) {
        val job = jobs[jobId]
        require(job?.stage == "completed" && job.outputUri != null) { "Önce tamamlanan bir indirme seçin." }
        job.outputUri!!
    }

    private fun reserve(kind: String): Active = synchronized(lock) {
        check(EngineRuntime.status == "ready") { "Önce Ayarlar'dan indirme araçlarını doğrulayın." }
        check(active == null) { "Bir işlem zaten sürüyor. Önce tamamlanmasını bekleyin veya iptal edin." }
        Active(UUID.randomUUID().toString(), kind, ToolCancellation()).also { active = it }
    }

    private fun workspace(id: String): File = File(appContext.cacheDir, "melodify-engine-probe/$id").also {
        check(it.mkdirs()) { "Geçici çalışma klasörü oluşturulamadı." }
    }

    private fun update(job: Job, force: Boolean = true, change: Job.() -> Unit) {
        synchronized(lock) { job.change() }
        signal(force)
    }

    private fun finish(operation: Active) {
        synchronized(lock) { if (active === operation) active = null }
        signal()
    }

    fun signal(force: Boolean = true, persist: Boolean = true) {
        val now = SystemClock.elapsedRealtime()
        synchronized(lock) { if (!force && now - lastSignal < 250) return; lastSignal = now }
        if (persist && restored && this::appContext.isInitialized) {
            val state = snapshot()
            DownloadJobStore.save(appContext, JSArray(state.getJSONArray("jobs").toString()), ::storageFailure)
            DownloadJobStore.savePlayback(appContext, ProbePlayback.snapshot(), ::storageFailure)
        }
        listeners.forEach { it() }
    }

    private fun storageFailure(message: String) {
        synchronized(lock) { persistenceError = message }
        signal(persist = false)
    }

    private fun friendlyError(value: String): String = when {
        value.contains("Sign in", true) || value.contains("cookies", true) -> "YouTube oturum doğrulaması istiyor. Bu denemede çerez desteği henüz eklenmedi."
        value.contains("No space left", true) -> "Telefonda yeterli boş alan yok."
        value.contains("timed out", true) || value.contains("Unable to download", true) -> "Ağ bağlantısı kurulamadı veya zaman aşımına uğradı. Yeniden deneyin."
        value.contains("Video unavailable", true) || value.contains("Private video", true) -> "Bu içeriğe erişilemiyor. Başka bir sonuç seçin."
        else -> value.trim().take(1000).ifBlank { "İşlem tamamlanamadı. Lütfen yeniden deneyin." }
    }
}
