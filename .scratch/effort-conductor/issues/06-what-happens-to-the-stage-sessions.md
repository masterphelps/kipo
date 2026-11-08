# What happens to the stage skills and their sessions?

Type: grilling
Status: open
Blocked by: 02
Map: [Each effort has a conductor](../map.md)

## Question

Today the effort's conversation runs a different skill per stage: `kipo-intake`, `kipo-shape`, `kipo-plan`, `kipo-build`, `kipo-review`, `kipo-done`. With a conductor, decide for each skill whether it:

- folds into the conductor (its judgment becomes the conductor's job),
- becomes the seed of a worker session the conductor starts (e.g. review and merge one PR), or
- goes away.

Also decide what replaces the per-stage state files (`.kipo/<n>/state.json`) for the conductor's own conversation, and what the conductor writes there.
