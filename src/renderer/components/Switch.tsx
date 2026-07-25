// iOS-style sliding pill toggle.
export function Switch({
  checked,
  onChange,
  disabled = false
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`switch${checked ? ' switch--on' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
    >
      <span className="switch__knob" />
    </button>
  )
}
