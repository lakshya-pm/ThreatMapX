export type AttackType = 'SYN' | 'UDP' | 'HTTP';

export interface AttackEvent {
  id: string;
  timestamp: string;
  srcLat: number;
  srcLng: number;
  dstLat: number;
  dstLng: number;
  srcCountry: string;
  dstCountry: string;
  srcIp: string;
  dstIp: string;
  attackType: AttackType;
  intensity: number;       // 0.1 to 1.0 (for varying arc width/glow)
  packetsPerSec: number;
}
