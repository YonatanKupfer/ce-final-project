import nodemailer from "nodemailer";

function getTransporter() {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass || pass === "skip") return null;
    return nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass },
    });
}

interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
    const transporter = getTransporter();
    if (!transporter) {
        console.log("[email] Skipped (SMTP not configured):", subject);
        return;
    }
    const toAddresses = Array.isArray(to) ? to.join(", ") : to;

    await transporter.sendMail({
        from: `"${process.env.EMAIL_FROM_NAME || "CE Final Projects"}" <${process.env.GMAIL_USER}>`,
        to: toAddresses,
        subject,
        html,
    });
}

export function wrapEmailHtml(body: string, rtl = true) {
    return `
    <!DOCTYPE html>
    <html dir="${rtl ? "rtl" : "ltr"}" lang="${rtl ? "he" : "en"}">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: ${rtl ? "rtl" : "ltr"};">
      ${body}
    </body>
    </html>
  `;
}
