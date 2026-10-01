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
- never decompose past `maxDepth` (`0` = no cap: split until a task is atomic);
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
| `maxDepth` | 0 | Hard cap on decomposition levels; `0` = no cap |
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

## The Legion view

A **Legion** tab sits beside Chat and Trajectory in the session. It draws the
run's task board as a hierarchy: one round-rect node card per task on a border
colored by status (completed, in progress, pending), joined by tree rails, each
carrying the task id, subject, owner, readiness, extra blockers, and write-scope
overlaps. Branches collapse from their own twisty, a legend names the statuses,
and the header counts tasks, levels, and members. That is spydr's graph language
in the harness's own CSS: no canvas, no graph library, no extra dependency.

The roster ceiling is Agent Teams' `maxMembers`, not this plugin's; raise it in
the same profile patch (the bundled default is 8, i.e. the lead plus 7
teammates) so a wide decomposition can keep every ready leaf in flight.

The values come from the session's own `agentTeam` projection, which the
harness's Agent Teams plugin already publishes — so the tree follows the run
live (no polling, no RPC, no host-half state) and costs nothing while the tab is
not selected. Open the lead session of a run; a session with no team shows the
empty state instead.

## Install

> **Install it as a bundle.** `dsh plugin add …` mounts the row from the
> package's own patch layer, which is what the settings editor can write to. A
> row added with `--patch` is an overlay: it disappears at the next start, and
> the Plugins card cannot save into it — the editor refuses a write an overlay
> would win.

`dsh plugin add dsh-legion`, or add the package to your profile's
`cordis.patch.yml` bundles. The bundled `cordis.patch.yml` inserts the `legion`
row automatically. For local development, `dsh plugin --profile <name> add <path-to-checkout>`.

Requires Agent Teams (`ctx.agentTeams`) — the verbs that touch the roster or
the board, and the Legion view, say so instead of failing silently when it is
not mounted. Agent Teams ships as an experimental bundle; enable it in the same
profile:

```bash
dsh plugin --profile <name> add @deepseek-ai/dsh-experimental-agent-team-profile
```

That bundle mounts `agent-team`, `tool-agent-team`, and the Agent Teams Web UI,
and its own patch disables `tool-subagent`, `tool-subagent-fork`,
`tool-subagent-list-agents`, and `tool-subagent-control`: the Team tools replace
direct delegation. Its defaults are `maxMembers: 8` and `maxTasks: 256`. Restart
the harness after the install.

## Notes

- Attachments ride the kickoff only; any other verb with attachments is
  rejected so the composer keeps the originals.
- `/legion stop` is lead-only, like every roster mutation in the Team domain.
- Settings are read when a verb runs, not when the plugin loads — no restart,
  no card reload needed.

## Tests

`npm test` (`node --test tests/*.test.js`): pure-logic tests (`parseLegion`, `clampSettings`, `buildKickoff`,
`formatStatus`, `formatConfig`, `relayText`), the view's tree fold
(`buildTaskTree`, loaded from the browser half with a stubbed module loader),
plus handler tests over a fake host context. `npm install` first: the handler
tests load the real module and need its two dev dependencies.
