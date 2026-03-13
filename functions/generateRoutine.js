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
   - BMI > 28 + Obiettivo Dimagrimento: Inserisci OBBLIGATORIAMENTE 15-20 min di cardio (camminata inclinata, cyclette) a fine o inizio sessione.
   - Altezza > 185cm: Attenzione alle lunghe leve; suggerisci ROM (Range of Motion) controllato.

4. STRUTTURA DELLA SCHEDA (JSON):
   - "ripetizioni": Numero esatto o range (es. "10-12") o tempo (es. "30s").
   - "peso": Suggerisci un peso iniziale realistico (es. "20kg") o "Corpo libero".
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
          "peso": "10kg",
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
