import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIME_RANGE_OPTIONS,
  INITIAL_QUEUE_TRANSACTIONS,
  INVESTMENT_PRODUCTS,
  ADMIN_USER_RECORDS,
  getDashboardSnapshot,
  getNonActiveUserSummary,
  filterAdminUsers,
  updateQueueTransactionStatus,
  getNextProductId,
  addInvestmentProduct,
  updateInvestmentProduct,
  deleteInvestmentProduct,
  buildDashboardCsv,
} from './dashboard-data';
import {
  AdminInvestmentRecordSchema,
  AdminUserRecordSchema,
  CashbackRuleSchema,
  InvestmentProductSchema,
  ProductCategorySchema,
  ProductCommissionEntrySchema,
  UserLevelRuleSchema,
  WithdrawalPublicationSchema,
} from './dashboard-schema';
import {
  INITIAL_CASHBACK_RULES,
  addCashbackRule,
  deleteCashbackRule,
  filterCashbackRules,
  findProductForCashback,
  formatCashbackApplicableLabel,
  getCashbackProductOptions,
  getCashbackSummary,
  getNextCashbackId,
  updateCashbackRule,
} from './cashbacks';
import {
  INITIAL_PRODUCT_CATEGORIES,
  addProductCategory,
  countProductsByCategory,
  deleteProductCategory,
  filterProductCategories,
  getCategorySummary,
  getNextCategoryId,
  slugifyCategoryName,
  updateProductCategory,
} from './categories';
import {
  INITIAL_ADMIN_INVESTMENTS,
  changeInvestmentStatus,
  filterAdminInvestments,
  getInvestmentSummary,
} from './investments';
import {
  INITIAL_WITHDRAWAL_PUBLICATIONS,
  clearWithdrawalProof,
  filterWithdrawalPublications,
  getWithdrawalPublicationSummary,
  toggleWithdrawalPublication,
  updateWithdrawalProof,
  upsertWithdrawalPublicationFromQueueTx,
} from './withdrawal-publications';
import {
  INITIAL_PRODUCT_COMMISSIONS,
  aggregateProductCommissionRecipients,
  buildReferralRegistrationLink,
  calculateProductCommissionAmount,
  deriveUserReferralCode,
  filterProductCommissionRecipients,
  getProductCommissionOverview,
  getUserProductCommissionSummary,
  isProductCommissionActive,
} from './product-commissions';
import {
  checkUserEmail,
  checkWhatsAppNumber,
  createAdminUser,
  detectIndonesianCarrier,
  normalizeIndonesianPhone,
  toggleUserAccountStatus,
} from './user-diagnostics';
import {
  DEFAULT_USER_LEVEL_RULES,
  cloneDefaultUserLevelRules,
  countUserActiveReferrals,
  evaluateUserLevel,
  validateAndSaveUserLevels,
} from './user-levels';
import {
  MAX_PRODUCT_IMAGE_BYTES,
  formatNumber,
  formatProductCommission,
  formatProductStock,
  formatRupiah,
  formatSignedRupiah,
  validateProductImageFile,
} from './utils';

test('Indonesian currency and number formatters match exact prompt conventions', () => {
  assert.equal(formatNumber(2291), '2.291');
  assert.equal(formatNumber(1776), '1.776');
  assert.equal(formatRupiah(20522293), 'Rp 20.522.293');
  assert.equal(formatRupiah(1647185000), 'Rp 1.647.185.000');
  assert.equal(formatRupiah(-15745982), '−Rp 15.745.982');
  assert.equal(formatSignedRupiah(-15745982), '−Rp 15.745.982');
  assert.equal(formatSignedRupiah(500000), '+Rp 500.000');
  assert.equal(formatProductCommission(5, 'percent'), '5%');
  assert.equal(formatProductCommission(4.5, 'percent'), '4.5%');
  assert.equal(formatProductCommission(50000, 'idr'), 'Rp 50.000');
  assert.equal(formatProductStock(312, 'limited'), '312');
  assert.equal(formatProductStock(312, 'unlimited'), 'Unlimited');
});

test('7-day default snapshot matches every prompt figure verbatim', () => {
  const s = getDashboardSnapshot('7d');

  assert.equal(s.rangeDescription, 'Grafik dan hitungan user aktif memakai rentang 7 hari terakhir.');
  assert.equal(s.activeUsers, 510);
  assert.equal(s.totalUsers, 2291);
  assert.equal(s.newUsers30d, 1895);
  assert.equal(s.totalDepositBalance, 20522293);
  assert.equal(s.totalWithdrawableBalance, 1647185000);

  assert.equal(s.cashflow.topUpTotal, 382782018);
  assert.equal(s.cashflow.withdrawalTotal, 398528000);
  assert.equal(s.cashflow.difference, -15745982);
  assert.equal(s.cashflow.peakTopUpAmount, 128700000);
  assert.equal(s.cashflow.peakTopUpDate, '14 Nov 2026');
  assert.equal(s.cashflow.peakWithdrawalAmount, 117116000);
  assert.equal(s.cashflow.peakWithdrawalDate, '14 Nov 2026');

  const conditionMap = Object.fromEntries(
    s.activeBreakdown.conditions.map((c) => [c.title, { type: c.type, count: c.count }])
  );
  assert.deepEqual(conditionMap['Punya produk berjalan'], { type: 'inti', count: 510 });
  assert.deepEqual(conditionMap['Masih beli produk'], { type: 'inti', count: 138 });
  assert.deepEqual(conditionMap['Masih klaim produk'], { type: 'inti', count: 490 });
  assert.deepEqual(conditionMap['Masih punya saldo'], { type: 'tambahan', count: 528 });
  assert.deepEqual(conditionMap['Top up disetujui'], { type: 'tambahan', count: 140 });
  assert.deepEqual(conditionMap['Masih bertransaksi'], { type: 'tambahan', count: 509 });

  assert.equal(s.activeBreakdown.coreTotal, 510);
  assert.equal(s.activeBreakdown.withAdditionalTotal, 598);
  assert.equal(s.activeBreakdown.passiveCount, 5);
  assert.equal(s.activeBreakdown.notStartedCount, 1776);

  assert.equal(s.operational.pendingTopUpCount, 5);
  assert.equal(s.operational.pendingTopUpAmount, 6100000);
  assert.equal(s.operational.pendingWithdrawalCount, 423);
  assert.equal(s.operational.pendingWithdrawalAmount, 451431500);
  assert.equal(s.operational.runningProductsCount, 1296);
  assert.equal(s.operational.runningProductsCapital, 1947810000);
  assert.equal(s.operational.activeProductsCount, 30);
  assert.equal(s.operational.totalCatalogProducts, 62);

  assert.equal(s.lifetime.totalApprovedTopUp, 1969304178);
  assert.equal(s.lifetime.totalApprovedWithdrawal, 1582680500);
  assert.equal(s.lifetime.totalClaimsPaid, 1637162000);
  assert.equal(s.lifetime.remainingEstimatedYield, 0);
});

test('All time ranges maintain mathematical invariants and invariant lifetime figures', () => {
  for (const { value } of TIME_RANGE_OPTIONS) {
    const s = getDashboardSnapshot(value);

    // Sum of series equals cashflow totals
    const seriesTopUpSum = s.cashflow.series.reduce((acc, p) => acc + p.topUp, 0);
    const seriesWithdrawalSum = s.cashflow.series.reduce((acc, p) => acc + p.withdrawal, 0);
    assert.equal(seriesTopUpSum, s.cashflow.topUpTotal, `TopUp sum mismatch for ${value}`);
    assert.equal(seriesWithdrawalSum, s.cashflow.withdrawalTotal, `Withdrawal sum mismatch for ${value}`);
    assert.equal(s.cashflow.difference, s.cashflow.topUpTotal - s.cashflow.withdrawalTotal);

    // User segmentation equals total users
    const userSegmentTotal =
      s.activeBreakdown.coreTotal + s.activeBreakdown.passiveCount + s.activeBreakdown.notStartedCount;
    assert.equal(userSegmentTotal, s.totalUsers, `User segmentation mismatch for ${value}`);

    // Lifetime metrics never change with range filter
    assert.equal(s.lifetime.totalApprovedTopUp, 1969304178);
    assert.equal(s.lifetime.totalApprovedWithdrawal, 1582680500);
    assert.equal(s.lifetime.totalClaimsPaid, 1637162000);
    assert.equal(s.lifetime.remainingEstimatedYield, 0);
  }
});

test('Pending queue approval updates pending count and amount accurately', () => {
  const pendingTopUps = INITIAL_QUEUE_TRANSACTIONS.filter((t) => t.type === 'topup');
  assert.equal(pendingTopUps.length, 5);
  assert.equal(
    pendingTopUps.reduce((acc, t) => acc + t.amount, 0),
    6100000
  );

  const res = updateQueueTransactionStatus(INITIAL_QUEUE_TRANSACTIONS, 'TU-261114-001', 'disetujui');
  assert.equal(res.deltaPendingTopUpCount, -1);
  assert.equal(res.deltaPendingTopUpAmount, -1500000);
  assert.equal(res.deltaPendingWithdrawalCount, 0);
  assert.equal(res.transactions.find((t) => t.id === 'TU-261114-001')?.status, 'disetujui');
});

test('CSV export includes key summary rows', () => {
  const csv = buildDashboardCsv(getDashboardSnapshot('7d'));
  assert.ok(csv.includes('Rp 20.522.293'));
  assert.ok(csv.includes('−Rp 15.745.982'));
  assert.ok(csv.includes('Rp 1.969.304.178'));
});

test('Product update validates with Zod and updates matching product', () => {
  const target = INVESTMENT_PRODUCTS[0];
  const updatedList = updateInvestmentProduct(INVESTMENT_PRODUCTS, {
    ...target,
    name: 'Reksa Energi Surya Nusantara v2',
    minCapital: 2_000_000,
    tenorDays: 45,
    claimIncome: 29_000,
    commissionRate: 7.5,
    maxPerUser: 8,
    status: 'nonaktif',
  });
  assert.equal(updatedList[0].name, 'Reksa Energi Surya Nusantara v2');
  assert.equal(updatedList[0].minCapital, 2_000_000);
  assert.equal(updatedList[0].tenorDays, 45);
  assert.equal(updatedList[0].claimIncome, 29_000);
  assert.equal(updatedList[0].commissionRate, 7.5);
  assert.equal(updatedList[0].maxPerUser, 8);
  assert.equal(updatedList[0].status, 'nonaktif');

  const badResult = InvestmentProductSchema.safeParse({
    ...target,
    name: '   ',
    minCapital: 0,
    claimIncome: -100,
    commissionType: 'percent',
    commissionRate: 120,
    maxPerUser: 0,
  });
  assert.equal(badResult.success, false);

  const flatIdrResult = InvestmentProductSchema.safeParse({
    ...target,
    commissionType: 'idr',
    commissionRate: 75_000,
    stockMode: 'unlimited',
  });
  assert.equal(flatIdrResult.success, true);
});

test('Product delete removes matching product cleanly', () => {
  const afterDelete = deleteInvestmentProduct(INVESTMENT_PRODUCTS, 'PRD-02');
  assert.equal(afterDelete.length, INVESTMENT_PRODUCTS.length - 1);
  assert.equal(afterDelete.some((p) => p.id === 'PRD-02'), false);
});

test('Product add generates next sequential PRD ID and validates with Zod', () => {
  assert.equal(getNextProductId(INVESTMENT_PRODUCTS), 'PRD-07');
  const nextList = addInvestmentProduct(INVESTMENT_PRODUCTS, {
    ...INVESTMENT_PRODUCTS[0],
    id: '',
    name: 'Obligasi Hijau Kalimantan',
    minCapital: 1_250_000,
    commissionType: 'idr',
    commissionRate: 50_000,
    stockMode: 'unlimited',
  });
  assert.equal(nextList.length, INVESTMENT_PRODUCTS.length + 1);
  assert.equal(nextList[0].id, 'PRD-07');
  assert.equal(nextList[0].name, 'Obligasi Hijau Kalimantan');
  assert.equal(nextList[0].commissionType, 'idr');
  assert.equal(nextList[0].stockMode, 'unlimited');
});

test('Gallery image upload validation accepts valid images and rejects non-images or oversized files', () => {
  assert.deepEqual(validateProductImageFile({ type: 'image/jpeg', size: 250_000 }), { valid: true });
  assert.deepEqual(validateProductImageFile({ type: 'image/png', size: MAX_PRODUCT_IMAGE_BYTES }), {
    valid: true,
  });

  const nonImage = validateProductImageFile({ type: 'application/pdf', size: 1024 });
  assert.equal(nonImage.valid, false);

  const emptyFile = validateProductImageFile({ type: 'image/webp', size: 0 });
  assert.equal(emptyFile.valid, false);

  const oversized = validateProductImageFile({
    type: 'image/png',
    size: MAX_PRODUCT_IMAGE_BYTES + 1,
  });
  assert.equal(oversized.valid, false);
});

test('Admin user records validate with Zod and include phone & non-active info', () => {
  assert.ok(ADMIN_USER_RECORDS.length > 0);
  for (const user of ADMIN_USER_RECORDS) {
    const parsed = AdminUserRecordSchema.safeParse(user);
    assert.equal(parsed.success, true, `User ${user.id} failed validation`);
    assert.ok(user.phone.trim().length >= 8, `User ${user.id} missing valid phone number`);
    if (user.accountStatus === 'nonaktif') {
      assert.ok(user.inactiveDays >= 1, `Non-active user ${user.id} should track inactiveDays`);
    }
  }

  const summary = getNonActiveUserSummary(getDashboardSnapshot('7d').activeBreakdown);
  assert.equal(summary.passiveCount, 5);
  assert.equal(summary.notStartedCount, 1776);
  assert.equal(summary.totalNonActive, 1781);

  const nonActiveUsers = filterAdminUsers(ADMIN_USER_RECORDS, {
    segmentFilter: 'nonaktif',
    query: '',
  });
  assert.ok(nonActiveUsers.length >= 4);
  assert.equal(
    nonActiveUsers.every((u) => u.accountStatus === 'nonaktif'),
    true
  );

  const phoneMatches = filterAdminUsers(ADMIN_USER_RECORDS, {
    segmentFilter: 'semua',
    query: '08137724',
  });
  assert.equal(phoneMatches.length, 1);
  assert.equal(phoneMatches[0].id, 'USR-8804');
});

test('User WhatsApp & Email diagnostics and status toggling work accurately', () => {
  const risma = ADMIN_USER_RECORDS.find((u) => u.id === 'USR-2303');
  assert.ok(risma, 'Sample user Risma (#2303) should exist');

  const norm = normalizeIndonesianPhone(risma.whatsappRaw);
  assert.equal(norm.internationalDigits, '6289608359465');
  assert.equal(norm.plusInternational, '+6289608359465');
  assert.equal(norm.local, '089608359465');
  assert.equal(norm.isIndonesia, true);
  assert.equal(norm.isReasonableLength, true);
  assert.equal(detectIndonesianCarrier(norm.local).carrier, 'Tri');

  const waCheck = checkWhatsAppNumber(risma, ADMIN_USER_RECORDS);
  assert.equal(waCheck.isValid, true);
  assert.equal(waCheck.checks.find((c) => c.id === 'carrier')?.detail.startsWith('Tri'), true);
  assert.equal(waCheck.checks.find((c) => c.id === 'whatsapp-registered')?.status, 'unknown');

  const emailCheck = checkUserEmail(risma, ADMIN_USER_RECORDS);
  assert.equal(emailCheck.isValid, true);
  assert.equal(
    emailCheck.checks.find((c) => c.id === 'mx')?.detail,
    'Domain gmail.com punya mail server.'
  );

  const emailCheckWithMx = checkUserEmail(risma, ADMIN_USER_RECORDS, {
    mxHost: 'gmail-smtp-in.l.google.com',
  });
  assert.equal(
    emailCheckWithMx.checks.find((c) => c.id === 'mx')?.detail,
    'Domain gmail.com punya mail server (gmail-smtp-in.l.google.com).'
  );

  const disposableEmailCheck = checkUserEmail(
    { id: 'TMP-1', email: 'test@mailinator.com' },
    ADMIN_USER_RECORDS
  );
  assert.equal(disposableEmailCheck.isValid, false);

  const afterDeactivate = toggleUserAccountStatus(ADMIN_USER_RECORDS, 'USR-2303', {
    reason: 'Uji penonaktifan akun',
  });
  const deactivatedRisma = afterDeactivate.find((u) => u.id === 'USR-2303')!;
  assert.equal(deactivatedRisma.accountStatus, 'nonaktif');
  assert.equal(deactivatedRisma.statusHistory.length, 1);
  assert.equal(deactivatedRisma.statusHistory[0].action, 'dinonaktifkan');
  assert.equal(deactivatedRisma.statusHistory[0].reason, 'Uji penonaktifan akun');

  const afterReactivate = toggleUserAccountStatus(afterDeactivate, 'USR-2303', {
    reason: 'Verifikasi selesai',
  });
  const reactivatedRisma = afterReactivate.find((u) => u.id === 'USR-2303')!;
  assert.equal(reactivatedRisma.accountStatus, 'aktif');
  assert.equal(reactivatedRisma.statusHistory.length, 2);
  assert.equal(reactivatedRisma.statusHistory[0].action, 'diaktifkan');
});

test('Withdrawal publications validate with Zod, filter accurately, and treat proof as optional', () => {
  assert.ok(INITIAL_WITHDRAWAL_PUBLICATIONS.length >= 4);
  for (const item of INITIAL_WITHDRAWAL_PUBLICATIONS) {
    const parsed = WithdrawalPublicationSchema.safeParse(item);
    assert.equal(parsed.success, true, `Withdrawal publication ${item.id} failed validation`);
  }

  const summary = getWithdrawalPublicationSummary(INITIAL_WITHDRAWAL_PUBLICATIONS);
  assert.equal(summary.totalCount, INITIAL_WITHDRAWAL_PUBLICATIONS.length);
  assert.ok(summary.publishedCount >= 1);
  assert.ok(summary.missingProofCount >= 1);

  const missingProofRow = INITIAL_WITHDRAWAL_PUBLICATIONS.find((r) => !r.proofUrl)!;
  const directPublishWithoutProof = toggleWithdrawalPublication(
    INITIAL_WITHDRAWAL_PUBLICATIONS,
    missingProofRow.id
  );
  assert.equal(directPublishWithoutProof.error, null, 'Should allow publishing without proof');
  assert.equal(
    directPublishWithoutProof.records.find((r) => r.id === missingProofRow.id)?.publicationStatus,
    'published'
  );

  const withProof = updateWithdrawalProof(
    directPublishWithoutProof.records,
    missingProofRow.id,
    {
      proofUrl: 'data:image/png;base64,iVBORw0KGgo=',
      proofFileName: 'bukti-transfer.png',
    }
  );
  assert.equal(
    withProof.find((r) => r.id === missingProofRow.id)?.proofFileName,
    'bukti-transfer.png'
  );

  const afterClear = clearWithdrawalProof(withProof, missingProofRow.id);
  const clearedRow = afterClear.find((r) => r.id === missingProofRow.id)!;
  assert.equal(clearedRow.proofUrl, '');
  assert.equal(clearedRow.publicationStatus, 'published');

  const noProofFiltered = filterWithdrawalPublications(INITIAL_WITHDRAWAL_PUBLICATIONS, {
    filter: 'no_proof',
    query: '',
  });
  assert.equal(noProofFiltered.every((r) => r.proofUrl === ''), true);

  const queueWd = INITIAL_QUEUE_TRANSACTIONS.find((t) => t.id === 'WD-261114-101')!;
  const syncedWithoutProof = upsertWithdrawalPublicationFromQueueTx(
    INITIAL_WITHDRAWAL_PUBLICATIONS,
    queueWd,
    ADMIN_USER_RECORDS
  );
  assert.equal(syncedWithoutProof.length, INITIAL_WITHDRAWAL_PUBLICATIONS.length + 1);
  assert.equal(syncedWithoutProof[0].id, 'WD-261114-101');
  assert.equal(syncedWithoutProof[0].userId, 'USR-8791');
  assert.equal(syncedWithoutProof[0].proofUrl, '');
  assert.equal(syncedWithoutProof[0].publicationStatus, 'draft');

  const syncedWithProof = upsertWithdrawalPublicationFromQueueTx(
    syncedWithoutProof,
    queueWd,
    ADMIN_USER_RECORDS,
    {
      proofUrl: 'data:image/png;base64,iVBORw0KGgo=',
      proofFileName: 'struk-adi.png',
      publishImmediately: true,
    }
  );
  assert.equal(syncedWithProof.length, syncedWithoutProof.length);
  assert.equal(syncedWithProof[0].proofFileName, 'struk-adi.png');
  assert.equal(syncedWithProof[0].publicationStatus, 'published');
});

test('Admin investments validate with Zod, match Sarminah seed row, filter, and require reason on status change', () => {
  assert.ok(INITIAL_ADMIN_INVESTMENTS.length >= 5);
  for (const inv of INITIAL_ADMIN_INVESTMENTS) {
    const parsed = AdminInvestmentRecordSchema.safeParse(inv);
    assert.equal(parsed.success, true, `Investment ${inv.id} failed validation`);
  }

  const sarminah = INITIAL_ADMIN_INVESTMENTS.find((i) => i.id === '1304');
  assert.ok(sarminah, 'Seed investment #1304 for Sarminah should exist');
  assert.equal(sarminah.userName, 'Sarminah');
  assert.equal(sarminah.userPhone, '6285202032609');
  assert.equal(sarminah.productName, 'C - 10');
  assert.equal(sarminah.sellingPrice, 250_000);
  assert.equal(sarminah.durationDays, 30);
  assert.equal(sarminah.claimsCompleted, 0);
  assert.equal(sarminah.totalClaims, 30);
  assert.equal(sarminah.incomePerClaim, 35_000);
  assert.equal(sarminah.totalEstimated, 1_050_000);
  assert.equal(sarminah.status, 'Active');
  assert.equal(sarminah.startDate, '2026-11-14 22:33');
  assert.equal(sarminah.endDate, '2026-12-14 22:33');
  assert.equal(sarminah.statusChangeReason, '-');

  const summary = getInvestmentSummary(INITIAL_ADMIN_INVESTMENTS);
  assert.equal(summary.totalCount, INITIAL_ADMIN_INVESTMENTS.length);
  assert.ok(summary.activeCount >= 1);
  assert.ok(summary.inactiveCount >= 1);
  assert.ok(summary.completedCount >= 1);

  const byPhone = filterAdminInvestments(INITIAL_ADMIN_INVESTMENTS, {
    filter: 'semua',
    query: '6285202032609',
  });
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].id, '1304');

  const activeOnly = filterAdminInvestments(INITIAL_ADMIN_INVESTMENTS, {
    filter: 'Active',
    query: '',
  });
  assert.equal(
    activeOnly.every((item) => item.status === 'Active'),
    true
  );

  // Empty reason must fail validation
  const emptyReasonAttempt = changeInvestmentStatus(INITIAL_ADMIN_INVESTMENTS, '1304', {
    nextStatus: 'Nonaktif',
    reason: '   ',
  });
  assert.ok(emptyReasonAttempt.error);
  assert.equal(
    emptyReasonAttempt.records.find((i) => i.id === '1304')?.status,
    'Active'
  );

  // Valid deactivation updates status, reason, and history
  const deactivated = changeInvestmentStatus(INITIAL_ADMIN_INVESTMENTS, '1304', {
    nextStatus: 'Nonaktif',
    reason: 'Verifikasi manual transaksi user',
    actor: 'Alfaciro Admin',
    changedAt: '2026-11-14 23:00',
  });
  assert.equal(deactivated.error, null);
  const updatedRow = deactivated.records.find((i) => i.id === '1304')!;
  assert.equal(updatedRow.status, 'Nonaktif');
  assert.equal(updatedRow.statusChangeReason, 'Verifikasi manual transaksi user');
  assert.equal(updatedRow.statusHistory.length, 1);
  assert.equal(updatedRow.statusHistory[0].toStatus, 'Nonaktif');

  // Reactivating updates status back to Active
  const reactivated = changeInvestmentStatus(deactivated.records, '1304', {
    nextStatus: 'Active',
    reason: 'Verifikasi selesai, kontrak dilanjutkan',
    actor: 'Alfaciro Admin',
    changedAt: '2026-11-14 23:10',
  });
  assert.equal(reactivated.error, null);
  const restoredRow = reactivated.records.find((i) => i.id === '1304')!;
  assert.equal(restoredRow.status, 'Active');
  assert.equal(restoredRow.statusChangeReason, 'Verifikasi selesai, kontrak dilanjutkan');
  assert.equal(restoredRow.statusHistory.length, 2);
});

test('Product categories validate with Zod, summarize linked products, filter, and support add/edit/delete', () => {
  assert.equal(INITIAL_PRODUCT_CATEGORIES.length, 6);
  for (const cat of INITIAL_PRODUCT_CATEGORIES) {
    const parsed = ProductCategorySchema.safeParse(cat);
    assert.equal(parsed.success, true, `Category ${cat.id} failed validation`);
  }

  const summary = getCategorySummary(INITIAL_PRODUCT_CATEGORIES, INVESTMENT_PRODUCTS);
  assert.equal(summary.totalCount, 6);
  assert.equal(summary.activeCount, 5);
  assert.equal(summary.inactiveCount, 1);
  assert.equal(summary.linkedProductsCount, 6);

  assert.equal(slugifyCategoryName('  Energi Terbarukan & Hijau! '), 'energi-terbarukan-hijau');
  assert.equal(getNextCategoryId(INITIAL_PRODUCT_CATEGORIES), 'CAT-07');
  assert.equal(countProductsByCategory(INVESTMENT_PRODUCTS, 'Infrastruktur Hijau'), 1);

  const activeOnly = filterProductCategories(INITIAL_PRODUCT_CATEGORIES, {
    statusFilter: 'aktif',
    query: '',
  });
  assert.equal(activeOnly.length, 5);

  const searchMatches = filterProductCategories(INITIAL_PRODUCT_CATEGORIES, {
    statusFilter: 'semua',
    query: 'rantai-pasok',
  });
  assert.equal(searchMatches.length, 1);
  assert.equal(searchMatches[0].id, 'CAT-02');

  // Empty name and case-insensitive duplicates must be rejected
  const emptyAttempt = addProductCategory(INITIAL_PRODUCT_CATEGORIES, {
    name: '   ',
  });
  assert.ok(emptyAttempt.error);
  assert.equal(emptyAttempt.categories.length, 6);

  const duplicateAttempt = addProductCategory(INITIAL_PRODUCT_CATEGORIES, {
    name: 'infrastruktur hijau',
  });
  assert.ok(duplicateAttempt.error);
  assert.equal(duplicateAttempt.categories.length, 6);

  // Valid create generates CAT-07 and auto-slug
  const created = addProductCategory(INITIAL_PRODUCT_CATEGORIES, {
    name: 'Energi Terbarukan',
    description: 'Pembangkit listrik tenaga angin dan mikrohidro.',
    status: 'aktif',
    createdAt: '2026-11-15',
  });
  assert.equal(created.error, null);
  assert.equal(created.categories.length, 7);
  assert.equal(created.categories[0].id, 'CAT-07');
  assert.equal(created.categories[0].slug, 'energi-terbarukan');

  // Update rejects duplicate name on another ID
  const duplicateRename = updateProductCategory(created.categories, {
    id: 'CAT-07',
    name: 'Rantai Pasok',
    slug: 'rantai-pasok',
    description: '',
    status: 'aktif',
  });
  assert.ok(duplicateRename.error);

  // Valid edit returns previousName and nextName
  const updated = updateProductCategory(created.categories, {
    id: 'CAT-07',
    name: 'Energi Bersih',
    slug: 'energi-bersih',
    description: 'Portofolio energi bersih terverifikasi.',
    status: 'nonaktif',
  });
  assert.equal(updated.error, null);
  assert.equal(updated.previousName, 'Energi Terbarukan');
  assert.equal(updated.nextName, 'Energi Bersih');
  const editedCat = updated.categories.find((c) => c.id === 'CAT-07')!;
  assert.equal(editedCat.slug, 'energi-bersih');
  assert.equal(editedCat.status, 'nonaktif');

  // Delete removes target and returns deletedCategory
  const deleted = deleteProductCategory(updated.categories, 'CAT-07');
  assert.equal(deleted.deletedCategory?.id, 'CAT-07');
  assert.equal(deleted.categories.length, 6);
  assert.equal(deleted.categories.some((c) => c.id === 'CAT-07'), false);
});

test('Cashback rules validate with Zod, match Investment Growth seed row, filter, and support CRUD', () => {
  assert.ok(INITIAL_CASHBACK_RULES.length >= 1);
  for (const rule of INITIAL_CASHBACK_RULES) {
    const parsed = CashbackRuleSchema.safeParse(rule);
    assert.equal(parsed.success, true, `Cashback ${rule.id} failed validation`);
  }

  const seed = INITIAL_CASHBACK_RULES.find((r) => r.name === 'Investment Growth');
  assert.ok(seed, 'Seed cashback Investment Growth should exist');
  assert.equal(seed.applicableLabel, 'Pembelian produk: V - 50');
  assert.equal(seed.minTransaction, 17_600_000);
  assert.equal(seed.cashbackAmount, 1_600_000);
  assert.equal(seed.status, 'aktif');

  assert.equal(
    formatCashbackApplicableLabel('produk_tertentu', 'V - 50'),
    'Pembelian produk: V - 50'
  );
  assert.equal(
    formatCashbackApplicableLabel('semua_produk', ''),
    'Semua produk investasi'
  );
  assert.equal(
    formatCashbackApplicableLabel('top_up', ''),
    'Top up saldo deposit'
  );
  assert.equal(getNextCashbackId(INITIAL_CASHBACK_RULES), 'CB-04');

  const summary = getCashbackSummary(INITIAL_CASHBACK_RULES);
  assert.equal(summary.totalCount, INITIAL_CASHBACK_RULES.length);
  assert.equal(summary.maxCashbackAmount, 1_600_000);

  const searchV50 = filterCashbackRules(INITIAL_CASHBACK_RULES, {
    statusFilter: 'semua',
    query: 'V - 50',
  });
  assert.equal(searchV50.length, 1);
  assert.equal(searchV50[0].id, 'CB-01');

  // Validation rejects missing name, missing targetProduct, or non-positive cashback
  const missingProduct = addCashbackRule(INITIAL_CASHBACK_RULES, {
    name: 'Promo Baru',
    targetType: 'produk_tertentu',
    targetProduct: '   ',
    minTransaction: 1_000_000,
    cashbackAmount: 100_000,
    status: 'aktif',
  });
  assert.ok(missingProduct.error);

  const zeroCashback = addCashbackRule(INITIAL_CASHBACK_RULES, {
    name: 'Promo Baru',
    targetType: 'semua_produk',
    targetProduct: '',
    minTransaction: 1_000_000,
    cashbackAmount: 0,
    status: 'aktif',
  });
  assert.ok(zeroCashback.error);

  // Valid create
  const created = addCashbackRule(INITIAL_CASHBACK_RULES, {
    name: 'Bonus Akhir Tahun',
    targetType: 'semua_produk',
    targetProduct: '',
    minTransaction: 10_000_000,
    cashbackAmount: 750_000,
    status: 'aktif',
    createdAt: '2026-11-15',
  });
  assert.equal(created.error, null);
  assert.equal(created.rules.length, INITIAL_CASHBACK_RULES.length + 1);
  assert.equal(created.rules[0].id, 'CB-04');
  assert.equal(created.rules[0].applicableLabel, 'Semua produk investasi');

  // Valid edit
  const edited = updateCashbackRule(created.rules, {
    id: 'CB-04',
    name: 'Bonus Akhir Tahun VIP',
    targetType: 'produk_tertentu',
    targetProduct: 'C - 10',
    minTransaction: 12_000_000,
    cashbackAmount: 900_000,
    status: 'nonaktif',
  });
  assert.equal(edited.error, null);
  const editedRow = edited.rules.find((r) => r.id === 'CB-04')!;
  assert.equal(editedRow.name, 'Bonus Akhir Tahun VIP');
  assert.equal(editedRow.applicableLabel, 'Pembelian produk: C - 10');
  assert.equal(editedRow.status, 'nonaktif');

  // Delete
  const afterDelete = deleteCashbackRule(edited.rules, 'CB-04');
  assert.equal(afterDelete.length, INITIAL_CASHBACK_RULES.length);
  assert.equal(afterDelete.some((r) => r.id === 'CB-04'), false);

  // Product dropdown options come directly from catalog products with price & image
  const createOptions = getCashbackProductOptions(INVESTMENT_PRODUCTS);
  assert.equal(createOptions.length, INVESTMENT_PRODUCTS.length);
  assert.equal(createOptions[0].value, INVESTMENT_PRODUCTS[0].name);
  assert.equal(createOptions[0].minCapital, INVESTMENT_PRODUCTS[0].minCapital);
  assert.ok(createOptions[0].imageUrl.length > 0);
  assert.equal(createOptions[0].isCustomLegacy, false);
  assert.equal(
    createOptions.some((o) => o.label.includes('(Nonaktif)')),
    true
  );

  // Editing an existing rule preserves custom/legacy product while listing catalog products
  const editOptions = getCashbackProductOptions(INVESTMENT_PRODUCTS, 'V - 50');
  assert.equal(editOptions[0].value, 'V - 50');
  assert.equal(editOptions[0].isCustomLegacy, true);
  assert.equal(editOptions[0].minCapital, null);
  assert.equal(editOptions.length, INVESTMENT_PRODUCTS.length + 1);

  // Matching product lookup for table rows
  const matched = findProductForCashback(INVESTMENT_PRODUCTS, INITIAL_CASHBACK_RULES[1]);
  assert.equal(matched?.id, 'PRD-01');
  assert.equal(matched?.minCapital, 1_000_000);
  assert.equal(findProductForCashback(INVESTMENT_PRODUCTS, INITIAL_CASHBACK_RULES[0]), null);
});

test('Product commissions validate with Zod, sync with active product commission rates, derive automatic member referral codes/links, and aggregate recipients', () => {
  assert.ok(INITIAL_PRODUCT_COMMISSIONS.length >= 10);
  for (const entry of INITIAL_PRODUCT_COMMISSIONS) {
    const parsed = ProductCommissionEntrySchema.safeParse(entry);
    assert.equal(parsed.success, true, `Commission entry ${entry.id} failed validation`);
  }

  const activeSolar = INVESTMENT_PRODUCTS.find((p) => p.id === 'PRD-01')!;
  const inactiveHydro = INVESTMENT_PRODUCTS.find((p) => p.id === 'PRD-06')!;
  assert.equal(isProductCommissionActive(activeSolar), true);
  assert.equal(isProductCommissionActive(inactiveHydro), false);
  assert.equal(
    isProductCommissionActive({ ...activeSolar, commissionRate: 0 }),
    false
  );

  // Percent vs IDR commission calculations
  assert.equal(calculateProductCommissionAmount(activeSolar, 1), 50_000);
  assert.equal(calculateProductCommissionAmount(activeSolar, 3), 150_000);
  assert.equal(
    calculateProductCommissionAmount(
      { minCapital: 1_000_000, commissionType: 'idr', commissionRate: 75_000 },
      2
    ),
    150_000
  );

  // Automatic member referral code & link generation upon registration
  const sampleMember = ADMIN_USER_RECORDS.find((u) => u.id === 'USR-8812')!;
  const autoCode = deriveUserReferralCode(sampleMember);
  assert.equal(autoCode, 'RIZKY2298');
  assert.equal(
    buildReferralRegistrationLink(autoCode),
    'https://finvault.id/daftar?ref=RIZKY2298'
  );

  // Aggregation matches user referral totals and latest commission
  const recipients = aggregateProductCommissionRecipients(
    INITIAL_PRODUCT_COMMISSIONS,
    INVESTMENT_PRODUCTS
  );
  const adi = recipients.find((r) => r.recipientUserId === 'USR-8791')!;
  const rizky = recipients.find((r) => r.recipientUserId === 'USR-8812')!;
  const siti = recipients.find((r) => r.recipientUserId === 'USR-8804')!;
  const tania = recipients.find((r) => r.recipientUserId === 'USR-8398')!;

  assert.equal(adi.totalReceived, 620_000);
  assert.equal(adi.commissionCount, 4);
  assert.equal(adi.latestCommission.id, 'KOM-014');

  assert.equal(rizky.totalReceived, 425_000);
  assert.equal(rizky.commissionCount, 3);
  assert.equal(rizky.latestCommission.id, 'KOM-013');

  assert.equal(siti.totalReceived, 150_000);
  assert.equal(tania.totalReceived, 45_000);

  const overview = getProductCommissionOverview(recipients, INVESTMENT_PRODUCTS);
  assert.equal(overview.totalRecipients, recipients.length);
  assert.equal(overview.totalCommissionsCount, INITIAL_PRODUCT_COMMISSIONS.length);
  assert.equal(overview.activeCommissionProductsCount, 5);

  // Syncs live product active status when catalog changes
  const deactivatedSolarCatalog = INVESTMENT_PRODUCTS.map((p) =>
    p.id === 'PRD-01' ? { ...p, status: 'nonaktif' as const } : p
  );
  const syncedOverview = getProductCommissionOverview(
    aggregateProductCommissionRecipients(INITIAL_PRODUCT_COMMISSIONS, deactivatedSolarCatalog),
    deactivatedSolarCatalog
  );
  assert.equal(syncedOverview.activeCommissionProductsCount, 4);

  // Filtering by referral code & product name
  assert.equal(
    filterProductCommissionRecipients(recipients, { query: 'MOANA2302' }).length,
    1
  );
  assert.equal(
    filterProductCommissionRecipients(recipients, { query: 'Pusat Data Regional Batam' }).length,
    4
  );

  // Per-user detail summary for user with product commissions (Rizky Pratama)
  const rizkySummary = getUserProductCommissionSummary(
    sampleMember,
    INITIAL_PRODUCT_COMMISSIONS,
    INVESTMENT_PRODUCTS
  );
  assert.equal(rizkySummary.referralCode, 'RIZKY2298');
  assert.equal(rizkySummary.referralLink, 'https://finvault.id/daftar?ref=RIZKY2298');
  assert.equal(rizkySummary.commissionCount, 3);
  assert.equal(rizkySummary.totalReceived, 425_000);
  assert.equal(rizkySummary.latestCommission?.id, 'KOM-013');
  assert.equal(rizkySummary.entries.every((e) => e.isProductCommissionCurrentlyActive), true);

  // Per-user detail summary for user with 0 product commissions (Risma)
  const rismaUser = ADMIN_USER_RECORDS.find((u) => u.id === 'USR-2303')!;
  const rismaSummary = getUserProductCommissionSummary(
    rismaUser,
    INITIAL_PRODUCT_COMMISSIONS,
    INVESTMENT_PRODUCTS
  );
  assert.equal(rismaSummary.referralCode, 'RISMA2303');
  assert.equal(rismaSummary.referralLink, 'https://finvault.id/daftar?ref=RISMA2303');
  assert.equal(rismaSummary.commissionCount, 0);
  assert.equal(rismaSummary.totalReceived, 0);
  assert.equal(rismaSummary.latestCommission, null);
});

test('Admin user creation validates required fields, prevents duplicate email/phone, normalizes phone, and derives referral code', () => {
  const missingName = createAdminUser(ADMIN_USER_RECORDS, {
    name: '   ',
    email: 'baru@mail.id',
    phone: '081234567890',
  });
  assert.ok(missingName.error);
  assert.equal(missingName.createdUser, null);

  const duplicateEmail = createAdminUser(ADMIN_USER_RECORDS, {
    name: 'Duplikat Email',
    email: 'RIZKY.PRATAMA@MAIL.ID',
    phone: '081299988877',
  });
  assert.ok(duplicateEmail.error);
  assert.equal(duplicateEmail.createdUser, null);

  const duplicatePhone = createAdminUser(ADMIN_USER_RECORDS, {
    name: 'Duplikat Phone',
    email: 'unik@mail.id',
    phone: '+6281284912201',
  });
  assert.ok(duplicatePhone.error);
  assert.equal(duplicatePhone.createdUser, null);

  const invalidPhone = createAdminUser(ADMIN_USER_RECORDS, {
    name: 'Nomor Pendek',
    email: 'unik@mail.id',
    phone: '08123',
  });
  assert.ok(invalidPhone.error);

  const created = createAdminUser(ADMIN_USER_RECORDS, {
    name: 'Hendra Kusuma',
    email: 'hendra.kusuma@mail.id',
    phone: '081299988877',
    depositBalance: 500_000,
    invitedBy: '#2298 rizky',
    emailVerified: true,
    accountStatus: 'aktif',
    actor: 'Alfaciro Admin',
    now: new Date(2026, 10, 15, 9, 30),
  });
  assert.equal(created.error, null);
  assert.ok(created.createdUser);
  assert.equal(created.users.length, ADMIN_USER_RECORDS.length + 1);
  assert.equal(created.createdUser.id, 'USR-2304');
  assert.equal(created.createdUser.userNumber, 2304);
  assert.equal(created.createdUser.phone, '0812-9998-8877');
  assert.equal(created.createdUser.whatsappRaw, '6281299988877');
  assert.equal(created.createdUser.depositBalance, 500_000);
  assert.equal(created.createdUser.transactions.length, 1);
  assert.equal(deriveUserReferralCode(created.createdUser), 'HENDRA2304');
});

test('User levels validate Levels 1-8, lock Level 1 to 0, enforce monotonic dual thresholds, and evaluate user progression', () => {
  assert.equal(DEFAULT_USER_LEVEL_RULES.length, 8);
  for (const rule of DEFAULT_USER_LEVEL_RULES) {
    const parsed = UserLevelRuleSchema.safeParse(rule);
    assert.equal(parsed.success, true, `Level ${rule.level} failed validation`);
  }

  // Exact defaults from prompt
  assert.equal(DEFAULT_USER_LEVEL_RULES[0].minActiveReferrals, 0);
  assert.equal(DEFAULT_USER_LEVEL_RULES[0].minTotalPurchase, 0);
  assert.equal(DEFAULT_USER_LEVEL_RULES[1].minActiveReferrals, 5);
  assert.equal(DEFAULT_USER_LEVEL_RULES[1].minTotalPurchase, 5_000_000);
  assert.equal(DEFAULT_USER_LEVEL_RULES[2].minActiveReferrals, 15);
  assert.equal(DEFAULT_USER_LEVEL_RULES[2].minTotalPurchase, 25_000_000);
  assert.equal(DEFAULT_USER_LEVEL_RULES[3].minActiveReferrals, 50);
  assert.equal(DEFAULT_USER_LEVEL_RULES[3].minTotalPurchase, 50_000_000);
  assert.equal(DEFAULT_USER_LEVEL_RULES[4].minActiveReferrals, 150);
  assert.equal(DEFAULT_USER_LEVEL_RULES[4].minTotalPurchase, 100_000_000);
  assert.equal(DEFAULT_USER_LEVEL_RULES[5].minActiveReferrals, 250);
  assert.equal(DEFAULT_USER_LEVEL_RULES[5].minTotalPurchase, 250_000_000);
  assert.equal(DEFAULT_USER_LEVEL_RULES[6].minActiveReferrals, 500);
  assert.equal(DEFAULT_USER_LEVEL_RULES[6].minTotalPurchase, 700_000_000);
  assert.equal(DEFAULT_USER_LEVEL_RULES[7].minActiveReferrals, 1000);
  assert.equal(DEFAULT_USER_LEVEL_RULES[7].minTotalPurchase, 5_000_000_000);

  // Dual condition: 10 referrals but only 1M purchase -> stays Level 1
  const onlyReferralsMet = evaluateUserLevel(10, 1_000_000, DEFAULT_USER_LEVEL_RULES);
  assert.equal(onlyReferralsMet.currentRule.level, 1);
  assert.equal(onlyReferralsMet.nextRule?.level, 2);
  assert.equal(onlyReferralsMet.missingReferrals, 0);
  assert.equal(onlyReferralsMet.missingPurchase, 4_000_000);

  // Dual condition: 20M purchase but only 3 referrals -> stays Level 1
  const onlyPurchaseMet = evaluateUserLevel(3, 20_000_000, DEFAULT_USER_LEVEL_RULES);
  assert.equal(onlyPurchaseMet.currentRule.level, 1);
  assert.equal(onlyPurchaseMet.missingReferrals, 2);

  // Meets Level 3 exactly
  const level3 = evaluateUserLevel(15, 25_000_000, DEFAULT_USER_LEVEL_RULES);
  assert.equal(level3.currentRule.level, 3);
  assert.equal(level3.nextRule?.level, 4);

  // Meets Level 8
  const level8 = evaluateUserLevel(1200, 6_000_000_000, DEFAULT_USER_LEVEL_RULES);
  assert.equal(level8.currentRule.level, 8);
  assert.equal(level8.nextRule, null);

  // Active referral count checks only referrals with investments (status === 'aktif')
  const rizky = ADMIN_USER_RECORDS.find((u) => u.id === 'USR-8812')!;
  assert.equal(countUserActiveReferrals(rizky), 2);

  // Validation rejects non-monotonic decrease (Level 3 < Level 2)
  const invalidDecrease = cloneDefaultUserLevelRules();
  invalidDecrease[2].minActiveReferrals = 2;
  const decreasedResult = validateAndSaveUserLevels(invalidDecrease);
  assert.ok(decreasedResult.error);

  // Validation keeps Level 1 locked at 0/0 even if passed dirty values
  const dirtyLevel1 = cloneDefaultUserLevelRules();
  dirtyLevel1[0].minActiveReferrals = 3;
  dirtyLevel1[0].minTotalPurchase = 999;
  const saved = validateAndSaveUserLevels(dirtyLevel1);
  assert.equal(saved.error, null);
  assert.equal(saved.rules[0].minActiveReferrals, 0);
  assert.equal(saved.rules[0].minTotalPurchase, 0);
});








