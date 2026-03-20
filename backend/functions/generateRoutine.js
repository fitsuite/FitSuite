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
- "peso": 
  * Per esercizi a corpo libero (es. piegamenti, trazioni senza zavorra, squat a corpo libero), scrivi "A corpo libero".
  * Per TUTTI gli altri esercizi che utilizzano pesi, manubri, bilancieri, cavi o macchinari, DEVI SEMPRE specificare un numero (es. "10", "15.5", "40"). 
  * Il valore deve essere PRIVO di unità di misura (NON scrivere "kg").
  * NON lasciare mai il campo vuoto se l'esercizio non è a corpo libero.
- "nome": Usa il nome esatto dalla lista, senza aggiungere nulla.

Dati Utente:
- Sesso: ${userData.sesso}, Età: ${userData.eta}, Peso: ${userData.peso}kg, Altezza: ${userData.altezza}cm
- Obiettivo: ${userData.obiettivo}, Esperienza: ${userData.esperienza}
- Frequenza: ${userData.giorni} giorni/settimana, Durata: ${userData.durata} min
- Focus: ${userData.focus.join(', ')}
- Limitazioni: ${userData.limitazioni || 'Nessuna'}

Regole Scientifiche Obbligatorie:
1. Obiettivo Perdita Peso: Inserisci OBBLIGATORIAMENTE esercizi di cardio (camminata inclinata, cyclette, corsa, ellittica, ecc.) all'interno della scheda. Non devono essere gli unici esercizi, ma devono essere presenti in ogni sessione o come sessione dedicata.
2. Peso: Per tutti gli esercizi non a corpo libero, il peso DEVE essere sempre inserito.

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
        { "nome": "Nome esatto dalla lista", "serie": 3, "ripetizioni": "10", "recupero": "60s", "peso": "10", "note": "" }
      ]
    }
  ]
}
`;

        // Lista di modelli da provare in ordine di preferenza
        const models = [
            'gemini-2.5-flash',
            'gemini-2.0-flash',
            'gemini-1.5-flash',
            'gemini-1.5-pro'
        ];

        let lastError = null;
        const maxRetriesPerModel = 2;
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        for (const modelName of models) {
            let retryCount = 0;
            while (retryCount <= maxRetriesPerModel) {
                try {
                    console.log(`Tentativo con modello: ${modelName} (Tentativo ${retryCount + 1})`);
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
                    
                    const response = await axios.post(url, {
                        contents: [{
                            role: "user",
                            parts: [{ text: systemPrompt }]
                        }],
                        generationConfig: {
                            temperature: 0.7,
                            topK: 40,
                            topP: 0.95,
                            maxOutputTokens: 4096,
                            responseMimeType: "application/json"
                        }
                    });

                    // Estrai e parsea la risposta
                    let text = response.data.candidates[0].content.parts[0].text;
                    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                    const parsedResult = JSON.parse(text);

                    return {
                        success: true,
                        routine: parsedResult,
                        modelUsed: modelName
                    };

                } catch (error) {
                    const status = error.response?.status;
                    const errorData = error.response?.data;
                    
                    console.error(`ERRORE GEMINI (${modelName}):`, {
                        status,
                        message: error.message,
                        data: JSON.stringify(errorData)
                    });
                    
                    lastError = error;

                    if (status === 429 && retryCount < maxRetriesPerModel) {
                        retryCount++;
                        await delay(retryCount * 2000);
                        continue;
                    }

                    if (status === 403) break;
                    break;
                }
            }
        }

        // Se tutti falliscono
        const finalStatus = lastError.response?.status;
        const finalMessage = lastError.message;

        if (finalStatus === 429) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'Quota Gemini superata (429). Ho provato tutti i modelli disponibili e i tentativi di riprova, ma il limite persiste. Riprova tra qualche minuto.'
            );
        }

        if (finalStatus === 403) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'Chiave API non valida o permessi insufficienti. Verifica la tua GEMINI_API_KEY.'
            );
        }

        if (finalStatus === 404) {
            throw new functions.https.HttpsError(
                'not-found',
                'Modello non trovato. Verifica la configurazione della tua GEMINI_API_KEY.'
            );
        }

        throw new functions.https.HttpsError(
            'internal',
            `Errore Gemini (${finalStatus || 'unknown'}): ${finalMessage}. Controlla i log di Firebase per i dettagli.`
        );

    } catch (outerError) {
        // Questo cattura errori di validazione iniziale o errori lanciati sopra
        if (outerError instanceof functions.https.HttpsError) {
            throw outerError;
        }
        
        console.error('ERRORE CRITICO GENERAZIONE:', outerError);
        throw new functions.https.HttpsError(
            'internal',
            `Errore imprevisto: ${outerError.message}`
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
        const apiKey = geminiApiKey.value();
        // Chiama Gemini API - Utilizziamo gemini-2.5-flash per la massima velocità e stabilità
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
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
            modelUsed: "gemini-2.5-flash"
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
