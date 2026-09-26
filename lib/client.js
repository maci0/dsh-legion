/**
 * dsh-legion — browser half.
 *
 * The Legion card in Settings → Plugins → Plugin configuration, keyed on the
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

    /** Plugin version, shown in the card header. Bump with package.json. */
    const VERSION = '0.2.0'

    /** Numeric fields: bounds mirror the host schema and lib/logic.js LIMITS. */
    const NUMBERS = [
      { key: 'minSubtasks', label: 'Min subtasks', min: 1, max: 20, hint: 'Fewer proposals than this means the task is a leaf.' },
      { key: 'maxSubtasks', label: 'Max subtasks', min: 1, max: 20, hint: 'Extra proposals are truncated to this.' },
      { key: 'maxDepth', label: 'Max depth', min: 1, max: 20, hint: 'Hard cap on decomposition levels.' },
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
      '.lg-card{list-style:none;border:0.5px solid var(--dsw-alias-border-l4);border-radius:16px;background:var(--dsw-alias-bg-layer-3);transition:border-color .16s,background .16s}',
      '.lg-card-open{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-label-dimmed)}',
      '.lg-header{width:100%;appearance:none;border:0;background:none;font:inherit;color:inherit;text-align:left;cursor:pointer;display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:12px}',
      '.lg-head{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}',
      '.lg-name{font-size:15px;font-weight:600;line-height:1.4;color:var(--dsw-alias-label-primary)}',
      '.lg-desc{font-size:13px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}',
      '.lg-chevron{flex:none;width:7px;height:7px;margin-top:-3px;border-right:1.5px solid var(--dsw-alias-label-tertiary);border-bottom:1.5px solid var(--dsw-alias-label-tertiary);transition:transform .16s;transform:rotate(45deg)}',
      '.lg-chevron-open{transform:rotate(225deg);margin-top:3px}',
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
          return `Split into ${section.minSubtasks}-${section.maxSubtasks} subtasks, depth ≤ ${section.maxDepth}.`
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
     * Mount the Plugins card.
     * @param ctx - the client root context.
     */
    function apply(ctx) {
      const scope = ctx.configForms.get(NAMESPACE)
      const Card = createCard(scope)

      ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
        name: 'plugins.row.config',
        key: 'dsh-legion#legion',
      }, Card))
    }

    exports.apply = apply
    exports.inject = ['slots', 'configForms']
    return module.exports
  },
})
