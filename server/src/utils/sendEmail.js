import nodemailer from "nodemailer";

const sendEmail = async (options) => {
  let transporter;

  // Use real SMTP if credentials are provided in .env
  if (process.env.EMAIL_HOST && process.env.EMAIL_PORT && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    // Fallback: Create a test Ethereal account if no real credentials are set
    console.warn("\n⚠️ No SMTP credentials found in environment variables. Generating a test Ethereal email account...");
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const message = {
    from: `${process.env.FROM_NAME || "Neuronest"} <${process.env.FROM_EMAIL || "noreply@neuronest.app"}>`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html,
  };

  const info = await transporter.sendMail(message);

  if (!process.env.EMAIL_HOST) {
    console.log(`\n========================================`);
    console.log("📨 Ethereal Test Email Sent!");
    console.log(`Message sent: ${info.messageId}`);
    console.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
    console.log("Click the Preview URL above to see the email in your browser.");
    console.log(`========================================\n`);
  }
};

export default sendEmail;
