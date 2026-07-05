import { EventEmitter } from 'events';
import { negotiateTransport, parseTransportMessage, buildTransportMessage, type TransportCapability, type TransportMode } from '@/lib/transport';
import { buildAckFrame, buildDataFrame, createProtocolSession, decodeFrame, encodeFrame, receiveFrame, type ProtocolSessionState } from '@/lib/protocol';

export const audioMessageEmitter = new EventEmitter();

// Utility for handling audio messages
let context: AudioContext | null = null;
let ggwave: any = null;
let instance: any = null;
let inputContext: AudioContext | null = null;
let inputStream: MediaStream | null = null;
let analyserNode: AnalyserNode | null = null;

// Global state for recording
let mediaStreamInstance: MediaStream | null = null;
let mediaStream: MediaStreamAudioSourceNode | null = null;
let recorder: ScriptProcessorNode | null = null;
let isRecording = false;
let activeTransportMode: TransportMode = 'audio';
let transportCapabilities: TransportCapability = { audio: true, webrtc: false, relay: true };
let relayRoomId: string | null = null;
let relayAgentId: string | null = null;
let protocolSession: ProtocolSessionState | null = null;
let remoteProtocolSessionId: string | null = null;

// Helper function to convert array types
function convertTypedArray(src: any, type: any) {
  const buffer = new ArrayBuffer(src.byteLength);
  new src.constructor(buffer).set(src);
  return new type(buffer);
}

export function getggwave() {
  return ggwave;
}

export function getinputContext() {
  return inputContext;
}

export function getinputStream() {
  return inputStream;
}

export function getinstance() {
  return instance;
}

export function getcontext(): AudioContext | null {
  return context;
}

export function getIsRecording(): boolean {
  return isRecording;
}

export async function stopRecording(): Promise<void> {
  if (!isRecording) return;

  if (recorder && context) {
    recorder.disconnect(context.destination);
    if (mediaStream) mediaStream.disconnect(recorder);
    recorder = null;
  }

  // Stop all tracks in the media stream
  if (mediaStreamInstance) {
    mediaStreamInstance.getTracks().forEach(track => track.stop());
    mediaStreamInstance = null;
  }
  mediaStream = null;
  isRecording = false;

  audioMessageEmitter.emit('recordingStateChanged', false);
}

export async function setTransportCapabilities(capabilities: Partial<TransportCapability>): Promise<void> {
  transportCapabilities = { ...transportCapabilities, ...capabilities };
  const plan = negotiateTransport(transportCapabilities);
  activeTransportMode = plan.mode;
  if (!protocolSession) {
    protocolSession = createProtocolSession(`sid-${myID}-${Date.now()}`);
  }
  audioMessageEmitter.emit('transportModeChanged', plan);
}

export function getActiveTransportMode(): TransportMode {
  return activeTransportMode;
}

export async function startRecording(): Promise<void> {
  if (isRecording) return;

  await initAudio();

  const constraints = {
    audio: {
      echoCancellation: false,
      autoGainControl: false,
      noiseSuppression: false,
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    mediaStreamInstance = stream;
    
    if (!context) {
      throw new Error('Audio context not initialized');
    }
    
    if (context.state === 'suspended') {
      await context.resume();
    }
    
    mediaStream = context.createMediaStreamSource(stream);
    const bufferSize = 1024;
    const numberOfInputChannels = 1;
    const numberOfOutputChannels = 1;

    recorder = context.createScriptProcessor(
      bufferSize,
      numberOfInputChannels,
      numberOfOutputChannels
    );

    if (!recorder) return;

    recorder.onaudioprocess = async (e: AudioProcessingEvent) => {
      const instance = getinstance(); 
      if (!getggwave()) {
        console.error('Audio processing failed: ggwave or instance not initialized', {instance, context: getcontext(), ggwave: getggwave()});
        return;
      }
      const sourceBuf = e.inputBuffer.getChannelData(0);
      const res = getggwave().decode(
        instance,
        convertTypedArray(new Float32Array(sourceBuf), Int8Array)
      );

      if (res && res.length > 0) {
        let text = new TextDecoder("utf-8").decode(res);
        console.log('MESSAGE RECEIVED!', text)
        // Parse ID from text and ignore messages from self
        if (text.startsWith(`${myID}$`)) {
          console.log("ignoring message from self", text);
          return;
        }
        // Remove any ID prefix if present
        text = text.includes('$') ? text.split('$').slice(1).join('$') : text;
        const parsed = parseTransportMessage(text);
        if (parsed) {
          const frame = decodeFrame(parsed.payload);
          if (frame) {
            if (!protocolSession) {
              protocolSession = createProtocolSession(frame.sid);
            }
            const result = receiveFrame(protocolSession, frame);
            if (frame.type === 'data' && result.ackFrame) {
              await sendAudioMessage(encodeFrame(result.ackFrame), false);
            }
            if (frame.type === 'data') {
              audioMessageEmitter.emit('recordingMessage', frame.payload);
              return;
            }
            if (frame.type === 'ack') {
              return;
            }
          }
          audioMessageEmitter.emit('recordingMessage', parsed.payload);
          return;
        }
        audioMessageEmitter.emit('recordingMessage', text);
        
        // Auto-respond to ping/pong with number increments
        const match = text.trim().toLowerCase().match(/^(ping|pong)\s*(\d+)$/);
        if (match) {
          const [, type, num] = match;
          const nextNum = parseInt(num) + 1;
          const nextMessage = type === "ping" ? `pong ${nextNum}` : `ping ${nextNum}`;
          setTimeout(() => sendAudioMessage(nextMessage), 100);
        }
      }
    };

    if (mediaStream && recorder) {
      mediaStream.connect(recorder);
      recorder.connect(context.destination);
    }

    isRecording = true;
    audioMessageEmitter.emit('recordingStateChanged', true);
  } catch (err) {
    console.error(err);
    audioMessageEmitter.emit('recordingError', err);
  }
}

// Initialize audio context and ggwave instance
export async function initAudio(newInputContext?: AudioContext, newInputStream?: MediaStream): Promise<boolean> {
  if (newInputContext) {
    inputContext = newInputContext;
  }
  if (newInputStream) {
    inputStream = newInputStream;
  }
  try {
    if (!context) {
      context = new AudioContext({ sampleRate: 48000 });
    }

    
    if (!ggwave && window && (window as any).ggwave_factory) {
      ggwave = await (window as any).ggwave_factory();
      const parameters = ggwave.getDefaultParameters();
      parameters.sampleRateInp = context.sampleRate;
      parameters.sampleRateOut = context.sampleRate;
      parameters.soundMarkerThreshold = 4; //??
      console.log('parameters', parameters)

      instance = ggwave.init(parameters);
      console.log('ggwave initialized UTIL', {instance, ggwave});
    }

    return !!(context && ggwave);
  } catch (error) {
    console.error('Failed to initialize audio:', error);
    return false;
  }
}

export const myID = Math.random().toString(36).substring(2, 4).toUpperCase();

export function getAnalyserNode(): AnalyserNode | null {
  return analyserNode;
}

export function createAnalyserNode(): AnalyserNode | null {
  if (!context) return null;
  if (!analyserNode) {
    analyserNode = context.createAnalyser();
    analyserNode.fftSize = 2048;
  }
  return analyserNode;
}

// Send an audio message
export async function registerTransportRelay(roomId: string, agentId: string): Promise<void> {
  relayRoomId = roomId;
  relayAgentId = agentId;
  const response = await fetch('/api/transport-relay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'register',
      roomId,
      agentId,
      capabilities: transportCapabilities,
    }),
  });

  if (!response.ok) {
    return;
  }

  const data = await response.json();
  if (data.mode === 'relay') {
    activeTransportMode = 'relay';
    audioMessageEmitter.emit('transportModeChanged', { mode: 'relay', reason: 'relay fallback available' });
  }
}

export async function sendAudioMessage(message: string, fastest:boolean = false): Promise<boolean> {
  console.log('sendAudioMessage', message);
  try {
    if (activeTransportMode === 'relay') {
      const roomId = relayRoomId || 'echo-pact-default';
      const agentId = relayAgentId || myID;
      const response = await fetch('/api/transport-relay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          roomId,
          agentId,
          message: buildTransportMessage(encodeFrame(buildDataFrame(protocolSession || createProtocolSession(`sid-${agentId}-${Date.now()}`), message, true)), activeTransportMode, agentId),
        }),
      });
      if (!response.ok) {
        console.error('Relay fallback failed');
      }
      return response.ok;
    }

    if (!await initAudio() || !context || !ggwave) {
      console.error('Failed to send audio message: audio context or ggwave not initialized',
        {context, ggwave}
      );
      return false;
    }
    const session = protocolSession || createProtocolSession(`sid-${myID}-${Date.now()}`);
    protocolSession = session;
    const frame = buildDataFrame(session, message, true);
    const msg = `${myID}$${buildTransportMessage(encodeFrame(frame), activeTransportMode, myID)}`;

    const waveform = ggwave.encode(
      instance,
      msg,
      fastest ? ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST : ggwave.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FAST,
      10
    );

    const buf = convertTypedArray(waveform, Float32Array);
    const buffer = context.createBuffer(1, buf.length, context.sampleRate);
    buffer.getChannelData(0).set(buf);
    const source = context.createBufferSource();
    source.buffer = buffer;
    
    // If global analyser node exists, connect through it
    if (analyserNode) {
      source.connect(analyserNode);
      analyserNode.connect(context.destination);
    } else {
      source.connect(context.destination);
    }
    
    source.start(0);

    // Emit event for sent message
    audioMessageEmitter.emit('audioMessage', message);

    return true;
  } catch (error) {
    console.error('Failed to send audio message:', error);
    alert(error);
    return false;
  }
} 