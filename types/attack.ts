export type AttackType = 'SYN' | 'UDP' | 'HTTP' | 'BENIGN';

export interface FeatureSnapshot {
  top_3_features: string[];
  top_3_values: number[];
  top_3_shap: number[];
}

export interface AttackEvent {
  id: string;
  timestamp: string;
  source_ip: string;
  source_country: string;
  source_lat: number;
  source_lng: number;
  target_ip: string;
  target_country: string;
  target_lat: number;
  target_lng: number;
  attack_type: AttackType;
  raw_label: string;
  packets_per_sec: number;
  bytes_per_sec: number;
  flow_duration_ms: number;
  severity: number;
  confidence: number;
  model_used: string;
  dataset_type: 'real_cicddos2019' | 'synthetic';
  mitre_id: string | null;
  mitre_tactic: string | null;
  mitre_name: string;
  feature_snapshot: FeatureSnapshot;
}

// Legacy aliases for backward compat with old components
export interface LegacyAttackEvent {
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
  intensity: number;
  packetsPerSec: number;
}

export interface StreamStats {
  attacks_per_min: number;
  type_breakdown: Record<string, number>;
  top_sources: Array<{ country: string; count: number }>;
  top_targets: Array<{ country: string; count: number }>;
  avg_severity: number;
  avg_confidence: number;
  unique_ips: number;
  unique_countries: number;
  total_events: number;
}

export interface ModelMetrics {
  model_name: string;
  accuracy: number;
  weighted_f1: number;
  per_class_f1: Record<string, number>;
  training_timestamp: string;
  dataset_type: string;
  hardware_used: string;
  smote_applied: boolean;
  n_features: number;
  class_names: string[];
  feature_importance_top10: Array<{ feature: string; shap_value: number }>;
  avg_latency_ms: number;
  predictions_count: number;
}
