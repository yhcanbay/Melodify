import type { MobileDownloadJob, MobileDownloadsSnapshot } from '../../../../src/shared/mobile'
import { DOWNLOAD_STAGE_LABELS, isDownloadActive } from './downloadLabels'

export function DownloadJobCard({ job, playback, onCancel, onPlay, onPause }: {
  job: MobileDownloadJob
  playback: MobileDownloadsSnapshot['probePlayback']
  onCancel: () => void
  onPlay: () => void
  onPause: () => void
}) {
  const playing = playback.jobId === job.id && playback.isPlaying
  return (
    <article className="mobile-download-job" aria-label={job.title} data-job-id={job.id}>
      <strong>{job.title}</strong>
      <p role="status">{DOWNLOAD_STAGE_LABELS[job.stage]}</p>
      {isDownloadActive(job) && (
        <>
          <progress aria-label={`${job.title} indirme ilerlemesi`} max={100} value={job.stage === 'downloading' ? job.progress ?? undefined : undefined} />
          <button type="button" className="mobile-action-button" disabled={job.stage === 'canceling'} onClick={onCancel}>İptal et</button>
        </>
      )}
      {job.error && <p role="alert">{job.error}</p>}
      {job.validation && <p>MP3 · {job.validation.hasEmbeddedJpeg ? 'JPG kapak hazır' : 'Kapak yok'} · {Math.round(job.validation.durationMs / 1000)} sn</p>}
      {job.stage === 'completed' && (
        <button type="button" className="mobile-action-button" onClick={playing ? onPause : onPlay}>
          {playing ? 'Duraklat' : 'Kaydedilen dosyayı dinle'}
        </button>
      )}
      {playback.jobId === job.id && playback.durationMs > 0 && <p>{Math.floor(playback.positionMs / 1000)} / {Math.round(playback.durationMs / 1000)} sn</p>}
      {playback.jobId === job.id && playback.error && <p role="alert">{playback.error}</p>}
    </article>
  )
}
