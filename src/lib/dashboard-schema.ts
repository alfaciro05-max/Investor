import { z } from 'zod';

export const TimeRangeSchema = z.enum(['7d', '30d', '90d', '1y']);
export type TimeRange = z.infer<typeof TimeRangeSchema>;

export const ActiveConditionTypeSchema = z.enum(['inti', 'tambahan']);
export type ActiveConditionType = z.infer<typeof ActiveConditionTypeSchema>;

export const DailyCashflowPointSchema = z.object({
  id: z.string(),
  label: z.string(),
  fullDate: z.string(),
  topUp: z.number().nonnegative(),
  withdrawal: z.number().nonnegative(),
});
export type DailyCashflowPoint = z.infer<typeof DailyCashflowPointSchema>;

export const ActiveConditionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: ActiveConditionTypeSchema,
  description: z.string(),
  count: z.number().int().nonnegative(),
});
export type ActiveConditionItem = z.infer<typeof ActiveConditionItemSchema>;

export const DashboardSnapshotSchema = z.object({
  range: TimeRangeSchema,
  rangeLabel: z.string(),
  rangeDescription: z.string(),
  activeUsers: z.number().int().nonnegative(),
  totalUsers: z.number().int().nonnegative(),
  newUsers30d: z.number().int().nonnegative(),
  totalDepositBalance: z.number().nonnegative(),
  totalWithdrawableBalance: z.number().nonnegative(),
  cashflow: z.object({
    topUpTotal: z.number().nonnegative(),
    withdrawalTotal: z.number().nonnegative(),
    difference: z.number(),
    peakTopUpAmount: z.number().nonnegative(),
    peakTopUpDate: z.string(),
    peakWithdrawalAmount: z.number().nonnegative(),
    peakWithdrawalDate: z.string(),
    series: z.array(DailyCashflowPointSchema).min(1),
  }),
  activeBreakdown: z.object({
    conditions: z.array(ActiveConditionItemSchema).length(6),
    coreTotal: z.number().int().nonnegative(),
    withAdditionalTotal: z.number().int().nonnegative(),
    passiveCount: z.number().int().nonnegative(),
    notStartedCount: z.number().int().nonnegative(),
  }),
  operational: z.object({
    pendingTopUpCount: z.number().int().nonnegative(),
    pendingTopUpAmount: z.number().nonnegative(),
    pendingWithdrawalCount: z.number().int().nonnegative(),
    pendingWithdrawalAmount: z.number().nonnegative(),
    runningProductsCount: z.number().int().nonnegative(),
    runningProductsCapital: z.number().nonnegative(),
    activeProductsCount: z.number().int().nonnegative(),
    totalCatalogProducts: z.number().int().nonnegative(),
  }),
  lifetime: z.object({
    totalApprovedTopUp: z.number().nonnegative(),
    totalApprovedWithdrawal: z.number().nonnegative(),
    totalClaimsPaid: z.number().nonnegative(),
    remainingEstimatedYield: z.number().nonnegative(),
  }),
});
export type DashboardSnapshot = z.infer<typeof DashboardSnapshotSchema>;

export const QueueTransactionSchema = z.object({
  id: z.string(),
  userName: z.string(),
  userEmail: z.string().email(),
  type: z.enum(['topup', 'withdrawal']),
  channel: z.string(),
  amount: z.number().positive(),
  submittedAt: z.string(),
  status: z.enum(['menunggu', 'disetujui', 'ditolak']),
});
export type QueueTransaction = z.infer<typeof QueueTransactionSchema>;

export const CommissionTypeSchema = z.enum(['percent', 'idr']);
export type CommissionType = z.infer<typeof CommissionTypeSchema>;

export const StockModeSchema = z.enum(['limited', 'unlimited']);
export type StockMode = z.infer<typeof StockModeSchema>;

export const InvestmentProductSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1, 'Nama produk wajib diisi'),
    category: z.string().trim().min(1, 'Kategori wajib diisi'),
    imageUrl: z.string(),
    minCapital: z.number().positive('Harga investasi harus lebih dari 0'),
    tenorDays: z.number().int('Durasi harus bilangan bulat').positive('Durasi minimal 1 hari'),
    dailyReturnRate: z.number().positive('Imbal harian harus lebih dari 0'),
    claimIncome: z.number().positive('Pendapatan / klaim harus lebih dari 0'),
    commissionType: CommissionTypeSchema.default('percent'),
    commissionRate: z.number().min(0, 'Komisi tidak boleh negatif'),
    maxPerUser: z.number().int('Batas/User harus bilangan bulat').positive('Batas/User minimal 1 unit'),
    stockMode: StockModeSchema.default('limited'),
    activeHolders: z.number().int('Stok harus bilangan bulat').nonnegative('Stok tidak boleh negatif'),
    totalCapitalIn: z.number().nonnegative('Modal masuk tidak boleh negatif'),
    status: z.enum(['aktif', 'nonaktif']),
  })
  .superRefine((data, ctx) => {
    if (data.commissionType === 'percent' && data.commissionRate > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commissionRate'],
        message: 'Komisi persentase maksimal 100%',
      });
    }
  });
export type InvestmentProduct = z.infer<typeof InvestmentProductSchema>;

export const UserStatusHistoryItemSchema = z.object({
  id: z.string(),
  action: z.enum(['dinonaktifkan', 'diaktifkan']),
  timestamp: z.string(),
  actor: z.string(),
  reason: z.string(),
});
export type UserStatusHistoryItem = z.infer<typeof UserStatusHistoryItemSchema>;

export const UserTopUpRecordSchema = z.object({
  id: z.string(),
  amount: z.number().nonnegative(),
  channel: z.string(),
  status: z.enum(['disetujui', 'menunggu', 'ditolak']),
  createdAt: z.string(),
});
export type UserTopUpRecord = z.infer<typeof UserTopUpRecordSchema>;

export const UserWithdrawalRecordSchema = z.object({
  id: z.string(),
  amount: z.number().nonnegative(),
  destination: z.string(),
  status: z.enum(['disetujui', 'menunggu', 'ditolak']),
  createdAt: z.string(),
});
export type UserWithdrawalRecord = z.infer<typeof UserWithdrawalRecordSchema>;

export const UserInvestmentRecordSchema = z.object({
  id: z.string(),
  productName: z.string(),
  capital: z.number().nonnegative(),
  expectedReturn: z.number().nonnegative(),
  earnedReturn: z.number().nonnegative(),
  status: z.enum(['aktif', 'selesai']),
  startedAt: z.string(),
});
export type UserInvestmentRecord = z.infer<typeof UserInvestmentRecordSchema>;

export const UserTransactionLedgerSchema = z.object({
  id: z.string(),
  type: z.string(),
  description: z.string(),
  amount: z.number(),
  createdAt: z.string(),
});
export type UserTransactionLedger = z.infer<typeof UserTransactionLedgerSchema>;

export const UserBankAccountSchema = z.object({
  id: z.string(),
  bankName: z.string(),
  accountNumber: z.string(),
  accountHolder: z.string(),
  isPrimary: z.boolean(),
});
export type UserBankAccount = z.infer<typeof UserBankAccountSchema>;

export const UserReferralRecordSchema = z.object({
  id: z.string(),
  userName: z.string(),
  joinedAt: z.string(),
  commissionEarned: z.number().nonnegative(),
  status: z.enum(['aktif', 'belum_transaksi']),
});
export type UserReferralRecord = z.infer<typeof UserReferralRecordSchema>;

export const AdminUserRecordSchema = z.object({
  id: z.string(),
  userNumber: z.number().int().positive(),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  phone: z.string().trim().min(1),
  whatsappRaw: z.string().trim().min(1),
  invitedBy: z.string().nullable(),
  registeredAt: z.string(),
  segment: z.enum(['aktif', 'pasif', 'belum_mulai']),
  accountStatus: z.enum(['aktif', 'nonaktif']),
  inactiveDays: z.number().int().nonnegative(),
  inactiveNote: z.string().trim().min(1),
  depositBalance: z.number().nonnegative(),
  withdrawableBalance: z.number().nonnegative(),
  totalTopUp: z.number().nonnegative(),
  totalTopUpCount: z.number().int().nonnegative(),
  totalWithdrawal: z.number().nonnegative(),
  totalWithdrawalCount: z.number().int().nonnegative(),
  totalInvestmentModal: z.number().nonnegative(),
  totalInvestmentCount: z.number().int().nonnegative(),
  activeInvestmentCount: z.number().int().nonnegative(),
  totalExpectedReturn: z.number().nonnegative(),
  totalEarnedReturn: z.number().nonnegative(),
  remainingExpectedReturn: z.number().nonnegative(),
  cashbackReceived: z.number().nonnegative(),
  referralCommissionReceived: z.number().nonnegative(),
  voucherClaimed: z.number().nonnegative(),
  runningProducts: z.number().int().nonnegative(),
  joinedAt: z.string(),
  lastActivity: z.string(),
  statusHistory: z.array(UserStatusHistoryItemSchema),
  topUps: z.array(UserTopUpRecordSchema),
  withdrawals: z.array(UserWithdrawalRecordSchema),
  investments: z.array(UserInvestmentRecordSchema),
  transactions: z.array(UserTransactionLedgerSchema),
  banks: z.array(UserBankAccountSchema),
  referrals: z.array(UserReferralRecordSchema),
});
export type AdminUserRecord = z.infer<typeof AdminUserRecordSchema>;

export const AdminSessionSchema = z.object({
  userId: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['Super Admin', 'Finance Reviewer', 'Operations Lead']),
  sessionId: z.string(),
});
export type AdminSession = z.infer<typeof AdminSessionSchema>;

export const WithdrawalPublicationSchema = z.object({
  id: z.string().trim().min(1),
  userId: z.string().nullable(),
  userNumber: z.number().int().positive(),
  userName: z.string().trim().min(1),
  userEmail: z.string().email(),
  bankChannel: z.string().trim().min(1),
  amount: z.number().positive(),
  withdrawalDate: z.string().trim().min(1),
  proofUrl: z.string(),
  proofFileName: z.string(),
  proofUploadedAt: z.string().nullable(),
  publicationStatus: z.enum(['published', 'draft']),
  publishedAt: z.string().nullable(),
});
export type WithdrawalPublication = z.infer<typeof WithdrawalPublicationSchema>;

export const AdminInvestmentStatusSchema = z.enum(['Active', 'Nonaktif', 'Selesai']);
export type AdminInvestmentStatus = z.infer<typeof AdminInvestmentStatusSchema>;

export const AdminInvestmentStatusHistorySchema = z.object({
  id: z.string().trim().min(1),
  fromStatus: AdminInvestmentStatusSchema,
  toStatus: AdminInvestmentStatusSchema,
  reason: z.string().trim().min(1),
  actor: z.string().trim().min(1),
  changedAt: z.string().trim().min(1),
});
export type AdminInvestmentStatusHistory = z.infer<typeof AdminInvestmentStatusHistorySchema>;

export const AdminInvestmentRecordSchema = z.object({
  id: z.string().trim().min(1),
  userId: z.string().nullable(),
  userName: z.string().trim().min(1),
  userPhone: z.string().trim().min(1),
  productName: z.string().trim().min(1),
  sellingPrice: z.number().positive(),
  durationDays: z.number().int().positive(),
  claimsCompleted: z.number().int().nonnegative(),
  totalClaims: z.number().int().positive(),
  incomePerClaim: z.number().positive(),
  totalEstimated: z.number().positive(),
  status: AdminInvestmentStatusSchema,
  startDate: z.string().trim().min(1),
  endDate: z.string().trim().min(1),
  statusChangeReason: z.string().trim().min(1),
  statusHistory: z.array(AdminInvestmentStatusHistorySchema),
});
export type AdminInvestmentRecord = z.infer<typeof AdminInvestmentRecordSchema>;

export const ProductCategorySchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1, 'Nama kategori wajib diisi'),
  slug: z.string().trim().min(1, 'Slug kategori wajib diisi'),
  description: z.string().trim(),
  status: z.enum(['aktif', 'nonaktif']),
  createdAt: z.string().trim().min(1),
});
export type ProductCategory = z.infer<typeof ProductCategorySchema>;

export const CashbackTargetTypeSchema = z.enum([
  'produk_tertentu',
  'semua_produk',
  'top_up',
]);
export type CashbackTargetType = z.infer<typeof CashbackTargetTypeSchema>;

export const CashbackRuleSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1, 'Nama cashback wajib diisi'),
  targetType: CashbackTargetTypeSchema,
  targetProduct: z.string().trim(),
  applicableLabel: z.string().trim().min(1, 'Target berlaku wajib diisi'),
  minTransaction: z.number().nonnegative('Minimum transaksi tidak boleh negatif'),
  cashbackAmount: z.number().positive('Nominal cashback harus lebih dari 0'),
  status: z.enum(['aktif', 'nonaktif']),
  createdAt: z.string().trim().min(1),
});
export type CashbackRule = z.infer<typeof CashbackRuleSchema>;

export const ProductCommissionEntrySchema = z.object({
  id: z.string().trim().min(1),
  recipientUserId: z.string().nullable(),
  recipientUserNumber: z.number().int().positive(),
  recipientName: z.string().trim().min(1),
  recipientEmail: z.string().email(),
  recipientPhone: z.string().trim().min(1),
  referralCode: z.string().trim().min(1),
  referredUserName: z.string().trim().min(1),
  referredUserEmail: z.string().email(),
  registeredViaReferralAt: z.string().trim().min(1),
  productId: z.string().trim().min(1),
  productName: z.string().trim().min(1),
  purchaseUnits: z.number().int().positive(),
  purchaseAmount: z.number().positive(),
  commissionType: CommissionTypeSchema,
  commissionRate: z.number().nonnegative(),
  commissionAmount: z.number().positive(),
  earnedAt: z.string().trim().min(1),
});
export type ProductCommissionEntry = z.infer<typeof ProductCommissionEntrySchema>;

export const UserLevelRuleSchema = z.object({
  level: z.number().int().min(1).max(8),
  label: z.string().trim().min(1),
  isStarterLevel: z.boolean(),
  minActiveReferrals: z.number().int().nonnegative(),
  minTotalPurchase: z.number().nonnegative(),
});
export type UserLevelRule = z.infer<typeof UserLevelRuleSchema>;
