import { useEffect, useState } from "react";

const STORAGE_KEY = "aiTipsFeedback";

const loadFeedback = () => {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
};

const saveFeedback = (data) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export default function TipFeedback({ tipId }) {
  const [selection, setSelection] = useState(() => loadFeedback()[tipId] || "");

  useEffect(() => {
    const data = loadFeedback();
    setSelection(data[tipId] || "");
  }, [tipId]);

  const handleSelect = (value) => {
    const data = loadFeedback();
    const next = value === selection ? "" : value;
    const updated = { ...data, [tipId]: next };
    saveFeedback(updated);
    setSelection(next);
  };

  return (
    <div className="tips-actions">
      <button
        type="button"
        className={`btn-glass${selection === "helpful" ? " active" : ""}`}
        onClick={() => handleSelect("helpful")}
      >
        Helpful
      </button>
      <button
        type="button"
        className={`btn-glass${selection === "not-useful" ? " active" : ""}`}
        onClick={() => handleSelect("not-useful")}
      >
        Not Useful
      </button>
    </div>
  );
}
