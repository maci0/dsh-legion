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
} from '../lib/logic.js'

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
  assert.equal(c.maxDepth, 0, '0 is a legal depth value: no cap')
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
  assert.match(text, /spawn one teammate per ready leaf/)
  assert.match(text, /team_task_create/)
})

test('buildKickoff turns the approval gate and budget off correctly', () => {
  const text = buildKickoff('chores', { ...DEFAULTS, requireHumanApproval: false, maxTasksPerRun: 0 })
  assert.match(text, /approval: not required/)
  assert.match(text, /budget for this run: unlimited/)
  assert.doesNotMatch(text, /wait for the human/)
})

test('buildKickoff lifts the depth cap at maxDepth 0', () => {
  const open = buildKickoff('infinite descent', { ...DEFAULTS, maxDepth: 0 })
  assert.match(open, /depth cap: none/)
  assert.doesNotMatch(open, /Never decompose past it/)

  const capped = buildKickoff('bounded', { ...DEFAULTS, maxDepth: 1 })
  assert.match(capped, /depth cap: 1\. Never decompose past it\./)
})

test('formatConfig reports every setting and the edit path', () => {
  const text = formatConfig(DEFAULTS)
  assert.match(text, /min subtasks: 2, max subtasks: 4, max depth: unlimited/)
  assert.match(text, /merge strategy: best/)
  assert.match(text, /approval: required/)
  assert.match(text, /unlimited/)
  assert.match(text, /Plugins page, on the Legion row's Configure control/)
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
  assert.match(text, /task-2 \[in progress\] core, owner scribe/)
  assert.match(text, /task-3 \[pending\] docs, blocked by task-2/)
  assert.match(text, /task-4 \[pending\] polish, ready/)
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

const { apply } = await import('../index.js')

/**
 * Mount the plugin against a fake ctx and return the registered command.
 * @param {object} [options] - `teams` service to expose via ctx.get.
 * @returns {{handler: Function, definition: object, setSection: (v: object) => void}}
 */
function mount({ teams } = {}) {
  let registered
  const config = {}
  const ctx = {
    effect: (fn) => fn(),
    commands: {
      register: (definition) => {
        registered = definition
        return () => {}
      },
    },
    get: (key) => (key === 'agentTeams' ? teams : undefined),
  }
  apply(ctx, config)
  return {
    handler: registered.handler,
    definition: registered,
    /** Overwrite the live config the handler will read. */
    setSection: (value) => {
      Object.assign(config, value)
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
      { name: 'worker', role: 'teammate', status: 'inactive' },
    ],
    listTasks: () => [
      { id: 'task-1', status: 'pending', subject: 'spec', blockedBy: [], ready: true },
    ],
    interrupt: () => ({ previousStatus: 'running' }),
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
  assert.equal(agent.queued[0].source.kind, 'legion')
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
  assert.match(ok.text, /task-1 \[pending\] spec, ready/)

  const noTeams = mount()
  const missing = await noTeams.handler(invocation(lead, 'status'))
  assert.equal(missing.kind, 'error')
  assert.match(missing.text, /Agent Teams is not mounted/)
  assert.match(missing.text, /dsh-experimental-agent-team-profile/, 'the error names the bundle to enable')

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
      return { previousStatus: 'running' }
    },
  })
  const { handler } = mount({ teams })
  const lead = { ...fakeAgent(), membership: { role: 'lead' } }
  const result = await handler(invocation(lead, 'stop'))
  assert.equal(result.kind, 'success')
  assert.deepEqual(interrupted, ['worker'])
  assert.match(result.text, /Stopped 1 running teammate/)

  const teammate = { ...fakeAgent(), membership: { role: 'teammate' } }
  const denied = await handler(invocation(teammate, 'stop'))
  assert.equal(denied.kind, 'error')
  assert.match(denied.text, /Only the Team Lead/)
  assert.equal(interrupted.length, 1, 'the denied stop interrupted nobody')
})

// AgentTeams.interrupt reports the target's status sampled before the cancel:
// an `inactive` teammate had no turn to stop, so it is not counted as stopped.
test('/legion stop counts only teammates that had a running turn', async () => {
  const teams = fakeTeams({
    listMembers: () => [
      { name: 'lead', role: 'lead', status: 'running' },
      { name: 'busy', role: 'teammate', status: 'running' },
      { name: 'idle', role: 'teammate', status: 'inactive' },
    ],
    interrupt: (_agent, name) => ({ previousStatus: name === 'busy' ? 'running' : 'inactive' }),
  })
  const { handler } = mount({ teams })
  const lead = { ...fakeAgent(), membership: { role: 'lead' } }
  const result = await handler(invocation(lead, 'stop'))
  assert.equal(result.kind, 'success')
  assert.match(result.text, /Stopped 1 running teammate\(s\)/)
  assert.match(result.text, /1 already idle/)
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

// The Legion view and teammate sessions are open in the same UI, so a verdict
// typed in a teammate's session must still reach the Team Lead
// (TeamMembership.root), not the teammate.
test('/legion approve and reject from a teammate session reach the lead', async () => {
  const lead = { ...fakeAgent(), membership: { role: 'lead' } }
  lead.membership.root = lead
  const teammate = { ...fakeAgent(), membership: { role: 'teammate', root: lead } }
  const { handler } = mount({ teams: fakeTeams() })

  const approved = await handler(invocation(teammate, 'approve'))
  assert.equal(approved.kind, 'success')
  const rejected = await handler(invocation(teammate, 'reject needs tests'))
  assert.equal(rejected.kind, 'success')
  assert.equal(teammate.queued.length, 0, 'the verdict went to the teammate')
  assert.equal(lead.queued.length, 2)
  assert.match(lead.queued[0].content[0].text, /approved the root deliverable/)
  assert.match(lead.queued[1].content[0].text, /rejected the root deliverable: needs tests/)

  const outsider = fakeAgent()
  const refused = await handler(invocation(outsider, 'approve'))
  assert.equal(refused.kind, 'error')
  assert.match(refused.text, /not part of a team/)
  assert.equal(outsider.queued.length, 0)
})

test('/legion config prints the effective settings', async () => {
  const { handler } = mount()
  const result = await handler(invocation(fakeAgent(), 'config'))
  assert.equal(result.kind, 'success')
  assert.match(result.text, /min subtasks: 2, max subtasks: 4/)
  assert.match(result.text, /Plugins page, on the Legion row's Configure control/)
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
  assert.match(before.text, /max depth: unlimited/)

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

test('formatStatus renders a bounded report in one pass (work counters)', () => {
  // Perf gate on work, never wall clock: getter reads count the operations a
  // render must do, so the gate holds on a loaded machine. Baseline recorded
  // on Node v26.10.0, Ryzen 9950X: one counting pass touches status 3n times
  // plus row touches, and only the 40 rendered rows read id and subject.
  // A render-then-slice over every row, or one more full pass, breaks the gate.
  const reads = { status: 0, subject: 0, id: 0 }
  const mk = (n) => Array.from({ length: n }, (_, j) => ({
    get id() { reads.id += 1; return `T${j}` },
    get status() { reads.status += 1; return j % 3 === 0 ? 'completed' : j % 3 === 1 ? 'in_progress' : 'pending' },
    get subject() { reads.subject += 1; return `subject line ${j}` },
    ready: j % 5 === 0,
    blockedBy: j % 7 === 0 ? [`T${j - 1}`] : [],
  }))
  const members = [{ name: 'lead', role: 'lead', status: 'running' }]

  const small = formatStatus({ members, tasks: mk(40) })
  assert.ok(reads.subject <= 50, `subject reads ${reads.subject}`)
  assert.ok(reads.id <= 50, `id reads ${reads.id}`)
  assert.ok(reads.status <= 3.5 * 40 + 200, `status reads ${reads.status}`)

  reads.status = reads.subject = reads.id = 0
  const huge = formatStatus({ members, tasks: mk(10_000) })
  assert.ok(reads.subject <= 50, `subject reads ${reads.subject}`)
  assert.ok(reads.id <= 50, `id reads ${reads.id}`)
  assert.ok(reads.status <= 3.5 * 10_000 + 200, `status reads ${reads.status}`)

  const rows = (text) => text.split('\n').filter((line) => line.startsWith('  T'))
  assert.equal(rows(huge).length, 40, 'exactly 40 board rows at any size')
  assert.deepEqual(rows(huge), rows(small), 'the same first 40 rows either way')
  assert.equal(huge.split('\n').length, small.split('\n').length + 1, 'overflow adds one summary line')
})

// --- browser half: the Legion view, loaded from the real client module ---

/** React stub: enough of the surface `lib/client.js` touches to render. */
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useMemo: (build) => build(),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
}

/** Import `lib/client.js` once, capturing what it registers on the module loader. */
let definitionPromise
function clientDefinition() {
  definitionPromise ??= (async () => {
    let definition
    globalThis.window = { __ModuleLoader__: { load: (value) => { definition = value } } }
    await import('../lib/client.js')
    delete globalThis.window
    return definition
  })()
  return definitionPromise
}

/** Run the captured factory against one React implementation. */
async function clientWith(react) {
  return (await clientDefinition()).factory((id) => {
    if (id === 'react') return react
    throw new Error(`unexpected require(${id})`)
  })
}

/** The bundle over the stateless stub, built once per run. */
let clientModulePromise
function clientModule() {
  clientModulePromise ??= clientWith(reactStub)
  return clientModulePromise
}

test('the browser half registers the Legion view beside Chat and Trajectory', async () => {
  const client = await clientModule()
  const registered = []
  const scope = {
    status: 'ready',
    value: {},
    user: {},
    writable: true,
    subscribe: () => () => {},
    getSnapshot: () => ({ status: 'ready', value: {}, user: {}, writable: true }),
  }
  const ctx = {
    configForms: { get: () => scope },
    slots: {
      inject: (name, register) => { register() },
      register: (options, component) => {
        registered.push({ options, component })
        return () => {}
      },
    },
  }
  client.apply(ctx)

  assert.deepEqual(client.inject, ['slots', 'configForms'])
  assert.deepEqual(registered.map((entry) => entry.options.name), ['plugins.row.config', 'conversation.view'])
  const view = registered[1]
  assert.equal(view.options.id, 'legion')
  assert.equal(view.options.order, 20, 'Chat is 0 and Trajectory 10')
  assert.equal(view.options.label, 'Legion')
})

test('the Legion view folds the board into a blocked_by tree', async () => {
  const client = await clientModule()
  const tree = client.buildTaskTree([
    { id: 'task-1', subject: 'root', status: 'completed', blockedBy: [] },
    { id: 'task-2', subject: 'child', status: 'in_progress', blockedBy: ['task-1'], ownerName: 'scribe' },
    { id: 'task-3', subject: 'leaf', status: 'pending', blockedBy: ['task-2'], ready: false },
    { id: 'task-4', subject: 'second root', status: 'pending', blockedBy: ['task-99'], ready: true },
  ])
  assert.deepEqual(tree.map((node) => node.task.id), ['task-1', 'task-4'], 'a deleted blocker leaves a root')
  assert.equal(tree[0].depth, 0)
  assert.equal(tree[0].children[0].task.id, 'task-2')
  assert.equal(tree[0].children[0].children[0].task.id, 'task-3')
  assert.equal(tree[0].children[0].children[0].depth, 2)
  assert.equal(tree[0].cycle, false)
})

test('buildTaskTree keeps a board loop visible instead of hanging', async () => {
  const client = await clientModule()
  const tree = client.buildTaskTree([
    { id: 'a', subject: 'a', status: 'pending', blockedBy: [] },
    { id: 'x', subject: 'x', status: 'pending', blockedBy: ['y'] },
    { id: 'y', subject: 'y', status: 'pending', blockedBy: ['x'] },
  ])
  assert.deepEqual(tree.map((node) => node.task.id), ['a', 'x'], 'an unreachable loop is promoted to a root')
  const looped = tree[1].children[0].children[0]
  assert.equal(looped.task.id, 'x')
  assert.equal(looped.cycle, true)
  assert.equal(looped.children.length, 0)
})

test('the Legion view counts only genuinely blocked pending tasks', async () => {
  // Regression: the summary counted every pending task with a `blockedBy`
  // entry as blocked, including a task whose blockers are already completed,
  // which the same node card draws as `ready`.
  const client = await clientModule()
  const registered = []
  const ctx = {
    configForms: { get: () => ({ status: 'ready', value: {}, user: {}, writable: true }) },
    slots: {
      inject: (_name, register) => { register() },
      register: (options, component) => {
        registered.push({ options, component })
        return () => {}
      },
    },
  }
  client.apply(ctx)
  const { component } = registered[1]

  const rendered = JSON.stringify(component({
    useProjection: () => ({
      members: [],
      tasks: [
        { id: 'task-1', subject: 'root', status: 'completed', blockedBy: [] },
        { id: 'task-2', subject: 'ready', status: 'pending', blockedBy: ['task-1'], ready: true },
        { id: 'task-3', subject: 'waiting', status: 'pending', blockedBy: ['task-4'], ready: false },
        { id: 'task-4', subject: 'running', status: 'in_progress', blockedBy: ['task-1'], ready: false },
      ],
    }),
  }))
  assert.match(rendered, /1 completed · 1 in progress · 1 blocked · 0 member\(s\)/)
})

test('the Legion view renders the tree, and an empty state without one', async () => {
  const client = await clientModule()
  const registered = []
  const ctx = {
    configForms: { get: () => ({ status: 'ready', value: {}, user: {}, writable: true }) },
    slots: {
      inject: (_name, register) => { register() },
      register: (options, component) => {
        registered.push({ options, component })
        return () => {}
      },
    },
  }
  client.apply(ctx)
  const { component } = registered[1]

  const live = component({
    useProjection: () => ({
      members: [{ id: 's1', name: 'lead', role: 'lead', phase: 'active' }],
      tasks: [
        { id: 'task-1', subject: 'root', status: 'completed', blockedBy: [] },
        { id: 'task-2', subject: 'child', status: 'in_progress', blockedBy: ['task-1'], ownerName: 'scribe' },
      ],
    }),
  })
  const rendered = JSON.stringify(live)
  assert.match(rendered, /Legion decomposition: 2 task\(s\), 2 level\(s\)/)
  assert.match(rendered, /1 completed · 1 in progress/)
  assert.match(rendered, /"@scribe"/)
  assert.match(rendered, /lgv-node-completed/, 'the node card carries its status class')
  assert.match(rendered, /lgv-twisty/, 'a parent offers collapse')
  assert.match(rendered, /lgv-legend/)

  const absent = JSON.stringify(component({ useProjection: () => undefined }))
  assert.match(absent, /Agent Teams is not mounted/)
  assert.match(absent, /dsh-experimental-agent-team-profile/, 'the empty state names the bundle to enable')

  const empty = JSON.stringify(component({
    useProjection: () => ({ members: [], tasks: [] }),
  }))
  assert.match(empty, /No legion run in this session/)
})

/**
 * Stateful React stub for the settings card: hook slots survive re-render,
 * so a state set from a settled write shows on the next render.
 */
function statefulReact() {
  const slots = []
  let cursor = 0
  const take = (init) => {
    const slot = cursor
    cursor += 1
    if (slots.length <= slot) slots[slot] = init()
    return slot
  }
  return {
    reset: () => { cursor = 0 },
    createElement: (type, props, ...children) => ({ type, props: props ?? {}, children: children.flat() }),
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
    useState: (initial) => {
      const slot = take(() => (typeof initial === 'function' ? initial() : initial))
      return [slots[slot], (next) => { slots[slot] = typeof next === 'function' ? next(slots[slot]) : next }]
    },
    useRef: (initial) => slots[take(() => ({ current: initial }))],
    useEffect: () => {},
    useMemo: (build) => build(),
  }
}

/** Every node of a rendered element tree, function components expanded. */
function nodesOf(node, out = []) {
  if (node === null || typeof node !== 'object') return out
  if (Array.isArray(node)) { for (const child of node) nodesOf(child, out); return out }
  if (typeof node.type === 'function') return nodesOf(node.type(node.props), out)
  out.push(node)
  return nodesOf(node.children, out)
}

const textOfNode = (node) => (typeof node === 'string' ? node
  : Array.isArray(node) ? node.map(textOfNode).join('')
    : node !== null && typeof node === 'object' ? textOfNode(node.children) : '')

// ConfigForm.set/unset/mutate resolve `false` when the host refuses the write
// (an overlay row, a revision conflict) instead of throwing, so the card must
// report that itself rather than let the form quietly reload the old value.
test('the Legion card reports a settings write the host refuses', async () => {
  const React = statefulReact()
  const client = await clientWith(React)
  const writes = []
  const snapshot = {
    status: 'ready',
    value: { minSubtasks: 2, maxSubtasks: 4, maxDepth: 0, workersPerTask: 1, mergeStrategy: 'best',
      maxReviewRetries: 2, requireHumanApproval: true, maxTasksPerRun: 0 },
    user: { maxDepth: 3 },
    writable: true,
  }
  const refuse = (op) => (...args) => { writes.push([op, ...args]); return Promise.resolve(false) }
  const scope = {
    subscribe: () => () => {},
    getSnapshot: () => snapshot,
    set: refuse('set'),
    unset: refuse('unset'),
    mutate: refuse('mutate'),
  }
  let Card
  client.apply({
    configForms: { get: () => scope },
    slots: {
      inject: (_name, register) => { register() },
      register: (options, component) => {
        if (options.name === 'plugins.row.config') Card = component
        return () => {}
      },
    },
  })
  const render = () => { React.reset(); return nodesOf(Card({ view: 'page' })) }
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

  render().find((node) => node.type === 'button' && textOfNode(node) === 'Reconcile').props.onClick()
  await settle()
  assert.deepEqual(writes, [['set', 'mergeStrategy', 'reconcile']])
  assert.match(textOfNode(render()), /The settings document refused the change\./)

  render().find((node) => node.type === 'button' && /^Reset/.test(textOfNode(node))).props.onClick()
  await settle()
  assert.deepEqual(writes.at(-1), ['unset', 'maxDepth'])
  assert.match(textOfNode(render()), /refused the change/, 'a refused reset is reported too')
})
