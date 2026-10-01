import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as TwitterStrategy } from "passport-twitter";
import User from "../models/User.js";

const SERVER_PUBLIC_URL =
  process.env.SERVER_PUBLIC_URL || `http://localhost:${process.env.PORT || 5000}`;
const SOCIAL_CALLBACK_BASE =
  process.env.SOCIAL_CALLBACK_BASE || `${SERVER_PUBLIC_URL}/api/users/auth`;

const normalizeEmail = (rawEmail) => rawEmail?.toLowerCase();

const deriveDisplayName = (profile) => {
  if (profile?.displayName) return profile.displayName;
  const given = profile?.name?.givenName || "";
  const family = profile?.name?.familyName || "";
  const joined = `${given} ${family}`.trim();
  return joined || undefined;
};

const upsertOAuthUser = async ({ provider, providerId, email, name, avatar }) => {
  if (!email) {
    throw new Error(
      `${provider} did not provide an email address. Ensure the scope includes email access.`
    );
  }

  let user = await User.findOne({ provider, providerId });
  if (!user) {
    user = await User.findOne({ email });
  }

  if (user) {
    user.provider = provider;
    user.providerId = providerId;
    if (avatar && user.avatar !== avatar) {
      user.avatar = avatar;
    }
    if (name && user.name !== name) {
      user.name = name;
    }
    await user.save();
    return user;
  }

  return User.create({
    name: name || email.split("@")[0],
    email,
    avatar,
    provider,
    providerId,
  });
};

const withStrategy = (name, factory) => {
  try {
    const strategy = factory();
    if (strategy) {
      passport.use(name, strategy);
      console.log(`[Auth] ${name} strategy initialised`);
    }
  } catch (err) {
    console.warn(`[Auth] Failed to configure ${name}:`, err.message);
  }
};

export const configurePassport = () => {
  withStrategy("google", () => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.warn("[Auth] GOOGLE_CLIENT_ID/SECRET not set. Google login disabled.");
      return null;
    }
    return new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL || `${SOCIAL_CALLBACK_BASE}/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await upsertOAuthUser({
            provider: "google",
            providerId: profile.id,
            email: normalizeEmail(profile.emails?.[0]?.value),
            name: deriveDisplayName(profile),
            avatar: profile.photos?.[0]?.value,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    );
  });

  withStrategy("facebook", () => {
    if (!process.env.FACEBOOK_CLIENT_ID || !process.env.FACEBOOK_CLIENT_SECRET) {
      console.warn("[Auth] FACEBOOK_CLIENT_ID/SECRET not set. Facebook login disabled.");
      return null;
    }
    return new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackURL:
          process.env.FACEBOOK_CALLBACK_URL || `${SOCIAL_CALLBACK_BASE}/facebook/callback`,
        profileFields: ["id", "displayName", "photos", "email"],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const user = await upsertOAuthUser({
            provider: "facebook",
            providerId: profile.id,
            email: normalizeEmail(profile.emails?.[0]?.value),
            name: deriveDisplayName(profile),
            avatar: profile.photos?.[0]?.value,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    );
  });

  withStrategy("twitter", () => {
    const consumerKey =
      process.env.TWITTER_CONSUMER_KEY ||
      process.env.TWITTER_CLIENT_ID ||
      process.env.TWITTER_API_KEY;
    const consumerSecret =
      process.env.TWITTER_CONSUMER_SECRET ||
      process.env.TWITTER_CLIENT_SECRET ||
      process.env.TWITTER_API_SECRET;

    if (!consumerKey || !consumerSecret) {
      console.warn("[Auth] Twitter keys not set. Twitter login disabled.");
      return null;
    }

    return new TwitterStrategy(
      {
        consumerKey,
        consumerSecret,
        callbackURL:
          process.env.TWITTER_CALLBACK_URL || `${SOCIAL_CALLBACK_BASE}/twitter/callback`,
        includeEmail: true,
      },
      async (_token, _tokenSecret, profile, done) => {
        try {
          const user = await upsertOAuthUser({
            provider: "twitter",
            providerId: profile.id,
            email: normalizeEmail(profile.emails?.[0]?.value),
            name: deriveDisplayName(profile) || profile.username,
            avatar: profile.photos?.[0]?.value,
          });
          done(null, user);
        } catch (err) {
          done(err);
        }
      }
    );
  });

  return passport;
};

export default configurePassport;
