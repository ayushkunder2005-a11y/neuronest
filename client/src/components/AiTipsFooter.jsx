export default function AiTipsFooter({ lastUpdatedLabel, completedCount, totalCount }) {
  return (
    <section className="tips-bottom-grid">
      <article className="tips-card">
        <h3>Daily clarity</h3>
        <ul>
          <li>Completed tips: {completedCount} / {totalCount}</li>
          <li>Next refresh: {lastUpdatedLabel}</li>
          <li>Tips are generated locally for privacy.</li>
        </ul>
      </article>
      <article className="tips-card">
        <h3>Brain-friendly checklist</h3>
        <ul>
          <li>Keep one active task visible.</li>
          <li>Use short recovery blocks between deep sessions.</li>
          <li>Close loops with a quick recap.</li>
        </ul>
      </article>
    </section>
  );
}
