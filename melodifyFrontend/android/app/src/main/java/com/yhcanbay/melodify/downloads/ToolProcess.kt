package com.yhcanbay.melodify.downloads

import android.os.ParcelFileDescriptor
import android.os.SystemClock
import java.io.File
import java.util.concurrent.CancellationException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

class ToolCancellation {
    private val canceled = AtomicBoolean(false)
    private val processId = AtomicInteger(0)

    fun cancel() {
        canceled.set(true)
        val pid = processId.get()
        if (pid != 0) NativeProcess.stopGroup(pid)
    }

    fun isCanceled() = canceled.get()
    fun throwIfCanceled() { if (isCanceled()) throw CancellationException("İşlem iptal edildi.") }
    fun attach(pid: Int) { processId.set(pid); if (canceled.get()) NativeProcess.stopGroup(pid) }
    fun detach() { processId.set(0) }
}

data class ToolResult(val exitCode: Int, val output: String, val error: String, val processId: Int)

object ToolProcess {
    private val readers = Executors.newCachedThreadPool()
    private val timers = Executors.newSingleThreadScheduledExecutor()

    fun run(
        arguments: List<String>, environment: Map<String, String>, directory: File,
        cancellation: ToolCancellation, timeoutSeconds: Long = 180,
        onLine: (String) -> Unit = {},
    ): ToolResult {
        cancellation.throwIfCanceled()
        val handles = NativeProcess.spawn(
            arguments.map { it.toByteArray(Charsets.UTF_8) }.toTypedArray(),
            environment.map { (key, value) -> "$key=$value".toByteArray(Charsets.UTF_8) }.toTypedArray(),
            directory.absolutePath.toByteArray(Charsets.UTF_8),
        )
        val pid = handles[0]
        val output = ParcelFileDescriptor.AutoCloseInputStream(ParcelFileDescriptor.adoptFd(handles[1]))
        val error = ParcelFileDescriptor.AutoCloseInputStream(ParcelFileDescriptor.adoptFd(handles[2]))
        val timedOut = AtomicBoolean(false)
        val deadline = timers.schedule({ timedOut.set(true); NativeProcess.stopGroup(pid) }, timeoutSeconds, TimeUnit.SECONDS)
        cancellation.attach(pid)
        fun collect(input: ParcelFileDescriptor.AutoCloseInputStream) = readers.submit<String> {
            try {
                input.bufferedReader(Charsets.UTF_8).use { source ->
                    val result = StringBuilder()
                    while (true) {
                        val line = source.readLine() ?: break
                        check(result.length + line.length < 4 * 1024 * 1024) { "Araç çıktısı beklenenden büyük." }
                        result.append(line).append('\n')
                        onLine(line)
                    }
                    result.toString()
                }
            } catch (failure: Exception) {
                NativeProcess.stopGroup(pid)
                throw failure
            }
        }
        val stdout = collect(output)
        val stderr = collect(error)
        try {
            val exitCode = NativeProcess.waitExit(pid)
            // Never leave grandchildren running after the Python process exits.
            NativeProcess.stopGroup(pid)
            val result = ToolResult(exitCode, stdout.get(10, TimeUnit.SECONDS), stderr.get(10, TimeUnit.SECONDS), pid)
            val stopDeadline = SystemClock.elapsedRealtime() + 5000
            while (NativeProcess.groupAlive(pid) && SystemClock.elapsedRealtime() < stopDeadline) Thread.sleep(20)
            check(!NativeProcess.groupAlive(pid)) { "Aracın alt süreçleri durdurulamadı." }
            cancellation.throwIfCanceled()
            check(!timedOut.get()) { "Araç işlemi zaman aşımına uğradı." }
            return result
        } finally {
            deadline.cancel(false)
            cancellation.detach()
            NativeProcess.release(pid)
            output.close()
            error.close()
        }
    }
}
