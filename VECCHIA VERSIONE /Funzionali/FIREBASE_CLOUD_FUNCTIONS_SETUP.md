# 🔐 Firebase Cloud Functions Setup - Protezione Chiave API Gemini

## Come Funziona

```
Frontend (pubblico)
    ↓ chiama Cloud Function
Tuo Backend Firebase (SICURO)
    ↓ usa chiave API segreta nel server
API Gemini
```

La **chiave API rimane nascosta sul server**, il frontend la chiama solo tramite Cloud Function.

---

## 📋 Setup Iniziale (ESEGUIRE UNA SOLA VOLTA)

### 1. Installa Firebase CLI
```bash
npm install -g firebase-tools
```

### 2. Accedi a Firebase
```bash
firebase login
```

### 3. Inizializza il progetto (se non l'hai già fatto)
```bash
cd /Users/fabiopesente/Library/Mobile\ Documents/com~apple~CloudDocs/FitSuite/FitSuite
firebase init functions
```
Rispondi alle domande:
- Seleziona il progetto: **fitsuite-a7b6c**
- Linguaggio: **JavaScript**
- ESLint: **No** (per ora)

### 4. Installa dipendenze Cloud Functions
```bash
cd backend/functions
npm install
```

---

## 🔑 Configura la Chiave API Gemini in Cloud Functions

### Opzione A: Via Firebase Console (Consigliato)

1. Vai a [Firebase Console](https://console.firebase.google.com)
2. Seleziona il progetto **fitsuite-a7b6c**
3. Vai a **Impostazioni progetto** (in basso a sinistra) → **Cloud Functions**
4. Clicca **Variabili di ambiente**
5. Aggiungi una nuova variabile:
   - **Nome**: `GEMINI_API_KEY`
   - **Valore**: Incolla la tua nuova chiave Gemini rigenerate da Google Cloud Console

### Opzione B: Via Firebase Deploy (Riga di comando)

```bash
firebase functions:config:set gemini.api_key="TUA_CHIAVE_GEMINI_QUI"
```

Verifica che sia configurata:
```bash
firebase functions:config:get
```

Dovrebbe mostrare:
```json
{
  "gemini": {
    "api_key": "AIza..."
  }
}
```

---

## 📦 Distribuisci le Cloud Functions

### Su Firebase Hosting (Consigliato)

```bash
cd /Users/fabiopesente/Library/Mobile\ Documents/com~apple~CloudDocs/FitSuite/FitSuite
firebase deploy --only functions
```

Output atteso:
```
✔ Deploy complete!

Function URL (generateWorkoutRoutine(us-central1)): 
https://us-central1-fitsuite-a7b6c.cloudfunctions.net/generateWorkoutRoutine
```

---

## ✅ Verifica Che Funziona

### Test dalla Console Firebase

1. Vai a **Cloud Functions** su Firebase Console
2. Clicca sulla funzione `generateWorkoutRoutine`
3. Vai al tab **Testing**
4. Incolla un test request:

```json
{
  "userData": {
    "sesso": "M",
    "eta": 30,
    "peso": 80,
    "altezza": 180,
    "obiettivo": "Massa",
    "esperienza": "Avanzato",
    "giorni": 4,
    "focus": ["Petto", "Schiena"],
    "limitazioni": null
  },
  "exerciseNames": ["Panca Piana", "Trazioni", "Manubri Inclinati"]
}
```

Clicca **Execute** → Dovresti vedere la scheda generata in formato JSON

---

## 🚀 Nel Frontend (Già Modificato)

Il file `crea_scheda_ai.js` è già stato aggiornato per:
1. Eliminare la chiave API dal codice client
2. Chiamare la Cloud Function anzichè l'API direttamente
3. Gestire i nuovi errori

Non hai bisogno di modificare altro nel frontend!

---

## 🔍 Debugging se Ce Problemi

### Errore: "Numero credential error" nella Cloud Function

**Soluzione**: Verifica che la chiave API sia in `firebase functions:config:get`

```bash
firebase functions:config:get
```

Se vuoto, riconfigura:
```bash
firebase functions:config:set gemini.api_key="TUA_CHIAVE_QUI"
firebase deploy --only functions
```

### Errore: "Permission denied" nelle Cloud Functions

**Soluzione**: Attiva API Gemini nella Google Cloud Console
1. Vai a https://console.cloud.google.com
2. Vai a **APIs & Services** → **Enabled APIs & services**
3. Cerca "Generative Language API"
4. Se non è abilitata, clicca **Enable**

### CloudFunction non esiste quando richiamata dal frontend

**Soluzione**: Assicurati di aver fatto deploy:
```bash
firebase deploy --only functions
```

Controlla che nel **Realtime Database Rules** non ci siano restrizioni:
```json
{
  "rules": {
    ".read": true,
    ".write": "auth != null"
  }
}
```

---

## 📊 Monitoraggio Costi

Cloud Functions **è gratis fino a 2M invocazioni/mese**, quindi per le tue esigenze potrebbe costarere poco o nulla.

Monitora i costi:
1. Firebase Console → **Usage** → **Cloud Functions**

---

## 🔒 Security Best Practices

✅ **fatto**: Chiave API nascosta nel server  
✅ **fatto**: Funzione richiede autenticazione Firebase  
✅ **fatto**: Input validato lato server  
✅ **fatto**: Nessun logging della chiave API

---

## 💾 File Modificati

- `backend/functions/generateRoutine.js` - Cloud Function
- `backend/functions/package.json` - Dipendenze Cloud Functions
- `frontend/crea_scheda_ai/crea_scheda_ai.js` - Chiama Cloud Function anzichè API diretta

