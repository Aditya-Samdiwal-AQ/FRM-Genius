import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ConflictStoreProvider } from "@/store/ConflictStore";
import "./globals.css";

import { HomeEntryGuard } from "@/components/layout/HomeEntryGuard";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "FRM Conflict Watch",
  description:
    "Territory-level payer change conflict resolution for Field Reimbursement Managers.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <HomeEntryGuard>
          <ConflictStoreProvider>{children}</ConflictStoreProvider>
        </HomeEntryGuard>      
      </body>
    </html>
  );
}
