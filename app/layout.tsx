import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { Shell } from "@/components/shell";
import { GymProvider } from "@/lib/gym";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Workout",
  description: "A flexible weekly workout log with muscle recovery.",
  applicationName: "Workout",
  appleWebApp: { capable: true, title: "Workout", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("dark h-full antialiased font-sans", geist.variable)}>
      <body className="min-h-full">
        <GymProvider>
          <Shell>{children}</Shell>
        </GymProvider>
      </body>
    </html>
  );
}
