import type { Metadata } from 'next';
import { Inter, Space_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const spaceMono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'ThreatMapX — Real-time DDoS Detection & SOC Visualization',
  description: 'Production-grade SOC visualization platform. Detects DDoS attacks in real-time using Random Forest / XGBoost ML on CIC-DDoS2019 with SHAP explainability.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceMono.variable}`}>
      <body className="font-sans antialiased bg-[#05060a] text-[#e2e8f0] overflow-hidden">
        {children}
      </body>
    </html>
  );
}
