import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "VK Messages — Автоматическая отправка сообщений ВКонтакте",
  description: "Автоматическая отправка сообщений в ВКонтакте по расписанию. Планируйте сообщения, выбирайте чаты и настраивайте время отправки.",
  keywords: ["VK", "ВКонтакте", "автоотправка", "расписание", "сообщения", "VK Messages"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className="antialiased bg-[#edeef0] text-[#222]"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif' }}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
