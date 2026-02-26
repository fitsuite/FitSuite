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
                        <button class="custom-popup-btn secondary" id="cancel-share-btn">Chiudi</button>
                        <button class="custom-popup-btn primary" id="send-share-btn">Conferma</button>
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

    async hide() {
        // Auto-save before closing
        await this.saveShareChanges();
        
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

        // Check if user is authenticated
        if (!this.auth.currentUser) {
            console.error('No authenticated user found for search');
            return;
        }

        try {
            console.log("Searching for users with query:", query);
            console.log("Current user UID:", this.auth.currentUser.uid);
            console.log("Already shared users:", this.sharedUsers.map(u => u.uid));
            
            // Search users by username
            const snapshot = await this.db.collection('users')
                .where('username', '>=', query)
                .where('username', '<=', query + '\uf8ff')
                .limit(10)
                .get();

            this.searchResults = [];
            snapshot.forEach(doc => {
                const userData = doc.data();
                console.log("Found user:", doc.id, userData.username);
                
                // Don't show current user or already shared users
                if (doc.id !== this.auth.currentUser.uid && 
                    !this.sharedUsers.some(u => u.uid === doc.id)) {
                    this.searchResults.push({
                        uid: doc.id,
                        username: userData.username || 'Utente',
                        email: userData.email || ''
                    });
                    console.log("Added to search results:", userData.username);
                }
            });

            console.log("Final search results:", this.searchResults.length);
            this.renderSearchResults();
            this.showSearchResults(); // Show results after rendering
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }

    renderSearchResults() {
        const container = document.getElementById('search-results');
        console.log("renderSearchResults called");
        console.log("Container:", container);
        console.log("Search results to render:", this.searchResults);
        
        if (!container) {
            console.log("Container not found!");
            return;
        }

        // Add test message to verify container is visible
        if (this.searchResults.length === 0) {
            container.innerHTML = '<div class="no-results">Nessun utente trovato</div>';
            console.log("No results message set");
            return;
        }

        container.innerHTML = '';
        console.log("Clearing container and rendering", this.searchResults.length, "users");
        
        this.searchResults.forEach(user => {
            const userEl = document.createElement('div');
            userEl.className = 'search-result-item';
            
            const initials = this.getInitials(user.username);
            
            userEl.innerHTML = `
                <div class="search-result-avatar">${initials}</div>
                <div class="search-result-info">
                    <div class="search-result-username">${user.username}</div>
                </div>
            `;

            userEl.addEventListener('click', () => this.addShare(user));
            container.appendChild(userEl);
            console.log("Added user to results:", user.username);
        });
    }

    showSearchResults() {
        const container = document.getElementById('search-results');
        console.log("showSearchResults called");
        console.log("Container:", container);
        console.log("Search results length:", this.searchResults.length);
        console.log("Search results:", this.searchResults);
        
        if (container && this.searchResults.length > 0) {
            container.classList.add('show');
            console.log("Added 'show' class to container");
        } else {
            console.log("Not showing results - container missing or no results");
        }
    }

    hideSearchResults() {
        const container = document.getElementById('search-results');
        if (container) {
            container.classList.remove('show');
        }
    }

    async addShare(user) {
        // Check if user is already in shared list
        if (this.sharedUsers.some(u => u.uid === user.uid)) {
            return;
        }

        this.sharedUsers.push({
            uid: user.uid,
            username: user.username,
            email: user.email,
            role: 'viewer'
        });

        this.renderSharedUsers();
        this.hideSearchResults();
        document.getElementById('user-search-input').value = '';
        
        // Auto-save immediately when adding a user
        await this.saveShareChanges();
    }

    async removeShare(userId) {
        this.sharedUsers = this.sharedUsers.filter(u => u.uid !== userId);
        this.renderSharedUsers();
        
        // Auto-save immediately when removing a user
        await this.saveShareChanges();
        
        // Trigger cache refresh for the removed user
        if (window.CacheManager) {
            window.CacheManager.forceRefreshSharedRoutines(userId);
        }
    }

    async saveShareChanges() {
        if (!this.currentRoutineId) return;

        try {
            console.log("Auto-saving share changes for routine:", this.currentRoutineId);
            
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

            console.log("Auto-saving document with:", updateData);
            
            await routineRef.update(updateData);
            
            console.log("Share changes auto-saved successfully");

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

        } catch (error) {
            console.error('Error auto-saving share changes:', error);
        }
    }

    async sendShare() {
        // This function now shows a toast notification
        if (window.showSuccessToast) {
            window.showSuccessToast('Condivisione salvata con successo!', 'Condivisione completata');
        }
        
        this.hide();
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
