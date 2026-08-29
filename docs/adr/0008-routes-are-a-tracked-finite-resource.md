# Routes are authored once in PLACES.md and tracked as a finite, claimable resource

Loci only work when the underlying place is deeply familiar, which means the app cannot invent one — the user must supply it. And reusing a Route across several Palaces is the classic failure of the technique: images from the old set bleed into the new ones at the same Locus. So Routes are a finite resource that has to be tracked, not an infinite supply.

`PLACES.md` lives at the app root, authored by the user, holding several Routes as ordered lists of Loci. The app copies it into each Workspace on creation, because Claude cannot read above its working directory. Each Palace claims exactly one Route, permanently.

The app is the authority on claims, since claims are global across Workspaces and Claude can only see its own. The app therefore writes claim status into each Workspace's copy of `PLACES.md`, and warns as free Routes run low. Claude never decides which Route is free; it reads what the app has already marked.

Consequence: `PLACES.md` copies can drift from the root file. The app owns reconciliation, and the root file is always the source of truth for Route *content* while the app is always the source of truth for Route *claims*.
