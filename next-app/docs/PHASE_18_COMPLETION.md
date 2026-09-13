# Phase 18 — AI Provider Routing, Credits & Monetization Foundation

Implemented:
- Task-aware AI provider router
- Free → standard → premium provider tiers
- Gemini Free as the first default chat/copy/storyboard route
- Provider priority and task capability model
- Retryable provider error catalog
- Credit cost catalog
- Credit balance checks
- AI provider discovery API
- AI routing/credit preflight API
- Credits balance API
- Workspace credit ledger table
- AI usage event table
- Provider configuration table
- Encrypted API-secret helper using AES-256-GCM
- Premium video provider slot kept disabled until a real provider/API is configured

Important:
The code does NOT invent or hard-code a fake "FLAP" provider. A real provider can be connected through the provider configuration layer once its exact API is selected. Free limits must be respected and paid fallbacks should only run when enabled and the workspace has sufficient credits.
