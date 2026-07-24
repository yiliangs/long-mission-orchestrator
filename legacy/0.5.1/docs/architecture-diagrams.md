# Architecture diagrams

The conceptual diagrams for the mission protocol. The README hero is now a single rendered role
org-chart (`docs/role-diagram.png`); these mermaid diagrams expand each piece of the system and
are kept here as explanatory reference, not promoted to the README.

---

## The mission, end to end

You set the goal and grill it up front (the one human-in-the-loop moment); after that a critic
fights the plan, the work fans out into parallel tasks each shadowed by its own checker, and what
you correct feeds the next run.

```mermaid
flowchart TD
    H(["You: point at a goal"]) --> GRILL(["You + AI grill it<br/>resolve every branch"])
    GRILL --> PLAN["PLAN the work"]
    PLAN <-.->|"challenge / push back"| PCRIT["Critic<br/>challenges the plan"]
    PCRIT --> FREEZE["Lock the plan"]

    FREEZE --> EX(["EXECUTE<br/>fan out to parallel tasks"])
    EX --> W1["Worker"] & W2["Worker"] & W3["Worker"]
    W1 <-.->|redo| K1["Critic<br/>checks"]
    W2 <-.->|redo| K2["Critic<br/>checks"]
    W3 <-.->|redo| K3["Critic<br/>checks"]
    K1 & K2 & K3 --> PROVE["Proven done<br/>tests, not promises"]

    PROVE --> DELIVER(["You wake up to<br/>a finished result"])
    DELIVER --> REVIEW["You review and correct"]
    REVIEW -.->|"learns, next mission"| H
```

---

## Brain vs hands — the plan is decided first, then walked

The split is what lets the same plan run on different AI tools: the BRAIN decides it (plan,
fight, freeze), the HANDS walk it (execute, audit).

```mermaid
flowchart TD
    G["GOAL"] --> GR(["GRILL<br/>you + AI align, up front"])
    GR --> P
    subgraph BRAIN["BRAIN : plan it (autonomous)"]
        P["PLAN"] --> F["FIGHT<br/>critics vs plan"]
        F --> FR["FREEZE<br/>lock the plan"]
    end
    FR --> EX
    subgraph HANDS["HANDS : do it (autonomous)"]
        EX["EXECUTE<br/>walk the plan"] --> AU["AUDIT<br/>recheck + fix"]
    end
    AU --> DL["DELIVER<br/>result + report"]
    DL --> RV["Human reviews"]
```

---

## When a step gets stuck — climb one rung at a time

Don't replan what a retry fixes; don't retry what only a replan can fix.

```mermaid
flowchart LR
    N["step fails"] --> T1["retry<br/>cap 3"]
    T1 -->|still stuck| T2["loop<br/>fresh worker"]
    T2 -->|plan is wrong| T3["replan<br/>that branch"]
    T3 -->|exhausted| ESC["ask the Human"]
    T1 -->|passes| OK["done"]
```

---

## How "done" is decided

Every task gets a check-level that says who may close it. The keystone: a self-checkable task
can't close without an actual passing check on record — no proof, no close; it gets bumped to a
critic.

```mermaid
flowchart TD
    T["a task"] --> C{"how to check?"}
    C -->|self-test| R0{"check<br/>passed?"}
    C -->|machine check| R0
    C -->|needs judgment| CR["critic"]
    C -->|human only| HU["Human"]
    R0 -->|yes| CLOSE["done"]
    R0 -->|no proof| DOWN["bump to critic"]
    DOWN --> CR
    CR --> ADJ["orchestrator<br/>decides"]
    FLOOR["public-facing<br/>always a critic"] -.-> CR
```

---

## Severity and adjudication — a blocker must cite a real rule

Worker and critic never argue directly; the orchestrator rules. Only the Human overrides a valid
blocker.

```mermaid
flowchart TD
    A["worker output"] --> CR["critic finds<br/>what's wrong"]
    CR --> SEV{"how bad?"}
    SEV -->|blocker| BCHK{"cites a<br/>real rule?"}
    BCHK -->|no| INVALID["rejected"]
    BCHK -->|yes| HUMAN["Human decides"]
    SEV -->|major| ORCH["fix, or log<br/>with a reason"]
    SEV -->|minor| LED["log it"]
    INVALID --> ORCH
```

---

## How it learns — three nested loops, human-gated

Drafting an improvement is automatic; applying one always waits for your grant.

```mermaid
flowchart TD
    subgraph L1["1 : run missions"]
        RUN["/mission"] --> ACC["Human review<br/>= the lesson"]
    end
    subgraph L2["2 : tune the numbers"]
        CAL["auto review"] --> CAPDIFF["proposed tweaks"]
    end
    subgraph L3["3 : change the rules"]
        EVO["auto review"] --> AMEND["proposed<br/>amendments"]
    end
    ACC --> CAL
    ACC --> EVO
    CAPDIFF --> MAIL["email you"]
    AMEND --> MAIL
    MAIL --> GRANT["you grant"]
    GRANT --> APPLY["apply + deploy"]
    APPLY --> RUN
```

---

## Works on more than one AI tool

The plan is pure data; the runtime is a swappable adapter. (Claude Code is proven; the Codex path
is specified but untested.)

```mermaid
flowchart LR
    SPEC["the plan<br/>pure data"] --> WF["Claude Code<br/>runs it : proven"]
    SPEC --> CX["Codex<br/>runs it : deferred"]
    WF --> ART["same result"]
    CX --> ART
```

---

## How it's wired — three places, never mixed

Governance (the rules), telemetry (the memory), and working-state (the actual work) live apart.

```mermaid
flowchart TB
    subgraph SRC["long-mission-orchestrator : the rules"]
        CON["constitution"]
        SK["skills"]
        EX["executors"]
    end
    subgraph LIVE["~/.claude : deployed per machine"]
        D1["each machine"]
    end
    subgraph FN["fieldnotes : the memory"]
        REC["run records"]
    end
    subgraph WORK["your repo : the work"]
        BR["agent branches"]
    end
    SRC -->|deploy| LIVE
    LIVE -->|drives| WORK
    WORK -->|records| FN
    FN -->|evidence| SRC
```
