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
        const apiKey = "AIzaSyDNPxVF48XPgh3r2g-YYXi_RR0kzOPtjfk"; // From .env
        
        // Array of available models to try in order (with correct v1beta names)
        const availableModels = [
            'gemini-2.0-flash',
            'gemini-2.5-flash',
        ];
        
        let lastError = null;
        const MAX_RETRIES = 0;

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
                role: "user",
                parts: [{ text: systemPrompt }]
            }]
        };

        // Try each model in order
        for (const model of availableModels) {
            let retries = 0;
            while (retries <= MAX_RETRIES) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        // Try to parse error response for more details
                        let errorData = null;
                        let errorDetails = '';
                        try {
                            errorData = await response.clone().json();
                            errorDetails = JSON.stringify(errorData, null, 2);
                        } catch (e) {
                            errorDetails = await response.text();
                        }
                        
                        // Check if quota exceeded (429)
                        if (response.status === 429) {
                            const delay = (Math.pow(2, retries) * 1000) + Math.random() * 1000;
                            console.warn(`Rate limit (429) su ${model}. Tentativo ${retries + 1}/${MAX_RETRIES + 1}. Attesa ${delay.toFixed(0)}ms...`);
                            if (retries < MAX_RETRIES) {
                                await new Promise(r => setTimeout(r, delay));
                                retries++;
                                continue; // Retry with exponential backoff
                            } else {
                                lastError = `Modello ${model}: QUOTA ESAURITA (Free Tier). Devi attivare un piano a pagamento o attendere il reset giornaliero.`;
                                console.warn(lastError);
                                break; // Exit retry loop, try next model
                            }
                        }
                        
                        // Other errors (like 404)
                        lastError = `Modello ${model}: ${response.status} ${response.statusText}`;
                        console.warn(`Modello ${model} non disponibile:`, errorDetails);
                        break; // Exit retry loop, try next model
                    }

                    const result = await response.json();
                    
                    try {
                        let text = result.candidates[0].content.parts[0].text;
                        // Clean markdown if present
                        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsedResult = JSON.parse(text);
                        console.log(`Scheda generata con successo con modello: ${model}`);
                        return parsedResult;
                    } catch (e) {
                        lastError = `Errore nel parsing con ${model}: ${e.message}`;
                        console.warn(lastError);
                        break; // Exit retry loop, try next model
                    }

                } catch (error) {
                    lastError = `Errore con ${model}: ${error.message}`;
                    console.warn(lastError);
                    break; // Exit retry loop, try next model
                }
            }
        }

        // If all models failed, provide helpful error message
        let errorMessage = `
Non è stato possibile generare la scheda.

Ultimo errore riscontrato:
${lastError}

Cosa puoi fare:
`;

        if (lastError && lastError.includes("QUOTA ESAURITA")) {
            errorMessage += `
1. ⚠️ HAI ESAURITO LA QUOTA FREE TIER DI GEMINI API
   - La Google Gemini API free tier ha limite molto basso (poche richieste al giorno)
   - Per continuare devi ATTIVARE UN PIANO A PAGAMENTO: https://console.cloud.google.com/billing
   - Oppure attendi il reset giornaliero (24 ore dopo il primo utilizzo)

2. Modelli disponibili in v1beta: ${availableModels.join(', ')}`;
        } else {
            errorMessage += `
1. Verifica che la chiave API sia valida e attiva
2. Controlla se la API Gemini è abilitata nella Google Cloud Console
3. I modelli supportati sono: ${availableModels.join(', ')}
4. Se hai superato la quota free tier, attiva un piano a pagamento`;
        }

        throw new Error(errorMessage);
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
