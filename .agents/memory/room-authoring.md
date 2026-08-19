---
name: Hand-authored room over scanned GLB
description: Why the gas-safety game's room is code-authored data, and the rules that keeps it consistent.
---

The room is authored as plain data in the game source (shape list + collider
rectangles), not imported from a scanned GLB.

**Why:** a photogrammetry scan gave an uneven, noisy floor that the cat could not
walk on and that looked poor next to the reference illustration. Authored data
fixed both at once: a flat floor at y = 0, furniture footprints as exact
rectangles, and full control over the palette. It also removes a multi-megabyte
asset from the bundle.

**How to apply:**
- The layout data module must stay import-free (no three.js) so Node tools can
  import it directly and share one source of truth with the engine.
- Boxes are authored from their bottom face. A *rotated* cylinder is the trap:
  it lies down, so its y is a centre, not a base — authoring it from the base
  leaves it floating in mid-air.
- Scale convention: 1 unit = 4 m. Report sizes in cm when sanity-checking props,
  otherwise everything looks plausible and nothing is.
- Only the two walls the camera looks past exist; a dollhouse clip plane is
  therefore unnecessary.
- Prop, sticker and spawn coordinates are world units. After moving furniture,
  re-run the reachability validator — it flood-fills the floor from spawn and
  proves every objective and collectible can still be approached.
- Solid props declare their own footprint and join the room's collider set, so
  the same rectangles both stop the cat and are checked by the validator. The
  cat is a rotated rectangular body, not a point: collision must account for
  its current facing or it will clip through objects when turned. A footprint
  only works if the cat can still reach the prop: interaction radius plus the
  prop's reach must exceed the resulting clearance.
- Imported character animation can displace feet below the authored floor even
  after the bind pose is grounded. After applying animation and secondary
  motion, clamp the visual pivot above the root floor plane without changing
  the gameplay position.
- If the cat needs to be taller rather than larger, scale only its visual Y
  dimension after horizontal normalization. Enlarging all axes also enlarges
  the collision footprint and can close the room's narrow objective paths.
- A rotated piece of furniture needs an AABB grown by half*(|cos|+|sin|), not
  its unrotated half-size, or the cat walks into its exposed corners.
- Parts are positioned in world space with each mesh rotated on its own centre.
  For a rotated piece, offset its parts inside the piece's own frame first,
  otherwise backs and arms drift off the seat.
- Geometry/material caches belong to the group a build returns (disposed
  through it), never to the module — a module-wide cache lets one scene's
  teardown free another's GPU resources.
