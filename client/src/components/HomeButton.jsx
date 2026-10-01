import { useLocation, useNavigate } from "react-router-dom";
import "../styles/homeButton.css";

// Pages where the Home button should NOT be shown
const AUTH_PAGES = ["/", "/signup", "/login", "/forgot-password"];

export default function HomeButton() {
  const location = useLocation();
  const navigate = useNavigate();

  // Don't show on auth pages
  if (AUTH_PAGES.includes(location.pathname)) {
    return null;
  }

  const isOnDashboard = location.pathname === "/dashboard";

  const handleClick = () => {
    if (!isOnDashboard) {
      navigate("/dashboard");
    }
  };

  return (
    <button
      type="button"
      className={`home-floating-btn ${isOnDashboard ? "home-floating-btn--disabled" : ""}`}
      onClick={handleClick}
      aria-label="Go to dashboard"
    >
      Home
    </button>
  );
}
