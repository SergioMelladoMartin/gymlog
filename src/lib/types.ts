// Shared data model for the local-first architecture. Serialised as JSON in
// the user's Google Drive appdata folder and mirrored locally in IndexedDB.

export interface Category {
  id: number;
  name: string;
  color: string | null;
  sort_order: number;
}

export interface Exercise {
  id: number;
  name: string;
  category_id: number;
  notes: string | null;
  is_favorite: boolean;
}

export interface TrainingSet {
  id: number;
  exercise_id: number;
  date: string;            // YYYY-MM-DD
  weight_kg: number;
  reps: number;
  distance_m: number;
  duration_seconds: number;
  position: number;
  created_at: string | null;
}

export interface BodyWeight {
  date: string;
  weight_kg: number;
}

export interface Settings {
  theme?: 'light' | 'dark';
  accent?: AccentKey;
}

export type AccentKey = 'lime' | 'rose' | 'sky' | 'amber' | 'violet' | 'mono';

export interface GymlogData {
  version: 1;
  updatedAt: string;
  categories: Category[];
  exercises: Exercise[];
  sets: TrainingSet[];
  comments: Record<string, string>; // date -> body
  body_weight: BodyWeight[];
  settings?: Settings;
}

/** PR flag triple computed on the fly for a given exercise's history. */
export interface PrFlags {
  pr_weight: boolean;
  pr_1rm: boolean;
  pr_reps: boolean;
}
