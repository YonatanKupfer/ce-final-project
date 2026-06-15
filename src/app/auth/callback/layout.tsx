import "@/app/globals.css";

export const metadata = {
    title: "התחברות לניהול - פרויקטי גמר",
};

export default function AuthCallbackLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="he" dir="rtl" className="h-full">
            <body className="min-h-full bg-background text-foreground">
                {children}
            </body>
        </html>
    );
}
