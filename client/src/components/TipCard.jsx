import { useState } from "react";
import TipActionButton from "./TipActionButton";
import TipFeedback from "./TipFeedback";
import TipReasonModal from "./TipReasonModal";

const ICON_LABELS = {
  focus: "🎯 FOCUS",
  memory: "🧠 MEMORY",
  productivity: "⚡ PRODUCT",
  recovery: "🧘 RECOVER",
};

const TYPE_CLASSES = {
  focus: "focus",
  memory: "challenge",
  productivity: "warning",
  recovery: "focus",
};

export default function TipCard({ tip, onDone, isFavorite, onToggleFavorite }) {
  const [isReasonOpen, setIsReasonOpen] = useState(false);
  const iconLabel = ICON_LABELS[tip.type] ?? "💡 TIP";
  const cardClass = TYPE_CLASSES[tip.type] ?? "";

  return (
    <div className={`tip ${cardClass}`}>
      <div className="tip-header">
        <strong>{iconLabel}</strong>
        {onToggleFavorite && (
          <button
            className={`tip-favorite-btn ${isFavorite ? "active" : ""}`}
            onClick={() => onToggleFavorite(tip.id)}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? "❤️" : "🤍"}
          </button>
        )}
      </div>
      <h4>{tip.title}</h4>
      <p>{tip.description}</p>
      <p className="mood-note">⏱️ Action time: {tip.duration}</p>
      <div className="tips-actions">
        <TipActionButton label="✓ Done" variant="primary" onClick={() => onDone(tip.id)} />
        <TipActionButton label="Why this tip?" onClick={() => setIsReasonOpen(true)} />
      </div>
      <TipReasonModal tip={tip} isOpen={isReasonOpen} onClose={() => setIsReasonOpen(false)} />
      <TipFeedback tipId={tip.id} />
    </div>
  );
}
