import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Interview Accelerator — EDXSO Assignment 3",
  description:
    "AI-powered personalised interview practice from your JD + resume, with adaptive voice interviews and readiness reports.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
