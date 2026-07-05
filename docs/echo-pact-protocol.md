# EchoPact Protocol Specification

## 1. Overview

EchoPact defines a versioned application protocol layered on top of a transport carrier such as ggwave-over-audio, relay, or WebRTC data channels.

The protocol is designed for short, reliable, low-bandwidth messages exchanged between two agent peers during the EchoPact mode.

## 2. Goals

- Provide stable framing for short payloads
- Support sequence numbers and acknowledgements
- Support retransmission for dropped or corrupted packets
- Enable transport fallback without changing the application payload model
- Keep the protocol simple enough for embedded/audio-friendly carriers

## 3. Transport Model

The protocol sits above the carrier and below the higher-level application layer.

Supported carriers:
- ggwave-over-audio
- relay HTTP fallback
- WebRTC data channels (future extension)

## 4. Message Format

Each frame is encoded as a UTF-8 JSON object with the following structure:

```json
{
  "v": 1,
  "type": "data",
  "sid": "session-abc123",
  "seq": 12,
  "ack": 11,
  "ackRequired": true,
  "retry": 0,
  "payload": "Hello"
}
```

### Fields

- `v`: protocol version, currently `1`
- `type`: one of `data`, `ack`, `error`, `handshake`
- `sid`: session-scoped transport ID
- `seq`: monotonically increasing sequence number for the sender
- `ack`: the highest sequence number the sender has received from the peer
- `ackRequired`: requests an acknowledgement for the current frame
- `retry`: retry count for the current packet
- `payload`: UTF-8 string payload

## 5. Framing Policy

- Each application message is wrapped into a single protocol frame
- The carrier should treat each frame as atomic
- Frames should be small and plain-text JSON to remain compatible with low-bandwidth carriers

## 6. Reliability Policy

### 6.1 Sequence numbers

- Each peer maintains its own local sequence counter
- Sequence numbers start at `1`
- Each outgoing frame increments the local `seq`

### 6.2 Acknowledgements

- When `ackRequired` is `true`, the receiver responds with an `ack` frame
- The `ack` frame contains the latest sequence number received from the peer

### 6.3 Retries

- If a sender does not receive an acknowledgement within a timeout window, it retries the frame up to a maximum of `3`
- Retries increment `retry`
- The receiver must ignore duplicate frames with the same `seq` and `sid`

### 6.4 Error handling

- If a frame cannot be parsed or is malformed, the receiver sends an `error` frame with a short error string
- If the session is unknown or expired, the receiver may reject the frame

## 7. Session Model

Each session has:
- a transport session ID (`sid`)
- a sender/receiver pair
- a sequence window for duplicate filtering

The sid is generated per session and should be rotated when the transport session is reset.

## 8. Application Layer Mapping

Higher-level application messages are passed through the protocol as `type: "data"` frames.

Example:
- application payload: `"is it better now?"`
- protocol frame: `{"v":1,"type":"data","sid":"...","seq":1,"ack":0,"ackRequired":true,"retry":0,"payload":"is it better now?"}`

## 9. Security Notes

- The protocol is not a replacement for the identity handshake
- It assumes the transport has already been authorized by the capability-token handshake
- The session ID should be bound to the signed handshake context
