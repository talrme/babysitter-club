import {
    onAuthStateChanged,
    signInWithPopup,
    signOut,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
    arrayRemove,
    arrayUnion,
    collection,
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
const householdStatus = document.getElementById('household-status');
const btnHouseholdAction = document.getElementById('btn-household-action');
const btnRemovePartner = document.getElementById('btn-remove-partner');

const btnNewRequest = document.getElementById('btn-new-request');
const btnAddPeople = document.getElementById('btn-add-people');
const btnInviteLink = document.getElementById('btn-invite-link');
const requestModal = document.getElementById('request-modal');
const requestModalTitle = document.getElementById('request-modal-title');
const requestModalMeta = document.getElementById('request-modal-meta');
const requestModalDetails = document.getElementById('request-modal-details');
const newRequestModal = document.getElementById('new-request-modal');
const newRequestForm = document.getElementById('new-request-form');
const addPeopleModal = document.getElementById('add-people-modal');
const addPeopleList = document.getElementById('add-people-list');
const householdModal = document.getElementById('household-modal');
const householdCandidateList = document.getElementById('household-candidate-list');
const removeClubModal = document.getElementById('remove-club-modal');
const btnConfirmRemoveClub = document.getElementById('btn-confirm-remove-club');

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
    signedInSections.forEach((section) => {
        section.hidden = false;
    });
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

async function loadAppData() {
    const [usersSnap, requestsSnap, outgoingClubInvitesSnap, clubInvitesSnap, householdInvitesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'requests'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'clubInvites'), where('fromUid', '==', state.currentUser.uid), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'clubInvites'), where('toUid', '==', state.currentUser.uid), where('status', '==', 'pending'))),
        getDocs(query(collection(db, 'householdInvites'), where('toUid', '==', state.currentUser.uid), where('status', '==', 'pending'))),
    ]);

    state.users = usersSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    state.requests = requestsSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    state.outgoingClubInvites = outgoingClubInvitesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    state.clubInvites = clubInvitesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    state.householdInvites = householdInvitesSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    state.currentProfile = state.users.find((user) => user.uid === state.currentUser.uid) || null;
}

function makeRequestRow(request, usersByUid) {
    const owner = usersByUid.get(request.createdByUid);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'request-row';

    const title = document.createElement('p');
    title.className = 'request-title';
    title.textContent = request.title || 'Untitled request';

    const meta = document.createElement('p');
    meta.className = 'request-meta';
    meta.textContent = `${formatDateTime(request.whenISO)} · ${owner?.displayName || 'Unknown'} · ${request.status || 'open'}`;

    row.appendChild(title);
    row.appendChild(meta);
    row.addEventListener('click', () => {
        requestModalTitle.textContent = request.title || 'Request details';
        requestModalMeta.textContent = meta.textContent;
        requestModalDetails.textContent = request.details || 'No details yet.';
        openModal(requestModal);
    });

    return row;
}

function renderMyRequests() {
    const mine = state.requests.filter((request) => request.createdByUid === state.currentUser.uid);
    const openItems = mine.filter((request) => request.status === 'open');
    const oldItems = mine.filter((request) => request.status !== 'open');
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
    const clubSet = new Set(state.currentProfile?.clubMemberUids || []);
    const others = state.requests.filter((request) => request.createdByUid !== state.currentUser.uid);
    const clubVisible = others.filter((request) => clubSet.has(request.createdByUid));
    const openItems = clubVisible.filter((request) => request.status === 'open');
    const oldItems = clubVisible.filter((request) => request.status !== 'open');
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
        .filter((request) => request.acceptedByUid === state.currentUser.uid && request.whenISO)
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
    upcoming.forEach((request) => {
        const row = document.createElement('div');
        row.className = 'invite-row';
        row.innerHTML = `<span>${request.title}</span><span class="muted small">${formatDateTime(request.whenISO)}</span>`;
        upcomingList.appendChild(row);
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
    if (state.outgoingClubInvites.length === 0) {
        outgoingClubInvites.innerHTML = '<p class="empty-state">No pending invites sent.</p>';
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
    if (uniqueIncoming.length === 0) {
        incomingClubInvites.innerHTML = '<p class="empty-state">No pending club invites.</p>';
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
    if (state.householdInvites.length === 0) {
        incomingHouseholdInvites.innerHTML = '<p class="empty-state">No pending household invites.</p>';
    }
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
            let profileSyncFailed = false;
            try {
                await ensureUserProfile(user);
                await refreshAndRender();
            } catch (err) {
                console.error('Failed to sync user profile:', err);
                authStatus.textContent = 'Signed in, but profile sync failed. Please refresh.';
                profileSyncFailed = true;
            }
            showSignedIn(user, { preserveStatus: profileSyncFailed });
        } else {
            state.currentUser = null;
            state.currentProfile = null;
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

    bindClick(btnNewRequest, () => openModal(newRequestModal));
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

    if (newRequestForm) {
        newRequestForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = new FormData(newRequestForm);
            await addDoc(collection(db, 'requests'), {
                title: form.get('title'),
                details: form.get('details'),
                whenISO: form.get('when'),
                createdByUid: state.currentUser.uid,
                createdByName: state.currentUser.displayName || state.currentUser.email || 'Unknown',
                status: 'open',
                visibility: 'club',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                acceptedByUid: null,
            });
            closeModal('new-request-modal');
            newRequestForm.reset();
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

        const closeId = target.dataset.close;
        if (closeId) {
            closeModal(closeId);
            return;
        }

        const removeClubData = target.dataset.removeClub;
        if (removeClubData) {
            state.pendingClubRemovalUids = removeClubData.split(',').filter(Boolean);
            openModal(removeClubModal);
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
