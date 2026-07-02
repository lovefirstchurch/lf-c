import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Synago - Saturday Arrivals Portal",
  description: "Saturday Arrivals Portal for LFC Unit Leaders",
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
