(function() {
    // Create Popup HTML structure
    const popupHTML = `
        <div id="customPopup" class="custom-popup-overlay">
            <div class="custom-popup-content">
                <h3 id="customPopupTitle" class="custom-popup-title">Avviso</h3>
                <p id="customPopupMessage" class="custom-popup-message"></p>
                <input type="text" id="customPopupInput" class="custom-popup-input" style="display:none;">
                <div class="custom-popup-actions">
                    <button id="customPopupCancel" class="custom-popup-btn secondary" style="display:none;">Annulla</button>
                    <button id="customPopupOk" class="custom-popup-btn primary">OK</button>
                </div>
            </div>
        </div>
    `;

    let resolvePromise = null;

    // Helper to push a dummy state to history to handle back button
    function pushPopupState() {
        if (!history.state || !history.state.popupOpen) {
            history.pushState({ popupOpen: true }, '');
        }
    }

    // Append to body when DOM is ready
    function initPopup() {
        if (!document.getElementById('customPopup')) {
            document.body.insertAdjacentHTML('beforeend', popupHTML);
            
            const overlay = document.getElementById('customPopup');
            const okBtn = document.getElementById('customPopupOk');
            const cancelBtn = document.getElementById('customPopupCancel');
            const input = document.getElementById('customPopupInput');

            function closePopup(result, fromBackAction = false) {
                overlay.classList.remove('show');
                if (resolvePromise) {
                    resolvePromise(result);
                    resolvePromise = null;
                }
                
                // If we closed it manually (not from back action), pop the state
                if (!fromBackAction && history.state && history.state.popupOpen) {
                    history.back();
                }
            }

            okBtn.addEventListener('click', () => {
                if (input.style.display !== 'none') {
                    closePopup(input.value);
                } else {
                    closePopup(true);
                }
            });

            cancelBtn.addEventListener('click', () => {
                closePopup(null); // Or false for confirm
            });
            
            // Allow Enter key in input
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    okBtn.click();
                }
            });

            // Listen for popstate to close popup
            window.addEventListener('popstate', (event) => {
                if (overlay.classList.contains('show')) {
                    if (cancelBtn && cancelBtn.style.display !== 'none') {
                        closePopup(null, true);
                    } else {
                        closePopup(true, true);
                    }
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopup);
    } else {
        initPopup();
    }

    // Reset popup state
    function resetPopup() {
        const titleEl = document.getElementById('customPopupTitle');
        const messageEl = document.getElementById('customPopupMessage');
        const inputEl = document.getElementById('customPopupInput');
        const cancelBtn = document.getElementById('customPopupCancel');
        const okBtn = document.getElementById('customPopupOk');

        titleEl.textContent = '';
        messageEl.textContent = '';
        messageEl.style.color = '';
        inputEl.value = '';
        inputEl.style.display = 'none';
        inputEl.classList.remove('error');
        inputEl.removeAttribute('maxlength');
        cancelBtn.style.display = 'none';
        cancelBtn.textContent = 'ANNULLA';
        okBtn.textContent = 'OK';
    }

    // Override window.alert
    window.alert = function(message, title = 'Avviso', okButtonText = 'CHIUDI') {
        return new Promise((resolve) => {
            if (!document.getElementById('customPopup')) initPopup();
            
            resetPopup();
            pushPopupState();
            
            const popup = document.getElementById('customPopup');
            const titleEl = document.getElementById('customPopupTitle');
            const messageEl = document.getElementById('customPopupMessage');
            const okBtn = document.getElementById('customPopupOk');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            okBtn.textContent = okButtonText;
            
            resolvePromise = resolve;
            popup.classList.add('show');
        });
    };

    // Custom Confirm
    window.showConfirm = function(message, title = 'Conferma', okButtonText = 'OK', cancelButtonText = 'Annulla') {
        return new Promise((resolve) => {
            if (!document.getElementById('customPopup')) initPopup();
            
            resetPopup();
            pushPopupState();
            
            const popup = document.getElementById('customPopup');
            const titleEl = document.getElementById('customPopupTitle');
            const messageEl = document.getElementById('customPopupMessage');
            const cancelBtn = document.getElementById('customPopupCancel');
            const okBtn = document.getElementById('customPopupOk');
            
            titleEl.textContent = title;
            messageEl.textContent = message;
            cancelBtn.style.display = 'inline-block';
            cancelBtn.textContent = cancelButtonText;
            okBtn.textContent = okButtonText;
            
            resolvePromise = (result) => {
                // If result is null (cancel clicked), resolve false
                // If result is true (ok clicked), resolve true
                resolve(!!result);
            };
            
            popup.classList.add('show');
        });
    };

    // Custom Prompt
    window.showPrompt = function(message, defaultValue = '', title = 'Inserisci', okButtonText = 'CONFERMA', cancelButtonText = 'ANNULLA', validateFn = null, maxLength = null) {
        return new Promise((resolve) => {
            if (!document.getElementById('customPopup')) initPopup();
            
            resetPopup();
            pushPopupState();
            
            const popup = document.getElementById('customPopup');
            const titleEl = document.getElementById('customPopupTitle');
            const messageEl = document.getElementById('customPopupMessage');
            const inputEl = document.getElementById('customPopupInput');
            const okBtn = document.getElementById('customPopupOk');
            const cancelBtn = document.getElementById('customPopupCancel');
            
            titleEl.textContent = title;
            messageEl.innerHTML = message.replace(/\n/g, '<br>');
            
            // Sostituiamo gli elementi per pulire tutti i listener precedenti
            const newInputEl = inputEl.cloneNode(true);
            inputEl.parentNode.replaceChild(newInputEl, inputEl);
            
            const newOkBtn = okBtn.cloneNode(true);
            okBtn.parentNode.replaceChild(newOkBtn, okBtn);
            
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

            newInputEl.value = defaultValue;
            newInputEl.style.display = 'block';
            if (maxLength) newInputEl.setAttribute('maxlength', maxLength);
            newOkBtn.textContent = okButtonText;
            
            // Gestione pulsante annulla: se null o vuoto, nascondilo
            if (cancelButtonText === null || cancelButtonText === '') {
                newCancelBtn.style.display = 'none';
            } else {
                newCancelBtn.style.display = 'inline-block';
                newCancelBtn.textContent = cancelButtonText;
            }

            const overlay = document.getElementById('customPopup');

            function closePopup(result, fromBackAction = false) {
                overlay.classList.remove('show');
                if (resolvePromise) {
                    resolvePromise(result);
                    resolvePromise = null;
                }
                
                if (!fromBackAction && history.state && history.state.popupOpen) {
                    history.back();
                }
            }

            newOkBtn.addEventListener('click', async () => {
                const value = newInputEl.value;
                if (validateFn) {
                    const validationError = await validateFn(value);
                    if (validationError) {
                        messageEl.innerHTML = `${validationError}<br><br>${message.replace(/\n/g, '<br>')}`;
                        messageEl.style.color = '#ff4444';
                        newInputEl.classList.add('error');
                        newInputEl.focus();
                        return;
                    }
                }
                closePopup(value);
            });

            newCancelBtn.addEventListener('click', () => {
                closePopup(null);
            });
            
            newInputEl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    newOkBtn.click();
                }
            });

            newInputEl.addEventListener('input', () => {
                newInputEl.classList.remove('error');
                messageEl.style.color = '';
            });
            
            // Focus input after a small delay to allow transition
            setTimeout(() => newInputEl.focus(), 100);
            
            resolvePromise = resolve;
            popup.classList.add('show');
        });
    };

})();
