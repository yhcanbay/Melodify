import type { MobileSnapshot } from '../../../src/shared/mobile.ts'

export type SnapshotState = {
  phase: 'loading' | 'ready' | 'error'
  snapshot: MobileSnapshot | null
  error: string | null
}

// Each refresh reads the entire native state. Older responses cannot overwrite newer ones.
export function createSnapshotStore(read: () => Promise<MobileSnapshot>, describeError: (error: unknown) => string) {
  let state: SnapshotState = { phase: 'loading', snapshot: null, error: null }
  let generation = 0
  let disposed = false
  const listeners = new Set<() => void>()
  function publish(next: SnapshotState) {
    if (disposed) return
    state = next
    for (const listener of listeners) listener()
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async refresh() {
      if (disposed) return
      const request = ++generation
      publish({ ...state, phase: 'loading', error: null })
      try {
        const snapshot = await read()
        if (request === generation) publish({ phase: 'ready', snapshot, error: null })
      } catch (error) {
        if (request === generation) publish({ ...state, phase: 'error', error: describeError(error) })
      }
    },
    dispose() {
      disposed = true
      generation++
      listeners.clear()
    },
  }
}
