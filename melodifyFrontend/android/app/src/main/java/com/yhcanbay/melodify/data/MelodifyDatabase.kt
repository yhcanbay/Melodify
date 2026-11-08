package com.yhcanbay.melodify.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [LibraryEntity::class, TrackEntity::class, DownloadJobEntity::class, PlaybackRecoveryEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class MelodifyDatabase : RoomDatabase() {
    abstract fun melodify(): MelodifyDao

    companion object {
        @Volatile private var instance: MelodifyDatabase? = null

        fun get(context: Context): MelodifyDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, MelodifyDatabase::class.java, "melodify-mobile.db")
                // Never enable destructive migration or main-thread queries.
                .build().also { instance = it }
        }
    }
}
