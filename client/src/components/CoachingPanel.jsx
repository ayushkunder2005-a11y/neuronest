import { useEffect, useMemo, useState } from "react";
import AIPremiumTutor from "./AIPremiumTutor";
import { checkPaymentStatus } from "../config/api";

const walletOptions = ["Paytm Wallet", "PhonePe Wallet", "Amazon Pay", "Mobikwik"];
const netBankingPopular = ["HDFC Bank", "ICICI Bank", "SBI", "Axis Bank"];
const netBankingAll = [
  "Kotak Mahindra",
  "Yes Bank",
  "Punjab National Bank",
  "IDFC First",
  "IndusInd",
  "Federal Bank",
  "Bank of Baroda",
];
const productSummary = {
  name: "AI Premium Tutor",
  label: "Coaching with AI",
  plan: "Monthly Plan",
  priceINR: 299,
  priceUSD: 9,
};
const priceBreakdown = {
  base: 299,
  tax: 25,
  discount: 0,
};

export default function CoachingPanel() {
  const [coachingMode, setCoachingMode] = useState("basic");
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  const [premiumHelperMessage, setPremiumHelperMessage] = useState("");
  const [selectedWallet, setSelectedWallet] = useState(walletOptions[0]);
  const [selectedNetBank, setSelectedNetBank] = useState(netBankingPopular[0]);
  const [upiId, setUpiId] = useState("");
  const [upiStatus, setUpiStatus] = useState("");
  const [qrTimer, setQrTimer] = useState(45);
  const [cardDetails, setCardDetails] = useState({
    cardName: "",
    cardNumber: "",
    expiry: "",
    cvv: "",
    save: false,
  });

  const headline = useMemo(
    () => (coachingMode === "AI" ? "AI Premium Tutor" : "Basic Coaching"),
    [coachingMode]
  );
  const orderId = useMemo(() => `#AI${Math.floor(Math.random() * 900000) + 100000}`, []);
  const totalPayable = priceBreakdown.base + priceBreakdown.tax - priceBreakdown.discount;

  useEffect(() => {
    checkPaymentStatus().then((status) => {
      if (status && status.active) {
        setPaymentComplete(true);
      }
    }).catch(console.warn);
  }, []);

  useEffect(() => {
    if (coachingMode !== "AI" || paymentComplete) {
      return undefined;
    }
    const interval = setInterval(() => {
      setQrTimer((prev) => {
        if (prev <= 1) {
          return 45;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [coachingMode, paymentComplete]);

  const formatAmount = (value, currency = "₹") => `${currency}${value.toLocaleString("en-IN")}`;

  const handleProceedToPay = () => {
    setIsPaymentModalOpen(true);
    setIsPaymentSuccess(false);
  };

  const handlePaymentConfirmed = () => {
    setIsPaymentSuccess(true);
  };

  const handleStartPremiumAccess = () => {
    setIsPaymentModalOpen(false);
    setPaymentComplete(true);
  };

  const handleClosePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setIsPaymentSuccess(false);
  };

  const handlePremiumReminder = (payload) => {
    const goalLabel = payload?.profile?.goal || "next session";
    setPremiumHelperMessage(`Reminder queued for ${goalLabel}.`);
  };

  const handlePremiumEscalation = (payload) => {
    const level = payload?.profile?.subjectLevel || "your course";
    setPremiumHelperMessage(`Human tutor has been alerted for ${level}.`);
  };

  if (coachingMode === "AI" && paymentComplete) {
    return (
      <AIPremiumTutor
        onScheduleReminder={handlePremiumReminder}
        onRequestHumanTutor={handlePremiumEscalation}
      />
    );
  }

  return (
    <section className="coaching-panel" aria-label="Coaching options">
      <header>
        <div>
          <h2>{headline}</h2>
          <p>Activate AI-style AI Tutor or standard coaching for continuous guidance.</p>
        </div>
        <div className="coaching-toggle">
          <button
            type="button"
            className={coachingMode === "basic" ? "active" : ""}
            onClick={() => {
              setCoachingMode("basic");
              setPaymentComplete(false);
            }}
          >
            Basic Coaching
          </button>
          <button
            type="button"
            className={coachingMode === "AI" ? "active" : ""}
            onClick={() => {
              setCoachingMode("AI");
              setPaymentComplete(false);
            }}
          >
            AI Premium Tutor
          </button>
        </div>
      </header>
      {coachingMode === "AI" ? (
        <div className="transaction-shell">
          <header className="transaction-header">
            <div>
              <p className="eyebrow">Transaction Window</p>
              <h2>Complete Your Payment</h2>
              <p className="order-id">Order ID: {orderId}</p>
            </div>
            {premiumHelperMessage && <span aria-live="polite">{premiumHelperMessage}</span>}
          </header>

          <article className="transaction-summary">
            <div>
              <p className="product-label">{productSummary.label}</p>
              <h3>
                {productSummary.name} — {productSummary.plan}
              </h3>
              <p className="transaction-price">
                {formatAmount(productSummary.priceINR)} / ${productSummary.priceUSD}
              </p>
            </div>
            <ul className="transaction-benefits">
              <li>Unlimited AI tutoring</li>
              <li>Personalized learning</li>
              <li>Fast responses</li>
              <li>Smart solutions</li>
            </ul>
          </article>

          <div className="payment-options-grid">
            <section className="payment-card">
              <header>
                <p className="eyebrow">UPI Payment</p>
                <h4>Scan & Pay / UPI Intent</h4>
              </header>
              <div className="upi-grid">
                <div className="qr-area">
                  <div className="qr-image" aria-hidden="true" />
                  <p>Scan with any UPI app (Paytm, PhonePe, GPay)</p>
                  <p className="qr-timer">QR expires in {qrTimer}s</p>
                  <button type="button" className="pill-btn" onClick={() => setQrTimer(45)}>
                    Refresh QR
                  </button>
                </div>
                <div className="upi-actions">
                  <button type="button" className="pill-btn primary">
                    Pay with UPI Apps
                  </button>
                  <label>
                    Enter UPI ID
                    <input
                      type="text"
                      value={upiId}
                      onChange={(event) => {
                        setUpiId(event.target.value);
                        setUpiStatus("");
                      }}
                      placeholder="name@bank"
                    />
                  </label>
                  <button
                    type="button"
                    className="pill-btn"
                    onClick={() =>
                      setUpiStatus(upiId.trim() ? "UPI ID verified. Ready to pay." : "Enter a valid UPI ID.")
                    }
                  >
                    Verify & Pay
                  </button>
                  {upiStatus && <small className="status-text">{upiStatus}</small>}
                </div>
              </div>
            </section>

            <section className="payment-card">
              <header>
                <p className="eyebrow">Card Payment</p>
                <h4>Credit / Debit Card</h4>
              </header>
              <div className="card-form">
                <label>
                  Name on Card
                  <input
                    type="text"
                    value={cardDetails.cardName}
                    onChange={(event) =>
                      setCardDetails((prev) => ({
                        ...prev,
                        cardName: event.target.value,
                      }))
                    }
                    placeholder="e.g., Ada Lovelace"
                  />
                </label>
                <label>
                  Card Number
                  <input
                    type="text"
                    value={cardDetails.cardNumber}
                    onChange={(event) =>
                      setCardDetails((prev) => ({
                        ...prev,
                        cardNumber: event.target.value,
                      }))
                    }
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                  />
                </label>
                <div className="card-row">
                  <label>
                    Expiry MM/YY
                    <input
                      type="text"
                      value={cardDetails.expiry}
                      onChange={(event) =>
                        setCardDetails((prev) => ({
                          ...prev,
                          expiry: event.target.value,
                        }))
                      }
                      placeholder="08/28"
                    />
                  </label>
                  <label>
                    CVV
                    <input
                      type="password"
                      value={cardDetails.cvv}
                      onChange={(event) =>
                        setCardDetails((prev) => ({
                          ...prev,
                          cvv: event.target.value,
                        }))
                      }
                      placeholder="***"
                    />
                  </label>
                </div>
                <label className="save-card">
                  <input
                    type="checkbox"
                    checked={cardDetails.save}
                    onChange={(event) =>
                      setCardDetails((prev) => ({
                        ...prev,
                        save: event.target.checked,
                      }))
                    }
                  />
                  Save this card securely
                </label>
              </div>
            </section>
          </div>

          <div className="payment-options-grid secondary">
            <section className="payment-card">
              <header>
                <p className="eyebrow">Wallets</p>
                <h4>Quick pay wallets</h4>
              </header>
              <div className="wallet-list">
                {walletOptions.map((wallet) => (
                  <button
                    type="button"
                    key={wallet}
                    onClick={() => setSelectedWallet(wallet)}
                    className={selectedWallet === wallet ? "wallet active" : "wallet"}
                  >
                    {wallet}
                  </button>
                ))}
              </div>
            </section>

            <section className="payment-card">
              <header>
                <p className="eyebrow">Net Banking</p>
                <h4>Popular Banks</h4>
              </header>
              <div className="netbanking-grid">
                {netBankingPopular.map((bank) => (
                  <button
                    type="button"
                    key={bank}
                    onClick={() => setSelectedNetBank(bank)}
                    className={selectedNetBank === bank ? "netbank active" : "netbank"}
                  >
                    {bank}
                  </button>
                ))}
              </div>
              <label className="all-bank-select">
                All Banks
                <select>
                  {netBankingAll.map((bank) => (
                    <option key={bank}>{bank}</option>
                  ))}
                </select>
              </label>
            </section>

            <section className="payment-card">
              <header>
                <p className="eyebrow">In-App Purchases</p>
                <h4>Store billing</h4>
              </header>
              <div className="iap-buttons">
                <button type="button" className="pill-btn primary">
                  Buy with Google Play
                </button>
                <button type="button" className="pill-btn">
                  Subscribe via Apple Pay
                </button>
              </div>
              <p className="iap-note">
                Mobile users can complete payment via Google Play Billing or Apple In-App Purchase for instant
                activation.
              </p>
            </section>
          </div>

          <section className="price-breakdown">
            <h4>Price Breakdown</h4>
            <table>
              <tbody>
                <tr>
                  <td>Base Price</td>
                  <td>{formatAmount(priceBreakdown.base)}</td>
                </tr>
                <tr>
                  <td>Taxes (GST)</td>
                  <td>{formatAmount(priceBreakdown.tax)}</td>
                </tr>
                <tr>
                  <td>Coupon Discount</td>
                  <td>-{formatAmount(priceBreakdown.discount)}</td>
                </tr>
                <tr className="total-row">
                  <td>Total Payable</td>
                  <td>{formatAmount(totalPayable)}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <div className="secure-pay">
            <div>
              <p>Total Payable</p>
              <h3>{formatAmount(totalPayable)}</h3>
              <small>Includes taxes & applicable fees</small>
            </div>
            <button type="button" className="btn-primary wide" onClick={handleProceedToPay}>
              Pay Securely
            </button>
            <p className="trust-note">🔒 Secure Payment · PCI-DSS compliant</p>
          </div>

          <footer className="transaction-footer">
            <a href="#refund">Refund Policy</a>
            <a href="#terms">Terms & Conditions</a>
            <a href="#support">Support</a>
          </footer>
        </div>
      ) : (
        <div className="basic-coaching">
          <p>Basic coaching activated. Receive reminders, emotional support tips, and learning roadmaps.</p>
          <ul>
            <li>Topic-based reminders synchronized with the dashboard</li>
            <li>Emotional support suggestions during low focus windows</li>
            <li>Personalized learning roadmap updates weekly</li>
          </ul>
          <button type="button" className="btn-glass">
            Upgrade to AI Tutor
          </button>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="payment-modal-overlay" role="dialog" aria-modal="true">
          <div className="payment-modal">
            <button type="button" className="close-modal" onClick={handleClosePaymentModal} aria-label="Close">
              ×
            </button>
            {isPaymentSuccess ? (
              <div className="payment-success">
                <div className="payment-success-icon" aria-hidden="true">
                  ✓
                </div>
                <h4>Payment Successful</h4>
                <p>You now have full access to the AI Premium Tutor.</p>
                <button type="button" className="btn-primary" onClick={handleStartPremiumAccess}>
                  Start Premium Access
                </button>
              </div>
            ) : (
              <div className="payment-flow">
                <h4>Confirm Payment</h4>
                <div className="qr-display" aria-label="Payment QR code" />
                <p>Scan or pay using your preferred method, then confirm below.</p>
                <button type="button" className="btn-primary" onClick={handlePaymentConfirmed}>
                  I have completed the payment
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
