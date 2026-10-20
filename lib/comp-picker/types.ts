// Types for the comp picker mini-game.

export type PropertyType = "single_family" | "duplex" | "condo";

export type VerdictCategory =
  | "good"
  | "cherry_picked_high"
  | "cherry_picked_low"
  | "different_neighborhood"
  | "wrong_size";

export type SubjectProperty = {
  id: "subject";
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  sqft: number;
  beds: number;
  baths: number;
  yearBuilt: number;
  propertyType: PropertyType;
  photoUrl: string;
  // What the subject is under contract for; shown on its map pin.
  salePrice: number;
};

export type CompProperty = {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  lat: number;
  lng: number;
  sqft: number;
  beds: number;
  baths: number;
  yearBuilt: number;
  propertyType: PropertyType;
  salePrice: number;
  soldDate: string;
  photoUrl: string;
  // Authored verdict, what category this comp falls into.
  // The game uses this directly; scoring.ts just formats the reason.
  verdictCategory: VerdictCategory;
};

export type CompVerdict = {
  compId: string;
  category: VerdictCategory;
  isGood: boolean;
  headline: string;    // short, e.g. "Good comp" or "Sold too high"
  reason: string;      // one-line student-facing why
};
