/**
 * Config Loader - Carica config.local.js se disponibile
 * Questo file deve essere incluso PRIMA di config.js nei tuoi HTML
 */

(function() {
    // Tenta di caricare config.local.js se esiste
    const script = document.createElement('script');
    script.src = '../config.local.js';
    script.onerror = function() {
        console.warn('⚠️  config.local.js non trovato. Usando config.js di default.');
        console.warn('📋 Per impostare le tue chiavi API, copia config.local.js.example in config.local.js');
    };
    document.head.appendChild(script);
})();
