/**
 * dsh-legion — spydr-style recursive task decomposition for DeepSeek Harness.
 *
 * One `/legion` command with a verb grammar, backed by the harness's native
 * Agent Teams instead of a private scheduler:
 *
 *   /legion <task>              queue the decomposition protocol (start)
 *   /legion status              roster + shared task board
 *   /legion config              effective settings
 *   /legion stop                interrupt every teammate, tell the lead to halt
 *   /legion approve [note]      answer the human root-approval gate
 *   /legion reject <reason>     reject the root deliverable with a reason
 *
 * Configuration lives in the `legion` settings namespace (patch row or the
 * Settings → Plugins card). It rides into the run inside the kickoff relay,
 * so a change applies to the next run with no reload and costs no prompt
 * on turns where no run is active.
 *
 * Load via a row in ~/.dsh/profiles/<profile>/cordis.patch.yml, or
 * `--patch cordis.local.yml`.
 */
import z from '@deepseek-ai/schemastery'
import { createUserMessage } from '@deepseek-ai/dsh-llm/message'
import {
  USAGE,
  buildKickoff,
  clampSettings,
  formatConfig,
  formatStatus,
  parseLegion,
  relayText,
  DEFAULTS,
} from './lib/logic.js'

export const name = 'legion'

// `commands` registers the verb grammar; `settings` and `agentTeams` are
// optional services reached through ctx.get, so a headless or team-less
// composition still mounts the command and degrades per verb.
export const inject = ['commands']

/**
 * Row schema. v0.1.7 reads settings from this Config, not a side document.
 * `.volatile()` lets a profile edit land without remounting the plugin.
 */
export const Config = z.object({
  minSubtasks: z.number().step(1).min(1).max(20).default(DEFAULTS.minSubtasks).volatile(),
  maxSubtasks: z.number().step(1).min(1).max(20).default(DEFAULTS.maxSubtasks).volatile(),
  maxDepth: z.number().step(1).min(1).max(20).default(DEFAULTS.maxDepth).volatile(),
  workersPerTask: z.number().step(1).min(1).max(16).default(DEFAULTS.workersPerTask).volatile(),
  mergeStrategy: z.union(['best', 'reconcile']).default(DEFAULTS.mergeStrategy).volatile(),
  maxReviewRetries: z.number().step(1).min(0).max(20).default(DEFAULTS.maxReviewRetries).volatile(),
  requireHumanApproval: z.boolean().default(DEFAULTS.requireHumanApproval).volatile(),
  maxTasksPerRun: z.number().step(1).min(0).max(10000).default(DEFAULTS.maxTasksPerRun).volatile(),
})

/** Settings namespace shared with the browser card — the join key between halves. */
export const LEGION_SETTINGS_NAMESPACE = 'legion'

/** Schema of the `legion` settings section (the card edits this shape). */
export const LEGION_SETTINGS_SCHEMA = Config

/**
 * Queue one relay message as the agent's next turn.
 * @param {object} agent - the exact receiving agent.
 * @param {string} text - the relay body.
 * @param {readonly object[]} [attachments] - durable blocks carried first.
 */
function relay(agent, text, attachments = []) {
  agent.followup(createUserMessage({
    content: [...attachments, { type: 'text', text }],
    source: { kind: 'legion', form: 'relay' },
  }))
}

/**
 * Resolve the team service's view for one agent, or the reason there is none.
 * @param {object|undefined} teams - `ctx.agentTeams`, when mounted.
 * @param {object} agent - the command's receiving agent.
 * @returns {{ok: true, members: object[], tasks: object[]} |
 *           {ok: false, reason: string}}
 */
function teamView(teams, agent) {
  if (teams === undefined) {
    return { ok: false, reason: 'Agent Teams is not mounted in this composition; /legion needs it.' }
  }
  const membership = teams.tryMembership?.(agent)
  if (membership === undefined) {
    return { ok: false, reason: 'This session is not part of a team. Start a run with /legion <task>.' }
  }
  return { ok: true, members: teams.listMembers(agent), tasks: teams.listTasks(agent) }
}

/**
 * Mount the plugin.
 * @param {object} ctx - the host context.
 * @param {object} [config] - the validated patch-row configuration.
 */
function plainConfig(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') return value.get()
  return value
}

function liveConfig(config) {
  const plain = {}
  for (const [key, value] of Object.entries(config)) plain[key] = plainConfig(value)
  return plain
}

export function apply(ctx, config = {}) {
  // Volatile fields update this object in place. Read it when the command runs.
  const source = () => clampSettings(liveConfig(config))

  ctx.effect(() => {
    const dispose = ctx.commands.register({
      definitionId: 'dsh-legion:legion',
      name: 'legion',
      description: '⚔ Recursive task decomposition: /legion <task> starts a run; status | config | stop | approve [note] | reject <reason>',
      input: { hint: '<task> | start <task> | status | config | stop | approve [note] | reject <reason>', attachments: true },
      handler: (invocation) => legionHandler(invocation, ctx, source),
    })
    return () => dispose()
  })
}

/**
 * Run one `/legion` invocation.
 * @param {object} invocation - the command invocation.
 * @param {object} ctx - the host context.
 * @param {() => object} source - the settings source reader.
 * @returns {Promise<{kind: 'success'|'error', text?: string}>} the UI result.
 */
function legionHandler(invocation, ctx, source) {
  const parsed = parseLegion(invocation.rawInput)
  const agent = invocation.agent
  const teams = ctx.get?.('agentTeams')

  // Attachments are admitted by the definition; only a starting run can carry
  // them into the kickoff, so any other verb gives the originals back.
  if (invocation.attachments?.length > 0 && parsed.kind !== 'start') {
    return Promise.resolve({
      kind: 'error',
      text: 'Attachments only accompany a starting run (/legion <task>). Send the verb without them.',
    })
  }

  switch (parsed.kind) {
    case 'usage':
      return Promise.resolve({ kind: 'error', text: USAGE })

    case 'error':
      return Promise.resolve({ kind: 'error', text: parsed.text })

    case 'start': {
      relay(agent, buildKickoff(parsed.task, source()), invocation.attachments ?? [])
      const c = clampSettings(source())
      return Promise.resolve({
        kind: 'success',
        text: `Legion run started: "${parsed.task}" — up to ${c.maxDepth} level(s) deep, `
          + `${c.minSubtasks}-${c.maxSubtasks} subtasks per split, ${c.workersPerTask} worker(s) per leaf, `
          + `human root approval ${c.requireHumanApproval ? 'required' : 'off'}. Track it with /legion status.`,
      })
    }

    case 'status': {
      const view = teamView(teams, agent)
      if (!view.ok) return Promise.resolve({ kind: 'error', text: view.reason })
      return Promise.resolve({ kind: 'success', text: formatStatus(view) })
    }

    case 'config':
      return Promise.resolve({ kind: 'success', text: formatConfig(source()) })

    case 'stop': {
      const view = teamView(teams, agent)
      if (!view.ok) return Promise.resolve({ kind: 'error', text: view.reason })
      const membership = teams.tryMembership(agent)
      if (membership.role !== 'lead') {
        return Promise.resolve({ kind: 'error', text: 'Only the Team Lead can stop a legion run.' })
      }
      let interrupted = 0
      for (const member of view.members) {
        if (member.role === 'teammate') {
          try {
            teams.interrupt(agent, member.name)
            interrupted += 1
          } catch {
            // A teammate that settled between the roster read and the interrupt
            // needs no report: the run is being stopped either way.
          }
        }
      }
      relay(agent, relayText('stop'))
      return Promise.resolve({
        kind: 'success',
        text: `Stopped ${interrupted} teammate(s); the lead was told to halt and summarize.`,
      })
    }

    case 'approve':
      relay(agent, relayText('approve', parsed.note))
      return Promise.resolve({
        kind: 'success',
        text: parsed.note
          ? `Approval relayed to the lead with your note: "${parsed.note}".`
          : 'Approval relayed to the lead; the run closes.',
      })

    case 'reject':
      relay(agent, relayText('reject', parsed.reason))
      return Promise.resolve({
        kind: 'success',
        text: `Rejection relayed to the lead: "${parsed.reason}". The deliverable goes back for rework.`,
      })

    default:
      return Promise.resolve({ kind: 'error', text: USAGE })
  }
}
