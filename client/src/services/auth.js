import api from "./api";
import { clearMongoSession } from "../config/api";

export const SUPPORTED_SOCIAL_PROVIDERS = {
  google: "Google",
  facebook: "Facebook",
  twitter: "Twitter",
};

const API_BASE = (api.defaults?.baseURL || "http://localhost:5000/api").replace(/\/$/, "");

export async function login(email, password) {
  const res = await api.post("/users/login", { email, password });
  return res.data;
}

export async function signup(name, email, password) {
  const res = await api.post("/users/register", { name, email, password });
  return res.data;
}

export function startSocialLogin(provider) {
  if (!SUPPORTED_SOCIAL_PROVIDERS[provider]) {
    throw new Error("Unsupported social provider");
  }
  const redirectUrl = `${API_BASE}/users/auth/${provider}`;
  window.location.assign(redirectUrl);
}

export function logout() {
  localStorage.removeItem("token");
  sessionStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.removeItem("user");
  localStorage.removeItem("nn-aittutor-paid");
  clearMongoSession();
}
