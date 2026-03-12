const { onCall, HttpsError } = require("firebase-functions/v2/https");
const axios = require("axios");

/**
 * Cloud Function: generateWorkoutRoutine (v2)
 * 
 * Proxy sicuro per Gemini API - Prova diversi modelli in fallback
 */
exports.generateWorkoutRoutine = onCall({
    secrets: ["GEMINI_API_KEY"],
    maxInstances: 10,
    region: "us-central1"
}, async (request) => {
    // In emulatore locale permettiamo il test senza auth per facilitare il debug
    const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
    if (!request.auth && !isEmulator) {
        throw new HttpsError(
            'unauthenticated',
            'Devi essere autenticato per usare questa funzione'
        );
    }

    const { userData, exerciseNames } = request.data;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Chiave API Gemini non configurata.');
    }

    // Lista di modelli da provare in ordine di preferenza (Piano Free)
    // L'utente consiglia gemini-2.5-flash (Marzo 2026)
    const models = [
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b',
        'gemini-1.5-pro'
    ];

    let lastError = null;

    for (const modelName of models) {
        try {
            console.log(`Tentativo generazione scheda con modello: ${modelName}`);
            
            const systemPrompt = `
Sei un esperto personal trainer. Crea una scheda di allenamento in formato JSON basata sui dati dell'utente.
Usa SOLO gli esercizi presenti nella seguente lista: ${JSON.stringify(exerciseNames)}.
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
- Durata allenamento: ${userData.durata} minuti
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
          "peso": "10kg",
          "note": "Note opzionali"
        }
      ]
    }
  ]
}
`;

            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            const response = await axios.post(url, {
                contents: [{
                    role: "user",
                    parts: [{ text: systemPrompt }]
                }]
            });

            // Estrai e parsea la risposta
            let text = response.data.candidates[0].content.parts[0].text;
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsedResult = JSON.parse(text);

            console.log(`Successo con modello: ${modelName}`);
            return {
                success: true,
                routine: parsedResult,
                modelUsed: modelName
            };

        } catch (error) {
            const status = error.response?.status;
            const errorData = error.response?.data;
            
            // Log dettagliato per debug
            console.error(`[Gemini Error] Modello: ${modelName} | Status: ${status} | Messaggio: ${error.message}`);
            if (errorData) {
                console.error(`[Gemini Error Data]:`, JSON.stringify(errorData));
            }
            
            lastError = error;

            // Se l'errore è 429 (Quota), 404 (Not Found) o 500/503 (Server Error), proviamo il prossimo modello
            // Se l'errore è 403 (Auth/API Key non valida), è inutile riprovare
            if (status === 403) {
                console.error("ERRORE DI AUTENTICAZIONE (403). La chiave API potrebbe essere non valida per questo progetto o regione.");
                break;
            }
            
            continue;
        }
    }

    // Se arriviamo qui, tutti i modelli hanno fallito
    const status = lastError.response?.status;
    const errorData = lastError.response?.data;

    console.error('TUTTI I MODELLI HANNO FALLITO:', {
        status,
        data: JSON.stringify(errorData)
    });

    if (status === 429) {
        throw new HttpsError('resource-exhausted', 
            'Quota Gemini superata (429). Hai raggiunto il limite di richieste RPM/RPD per il tuo account. ' +
            'Assicurati che la chiave API sia attiva in Google AI Studio e prova a ricaricare la pagina.'
        );
    }

    throw new HttpsError('internal', `Errore finale dopo fallback: ${lastError.message}`);
});

/**
 * Cloud Function: testGeminiConnection (v2)
 * 
 * Funzione di TEST rapido per verificare se la chiave API e il modello rispondono.
 */
exports.testGeminiConnection = onCall({
    secrets: ["GEMINI_API_KEY"],
    region: "us-central1"
}, async (request) => {
    // Permettiamo il test senza auth solo se siamo in emulatore locale per facilitare il debug
    const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
    if (!request.auth && !isEmulator) {
        throw new HttpsError('unauthenticated', 'Devi essere autenticato');
    }

    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro'];
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return { success: false, error: "GEMINI_API_KEY mancante." };
    }

    for (const modelName of models) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await axios.post(url, {
                contents: [{ role: "user", parts: [{ text: "Ciao, rispondi OK." }] }]
            });

            return {
                success: true,
                message: "Connessione riuscita!",
                modelUsed: modelName,
                response: response.data.candidates[0].content.parts[0].text
            };
        } catch (e) {
            console.log(`Test fallito per ${modelName}: ${e.message}`);
        }
    }

    return { success: false, error: "Nessun modello ha risposto correttamente." };
});
