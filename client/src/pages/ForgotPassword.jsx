// src/pages/ForgotPassword.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { resetPassword } from "../config/firebase";

const ForgotPassword = () => {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        setStatus({ type: "info", message: "Sending reset link..." });

        try {
            await resetPassword(email);
            setEmailSent(true);
            setStatus({
                type: "success",
                message: "Password reset link generated! Please check your email inbox."
            });
        } catch (error) {
            setStatus({ type: "error", message: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResend = async () => {
        setIsSubmitting(true);
        setStatus({ type: "info", message: "Resending reset link..." });

        try {
            await resetPassword(email);
            setStatus({
                type: "success",
                message: "A new reset link has been generated. Please check your email inbox."
            });
        } catch (error) {
            setStatus({ type: "error", message: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Email sent confirmation view
    if (emailSent) {
        return (
            <AuthLayout
                title="Check Your Email"
                description="If an account exists with this email, we've generated a password reset link"
            >
                <div className="forgot-success">
                    <div className="success-icon">📧</div>
                    <p className="success-email">{email}</p>

                    <div className="success-instructions">
                        <p>A password reset link has been generated.</p>
                        <p className="note">Please check your <strong>email inbox</strong> for the reset link. The link will expire in 30 days.</p>
                    </div>

                    {status && (
                        <p className={`auth-status ${status.type}`}>{status.message}</p>
                    )}

                    <div className="forgot-actions">
                        <button
                            type="button"
                            className="auth-secondary-btn"
                            onClick={handleResend}
                            disabled={isSubmitting}
                        >
                            Resend Link
                        </button>

                        <Link to="/" className="auth-primary-btn" style={{ textAlign: 'center', textDecoration: 'none' }}>
                            Back to Login
                        </Link>
                    </div>

                    <p className="forgot-help">
                        Not registered yet?{" "}
                        <Link to="/signup" className="link-button" style={{ background: 'none', border: 'none' }}>
                            Create an account
                        </Link>
                    </p>
                </div>
            </AuthLayout>
        );
    }

    // Request password reset form
    return (
        <AuthLayout
            title="Forgot Password?"
            description="No worries! Enter your email address and we'll send you a link to reset your password"
        >
            <form className="auth-form" onSubmit={handleSubmit}>
                <div className="forgot-icon">🔐</div>

                <input
                    className="auth-input"
                    type="email"
                    placeholder="Email Address"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                {status && (
                    <p className={`auth-status ${status.type}`}>{status.message}</p>
                )}

                <button
                    type="submit"
                    className="auth-primary-btn"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Sending..." : "Send Reset Link"}
                </button>
            </form>

            <div className="forgot-divider">
                <span />
            </div>

            <p className="auth-switch">
                Remember your password? <Link to="/">Sign In</Link>
            </p>

            <p className="auth-switch" style={{ marginTop: '0.75rem' }}>
                Need an account? <Link to="/signup">Sign Up</Link>
            </p>
        </AuthLayout>
    );
};

export default ForgotPassword;
