"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function SiteFrame({ children }: { children: ReactNode }) {
  const studio = usePathname() === "/studio";
  return <div className={studio ? "studio-site-frame" : "contents"}>
    <Navbar />
    <main className={studio ? "studio-route flex-1 min-w-0" : "flex-1"}>{children}</main>
    {!studio && <Footer />}
  </div>;
}
