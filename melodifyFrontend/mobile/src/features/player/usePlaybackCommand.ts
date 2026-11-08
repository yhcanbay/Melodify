import { useState } from 'react'
import type { MobilePlaybackCommand } from '../../../../src/shared/mobile'
import { mobilePlatform } from '../../platform'
import { describePlatformError } from '../../platform/errors'

export function usePlaybackCommand() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function dispatch(command: MobilePlaybackCommand) {
    setPending(true)
    setError(null)
    try { await mobilePlatform.playback.dispatch(command) }
    catch (failure) { setError(describePlatformError(failure)) }
    finally { setPending(false) }
  }
  return { dispatch, pending, error }
}
