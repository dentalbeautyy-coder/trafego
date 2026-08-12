import { Manrope } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { Nav } from "./components/Nav";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-ui", weight: ["500", "600", "700", "800"] });

// Fonte da marca Dental Beauty (brandbook: New June Medium para o logo).
const newJune = localFont({
  src: [
    { path: "./fonts/NewJune-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/NewJune-Semibold.otf", weight: "600", style: "normal" },
  ],
  variable: "--font-brand",
  display: "swap",
});

export const metadata = {
  title: "Dashboard Meta Ads — Dental Beauty",
  description: "Funil de campanhas, leads, agendamentos e fechamentos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${newJune.variable}`}>
      <body>
        <div className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <span className="brand-dot" />
              Dental Beauty <span className="muted" style={{ fontWeight: 500 }}>· Dashboard</span>
            </div>
            <Nav />
          </div>
        </div>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
