import {
    onAuthStateChanged,
    signInWithPopup,
    signOut,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
    arrayRemove,
    arrayUnion,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    addDoc,
    writeBatch,
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

const signedInSections = [
    document.getElementById('app-nav'),
    document.getElementById('my-requests'),
    document.getElementById('upcoming-babysits'),
    document.getElementById('club-requests'),
    document.getElementById('my-club'),
    document.getElementById('my-household'),
].filter(Boolean);

const myRequestsList = document.getElementById('my-requests-list');
const othersRequestsList = document.getElementById('others-requests-list');
const btnToggleMyOld = document.getElementById('btn-toggle-my-old');
const upcomingList = document.getElementById('upcoming-list');
const upcomingEmpty = document.getElementById('upcoming-empty');
const clubMembersList = document.getElementById('club-members-list');
const clubInvitesNote = document.getElementById('club-invites-note');
const outgoingClubInvites = document.getElementById('outgoing-club-invites');
const incomingClubInvites = document.getElementById('incoming-club-invites');
const incomingHouseholdInvites = document.getElementById('incoming-household-invites');
const outgoingInvitesHeading = document.getElementById('outgoing-invites-heading');
const incomingInvitesHeading = document.getElementById('incoming-invites-heading');
const householdStatus = document.getElementById('household-status');
const btnHouseholdAction = document.getElementById('btn-household-action');
const btnRemovePartner = document.getElementById('btn-remove-partner');
const navAdmin = document.getElementById('nav-admin');
const adminSection = document.getElementById('admin-view');
const adminUsersList = document.getElementById('admin-users-list');
const btnViewAs = document.getElementById('btn-view-as');
const viewAsModal = document.getElementById('view-as-modal');
const viewAsList = document.getElementById('view-as-list');
const viewAsBanner = document.getElementById('view-as-banner');
const viewAsName = document.getElementById('view-as-name');
const btnExitViewAs = document.getElementById('btn-exit-view-as');

const btnNewRequest = document.getElementById('btn-new-request');
const btnAddPeople = document.getElementById('btn-add-people');
const inviteLinkInput = document.getElementById('invite-link-input');
const btnCopyInviteLink = document.getElementById('btn-copy-invite-link');
const requestModal = document.getElementById('request-modal');
const requestModalTitle = document.getElementById('request-modal-title');
const requestModalMeta = document.getElementById('request-modal-meta');
const requestModalDetails = document.getElementById('request-modal-details');
const requestModalOrNote = document.getElementById('request-modal-or-note');
const requestModalGroup = document.getElementById('request-modal-group');
const btnRequestPrimary = document.getElementById('btn-request-primary');
const btnRequestSecondary = document.getElementById('btn-request-secondary');
const btnRequestTertiary = document.getElementById('btn-request-tertiary');
const requestFormModal = document.getElementById('request-form-modal');
const requestForm = document.getElementById('request-form');
const requestFormTitle = document.getElementById('request-form-title');
const requestFormId = document.getElementById('request-form-id');
const dateRowsList = document.getElementById('date-rows');
const btnAddOrDate = document.getElementById('btn-add-or-date');
const requestFormDetails = document.getElementById('request-form-details');
const requestFormAudience = document.getElementById('request-form-audience');
const requestFormAudienceList = document.getElementById('request-form-audience-list');
const btnRequestSubmit = document.getElementById('btn-request-submit');
const btnRequestDelete = document.getElementById('btn-request-delete');
const addPeopleModal = document.getElementById('add-people-modal');
const addPeopleList = document.getElementById('add-people-list');
const householdModal = document.getElementById('household-modal');
const householdCandidateList = document.getElementById('household-candidate-list');
const removeClubModal = document.getElementById('remove-club-modal');
const btnConfirmRemoveClub = document.getElementById('btn-confirm-remove-club');

// Households assignable to the request currently open in the form (for manual fill).
let currentFormAssignable = [];
const assignRequestModal = document.getElementById('assign-request-modal');
const assignRequestForm = document.getElementById('assign-request-form');
const assignRequestId = document.getElementById('assign-request-id');
const assignRequestUser = document.getElementById('assign-request-user');

const state = {
    currentUser: null,
    currentProfile: null,
    users: [],
    requests: [],
    outgoingClubInvites: [],
    clubInvites: [],
    householdInvites: [],
    showOldMine: false,
    pendingClubRemovalUids: [],
    isAdmin: false,
    adminUids: [],
    activeRequestModalId: null,
    viewAsUid: null,
};

// "View as" lets an admin preview the app exactly as another member sees it.
// It only changes the identity the render layer reads from — all writes are
// blocked while active (see isViewingAs guards).
function isViewingAs() {
    return Boolean(state.viewAsUid && state.viewAsUid !== state.currentUser?.uid);
}

function effectiveUid() {
    return isViewingAs() ? state.viewAsUid : state.currentUser?.uid;
}

function effectiveProfile() {
    if (isViewingAs()) {
        return state.users.find((user) => user.uid === state.viewAsUid) || null;
    }
    return state.currentProfile;
}

// Returns true (and surfaces a message) when a write should be blocked because
// we're in a read-only "View as" preview. Buttons stay visible so the preview
// is faithful, but clicking them does nothing but explain why.
function blockedByViewAs() {
    if (!isViewingAs()) {
        return false;
    }
    authStatus.textContent = 'Read-only preview — exit "View as" to make changes.';
    return true;
}

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
    signedInSections.forEach((section) => {
        section.hidden = true;
    });
    if (navAdmin) {
        navAdmin.hidden = true;
    }
    if (adminSection) {
        adminSection.hidden = true;
    }
}

function showSignedIn(user, options = {}) {
    const { preserveStatus = false } = options;
    const name = user.displayName || user.email || user.uid;
    if (!preserveStatus) {
        authStatus.textContent = '';
    }
    btnSignIn.hidden = true;
    btnSignOut.hidden = false;
    userLabel.textContent = user.email && user.email !== name ? `${name} (${user.email})` : name;
    signedInPanel.hidden = false;
    signedInSections.forEach((section) => {
        section.hidden = false;
    });
    if (navAdmin) {
        navAdmin.hidden = !state.isAdmin;
    }
    if (adminSection) {
        adminSection.hidden = !state.isAdmin;
    }
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
        clubMemberUids: [],
        householdPartnerUid: null,
    });
}

async function ensureAdminAccess(user) {
    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
    const isAdmin = adminDoc.exists();
    await setDoc(doc(db, 'users', user.uid), { isAdmin, updatedAt: serverTimestamp() }, { merge: true });
    return isAdmin;
}

function formatDateTime(value) {
    if (!value) {
        return 'No date set';
    }
    const date = new Date(value);
    return date.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatDateTimeLong(value) {
    if (!value) {
        return 'No date set';
    }
    const date = new Date(value);
    return date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function firstName(name) {
    return (name || '').trim().split(' ')[0] || 'Friend';
}

function openModal(modalEl) {
    if (modalEl) {
        modalEl.hidden = false;
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.hidden = true;
    }
    if (modalId === 'remove-club-modal') {
        state.pendingClubRemovalUids = [];
    }
}

function userMap() {
    return new Map(state.users.map((user) => [user.uid, user]));
}

// Household = the current user plus their linked partner. Once linked, the two
// are treated as a single actor: shared boards, shared ownership, one item in
// lists. Households are capped at two people, so we derive them from the
// householdPartnerUid pointer rather than a separate collection.
function myHouseholdUids() {
    const uids = new Set([effectiveUid()]);
    const partnerUid = effectiveProfile()?.householdPartnerUid;
    if (partnerUid) {
        uids.add(partnerUid);
    }
    return uids;
}

function isMine(uid) {
    if (!uid) {
        return false;
    }
    return myHouseholdUids().has(uid);
}

function householdDisplayName(uid, usersByUid = userMap()) {
    const user = usersByUid.get(uid);
    if (!user) {
        return 'Unknown';
    }
    const partner = user.householdPartnerUid ? usersByUid.get(user.householdPartnerUid) : null;
    if (partner) {
        return `${firstName(user.displayName)} & ${firstName(partner.displayName)}`;
    }
    return user.displayName || user.email || 'Unknown';
}

// Collapses a flat list of uids into household groups, so pickers can show one
// item per household. Each group exposes all member uids (for visibility), a
// primaryUid (the value we store when a single field can only hold one uid),
// and a combined label.
function groupUidsByHousehold(uids, usersByUid = userMap()) {
    const list = Array.isArray(uids) ? uids : [...uids];
    const present = new Set(list);
    const seen = new Set();
    const groups = [];
    list.forEach((uid) => {
        if (seen.has(uid)) {
            return;
        }
        seen.add(uid);
        const user = usersByUid.get(uid);
        if (!user) {
            return;
        }
        const groupUids = [uid];
        const partnerUid = user.householdPartnerUid;
        if (partnerUid && present.has(partnerUid) && !seen.has(partnerUid)) {
            groupUids.push(partnerUid);
            seen.add(partnerUid);
        }
        groups.push({
            uids: groupUids,
            primaryUid: uid,
            label: householdDisplayName(uid, usersByUid),
        });
    });
    return groups.sort((a, b) => a.label.localeCompare(b.label));
}

function statusLabel(status) {
    switch (status) {
        case 'accepted':
            return 'Filled';
        case 'completed':
            return 'Done';
        case 'superseded':
            return 'Filled (other date)';
        case 'closed':
            return 'Closed';
        default:
            return 'Open';
    }
}

function requestVisibleToCurrentUser(request) {
    if (!request || isMine(request.createdByUid)) {
        return true;
    }
    if (request.visibility === 'subset') {
        return (request.visibilityUids || []).includes(effectiveUid());
    }
    const clubSet = new Set(effectiveProfile()?.clubMemberUids || []);
    return clubSet.has(request.createdByUid);
}

function byRequestDateAsc(a, b) {
    const aTime = a.whenISO ? new Date(a.whenISO).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.whenISO ? new Date(b.whenISO).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
}

function hashString(input) {
    let hash = 0;
    const text = String(input || '');
    for (let i = 0; i < text.length; i += 1) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getOrGroupColor(groupId) {
    const palette = [
        { border: '#2563eb', bg: '#eff6ff', text: '#1d4ed8' }, // blue
        { border: '#7c3aed', bg: '#f5f3ff', text: '#6d28d9' }, // violet
        { border: '#f97316', bg: '#fff7ed', text: '#c2410c' }, // orange
        { border: '#059669', bg: '#ecfdf5', text: '#047857' }, // emerald
        { border: '#db2777', bg: '#fdf2f8', text: '#be185d' }, // pink
    ];
    const index = hashString(groupId) % palette.length;
    return palette[index];
}

function clearOrGroupHover() {
    document.querySelectorAll('.request-row.or-linked-highlight').forEach((row) => {
        row.classList.remove('or-linked-highlight', 'or-linked-source', 'or-linked-other', 'show-or-popup');
    });
}

function highlightOrGroup(groupId, sourceRow) {
    clearOrGroupHover();
    if (!groupId) {
        return;
    }
    const rows = document.querySelectorAll(`.request-row[data-group-id="${groupId}"]`);
    rows.forEach((row) => {
        row.classList.add('or-linked-highlight');
        if (row === sourceRow) {
            row.classList.add('or-linked-source', 'show-or-popup');
        } else {
            row.classList.add('or-linked-other');
        }
    });
}

async function loadAppData() {
    const [currentProfileSnap, outgoingClubInvitesSnap, clubInvitesSnap, householdInvitesSnap] = await Promise.all([
        getDoc(doc(db, 'users', state.currentUser.uid)),
        getDocs(query(collection(db, 'clubInvites'), where('fromUid', '==', state.currentUser.uid), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'clubInvites'), where('toUid', '==', state.currentUser.uid), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'householdInvites'), where('toUid', '==', state.currentUser.uid), where('status', '==', 'pending'))),
    ]);

    state.outgoingClubInvites = outgoingClubInvitesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    state.clubInvites = clubInvitesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    state.householdInvites = householdInvitesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    state.currentProfile = currentProfileSnap.exists() ? { id: currentProfileSnap.id, ...currentProfileSnap.data() } : null;

    if (state.isAdmin) {
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            state.users = usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        } catch (err) {
            console.error('Admin users query failed:', err);
            state.users = [];
            authStatus.textContent = 'Admin mode: could not load full user list.';
        }

        try {
            const requestsSnap = await getDocs(query(collection(db, 'requests'), orderBy('createdAt', 'desc')));
            state.requests = requestsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        } catch (err) {
            console.error('Admin requests query failed:', err);
            state.requests = [];
        }

        try {
            const adminsSnap = await getDocs(collection(db, 'admins'));
            state.adminUids = adminsSnap.docs.map((docSnap) => docSnap.id);
        } catch (err) {
            console.error('Admin list query failed:', err);
            state.adminUids = [];
        }
        return;
    }

    const ownUid = state.currentUser.uid;
    const clubUids = [...new Set(state.currentProfile?.clubMemberUids || [])];
    const requestQueries = [
        getDocs(query(collection(db, 'requests'), where('createdByUid', '==', ownUid))),
        getDocs(query(collection(db, 'requests'), where('acceptedByUid', '==', ownUid))),
        ...clubUids.map((uid) => (
            getDocs(query(collection(db, 'requests'), where('createdByUid', '==', uid)))
        )),
    ];
    const requestSnaps = await Promise.all(requestQueries);
    const requestMap = new Map();
    requestSnaps.forEach((snap) => {
        snap.docs.forEach((docSnap) => {
            requestMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() });
        });
    });
    state.requests = [...requestMap.values()].sort((a, b) => {
        const aTs = a.createdAt?.seconds || 0;
        const bTs = b.createdAt?.seconds || 0;
        return bTs - aTs;
    });

    const visibleUids = new Set([state.currentUser.uid]);
    (state.currentProfile?.clubMemberUids || []).forEach((uid) => visibleUids.add(uid));
    if (state.currentProfile?.householdPartnerUid) {
        visibleUids.add(state.currentProfile.householdPartnerUid);
    }
    state.requests.forEach((request) => {
        if (request.createdByUid) {
            visibleUids.add(request.createdByUid);
        }
        if (request.acceptedByUid) {
            visibleUids.add(request.acceptedByUid);
        }
    });
    state.outgoingClubInvites.forEach((invite) => {
        visibleUids.add(invite.toUid);
    });
    state.clubInvites.forEach((invite) => {
        visibleUids.add(invite.fromUid);
    });
    state.householdInvites.forEach((invite) => {
        visibleUids.add(invite.fromUid);
    });

    // Everyone signed in can see everyone in the system so they can add each
    // other to their clubs. Fall back to a scoped fetch if the broad read fails.
    try {
        const usersSnap = await getDocs(collection(db, 'users'));
        state.users = usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    } catch (err) {
        console.warn('Full user list query failed, falling back to scoped fetch:', err?.code || err);
        const userDocs = await Promise.all(
            [...visibleUids].map(async (uid) => {
                try {
                    const snap = await getDoc(doc(db, 'users', uid));
                    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
                } catch (innerErr) {
                    console.warn('Skipping user doc fetch due to permission or missing access:', uid, innerErr?.code || innerErr);
                    return null;
                }
            }),
        );
        state.users = userDocs.filter(Boolean);
    }
    state.adminUids = state.isAdmin ? state.adminUids : [];
    if (!state.currentProfile) {
        state.currentProfile = state.users.find((user) => user.uid === state.currentUser.uid) || null;
    }
}

function truncateText(text, max = 90) {
    const value = (text || '').trim();
    if (!value) {
        return '';
    }
    return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

// "Babysitter: Name" for a single sitter, "Babysitters: A and B" for a household.
function babysitterLine(request, usersByUid = userMap()) {
    if (request.acceptedOther) {
        return `Babysitter: ${request.acceptedByName || 'Someone else'}`;
    }
    if (!request.acceptedByUid) {
        return '';
    }
    const user = usersByUid.get(request.acceptedByUid);
    if (!user) {
        return 'Babysitter: Unknown';
    }
    const partner = user.householdPartnerUid ? usersByUid.get(user.householdPartnerUid) : null;
    if (partner) {
        return `Babysitters: ${firstName(user.displayName)} and ${firstName(partner.displayName)}`;
    }
    return `Babysitter: ${user.displayName || user.email || 'Unknown'}`;
}

function makeLine(text, className) {
    const el = document.createElement('p');
    el.className = className;
    el.textContent = text;
    return el;
}

// context: 'mine' (requester's page) leads with the date, then details, then the
// booked sitter. 'others' leads with the requester's name, then date + details.
function makeRequestRow(request, usersByUid, context = 'others') {
    const isMineRow = context === 'mine';
    const status = request.status || 'open';
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'request-row';
    // Upcoming commitments stay neutral (no green "accepted" styling).
    if (context !== 'upcoming') {
        row.classList.add(`status-${status}`);
    }
    row.classList.add(isMineRow ? 'request-row-mine' : 'request-row-others');
    // No OR badge for upcoming commitments, or for the requester's own filled
    // requests (the date is already settled).
    const isFilled = status === 'accepted' || Boolean(request.acceptedByUid) || Boolean(request.acceptedOther);
    const isGroup = Boolean(request.groupId)
        && Number(request.groupSize || 0) > 1
        && context !== 'upcoming'
        && !(isMineRow && isFilled);
    if (isGroup) {
        row.dataset.groupId = request.groupId;
    }

    // Pills (OR badge, and a status badge only for old/closed mine items) live in
    // a top-right group that shares the header line with the primary text.
    const pillGroup = document.createElement('div');
    pillGroup.className = 'request-pill-group';

    if (isGroup) {
        const orPill = document.createElement('span');
        orPill.className = 'or-pill';
        const colors = getOrGroupColor(request.groupId);
        row.style.setProperty('--or-border', colors.border);
        row.style.setProperty('--or-bg', colors.bg);
        row.style.setProperty('--or-text', colors.text);
        orPill.style.borderColor = colors.border;
        orPill.style.backgroundColor = colors.bg;
        orPill.style.color = colors.text;
        orPill.textContent = 'OR';
        orPill.setAttribute('aria-label', 'Part of OR date group');
        pillGroup.appendChild(orPill);

        const popup = document.createElement('div');
        popup.className = 'or-hover-popup';
        popup.textContent = `Alternative dates for one request — ${householdDisplayName(request.createdByUid, usersByUid)} only needs a sitter for one. Taking a date signs you up for just that date; the others are then withdrawn.`;
        row.appendChild(popup);

        row.addEventListener('mouseenter', () => highlightOrGroup(request.groupId, row));
        row.addEventListener('mouseleave', () => clearOrGroupHover());
    }

    // Only the requester's old/closed items still show a status badge — everything
    // else on screen is open (or, for upcoming sits, implicitly booked).
    if (isMineRow && status !== 'open' && status !== 'accepted') {
        const statusPill = document.createElement('span');
        statusPill.className = `status-pill status-${status}`;
        statusPill.textContent = statusLabel(status);
        pillGroup.appendChild(statusPill);
    }

    const dateText = formatDateTimeLong(request.whenISO);
    const header = document.createElement('div');
    header.className = 'request-title-line';
    const primary = makeLine(
        isMineRow ? dateText : householdDisplayName(request.createdByUid, usersByUid),
        isMineRow ? 'request-line-muted' : 'request-name',
    );
    header.appendChild(primary);
    if (pillGroup.children.length) {
        header.appendChild(pillGroup);
    }
    row.appendChild(header);

    if (isMineRow) {
        const detailText = truncateText(request.details, 120);
        if (detailText) {
            row.appendChild(makeLine(detailText, 'request-line-muted'));
        }
        const sitter = babysitterLine(request, usersByUid);
        if (sitter) {
            row.appendChild(makeLine(sitter, 'request-sitter'));
        }
    } else {
        row.appendChild(makeLine(dateText, 'request-line-muted'));
        const descText = truncateText(request.details, 110);
        if (descText) {
            row.appendChild(makeLine(descText, 'request-line-muted'));
        }
    }

    row.addEventListener('click', () => {
        if (!isViewingAs() && isMine(request.createdByUid)) {
            openRequestForm(request);
            return;
        }
        openRequestModal(request, dateText);
    });

    return row;
}

function setRequestModalButtons({
    primaryText = '',
    secondaryText = '',
    tertiaryText = '',
    onPrimary = null,
    onSecondary = null,
    onTertiary = null,
}) {
    btnRequestPrimary.hidden = !primaryText;
    btnRequestSecondary.hidden = !secondaryText;
    btnRequestTertiary.hidden = !tertiaryText;
    btnRequestPrimary.textContent = primaryText;
    btnRequestSecondary.textContent = secondaryText;
    btnRequestTertiary.textContent = tertiaryText;

    btnRequestPrimary.onclick = onPrimary;
    btnRequestSecondary.onclick = onSecondary;
    btnRequestTertiary.onclick = onTertiary;
}

function renderRequestGroupInModal(request) {
    if (!requestModalGroup) {
        return;
    }
    // Only the owner sees the full list of linked dates (to manage them). A
    // filler should focus on the single date they're considering, so we keep
    // this hidden for them to avoid implying they sign up for all of them.
    if (!request.groupId || Number(request.groupSize || 0) <= 1 || !isMine(request.createdByUid)) {
        requestModalGroup.hidden = true;
        requestModalGroup.innerHTML = '';
        return;
    }

    const usersByUid = userMap();
    const groupItems = state.requests
        .filter((item) => item.groupId === request.groupId)
        .sort(byRequestDateAsc);

    requestModalGroup.hidden = false;
    requestModalGroup.innerHTML = '';

    groupItems.forEach((item) => {
        const acceptedByName = item.acceptedByUid ? householdDisplayName(item.acceptedByUid, usersByUid) : '';
        const row = document.createElement('div');
        row.className = `modal-group-row status-${item.status || 'open'}`;

        const meta = document.createElement('div');
        meta.className = 'modal-group-meta';
        meta.innerHTML = `
            <p><strong>${formatDateTimeLong(item.whenISO)}</strong></p>
            <p class="muted small">${statusLabel(item.status)}${acceptedByName ? ` · ${acceptedByName}` : ''}</p>
        `;

        row.appendChild(meta);

        const isOwner = isMine(item.createdByUid);
        if (isOwner && item.status === 'open') {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn-ghost btn-small';
            btn.textContent = 'Set accepted person';
            btn.addEventListener('click', () => {
                openAssignRequestModal(item);
            });
            row.appendChild(btn);
        }

        requestModalGroup.appendChild(row);
    });
}

function openRequestModal(request, metaText) {
    state.activeRequestModalId = request.id;
    requestModalTitle.textContent = householdDisplayName(request.createdByUid);
    requestModalMeta.textContent = metaText;
    requestModalDetails.textContent = request.details || 'No details yet.';
    renderRequestGroupInModal(request);

    // Read-only preview: show details with no action buttons.
    if (isViewingAs()) {
        if (requestModalOrNote) {
            requestModalOrNote.hidden = true;
            requestModalOrNote.textContent = '';
        }
        setRequestModalButtons({});
        openModal(requestModal);
        return;
    }

    const isOwner = isMine(request.createdByUid);
    const isOpen = request.status === 'open';
    const isAcceptedByMe = isMine(request.acceptedByUid);
    const isGroup = Boolean(request.groupId) && Number(request.groupSize || 0) > 1;

    if (requestModalOrNote) {
        if (isGroup && !isOwner) {
            const requesterName = householdDisplayName(request.createdByUid);
            requestModalOrNote.hidden = false;
            requestModalOrNote.textContent = `Heads up: ${requesterName} offered a few possible dates and only needs a sitter for ONE of them. Accepting signs you up for just this date — ${formatDateTimeLong(request.whenISO)} — and nothing else. You are not committing to the other dates.`;
        } else {
            requestModalOrNote.hidden = true;
            requestModalOrNote.textContent = '';
        }
    }

    if (isOwner) {
        setRequestModalButtons({
            primaryText: 'Edit',
            secondaryText: 'Set accepted person',
            tertiaryText: 'Delete',
            onPrimary: () => {
                closeModal('request-modal');
                openRequestForm(request);
            },
            onSecondary: () => {
                closeModal('request-modal');
                openAssignRequestModal(request);
            },
            onTertiary: async () => {
                const deleteWholeGroup = request.groupId && Number(request.groupSize || 0) > 1;
                const confirmed = window.confirm(deleteWholeGroup
                    ? 'Delete this OR request group? All linked date options will be deleted.'
                    : 'Delete this request?');
                if (!confirmed) {
                    return;
                }

                if (deleteWholeGroup) {
                    const groupSnap = await getDocs(query(collection(db, 'requests'), where('groupId', '==', request.groupId)));
                    await Promise.all(groupSnap.docs.map((docSnap) => deleteDoc(doc(db, 'requests', docSnap.id))));
                } else {
                    await deleteDoc(doc(db, 'requests', request.id));
                }

                closeModal('request-modal');
                await refreshAndRender();
            },
        });
    } else if (!isOwner && isOpen && !request.acceptedByUid) {
        setRequestModalButtons({
            primaryText: isGroup ? "I'll babysit this date" : "I'll babysit",
            onPrimary: async () => {
                if (request.groupId) {
                    const groupSnap = await getDocs(query(collection(db, 'requests'), where('groupId', '==', request.groupId)));
                    const batch = writeBatch(db);
                    groupSnap.docs.forEach((docSnap) => {
                        batch.update(doc(db, 'requests', docSnap.id), {
                            status: docSnap.id === request.id ? 'accepted' : 'superseded',
                            acceptedByUid: state.currentUser.uid,
                            updatedAt: serverTimestamp(),
                        });
                    });
                    await batch.commit();
                } else {
                    await updateDoc(doc(db, 'requests', request.id), {
                        status: 'accepted',
                        acceptedByUid: state.currentUser.uid,
                        updatedAt: serverTimestamp(),
                    });
                }
                closeModal('request-modal');
                await refreshAndRender();
            },
        });
    } else if (isAcceptedByMe) {
        setRequestModalButtons({
            primaryText: 'Back out (un-fill)',
            onPrimary: async () => {
                if (request.groupId) {
                    const groupSnap = await getDocs(query(collection(db, 'requests'), where('groupId', '==', request.groupId)));
                    const batch = writeBatch(db);
                    groupSnap.docs.forEach((docSnap) => {
                        batch.update(doc(db, 'requests', docSnap.id), {
                            status: 'open',
                            acceptedByUid: null,
                            updatedAt: serverTimestamp(),
                        });
                    });
                    await batch.commit();
                } else {
                    await updateDoc(doc(db, 'requests', request.id), {
                        status: 'open',
                        acceptedByUid: null,
                        updatedAt: serverTimestamp(),
                    });
                }
                closeModal('request-modal');
                await refreshAndRender();
            },
        });
    } else {
        setRequestModalButtons({});
    }

    openModal(requestModal);
}

function renderMyRequests() {
    // Once one date in an OR group is filled, the others become 'superseded' —
    // hide those siblings entirely so only the chosen date remains.
    const filledGroupIds = new Set(
        state.requests
            .filter((request) => request.status === 'accepted' && request.groupId)
            .map((request) => request.groupId),
    );
    const mine = state.requests
        .filter((request) => isMine(request.createdByUid))
        .filter((request) => !(request.status === 'superseded' && request.groupId && filledGroupIds.has(request.groupId)));
    const openItems = mine
        .filter((request) => request.status === 'open' || request.status === 'accepted')
        .sort(byRequestDateAsc);
    const oldItems = mine
        .filter((request) => request.status !== 'open' && request.status !== 'accepted')
        .sort(byRequestDateAsc);
    const visible = state.showOldMine ? [...openItems, ...oldItems] : openItems;
    const usersByUid = userMap();

    const myRequestsHeading = document.getElementById('my-requests-heading');
    if (myRequestsHeading) {
        const inHousehold = Boolean(effectiveProfile()?.householdPartnerUid);
        myRequestsHeading.textContent = inHousehold ? 'Our Babysitting Requests' : 'My Babysitting Requests';
    }

    myRequestsList.innerHTML = '';
    visible.forEach((request) => myRequestsList.appendChild(makeRequestRow(request, usersByUid, 'mine')));

    if (visible.length === 0) {
        myRequestsList.innerHTML = '<p class="empty-state">No requests yet. Hit "New Request" to add one.</p>';
    }
    btnToggleMyOld.textContent = state.showOldMine ? 'Hide old requests' : 'Show old requests';
}

function renderOthersRequests() {
    const visible = state.requests
        .filter((request) => !isMine(request.createdByUid))
        .filter((request) => requestVisibleToCurrentUser(request))
        .filter((request) => request.status === 'open')
        .sort(byRequestDateAsc);
    const usersByUid = userMap();

    othersRequestsList.innerHTML = '';
    visible.forEach((request) => othersRequestsList.appendChild(makeRequestRow(request, usersByUid, 'others')));
    if (visible.length === 0) {
        othersRequestsList.innerHTML = '<p class="empty-state">No open club requests yet.</p>';
    }
}

function renderUpcomingBabysits() {
    const upcoming = state.requests
        .filter((request) => isMine(request.acceptedByUid) && request.status === 'accepted' && request.whenISO)
        .filter((request) => new Date(request.whenISO) > new Date())
        .sort((a, b) => new Date(a.whenISO) - new Date(b.whenISO));

    upcomingList.innerHTML = '';
    if (upcoming.length === 0) {
        upcomingEmpty.hidden = false;
        upcomingList.hidden = true;
        return;
    }

    upcomingEmpty.hidden = true;
    upcomingList.hidden = false;
    const usersByUid = userMap();
    upcoming.forEach((request) => {
        upcomingList.appendChild(makeRequestRow(request, usersByUid, 'upcoming'));
    });
}

function renderClubMembers() {
    const usersByUid = userMap();
    const memberIds = new Set(effectiveProfile()?.clubMemberUids || []);
    const handled = new Set();
    clubMembersList.innerHTML = '';

    [...memberIds].forEach((uid) => {
        if (handled.has(uid)) {
            return;
        }
        const user = usersByUid.get(uid);
        if (!user) {
            return;
        }

        const partnerUid = user.householdPartnerUid;
        let label = user.displayName || user.email || 'Unknown member';
        let avatar = user.photoURL || '';
        const removeUids = [uid];

        if (partnerUid && memberIds.has(partnerUid)) {
            const partner = usersByUid.get(partnerUid);
            if (partner) {
                label = `${firstName(user.displayName)} & ${firstName(partner.displayName)}`;
                if (!avatar) {
                    avatar = partner.photoURL || '';
                }
                removeUids.push(partnerUid);
                handled.add(partnerUid);
            }
        }

        const row = document.createElement('div');
        row.className = 'member-row';
        row.innerHTML = `
            <div class="member-main">
                <span class="member-name">${label}</span>
                <button type="button" class="btn btn-ghost btn-small member-remove-btn" data-remove-club="${removeUids.join(',')}">Remove from Club</button>
            </div>
            <div class="member-hover-card">
                ${avatar ? `<img src="${avatar}" alt="${label}" />` : '<div class="member-avatar-fallback">No photo</div>'}
                <p>${label}</p>
            </div>
        `;

        clubMembersList.appendChild(row);
        handled.add(uid);
    });

    if (clubMembersList.children.length === 0) {
        clubMembersList.innerHTML = '<p class="empty-state">Your club is still empty. Add your first trusted family.</p>';
    }

    clubInvitesNote.textContent = 'Hover a row to preview face and reveal Remove from Club.';
}

function renderIncomingInvites() {
    // Invites are loaded for the real signed-in user only, so hide them while
    // previewing someone else's view to avoid showing the admin's own invites.
    if (isViewingAs()) {
        [outgoingClubInvites, incomingClubInvites, incomingHouseholdInvites].forEach((el) => {
            if (el) {
                el.innerHTML = '';
                el.hidden = true;
            }
        });
        if (outgoingInvitesHeading) outgoingInvitesHeading.hidden = true;
        if (incomingInvitesHeading) incomingInvitesHeading.hidden = true;
        return;
    }
    const usersByUid = userMap();
    const uniqueIncomingBySender = new Map();
    state.clubInvites.forEach((invite) => {
        if (!uniqueIncomingBySender.has(invite.fromUid)) {
            uniqueIncomingBySender.set(invite.fromUid, invite);
        }
    });
    const uniqueIncoming = [...uniqueIncomingBySender.values()];

    outgoingClubInvites.innerHTML = '';
    state.outgoingClubInvites.forEach((invite) => {
        const toUser = usersByUid.get(invite.toUid);
        const row = document.createElement('div');
        row.className = 'invite-row';
        row.innerHTML = `
            <span>Waiting on ${toUser?.displayName || 'a member'} to accept your club invite.</span>
            <span class="muted small">Pending</span>
        `;
        outgoingClubInvites.appendChild(row);
    });
    const hasOutgoing = state.outgoingClubInvites.length > 0;
    outgoingClubInvites.hidden = !hasOutgoing;
    if (outgoingInvitesHeading) {
        outgoingInvitesHeading.hidden = !hasOutgoing;
    }

    incomingClubInvites.innerHTML = '';
    uniqueIncoming.forEach((invite) => {
        const fromUser = usersByUid.get(invite.fromUid);
        const row = document.createElement('div');
        row.className = 'invite-row';
        row.innerHTML = `
            <span>${fromUser?.displayName || 'Someone'} invited you to their club.</span>
            <span class="inline-actions">
                <button type="button" class="btn btn-ghost btn-small" data-club-accept="${invite.id}">Accept</button>
                <button type="button" class="btn btn-ghost btn-small" data-club-decline="${invite.id}">Decline</button>
            </span>
        `;
        incomingClubInvites.appendChild(row);
    });
    const hasIncoming = uniqueIncoming.length > 0;
    incomingClubInvites.hidden = !hasIncoming;
    if (incomingInvitesHeading) {
        incomingInvitesHeading.hidden = !hasIncoming;
    }

    incomingHouseholdInvites.innerHTML = '';
    state.householdInvites.forEach((invite) => {
        const fromUser = usersByUid.get(invite.fromUid);
        const row = document.createElement('div');
        row.className = 'invite-row';
        row.innerHTML = `
            <span>${fromUser?.displayName || 'Someone'} wants to link households.</span>
            <span class="inline-actions">
                <button type="button" class="btn btn-ghost btn-small" data-household-accept="${invite.id}">Accept</button>
                <button type="button" class="btn btn-ghost btn-small" data-household-decline="${invite.id}">Decline</button>
            </span>
        `;
        incomingHouseholdInvites.appendChild(row);
    });
    incomingHouseholdInvites.hidden = state.householdInvites.length === 0;
}

function renderHousehold() {
    const usersByUid = userMap();
    const partnerUid = effectiveProfile()?.householdPartnerUid;
    if (!partnerUid) {
        householdStatus.textContent = 'No household partner linked yet.';
        btnHouseholdAction.textContent = 'Add my parenting partner / lover / spouse';
        btnRemovePartner.hidden = true;
        return;
    }

    const partner = usersByUid.get(partnerUid);
    householdStatus.textContent = `Linked with ${partner?.displayName || 'your partner'}. Networks are merged.`;
    btnHouseholdAction.textContent = 'Household linked';
    btnRemovePartner.hidden = false;
}

function renderAllSections() {
    renderMyRequests();
    renderUpcomingBabysits();
    renderOthersRequests();
    renderClubMembers();
    renderIncomingInvites();
    renderHousehold();
    renderAdminSection();
}

function renderAdminSection() {
    if (!adminSection || !adminUsersList || !navAdmin) {
        return;
    }
    // While previewing another member, mirror their (non-admin) view by hiding
    // admin tools. The banner's Exit button is always available to return.
    if (!state.isAdmin || isViewingAs()) {
        adminSection.hidden = true;
        navAdmin.hidden = true;
        return;
    }

    adminSection.hidden = false;
    navAdmin.hidden = false;

    const usersByUid = userMap();
    const sorted = [...state.users].sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));
    const adminSet = new Set(state.adminUids);
    adminUsersList.innerHTML = '';
    if (sorted.length === 0) {
        adminUsersList.innerHTML = '<p class="empty-state">No visible users loaded for admin view.</p>';
        return;
    }
    sorted.forEach((user) => {
        const clubMembers = (user.clubMemberUids || [])
            .map((uid) => usersByUid.get(uid)?.displayName || usersByUid.get(uid)?.email || uid)
            .sort();
        const isAdminUser = adminSet.has(user.uid);
        const isSelf = user.uid === state.currentUser.uid;
        const card = document.createElement('article');
        card.className = 'admin-user-card';
        card.innerHTML = `
            <h4>${user.displayName || user.email || user.uid}</h4>
            <p class="muted small">UID: ${user.uid}</p>
            <p class="muted small">Admin: ${isAdminUser ? 'Yes' : 'No'}</p>
            <p class="muted small">Household partner: ${user.householdPartnerUid || 'None'}</p>
            <p class="muted small">Club (${clubMembers.length}): ${clubMembers.length ? clubMembers.join(', ') : 'No members'}</p>
            <div class="inline-actions">
                <button
                    type="button"
                    class="btn btn-ghost btn-small"
                    data-admin-action="${isAdminUser ? 'remove' : 'add'}"
                    data-admin-uid="${user.uid}"
                    ${isSelf ? 'disabled' : ''}
                >
                    ${isAdminUser ? 'Remove admin' : 'Make admin'}
                </button>
                ${isSelf ? '<span class="muted small">You</span>' : ''}
            </div>
        `;
        adminUsersList.appendChild(card);
    });
}

function applyViewAsUiState() {
    const viewing = isViewingAs();
    document.body.classList.toggle('is-viewing-as', viewing);
    if (viewAsBanner) {
        viewAsBanner.hidden = !viewing;
    }
    if (viewAsName && viewing) {
        viewAsName.textContent = householdDisplayName(state.viewAsUid);
    }
}

function setViewAs(uid) {
    if (!state.isAdmin || !uid || uid === state.currentUser?.uid) {
        return;
    }
    state.viewAsUid = uid;
    closeModal('view-as-modal');
    applyViewAsUiState();
    renderAllSections();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitViewAs() {
    state.viewAsUid = null;
    if (authStatus.textContent.startsWith('Read-only preview')) {
        authStatus.textContent = '';
    }
    applyViewAsUiState();
    renderAllSections();
}

function buildViewAsModal() {
    if (!viewAsList) {
        return;
    }
    const candidates = [...state.users]
        .filter((user) => user.uid !== state.currentUser?.uid)
        .sort((a, b) => (a.displayName || a.email || '').localeCompare(b.displayName || b.email || ''));

    viewAsList.className = 'people-circle-grid';
    viewAsList.innerHTML = '';
    candidates.forEach((user) => {
        const photo = user.photoURL || '';
        const initials = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
        const avatarStyle = photo ? ` style="background-image:url('${photo}')"` : '';
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'person-circle';
        item.dataset.viewAsUid = user.uid;
        item.title = user.email
            ? `${user.displayName || 'Unnamed'} · ${user.email}`
            : (user.displayName || 'Unnamed');
        item.innerHTML = `
            <span class="person-circle-avatar-wrap">
                <span class="person-circle-avatar"${avatarStyle}>${photo ? '' : initials}</span>
            </span>
            <span class="person-circle-name">${firstName(user.displayName) || user.email}</span>
        `;
        viewAsList.appendChild(item);
    });

    if (candidates.length === 0) {
        viewAsList.className = 'list-stack';
        viewAsList.innerHTML = '<p class="empty-state">No other users to view as yet.</p>';
    }
}

function buildInviteLink() {
    const uid = effectiveUid() || '';
    return `${window.location.origin}${window.location.pathname}?inviteFrom=${uid}`;
}

// When someone opens a shared invite link, send a connection request back to the
// inviter so they can accept it from "Invites waiting for me".
async function processInviteLink() {
    if (!state.currentUser) {
        return;
    }
    const params = new URLSearchParams(window.location.search);
    const fromUid = params.get('inviteFrom');
    if (!fromUid) {
        return;
    }
    const clearParam = () => {
        params.delete('inviteFrom');
        const queryString = params.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${queryString ? `?${queryString}` : ''}`);
    };

    if (fromUid === state.currentUser.uid) {
        clearParam();
        return;
    }
    const myClub = new Set(state.currentProfile?.clubMemberUids || []);
    if (myClub.has(fromUid)) {
        authStatus.textContent = 'You are already connected with the person who invited you.';
        clearParam();
        return;
    }
    const alreadyPending = state.outgoingClubInvites.some((invite) => invite.toUid === fromUid)
        || state.clubInvites.some((invite) => invite.fromUid === fromUid);
    if (alreadyPending) {
        authStatus.textContent = 'A connection request with your inviter is already pending.';
        clearParam();
        return;
    }

    try {
        await addDoc(collection(db, 'clubInvites'), {
            fromUid: state.currentUser.uid,
            toUid: fromUid,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        authStatus.textContent = 'Connection request sent to the person who invited you — they just need to accept it.';
        clearParam();
        await refreshAndRender();
    } catch (err) {
        console.error('Failed to process invite link:', err);
        clearParam();
    }
}

function buildAddPeopleModal() {
    const myClub = new Set(effectiveProfile()?.clubMemberUids || []);
    const myClubArray = [...myClub];
    // Outgoing invites are only loaded for the real user, so we can't show the
    // previewed member's pending state — leave it empty in that case.
    const pendingTo = isViewingAs()
        ? new Set()
        : new Set(state.outgoingClubInvites.map((invite) => invite.toUid));

    const candidates = state.users
        .filter((user) => user.uid !== effectiveUid())
        .filter((user) => !myClub.has(user.uid))
        .map((user) => {
            const theirClub = new Set(user.clubMemberUids || []);
            const score = myClubArray.filter((uid) => theirClub.has(uid)).length;
            return { user, score };
        })
        .sort((a, b) => b.score - a.score || (a.user.displayName || '').localeCompare(b.user.displayName || ''));

    addPeopleList.className = 'people-circle-grid';
    addPeopleList.innerHTML = '';
    candidates.forEach(({ user }) => {
        const isPending = pendingTo.has(user.uid);
        const photo = user.photoURL || '';
        const initials = (user.displayName || user.email || '?').trim().charAt(0).toUpperCase();
        const avatarStyle = photo ? ` style="background-image:url('${photo}')"` : '';
        const item = document.createElement('button');
        item.type = 'button';
        item.className = `person-circle${isPending ? ' is-pending' : ''}`;
        item.disabled = isPending;
        item.title = isPending
            ? `Invite already sent to ${user.displayName || user.email}`
            : `Invite ${user.displayName || user.email} to your club`;
        if (!isPending) {
            item.dataset.sendClub = user.uid;
        }
        item.innerHTML = `
            <span class="person-circle-avatar-wrap">
                <span class="person-circle-avatar"${avatarStyle}>${photo ? '' : initials}</span>
                <span class="person-circle-badge">${isPending ? '\u2713' : '+'}</span>
            </span>
            <span class="person-circle-name">${firstName(user.displayName) || user.email}</span>
        `;
        addPeopleList.appendChild(item);
    });

    if (candidates.length === 0) {
        addPeopleList.className = 'list-stack';
        addPeopleList.innerHTML = '<p class="empty-state">No one new to add right now. Use the invite link below.</p>';
    }
}

function buildHouseholdModal() {
    householdCandidateList.innerHTML = '';
    const selfUid = effectiveUid();
    const candidates = state.users
        .filter((user) => user.uid !== selfUid)
        .filter((user) => !user.householdPartnerUid || user.householdPartnerUid === selfUid);

    candidates.forEach((user) => {
        const row = document.createElement('div');
        row.className = 'invite-row';
        row.innerHTML = `
            <span>${user.displayName || user.email}</span>
            <button type="button" class="btn btn-ghost btn-small" data-send-household="${user.uid}">Send request</button>
        `;
        householdCandidateList.appendChild(row);
    });

    if (candidates.length === 0) {
        householdCandidateList.innerHTML = '<p class="empty-state">No available users right now.</p>';
    }
}

function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getNextFridayDate() {
    const now = new Date();
    const day = now.getDay();
    let offset = (5 - day + 7) % 7;
    if (offset === 0) {
        offset = 7;
    }
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + offset);
    nextFriday.setHours(0, 0, 0, 0);
    return nextFriday;
}

function buildTimeOptions(selected = '18:00') {
    const options = [];
    for (let hour = 10; hour <= 20; hour += 1) {
        for (let minute = 0; minute < 60; minute += 15) {
            if (hour === 20 && minute > 0) {
                break;
            }
            const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
            const date = new Date(`2000-01-01T${value}:00`);
            const label = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
            options.push(`<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`);
        }
    }
    return options.join('');
}

function combineDateAndTime(dateValue, timeValue) {
    if (!dateValue || !timeValue) {
        return '';
    }
    return `${dateValue}T${timeValue}`;
}

function splitIsoToDateTime(whenISO) {
    if (!whenISO) {
        return { date: '', time: '18:00' };
    }
    const [datePart, timePart = '18:00'] = String(whenISO).split('T');
    return { date: datePart, time: timePart.slice(0, 5) };
}

function getRequestById(requestId) {
    return state.requests.find((request) => request.id === requestId) || null;
}

function getGroupedRequests(request) {
    if (request?.groupId) {
        return state.requests.filter((item) => item.groupId === request.groupId).sort(byRequestDateAsc);
    }
    return request ? [request] : [];
}

function getAssignableHouseholdsForRequest(request) {
    const usersByUid = userMap();
    const clubSet = new Set(effectiveProfile()?.clubMemberUids || []);
    const allowedUids = request.visibility === 'subset'
        ? new Set(request.visibilityUids || [])
        : clubSet;
    const candidateUids = [...allowedUids].filter((uid) => !isMine(uid));
    return groupUidsByHousehold(candidateUids, usersByUid);
}

// Fill picker options: club households plus a manual "Someone else" entry.
// There is no empty option — the Not filled / Filled toggle controls that.
function buildFillPersonOptions(groups, selectedUid = '', selectedOther = false) {
    const options = [];
    groups.forEach((group) => {
        const selected = (!selectedOther && selectedUid && group.uids.includes(selectedUid)) ? 'selected' : '';
        options.push(`<option value="${group.primaryUid}" ${selected}>${group.label}</option>`);
    });
    options.push(`<option value="__other__" ${selectedOther ? 'selected' : ''}>Someone else</option>`);
    return options.join('');
}

function createDateRow({ date = '', time = '18:00', acceptedByUid = '', acceptedOther = false } = {}) {
    const minDate = toDateInputValue(new Date());
    const row = document.createElement('div');
    row.className = 'inline-date-row';
    row.dataset.row = '';
    row.innerHTML = `
        <div class="date-click-target"><input class="row-date" type="date" value="${date}" min="${minDate}" required /></div>
        <select class="row-time" required>${buildTimeOptions(time || '18:00')}</select>
        <button type="button" class="btn btn-ghost btn-small fill-toggle" data-fill-toggle>Not filled</button>
        <select class="fill-person" hidden>${buildFillPersonOptions(currentFormAssignable, acceptedByUid, acceptedOther)}</select>
        <button type="button" class="row-remove" data-remove-row aria-label="Remove this date" title="Remove">&times;</button>
    `;
    return row;
}

function allDateRows() {
    return Array.from(dateRowsList.querySelectorAll('.inline-date-row[data-row]'));
}

function getFilledRow() {
    return allDateRows().find((row) => (
        row.querySelector('[data-fill-toggle]')?.classList.contains('is-filled')
    )) || null;
}

function applyFillState(filledRow) {
    allDateRows().forEach((row) => {
        const toggle = row.querySelector('[data-fill-toggle]');
        const person = row.querySelector('.fill-person');
        const isFilled = filledRow === row;
        const isDimmed = Boolean(filledRow) && !isFilled;
        row.classList.toggle('row-dimmed', isDimmed);
        if (toggle) {
            toggle.classList.toggle('is-filled', isFilled);
            toggle.textContent = isFilled ? 'Filled \u2713' : 'Not filled';
            toggle.disabled = isDimmed;
        }
        if (person) {
            person.hidden = !isFilled;
        }
        // Dim the date/time of other rows, but keep the X usable so OR options
        // can still be deleted even when one date is already filled.
        row.querySelectorAll('.row-date, .row-time').forEach((el) => {
            el.disabled = isDimmed;
        });
    });
}

function toggleFillRow(row) {
    if (!row) {
        return;
    }
    const toggle = row.querySelector('[data-fill-toggle]');
    if (!toggle) {
        return;
    }
    applyFillState(toggle.classList.contains('is-filled') ? null : row);
}

function refreshRemoveButtons() {
    const rows = allDateRows();
    const onlyOne = rows.length <= 1;
    rows.forEach((row) => {
        const removeBtn = row.querySelector('[data-remove-row]');
        if (removeBtn) {
            removeBtn.hidden = onlyOne;
        }
    });
}

function addOrDateRow() {
    if (allDateRows().length >= 5) {
        authStatus.textContent = 'You can keep up to 5 date options.';
        return;
    }
    dateRowsList.appendChild(createDateRow({ date: toDateInputValue(getNextFridayDate()), time: '18:00' }));
    refreshRemoveButtons();
    applyFillState(getFilledRow());
}

// Single entry point for both creating and editing a request.
function openRequestForm(request = null) {
    if (!requestForm) {
        return;
    }
    const isEdit = Boolean(request);
    requestForm.dataset.mode = isEdit ? 'edit' : 'create';
    requestFormTitle.textContent = isEdit ? 'Edit request' : 'Create new request';
    btnRequestSubmit.textContent = isEdit ? 'Save changes' : 'Create request';
    btnRequestDelete.hidden = !isEdit;
    requestFormId.value = isEdit ? request.id : '';
    currentFormAssignable = getAssignableHouseholdsForRequest(isEdit ? request : { visibility: 'all' });

    dateRowsList.innerHTML = '';
    let filledRow = null;

    if (isEdit) {
        const grouped = getGroupedRequests(request);
        requestFormDetails.value = request.details || '';
        grouped.forEach((item) => {
            const { date, time } = splitIsoToDateTime(item.whenISO);
            const row = createDateRow({
                date,
                time: time || '18:00',
                acceptedByUid: item.acceptedByUid || '',
                acceptedOther: Boolean(item.acceptedOther),
            });
            dateRowsList.appendChild(row);
        });
        const rows = allDateRows();
        grouped.forEach((item, idx) => {
            if (item.acceptedByUid || item.acceptedOther) {
                filledRow = rows[idx] || filledRow;
            }
        });
        const audience = request.visibility === 'subset' ? 'subset' : 'all';
        requestFormAudience.value = audience;
        buildAudienceList(requestFormAudienceList, 'subsetUid', request.visibilityUids || []);
        requestFormAudienceList.hidden = audience !== 'subset';
    } else {
        requestFormDetails.value = '';
        dateRowsList.appendChild(createDateRow({ date: toDateInputValue(getNextFridayDate()), time: '18:00' }));
        requestFormAudience.value = 'all';
        buildAudienceList(requestFormAudienceList, 'subsetUid', []);
        requestFormAudienceList.hidden = true;
    }

    refreshRemoveButtons();
    applyFillState(filledRow);
    openModal(requestFormModal);
}

function randomGroupId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Reads every date row in the request form into a de-duped, date-sorted list of
// { whenISO, acceptedByUid, acceptedOther } options.
function gatherFormOptions() {
    const seen = new Map();
    allDateRows().forEach((row) => {
        const dateInput = row.querySelector('.row-date');
        const timeSelect = row.querySelector('.row-time');
        const whenISO = combineDateAndTime(dateInput?.value || '', timeSelect?.value || '');
        if (!whenISO || seen.has(whenISO)) {
            return;
        }
        const filled = row.querySelector('[data-fill-toggle]')?.classList.contains('is-filled');
        let acceptedByUid = '';
        let acceptedOther = false;
        if (filled) {
            const personVal = row.querySelector('.fill-person')?.value || '';
            if (personVal === '__other__') {
                acceptedOther = true;
            } else if (personVal) {
                acceptedByUid = personVal;
            }
        }
        seen.set(whenISO, { whenISO, acceptedByUid, acceptedOther });
    });
    return [...seen.values()].sort((a, b) => byRequestDateAsc(a, b));
}

function readFormAudience() {
    const audience = requestFormAudience.value === 'subset' ? 'subset' : 'all';
    const subsetUids = audience === 'subset'
        ? [...new Set(
            Array.from(requestForm.querySelectorAll('input[name="subsetUid"]:checked'))
                .flatMap((el) => String(el.value).split(','))
                .filter(Boolean),
        )]
        : [];
    return { audience, subsetUids };
}

function openAssignRequestModal(request) {
    if (!request || !assignRequestForm) {
        return;
    }
    const options = getAssignableHouseholdsForRequest(request);

    assignRequestId.value = request.id;
    assignRequestUser.innerHTML = options.map((group) => (
        `<option value="${group.primaryUid}" ${group.uids.includes(request.acceptedByUid) ? 'selected' : ''}>${group.label}</option>`
    )).join('');

    if (!options.length) {
        assignRequestUser.innerHTML = '<option value="">No club members available</option>';
        assignRequestUser.disabled = true;
    } else {
        assignRequestUser.disabled = false;
    }
    openModal(assignRequestModal);
}

function buildAudienceList(listEl, inputName, selectedUids = []) {
    if (!listEl) {
        return;
    }
    listEl.innerHTML = '';
    const clubSet = new Set(effectiveProfile()?.clubMemberUids || []);
    const usersByUid = userMap();
    const candidateUids = [...clubSet].filter((uid) => !isMine(uid));
    const groups = groupUidsByHousehold(candidateUids, usersByUid);
    const selectedSet = new Set(selectedUids);
    groups.forEach((group) => {
        const checked = group.uids.some((uid) => selectedSet.has(uid)) ? 'checked' : '';
        const primaryUser = usersByUid.get(group.primaryUid);
        const photo = primaryUser?.photoURL || '';
        const initials = (group.label || '?').trim().charAt(0).toUpperCase();
        const avatarStyle = photo ? ` style="background-image:url('${photo}')"` : '';
        const chip = document.createElement('label');
        chip.className = 'audience-chip';
        chip.innerHTML = `
            <input type="checkbox" name="${inputName}" value="${group.uids.join(',')}" ${checked} />
            <span class="audience-chip-avatar-wrap">
                <span class="audience-chip-avatar"${avatarStyle}>${photo ? '' : initials}</span>
                <span class="audience-chip-check" aria-hidden="true">&check;</span>
            </span>
            <span class="audience-chip-name">${group.label}</span>
        `;
        listEl.appendChild(chip);
    });
    if (!listEl.children.length) {
        listEl.innerHTML = '<p class="empty-state">No club members available yet.</p>';
    }
}

async function refreshAndRender() {
    await loadAppData();
    renderAllSections();
}

function bindClick(el, handler) {
    if (el) {
        el.addEventListener('click', handler);
    }
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
            state.currentUser = user;
            let hasBlockingError = false;
            authStatus.textContent = '';

            try {
                await ensureUserProfile(user);
            } catch (err) {
                console.error('Failed to sync user profile:', err);
                authStatus.textContent = 'Signed in, but profile sync failed. Please refresh.';
                hasBlockingError = true;
            }

            if (!hasBlockingError) {
                try {
                    state.isAdmin = await ensureAdminAccess(user);
                } catch (err) {
                    console.error('Failed to verify admin status:', err);
                    state.isAdmin = false;
                    authStatus.textContent = 'Signed in, but admin check failed.';
                }

                try {
                    await refreshAndRender();
                } catch (err) {
                    console.error('Failed to load app data:', err);
                    authStatus.textContent = 'Signed in, but some data failed to load. Please refresh.';
                }

                try {
                    await processInviteLink();
                } catch (err) {
                    console.error('Failed to process invite link:', err);
                }
            }

            showSignedIn(user, { preserveStatus: authStatus.textContent.length > 0 });
        } else {
            state.currentUser = null;
            state.currentProfile = null;
            state.isAdmin = false;
            state.viewAsUid = null;
            applyViewAsUiState();
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

    bindClick(btnToggleMyOld, () => {
        state.showOldMine = !state.showOldMine;
        renderMyRequests();
    });

    bindClick(btnNewRequest, () => {
        openRequestForm(null);
    });
    bindClick(btnAddPeople, () => {
        buildAddPeopleModal();
        if (inviteLinkInput) {
            inviteLinkInput.value = buildInviteLink();
        }
        openModal(addPeopleModal);
    });

    bindClick(btnViewAs, () => {
        buildViewAsModal();
        openModal(viewAsModal);
    });

    bindClick(btnExitViewAs, () => {
        exitViewAs();
    });

    bindClick(btnCopyInviteLink, async () => {
        const link = buildInviteLink();
        if (inviteLinkInput) {
            inviteLinkInput.value = link;
            inviteLinkInput.select();
        }
        try {
            await navigator.clipboard.writeText(link);
            btnCopyInviteLink.textContent = 'Copied!';
            setTimeout(() => { btnCopyInviteLink.textContent = 'Copy'; }, 1500);
        } catch (err) {
            authStatus.textContent = `Could not copy automatically. Copy this link: ${link}`;
        }
    });
    bindClick(btnHouseholdAction, () => {
        if (effectiveProfile()?.householdPartnerUid) {
            return;
        }
        buildHouseholdModal();
        openModal(householdModal);
    });

    bindClick(btnAddOrDate, () => {
        addOrDateRow();
    });

    bindClick(btnRequestDelete, async () => {
        const request = getRequestById(requestFormId.value);
        if (!request) {
            closeModal('request-form-modal');
            return;
        }
        const deleteWholeGroup = request.groupId && Number(request.groupSize || 0) > 1;
        const confirmed = window.confirm(deleteWholeGroup
            ? 'Delete this OR request group? All linked date options will be deleted.'
            : 'Delete this request?');
        if (!confirmed) {
            return;
        }

        if (deleteWholeGroup) {
            const groupSnap = await getDocs(query(collection(db, 'requests'), where('groupId', '==', request.groupId)));
            await Promise.all(groupSnap.docs.map((docSnap) => deleteDoc(doc(db, 'requests', docSnap.id))));
        } else {
            await deleteDoc(doc(db, 'requests', request.id));
        }
        closeModal('request-form-modal');
        await refreshAndRender();
    });

    if (requestForm) {
        requestForm.addEventListener('change', (event) => {
            const target = event.target;
            if (target && target.name === 'audience') {
                requestFormAudienceList.hidden = target.value !== 'subset';
            }
        });

        requestForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (blockedByViewAs()) {
                closeModal('request-form-modal');
                return;
            }
            const normalizedOptions = gatherFormOptions();
            if (!normalizedOptions.length) {
                authStatus.textContent = 'Please choose at least one date and time.';
                return;
            }
            const details = requestFormDetails.value.trim();
            const { audience, subsetUids } = readFormAudience();
            const isEdit = Boolean(requestFormId.value);

            // Only one date in an OR group can be the filled one.
            const acceptedIndex = normalizedOptions.findIndex((o) => o.acceptedByUid || o.acceptedOther);
            if (acceptedIndex >= 0) {
                normalizedOptions.forEach((o, idx) => {
                    if (idx !== acceptedIndex) {
                        o.acceptedByUid = '';
                        o.acceptedOther = false;
                    }
                });
            }

            const existing = isEdit ? getRequestById(requestFormId.value) : null;
            const groupId = normalizedOptions.length > 1
                ? (existing?.groupId || randomGroupId())
                : null;

            const fillFields = (o) => ({
                status: (o.acceptedByUid || o.acceptedOther)
                    ? 'accepted'
                    : (acceptedIndex >= 0 ? 'superseded' : 'open'),
                acceptedByUid: o.acceptedByUid || null,
                acceptedOther: Boolean(o.acceptedOther),
                acceptedByName: o.acceptedOther ? 'Someone else' : null,
            });
            const sharedBase = {
                details,
                title: 'Babysitting request',
                visibility: audience,
                visibilityUids: subsetUids,
                updatedAt: serverTimestamp(),
            };

            if (!isEdit) {
                await Promise.all(normalizedOptions.map((o, index) => addDoc(collection(db, 'requests'), {
                    ...sharedBase,
                    whenISO: o.whenISO,
                    createdByUid: state.currentUser.uid,
                    createdByName: state.currentUser.displayName || state.currentUser.email || 'Unknown',
                    groupId,
                    groupSize: normalizedOptions.length,
                    groupIndex: index,
                    createdAt: serverTimestamp(),
                    ...fillFields(o),
                })));
            } else {
                if (!existing) {
                    closeModal('request-form-modal');
                    return;
                }
                const baseGroup = getGroupedRequests(existing);
                const keepDocs = baseGroup.slice(0, normalizedOptions.length);
                const removeDocs = baseGroup.slice(normalizedOptions.length);
                const addOptions = normalizedOptions.slice(baseGroup.length);

                const batch = writeBatch(db);
                keepDocs.forEach((docItem, idx) => {
                    const o = normalizedOptions[idx];
                    batch.update(doc(db, 'requests', docItem.id), {
                        ...sharedBase,
                        whenISO: o.whenISO,
                        groupId,
                        groupSize: normalizedOptions.length,
                        groupIndex: idx,
                        ...fillFields(o),
                    });
                });
                removeDocs.forEach((docItem) => batch.delete(doc(db, 'requests', docItem.id)));
                await batch.commit();

                if (addOptions.length) {
                    await Promise.all(addOptions.map((o, idx) => addDoc(collection(db, 'requests'), {
                        ...sharedBase,
                        whenISO: o.whenISO,
                        createdByUid: existing.createdByUid,
                        createdByName: existing.createdByName,
                        groupId,
                        groupSize: normalizedOptions.length,
                        groupIndex: baseGroup.length + idx,
                        createdAt: serverTimestamp(),
                        ...fillFields(o),
                    })));
                }
            }

            closeModal('request-form-modal');
            await refreshAndRender();
        });
    }

    if (assignRequestForm) {
        assignRequestForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const request = getRequestById(assignRequestId.value);
            if (!request || !assignRequestUser.value) {
                closeModal('assign-request-modal');
                return;
            }
            const selectedUid = assignRequestUser.value;

            if (request.groupId && Number(request.groupSize || 0) > 1) {
                const groupSnap = await getDocs(query(collection(db, 'requests'), where('groupId', '==', request.groupId)));
                const batch = writeBatch(db);
                groupSnap.docs.forEach((docSnap) => {
                    batch.update(doc(db, 'requests', docSnap.id), {
                        status: docSnap.id === request.id ? 'accepted' : 'superseded',
                        acceptedByUid: selectedUid,
                        updatedAt: serverTimestamp(),
                    });
                });
                await batch.commit();
            } else {
                await updateDoc(doc(db, 'requests', request.id), {
                    status: 'accepted',
                    acceptedByUid: selectedUid,
                    updatedAt: serverTimestamp(),
                });
            }

            closeModal('assign-request-modal');
            await refreshAndRender();
        });
    }

    bindClick(btnRemovePartner, async () => {
        if (blockedByViewAs()) {
            return;
        }
        const partnerUid = state.currentProfile?.householdPartnerUid;
        if (!partnerUid) {
            return;
        }
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', state.currentUser.uid), { householdPartnerUid: null, updatedAt: serverTimestamp() });
        batch.update(doc(db, 'users', partnerUid), { householdPartnerUid: null, updatedAt: serverTimestamp() });
        await batch.commit();
        await refreshAndRender();
    });

    bindClick(btnConfirmRemoveClub, async () => {
        if (!state.pendingClubRemovalUids.length) {
            closeModal('remove-club-modal');
            return;
        }
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', state.currentUser.uid), {
            clubMemberUids: arrayRemove(...state.pendingClubRemovalUids),
            updatedAt: serverTimestamp(),
        });
        state.pendingClubRemovalUids.forEach((uid) => {
            batch.update(doc(db, 'users', uid), {
                clubMemberUids: arrayRemove(state.currentUser.uid),
                updatedAt: serverTimestamp(),
            });
        });
        await batch.commit();
        state.pendingClubRemovalUids = [];
        closeModal('remove-club-modal');
        authStatus.textContent = 'Member removed from your club.';
        await refreshAndRender();
    });

    document.addEventListener('click', async (event) => {
        const { target } = event;
        if (!(target instanceof HTMLElement)) {
            return;
        }

        const dateTarget = target.closest('.date-click-target');
        if (dateTarget) {
            const dateInput = dateTarget.querySelector('input[type="date"]');
            if (dateInput && typeof dateInput.showPicker === 'function') {
                dateInput.showPicker();
            } else if (dateInput) {
                dateInput.focus();
            }
        }

        const fillToggle = target.closest('[data-fill-toggle]');
        if (fillToggle && requestForm?.contains(fillToggle)) {
            if (!fillToggle.disabled) {
                toggleFillRow(fillToggle.closest('.inline-date-row'));
            }
            return;
        }

        const closeId = target.dataset.close;
        if (closeId) {
            closeModal(closeId);
            return;
        }

        // Read-only preview: block actions that write to Firestore. Purely local
        // controls (opening modals, editing the draft form) stay interactive so
        // the preview shows what the member sees.
        if (isViewingAs()) {
            const writeTarget = target.closest('[data-remove-club],[data-admin-action],[data-send-club],[data-send-household],[data-club-accept],[data-club-decline],[data-household-accept],[data-household-decline]');
            if (writeTarget) {
                authStatus.textContent = 'Read-only preview — exit "View as" to make changes.';
                return;
            }
        }

        const removeRowBtn = target.closest('[data-remove-row]');
        if (removeRowBtn && requestForm?.contains(removeRowBtn)) {
            const row = removeRowBtn.closest('.inline-date-row');
            if (row && allDateRows().length > 1) {
                row.remove();
                refreshRemoveButtons();
                applyFillState(getFilledRow());
            }
            return;
        }

        const viewAsTarget = target.closest('[data-view-as-uid]');
        if (viewAsTarget) {
            setViewAs(viewAsTarget.dataset.viewAsUid);
            return;
        }

        const removeClubData = target.dataset.removeClub;
        if (removeClubData) {
            state.pendingClubRemovalUids = removeClubData.split(',').filter(Boolean);
            openModal(removeClubModal);
            return;
        }

        const adminAction = target.dataset.adminAction;
        if (adminAction) {
            const targetUid = target.dataset.adminUid;
            if (!targetUid || targetUid === state.currentUser.uid) {
                authStatus.textContent = 'You cannot change your own admin status from here.';
                return;
            }
            if (adminAction === 'add') {
                await setDoc(doc(db, 'admins', targetUid), {
                    uid: targetUid,
                    grantedByUid: state.currentUser.uid,
                    updatedAt: serverTimestamp(),
                }, { merge: true });
                await setDoc(doc(db, 'users', targetUid), { isAdmin: true, updatedAt: serverTimestamp() }, { merge: true });
                authStatus.textContent = 'Admin access granted.';
            } else {
                await deleteDoc(doc(db, 'admins', targetUid));
                await setDoc(doc(db, 'users', targetUid), { isAdmin: false, updatedAt: serverTimestamp() }, { merge: true });
                authStatus.textContent = 'Admin access removed.';
            }
            await refreshAndRender();
            return;
        }

        const clubInviteUserId = target.dataset.sendClub;
        if (clubInviteUserId) {
            const existingInvite = await getDocs(query(
                collection(db, 'clubInvites'),
                where('fromUid', '==', state.currentUser.uid),
                where('toUid', '==', clubInviteUserId),
                where('status', '==', 'pending'),
            ));
            if (existingInvite.empty) {
                await addDoc(collection(db, 'clubInvites'), {
                    fromUid: state.currentUser.uid,
                    toUid: clubInviteUserId,
                    status: 'pending',
                    createdAt: serverTimestamp(),
                });
                authStatus.textContent = 'Invite sent.';
            } else {
                authStatus.textContent = 'Invite already pending for this person.';
            }
            await refreshAndRender();
            buildAddPeopleModal();
            return;
        }

        const householdInviteUserId = target.dataset.sendHousehold;
        if (householdInviteUserId) {
            await addDoc(collection(db, 'householdInvites'), {
                fromUid: state.currentUser.uid,
                toUid: householdInviteUserId,
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            await refreshAndRender();
            buildHouseholdModal();
            return;
        }

        if (target.dataset.clubAccept) {
            const inviteId = target.dataset.clubAccept;
            const invite = state.clubInvites.find((item) => item.id === inviteId);
            if (!invite) {
                return;
            }
            const batch = writeBatch(db);
            batch.update(doc(db, 'clubInvites', inviteId), { status: 'accepted', updatedAt: serverTimestamp() });
            batch.update(doc(db, 'users', state.currentUser.uid), { clubMemberUids: arrayUnion(invite.fromUid), updatedAt: serverTimestamp() });
            batch.update(doc(db, 'users', invite.fromUid), { clubMemberUids: arrayUnion(state.currentUser.uid), updatedAt: serverTimestamp() });
            await batch.commit();
            authStatus.textContent = 'Club invite accepted.';
            await refreshAndRender();
            return;
        }

        if (target.dataset.clubDecline) {
            await updateDoc(doc(db, 'clubInvites', target.dataset.clubDecline), { status: 'rejected', updatedAt: serverTimestamp() });
            authStatus.textContent = 'Club invite declined.';
            await refreshAndRender();
            return;
        }

        if (target.dataset.householdAccept) {
            const invite = state.householdInvites.find((item) => item.id === target.dataset.householdAccept);
            if (!invite) {
                return;
            }
            const fromUser = state.users.find((user) => user.uid === invite.fromUid);
            const myClub = new Set(state.currentProfile?.clubMemberUids || []);
            const theirClub = new Set(fromUser?.clubMemberUids || []);
            const mergedClub = [...new Set([...myClub, ...theirClub, invite.fromUid, state.currentUser.uid])];

            const batch = writeBatch(db);
            batch.update(doc(db, 'householdInvites', invite.id), { status: 'accepted', updatedAt: serverTimestamp() });
            batch.update(doc(db, 'users', state.currentUser.uid), {
                householdPartnerUid: invite.fromUid,
                clubMemberUids: mergedClub,
                updatedAt: serverTimestamp(),
            });
            batch.update(doc(db, 'users', invite.fromUid), {
                householdPartnerUid: state.currentUser.uid,
                clubMemberUids: mergedClub,
                updatedAt: serverTimestamp(),
            });
            await batch.commit();
            authStatus.textContent = 'Household linked and club networks merged.';
            await refreshAndRender();
            return;
        }

        if (target.dataset.householdDecline) {
            await updateDoc(doc(db, 'householdInvites', target.dataset.householdDecline), { status: 'rejected', updatedAt: serverTimestamp() });
            authStatus.textContent = 'Household invite declined.';
            await refreshAndRender();
        }
    });
});
