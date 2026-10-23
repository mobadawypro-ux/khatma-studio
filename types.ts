
export interface KhatmaSlot {
  id: string;
  startJuz: number;
  endJuz: number;
  reservedBy: string;
  isCompleted: boolean;
}

export interface Khatma {
  id: string;
  number: string;
  createdAt: number;
  slots: KhatmaSlot[];
  description?: string;
}

export type ViewState = 'LIST' | 'DETAIL';
