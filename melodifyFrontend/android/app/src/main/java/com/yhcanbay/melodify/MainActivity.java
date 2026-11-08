package com.yhcanbay.melodify;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.yhcanbay.melodify.bridge.MelodifyDownloadsPlugin;
import com.yhcanbay.melodify.bridge.MelodifyLibraryPlugin;
import com.yhcanbay.melodify.bridge.MelodifyPlaybackPlugin;
import com.yhcanbay.melodify.bridge.MelodifyPlaylistsPlugin;
import com.yhcanbay.melodify.bridge.MelodifySettingsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MelodifyLibraryPlugin.class);
        registerPlugin(MelodifyPlaybackPlugin.class);
        registerPlugin(MelodifyDownloadsPlugin.class);
        registerPlugin(MelodifyPlaylistsPlugin.class);
        registerPlugin(MelodifySettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
