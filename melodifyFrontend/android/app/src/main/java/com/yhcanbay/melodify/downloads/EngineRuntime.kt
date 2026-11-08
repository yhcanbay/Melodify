package com.yhcanbay.melodify.downloads

import android.content.Context
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import java.io.File
import java.security.MessageDigest
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.json.JSONObject

// This probe verifies the packaged runtime before search/download work is enabled.
// Initialization is explicit: app startup never extracts or replaces tool files.
object EngineRuntime {
    @Volatile var status = "not-prepared"
        private set
    @Volatile var error: String? = null
        private set
    @Volatile private var preparedTools: List<JSObject> = emptyList()

    fun tools(): JSArray = JSArray().apply {
        val prepared = preparedTools.associateBy { it.getString("name") }
        listOf("python", "yt-dlp", "ffmpeg", "ffprobe", "quickjs").forEach { name ->
            put(prepared[name] ?: JSObject().apply {
                put("name", name)
                put("version", JSONObject.NULL)
                put("sha256", JSONObject.NULL)
                put("ready", false)
            })
        }
    }

    @Synchronized
    fun prepare(context: Context) {
        if (status == "ready") return
        check(status != "preparing") { "Araç hazırlığı zaten sürüyor." }
        status = "preparing"
        error = null
        preparedTools = emptyList()
        try {
            val manifest = context.assets.open("android-tools/manifest.json").bufferedReader().use { JSONObject(it.readText()) }
            val nativeRoot = File(context.applicationInfo.nativeLibraryDir)
            val baseRoot = File(context.noBackupFilesDir, "youtubedl-android")
            YoutubeDL.init(context)
            FFmpeg.init(context)

            // Upstream 0.18.1 omits libc++_shared.so from FFmpeg's extracted LD_LIBRARY_PATH.
            val cppRuntime = File(nativeRoot, "libc++_shared.so")
            val cppTarget = File(baseRoot, "packages/ffmpeg/usr/lib/libc++_shared.so")
            if (!cppTarget.exists()) cppRuntime.copyTo(cppTarget)
            check(hash(cppTarget) == hash(cppRuntime)) { "FFmpeg C++ çalışma zamanı uyuşmuyor." }

            val ytDlp = File(baseRoot, "yt-dlp/yt-dlp")
            check(hash(ytDlp) == manifest.getJSONObject("ytDlp").getString("sha256")) { "yt-dlp paketinin SHA-256 değeri uyuşmuyor." }
            val environment = mapOf(
                "LD_LIBRARY_PATH" to "${File(baseRoot, "packages/python/usr/lib")}:${File(baseRoot, "packages/ffmpeg/usr/lib")}:$nativeRoot",
                "PYTHONHOME" to File(baseRoot, "packages/python/usr").absolutePath,
                "SSL_CERT_FILE" to File(baseRoot, "packages/python/usr/etc/tls/cert.pem").absolutePath,
                "TMPDIR" to context.cacheDir.absolutePath,
            )
            val pythonVersion = version(File(nativeRoot, "libpython.so"), "--version", environment)
            val pythonMatch = Regex("Python (\\d+)\\.(\\d+)").find(pythonVersion)
                ?: kotlin.error("Python sürümü okunamadı.")
            val pythonMajor = pythonMatch.groupValues[1].toInt()
            val pythonMinor = pythonMatch.groupValues[2].toInt()
            check(pythonMajor > 3 || (pythonMajor == 3 && pythonMinor >= 11)) { "Python 3.11 veya üzeri gerekli." }
            val versionRequest = YoutubeDLRequest(emptyList<String>()).addOption("--ignore-config").addOption("--version")
            val ytDlpVersion = YoutubeDL.execute(versionRequest, UUID.randomUUID().toString(), null).out.trim()
            check(ytDlpVersion == manifest.getJSONObject("ytDlp").getString("version")) { "yt-dlp sürümü paket kaydıyla uyuşmuyor." }
            preparedTools = listOf(
                tool("python", pythonVersion, File(nativeRoot, "libpython.zip.so")),
                tool("yt-dlp", ytDlpVersion, ytDlp),
                tool("ffmpeg", version(File(nativeRoot, "libffmpeg.so"), "-version", environment), File(nativeRoot, "libffmpeg.zip.so")),
                tool("ffprobe", version(File(nativeRoot, "libffprobe.so"), "-version", environment), File(nativeRoot, "libffprobe.so")),
                tool("quickjs", version(File(nativeRoot, "libqjs.so"), "--help", environment), File(nativeRoot, "libqjs.so")),
            )
            status = "ready"
        } catch (failure: Exception) {
            status = "failed"
            error = "Android indirme araçları doğrulanamadı: ${failure.message}"
            throw IllegalStateException(error, failure)
        }
    }

    private fun tool(name: String, version: String, file: File) = JSObject().apply {
        put("name", name)
        put("version", version)
        put("sha256", hash(file))
        put("ready", true)
    }

    private fun hash(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(65536)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    fun environment(context: Context): Map<String, String> {
        check(status == "ready") { "Önce indirme araçlarını doğrulayın." }
        val baseRoot = File(context.noBackupFilesDir, "youtubedl-android")
        return mapOf(
            "LD_LIBRARY_PATH" to "${File(baseRoot, "packages/python/usr/lib")}:${File(baseRoot, "packages/ffmpeg/usr/lib")}:${context.applicationInfo.nativeLibraryDir}",
            "PYTHONHOME" to File(baseRoot, "packages/python/usr").absolutePath,
            "SSL_CERT_FILE" to File(baseRoot, "packages/python/usr/etc/tls/cert.pem").absolutePath,
            "TMPDIR" to context.cacheDir.absolutePath,
            "PATH" to "/system/bin:${context.applicationInfo.nativeLibraryDir}",
            "PYTHONDONTWRITEBYTECODE" to "1",
            "PYTHONUNBUFFERED" to "1",
        )
    }

    fun execute(
        context: Context, request: YoutubeDLRequest, directory: File,
        cancellation: ToolCancellation, onLine: (String) -> Unit = {},
    ): ToolResult {
        val nativeRoot = File(context.applicationInfo.nativeLibraryDir)
        val ytDlp = File(context.noBackupFilesDir, "youtubedl-android/yt-dlp/yt-dlp")
        request.addOption("--ignore-config")
            .addOption("--no-cache-dir")
            .addOption("--no-js-runtimes")
            .addOption("--js-runtimes", "quickjs:${File(nativeRoot, "libqjs.so")}")
            .addOption("--ffmpeg-location", File(nativeRoot, "libffmpeg.so").absolutePath)
            .addOption("--socket-timeout", "15")
            .addOption("--retries", "2")
            .addOption("--fragment-retries", "2")
        val arguments = listOf(File(nativeRoot, "libpython.so").absolutePath, ytDlp.absolutePath) + request.buildCommand()
        return ToolProcess.run(arguments, environment(context), directory, cancellation, 600, onLine)
    }

    private fun version(executable: File, argument: String, environment: Map<String, String>): String {
        val builder = ProcessBuilder(executable.absolutePath, argument).redirectErrorStream(true)
        builder.environment().putAll(environment)
        val process = builder.start()
        val reader = Executors.newSingleThreadExecutor()
        try {
            val output = reader.submit<String> {
                process.inputStream.bufferedReader().use { input ->
                    val result = StringBuilder()
                    while (true) {
                        val line = input.readLine() ?: break
                        check(result.length + line.length < 65536) { "Araç sürüm çıktısı beklenenden büyük." }
                        result.append(line).append('\n')
                    }
                    result.toString()
                }
            }.get(15, TimeUnit.SECONDS)
            val exitCode = process.waitFor()
            // This QuickJS build exits with 1 for --help even when it starts successfully.
            val quickJsHelp = executable.name == "libqjs.so" && argument == "--help" &&
                Regex("^QuickJS version \\d{4}-\\d{2}-\\d{2}").containsMatchIn(output) &&
                output.contains("usage: qjs") && exitCode == 1
            check(exitCode == 0 || quickJsHelp) { "${executable.name} başlatılamadı: ${output.take(300)}" }
            return output.lineSequence().firstOrNull { it.isNotBlank() } ?: kotlin.error("Araç sürümü boş.")
        } finally {
            process.destroy()
            reader.shutdownNow()
        }
    }
}
