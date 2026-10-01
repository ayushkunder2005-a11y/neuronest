import { createContext, useContext, useMemo, useState } from "react";

const UserContext = createContext(null);

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUserContext must be used within UserContextProvider");
  }
  return context;
};

const DEFAULT_PATTERNS = {
  focusBlocks: 3,
  lastBreakMinutes: 42,
  interruptions: 2,
  focusStreak: 4,
  dailyStudyMinutes: 120,
};

export default function UserContextProvider({ children }) {
  const [userType] = useState("student");
  const [currentMode, setCurrentMode] = useState("study");

  const usagePatterns = useMemo(() => ({ ...DEFAULT_PATTERNS }), []);

  const value = useMemo(
    () => ({
      userType,
      currentMode,
      setCurrentMode,
      usagePatterns,
    }),
    [currentMode, usagePatterns, userType]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}
