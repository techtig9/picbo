# Phase 5 — AI Engine, Provider Router, Jobs & Credits

Implemented:
- provider abstraction
- Gemini REST adapter for chat/copy/analysis
- fal.ai REST adapter for image/image-edit
- configurable model registry
- free/low-cost-first routing for eligible Gemini tasks
- provider fallback architecture
- task/quality routing contracts
- AI generation jobs
- job status/progress
- provider attempts schema
- idempotency keys
- credit ledger
- atomic credit reservation
- automatic credit refund on failed generation
- AI generation API route
- real Image Studio request path
- provider configuration status helper
- server-only provider keys
- production-oriented failure handling

Important:
- "Free model" availability and quotas are controlled by the provider and can change. The router never assumes a provider is free forever.
- The current Gemini adapter is intentionally text/analysis focused; image/video adapters are added when their exact provider APIs are wired in later creative phases.
- The current fal adapter handles image/image-edit. Video generation is intentionally deferred to the dedicated video phase.
