import type { Metadata } from "next";
import "./globals.scss";
import { ToastProvider } from '@/components/Toast/ToastContext';

export const metadata: Metadata = {
  title: "Minecraft Dashboard",
  description: "Docker-based Minecraft Server Manager",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
