import type { Metadata } from "next";
import "./globals.css";
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: "Prime API Platform",
  description: "API Management and Research Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
          <Sidebar />
          <main className="flex-1 p-8 transition-all duration-300">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
