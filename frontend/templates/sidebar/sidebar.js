document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Color Map for dynamic styling
    const colorMap = {
        'Arancione': '#ff6600',
        'Verde': '#4ade80',
        'Blu': '#3b82f6',
        'Rosa': '#f472b6'
    };

    const gradientMap = {
        'Arancione': 'linear-gradient(135deg, #2b1d16 0%, #1a1a1a 100%)',
        'Verde': 'linear-gradient(135deg, #1a2b16 0%, #1a1a1a 100%)',
        'Blu': 'linear-gradient(135deg, #161d2b 0%, #1a1a1a 100%)',
        'Rosa': 'linear-gradient(135deg, #2b1625 0%, #1a1a1a 100%)'
    };

    // Set initial primary color based on user preferences
    function setPrimaryColor(colorName) {
        const hex = colorMap[colorName] || colorMap['Arancione'];
        const gradient = gradientMap[colorName] || gradientMap['Arancione'];
        
        // Convert hex to rgb for opacity usage
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const rgb = `${r}, ${g}, ${b}`;

        document.documentElement.style.setProperty('--primary-color', hex);
        document.documentElement.style.setProperty('--primary-color-rgb', rgb);
        document.documentElement.style.setProperty('--background-gradient', gradient);
    }

    // Function to get Google Profile Picture URL
    function getGoogleProfilePictureUrl(email, size = 200) {
        return `https://www.google.com/s2/u/0/photos/public/id?sz=${size}&email=${encodeURIComponent(email)}`;
    }

    // Function to load user avatar with fallback to initial
    function loadUserAvatar(email, username, avatarElement, size = 200) {
        if (!avatarElement) return;
        
        const profilePicUrl = getGoogleProfilePictureUrl(email, size);
        const img = new Image();
        
        img.onload = function() {
            // If Google profile picture loads successfully, use it
            avatarElement.style.backgroundImage = `url(${profilePicUrl})`;
            avatarElement.style.backgroundSize = 'cover';
            avatarElement.style.backgroundPosition = 'center';
            avatarElement.textContent = ''; // Remove initial if image loads
        };
        
        img.onerror = function() {
            // Fallback to initial if image fails to load
            const initial = (username || email || 'U').charAt(0).toUpperCase();
            avatarElement.style.backgroundImage = 'none';
            avatarElement.textContent = initial;
        };
        
        // Start loading the image
        img.src = profilePicUrl;
    }

    // Make functions globally available
    window.getGoogleProfilePictureUrl = getGoogleProfilePictureUrl;
    window.loadUserAvatar = loadUserAvatar;
    window.setPrimaryColor = setPrimaryColor;

    // Listen for username updates
    window.addEventListener('usernameUpdated', (event) => {
        const { userId, username } = event.detail;
        const userUsernameSidebar = document.getElementById('user-username-sidebar');
        
        if (userUsernameSidebar && auth.currentUser && auth.currentUser.uid === userId) {
            userUsernameSidebar.textContent = `@${username}`;
            
            // Also update avatar if needed
            const userInitialSidebar = document.getElementById('user-initial-sidebar');
            if (userInitialSidebar) {
                loadUserAvatar(auth.currentUser.email, username, userInitialSidebar, 45);
            }
        }
    });

    // Listen for routines updates to refresh sidebar
    window.addEventListener('routinesUpdated', (event) => {
        const routines = event.detail;
        const userRoutineListSidebar = document.getElementById('user-routine-list-sidebar');
        if (userRoutineListSidebar) {
            console.log('Sidebar: routinesUpdated event received, re-rendering...');
            renderUserRoutines(routines, userRoutineListSidebar);
        }
    });

    // Listen for cross-tab routines updates
    window.addEventListener('routinesUpdatedFromOtherTab', () => {
        if (auth.currentUser) {
            const userRoutineListSidebar = document.getElementById('user-routine-list-sidebar');
            if (userRoutineListSidebar) {
                console.log('Sidebar: routinesUpdatedFromOtherTab event received, fetching...');
                fetchUserRoutines(auth.currentUser.uid, userRoutineListSidebar);
            }
        }
    });

    // Mobile Sidebar Logic
    function initMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const body = document.body;

        if (!sidebar) {
            // Retry if sidebar not yet loaded
            setTimeout(initMobileSidebar, 100);
            return;
        }

        // Set initial height and add resize listener for mobile
        setSidebarHeight();
        // Aggiungi listener per altezza dinamica su mobile (una sola volta)
        if (!window._sidebarListenersAdded) {
            window.addEventListener('resize', setSidebarHeight, { passive: true });
            window.addEventListener('orientationchange', setSidebarHeight, { passive: true });
            window._sidebarListenersAdded = true;
        }

        // Check if toggle button already exists
        if (!document.querySelector('.sidebar-toggle-btn')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'sidebar-toggle-btn';
            toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
            toggleBtn.onclick = toggleSidebar;
            body.appendChild(toggleBtn);
        }

        // Check if overlay already exists
        if (!document.querySelector('.sidebar-overlay')) {
            const overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.onclick = closeSidebar;
            body.appendChild(overlay);
        }
    }

    function setSidebarHeight() {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && window.innerWidth <= 992) { // Apply only on mobile
            sidebar.style.height = `${window.innerHeight}px`;
            sidebar.style.minHeight = `${window.innerHeight}px`;
        } else if (sidebar && window.innerWidth > 992) {
            // Reset height for desktop if it was set by JS
            sidebar.style.height = '';
            sidebar.style.minHeight = '';
        }
    }

    function toggleSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) {
            sidebar.classList.toggle('open');
            if (overlay) {
                overlay.classList.toggle('active', sidebar.classList.contains('open'));
                overlay.style.display = sidebar.classList.contains('open') ? 'block' : 'none';
                // Trigger reflow for transition
                if (sidebar.classList.contains('open')) {
                    setTimeout(() => overlay.style.opacity = '1', 10);
                } else {
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.style.display = 'none', 300);
                }
            }
        }
    }

    function closeSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.querySelector('.sidebar-overlay');
        if (sidebar) {
            sidebar.classList.remove('open');
            if (overlay) {
                overlay.classList.remove('active');
                overlay.style.opacity = '0';
                setTimeout(() => overlay.style.display = 'none', 300);
            }
        }
    }

    // Function to wait for sidebar to be loaded
    function waitForSidebar(callback, maxAttempts = 50) {
        let attempts = 0;
        const checkSidebar = () => {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                callback();
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkSidebar, 100);
            }
        };
        checkSidebar();
    }

    // Initialize mobile sidebar when DOM is ready
    waitForSidebar(initMobileSidebar);

    // Optimistic Load
    const lastUid = localStorage.getItem('lastUserId');
    if (lastUid) {
        // Apply theme immediately
        if (window.CacheManager) {
            const prefs = window.CacheManager.getPreferences(lastUid);
            if (prefs && prefs.color) setPrimaryColor(prefs.color);
        }
        
        // Try to load routines optimistically
        const optimisticSidebarLoad = () => {
            const listContainer = document.getElementById('user-routine-list-sidebar');
            if (listContainer) {
                console.log("Optimistic sidebar load for:", lastUid);
                fetchUserRoutines(lastUid, listContainer);
            } else {
                // If sidebar not injected yet, wait briefly (but not too long, let real auth take over if slow)
                setTimeout(optimisticSidebarLoad, 100);
            }
        };
        // Only try for a limited time to avoid conflict with real auth if it's fast
        // But actually, fetchUserRoutines is safe to call multiple times.
        optimisticSidebarLoad();
    }

    // Check Auth State and populate sidebar
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('User is signed in for sidebar:', user.email);
            
            // Setup Session Check (on load only)
            if (window.SessionManager) {
                const sessionId = localStorage.getItem('fitsuite_sessionId');
                if (sessionId) {
                    // One-time check for session validity on load
                    const userRef = db.collection('users').doc(user.uid);
                    
                    userRef.get().then((doc) => {
                        if (doc.exists) {
                            const data = doc.data();
                            const session = data.sessions ? data.sessions[sessionId] : null;
                            
                            if (!session || session.valid === false) {
                                console.log('Sessione invalidata o rimossa. Logout in corso...');
                                window.SessionManager.logoutLocal();
                            }
                        }
                    }).catch((error) => {
                        console.error('Errore nel controllo della sessione:', error);
                    });
                }
            }

            // Update lastUserId
            if (user.uid !== lastUid) {
                localStorage.setItem('lastUserId', user.uid);
            }

            // Fetch user preferences and apply theme
            const fetchPreferences = async () => {
                let shouldFetchFromDB = true;
                if (window.CacheManager) {
                    const prefs = window.CacheManager.getPreferences(user.uid);
                    if (prefs && prefs.color) {
                        setPrimaryColor(prefs.color);
                        if (!window.CacheManager.shouldFetch('preferences', user.uid)) {
                            console.log("Sidebar: Preferences loaded from cache (throttled), skipping DB");
                            shouldFetchFromDB = false;
                        }
                    }
                }

                if (shouldFetchFromDB) {
                    try {
                        console.log("Sidebar: Fetching preferences from DB...");
                        const userDoc = await db.collection('users').doc(user.uid).get();
                         if (userDoc.exists) {
                             const data = userDoc.data();
                             if (data.preferences) {
                                if (data.preferences.color) setPrimaryColor(data.preferences.color);
                                if (window.CacheManager) window.CacheManager.savePreferences(user.uid, data.preferences);
                            } else {
                                setPrimaryColor('Arancione');
                            }
                        } else {
                            setPrimaryColor('Arancione');
                        }
                    } catch (error) {
                        console.error("Error fetching user preferences for theme:", error);
                        setPrimaryColor('Arancione');
                    }
                }
            };

            fetchPreferences();

            // Function to update sidebar elements
            const updateSidebar = async () => {
                const userInitialSidebar = document.getElementById('user-initial-sidebar');
                const userRoutineListSidebar = document.getElementById('user-routine-list-sidebar');
                const userUsernameSidebar = document.getElementById('user-username-sidebar');

                let username = '@utente';
                
                // Load and display username from database
                if (userUsernameSidebar) {
                    let shouldFetchUsernameFromDB = true;
                    
                    // Try cache first
                    if (window.CacheManager) {
                        const cachedProfile = localStorage.getItem(`userProfile_${user.uid}`);
                        if (cachedProfile) {
                            try {
                                const userData = JSON.parse(cachedProfile);
                                if (userData.username) {
                                    username = userData.username;
                                    userUsernameSidebar.textContent = `@${userData.username}`;
                                    
                                    if (!window.CacheManager.shouldFetch('profile', user.uid)) {
                                        console.log("Sidebar: Username loaded from cache (throttled), skipping DB");
                                        shouldFetchUsernameFromDB = false;
                                    }
                                }
                            } catch (e) {
                                console.error("Error parsing cached profile in sidebar:", e);
                            }
                        }
                    }

                    if (shouldFetchUsernameFromDB) {
                        try {
                            console.log("Sidebar: Fetching user profile from DB...");
                            const userDoc = await db.collection('users').doc(user.uid).get();
                            if (userDoc.exists) {
                                const userData = userDoc.data();
                                if (userData.username) {
                                    username = userData.username;
                                    userUsernameSidebar.textContent = `@${userData.username}`;
                                } else {
                                    userUsernameSidebar.textContent = '@utente';
                                }
                                // Save to generic profile cache
                                localStorage.setItem(`userProfile_${user.uid}`, JSON.stringify(userData));
                                if (window.CacheManager) window.CacheManager.markFetched('profile', user.uid);
                            } else {
                                userUsernameSidebar.textContent = '@utente';
                            }
                        } catch (error) {
                            console.error('Error loading username:', error);
                            userUsernameSidebar.textContent = '@utente';
                        }
                    }
                }
                
                // Load user avatar with Google profile picture fallback to initial
                if (userInitialSidebar) {
                    loadUserAvatar(user.email, username.replace('@', ''), userInitialSidebar, 45);
                }

                if (userRoutineListSidebar) {
                    fetchUserRoutines(user.uid, userRoutineListSidebar);
                } else {
                    // If sidebar not loaded yet, try again in 100ms
                    setTimeout(updateSidebar, 100);
                }
            };

            // Wait for sidebar to be loaded before updating
            waitForSidebar(updateSidebar);
        } else {
            console.log('No user signed in, redirecting to login...');
            window.location.href = '../auth/auth.html';
        }
    });


    // Fetch User Routines
    async function fetchUserRoutines(uid, container, forceRefresh = false) {
        // 1. Check if we should perform an actual DB fetch based on throttle
        let shouldFetchFromDB = forceRefresh;
        
        if (window.CacheManager) {
            const cachedRoutines = window.CacheManager.getRoutines(uid);
            const isThrottled = !window.CacheManager.shouldRefreshRoutines(uid);
            
            if (cachedRoutines !== null) {
                // We have cache. Should we use it or fetch from DB?
                if (isThrottled && !forceRefresh) {
                    // Cache is fresh (less than 30s old) and not a forced refresh
                    console.log("Sidebar routines loaded from cache (throttled), skipping DB");
                    renderUserRoutines(cachedRoutines, container);
                    return;
                } else {
                    // Cache is older than 30s or it's a forced refresh
                    console.log("Sidebar cache expired (>30s) or forced refresh, preparing to fetch from DB");
                    shouldFetchFromDB = true;
                    // Render cache immediately for better UX while fetching
                    renderUserRoutines(cachedRoutines, container);
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
        if (window.CacheManager) window.CacheManager.setLoading(uid, 'owned', true);

        try {
            console.log("Sidebar routines not in cache or expired, fetching from DB");
            // 2. Network Refresh
            const routinesSnapshot = await db.collection('routines')
                                             .where('userId', '==', uid)
                                             .get();

            if (routinesSnapshot.empty) {
                // If empty on server, clear cache (or update with empty list)
                renderUserRoutines([], container);
                if (window.CacheManager) {
                    window.CacheManager.saveRoutines(uid, []);
                    window.CacheManager.setLoading(uid, 'owned', false);
                }
            } else {
                let routines = [];
                routinesSnapshot.forEach(doc => {
                    routines.push({ id: doc.id, ...doc.data() });
                });

                // Sort client-side by createdAt descending
                routines.sort((a, b) => {
                    const dateA = a.createdAt ? a.createdAt.toDate() : new Date(0);
                    const dateB = b.createdAt ? b.createdAt.toDate() : new Date(0);
                    return dateB - dateA;
                });

                // 3. Update UI and Cache
                renderUserRoutines(routines, container); 
                if (window.CacheManager) {
                    window.CacheManager.saveRoutines(uid, routines.slice(0, 20));
                    window.CacheManager.setLoading(uid, 'owned', false);
                }
            }
        } catch (error) {
            console.error("Error fetching user routines for sidebar:", error);
            if (window.CacheManager) window.CacheManager.setLoading(uid, 'owned', false);
            // ... (rest of error handling)
            const hasCache = window.CacheManager && window.CacheManager.getRoutines(uid);
            if (!hasCache) {
                const errorItem = document.createElement('li');
                errorItem.textContent = 'Errore nel caricamento delle schede.';
                errorItem.style.color = 'red';
                container.appendChild(errorItem);
            }
        }
    }

    function renderUserRoutines(routines, container) {
        container.innerHTML = ''; // Clear existing routines
        
        // If we want to strictly follow "20 most recent" for sidebar too:
        // routines = routines.slice(0, 20); 
        // But user didn't explicitly say "limit sidebar to 20", just "save... 20 most recent".
        // I'll keep it as is (render all passed), but cache is limited.
        // Wait, if I render all, but cache has 20, then on reload I see 20, then 50.
        // That's a UI jump.
        // Better to limit sidebar to 20 too?
        // "vorrei salvare in localStorage... le piu recenti 20 schede... per velocizzare l'app."
        // Usually sidebars are for quick access. 20 is plenty.
        const limit = 20;
        const displayRoutines = routines.slice(0, limit);

        if (displayRoutines.length === 0) {
            const noRoutinesItem = document.createElement('li');
            noRoutinesItem.textContent = 'Nessuna scheda creata.';
            noRoutinesItem.style.fontStyle = 'italic';
            noRoutinesItem.style.color = '#888';
            container.appendChild(noRoutinesItem);
            return;
        }

        displayRoutines.forEach(routine => {
            const routineItem = document.createElement('li');
            routineItem.classList.add('routine-item'); // Add a class for styling
            routineItem.dataset.routineId = routine.id; // Store routine ID

            // Name
            const nameDiv = document.createElement('div');
            nameDiv.classList.add('routine-name');
            nameDiv.textContent = routine.name || 'Scheda senza nome';
            routineItem.appendChild(nameDiv);

            // Details (Sessions & Period)
            const detailsDiv = document.createElement('div');
            detailsDiv.classList.add('routine-details');
            
            const seduteText = `${routine.sedute || 0} sedute`;
            
            let periodText = '';
            if (routine.startDate && routine.endDate) {
                try {
                    // Handle both Firestore Timestamp and Date/ISO string (from cache)
                    const start = routine.startDate.toDate ? routine.startDate.toDate() : new Date(routine.startDate);
                    const end = routine.endDate.toDate ? routine.endDate.toDate() : new Date(routine.endDate);
                    
                    const options = { day: '2-digit', month: '2-digit', year: '2-digit' };
                    // Check if valid dates
                    if (!isNaN(start) && !isNaN(end)) {
                        const startStr = start.toLocaleDateString('it-IT', options);
                        const endStr = end.toLocaleDateString('it-IT', options);
                        periodText = `${startStr} - ${endStr}`;
                    }
                } catch (e) {
                    console.error("Error formatting dates", e);
                }
            }

            detailsDiv.textContent = periodText ? `${seduteText} • ${periodText}` : seduteText;
            routineItem.appendChild(detailsDiv);

            routineItem.addEventListener('click', () => {
                window.location.href = `../visualizza_scheda/visualizza_scheda.html?id=${routine.id}`;
            });
            container.appendChild(routineItem);
        });
    }

    // Mark sidebar as initialized
    window.sidebarInitialized = true;
});