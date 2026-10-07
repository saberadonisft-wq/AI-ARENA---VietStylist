import type { Metadata } from "next";
import { Be_Vietnam_Pro, Noto_Serif } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/context";
import { CatalogProvider } from "@/lib/catalog/CatalogProvider";
import { StudioDocumentProvider } from "@/features/studio/useStudioDocument";
import SiteFrame from "@/components/SiteFrame";

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
  icons: {
    icon: { url: "/brand/vietstylist-mark.svg?v=2", type: "image/svg+xml", sizes: "any" },
  },
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
      <body className="flex flex-col min-h-screen bg-page text-stone-800 font-sans">
        <AuthProvider>
          <CatalogProvider>
            <StudioDocumentProvider>
              <SiteFrame>{children}</SiteFrame>
            </StudioDocumentProvider>
          </CatalogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
