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

        // Crea il prompt
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

        // Chiama Gemini API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        
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

        return {
            success: true,
            routine: parsedResult
        };

    } catch (error) {
        console.error('Errore nella generazione della scheda:', error);
        
        if (error.response?.status === 429) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'Quota API Gemini esaurita. Attendi il reset giornaliero o attiva un piano a pagamento.'
            );
        }

        throw new functions.https.HttpsError(
            'internal',
            `Errore nella generazione: ${error.message}`
        );
    }
});
