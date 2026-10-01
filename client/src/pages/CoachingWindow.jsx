import "../styles/tips.css";
import CoachingPanel from "../components/CoachingPanel.jsx";

export default function CoachingWindow() {
  return (
    <div className="tips-shell coaching-window">
      <header className="tips-hero">
        <div>
          <p className="eyebrow">Dedicated Coaching Console</p>
          <h1>Stay focused with a distraction-free coaching workspace</h1>
          <p>
            This window keeps AI coaching, payment steps, and premium tutor controls separate so you can keep the
            main dashboard visible. Close the tab anytime to end the session.
          </p>
        </div>
      </header>
      <CoachingPanel />
    </div>
  );
}
