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
    
    const form = document.getElementById('ai-workout-form');
    const auth = firebase.auth();
    const db = firebase.firestore();

    // Inizializza la loading screen
    window.LoadingManager.show([
        'Inizializzazione pagina...',
        'Caricamento preferenze utente...',
        'Preparazione interfaccia...'
    ]);

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

    function setPrimaryColor(colorName) {
        const hex = colorMap[colorName] || colorMap['Arancione'];
        const gradient = gradientMap[colorName] || gradientMap['Arancione'];
        document.documentElement.style.setProperty('--primary-color', hex);
        document.documentElement.style.setProperty('--background-gradient', gradient);
    }

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

    // --- Authentication & Initialization ---
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                window.LoadingManager.nextStep('Caricamento preferenze utente...');
                await Promise.all([
                    loadUserPreferences(user.uid),
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
    
    // Update range value display
    const daysRange = document.getElementById('giorni');
    const daysVal = document.getElementById('giorni-val');
    
    if (daysRange && daysVal) {
        daysRange.addEventListener('input', (e) => {
            daysVal.textContent = e.target.value;
        });
    }

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Gather form data
            const formData = new FormData(form);
            const data = {};
            
            // Handle checkboxes specifically for arrays
            const equipment = [];
            const focus = [];
            
            // Need to manually collect checkboxes because FormData might not group them as expected if names are same
            const equipmentCheckboxes = form.querySelectorAll('input[name="attrezzatura"]:checked');
            equipmentCheckboxes.forEach(cb => equipment.push(cb.value));

            const focusCheckboxes = form.querySelectorAll('input[name="focus"]:checked');
            focusCheckboxes.forEach(cb => focus.push(cb.value));
            
            // Collect other fields
            for (let [key, value] of formData.entries()) {
                if (key !== 'attrezzatura' && key !== 'focus') {
                    data[key] = value;
                }
            }
            
            data.attrezzatura = equipment;
            data.focus = focus;

            console.log("Form Data Collected:", data);

            // Validation
            if (data.focus.length === 0) {
                if (window.showErrorToast) {
                    window.showErrorToast("Seleziona almeno un focus muscolare o 'Full Body'.");
                }
                return;
            }
            
            if (data.attrezzatura.length === 0) {
                if (window.showErrorToast) {
                    window.showErrorToast("Seleziona almeno un tipo di attrezzatura.");
                }
                return;
            }

            try {
                // Show loading state for AI generation
                window.LoadingManager.showAIGeneration();
                
                // 1. Load and Filter Database
                window.LoadingManager.nextStep('Caricamento database esercizi...');
                const exercises = await loadAndFilterExercises(data.attrezzatura);
                
                if (exercises.names.length === 0) {
                    throw new Error("Nessun esercizio trovato con l'attrezzatura selezionata.");
                }

                // 2. Call Gemini API
                window.LoadingManager.nextStep('Generazione scheda con AI...');
                const generatedRoutine = await generateRoutineWithGemini(data, exercises);
                
                // 3. Process Response & Map to Full Objects
                window.LoadingManager.nextStep('Elaborazione esercizi...');
                const finalRoutine = mapRoutineToFullObjects(generatedRoutine, exercises.fullList);

                // 4. Export/Save
                window.LoadingManager.nextStep('Preparazione download...');
                exportRoutineToPDF(finalRoutine);

            } catch (error) {
                console.error("Errore durante la generazione:", error);
                if (window.showErrorToast) {
                    window.showErrorToast("Si è verificato un errore: " + error.message);
                }
            } finally {
                window.LoadingManager.hide();
            }
        });
    }

    // --- Helper Functions ---

    async function loadAndFilterExercises(selectedEquipment) {
        try {
            const response = await fetch('../../backend/data_it/esercizi_DATABASE_TOTALE.json');
            if (!response.ok) throw new Error("Impossibile caricare il database esercizi.");
            
            const allExercises = await response.json();
            
            // Define equipment mapping
            const equipmentMap = {
                'manubri': ['Manubrio'],
                'bilanciere': ['Bilanciere', 'Bilanciere olimpico', 'Bilanciere EZ (Sagomato)', 'Trap Bar'],
                'macchine': ['Multipower (Smith Machine)', 'SkiErg', 'Ellittica', 'Cyclette', 'Ergometro per braccia', 'Slitta (Sled)', 'Macchina a leva', 'Assistito'],
                'cavi': ['Cavo'],
                'corpo_libero': ['A corpo libero'],
                'elastici': ['Elastico', 'Fascia elastica']
            };

            // Build allowed list based on selection
            let allowedEquipment = [];
            if (selectedEquipment.includes('palestra')) {
                // If 'palestra' is selected, include everything
                 return {
                    names: allExercises.map(ex => ex.name_it),
                    fullList: allExercises
                };
            }

            selectedEquipment.forEach(type => {
                if (equipmentMap[type]) {
                    allowedEquipment = allowedEquipment.concat(equipmentMap[type]);
                }
            });

            // Filter exercises
            const filtered = allExercises.filter(ex => {
                // Check if exercise equipment matches any allowed equipment
                // ex.equipments_it is an array of strings
                if (!ex.equipments_it) return false;
                return ex.equipments_it.some(eq => allowedEquipment.includes(eq));
            });

            return {
                names: filtered.map(ex => ex.name_it),
                fullList: filtered
            };

        } catch (error) {
            console.error("Load exercises error:", error);
            throw error;
        }
    }

    async function generateRoutineWithGemini(userData, exercises) {
        try {
            // Chiama la Cloud Function Firebase (SICURA - chiave API nel backend)
            const cloudFunction = firebase.functions().httpsCallable('generateWorkoutRoutine');
            
            console.log("Chiamando Cloud Function...");
            
            const result = await cloudFunction({
                userData: userData,
                exerciseNames: exercises.names
            });

            console.log("Scheda generata con successo!");
            return result.data.routine;

        } catch (error) {
            console.error("Errore nella generazione della scheda:", error);
            
            let errorMessage = "Non è stato possibile generare la scheda.\n\n";
            
            if (error.code === 'resource-exhausted') {
                errorMessage += "⚠️ HAI ESAURITO LA QUOTA FREE TIER DI GEMINI API\n";
                errorMessage += "- Per continuare: https://console.cloud.google.com/billing\n";
                errorMessage += "- Oppure attendi il reset giornaliero (24 ore)";
            } else if (error.code === 'unauthenticated') {
                errorMessage += "Errore di autenticazione. Per favore, accedi di nuovo.";
            } else {
                errorMessage += "Errore: " + (error.message || 'Sconosciuto');
            }
            
            throw new Error(errorMessage);
        }
    }

    function mapRoutineToFullObjects(routine, fullList) {
        // Map simplified names back to full objects
        routine.sedute.forEach(seduta => {
            seduta.esercizi = seduta.esercizi.map(ex => {
                // Find matching exercise in fullList
                const match = fullList.find(dbEx => dbEx.name_it === ex.nome);
                
                if (match) {
                    return {
                        ...ex,
                        originalData: {
                            id: match.exerciseId,
                            gifUrl: match.gifUrl,
                            instructions: match.instructions_it
                        }
                    };
                }
                return ex; // Return as is if not found
            });
        });
        return routine;
    }

    function exportRoutineToPDF(routineData) {
        console.log("Dati pronti per esportazione al crea_scheda:", routineData);
        
        // Salva i dati in sessionStorage  
        sessionStorage.setItem('aiGeneratedRoutine', JSON.stringify(routineData));
        
        // Redirect a crea_scheda.js
        window.location.href = '../crea_scheda/crea_scheda.html';
    }
});
