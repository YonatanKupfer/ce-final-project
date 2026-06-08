/**
 * Demo seed script — run with: node scripts/seed.mjs
 * Clears existing data and inserts demo projects + staff email.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://dkewtnmnalssdlcqbunt.supabase.co";
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrZXd0bm1uYWxzc2RsY3FidW50Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjAxNjU5NywiZXhwIjoyMDkxNTkyNTk3fQ._0iy59YvRkqHm9Z7G2AXIS42vsKJ_REbWc87240nKXY";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function seed() {
  console.log("🌱 Seeding demo data...\n");

  // ── 1. Staff email ─────────────────────────────────────────────────────────
  const { error: staffErr } = await supabase
    .from("staff_emails")
    .upsert({ email: "yonatank50@gmail.com", name: "Yonatan K" }, { onConflict: "email" });
  if (staffErr) console.error("staff_emails:", staffErr.message);
  else console.log("✅ Staff email: yonatank50@gmail.com");

  // ── 2. Clear existing demo projects ────────────────────────────────────────
  await supabase.from("registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("projects").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("🗑️  Cleared existing projects & registrations");

  // ── 3. Insert projects ──────────────────────────────────────────────────────
  const ACADEMIC_EMAIL = "yonatank50@gmail.com"; // all emails go here for testing

  const projects = [
    // ── Pending ──
    {
      status: "pending",
      title_he: "זיהוי חדירות רשת בזמן אמת",
      track: "crypto",
      supervisors_name: "ד\"ר אבי לוי",
      supervisors_email: ACADEMIC_EMAIL,
      academic_supervisor_name: "פרופ' מרים כהן",
      academic_supervisor_email: ACADEMIC_EMAIL,
      abstract: "פרויקט זה מתמקד בפיתוח מערכת לזיהוי חדירות רשת בזמן אמת תוך שימוש בלמידת מכונה.",
      objective: "פיתוח מודל ML לזיהוי התנהגות חריגה ברשת. תוצרים: מודל מאומן, ממשק ניטור, דוח ביצועים.",
      scope: "1. איסוף נתוני רשת\n2. עיבוד מקדים\n3. אימון מודל\n4. בדיקות ביצועים\n5. ממשק ויזואלי",
      prereq_course_1: "67509 - רשתות תקשורת",
      prereq_course_2: "67748 - למידת מכונה",
      references_text: "• Tavallaee et al. (2009) KDD-99 dataset\n• https://www.kaggle.com/datasets/sampadab17/network-intrusion-detection",
    },
    {
      status: "pending",
      title_he: "ניהול אנרגיה חכם בבתים",
      title_en: "Smart Home Energy Management System",
      track: "hardware",
      supervisors_name: "ד\"ר רונית שמש",
      supervisors_email: ACADEMIC_EMAIL,
      academic_supervisor_name: "פרופ' יוסף ברק",
      academic_supervisor_email: ACADEMIC_EMAIL,
      abstract: "מערכת IoT לניהול צריכת אנרגיה בבית חכם עם אופטימיזציה אוטומטית.",
      objective: "עיצוב ופיתוח מערכת חומרה-תוכנה לניהול אנרגיה. תוצרים: לוח בקרה, חיישנים, אלגוריתם אופטימיזציה.",
      scope: "1. עיצוב מעגל חיישנים\n2. כתיבת firmware\n3. ממשק ניהול\n4. אלגוריתם אופטימיזציה\n5. בדיקות שדה",
      prereq_course_1: "67318 - ארכיטקטורת מחשבים",
      references_text: "• ESP32 Technical Reference Manual\n• https://www.energy.gov/smart-home",
    },

    // ── Review (sent back for corrections) ──
    {
      status: "review",
      title_he: "אנליזה של נתוני בריאות עם למידה עמוקה",
      title_en: "Deep Learning Analysis of Healthcare Data",
      track: "ai",
      supervisors_name: "ד\"ר נועה גפן",
      supervisors_email: ACADEMIC_EMAIL,
      academic_supervisor_name: "פרופ' מרים כהן",
      academic_supervisor_email: ACADEMIC_EMAIL,
      abstract: "שימוש ברשתות נוירונים עמוקות לניתוח נתוני EHR לזיהוי מוקדם של מחלות.",
      objective: "פיתוח מודל deep learning לסיווג נתוני בריאות. תוצרים: מודל, ניתוח ביצועים, מאמר.",
      scope: "1. עיבוד dataset\n2. ארכיטקטורת רשת\n3. אימון ואימות\n4. ניתוח XAI\n5. תיעוד",
      prereq_course_1: "67748 - למידת מכונה",
      references_text: "• Miotto et al. (2018) Deep learning for healthcare\n• https://physionet.org",
      review_notes: "נא להרחיב את הסעיף על אתיקת מידע רפואי ולהוסיף התייחסות ל-GDPR.",
    },

    // ── Approved ──
    {
      status: "approved",
      project_number: 101,
      title_he: "מערכת הצפנה קוונטית",
      title_en: "Quantum-Resistant Encryption System",
      track: "crypto",
      supervisors_name: "ד\"ר אורי פרידמן",
      supervisors_email: ACADEMIC_EMAIL,
      academic_supervisor_name: "פרופ' דוד שפירו",
      academic_supervisor_email: ACADEMIC_EMAIL,
      abstract: "פיתוח מערכת הצפנה עמידה בפני מחשוב קוונטי המבוססת על אלגוריתמי post-quantum cryptography.",
      objective: "יישום אלגוריתמי CRYSTALS-Kyber ו-CRYSTALS-Dilithium. תוצרים: ספריית הצפנה, בנצ'מרק, תיעוד.",
      scope: "1. מחקר PQC\n2. יישום Kyber\n3. יישום Dilithium\n4. ממשק API\n5. בדיקות ביצועים",
      prereq_course_1: "67518 - אבטחת מידע",
      references_text: "• NIST PQC Standard (2024)\n• https://pq-crystals.org",
      is_taken: false,
    },
    {
      status: "approved",
      project_number: 201,
      title_he: "פרוטוקול ניתוב אדפטיבי ל-SDN",
      title_en: "Adaptive Routing Protocol for SDN",
      track: "networks",
      supervisors_name: "ד\"ר יעל מור",
      supervisors_email: ACADEMIC_EMAIL,
      academic_supervisor_name: "פרופ' מרים כהן",
      academic_supervisor_email: ACADEMIC_EMAIL,
      abstract: "פיתוח פרוטוקול ניתוב דינמי לרשתות מוגדרות תוכנה (SDN) עם אופטימיזציה בזמן אמת.",
      objective: "פיתוח ובדיקת פרוטוקול ניתוב ב-Mininet. תוצרים: פרוטוקול, סימולציה, השוואה לפרוטוקולים קיימים.",
      scope: "1. סקירת SDN\n2. תכנון פרוטוקול\n3. יישום ב-Python/Ryu\n4. סימולציה ב-Mininet\n5. ניתוח תוצאות",
      prereq_course_1: "67509 - רשתות תקשורת",
      references_text: "• OpenFlow Specification v1.5\n• https://mininet.org",
      is_taken: true,
    },
    {
      status: "approved",
      project_number: 301,
      title_he: "עיבוד שפה טבעית לעברית",
      title_en: "Hebrew NLP Sentiment Analysis",
      track: "ai",
      recommended_track: "crypto",
      supervisors_name: "ד\"ר שירה אלון",
      supervisors_email: ACADEMIC_EMAIL,
      academic_supervisor_name: "פרופ' יוסף ברק",
      academic_supervisor_email: ACADEMIC_EMAIL,
      abstract: "בניית מודל NLP לניתוח סנטימנט של טקסטים בעברית, כולל תמיכה בסלנג ובניב מדובר.",
      objective: "פיתוח מודל NLP עברי מבוסס BERT. תוצרים: מודל מאומן, API, ממשק הדגמה.",
      scope: "1. איסוף corpus עברי\n2. עיבוד מקדים\n3. fine-tuning AlephBERT\n4. REST API\n5. ממשק משתמש",
      prereq_course_1: "67748 - למידת מכונה",
      prereq_course_2: "67535 - עיבוד שפה טבעית",
      references_text: "• Ben-David et al. (2020) AlephBERT\n• https://huggingface.co/onlplab/alephbert-base",
      is_taken: false,
    },

    // ── Rejected ──
    {
      status: "rejected",
      title_he: "בלוקצ'יין לניהול שרשרת אספקה",
      title_en: "Blockchain Supply Chain Management",
      track: "networks",
      supervisors_name: "ד\"ר ארז כץ",
      supervisors_email: ACADEMIC_EMAIL,
      academic_supervisor_name: "פרופ' דוד שפירו",
      academic_supervisor_email: ACADEMIC_EMAIL,
      abstract: "מערכת ניהול שרשרת אספקה מבוססת blockchain עם חוזים חכמים.",
      objective: "פיתוח מערכת blockchain מלאה. תוצרים: smart contracts, ממשק ניהול.",
      scope: "1. תכנון ארכיטקטורה\n2. smart contracts\n3. frontend\n4. בדיקות",
      references_text: "• Nakamoto (2008)\n• https://ethereum.org",
      review_notes: "הנושא אינו מתאים לתחום הנדסת מחשבים. נא להגיש הצעה חדשה.",
    },
  ];

  const { data: insertedProjects, error: projErr } = await supabase
    .from("projects")
    .insert(projects)
    .select("id, title_en, status, project_number");

  if (projErr) {
    console.error("❌ Error inserting projects:", projErr.message);
    return;
  }
  console.log(`\n✅ Inserted ${insertedProjects.length} projects:`);
  insertedProjects.forEach((p) =>
    console.log(`   [${p.status}] ${p.project_number ? `#${p.project_number} ` : ""}${p.title_en}`)
  );

  // ── 4. Insert demo registrations on approved+taken project ─────────────────
  const takenProject = insertedProjects.find((p) => p.title_en.includes("SDN"));
  if (takenProject) {
    const { error: regErr } = await supabase.from("registrations").insert({
      project_id: takenProject.id,
      status: "approved",
      student1_name: "אלון בן-דוד",
      student1_id: "312345678",
      student1_email: ACADEMIC_EMAIL,
      student2_name: "מאיה לוי",
      student2_id: "318765432",
      student2_email: ACADEMIC_EMAIL,
      is_ce_student: true,
    });
    if (regErr) console.error("❌ Error inserting registration:", regErr.message);
    else console.log("\n✅ Added approved registration (2 students) to SDN project");
  }

  // Also add a pending registration on the Quantum project
  const quantumProject = insertedProjects.find((p) => p.title_en.includes("Quantum"));
  if (quantumProject) {
    const { error: regErr2 } = await supabase.from("registrations").insert({
      project_id: quantumProject.id,
      status: "pending",
      student1_name: "תמר גולן",
      student1_id: "314567890",
      student1_email: ACADEMIC_EMAIL,
      is_ce_student: true,
    });
    if (regErr2) console.error("❌ Error inserting pending registration:", regErr2.message);
    else console.log("✅ Added pending registration (1 student) to Quantum project");
  }

  console.log("\n🎉 Seed complete!\n");
  console.log("👤 Login with: yonatank50@gmail.com  (magic link → /admin/pending)");
  console.log("🌐 App:        http://localhost:3000\n");
}

seed().catch(console.error);
