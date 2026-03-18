document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Visualizza Esercizio Script Loaded");
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Global Error Handler
    window.onerror = function(msg, url, line, col, error) {
        console.error("❌ Global Error:", msg, "at", url, ":", line);
        if (window.showErrorToast) window.showErrorToast("Errore imprevisto: " + msg, "Errore");
        return false;
    };

    // Elements
    const backBtn = document.getElementById('back-to-scheda');
    const sedutaNameTitle = document.getElementById('seduta-name-title');
    const exerciseProgress = document.getElementById('exercise-progress');
    const exerciseName = document.getElementById('exercise-name');
    const exerciseGif = document.getElementById('exercise-gif');
    const exerciseSets = document.getElementById('exercise-sets');
    const exerciseReps = document.getElementById('exercise-reps');
    const exerciseRest = document.getElementById('exercise-rest');
    const exerciseWeight = document.getElementById('exercise-weight');
    const exerciseRoutineNotesContainer = document.getElementById('exercise-routine-notes');
    const exerciseRoutineNotesText = document.getElementById('exercise-routine-notes-text');
    const exerciseDescription = document.getElementById('exercise-description');
    const stepDots = document.getElementById('step-dots');
    const prevStepBtn = document.getElementById('prev-step');
    const nextStepBtn = document.getElementById('next-step');
    const notesTextarea = document.getElementById('exercise-notes-textarea');
    const charCount = document.querySelector('.notes-char-count');
    const saveNotesBtn = document.getElementById('save-notes-btn');
    const prevExerciseBtn = document.getElementById('prev-exercise');
    const nextExerciseBtn = document.getElementById('next-exercise');

    // State
    let currentUser = null;
    let routineData = null;
    let sedutaIndex = -1;
    let exerciseIndex = -1;
    let allExercisesData = [];
    let exercisesMap = new Map();
    let currentStep = 0;
    let totalSteps = 0;
    let isSavingNotes = false;

    // Get URL Parameters
    const urlParams = new URLSearchParams(window.location.search);
    const routineId = urlParams.get('routineId');
    const sedutaId = urlParams.get('sedutaId');
    const initialExerciseIndex = parseInt(urlParams.get('exerciseIndex')) || 0;

    if (!routineId || !sedutaId) {
        window.location.href = '../visualizza_scheda/visualizza_scheda.html';
        return;
    }

    // Inizializza la loading screen
    window.LoadingManager.show([
        'Caricamento dati...',
        'Preparazione esercizio...'
    ]);

    // Authentication
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            // Verifica email
            if (!user.emailVerified) {
                console.log('User not verified, redirecting to auth.html');
                window.location.href = '../auth/auth.html';
                return;
            }

            currentUser = user;
            await loadAllData();
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    async function loadAllData() {
        try {
            console.log("🔥 Starting data load...");
            
            // Load exercises database
            const response = await fetch('../../backend/data_it/esercizi_DATABASE_TOTALE.json');
            if (!response.ok) throw new Error("Failed to fetch exercises database");
            allExercisesData = await response.json();
            exercisesMap = new Map(allExercisesData.map(ex => [ex.name, ex]));
            console.log(`🔥 Loaded ${allExercisesData.length} exercises from DB`);

            // Load routine
            await loadRoutineData();
            console.log("🔥 Routine data loaded:", routineData?.name);

            // Load user preferences for color
            await loadUserPreferences();

            window.LoadingManager.hide();
        } catch (error) {
            console.error("🔥 Error in loadAllData:", error);
            window.LoadingManager.hide();
            if (window.showErrorToast) window.showErrorToast('Errore nel caricamento dell\'esercizio: ' + error.message, 'Errore');
        }
    }

    async function loadRoutineData() {
        if (!routineId || !sedutaId) {
            console.error("🔥 Missing routineId or sedutaId");
            throw new Error("Dati della sessione mancanti");
        }
        
        console.log(`🔥 Fetching routine: ${routineId}`);
        let shouldFetchFromDB = true;
        
        // 1. Try Cache
        if (window.CacheManager) {
            try {
                const cachedRoutines = window.CacheManager.getRoutines(currentUser.uid);
                if (cachedRoutines) {
                    routineData = cachedRoutines.find(r => String(r.id) === String(routineId));
                    if (routineData) {
                        console.log("🔥 Routine LOADED FROM CACHE:", routineData.name);
                        processRoutineData();
                        
                        // Check if we should perform an actual DB fetch based on throttle
                        if (!window.CacheManager.shouldFetch('routine_detail', routineId)) {
                            console.log("🔥 Routine fetch throttled (30s), skipping DB");
                            shouldFetchFromDB = false;
                        }
                    }
                }
            } catch (e) {
                console.warn("🔥 Cache read failed, falling back to DB", e);
            }
        }

        if (!shouldFetchFromDB) return;

        // Se non è in cache o è scaduta, allora fetch dal DB
        console.log("🔥 Routine not in cache or expired, fetching from DB");
        try {
            const doc = await db.collection('routines').doc(routineId).get();
            if (doc.exists) {
                routineData = { id: doc.id, ...doc.data() };
                console.log("🔥 Routine fetched from DB:", routineData.name);
                
                // Salva in cache per la prossima volta
                if (window.CacheManager) {
                    window.CacheManager.updateSingleRoutineInCache(currentUser.uid, routineData);
                    window.CacheManager.markFetched('routine_detail', routineId);
                }
                processRoutineData();
            } else {
                console.error("🔥 Routine not found for ID:", routineId);
                throw new Error("La scheda selezionata non esiste più");
            }
        } catch (error) {
            console.error("🔥 DB fetch error:", error);
            throw new Error("Impossibile connettersi al database");
        }
    }

    function processRoutineData() {
        // Check if seduteData exists
        if (!routineData.seduteData || !Array.isArray(routineData.seduteData)) {
            console.error("🔥 routineData.seduteData is missing or not an array!", routineData);
            throw new Error("La scheda non contiene dati delle sedute");
        }

        // Find correct seduta and exercise
        console.log(`🔥 Searching for seduta: ${sedutaId}`);
        sedutaIndex = routineData.seduteData.findIndex(s => String(s.id) === String(sedutaId));
        
        if (sedutaIndex === -1) {
            console.warn("🔥 Seduta ID not found, trying numeric fallback...");
            if (!isNaN(sedutaId)) {
                sedutaIndex = parseInt(sedutaId);
            }
        }

        if (sedutaIndex === -1 || !routineData.seduteData[sedutaIndex]) {
            console.error("🔥 Seduta not found for ID:", sedutaId);
            throw new Error("Seduta non trovata nella scheda");
        }

        const seduta = routineData.seduteData[sedutaIndex];
        if (!seduta.exercises || !Array.isArray(seduta.exercises)) {
            console.error("🔥 seduta.exercises is missing or not an array!", seduta);
            throw new Error("La seduta non contiene esercizi");
        }

        exerciseIndex = initialExerciseIndex;
        if (exerciseIndex < 0 || exerciseIndex >= seduta.exercises.length) {
            exerciseIndex = 0;
        }

        console.log(`🔥 Starting render for exercise at index: ${exerciseIndex}`);
        renderExercise();
    }

    async function loadUserPreferences() {
        let shouldFetchFromDB = true;
        
        // 1. Try Cache
        if (window.CacheManager) {
            const prefs = window.CacheManager.getPreferences(currentUser.uid);
            if (prefs && prefs.color) {
                if (typeof setPrimaryColor === 'function') setPrimaryColor(prefs.color);
                
                // Check if we should perform an actual DB fetch based on throttle
                if (!window.CacheManager.shouldFetch('preferences', currentUser.uid)) {
                    console.log("🔥 Preferences loaded from cache (throttled), skipping DB");
                    shouldFetchFromDB = false;
                }
            }
        }

        if (!shouldFetchFromDB) return;

        // 2. Network Fallback (if CacheManager didn't have it or it's time to refresh)
        try {
            console.log("🔥 Fetching preferences from DB...");
            const doc = await db.collection('users').doc(currentUser.uid).get();
            if (doc.exists) {
                const data = doc.data();
                if (data.preferences) {
                    if (data.preferences.color && typeof setPrimaryColor === 'function') {
                        setPrimaryColor(data.preferences.color);
                    }
                    if (window.CacheManager) {
                        window.CacheManager.savePreferences(currentUser.uid, data.preferences);
                    }
                }
            }
        } catch (error) {
            console.error("🔥 Error loading preferences:", error);
        }
    }

    function renderExercise() {
        console.log("🔥 Rendering exercise at index:", exerciseIndex);
        const seduta = routineData.seduteData[sedutaIndex];
        const exercise = seduta.exercises[exerciseIndex];
        
        // Cerca l'esercizio nel database degli esercizi
        // Prima prova con il nome originale, poi prova con il nome visualizzato se diverso
        let fullData = exercisesMap.get(exercise.name);
        
        if (!fullData) {
            console.warn(`🔥 Exercise "${exercise.name}" not found in map by name. Searching all database...`);
            // Ricerca manuale nel caso ci siano problemi di case sensitivity o spazi
            fullData = allExercisesData.find(ex => 
                ex.name.toLowerCase() === exercise.name.toLowerCase() || 
                ex.name_it?.toLowerCase() === exercise.name.toLowerCase()
            );
        }

        if (!fullData) {
            console.error("🔥 FATAL: Exercise data not found for:", exercise.name);
            // Fallback render with partial data
            exerciseName.textContent = exercise.name;
            exerciseSets.textContent = exercise.sets || '-';
            exerciseReps.textContent = exercise.reps || '-';
            exerciseRest.textContent = exercise.rest ? `${exercise.rest} sec` : '-';
            exerciseWeight.textContent = exercise.weight ? `${exercise.weight} kg` : '-';
            exerciseDescription.innerHTML = '<p style="color: var(--text-gray); text-align: center; padding: 20px;">Istruzioni non disponibili per questo esercizio.</p>';
            
            if (window.showErrorToast) window.showErrorToast(`Dati non trovati per: ${exercise.name}`, 'Attenzione');
            return;
        }

        console.log("🔥 Full exercise data found:", fullData.name_it || fullData.name);

        // Header & Progress
        sedutaNameTitle.textContent = seduta.name;
        exerciseProgress.textContent = `Esercizio ${exerciseIndex + 1} di ${seduta.exercises.length}`;

        // Basic Info
        exerciseName.textContent = fullData.name_it || fullData.name;
        exerciseGif.src = fullData.gifUrl;
        exerciseSets.textContent = exercise.sets || '-';
        exerciseReps.textContent = exercise.reps || '-';
        exerciseRest.textContent = exercise.rest ? `${exercise.rest} sec` : '-';
        exerciseWeight.textContent = exercise.weight ? `${exercise.weight} kg` : '-';

        // Routine-specific notes
        if (exercise.note && exercise.note.trim() !== '-' && exercise.note.trim() !== '') {
            exerciseRoutineNotesContainer.style.display = 'flex';
            exerciseRoutineNotesText.textContent = exercise.note;
        } else {
            exerciseRoutineNotesContainer.style.display = 'none';
        }

        // Stepper
        const instructions = fullData.instructions_it || fullData.instructions || [];
        totalSteps = instructions.length;
        currentStep = 0;
        renderStepper(instructions);

        // Notes
        loadNotes(exercise.exerciseId || exercise.id || exercise.name);

        // Navigation Buttons
        prevExerciseBtn.disabled = exerciseIndex === 0;
        nextExerciseBtn.disabled = exerciseIndex === seduta.exercises.length - 1;

        // Update URL without reloading
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('exerciseIndex', exerciseIndex);
        window.history.replaceState({}, '', newUrl);
    }

    function renderStepper(instructions) {
        exerciseDescription.innerHTML = instructions.map((instruction, index) => {
            // Rimuove il prefisso "Step X: " o "X: " se presente
            let cleanedInstruction = instruction;
            
            // Gestione "Step X: ", "Passo X: ", "X: " o semplicemente "X " all'inizio
            if (cleanedInstruction.toLowerCase().startsWith('step') || cleanedInstruction.toLowerCase().startsWith('passo')) {
                cleanedInstruction = cleanedInstruction.substring(cleanedInstruction.indexOf(':') + 1).trim();
            } 
            else if (/^\d+[:.]/.test(cleanedInstruction)) {
                cleanedInstruction = cleanedInstruction.substring(cleanedInstruction.indexOf(cleanedInstruction.match(/[:.]/)[0]) + 1).trim();
            }
            else if (/^\d+\s/.test(cleanedInstruction)) {
                cleanedInstruction = cleanedInstruction.replace(/^\d+\s+/, '').trim();
            }

            return `<div class="step-card" data-step="${index}" style="display: ${index === 0 ? 'flex' : 'none'}">
                        <span class="step-number">${index + 1}</span>
                        <p class="step-text">${cleanedInstruction}</p>
                    </div>`;
        }).join('');

        stepDots.innerHTML = instructions.map((_, index) => 
            `<span class="dot ${index === 0 ? 'active' : ''}" data-step="${index}"></span>`
        ).join('');

        const dots = stepDots.querySelectorAll('.dot');
        dots.forEach((dot, index) => {
            dot.onclick = () => {
                currentStep = index;
                updateStepper();
            };
        });

        updateStepper();
    }

    function updateStepper() {
        const steps = exerciseDescription.querySelectorAll('.step-card');
        const dots = stepDots.querySelectorAll('.dot');

        steps.forEach((step, index) => {
            step.style.display = index === currentStep ? 'flex' : 'none';
        });

        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentStep);
        });

        prevStepBtn.disabled = currentStep === 0;
        nextStepBtn.disabled = currentStep === totalSteps - 1;
    }

    async function loadNotes(exerciseId) {
        console.log(`🔥 Loading notes for exercise: ${exerciseId}`);
        notesTextarea.value = '';
        updateCharCount();

        try {
            let notes = '';
            const isOwner = routineData.userId === currentUser.uid;
            console.log(`🔥 Is owner: ${isOwner}`);

            if (isOwner) {
                const seduta = routineData.seduteData[sedutaIndex];
                const exercise = seduta.exercises[exerciseIndex];
                notes = exercise.notes || '';
                console.log(`🔥 Owner notes found: ${notes.length > 0 ? 'Yes' : 'No'}`);
            } else {
                const condivisioni = routineData.condivisioni || {};
                console.log(`🔥 Shared notes (condivisioni) found for user: ${condivisioni[currentUser.uid] ? 'Yes' : 'No'}`);
                
                if (condivisioni[currentUser.uid] && condivisioni[currentUser.uid][exerciseId]) {
                    notes = condivisioni[currentUser.uid][exerciseId].notes || '';
                    console.log("🔥 Shared note content loaded");
                }
            }
            notesTextarea.value = notes;
            updateCharCount();
        } catch (error) {
            console.error('🔥 Error loading notes:', error);
        }
    }

    async function saveNotes() {
        if (!currentUser || isSavingNotes) return;
        
        isSavingNotes = true;
        saveNotesBtn.disabled = true;
        saveNotesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';

        try {
            const notes = notesTextarea.value.trim();
            const exercise = routineData.seduteData[sedutaIndex].exercises[exerciseIndex];
            const exerciseId = exercise.exerciseId || exercise.id;
            const isOwner = routineData.userId === currentUser.uid;

            const routineRef = db.collection('routines').doc(routineId);

            if (isOwner) {
                const updatedSeduteData = JSON.parse(JSON.stringify(routineData.seduteData));
                updatedSeduteData[sedutaIndex].exercises[exerciseIndex].notes = notes;
                
                await routineRef.update({ seduteData: updatedSeduteData });
                routineData.seduteData = updatedSeduteData;
            } else {
                let condivisioni = routineData.condivisioni || {};
                if (Array.isArray(condivisioni)) {
                    const newCondivisioni = {};
                    condivisioni.forEach(uid => newCondivisioni[uid] = {});
                    condivisioni = newCondivisioni;
                }
                
                if (!condivisioni[currentUser.uid]) condivisioni[currentUser.uid] = {};
                condivisioni[currentUser.uid][exerciseId] = { id: exerciseId, notes: notes };
                
                await routineRef.update({ condivisioni: condivisioni });
                routineData.condivisioni = condivisioni;
            }

            if (window.CacheManager) {
                window.CacheManager.saveRoutines(currentUser.uid, 
                    window.CacheManager.getRoutines(currentUser.uid).map(r => r.id === routineId ? routineData : r)
                );
            }

            if (window.showSuccessToast) window.showSuccessToast('Appunti salvati!', 'Successo');
        } catch (error) {
            console.error('Error saving notes:', error);
            if (window.showErrorToast) window.showErrorToast('Errore nel salvataggio', 'Errore');
        } finally {
            isSavingNotes = false;
            saveNotesBtn.disabled = false;
            saveNotesBtn.innerHTML = '<i class="fas fa-save"></i> Salva';
        }
    }

    function updateCharCount() {
        const len = notesTextarea.value.length;
        charCount.textContent = `${len}/500`;
        charCount.style.color = len >= 450 ? '#ff6600' : 'var(--text-gray)';
    }

    // Event Listeners
    backBtn.onclick = () => {
        window.location.href = `../visualizza_scheda/visualizza_scheda.html?id=${routineId}`;
    };

    prevStepBtn.onclick = () => {
        if (currentStep > 0) {
            currentStep--;
            updateStepper();
        }
    };

    nextStepBtn.onclick = () => {
        if (currentStep < totalSteps - 1) {
            currentStep++;
            updateStepper();
        }
    };

    notesTextarea.oninput = updateCharCount;
    saveNotesBtn.onclick = saveNotes;

    prevExerciseBtn.onclick = () => {
        if (exerciseIndex > 0) {
            exerciseIndex--;
            renderExercise();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    nextExerciseBtn.onclick = () => {
        const seduta = routineData.seduteData[sedutaIndex];
        if (exerciseIndex < seduta.exercises.length - 1) {
            exerciseIndex++;
            renderExercise();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
});
