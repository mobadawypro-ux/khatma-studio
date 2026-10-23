
import { Khatma, KhatmaSlot } from './types';

export const STORAGE_KEY = 'khatma_app_data_v1';

export const DEFAULT_SLOT_SIZE = 1; // 1 juz per slot by default, user can group

// Rebalancing rules: each reader must hold between 5 and 10 parts per khatma
export const MIN_PARTS_PER_PERSON = 5;
export const MAX_PARTS_PER_PERSON = 10;

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const createStandardSlots = (): any[] => {
  const slots = [];
  // Example grouping: 1-5, 6-10... or just 1, 2, 3...
  // Based on user request "1 to 5", "6 to 10"
  for (let i = 1; i <= 30; i += 1) {
    slots.push({
      id: `slot-${i}`,
      startJuz: i,
      endJuz: i,
      reservedBy: '',
      isCompleted: false
    });
  }
  return slots;
};

export interface RebalanceResult {
  khatma: Khatma;
  changed: boolean;
  freedSlots: number;
}

/**
 * Rebalances a single khatma so that every reader holds between
 * MIN_PARTS_PER_PERSON (5) and MAX_PARTS_PER_PERSON (10) parts.
 *
 * Rules:
 *  - Fully completed khatmas are never modified.
 *  - A reader holding more than 10 parts keeps 10 parts (completed parts
 *    are kept first to preserve progress, then the earliest parts) and the
 *    rest are released.
 *  - A reader holding fewer than 5 parts has all of their parts released.
 *  - Released parts become unreserved and not completed.
 */
export const rebalanceKhatma = (khatma: Khatma): RebalanceResult => {
  // Never touch completed (or empty) khatmas
  if (khatma.slots.length === 0 || khatma.slots.every(s => s.isCompleted)) {
    return { khatma, changed: false, freedSlots: 0 };
  }

  // Group reserved slots by reader name
  const slotsByReader = new Map<string, KhatmaSlot[]>();
  khatma.slots.forEach(slot => {
    const name = (slot.reservedBy || '').trim();
    if (!name) return;
    const list = slotsByReader.get(name) ?? [];
    list.push(slot);
    slotsByReader.set(name, list);
  });

  const freedSlotIds = new Set<string>();

  slotsByReader.forEach(readerSlots => {
    const sorted = [...readerSlots].sort((a, b) => a.startJuz - b.startJuz);

    if (sorted.length > MAX_PARTS_PER_PERSON) {
      // Keep completed parts first (to preserve progress), then earliest parts
      const completed = sorted.filter(s => s.isCompleted);
      const pending = sorted.filter(s => !s.isCompleted);
      const keptIds = new Set(
        [...completed, ...pending].slice(0, MAX_PARTS_PER_PERSON).map(s => s.id)
      );
      sorted.forEach(s => {
        if (!keptIds.has(s.id)) freedSlotIds.add(s.id);
      });
    } else if (sorted.length < MIN_PARTS_PER_PERSON) {
      // Below the minimum: release all of this reader's parts
      sorted.forEach(s => freedSlotIds.add(s.id));
    }
  });

  if (freedSlotIds.size === 0) {
    return { khatma, changed: false, freedSlots: 0 };
  }

  const updatedSlots = khatma.slots.map(s =>
    freedSlotIds.has(s.id) ? { ...s, reservedBy: '', isCompleted: false } : s
  );

  return {
    khatma: { ...khatma, slots: updatedSlots },
    changed: true,
    freedSlots: freedSlotIds.size
  };
};

/**
 * Redistributes all participants sequentially across incomplete khatmas.
 * 
 * Algorithm:
 *  1. Collect all participants and their parts from all incomplete khatmas
 *  2. Sort khatmas by creation date (oldest first)
 *  3. Clear all participant assignments (keeping completed parts)
 *  4. Redistribute participants sequentially:
 *     - Each participant gets max 10 parts per khatma
 *     - Fill oldest khatmas first
 *  5. Completed parts are always preserved
 */
export interface RedistributeResult {
  khatmas: Khatma[];
  changedCount: number;
  totalReassigned: number;
}

export const redistributeParticipants = (khatmas: Khatma[]): RedistributeResult => {
  // Filter incomplete khatmas
  const incompleteKhatmas = khatmas.filter(
    k => k.slots.length > 0 && !k.slots.every(s => s.isCompleted)
  );

  if (incompleteKhatmas.length === 0) {
    return { khatmas, changedCount: 0, totalReassigned: 0 };
  }

  // Step 1: Collect all participants and their total parts
  interface ParticipantInfo {
    name: string;
    slots: KhatmaSlot[]; // All slots assigned to this person
    khatmaIds: string[]; // Which khatmas they're in
  }
  const participantMap = new Map<string, ParticipantInfo>();

  incompleteKhatmas.forEach(khatma => {
    khatma.slots.forEach(slot => {
      const name = (slot.reservedBy || '').trim();
      if (!name) return;

      if (!participantMap.has(name)) {
        participantMap.set(name, {
          name,
          slots: [],
          khatmaIds: []
        });
      }
      const info = participantMap.get(name)!;
      info.slots.push(slot);
      if (!info.khatmaIds.includes(khatma.id)) {
        info.khatmaIds.push(khatma.id);
      }
    });
  });

  // Step 2: Sort khatmas by creation date (oldest first)
  const sortedKhatmas = [...incompleteKhatmas].sort((a, b) => a.createdAt - b.createdAt);

  // Step 3: Clear all assignments (keep completed parts only)
  let updatedKhatmas = khatmas.map(khatma => {
    if (!incompleteKhatmas.find(ik => ik.id === khatma.id)) {
      return khatma; // Skip if not incomplete
    }
    const cleared = khatma.slots.map(slot => {
      if (slot.isCompleted) {
        return slot; // Keep completed
      }
      return { ...slot, reservedBy: '' }; // Clear unreserved assignments
    });
    return { ...khatma, slots: cleared };
  });

  // Step 4: Redistribute participants sequentially
  const participants = Array.from(participantMap.values()).sort((a, b) => 
    a.name.localeCompare(b.name) // Sort by name for consistency
  );

  // Create a map to track original slot states
  const slotStateMap = new Map<string, boolean>();
  participants.forEach(participant => {
    participant.slots.forEach(slot => {
      slotStateMap.set(slot.id, slot.isCompleted);
    });
  });

  for (const participant of participants) {
    const totalParts = participant.slots.length;
    let partsToAssign = totalParts;
    let assignedCount = 0;

    // Assign to each khatma (oldest first)
    for (const khatma of sortedKhatmas) {
      if (partsToAssign === 0) break;

      // Find empty slots in this khatma
      const khatmaIndex = updatedKhatmas.findIndex(k => k.id === khatma.id);
      if (khatmaIndex === -1) continue;

      const currentKhatma = updatedKhatmas[khatmaIndex];
      const emptySlots = currentKhatma.slots.filter(s => !s.reservedBy);
      
      // Count how many slots are already assigned to this participant
      const alreadyAssignedInKhatma = currentKhatma.slots.filter(
        s => s.reservedBy === participant.name
      ).length;

      const availableSpace = MAX_PARTS_PER_PERSON - alreadyAssignedInKhatma;
      const slotsToAssignNow = Math.min(availableSpace, partsToAssign, emptySlots.length);

      if (slotsToAssignNow > 0) {
        const updatedSlots = [...currentKhatma.slots];
        let assigned = 0;

        for (let i = 0; i < updatedSlots.length && assigned < slotsToAssignNow; i++) {
          if (!updatedSlots[i].reservedBy) {
            // Get original completion state from the slot state map
            const originalState = slotStateMap.get(updatedSlots[i].id) ?? false;
            updatedSlots[i] = {
              ...updatedSlots[i],
              reservedBy: participant.name,
              isCompleted: originalState // Preserve original completion state
            };
            assigned++;
            assignedCount++;
            partsToAssign--;
          }
        }

        updatedKhatmas[khatmaIndex] = { ...currentKhatma, slots: updatedSlots };
      }
    }
  }

  // Step 5: Count changes
  let changedCount = 0;
  updatedKhatmas.forEach(updated => {
    const original = khatmas.find(k => k.id === updated.id);
    if (original && JSON.stringify(original.slots) !== JSON.stringify(updated.slots)) {
      changedCount++;
    }
  });

  return {
    khatmas: updatedKhatmas,
    changedCount,
    totalReassigned: Array.from(participantMap.values()).reduce((sum, p) => sum + p.slots.length, 0)
  };
};
