import { useEffect } from 'react'
import { useStore } from '../state/store'
import { captureManager } from './capture'

/**
 * Shared listening controller. Transcription is started once; the microphone and system
 * audio capture channels are then driven *reactively* from settings, so toggling them in
 * Settings takes effect immediately (start/stop the live audio graph) rather than only
 * on relaunch.
 */
export function useListening(): {
  transcribing: boolean
  start: () => Promise<void>
} {
  const { state, dispatch } = useStore()
  const micOn = state.settings?.microphoneEnabled !== false
  const sysOn = !!state.settings?.systemAudioEnabled
  const sysSupported = !!state.status?.platform.systemAudio.supported

  async function start(): Promise<void> {
    await window.clueless.transcription.start()
  }

  // Microphone: follow the setting while transcribing.
  useEffect(() => {
    if (!state.transcribing || !state.settings) return
    if (micOn) {
      captureManager.startMicrophone().catch((err) => {
        dispatch({
          type: 'banner',
          banner: { kind: 'error', text: `Microphone unavailable: ${String(err)}. Grant access in System Settings.` }
        })
        void window.clueless.platform.openPermissionSettings('microphone')
      })
    } else {
      captureManager.stop('me')
    }
  }, [micOn, state.transcribing, state.settings, dispatch])

  // System audio: follow the setting while transcribing (if the platform supports it).
  useEffect(() => {
    if (!state.transcribing || !state.settings) return
    if (sysOn && sysSupported) {
      captureManager.startSystemAudio().catch((err) => {
        dispatch({
          type: 'banner',
          banner: {
            kind: 'error',
            text: `System audio unavailable: ${String(err)}. Grant Screen Recording permission.`
          }
        })
        void window.clueless.platform.openPermissionSettings('screen')
      })
    } else {
      captureManager.stop('them')
    }
  }, [sysOn, sysSupported, state.transcribing, state.settings, dispatch])

  return { transcribing: state.transcribing, start }
}
