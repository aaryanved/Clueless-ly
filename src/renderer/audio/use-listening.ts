import { useStore } from '../state/store'
import { captureManager } from './capture'

/**
 * Shared listening controller: starts/stops the transcription engine and the browser
 * audio graph (microphone + optional system audio) together, with friendly permission
 * errors surfaced as banners. Used by the top-bar toggle.
 */
export function useListening(): {
  transcribing: boolean
  start: () => Promise<void>
  toggle: () => void
} {
  const { state, dispatch } = useStore()
  const settings = state.settings

  async function start(): Promise<void> {
    await window.clueless.transcription.start()
    if (settings?.microphoneEnabled !== false) {
      try {
        await captureManager.startMicrophone()
      } catch (err) {
        dispatch({
          type: 'banner',
          banner: { kind: 'error', text: `Microphone unavailable: ${String(err)}. Grant access in System Settings.` }
        })
        void window.clueless.platform.openPermissionSettings('microphone')
      }
    }
    if (settings?.systemAudioEnabled && state.status?.platform.systemAudio.supported) {
      try {
        await captureManager.startSystemAudio()
      } catch (err) {
        dispatch({
          type: 'banner',
          banner: {
            kind: 'error',
            text: `System audio unavailable: ${String(err)}. Grant Screen Recording permission.`
          }
        })
        void window.clueless.platform.openPermissionSettings('screen')
      }
    }
  }

  async function stop(): Promise<void> {
    captureManager.stopAll()
    await window.clueless.transcription.stop()
  }

  function toggle(): void {
    const run = state.transcribing ? stop() : start()
    run.catch((err) =>
      dispatch({ type: 'banner', banner: { kind: 'error', text: `Transcription: ${String(err)}` } })
    )
  }

  return { transcribing: state.transcribing, start, toggle }
}
