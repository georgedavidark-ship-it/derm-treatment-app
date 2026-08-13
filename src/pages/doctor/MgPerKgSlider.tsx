interface Props {
  id: string
  min: number
  max: number
  value: number
  onChange: (value: number) => void
}

export default function MgPerKgSlider({ id, min, max, value, onChange }: Props) {
  function clamp(v: number) {
    return Math.min(max, Math.max(min, v))
  }

  return (
    <div className="field" style={{ minWidth: 260 }}>
      <label htmlFor={id}>
        Суточная доза, мг/кг ({min}–{max})
      </label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={0.01}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          style={{ flex: 1 }}
        />
        <input
          type="number"
          min={min}
          max={max}
          step={0.01}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value)
            if (!Number.isNaN(v)) onChange(clamp(v))
          }}
          style={{ width: 90, padding: '6px 8px', border: '1px solid var(--color-border)', borderRadius: 6 }}
        />
      </div>
    </div>
  )
}
