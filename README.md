# KiPo

A Kiro Crew app that runs Matt Pocock's engineering skills over your repos. A conductor
agent runs each effort through seven stations, one per KiPo skill: Intake, Shape, Grill,
Plan, Build, Review and Done. Tickets live in GitHub Issues, each thread gets its own
conversation running the right skills, and open wayfinder maps can be added as efforts.
See CONTRACT.md.

Forked from Launchpad (same plumbing, a different model).

![KiPo board](docs/kipo-board.png)

## Install

You need:

- [Kiro Crew](https://kiro.dev/crew) 0.13.0 or later, signed in to Kiro
- The GitHub CLI, signed in: `gh auth login`

Matt Pocock's skills come bundled (a pinned copy of v1.3.2 in `vendor/mattpocock-skills`,
MIT-licensed, credited there). To use your own copy instead, set `KIPO_SKILLS_DIR`.

Then:

```bash
kirocrew app install https://github.com/masterphelps/kipo.git --ref main
```

The app installs disabled, and Crew won't run a third-party app's code until you trust it.
Open the Crew dashboard's App Store, find KiPo, review its permissions and turn it on
(`kirocrew app enable` is refused for untrusted apps). KiPo then appears in the sidebar. Add a repo from KiPo's page to start an effort.

## Update

Installed from the git URL, KiPo updates with:

```bash
kirocrew app update kipo
```

If that reports nothing new, pull its checkout first (the install prints the path) and run it again.

## Developing

The built UI bundle (`ui/dist/index.mjs`) is committed so installs don't need a build.
After changing `ui/src`, rebuild it (`cd ui && npm install && npm run build`), bump
`version` in `app.json`, and commit both. Backend tests: `cd backend/tests && python3 -m unittest`.

## License

Apache-2.0 (see `LICENSE`). The bundled skills in `vendor/mattpocock-skills` are Matt Pocock's, under their own MIT license.
