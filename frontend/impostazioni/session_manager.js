/**
 * SessionManager.js
 * Gestisce le sessioni utente su Firestore per permettere il logout remoto.
 */

const SessionManager = {
    /**
     * Genera un UUID v4 semplice per il sessionId
     */
    generateSessionId: function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    /**
     * Ottiene informazioni sul dispositivo corrente dallo User Agent
     */
    getDeviceInfo: function() {
        const ua = navigator.userAgent;
        let browser = "Sconosciuto";
        let deviceName = "Dispositivo generico";

        // Browser Detection
        if (ua.indexOf("Firefox") > -1) browser = "Firefox";
        else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Browser";
        else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
        else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
        else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) browser = "Edge";
        else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
        else if (ua.indexOf("Safari") > -1) browser = "Safari";

        // Device Detection
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const platform = navigator.platform;

        if (/iPhone/.test(ua)) deviceName = "iPhone";
        else if (/iPad/.test(ua)) deviceName = "iPad";
        else if (/Android/.test(ua)) deviceName = "Dispositivo Android";
        else if (/Windows/.test(platform)) deviceName = "Windows PC";
        else if (/Mac/.test(platform)) deviceName = "Mac";
        else if (/Linux/.test(platform)) deviceName = "Linux PC";

        return {
            browser: browser,
            deviceName: `${browser} su ${deviceName}`,
            userAgent: ua,
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            valid: true
        };
    },

    /**
     * Crea una nuova sessione in Firestore
     */
    createSession: async function(uid) {
        const sessionId = this.generateSessionId();
        const deviceInfo = this.getDeviceInfo();
        
        try {
            // Salva all'interno del documento utente (map 'sessions') 
            // per rispettare la regola allow write: if isOwner(userId)
            await firebase.firestore()
                .collection('users')
                .doc(uid)
                .update({
                    [`sessions.${sessionId}`]: deviceInfo
                });
            
            localStorage.setItem('fitsuite_sessionId', sessionId);
            console.log('Sessione creata con successo nel documento utente:', sessionId);
            return sessionId;
        } catch (error) {
            console.error('Errore durante la creazione della sessione:', error);
            return null;
        }
    },

    /**
     * Verifica se la sessione corrente esiste e la crea se necessario (per utenti già loggati)
     */
    syncSession: async function(uid) {
        const sessionId = localStorage.getItem('fitsuite_sessionId');
        if (!sessionId) {
            console.log('Nessun sessionId trovato, creazione nuova sessione per utente esistente...');
            return await this.createSession(uid);
        }

        // Tenta di aggiornare lastActive direttamente. Se fallisce (perché la sessione non esiste o permessi negati),
        // allora creiamo una nuova sessione. Questo risparmia una lettura (get()).
        try {
            const db = firebase.firestore();
            const userRef = db.collection('users').doc(uid);
            
            await userRef.update({
                [`sessions.${sessionId}.lastActive`]: firebase.firestore.FieldValue.serverTimestamp(),
                [`sessions.${sessionId}.valid`]: true // Assicuriamoci che sia valida
            });
            
            console.log('Sessione sincronizzata con successo (lastActive aggiornato)');
            return sessionId;
        } catch (error) {
            console.warn('Impossibile aggiornare lastActive, la sessione potrebbe non esistere o essere non valida. Creazione nuova...');
            return await this.createSession(uid);
        }
    },

    /**
     * Esegue il logout remoto di una sessione specifica
     */
    removeRemoteSession: async function(uid, targetSessionId) {
        try {
            await firebase.firestore()
                .collection('users')
                .doc(uid)
                .update({
                    [`sessions.${targetSessionId}`]: firebase.firestore.FieldValue.delete()
                });
            return true;
        } catch (error) {
            console.error('Errore durante la rimozione della sessione remota:', error);
            return false;
        }
    },

    /**
     * Esegue il logout locale pulendo tutto
     */
    logoutLocal: async function() {
        const auth = firebase.auth();
        const uid = auth.currentUser ? auth.currentUser.uid : null;
        const sessionId = localStorage.getItem('fitsuite_sessionId');

        if (uid && sessionId) {
            // Tenta di eliminare la sessione dal documento utente
            try {
                await firebase.firestore()
                    .collection('users')
                    .doc(uid)
                    .update({
                        [`sessions.${sessionId}`]: firebase.firestore.FieldValue.delete()
                    });
            } catch (e) {
                console.warn('Impossibile eliminare la sessione dal DB durante il logout:', e);
            }
        }

        // Pulisce tutta la cache tramite CacheManager
        if (window.CacheManager && typeof window.CacheManager.clearAllCache === 'function') {
            window.CacheManager.clearAllCache();
        } else {
            console.warn("CacheManager non trovato, eseguo pulizia manuale parziale");
            localStorage.removeItem('fitsuite_sessionId');
            localStorage.removeItem('lastUserId');
            // Pulisce anche altre chiavi di cache se necessario
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('userProfile_') || key.startsWith('userPreferences_') || key.startsWith('routines_'))) {
                    localStorage.removeItem(key);
                    i--;
                }
            }
        }

        await auth.signOut();
        window.location.href = '../auth/auth.html';
    }
};

// Esporta globalmente
window.SessionManager = SessionManager;
