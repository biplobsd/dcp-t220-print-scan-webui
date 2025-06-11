export enum CleaningType {
  BLACK_NORMAL = 1,
  BLACK_STRONG = 2,
  BLACK_STRONGEST = 3,
  COLOR_NORMAL = 4,
  COLOR_STRONG = 5,
  COLOR_STRONGEST = 6,
  ALL_NORMAL = 7,
  ALL_STRONG = 8,
  ALL_STRONGEST = 9,
  SPECIAL = 10,
}

export type InkUsage = "low" | "medium" | "high" | "very-high";

export interface CleaningOption {
  id: CleaningType;
  label: string;
  description: string;
  duration: number;
  inkUsage: InkUsage;
}

export interface MaintenanceResult {
  success: boolean;
  message: string;
  timestamp: Date;
}
