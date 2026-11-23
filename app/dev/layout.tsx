import type { Metadata } from "next";
import { cormorant, inter } from "@/lib/fonts";
import "../globals.css";

export const metadata: Metadata = {
  title: "Dev 3D Model Viewer | W Automobiles",
  robots: { index: false, follow: false },
};

export default function DevRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${cormorant.variable} ${inter.variable}`}
    >
      <body className="min-h-screen bg-[#12151b] text-[#F4F1EC] antialiased">
        {children}
      </body>
    </html>
  );
}
