import generateToken from "./generateToken.js";

export const serializeUser = (userDoc) => {
  if (!userDoc) return null;
  return {
    _id: userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
    provider: userDoc.provider,
    avatar: userDoc.avatar,
    createdAt: userDoc.createdAt,
    updatedAt: userDoc.updatedAt,
  };
};

export const buildAuthResponse = (userDoc) => {
  return {
    token: generateToken(userDoc._id),
    user: serializeUser(userDoc),
  };
};

export default buildAuthResponse;
