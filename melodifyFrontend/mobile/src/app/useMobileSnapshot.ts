import { useCallback, useEffect, useState } from 'react'
import type { MobilePlatform } from '../platform/contracts'
import { describePlatformError } from '../platform/errors'
import { createSnapshotStore } from '../platform/snapshotStore'
import type { SnapshotState } from '../platform/snapshotStore'

export function useMobileSnapshot(platform: MobilePlatform) {
  const [state, setState] = useState<SnapshotState>({ phase: 'loading', snapshot: null, error: null })
  const [connectionAttempt, setConnectionAttempt] = useState(0)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)

  useEffect(() => {
    const store = createSnapshotStore(() => platform.readSnapshot(), describePlatformError)
    let active = true
    setSubscriptionError(null)
    const refresh = () => { void store.refresh() }
    const unsubscribeStore = store.subscribe(() => setState(store.getSnapshot()))
    const unsubscribePlatform = platform.subscribe(refresh, (error) => {
      if (active) setSubscriptionError(describePlatformError(error))
    })
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    refresh()
    return () => {
      active = false
      unsubscribePlatform()
      unsubscribeStore()
      store.dispose()
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [platform, connectionAttempt])

  const refresh = useCallback(() => setConnectionAttempt((attempt) => attempt + 1), [])
  return { ...state, subscriptionError, refresh, connectionAttempt }
}
