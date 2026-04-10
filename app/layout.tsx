import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ThreatMapX — Real-time DDoS Detection & SOC Visualization',
  description: 'Production-grade SOC visualization platform. Detects DDoS attacks in real-time using Random Forest / XGBoost ML on CIC-DDoS2019 with SHAP explainability.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#080d14] text-[#e2e8f0] overflow-hidden">
        {children}
      </body>
    </html>
  );
}
