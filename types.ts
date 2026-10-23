
export interface KhatmaSlot {
  id: string;
  startJuz: number;
  endJuz: number;
  reservedBy: string;
  isCompleted: boolean;
  reservedAt?: number;
}

export interface Khatma {
  id: string;
  number: string;
  createdAt: number;
  slots: KhatmaSlot[];
  description?: string;
}

export interface FeaturedParticipant {
  id: string;
  name: string;
  createdAt: number;
  note?: string;
}

export interface ParticipantKhatmaAssignment {
  khatmaId: string;
  khatmaNumber: string;
  khatmaDescription?: string;
  khatmaCreatedAt: number;
  addedAt: number;
  allJuz: number[];
  completedJuz: number[];
  pendingJuz: number[];
  partsCount: number;
  completedCount: number;
  isKhatmaCompleted: boolean;
}

export interface ParticipantStats {
  name: string;
  isFeatured: boolean;
  featuredId?: string;
  completedParts: number;
  pendingParts: number;
  totalParts: number;
  activeKhatmas: {
    khatmaId: string;
    khatmaNumber: string;
    partsCount: number;
    completedCount: number;
  }[];
  assignments: ParticipantKhatmaAssignment[];
}

export type ViewState = 'LIST' | 'DETAIL' | 'PARTICIPANTS';


