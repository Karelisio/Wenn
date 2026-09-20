export type FlowIntensity = "spotting" | "leger" | "moyen" | "abondant";

export const SYMPTOM_OPTIONS = [
  "crampes",
  "fatigue",
  "maux_de_tete",
  "ballonnements",
  "seins_sensibles",
  "acne",
  "dos_douloureux",
  "nausees",
  "secretions",
  "rapport_sexuel",
  "autre_douleur",
] as const;

export type Symptom = (typeof SYMPTOM_OPTIONS)[number];

export const SYMPTOM_LABELS: Record<Symptom, string> = {
  crampes: "Crampes",
  fatigue: "Fatigue",
  maux_de_tete: "Maux de tête",
  ballonnements: "Ballonnements",
  seins_sensibles: "Seins sensibles",
  acne: "Acné",
  dos_douloureux: "Mal de dos",
  nausees: "Nausées",
  secretions: "Sécrétions",
  rapport_sexuel: "Rapport sexuel",
  autre_douleur: "Autre douleur",
};

/** Emoji affiché sur le calendrier pour chaque symptôme enregistré. */
export const SYMPTOM_EMOJI: Record<Symptom, string> = {
  crampes: "😣",
  fatigue: "🥱",
  maux_de_tete: "🤕",
  ballonnements: "🎈",
  seins_sensibles: "💗",
  acne: "🔴",
  dos_douloureux: "🦴",
  nausees: "🤢",
  secretions: "💧",
  rapport_sexuel: "❤️",
  autre_douleur: "⚠️",
};

/** Emoji affiché sur le calendrier / la saisie du jour selon la quantité de flux. */
export const FLOW_INTENSITY_EMOJI: Record<FlowIntensity, string> = {
  spotting: "🟤",
  leger: "🩸",
  moyen: "🩸🩸",
  abondant: "🩸🩸🩸",
};

export const VAGINAL_PAIN_EMOJI = "🔥";

export const MOOD_OPTIONS = ["😊", "😌", "😐", "😢", "😡", "🥱", "🥰", "😖"] as const;
export type Mood = (typeof MOOD_OPTIONS)[number];

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  theme_image_url: string | null;
  theme_seed_color: string | null;
  notifications_days_before: number;
  created_at: string;
  updated_at: string;
}

export interface Couple {
  id: string;
  owner_id: string;
  partner_id: string | null;
  invite_code: string;
  name: string;
  average_cycle_length: number;
  average_period_length: number;
  created_at: string;
}

export interface CycleDay {
  id: string;
  couple_id: string;
  date: string; // yyyy-MM-dd
  flow: FlowIntensity | null;
  vaginal_pain: FlowIntensity | null;
  symptoms: string[];
  mood: string | null;
  note: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerNote {
  id: string;
  couple_id: string;
  date: string;
  author_id: string;
  message: string;
  created_at: string;
}

export interface CyclePrediction {
  lastPeriodStart: string | null;
  nextPeriodStart: string | null;
  ovulationDate: string | null;
  fertileWindowStart: string | null;
  fertileWindowEnd: string | null;
  averageCycleLength: number;
  averagePeriodLength: number;
  cycleLengths: { start: string; length: number }[];
  currentCycleDay: number | null;
}
