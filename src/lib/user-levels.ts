import {
  UserLevelRuleSchema,
  type AdminUserRecord,
  type UserLevelRule,
} from './dashboard-schema';

export const DEFAULT_USER_LEVEL_RULES: ReadonlyArray<UserLevelRule> = [
  {
    level: 1,
    label: 'Level 1 (level awal)',
    isStarterLevel: true,
    minActiveReferrals: 0,
    minTotalPurchase: 0,
  },
  {
    level: 2,
    label: 'Level 2',
    isStarterLevel: false,
    minActiveReferrals: 5,
    minTotalPurchase: 5_000_000,
  },
  {
    level: 3,
    label: 'Level 3',
    isStarterLevel: false,
    minActiveReferrals: 15,
    minTotalPurchase: 25_000_000,
  },
  {
    level: 4,
    label: 'Level 4',
    isStarterLevel: false,
    minActiveReferrals: 50,
    minTotalPurchase: 50_000_000,
  },
  {
    level: 5,
    label: 'Level 5',
    isStarterLevel: false,
    minActiveReferrals: 150,
    minTotalPurchase: 100_000_000,
  },
  {
    level: 6,
    label: 'Level 6',
    isStarterLevel: false,
    minActiveReferrals: 250,
    minTotalPurchase: 250_000_000,
  },
  {
    level: 7,
    label: 'Level 7',
    isStarterLevel: false,
    minActiveReferrals: 500,
    minTotalPurchase: 700_000_000,
  },
  {
    level: 8,
    label: 'Level 8',
    isStarterLevel: false,
    minActiveReferrals: 1000,
    minTotalPurchase: 5_000_000_000,
  },
];

export function cloneDefaultUserLevelRules(): UserLevelRule[] {
  return DEFAULT_USER_LEVEL_RULES.map((rule) => ({ ...rule }));
}

export function countUserActiveReferrals(
  user: Pick<AdminUserRecord, 'referrals'>
): number {
  return user.referrals.filter((ref) => ref.status === 'aktif').length;
}

export interface UserLevelEvaluation {
  currentRule: UserLevelRule;
  nextRule: UserLevelRule | null;
  missingReferrals: number;
  missingPurchase: number;
}

export function evaluateUserLevel(
  activeReferrals: number,
  totalPurchase: number,
  rules: ReadonlyArray<UserLevelRule>
): UserLevelEvaluation {
  const sorted = [...rules].sort((a, b) => a.level - b.level);
  const safeReferrals = Number.isFinite(activeReferrals) ? Math.max(0, activeReferrals) : 0;
  const safePurchase = Number.isFinite(totalPurchase) ? Math.max(0, totalPurchase) : 0;

  let currentRule = sorted[0] ?? DEFAULT_USER_LEVEL_RULES[0];
  for (const rule of sorted) {
    if (
      safeReferrals >= rule.minActiveReferrals &&
      safePurchase >= rule.minTotalPurchase
    ) {
      currentRule = rule;
    } else {
      break;
    }
  }

  const nextRule =
    sorted.find((rule) => rule.level === currentRule.level + 1) ?? null;

  return {
    currentRule,
    nextRule,
    missingReferrals: nextRule
      ? Math.max(0, nextRule.minActiveReferrals - Math.trunc(safeReferrals))
      : 0,
    missingPurchase: nextRule
      ? Math.max(0, Math.round(nextRule.minTotalPurchase - safePurchase))
      : 0,
  };
}

export function validateAndSaveUserLevels(
  draftRules: ReadonlyArray<UserLevelRule>
): {
  rules: UserLevelRule[];
  error: string | null;
} {
  if (draftRules.length !== 8) {
    return {
      rules: [],
      error: 'Pengaturan level harus terdiri dari tepat 8 level (Level 1 sampai Level 8).',
    };
  }

  const sorted = [...draftRules].sort((a, b) => a.level - b.level);
  const validated: UserLevelRule[] = [];

  for (let i = 0; i < sorted.length; i += 1) {
    const expectedLevel = i + 1;
    const item = sorted[i];

    if (item.level !== expectedLevel) {
      return {
        rules: [],
        error: `Urutan level tidak valid. Level ${expectedLevel} harus tersedia.`,
      };
    }

    if (
      !Number.isFinite(item.minActiveReferrals) ||
      item.minActiveReferrals < 0 ||
      !Number.isInteger(item.minActiveReferrals)
    ) {
      return {
        rules: [],
        error: `Minimum Referral Aktif pada ${item.label} harus berupa bilangan bulat 0 atau lebih.`,
      };
    }

    if (!Number.isFinite(item.minTotalPurchase) || item.minTotalPurchase < 0) {
      return {
        rules: [],
        error: `Minimum Total Pembelian pada ${item.label} tidak boleh bernilai negatif.`,
      };
    }

    const normalized: UserLevelRule =
      expectedLevel === 1
        ? {
            level: 1,
            label: 'Level 1 (level awal)',
            isStarterLevel: true,
            minActiveReferrals: 0,
            minTotalPurchase: 0,
          }
        : {
            level: expectedLevel,
            label: `Level ${expectedLevel}`,
            isStarterLevel: false,
            minActiveReferrals: Math.trunc(item.minActiveReferrals),
            minTotalPurchase: Math.round(item.minTotalPurchase),
          };

    const parsed = UserLevelRuleSchema.safeParse(normalized);
    if (!parsed.success) {
      return {
        rules: [],
        error: parsed.error.issues[0]?.message ?? `Data ${item.label} tidak valid.`,
      };
    }

    if (i > 0) {
      const prev = validated[i - 1];
      if (parsed.data.minActiveReferrals < prev.minActiveReferrals) {
        return {
          rules: [],
          error: `Minimum Referral Aktif pada Level ${expectedLevel} tidak boleh lebih kecil dari Level ${expectedLevel - 1}.`,
        };
      }
      if (parsed.data.minTotalPurchase < prev.minTotalPurchase) {
        return {
          rules: [],
          error: `Minimum Total Pembelian pada Level ${expectedLevel} tidak boleh lebih kecil dari Level ${expectedLevel - 1}.`,
        };
      }
    }

    validated.push(parsed.data);
  }

  return {
    rules: validated,
    error: null,
  };
}
