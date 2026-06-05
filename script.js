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
const btnToggleOthersOld = document.getElementById('btn-toggle-others-old');
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

const btnNewRequest = document.getElementById('btn-new-request');
const btnAddPeople = document.getElementById('btn-add-people');
const btnInviteLink = document.getElementById('btn-invite-link');
const requestModal = document.getElementById('request-modal');
const requestModalTitle = document.getElementById('request-modal-title');
const requestModalMeta = document.getElementById('request-modal-meta');
const requestModalDetails = document.getElementById('request-modal-details');
const requestModalOrNote = document.getElementById('request-modal-or-note');
const requestModalGroup = document.getElementById('request-modal-group');
const btnRequestPrimary = document.getElementById('btn-request-primary');
const btnRequestSecondary = document.getElementById('btn-request-secondary');
const btnRequestTertiary = document.getElementById('btn-request-tertiary');
const newRequestModal = document.getElementById('new-request-modal');
const newRequestForm = document.getElementById('new-request-form');
const newRequestDate = document.getElementById('new-request-date');
const newRequestTime = document.getElementById('new-request-time');
const btnNewRemovePrimaryDate = document.getElementById('btn-new-remove-primary-date');
const btnAddOrDate = document.getElementById('btn-add-or-date');
const orDatesList = document.getElementById('or-dates-list');
const orDateCount = document.getElementById('or-date-count');
const kidOptions = Array.from(document.querySelectorAll('.kid-option'));
const newRequestKidCount = document.getElementById('new-request-kid-count');
const subsetAudienceList = document.getElementById('subset-audience-list');
const addPeopleModal = document.getElementById('add-people-modal');
const addPeopleList = document.getElementById('add-people-list');
const householdModal = document.getElementById('household-modal');
const householdCandidateList = document.getElementById('household-candidate-list');
const removeClubModal = document.getElementById('remove-club-modal');
const btnConfirmRemoveClub = document.getElementById('btn-confirm-remove-club');
const editRequestModal = document.getElementById('edit-request-modal');
const editRequestForm = document.getElementById('edit-request-form');
const editRequestId = document.getElementById('edit-request-id');
const editRequestDate = document.getElementById('edit-request-date');
const editRequestTime = document.getElementById('edit-request-time');
const btnEditRemovePrimaryDate = document.getElementById('btn-edit-remove-primary-date');
const editRequestFilledBy = document.getElementById('edit-request-filled-by');
const editRequestDetails = document.getElementById('edit-request-details');
const editRequestKidCount = document.getElementById('edit-request-kid-count');
const editOrDatesList = document.getElementById('edit-or-dates-list');
const btnEditAddOrDate = document.getElementById('btn-edit-add-or-date');
const btnEditDeleteRequest = document.getElementById('btn-edit-delete-request');
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
    showOldOthers: false,
    pendingClubRemovalUids: [],
    isAdmin: false,
    adminUids: [],
    activeRequestModalId: null,
};

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
    const uids = new Set([state.currentUser.uid]);
    const partnerUid = state.currentProfile?.householdPartnerUid;
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
        return (request.visibilityUids || []).includes(state.currentUser.uid);
    }
    const clubSet = new Set(state.currentProfile?.clubMemberUids || []);
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

    const userDocs = await Promise.all(
        [...visibleUids].map(async (uid) => {
            try {
                const snap = await getDoc(doc(db, 'users', uid));
                return snap.exists() ? { id: snap.id, ...snap.data() } : null;
            } catch (err) {
                console.warn('Skipping user doc fetch due to permission or missing access:', uid, err?.code || err);
                return null;
            }
        }),
    );
    state.users = userDocs.filter(Boolean);
    state.adminUids = state.isAdmin ? state.adminUids : [];
    if (!state.currentProfile) {
        state.currentProfile = state.users.find((user) => user.uid === state.currentUser.uid) || null;
    }
}

function makeRequestRow(request, usersByUid) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'request-row';
    row.classList.add(`status-${request.status || 'open'}`);
    if (request.groupId && Number(request.groupSize || 0) > 1) {
        row.dataset.groupId = request.groupId;
    }

    const titleLine = document.createElement('div');
    titleLine.className = 'request-title-line';
    const title = document.createElement('p');
    title.className = 'request-title';
    title.textContent = householdDisplayName(request.createdByUid, usersByUid);

    const pillGroup = document.createElement('div');
    pillGroup.className = 'request-pill-group';

    if (request.groupId && Number(request.groupSize || 0) > 1) {
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

    const statusPill = document.createElement('span');
    statusPill.className = `status-pill status-${request.status || 'open'}`;
    statusPill.textContent = statusLabel(request.status);
    pillGroup.appendChild(statusPill);

    const meta = document.createElement('p');
    meta.className = 'request-meta';
    const kidCount = request.kidCount || 1;
    const kidsText = `${kidCount} kid${kidCount > 1 ? 's' : ''}`;
    const audienceText = request.visibility === 'subset' ? 'Selected people' : 'All club';
    meta.textContent = `${formatDateTimeLong(request.whenISO)} · ${kidsText} · ${audienceText}`;

    titleLine.appendChild(title);
    titleLine.appendChild(pillGroup);
    row.appendChild(titleLine);
    row.appendChild(meta);
    row.addEventListener('click', () => {
        if (isMine(request.createdByUid)) {
            openEditRequestModal(request);
            return;
        }
        openRequestModal(request, meta.textContent);
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
    requestModalTitle.textContent = request.title || `${request.kidCount || 1} kid request`;
    requestModalMeta.textContent = metaText;
    requestModalDetails.textContent = `${request.details || 'No details yet.'}\n\nKids: ${request.kidCount || 1}`;
    renderRequestGroupInModal(request);

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
                openEditRequestModal(request);
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
    const mine = state.requests.filter((request) => isMine(request.createdByUid));
    const openItems = mine
        .filter((request) => request.status === 'open' || request.status === 'accepted')
        .sort(byRequestDateAsc);
    const oldItems = mine
        .filter((request) => request.status !== 'open' && request.status !== 'accepted')
        .sort(byRequestDateAsc);
    const visible = state.showOldMine ? [...openItems, ...oldItems] : openItems;
    const usersByUid = userMap();

    myRequestsList.innerHTML = '';
    visible.forEach((request) => myRequestsList.appendChild(makeRequestRow(request, usersByUid)));

    if (visible.length === 0) {
        myRequestsList.innerHTML = '<p class="empty-state">No requests yet. Hit "New Request" to add one.</p>';
    }
    btnToggleMyOld.textContent = state.showOldMine ? 'Hide old requests' : 'Show old requests';
}

function renderOthersRequests() {
    const others = state.requests
        .filter((request) => !isMine(request.createdByUid))
        .filter((request) => requestVisibleToCurrentUser(request));
    const openItems = others.filter((request) => request.status === 'open').sort(byRequestDateAsc);
    const oldItems = others.filter((request) => request.status !== 'open').sort(byRequestDateAsc);
    const visible = state.showOldOthers ? [...openItems, ...oldItems] : openItems;
    const usersByUid = userMap();

    othersRequestsList.innerHTML = '';
    visible.forEach((request) => othersRequestsList.appendChild(makeRequestRow(request, usersByUid)));
    if (visible.length === 0) {
        othersRequestsList.innerHTML = '<p class="empty-state">No open club requests yet.</p>';
    }
    btnToggleOthersOld.textContent = state.showOldOthers ? 'Hide older requests' : 'Show older requests';
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
        upcomingList.appendChild(makeRequestRow(request, usersByUid));
    });
}

function renderClubMembers() {
    const usersByUid = userMap();
    const memberIds = new Set(state.currentProfile?.clubMemberUids || []);
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
    const partnerUid = state.currentProfile?.householdPartnerUid;
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
    if (!state.isAdmin) {
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

function buildAddPeopleModal() {
    const myClub = new Set(state.currentProfile?.clubMemberUids || []);
    const myClubArray = [...myClub];
    const pendingTo = new Set(state.outgoingClubInvites.map((invite) => invite.toUid));

    const candidates = state.users
        .filter((user) => user.uid !== state.currentUser.uid)
        .filter((user) => !myClub.has(user.uid))
        .map((user) => {
            const theirClub = new Set(user.clubMemberUids || []);
            const score = myClubArray.filter((uid) => theirClub.has(uid)).length;
            return { user, score };
        })
        .sort((a, b) => b.score - a.score || (a.user.displayName || '').localeCompare(b.user.displayName || ''));

    addPeopleList.innerHTML = '';
    candidates.forEach(({ user, score }) => {
        const row = document.createElement('div');
        row.className = 'invite-row';
        const isPending = pendingTo.has(user.uid);
        row.innerHTML = `
            <span>${user.displayName || user.email} <span class="muted small">(${score} shared club links)</span></span>
            <button type="button" class="btn btn-ghost btn-small" data-send-club="${user.uid}" ${isPending ? 'disabled' : ''}>
                ${isPending ? 'Invite pending' : 'Invite'}
            </button>
        `;
        addPeopleList.appendChild(row);
    });

    if (candidates.length === 0) {
        addPeopleList.innerHTML = '<p class="empty-state">Everyone currently in the system is already in your club.</p>';
    }
}

function buildHouseholdModal() {
    householdCandidateList.innerHTML = '';
    const candidates = state.users
        .filter((user) => user.uid !== state.currentUser.uid)
        .filter((user) => !user.householdPartnerUid || user.householdPartnerUid === state.currentUser.uid);

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
    const clubSet = new Set(state.currentProfile?.clubMemberUids || []);
    const allowedUids = request.visibility === 'subset'
        ? new Set(request.visibilityUids || [])
        : clubSet;
    const candidateUids = [...allowedUids].filter((uid) => !isMine(uid));
    return groupUidsByHousehold(candidateUids, usersByUid);
}

function buildFilledByOptions(householdGroups, selectedUid = '') {
    const options = ['<option value="">Not filled</option>'];
    householdGroups.forEach((group) => {
        const selected = group.uids.includes(selectedUid) ? 'selected' : '';
        options.push(`<option value="${group.primaryUid}" ${selected}>${group.label}</option>`);
    });
    return options.join('');
}

function addEditOrDateRow(dateValue, timeValue = '18:00', acceptedByUid = '', assignableUsers = []) {
    const idx = editOrDatesList.querySelectorAll('[data-edit-or-date]').length + 1;
    const minDate = toDateInputValue(new Date());
    const row = document.createElement('div');
    row.className = 'inline-date-row';
    row.dataset.editRow = '';
    row.dataset.editOrDate = String(idx);
    row.innerHTML = `
        <div class="date-click-target"><input type="date" value="${dateValue}" min="${minDate}" /></div>
        <select>${buildTimeOptions(timeValue)}</select>
        <button type="button" class="btn btn-ghost btn-small fill-toggle" data-fill-toggle>Not filled</button>
        <select class="fill-person edit-filled-by" hidden>${buildFilledByOptions(assignableUsers, acceptedByUid || '')}</select>
        <button type="button" class="row-remove" data-remove-edit-or-date="${idx}" aria-label="Remove this date" title="Remove">&times;</button>
    `;
    editOrDatesList.appendChild(row);
    refreshPrimaryDateRemoveButtons();
}

function allEditDateRows() {
    const rows = [];
    const primaryRow = editRequestForm?.querySelector('[data-edit-primary-row]');
    if (primaryRow) {
        rows.push(primaryRow);
    }
    rows.push(...editOrDatesList.querySelectorAll('[data-edit-or-date]'));
    return rows;
}

function getEditFilledRow() {
    return allEditDateRows().find((row) => (
        row.querySelector('[data-fill-toggle]')?.classList.contains('is-filled')
    )) || null;
}

function applyEditFillState(filledRow) {
    allEditDateRows().forEach((row) => {
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
            if (!isFilled) {
                person.value = '';
            } else if (!person.value) {
                const firstReal = Array.from(person.options).find((opt) => opt.value);
                if (firstReal) {
                    person.value = firstReal.value;
                }
            }
        }
        row.querySelectorAll('input[type="date"], select:not(.fill-person), [data-remove-edit-or-date], #btn-edit-remove-primary-date').forEach((el) => {
            el.disabled = isDimmed;
        });
    });
}

function toggleEditFillRow(row) {
    if (!row) {
        return;
    }
    const toggle = row.querySelector('[data-fill-toggle]');
    if (!toggle) {
        return;
    }
    applyEditFillState(toggle.classList.contains('is-filled') ? null : row);
}

function openEditRequestModal(request) {
    if (!request || !editRequestForm) {
        return;
    }
    const grouped = getGroupedRequests(request);
    const primary = grouped[0] || request;
    const assignableUsers = getAssignableHouseholdsForRequest(request);
    const { date, time } = splitIsoToDateTime(primary.whenISO);
    editRequestId.value = request.id;
    editRequestDate.value = date;
    editRequestTime.innerHTML = buildTimeOptions(time || '18:00');
    editRequestFilledBy.innerHTML = buildFilledByOptions(assignableUsers, primary.acceptedByUid || '');
    editRequestDetails.value = request.details || '';
    editRequestKidCount.value = String(request.kidCount || 1);
    editOrDatesList.innerHTML = '';

    const orItems = grouped.slice(1);
    orItems.forEach((item) => {
        const split = splitIsoToDateTime(item.whenISO);
        addEditOrDateRow(split.date, split.time || '18:00', item.acceptedByUid || '', assignableUsers);
    });

    refreshPrimaryDateRemoveButtons();

    let filledRow = null;
    if (primary.acceptedByUid) {
        filledRow = editRequestForm.querySelector('[data-edit-primary-row]');
    } else {
        const orRows = Array.from(editOrDatesList.querySelectorAll('[data-edit-or-date]'));
        const filledIdx = orItems.findIndex((item) => Boolean(item.acceptedByUid));
        if (filledIdx >= 0) {
            filledRow = orRows[filledIdx] || null;
        }
    }
    applyEditFillState(filledRow);

    openModal(editRequestModal);
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

function addOrDateInput() {
    const currentCount = Number(orDateCount.value);
    if (currentCount >= 5) {
        authStatus.textContent = 'You can add up to 5 date options.';
        return;
    }
    const nextIndex = currentCount + 1;
    const defaultDate = getNextFridayDate();
    const row = document.createElement('div');
    row.className = 'inline-date-row';
    const minDate = toDateInputValue(new Date());
    row.innerHTML = `
        <div class="date-click-target"><input type="date" name="orDate${nextIndex}" value="${toDateInputValue(defaultDate)}" min="${minDate}" /></div>
        <select name="orTime${nextIndex}">${buildTimeOptions('18:00')}</select>
        <button type="button" class="row-remove" data-remove-or-date="${nextIndex}" aria-label="Remove this date" title="Remove">&times;</button>
    `;
    row.dataset.orDate = String(nextIndex);
    orDatesList.appendChild(row);
    orDateCount.value = String(nextIndex);
    refreshPrimaryDateRemoveButtons();
}

function rebuildOrDateCount() {
    const total = 1 + orDatesList.querySelectorAll('[data-or-date]').length;
    orDateCount.value = String(total);
}

function refreshPrimaryDateRemoveButtons() {
    const newHasExtras = orDatesList.querySelectorAll('[data-or-date]').length > 0;
    const editHasExtras = editOrDatesList.querySelectorAll('[data-edit-or-date]').length > 0;
    if (btnNewRemovePrimaryDate) {
        btnNewRemovePrimaryDate.hidden = !newHasExtras;
    }
    if (btnEditRemovePrimaryDate) {
        btnEditRemovePrimaryDate.hidden = !editHasExtras;
    }
}

function promoteFirstNewOrDateToPrimary() {
    const first = orDatesList.querySelector('[data-or-date]');
    if (!first) {
        return;
    }
    const dateInput = first.querySelector('input[type="date"]');
    const timeSelect = first.querySelector('select');
    if (newRequestDate && dateInput) {
        newRequestDate.value = dateInput.value;
    }
    if (newRequestTime && timeSelect) {
        newRequestTime.value = timeSelect.value;
    }
    first.remove();
    rebuildOrDateCount();
    refreshPrimaryDateRemoveButtons();
}

function promoteFirstEditOrDateToPrimary() {
    const first = editOrDatesList.querySelector('[data-edit-or-date]');
    if (!first) {
        return;
    }
    const dateInput = first.querySelector('input[type="date"]');
    const timeSelect = first.querySelector('select:not(.fill-person)');
    const filledBySelect = first.querySelector('select.fill-person');
    const firstWasFilled = first.querySelector('[data-fill-toggle]')?.classList.contains('is-filled');
    const primaryRow = editRequestForm?.querySelector('[data-edit-primary-row]');
    const primaryWasFilled = primaryRow?.querySelector('[data-fill-toggle]')?.classList.contains('is-filled');
    if (editRequestDate && dateInput) {
        editRequestDate.value = dateInput.value;
    }
    if (editRequestTime && timeSelect) {
        editRequestTime.value = timeSelect.value;
    }
    if (editRequestFilledBy && filledBySelect) {
        editRequestFilledBy.value = filledBySelect.value;
    }
    first.remove();
    refreshPrimaryDateRemoveButtons();
    if (primaryWasFilled || firstWasFilled) {
        applyEditFillState(primaryRow || null);
    } else {
        applyEditFillState(getEditFilledRow());
    }
}

function buildSubsetAudienceList() {
    subsetAudienceList.innerHTML = '';
    const clubSet = new Set(state.currentProfile?.clubMemberUids || []);
    const usersByUid = userMap();
    const candidateUids = [...clubSet].filter((uid) => !isMine(uid));
    const groups = groupUidsByHousehold(candidateUids, usersByUid);
    groups.forEach((group) => {
        const row = document.createElement('label');
        row.className = 'radio-line';
        row.innerHTML = `
            <input type="checkbox" name="subsetUid" value="${group.uids.join(',')}" />
            ${group.label}
        `;
        subsetAudienceList.appendChild(row);
    });
    if (!subsetAudienceList.children.length) {
        subsetAudienceList.innerHTML = '<p class="empty-state">No club members available yet.</p>';
    }
}

function resetRequestDateDefaults() {
    const nextFriday = getNextFridayDate();
    const todayValue = toDateInputValue(new Date());
    if (newRequestDate) {
        newRequestDate.min = todayValue;
        newRequestDate.value = toDateInputValue(nextFriday);
    }
    if (newRequestTime) {
        newRequestTime.innerHTML = buildTimeOptions('18:00');
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
            }

            showSignedIn(user, { preserveStatus: authStatus.textContent.length > 0 });
        } else {
            state.currentUser = null;
            state.currentProfile = null;
            state.isAdmin = false;
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

    bindClick(btnToggleOthersOld, () => {
        state.showOldOthers = !state.showOldOthers;
        renderOthersRequests();
    });

    bindClick(btnNewRequest, () => {
        if (newRequestForm) {
            newRequestForm.reset();
        }
        orDatesList.innerHTML = '';
        orDateCount.value = '1';
        resetRequestDateDefaults();
        kidOptions.forEach((btn, index) => {
            btn.classList.toggle('is-active', index === 0);
        });
        newRequestKidCount.value = '1';
        buildSubsetAudienceList();
        subsetAudienceList.hidden = true;
        refreshPrimaryDateRemoveButtons();
        openModal(newRequestModal);
    });
    bindClick(btnAddPeople, () => {
        buildAddPeopleModal();
        openModal(addPeopleModal);
    });
    bindClick(btnHouseholdAction, () => {
        if (state.currentProfile?.householdPartnerUid) {
            return;
        }
        buildHouseholdModal();
        openModal(householdModal);
    });

    bindClick(btnInviteLink, async () => {
        const inviteUrl = `${window.location.origin}${window.location.pathname}?inviteFrom=${state.currentUser.uid}`;
        try {
            await navigator.clipboard.writeText(inviteUrl);
            authStatus.textContent = 'Invite link copied. Share it anywhere you want.';
        } catch (err) {
            authStatus.textContent = `Could not copy link. Use this manually: ${inviteUrl}`;
        }
    });

    bindClick(btnAddOrDate, () => {
        addOrDateInput();
    });

    bindClick(btnNewRemovePrimaryDate, () => {
        promoteFirstNewOrDateToPrimary();
    });

    bindClick(btnEditAddOrDate, () => {
        const request = getRequestById(editRequestId.value);
        const assignableUsers = request ? getAssignableHouseholdsForRequest(request) : [];
        const currentCount = 1 + editOrDatesList.querySelectorAll('[data-edit-or-date]').length;
        if (currentCount >= 5) {
            authStatus.textContent = 'You can keep up to 5 date options.';
            return;
        }
        addEditOrDateRow(toDateInputValue(getNextFridayDate()), '18:00', '', assignableUsers);
        applyEditFillState(getEditFilledRow());
    });

    bindClick(btnEditRemovePrimaryDate, () => {
        promoteFirstEditOrDateToPrimary();
    });

    bindClick(btnEditDeleteRequest, async () => {
        const request = getRequestById(editRequestId.value);
        if (!request) {
            closeModal('edit-request-modal');
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
        closeModal('edit-request-modal');
        await refreshAndRender();
    });

    kidOptions.forEach((btn) => {
        btn.addEventListener('click', () => {
            const value = btn.dataset.kidCount || '1';
            newRequestKidCount.value = value;
            kidOptions.forEach((option) => option.classList.remove('is-active'));
            btn.classList.add('is-active');
        });
    });

    if (newRequestForm) {
        newRequestForm.addEventListener('change', (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) {
                return;
            }
            if (target.name === 'requestAudience') {
                subsetAudienceList.hidden = target.value !== 'subset';
            }
        });
    }

    if (newRequestForm) {
        newRequestForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = new FormData(newRequestForm);
            const whenValues = [];
            const primaryWhen = combineDateAndTime(String(form.get('date') || ''), String(form.get('time') || ''));
            if (primaryWhen) {
                whenValues.push(primaryWhen);
            }
            orDatesList.querySelectorAll('[data-or-date]').forEach((row) => {
                const dateInput = row.querySelector('input[type="date"]');
                const timeSelect = row.querySelector('select');
                const when = combineDateAndTime(dateInput?.value || '', timeSelect?.value || '');
                if (when) {
                    whenValues.push(when);
                }
            });
            const uniqueDates = [...new Set(whenValues)];
            if (!uniqueDates.length) {
                authStatus.textContent = 'Please choose at least one date and time.';
                return;
            }
            const audience = form.get('requestAudience') === 'subset' ? 'subset' : 'all';
            const subsetUids = audience === 'subset'
                ? [...new Set(
                    Array.from(form.getAll('subsetUid'))
                        .flatMap((value) => String(value).split(','))
                        .filter(Boolean),
                )]
                : [];
            const details = String(form.get('details') || '').trim();
            const kidCount = Number(form.get('kidCount') || 1);
            const requestTitle = `${kidCount} kid${kidCount > 1 ? 's' : ''} babysitting request`;
            const groupId = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);

            const createDocs = uniqueDates.map((whenISO, index) => addDoc(collection(db, 'requests'), {
                title: requestTitle,
                details,
                whenISO,
                createdByUid: state.currentUser.uid,
                createdByName: state.currentUser.displayName || state.currentUser.email || 'Unknown',
                kidCount,
                status: 'open',
                visibility: audience,
                visibilityUids: audience === 'subset' ? subsetUids : [],
                groupId,
                groupSize: uniqueDates.length,
                groupIndex: index,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                acceptedByUid: null,
            }));
            await Promise.all(createDocs);
            closeModal('new-request-modal');
            newRequestForm.reset();
            orDatesList.innerHTML = '';
            subsetAudienceList.hidden = true;
            await refreshAndRender();
        });
    }

    if (editRequestForm) {
        editRequestForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const request = getRequestById(editRequestId.value);
            if (!request) {
                closeModal('edit-request-modal');
                return;
            }
            const baseGroup = getGroupedRequests(request);
            const options = [{
                whenISO: combineDateAndTime(editRequestDate.value, editRequestTime.value),
                acceptedByUid: editRequestFilledBy?.value || '',
            }];
            editOrDatesList.querySelectorAll('[data-edit-or-date]').forEach((row) => {
                const dateInput = row.querySelector('input[type="date"]');
                const timeSelect = row.querySelector('select:not(.edit-filled-by)');
                const filledBySelect = row.querySelector('select.edit-filled-by');
                const whenISO = combineDateAndTime(dateInput?.value || '', timeSelect?.value || '');
                if (whenISO) {
                    options.push({
                        whenISO,
                        acceptedByUid: filledBySelect?.value || '',
                    });
                }
            });
            const uniqueOptionMap = new Map();
            options.forEach((item) => {
                if (!item.whenISO) {
                    return;
                }
                uniqueOptionMap.set(item.whenISO, item);
            });
            const normalizedOptions = [...uniqueOptionMap.values()].sort((a, b) => byRequestDateAsc(a, b));

            if (!normalizedOptions.length) {
                authStatus.textContent = 'Please include at least one date option.';
                return;
            }

            const kidCount = Number(editRequestKidCount.value || 1);
            const details = editRequestDetails.value.trim();
            const title = `${kidCount} kid${kidCount > 1 ? 's' : ''} babysitting request`;
            const groupId = normalizedOptions.length > 1
                ? (request.groupId || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`))
                : null;

            const acceptedIndex = normalizedOptions.findIndex((item) => Boolean(item.acceptedByUid));
            if (acceptedIndex >= 0) {
                normalizedOptions.forEach((item, idx) => {
                    if (idx !== acceptedIndex) {
                        item.acceptedByUid = '';
                    }
                });
            }
            const shared = {
                details,
                kidCount,
                title,
                visibility: request.visibility || 'all',
                visibilityUids: request.visibilityUids || [],
                updatedAt: serverTimestamp(),
            };

            const keepDocs = baseGroup.slice(0, normalizedOptions.length);
            const removeDocs = baseGroup.slice(normalizedOptions.length);
            const addOptions = normalizedOptions.slice(baseGroup.length);

            const batch = writeBatch(db);
            keepDocs.forEach((docItem, idx) => {
                const option = normalizedOptions[idx];
                const isAccepted = Boolean(option.acceptedByUid);
                batch.update(doc(db, 'requests', docItem.id), {
                    ...shared,
                    whenISO: option.whenISO,
                    groupId,
                    groupSize: normalizedOptions.length,
                    groupIndex: idx,
                    status: isAccepted ? 'accepted' : (acceptedIndex >= 0 ? 'superseded' : 'open'),
                    acceptedByUid: option.acceptedByUid || null,
                });
            });
            removeDocs.forEach((docItem) => {
                batch.delete(doc(db, 'requests', docItem.id));
            });
            await batch.commit();

            if (addOptions.length) {
                await Promise.all(addOptions.map((option, idx) => {
                    const isAccepted = Boolean(option.acceptedByUid);
                    return addDoc(collection(db, 'requests'), {
                    ...shared,
                    whenISO: option.whenISO,
                    createdByUid: request.createdByUid,
                    createdByName: request.createdByName,
                    status: isAccepted ? 'accepted' : (acceptedIndex >= 0 ? 'superseded' : 'open'),
                    acceptedByUid: option.acceptedByUid || null,
                    groupId,
                    groupSize: normalizedOptions.length,
                    groupIndex: baseGroup.length + idx,
                    createdAt: serverTimestamp(),
                });
                }));
            }

            closeModal('edit-request-modal');
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
        if (fillToggle && editRequestForm?.contains(fillToggle)) {
            if (!fillToggle.disabled) {
                toggleEditFillRow(fillToggle.closest('.inline-date-row'));
            }
            return;
        }

        const closeId = target.dataset.close;
        if (closeId) {
            closeModal(closeId);
            return;
        }

        const removeOrDate = target.dataset.removeOrDate;
        if (removeOrDate) {
            const row = orDatesList.querySelector(`[data-or-date="${removeOrDate}"]`);
            if (row) {
                row.remove();
                rebuildOrDateCount();
                refreshPrimaryDateRemoveButtons();
            }
            return;
        }

        const removeEditOrDate = target.dataset.removeEditOrDate;
        if (removeEditOrDate) {
            const row = editOrDatesList.querySelector(`[data-edit-or-date="${removeEditOrDate}"]`);
            if (row) {
                row.remove();
                refreshPrimaryDateRemoveButtons();
                applyEditFillState(getEditFilledRow());
            }
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
            closeModal('add-people-modal');
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
