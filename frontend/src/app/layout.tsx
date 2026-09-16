import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/context";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "VietStylist | Nền tảng Phối đồ & Di sản Thời trang Việt",
  description: "VietStylist - Trải nghiệm phối đồ Việt phục 2D với Áo ngũ thân tay chẽn, Áo tấc, Áo Nhật bình, thẩm định quy tắc di sản văn hóa và chia sẻ Lookbook.",
  keywords: ["VietStylist", "Việt phục", "Cổ phục Việt", "Áo ngũ thân", "Áo tấc", "Áo Nhật bình", "Phối đồ 2D", "Di sản văn hóa"],
  authors: [{ name: "VietStylist Team" }],
  openGraph: {
    title: "VietStylist | Phối đồ & Di sản Cổ phục Việt",
    description: "Khám phá vẻ đẹp di sản văn hóa Việt Nam qua nền tảng phối đồ 2D trực quan VietStylist.",
    siteName: "VietStylist",
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=Noto+Serif:ital,wght@0,400;0,600;0,700;1,400&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col min-h-screen bg-[#FAF8F5] text-stone-800">
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
        <AuthProvider>
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
