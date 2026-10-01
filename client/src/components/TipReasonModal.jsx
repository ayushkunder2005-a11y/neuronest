const REASON_COPY = {
  focus_drop_detected: "Focus has dipped, so a quick reset helps regain clarity.",
  memory_strengthen: "Short recall bursts improve memory strength without fatigue.",
  study_structure: "Structured summaries improve retention with less effort.",
  work_flow_control: "Capturing next actions reduces context switching.",
  energy_alignment: "Matching task size to energy keeps productivity steady.",
  break_mode_active: "Light recovery resets attention before the next task.",
  kid_focus_support: "Simple visual cues keep focus on the right task.",
  study_retention: "Brief recaps lock in learning while it is fresh.",
  work_clarity: "Clear next actions reduce task friction.",
  focus_mode_boost: "Short sprints sustain focus without draining energy.",
  break_hydration: "Hydration and breathing bring the nervous system down quickly.",
  morning_intent_setup: "Setting outcomes early reduces decision fatigue.",
  long_focus_run: "Long focus runs benefit from a brief reset.",
  interruptions_high: "Reducing notifications protects deep work quality.",
  extended_focus_blocks: "Cooldowns protect performance across focus blocks.",
  recovery_needed: "Recovery supports sustained performance.",
};

export default function TipReasonModal({ tip, isOpen, onClose }) {
  if (!isOpen) {
    return null;
  }
  const reasonText = REASON_COPY[tip.reason] || "This tip matches your current focus context.";
  return (
    <div className="tips-card">
      <h4>Why this tip</h4>
      <p>{reasonText}</p>
      <div className="tips-actions">
        <button type="button" className="btn-glass" onClick={onClose}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
