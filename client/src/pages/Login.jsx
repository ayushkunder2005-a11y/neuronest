// src/pages/Login.jsx
import { useState } from "react";
import { FaFacebookF, FaGoogle, FaTwitter } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { syncUserToMongo, storeMongoToken, storeMongoUser } from "../config/api";
import {
  loginWithEmail,
  signInWithFacebook,
  signInWithGoogle,
  signInWithTwitter
} from "../config/firebase";
import { persistSession, setOAuthRememberPreference } from "../utils/session";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "info", message: "Signing you in..." });

    try {
      // Firebase email/password login
      const data = await loginWithEmail(email, password);

      const sessionData = {
        user: {
          uid: data.user.uid,
          email: data.user.email,
          displayName: data.user.displayName,
          photoURL: data.user.photoURL
        },
        token: data.token
      };

      persistSession(sessionData, rememberMe);

      // Sync to MongoDB
      try {
        const mongoData = await syncUserToMongo(data.user, "local");
        storeMongoToken(mongoData.token, rememberMe);
        storeMongoUser(mongoData.user, rememberMe);
        
        // OVERWRITE the session user with the MongoDB user so the app uses the custom name/avatar
        persistSession({ token: data.token, user: mongoData.user }, rememberMe);
      } catch (syncErr) {
        console.warn("[MongoDB Sync] Warning:", syncErr.message);
      }

      setStatus({ type: "success", message: "Welcome back! Redirecting..." });
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const socialProviderLabels = {
    facebook: "Facebook",
    twitter: "Twitter",
    google: "Google",
  };

  const handleSocialLogin = async (provider) => {
    const providerLabel = socialProviderLabels[provider] || provider;
    setIsSubmitting(true);
    setStatus({ type: "info", message: `Connecting with ${providerLabel}...` });

    try {
      setOAuthRememberPreference(rememberMe);

      let result;
      switch (provider) {
        case 'google':
          result = await signInWithGoogle();
          break;
        case 'facebook':
          result = await signInWithFacebook();
          break;
        case 'twitter':
          result = await signInWithTwitter();
          break;
        default:
          throw new Error('Invalid provider');
      }

      const sessionData = {
        user: {
          uid: result.user.uid,
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL
        },
        token: result.token
      };

      persistSession(sessionData, rememberMe);

      // Sync to MongoDB
      try {
        const mongoData = await syncUserToMongo(result.user, provider);
        storeMongoToken(mongoData.token, rememberMe);
        storeMongoUser(mongoData.user, rememberMe);
        
        // OVERWRITE the session user with the MongoDB user so the app uses the custom name/avatar
        persistSession({ token: result.token, user: mongoData.user }, rememberMe);
      } catch (syncErr) {
        console.warn("[MongoDB Sync] Warning:", syncErr.message);
      }

      setStatus({ type: "success", message: "Welcome! Redirecting..." });
      setTimeout(() => navigate("/dashboard"), 600);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign In"
      description="Welcome ! Please enter your details to log in to your account"
    >
      <form className="auth-form" onSubmit={handleLogin}>
        <input
          className="auth-input"
          type="email"
          placeholder="Email Address"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          className="auth-input"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <div className="auth-meta-row">
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            Remember me
          </label>
          <Link className="auth-forgot" to="/forgot-password">
            Forgot Password
          </Link>
        </div>

        {status && <p className={`auth-status ${status.type}`}>{status.message}</p>}

        <button type="submit" className="auth-primary-btn" disabled={isSubmitting}>
          Log In
        </button>
      </form>

      <div className="auth-divider">
        <span />
        <p>or login with</p>
        <span />
      </div>

      <div className="auth-socials">
        <button
          type="button"
          className="auth-social-btn facebook"
          aria-label="Continue with Facebook"
          onClick={() => handleSocialLogin("facebook")}
          disabled={isSubmitting}
        >
          <FaFacebookF />
        </button>
        <button
          type="button"
          className="auth-social-btn twitter"
          aria-label="Continue with Twitter"
          onClick={() => handleSocialLogin("twitter")}
          disabled={isSubmitting}
        >
          <FaTwitter />
        </button>
        <button
          type="button"
          className="auth-social-btn google"
          aria-label="Continue with Google"
          onClick={() => handleSocialLogin("google")}
          disabled={isSubmitting}
        >
          <FaGoogle />
        </button>
      </div>

      <p className="auth-switch">
        Need an account? <Link to="/signup">Sign up</Link>
      </p>
    </AuthLayout>
  );
};

export default Login;