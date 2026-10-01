// src/config/firebase.js
import { initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  FacebookAuthProvider,
  signOut as firebaseSignOut,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  TwitterAuthProvider,
  sendPasswordResetEmail
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBwqfV-hU5jqEPD3rM6KSGiaaNE9CfTpCY",
  authDomain: "neuronest-20b24.firebaseapp.com",
  projectId: "neuronest-20b24",
  storageBucket: "neuronest-20b24.firebasestorage.app",
  messagingSenderId: "719614430660",
  appId: "1:719614430660:web:c7e04c2c6a2b8c2517e891"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Provider instances
const googleProvider = new GoogleAuthProvider();
const facebookProvider = new FacebookAuthProvider();
const twitterProvider = new TwitterAuthProvider();

// Email/Password Authentication
export const signupWithEmail = async (email, password, name) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // You can update the user's profile with their name
    // await updateProfile(userCredential.user, { displayName: name });
    return {
      user: userCredential.user,
      token: await userCredential.user.getIdToken()
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return {
      user: userCredential.user,
      token: await userCredential.user.getIdToken()
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// Social Authentication
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return {
      user: result.user,
      token: await result.user.getIdToken()
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const signInWithFacebook = async () => {
  try {
    const result = await signInWithPopup(auth, facebookProvider);
    return {
      user: result.user,
      token: await result.user.getIdToken()
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

export const signInWithTwitter = async () => {
  try {
    const result = await signInWithPopup(auth, twitterProvider);
    return {
      user: result.user,
      token: await result.user.getIdToken()
    };
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};

// Sign out
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    throw new Error("Failed to sign out");
  }
};

// Password Reset
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return true;
  } catch (error) {
    throw new Error(getErrorMessage(error));
  }
};


// Helper function to get user-friendly error messages
const getErrorMessage = (error) => {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'This email is already registered. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Invalid email address.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled. Please contact support.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/user-not-found':
      return 'No account found with this email.';
    case 'auth/wrong-password':
      return 'Incorrect password.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing.';
    case 'auth/cancelled-popup-request':
      return 'Sign-in was cancelled.';
    case 'auth/popup-blocked':
      return 'Pop-up was blocked by your browser. Please allow pop-ups for this site.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with the same email but different sign-in credentials.';
    default:
      return error.message || 'An error occurred during authentication.';
  }
};