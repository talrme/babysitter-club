import {
    signInWithPopup,
    signOut,
    onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
    doc,
    getDoc,
    serverTimestamp,
    setDoc,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import {
    auth,
    createGoogleProvider,
    db,
    missingConfig,
} from './firebase.js';

const setupHint = document.getElementById('setup-hint');
const setupGuide = document.getElementById('setup-guide');
const authStatus = document.getElementById('auth-status');
const btnSignIn = document.getElementById('btn-sign-in');
const btnSignOut = document.getElementById('btn-sign-out');
const signedInPanel = document.getElementById('signed-in-panel');
const userLabel = document.getElementById('user-label');

function setAuthLoading(text) {
    authStatus.textContent = text;
    btnSignIn.hidden = true;
    btnSignOut.hidden = true;
}

function showSignedOut() {
    authStatus.textContent = '';
    btnSignIn.hidden = missingConfig;
    btnSignOut.hidden = true;
    signedInPanel.hidden = true;
}

function showSignedIn(user, options = {}) {
    const { preserveStatus = false } = options;
    const name = user.displayName || user.email || user.uid;
    if (!preserveStatus) {
        authStatus.textContent = '';
    }
    btnSignIn.hidden = true;
    btnSignOut.hidden = false;
    userLabel.textContent = name;
    signedInPanel.hidden = false;
}

function getAuthErrorMessage(err) {
    switch (err.code) {
        case 'auth/popup-closed-by-user':
            return 'Sign-in cancelled.';
        case 'auth/popup-blocked':
            return 'Popup blocked. Allow popups for this site and try again.';
        case 'auth/unauthorized-domain':
            return 'This domain is not authorized in Firebase Auth. Add it under Authentication > Settings > Authorized domains.';
        case 'auth/operation-not-allowed':
            return 'Google sign-in is not enabled. Turn it on in Authentication > Sign-in method.';
        default:
            return `Sign-in failed: ${err.message}`;
    }
}

async function ensureUserProfile(user) {
    if (!db) {
        return;
    }

    const userRef = doc(db, 'users', user.uid);
    const existing = await getDoc(userRef);

    if (existing.exists()) {
        await setDoc(userRef, {
            displayName: user.displayName || '',
            email: user.email || '',
            photoURL: user.photoURL || '',
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, { merge: true });
        return;
    }

    await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName || '',
        email: user.email || '',
        photoURL: user.photoURL || '',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        notificationPreference: 'instant',
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (missingConfig) {
        setupHint.hidden = false;
        setupGuide.hidden = false;
        showSignedOut();
        return;
    }

    const provider = createGoogleProvider();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            let profileSyncFailed = false;
            try {
                await ensureUserProfile(user);
            } catch (err) {
                console.error('Failed to sync user profile:', err);
                authStatus.textContent = 'Signed in, but profile sync failed. Please refresh.';
                profileSyncFailed = true;
            }
            showSignedIn(user, { preserveStatus: profileSyncFailed });
        } else {
            showSignedOut();
        }
    });

    btnSignIn.addEventListener('click', async () => {
        setAuthLoading('Signing in…');
        try {
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error(err);
            authStatus.textContent = getAuthErrorMessage(err);
            if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/operation-not-allowed') {
                setupGuide.hidden = false;
            }
            btnSignIn.hidden = false;
        }
    });

    btnSignOut.addEventListener('click', async () => {
        setAuthLoading('Signing out…');
        try {
            await signOut(auth);
        } catch (err) {
            console.error(err);
            authStatus.textContent = `Sign-out failed: ${err.message}`;
        }
    });
});
