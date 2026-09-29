Beacon Proton Therapy Hero Animation
---

The project for creating Beacon Proton Therapy's website hero animation.

Run the editor with `make run` or `npm run dev`.

## Embed export

Before exporting embeds (or after changing simulation code), build the embed runtime:

```bash
npm run build:embed
```

In the editor, use **Export embed** to write `exports/{name}.embed.html`, or **Copy embed** for a self-contained HTML snippet.

### Hosting on your site (iframe)

Size the iframe to match your layout. The embed fills the iframe and scales like **object-fit: cover** (same frame aspect as **Width** / **Height** in the editor). For a pixel-perfect match to the project frame, use the same aspect ratio (e.g. `3200 / 1080`).

```html
<iframe
  src="/media/wa-hero.embed.html"
  title="Beacon hero animation"
  width="100%"
  height="600"
  style="border:0;display:block;aspect-ratio:3200/1080"
  loading="lazy"
></iframe>
```

The exported HTML exposes `data-frame-width` and `data-frame-height` on `#bpt-hero` for CMS wiring.

Serve the file with `Content-Type: text/html`. Enable gzip or Brotli on your CDN for smaller transfers.

## Video export

MP4 and WebM exports use the canvas encoder and write to `exports/` when using the dev server.
