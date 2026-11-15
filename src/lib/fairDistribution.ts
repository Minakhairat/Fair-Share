import type { EnergyLevel, FamilyMember, FamilyTask } from '../types/fairshare';

export interface MemberCapacityMetrics {
  member: FamilyMember;
  effectiveCapacity: number;
  assignedLoad: number;
  utilizationRatio: number;
  heavyTaskCount: number;
}

export interface BalancedProposal {
  taskId: string;
  taskTitle: string;
  previousAssigneeId: string;
  previousAssigneeName: string;
  proposedAssigneeId: string;
  proposedAssigneeName: string;
  effortWeight: number;
  hoursPerWeek: number;
  energyLevel: EnergyLevel;
  rotatedWeekly: boolean;
  changed: boolean;
}

export interface FairnessReport {
  fairnessIndex: number; // 0-100
  memberMetrics: MemberCapacityMetrics[];
  proposals: BalancedProposal[];
  totalWorkloadUnits: number;
}

const ENERGY_MULTIPLIER: Record<EnergyLevel, number> = {
  low: 0.72,
  medium: 1.0,
  high: 1.28,
};

const ENERGY_RANK: Record<EnergyLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function computeEffectiveCapacity(member: FamilyMember): number {
  const hours = Math.max(1, member.availableHoursPerWeek || 10);
  const multiplier = ENERGY_MULTIPLIER[member.energyLevel] ?? 1.0;
  return Number((hours * multiplier).toFixed(2));
}

export function computeTaskWeight(task: Pick<FamilyTask, 'estimatedMinutes' | 'difficulty' | 'isHeavy'>): number {
  const durationFactor = Math.max(0.25, task.estimatedMinutes / 30);
  const difficultyFactor = 0.7 + task.difficulty * 0.35;
  const heavyBonus = task.isHeavy ? 1.45 : 1.0;
  return Number((durationFactor * difficultyFactor * heavyBonus * 10).toFixed(2));
}

function computeEnergyMismatchPenalty(taskEnergy: EnergyLevel, memberEnergy: EnergyLevel): number {
  const diff = ENERGY_RANK[taskEnergy] - ENERGY_RANK[memberEnergy];
  if (diff <= 0) return 0;
  return diff * 18;
}

export function computeFairnessIndex(ratios: number[]): number {
  if (ratios.length <= 1) return 100;
  const mean = ratios.reduce((acc, r) => acc + r, 0) / ratios.length;
  if (mean <= 0) return 100;
  const variance = ratios.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / ratios.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;
  return Math.max(0, Math.min(100, Math.round((1 - Math.min(1, cv)) * 100)));
}

export function calculateFairDistribution(
  members: FamilyMember[],
  tasks: FamilyTask[],
  options: { rotateHeavyWeekly?: boolean } = {}
): FairnessReport {
  if (members.length === 0) {
    return {
      fairnessIndex: 100,
      memberMetrics: [],
      proposals: [],
      totalWorkloadUnits: 0,
    };
  }

  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const currentLoads = new Map<string, number>();
  const currentHeavyCounts = new Map<string, number>();
  const currentCapacities = new Map<string, number>();

  for (const m of members) {
    currentCapacities.set(m.uid, computeEffectiveCapacity(m));
    currentLoads.set(m.uid, Number((m.weeklyLoadScore * 0.25).toFixed(2)));
    currentHeavyCounts.set(m.uid, 0);
  }

  const sortedTasks = [...activeTasks].sort((a, b) => {
    if (a.isHeavy !== b.isHeavy) return a.isHeavy ? -1 : 1;
    return computeTaskWeight(b) - computeTaskWeight(a);
  });

  const proposals: BalancedProposal[] = [];
  let totalWorkloadUnits = 0;

  for (const task of sortedTasks) {
    const weight = computeTaskWeight(task);
    totalWorkloadUnits += weight;

    let bestMember = members[0];
    let bestScore = Number.POSITIVE_INFINITY;
    let rotated = false;

    for (const candidate of members) {
      const cap = currentCapacities.get(candidate.uid) ?? 10;
      const load = currentLoads.get(candidate.uid) ?? 0;
      const projectedRatio = (load + weight) / cap;

      const energyPenalty = computeEnergyMismatchPenalty(task.energyRequired, candidate.energyLevel);
      const heavyHistoryPenalty = task.isHeavy
        ? candidate.heavyTasksCompleted * 0.35 + (currentHeavyCounts.get(candidate.uid) ?? 0) * 1.6
        : 0;

      const rotationPenalty =
        options.rotateHeavyWeekly && task.isHeavy && members.length > 1 && candidate.uid === task.assigneeId
          ? 25
          : 0;

      const score = projectedRatio * 100 + energyPenalty + heavyHistoryPenalty + rotationPenalty;

      if (score < bestScore) {
        bestScore = score;
        bestMember = candidate;
        rotated = Boolean(options.rotateHeavyWeekly && task.isHeavy && candidate.uid !== task.assigneeId);
      }
    }

    currentLoads.set(bestMember.uid, Number(((currentLoads.get(bestMember.uid) ?? 0) + weight).toFixed(2)));
    if (task.isHeavy) {
      currentHeavyCounts.set(bestMember.uid, (currentHeavyCounts.get(bestMember.uid) ?? 0) + 1);
    }

    proposals.push({
      taskId: task.id,
      taskTitle: task.title,
      previousAssigneeId: task.assigneeId,
      previousAssigneeName: task.assigneeName,
      proposedAssigneeId: bestMember.uid,
      proposedAssigneeName: bestMember.displayName,
      effortWeight: weight,
      hoursPerWeek: bestMember.availableHoursPerWeek,
      energyLevel: bestMember.energyLevel,
      rotatedWeekly: rotated,
      changed: bestMember.uid !== task.assigneeId,
    });
  }

  const actualLoads = new Map<string, number>();
  const actualHeavy = new Map<string, number>();
  for (const m of members) {
    actualLoads.set(m.uid, 0);
    actualHeavy.set(m.uid, 0);
  }
  for (const task of activeTasks) {
    const w = computeTaskWeight(task);
    actualLoads.set(task.assigneeId, Number(((actualLoads.get(task.assigneeId) ?? 0) + w).toFixed(2)));
    if (task.isHeavy) {
      actualHeavy.set(task.assigneeId, (actualHeavy.get(task.assigneeId) ?? 0) + 1);
    }
  }

  const memberMetrics: MemberCapacityMetrics[] = members.map((m) => {
    const cap = currentCapacities.get(m.uid) ?? 10;
    const assigned = actualLoads.get(m.uid) ?? 0;
    return {
      member: m,
      effectiveCapacity: cap,
      assignedLoad: assigned,
      utilizationRatio: Number((assigned / cap).toFixed(2)),
      heavyTaskCount: actualHeavy.get(m.uid) ?? 0,
    };
  });

  const fairnessIndex = computeFairnessIndex(memberMetrics.map((m) => m.utilizationRatio));

  return {
    fairnessIndex,
    memberMetrics,
    proposals,
    totalWorkloadUnits: Number(totalWorkloadUnits.toFixed(1)),
  };
}
