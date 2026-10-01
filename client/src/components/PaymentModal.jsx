import { useState } from "react";
import "../styles/paymentModal.css";

const FEATURES = [
  "50 AI Tutor sessions/month",
  "PDF document analysis",
  "Basic study plans",
  "Chat history saved",
];

const API_BASE = "http://localhost:5000";
const RZP_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_SSC8jBtP7AxRCd";

/** Dynamically load Razorpay checkout script */
function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function PaymentModal({ onClose, onSuccess }) {
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handlePay = async () => {
    setError("");
    setLoading(true);

    try {
      // 1. Load Razorpay script
      const loaded = await loadRazorpay();
      if (!loaded) { setError("Could not load payment gateway. Check your internet."); setLoading(false); return; }

      // 2. Create order on backend
      const token = localStorage.getItem("mongoToken") || sessionStorage.getItem("mongoToken") || "";
      const orderRes = await fetch(`${API_BASE}/api/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: 29900, plan: "basic", planDuration: "monthly" }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) { setError(orderData.message || "Failed to create order."); setLoading(false); return; }

      // 3. Open Razorpay checkout
      const options = {
        key: RZP_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "NeuroNest",
        description: "AI Tutor Monthly Plan",
        order_id: orderData.orderId,
        theme: { color: "#7c3aed" },
        modal: { ondismiss: () => setLoading(false) },
        handler: async (response) => {
          // 4. Verify payment on backend
          try {
            const verifyRes = await fetch(`${API_BASE}/api/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                orderId:   response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) { setError(verifyData.message || "Payment verification failed."); setLoading(false); return; }

            // 5. Mark paid in localStorage so modal doesn't re-show
            localStorage.setItem("nn-aittutor-paid", "true");
            setLoading(false);
            setPaid(true);
          } catch {
            setError("Verification error. Please contact support.");
            setLoading(false);
          }
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError("Unexpected error: " + err.message);
      setLoading(false);
    }
  };

  return (
    <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="pm-modal">
        {/* Header */}
        <div className="pm-header">
          <div className="pm-header-left">
            <div className="pm-logo">🧠</div>
            <div>
              <h2 className="pm-title">NeuroNest AI Tutor</h2>
              <p className="pm-subtitle">Unlock your learning superpower</p>
            </div>
          </div>
          <button className="pm-close" onClick={onClose}>✕</button>
        </div>

        {!paid ? (
          <div className="pm-body">
            {/* Plan card */}
            <div className="pm-single-plan">
              <div className="pm-plan-left">
                <div className="pm-plan-label">AI Tutor Plan</div>
                <div className="pm-plan-price-row">
                  <span className="pm-big-price">₹299</span>
                  <span className="pm-per-mo">/month</span>
                </div>
                <ul className="pm-features">
                  {FEATURES.map((f) => (
                    <li key={f}><span className="pm-check">✓</span> {f}</li>
                  ))}
                </ul>
              </div>
              <div className="pm-plan-right">
                <div className="pm-trial-badge">7-day free trial</div>
                <p className="pm-cancel-note">Cancel anytime</p>
              </div>
            </div>

            {error && <p className="pm-error">{error}</p>}

            <button className="pm-pay-btn" onClick={handlePay} disabled={loading}>
              {loading ? "⟳ Opening payment..." : "🔒 Pay ₹299 / month"}
            </button>
            <p className="pm-secure-note">🔐 Powered by Razorpay · 256-bit SSL encrypted</p>
          </div>
        ) : (
          <div className="pm-success">
            <div className="pm-success-icon">✅</div>
            <h2 className="pm-success-title">Payment Successful!</h2>
            <p className="pm-success-sub">Your AI Tutor subscription is now active.</p>
            <div className="pm-success-details">
              <div className="pm-success-row"><span>Plan</span><strong>AI Tutor</strong></div>
              <div className="pm-success-row"><span>Amount</span><strong>₹299/month</strong></div>
              <div className="pm-success-row"><span>Status</span><strong className="pm-active">🟢 Active</strong></div>
            </div>
            <button className="pm-pay-btn" onClick={() => onSuccess?.()}>
              🚀 Launch AI Tutor
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
