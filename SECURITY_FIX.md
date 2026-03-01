# 🔐 SECURITY FIX - Chiavi API Esposte

## ⚠️ AZIONI URGENTI DA COMPIERE

### 1️⃣ RIGENERARE LE CHIAVI API NELLA CONSOLE GOOGLE CLOUD

La tua chiave Gemini è stata compromessa e DEVE essere rigenerata:

**Chiave compromessa:**
- `AIzaSyDNPxVF48XPgh3r2g-YYXi_RR0kzOPtjfk` ❌

**Passi per rigenerare:**
1. Vai a https://console.cloud.google.com/
2. Seleziona il progetto "Default Gemini Project"
3. Vai a **Credenziali** (Navigation → APIs & Services → Credentials)
4. Trova la chiave API compromessa
5. Clicca il menu **...** e seleziona **Rigenera chiave** (o Elimina e crea una nuova)
6. Copia la **nuova chiave API**

---

### 2️⃣ SETUP LOCALE DELLE CHIAVI (NON COMMITTARE SU GITHUB)

**Già è stato creato il setup di sicurezza:**
- ✅ `.gitignore` - esclude file con chiavi sensibili
- ✅ `config.local.js.example` - template da copiare
- ✅ `config.js` - modificato per caricare config.local.js

**Cosa devi fare:**

```bash
# Naviga nella directory frontend
cd frontend/

# Copia il template
cp config.local.js.example config.local.js
```

Poi apri `config.local.js` e incolla le tue nuove chiavi:

```javascript
window.CONFIG = {
    FIREBASE: {
        apiKey: "NUOVA_CHIAVE_FIREBASE_QUI",
        authDomain: "fitsuite-a7b6c.firebaseapp.com",
        projectId: "fitsuite-a7b6c",
        storageBucket: "fitsuite-a7b6c.firebasestorage.app",
        messagingSenderId: "721614273457",
        appId: "1:721614273457:web:195f48279fafd01a1f5b90",
        measurementId: "G-W4ME455MH5"
    },
    GEMINI: {
        API_KEY: "NUOVA_CHIAVE_GEMINI_QUI"  // ← La nuova chiave rigenerate
    }
};
```

---

### 3️⃣ PULIRE LA STORIA DI GIT SU GITHUB

⚠️ **CRITICO:** Le chiavi vecchie rimangono nel git history anche se le rimuovi dai file attuali!

Se il tuo repo è **pubblico**, devi pulire il history:

```bash
# Opzione 1: Usando BFG Repo-Cleaner (consigliato, più semplice)
# Installa: brew install bfg
cd /path/to/FitSuite
bfg --delete-files config.js
bfg --delete-files config.local.js
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push origin --force-with-lease

# Opzione 2: Usando git filter-branch (manuale, più lento)
git filter-branch --tree-filter 'rm -f frontend/config.js' -- --all
git push origin --force-with-lease
```

Se il tuo repo è **privato**, almeno per adesso sei più al sicuro, ma è comunque consigliato pulire il history.

---

### 4️⃣ AGGIORNARE I FILE HTML (OPZIONALE)

Al momento, i file HTML hanno ancora la configurazione Firebase hardcoded. Questo è tecnicamente OK per Firebase auth key (è pubblica per design), ma per essere ultra-sicuri puoi:

1. Accedere alla [Google Cloud Console](https://console.cloud.google.com)
2. Andare su **Credenziali → Chiavi API**
3. Cliccare sulla tua chiave Firebase
4. Aggiungere **Restrizioni HTTP referer** (solo dominio fitsuite.com)

---

## ✅ CHECKLIST DI COMPLETAMENTO

- [ ] Rigenerata nuova chiave Gemini API
- [ ] Copiato `config.local.js.example` in `config.local.js`
- [ ] Incollato le nuove chiavi in `config.local.js`
- [ ] Testata l'app (dovrebbe funzionare con le nuove chiavi)
- [ ] Pulito il git history da GitHub
- [ ] Verificato che `.gitignore` è nel root del progetto
- [ ] Fatto commit delle modifiche (senza le vere chiavi!)

---

## 🔍 COSA ABBIAMO MODIFICATO

1. **Creato `.gitignore`** - esclude `config.local.js` e altri file sensibili
2. **Creato `config.local.js.example`** - template pubblico
3. **Modificato `config.js`** - ora usa placeholder e carica `config.local.js`
4. **Creato `config-loader.js`** - script helper (opzionale)

---

## ⚡ PROSSIMI STEP (DOPO AVER RIGENERATO LE CHIAVI)

Se vuoi automatizzare meglio il caricamento delle chiavi in futuro:
- Considera di usare un backend Node.js che serve le credenziali
- Oppure usa un bundler (Webpack/Vite) che lesse da `.env`
- Per adesso, la soluzione `config.local.js` è pratica e sicura

