// src/pages/Signup.jsx
import { useState } from "react";
import { FaFacebookF, FaGoogle, FaTwitter } from "react-icons/fa";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { syncUserToMongo, storeMongoToken, storeMongoUser } from "../config/api";
import {
  signInWithFacebook,
  signInWithGoogle,
  signInWithTwitter,
  signupWithEmail
} from "../config/firebase";
import { persistSession, setOAuthRememberPreference } from "../utils/session";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(true);
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (event) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    if (!agree) {
      setStatus({ type: "error", message: "Please accept the terms to continue." });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "info", message: "Creating your account..." });
      
      // Firebase email/password signup
      const data = await signupWithEmail(email, password, name);
      
      const sessionData = {
        user: {
          uid: data.user.uid,
          email: data.user.email,
          displayName: name,
          photoURL: data.user.photoURL
        },
        token: data.token
      };
      
      persistSession(sessionData, true);

      // Sync to MongoDB
      try {
        const mongoData = await syncUserToMongo(
          { uid: data.user.uid, email: data.user.email, displayName: name, photoURL: data.user.photoURL },
          "local"
        );
        storeMongoToken(mongoData.token, true);
        storeMongoUser(mongoData.user, true);
        
        // OVERWRITE the session user with the MongoDB user so the app uses the custom name/avatar
        persistSession({ token: data.token, user: mongoData.user }, true);
      } catch (syncErr) {
        console.warn("[MongoDB Sync] Warning:", syncErr.message);
      }

      setStatus({ type: "success", message: "Account ready! Redirecting..." });
      setTimeout(() => navigate("/dashboard"), 700);
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

  const handleSocialSignup = async (provider) => {
    const providerLabel = socialProviderLabels[provider] || provider;
    setIsSubmitting(true);
    setStatus({ type: "info", message: `Connecting with ${providerLabel}...` });
    
    try {
      setOAuthRememberPreference(true);
      
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

      persistSession(sessionData, true);

      // Sync to MongoDB
      try {
        const mongoData = await syncUserToMongo(result.user, provider);
        storeMongoToken(mongoData.token, true);
        storeMongoUser(mongoData.user, true);
        
        // OVERWRITE the session user with the MongoDB user so the app uses the custom name/avatar
        persistSession({ token: result.token, user: mongoData.user }, true);
      } catch (syncErr) {
        console.warn("[MongoDB Sync] Warning:", syncErr.message);
      }

      setStatus({ type: "success", message: "Account created! Redirecting..." });
      setTimeout(() => navigate("/dashboard"), 700);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Join NeuroNest"
      description="Create your workspace account in a few seconds and keep learning without missing a beat."
    >
      <form className="auth-form" onSubmit={handleSignup}>
        <input
          className="auth-input"
          type="text"
          placeholder="Full Name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <input
          className="auth-input"
          type="password"
          placeholder="Confirm Password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

        <div className="auth-meta-row align-start">
          <label className="auth-checkbox">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I agree to the Terms & Privacy Policy
          </label>
        </div>

        {status && <p className={`auth-status ${status.type}`}>{status.message}</p>}

        <button type="submit" className="auth-primary-btn" disabled={isSubmitting}>
          Create Account
        </button>
      </form>

      <div className="auth-divider">
        <span />
        <p>or sign up with</p>
        <span />
      </div>

      <div className="auth-socials">
        <button
          type="button"
          className="auth-social-btn facebook"
          aria-label="Continue with Facebook"
          onClick={() => handleSocialSignup("facebook")}
          disabled={isSubmitting}
        >
          <FaFacebookF />
        </button>
        <button
          type="button"
          className="auth-social-btn twitter"
          aria-label="Continue with Twitter"
          onClick={() => handleSocialSignup("twitter")}
          disabled={isSubmitting}
        >
          <FaTwitter />
        </button>
        <button
          type="button"
          className="auth-social-btn google"
          aria-label="Continue with Google"
          onClick={() => handleSocialSignup("google")}
          disabled={isSubmitting}
        >
          <FaGoogle />
        </button>
      </div>

      <p className="auth-switch">
        Already have an account? <Link to="/">Sign in</Link>
      </p>
    </AuthLayout>
  );
};

export default Signup;