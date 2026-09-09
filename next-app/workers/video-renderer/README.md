# Picbo Video Render Worker

Production boundary for Phase 10.

Responsibilities:
1. Lease a queued `render_jobs` row.
2. Create short-lived signed download URLs for input assets.
3. Build the composition manifest.
4. Run FFmpeg inside a worker/container (never the Next.js request).
5. Mix music/voice-over and burn captions.
6. Upload the final MP4 to Supabase Storage.
7. Write `render_media` and render output metadata.
8. Mark the render complete.
9. On failure, mark failed and trigger the credit-refund path.

Required runtime:
- FFmpeg installed in the worker image.
- Supabase service-role credentials supplied only as worker secrets.
- A queue or polling mechanism.
- Enough ephemeral disk for intermediate files.

The worker must never return service-role keys or permanent storage credentials to the browser.
