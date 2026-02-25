class SharePopup {
    constructor() {
        this.overlay = null;
        this.currentRoutineId = null;
        this.currentRoutine = null;
        this.sharedUsers = [];
        this.searchResults = [];
        this.auth = firebase.auth();
        this.db = firebase.firestore();
        this.init();
    }

    init() {
        // Create popup elements if they don't exist
        this.createPopupElements();
        this.bindEvents();
    }

    createPopupElements() {
        // Check if popup already exists
        if (document.getElementById('share-popup-overlay')) {
            this.overlay = document.getElementById('share-popup-overlay');
            return;
        }

        // Create popup HTML
        const popupHTML = `
            <div id="share-popup-overlay" class="popup-overlay">
                <div class="share-popup-content">
                    <div class="share-popup-header">
                        <h2 class="share-popup-title">Condividi '<span id="share-routine-name">Scheda</span>'</h2>
                        <button class="close-btn" id="close-share-popup">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <div class="share-popup-body">
                        <!-- Search Users -->
                        <div class="search-users-section">
                            <div class="search-input-wrapper">
                                <i class="fas fa-search search-icon"></i>
                                <input 
                                    type="text" 
                                    id="user-search-input" 
                                    placeholder="Aggiungi persone, gruppi, spazi ed eventi di calendario"
                                    class="search-input"
                                >
                            </div>
                            <div id="search-results" class="search-results"></div>
                        </div>

                        <!-- Shared Users List -->
                        <div class="shared-users-section">
                            <h3 class="section-title">Persone con accesso</h3>
                            <div id="shared-users-list" class="shared-users-list">
                                <!-- Shared users will be loaded here -->
                            </div>
                        </div>
                    </div>

                    <div class="share-popup-actions">
                        <button class="custom-popup-btn secondary" id="cancel-share-btn">Annulla</button>
                        <button class="custom-popup-btn primary" id="send-share-btn">Invia condivisione</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', popupHTML);
        this.overlay = document.getElementById('share-popup-overlay');
    }

    bindEvents() {
        // Close popup events
        const closeBtn = document.getElementById('close-share-popup');
        const cancelBtn = document.getElementById('cancel-share-btn');
        
        if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.hide());
        
        // Close on overlay click
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.hide();
            }
        });

        // Search input
        const searchInput = document.getElementById('user-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            searchInput.addEventListener('focus', () => this.showSearchResults());
        }

        // Send share button
        const sendBtn = document.getElementById('send-share-btn');
        if (sendBtn) sendBtn.addEventListener('click', () => this.sendShare());

        // Close search results when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-users-section')) {
                this.hideSearchResults();
            }
        });
    }

    async show(routineId, routine) {
        this.currentRoutineId = routineId;
        this.currentRoutine = routine;
        
        // Update routine name in title
        const routineNameEl = document.getElementById('share-routine-name');
        if (routineNameEl) {
            routineNameEl.textContent = routine.name || 'Scheda senza nome';
        }

        // Load current shared users
        await this.loadSharedUsers();
        
        // Reset search
        document.getElementById('user-search-input').value = '';
        this.hideSearchResults();
        
        // Show popup
        this.overlay.classList.add('show');
    }

    hide() {
        this.overlay.classList.remove('show');
        this.currentRoutineId = null;
        this.currentRoutine = null;
        this.sharedUsers = [];
        this.searchResults = [];
    }

    async loadSharedUsers() {
        if (!this.currentRoutineId) return;

        try {
            console.log("Loading shared users for routine:", this.currentRoutineId);
            const doc = await this.db.collection('routines').doc(this.currentRoutineId).get();
            if (doc.exists) {
                const routineData = doc.data();
                this.sharedUsers = [];
                
                console.log("Routine data:", routineData);
                
                // Add owner
                if (routineData.userId) {
                    console.log("Loading owner data for:", routineData.userId);
                    const ownerDoc = await this.db.collection('users').doc(routineData.userId).get();
                    if (ownerDoc.exists) {
                        const ownerData = ownerDoc.data();
                        this.sharedUsers.push({
                            uid: routineData.userId,
                            username: ownerData.username || 'Utente',
                            email: ownerData.email || '',
                            role: 'owner'
                        });
                        console.log("Owner added:", ownerData.username);
                    }
                }
                
                // Add shared users
                if (routineData.condivisioni && Array.isArray(routineData.condivisioni)) {
                    console.log("Loading shared users:", routineData.condivisioni);
                    for (const userId of routineData.condivisioni) {
                        if (userId !== routineData.userId) { // Don't duplicate owner
                            console.log("Loading user data for:", userId);
                            const userDoc = await this.db.collection('users').doc(userId).get();
                            if (userDoc.exists) {
                                const userData = userDoc.data();
                                this.sharedUsers.push({
                                    uid: userId,
                                    username: userData.username || 'Utente',
                                    email: userData.email || '',
                                    role: 'viewer'
                                });
                                console.log("Shared user added:", userData.username);
                            }
                        }
                    }
                }
                
                console.log("Final shared users list:", this.sharedUsers);
                this.renderSharedUsers();
            }
        } catch (error) {
            console.error('Error loading shared users:', error);
        }
    }

    renderSharedUsers() {
        const container = document.getElementById('shared-users-list');
        if (!container) return;

        container.innerHTML = '';

        this.sharedUsers.forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'shared-user-item';
            
            const initials = this.getInitials(user.username);
            const roleText = user.role === 'owner' ? 'Proprietario' : 'Può visualizzare';
            
            userEl.innerHTML = `
                <div class="shared-user-avatar">${initials}</div>
                <div class="shared-user-info">
                    <div class="shared-user-name">${user.username}</div>
                    <div class="shared-user-role ${user.role}">${roleText}</div>
                </div>
                ${user.role !== 'owner' ? `
                    <button class="remove-share-btn" data-uid="${user.uid}">
                        <i class="fas fa-times"></i>
                    </button>
                ` : ''}
            `;

            // Bind remove event
            const removeBtn = userEl.querySelector('.remove-share-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => this.removeShare(user.uid));
            }

            container.appendChild(userEl);
        });
    }

    async handleSearch(query) {
        if (!query || query.length < 2) {
            this.hideSearchResults();
            return;
        }

        try {
            console.log("Searching for users with query:", query);
            // Search users by username
            const snapshot = await this.db.collection('users')
                .where('username', '>=', query)
                .where('username', '<=', query + '\uf8ff')
                .limit(10)
                .get();

            this.searchResults = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                // Don't show current user or already shared users
                if (doc.id !== this.auth.currentUser?.uid && 
                    !this.sharedUsers.some(u => u.uid === doc.id)) {
                    this.searchResults.push({
                        uid: doc.id,
                        username: userData.username || 'Utente',
                        email: userData.email || ''
                    });
                }
            });

            console.log("Search results found:", this.searchResults.length);
            this.renderSearchResults();
            this.showSearchResults(); // Show results after rendering
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }

    renderSearchResults() {
        const container = document.getElementById('search-results');
        if (!container) return;

        if (this.searchResults.length === 0) {
            container.innerHTML = '<div class="no-results">Nessun utente trovato</div>';
            return;
        }

        container.innerHTML = '';
        this.searchResults.forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'search-result-item';
            
            const initials = this.getInitials(user.username);
            
            userEl.innerHTML = `
                <div class="search-result-avatar">${initials}</div>
                <div class="search-result-info">
                    <div class="search-result-username">${user.username}</div>
                    <div class="search-result-email">${user.email}</div>
                </div>
            `;

            userEl.addEventListener('click', () => this.addShare(user));
            container.appendChild(userEl);
        });
    }

    showSearchResults() {
        const container = document.getElementById('search-results');
        if (container && this.searchResults.length > 0) {
            container.classList.add('show');
        }
    }

    hideSearchResults() {
        const container = document.getElementById('search-results');
        if (container) {
            container.classList.remove('show');
        }
    }

    addShare(user) {
        // Check if user is already shared
        if (this.sharedUsers.some(u => u.uid === user.uid)) {
            return;
        }

        this.sharedUsers.push({
            ...user,
            role: 'viewer'
        });

        this.renderSharedUsers();
        this.hideSearchResults();
        document.getElementById('user-search-input').value = '';
    }

    async removeShare(userId) {
        this.sharedUsers = this.sharedUsers.filter(u => u.uid !== userId);
        this.renderSharedUsers();
        
        // Trigger cache refresh for the removed user
        if (window.CacheManager) {
            window.CacheManager.forceRefreshSharedRoutines(userId);
        }

        // Also remove from acceptedUsers in the database
        if (this.currentRoutineId) {
            try {
                const routineRef = this.db.collection('routines').doc(this.currentRoutineId);
                const doc = await routineRef.get();
                
                if (doc.exists) {
                    const routineData = doc.data();
                    const acceptedUsers = routineData.acceptedUsers || [];
                    
                    if (acceptedUsers.includes(userId)) {
                        const updatedAcceptedUsers = acceptedUsers.filter(uid => uid !== userId);
                        await routineRef.update({ acceptedUsers: updatedAcceptedUsers });
                        console.log("Removed user from acceptedUsers:", userId);
                    }
                }
            } catch (error) {
                console.error('Error removing user from acceptedUsers:', error);
            }
        }
    }

    async sendShare() {
        if (!this.currentRoutineId) return;

        try {
            console.log("Sending share for routine:", this.currentRoutineId);
            console.log("Current shared users:", this.sharedUsers);
            
            const sharedUserIds = this.sharedUsers
                .filter(u => u.role === 'viewer')
                .map(u => u.uid);

            // Get current accepted users to preserve them
            const routineRef = this.db.collection('routines').doc(this.currentRoutineId);
            const doc = await routineRef.get();
            const currentAcceptedUsers = doc.exists ? (doc.data().acceptedUsers || []) : [];
            
            // Determine which users to remove from acceptedUsers (those who were previously shared but are no longer)
            const usersToRemoveFromAccepted = currentAcceptedUsers.filter(uid => !sharedUserIds.includes(uid) && uid !== this.auth.currentUser?.uid);

            const updateData = {
                condivisioni: sharedUserIds,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Only update acceptedUsers if there are changes
            if (usersToRemoveFromAccepted.length > 0) {
                const updatedAcceptedUsers = currentAcceptedUsers.filter(uid => sharedUserIds.includes(uid) || uid === this.auth.currentUser?.uid);
                updateData.acceptedUsers = updatedAcceptedUsers;
            }

            console.log("Updating document with:", updateData);
            
            await routineRef.update(updateData);
            
            console.log("Share successfully saved to database");

            // Trigger cache refresh for all affected users
            for (const userId of sharedUserIds) {
                if (window.CacheManager) {
                    window.CacheManager.forceRefreshSharedRoutines(userId);
                }
            }
            
            // Also trigger cache refresh for users removed from acceptedUsers
            for (const userId of usersToRemoveFromAccepted) {
                if (window.CacheManager) {
                    window.CacheManager.forceRefreshSharedRoutines(userId);
                }
            }

            // Show success message
            if (window.showAlert) {
                await window.showAlert('Scheda condivisa con successo!', 'Condivisione completata');
            } else {
                alert('Scheda condivisa con successo!');
            }

            this.hide();
        } catch (error) {
            console.error('Error sharing routine:', error);
            console.error('Error details:', error.message, error.code);
            
            if (window.showAlert) {
                await window.showAlert('Errore durante la condivisione della scheda: ' + error.message, 'Errore');
            } else {
                alert('Errore durante la condivisione della scheda: ' + error.message);
            }
        }
    }

    getInitials(name) {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
}

// Initialize and make globally available
window.SharePopup = new SharePopup();

// Global function to show share popup
window.showSharePopup = async (routineId) => {
    try {
        const db = firebase.firestore();
        const doc = await db.collection('routines').doc(routineId).get();
        if (doc.exists) {
            const routine = { id: doc.id, ...doc.data() };
            window.SharePopup.show(routineId, routine);
        }
    } catch (error) {
        console.error('Error loading routine for sharing:', error);
    }
};
