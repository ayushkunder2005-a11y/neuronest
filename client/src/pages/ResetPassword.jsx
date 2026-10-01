import { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { resetPassword } from "../config/api";

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const navigate = useNavigate();

    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [status, setStatus] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) {
            setStatus({ type: "error", message: "Invalid or missing reset token." });
        }
    }, [token]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        
        if (!token) {
            return setStatus({ type: "error", message: "Invalid or missing reset token." });
        }

        if (password.length < 6) {
            return setStatus({ type: "error", message: "Password must be at least 6 characters long." });
        }

        if (password !== confirmPassword) {
            return setStatus({ type: "error", message: "Passwords do not match." });
        }

        setIsSubmitting(true);
        setStatus({ type: "info", message: "Resetting password..." });

        try {
            await resetPassword(token, password);
            setSuccess(true);
            setStatus({ type: "success", message: "Your password has been successfully reset!" });
            
            // Navigate to login after 3 seconds
            setTimeout(() => {
                navigate("/");
            }, 3000);
        } catch (error) {
            setStatus({ type: "error", message: error.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <AuthLayout title="Password Reset Complete" description="You can now sign in with your new password.">
                <div className="forgot-success" style={{ textAlign: "center", padding: "2rem 0" }}>
                    <div className="success-icon" style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
                    <p style={{ color: "#e2e8f0", fontSize: "1.1rem", marginBottom: "1rem" }}>
                        Your password has been successfully reset!
                    </p>
                    <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "2rem" }}>
                        Redirecting you to the login page...
                    </p>
                    <Link to="/" className="auth-primary-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
                        Go to Login Now
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Reset Password" description="Enter your new password below to regain access to your account.">
            <form className="auth-form" onSubmit={handleSubmit}>
                <div className="forgot-icon" style={{ fontSize: "2.5rem", textAlign: "center", marginBottom: "1rem" }}>🔑</div>

                <input
                    className="auth-input"
                    type="password"
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={!token || isSubmitting}
                />

                <input
                    className="auth-input"
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ marginTop: "1rem" }}
                    disabled={!token || isSubmitting}
                />

                {status && (
                    <p className={`auth-status ${status.type}`} style={{ marginTop: "1rem", textAlign: "center" }}>
                        {status.message}
                    </p>
                )}

                <button type="submit" className="auth-primary-btn" disabled={!token || isSubmitting} style={{ marginTop: "1.5rem" }}>
                    {isSubmitting ? "Resetting..." : "Reset Password"}
                </button>
            </form>
        </AuthLayout>
    );
};

export default ResetPassword;
