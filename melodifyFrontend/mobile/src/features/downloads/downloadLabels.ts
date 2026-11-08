import type { MobileDownloadJob } from '../../../../src/shared/mobile'

export const DOWNLOAD_STAGE_LABELS: Record<MobileDownloadJob['stage'], string> = {
  queued: 'Sırada', preparing: 'Hazırlanıyor', downloading: 'İndiriliyor', converting: 'MP3 ve kapak hazırlanıyor',
  saving: 'Klasöre kaydediliyor', canceling: 'İptal ediliyor', completed: 'Kaydedildi',
  failed: 'Tamamlanamadı', canceled: 'İptal edildi', interrupted: 'Kesintiye uğradı',
}

export function isDownloadActive(job: MobileDownloadJob) {
  return ['queued', 'preparing', 'downloading', 'converting', 'saving', 'canceling'].includes(job.stage)
}
