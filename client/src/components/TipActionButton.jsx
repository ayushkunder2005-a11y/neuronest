export default function TipActionButton({ label, onClick, variant = "glass", disabled }) {
  const className = variant === "primary" ? "btn-primary" : "btn-glass";
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}
