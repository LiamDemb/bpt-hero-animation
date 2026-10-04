Beacon Proton Therapy Hero Animation
---

The project for creating Beacon Proton Therapy's website hero animation.

Run the editor with `make run` or `npm run dev`.

## Embed export

Before exporting embeds (or after changing simulation code), build the embed runtime:

```bash
npm run build:embed
```

In the editor, use **Export embed** or **Copy embed**. The result is a self-contained snippet: a div, scoped styles, and the animation script. Paste it into an HTML block on the page. It does not include a document, `html`, or `body` rules, so it will not lock the rest of the page’s scroll.

Give the parent a size (hero section, iframe, or embed widget). The snippet fills that slot (`width`/`height` 100%). If the parent has width but no height, height comes from the project frame aspect ratio. The animation covers the box like `object-fit: cover`. `data-frame-width` and `data-frame-height` match Width and Height in the editor.

## Video export

MP4 and WebM exports use the canvas encoder and write to `exports/` when using the dev server.
