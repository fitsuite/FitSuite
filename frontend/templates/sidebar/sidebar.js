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

    // Mobile Sidebar Logic
    function initMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const body = document.body;

        if (!sidebar) {
            // Retry if sidebar not yet loaded
            setTimeout(initMobileSidebar, 100);
            return;
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

    // Helper to get routines from local cache
    function getLocalRoutinesCache(uid) {
        const cacheKey = `cachedRoutines_${uid}`;
        const cached = localStorage.getItem(cacheKey);
        if (!cached) return null;
        try {
            const routines = JSON.parse(cached);
            return routines.map(r => ({
                ...r,
                // Hydrate timestamps with a mock toDate() method
                createdAt: r.createdAt ? { toDate: () => new Date(r.createdAt) } : null,
                startDate: r.startDate ? { toDate: () => new Date(r.startDate) } : null,
                endDate: r.endDate ? { toDate: () => new Date(r.endDate) } : null
            }));
        } catch (e) {
            console.error("Error parsing routines cache", e);
            return null;
        }
    }

    // Helper to update local routines cache (Limit 20)
    function updateLocalRoutinesCache(uid, routines) {
        const cacheKey = `cachedRoutines_${uid}`;
        // Sort by createdAt descending
        const sorted = [...routines].sort((a, b) => {
            const dateA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const dateB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return dateB - dateA;
        });
        
        // Take top 20
        const toCache = sorted.slice(0, 20).map(r => {
            return {
                ...r,
                // Serialize timestamps to ISO strings for storage
                createdAt: r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toISOString() : r.createdAt,
                startDate: r.startDate && r.startDate.toDate ? r.startDate.toDate().toISOString() : r.startDate,
                endDate: r.endDate && r.endDate.toDate ? r.endDate.toDate().toISOString() : r.endDate
            };
        });
        
        localStorage.setItem(cacheKey, JSON.stringify(toCache));
        
        // Dispatch event to notify other components
        const event = new CustomEvent('routines-updated', { detail: { uid } });
        document.dispatchEvent(event);
    }

    // Initialize mobile sidebar
    initMobileSidebar();

    // Check Auth State and populate sidebar
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('User is signed in for sidebar:', user.email);
            
            // Fetch user preferences and apply theme
            const cacheKey = `userPreferences_${user.uid}`;
            let hasCachedTheme = false;
            
            // 1. Try Cache First
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const prefs = JSON.parse(cached);
                    if (prefs.color) {
                        setPrimaryColor(prefs.color);
                        hasCachedTheme = true;
                    }
                }
            } catch (e) { console.error("Cache error in sidebar:", e); }

            // 2. Fetch from Network (ONLY if not cached)
            if (!hasCachedTheme) {
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const data = userDoc.data();
                        if (data.preferences && data.preferences.color) {
                            setPrimaryColor(data.preferences.color);
                            // Update cache
                            localStorage.setItem(cacheKey, JSON.stringify(data.preferences));
                        } else {
                            if (!localStorage.getItem(cacheKey)) setPrimaryColor('Arancione');
                        }
                    } else {
                        if (!localStorage.getItem(cacheKey)) setPrimaryColor('Arancione');
                    }
                } catch (error) {
                    console.error("Error fetching user preferences for theme:", error);
                    if (!localStorage.getItem(cacheKey)) setPrimaryColor('Arancione');
                }
            }

            // Function to update sidebar elements
            const updateSidebar = () => {
                const userInitialSidebar = document.getElementById('user-initial-sidebar');
                const userRoutineListSidebar = document.getElementById('user-routine-list-sidebar');
                const userEmailSidebar = document.getElementById('user-email-sidebar');

                if (userEmailSidebar) {
                    userEmailSidebar.textContent = user.email.split('@')[0];
                }
                
                if (userInitialSidebar) {
                    const initial = (user.displayName || user.email).charAt(0).toUpperCase();
                    userInitialSidebar.textContent = initial;
                }

                if (userRoutineListSidebar) {
                    fetchUserRoutines(user.uid, userRoutineListSidebar);
                } else {
                    // If sidebar not loaded yet, try again in 100ms
                    setTimeout(updateSidebar, 100);
                }
            };

            updateSidebar();
        } else {
            console.log('No user signed in, redirecting to login...');
            window.location.href = '../auth/auth.html';
        }
    });


    // Fetch User Routines
    async function fetchUserRoutines(uid, container) {
        // 1. Render from Cache FIRST
        const cachedRoutines = getLocalRoutinesCache(uid);
        if (cachedRoutines) {
            renderUserRoutines(cachedRoutines, container);
        }

        try {
            // 2. Network Refresh
            const routinesSnapshot = await db.collection('routines')
                                             .where('userId', '==', uid)
                                             .get();

            if (routinesSnapshot.empty) {
                // If empty on server, clear cache (or update with empty list)
                renderUserRoutines([], container);
                updateLocalRoutinesCache(uid, []); // This dispatches event, but listener just re-renders cache, which is fine (idempotent)
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
                // We only render top 20 in sidebar to match cache? 
                // User asked for "20 most recent". Sidebar usually shows recent.
                // But if we want to be consistent with "save... 20 most recent", 
                // we should probably pass all to updateLocalRoutinesCache (which slices to 20),
                // and render what we have.
                // If we render ALL from network, then when we switch to cache-only view (e.g. offline restart), we only see 20.
                // This is acceptable.
                renderUserRoutines(routines, container); 
                updateLocalRoutinesCache(uid, routines);
            }
        } catch (error) {
            console.error("Error fetching user routines for sidebar:", error);
            if (!cachedRoutines) {
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
        // But the user didn't explicitly say "limit sidebar to 20", just "save... 20 most recent".
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
});