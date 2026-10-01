import { buildAuthResponse } from "../utils/userResponse.js";

const CLIENT_APP_URL = process.env.CLIENT_APP_URL || "http://localhost:3000";
export const SOCIAL_SUCCESS_REDIRECT =
  process.env.SOCIAL_SUCCESS_REDIRECT || `${CLIENT_APP_URL}/auth/callback`;

const encodeUserPayload = (user) =>
  Buffer.from(JSON.stringify(user), "utf8").toString("base64");

const redirectWithMessage = (res, message) => {
  const redirectUrl = new URL(SOCIAL_SUCCESS_REDIRECT);
  if (message) {
    redirectUrl.searchParams.set("error", message);
  }
  return res.redirect(redirectUrl.toString());
};

export const socialAuthSuccess = (req, res) => {
  if (!req.user) {
    return redirectWithMessage(res, "Unable to complete sign in.");
  }
  const payload = buildAuthResponse(req.user);
  const redirectUrl = new URL(SOCIAL_SUCCESS_REDIRECT);
  redirectUrl.searchParams.set("token", payload.token);
  redirectUrl.searchParams.set("user", encodeUserPayload(payload.user));
  return res.redirect(redirectUrl.toString());
};

export const socialAuthFailure = (res, message) =>
  redirectWithMessage(res, message || "Authentication failed.");

export const getSocialSuccessRedirect = () => SOCIAL_SUCCESS_REDIRECT;

export default socialAuthSuccess;
