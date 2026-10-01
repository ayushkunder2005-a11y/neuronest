import crypto from "crypto";
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import Payment from "../models/Payment.js";

const router = express.Router();

const RZP_KEY_ID     = process.env.RAZORPAY_KEY_ID;
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

/** Base64 credentials for Razorpay REST API */
const rzpBasicAuth = () =>
  "Basic " + Buffer.from(`${RZP_KEY_ID}:${RZP_KEY_SECRET}`).toString("base64");

// All payment routes require authentication
router.use(protect);

// POST /api/payments/create-order — Create a real Razorpay order
router.post("/create-order", async (req, res) => {
  try {
    const { amount = 29900, plan = "basic", planDuration = "monthly" } = req.body;
    // amount must be in paise (Rs.299 = 29900 paise)

    // Call Razorpay Orders API
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: rzpBasicAuth(),
      },
      body: JSON.stringify({
        amount,         // in paise
        currency: "INR",
        receipt: `rcpt_${Date.now()}`,
        notes: { plan, userId: String(req.user._id) },
      }),
    });

    if (!rzpRes.ok) {
      const errBody = await rzpRes.text();
      console.error("[Payments] Razorpay order error:", errBody);
      return res.status(502).json({ message: "Failed to create Razorpay order", detail: errBody });
    }

    const rzpOrder = await rzpRes.json();

    // Calculate subscription expiry
    const expiresAt = new Date();
    if (planDuration === "yearly") expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    else expiresAt.setMonth(expiresAt.getMonth() + 1);

    // Persist the pending payment record
    const payment = await Payment.create({
      user: req.user._id,
      orderId: rzpOrder.id,           // real Razorpay order_id
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      status: "created",
      plan,
      planDuration,
      expiresAt,
    });

    res.status(201).json({
      orderId:  payment.orderId,
      amount:   payment.amount,
      currency: payment.currency,
      plan:     payment.plan,
      keyId:    RZP_KEY_ID,           // send key_id to frontend (safe)
    });
  } catch (err) {
    console.error("[Payments] Create order error:", err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/payments/verify — Verify Razorpay HMAC-SHA256 signature
router.post("/verify", async (req, res) => {
  try {
    const { orderId, paymentId, signature } = req.body;

    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ message: "orderId, paymentId and signature are required" });
    }

    // Verify HMAC-SHA256 signature
    const expectedSig = crypto
      .createHmac("sha256", RZP_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    if (expectedSig !== signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    const payment = await Payment.findOne({ orderId, user: req.user._id });
    if (!payment) return res.status(404).json({ message: "Order not found" });
    if (payment.status === "paid") return res.json({ message: "Already verified", payment });

    payment.paymentId = paymentId;
    payment.signature = signature;
    payment.status = "paid";
    await payment.save();

    res.json({
      message: "Payment verified successfully",
      payment: {
        orderId:   payment.orderId,
        paymentId: payment.paymentId,
        amount:    payment.amount,
        plan:      payment.plan,
        status:    payment.status,
        expiresAt: payment.expiresAt,
      },
    });
  } catch (err) {
    console.error("[Payments] Verify error:", err);
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments/status
router.get("/status", async (req, res) => {
  try {
    const payment = await Payment.findOne({ user: req.user._id, status: "paid" }).sort({ createdAt: -1 });
    if (!payment) return res.json({ plan: "free", active: false });
    const isActive = payment.expiresAt > new Date();
    res.json({ plan: payment.plan, active: isActive, expiresAt: payment.expiresAt, amount: payment.amount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/payments/history
router.get("/history", async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json(payments.map((p) => ({
      orderId: p.orderId, paymentId: p.paymentId,
      amount: p.amount, currency: p.currency,
      plan: p.plan, status: p.status,
      expiresAt: p.expiresAt, createdAt: p.createdAt,
    })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
