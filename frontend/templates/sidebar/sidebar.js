document.addEventListener('DOMContentLoaded', () => {
    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements - Sidebar
    const userInitialSidebar = document.getElementById('user-initial-sidebar');
    const userNameSidebar = document.getElementById('user-name-sidebar');
    const userRoutineListSidebar = document.getElementById('user-routine-list-sidebar');

    // Check Auth State and populate sidebar
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log('User is signed in for sidebar:', user.email);
            userNameSidebar.textContent = user.displayName || user.email.split('@')[0];
            const initial = (user.displayName || user.email).charAt(0).toUpperCase();
            userInitialSidebar.textContent = initial;
            fetchUserRoutines(user.uid);
        } else {
            console.log('No user signed in for sidebar.');
            // Optionally clear sidebar or redirect if needed
        }
    });

    // Fetch User Routines
    async function fetchUserRoutines(uid) {
        userRoutineListSidebar.innerHTML = ''; // Clear existing routines

        try {
            const routinesSnapshot = await db.collection('routines')
                                             .where('userId', '==', uid)
                                             .orderBy('createdAt', 'desc')
                                             .get();

            if (routinesSnapshot.empty) {
                const noRoutinesItem = document.createElement('li');
                noRoutinesItem.textContent = 'Nessuna scheda creata.';
                noRoutinesItem.style.fontStyle = 'italic';
                noRoutinesItem.style.color = '#888';
                userRoutineListSidebar.appendChild(noRoutinesItem);
            } else {
                routinesSnapshot.forEach(doc => {
                    const routine = doc.data();
                    const routineItem = document.createElement('li');
                    routineItem.textContent = routine.name || 'Scheda senza nome';
                    routineItem.classList.add('routine-item'); // Add a class for styling
                    routineItem.dataset.routineId = doc.id; // Store routine ID

                    routineItem.addEventListener('click', () => {
                        window.location.href = `../visualizza_scheda/visualizza_scheda.html?id=${doc.id}`;
                    });
                    userRoutineListSidebar.appendChild(routineItem);
                });
            }
        } catch (error) {
            console.error("Error fetching user routines for sidebar:", error);
            const errorItem = document.createElement('li');
            errorItem.textContent = 'Errore nel caricamento delle schede.';
            errorItem.style.color = 'red';
            userRoutineListSidebar.appendChild(errorItem);
        }
    }
});