# Phase 7 — Ad Studio

Implemented:
- Ad brief domain
- Performance objectives
- Platform selection
- Static/carousel/story/short formats
- Platform specifications
- Audience, offer, hook, tone and CTA controls
- Multi-variant generation
- Product-aware ad copy prompting
- Safety against invented product facts and fake claims
- Ad brief persistence
- Ad variant persistence
- Ad export persistence
- RLS and workspace isolation
- Ad Studio UI
- Product selector
- Real AI job/credit/provider routing for copy generation

Important boundary:
- This phase creates the ad intelligence and content pipeline. Exact final image composition/export rendering and platform-specific video rendering are handled by the rendering/video phases rather than pretending a text-generation call is a finished ad asset.
