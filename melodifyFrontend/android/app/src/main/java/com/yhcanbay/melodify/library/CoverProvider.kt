package com.yhcanbay.melodify.library

import android.content.ContentProvider
import android.content.ContentValues
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.FileNotFoundException
import java.util.concurrent.Executors

class CoverProvider : ContentProvider() {
    private val writer = Executors.newSingleThreadExecutor()
    override fun onCreate() = true
    override fun getType(uri: Uri) = "image/jpeg"

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        if (mode != "r") throw FileNotFoundException("Kapak yalnızca okunabilir.")
        val id = uri.lastPathSegment ?: throw FileNotFoundException("Parça kimliği eksik.")
        val data = CoverCache.read(requireNotNull(context), id) ?: throw FileNotFoundException("Kapak bulunamadı.")
        val pipe = ParcelFileDescriptor.createPipe()
        writer.execute { runCatching { ParcelFileDescriptor.AutoCloseOutputStream(pipe[1]).use { it.write(data) } } }
        return pipe[0]
    }

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
        val columns = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        return MatrixCursor(columns).apply {
            addRow(columns.map { if (it == OpenableColumns.DISPLAY_NAME) "cover.jpg" else null })
        }
    }
    override fun insert(uri: Uri, values: ContentValues?): Uri = throw UnsupportedOperationException("Salt okunur.")
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?) = throw UnsupportedOperationException("Salt okunur.")
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?) = throw UnsupportedOperationException("Salt okunur.")
}
