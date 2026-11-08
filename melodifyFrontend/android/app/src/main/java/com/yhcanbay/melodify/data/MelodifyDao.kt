package com.yhcanbay.melodify.data

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Upsert

@Dao
abstract class MelodifyDao {
    @Query("SELECT * FROM libraries WHERE selected = 1 LIMIT 1")
    abstract fun selectedLibrary(): LibraryEntity?

    @Query("SELECT * FROM libraries WHERE treeUri = :uri LIMIT 1")
    abstract fun libraryByUri(uri: String): LibraryEntity?

    @Query("SELECT * FROM libraries WHERE id = :id LIMIT 1")
    abstract fun library(id: String): LibraryEntity?

    @Query("UPDATE libraries SET selected = 0 WHERE selected = 1")
    abstract fun clearSelection()

    @Upsert
    abstract fun saveLibrary(library: LibraryEntity)

    @Transaction
    open fun selectLibrary(library: LibraryEntity) {
        clearSelection()
        saveLibrary(library.copy(selected = true))
    }

    @Query("SELECT * FROM tracks WHERE libraryId = :libraryId ORDER BY relativePath COLLATE NOCASE, id")
    abstract fun tracks(libraryId: String): List<TrackEntity>

    @Query("SELECT * FROM tracks WHERE id = :id LIMIT 1")
    abstract fun track(id: String): TrackEntity?

    @Query("UPDATE tracks SET missing = 1 WHERE libraryId = :libraryId")
    abstract fun markTracksMissing(libraryId: String)

    @Upsert
    abstract fun saveTracks(tracks: List<TrackEntity>)

    @Transaction
    open fun replaceIndex(library: LibraryEntity, tracks: List<TrackEntity>) {
        markTracksMissing(library.id)
        saveTracks(tracks)
        saveLibrary(library.copy(access = "granted", scannedAt = System.currentTimeMillis()))
    }

    @Upsert
    abstract fun saveDownloadJob(job: DownloadJobEntity)

    @Query("SELECT * FROM download_jobs WHERE id = :id LIMIT 1")
    abstract fun downloadJob(id: String): DownloadJobEntity?

    @Query("SELECT * FROM download_jobs ORDER BY updatedAt DESC LIMIT 100")
    abstract fun downloadJobs(): List<DownloadJobEntity>

    @Upsert
    abstract fun savePlaybackRecovery(recovery: PlaybackRecoveryEntity)

    @Query("SELECT * FROM playback_recovery WHERE id = :id")
    abstract fun playbackRecovery(id: String): PlaybackRecoveryEntity?
}
