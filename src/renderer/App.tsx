import { StoreProvider } from './state/store'
import { OverlayShell } from './components/OverlayShell'

export function App(): JSX.Element {
  return (
    <StoreProvider>
      <OverlayShell />
    </StoreProvider>
  )
}
