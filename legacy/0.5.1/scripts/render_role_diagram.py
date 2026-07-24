"""Role org-chart for the long-mission-orchestrator README.

Architect register: palette adapted from MILP-solver-paper/experiments/figures/style.py
(ink-on-warm-paper, restrained strokes), IBM Plex Sans body. Self-contained — no cross-repo import.

Run:  python scripts/render_role_diagram.py   ->  docs/role-diagram.png
"""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch, PathPatch
from matplotlib.path import Path as MPath
from matplotlib import font_manager as _fm

# Register bundled IBM Plex Sans (repo carries the TTFs so the render is reproducible).
_FONT_DIR = Path(__file__).resolve().parent / "fonts"
for _ttf in sorted(_FONT_DIR.glob("IBMPlexSans-*.ttf")):
    _fm.fontManager.addfont(str(_ttf))

# --- palette (from style.py) -------------------------------------------------
INK, PAPER = "#1F1B17", "#FBF7EF"
CONCRETE, SLATE = "#8A8278", "#3D434A"
TERRACOTTA, VERDIGRIS, OCHRE, BONE = "#B5482E", "#436F6A", "#C4933B", "#E8DFCF"
ROUNDING = 0.10  # one corner radius for every box

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["IBM Plex Sans", "DejaVu Sans", "Arial"],
    "figure.facecolor": PAPER, "savefig.facecolor": PAPER, "text.color": INK,
})

fig, ax = plt.subplots(figsize=(7.4, 10.9))
ax.set_xlim(0, 10); ax.set_ylim(-1.6, 13.4); ax.axis("off")
CX = 5.0


def box(x, y, w, h, label, *, fc, tc, sub=None, fs=11.5, ec=INK, lw=1.1, ls="-"):
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h,
                 boxstyle=f"round,pad=0,rounding_size={ROUNDING}", fc=fc, ec=ec, lw=lw, ls=ls, zorder=2))
    ax.text(x, y + (0.13 if sub else 0.0), label, ha="center", va="center",
            color=tc, fontsize=fs, fontweight="bold", zorder=3)
    if sub:
        ax.text(x, y - 0.21, sub, ha="center", va="center", color=tc, fontsize=8, zorder=3)


def varrow(x, y1, y2, *, color=INK, lw=1.1):                 # vertical arrow (head at y2)
    ax.add_patch(FancyArrowPatch((x, y1), (x, y2), arrowstyle="-|>", mutation_scale=12,
                 color=color, lw=lw, connectionstyle="arc3,rad=0", shrinkA=1, shrinkB=1, zorder=1))


def line(p1, p2, *, color=INK, lw=1.1, ls="-"):              # plain orthogonal segment, no head
    ax.add_patch(PathPatch(MPath([p1, p2], [MPath.MOVETO, MPath.LINETO]),
                 fc="none", ec=color, lw=lw, ls=ls, zorder=1))


def elbow(pts, *, color=SLATE, lw=1.1, ls="--"):             # dashed polyline, head at end
    for a, b in zip(pts[:-2], pts[1:-1]):
        line(a, b, color=color, lw=lw, ls=ls)
    ax.add_patch(FancyArrowPatch(pts[-2], pts[-1], arrowstyle="-|>", mutation_scale=12,
                 color=color, lw=lw, ls=ls, shrinkA=0, shrinkB=1, zorder=1))


# --- y budget (generous gaps so no arrow squishes) ---------------------------
y_you, y_plan, y_fight, y_freeze = 12.0, 10.55, 8.95, 7.45
flock_top, flock_bot = 6.55, 3.85
y_exec, y_ncrit = 5.55, 4.45
y_fb, y_mb = 3.45, 2.05            # fork bar / merge bar
y_cold = 2.75
y_audit, y_deliver = 1.2, -0.1
cols = [2.45, 5.0, 7.55]
xR = CX + 2.4                       # the cold-review detour vertical

# title (colon, no em-dash, per the no-em-dash prose rule)
ax.text(CX, 13.05, "Who does what: the verifiers outnumber the workers",
        ha="center", va="center", fontsize=12.5, color=SLATE)

# flock container (behind)
ax.add_patch(FancyBboxPatch((0.95, flock_bot), 8.1, flock_top - flock_bot,
             boxstyle=f"round,pad=0,rounding_size={ROUNDING}", fc=BONE, ec=CONCRETE, lw=1.0, alpha=0.32, zorder=0))
ax.text(CX, flock_top - 0.30, "EXECUTORS · one per task, in parallel",
        ha="center", va="center", fontsize=9.5, color=SLATE, zorder=3)

# --- boxes -------------------------------------------------------------------
box(CX, y_you, 5.8, 0.98, "YOU", fc=INK, tc=PAPER, fs=13, sub="set the goal · grill it · review the result")
box(CX, y_plan, 3.4, 0.9, "PLANNER", fc=VERDIGRIS, tc=PAPER, sub="drafts the plan")
box(CX, y_fight, 7.4, 1.22, "PLAN-FIGHT  ·  critic panel", fc=TERRACOTTA, tc=PAPER, fs=11.5,
    sub="feasibility · completeness · scope · dependency · verification-adequacy")
box(CX, y_freeze, 3.4, 0.92, "FREEZE", fc=BONE, tc=INK, fs=11, sub="lock the plan")

for cxp in cols:
    box(cxp, y_exec, 2.05, 0.6, "EXECUTOR", fc=VERDIGRIS, tc=PAPER, fs=10)
    box(cxp, y_ncrit, 2.05, 0.6, "CRITIC", fc=TERRACOTTA, tc=PAPER, fs=10)
    ax.add_patch(FancyArrowPatch((cxp, y_exec - 0.30), (cxp, y_ncrit + 0.30),
                 arrowstyle="<|-|>", mutation_scale=9, color=INK, lw=0.9, zorder=1))
    ax.text(cxp + 0.28, (y_exec + y_ncrit) / 2, "redo", ha="left", va="center", fontsize=7.5, color=SLATE, zorder=3)

box(xR, y_cold, 2.7, 0.82, "COLD-REVIEWER", fc=TERRACOTTA, tc=PAPER, fs=9.5, sub="fresh eyes on a clean pass")
box(CX, y_audit, 3.4, 0.88, "AUDITOR", fc=TERRACOTTA, tc=PAPER, fs=11, sub="re-checks the whole mission")
box(CX, y_deliver, 3.6, 0.92, "DELIVER", fc=BONE, tc=INK, fs=11, sub="proven, not promised")

# --- spine arrows (orthogonal) -----------------------------------------------
varrow(CX, y_you - 0.49, y_plan + 0.45)
varrow(CX, y_plan - 0.45, y_fight + 0.61)
varrow(CX, y_fight - 0.61, y_freeze + 0.46)
varrow(CX, y_freeze - 0.46, flock_top)             # FREEZE -> flock container

# --- conditional cold review: "no" path is the straight spine; "yes" detours out --
varrow(CX, flock_bot, y_audit + 0.44)              # straight spine = "no" path (head -> AUDITOR)
line((CX, y_fb), (xR, y_fb))                        # tap off right ("yes")
line((xR, y_fb), (xR, y_cold + 0.41))              # down into COLD-REVIEWER
line((xR, y_cold - 0.41), (xR, y_mb))              # down out of COLD-REVIEWER
line((xR, y_mb), (CX, y_mb))                        # merge back onto the spine
varrow(CX, y_audit - 0.44, y_deliver + 0.46)       # AUDITOR -> DELIVER

ax.text(CX - 0.22, 2.72, "no", ha="right", va="center", fontsize=8, style="italic", color=SLATE, zorder=3)
ax.text(CX + 0.52, y_fb + 0.15, "yes", ha="left", va="center", fontsize=8, style="italic", color=SLATE, zorder=3)
ax.text(2.75, 2.72, "orchestrator adjudicates\nif a cold review is needed (§3.4)",
        ha="center", va="center", fontsize=7.8, style="italic", color=SLATE, zorder=3)

# --- learn loop up the left margin -------------------------------------------
elbow([(CX - 1.8, y_deliver), (0.5, y_deliver), (0.5, y_you), (CX - 2.9, y_you)], color=SLATE, lw=1.1)
ax.text(0.3, (y_deliver + y_you) / 2, "what you correct → next mission",
        ha="center", va="center", fontsize=8, color=SLATE, rotation=90)

# --- legend ------------------------------------------------------------------
for xx, c, txt in [(2.7, VERDIGRIS, "makes the work"), (5.9, TERRACOTTA, "checks the work")]:
    ax.add_patch(FancyBboxPatch((xx, -1.18), 0.32, 0.32, boxstyle="round,pad=0,rounding_size=0.07",
                 fc=c, ec=INK, lw=0.8, zorder=2))
    ax.text(xx + 0.45, -1.02, txt, ha="left", va="center", fontsize=8.5, color=INK)

out = Path(__file__).resolve().parents[1] / "docs" / "role-diagram.png"
out.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(out, dpi=200, bbox_inches="tight", pad_inches=0.12)
print(out)
