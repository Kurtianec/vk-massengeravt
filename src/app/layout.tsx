import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Messages pull — Автоматическая отправка сообщений",
  description: "Автоматическая отправка сообщений по расписанию. Планируйте сообщения, выбирайте чаты и настраивайте время отправки.",
  keywords: ["автоотправка", "расписание", "сообщения", "Messages pull"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className="antialiased bg-[#0d0d1a] text-[#e0e0ff]"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif' }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
