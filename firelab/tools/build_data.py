"""Build the compact data files the Fire Lab engines load.

Reads the PSI tables in ../LEADERS_NASA (never modifies them) and writes JSON to ../data.
Run from anywhere:  python -I -X utf8 firelab/tools/build_data.py
"""
import csv, io, json, math, re, sys
from datetime import date
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT.parent / "LEADERS_NASA"
OUT = ROOT / "data"


def read_csv(path):
    text = Path(path).read_bytes().decode("utf-8-sig", errors="replace")
    rows = [[c.strip() for c in r] for r in csv.reader(io.StringIO(text))]
    return [r for r in rows if any(r)]


def num(s):
    try:
        v = float(s)
        return v if math.isfinite(v) else None
    except (TypeError, ValueError):
        return None


def iso_date(s):
    m = re.match(r"^(\d{1,2})/(\d{1,2})/(\d{2,4})$", s or "")
    if not m:
        return s or None
    mo, d, y = int(m[1]), int(m[2]), int(m[3])
    y += 2000 if y < 100 else 0
    return f"{y:04d}-{mo:02d}-{d:02d}"


def r3(v, n=3):
    return None if v is None else round(float(v), n)


def fit_linear(X, y, clip_sigma=3.0):
    """Least squares with one round of outlier rejection. Returns coef, stats."""
    A = np.c_[np.ones(len(X)), X]
    keep = np.ones(len(y), bool)
    for _ in range(2):
        coef, *_ = np.linalg.lstsq(A[keep], y[keep], rcond=None)
        res = A @ coef - y
        s = res[keep].std()
        new = np.abs(res) <= clip_sigma * s
        if new.sum() == keep.sum():
            break
        keep = new
    return coef, keep


def r2(pred, y):
    return float(1 - ((pred - y) ** 2).sum() / ((y - y.mean()) ** 2).sum())


def build_flex():
    path = SRC / "PSI-69" / "PSI-69_Experimental table_FLEX.csv"
    rows = read_csv(path)[1:]
    tests = []
    for r in rows:
        r = r + [""] * 15
        p_mmhg = num(r[5])
        t = dict(
            n=int(num(r[0])), id=r[1], date=iso_date(r[2]),
            fuel={"Methanol": "methanol", "Heptane": "heptane"}.get(r[4], r[4].lower()),
            p=r3(p_mmhg / 760.0) if p_mmhg else None,
            o2=num(r[6]), n2=num(r[7]), co2=num(r[8]) or 0.0, he=num(r[9]) or 0.0,
            d0=num(r[10]), dx=num(r[11]), k=num(r[12]), tb=num(r[13]),
            end={"Extinction": "E", "Disruption": "D", "Completion": "C"}.get(r[14], "?"),
        )
        tests.append(t)

    def feats(t):
        return [t["o2"], t["co2"], t["he"], math.log(t["p"]), t["d0"]]

    sig = lambda z: 1 / (1 + np.exp(-z))
    fuels = {}
    for fuel in ("methanol", "heptane"):
        S = [t for t in tests if t["fuel"] == fuel]
        ok = [t for t in S if t["d0"] and t["p"]]
        # burn-rate constant K (mm2/s): linear in O2, CO2, He, ln P, d0
        Sk = [t for t in ok if t["k"]]
        Xk = np.array([feats(t) for t in Sk]); yk = np.array([t["k"] for t in Sk])
        ck, keep = fit_linear(Xk, yk)
        pk = np.c_[np.ones(len(Xk)), Xk] @ ck
        # extinction ratio r = d_ext / d0: logit-linear. Completed burns count as r = 0.
        Sr = [t for t in ok if t["end"] != "D" and (t["dx"] is not None or t["end"] == "C")]
        Xr = np.array([feats(t) for t in Sr])
        yr = np.clip(np.array([(t["dx"] or 0.0) / t["d0"] for t in Sr]), 0, 1)
        yc = np.clip(yr, 0.03, 0.97)
        cr, _ = fit_linear(Xr, np.log(yc / (1 - yc)), clip_sigma=1e9)
        pr = sig(np.c_[np.ones(len(Xr)), Xr] @ cr)
        # burn time check: t_b ~ c * (d0^2 - dx^2) / K using each test's own measurements
        Q = [t for t in ok if t["k"] and t["tb"] and t["dx"] is not None and t["d0"] > t["dx"]]
        ratio = [t["tb"] / ((t["d0"] ** 2 - t["dx"] ** 2) / t["k"]) for t in Q]
        # end-to-end: predicted burn time from conditions only
        E = [t for t in ok if t["tb"] and t["tb"] > 1.5]
        err = []
        for t in E:
            x = np.r_[1, feats(t)]
            kk = float(np.clip(x @ ck, 0.12, 1.3)); rr = float(sig(x @ cr))
            err.append(abs(1.05 * (t["d0"] ** 2) * (1 - rr * rr) / kk - t["tb"]) / t["tb"])
        rng = lambda key: [r3(min(t[key] for t in ok)), r3(max(t[key] for t in ok))]
        fuels[fuel] = dict(
            n=len(S), usable=len(ok),
            fitK=dict(c=[r3(v, 4) for v in ck], mae=r3(np.mean(np.abs(pk - yk))), r2=r3(r2(pk, yk)),
                      n=int(keep.sum())),
            fitR=dict(c=[r3(v, 4) for v in cr], mae=r3(np.mean(np.abs(pr - yr))), r2=r3(r2(pr, yr)),
                      n=len(Sr)),
            tbFactor=r3(np.median(ratio)), tbErrMedian=r3(np.median(err)),
            range=dict(o2=rng("o2"), p=rng("p"), d0=rng("d0"), co2=rng("co2"), he=rng("he")),
            ends={k: sum(1 for t in S if t["end"] == k) for k in "EDC"},
        )
    cols = ["n", "id", "date", "fuel", "p", "o2", "n2", "co2", "he", "d0", "dx", "k", "tb", "end"]
    return dict(
        source=dict(psi="PSI-69", name="Flame Extinguishment Experiment (FLEX)",
                    file=str(path.relative_to(ROOT.parent)).replace("\\", "/"),
                    features=["1", "xO2", "xCO2", "xHe", "ln(P/atm)", "d0_mm"]),
        generated=date.today().isoformat(),
        fuels=fuels, cols=cols,
        tests=[[t[c] for c in cols] for t in tests],
    )


def build_labs():
    """Real-test lists for the engines built on core/lab.js: label, one line of what was
    measured, and the settings that reproduce the test in the lab."""
    out = {}

    # Saffire-II: nine material strips, each burned in orbit and again on Earth
    tests, last = [], ""
    for r in read_csv(SRC / "PSI-99" / "PSI-99_Experimental table_SAFFIRE-2.csv")[1:]:
        if not re.match(r"^2-\d", r[0]):
            continue
        last = name = r[1] or last
        # sample 2-7 is a Nomex sheet behind a short PMMA starter strip: the Nomex is what is under test
        key = "silicone" if "ilicone" in name else "cotton" if "otton" in name else "nomex" if "omex" in name else "pmma"
        shown = "Nomex behind a PMMA starter strip" if key == "nomex" else name.split("&")[0].strip()
        logged = lambda text: re.sub(r"\s*\(note \d\)", "", text).strip()[:18] or "-"
        m = re.search(r"(\d*\.?\d+)\s*(mm|cm)", r[2].replace("037", "0.37"))
        thick = float(m[1]) * (10 if m[2] == "cm" else 1) if m else 10.0
        tests.append(dict(label=f"Sample {r[0]}: {shown}, {thick:g} mm",
                          sub=f"0 g: {logged(r[11])} · Earth: {logged(r[13])}",
                          set=dict(material=key, thick=thick, v=20, o2=22, p=14.7, g=0,
                                   dir="with" if r[10].lower().startswith("con") else "against")))
    out["saffire2"] = tests

    def thin(items, n=36):
        return items[::max(1, len(items) // n)][:n]

    # SPICE: gas-jet flames, one entry per distinct fuel / nozzle / flow combination
    seen = {}
    for r in read_csv(SRC / "PSI-107" / "PSI-107_Experimental table_Spice.csv")[1:]:
        fuel, noz, mg, air = r[3].lower(), num(r[4]), num(r[6]), num(r[8])
        base = next((f for f in ("propylene", "propane", "ethylene") if f in fuel), None)
        if not base or not mg or noz is None or air is None or air < 0:
            continue
        dil = 25 if "75" in fuel else 50 if "50" in fuel else 0
        nozzle = min((0.4, 0.8, 1.6), key=lambda x: abs(x - noz))
        seen.setdefault((base, dil, nozzle, round(mg * 2), round(air / 20)), dict(
            label=f"{r[3]}, {noz:.1f} mm nozzle", sub=f"{mg:.1f} mg/s · air {air:.0f} cm/s",
            set=dict(fuel=base, dilute=dil, nozzle=nozzle, mdot=round(mg, 1), air=round(air), g=0)))
    out["spice"] = thin(list(seen.values()))

    # ACME Flame Design: spherical flames with the stoichiometric mixture fraction and flame temperature logged
    tests = []
    for r in read_csv(SRC / "PSI-10" / "PSI-10_Experimental table_Flame Design_Normal Flame.csv")[1:]:
        xf, mf, xo, zst, tad = (num(r[i]) for i in (4, 5, 8, 13, 14))
        if None in (xf, mf, xo, zst, tad):
            continue
        tests.append(dict(label=f"Test {r[3]}", sub=f"Zst {zst:.2f} · {tad:.0f} K",
                          set=dict(mode="normal", fuel="ethylene" if r[2] == "C2H4" else "propane",
                                   xf=round(xf * 100), mdot=round(mf, 2), o2=round(xo * 100, 1), g=0)))
    out["flamedesign"] = thin(tests)

    # ACME CFI-G: inverse flames up to 85% oxygen, with whether they lit, how long they burned and their colour
    tests = []
    for r in read_csv(SRC / "PSI-159" / "PSI-159_Experimental table_CFI-G_Inverse Flames.csv")[1:]:
        xf, xo, mo = num(r[4]), num(r[7]), num(r[9])
        if xf is None or xo is None:
            continue
        tests.append(dict(label=f"{r[3]}: {r[2]}", sub=f"{xo * 100:.0f}% O2 · lit: {r[13].lower()} · {r[14] or '0'} s · {r[18].lower() or '-'}",
                          set=dict(mode="inverse", fuel=r[2].lower(), xf=round(xf * 100), o2=round(xo * 100, 1), mdot=round(mo or 5.6, 1), g=0)))
    out["cfig"] = thin(tests)
    return out


def main():
    OUT.mkdir(exist_ok=True)
    labs = build_labs()
    (OUT / "labs.json").write_text(json.dumps(labs, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print("labs.json:", ", ".join(f"{k} {len(v)}" for k, v in labs.items()))
    flex = build_flex()
    (OUT / "flex.json").write_text(json.dumps(flex, separators=(",", ":")), encoding="utf-8")
    print(f"flex.json: {len(flex['tests'])} tests, {(OUT / 'flex.json').stat().st_size / 1024:.1f} KB")
    for fuel, f in flex["fuels"].items():
        print(f"  {fuel}: n={f['n']} usable={f['usable']} ends={f['ends']}")
        print(f"    K fit   c={f['fitK']['c']} MAE={f['fitK']['mae']} R2={f['fitK']['r2']} n={f['fitK']['n']}")
        print(f"    r fit   c={f['fitR']['c']} MAE={f['fitR']['mae']} R2={f['fitR']['r2']} n={f['fitR']['n']}")
        print(f"    tb factor={f['tbFactor']}  median |tb error| from conditions only={f['tbErrMedian']}")
        print(f"    range={f['range']}")


if __name__ == "__main__":
    sys.exit(main())
