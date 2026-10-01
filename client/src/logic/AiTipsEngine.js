const TIME_SEGMENTS = [
  { id: "morning", start: 5, end: 11 },
  { id: "afternoon", start: 12, end: 16 },
  { id: "evening", start: 17, end: 21 },
];

const BASE_TIPS = [
  {
    id: "plan-top-two",
    type: "productivity",
    category: "productivity",
    title: "Plan the top two outcomes",
    description: "Write two must-finish outcomes before opening new tabs.",
    duration: "2m",
    reason: "morning_intent_setup",
    priority: 2,
    modes: ["study", "work", "focus"],
    userTypes: ["kid", "student", "professional"],
    time: ["morning"],
  },
  {
    id: "focus-reset",
    type: "focus",
    category: "focus",
    title: "2-minute eye reset",
    description: "Close eyes, relax brow, and breathe slowly for 6 cycles.",
    duration: "2m",
    reason: "focus_drop_detected",
    priority: 1,
    modes: ["study", "work", "focus"],
    userTypes: ["kid", "student", "professional"],
    time: ["afternoon", "evening"],
  },
  {
    id: "recall-sprint",
    type: "memory",
    category: "memory",
    title: "Quick recall sprint",
    description: "List what you remember before checking notes.",
    duration: "30s",
    reason: "memory_strengthen",
    priority: 2,
    modes: ["study", "focus"],
    userTypes: ["student", "professional"],
    time: ["morning", "afternoon", "evening"],
  },
  {
    id: "single-tab-focus",
    type: "focus",
    category: "focus",
    title: "Single-tab focus",
    description: "Close extra tabs and keep only the active task visible.",
    duration: "30s",
    reason: "distraction_prune",
    priority: 3,
    modes: ["study", "work", "focus"],
    userTypes: ["kid", "student", "professional"],
    time: ["morning", "afternoon", "evening"],
  },
  {
    id: "micro-break-walk",
    type: "recovery",
    category: "productivity",
    title: "Short recovery walk",
    description: "Stand and move for one minute to reset attention.",
    duration: "2m",
    reason: "recovery_needed",
    priority: 1,
    modes: ["break"],
    userTypes: ["kid", "student", "professional"],
    time: ["morning", "afternoon", "evening"],
  },
  {
    id: "meeting-buffer",
    type: "productivity",
    category: "productivity",
    title: "Meeting buffer",
    description: "Reserve 5 minutes to capture outcomes and next actions.",
    duration: "5m",
    reason: "work_flow_control",
    priority: 3,
    modes: ["work"],
    userTypes: ["professional"],
    time: ["morning", "afternoon", "evening"],
  },
  {
    id: "study-outline",
    type: "memory",
    category: "study",
    title: "One-page outline",
    description: "Summarize the topic into five bullet points.",
    duration: "5m",
    reason: "study_structure",
    priority: 2,
    modes: ["study"],
    userTypes: ["student"],
    time: ["morning", "afternoon", "evening"],
  },
  {
    id: "kid-focus-cards",
    type: "focus",
    category: "study",
    title: "Color focus cards",
    description: "Use a green card for the task and red for distractions.",
    duration: "2m",
    reason: "kid_focus_support",
    priority: 2,
    modes: ["study", "focus"],
    userTypes: ["kid"],
    time: ["morning", "afternoon"],
  },
  {
    id: "energy-check",
    type: "productivity",
    category: "productivity",
    title: "Energy check-in",
    description: "Rate energy 1-5 and pick a matching task size.",
    duration: "30s",
    reason: "energy_alignment",
    priority: 2,
    modes: ["work", "study", "focus"],
    userTypes: ["kid", "student", "professional"],
    time: ["afternoon", "evening"],
  },
  {
    id: "break-breathe",
    type: "recovery",
    category: "productivity",
    title: "Box breathing",
    description: "Inhale 4, hold 4, exhale 4, hold 4.",
    duration: "2m",
    reason: "break_mode_active",
    priority: 2,
    modes: ["break"],
    userTypes: ["kid", "student", "professional"],
    time: ["morning", "afternoon", "evening"],
  },
];

const MODE_TIPS = {
  study: [
    {
      id: "study-recap",
      type: "memory",
      category: "study",
      title: "Mini recap note",
      description: "Write a 2-sentence recap after each section.",
      duration: "2m",
      reason: "study_retention",
      priority: 3,
    },
  ],
  work: [
    {
      id: "work-priority",
      type: "productivity",
      category: "productivity",
      title: "Define the next action",
      description: "Convert the largest task into one concrete action.",
      duration: "2m",
      reason: "work_clarity",
      priority: 2,
    },
  ],
  focus: [
    {
      id: "focus-sprint",
      type: "focus",
      category: "focus",
      title: "15-minute focus sprint",
      description: "Set a timer and work until it ends.",
      duration: "2m",
      reason: "focus_mode_boost",
      priority: 2,
    },
  ],
  break: [
    {
      id: "break-hydrate",
      type: "recovery",
      category: "productivity",
      title: "Hydration reset",
      description: "Drink water and roll shoulders twice.",
      duration: "30s",
      reason: "break_hydration",
      priority: 2,
    },
  ],
};

const getTimeSegment = (hour) => {
  const segment = TIME_SEGMENTS.find((item) => hour >= item.start && hour <= item.end);
  return segment ? segment.id : "evening";
};

const matchesTag = (value, allowed) => !allowed || allowed.includes(value);

const uniqueTips = (tips) => {
  const map = new Map();
  tips.forEach((tip) => {
    if (!map.has(tip.id)) {
      map.set(tip.id, tip);
    }
  });
  return Array.from(map.values());
};

const boostByPatterns = (tips, patterns, mode) => {
  const output = [...tips];
  if (patterns.lastBreakMinutes > 60 && mode !== "break") {
    output.push({
      id: "break-reset",
      type: "recovery",
      category: "productivity",
      title: "60-minute reset",
      description: "Take a short walk before the next deep block.",
      duration: "2m",
      reason: "long_focus_run",
      priority: 1,
    });
  }
  if (patterns.interruptions >= 3) {
    output.push({
      id: "interrupt-shield",
      type: "focus",
      category: "focus",
      title: "Interrupt shield",
      description: "Silence notifications for the next task.",
      duration: "30s",
      reason: "interruptions_high",
      priority: 1,
    });
  }
  if (patterns.focusBlocks >= 4) {
    output.push({
      id: "focus-cooldown",
      type: "recovery",
      category: "productivity",
      title: "Focus cooldown",
      description: "Stretch wrists and neck before the next block.",
      duration: "2m",
      reason: "extended_focus_blocks",
      priority: 2,
    });
  }
  return output;
};

export const getAiTips = ({ mode, userType, patterns, now = new Date() }) => {
  const safePatterns = patterns || { focusBlocks: 0, lastBreakMinutes: 0, interruptions: 0 };
  const timeSegment = getTimeSegment(now.getHours());
  const modeTips = MODE_TIPS[mode] ?? [];
  const seedTips = BASE_TIPS.filter(
    (tip) =>
      matchesTag(mode, tip.modes) &&
      matchesTag(userType, tip.userTypes) &&
      matchesTag(timeSegment, tip.time)
  );
  const blended = boostByPatterns(seedTips.concat(modeTips), safePatterns, mode);
  return uniqueTips(blended)
    .map((tip, index) => ({
      ...tip,
      priority: tip.priority ?? index + 1,
    }))
    .sort((a, b) => a.priority - b.priority);
};
