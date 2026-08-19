---
name: No WebGL in sandbox browsers
description: Headless/screenshot browsers here cannot create a WebGL context; how to verify 3D work anyway.
---

Screenshot captures and Playwright-driven testing sessions in this workspace run
in browsers with no WebGL context. Only the workspace preview pane the user
looks at gets one.

**Why:** the sandbox browsers have no GPU and no SwiftShader fallback, so a
three.js scene never renders for the agent. Repeated screenshot attempts just
burn time and produce a blank or fallback panel.

**How to apply:** verify 3D work on the CPU instead.
- three.js itself runs fine under Node — only `WebGLRenderer` needs a GPU. Build
  the real scene, walk it, and read `geometry`/`matrixWorld` directly.
- `tsx` runs the game's TypeScript modules unchanged, so the offline tool and the
  game share one source of truth rather than a re-implementation that drifts.
- `GLTFLoader` still throws in Node whenever a model carries a texture (it reaches
  for `self`/`document`). Strip textures first by reading the GLB with
  `@gltf-transform/core` and disposing every texture — geometry survives, which is
  all a placement check needs.
- A tiny software rasteriser (z-buffer + flat lambert + hand-rolled PNG chunks) is
  enough to judge framing, occlusion, scale and placement.
- Numbers beat eyeballs: printing world-space bounding boxes in real-world units
  catches "the model is invisible" and "this prop is three times too big" faster
  than staring at a render.
- Anything about materials, lighting, shadows or animation still needs the user's
  eyes on the preview. Say so instead of claiming it looks right.
