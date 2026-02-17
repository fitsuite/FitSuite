document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ai-workout-form');
    
    // Update range value display
    const daysRange = document.getElementById('giorni');
    const daysVal = document.getElementById('giorni-val');
    
    if (daysRange && daysVal) {
        daysRange.addEventListener('input', (e) => {
            daysVal.textContent = e.target.value;
        });
    }

    // Handle form submission
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Gather form data
            const formData = new FormData(form);
            const data = {};
            
            // Handle checkboxes specifically for arrays
            const equipment = [];
            const focus = [];
            
            for (let [key, value] of formData.entries()) {
                if (key === 'attrezzatura') {
                    equipment.push(value);
                } else if (key === 'focus') {
                    focus.push(value);
                } else {
                    data[key] = value;
                }
            }
            
            data.attrezzatura = equipment;
            data.focus = focus;

            console.log("Form Data Collected:", data);

            // Validation
            if (data.focus.length === 0) {
                alert("Seleziona almeno un focus muscolare o 'Full Body'.");
                return;
            }
            
            if (data.attrezzatura.length === 0) {
                alert("Seleziona almeno un tipo di attrezzatura.");
                return;
            }

            // TODO: Construct prompt and call AI API
            alert("Funzionalità AI in arrivo! I dati sono stati raccolti correttamete.");
            
            // Future implementation:
            // 1. Send data to AI endpoint
            // 2. Receive JSON response
            // 3. Save JSON to localStorage or pass to crea_scheda.html
            // 4. window.location.href = '../crea_scheda/crea_scheda.html?from_ai=true';
        });
    }
});
