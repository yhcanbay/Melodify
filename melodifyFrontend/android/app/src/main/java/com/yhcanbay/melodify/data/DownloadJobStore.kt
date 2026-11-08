package com.yhcanbay.melodify.data

import android.content.Context
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import java.util.concurrent.Executors
import org.json.JSONObject

object DownloadJobStore {
    private val writer = Executors.newSingleThreadExecutor()
    private val activeStages = setOf("queued", "preparing", "downloading", "converting", "saving", "canceling")

    fun load(context: Context): List<JSObject> {
        val dao = MelodifyDatabase.get(context).melodify()
        return dao.downloadJobs().reversed().map { entity ->
            val payload = JSObject(entity.payload)
            if (entity.stage in activeStages) {
                payload.put("stage", "interrupted")
                payload.put("error", "Önceki uygulama oturumu kapandı. İş otomatik başlatılmadı.")
                dao.saveDownloadJob(DownloadJobEntity(entity.id, "interrupted", payload.toString(), System.currentTimeMillis()))
            }
            payload
        }
    }

    fun save(context: Context, jobs: JSArray, onError: (String) -> Unit) {
        val payload = jobs.toString()
        writer.execute {
            try {
                val dao = MelodifyDatabase.get(context).melodify()
                val records = JSArray(payload)
                for (index in 0 until records.length()) {
                    val job = records.getJSONObject(index)
                    val id = job.getString("id")
                    if (dao.downloadJob(id)?.payload != job.toString()) {
                        dao.saveDownloadJob(DownloadJobEntity(id, job.getString("stage"), job.toString(), System.currentTimeMillis()))
                    }
                }
            } catch (failure: Exception) { onError("İndirme geçmişi kaydedilemedi: ${failure.message}") }
        }
    }

    fun savePlayback(context: Context, payload: JSObject, onError: (String) -> Unit) {
        val value = payload.toString()
        writer.execute {
            try {
                val record = JSONObject(value).put("kind", "probe")
                MelodifyDatabase.get(context).melodify().savePlaybackRecovery(PlaybackRecoveryEntity(id = "probe", payload = record.toString(), updatedAt = System.currentTimeMillis()))
            } catch (failure: Exception) { onError("Oynatma konumu kaydedilemedi: ${failure.message}") }
        }
    }
}
