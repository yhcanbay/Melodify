package com.yhcanbay.melodify.library

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.DocumentsContract
import android.util.LruCache
import java.io.ByteArrayOutputStream

object CoverCache {
    private const val MAX_IMAGE_BYTES = 4 * 1024 * 1024
    private val cache = object : LruCache<String, ByteArray>(8 * 1024 * 1024) {
        override fun sizeOf(key: String, value: ByteArray) = value.size
    }

    @Synchronized
    fun read(context: Context, trackId: String): ByteArray? {
        val track = LibraryRepository.track(trackId) ?: return null
        if (track.missing) return null
        val library = LibraryRepository.library(track.libraryId) ?: return null
        if (LibraryScanner(context).access(library) != "granted") return null
        val key = "${track.id}:${track.modifiedTimeMs}:${track.sizeBytes}"
        cache.get(key)?.let { return it }
        val retriever = MediaMetadataRetriever()
        val embedded = try {
            retriever.setDataSource(context, Uri.parse(track.contentUri))
            retriever.embeddedPicture
        } catch (_: Exception) { null }
        finally { retriever.release() }
        val source = embedded?.takeIf { it.size <= MAX_IMAGE_BYTES } ?: sidecar(context, library.treeUri, track.parentDocumentId, track.fileName)
            ?: return null
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(source, 0, source.size, bounds)
        if (bounds.outWidth !in 1..16384 || bounds.outHeight !in 1..16384) return null
        val options = BitmapFactory.Options()
        while (maxOf(bounds.outWidth, bounds.outHeight) / options.inSampleSize.coerceAtLeast(1) > 768) {
            options.inSampleSize = options.inSampleSize.coerceAtLeast(1) * 2
        }
        val bitmap = BitmapFactory.decodeByteArray(source, 0, source.size, options) ?: return null
        try {
            val scale = minOf(1.0, 384.0 / maxOf(bitmap.width, bitmap.height))
            val scaled = if (scale < 1) Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).toInt().coerceAtLeast(1), (bitmap.height * scale).toInt().coerceAtLeast(1), true) else bitmap
            try {
                val result = ByteArrayOutputStream().use { output -> scaled.compress(Bitmap.CompressFormat.JPEG, 88, output); output.toByteArray() }
                if (result.size > MAX_IMAGE_BYTES) return null
                cache.put(key, result)
                return result
            } finally { if (scaled !== bitmap) scaled.recycle() }
        } finally { bitmap.recycle() }
    }

    private fun sidecar(context: Context, treeUri: String, parent: String, fileName: String): ByteArray? {
        val tree = Uri.parse(treeUri)
        val stem = fileName.substringBeforeLast('.')
        val names = listOf("$stem.jpg", "$stem.jpeg", "$stem.png", "cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "folder.png")
        val candidates = mutableMapOf<String, String>()
        val children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent)
        context.contentResolver.query(children, arrayOf(DocumentsContract.Document.COLUMN_DOCUMENT_ID, DocumentsContract.Document.COLUMN_DISPLAY_NAME), null, null, null)?.use {
            while (it.moveToNext()) {
                val name = it.getString(1)
                names.firstOrNull { candidate -> candidate.equals(name, true) }?.let { key -> candidates[key] = it.getString(0) }
            }
        }
        for (name in names) {
            val id = candidates[name] ?: continue
            val uri = DocumentsContract.buildDocumentUriUsingTree(tree, id)
            val result = context.contentResolver.openInputStream(uri)?.use { input ->
                val output = ByteArrayOutputStream()
                val buffer = ByteArray(16384)
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    if (output.size() + count > MAX_IMAGE_BYTES) return@use null
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
            if (result != null) return result
        }
        return null
    }
}
