type Subscription = { remove(): Promise<void> }

export function manageSubscriptions(registrations: Promise<Subscription>[], onError: (error: unknown) => void) {
  let disposed = false
  const handles = new Set<Subscription>()
  for (const registration of registrations) {
    void registration.then((handle) => {
      if (disposed) {
        void handle.remove().catch(onError)
      } else {
        handles.add(handle)
      }
    }).catch((error) => { if (!disposed) onError(error) })
  }
  return () => {
    if (disposed) return
    disposed = true
    for (const handle of handles) void handle.remove().catch(onError)
    handles.clear()
  }
}
