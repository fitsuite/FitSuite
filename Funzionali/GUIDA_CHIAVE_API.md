# 🔐 Guida per Cambiare la Chiave API Gemini

Questa guida spiega come aggiornare la chiave API di Gemini sia per lo sviluppo locale che per la versione pubblicata su Firebase.

## 1. Recuperare la Nuova Chiave API
1. Vai su [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Se hai già una chiave, copiala. Altrimenti, clicca su **"Create API key"**.
3. Assicurati che la chiave sia attiva per il modello che stai usando (es. Gemini 2.5 Flash).

---

## 2. Aggiornamento per lo Sviluppo Locale (sul tuo Mac)
Per far funzionare la creazione della scheda mentre lavori sul tuo computer, devi aggiornare il file `.env`.

1. Apri il file `.env` nella cartella principale del progetto.
2. Sostituisci il valore di `GEMINI_API_KEY` con la tua nuova chiave:
   ```env
   GEMINI_API_KEY=TUA_NUOVA_CHIAVE_QUI
   ```
3. Salva il file. L'emulatore Firebase leggerà automaticamente la nuova chiave.

---

## 3. Aggiornamento per la Produzione (Firebase) via Terminale
Questa è la procedura completa da eseguire nel terminale del tuo Mac per aggiornare la chiave sul sito live.

### Passaggio A: Accedere a Firebase
Se non sei già loggato o vuoi cambiare account:
```bash
# Effettua il login nel browser
firebase login

# Se sei già loggato e vuoi verificare l'account attivo
firebase login:list
```

### Passaggio B: Selezionare il Progetto
Assicurati di essere nel progetto corretto (`fitsuite-a7b6c`):
```bash
# Mostra i progetti disponibili e quello attivo
firebase projects:list

# Se il progetto attivo non è quello giusto, impostalo
firebase use fitsuite-a7b6c
```

### Passaggio C: Aggiornare la Chiave (Secret)
Firebase usa i "Secrets" per le chiavi API nelle funzioni v2.
```bash
# Imposta il nuovo valore per la chiave
firebase functions:secrets:set GEMINI_API_KEY
```
> **Nota**: Il terminale ti chiederà `Enter a value for GEMINI_API_KEY:`. Incolla la chiave e premi **Invio**.

Per verificare che la chiave sia stata salvata correttamente:
```bash
firebase functions:secrets:list
```

### Passaggio D: Pubblicare le Modifiche
Affinché le funzioni inizino a usare la nuova chiave, devi fare il deploy:
```bash
# Carica le funzioni su Firebase
firebase deploy --only functions
```

---

## 4. Metodo Alternativo: Firebase Console (Browser)
Se preferisci usare l'interfaccia web:
1. Vai alla [Firebase Console](https://console.firebase.google.com/).
2. Seleziona il progetto **fitsuite-a7b6c**.
3. Vai in **Build** -> **Functions**.
4. Clicca sulla scheda **Secrets** (in alto).
5. Trova `GEMINI_API_KEY`, clicca sull'icona della matita o "Aggiungi nuova versione" e incolla la nuova chiave.
6. **Importante**: Anche da qui, solitamente è necessario un nuovo deploy per rendere attiva la modifica.

---

## 5. Verifica del Funzionamento
Dopo aver cambiato la chiave, puoi verificare se tutto funziona:
1. Apri il sito o l'app locale.
2. Prova a creare una scheda con l'AI.
3. Se ricevi un errore "403 Permission Denied", la chiave è sbagliata o non ha i permessi.
4. Se ricevi un errore "429 Quota Exceeded", hai superato i limiti gratuiti su Google AI Studio.
