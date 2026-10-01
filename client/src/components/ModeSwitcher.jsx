const MODES = ["study", "work", "focus", "break"];

export default function ModeSwitcher({ currentMode, onChange }) {
  return (
    <div className="coaching-toggle" role="group" aria-label="Tip mode switcher">
      {MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          className={currentMode === mode ? "active" : ""}
          onClick={() => onChange(mode)}
        >
          {mode}
        </button>
      ))}
    </div>
  );
}
