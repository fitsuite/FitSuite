const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const axios = require("axios");

// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

/**
 * Cloud Function: generateWorkoutRoutine (v2)
 * 
 * Proxy sicuro per Gemini API - Prova diversi modelli in fallback
 */
exports.generateWorkoutRoutine = onCall({
    secrets: ["GEMINI_API_KEY"],
    maxInstances: 5,
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

    const uid = request.auth.uid;
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Profilo utente non trovato');
    }

    const userDataDB = userDoc.data();
    const plan = (userDataDB.subscription && userDataDB.subscription.plan) || 'free';
    const aiUsage = userDataDB.ai_usage || { count: 0, lastReset: null };

    // Check limits
    const limits = {
        'free': 1,
        'pro': 7,
        'pt': 100
    };

    const maxAI = limits[plan.toLowerCase()] || 1;
    const isMonthly = plan.toLowerCase() !== 'free';

    let currentCount = aiUsage.count || 0;
    const now = new Date();
    let lastReset = aiUsage.lastReset ? (aiUsage.lastReset.toDate ? aiUsage.lastReset.toDate() : new Date(aiUsage.lastReset)) : null;

    if (isMonthly) {
        // Reset monthly counter if needed
        if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
            currentCount = 0;
            lastReset = now;
        }
    }

    if (currentCount >= maxAI) {
        throw new HttpsError('resource-exhausted', `Hai raggiunto il limite di ${maxAI} schede AI per il tuo piano attuale.`);
    }

    const { userData, exerciseNames } = request.data;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('Chiave API Gemini non configurata.');
    }

    // ... (rest of the existing logic)

    // Calcolo BMI e categorizzazione per una guida più precisa
    const altezzaM = userData.altezza / 100;
    const bmi = (userData.peso / (altezzaM * altezzaM)).toFixed(1);
    let bmiStatus = "";
    if (bmi < 18.5) bmiStatus = "Sottopeso";
    else if (bmi < 25) bmiStatus = "Normopeso";
    else if (bmi < 30) bmiStatus = "Sovrappeso";
    else if (bmi < 35) bmiStatus = "Obesità Classe I";
    else bmiStatus = "Obesità Classe II o superiore";

    // Lista di modelli da provare in ordine di preferenza (Piano Free)
    // Utilizziamo modelli stabili e performanti, con fallback automatico
    const models = [
        'gemini-3.0-flash',    // Modello di punta Gemini 3
        'gemini-2.5-flash',    // Modello Gemini 2.5
        'gemini-2.0-flash'     // Modello Gemini 2.0 stabile
    ];

    let lastError = null;
    const maxRetriesPerModel = 3; // Aumentato per maggiore resilienza
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    
    // Flag per gestire il rate limiting globale (se un modello è in 429, probabilmente lo sono tutti)
    let isRateLimited = false;

    for (const modelName of models) {
        if (isRateLimited) break; 
        
        let retryCount = 0;
        
        while (retryCount <= maxRetriesPerModel) {
            try {
                console.log(`Tentativo generazione scheda con modello: ${modelName} (Tentativo ${retryCount + 1}/${maxRetriesPerModel + 1})`);
                
                const systemPrompt = `
Sei un Personal Trainer d'élite con competenze avanzate in fisiologia, biomeccanica e nutrizione sportiva.
Il tuo compito è creare una scheda di allenamento professionale, SCIENTIFICAMENTE VALIDA e CALIBRATA sui parametri biometrici dell'utente.

Dati Utente:
- Sesso: ${userData.sesso}, Età: ${userData.eta} anni, Altezza: ${userData.altezza} cm, Peso: ${userData.peso} kg.
- BMI: ${bmi} (${bmiStatus}).
- Obiettivo: ${userData.obiettivo}. Esperienza: ${userData.esperienza}.
- Tipo di Allenamento: ${userData.workout_type}. Focus: ${userData.focus.join(', ')}.
- Limitazioni: ${userData.limitazioni || 'Nessuna'}.

Linee Guida Scientifiche per la Generazione:
1. CALIBRAZIONE CARICHI E INTENSITÀ:
   - Utilizza la scala RPE (Rating of Perceived Exertion) 1-10 per ogni esercizio.
   - Principianti (0-1 anni): RPE 6-7, focus su tecnica e controllo motorio.
   - Intermedi (1-3 anni): RPE 7-8, sovraccarico progressivo moderato.
   - Avanzati (>3 anni): RPE 8-9, tecniche di intensità (es. cedimento tecnico).

2. PARAMETRI FISIOLOGICI (Volume e Recupero):
   - IPERTROFIA: 3-4 serie, 8-12 rep, recupero 90-120s. Tempo: 3-1-1-0.
   - FORZA: 3-5 serie, 3-6 rep, recupero 180-240s. Tempo: 2-0-X-0.
   - DIMAGRIMENTO/DEFINIZIONE: 2-3 serie, 12-20 rep, recupero 30-60s. Tempo: 2-0-2-0.
   - Se l'utente è in sovrappeso (BMI > 28), inserisci pause più lunghe se necessario per la sicurezza cardiovascolare.

3. SELEZIONE ESERCIZI E BIOMECCANICA:
   - BMI > 30: Evita Squat con bilanciere o Stacchi pesanti; usa Leg Press o varianti ai cavi/macchine per proteggere la colonna e le ginocchia.
   - Obiettivo Perdita Peso: Inserisci OBBLIGATORIAMENTE esercizi di cardio (camminata inclinata, cyclette, corsa, ellittica, ecc.) all'interno della scheda. Non devono essere gli unici esercizi, ma devono essere presenti in ogni sessione o come sessione dedicata.
   - Altezza > 185cm: Attenzione alle lunghe leve; suggerisci ROM (Range of Motion) controllato.

4. STRUTTURA DELLA SCHEDA (JSON):
   - "ripetizioni": Numero esatto o range (es. "10-12") o tempo (es. "30s").
   - "peso": 
     * Per esercizi a corpo libero (es. piegamenti, trazioni senza zavorra, squat a corpo libero), scrivi "A corpo libero".
     * Per TUTTI gli altri esercizi che utilizzano pesi, manubri, bilancieri, cavi o macchinari, DEVI SEMPRE specificare un numero (es. "10", "15.5", "40"). 
     * Il valore deve essere PRIVO di unità di misura (NON scrivere "kg").
     * NON lasciare mai il campo vuoto se l'esercizio non è a corpo libero.
   - "tempo": Specifica il tempo sotto tensione (es. "3-0-1-0").
   - "note": Spiega BREVEMENTE la motivazione scientifica della scelta (es. "Scelto per ridurre impatto sulle ginocchia dato il peso").

Esercizi Disponibili:
Usa SOLO questi nomi: ${JSON.stringify(exerciseNames)}.

IMPORTANTE: Rispondi SOLO con il JSON. Non aggiungere testo prima o dopo.

Struttura:
{
  "nome_scheda": "Titolo Professionale",
  "descrizione": "Spiegazione scientifica della strategia adottata basata su BMI ${bmi} e obiettivo ${userData.obiettivo}.",
  "sedute": [
    {
      "giorno": 1,
      "nome_seduta": "Focus Muscolare",
      "esercizi": [
        {
          "nome": "Nome esatto",
          "serie": 3,
          "ripetizioni": "12",
          "recupero": "60s",
          "peso": "10",
          "rpe": "7",
          "tempo": "3-0-1-0",
          "note": "Motivazione tecnica"
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
                }, {
                    timeout: 60000 // 60s timeout per singola richiesta
                });

                // Estrai e parsea la risposta
                let text = response.data.candidates[0].content.parts[0].text;
                text = text.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsedResult = JSON.parse(text);

                console.log(`Successo con modello: ${modelName}`);
                
                // Increment usage counter after success
                await userRef.update({
                    'ai_usage.count': currentCount + 1,
                    'ai_usage.lastReset': lastReset || now
                });

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
                
                lastError = error;

                // Gestione 429: Too Many Requests
                if (status === 429) {
                    if (retryCount < maxRetriesPerModel) {
                        retryCount++;
                        // Backoff esponenziale con jitter (2s, 4s, 8s... + random)
                        const baseWait = Math.pow(2, retryCount) * 1000;
                        const jitter = Math.random() * 1000;
                        const waitTime = baseWait + jitter;
                        
                        console.log(`Quota superata (429) per ${modelName}. Riprovo tra ${Math.round(waitTime)}ms...`);
                        await delay(waitTime);
                        continue; // Riprova il ciclo while con lo stesso modello
                    } else {
                        // Se abbiamo esaurito i retry per questo modello con 429, 
                        // è inutile provare gli altri immediatamente (stessa API KEY)
                        console.error(`Quota esaurita definitivamente per ${modelName} dopo ${maxRetriesPerModel} tentativi.`);
                        isRateLimited = true;
                        break; 
                    }
                }

                // Se l'errore è 403 (Auth/API Key non valida) o 400 (Bad Request - es. prompt troppo lungo)
                if (status === 403 || status === 400) {
                    console.error(`Errore bloccante (${status}). Salto il modello.`);
                    break; // Esci dal ciclo while
                }
                
                // Per altri errori (404, 500), passiamo al prossimo modello
                console.warn(`Errore non fatale (${status}). Provo il prossimo modello se disponibile.`);
                break; // Esci dal ciclo while, continua il ciclo for dei modelli
            }
        }
    }

    // Se arriviamo qui, tutti i modelli hanno fallito
    const status = lastError?.response?.status;
    const errorData = lastError?.response?.data;

    console.error('TUTTI I MODELLI HANNO FALLITO:', {
        status,
        data: JSON.stringify(errorData)
    });

    if (status === 429 || isRateLimited) {
        throw new HttpsError('resource-exhausted', 
            'Quota Gemini temporaneamente superata. Per evitare di consumare troppi tentativi, la generazione è stata sospesa. Riprova tra 1-2 minuti.'
        );
    }

    if (status === 404) {
        throw new HttpsError('not-found', 
            'Modello AI non disponibile. Controlla la configurazione della chiave API Gemini.'
        );
    }

    throw new HttpsError('internal', 
        `Errore nella generazione della scheda: ${lastError?.message || 'Errore sconosciuto'}. Riprova.`
    );
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

    const models = ['gemini-3.0-flash', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return { success: false, error: "GEMINI_API_KEY mancante." };
    }

    for (const modelName of models) {
        try {
            console.log(`Test connettività per modello: ${modelName}`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await axios.post(url, {
                contents: [{ role: "user", parts: [{ text: "Ciao, rispondi OK." }] }]
            }, { timeout: 10000 });

            return {
                success: true,
                message: "Connessione riuscita!",
                modelUsed: modelName,
                response: response.data.candidates[0].content.parts[0].text
            };
        } catch (e) {
            const status = e.response?.status;
            console.error(`Test fallito per ${modelName}: Status ${status} | ${e.message}`);
            if (status === 429) {
                return { success: false, error: "Quota superata (429). Attendi qualche minuto." };
            }
        }
    }

    return { success: false, error: "Nessun modello ha risposto correttamente." };
});
