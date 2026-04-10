// AttackDetail.tsx — Replaced by IPIntelPanel.tsx in v2.0
// Kept to avoid breaking any lingering imports.

import { AttackEvent } from '@/types/attack';

interface AttackDetailProps {
  attack: AttackEvent | null;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function AttackDetail(_props: AttackDetailProps) {
  return null;
}
