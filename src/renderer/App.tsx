// Renderer root. The UI is a single-window React app inside the transparent overlay.
// `StoreProvider` owns all UI state (a reducer fed by main→renderer events); everything
// privileged goes through `window.clueless.*` (defined in src/preload). Start reading
// from OverlayShell for the layout, or state/store.tsx for the data flow.
import { StoreProvider } from './state/store'
import { OverlayShell } from './components/OverlayShell'

export function App(): JSX.Element {
  return (
    <StoreProvider>
      <OverlayShell />
    </StoreProvider>
  )
}
