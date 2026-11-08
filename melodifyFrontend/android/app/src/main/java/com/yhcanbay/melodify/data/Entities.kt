package com.yhcanbay.melodify.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "libraries", indices = [Index(value = ["treeUri"], unique = true)])
data class LibraryEntity(
    @PrimaryKey val id: String,
    val treeUri: String,
    val name: String,
    val selected: Boolean,
    val access: String,
    val scannedAt: Long?,
)

@Entity(
    tableName = "tracks",
    indices = [Index("libraryId"), Index(value = ["libraryId", "documentId"], unique = true)],
    foreignKeys = [ForeignKey(entity = LibraryEntity::class, parentColumns = ["id"], childColumns = ["libraryId"])],
)
data class TrackEntity(
    @PrimaryKey val id: String,
    val libraryId: String,
    val documentId: String,
    val parentDocumentId: String,
    val contentUri: String,
    val fileName: String,
    val relativePath: String,
    val title: String,
    val artist: String?,
    val durationMs: Long?,
    val youtubeId: String?,
    val modifiedTimeMs: Long,
    val sizeBytes: Long,
    val missing: Boolean,
)

@Entity(tableName = "download_jobs", indices = [Index("updatedAt")])
data class DownloadJobEntity(
    @PrimaryKey val id: String,
    val stage: String,
    val payload: String,
    val updatedAt: Long,
)

@Entity(tableName = "playback_recovery")
data class PlaybackRecoveryEntity(
    @PrimaryKey val id: String = "current",
    val payload: String,
    val updatedAt: Long,
)
