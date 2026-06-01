import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signOut,
    onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import { firebaseConfig } from './firebase-config.js';

const missingConfig = typeof firebaseConfig?.apiKey !== 'string' || firebaseConfig.apiKey.length === 0;

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

function showSignedIn(user) {
    const name = user.displayName || user.email || user.uid;
    authStatus.textContent = '';
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

document.addEventListener('DOMContentLoaded', () => {
    if (missingConfig) {
        setupHint.hidden = false;
        setupGuide.hidden = false;
        showSignedOut();
        return;
    }

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    onAuthStateChanged(auth, (user) => {
        if (user) {
            showSignedIn(user);
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
