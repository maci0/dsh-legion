/**
 * dsh-legion — pure logic shared by the host half and the tests.
 *
 * No imports on purpose: the unit tests run with bare `node --test`, no
 * node_modules required. Everything here is a function of its arguments —
 * command parsing, settings clamping, the kickoff protocol text, and the
 * status/config renderers the `/legion` command returns.
 */

/** Field defaults; also the schema defaults and the patch-row entry in `index.js`. */
export const DEFAULTS = Object.freeze({
  minSubtasks: 2,
  maxSubtasks: 4,
  maxDepth: 3,
  workersPerTask: 1,
  mergeStrategy: 'best',
  maxReviewRetries: 2,
  requireHumanApproval: true,
  maxTasksPerRun: 0,
})

/** Per-field bounds shared by the host schema and the settings card. */
export const LIMITS = Object.freeze({
  minSubtasks: [1, 20],
  maxSubtasks: [1, 20],
  maxDepth: [1, 20],
  workersPerTask: [1, 16],
  maxReviewRetries: [0, 20],
  maxTasksPerRun: [0, 10000],
})

/** Usage line returned for `/legion` with no arguments or a bad verb. */
export const USAGE = 'Usage: /legion <task> — start a run (or /legion start <task>). '
  + 'Verbs: /legion status (roster + task board), /legion config (effective settings), '
  + '/legion stop (interrupt teammates), /legion approve [note], /legion reject <reason>. '
  + 'A verb is matched whole; a task that starts with a verb word uses /legion start.'

/**
 * Parse the text after `/legion`.
 *
 * Verbs are exact whole-input matches (case-insensitive) except `start`,
 * `approve`, and `reject`, which take a suffix. Everything else is a task
 * title, so `/legion status page redesign` starts a run rather than guessing.
 *
 * @param {string} input - raw text after the command name.
 * @returns {{kind: 'usage'} | {kind: 'error', text: string} |
 *           {kind: 'status'} | {kind: 'config'} | {kind: 'stop'} |
 *           {kind: 'approve', note: string} | {kind: 'reject', reason: string} |
 *           {kind: 'start', task: string}}
 */
export function parseLegion(input) {
  const trimmed = String(input ?? '').trim()
  if (trimmed === '') return { kind: 'usage' }
  const lower = trimmed.toLowerCase()
  if (lower === 'status') return { kind: 'status' }
  if (lower === 'config') return { kind: 'config' }
  if (lower === 'stop') return { kind: 'stop' }

  const approve = /^approve(?:\s+([\s\S]+))?$/i.exec(trimmed)
  if (approve) return { kind: 'approve', note: (approve[1] ?? '').trim() }

  const reject = /^reject(?:\s+([\s\S]+))?$/i.exec(trimmed)
  if (reject) {
    const reason = (reject[1] ?? '').trim()
    if (reason === '') {
      return { kind: 'error', text: 'Usage: /legion reject <reason> — say what the root deliverable must change.' }
    }
    return { kind: 'reject', reason }
  }

  const start = /^start\s+([\s\S]+)$/i.exec(trimmed)
  if (start) {
    const task = start[1].trim()
    if (task === '') return { kind: 'usage' }
    return { kind: 'start', task }
  }
  return { kind: 'start', task: trimmed }
}

/**
 * Clamp a settings value to the bounds the schema and the card enforce.
 *
 * `maxSubtasks` is raised to `minSubtasks` when a hand-edit inverted them:
 * a schema cannot express that cross-field rule, and refusing the section
 * would wedge the card, so the kickoff reads a usable pair either way.
 *
 * @param {unknown} raw - the resolved settings section (may be partial).
 * @returns {typeof DEFAULTS} a complete, in-bounds settings value.
 */
export function clampSettings(raw) {
  const s = raw !== null && typeof raw === 'object' ? raw : {}
  const int = (value, key, fallback) => {
    const [lo, hi] = LIMITS[key]
    const n = Math.trunc(Number(value))
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback
  }
  const minSubtasks = int(s.minSubtasks, 'minSubtasks', DEFAULTS.minSubtasks)
  return {
    minSubtasks,
    maxSubtasks: Math.max(minSubtasks, int(s.maxSubtasks, 'maxSubtasks', DEFAULTS.maxSubtasks)),
    maxDepth: int(s.maxDepth, 'maxDepth', DEFAULTS.maxDepth),
    workersPerTask: int(s.workersPerTask, 'workersPerTask', DEFAULTS.workersPerTask),
    mergeStrategy: typeof s.mergeStrategy === 'string' && s.mergeStrategy.toLowerCase() === 'reconcile'
      ? 'reconcile'
      : 'best',
    maxReviewRetries: int(s.maxReviewRetries, 'maxReviewRetries', DEFAULTS.maxReviewRetries),
    requireHumanApproval: typeof s.requireHumanApproval === 'boolean'
      ? s.requireHumanApproval
      : DEFAULTS.requireHumanApproval,
    maxTasksPerRun: int(s.maxTasksPerRun, 'maxTasksPerRun', DEFAULTS.maxTasksPerRun),
  }
}

/**
 * The kickoff protocol queued to the agent when a run starts.
 *
 * The configuration rides in this message instead of a system-prompt
 * section: it applies to the run being started, costs nothing on turns
 * where no run is active, and a settings change needs no reload.
 *
 * @param {string} task - the root task title as the human typed it.
 * @param {unknown} raw - resolved settings (clamped here).
 * @returns {string} the relay message text.
 */
export function buildKickoff(task, raw) {
  const c = clampSettings(raw)
  const approval = c.requireHumanApproval
    ? 'required — when the root deliverable is ready, stop and wait for the human '
      + 'to answer /legion approve or /legion reject <reason>.'
    : 'not required — close the root yourself once every child task is completed.'
  const budget = c.maxTasksPerRun === 0 ? 'unlimited' : `${c.maxTasksPerRun} task(s)`
  return [
    '[legion] New root task. Run the legion decomposition protocol for this session.',
    '',
    `Task: ${task}`,
    '',
    'Decomposition rules (effective now):',
    `- Split a non-atomic task into ${c.minSubtasks}-${c.maxSubtasks} subtasks; fewer than ${c.minSubtasks} proposed subtasks means the task is a leaf.`,
    `- Decomposition depth cap: ${c.maxDepth}. Never decompose past it.`,
    `- Execution: ${c.workersPerTask} worker(s) per leaf. Combine multiple workers with the "${c.mergeStrategy}" strategy:`,
    c.mergeStrategy === 'reconcile'
      ? '  reconcile — merge the strengths of every candidate into one deliverable.'
      : '  best — a judge picks the strongest candidate verbatim.',
    `- Review: the agent that authored a task reviews each child result; at most ${c.maxReviewRetries} rework attempts before a task fails terminally.`,
    `- Human root approval: ${approval}`,
    `- Task budget for this run: ${budget}.`,
    '',
    'Flow guarantees: tasks flow top down only (parents create children), results flow',
    'bottom up only (a completed child unblocks its parent, which consolidates the',
    'children results into its own deliverable), and siblings never exchange work.',
    'Model the tree on the shared team task board: team_task_create with blocked_by',
    'edges, spawn_teammate for leaf workers, send_message for handoffs, team_task_update',
    'as status changes. Report progress with /legion status; the human can end the run',
    'with /legion stop.',
  ].join('\n')
}

/**
 * Render the effective settings for `/legion config`.
 * @param {unknown} raw - resolved settings (clamped here).
 * @returns {string} one line per setting plus the edit hint.
 */
export function formatConfig(raw) {
  const c = clampSettings(raw)
  return [
    'Legion configuration (effective):',
    `- min subtasks: ${c.minSubtasks}, max subtasks: ${c.maxSubtasks}, max depth: ${c.maxDepth}`,
    `- workers per leaf: ${c.workersPerTask}, merge strategy: ${c.mergeStrategy}`,
    `- max review retries: ${c.maxReviewRetries}`,
    `- human root approval: ${c.requireHumanApproval ? 'required' : 'not required'}`,
    `- task budget per run: ${c.maxTasksPerRun === 0 ? 'unlimited' : c.maxTasksPerRun}`,
    "Edit in the Plugins page, on the Legion row's Configure control; changes apply to the next run.",
  ].join('\n')
}

/** Verbose spelling of a durable task status for the status renderer. */
const TASK_STATUS = { pending: 'pending', in_progress: 'in progress', completed: 'completed' }

/**
 * Render the roster and the task board for `/legion status`.
 *
 * Task lines cap at 40: a runaway decomposition would otherwise dump the
 * whole board into the composer result (upgrade path: paginate if boards
 * that large become normal).
 *
 * @param {{members?: readonly object[], tasks?: readonly object[]}} view -
 *   `listMembers` + `listTasks` output for the caller's team.
 * @returns {string} the human-readable status report.
 */
export function formatStatus(view) {
  const members = Array.isArray(view?.members) ? view.members : []
  const tasks = Array.isArray(view?.tasks) ? view.tasks : []
  const counts = { completed: 0, in_progress: 0, pending: 0, deleted: 0, ready: 0 }
  for (const task of tasks) {
    if (counts[task.status] !== undefined) counts[task.status] += 1
    if (task.status === 'pending' && task.ready === true) counts.ready += 1
  }

  const lines = []
  lines.push(`Legion status — ${members.length} member(s), ${tasks.length} task(s).`)
  lines.push(`Roster: ${members.length === 0 ? '(none)' : members
    .map((m) => `${m.name} (${m.role}, ${m.status})`)
    .join(', ')}`)
  lines.push(`Tasks: ${counts.completed} completed, ${counts.in_progress} in progress, `
    + `${counts.pending} pending (${counts.ready} ready).`)

  const shown = tasks.slice(0, 40)
  for (const task of shown) lines.push(taskLine(task))
  if (tasks.length > shown.length) lines.push(`… and ${tasks.length - shown.length} more task(s).`)
  return lines.join('\n')
}

/**
 * One board row: id, status, subject, then the owner or the blockers.
 * @param {object} task - one `TeamTaskView`.
 * @returns {string} the row.
 */
function taskLine(task) {
  const status = TASK_STATUS[task.status] ?? String(task.status)
  let suffix = ''
  if (task.status === 'in_progress') suffix = ` — owner ${task.ownerName ?? 'unknown'}`
  else if (task.status === 'pending' && task.blockedBy?.length > 0) {
    suffix = task.ready === true ? ' — ready' : ` — blocked by ${task.blockedBy.join(', ')}`
  } else if (task.status === 'pending') suffix = ' — ready'
  return `  ${task.id} [${status}] ${task.subject}${suffix}`
}

/** One relay line queued to the agent by an approval-gate or stop verb. */
export function relayText(kind, payload) {
  if (kind === 'approve') {
    return payload
      ? `[legion] Human approved the root deliverable. Note: ${payload}`
      : '[legion] Human approved the root deliverable. Close the run.'
  }
  if (kind === 'reject') {
    return `[legion] Human rejected the root deliverable: ${payload}. `
      + 'Address the reason, then present the result again for approval.'
  }
  return '[legion] Human ended the run. Do not spawn new teammates or tasks. '
    + 'Summarize where the work stopped and what remains.'
}
