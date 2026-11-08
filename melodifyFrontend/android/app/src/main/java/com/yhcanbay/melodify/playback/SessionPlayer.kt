package com.yhcanbay.melodify.playback

import androidx.media3.common.ForwardingSimpleBasePlayer
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import com.yhcanbay.melodify.downloads.ProbePlayback

@UnstableApi
class SessionPlayer(player: Player, private val engine: NativePlayback) : ForwardingSimpleBasePlayer(player) {
    override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
        if (playWhenReady) ProbePlayback.pause()
        return super.handleSetPlayWhenReady(playWhenReady)
    }

    override fun getState(): State {
        val state = super.getState()
        val commands = state.availableCommands.buildUpon()
            .remove(Player.COMMAND_CHANGE_MEDIA_ITEMS).remove(Player.COMMAND_SET_MEDIA_ITEM)
            .remove(Player.COMMAND_SET_REPEAT_MODE).remove(Player.COMMAND_SET_SHUFFLE_MODE)
        if (state.playlist.isNotEmpty()) commands.addAll(
            Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
            Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
        )
        return state.buildUpon().setAvailableCommands(commands.build()).build()
    }

    override fun handleSeek(mediaItemIndex: Int, positionMs: Long, seekCommand: Int): ListenableFuture<*> {
        when (seekCommand) {
            Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM -> engine.next()
            Player.COMMAND_SEEK_TO_PREVIOUS, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM -> engine.previous()
            Player.COMMAND_SEEK_TO_MEDIA_ITEM -> engine.selectPhysical(mediaItemIndex, positionMs)
            else -> return super.handleSeek(mediaItemIndex, positionMs, seekCommand)
        }
        return Futures.immediateVoidFuture()
    }
}
