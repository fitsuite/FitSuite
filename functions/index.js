const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
const stripeLib = require("stripe");

// Initialize admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Configurazione Nodemailer
// NOTA: Dovresti usare variabili d'ambiente per questi valori in produzione
// firebase functions:config:set email.user="latuaemail@gmail.com" email.pass="latuapassword"
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || "fitsuite.app@gmail.com",
        pass: process.env.EMAIL_PASS || "vostra-password-app"
    }
});

// Importa le funzioni di generazione routine
const { generateWorkoutRoutine, testGeminiConnection } = require("./generateRoutine");

// Esporta le funzioni
exports.generateWorkoutRoutine = generateWorkoutRoutine;
exports.testGeminiConnection = testGeminiConnection;

/**
 * Cloud Function: createStripeCheckoutSession
 * 
 * Crea una sessione di checkout Stripe recuperando la chiave dal database.
 */
exports.createStripeCheckoutSession = onCall(async (request) => {
    const { planId } = request.data;
    const auth = request.auth;

    if (!auth) {
        throw new HttpsError('unauthenticated', "Devi essere autenticato per procedere al pagamento.");
    }

    if (!planId || !['pro', 'pt'].includes(planId)) {
        throw new HttpsError('invalid-argument', "Piano non valido.");
    }

    try {
        const db = getFirestore();
        // Recupera la chiave segreta dal database come richiesto dall'utente
        const configDoc = await db.collection('config').doc('stripe').get();
        
        if (!configDoc.exists) {
            logger.error("Configurazione Stripe non trovata in Firestore: config/stripe");
            throw new HttpsError('not-found', "Configurazione Stripe non trovata nel database.");
        }

        const stripeSecretKey = configDoc.data().STRIPE_SECRET_KEY;
        if (!stripeSecretKey) {
            logger.error("Chiave STRIPE_SECRET_KEY mancante nel documento config/stripe");
            throw new HttpsError('failed-precondition', "Chiave STRIPE_SECRET_KEY mancante nel database.");
        }

        const stripe = stripeLib(stripeSecretKey);

        // Definiamo i prezzi
        const prices = {
            'pro': { amount: 499, name: 'Piano PRO' }, // 4.99€
            'pt': { amount: 999, name: 'Piano PT' }    // 9.99€
        };

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency: 'eur',
                    product_data: {
                        name: prices[planId].name,
                    },
                    unit_amount: prices[planId].amount,
                },
                quantity: 1,
            }],
            mode: 'payment',
            success_url: `${request.data.origin}/frontend/scelta_piano/scelta_piano.html?payment_success=true&plan=${planId}`,
            cancel_url: `${request.data.origin}/frontend/scelta_piano/scelta_piano.html`,
            client_reference_id: auth.uid,
            metadata: {
                planId: planId,
                userId: auth.uid
            }
        });

        return { url: session.url };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        
        logger.error("Errore creazione sessione Stripe:", error);
        throw new HttpsError('internal', "Impossibile avviare il pagamento. Riprova più tardi.");
    }
});

// Funzione per inviare l'email di verifica
exports.sendVerificationEmail = onCall(async (request) => {
    const { email, code } = request.data;
    
    if (!email || !code) {
        throw new HttpsError('invalid-argument', "Email e codice sono richiesti");
    }

    const mailOptions = {
        from: '"FitSuite" <fitsuite.app@gmail.com>',
        to: email,
        subject: 'Codice di verifica FitSuite',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
                <h2 style="color: #ff6600; text-align: center;">Benvenuto su FitSuite!</h2>
                <p>Grazie per esserti registrato. Per completare la creazione del tuo account, inserisci il seguente codice di verifica nell'app:</p>
                <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333;">${code}</span>
                </div>
                <p>Il codice scadrà tra 15 minuti.</p>
                <p>Se non hai richiesto questo codice, puoi ignorare questa email.</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #888; text-align: center;">© 2025 FitSuite - Il primo servizio di creazione schede totalmente gratuito</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        logger.info(`Email di verifica inviata con successo a ${email}`);
        return { success: true };
    } catch (error) {
        logger.error(`Errore nell'invio dell'email a ${email}:`, error);
        throw new HttpsError('internal', "Errore nell'invio dell'email");
    }
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
