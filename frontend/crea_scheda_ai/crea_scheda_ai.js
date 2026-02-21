document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ai-workout-form');
    const loadingScreen = document.getElementById('loading-screen');
    const auth = firebase.auth();
    const db = firebase.firestore();

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
        const loadingScreen = document.getElementById('loading-screen');
        if (user) {
            try {
                await Promise.all([
                    loadUserPreferences(user.uid),
                    waitForSidebar()
                ]);
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
                alert("Seleziona almeno un focus muscolare o 'Full Body'.");
                return;
            }
            
            if (data.attrezzatura.length === 0) {
                alert("Seleziona almeno un tipo di attrezzatura.");
                return;
            }

            try {
                // Show loading state
                if (loadingScreen) loadingScreen.style.display = 'flex';
                
                // 1. Load and Filter Database
                const exercises = await loadAndFilterExercises(data.attrezzatura);
                
                if (exercises.names.length === 0) {
                    throw new Error("Nessun esercizio trovato con l'attrezzatura selezionata.");
                }

                // 2. Call Gemini API
                const generatedRoutine = await generateRoutineWithGemini(data, exercises);
                
                // 3. Process Response & Map to Full Objects
                const finalRoutine = mapRoutineToFullObjects(generatedRoutine, exercises.fullList);

                // 4. Export/Save
                exportRoutineToPDF(finalRoutine);

            } catch (error) {
                console.error("Errore durante la generazione:", error);
                alert("Si è verificato un errore: " + error.message);
            } finally {
                if (loadingScreen) loadingScreen.style.display = 'none';
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
        const apiKey = "AIzaSyCcNhs7-ihHVjao3Vi6c5oqh_duTvPPEyA"; // From .env
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const systemPrompt = `
Sei un esperto personal trainer. Crea una scheda di allenamento in formato JSON basata sui dati dell'utente.
Usa SOLO gli esercizi presenti nella seguente lista: ${JSON.stringify(exercises.names)}.
Non inventare esercizi.
Rispondi SOLO con un JSON valido, senza markdown o testo aggiuntivo.

Dati Utente:
- Sesso: ${userData.sesso}
- Età: ${userData.eta}
- Peso: ${userData.peso} kg
- Altezza: ${userData.altezza} cm
- Obiettivo: ${userData.obiettivo}
- Esperienza: ${userData.esperienza}
- Giorni a settimana: ${userData.giorni}
- Focus: ${userData.focus.join(', ')}
- Limitazioni fisiche: ${userData.limitazioni || 'Nessuna'}

Struttura JSON richiesta:
{
  "nome_scheda": "Nome Scheda",
  "descrizione": "Breve descrizione",
  "sedute": [
    {
      "giorno": 1,
      "nome_seduta": "Nome Seduta (es. Petto e Tricipiti)",
      "esercizi": [
        {
          "nome": "Nome esatto dalla lista",
          "serie": 3,
          "ripetizioni": "10-12",
          "recupero": "60s",
          "note": "Note opzionali"
        }
      ]
    }
  ]
}
`;

        const payload = {
            contents: [{
                parts: [{ text: systemPrompt }]
            }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.statusText}`);
        }

        const result = await response.json();
        
        try {
            let text = result.candidates[0].content.parts[0].text;
            // Clean markdown if present
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(text);
        } catch (e) {
            throw new Error("Errore nel parsing della risposta AI: " + e.message);
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
        console.log("Dati pronti per esportazione PDF:", routineData);
        
        // Placeholder for user's existing PDF export function.
        // If you have a function like 'generatePDF(data)' or 'window.exportToPDF(data)', call it here.
        // Example:
        // if (typeof window.exportToPDF === 'function') {
        //     window.exportToPDF(routineData);
        // } else {
        //     console.warn("Funzione exportToPDF non trovata. Uso fallback.");
        //     alert("Scheda generata! Controlla la console per i dati. (Funzione PDF non trovata)");
        // }

        // Fallback: Simple alert and console log for now, as requested function was not found.
        alert("Scheda generata con successo! I dati sono pronti per l'esportazione.");
        console.log(JSON.stringify(routineData, null, 2));
    }
});
