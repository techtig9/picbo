# Phase 6 — AI Photoshoot + Image Studio

Implemented:
- Photoshoot request domain
- Shot types: studio, lifestyle, ecommerce, closeup, detail, packaging, hero, social
- Aspect ratio controls: 1:1, 4:5, 3:4, 9:16, 16:9
- Scene direction
- Lighting and camera direction contracts
- Variant count
- Product identity protection
- Photoshoot database
- Shot-item database
- Asset version lineage
- RLS for creative studio records
- Product selector API
- Photoshoot API
- Real job/credit/provider path reuse
- Image Studio generate/edit mode foundation
- Provider-backed generation path
- Credit/error handling
- Production-oriented prompt builder

Intentional boundary:
- Exact provider-specific image edit, inpainting, outpainting, background removal and upscale APIs remain behind the common task contract and will be wired to the appropriate providers as their dedicated operations are enabled. The UI does not pretend these operations are complete.
