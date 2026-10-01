const hasWindow = () => typeof window !== "undefined";
const getStoragePair = (remember) => {
  if (!hasWindow()) return [null, null];
  return remember ? [window.localStorage, window.sessionStorage] : [window.sessionStorage, window.localStorage];
};

export const persistSession = (payload, remember = true) => {
  if (!payload || !hasWindow()) return;
  const [primary, secondary] = getStoragePair(remember);
  if (!primary || !secondary) return;

  if (payload.token) {
    primary.setItem("token", payload.token);
    secondary.removeItem("token");
  }
  if (payload.user) {
    primary.setItem("user", JSON.stringify(payload.user));
    secondary.removeItem("user");
  }
};

const OAUTH_REMEMBER_KEY = "oauthRememberMe";

export const setOAuthRememberPreference = (remember) => {
  if (!hasWindow()) return;
  sessionStorage.setItem(OAUTH_REMEMBER_KEY, remember ? "local" : "session");
};

export const consumeOAuthRememberPreference = () => {
  if (!hasWindow()) return true;
  const value = sessionStorage.getItem(OAUTH_REMEMBER_KEY);
  sessionStorage.removeItem(OAUTH_REMEMBER_KEY);
  return value !== "session";
};
