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
  loadTrackPayload: (filePath) => electron.ipcRenderer.invoke("library:load-track-payload", filePath)
});
