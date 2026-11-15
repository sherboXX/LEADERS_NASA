# Validation report

How far each Freefall model can be trusted, what was checked on the published site, and
what has not been checked. Written on 2026-11-15 from fresh runs of the scripts named below.

Reproduce the model figures with `node tools/validate.mjs`, and the page checks by opening
`tools/sweep.html` on the site.

## Summary

| Engine | Experiments | Compared with | Result | Trust it for |
|---|---|---|---|---|
| Droplet | FLEX, FLEX-2, CFI | 261 FLEX tests (PSI-69) | How the burn ends matches in 219 of 261 (84%) | Trends and rough sizes within the tested range |
| Solid | BASS, BASS-II, Saffire-I/II/III | 9 Saffire-II samples | Burns or does not burn: right for all nine | Which materials burn, and the direction of each effect |
| Burner | s-Flame, Flame Design, CFI-G, BRE | 36 Flame Design tests, 33 CFI-G ignitions | Temperature within 68 K on average; does not predict failed ignitions | Flame temperature and position |
| Jet | SPICE, SLICE, CLD Flame, E-FIELD | Nothing measured | Not compared | Direction of each effect only |
| Smoke | SAME, SAME-R, DAFT, DAFT-2 | Nothing measured | Not compared | Direction of each effect only |

All five are teaching models. Every lab says "illustrative" in its Result tab. None should
be used to design or certify anything.

## Droplet engine (FLEX)

The FLEX table (PSI-69) has 274 tests; 261 have the droplet size and pressure needed to
run the model. The model's constants are fitted to those same tests, so this is a check of
fit, not a prediction of unseen tests.

| | Methanol | Heptane |
|---|---|---|
| Usable tests | 153 of 157 | 108 of 117 |
| Burn-rate fit, R² | 0.88 | 0.65 |
| Burn-rate mean error | 0.025 mm²/s (146 tests) | 0.063 mm²/s (102 tests) |
| Leftover-droplet fit, R² | 0.51 (110 tests) | 0.75 (75 tests) |
| Median burn-time error | 15% | 20% |

How the burn ends (burns out, goes out early, goes out by heat loss, never lights),
measured against model:

| Measured | Model says the same | Model says something else |
|---|---|---|
| Goes out early (148) | 137 | 10 burn out, 1 heat loss |
| Burns out (46) | 35 | 9 go out early, 2 heat loss |
| Goes out by heat loss (40) | 34 | 5 go out early, 1 burns out |
| Never lights (27) | 13 | 8 go out early, 6 heat loss |

Weakest point: tests that never lit. The model lights about half of them.

FLEX-2 (airflow) and CFI (dodecane) reuse this model with a standard airflow correction and
constants from PSI-117. Neither has a fitted table, so their numbers are less certain than
FLEX's.

## Solid engine (Saffire-II)

The nine Saffire-II samples, run at their logged conditions in orbit:

| Sample | Burned in orbit (NASA) | Model |
|---|---|---|
| Silicone 0.27, 0.37, 0.61, 1.03 mm | About 0 | Does not burn (4 of 4) |
| Cotton-fibreglass 0.37 mm (two samples) | 29 cm, the whole sample | Spreads at 2.28 mm/s |
| Nomex 0.37 mm, behind a 5 cm acrylic starter strip | Starter burned, Nomex did not light | Does not burn |
| Acrylic (PMMA) 10 mm (two samples) | About 10 cm | Spreads slowly, 0.12 mm/s |

Burn or no burn agrees for all nine. Only the outcome is compared here, not the distance
burned. When the model was tuned, the cotton spread rate was set against the 2.1 to 2.6
mm/s recorded for Saffire-II; that range was not re-read for this report.

While writing this report the Nomex sample was found to be labelled as thin acrylic in
`data/labs.json`. `tools/build_data.py` was corrected and the data rebuilt.

## Burner engine

**Flame Design (PSI-10), 36 tests with tabulated values.** Flame position (stoichiometric
mixture fraction): mean error 0.004, worst 0.014. Flame temperature: mean error 68 K,
worst 190 K.

**CFI-G (PSI-159), 33 ignition attempts.** 28 lit and 5 did not. The model lights all 33.
It agrees in 85% of cases only because most tests lit; it has no skill at predicting a
failed ignition.

**BRE.** In the model, ethylene goes out by heat loss in air and at 30% oxygen and burns
steadily at 40%. This was not compared with a table or re-checked against the BRE reports.

## Jet and Smoke engines

Built from standard relations and the trends the experiments reported. The jet labs can
replay 36 logged SPICE test conditions, but the table holds no measured outcome to compare
with. The smoke labs have no table at all. Treat both as showing which way each control
pushes the result, not how far.

## Do the models ever break?

Each model was run over a grid of settings looking for impossible numbers.

| Model | Settings tried | Problems |
|---|---|---|
| Droplet | 261 tests, three ways each | 0 |
| Solid | 6,912 | 0 |
| Jet | 2,592 | 0 |
| Burner | 2,160 | 0 |
| Smoke | 360 | 0 |

`node tools/check_site.mjs` confirms all 20 experiments are wired from gallery to lab to
station view.

## The published site

Checked at https://sherboxx.github.io/LEADERS_NASA/ with `tools/sweep.html`, in desktop
Chrome.

- All 20 labs start, draw, give finite numbers and find every file they ask for.
- The station view opens and draws for all 20 experiments (`tools/sweep.html?app=1`:
  40 pages, no problems). The sweep confirms it loads; where it flies to was looked at for
  a few experiments only.
- The guide answers with its built-in rules; a hosted copy has no ChatGPT link unless a
  visitor adds their own key.
- The architecture page and gallery load.

### Weight

| Page | Files | Download, first visit | Unpacked |
|---|---|---|---|
| A lab | 33 to 35 | about 0.6 MB | 2.4 MB |
| The station view | 90 to 130 | 7 to 9 MB seen, more on a cold cache | 14 to 33 MB |

Later labs load from the browser's cache. The station view is heavy because of the ISS
geometry; expect a long wait on a slow connection.

### Drawing load

| Lab | Draw calls per frame | Triangles |
|---|---|---|
| Droplet (FLEX, FLEX-2, CFI) | about 190 | 54,000 |
| Burner | 37 to 39 | 10,700 to 12,800 |
| Smoke | 37 | 4,300 |
| Solid, Jet | 49 to 51 | 1,300 to 1,600 |

Each lab measures its own frame time and lowers its resolution if a frame takes longer
than 27 ms. Whether that happens on a given device has not been measured.

## Not checked

- **A real phone.** The layout was checked at 390 px wide in a desktop browser only
  (`tools/phone.html`). Open the live address on a phone to settle this.
- **Motion and frame rate.** The checks were stills and scripts in an automated browser
  tab, which runs about one frame a second. No frame rate is claimed.
- **ChatGPT answers.** The guide's link to ChatGPT has never been exercised with a working
  key.
- **Other browsers.** Only Chrome on Windows.
- **Where each station view lands.** All twenty load; the fly-in to the right module and
  the text shown there were looked at for a few experiments only.
