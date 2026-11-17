interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  hint?: string;
  disabled?: boolean;
}

export function Switch({ checked, onChange, title, hint, disabled = false }: SwitchProps) {
  return (
    <label className="switch">
      <span className="switch__text">
        <span className="switch__title">{title}</span>
        {hint ? <span className="switch__hint">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch__control" aria-hidden="true" />
    </label>
  );
}
