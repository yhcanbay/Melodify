package com.yhcanbay.melodify.downloads

import android.content.Context
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import java.io.File
import java.util.UUID
import java.util.concurrent.CancellationException
import java.util.concurrent.CompletableFuture
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.json.JSONObject

object ProcessCancellationProbe {
    fun verify(context: Context): JSObject {
        val work = File(context.cacheDir, "melodify-engine-probe/cancel-${UUID.randomUUID()}")
        check(work.mkdirs()) { "Deneme çalışma alanı oluşturulamadı." }
        val nativeRoot = File(context.applicationInfo.nativeLibraryDir)
        val ffmpeg = File(nativeRoot, "libffmpeg.so").absolutePath
        val quickjs = File(nativeRoot, "libqjs.so").absolutePath
        val script = File(work, "cancellation.py")
        script.writeText("""
            import json, os, subprocess, sys, time
            children = [
                subprocess.Popen([sys.argv[1], '-nostdin', '-v', 'error', '-re', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-f', 'null', '-'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL),
                subprocess.Popen([sys.argv[2], '-e', 'while (true) {}'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            ]
            time.sleep(0.15)
            if any(child.poll() is not None for child in children):
                raise RuntimeError('A child did not remain running')
            print(json.dumps({'python': os.getpid(), 'ffmpeg': children[0].pid, 'quickjs': children[1].pid}), flush=True)
            time.sleep(120)
        """.trimIndent())
        val cancellation = ToolCancellation()
        val started = CompletableFuture<JSONObject>()
        val worker = Executors.newSingleThreadExecutor()
        val task = worker.submit {
            try {
                val result = ToolProcess.run(
                    listOf(File(nativeRoot, "libpython.so").absolutePath, script.absolutePath, ffmpeg, quickjs),
                    EngineRuntime.environment(context), work, cancellation, 20,
                ) { line -> if (line.startsWith("{\"python\"")) started.complete(JSONObject(line)) }
                kotlin.error("İptal denemesi erken sonlandı (${result.exitCode}): ${result.error.take(1000)}")
            } catch (expected: CancellationException) {
                // Expected only after all processes have actually stopped.
            } catch (failure: Exception) {
                started.completeExceptionally(failure)
                throw failure
            }
        }
        try {
            val processIds = started.get(10, TimeUnit.SECONDS)
            val names = listOf("python", "ffmpeg", "quickjs")
            check(names.all { running(processIds.getInt(it)) }) { "Deneme süreçleri birlikte çalışmıyor." }
            cancellation.cancel()
            task.get(10, TimeUnit.SECONDS)
            check(names.none { running(processIds.getInt(it)) }) { "İptalden sonra çalışan alt süreç kaldı." }
            return JSObject().apply {
                put("allProcessesStopped", true)
                put("processes", JSArray(names))
                put("processIds", processIds)
            }
        } finally {
            cancellation.cancel()
            worker.shutdown()
        }
    }

    private fun running(pid: Int): Boolean {
        val stat = runCatching { File("/proc/$pid/stat").readText() }.getOrNull() ?: return false
        val state = stat.substringAfterLast(") ").firstOrNull()
        return state != null && state != 'Z' && state != 'X'
    }
}
