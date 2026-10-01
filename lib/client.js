/**
 * dsh-legion browser half.
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

    /** Locale namespace for the card's copy. */
    const LOCALE_NS = 'legion'

    /**
     * Numeric fields: bounds mirror the host schema and lib/logic.js LIMITS.
     * Copy resolves as `<key>Label` and `<key>Hint`.
     */
    const NUMBERS = [
      { key: 'minSubtasks', min: 1, max: 20 },
      { key: 'maxSubtasks', min: 1, max: 20 },
      { key: 'maxDepth', min: 0, max: 20 },
      { key: 'workersPerTask', min: 1, max: 16 },
      { key: 'maxReviewRetries', min: 0, max: 20 },
      { key: 'maxTasksPerRun', min: 0, max: 10000 },
    ]

    /** Merge strategies; copy resolves as `<value>Label` and `<value>Hint`. */
    const STRATEGIES = ['best', 'reconcile']

    const en = {
      minSubtasksLabel: 'Min subtasks',
      minSubtasksHint: 'Fewer proposals than this means the task is a leaf.',
      maxSubtasksLabel: 'Max subtasks',
      maxSubtasksHint: 'Extra proposals are truncated to this.',
      maxDepthLabel: 'Max depth',
      maxDepthHint: 'Hard cap on decomposition levels; 0 = no cap.',
      workersPerTaskLabel: 'Workers per leaf',
      workersPerTaskHint: 'Independent candidates combined by the merge strategy.',
      maxReviewRetriesLabel: 'Review retries',
      maxReviewRetriesHint: 'Rework attempts before a task fails terminally.',
      maxTasksPerRunLabel: 'Task budget',
      maxTasksPerRunHint: 'Tasks a single run may create; 0 = unlimited.',
      bestLabel: 'Best',
      bestHint: 'A judge picks the strongest candidate verbatim.',
      reconcileLabel: 'Reconcile',
      reconcileHint: 'Merge the strengths of every candidate.',
      groupDecomposition: 'Decomposition',
      groupExecution: 'Execution and review',
      groupStrategy: 'Merge strategy',
      groupApproval: 'Human root approval',
      overridden: 'Overridden in your settings',
      fieldRange: '{label} ({min}-{max})',
      invalid: 'Whole number {min}-{max}.',
      approvalRequired: 'Required',
      approvalOff: 'Off',
      approvalRequiredHint: 'The root deliverable waits for /legion approve or /legion reject.',
      approvalOffHint: 'The lead closes the root itself once every child completes.',
      persists: 'Applies to the next /legion run and persists in your settings.',
      readOnly: 'Read-only: settings are not persisted in this deployment.',
      reset: 'Reset {count}',
      summary: 'Split into {min}-{max} subtasks, {depth}.',
      depthUnlimited: 'depth unlimited',
      depthCapped: 'depth ≤ {depth}',
      refused: 'The settings document refused the change.',
      viewTitle: 'Legion decomposition: {tasks} task(s), {levels} level(s)',
      viewSummary: '{completed} completed · {running} in progress · {blocked} blocked · {members} member(s)',
      statusCompleted: 'completed',
      statusInProgress: 'in progress',
      statusPending: 'pending',
      statusDeleted: 'deleted',
      roleLead: 'lead',
      roleTeammate: 'teammate',
      phaseActive: 'active',
      phaseProvisioning: 'provisioning',
      phaseFailed: 'failed',
      member: '{name} ({role})',
      memberPhase: '{name} ({role}, {phase})',
      expand: 'Expand {id}',
      collapse: 'Collapse {id}',
      chipReady: 'ready',
      extraBlockers: '+{count} blocker(s)',
      overlaps: '{count} overlap(s)',
      cycle: 'cycle',
      cycleHint: 'a blocker chain loops back here',
      hidden: '{count} hidden task(s)',
      projectionFailure: 'Task board projection failure: {failure}',
      noTeams: 'Agent Teams is not mounted in this composition, so there is no team task board to draw. Enable the experimental bundle with dsh plugin --profile <name> add @deepseek-ai/dsh-experimental-agent-team-profile, then restart the harness.',
      noRun: 'No legion run in this session. Start one with /legion <task>, or open the lead session of a run.',
    }

    const zh = {
      minSubtasksLabel: '最少子任务',
      minSubtasksHint: '提出的子任务少于此数时，该任务即为叶子任务。',
      maxSubtasksLabel: '最多子任务',
      maxSubtasksHint: '超出的子任务提议会被截断到此数。',
      maxDepthLabel: '最大深度',
      maxDepthHint: '分解层级的硬上限；0 表示不设上限。',
      workersPerTaskLabel: '每个叶子的执行者',
      workersPerTaskHint: '由合并策略汇总的独立候选数。',
      maxReviewRetriesLabel: '评审重试',
      maxReviewRetriesHint: '任务最终失败前的返工次数。',
      maxTasksPerRunLabel: '任务预算',
      maxTasksPerRunHint: '单次运行可创建的任务数；0 表示不限。',
      bestLabel: '择优',
      bestHint: '由评审者原样选出最强的候选。',
      reconcileLabel: '融合',
      reconcileHint: '合并每个候选的长处。',
      groupDecomposition: '分解',
      groupExecution: '执行与评审',
      groupStrategy: '合并策略',
      groupApproval: '人工根审批',
      overridden: '已在你的设置中覆盖',
      fieldRange: '{label}（{min}-{max}）',
      invalid: '请输入 {min}-{max} 之间的整数。',
      approvalRequired: '需要',
      approvalOff: '关闭',
      approvalRequiredHint: '根交付物等待 /legion approve 或 /legion reject。',
      approvalOffHint: '所有子任务完成后，负责人自行关闭根任务。',
      persists: '应用于下一次 /legion 运行，并保存在你的设置中。',
      readOnly: '只读：此部署不持久化设置。',
      reset: '重置 {count} 项',
      summary: '拆分为 {min}-{max} 个子任务，{depth}。',
      depthUnlimited: '深度不限',
      depthCapped: '深度 ≤ {depth}',
      refused: '设置文档拒绝了此改动。',
      viewTitle: 'Legion 分解：{tasks} 个任务，{levels} 层',
      viewSummary: '已完成 {completed} · 进行中 {running} · 受阻 {blocked} · 成员 {members}',
      statusCompleted: '已完成',
      statusInProgress: '进行中',
      statusPending: '待处理',
      statusDeleted: '已删除',
      roleLead: '负责人',
      roleTeammate: '队员',
      phaseActive: '活跃',
      phaseProvisioning: '准备中',
      phaseFailed: '失败',
      member: '{name}（{role}）',
      memberPhase: '{name}（{role}，{phase}）',
      expand: '展开 {id}',
      collapse: '折叠 {id}',
      chipReady: '就绪',
      extraBlockers: '另有 {count} 个阻塞项',
      overlaps: '{count} 处写入范围重叠',
      cycle: '循环',
      cycleHint: '阻塞链在此处形成循环',
      hidden: '已隐藏 {count} 个任务',
      projectionFailure: '任务板投影失败：{failure}',
      noTeams: '此组合未挂载 Agent Teams，因此没有可绘制的团队任务板。请用 dsh plugin --profile <name> add @deepseek-ai/dsh-experimental-agent-team-profile 启用实验性组件包，然后重启 harness。',
      noRun: '此会话没有 legion 运行。用 /legion <task> 开始一次，或打开某次运行的负责人会话。',
    }

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
      // Round-rect cards on status-colored borders, joined by CSS rails: the
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
    // for this package and disposes it on unload. Guarded because the unit
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
    function depthLabel(t, maxDepth) {
      return maxDepth === 0 ? t('depthUnlimited') : t('depthCapped', { depth: maxDepth })
    }

    /** Task status glyph for one node card, and the legend's words. */
    const STATUS_MARK = { completed: '✓', in_progress: '◐', pending: '○', deleted: '×' }
    /** Task status → its locale key; the legend draws the first three. */
    const STATUS_KEY = { completed: 'statusCompleted', in_progress: 'statusInProgress', pending: 'statusPending', deleted: 'statusDeleted' }
    const STATUS_LEGEND = ['completed', 'in_progress', 'pending']

    /** Member role and phase → their locale keys. */
    const ROLE_KEY = { lead: 'roleLead', teammate: 'roleTeammate' }
    const PHASE_KEY = { active: 'phaseActive', provisioning: 'phaseProvisioning', failed: 'phaseFailed' }

    /** A locale key's word, or the raw value when the harness adds one this table lacks. */
    const wordOf = (t, table, value) => (table[value] === undefined ? String(value) : t(table[value]))

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
     * live blocker is a root (a blocker that was deleted reads as unblocked,
     * not orphaned). Board rows that no root reaches are a malformed loop; they
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
     * @param t - translate bound to the plugin's locale namespace.
     * @returns the branch list item.
     */
    function renderNode(node, collapsed, onToggle, t) {
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
              'aria-label': t(closed ? 'expand' : 'collapse', { id: task.id }),
              onClick: () => onToggle(task.id),
            }, closed ? '▸' : '▾')
            : createElement('span', { className: 'lgv-leaf', 'aria-hidden': true }, '•'),
          createElement('span', { className: 'lgv-status', title: wordOf(t, STATUS_KEY, task.status) }, STATUS_MARK[task.status] ?? '•'),
          createElement('span', { className: 'lgv-node-main' },
            createElement('span', { className: 'lgv-subject' }, task.subject),
            createElement('span', { className: 'lgv-meta' },
              createElement('span', { className: 'lgv-id' }, task.id),
              node.depth > 0 ? createElement('span', { className: 'lgv-level' }, `L${node.depth}`) : null,
              task.ownerName === undefined ? null : chip(' lgv-chip-owner', `@${task.ownerName}`),
              task.status === 'pending' && task.ready === true ? chip(' lgv-chip-ready', t('chipReady')) : null,
              extraBlockers > 0 ? chip('', t('extraBlockers', { count: extraBlockers }), blockers.join(', ')) : null,
              overlaps > 0
                ? chip(' lgv-chip-warn', t('overlaps', { count: overlaps }), task.writeScopeWarnings.join('; '))
                : null,
              node.cycle ? chip(' lgv-chip-warn', t('cycle'), t('cycleHint')) : null,
            ),
          ),
        ),
        hasChildren && !closed
          ? createElement('ul', { className: 'lgv-children' },
            node.children.map((child) => renderNode(child, collapsed, onToggle, t)))
          : null,
        closed
          ? createElement('div', { className: 'lgv-hidden' }, t('hidden', { count: countDescendants(node) }))
          : null,
      )
    }

    /**
     * The Legion decomposition view beside Chat and Trajectory: the run's task
     * board folded into the parent/child tree the protocol builds from
     * `blocked_by` edges. The lead session's `agentTeam` projection carries the
     * values, so the tree tracks the run live with no polling, no RPC, and no
     * work on turns where the tab is not selected.
     * @param t - translate bound to the plugin's locale namespace.
     * @returns the component the slot renders.
     */
    function createView(t) {
      return function LegionView({ useProjection }) {
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
          return createElement('div', { className: 'lgv-empty' }, t('noTeams'))
        }
        if (tasks.length === 0) {
          return createElement('div', { className: 'lgv-empty' }, t('noRun'))
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
              t('viewTitle', { tasks: tasks.length, levels: treeDepth(tree) })),
            createElement('span', { className: 'lgv-summary' },
              t('viewSummary', { completed: settled, running, blocked, members: members.length })),
          ),
          createElement('div', { className: 'lgv-legend' },
            STATUS_LEGEND.map((status) => createElement('span', { key: status },
              createElement('i', { className: `lgv-l-${status}` }), t(STATUS_KEY[status])))),
          members.length === 0 ? null : createElement('div', { className: 'lgv-members' },
            members.map((member) => createElement('span', {
              key: member.id ?? member.name,
              className: `lgv-member${member.role === 'lead' ? ' lgv-member-lead' : ''}`
                + `${member.phase === 'failed' ? ' lgv-member-failed' : ''}`,
              title: member.error ?? wordOf(t, PHASE_KEY, member.phase),
            }, member.phase === 'active'
              ? t('member', { name: member.name, role: wordOf(t, ROLE_KEY, member.role) })
              : t('memberPhase', { name: member.name, role: wordOf(t, ROLE_KEY, member.role), phase: wordOf(t, PHASE_KEY, member.phase) })))),
          team.failure === undefined
            ? null
            : createElement('div', { className: 'lgv-error' }, t('projectionFailure', { failure: team.failure })),
          createElement('ul', { className: 'lgv-list' }, tree.map((node) => renderNode(node, collapsed, toggle, t))),
        )
      }
    }

    /**
     * Build the card component over one bound settings scope.
     * @param scope - the scope bound to the legion namespace.
     * @param t - translate bound to the card's locale namespace.
     * @returns the component the slot renders.
     */
    function createCard(scope, t) {
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
            overridden ? createElement('span', { className: 'lg-dot', title: t('overridden') }) : null,
            t(`${field.key}Label`),
          ),
          createElement('input', {
            className: `lg-input${invalid ? ' lg-input-invalid' : ''}`,
            type: 'text',
            inputMode: 'numeric',
            value: draft,
            disabled,
            'aria-label': t('fieldRange', { label: t(`${field.key}Label`), min: field.min, max: field.max }),
            onChange: (e) => setDraft(e.target.value),
            onBlur: commit,
            onKeyDown: (e) => { if (e.key === 'Enter') commit() },
          }),
          createElement('span', { className: 'lg-hint' }, invalid
            ? t('invalid', { min: field.min, max: field.max })
            : t(`${field.key}Hint`)),
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
        // `set`, `unset`, and `mutate` resolve `false` when the host refuses the
        // write (an overlay row, a revision conflict), so a refusal is reported
        // here, not thrown. A reset is one atomic mutation.
        const write = (run) => {
          setError(null)
          Promise.resolve(run()).then((accepted) => {
            if (accepted === false) setError(t('refused'))
          }).catch(report)
        }
        // Keep the stored range consistent with clampSettings, which raises
        // an inverted maximum to the minimum when a run starts.
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
        const resetAll = () => write(() => scope.mutate(
          Object.keys(user).map((key) => ({ op: 'unset', path: [key] })),
        ))

        const strategy = STRATEGIES.includes(section.mergeStrategy) ? section.mergeStrategy : STRATEGIES[0]
        const approval = section.requireHumanApproval === true
        if (props != null && props.view === 'summary') {
          return t('summary', { min: section.minSubtasks, max: section.maxSubtasks, depth: depthLabel(t, section.maxDepth) })
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
                createElement('span', { className: 'lg-group-label' }, t('groupDecomposition')),
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
                createElement('span', { className: 'lg-group-label' }, t('groupExecution')),
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
                createElement('span', { className: 'lg-group-label' }, t('groupStrategy')),
                createElement(
                  'div',
                  { className: 'lg-row', role: 'radiogroup', 'aria-label': t('groupStrategy') },
                  STRATEGIES.map((value) => createElement('button', {
                    key: value,
                    type: 'button',
                    role: 'radio',
                    'aria-checked': section.mergeStrategy === value,
                    disabled,
                    className: `lg-pill${section.mergeStrategy === value ? ' lg-pill-selected' : ''}`,
                    title: t(`${value}Hint`),
                    onClick: () => pickStrategy(value),
                  }, t(`${value}Label`))),
                ),
                createElement('span', { className: 'lg-hint' }, t(`${strategy}Hint`)),
              ),
              createElement(
                'div',
                { className: 'lg-group' },
                createElement('span', { className: 'lg-group-label' }, t('groupApproval')),
                createElement(
                  'div',
                  { className: 'lg-row', role: 'radiogroup', 'aria-label': t('groupApproval') },
                  [['required', true], ['off', false]].map(([label, value]) => createElement('button', {
                    key: label,
                    type: 'button',
                    role: 'radio',
                    'aria-checked': approval === value,
                    disabled,
                    className: `lg-pill${approval === value ? ' lg-pill-selected' : ''}`,
                    onClick: () => setField('requireHumanApproval', value),
                  }, t(label === 'required' ? 'approvalRequired' : 'approvalOff'))),
                ),
                createElement('span', { className: 'lg-hint' },
                  approval
                    ? t('approvalRequiredHint')
                    : t('approvalOffHint')),
              ),
              createElement(
                'div',
                { className: 'lg-status' },
                snapshot.writable
                  ? t('persists')
                  : t('readOnly'),
                overriddenCount > 0
                  ? createElement('button', {
                    type: 'button',
                    className: 'lg-reset',
                    disabled,
                    onClick: resetAll,
                  }, t('reset', { count: overriddenCount }))
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
      const t = ctx.locale.bind(LOCALE_NS)
      ctx.effect(() => ctx.locale.register(LOCALE_NS, { en, zh }), 'dsh-legion: locale dictionaries')
      const scope = ctx.configForms.get(NAMESPACE)
      const Card = createCard(scope, t)

      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config',
        key: 'dsh-legion#legion',
        locale: LOCALE_NS,
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
      }, createView(t)))
    }

    exports.apply = apply
    exports.inject = ['slots', 'configForms', 'locale']
    // Exported for the unit tests: the tree fold is the view's only logic.
    exports.buildTaskTree = buildTaskTree
    return module.exports
  },
})
