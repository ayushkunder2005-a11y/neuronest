import TipActionButton from "./TipActionButton";

const FILTERS = ["all", "study", "focus", "memory", "productivity"];

export default function TipFilters({ activeFilter, onChange }) {
  return (
    <div className="tips-actions" role="group" aria-label="Tip filters">
      {FILTERS.map((filter) => (
        <TipActionButton
          key={filter}
          label={filter}
          variant={activeFilter === filter ? "primary" : "glass"}
          onClick={() => onChange(filter)}
        />
      ))}
    </div>
  );
}
