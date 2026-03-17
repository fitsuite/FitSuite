document.addEventListener('DOMContentLoaded', () => {
    // Funzione per verificare la connessione
    function checkConnection() {
        if (!navigator.onLine) {
            showErrorToast('Non sei collegato alla rete. Controlla la tua connessione internet.', 'Nessuna Connessione', 8000);
        }
    }
    
    // Controlla la connessione al caricamento della pagina
    checkConnection();
    
    // Ascolta i cambiamenti di stato della connessione
    window.addEventListener('online', () => {
        showSuccessToast('Connessione ripristinata', 'Online');
    });
    
    window.addEventListener('offline', () => {
        showErrorToast('Connessione persa. Non sei collegato alla rete.', 'Offline', 8000);
    });
    
    const auth = firebase.auth();
    const db = firebase.firestore();
    const routinesContainer = document.getElementById('routines-container');
    const searchInput = document.getElementById('search-bar');
    const refreshBtn = document.getElementById('refresh-btn');

    // Inizializza la loading screen
    window.LoadingManager.show([
        'Inizializzazione pagina...',
        'Caricamento preferenze utente...',
        'Caricamento schede condivise...',
        'Preparazione interfaccia...'
    ]);

    let allRoutines = []; // Store shared routines for client-side filtering

    const colorMap = {
        'Arancione': '#ff6600',
        'Verde': '#4ade80',
        'Blu': '#3b82f6',
        'Rosa': '#f472b6'
    };

    const colorRGBMap = {
        'Arancione': '255, 102, 0',
        'Verde': '74, 222, 128',
        'Blu': '59, 130, 246',
        'Rosa': '244, 114, 182'
    };

    const gradientMap = {
        'Arancione': 'linear-gradient(135deg, #2b1d16 0%, #1a1a1a 100%)',
        'Verde': 'linear-gradient(135deg, #1a2b16 0%, #1a1a1a 100%)',
        'Blu': 'linear-gradient(135deg, #161d2b 0%, #1a1a1a 100%)',
        'Rosa': 'linear-gradient(135deg, #2b1625 0%, #1a1a1a 100%)'
    };

    function setPrimaryColor(colorName) {
        const hex = colorMap[colorName] || colorMap['Arancione'];
        const rgb = colorRGBMap[colorName] || colorRGBMap['Arancione'];
        const gradient = gradientMap[colorName] || gradientMap['Arancione'];
        document.documentElement.style.setProperty('--primary-color', hex);
        document.documentElement.style.setProperty('--primary-color-rgb', rgb);
        document.documentElement.style.setProperty('--background-gradient', gradient);
    }

    async function loadUserPreferences(uid) {
        if (!window.CacheManager) return;
        
        // 1. Try Cache
        const prefs = window.CacheManager.getPreferences(uid);
        if (prefs && prefs.color) {
            setPrimaryColor(prefs.color);
            return;
        }

        // 2. Network Fallback (if CacheManager didn't have it)
        try {
            const doc = await db.collection('users').doc(uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.preferences) {
                    if (data.preferences.color) {
                        setPrimaryColor(data.preferences.color);
                    }
                    window.CacheManager.savePreferences(uid, data.preferences);
                }
            }
        } catch (error) {
            console.error("Error loading preferences:", error);
        }
    }

    function waitForSidebar() {
        return new Promise(resolve => {
            const start = Date.now();
            const check = () => {
                if (document.querySelector('.sidebar')) {
                    resolve();
                } else if (Date.now() - start > 5000) {
                    console.warn("Sidebar load timeout");
                    resolve();
                } else {
                    requestAnimationFrame(check);
                }
            };
            check();
        });
    }

    // Optimistic Load: Render immediately if we have a known user
    const lastUid = localStorage.getItem('lastUserId');
    if (lastUid) {
        console.log("Optimistic load for user:", lastUid);
        // Load preferences and routines immediately from cache
        loadUserPreferences(lastUid);
        fetchSharedRoutines(lastUid);
        // We don't await sidebar here to unblock rendering
        waitForSidebar();
    }

    auth.onAuthStateChanged(async user => {
        if (user) {
            // Check if user has username
            if (window.UsernameChecker) {
                const hasValidUsername = await window.UsernameChecker.enforceUsernameRequirement();
                if (!hasValidUsername) return;
            }

            // Update lastUserId if different (should be rare)
            if (user.uid !== lastUid) {
                localStorage.setItem('lastUserId', user.uid);
            }
            
            try {
                window.LoadingManager.nextStep('Caricamento preferenze utente...');
                await Promise.all([
                    loadUserPreferences(user.uid),
                    fetchSharedRoutines(user.uid),
                    waitForSidebar()
                ]);
                
                window.LoadingManager.nextStep('Preparazione interfaccia completata');
            } catch (error) {
                console.error("Error during initialization:", error);
            } finally {
                window.LoadingManager.hide();
            }
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            filterRoutines(searchTerm);
        });
    }

    // Refresh functionality
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            // Check throttle first
            if (window.CacheManager && !window.CacheManager.shouldRefreshSharedRoutines(auth.currentUser.uid)) {
                console.log('Refresh button clicked, but throttled (30s)');
                // Show a quick visual feedback
                refreshBtn.classList.add('success');
                setTimeout(() => refreshBtn.classList.remove('success'), 1000);
                return;
            }

            refreshBtn.classList.add('spinning');
            try {
                // Force cache refresh
                if (window.CacheManager) {
                    window.CacheManager.forceRefreshSharedRoutines(auth.currentUser.uid);
                }
                await fetchSharedRoutines(auth.currentUser.uid, true);
            } catch (error) {
                console.error('Error refreshing shared routines:', error);
            } finally {
                refreshBtn.classList.remove('spinning');
            }
        });
    }
    
    // Listen for cross-tab updates
    window.addEventListener('sharedRoutinesUpdatedFromOtherTab', () => {
        console.log('Shared routines updated in another tab, refreshing...');
        fetchSharedRoutines(auth.currentUser.uid, true);
    });

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.col-menu')) {
            document.querySelectorAll('.menu-dropdown').forEach(menu => {
                menu.classList.remove('active');
            });
        }
    });

    async function fetchSharedRoutines(uid, forceRefresh = false) {
        // 1. Check if we should perform an actual DB fetch based on throttle
        let shouldFetchFromDB = forceRefresh;
        
        if (window.CacheManager) {
            const cachedSharedRoutines = window.CacheManager.getSharedRoutines(uid);
            const isThrottled = !window.CacheManager.shouldRefreshSharedRoutines(uid);
            
            if (cachedSharedRoutines !== null) {
                // We have cache. Should we use it or fetch from DB?
                if (isThrottled && !forceRefresh) {
                    // Cache is fresh (less than 30s old) and not a forced refresh
                    console.log("Shared routines loaded from cache (throttled), skipping DB");
                    allRoutines = cachedSharedRoutines;
                    renderRoutines(allRoutines);
                    return;
                } else {
                    // Cache is older than 30s or it's a forced refresh
                    console.log("Shared cache expired (>30s) or forced refresh, preparing to fetch from DB");
                    shouldFetchFromDB = true;
                    // Render cache immediately for better UX while fetching
                    allRoutines = cachedSharedRoutines;
                    renderRoutines(allRoutines);
                }
            } else {
                // No cache at all
                shouldFetchFromDB = true;
            }
        } else {
            shouldFetchFromDB = true;
        }

        if (!shouldFetchFromDB) return;

        // Set loading state in CacheManager
        if (window.CacheManager) window.CacheManager.setLoading(uid, 'shared', true);

        try {
            console.log("Fetching shared routines from DB...");
            
            // Fetch only shared routines (not owned)
            const sharedSnapshot = await db.collection('routines')
                .where('condivisioni', 'array-contains', uid)
                .get();

            console.log("Found shared routines count:", sharedSnapshot.docs.length);

            allRoutines = [];
            
            // Process shared routines
            const processedIds = new Set(); // Track processed routine IDs to prevent duplicates
            const ownerIdsToFetch = new Set();
            const tempRoutines = [];
            
            for (const doc of sharedSnapshot.docs) {
                const routineData = doc.data();
                if (processedIds.has(doc.id)) continue;
                if (routineData.userId !== uid) {
                    processedIds.add(doc.id);
                    
                    // Check if owner name is ALREADY in the routine document (one request optimization)
                    if (routineData.ownerName) {
                        tempRoutines.push({ 
                            id: doc.id, 
                            ...routineData, 
                            isOwned: false,
                            ownerInfo: { username: routineData.ownerName }
                        });
                        continue;
                    }

                    // Check Cache for owner info
                    const cachedOwner = window.CacheManager ? window.CacheManager.getUserInfo(routineData.userId) : null;
                    if (cachedOwner) {
                        tempRoutines.push({ 
                            id: doc.id, 
                            ...routineData, 
                            isOwned: false,
                            ownerInfo: cachedOwner
                        });
                    } else {
                        ownerIdsToFetch.add(routineData.userId);
                        tempRoutines.push({ id: doc.id, ...routineData, isOwned: false });
                    }
                }
            }

            // Fetch all missing owners in one go (max 30 per query in Firestore 'in' operator)
            const ownersMap = new Map();
            if (ownerIdsToFetch.size > 0) {
                const ownerIdsArray = Array.from(ownerIdsToFetch);
                for (let i = 0; i < ownerIdsArray.length; i += 30) {
                    const chunk = ownerIdsArray.slice(i, i + 30);
                    const ownersSnapshot = await db.collection('users')
                        .where(firebase.firestore.FieldPath.documentId(), 'in', chunk)
                        .get();
                    ownersSnapshot.forEach(doc => {
                        const userData = doc.data();
                        ownersMap.set(doc.id, userData);
                        // Save to cache for next time
                        if (window.CacheManager) window.CacheManager.saveUserInfo(doc.id, userData);
                    });
                }
            }

            allRoutines = tempRoutines.map(routine => {
                if (routine.ownerInfo) return routine; // Already has info from routine doc or cache
                return {
                    ...routine,
                    ownerInfo: ownersMap.get(routine.userId) || { username: 'Utente', email: '' }
                };
            });

            console.log("Final shared routines count:", allRoutines.length);

            if (allRoutines.length === 0) {
                renderRoutines([]);
                if (window.CacheManager) {
                    window.CacheManager.saveSharedRoutines(uid, []);
                    window.CacheManager.setLoading(uid, 'shared', false);
                }
                return;
            }

            // Sort by createdAt descending
            allRoutines.sort((a, b) => {
                const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                return dateB - dateA;
            });

            // Update UI and Cache
            renderRoutines(allRoutines);
            if (window.CacheManager) {
                // Save top 20 to cache (deduplicated)
                window.CacheManager.saveSharedRoutines(uid, allRoutines.slice(0, 20));
                window.CacheManager.setLoading(uid, 'shared', false);
            }

        } catch (error) {
            console.error("Errore nel recupero delle schede condivise:", error);
            if (window.CacheManager) window.CacheManager.setLoading(uid, 'shared', false);
            // ... (rest of error handling)
            // If we have cache, we are fine (already rendered)
            // But if we failed and no cache, show error
            const cachedSharedRoutines = window.CacheManager && window.CacheManager.getSharedRoutines(uid);
            if (cachedSharedRoutines === null) {
                routinesContainer.innerHTML = '<div style="color: red; text-align: center; padding: 20px;">Errore nel caricamento delle schede condivise. Controlla la connessione.</div>';
            }
        }
    }

    function renderRoutines(routines) {
        // Remove duplicates before rendering
        const uniqueRoutines = [];
        const seenIds = new Set();
        
        for (const routine of routines) {
            if (!seenIds.has(routine.id)) {
                seenIds.add(routine.id);
                uniqueRoutines.push(routine);
            }
        }
        
        routinesContainer.innerHTML = '';

        if (uniqueRoutines.length === 0) {
            routinesContainer.innerHTML = '<div style="text-align: center; color: var(--text-gray); padding: 40px;">Nessuna scheda condivisa trovata.</div>';
            return;
        }

        uniqueRoutines.forEach(routine => {
            const routineItem = document.createElement('div');
            routineItem.className = 'routine-list-row';
            
            // Format Data
            const seduteText = `${routine.sedute || 0} sedute`;
            
            let periodText = '-';
            if (routine.startDate && routine.endDate) {
                try {
                    const start = routine.startDate.toDate();
                    const end = routine.endDate.toDate();
                    const options = { day: '2-digit', month: '2-digit', year: '2-digit' };
                    const startStr = start.toLocaleDateString('it-IT', options);
                    const endStr = end.toLocaleDateString('it-IT', options);
                    periodText = `${startStr} - ${endStr}`;
                } catch (e) {
                    console.error("Error formatting dates", e);
                }
            }

            // Get owner initials and create badge
            const ownerInitials = getInitials(routine.ownerInfo?.username || 'Utente');
            const isAccepted = routine.acceptedUsers && routine.acceptedUsers.includes(auth.currentUser.uid);
            const statusBadge = isAccepted ? 
                '<span class="accepted-badge">Accettata</span>' : 
                '<span class="pending-badge">In attesa</span>';

            routineItem.innerHTML = `
                <div class="col-menu">
                    <button class="menu-trigger">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="menu-dropdown">
                        <button class="menu-item view-btn">
                            <i class="fas fa-eye"></i> Visualizza
                        </button>
                        <button class="menu-item delete-btn delete">
                            <i class="fas fa-trash-alt"></i> Elimina
                        </button>
                    </div>
                </div>
                <div class="col-name" title="${routine.name || 'Scheda senza nome'}">
                    ${routine.name || 'Scheda senza nome'}
                    <div class="shared-status">
                        ${statusBadge}
                    </div>
                </div>
                <div class="col-owner">
                    <div class="shared-by-badge">
                        <div class="shared-by-avatar">${ownerInitials}</div>
                        <span>${routine.ownerInfo?.username || 'Utente'}</span>
                    </div>
                </div>
                <div class="col-sessions">${seduteText}</div>
                <div class="col-actions">
                    ${!isAccepted ? `
                        <div class="accept-reject-buttons">
                            <button class="accept-btn" data-id="${routine.id}">Accetta</button>
                            <button class="reject-btn" data-id="${routine.id}">Rifiuta</button>
                        </div>
                    ` : `
                        <a href="../visualizza_scheda/visualizza_scheda.html?id=${routine.id}" class="view-btn">Visualizza</a>
                    `}
                </div>
            `;

            // Menu Event Listeners
            const menuTrigger = routineItem.querySelector('.menu-trigger');
            const menuDropdown = routineItem.querySelector('.menu-dropdown');
            
            menuTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close other menus
                document.querySelectorAll('.menu-dropdown').forEach(m => {
                    if (m !== menuDropdown) m.classList.remove('active');
                });
                menuDropdown.classList.toggle('active');
            });

            // View Action from menu
            const viewBtn = routineItem.querySelector('.menu-item.view-btn');
            if (viewBtn) {
                viewBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    menuDropdown.classList.remove('active');
                    if (isAccepted) {
                        window.location.href = `../visualizza_scheda/visualizza_scheda.html?id=${routine.id}`;
                    } else {
                        if (await window.showConfirm("Devi prima accettare questa scheda condivisa. Vuoi accettarla ora?", "Accetta Scheda", "ACCETTA", "ANNULLA")) {
                        await acceptSharedRoutine(routine.id);
                    }
                    }
                });
            }

            // Delete Action
            const deleteBtn = routineItem.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    menuDropdown.classList.remove('active');
                    if (await window.showConfirm(`Sei sicuro di voler rimuovere la scheda condivisa "${routine.name}"?`, "Rimuovi Scheda", "RIMUOVI", "ANNULLA")) {
                        await removeSharedRoutine(routine.id);
                    }
                });
            }

            // Accept/Reject buttons
            const acceptBtn = routineItem.querySelector('.accept-btn');
            const rejectBtn = routineItem.querySelector('.reject-btn');
            
            if (acceptBtn) {
                acceptBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    await acceptSharedRoutine(routine.id);
                });
            }
            
            if (rejectBtn) {
                rejectBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (await window.showConfirm(`Sei sicuro di voler rifiutare la scheda "${routine.name}"?`, "Rifiuta Scheda", "RIFIUTA", "ANNULLA")) {
                        await removeSharedRoutine(routine.id);
                    }
                });
            }

            routinesContainer.appendChild(routineItem);
        });
    }

    async function acceptSharedRoutine(routineId) {
        try {
            const routineRef = db.collection('routines').doc(routineId);
            const doc = await routineRef.get();
            
            if (doc.exists) {
                const routineData = doc.data();
                const acceptedUsers = routineData.acceptedUsers || [];
                
                if (!acceptedUsers.includes(auth.currentUser.uid)) {
                    acceptedUsers.push(auth.currentUser.uid);
                    await routineRef.update({ acceptedUsers });
                    
                    // Update local data
                    const routine = allRoutines.find(r => r.id === routineId);
                    if (routine) {
                        routine.acceptedUsers = acceptedUsers;
                        renderRoutines(allRoutines);
                        // Update cache
                        if (window.CacheManager) {
                            window.CacheManager.saveSharedRoutines(auth.currentUser.uid, allRoutines.slice(0, 20));
                        }
                    }
                    
                    if (window.showSuccessToast) {
                        window.showSuccessToast('Scheda accettata con successo!', 'Condivisione accettata');
                    }
                }
            }
        } catch (error) {
            console.error('Error accepting shared routine:', error);
            if (window.showErrorToast) {
                window.showErrorToast('Errore durante l\'accettazione della scheda.', 'Errore');
            }
        }
    }

    async function removeSharedRoutine(routineId) {
        try {
            const routineRef = db.collection('routines').doc(routineId);
            const doc = await routineRef.get();
            
            if (doc.exists) {
                const routineData = doc.data();
                const condivisioni = routineData.condivisioni || [];
                const acceptedUsers = routineData.acceptedUsers || [];
                
                // Remove user from condivisioni and acceptedUsers
                const updatedCondivisioni = condivisioni.filter(uid => uid !== auth.currentUser.uid);
                const updatedAcceptedUsers = acceptedUsers.filter(uid => uid !== auth.currentUser.uid);
                
                await routineRef.update({ 
                    condivisioni: updatedCondivisioni,
                    acceptedUsers: updatedAcceptedUsers
                });
                
                // Remove from local data
                allRoutines = allRoutines.filter(r => r.id !== routineId);
                renderRoutines(allRoutines);
                
                // Update cache
                if (window.CacheManager) {
                    window.CacheManager.saveSharedRoutines(auth.currentUser.uid, allRoutines.slice(0, 20));
                }
                
                if (window.showSuccessToast) {
                    window.showSuccessToast('Scheda rimossa con successo!', 'Scheda rimossa');
                }
            }
        } catch (error) {
            console.error('Error removing shared routine:', error);
            if (window.showErrorToast) {
                window.showErrorToast('Errore durante la rimozione della scheda.', 'Errore');
            }
        }
    }

    function filterRoutines(searchTerm) {
        if (!searchTerm) {
            renderRoutines(allRoutines);
            return;
        }
        
        const filtered = allRoutines.filter(routine => {
            const name = (routine.name || '').toLowerCase();
            const ownerName = (routine.ownerInfo?.username || '').toLowerCase();
            return name.includes(searchTerm) || ownerName.includes(searchTerm);
        });
        
        renderRoutines(filtered);
    }

    function getInitials(name) {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return parts[0][0].toUpperCase() + parts[1][0].toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }
});
