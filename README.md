# ECHOPACT

ECHOPACT is a voice-first multi-agent communication platform built with Next.js, TypeScript, and browser audio transport. It extends the original GibberLink-style concept into a more structured system for agent-to-agent communication with handshake verification, transport fallback, protocol framing, room coordination, observability, and adaptive transport monitoring.

> Ownership notice: This repository is owned and maintained by Usman Amin. The current implementation has been substantially reworked, expanded, and adapted from the original GibberLink concept and related open-source components.

## Overview

ECHOPACT combines:
- voice-based agent interaction,
- a capability handshake layer,
- a lightweight transport protocol,
- multi-agent room coordination,
- live observability and dashboard views,
- and a provider-based chat backend.

The project is designed as a modular foundation for future expansion into richer multi-agent, multi-device, and production-grade communication flows.

## Key features

### 1. Voice-first agent interaction
- Supports conversational voice sessions through a provider abstraction.
- Integrates with ElevenLabs-style voice providers and a reusable provider interface.
- Includes microphone permission handling and audio visualization.

### 2. Handshake and identity verification
- Implements a signed capability-token handshake for agent authorization.
- Verifies peer identity before enabling transport features.

### 3. Adaptive transport system
- Supports audio transport, relay fallback, and a future-ready WebRTC path.
- Includes transport negotiation and monitoring for degraded reliability.
- Can switch modes automatically based on observed channel quality.

### 4. Reliable protocol layer
- Implements a lightweight application protocol with:
  - sequence numbers,
  - acknowledgements,
  - duplicate suppression,
  - retry tracking,
  - and payload fragmentation support.

### 5. Multi-agent room coordination
- Supports room creation, participant joining, leaving, role changes, and lifecycle updates.
- Provides a service-oriented model for future persistence support.

### 6. Observability and coordinator dashboard
- Presents live status for transport mode, handshake state, protocol health, participants, warnings, and recent events.
- Gives coordinators a clear view of the active session without exposing low-level internals.

### 7. Provider-based chat backend
- Routes chat generation through a provider abstraction.
- Supports multiple LLM providers when configured.
- Provides safe fallback behavior if providers are unavailable.

## Project structure

- src/components: UI and conversation experience
- src/app/api: API routes for chat, handshake, rooms, and transport helpers
- src/lib: core domain logic for protocol, transport, rooms, observability, and providers
- src/utils: browser audio utilities
- docs: protocol documentation

## Tech stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Web Audio / ggwave-based transport concepts
- Jest for automated testing

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Copy the example environment file:

```bash
cp example.env .env
```

4. Configure the required environment variables in .env
5. Start the development server:

```bash
npm run dev
```

## Environment variables

The project expects configuration values such as:
- API keys for supported voice or LLM providers
- handshake secret values for signed verification
- optional public endpoint configuration for real-time providers

Refer to example.env for the available placeholders.

## Verification

The current implementation has been verified with:

```bash
npm test -- --runInBand
```

and a TypeScript compile check:

```bash
npx tsc --noEmit
```

## Status

The current version includes the major feature areas requested for the project roadmap:
- LLM chat backend
- persistent multi-agent room system
- reliable transport protocol
- live observability dashboard
- adaptive transport fallback monitoring

These features are implemented and verified in the current workspace.

## Ownership

This repository is owned and maintained by Usman Amin.
