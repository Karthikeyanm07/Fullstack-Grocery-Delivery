import { createTransport } from "nodemailer";
// Validate SMTP config at startup — fail loud rather than silently
// sending no emails in production with no error
if (!process.env.SMTP_USER ||
    !process.env.SMTP_PASS ||
    !process.env.SENDER_EMAIL) {
    throw new Error("Missing email config: SMTP_USER, SMTP_PASS, and SENDER_EMAIL must be set.");
}
// Create a transporter using SMTP - nodemailer
const transporter = createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
const sendEmail = async ({ to, subject, body, }) => {
    const response = await transporter.sendMail({
        from: process.env.SENDER_EMAIL,
        to: Array.isArray(to) ? to.join(", ") : to,
        subject,
        html: body,
    });
    return response;
};
export default sendEmail;
