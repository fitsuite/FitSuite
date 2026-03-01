# 📝 Istruzioni Complete - Setup su Mac

## PASSO 1: Rigenerare la Chiave API Gemini (5 minuti)

1. Vai a https://console.cloud.google.com/
2. Seleziona il progetto **"Default Gemini Project"** (in alto a sinistra)
3. Nel menu sinistro, vai a **APIs & Services** → **Credentials**
4. Trova la chiave API compromessa (AIzaSyDNPxVF48XPgh3r2g-YYXi_RR0kzOPtjfk)
5. Clicca il menu **⋯** (tre puntini) e seleziona **Rigenera chiave**
6. Copia la **NUOVA chiave API** (inizia con `AIza...`)
7. Tienila in un file di testo temporaneo sul tuo Mac

---

## PASSO 2: Installa Firebase CLI (2 minuti)

Apri il **Terminal** su Mac (cmd+space, digita "Terminal", premi Enter)

Se non hai Homebrew:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Installa Firebase CLI con Homebrew:
```bash
brew install firebase-tools
```

Verifica che sia installato:
```bash
firebase --version
```

Dovrebbe stamparti una versione (es. 13.5.0)

---

## PASSO 3: Accedi a Firebase (1 minuto)

Nel Terminal, digita:

```bash
firebase login
```

Si aprirà il browser. Accedi con l'account Google che hai usato per Firebase.

Torna al Terminal e premi Enter per continuare.

---

## PASSO 4: Installa Dipendenze Cloud Functions (2 minuti)

Nel Terminal, naviga nella cartella delle functions:

```bash
cd "/Users/fabiopesente/Library/Mobile Documents/com~apple~CloudDocs/FitSuite/FitSuite/backend/functions"
```

(Se lo spazio ti da problemi, prova con il Tab autocomplete)

Installa le dipendenze (è stato aggiornato firebase-functions alla versione 5.0.0):

```bash
rm package-lock.json
npm install
```

Aspetta finché non finisce (vedi il ✔ in fondo)

---

## PASSO 5: Configura il Secret della Chiave API in Firebase (2 minuti)

Nel Terminal, torna alla root del progetto:

```bash
cd "/Users/fabiopesente/Library/Mobile Documents/com~apple~CloudDocs/FitSuite/FitSuite"
```

Configura il secret della chiave Gemini API (il terminale ti chiederà interattivamente di incollare la chiave):

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Quando ti chiede, incolla la **NUOVA chiave Gemini API** che hai copiato al PASSO 1, poi premi Enter.

Esempio di input:
```
Enter a value for GEMINI_API_KEY:
AIzaSyDNPx...  (incolla qui la chiave)
✔ Set secret GEMINI_API_KEY
```

Verifica che sia stata salvata:

```bash
firebase functions:secrets:list
```

Dovresti vedere `GEMINI_API_KEY` nella lista

---

## PASSO 6: Deploy delle Cloud Functions (3 minuti)

Nel Terminal (dalla root del progetto):

```bash
firebase deploy --only functions
```

Aspetta che finisca. Dovresti vedere qualcosa come:

```
✔ Deploy complete!

Function URL (generateWorkoutRoutine(us-central1)): 
https://us-central1-fitsuite-a7b6c.cloudfunctions.net/generateWorkoutRoutine
```

**PERFETTO!** La Cloud Function è live!

---

## PASSO 7: Testa che Funziona (5 minuti)

### Opzione A: Test da Firebase Console (Facile)

1. Vai a https://console.firebase.google.com
2. Seleziona il progetto **fitsuite-a7b6c**
3. Nel menu sinistro: **Functions** → **generateWorkoutRoutine**
4. Vai al tab **Testing** (a destra)
5. Nel campo "Request body", incolla questo:

```json
{
  "userData": {
    "sesso": "M",
    "eta": 28,
    "peso": 75,
    "altezza": 178,
    "obiettivo": "Massa",
    "esperienza": "Intermedio",
    "giorni": 4,
    "focus": ["Petto", "Schiena"],
    "limitazioni": ""
  },
  "exerciseNames": ["Panca Piana", "Trazioni", "Manubri Inclinati", "Rematore con Bilanciere"]
}
```

6. Clicca **Execute**
7. Aspetta 10-20 secondi
8. Dovresti vedere la scheda generata in JSON nel campo "Response"

### Opzione B: Test dal Sito (Più Realistico)

1. Apri il sito http://localhost:8080 (se lo hai in locale) oppure il tuo sito pubblico
2. Vai alla pagina "Crea Scheda AI"
3. Compila il form normalmente
4. Clicca "Genera Scheda"
5. Dovresti vedere la scheda generata normalmente

Se non funziona, apri Developer Tools (F12) e guarda la console per errori.

---

## PASSO 8: Verifica che la Chiave Non è Esposta (2 minuti)

Apri il sito → F12 (Developer Tools) → Tab **Network**

Genera una scheda → Guarda le chiamate di rete

Dovresti vedere:
- ❌ **NO** una chiamata a `generativelanguage.googleapis.com` (quella esporrebbe la chiave)
- ✅ **SÌ** una chiamata a `cloudfunctions.net` (quella è sicura)

Se vedi la prima, ricarica la pagina e riprova.

---

## PASSO 9: Pulisci il Git History su GitHub (Opzionale ma IMPORTANTE)

Se il repo è pubblico su GitHub, devi rimuovere la vecchia chiave dalla storia.

Nel Terminal:

```bash
cd "/Users/fabiopesente/Library/Mobile Documents/com~apple~CloudDocs/FitSuite/FitSuite"

# Installa BFG (tool per pulire git history)
brew install bfg

# Pulisci il file config.js dalla storia
bfg --delete-files config.js

# Applica le modifiche
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Carica su GitHub (ATTENZIONE: usa --force-with-lease)
git push origin --force-with-lease
```

Se il repo è privato, puoi saltare questo step per adesso.

---

## ✅ CHECKLIST FINALE

- [ ] Rigenerata nuova chiave Gemini API
- [ ] Installato firebase-tools (`firebase --version` funziona)
- [ ] Fatto login Firebase (`firebase login`)
- [ ] Installate dipendenze Cloud Functions (`cd .../functions && npm install`)
- [ ] Configurata chiave API (`firebase functions:config:set gemini.api_key="..."`)
- [ ] Deploy fatto (`firebase deploy --only functions`)
- [ ] Testato da Firebase Console (Response mentra visualizzato)
- [ ] Testato dal sito (Genera Scheda funziona)
- [ ] Verificato Network tab (NO gemini API call, SÌ cloudfunctions call)
- [ ] Pulito git history (se repo è pubblico)

---

## 🆘 Se Qualcosa Non Funziona

### Errore: "Secret not found" durante deploy

Assicurati di aver fatto:
```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions
```

### Errore: "permission denied" durante deploy

```bash
firebase projects:list
firebase use --add
# Seleziona fitsuite-a7b6c
firebase deploy --only functions
```

### Errore: "Cloud Function non trovata" dal sito

Ricorda che devi aver fatto:
```bash
firebase deploy --only functions
```

### Errore: "UNAUTHENTICATED" quando generi scheda dal sito

Assicurati di essere loggato al sito. La Cloud Function richiede autenticazione Firebase.

### Errore: "API disabled"

1. Vai a https://console.cloud.google.com
2. Vai a **APIs & Services** → **Library**
3. Cerca **"Generative Language API"**
4. Se non è abilitata, clicca **Enable**

### La scheda non genera

Aspetta 20-30 secondi, Gemini a volte è lento. Se continua, guarda la console del browser (F12) per errori.

---

## 📱 Come Shareware il Sito

Una volta che tutto funziona:

1. Deploya il sito su **Firebase Hosting**:
```bash
firebase deploy --only hosting
```

2. Url del sito sarà: `https://fitsuite-a7b6c.web.app`

3. Chiunque dal mondo può visitare il link e generare schede senza vedere la chiave API ✅

