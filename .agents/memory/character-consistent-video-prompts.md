---
name: Character-consistent video prompts
description: How to preserve Chichi's exact black-and-white markings across generated mission videos.
---

Define every required white marking positively and separately from every forbidden white marking. For Chichi, keep the white muzzle pads, isolated chest patch, and four sock tips explicit while independently requiring a solid-black nose bridge and forehead.

**Why:** Broad negative instructions such as “no white face stripe” can remove the required white muzzle as well. Repeated text-to-video generations also drift between a stylized black coat and a realistic gray coat even when the action prompt is unchanged.

**How to apply:** Generate a single calibration clip first. Compare early, middle, and final contact-sheet frames against the character sheet, then reuse the successful character block for the remaining clips. Reject clips with marking drift even when the mission action is correct.