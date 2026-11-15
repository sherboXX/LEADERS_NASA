# Freefall

Fire behaves differently in space. Freefall turns twenty NASA microgravity fire experiments
into labs you can run in a browser, ranks them by how much they matter for crew fire
safety, and shows where each result applies on the Space Station.

**Live site:** https://sherboxx.github.io/LEADERS_NASA/

Team LEADERS, NASA Space Apps. The measurements come from NASA's Physical Sciences
Informatics (PSI) database; the tables the team collected are in the other folders of this
repository.

## What is here

| Page | What it is |
|---|---|
| `application/index.html?start` | Where the site opens: the 3D station you can turn, a guide you can ask about fire in space, and two tabs, Experiments and Application |
| `index.html#experiments` | The 20 experiments, ranked by fire-safety relevance, filtered by Prevention, Detection, Suppression |
| `droplet.html?exp=flex` | Droplet labs: FLEX, FLEX-2, CFI |
| `lab.html?engine=solid&exp=saffire2` | Every other lab (engines: solid, smoke, jet, burner) |
| `application/index.html?exp=flex` | The station view: where that experiment matters on the ISS |
| `architecture.html` | How the system fits together and how it was built |

## Run it on your computer

You need Python 3. From this folder:

```
python tools/serve.py
```

then open http://127.0.0.1:8765/. On Windows, double-click `start.bat` instead. Any static
web server works too (`python -m http.server`); `serve.py` only adds the optional link to
ChatGPT for the guide.

The guide answers from built-in rules by default. To let it use ChatGPT, paste an OpenAI
key in Settings (it stays in your browser), or set `OPENAI_API_KEY` before starting
`serve.py`. For every visitor of the live site to get ChatGPT answers, switch on the shared
proxy described in [tools/ai-proxy/README.md](tools/ai-proxy/README.md). The key is never
stored in this repository.

## Check it

You need Node.js 18 or later.

```
node tools/check_model.mjs    # droplet model over all 261 FLEX tests
node tools/check_labs.mjs     # the other four models over a grid of settings
node tools/check_guide.mjs    # the guide's answers and sketches
node tools/check_site.mjs     # every experiment wired: gallery, lab, station view
node tools/validate.mjs       # models against NASA measurements (see docs/VALIDATION.md)
```

and open `tools/sweep.html` in the browser to load every page and report any that fail.

## More

- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md): how the code is laid out, how to add an experiment, how to publish
- [docs/VALIDATION.md](docs/VALIDATION.md): how far each model can be trusted
- `architecture.html`: the system as a flow chart, and how it was programmed

## Credits

- Experiment data: NASA Physical Sciences Informatics.
- 3D engine: [Three.js](https://threejs.org) (MIT licence), kept in `vendor/three`.
- Fonts: Oxanium, Exo 2, Inter and Poppins (SIL Open Font Licence), kept in `vendor/fonts`;
  see `vendor/fonts/NOTICE.md`.
- Earth image in the station view: NASA Blue Marble, from Wikimedia Commons.
- The lab code was written with an AI coding assistant (Claude Code) under the team's
  direction. The guide can optionally use ChatGPT to word its answers; the numbers always
  come from Freefall's own models.
