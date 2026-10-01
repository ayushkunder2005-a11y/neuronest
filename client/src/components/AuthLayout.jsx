import "../styles/auth.css";
import AuthIllustration from "./AuthIllustration";

const AuthLayout = ({ title, description, children }) => {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-illustration-panel">
          <div className="auth-illustration-wrapper">
            <AuthIllustration />
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-inner">
            <h1 className="auth-title">{title}</h1>
            <p className="auth-subtitle">{description}</p>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
