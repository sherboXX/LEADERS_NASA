# Development notes

For anyone who picks this up: how the code is laid out, how to add to it, what to run
before publishing, and what was learned the hard way. `architecture.html` has the picture;
this file has the detail.

## Layout

```
index.html            the list of experiments (index.html#experiments), ranked from engines/catalog.js;
                      without that hash it forwards to application/index.html?start, the start:
                      the 3D station, the guide's chat box and two tabs (bridge.js, section 6)
droplet.html          droplet labs (FLEX, FLEX-2, CFI)
lab.html              every other lab: ?engine=solid|smoke|jet|burner&exp=<id>
architecture.html     how it fits together
application/          the station view (a hooked copy of the team's Freefall Fire Console)
engines/
  catalog.js          the 20 experiments: name, PSI number, pillar, relevance score, link
  core/               shared by every lab (see below)
  droplet/            model.js, scene.js, engine.js, brain.js
  solid|smoke|jet|burner/   model.js, scene.js, spec.js
data/                 flex.json, labs.json: written by tools/build_data.py, do not edit by hand
img/                  a still of the ISS, shown on the start screen while the 3D station loads
audio/                background music (see below)
tools/                build, check, serve and publish scripts
vendor/               Three.js r187 and the fonts
docs/                 these notes and the validation report
```

There is no build step and no package to install. Pages load ES modules directly and find
Three.js through the import map at the top of `droplet.html` and `lab.html`. Every path is
relative, so the site works from any folder on any static host.

### `engines/core/`

| File | Job |
|---|---|
| `stage.js` | Renderer, camera, orbit controls, bloom, 3D labels, depth pre-pass, automatic resolution drop on slow devices |
| `flame.js` | The flame renderer: steps along each line of sight and adds up light from a `field(p)` shader function |
| `parts.js` | Small helpers for building hardware (rods, boxes, coils, the chamber) |
| `shell.js`, `dock.js` | The page frame: brand, Experiment/Application tabs, the dock of panels, Settings |
| `lab.js` | Builds a whole lab page from a spec |
| `ask.js`, `guide.js`, `sketch.js` | The guide: question in, answer plus a chart or sketch out |
| `home.js` | The start screen's guide: built-in answers about fire in space, links to the matching experiments, the ChatGPT prompt |
| `intro.js` | The "steps" walkthrough shown before a lab |
| `prefs.js` | Saved settings (level, text size, hidden panels), in the browser only |
| `icons.js` | Every icon, as two-tone vector drawings |
| `ui.js`, `ui.css`, `chrome.css` | Controls, charts, and the shared look |

## How a lab works

Each experiment is described by three files that do one thing each.

- **`model.js`** is pure arithmetic. `plan(settings)` works out the whole run (how it ends,
  how long it takes, the key numbers) and `at(plan, t)` returns the state at time `t`. It
  never touches the page, so Node can run it. Keep it that way: the check scripts depend
  on it.
- **`scene.js`** builds the hardware once, then redraws from the state every frame. Scene
  units are centimetres; the flame field works in millimetres.
- **`spec.js`** lists the experiments on this engine, their controls, readings, chart,
  result text, guide answers and intro steps. `core/lab.js` turns it into the page.

The droplet engine is older and has its own `engine.js` in place of a spec, but follows the
same split.

### Add an experiment to an existing engine

1. Add it to the `spec.js` of that engine (copy a neighbour).
2. Add a line to `engines/catalog.js` with its PSI number, pillar and relevance score.
3. Add an entry to `application/experiments.js`: the zone on the station and the text shown
   there.
4. Run `node tools/check_site.mjs`. It fails until all three agree.

### Add an engine

Create `engines/<name>/` with `model.js`, `scene.js` and `spec.js`, add the name to the
`ENGINES` list in `lab.html`, add a grid for it in `tools/check_labs.mjs`, then add its
experiments as above.

### Data

`python tools/build_data.py` reads the PSI tables in the repository (`PSI-69`, `PSI-99`,
`PSI-10`, `PSI-159` and others) and rewrites `data/flex.json` (every FLEX test and the
fitted constants) and `data/labs.json` (logged tests for the other engines). Run it after
adding a table; never edit the JSON by hand.

## Interface rules

These came from review and apply everywhere.

- The audience is students as much as engineers. A lab opens calm: every panel is
  minimised behind a dock tab, with little text. Detail belongs behind the Advanced level.
- No emoji. Icons are drawn in `icons.js`; add new ones there in the same two-tone style.
- Text is Large by default and Extra large is the only other size. It is done with CSS
  zoom (`--z`), so any pixel position passed from JavaScript to CSS must be divided by
  `--z` (see `layout()` in `shell.js`).
- Colours: NASA red for actions, NASA blue for selection and data. Fonts: Oxanium for
  headings and numbers, Exo 2 for text.
- Every model is labelled "illustrative" in its Result tab, with what it was checked
  against. Keep that honest when a model changes.
- The guide never invents a number. ChatGPT (when a key is set) returns words and an
  instruction such as "plot burn rate against oxygen"; the curve is computed by the model.

## Before publishing

```
node tools/check_model.mjs
node tools/check_labs.mjs
node tools/check_guide.mjs
node tools/check_site.mjs
node tools/validate.mjs
```

All should report no problems. Then open `tools/sweep.html` on the local server: it loads
all 20 labs in turn and lists any that fail to start, draw, or find a file. Add `?app=1` to
include the station views.

## Publishing

```
python tools/publish.py "what changed" --push
```

The script builds two branches in the team repository without touching its checkout:

- `freefall-website`: `main` plus this folder as `firelab/`. This is the source. Merge it
  into `main` when the team is ready.
- `gh-pages`: this folder alone. GitHub Pages serves it at
  https://sherboxx.github.io/LEADERS_NASA/ a minute or so after the push.

It refuses to commit if anything outside `firelab/` would change, and never force-pushes.
The document links at the foot of `architecture.html` point at the `freefall-website`
branch on GitHub; change them to `main` once the branch is merged.
Files in `.gitignore` (an API key file, caches, private working notes) are left out.
After a publish, run the sweep on the live address as well: GitHub Pages is case-sensitive
about file names and Windows is not.

A hosted copy has no server, so the guide there uses the built-in answers unless a visitor
pastes their own key in Settings.

## AI guide routes

`engines/core/ask.js` asks, in order: a key pasted in Settings (sent straight to OpenAI);
the shared proxy at `AI_PROXY` in `engines/core/config.js` (`tools/ai-proxy/worker.js` on
Cloudflare, see its README); `tools/serve.py` when the page is served from this computer;
otherwise the built-in answers. A route that is missing or whose key is rejected is skipped
for the rest of the visit, and every request gives up after 30 s, so a deleted proxy only
means built-in answers. ChatGPT words answers and picks what to plot or open; numbers and
charts always come from the models.

## Background music

`engines/core/music.js` plays `audio/freefall-theme.m4a` (MP3 fallback beside it) on every
page at 10% volume. Browsers allow sound only after a click, tap or key press, so it fades in
on the first one. It pauses while the tab is hidden, resumes at the same point on the next
page (the position is kept in `sessionStorage`), stays silent inside iframes (the phone
preview and the page sweep), and is switched off with the speaker button in the top bar or in
Settings (`prefs.music`). Resuming needs a server that answers HTTP range requests: GitHub
Pages does, `tools/serve.py` does, `python -m http.server` does not (the music then restarts
on each page).

## Debugging

Every lab exposes `window.fireLab` in the console: `seek(t)`, `set({ g: 1 })`, `run()`,
`pause()`, `reset()`, `ask('...')`, `benchmark(n)` and `state` (settings, plan, and
`frameMs` with the frame time, pixel ratio, draw calls and triangles).

A browser tab that is in the background or driven by automation runs at about one frame a
second. Judge motion in a normal foreground tab; for stills, `fireLab.seek(t)` then look.

## Lessons from tuning the flame

Worth reading before changing `engines/droplet/scene.js`.

- **Colours in the shader are linear light.** An orange that looks right on screen is
  about `(1.0, 0.26, 0.015)`. Values that look orange as numbers come out cream.
- **The tone curve decides whether fire looks like fire.** Three.js's Neutral curve keeps
  the hue of bright light and fades it toward white. The droplet lab installs its own
  curve (top of `scene.js`) that eases each channel to 1 separately, so brightness runs
  red, orange, yellow, white. Below 0.75 it is identical to Neutral.
- **Bloom only spreads what is above its threshold.** At the usual 0.9 only the white core
  bloomed and washed out the colour around it. With the chamber dark the threshold drops
  to 0.28 so orange and blue glow in their own colour.
- **Blue over orange makes pink.** In a sooty flame the blue reaction sheet is drawn only
  at the limb; across the face it mixed with the glowing soot.
- **The scene has a front only.** It is built for the flight camera's view of the
  backplate, so orbiting is limited and the idle camera sways instead of circling.
- **Compare with footage, not with a description of it.** The FLEX scene was matched
  against frames of NASA's flight video, side by side.

## Known gaps

- Motion and frame rate have only been judged from stills and scripted checks; see
  `docs/VALIDATION.md`.
- A real phone has not been tested. The layout was checked at 390 px wide in a desktop
  browser (`tools/phone.html`).
- The station view downloads tens of megabytes of ISS geometry; it is slow on a poor
  connection.
- Jet and Smoke models follow reported trends only; neither has a table to fit.
- The burner model does not predict the CFI-G tests that failed to ignite.
