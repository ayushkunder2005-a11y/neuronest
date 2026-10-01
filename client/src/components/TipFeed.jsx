import TipCard from "./TipCard";

export default function TipFeed({ tips, onDone, emptyMessage, favorites = [], onToggleFavorite }) {
  const sortedTips = [...tips].sort((a, b) => a.priority - b.priority);

  return (
    <article className="tips-card">
      <h3>Tip Feed</h3>
      {sortedTips.length === 0 ? (
        <p className="mood-note">{emptyMessage}</p>
      ) : (
        <div className="tip-list" style={{ maxHeight: "400px", overflowY: "auto" }}>
          {sortedTips.map((tip) => (
            <TipCard
              key={tip.id}
              tip={tip}
              onDone={onDone}
              isFavorite={favorites.includes(tip.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}
    </article>
  );
}
