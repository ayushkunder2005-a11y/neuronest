import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/analytics.css";
import {
  generateDynamicReport,
  getCognitiveAxes,
  getDynamicInsights,
  getGamificationStats,
  getMilestones,
  getTaskCategoryBreakdown,
  getTaskStats,
  getTrendSplit,
  getWeeklyProgress
} from "../utils/gamification";
import { loadExerciseStats } from "../utils/exerciseStats";

const getUserId = () => {
  try {
    const raw = window.localStorage.getItem("user") || window.sessionStorage.getItem("user");
    const user = raw ? JSON.parse(raw) : null;
    return user?.uid || user?.firebaseUid || user?._id || user?.id || "default";
  } catch {
    return "default";
  }
};

// Training modules data for feature progress display
const TRAINING_MODULES = [
  {
    id: "focus",
    title: "Focus Training",
    icon: "🎯",
    description: "Improve concentration and attention span",
    exercises: 4,
    totalXP: 345,
  },
  {
    id: "memory",
    title: "Memory Training",
    icon: "🧠",
    description: "Enhance short and long-term memory",
    exercises: 4,
    totalXP: 390,
  },
  {
    id: "logic",
    title: "Logic & Reasoning",
    icon: "🧩",
    description: "Strengthen problem-solving skills",
    exercises: 4,
    totalXP: 345,
  },
  {
    id: "relaxation",
    title: "Mental Recovery",
    icon: "🧘",
    description: "Reduce stress and restore clarity",
    exercises: 4,
    totalXP: 155,
  },
];

// Task categories for feature display
const TASK_CATEGORIES = [
  { id: "deep", label: "Deep Work", icon: "🧠", load: "high" },
  { id: "focus", label: "Focus Tasks", icon: "🎯", load: "medium" },
  { id: "repetition", label: "Repetition", icon: "🔁", load: "medium" },
  { id: "light", label: "Light Tasks", icon: "☀️", load: "low" },
];

// Avatar stages for rewards progress
const AVATAR_STAGES = [
  { id: "novice", emoji: "🌱", name: "Novice", xpRequired: 0 },
  { id: "explorer", emoji: "🔍", name: "Explorer", xpRequired: 100 },
  { id: "scholar", emoji: "📚", name: "Scholar", xpRequired: 300 },
  { id: "master", emoji: "🎓", name: "Master", xpRequired: 600 },
  { id: "sage", emoji: "🧙", name: "Sage", xpRequired: 1000 },
];





const TREND_SPLIT = [
  { label: "Deep work", share: 35, color: "#8b5cf6" },
  { label: "Light tasks", share: 20, color: "#38bdf8" },
  { label: "Repetition", share: 25, color: "#34d399" },
  { label: "Focus tasks", share: 20, color: "#f97316" },
];

const INSIGHT_ITEMS = [
  "Peak focus window holds between 9:00 AM and 11:30 AM.",
  "Task quality improves after a 10-minute recovery block.",
  "Skipping high-load tasks increases fatigue score by 15 points.",
  "Short repetition loops stabilize recall ratings.",
];

const MILESTONES = [
  "7-day streak of consistent focus planning",
  "IQ_Score trend holds above 115 for 3 sessions",
  "Productivity_Score average stays above 80",
];



const TASK_CATEGORY_TRENDS = [
  {
    label: "Deep thinking",
    stats: ["8 blocks", "Avg quality 82", "Recovery needed"],
  },
  {
    label: "Light tasks",
    stats: ["4 blocks", "Avg quality 76", "Stable load"],
  },
  {
    label: "Repetition",
    stats: ["3 loops", "Avg quality 71", "Recall boost"],
  },
  {
    label: "Focus tasks",
    stats: ["3 blocks", "Avg quality 79", "Short bursts"],
  },
];

const RADAR_SIZE = 220;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 80;

const buildRadarPoints = (axes) =>
  axes
    .map((axis, index) => {
      const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2;
      const radius = (axis.value / 100) * RADAR_RADIUS;
      const x = RADAR_CENTER + Math.cos(angle) * radius;
      const y = RADAR_CENTER + Math.sin(angle) * radius;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

const COGNITIVE_AXES = [
  { label: "Memory", value: 78 },
  { label: "Focus", value: 72 },
  { label: "Speed", value: 75 },
  { label: "Planning", value: 68 },
  { label: "Resilience", value: 70 },
];

const RADAR_POINTS = buildRadarPoints(COGNITIVE_AXES);

// Phone number validation
const validatePhoneNumber = (phone) => {
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
};

// Format phone number for WhatsApp (remove + and spaces)
const formatPhoneForWhatsApp = (phone) => {
  return phone.replace(/\D/g, "");
};

export default function Analytics() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("reports");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPdfBlob, setGeneratedPdfBlob] = useState(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [gamificationStats, setGamificationStats] = useState(null);
  const [dynamicReport, setDynamicReport] = useState(null);
  const [weeklyTrends, setWeeklyTrends] = useState([]);
  const [taskOutcomes, setTaskOutcomes] = useState({ total: 0, completed: 0, pending: 0 });
  const [exerciseStats, setExerciseStats] = useState(null);

  // Arena profile from localStorage
  const [arenaProfile, setArenaProfile] = useState(() => {
    try {
      const saved = localStorage.getItem(`arena_profile_${getUserId()}`);
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  // Dynamic analytics data - initialize with defaults to prevent blank render
  const [trendSplit, setTrendSplit] = useState([
    { label: "Deep work", share: 25, color: "#8b5cf6" },
    { label: "Light tasks", share: 25, color: "#38bdf8" },
    { label: "Repetition", share: 25, color: "#34d399" },
    { label: "Focus tasks", share: 25, color: "#f97316" },
  ]);
  const [insights, setInsights] = useState([
    "Start training to generate personalized insights.",
    "Regular exercise improves cognitive performance.",
    "Consistency is key to building strong habits.",
  ]);
  const [cognitiveAxes, setCognitiveAxes] = useState([
    { label: "Memory", value: 50 },
    { label: "Focus", value: 50 },
    { label: "Speed", value: 50 },
    { label: "Planning", value: 50 },
    { label: "Resilience", value: 50 },
  ]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([
    { label: "Deep thinking", stats: ["0 tasks", "0% done", "No data"] },
    { label: "Light tasks", stats: ["0 tasks", "0% done", "No data"] },
    { label: "Repetition", stats: ["0 tasks", "0% done", "No data"] },
    { label: "Focus tasks", stats: ["0 tasks", "0% done", "No data"] },
  ]);
  const [milestones, setMilestones] = useState([
    "⏳ 7-day streak: 0/7 days",
    "⏳ 500 XP milestone: 0/500 XP",
    "⏳ 80% completion rate: 0%/80%",
  ]);

  // Load gamification stats and dynamic report
  useEffect(() => {
    const loadAllData = () => {
      setGamificationStats(getGamificationStats());
      setDynamicReport(generateDynamicReport());
      setWeeklyTrends(getWeeklyProgress());
      setTaskOutcomes(getTaskStats());
      setTrendSplit(getTrendSplit());
      setInsights(getDynamicInsights());
      setCognitiveAxes(getCognitiveAxes());
      setCategoryBreakdown(getTaskCategoryBreakdown());
      setMilestones(getMilestones());
      setExerciseStats(loadExerciseStats());
    };

    loadAllData();

    // Listen for gamification updates
    const handleUpdate = () => {
      loadAllData();
    };

    const handleStorage = (e) => {
      if (e.key === `neuronest_gamification_${getUserId()}` || e.key === `NeuroNest-exerciseStats_${getUserId()}`) {
        loadAllData();
      }
    };

    window.addEventListener("gamification-update", handleUpdate);
    window.addEventListener("storage", handleStorage);

    // Refresh arena profile on storage changes
    const handleArenaStorage = (e) => {
      if (e.key === `arena_profile_${getUserId()}`) {
        try { setArenaProfile(JSON.parse(e.newValue)); } catch { }
      }
    };
    window.addEventListener("storage", handleArenaStorage);

    return () => {
      window.removeEventListener("gamification-update", handleUpdate);
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("storage", handleArenaStorage);
    };
  }, []);

  // Calculate avatar stage from XP
  const getAvatarStage = (xp) => {
    for (let i = AVATAR_STAGES.length - 1; i >= 0; i--) {
      if (xp >= AVATAR_STAGES[i].xpRequired) {
        return AVATAR_STAGES[i];
      }
    }
    return AVATAR_STAGES[0];
  };

  // Use dynamic report data with fallbacks
  const latestReport = dynamicReport || {
    reportId: "RPT-000",
    userId: "U-001",
    date: new Date().toISOString().split("T")[0],
    cognitiveSummary: "Start training to generate your personalized cognitive report.",
    iqScore: 100,
    productivityScore: 0,
    recommendations: ["Complete your first training exercise to get started."],
    level: 1,
    totalXP: 0,
    streak: 0,
    exercisesCompleted: 0,
    tasksCompleted: 0,
    tasksPending: 0,
  };

  const avgProductivity = weeklyTrends.length > 0
    ? Math.round(weeklyTrends.reduce((sum, day) => sum + day.productivity, 0) / weeklyTrends.length)
    : 0;
  const avgFocus = weeklyTrends.length > 0
    ? Math.round(weeklyTrends.reduce((sum, day) => sum + day.focus, 0) / weeklyTrends.length)
    : 0;

  // Generate PDF report with real data
  const generatePDF = async () => {
    setIsGenerating(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // Header
      doc.setFillColor(25, 10, 58);
      doc.rect(0, 0, pageWidth, 40, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont("helvetica", "bold");
      doc.text("NeuroNest Analytics Report", 15, yPos);

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      yPos += 10;
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 15, yPos);

      yPos = 50;
      doc.setTextColor(0, 0, 0);

      // Report Info Section with real data
      doc.setFillColor(240, 240, 255);
      doc.roundedRect(10, yPos - 5, pageWidth - 20, 45, 3, 3, "F");

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Your Progress Summary", 15, yPos + 5);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      yPos += 15;
      doc.text(`Report ID: ${latestReport.reportId}`, 15, yPos);
      doc.text(`Date: ${latestReport.date}`, 100, yPos);
      yPos += 8;
      doc.text(`Level: ${latestReport.level || 1}`, 15, yPos);
      doc.text(`Streak: ${latestReport.streak || 0} days`, 60, yPos);
      doc.text(`Total XP: ${latestReport.totalXP || 0}`, 120, yPos);

      yPos += 25;

      // Scores Section - Real XP and Productivity
      doc.setFillColor(230, 255, 230);
      doc.roundedRect(10, yPos - 5, 60, 40, 3, 3, "F");
      doc.setFillColor(255, 240, 230);
      doc.roundedRect(75, yPos - 5, 60, 40, 3, 3, "F");
      doc.setFillColor(230, 240, 255);
      doc.roundedRect(140, yPos - 5, 60, 40, 3, 3, "F");

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 100, 0);
      doc.text("Total XP", 25, yPos + 5);
      doc.setFontSize(22);
      doc.text(String(latestReport.totalXP || 0), 25, yPos + 22);

      doc.setFontSize(10);
      doc.setTextColor(200, 100, 0);
      doc.text("Exercises", 88, yPos + 5);
      doc.setFontSize(22);
      doc.text(String(latestReport.exercisesCompleted || 0), 95, yPos + 22);

      doc.setFontSize(10);
      doc.setTextColor(0, 50, 150);
      doc.text("Tasks Done", 150, yPos + 5);
      doc.setFontSize(22);
      doc.text(String(latestReport.tasksCompleted || 0), 160, yPos + 22);

      yPos += 50;
      doc.setTextColor(0, 0, 0);

      // Cognitive Summary
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Cognitive Summary", 15, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      const summaryLines = doc.splitTextToSize(latestReport.cognitiveSummary, pageWidth - 30);
      doc.text(summaryLines, 15, yPos);
      yPos += summaryLines.length * 6 + 10;

      // Recommendations
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Recommendations", 15, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      (latestReport.recommendations || []).forEach((rec, idx) => {
        const recLines = doc.splitTextToSize(`${idx + 1}. ${rec}`, pageWidth - 30);
        doc.text(recLines, 15, yPos);
        yPos += recLines.length * 6;
      });

      yPos += 10;

      // Weekly Trends with real data
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Weekly Activity", 15, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Day", 20, yPos);
      doc.text("Exercises", 50, yPos);
      doc.text("Tasks", 90, yPos);
      doc.text("Productivity", 125, yPos);
      doc.text("Focus", 170, yPos);

      doc.setFont("helvetica", "normal");
      weeklyTrends.forEach((day) => {
        yPos += 7;
        doc.text(day.label, 20, yPos);
        doc.text(String(day.exercises), 55, yPos);
        doc.text(String(day.tasks), 95, yPos);
        doc.text(String(day.productivity), 135, yPos);
        doc.text(String(day.focus), 175, yPos);
      });

      yPos += 15;
      doc.setFontSize(11);
      doc.text(`Weekly Averages: Productivity ${avgProductivity}%, Focus ${avgFocus}%`, 15, yPos);

      // Footer for page 1
      yPos = 280;
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text("Generated by NeuroNest Cognitive Training Platform", pageWidth / 2, yPos, { align: "center" });

      // --- PAGE 2: Detailed Analytics ---
      doc.addPage();
      yPos = 20;

      // Header Page 2
      doc.setFillColor(25, 10, 58);
      doc.rect(0, 0, pageWidth, 30, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("Detailed Progress & Insights", 15, yPos);
      
      yPos = 45;
      doc.setTextColor(0, 0, 0);

      let imgTrends = null, imgSplit = null, imgRadar = null, imgLive = null;
      try {
        const trendsEl = document.getElementById("pdf-chart-trends");
        const splitEl = document.getElementById("pdf-chart-split");
        const radarEl = document.getElementById("pdf-chart-radar");
        const liveEl = document.getElementById("pdf-chart-live");

        const opts = { 
          backgroundColor: '#1e0c3a', 
          scale: 2, 
          logging: false,
          useCORS: true,
          onclone: (clonedDoc) => {
            const clonedContainer = clonedDoc.getElementById("pdf-export-container");
            if (clonedContainer) {
              clonedContainer.style.position = "static";
              clonedContainer.style.left = "auto";
              clonedContainer.style.top = "auto";
              clonedContainer.style.zIndex = "100";
            }
          }
        };

        if (liveEl) try { imgLive = (await html2canvas(liveEl, opts)).toDataURL("image/png"); } catch(e) { console.error("Live chart error:", e); }
        if (trendsEl) try { imgTrends = (await html2canvas(trendsEl, opts)).toDataURL("image/png"); } catch(e) { console.error("Trends chart error:", e); }
        if (splitEl) try { imgSplit = (await html2canvas(splitEl, opts)).toDataURL("image/png"); } catch(e) { console.error("Split chart error:", e); }
        if (radarEl) try { imgRadar = (await html2canvas(radarEl, opts)).toDataURL("image/png"); } catch(e) { console.error("Radar chart error:", e); }
        
      } catch (err) {
        console.error("Graph capture setup error:", err);
      }

      // 1. Progress Intelligence (Live Report)
      if (imgLive) {
        doc.addImage(imgLive, "PNG", 15, yPos, 180, 50);
        yPos += 60;
      }

      // 2. Trend Split & Graph
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Trend Split", 15, yPos);
      yPos += 8;
      
      if (imgSplit) {
        doc.addImage(imgSplit, "PNG", 15, yPos, 140, 45);
        yPos += 50;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      trendSplit.forEach((item) => {
        doc.text(`• ${item.label}: ${item.share}%`, 15, yPos);
        yPos += 6;
      });
      yPos += 6;

      // 3. Weekly Activity Graph
      if (imgTrends) {
        if (yPos > 200) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Weekly Activity Chart", 15, yPos);
        yPos += 8;
        doc.addImage(imgTrends, "PNG", 15, yPos, 180, 60);
        yPos += 65;
      }

      // 4. Cognitive Radar Score & Chart
      if (yPos > 180) { doc.addPage(); yPos = 20; }
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Cognitive Axes Radar", 15, yPos);
      yPos += 8;
      
      if (imgRadar) {
        doc.addImage(imgRadar, "PNG", 15, yPos, 160, 80);
        yPos += 85;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      cognitiveAxes.forEach((axis) => {
        doc.text(`• ${axis.label}: ${axis.value}/100`, 15, yPos);
        yPos += 6;
      });
      yPos += 10;

      if (yPos > 220) { doc.addPage(); yPos = 20; }

      // 5. Task Outcomes & Categories
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Task Outcomes", 15, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Total: ${taskOutcomes.total} | Completed: ${taskOutcomes.completed} | Pending: ${taskOutcomes.pending}`, 15, yPos);
      yPos += 8;
      doc.setFont("helvetica", "normal");
      categoryBreakdown.forEach((cat) => {
        const statsStr = cat.stats.join(" - ");
        doc.text(`• ${cat.label}: ${statsStr}`, 15, yPos);
        yPos += 6;
      });
      yPos += 10;

      if (yPos > 240) { doc.addPage(); yPos = 20; }

      // 6. Dynamic Insights
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Actionable Insights", 15, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      insights.forEach((insight) => {
        const lines = doc.splitTextToSize(`• ${insight}`, pageWidth - 30);
        doc.text(lines, 15, yPos);
        yPos += lines.length * 6 + 2;
      });
      yPos += 10;

      if (yPos > 240) { doc.addPage(); yPos = 20; }

      // 7. Milestones & Gamification
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Milestones & Gamification", 15, yPos);
      yPos += 8;
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      if (gamificationStats) {
        doc.text(`• Current Streak: ${gamificationStats.streak} days (Longest: ${gamificationStats.longestStreak} days)`, 15, yPos);
        yPos += 6;
        doc.text(`• Current Level: ${gamificationStats.level} (${gamificationStats.progress}% to next level)`, 15, yPos);
        yPos += 6;
      }
      milestones.forEach((ms) => {
        doc.text(`• ${ms}`, 15, yPos);
        yPos += 6;
      });

      // Footer for last page
      yPos = 280;
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text("Generated by NeuroNest Cognitive Training Platform", pageWidth / 2, yPos, { align: "center" });

      // Save as blob for sharing
      const pdfBlob = doc.output("blob");
      setGeneratedPdfBlob(pdfBlob);

      // Download the PDF
      doc.save(`NeuroNest_Report_${latestReport.reportId}.pdf`);

    } catch (error) {
      console.error("PDF generation error:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Build the WhatsApp share URL
  const getWhatsAppUrl = () => {
    const phone = phoneNumber.replace(/\D/g, "");
    const text = encodeURIComponent(
      `🧠 NeuroNest Analytics Report\n\n` +
      `📊 Report: ${latestReport.reportId}\n` +
      `📅 Date: ${latestReport.date}\n\n` +
      `🎯 IQ Score: ${latestReport.iqScore}\n` +
      `📈 Productivity: ${latestReport.productivityScore}\n\n` +
      `💡 Summary: ${latestReport.cognitiveSummary}\n\n` +
      `✅ Weekly Avg IQ: ${latestReport.iqScore}\n` +
      `✅ Weekly Avg Productivity: ${avgProductivity}\n\n` +
      `Download full PDF report from NeuroNest app!`
    );
    return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
  };

  // Build the Email share URL
  const getEmailUrl = () => {
    const subject = encodeURIComponent(`NeuroNest Report ${latestReport.reportId}`);
    const body = encodeURIComponent(
      `NeuroNest Analytics Report\n\n` +
      `Report: ${latestReport.reportId}\n` +
      `Date: ${latestReport.date}\n\n` +
      `IQ Score: ${latestReport.iqScore}\n` +
      `Productivity: ${latestReport.productivityScore}\n\n` +
      `Summary: ${latestReport.cognitiveSummary}\n\n` +
      `Weekly Avg IQ: ${latestReport.iqScore}\n` +
      `Weekly Avg Productivity: ${avgProductivity}`
    );
    return `mailto:?subject=${subject}&body=${body}`;
  };

  // Copy report to clipboard
  const copyReport = async () => {
    const text =
      `🧠 NeuroNest Analytics Report\n\n` +
      `📊 Report: ${latestReport.reportId}\n` +
      `📅 Date: ${latestReport.date}\n\n` +
      `🎯 IQ Score: ${latestReport.iqScore}\n` +
      `📈 Productivity: ${latestReport.productivityScore}\n\n` +
      `💡 Summary: ${latestReport.cognitiveSummary}\n\n` +
      `✅ Weekly Avg IQ: ${latestReport.iqScore}\n` +
      `✅ Weekly Avg Productivity: ${avgProductivity}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  // Handle phone number change
  const handlePhoneChange = (e) => {
    setPhoneNumber(e.target.value);
  };

  return (
    <div className="analytics-shell">
      <header className="analytics-hero">
        <div>
          <p className="eyebrow">Analytics</p>
          <h1>Progress intelligence</h1>
          <p>Role: Analytics &amp; feedback data for user progress.</p>
        </div>
        <div className="analytics-mode-switch" role="group" aria-label="Analytics view">
          <button
            type="button"
            className={activeView === "reports" ? "active" : ""}
            onClick={() => setActiveView("reports")}
          >
            Reports
          </button>
          <button
            type="button"
            className={activeView === "trends" ? "active" : ""}
            onClick={() => setActiveView("trends")}
          >
            Trends
          </button>
          <button
            type="button"
            className={activeView === "insights" ? "active" : ""}
            onClick={() => setActiveView("insights")}
          >
            Insights
          </button>
          <button
            type="button"
            className={activeView === "features" ? "active" : ""}
            onClick={() => setActiveView("features")}
          >
            Features
          </button>
        </div>
      </header>
      
      {/* HIDDEN CONTAINER FOR PDF GRAPH EXPORT */}
      <div 
        id="pdf-export-container"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '800px',
          background: '#0f0518',
          color: '#fff',
          padding: '20px',
          zIndex: -1
        }}
      >
        <div id="pdf-chart-live" className="analytics-card" style={{ marginBottom: '20px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
            <span style={{ fontSize: '24px', marginRight: '10px' }}>📊</span>
            <h3 style={{ fontSize: '22px', margin: 0 }}>Live Progress Report</h3>
            <span style={{ marginLeft: '15px', backgroundColor: '#8b5cf6', color: 'white', padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>LIVE</span>
          </div>
          <div style={{ display: 'flex', gap: '30px', marginTop: '10px' }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '5px' }}>Total XP</div>
              <div style={{ fontSize: '28px', color: '#8b5cf6', fontWeight: 'bold' }}>{latestReport.totalXP || 0}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '5px' }}>Level</div>
              <div style={{ fontSize: '28px', color: '#10b981', fontWeight: 'bold' }}>{latestReport.level || 1}</div>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', opacity: 0.7, marginBottom: '5px' }}>Streak</div>
              <div style={{ fontSize: '28px', color: '#f59e0b', fontWeight: 'bold' }}>🔥 {latestReport.streak || 0}</div>
            </div>
          </div>
        </div>

        <div id="pdf-chart-trends" className="analytics-card" style={{ marginBottom: '20px', padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '15px' }}>Weekly Activity Focus</h3>
          <div className="line-chart" style={{ display: 'flex', gap: '30px', alignItems: 'flex-end', height: '180px', padding: '10px 0' }}>
            {weeklyTrends.length > 0 ? weeklyTrends.map((day) => (
              <div key={day.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', flex: 1, justifyContent: 'flex-end' }}>
                <div style={{ width: '40px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', height: '100%', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${day.productivity}%`, background: 'linear-gradient(to top, #7c3aed, #10b981)', borderRadius: '4px' }} />
                </div>
                <strong style={{ marginTop: '8px', fontSize: '14px', opacity: 0.8 }}>{day.label}</strong>
              </div>
            )) : <p>No data</p>}
          </div>
        </div>

        <div id="pdf-chart-split" className="analytics-card" style={{ marginBottom: '20px', padding: '20px', display: 'flex', alignItems: 'center', gap: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <div style={{ width: '150px', height: '150px' }}>
            {/* SVG Pie Chart */}
            <svg viewBox="0 0 32 32" style={{ width: '150px', height: '150px', transform: 'rotate(-90deg)', borderRadius: '50%' }}>
              {(() => {
                let cumulativeOffset = 0;
                return trendSplit.map((item, index) => {
                  const dashValue = (item.share / 100) * 100;
                  const dashArray = `${dashValue} 100`;
                  const strokeOffset = -cumulativeOffset;
                  cumulativeOffset += dashValue;
                  return (
                    <circle
                      key={index}
                      r="16"
                      cx="16"
                      cy="16"
                      fill="transparent"
                      stroke={item.color}
                      strokeWidth="32"
                      strokeDasharray={dashArray}
                      strokeDashoffset={strokeOffset}
                    />
                  );
                });
              })()}
            </svg>
          </div>
          <ul style={{ flex: 1, listStyle: 'none', padding: 0 }}>
            {trendSplit.map((item) => (
              <li key={item.label} style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', fontSize: '18px' }}>
                <span style={{ display: 'inline-block', width: '16px', height: '16px', borderRadius: '50%', background: item.color, marginRight: '12px' }} />
                <span style={{ flex: 1 }}>{item.label}</span>
                <strong style={{ fontSize: '20px' }}>{item.share}%</strong>
              </li>
            ))}
          </ul>
        </div>

        <div id="pdf-chart-radar" className="analytics-card" style={{ marginBottom: '20px', padding: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
          <div className="radar-chart" style={{ width: '400px' }}>
            <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
              <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r="30" stroke="rgba(255,255,255,0.1)" fill="none" />
              <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r="55" stroke="rgba(255,255,255,0.1)" fill="none" />
              <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={RADAR_RADIUS} stroke="rgba(255,255,255,0.2)" fill="none" />
              {cognitiveAxes.map((axis, index) => {
                const angle = (Math.PI / 2) - (2 * Math.PI * index / cognitiveAxes.length);
                const x = RADAR_CENTER + RADAR_RADIUS * Math.cos(angle);
                const y = RADAR_CENTER - RADAR_RADIUS * Math.sin(angle);
                return (
                  <text key={axis.label} x={x} y={y} fill="#fff" fontSize="16" textAnchor="middle" alignmentBaseline="middle">
                    {axis.label}
                  </text>
                );
              })}
              <polygon points={cognitiveAxes.length > 0 ? buildRadarPoints(cognitiveAxes) : RADAR_POINTS} fill="rgba(139, 92, 246, 0.4)" stroke="#8b5cf6" strokeWidth="3" />
            </svg>
          </div>
        </div>
      </div>
      {/* END HIDDEN CONTAINER */}

      {activeView === "reports" && (
        <>
          <section className="analytics-grid">
            <article className="analytics-card feature-card highlight">
              <div className="feature-card-header">
                <span className="feature-icon">📝</span>
                <div>
                  <h3>Latest Report</h3>
                  <p className="feature-subtitle">Your most recent cognitive summary</p>
                </div>
              </div>
              <div className="feature-stats" style={{ marginTop: '20px' }}>
                <div className="stat-grid" style={{ marginBottom: '16px' }}>
                  <div>
                    <span className="stat-mini-label">Report ID</span>
                    <strong style={{ fontSize: '1.1rem' }}>{latestReport.reportId}</strong>
                  </div>
                  <div>
                    <span className="stat-mini-label">Date</span>
                    <strong style={{ fontSize: '1.1rem' }}>{latestReport.date}</strong>
                  </div>
                  <div>
                    <span className="stat-mini-label">IQ Score</span>
                    <strong className="stat-value highlight" style={{ fontSize: '1.75rem', color: '#8b5cf6' }}>{latestReport.iqScore}</strong>
                  </div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
                  <span className="stat-mini-label" style={{ display: 'block', marginBottom: '8px' }}>Cognitive Summary</span>
                  <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5', opacity: 0.9 }}>
                    {latestReport.cognitiveSummary}
                  </p>
                </div>
              </div>
            </article>

            <article className="analytics-card feature-card">
              <div className="feature-card-header">
                <span className="feature-icon">📈</span>
                <div>
                  <h3>Score Snapshot</h3>
                  <p className="feature-subtitle">Current performance metrics</p>
                </div>
              </div>
              <div className="bar-chart" style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600 }}>IQ Score</span>
                    <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{latestReport.iqScore}</span>
                  </div>
                  <div className="bar-track">
                    <div style={{ inlineSize: `${Math.min(100, latestReport.iqScore)}%`, background: 'linear-gradient(90deg, #8b5cf6, #3b82f6)' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600 }}>Productivity Score</span>
                    <span style={{ color: '#10b981', fontWeight: 600 }}>{latestReport.productivityScore}%</span>
                  </div>
                  <div className="bar-track">
                    <div style={{ inlineSize: `${latestReport.productivityScore}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }} />
                  </div>
                </div>
              </div>
            </article>

            <article className="analytics-card">
              <h3>Recommendations</h3>
              <ul className="insight-list">
                {latestReport.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </section>

          {/* Show current report as beautifully styled live card */}
          <article className="analytics-card feature-card live-report-card">
            <div className="feature-card-header">
              <span className="feature-icon">📊</span>
              <div>
                <h3>Live Progress Report</h3>
                <p className="feature-subtitle">Real-time stats from your training sessions</p>
              </div>
              <span className="live-badge" style={{
                backgroundColor: 'var(--color-primary, #8b5cf6)',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '12px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                boxShadow: '0 0 8px var(--color-primary, #8b5cf6)',
                animation: 'pulse 2s infinite'
              }}>LIVE</span>
            </div>

            <div className="feature-stats" style={{ marginTop: '20px' }}>
              <div className="stat-grid" style={{ marginBottom: '16px' }}>
                <div>
                  <span className="stat-mini-label">Total XP</span>
                  <strong className="stat-value highlight" style={{ fontSize: '1.75rem' }}>{latestReport.totalXP || 0}</strong>
                </div>
                <div>
                  <span className="stat-mini-label">Level</span>
                  <strong className="stat-value highlight" style={{ fontSize: '1.75rem', color: '#10b981' }}>{latestReport.level || 1}</strong>
                </div>
                <div>
                  <span className="stat-mini-label">Streak</span>
                  <strong className="stat-value highlight" style={{ fontSize: '1.75rem', color: '#f59e0b' }}>🔥 {latestReport.streak || 0} <span style={{ fontSize: '1rem' }}>days</span></strong>
                </div>
              </div>
              <div className="stat-grid">
                <div>
                  <span className="stat-mini-label">Exercises Done</span>
                  <strong>{latestReport.exercisesCompleted || 0}</strong>
                </div>
                <div>
                  <span className="stat-mini-label">Tasks Done</span>
                  <strong>{latestReport.tasksCompleted || 0}</strong>
                </div>
                <div>
                  <span className="stat-mini-label">Report ID</span>
                  <strong style={{ opacity: 0.8, fontSize: '0.85rem' }}>{latestReport.reportId}</strong>
                </div>
              </div>
            </div>
          </article>
        </>
      )}

      {activeView === "trends" && (
        <section className="analytics-grid">
          <article className="analytics-card">
            <h3>Weekly Activity</h3>
            <div className="line-chart">
              {weeklyTrends.length > 0 ? weeklyTrends.map((day) => (
                <div key={day.label}>
                  <div>
                    <strong>{day.label}</strong>
                    <p className="analytics-empty">
                      Exercises: {day.exercises} · Tasks: {day.tasks} · Productivity: {day.productivity}%
                    </p>
                  </div>
                  <div className="bar-track">
                    <div style={{ inlineSize: `${day.productivity}%` }} />
                  </div>
                </div>
              )) : (
                <p className="analytics-empty">Start training to see your weekly progress!</p>
              )}
            </div>
            <p className="analytics-empty">
              Weekly averages: Productivity {avgProductivity}%, Focus {avgFocus}%.
            </p>
          </article>

          <article className="analytics-card">
            <h3>Trend split</h3>
            <div className="pie-chart">
              <div className="pie-graphic" aria-hidden="true" />
              <ul className="pie-legend">
                {trendSplit.map((item) => (
                  <li key={item.label}>
                    <span className="dot" style={{ background: item.color }} />
                    {item.label} {item.share}%
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <article className="analytics-card">
            <h3>Attention heatmap</h3>
            <div className="heatmap-placeholder">
              Peak focus windows: 9:00 AM to 11:30 AM, 3:00 PM to 4:00 PM.
            </div>
          </article>
        </section>
      )}

      {activeView === "insights" && (
        <>
          <section className="analytics-flex">
            <article className="analytics-card">
              <h3>Insights</h3>
              <ul className="insight-list">
                {insights.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="analytics-card">
              <h3>Cognitive radar</h3>
              <div className="radar-chart">
                <svg
                  viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
                  role="img"
                  aria-label="Cognitive radar"
                >
                  <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r="30" />
                  <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r="55" />
                  <circle cx={RADAR_CENTER} cy={RADAR_CENTER} r={RADAR_RADIUS} />
                  <polygon points={cognitiveAxes.length > 0 ? buildRadarPoints(cognitiveAxes) : RADAR_POINTS} />
                </svg>
                <ul className="radar-legend">
                  {cognitiveAxes.map((axis) => (
                    <li key={axis.label}>
                      {axis.label}: {axis.value}
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="analytics-card task-metrics">
              <h3>Task outcome mix</h3>
              <div className="task-totals">
                <div>
                  <p>Total</p>
                  <strong>{taskOutcomes.total}</strong>
                </div>
                <div>
                  <p>Completed</p>
                  <strong>{taskOutcomes.completed}</strong>
                </div>
                <div>
                  <p>Pending</p>
                  <strong>{taskOutcomes.pending}</strong>
                </div>
              </div>
              <div className="task-count-grid">
                {categoryBreakdown.map((category) => (
                  <div key={category.label}>
                    <strong>{category.label}</strong>
                    <ul>
                      {category.stats.map((stat, idx) => (
                        <li key={idx}>{stat}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </article>
          </section>

          <section className="analytics-flex">
            <article className="analytics-card milestones">
              <h3>Milestones</h3>
              <ul>
                {milestones.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </article>
          </section>
        </>
      )}

      {/* Features Progress View */}
      {activeView === "features" && (
        <>
          <section className="feature-grid">
            {/* Gamification Overview Card */}
            <article
              className="analytics-card feature-card"
              onClick={() => navigate("/dashboard")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/dashboard")}
            >
              <div className="feature-card-header">
                <span className="feature-icon">🏆</span>
                <div>
                  <h3>Gamification Progress</h3>
                  <p className="feature-subtitle">Track your level and achievements</p>
                </div>
                <span className="feature-arrow">→</span>
              </div>
              {gamificationStats ? (
                <div className="feature-stats">
                  <div className="stat-row">
                    <span className="stat-label">Level</span>
                    <span className="stat-value highlight">{gamificationStats.level}</span>
                  </div>
                  <div className="progress-stat">
                    <div className="progress-label-row">
                      <span>Progress to Level {gamificationStats.level + 1}</span>
                      <span>{gamificationStats.progress}%</span>
                    </div>
                    <div className="bar-track">
                      <div style={{ inlineSize: `${gamificationStats.progress}%` }} />
                    </div>
                  </div>
                  <div className="stat-grid">
                    <div>
                      <span className="stat-mini-label">Total XP</span>
                      <strong>{gamificationStats.totalXP}</strong>
                    </div>
                    <div>
                      <span className="stat-mini-label">Streak</span>
                      <strong>🔥 {gamificationStats.streak} days</strong>
                    </div>
                    <div>
                      <span className="stat-mini-label">Exercises</span>
                      <strong>{gamificationStats.exercisesCompleted}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="analytics-empty">Loading stats...</p>
              )}
            </article>

            {/* Training Modules Card */}
            <article
              className="analytics-card feature-card"
              onClick={() => navigate("/training")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/training")}
            >
              <div className="feature-card-header">
                <span className="feature-icon">🧠</span>
                <div>
                  <h3>Training Modules</h3>
                  <p className="feature-subtitle">Brain exercises and cognitive training</p>
                </div>
                <span className="feature-arrow">→</span>
              </div>
              <div className="module-list">
                {TRAINING_MODULES.map((module) => {
                  const currentModStats = exerciseStats?.moduleStats?.[module.id] || { completed: 0, xp: 0 };
                  const completed = currentModStats.completed;
                  const earnedXP = currentModStats.xp;
                  const progressPct = module.totalXP > 0 ? Math.min(100, Math.round((earnedXP / module.totalXP) * 100)) : 0;

                  return (
                    <div key={module.id} className="module-item" style={{display: 'flex', flexDirection: 'column', alignItems: 'stretch'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.6rem'}}>
                        <span className="module-icon">{module.icon}</span>
                        <div className="module-info" style={{flex: 1}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <strong>{module.title}</strong>
                            {completed > 0 && <span style={{fontSize: '0.75rem', opacity: 0.8}}>{completed}/{module.exercises} exercises</span>}
                          </div>
                          <div className="bar-track" style={{margin: '6px 0', height: '4px'}}>
                            <div style={{ inlineSize: `${progressPct}%`, background: 'var(--color-primary, #8b5cf6)' }} />
                          </div>
                          <div className="module-meta" style={{display: 'flex', gap: '1rem'}}>
                            <span>{module.exercises} exercises</span>
                            <span style={{color: progressPct > 0 ? '#10b981' : 'inherit'}}>{earnedXP} / {module.totalXP} XP</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="feature-footer">
                <span className="feature-total">
                  {TRAINING_MODULES.reduce((sum, m) => sum + m.exercises, 0)} total exercises
                </span>
                <span className="feature-xp">
                  {TRAINING_MODULES.reduce((sum, m) => sum + m.totalXP, 0)} XP available
                </span>
              </div>
            </article>

            {/* AI Tutor Quizzes Card */}
            <article
              className="analytics-card feature-card"
              onClick={() => navigate("/ai-tutor")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/ai-tutor")}
            >
              <div className="feature-card-header">
                <span className="feature-icon">📝</span>
                <div>
                  <h3>AI Tutor Quizzes</h3>
                  <p className="feature-subtitle">Quiz performance and learning progress</p>
                </div>
                <span className="feature-arrow">→</span>
              </div>
              <div className="feature-stats">
                {gamificationStats && gamificationStats.exercisesCompleted > 0 ? (
                  <>
                    <div className="stat-row">
                      <span className="stat-label">Exercises Completed</span>
                      <span className="stat-value highlight">{gamificationStats.exercisesCompleted}</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Total XP Earned</span>
                      <span className="stat-value">{gamificationStats.totalXP} XP</span>
                    </div>
                    <div className="progress-stat">
                      <div className="progress-label-row">
                        <span>Level Progress</span>
                        <span>{gamificationStats.progress}%</span>
                      </div>
                      <div className="bar-track">
                        <div style={{ inlineSize: `${gamificationStats.progress}%`, background: "linear-gradient(90deg,#f97316,#ef4444)" }} />
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="analytics-empty">No quizzes completed yet. Start learning!</p>
                )}
              </div>
            </article>

            {/* AI Twin Arena Card */}
            <article
              className="analytics-card feature-card arena-feature-card"
              onClick={() => navigate("/ai-twin-arena")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/ai-twin-arena")}
            >
              <div className="feature-card-header">
                <span className="feature-icon">⚔️</span>
                <div>
                  <h3>AI Twin Arena</h3>
                  <p className="feature-subtitle">Battle results and competitive stats</p>
                </div>
                <span className="feature-arrow">→</span>
              </div>
              {arenaProfile && arenaProfile.sessions > 0 ? (
                <div className="feature-stats">
                  <div className="stat-grid">
                    <div>
                      <span className="stat-mini-label">Arena XP</span>
                      <strong style={{ color: "#ef4444" }}>⚔️ {arenaProfile.xp}</strong>
                    </div>
                    <div>
                      <span className="stat-mini-label">Accuracy</span>
                      <strong style={{ color: arenaProfile.accuracy >= 70 ? "#10b981" : "#f59e0b" }}>
                        🎯 {arenaProfile.accuracy}%
                      </strong>
                    </div>
                    <div>
                      <span className="stat-mini-label">Sessions</span>
                      <strong>⚡ {arenaProfile.sessions}</strong>
                    </div>
                    <div>
                      <span className="stat-mini-label">Win Streak</span>
                      <strong style={{ color: "#f97316" }}>🔥 {arenaProfile.streak}</strong>
                    </div>
                  </div>
                  {/* Accuracy bar */}
                  <div className="progress-stat" style={{ marginTop: "0.6rem" }}>
                    <div className="progress-label-row">
                      <span>Battle Accuracy</span>
                      <span>{arenaProfile.accuracy}%</span>
                    </div>
                    <div className="bar-track">
                      <div
                        style={{
                          inlineSize: `${arenaProfile.accuracy}%`,
                          background: arenaProfile.accuracy >= 70
                            ? "linear-gradient(90deg,#10b981,#34d399)"
                            : arenaProfile.accuracy >= 40
                              ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
                              : "linear-gradient(90deg,#ef4444,#f97316)"
                        }}
                      />
                    </div>
                  </div>
                  {/* Titles */}
                  {arenaProfile.titles && arenaProfile.titles.length > 0 && (
                    <div className="arena-titles-mini">
                      {arenaProfile.titles.map(t => (
                        <span key={t} className="arena-title-mini-badge">🏅 {t}</span>
                      ))}
                    </div>
                  )}
                  {/* Recent history */}
                  {arenaProfile.history && arenaProfile.history.length > 0 && (
                    <div className="arena-history-mini">
                      <span className="stat-mini-label" style={{ marginBottom: "0.4rem", display: "block" }}>Recent Battles</span>
                      {arenaProfile.history.slice(-3).reverse().map((h, i) => (
                        <div key={i} className="arena-history-row">
                          <span>{h.date}</span>
                          <span style={{ color: "#94a3b8" }}>{h.domain} · {h.difficulty}</span>
                          <span style={{ fontWeight: 700, color: h.score >= 70 ? "#10b981" : "#f87171" }}>
                            {h.score}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="analytics-empty">No arena matches yet. Challenge the AI Twin! ⚔️</p>
              )}
            </article>


            <article
              className="analytics-card feature-card"
              onClick={() => navigate("/tasks")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/tasks")}
            >
              <div className="feature-card-header">
                <span className="feature-icon">📋</span>
                <div>
                  <h3>Task Management</h3>
                  <p className="feature-subtitle">Organize and track your tasks</p>
                </div>
                <span className="feature-arrow">→</span>
              </div>
              <div className="category-list">
                {TASK_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="category-item">
                    <span className="category-icon">{cat.icon}</span>
                    <span className="category-label">{cat.label}</span>
                    <span className={`load-badge ${cat.load}`}>{cat.load}</span>
                  </div>
                ))}
              </div>
              <div className="task-status-preview">
                <div className="status-row">
                  <span className="status-dot pending" />
                  <span>Pending</span>
                  <span className="status-count">{taskOutcomes.pending}</span>
                </div>
                <div className="status-row">
                  <span className="status-dot in-progress" />
                  <span>In Progress</span>
                  <span className="status-count">{taskOutcomes.inProgress || 0}</span>
                </div>
                <div className="status-row">
                  <span className="status-dot completed" />
                  <span>Completed</span>
                  <span className="status-count">{taskOutcomes.completed}</span>
                </div>
              </div>
              <div className="feature-footer">
                <span className="feature-total">{taskOutcomes.total} total tasks</span>
              </div>
            </article>

            {/* Rewards Progress Card */}
            <article
              className="analytics-card feature-card"
              onClick={() => navigate("/rewards")}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate("/rewards")}
            >
              <div className="feature-card-header">
                <span className="feature-icon">🎖️</span>
                <div>
                  <h3>Rewards & Badges</h3>
                  <p className="feature-subtitle">Your cognitive journey milestones</p>
                </div>
                <span className="feature-arrow">→</span>
              </div>
              {gamificationStats && (
                <div className="rewards-preview">
                  <div className="avatar-preview">
                    <span className="avatar-stage-icon">
                      {getAvatarStage(gamificationStats.totalXP).emoji}
                    </span>
                    <div className="avatar-info">
                      <strong>{getAvatarStage(gamificationStats.totalXP).name}</strong>
                      <span className="avatar-xp">{gamificationStats.totalXP} XP</span>
                    </div>
                  </div>
                  <div className="badges-preview">
                    <span className="badge-icon">🏅</span>
                    <span>Achievement Badges</span>
                  </div>
                  <div className="capsule-preview">
                    <span className="capsule-icon">⏳</span>
                    <span>Time Capsule - Replay challenges</span>
                  </div>
                </div>
              )}
            </article>
          </section>

          <section className="feature-summary">
            <article className="analytics-card">
              <h3>📊 What You Can Do</h3>
              <ul className="action-list">
                <li>
                  <span className="action-icon">🎯</span>
                  <div>
                    <strong>Complete Training Exercises</strong>
                    <p>Earn XP and level up by completing cognitive exercises</p>
                  </div>
                </li>
                <li>
                  <span className="action-icon">🔥</span>
                  <div>
                    <strong>Maintain Your Streak</strong>
                    <p>Train daily to build your streak and unlock achievements</p>
                  </div>
                </li>
                <li>
                  <span className="action-icon">📅</span>
                  <div>
                    <strong>Manage Tasks</strong>
                    <p>Organize your work with categories and priority levels</p>
                  </div>
                </li>
                <li>
                  <span className="action-icon">🏆</span>
                  <div>
                    <strong>Earn Badges</strong>
                    <p>Unlock achievements as you progress through training</p>
                  </div>
                </li>
              </ul>
            </article>
          </section>
        </>
      )}

      {/* PDF Export & Share Section */}
      <section className="analytics-export">
        <header>
          <div>
            <h3>📄 Export & Share Report</h3>
            <p className="analytics-empty">
              Generate a PDF or share your report instantly
            </p>
          </div>
        </header>

        <div className="export-content">
          <div className="phone-input-group">
            <label htmlFor="phone-input">Phone Number for WhatsApp (optional)</label>
            <input
              id="phone-input"
              type="tel"
              placeholder="+91 98765 43210"
              value={phoneNumber}
              onChange={handlePhoneChange}
            />
          </div>

          <div className="export-actions">
            <button
              type="button"
              className="export-btn pdf-btn"
              onClick={generatePDF}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <>⏳ Generating...</>
              ) : (
                <>📥 Generate PDF</>
              )}
            </button>

            <a
              href={getWhatsAppUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="export-btn whatsapp-btn"
            >
              <span className="btn-icon">💬</span>
              Share on WhatsApp
            </a>

            <button
              type="button"
              className="export-btn copy-btn"
              onClick={copyReport}
            >
              <span className="btn-icon">{copySuccess ? "✅" : "📋"}</span>
              {copySuccess ? "Copied!" : "Copy Report"}
            </button>

            <a
              href={getEmailUrl()}
              className="export-btn email-btn"
            >
              <span className="btn-icon">✉️</span>
              Email Report
            </a>
          </div>

          <div className="export-preview">
            <h4>Report Preview</h4>
            <div className="preview-card">
              <p><strong>Report:</strong> {latestReport.reportId}</p>
              <p><strong>Date:</strong> {latestReport.date}</p>
              <p><strong>IQ Score:</strong> {latestReport.iqScore}</p>
              <p><strong>Productivity:</strong> {latestReport.productivityScore}</p>
              <p><strong>Summary:</strong> {latestReport.cognitiveSummary}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
