import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
// Using project configuration without service account for simple verification
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'neuronest-20b24'
    });
}

/**
 * Firebase Auth Middleware
 * Verifies Firebase ID tokens from the Authorization header
 */
export const firebaseAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            // Verify the Firebase ID token
            const decodedToken = await admin.auth().verifyIdToken(token);

            // Attach user info to request
            req.user = {
                uid: decodedToken.uid,
                email: decodedToken.email,
                name: decodedToken.name || decodedToken.email?.split('@')[0],
                picture: decodedToken.picture
            };

            next();
        } catch (err) {
            console.error('[Firebase Auth] Token verification failed:', err.message);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

export default firebaseAuth;
