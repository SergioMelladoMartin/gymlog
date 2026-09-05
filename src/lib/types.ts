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

/** PR flags computed on the fly for a given exercise's history.
 *  - pr_weight (pesa): heavier than any earlier set → a new max weight unlocked.
 *  - pr_reps   (copa): more reps than any earlier set at this weight or heavier. */
export interface PrFlags {
  pr_weight: boolean;
  pr_reps: boolean;
}
