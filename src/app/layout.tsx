import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LFC Church Management System",
  description: "LFC Church Management System running on Next.js",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
