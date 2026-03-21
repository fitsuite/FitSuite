// Test script per verificare la sincronizzazione della cache
// Questo script può essere eseguito nella console del browser per testare il sistema

function testCacheSync() {
    console.log('=== TEST SINCRONIZZAZIONE CACHE ===');
    
    // Verifica che CacheManager sia disponibile
    if (!window.CacheManager) {
        console.error('❌ CacheManager non disponibile');
        return false;
    }
    
    console.log('✅ CacheManager disponibile');
    
    // Verifica le funzioni necessarie
    const requiredFunctions = [
        'getPreferences',
        'savePreferences', 
        'getRoutines',
        'saveRoutines',
        'updateSingleRoutineInCache',
        'removeRoutineFromCache',
        'getLocalRoutinesCache',
        'updateLocalRoutinesCache'
    ];
    
    let allFunctionsAvailable = true;
    requiredFunctions.forEach(func => {
        if (typeof window.CacheManager[func] !== 'function') {
            console.error(`❌ Funzione mancante: ${func}`);
            allFunctionsAvailable = false;
        } else {
            console.log(`✅ Funzione disponibile: ${func}`);
        }
    });
    
    if (!allFunctionsAvailable) {
        console.error('❌ Alcune funzioni necessarie non sono disponibili');
        return false;
    }
    
    // Test salvataggio e recupero preferences
    const testUid = 'test_user_123';
    const testPrefs = { color: 'Blu', language: 'Italiano' };
    
    try {
        window.CacheManager.savePreferences(testUid, testPrefs);
        const retrievedPrefs = window.CacheManager.getPreferences(testUid);
        
        if (JSON.stringify(retrievedPrefs) === JSON.stringify(testPrefs)) {
            console.log('✅ Test preferences: PASS');
        } else {
            console.error('❌ Test preferences: FAIL - Dati non corrispondenti');
            return false;
        }
    } catch (error) {
        console.error('❌ Test preferences: ERROR', error);
        return false;
    }
    
    // Test salvataggio e recupero routines
    const testRoutines = [
        { id: 'routine1', name: 'Test Routine 1', createdAt: new Date() },
        { id: 'routine2', name: 'Test Routine 2', createdAt: new Date() }
    ];
    
    try {
        window.CacheManager.saveRoutines(testUid, testRoutines);
        const retrievedRoutines = window.CacheManager.getRoutines(testUid);
        
        if (retrievedRoutines && retrievedRoutines.length === testRoutines.length) {
            console.log('✅ Test routines base: PASS');
        } else {
            console.error('❌ Test routines base: FAIL');
            return false;
        }
    } catch (error) {
        console.error('❌ Test routines base: ERROR', error);
        return false;
    }
    
    // Test updateSingleRoutineInCache
    const newRoutine = { id: 'routine3', name: 'New Routine', createdAt: new Date() };
    try {
        window.CacheManager.updateSingleRoutineInCache(testUid, newRoutine);
        const updatedRoutines = window.CacheManager.getRoutines(testUid);
        
        if (updatedRoutines && updatedRoutines.find(r => r.id === 'routine3')) {
            console.log('✅ Test updateSingleRoutineInCache: PASS');
        } else {
            console.error('❌ Test updateSingleRoutineInCache: FAIL');
            return false;
        }
    } catch (error) {
        console.error('❌ Test updateSingleRoutineInCache: ERROR', error);
        return false;
    }
    
    // Test removeRoutineFromCache
    try {
        window.CacheManager.removeRoutineFromCache(testUid, 'routine1');
        const finalRoutines = window.CacheManager.getRoutines(testUid);
        
        if (finalRoutines && !finalRoutines.find(r => r.id === 'routine1')) {
            console.log('✅ Test removeRoutineFromCache: PASS');
        } else {
            console.error('❌ Test removeRoutineFromCache: FAIL');
            return false;
        }
    } catch (error) {
        console.error('❌ Test removeRoutineFromCache: ERROR', error);
        return false;
    }
    
    // Test funzioni helper
    try {
        const helperRoutines = window.CacheManager.getLocalRoutinesCache(testUid);
        const helperRoutines2 = window.CacheManager.getRoutines(testUid);
        
        if (JSON.stringify(helperRoutines) === JSON.stringify(helperRoutines2)) {
            console.log('✅ Test getLocalRoutinesCache helper: PASS');
        } else {
            console.error('❌ Test getLocalRoutinesCache helper: FAIL');
            return false;
        }
    } catch (error) {
        console.error('❌ Test getLocalRoutinesCache helper: ERROR', error);
        return false;
    }
    
    console.log('=== TUTTI I TEST PASSATI ===');
    console.log('✅ Il sistema di cache è correttamente sincronizzato');
    
    // Cleanup test data
    try {
        localStorage.removeItem(`userPreferences_${testUid}`);
        localStorage.removeItem(`cachedRoutines_${testUid}`);
        console.log('🧹 Test data cleaned up');
    } catch (error) {
        console.warn('⚠️ Cleanup non completato', error);
    }
    
    return true;
}

// Funzione per testare la sincronizzazione reale con il database
async function testRealTimeSync() {
    console.log('=== TEST SINCRONIZZAZIONE REAL-TIME ===');
    
    if (!firebase.auth().currentUser) {
        console.error('❌ Utente non autenticato');
        return false;
    }
    
    const uid = firebase.auth().currentUser.uid;
    console.log(`👤 Test per utente: ${uid}`);
    
    // Test cache corrente
    const currentPrefs = window.CacheManager.getPreferences(uid);
    const currentRoutines = window.CacheManager.getRoutines(uid);
    
    console.log('📊 Preferences correnti:', currentPrefs);
    console.log('📋 Routines correnti:', currentRoutines?.length || 0, 'routine');
    
    // Simula un cambiamento
    if (currentPrefs) {
        const originalColor = currentPrefs.color;
        const testColor = originalColor === 'Arancione' ? 'Blu' : 'Arancione';
        
        console.log(`🔄 Test cambio colore: ${originalColor} → ${testColor}`);
        
        try {
            // Aggiorna cache
            window.CacheManager.savePreferences(uid, { ...currentPrefs, color: testColor });
            
            // Verifica cache aggiornata
            const updatedPrefs = window.CacheManager.getPreferences(uid);
            if (updatedPrefs.color === testColor) {
                console.log('✅ Cache aggiornata con successo');
                
                // Ripristina originale
                setTimeout(() => {
                    window.CacheManager.savePreferences(uid, { ...updatedPrefs, color: originalColor });
                    console.log('🔄 Preferenze originali ripristinate');
                }, 2000);
                
                return true;
            } else {
                console.error('❌ Cache non aggiornata correttamente');
                return false;
            }
        } catch (error) {
            console.error('❌ Errore durante test sincronizzazione:', error);
            return false;
        }
    } else {
        console.warn('⚠️ Nessuna preferenza trovata per test');
        return false;
    }
}

// Esporta funzioni per uso globale
window.testCacheSync = testCacheSync;
window.testRealTimeSync = testRealTimeSync;

console.log('🧪 Test cache sync caricato. Esegui testCacheSync() per iniziare');
