
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

/**
 * Formats an array of Juz numbers into readable Arabic ranges (e.g. [1,2,3,5] -> "1-3، 5")
 */
export const formatJuzRanges = (juzList: number[]): string => {
  if (juzList.length === 0) return '';
  const sorted = Array.from(new Set(juzList)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      if (i < sorted.length) {
        start = sorted[i];
        end = sorted[i];
      }
    }
  }
  return ranges.join('، ');
};

/**
 * Aggregates all featured participants and existing khatma participants with live statistics
 * and full khatma assignment details (Juz, Khatma number, and Date added).
 */
export const buildParticipantsStats = (
  khatmas: Khatma[],
  featuredList: { id: string; name: string; createdAt: number; note?: string }[]
) => {
  const map = new Map<
    string,
    {
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
      assignments: {
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
      }[];
    }
  >();

  // 1. Seed with featured participants
  featuredList.forEach(fp => {
    const clean = fp.name.trim();
    if (!clean) return;
    map.set(clean, {
      name: clean,
      isFeatured: true,
      featuredId: fp.id,
      completedParts: 0,
      pendingParts: 0,
      totalParts: 0,
      activeKhatmas: [],
      assignments: []
    });
  });

  // 2. Scan all khatmas for stats and detailed assignments
  const sortedKhatmas = [...khatmas].sort((a, b) => b.createdAt - a.createdAt);
  sortedKhatmas.forEach(khatma => {
    const isKhatmaFullyCompleted =
      khatma.slots.length > 0 && khatma.slots.every(s => s.isCompleted);

    const perUserInKhatma = new Map<
      string,
      {
        allJuz: number[];
        completedJuz: number[];
        pendingJuz: number[];
        latestReservedAt: number;
      }
    >();

    khatma.slots.forEach(slot => {
      const clean = (slot.reservedBy || '').trim();
      if (!clean) return;

      if (!map.has(clean)) {
        map.set(clean, {
          name: clean,
          isFeatured: false,
          completedParts: 0,
          pendingParts: 0,
          totalParts: 0,
          activeKhatmas: [],
          assignments: []
        });
      }

      const entry = map.get(clean)!;
      entry.totalParts += 1;
      if (slot.isCompleted) {
        entry.completedParts += 1;
      } else {
        entry.pendingParts += 1;
      }

      const kStat = perUserInKhatma.get(clean) || {
        allJuz: [],
        completedJuz: [],
        pendingJuz: [],
        latestReservedAt: 0
      };
      kStat.allJuz.push(slot.startJuz);
      if (slot.isCompleted) {
        kStat.completedJuz.push(slot.startJuz);
      } else {
        kStat.pendingJuz.push(slot.startJuz);
      }
      if (slot.reservedAt && slot.reservedAt > kStat.latestReservedAt) {
        kStat.latestReservedAt = slot.reservedAt;
      }
      perUserInKhatma.set(clean, kStat);
    });

    perUserInKhatma.forEach((kStat, userName) => {
      const entry = map.get(userName);
      if (!entry) return;

      const sortedAll = [...kStat.allJuz].sort((a, b) => a - b);
      const sortedCompleted = [...kStat.completedJuz].sort((a, b) => a - b);
      const sortedPending = [...kStat.pendingJuz].sort((a, b) => a - b);

      entry.assignments.push({
        khatmaId: khatma.id,
        khatmaNumber: khatma.number,
        khatmaDescription: khatma.description,
        khatmaCreatedAt: khatma.createdAt,
        addedAt: kStat.latestReservedAt > 0 ? kStat.latestReservedAt : khatma.createdAt,
        allJuz: sortedAll,
        completedJuz: sortedCompleted,
        pendingJuz: sortedPending,
        partsCount: sortedAll.length,
        completedCount: sortedCompleted.length,
        isKhatmaCompleted: isKhatmaFullyCompleted
      });

      if (!isKhatmaFullyCompleted) {
        entry.activeKhatmas.push({
          khatmaId: khatma.id,
          khatmaNumber: khatma.number,
          partsCount: sortedAll.length,
          completedCount: sortedCompleted.length
        });
      }
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    if (b.totalParts !== a.totalParts) return b.totalParts - a.totalParts;
    return a.name.localeCompare(b.name, 'ar');
  });
};

export interface SmartAddAllocation {
  khatma: Khatma;
  updatedKhatma: Khatma;
  assignedJuz: number[];
  newlyReservedJuz: number[];
  alreadyReservedCompletedJuz: number[];
  previousUserParts: number;
  newUserParts: number;
  matchReason: string;
}

export interface CompatibleKhatmaOption {
  khatma: Khatma;
  availableTargetJuz: number[];
  currentUserParts: number;
  remainingUserCapacity: number;
  effectiveAssignableCount: number;
}

export interface SmartAddPlan {
  allocations: SmartAddAllocation[];
  unassignedJuz: number[];
  compatibleKhatmas: CompatibleKhatmaOption[];
}

/**
 * Smart search algorithm:
 * Finds the best Khatma(s) for a participant and a list of read/selected Juz,
 * strictly enforcing a maximum of MAX_PARTS_PER_PERSON (10) parts per participant per Khatma.
 */
export const computeSmartAddPlan = (
  khatmas: Khatma[],
  participantName: string,
  selectedJuz: number[],
  markAsCompleted: boolean = true,
  replaceSlowReaders: boolean = false,
  preferredKhatmaId: string = 'AUTO'
): SmartAddPlan => {
  const cleanName = participantName.trim();
  const uniqueSelectedJuz = Array.from(new Set(selectedJuz))
    .filter(j => j >= 1 && j <= 30)
    .sort((a, b) => a - b);

  const incompleteKhatmas = khatmas.filter(
    k => k.slots.length > 0 && !k.slots.every(s => s.isCompleted)
  );

  // Build compatible khatma options for inspection / manual override
  const compatibleKhatmas: CompatibleKhatmaOption[] = [];
  incompleteKhatmas.forEach(k => {
    const currentUserParts = k.slots.filter(
      s => (s.reservedBy || '').trim() === cleanName
    ).length;
    const remainingUserCapacity = Math.max(0, MAX_PARTS_PER_PERSON - currentUserParts);

    // Slots that are either already reserved by this user (and not completed yet) or free
    const alreadyUserPending = k.slots.filter(
      s =>
        uniqueSelectedJuz.includes(s.startJuz) &&
        (s.reservedBy || '').trim() === cleanName &&
        !s.isCompleted
    );
    const freeTargetSlots = k.slots.filter(
      s => uniqueSelectedJuz.includes(s.startJuz) && !(s.reservedBy || '').trim()
    );
    const replaceableSlots = replaceSlowReaders
      ? k.slots.filter(
          s =>
            uniqueSelectedJuz.includes(s.startJuz) &&
            (s.reservedBy || '').trim() &&
            (s.reservedBy || '').trim() !== cleanName &&
            !s.isCompleted
        )
      : [];

    const assignableFree = freeTargetSlots.slice(0, remainingUserCapacity);
    const remainingCapAfterFree = Math.max(0, remainingUserCapacity - assignableFree.length);
    const assignableReplaceable = replaceableSlots.slice(0, remainingCapAfterFree);

    const availableTargetJuz = [
      ...alreadyUserPending.map(s => s.startJuz),
      ...assignableFree.map(s => s.startJuz),
      ...assignableReplaceable.map(s => s.startJuz)
    ].sort((a, b) => a - b);

    if (availableTargetJuz.length > 0) {
      compatibleKhatmas.push({
        khatma: k,
        availableTargetJuz,
        currentUserParts,
        remainingUserCapacity,
        effectiveAssignableCount: availableTargetJuz.length
      });
    }
  });

  if (!cleanName || uniqueSelectedJuz.length === 0) {
    return {
      allocations: [],
      unassignedJuz: uniqueSelectedJuz,
      compatibleKhatmas
    };
  }

  let remainingJuz = [...uniqueSelectedJuz];
  const allocations: SmartAddAllocation[] = [];
  const usedKhatmaIds = new Set<string>();
  const nowTimestamp = Date.now();

  while (remainingJuz.length > 0) {
    interface CandidateScore {
      khatma: Khatma;
      alreadyReservedJuz: number[];
      newlyReservedJuz: number[];
      replacedJuz: number[];
      totalAssignedJuz: number[];
      previousUserParts: number;
      newUserParts: number;
      score: number;
      reason: string;
    }

    let bestCandidate: CandidateScore | null = null;

    for (const khatma of incompleteKhatmas) {
      if (usedKhatmaIds.has(khatma.id)) continue;

      // If user forced a specific khatma, try it first
      if (preferredKhatmaId !== 'AUTO' && allocations.length === 0 && khatma.id !== preferredKhatmaId) {
        continue;
      }

      const previousUserParts = khatma.slots.filter(
        s => (s.reservedBy || '').trim() === cleanName
      ).length;
      const remainingCapacity = Math.max(0, MAX_PARTS_PER_PERSON - previousUserParts);

      // 1. Parts already reserved by this participant in this khatma that need completion
      const alreadyReservedJuz = khatma.slots
        .filter(
          s =>
            remainingJuz.includes(s.startJuz) &&
            (s.reservedBy || '').trim() === cleanName &&
            !s.isCompleted
        )
        .map(s => s.startJuz)
        .sort((a, b) => a - b);

      // 2. Unreserved slots in this khatma matching remainingJuz
      const freeMatchingJuz = khatma.slots
        .filter(
          s =>
            remainingJuz.includes(s.startJuz) &&
            !(s.reservedBy || '').trim()
        )
        .map(s => s.startJuz)
        .sort((a, b) => a - b)
        .slice(0, remainingCapacity);

      const capacityLeft = Math.max(0, remainingCapacity - freeMatchingJuz.length);

      // 3. Replaceable slots (reserved by others, uncompleted) if replaceSlowReaders is on
      const replacedJuz = replaceSlowReaders && capacityLeft > 0
        ? khatma.slots
            .filter(
              s =>
                remainingJuz.includes(s.startJuz) &&
                (s.reservedBy || '').trim() &&
                (s.reservedBy || '').trim() !== cleanName &&
                !s.isCompleted
            )
            .map(s => s.startJuz)
            .sort((a, b) => a - b)
            .slice(0, capacityLeft)
        : [];

      const totalAssignedJuz = Array.from(
        new Set([...alreadyReservedJuz, ...freeMatchingJuz, ...replacedJuz])
      ).sort((a, b) => a - b);

      if (totalAssignedJuz.length === 0) continue;

      const newlyAddedCount = freeMatchingJuz.length + replacedJuz.length;
      const newUserParts = previousUserParts + newlyAddedCount;
      const targetBatchSize = Math.min(remainingJuz.length, MAX_PARTS_PER_PERSON);
      const fitsEntireBatch = totalAssignedJuz.length >= targetBatchSize;
      const totalReservedInKhatma = khatma.slots.filter(s => (s.reservedBy || '').trim()).length;
      const totalCompletedInKhatma = khatma.slots.filter(s => s.isCompleted).length;

      // Calculate suitability score
      let score = 0;
      score += totalAssignedJuz.length * 10000;
      if (fitsEntireBatch) score += 50000;
      score += alreadyReservedJuz.length * 5000;
      score += freeMatchingJuz.length * 1000;
      if (previousUserParts > 0 && newUserParts <= MAX_PARTS_PER_PERSON) {
        score += 3000 + newUserParts * 200;
      }
      score += totalCompletedInKhatma * 50 + totalReservedInKhatma * 25;

      let reason = '';
      if (alreadyReservedJuz.length > 0 && freeMatchingJuz.length === 0 && replacedJuz.length === 0) {
        reason = 'تأكيد إتمام أجزاء محجوزة مسبقاً للمشارك في هذه الخاتمة';
      } else if (replacedJuz.length > 0) {
        reason = `استبدال وتسريع قراءة ${replacedJuz.length} جزء غير منجز لتسريع الخاتمة رقم ${khatma.number}`;
      } else if (fitsEntireBatch && previousUserParts > 0) {
        reason = `تستكمل حصة المشارك (${newUserParts}/${MAX_PARTS_PER_PERSON}) وتستوعب الأجزاء المحددة بالكامل`;
      } else if (fitsEntireBatch) {
        reason = `تستوعب جميع الأجزاء المطلوبة (${totalAssignedJuz.length}) وهي الأقرب للإتمام`;
      } else {
        reason = `تستوعب ${totalAssignedJuz.length} أجزاء متاحة ضمن الحد الأقصى (${newUserParts}/${MAX_PARTS_PER_PERSON})`;
      }

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          khatma,
          alreadyReservedJuz,
          newlyReservedJuz: freeMatchingJuz,
          replacedJuz,
          totalAssignedJuz,
          previousUserParts,
          newUserParts,
          score,
          reason
        };
      }
    }

    if (!bestCandidate && preferredKhatmaId !== 'AUTO' && allocations.length === 0) {
      preferredKhatmaId = 'AUTO';
      continue;
    }

    if (!bestCandidate) {
      break;
    }

    usedKhatmaIds.add(bestCandidate.khatma.id);

    const assignedSet = new Set(bestCandidate.totalAssignedJuz);
    const updatedSlots = bestCandidate.khatma.slots.map(slot => {
      if (!assignedSet.has(slot.startJuz)) return slot;
      return {
        ...slot,
        reservedBy: cleanName,
        isCompleted: markAsCompleted ? true : slot.isCompleted,
        reservedAt: slot.reservedBy === cleanName && slot.reservedAt ? slot.reservedAt : nowTimestamp
      };
    });

    allocations.push({
      khatma: bestCandidate.khatma,
      updatedKhatma: {
        ...bestCandidate.khatma,
        slots: updatedSlots
      },
      assignedJuz: bestCandidate.totalAssignedJuz,
      newlyReservedJuz: bestCandidate.newlyReservedJuz,
      alreadyReservedCompletedJuz: bestCandidate.alreadyReservedJuz,
      previousUserParts: bestCandidate.previousUserParts,
      newUserParts: bestCandidate.newUserParts,
      matchReason: bestCandidate.reason
    });

    remainingJuz = remainingJuz.filter(j => !assignedSet.has(j));
  }

  return {
    allocations,
    unassignedJuz: remainingJuz,
    compatibleKhatmas
  };
};



