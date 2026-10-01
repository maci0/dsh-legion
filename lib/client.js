/**
 * dsh-legion — browser half.
 *
 * The Legion card on the Plugins page, keyed on the
 * `legion` settings namespace the host half installs. It edits the same
 * decomposition knobs the `/legion` kickoff reads: subtask bounds, depth cap,
 * workers per leaf, merge strategy, review retries, human root approval, and
 * the per-run task budget.
 *
 * One form (`ctx.configForms.get`) is the only source either half
 * sees, so the card and `/legion config` cannot disagree. Numbers commit on
 * blur or Enter with per-field bounds (the same limits the host schema
 * enforces), so a half-typed value never reaches the wire.
 *
 * Plain JavaScript on purpose: the client module system serves this file as a
 * lazy-CJS factory on `window.__ModuleLoader__`; `react` is provided.
 */

window.__ModuleLoader__.load({
  id: 'dsh-legion',

  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    const React = require('react')
    const createElement = React.createElement

    /** Settings namespace shared with the host half; also this card's slot key. */
    const NAMESPACE = 'legion'

    /** Numeric fields: bounds mirror the host schema and lib/logic.js LIMITS. */
    const NUMBERS = [
      { key: 'minSubtasks', label: 'Min subtasks', min: 1, max: 20, hint: 'Fewer proposals than this means the task is a leaf.' },
      { key: 'maxSubtasks', label: 'Max subtasks', min: 1, max: 20, hint: 'Extra proposals are truncated to this.' },
      { key: 'maxDepth', label: 'Max depth', min: 0, max: 20, hint: 'Hard cap on decomposition levels; 0 = no cap.' },
      { key: 'workersPerTask', label: 'Workers per leaf', min: 1, max: 16, hint: 'Independent candidates combined by the merge strategy.' },
      { key: 'maxReviewRetries', label: 'Review retries', min: 0, max: 20, hint: 'Rework attempts before a task fails terminally.' },
      { key: 'maxTasksPerRun', label: 'Task budget', min: 0, max: 10000, hint: 'Tasks a single run may create; 0 = unlimited.' },
    ]

    const STRATEGIES = [
      { value: 'best', label: 'Best', hint: 'A judge picks the strongest candidate verbatim.' },
      { value: 'reconcile', label: 'Reconcile', hint: 'Merge the strengths of every candidate.' },
    ]

    /** Every class is `lg-`-prefixed: the sheet lands in the page's own document. */
    const CSS = [
      '.lg-body{border-top:0.5px solid var(--dsw-alias-border-l2);margin:0 16px;padding:12px 0 8px;display:flex;flex-direction:column;gap:12px}',
      '.lg-group{display:flex;flex-direction:column;gap:8px}',
      '.lg-group-label{font-size:12px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-secondary);text-transform:uppercase;letter-spacing:.04em}',
      '.lg-row{display:flex;flex-wrap:wrap;gap:8px}',
      '.lg-field{flex:1 1 200px;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.lg-label{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-primary);display:flex;align-items:center;gap:6px}',
      '.lg-dot{width:5px;height:5px;border-radius:50%;background:var(--dsw-alias-label-accent);flex:none}',
      '.lg-hint{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}',
      '.lg-input{font:inherit;font-size:13px;line-height:1.5;padding:5px 12px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-4);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;width:100%;box-sizing:border-box}',
      '.lg-input:disabled{cursor:default;opacity:.5}',
      '.lg-input-invalid{border-color:var(--dsw-alias-label-error)}',
      '.lg-pill{appearance:none;font:inherit;font-size:13px;line-height:1.5;padding:5px 14px;cursor:pointer;color:var(--dsw-alias-label-secondary);background:none;border:1px solid var(--dsw-alias-border-l2);border-radius:999px}',
      '.lg-pill-selected{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-4)}',
      '.lg-pill:disabled{cursor:default;opacity:.5}',
      '.lg-status{display:flex;align-items:center;gap:8px;font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.lg-reset{appearance:none;font:inherit;font-size:12px;line-height:1.5;padding:3px 10px;cursor:pointer;color:var(--dsw-alias-label-secondary);background:none;border:1px solid var(--dsw-alias-border-l2);border-radius:8px}',
      '.lg-error{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-error)}',
      // Decomposition view: a hierarchical tree beside Chat and Trajectory.
      // Round-rect cards on status-colored borders, joined by CSS rails — the
      // same visual language as spydr's graph, with no canvas and no dependency.
      // No own scrollport: the conversation view area already scrolls.
      '.lgv-page{display:flex;flex-direction:column;gap:12px;padding:16px 20px;box-sizing:border-box}',
      '.lgv-head{display:flex;flex-direction:column;gap:3px}',
      '.lgv-title{font-size:14px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}',
      '.lgv-summary{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.lgv-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:11px;color:var(--dsw-alias-label-tertiary)}',
      '.lgv-legend span{display:inline-flex;align-items:center;gap:5px}',
      '.lgv-legend i{display:inline-block;width:9px;height:9px;border-radius:3px;border:1.5px solid var(--dsw-alias-border-l2)}',
      '.lgv-legend .lgv-l-completed{border-color:var(--dsw-alias-state-success-primary)}',
      '.lgv-legend .lgv-l-in_progress{border-color:var(--dsw-alias-label-accent)}',
      '.lgv-legend .lgv-l-pending{border-style:dashed}',
      '.lgv-members{display:flex;flex-wrap:wrap;gap:6px}',
      '.lgv-member{font-size:11px;line-height:1.6;padding:1px 9px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;color:var(--dsw-alias-label-secondary)}',
      '.lgv-member-lead{border-color:var(--dsw-alias-label-accent);color:var(--dsw-alias-label-primary)}',
      '.lgv-member-failed{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
      '.lgv-list,.lgv-children{list-style:none;margin:0;padding:0}',
      '.lgv-list{display:flex;flex-direction:column;gap:4px}',
      '.lgv-children{margin-left:11px;padding-left:15px;border-left:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:4px}',
      '.lgv-branch{position:relative}',
      '.lgv-children>.lgv-branch::before{content:"";position:absolute;left:-15px;top:18px;width:13px;border-top:1px solid var(--dsw-alias-border-l2)}',
      '.lgv-node{display:flex;align-items:center;gap:8px;padding:5px 10px;border:1.5px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-3)}',
      '.lgv-node-completed{border-color:var(--dsw-alias-state-success-primary);opacity:.8}',
      '.lgv-node-in_progress{border-color:var(--dsw-alias-label-accent)}',
      '.lgv-node-pending{border-style:dashed}',
      '.lgv-node-deleted{opacity:.45}',
      '.lgv-node-cycle{border-color:var(--dsw-alias-state-error-primary)}',
      '@keyframes lgv-breathe{0%,100%{border-color:var(--dsw-alias-label-accent)}50%{border-color:var(--dsw-alias-label-dimmed)}}',
      '@media (prefers-reduced-motion:no-preference){.lgv-node-in_progress{animation:lgv-breathe 2.4s ease-in-out infinite}}',
      '.lgv-twisty{flex:none;width:17px;height:17px;padding:0;appearance:none;border:1px solid var(--dsw-alias-border-l2);border-radius:4px;background:none;color:var(--dsw-alias-label-secondary);font-size:10px;line-height:1;cursor:pointer}',
      '.lgv-leaf{flex:none;width:17px;text-align:center;font-size:11px;color:var(--dsw-alias-label-dimmed)}',
      '.lgv-status{flex:none;width:14px;text-align:center;font-size:12px;color:var(--dsw-alias-label-tertiary)}',
      '.lgv-node-in_progress .lgv-status{color:var(--dsw-alias-label-accent)}',
      '.lgv-node-completed .lgv-status{color:var(--dsw-alias-state-success-primary)}',
      '.lgv-node-main{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1 1 auto}',
      '.lgv-subject{font-size:13px;line-height:1.45;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.lgv-node-completed .lgv-subject{color:var(--dsw-alias-label-secondary)}',
      '.lgv-meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:11px;line-height:1.4;color:var(--dsw-alias-label-tertiary)}',
      '.lgv-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}',
      '.lgv-chip{padding:0 6px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px}',
      '.lgv-chip-owner{color:var(--dsw-alias-label-secondary)}',
      '.lgv-chip-ready{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}',
      '.lgv-chip-warn{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}',
      '.lgv-hidden{font-size:11px;line-height:1.6;padding-left:25px;color:var(--dsw-alias-label-dimmed)}',
      '.lgv-empty{font-size:13px;line-height:1.6;color:var(--dsw-alias-label-tertiary);padding:16px 20px}',
      '.lgv-error{font-size:12px;line-height:1.5;color:var(--dsw-alias-state-error-primary);padding:0 20px}',
    ].join('')

    // Appended while the factory materializes: the module system claims the tag
    // for this package and disposes it on unload. Guarded because the node unit
    // tests evaluate this file without a DOM.
    if (typeof document !== 'undefined') {
      const style = document.createElement('style')
      style.textContent = CSS
      document.head.append(style)
    }

    /**
     * Bind one scope to a React subscription.
     * @param scope - a scope bound to the legion settings namespace.
     * @returns a hook reading that scope's current snapshot.
     */
    function useScope(scope) {
      const subscribe = (listener) => scope.subscribe(listener)
      const getSnapshot = () => scope.getSnapshot()
      return () => React.useSyncExternalStore(subscribe, getSnapshot)
    }

    /**
     * Read the resolved section from a snapshot, clamped to card defaults.
     * A namespace this deployment does not serve reports `undefined`.
     * @param snapshot - the settings scope snapshot.
     * @returns the current field values, or `undefined` when unreadable.
     */
    function sectionOf(snapshot) {
      if (snapshot.status !== 'ready') return undefined
      const value = snapshot.value !== null && typeof snapshot.value === 'object' ? snapshot.value : {}
      return value
    }

    /** `depth ≤ N`, or `depth unlimited` when the cap is off (0). */
    function depthLabel(maxDepth) {
      return maxDepth === 0 ? 'depth unlimited' : `depth ≤ ${maxDepth}`
    }

    /** Task status glyph for one node card, and the legend's words. */
    const STATUS_MARK = { completed: '✓', in_progress: '◐', pending: '○', deleted: '×' }
    const STATUS_LEGEND = [
      ['completed', 'lgv-l-completed'],
      ['in progress', 'lgv-l-in_progress'],
      ['pending', 'lgv-l-pending'],
    ]

    /** Stable empty board, so the projection-absent path allocates once. */
    const NO_TASKS = []

    /** Size of a closed subtree, so a collapsed branch still says what it hides. */
    function countDescendants(node) {
      let total = 0
      const stack = [...node.children]
      while (stack.length > 0) {
        const child = stack.pop()
        total += 1
        for (const grandchild of child.children) stack.push(grandchild)
      }
      return total
    }

    /**
     * Fold the flat team board into the decomposition tree.
     *
     * `blockedBy` is the only parent edge the protocol writes, so a task hangs
     * under its first blocker that is still on the board, and a task with no
     * live blocker is a root — a blocker that was deleted reads as unblocked,
     * not orphaned. Board rows that no root reaches are a malformed loop; they
     * are promoted to roots so they stay visible, and the loop itself is marked
     * on the node it re-enters instead of walking forever. Extra blockers of a
     * node stay visible as a `+N blocker(s)` badge rather than a second subtree.
     *
     * @param {readonly object[]} tasks - live task views from the team projection.
     * @returns {object[]} roots, each `{ task, depth, cycle, children }`.
     */
    function buildTaskTree(tasks) {
      const byId = new Map(tasks.map((task) => [task.id, task]))
      const children = new Map()
      const roots = []
      for (const task of tasks) {
        const blockers = Array.isArray(task.blockedBy) ? task.blockedBy : []
        const parent = blockers.find((id) => id !== task.id && byId.has(id))
        if (parent === undefined) {
          roots.push(task)
          continue
        }
        const siblings = children.get(parent)
        if (siblings === undefined) children.set(parent, [task])
        else siblings.push(task)
      }
      // ponytail: recursion depth is the tree depth. Real runs stay shallow
      // (the agent stops at atomic tasks); go iterative if depth 10k land.
      const placed = new Set()
      const path = new Set()
      const walk = (task, depth) => {
        const cycle = path.has(task.id)
        if (!cycle) {
          path.add(task.id)
          placed.add(task.id)
        }
        const node = {
          task,
          depth,
          cycle,
          children: cycle ? [] : (children.get(task.id) ?? []).map((child) => walk(child, depth + 1)),
        }
        if (!cycle) path.delete(task.id)
        return node
      }
      const tree = roots.map((task) => walk(task, 0))
      for (const task of tasks) {
        if (!placed.has(task.id)) tree.push(walk(task, 0))
      }
      return tree
    }

    /** Deepest level of a built tree, counted without recursion. */
    function treeDepth(nodes) {
      let depth = 0
      const stack = nodes.map((node) => [node, 1])
      while (stack.length > 0) {
        const [node, level] = stack.pop()
        if (level > depth) depth = level
        for (const child of node.children) stack.push([child, level + 1])
      }
      return depth
    }

    /**
     * One node card plus its subtree, drawn as a hierarchy.
     *
     * The rails painted by `.lgv-children` and `.lgv-branch` carry the
     * parent/child edges, so the shape reads as a tree with no layout pass, no
     * canvas, and no dependency: a card per task, status-colored, collapsible,
     * indented by depth. Mirrors spydr's graph language (round-rect node on a
     * status border, active work lit) in the harness's own CSS tokens.
     *
     * @param node - a node from `buildTaskTree`.
     * @param collapsed - ids whose subtrees are closed.
     * @param onToggle - close or open one subtree.
     * @returns the branch list item.
     */
    function renderNode(node, collapsed, onToggle) {
      const task = node.task
      const hasChildren = node.children.length > 0
      const closed = hasChildren && collapsed.has(task.id)
      const blockers = Array.isArray(task.blockedBy) ? task.blockedBy : []
      const extraBlockers = Math.max(0, blockers.length - 1)
      const overlaps = Array.isArray(task.writeScopeWarnings) ? task.writeScopeWarnings.length : 0
      const detail = task.description === undefined || task.description === ''
        ? task.subject
        : `${task.subject}\n\n${task.description}`
      const chip = (extra, text, title) => createElement('span', {
        className: `lgv-chip${extra}`, title,
      }, text)

      return createElement('li', { key: `${task.id}#${node.depth}`, className: 'lgv-branch' },
        createElement('div', { className: `lgv-node lgv-node-${task.status}`, title: detail },
          hasChildren
            ? createElement('button', {
              type: 'button',
              className: 'lgv-twisty',
              'aria-expanded': !closed,
              'aria-label': `${closed ? 'Expand' : 'Collapse'} ${task.id}`,
              onClick: () => onToggle(task.id),
            }, closed ? '▸' : '▾')
            : createElement('span', { className: 'lgv-leaf', 'aria-hidden': true }, '•'),
          createElement('span', { className: 'lgv-status', title: task.status }, STATUS_MARK[task.status] ?? '•'),
          createElement('span', { className: 'lgv-node-main' },
            createElement('span', { className: 'lgv-subject' }, task.subject),
            createElement('span', { className: 'lgv-meta' },
              createElement('span', { className: 'lgv-id' }, task.id),
              node.depth > 0 ? createElement('span', { className: 'lgv-level' }, `L${node.depth}`) : null,
              task.ownerName === undefined ? null : chip(' lgv-chip-owner', `@${task.ownerName}`),
              task.status === 'pending' && task.ready === true ? chip(' lgv-chip-ready', 'ready') : null,
              extraBlockers > 0 ? chip('', `+${extraBlockers} blocker(s)`, blockers.join(', ')) : null,
              overlaps > 0
                ? chip(' lgv-chip-warn', `${overlaps} overlap(s)`, task.writeScopeWarnings.join('; '))
                : null,
              node.cycle ? chip(' lgv-chip-warn', 'cycle', 'a blocker chain loops back here') : null,
            ),
          ),
        ),
        hasChildren && !closed
          ? createElement('ul', { className: 'lgv-children' },
            node.children.map((child) => renderNode(child, collapsed, onToggle)))
          : null,
        closed
          ? createElement('div', { className: 'lgv-hidden' }, `${countDescendants(node)} hidden task(s)`)
          : null,
      )
    }

    /**
     * The Legion decomposition view beside Chat and Trajectory: the run's task
     * board folded into the parent/child tree the protocol builds from
     * `blocked_by` edges. The lead session's `agentTeam` projection carries the
     * values, so the tree tracks the run live with no polling, no RPC, and no
     * work on turns where the tab is not selected.
     * @param props - standard conversation view props.
     */
    function LegionView({ useProjection }) {
      const team = useProjection('agentTeam')
      const tasks = team !== null && typeof team === 'object' && Array.isArray(team.tasks) ? team.tasks : NO_TASKS
      const tree = React.useMemo(() => buildTaskTree(tasks), [tasks])
      const [collapsed, setCollapsed] = React.useState(() => new Set())
      const toggle = (id) => setCollapsed((current) => {
        const next = new Set(current)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })

      if (team === undefined || team === null) {
        return createElement('div', { className: 'lgv-empty' },
          'Agent Teams is not mounted in this composition, so there is no team task board to draw. '
          + 'Enable the experimental bundle with '
          + 'dsh plugin --profile <name> add @deepseek-ai/dsh-experimental-agent-team-profile, '
          + 'then restart the harness.')
      }
      if (tasks.length === 0) {
        return createElement('div', { className: 'lgv-empty' },
          'No legion run in this session. Start one with /legion <task>, or open the lead session of a run.')
      }
      const members = Array.isArray(team.members) ? team.members : []
      const settled = tasks.filter((task) => task.status === 'completed').length
      const running = tasks.filter((task) => task.status === 'in_progress').length
      // `ready` is the projection's own "no unmet blocker" answer: a pending
      // task whose blockers all completed keeps its `blockedBy` ids but is not
      // blocked, and the node card already draws it as ready.
      const blocked = tasks.filter((task) => task.status === 'pending' && task.ready !== true).length
      return createElement('div', { className: 'lgv-page' },
        createElement('div', { className: 'lgv-head' },
          createElement('span', { className: 'lgv-title' },
            `Legion decomposition — ${tasks.length} task(s), ${treeDepth(tree)} level(s)`),
          createElement('span', { className: 'lgv-summary' },
            `${settled} completed · ${running} in progress · ${blocked} blocked · ${members.length} member(s)`),
        ),
        createElement('div', { className: 'lgv-legend' },
          STATUS_LEGEND.map(([label, className]) => createElement('span', { key: label },
            createElement('i', { className }), label))),
        members.length === 0 ? null : createElement('div', { className: 'lgv-members' },
          members.map((member) => createElement('span', {
            key: member.id ?? member.name,
            className: `lgv-member${member.role === 'lead' ? ' lgv-member-lead' : ''}`
              + `${member.phase === 'failed' ? ' lgv-member-failed' : ''}`,
            title: member.error ?? member.phase,
          }, `${member.name} (${member.role}${member.phase === 'active' ? '' : `, ${member.phase}`})`))),
        team.failure === undefined
          ? null
          : createElement('div', { className: 'lgv-error' }, `Task board projection failure: ${team.failure}`),
        createElement('ul', { className: 'lgv-list' }, tree.map((node) => renderNode(node, collapsed, toggle))),
      )
    }

    /**
     * Build the card component over one bound settings scope.
     * @param scope - the scope bound to the legion namespace.
     * @returns the component the slot renders.
     */
    function createCard(scope) {
      const useLegion = useScope(scope)

      /** One numeric editor: local text while typing, committed on blur/Enter. */
      function NumberField({ field, value, overridden, disabled, onCommit }) {
        const [draft, setDraft] = React.useState(String(value))
        const [invalid, setInvalid] = React.useState(false)
        // Re-sync from the store only after external movement (a reset, another tab),
        // so a keystroke the user is mid-way through is never clobbered.
        const last = React.useRef(value)
        React.useEffect(() => {
          if (last.current !== value) {
            last.current = value
            setDraft(String(value))
            setInvalid(false)
          }
        }, [value])

        const commit = () => {
          const n = Number(draft)
          if (!Number.isSafeInteger(n) || n < field.min || n > field.max) {
            setInvalid(true)
            return
          }
          setInvalid(false)
          if (n !== value) onCommit(field.key, n)
        }

        return createElement('div', { className: 'lg-field' },
          createElement('label', { className: 'lg-label' },
            overridden ? createElement('span', { className: 'lg-dot', title: 'Overridden in your settings' }) : null,
            field.label,
          ),
          createElement('input', {
            className: `lg-input${invalid ? ' lg-input-invalid' : ''}`,
            type: 'text',
            inputMode: 'numeric',
            value: draft,
            disabled,
            'aria-label': `${field.label} (${field.min}-${field.max})`,
            onChange: (e) => setDraft(e.target.value),
            onBlur: commit,
            onKeyDown: (e) => { if (e.key === 'Enter') commit() },
          }),
          createElement('span', { className: 'lg-hint' }, invalid
            ? `Whole number ${field.min}-${field.max}.`
            : field.hint),
        )
      }

      return function LegionCard(props) {
        const snapshot = useLegion()
        const [error, setError] = React.useState(null)

        const section = sectionOf(snapshot)
        // A namespace this deployment does not serve renders no trace of itself.
        if (section === undefined) return null

        const user = snapshot.user !== null && typeof snapshot.user === 'object' ? snapshot.user : {}
        const overriddenCount = Object.keys(user).length
        const disabled = !snapshot.writable

        const report = (cause) => {
          setError(cause instanceof Error ? cause.message : String(cause))
        }
        const write = (run) => {
          setError(null)
          Promise.resolve(run()).catch(report)
        }
        // Mirror the host's cross-field rule (max ≥ min): an inverted pair is
        // unwritable in the schema, so the commit repairs it instead of
        // showing a summary the kickoff would silently clamp anyway.
        const setField = (key, value) => write(() => {
          if (key === 'minSubtasks' && value > section.maxSubtasks) {
            return scope.mutate([
              { op: 'set', path: ['minSubtasks'], value },
              { op: 'set', path: ['maxSubtasks'], value },
            ])
          }
          if (key === 'maxSubtasks' && value < section.minSubtasks) {
            return scope.set('maxSubtasks', section.minSubtasks)
          }
          return scope.set(key, value)
        })
        const pickStrategy = (value) => setField('mergeStrategy', value)
        const resetAll = () => write(() => Promise.all(
          Object.keys(user).map((key) => scope.unset(key)),
        ))

        const strategy = STRATEGIES.filter((s) => s.value === section.mergeStrategy)[0] ?? STRATEGIES[0]
        const approval = section.requireHumanApproval === true
        if (props != null && props.view === 'summary') {
          return `Split into ${section.minSubtasks}-${section.maxSubtasks} subtasks, ${depthLabel(section.maxDepth)}.`
        }

        return createElement(
          'div',
          { className: 'lg-page' },
          createElement(
            'div',
            { className: 'lg-body' },
              createElement(
                'div',
                { className: 'lg-group' },
                createElement('span', { className: 'lg-group-label' }, 'Decomposition'),
                createElement(
                  'div',
                  { className: 'lg-row' },
                  NUMBERS.slice(0, 3).map((field) => createElement(NumberField, {
                    key: field.key,
                    field,
                    value: section[field.key],
                    overridden: Object.prototype.hasOwnProperty.call(user, field.key),
                    disabled,
                    onCommit: setField,
                  })),
                ),
              ),
              createElement(
                'div',
                { className: 'lg-group' },
                createElement('span', { className: 'lg-group-label' }, 'Execution and review'),
                createElement(
                  'div',
                  { className: 'lg-row' },
                  ...NUMBERS.slice(3).map((field) => createElement(NumberField, {
                    key: field.key,
                    field,
                    value: section[field.key],
                    overridden: Object.prototype.hasOwnProperty.call(user, field.key),
                    disabled,
                    onCommit: setField,
                  })),
                ),
              ),
              createElement(
                'div',
                { className: 'lg-group' },
                createElement('span', { className: 'lg-group-label' }, 'Merge strategy'),
                createElement(
                  'div',
                  { className: 'lg-row', role: 'radiogroup', 'aria-label': 'Merge strategy' },
                  STRATEGIES.map((s) => createElement('button', {
                    key: s.value,
                    type: 'button',
                    role: 'radio',
                    'aria-checked': section.mergeStrategy === s.value,
                    disabled,
                    className: `lg-pill${section.mergeStrategy === s.value ? ' lg-pill-selected' : ''}`,
                    title: s.hint,
                    onClick: () => pickStrategy(s.value),
                  }, s.label)),
                ),
                createElement('span', { className: 'lg-hint' }, strategy.hint),
              ),
              createElement(
                'div',
                { className: 'lg-group' },
                createElement('span', { className: 'lg-group-label' }, 'Human root approval'),
                createElement(
                  'div',
                  { className: 'lg-row', role: 'radiogroup', 'aria-label': 'Human root approval' },
                  [['required', true], ['off', false]].map(([label, value]) => createElement('button', {
                    key: label,
                    type: 'button',
                    role: 'radio',
                    'aria-checked': approval === value,
                    disabled,
                    className: `lg-pill${approval === value ? ' lg-pill-selected' : ''}`,
                    onClick: () => setField('requireHumanApproval', value),
                  }, label === 'required' ? 'Required' : 'Off')),
                ),
                createElement('span', { className: 'lg-hint' },
                  approval
                    ? 'The root deliverable waits for /legion approve or /legion reject.'
                    : 'The lead closes the root itself once every child completes.'),
              ),
              createElement(
                'div',
                { className: 'lg-status' },
                snapshot.writable
                  ? 'Applies to the next /legion run and persists in your settings.'
                  : 'Read-only: settings are not persisted in this deployment.',
                overriddenCount > 0
                  ? createElement('button', {
                    type: 'button',
                    className: 'lg-reset',
                    disabled,
                    onClick: resetAll,
                  }, `Reset ${overriddenCount}`)
                  : null,
              ),
              error === null ? null : createElement('div', { className: 'lg-error' }, error),
            ),
        )
      }
    }

    /**
     * Mount the Plugins card and the decomposition view.
     * @param ctx - the client root context.
     */
    function apply(ctx) {
      const scope = ctx.configForms.get(NAMESPACE)
      const Card = createCard(scope)

      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config',
        key: 'dsh-legion#legion',
      }, Card))

      // The Legion view: a third tab beside Chat and Trajectory. Values come
      // from the session's `agentTeam` projection, which the harness's own
      // Agent Teams plugin publishes, so this half needs no response shape of
      // its own and no change to the host half.
      ctx.slots.inject('conversation.view', () => ctx.slots.register({
        name: 'conversation.view',
        id: 'legion',
        order: 20,
        label: 'Legion',
      }, LegionView))
    }

    exports.apply = apply
    exports.inject = ['slots', 'configForms']
    // Exported for the unit tests: the tree fold is the view's only logic.
    exports.buildTaskTree = buildTaskTree
    return module.exports
  },
})
