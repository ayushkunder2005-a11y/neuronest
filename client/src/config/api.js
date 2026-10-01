const API_BASE = "http://localhost:5000/api";

/**
 * Sync Firebase user to MongoDB after login/signup
 * Creates or updates user in MongoDB, returns JWT + user data
 */
export const syncUserToMongo = async (firebaseUser, provider = "local") => {
  const res = await fetch(`${API_BASE}/users/firebase-sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
      provider,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Sync failed");
  return data; // { token, user }
};

/**
 * Request password reset
 */
export const forgotPassword = async (email) => {
  const res = await fetch(`${API_BASE}/users/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

/**
 * Handle password reset directly via token
 */
export const resetPassword = async (token, newPassword) => {
  const res = await fetch(`${API_BASE}/users/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Reset failed");
  return data;
};

/**
 * Get current user profile (requires JWT)
 */
export const getMe = async () => {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Unauthorized");
  return data;
};

/**
 * Check payment subscription status
 */
export const checkPaymentStatus = async () => {
  const token = getToken();
  if (!token) throw new Error("Not authenticated");
  const res = await fetch(`${API_BASE}/payments/status`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to check status");
  return await res.json();
};

/**
 * Get stored MongoDB JWT token
 */
export const getToken = () => {
  return localStorage.getItem("mongoToken") || sessionStorage.getItem("mongoToken");
};

/**
 * Store MongoDB JWT token
 */
export const storeMongoToken = (token, remember = true) => {
  if (remember) {
    localStorage.setItem("mongoToken", token);
    sessionStorage.removeItem("mongoToken");
  } else {
    sessionStorage.setItem("mongoToken", token);
    localStorage.removeItem("mongoToken");
  }
};

/**
 * Store MongoDB user info
 */
export const storeMongoUser = (user, remember = true) => {
  const json = JSON.stringify(user);
  if (remember) {
    localStorage.setItem("mongoUser", json);
    sessionStorage.removeItem("mongoUser");
  } else {
    sessionStorage.setItem("mongoUser", json);
    localStorage.removeItem("mongoUser");
  }
};

/**
 * Get stored MongoDB user
 */
export const getMongoUser = () => {
  try {
    const raw = localStorage.getItem("mongoUser") || sessionStorage.getItem("mongoUser");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Clear MongoDB session data
 */
export const clearMongoSession = () => {
  localStorage.removeItem("mongoToken");
  localStorage.removeItem("mongoUser");
  sessionStorage.removeItem("mongoToken");
  sessionStorage.removeItem("mongoUser");
};
