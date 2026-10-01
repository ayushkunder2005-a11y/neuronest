const STATUS_MAP = {
  sharp: { label: "sharp", className: "status-pill live", note: "High clarity" },
  steady: { label: "steady", className: "status-pill", note: "Stable focus" },
  recharge: { label: "recharge", className: "status-pill", note: "Time to reset" },
};

export default function BrainStatusBadge({ status }) {
  const data = STATUS_MAP[status] ?? STATUS_MAP.steady;
  return (
    <div>
      <span className={data.className}>{data.label}</span>
      <p className="mood-note">{data.note}</p>
    </div>
  );
}
