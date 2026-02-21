document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    const loadingScreen = document.getElementById('loading-screen');
    const schedaNameElement = document.getElementById('scheda-name');
    const dateRangeDisplay = document.getElementById('date-range-display');
    const seduteContainer = document.getElementById('sedute-container');

    let currentUser = null;

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

    // Helper to wait for sidebar
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

    // Helper to get Routine ID from URL
    function getRoutineIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }

    // Optimistic Load: Render immediately if we have a known user
    const lastUid = localStorage.getItem('lastUserId');
    if (lastUid) {
        const routineId = getRoutineIdFromUrl();
        if (routineId) {
            console.log("Optimistic load for routine:", routineId);
            loadUserPreferences(lastUid);
            loadRoutineData(routineId, lastUid);
            // Don't wait for sidebar here
            waitForSidebar();
        }
    }

    // --- Authentication & Initialization ---
    auth.onAuthStateChanged(async (user) => {
        const loadingScreen = document.getElementById('loading-screen');
        if (user) {
            try {
                currentUser = user;
                
                // Update lastUserId
                if (user.uid !== lastUid) {
                    localStorage.setItem('lastUserId', user.uid);
                }

                const tasks = [
                    loadUserPreferences(user.uid),
                    waitForSidebar()
                ];
                const routineId = getRoutineIdFromUrl();
                if (routineId) {
                    tasks.push(loadRoutineData(routineId, user.uid));
                } else {
                    console.error("No routine ID found in URL.");
                }
                await Promise.all(tasks);
            } catch (error) {
                console.error("Error during initialization:", error);
            } finally {
                if (loadingScreen) loadingScreen.style.display = 'none';
            }
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    async function loadUserPreferences(uid) {
        if (!window.CacheManager) return;

        // 1. Try Cache
        const prefs = window.CacheManager.getPreferences(uid);
        if (prefs && prefs.color) {
            setPrimaryColor(prefs.color);
            return;
        }

        // 2. Network Fallback
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

    async function loadRoutineData(routineId, uid) {
        // 1. Try Cache
        if (window.CacheManager) {
            const cachedRoutines = window.CacheManager.getRoutines(uid);
            if (cachedRoutines) {
                const cachedRoutine = cachedRoutines.find(r => r.id === routineId);
                if (cachedRoutine) {
                    console.log("Routine loaded from cache:", routineId);
                    renderRoutine(cachedRoutine);
                    // Hide loading screen immediately if possible, or let Promise.all handle it
                    // But to be sure, we return early to skip DB
                    await waitForImages();
                    return;
                }
            }
        }

        try {
            console.log("Routine not in cache, fetching from DB:", routineId);
            const routineDoc = await db.collection('routines').doc(routineId).get();
            if (routineDoc.exists) {
                const routine = { id: routineDoc.id, ...routineDoc.data() };
                renderRoutine(routine);
                if (window.CacheManager) {
                    window.CacheManager.updateRoutine(uid, routine);
                }
                await waitForImages();
            } else {
                console.error("Routine not found.");
                // Optionally redirect or show an error
            }
        } catch (error) {
            console.error("Error loading routine data:", error);
        }
    }

    function waitForImages() {
        const images = document.querySelectorAll('#sedute-container img');
        if (images.length === 0) return Promise.resolve();

        const promises = Array.from(images).map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
                img.onload = resolve;
                img.onerror = resolve; // Resolve even on error to avoid hanging
            });
        });
        return Promise.all(promises);
    }

    function renderRoutine(routine) {
        schedaNameElement.textContent = routine.name;

        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        let dateRangeText = '';
        if (routine.startDate && routine.endDate) {
            const startDate = routine.startDate.toDate().toLocaleDateString('it-IT', options);
            const endDate = routine.endDate.toDate().toLocaleDateString('it-IT', options);
            dateRangeText = `${startDate} - ${endDate}`;
        } else if (routine.startDate) {
            dateRangeText = routine.startDate.toDate().toLocaleDateString('it-IT', options);
        }
        dateRangeDisplay.textContent = dateRangeText;

        seduteContainer.innerHTML = ''; // Clear existing placeholder
        if (routine.seduteData && routine.seduteData.length > 0) {
            routine.seduteData.forEach(seduta => {
                const sedutaCard = document.createElement('div');
                sedutaCard.className = 'card-section seduta-card';
                sedutaCard.dataset.sedutaId = seduta.id;
                sedutaCard.innerHTML = `
                    <div class="seduta-header">
                        <div class="seduta-title-container">
                            <h3 class="section-label">${seduta.name}</h3>
                        </div>
                    </div>
                    <div class="seduta-exercises-header">
                        <span class="header-col col-name">Esercizio</span>
                        <span class="header-col col-rep">Rep</span>
                        <span class="header-col col-set">Serie</span>
                        <span class="header-col col-rest">Recupero</span>
                        <span class="header-col col-weight">Peso (kg)</span>
                        <span class="header-col col-note">Nota</span>
                        <span class="header-col col-photo">Foto</span>
                    </div>
                    <div class="seduta-content">
                        <div class="exercises-list">
                            <!-- Exercise rows will be dynamically loaded here -->
                        </div>
                    </div>
                `;
                const exercisesList = sedutaCard.querySelector('.exercises-list');
                if (seduta.exercises && seduta.exercises.length > 0) {
                    seduta.exercises.forEach(exercise => {
                        const exerciseRow = document.createElement('div');
                        exerciseRow.className = 'exercise-row';
                        exerciseRow.innerHTML = `
                            <span class="exercise-detail col-name">${exercise.name}</span>
                            <span class="exercise-detail col-rep">${exercise.reps}</span>
                            <span class="exercise-detail col-set">${exercise.sets}</span>
                            <span class="exercise-detail col-rest">${exercise.rest}</span>
                            <span class="exercise-detail col-weight">${exercise.weight}</span>
                            <span class="exercise-detail col-note">${exercise.note}</span>
                            <span class="exercise-detail col-photo">
                                <img src="${exercise.photo || 'https://via.placeholder.com/90'}" alt="Esercizio">
                            </span>
                        `;
                        exercisesList.appendChild(exerciseRow);
                    });
                } else {
                    exercisesList.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 20px;">Nessun esercizio in questa seduta.</p>';
                }
                seduteContainer.appendChild(sedutaCard);
            });
        } else {
            seduteContainer.innerHTML = '<p style="text-align: center; color: var(--text-gray); padding: 40px;">Nessuna seduta trovata per questa scheda.</p>';
        }
    }
});
