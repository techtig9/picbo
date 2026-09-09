# Phase 11 — Real Worker Queue & FFmpeg Execution

Implemented:
- Atomic Postgres render-job claiming with `FOR UPDATE SKIP LOCKED`
- Worker leases and stale-job recovery
- Attempt counters and retry limit
- Real FFmpeg process execution inside the worker
- MP4 encoding with H.264/AAC/yuv420p/faststart
- Progress events
- Failure/retry handling
- Worker health/status endpoint
- Worker environment template
- Service-role-only queue claim function
- Temporary-file cleanup

Important:
- The worker only runs with service-role secrets in its private environment.
- No service-role secret is exposed to the browser.
- Phase 11 deliberately requires a local input asset for its minimal executable FFmpeg path and requires an output storage bucket to be configured. Remote asset downloading, full multi-scene composition, audio mixing, captions, transitions, and final storage upload should be wired next rather than being falsely marked complete.
