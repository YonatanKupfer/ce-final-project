import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CE Final Projects",
  description: "Computer Engineering Final Projects Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}

