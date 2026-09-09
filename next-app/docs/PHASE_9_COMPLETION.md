# Phase 9 — Production Render Engine Architecture

Implemented:
- Provider-agnostic render contracts
- FFmpeg filter/command planning
- MP4/H.264/AAC/yuv420p/faststart output contract
- Render jobs and progress events
- Idempotent render requests
- Credit reservation before rendering
- Render status API
- Web-to-worker separation
- Failure-safe worker boundary

Important: FFmpeg is not executed inside a Next.js request handler. The worker intentionally fails closed until a real queue/container runtime is configured. This prevents fake completion and web-server timeouts.
