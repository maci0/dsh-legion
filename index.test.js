import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULTS,
  USAGE,
  buildKickoff,
  clampSettings,
  formatConfig,
  formatStatus,
  parseLegion,
  relayText,
} from './lib/logic.js'

test('parseLegion reads the documented forms', () => {
  assert.deepEqual(parseLegion('status'), { kind: 'status' })
  assert.deepEqual(parseLegion(' Config '), { kind: 'config' })
  assert.deepEqual(parseLegion('stop'), { kind: 'stop' })
  assert.deepEqual(parseLegion(''), { kind: 'usage' })
  assert.deepEqual(parseLegion('approve'), { kind: 'approve', note: '' })
  assert.deepEqual(parseLegion('approve ship it as-is'), { kind: 'approve', note: 'ship it as-is' })
  assert.deepEqual(parseLegion('reject the API contract'), { kind: 'reject', reason: 'the API contract' })
  assert.deepEqual(parseLegion('start refactor auth'), { kind: 'start', task: 'refactor auth' })
  assert.deepEqual(parseLegion('refactor auth'), { kind: 'start', task: 'refactor auth' })
})

test('parseLegion treats a verb word at the head of a task as a task', () => {
  // Whole-input verb matching only: a real task often begins with these words.
  assert.deepEqual(parseLegion('status page redesign'), { kind: 'start', task: 'status page redesign' })
  assert.deepEqual(parseLegion('stop the bleeding in checkout'), {
    kind: 'start',
    task: 'stop the bleeding in checkout',
  })
  assert.deepEqual(parseLegion('config migration plan'), { kind: 'start', task: 'config migration plan' })
})

test('parseLegion rejects a reason-less reject', () => {
  const parsed = parseLegion('reject')
  assert.equal(parsed.kind, 'error')
  assert.match(parsed.text, /reject <reason>/)
})

test('clampSettings bounds every field and repairs an inverted pair', () => {
  const c = clampSettings({
    minSubtasks: 99,
    maxSubtasks: 3,
    maxDepth: 0,
    workersPerTask: -4,
    mergeStrategy: 'RECONCILE',
    maxReviewRetries: 1.7,
    requireHumanApproval: false,
    maxTasksPerRun: -1,
  })
  assert.equal(c.minSubtasks, 20)
  assert.equal(c.maxSubtasks, 20, 'max is raised to min when the pair inverts')
  assert.equal(c.maxDepth, 1)
  assert.equal(c.workersPerTask, 1)
  assert.equal(c.mergeStrategy, 'reconcile')
  assert.equal(c.maxReviewRetries, 1)
  assert.equal(c.requireHumanApproval, false)
  assert.equal(c.maxTasksPerRun, 0)
  assert.deepEqual(clampSettings(undefined), { ...DEFAULTS })
  assert.deepEqual(clampSettings('junk'), { ...DEFAULTS })
})

test('buildKickoff carries the task and every knob', () => {
  const text = buildKickoff('ship v2', {
    minSubtasks: 3,
    maxSubtasks: 5,
    maxDepth: 2,
    workersPerTask: 2,
    mergeStrategy: 'reconcile',
    maxReviewRetries: 1,
    requireHumanApproval: true,
    maxTasksPerRun: 40,
  })
  assert.match(text, /Task: ship v2/)
  assert.match(text, /3-5 subtasks/)
  assert.match(text, /depth cap: 2/)
  assert.match(text, /2 worker\(s\) per leaf/)
  assert.match(text, /"reconcile" strategy/)
  assert.match(text, /at most 1 rework attempt/)
  assert.match(text, /[Hh]uman root approval: required/)
  assert.match(text, /budget for this run: 40 task\(s\)/)
  assert.match(text, /team_task_create/)
})

test('buildKickoff turns the approval gate and budget off correctly', () => {
  const text = buildKickoff('chores', { ...DEFAULTS, requireHumanApproval: false, maxTasksPerRun: 0 })
  assert.match(text, /approval: not required/)
  assert.match(text, /budget for this run: unlimited/)
  assert.doesNotMatch(text, /wait for the human/)
})

test('formatConfig reports every setting and the edit path', () => {
  const text = formatConfig(DEFAULTS)
  assert.match(text, /min subtasks: 2, max subtasks: 4, max depth: 3/)
  assert.match(text, /merge strategy: best/)
  assert.match(text, /approval: required/)
  assert.match(text, /unlimited/)
  assert.match(text, /Settings → Plugins → Legion/)
})

test('formatStatus renders roster, counts, owners, and blockers', () => {
  const text = formatStatus({
    members: [
      { name: 'lead', role: 'lead', status: 'running' },
      { name: 'scribe', role: 'teammate', status: 'idle' },
    ],
    tasks: [
      { id: 'task-1', status: 'completed', subject: 'spec' },
      { id: 'task-2', status: 'in_progress', subject: 'core', ownerName: 'scribe' },
      { id: 'task-3', status: 'pending', subject: 'docs', blockedBy: ['task-2'], ready: false },
      { id: 'task-4', status: 'pending', subject: 'polish', blockedBy: [], ready: true },
    ],
  })
  assert.match(text, /2 member\(s\), 4 task\(s\)/)
  assert.match(text, /lead \(lead, running\), scribe \(teammate, idle\)/)
  assert.match(text, /1 completed, 1 in progress, 2 pending \(1 ready\)/)
  assert.match(text, /task-2 \[in progress\] core — owner scribe/)
  assert.match(text, /task-3 \[pending\] docs — blocked by task-2/)
  assert.match(text, /task-4 \[pending\] polish — ready/)
})

test('formatStatus caps a runaway board at 40 lines', () => {
  const tasks = Array.from({ length: 55 }, (_, i) => ({
    id: `task-${i}`,
    status: 'pending',
    subject: `t${i}`,
    blockedBy: [],
    ready: false,
  }))
  const text = formatStatus({ members: [], tasks })
  assert.match(text, /… and 15 more task\(s\)\./)
  assert.equal(text.split('\n').length, 3 + 40 + 1)
})

test('relayText phrases the three relays', () => {
  assert.equal(relayText('approve', ''), '[legion] Human approved the root deliverable. Close the run.')
  assert.match(relayText('approve', 'ship it'), /Note: ship it/)
  assert.match(relayText('reject', 'wrong endpoint'), /rejected the root deliverable: wrong endpoint/)
  assert.match(relayText('reject', 'wrong endpoint'), /present the result again/)
  assert.match(relayText('stop'), /Do not spawn new teammates or tasks/)
})

test('USAGE names every verb', () => {
  for (const verb of ['start', 'status', 'config', 'stop', 'approve', 'reject']) {
    assert.ok(USAGE.includes(verb), `usage mentions ${verb}`)
  }
})

// --- handler-level tests: the verb grammar through a fake host context ---

const { apply } = await import('./index.js')

/**
 * Mount the plugin against a fake ctx and return the registered command.
 * @param {object} [options] - `teams` service to expose via ctx.get.
 * @returns {{handler: Function, setSourceValue: (v: object) => void}}
 */
function mount({ teams } = {}) {
  let registered
  let hooks
  let entry
  const ctx = {
    // Real cordis runs an inject callback only when the service is present,
    // so the fake provides `settings` and skips anything it does not carry.
    inject: (deps, cb) => {
      if (deps.every((dep) => ctx[dep] !== undefined)) cb(ctx)
    },
    effect: (fn) => fn(),
    settings: {
      installSection: (_owner, ns, schema, base, sectionHooks) => {
        entry = schema(base)
        hooks = sectionHooks
        hooks.setSource(() => entry)
        hooks.onChange()
      },
    },
    commands: {
      register: (definition) => {
        registered = definition
        return () => {}
      },
    },
    get: (key) => (key === 'agentTeams' ? teams : undefined),
  }
  apply(ctx, {})
  return {
    handler: registered.handler,
    definition: registered,
    /** Overwrite the settings section the handler will read. */
    setSection: (value) => {
      entry = { ...entry, ...value }
      hooks.onChange()
    },
  }
}

/** A fake agent that records queued relays instead of running a turn. */
function fakeAgent() {
  const queued = []
  return {
    queued,
    followup: (message) => queued.push(message),
  }
}

/** A fake team service with one lead, one teammate, and a small board. */
function fakeTeams(overrides = {}) {
  return {
    tryMembership: (agent) => agent.membership,
    listMembers: () => [
      { name: 'lead', role: 'lead', status: 'running' },
      { name: 'worker', role: 'teammate', status: 'idle' },
    ],
    listTasks: () => [
      { id: 'task-1', status: 'pending', subject: 'spec', blockedBy: [], ready: true },
    ],
    interrupt: () => ({ previousStatus: 'idle' }),
    ...overrides,
  }
}

const invocation = (agent, rawInput, attachments = []) => ({
  commandId: 'cmd-1',
  agent,
  rawInput,
  attachments,
  signal: new AbortController().signal,
})

test('apply registers the legion command with its grammar', () => {
  const { definition } = mount()
  assert.equal(definition.name, 'legion')
  assert.equal(definition.definitionId, 'dsh-legion:legion')
  assert.equal(definition.input.attachments, true)
  assert.match(definition.description, /status \| config \| stop/)
})

test('/legion start queues a kickoff relay carrying the task', async () => {
  const { handler } = mount()
  const agent = fakeAgent()
  const result = await handler(invocation(agent, 'ship the v2 API'))
  assert.equal(result.kind, 'success')
  assert.match(result.text, /Legion run started: "ship the v2 API"/)
  assert.equal(agent.queued.length, 1)
  const blocks = agent.queued[0].content
  assert.equal(blocks[blocks.length - 1].type, 'text')
  assert.match(blocks[blocks.length - 1].text, /Task: ship the v2 API/)
  assert.equal(agent.queued[0].source.plugin, 'legion')
})

test('attachments ride a starting run and are rejected elsewhere', async () => {
  const { handler } = mount()
  const agent = fakeAgent()
  const file = { type: 'file', fileId: 'f1' }
  const start = await handler(invocation(agent, 'read this spec', [file]))
  assert.equal(start.kind, 'success')
  assert.deepEqual(agent.queued[0].content[0], file)

  const status = await handler(invocation(agent, 'status', [file]))
  assert.equal(status.kind, 'error')
  assert.match(status.text, /Attachments only accompany a starting run/)
  assert.equal(agent.queued.length, 1, 'the rejected verb queued nothing')
})

test('/legion status renders the team view, or explains its absence', async () => {
  const withTeams = mount({ teams: fakeTeams() })
  const lead = { membership: { role: 'lead' } }
  const ok = await withTeams.handler(invocation(lead, 'status'))
  assert.equal(ok.kind, 'success')
  assert.match(ok.text, /2 member\(s\), 1 task\(s\)/)
  assert.match(ok.text, /task-1 \[pending\] spec — ready/)

  const noTeams = mount()
  const missing = await noTeams.handler(invocation(lead, 'status'))
  assert.equal(missing.kind, 'error')
  assert.match(missing.text, /Agent Teams is not mounted/)

  const noMembership = mount({ teams: fakeTeams() })
  const stranger = await noMembership.handler(invocation({}, 'status'))
  assert.equal(stranger.kind, 'error')
  assert.match(stranger.text, /not part of a team/)
})

test('/legion stop interrupts every teammate, lead only', async () => {
  const interrupted = []
  const teams = fakeTeams({
    interrupt: (_agent, name) => {
      interrupted.push(name)
      return { previousStatus: 'idle' }
    },
  })
  const { handler } = mount({ teams })
  const lead = { ...fakeAgent(), membership: { role: 'lead' } }
  const result = await handler(invocation(lead, 'stop'))
  assert.equal(result.kind, 'success')
  assert.deepEqual(interrupted, ['worker'])
  assert.match(result.text, /Stopped 1 teammate/)

  const teammate = { ...fakeAgent(), membership: { role: 'teammate' } }
  const denied = await handler(invocation(teammate, 'stop'))
  assert.equal(denied.kind, 'error')
  assert.match(denied.text, /Only the Team Lead/)
  assert.equal(interrupted.length, 1, 'the denied stop interrupted nobody')
})

test('/legion approve and reject relay to the lead', async () => {
  const { handler } = mount()
  const lead = fakeAgent()

  const approved = await handler(invocation(lead, 'approve ship it'))
  assert.equal(approved.kind, 'success')
  assert.match(lead.queued[0].content[0].text, /approved the root deliverable/)
  assert.match(lead.queued[0].content[0].text, /Note: ship it/)

  const rejected = await handler(invocation(lead, 'reject the contract'))
  assert.equal(rejected.kind, 'success')
  assert.match(lead.queued[1].content[0].text, /rejected the root deliverable: the contract/)

  const bare = await handler(invocation(lead, 'reject'))
  assert.equal(bare.kind, 'error')
  assert.match(bare.text, /reject <reason>/)
  assert.equal(lead.queued.length, 2, 'the bad reject queued nothing')
})

test('/legion config prints the effective settings', async () => {
  const { handler } = mount()
  const result = await handler(invocation(fakeAgent(), 'config'))
  assert.equal(result.kind, 'success')
  assert.match(result.text, /min subtasks: 2, max subtasks: 4/)
  assert.match(result.text, /Settings → Plugins → Legion/)
})

test('empty input returns the usage line as an error', async () => {
  const { handler } = mount()
  const result = await handler(invocation(fakeAgent(), '   '))
  assert.equal(result.kind, 'error')
  assert.equal(result.text, USAGE)
})

test('a settings change applies to the very next command', async () => {
  const mounted = mount()
  const before = await mounted.handler(invocation(fakeAgent(), 'config'))
  assert.match(before.text, /max depth: 3/)

  mounted.setSection({ maxDepth: 7, mergeStrategy: 'reconcile' })
  const after = await mounted.handler(invocation(fakeAgent(), 'config'))
  assert.match(after.text, /max depth: 7/)
  assert.match(after.text, /merge strategy: reconcile/)

  const agent = fakeAgent()
  await mounted.handler(invocation(agent, 'ship it'))
  const kickoff = agent.queued[0].content.at(-1).text
  assert.match(kickoff, /depth cap: 7/)
  assert.match(kickoff, /"reconcile" strategy/)
})
