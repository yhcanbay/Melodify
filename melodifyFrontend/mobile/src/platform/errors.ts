export class MobilePlatformError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'MobilePlatformError'
  }
}

export function describePlatformError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Uygulamaya bağlanılamadı. Lütfen tekrar deneyin.'
}
