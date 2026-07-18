const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

// Initialize Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function sendEmails() {
  console.log('🔍 Checking for new contacts...');

  // Get unsent contacts
  const snapshot = await db.collection('contacts')
    .where('sent', '==', false)
    .limit(50)
    .get();

  if (snapshot.empty) {
    console.log('✅ No new contacts to send.');
    return;
  }

  console.log(`📬 Found ${snapshot.size} new contact(s).`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const docId = doc.id;

    console.log(`📧 Sending email for: ${data.email}`);

    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: process.env.TO_EMAIL || 'support@keepeduroam.com',
        subject: `📬 New Contact: ${data.category}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>From:</strong> ${data.name}</p>
          <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
          <p><strong>Category:</strong> ${data.category}</p>
          <p><strong>Message:</strong></p>
          <p>${data.message}</p>
          <hr>
          <p style="color:#95A5A6; font-size:12px;">
            <a href="https://console.firebase.google.com/project/keepeduroam/firestore/data/contacts/${docId}">
              View in Firebase Console
            </a>
          </p>
        `
      });

      // Mark as sent
      await doc.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
      console.log(`✅ Email sent for: ${data.email}`);

    } catch (error) {
      console.error(`❌ Failed to send for ${data.email}:`, error.message);
    }
  }
}

sendEmails().catch(console.error);
