import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poimen - Church Administration Portal",
  description: "Church Administration and Analytics Portal",
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
