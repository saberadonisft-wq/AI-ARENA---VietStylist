import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Serif } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/context";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const notoSerif = Noto_Serif({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-serif",
  display: "swap",
});

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
    <html lang="vi" className={`h-full ${beVietnamPro.variable} ${notoSerif.variable}`}>
      <body className="flex flex-col min-h-screen bg-[#FAF8F5] text-stone-800 font-sans">
        <AuthProvider>
          <CatalogProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </CatalogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
