# dsh-legion

Recursive task decomposition for DeepSeek Harness — spydr's workflow on top of
the harness's native Agent Teams: one root task splits into a tree, leaves run
as teammates against a shared task board, results consolidate upward, and the
human gates the root.

```
/legion refactor the auth layer   # start a run (attachments allowed)
/legion start status page redo    # start a task whose title begins with a verb
/legion status                    # roster + task board
/legion config                    # effective settings
/legion stop                      # interrupt every teammate, halt the lead
/legion approve                   # accept the root deliverable
/legion approve ship it           # accept, with a note
/legion reject the API contract   # send it back with a reason
```

A verb is matched **whole**: `/legion status page redesign` starts a run whose
title begins with "status". To start a task that *is* one of the verb words,
prefix it: `/legion start stop`.

## How it works

`/legion <task>` queues a kickoff relay as the agent's next turn. The relay
carries the decomposition protocol with the current settings inlined:

- split non-atomic tasks into `minSubtasks`-`maxSubtasks` subtasks; fewer than
  `minSubtasks` means the task is a leaf;
- never decompose past `maxDepth`;
- `workersPerTask` candidates per leaf, combined by `mergeStrategy`
  (`best` = judge picks the strongest verbatim, `reconcile` = merge strengths);
- the authoring agent reviews each child result, up to `maxReviewRetries`
  rework attempts before a task fails terminally;
- `requireHumanApproval` holds the root at an `/legion approve | reject` gate;
- `maxTasksPerRun` caps how many tasks one run may create (`0` = unlimited).

The tree lives on the shared team task board (`team_task_create` with
`blocked_by` edges), so flow guarantees are structural: tasks flow top-down
only, results bottom-up only, and siblings never exchange work — the same
guarantees spydr enforces in its data model. `status`, `stop`, and the
approval verbs read and steer that live team state; nothing is kept in
process memory, so a restart cannot strand a run.

## Configuration

Two layers, same namespace (`legion`), same precedence as every DSH settings
section: the patch row is the base, the settings document overrides it.

| Field | Default | Meaning |
|---|---|---|
| `minSubtasks` | 2 | Fewer proposals than this ⇒ the task is a leaf |
| `maxSubtasks` | 4 | Extra proposals are truncated to this |
| `maxDepth` | 3 | Hard cap on decomposition levels |
| `workersPerTask` | 1 | Independent candidates per leaf |
| `mergeStrategy` | `best` | `best` \| `reconcile` |
| `maxReviewRetries` | 2 | Rework attempts before terminal failure |
| `requireHumanApproval` | `true` | Root waits for `/legion approve` \| `reject` |
| `maxTasksPerRun` | 0 | Task cap per run; `0` = unlimited |

Edit either way:

- **Config menu** — Plugins → the `legion` row's **Configure** control: every field with its bounds,
  merge-strategy and approval toggles, overridden-field markers and a one-click
  Reset, read-only state when the deployment does not persist settings.
- **Patch row** — a `- id: legion` row in your profile's `cordis.patch.yml`
  (or the `config:` block in this package's `cordis.patch.yml`).

Changes validate immediately and apply to the next `/legion` run; `/legion
config` always prints what the next run will actually use.

## Install

> **Install it as a bundle.** `dsh plugin add …` mounts the row from the
> package's own patch layer, which is what the settings editor can write to. A
> row added with `--patch` is an overlay: it disappears at the next start, and
> the Plugins card cannot save into it — the editor refuses a write an overlay
> would win.

`dsh plugin add dsh-legion`, or add the package to your profile's
`cordis.patch.yml` bundles. The bundled `cordis.patch.yml` inserts the `legion`
row automatically. For local development: `--patch cordis.local.yml`.

Requires Agent Teams (`ctx.agentTeams`) — the verbs that touch the roster or
the board say so instead of failing silently when it is not mounted.

## Notes

- Attachments ride the kickoff only; any other verb with attachments is
  rejected so the composer keeps the originals.
- `/legion stop` is lead-only, like every roster mutation in the Team domain.
- Settings are read when a verb runs, not when the plugin loads — no restart,
  no card reload needed.

## Tests

`npm test` — pure-logic tests (`parseLegion`, `clampSettings`, `buildKickoff`,
`formatStatus`, `formatConfig`, `relayText`) plus handler tests over a fake
host context. `npm install` first: the handler tests load the real module and
need its two dev dependencies.
