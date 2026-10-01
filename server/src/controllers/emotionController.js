import EmotionLog from "../models/EmotionLog.js";

/**
 * POST /api/emotion/log
 * Save a detected emotion reading to MongoDB.
 * Body: { userId?, emotion, confidence, emotions?, distracted?, headPose?, timestamp? }
 */
export const logEmotion = async (req, res) => {
  try {
    const { emotion, confidence, emotions, distracted, headPose, timestamp } = req.body;

    if (!emotion) {
      return res.status(400).json({ error: "emotion is required" });
    }

    // userId from auth middleware (if logged in) or body
    const userId = req.user?._id || req.body.userId || null;

    const entry = await EmotionLog.create({
      user: userId,
      emotion: emotion.toLowerCase(),
      confidence: confidence ?? 0,
      // Extended fields (stored in a flexible way if the schema allows, else ignored)
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    return res.status(201).json({ success: true, id: entry._id });
  } catch (err) {
    console.error("[EmotionLog] Save error:", err.message);
    return res.status(500).json({ error: "Failed to save emotion log" });
  }
};

/**
 * GET /api/emotion/logs
 * Retrieve recent emotion logs for a user or all (last 200).
 * Query: ?userId=xxx&limit=50
 */
export const getEmotionLogs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const userId = req.user?._id || req.query.userId || null;

    const filter = userId ? { user: userId } : {};
    const logs = await EmotionLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    // Build summary stats
    const emotionCounts = {};
    for (const log of logs) {
      emotionCounts[log.emotion] = (emotionCounts[log.emotion] || 0) + 1;
    }
    const dominant = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const avgConfidence =
      logs.length > 0
        ? Math.round(logs.reduce((s, l) => s + (l.confidence || 0), 0) / logs.length)
        : 0;

    return res.json({
      success: true,
      logs,
      total: logs.length,
      summary: {
        dominant,
        avgConfidence,
        emotionCounts,
      },
    });
  } catch (err) {
    console.error("[EmotionLog] Fetch error:", err.message);
    return res.status(500).json({ error: "Failed to fetch emotion logs" });
  }
};

/**
 * GET /api/emotion/summary
 * Returns aggregated emotion summary for analytics (last 24h by default).
 * Query: ?hours=24
 */
export const getEmotionSummary = async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const userId = req.user?._id || req.query.userId || null;

    const filter = { timestamp: { $gte: since } };
    if (userId) filter.user = userId;

    const logs = await EmotionLog.find(filter).lean();

    const emotionCounts = {};
    let totalConfidence = 0;

    for (const log of logs) {
      emotionCounts[log.emotion] = (emotionCounts[log.emotion] || 0) + 1;
      totalConfidence += log.confidence || 0;
    }

    const total = logs.length;
    const dominant = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
    const avgConfidence = total > 0 ? Math.round(totalConfidence / total) : 0;

    // Hourly distribution (for charts)
    const hourlyMap = {};
    for (const log of logs) {
      const hour = new Date(log.timestamp).getHours();
      if (!hourlyMap[hour]) hourlyMap[hour] = {};
      hourlyMap[hour][log.emotion] = (hourlyMap[hour][log.emotion] || 0) + 1;
    }

    return res.json({
      success: true,
      period: `last ${hours}h`,
      total,
      dominant,
      avgConfidence,
      emotionCounts,
      hourlyDistribution: hourlyMap,
    });
  } catch (err) {
    console.error("[EmotionLog] Summary error:", err.message);
    return res.status(500).json({ error: "Failed to fetch emotion summary" });
  }
};
