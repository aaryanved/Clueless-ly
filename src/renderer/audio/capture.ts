// Only microphone ('me') and system audio ('them') are captured as audio sources.
type CaptureRole = 'me' | 'them'

// The Realtime API consumes mono PCM16 at 24 kHz. We request a 24 kHz AudioContext
// (Chromium honours the requested sample rate) so no manual resampling is needed, then
// convert Float32 frames to little-endian Int16 before pushing to the main process.
const TARGET_SAMPLE_RATE = 24000

function floatToPcm16(input: Float32Array): ArrayBuffer {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out.buffer
}

interface Channel {
  stream: MediaStream
  ctx: AudioContext
  source: MediaStreamAudioSourceNode
  processor: ScriptProcessorNode
  sink: GainNode
}

/**
 * Owns the browser-side audio graph for each speaker role. 'me' is the microphone;
 * 'them' is system audio (started in the macOS system-audio batch). Both feed PCM16
 * chunks to main via the preload bridge.
 */
export class CaptureManager {
  private channels = new Map<CaptureRole, Channel>()

  isCapturing(role: CaptureRole): boolean {
    return this.channels.has(role)
  }

  async startMicrophone(): Promise<void> {
    if (this.channels.has('me')) return
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false
    })
    this.wire('me', stream)
  }

  async startSystemAudio(): Promise<void> {
    if (this.channels.has('them')) return
    // The main process grants system (loopback) audio via setDisplayMediaRequestHandler.
    const stream = await navigator.mediaDevices.getDisplayMedia({
      audio: true,
      video: true
    })
    // We only want the audio; stop the video track immediately to avoid overhead.
    for (const track of stream.getVideoTracks()) track.stop()
    if (stream.getAudioTracks().length === 0) {
      throw new Error('No system audio track was provided by the OS.')
    }
    this.wire('them', stream)
  }

  private wire(role: CaptureRole, stream: MediaStream): void {
    const ctx = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })
    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    // A muted sink keeps the graph pulling without playing audio back to the user.
    const sink = ctx.createGain()
    sink.gain.value = 0

    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      const pcm = floatToPcm16(input)
      void window.clueless.transcription.pushAudio(role, pcm)
    }

    source.connect(processor)
    processor.connect(sink)
    sink.connect(ctx.destination)

    this.channels.set(role, { stream, ctx, source, processor, sink })
  }

  stop(role: CaptureRole): void {
    const ch = this.channels.get(role)
    if (!ch) return
    ch.processor.disconnect()
    ch.source.disconnect()
    ch.sink.disconnect()
    for (const track of ch.stream.getTracks()) track.stop()
    void ch.ctx.close()
    this.channels.delete(role)
  }

  stopAll(): void {
    for (const role of [...this.channels.keys()]) this.stop(role)
  }
}

export const captureManager = new CaptureManager()
