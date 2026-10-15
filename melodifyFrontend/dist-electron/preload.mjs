"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("melodifyApi", {
  pickLibrary: () => electron.ipcRenderer.invoke("library:pick-folder"),
  loadLastLibrary: () => electron.ipcRenderer.invoke("library:load-last"),
  loadLastDownloadFolder: () => electron.ipcRenderer.invoke("library:load-last-download-folder"),
  pickDownloadFolder: () => electron.ipcRenderer.invoke("library:pick-download-folder"),
  searchTracks: (request) => electron.ipcRenderer.invoke("yt-dlp:search", request),
  updateYtDlp: () => electron.ipcRenderer.invoke("yt-dlp:update"),
  downloadTrack: (request) => electron.ipcRenderer.invoke("yt-dlp:download", request),
  loadTrackPayload: (filePath) => electron.ipcRenderer.invoke("library:load-track-payload", filePath),
  loadTrackCover: (filePath) => electron.ipcRenderer.invoke("library:load-track-cover", filePath),
  loadTracksCovers: (filePaths) => electron.ipcRenderer.invoke("library:load-tracks-covers", filePaths),
  loadPlaylists: (folderPath) => electron.ipcRenderer.invoke("playlists:load-all", folderPath),
  savePlaylist: (folderPath, playlist) => electron.ipcRenderer.invoke("playlists:save", folderPath, playlist),
  deletePlaylist: (folderPath, playlistId) => electron.ipcRenderer.invoke("playlists:delete", folderPath, playlistId),
  exportLibrary: () => electron.ipcRenderer.invoke("library:export"),
  importAnalyze: () => electron.ipcRenderer.invoke("library:import-analyze"),
  importDownloadMissing: (missingTracks, cookiesFromBrowser, allowSearchForMissingUrl) => electron.ipcRenderer.invoke(
    "library:import-download",
    missingTracks,
    cookiesFromBrowser,
    allowSearchForMissingUrl
  ),
  setMediaControlState: (state) => electron.ipcRenderer.send("media:state", state),
  onMediaCommand: (callback) => {
    const listener = (_event, command) => {
      callback(command);
    };
    electron.ipcRenderer.on("media:command", listener);
    return () => {
      electron.ipcRenderer.removeListener("media:command", listener);
    };
  },
  onImportProgress: (callback) => {
    const listener = (_event, progress) => {
      callback(progress);
    };
    electron.ipcRenderer.on("import:progress", listener);
    return () => {
      electron.ipcRenderer.removeListener("import:progress", listener);
    };
  }
});
