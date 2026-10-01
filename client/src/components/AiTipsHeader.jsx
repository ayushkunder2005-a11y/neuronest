import BrainStatusBadge from "./BrainStatusBadge";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

const formatUserType = (value) => value.charAt(0).toUpperCase() + value.slice(1);

export default function AiTipsHeader({ currentMode, userType, brainStatus }) {
  return (
    <header className="tips-hero">
      <div>
        <p className="eyebrow">AI Tips</p>
        <h1>
          {getGreeting()}, {formatUserType(userType)}
        </h1>
        <p>Mode: {formatUserType(currentMode)}</p>
      </div>
      <BrainStatusBadge status={brainStatus} />
    </header>
  );
}
