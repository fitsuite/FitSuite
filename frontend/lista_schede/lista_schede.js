document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();
    const routinesContainer = document.getElementById('routines-container');

    auth.onAuthStateChanged(user => {
        if (user) {
            fetchRoutines(user.uid);
        } else {
            window.location.href = '../auth/auth.html';
        }
    });

    async function fetchRoutines(uid) {
        try {
            const snapshot = await db.collection('routines')
                .where('userId', '==', uid)
                .orderBy('createdAt', 'desc')
                .get();

            routinesContainer.innerHTML = '';

            if (snapshot.empty) {
                routinesContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-gray);">Non hai ancora creato nessuna scheda.</p>';
                return;
            }

            snapshot.forEach(doc => {
                const routine = doc.data();
                const date = routine.createdAt ? new Date(routine.createdAt.seconds * 1000).toLocaleDateString() : 'Data non disponibile';
                
                const card = document.createElement('div');
                card.className = 'routine-card';
                card.innerHTML = `
                    <h3 class="routine-name">${routine.name || 'Scheda senza nome'}</h3>
                    <p class="routine-date">Creato il: ${date}</p>
                `;
                
                card.addEventListener('click', () => {
                    window.location.href = `../visualizza_scheda/visualizza_scheda.html?id=${doc.id}`;
                });
                
                routinesContainer.appendChild(card);
            });
        } catch (error) {
            console.error("Errore nel recupero delle schede:", error);
            routinesContainer.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: red;">Errore nel caricamento delle schede. Riprova più tardi.</p>';
        }
    }
});
