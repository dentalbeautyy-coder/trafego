import { Manrope } from "next/font/google";
import "./globals.css";
import { Nav } from "./components/Nav";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-ui", weight: ["500", "600", "700", "800"] });

export const metadata = {
  title: "Dashboard Meta Ads — Dental Beauty",
  description: "Funil de campanhas, leads, agendamentos e fechamentos",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={manrope.variable}>
      <body>
        <div className="topbar">
          <div className="topbar-inner">
            <div className="brand">
              <span className="brand-dot" />
              Dashboard Meta Ads
            </div>
            <Nav />
          </div>
        </div>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
