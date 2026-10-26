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

// The academic advisor's judge-assignment portal invitation — spells out
// exactly what to click, since assigning a judge does NOT email them (the
// admin's per-round send action does that later).
export function advisorPortalEmail(advisorName: string, portalLink: string) {
    return {
        subject: "נדרשת פעולה: שיבוץ שופטים לפרויקטים שבאחריותך",
        html: wrapEmailHtml(`
        <h2>שיבוץ שופטים לפרויקטים שבאחריותך</h2>
        <p>שלום ${advisorName},</p>
        <p>לקראת מצגות האמצע והסיום, נבקש לשבץ שופט/ת לכל אחד מהפרויקטים שבאחריותך.</p>
        <p style="font-weight: bold; margin-bottom: 4px;">מה צריך לעשות?</p>
        <ol style="margin-top: 0; padding-right: 20px;">
          <li>ללחוץ על הכפתור "מעבר לשיבוץ שופטים" שלמטה.</li>
          <li>בעמוד שייפתח מופיעים כל הפרויקטים שבאחריותך, ולכל פרויקט אזור נפרד למצגת האמצע ולמצגת הסיום.</li>
          <li>בכל אזור, לבחור שופט/ת מהרשימה (או "אחר" להזנת שם ואימייל) וללחוץ "הוספת שופט/ת". השיבוץ נשמר מיד — אין צורך בשליחה נוספת.</li>
        </ol>
        <p>
          <a href="${portalLink}" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            מעבר לשיבוץ שופטים
          </a>
        </p>
        <p style="color: #888; font-size: 13px; margin-top: 24px;">השופטים לא יקבלו מייל בשלב זה — לאחר כל מצגת, צוות הקורס ישלח להם קישור למתן ציון. ניתן לחזור לקישור זה בכל עת כדי לעדכן את השיבוץ.</p>
      `),
    };
}

// The initial "please submit a score" email for one grading invite — sent
// by the per-form bulk send and by the admin's single-invite send button.
export function gradeRequestEmail({
    recipientName,
    roleLabel,
    formLabel,
    project,
    link,
    adminNote,
}: {
    recipientName: string | null;
    roleLabel: string;
    formLabel: string;
    project: { project_number: number | null; title_he: string; title_en: string };
    link: string;
    adminNote?: string | null;
}) {
    return {
        subject: `בקשה למתן ציון: ${project.title_he}`,
        html: wrapEmailHtml(`
        <h2>בקשה למתן ציון</h2>
        <p>שלום${recipientName ? ` ${recipientName}` : ""},</p>
        <p>מתבקש/ת למלא ציון (בתפקיד ${roleLabel}) עבור ${formLabel} של פרויקט הגמר הבא:</p>
        <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px; font-weight: bold;">מספר פרויקט:</td><td style="padding: 8px;">${project.project_number ?? "—"}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">שם הפרויקט:</td><td style="padding: 8px;">${project.title_he}</td></tr>
          <tr><td style="padding: 8px; font-weight: bold;">Project Title:</td><td style="padding: 8px;">${project.title_en}</td></tr>
        </table>
        ${adminNote ? `<p><strong>הערה:</strong><br/>${adminNote}</p>` : ""}
        <p>
          <a href="${link}" style="background: #2563eb; color: white; padding: 10px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
            מעבר לטופס הציון
          </a>
        </p>
      `),
    };
}
