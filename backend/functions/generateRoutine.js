const functions = require("firebase-functions");
const { defineSecret } = require("firebase-functions/params");
const axios = require("axios");

// Definisci il secret per la chiave Gemini API
const geminiApiKey = defineSecret('GEMINI_API_KEY');

/**
 * Cloud Function: generateWorkoutRoutine
 * 
 * Proxy sicuro per Gemini API - la chiave API rimane SEGRETA nel backend
 */
exports.generateWorkoutRoutine = functions
    .runWith({
        secrets: [geminiApiKey],
        timeoutSeconds: 180, // Aumentato a 3 minuti per gestire schede lunghe (>5 sedute)
        memory: '512MB'     // Più memoria per gestire JSON pesanti
    })
    .https.onCall(async (data, context) => {
    // Verifica che l'utente sia autenticato
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Devi essere autenticato per usare questa funzione'
        );
    }

    try {
        // Estrai la chiave API dal secret (SEGURA)
        const apiKey = geminiApiKey.value();
        if (!apiKey) {
            throw new Error('Chiave API Gemini non configurata');
        }

        // Estrai dati dall'utente
        const { userData, exerciseNames } = data;

        // Validazione
        if (!userData || !exerciseNames) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'userData e exerciseNames sono obbligatori'
            );
        }

        // Crea il prompt ottimizzato per velocità e precisione
        const systemPrompt = `
Sei un esperto personal trainer. Crea una scheda di allenamento professionale in formato JSON.
IMPORTANTE: Devi rispettare RIGOROSAMENTE ogni punto della richiesta.

Esercizi Disponibili:
Usa SOLO gli esercizi presenti nella seguente lista: ${JSON.stringify(exerciseNames)}.
- NON inventare esercizi.
- NON aggiungere parentesi, numeri, o note al nome dell'esercizio (es. se nella lista c'è "Panca Piana", NON scrivere "Panca Piana (3x10)").

Regole per i Campi Esercizio:
- "ripetizioni": Per esercizi a tempo, scrivi "n min" o "n sec" (es. "1 min", "30 sec"). Per esercizi unilaterali scrivi "n sec per lato".
- "recupero": Se non c'è recupero, lascia il campo VUOTO (stringa vuota "").
- "peso": Deve contenere solo il numero seguito da "kg" (es. "10kg", "15.5kg"). NON usare trattini, slash o altri simboli strani. L'unica eccezione è "Corpo libero" se non si usano pesi.
- "nome": Usa il nome esatto dalla lista, senza aggiungere nulla.

Dati Utente:
- Sesso: ${userData.sesso}, Età: ${userData.eta}, Peso: ${userData.peso}kg, Altezza: ${userData.altezza}cm
- Obiettivo: ${userData.obiettivo}, Esperienza: ${userData.esperienza}
- Frequenza: ${userData.giorni} giorni/settimana, Durata: ${userData.durata} min
- Focus: ${userData.focus.join(', ')}
- Limitazioni: ${userData.limitazioni || 'Nessuna'}

Genera ${userData.giorni} sedute distinte.
Rispondi SOLO con il JSON valido.

Struttura JSON:
{
  "nome_scheda": "Nome",
  "descrizione": "Breve",
  "sedute": [
    {
      "giorno": 1,
      "nome_seduta": "Esempio: Spinta",
      "esercizi": [
        { "nome": "Nome esatto dalla lista", "serie": 3, "ripetizioni": "10", "recupero": "60s", "peso": "10kg", "note": "" }
      ]
    }
  ]
}
`;

        // Chiama Gemini API - Utilizziamo gemini-1.5-flash per la massima velocità e stabilità
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        const response = await axios.post(url, {
            contents: [{
                role: "user",
                parts: [{ text: systemPrompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 4096, // Assicurati che non venga troncato
                responseMimeType: "application/json" // Forza la risposta JSON
            }
        });

        // Estrai e parsea la risposta
        let text = response.data.candidates[0].content.parts[0].text;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedResult = JSON.parse(text);

        return {
            success: true,
            routine: parsedResult
        };

    } catch (error) {
        // Log dettagliato sul server (visibile nella console Firebase)
        const status = error.response?.status;
        const errorData = error.response?.data;
        const message = error.message;

        console.error('ERRORE DETTAGLIATO GEMINI:', {
            status,
            message,
            data: JSON.stringify(errorData),
            stack: error.stack
        });
        
        if (status === 429) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'Hai raggiunto il limite di richieste (Quota Exceeded). ' +
                'Controlla su Google AI Studio se hai superato i limiti RPM (Richieste al Minuto) o RPD (Richieste al Giorno).'
            );
        }

        if (status === 403) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Chiave API non valida o permessi insufficienti. Verifica la tua GEMINI_API_KEY.'
            );
        }

        if (status === 404) {
            throw new functions.https.HttpsError(
                'not-found',
                'Modello non trovato. Il nome "gemini-2.5-flash" potrebbe non essere ancora attivo nel tuo account o regione.'
            );
        }

        throw new functions.https.HttpsError(
            'internal',
            `Errore Gemini (${status || 'unknown'}): ${message}. Controlla i log di Firebase per i dettagli.`
        );
    }
});

/**
 * Cloud Function: testGeminiConnection
 * 
 * Funzione di TEST rapido per verificare se la chiave API e il modello rispondono.
 */
exports.testGeminiConnection = functions
    .runWith({
        secrets: [geminiApiKey],
    })
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Devi essere autenticato');
    }

    try {
        // Chiama Gemini API - Utilizziamo gemini-1.5-flash per la massima velocità e stabilità
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        
        console.log('Avvio test connettività Gemini...');
        
        const response = await axios.post(testUrl, {
            contents: [{
                role: "user",
                parts: [{ text: "Ciao, rispondi solo con la parola 'OK' se mi senti." }]
            }]
        });

        const reply = response.data.candidates[0].content.parts[0].text;
        
        return {
            success: true,
            message: "Connessione a Gemini riuscita!",
            apiResponse: reply,
            modelUsed: "gemini-1.5-flash"
        };

    } catch (error) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        console.error('TEST FALLITO:', {
            status,
            data: errorData
        });

        return {
            success: false,
            error: error.message,
            statusCode: status,
            details: errorData?.error?.message || "Nessun dettaglio aggiuntivo dall'API"
        };
    }
});
