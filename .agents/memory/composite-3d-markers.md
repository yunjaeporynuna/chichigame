---
name: Composite 3D markers
description: How gameplay marker animation should handle multi-mesh visual indicators.
---

When a gameplay marker is composed of multiple meshes, animate its transform on
the group and update color/emissive state by traversing its mesh children.

**Why:** assuming a marker itself has one material works only for a single mesh;
it crashes during the game loop after a visual redesign changes it into a group.

**How to apply:** keep marker lifecycle state on the root object, then iterate
its child meshes whenever changing material-driven effects such as glow,
color, or pulsing.