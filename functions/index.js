const {onCall} = require("firebase-functions/v2/https");
const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

// Inizializza Firebase Admin
admin.initializeApp();
const db = admin.firestore();

const cors = require('cors')({
    origin: ['https://fitsuite.github.io', 'http://localhost:5500', 'http://127.0.0.1:5500'],
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
});

// Inizializza Stripe (usa la tua Secret Key salvata nelle variabili d'ambiente)
// firebase functions:config:set stripe.secret="sk_test_..."
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

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

// Funzione per creare la sessione di Checkout di Stripe
exports.createCheckoutSession = onRequest(async (req, res) => {
    // Gestione CORS per fitsuite.github.io
    return cors(req, res, async () => {
        // Se Stripe non è configurato correttamente
        if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
            logger.error("STRIPE_SECRET_KEY non configurata nel backend.");
            return res.status(500).json({ 
                message: "Configurazione Stripe mancante sul server. Imposta la variabile STRIPE_SECRET_KEY." 
            });
        }

        if (req.method !== 'POST') {
            return res.status(405).json({ message: 'Metodo non consentito' });
        }

        try {
            const { priceId, userId, userEmail, successUrl, cancelUrl } = req.body;

            if (!priceId || !userId) {
                return res.status(400).json({ message: "priceId e userId sono obbligatori." });
            }

            // Creazione della sessione di Checkout su Stripe
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                customer_email: userEmail,
                client_reference_id: userId,
                metadata: {
                    userId: userId,
                },
                success_url: successUrl,
                cancel_url: cancelUrl,
            });

            logger.info(`Sessione Checkout creata per utente ${userId}: ${session.id}`);
            return res.json({ id: session.id });

        } catch (error) {
            logger.error("Errore durante la creazione della sessione Stripe:", error);
            return res.status(500).json({ 
                message: "Errore interno durante la creazione della sessione di pagamento.",
                details: error.message 
            });
        }
    });
});

// Funzione per inviare l'email di verifica
exports.sendVerificationEmail = onCall(async (request) => {
    const { email, code } = request.data;
    
    if (!email || !code) {
        throw new Error("Email e codice sono richiesti");
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
        throw new Error("Errore nell'invio dell'email");
    }
});

// Webhook di Stripe per gestire le notifiche asincrone di pagamento
exports.stripeWebhook = onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    let event;

    try {
        if (webhookSecret && sig) {
            // Verifica la firma se il segreto è configurato
            event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
        } else {
            // Se non c'è il segreto, usiamo il body direttamente (meno sicuro, ma utile per test)
            event = req.body;
            logger.warn("Webhook ricevuto senza verifica della firma. Configura STRIPE_WEBHOOK_SECRET per la produzione.");
        }
    } catch (err) {
        logger.error(`Webhook Error: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Gestione dei vari eventi di Stripe
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const userId = session.client_reference_id;
                
                if (userId) {
                    logger.info(`Pagamento completato con successo per utente: ${userId}`);
                    
                    // Determina il piano acquistato dai metadati o dal price_id
                    // In questo caso, forziamo 'pro' come da richiesta dell'utente per il link specifico
                    await db.collection('users').doc(userId).set({
                        subscription: {
                            plan: 'pro',
                            status: 'active',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                            sessionId: session.id,
                            customerId: session.customer
                        }
                    }, { merge: true });
                    
                    logger.info(`Profilo utente ${userId} aggiornato a PRO tramite Webhook.`);
                } else {
                    logger.error("User ID (client_reference_id) non trovato nella sessione di checkout.");
                }
                break;
            }

            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                
                // Trova l'utente tramite il customerId di Stripe
                const usersSnapshot = await db.collection('users')
                    .where('subscription.customerId', '==', customerId)
                    .limit(1)
                    .get();

                if (!usersSnapshot.empty) {
                    const userDoc = usersSnapshot.docs[0];
                    await userDoc.ref.set({
                        subscription: {
                            plan: 'free',
                            status: 'canceled',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        }
                    }, { merge: true });
                    logger.info(`Abbonamento cancellato per l'utente ${userDoc.id}.`);
                }
                break;
            }

            default:
                logger.info(`Evento Stripe non gestito: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        logger.error("Errore durante la gestione del webhook:", error);
        res.status(500).send("Internal Server Error");
    }
});

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
