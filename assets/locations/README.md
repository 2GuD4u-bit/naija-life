# Abuja location assets

Important landmarks and venues are built as reusable Three.js location assets by the procedural builders in `js/three-world.js`. `js/world.js` holds each place's world coordinates, dimensions, asset key, collision, interaction point, road links, rotation, scale, and level-of-detail ranges.

## Add a location

1. Add a uniquely identified entry to the location definitions in `js/world.js`, including its `x`, `y`, `type`, and `asset` fields.
2. Add an entry to `G.world.assetManifest` when it needs a specialized builder. Use an existing builder or register one with `G.world.registerAssetBuilder(name, builder)` in `js/three-world.js`.
3. A builder receives its chunk group, the location definition, and rendering helpers. Add its geometry to the supplied group so chunk streaming can manage it.
4. Set realistic dimensions and an interaction point. The shared location registry supplies collision bounds, default LOD distances, and a road-link list.
5. Move an existing place with `G.world.repositionLocation(id, { x, y, rotation, scale })`. The renderer discards affected chunks so the asset is rebuilt at its new location.

Locations without a specialized builder use the category-aware architectural builder. The renderer streams 800 m chunks, uses detailed-to-simplified LODs, and instances repeated homes, trees, road markings, and streetlights.

## Coordinate and scale conventions

- World coordinates and dimensions are metres; `x` is east/west and `y` is north/south.
- Three.js maps world `y` to its horizontal `z` axis; height is Three.js `y`.
- Location rotation is in radians. Scale is a uniform multiplier.
- Keep detailed geometry local to the location origin so rotation and scale remain predictable.
