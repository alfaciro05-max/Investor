import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  Award,
  BadgePercent,
  Download,
  FileCheck2,
  FolderKanban,
  HandCoins,
  LayoutDashboard,
  Menu,
  Moon,
  PackageCheck,
  Sun,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { CashbackView } from '@/src/components/CashbackView';
import { CategoryView } from '@/src/components/CategoryView';
import { InvestmentView } from '@/src/components/InvestmentView';
import { AntreanView, DataUserView, ProdukView } from '@/src/components/OperationsViews';
import { ProductCommissionView } from '@/src/components/ProductCommissionView';
import { RingkasanView, type AdminSection } from '@/src/components/RingkasanView';
import { UserDetailView } from '@/src/components/UserDetailView';
import { UserLevelView } from '@/src/components/UserLevelView';
import { WithdrawalPublicationView } from '@/src/components/WithdrawalPublicationView';
import {
  ADMIN_USER_RECORDS,
  DEFAULT_ADMIN_SESSION,
  INITIAL_QUEUE_TRANSACTIONS,
  INVESTMENT_PRODUCTS,
  buildDashboardCsv,
  addInvestmentProduct,
  deleteInvestmentProduct,
  getDashboardSnapshot,
  updateInvestmentProduct,
  updateQueueTransactionStatus,
} from '@/src/lib/dashboard-data';
import type {
  AdminInvestmentRecord,
  AdminInvestmentStatus,
  AdminUserRecord,
  CashbackRule,
  InvestmentProduct,
  ProductCategory,
  QueueTransaction,
  TimeRange,
  UserLevelRule,
  WithdrawalPublication,
} from '@/src/lib/dashboard-schema';
import {
  INITIAL_CASHBACK_RULES,
  addCashbackRule,
  deleteCashbackRule,
  updateCashbackRule,
  type CashbackInputPayload,
} from '@/src/lib/cashbacks';
import {
  INITIAL_PRODUCT_CATEGORIES,
  addProductCategory,
  deleteProductCategory,
  updateProductCategory,
} from '@/src/lib/categories';
import {
  INITIAL_ADMIN_INVESTMENTS,
  changeInvestmentStatus,
} from '@/src/lib/investments';
import {
  INITIAL_WITHDRAWAL_PUBLICATIONS,
  clearWithdrawalProof,
  toggleWithdrawalPublication,
  updateWithdrawalProof,
  upsertWithdrawalPublicationFromQueueTx,
} from '@/src/lib/withdrawal-publications';
import { INITIAL_PRODUCT_COMMISSIONS } from '@/src/lib/product-commissions';
import {
  createAdminUser,
  toggleUserAccountStatus,
  type CreateAdminUserInput,
} from '@/src/lib/user-diagnostics';
import {
  cloneDefaultUserLevelRules,
  validateAndSaveUserLevels,
} from '@/src/lib/user-levels';
import { cn, formatNumber } from '@/src/lib/utils';

const NAV_ITEMS: ReadonlyArray<{
  id: AdminSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'ringkasan', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'antrean', label: 'Antrean Transaksi', icon: ArrowLeftRight },
  { id: 'withdrawal_publication', label: 'Publikasi Withdrawal', icon: FileCheck2 },
  { id: 'investment', label: 'Investment', icon: TrendingUp },
  { id: 'produk', label: 'Produk Investasi', icon: PackageCheck },
  { id: 'category', label: 'Category', icon: FolderKanban },
  { id: 'cashback', label: 'Cashback', icon: BadgePercent },
  { id: 'komisi_produk', label: 'Komisi Produk', icon: HandCoins },
  { id: 'user', label: 'Data User', icon: Users },
  { id: 'level_user', label: 'Level User', icon: Award },
];

export default function App() {
  const [selectedRange, setSelectedRange] = useState<TimeRange>('7d');
  const [activeSection, setActiveSection] = useState<AdminSection>('ringkasan');
  const [queueFilter, setQueueFilter] = useState<'semua' | 'topup' | 'withdrawal'>('semua');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const [transactions, setTransactions] = useState<QueueTransaction[]>(
    INITIAL_QUEUE_TRANSACTIONS
  );
  const [products, setProducts] = useState<InvestmentProduct[]>(INVESTMENT_PRODUCTS);
  const [categories, setCategories] = useState<ProductCategory[]>(
    INITIAL_PRODUCT_CATEGORIES
  );
  const [cashbacks, setCashbacks] = useState<CashbackRule[]>(
    INITIAL_CASHBACK_RULES
  );
  const [users, setUsers] = useState<AdminUserRecord[]>(ADMIN_USER_RECORDS);
  const [withdrawalPublications, setWithdrawalPublications] = useState<WithdrawalPublication[]>(
    INITIAL_WITHDRAWAL_PUBLICATIONS
  );
  const [investments, setInvestments] = useState<AdminInvestmentRecord[]>(
    INITIAL_ADMIN_INVESTMENTS
  );
  const [userLevels, setUserLevels] = useState<UserLevelRule[]>(() =>
    cloneDefaultUserLevelRules()
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pendingDeltas, setPendingDeltas] = useState({
    topUpCount: 0,
    topUpAmount: 0,
    withdrawalCount: 0,
    withdrawalAmount: 0,
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  const snapshot = useMemo(() => {
    const base = getDashboardSnapshot(selectedRange);
    return {
      ...base,
      operational: {
        ...base.operational,
        pendingTopUpCount: Math.max(
          0,
          base.operational.pendingTopUpCount + pendingDeltas.topUpCount
        ),
        pendingTopUpAmount: Math.max(
          0,
          base.operational.pendingTopUpAmount + pendingDeltas.topUpAmount
        ),
        pendingWithdrawalCount: Math.max(
          0,
          base.operational.pendingWithdrawalCount + pendingDeltas.withdrawalCount
        ),
        pendingWithdrawalAmount: Math.max(
          0,
          base.operational.pendingWithdrawalAmount + pendingDeltas.withdrawalAmount
        ),
      },
    };
  }, [selectedRange, pendingDeltas]);

  const totalPendingCount =
    snapshot.operational.pendingTopUpCount +
    snapshot.operational.pendingWithdrawalCount;

  const handleNavigate = (section: AdminSection, subFilter?: string) => {
    if (
      section === 'antrean' &&
      (subFilter === 'topup' || subFilter === 'withdrawal')
    ) {
      setQueueFilter(subFilter);
    } else if (section === 'antrean') {
      setQueueFilter('semua');
    }
    setActiveSection(section);
    setSelectedUserId(null);
    setMobileMenuOpen(false);
  };

  const handleProcessTransaction = (
    txId: string,
    action: 'disetujui' | 'ditolak'
  ) => {
    const result = updateQueueTransactionStatus(transactions, txId, action);
    setTransactions(result.transactions);
    setPendingDeltas((prev) => ({
      topUpCount: prev.topUpCount + result.deltaPendingTopUpCount,
      topUpAmount: prev.topUpAmount + result.deltaPendingTopUpAmount,
      withdrawalCount: prev.withdrawalCount + result.deltaPendingWithdrawalCount,
      withdrawalAmount: prev.withdrawalAmount + result.deltaPendingWithdrawalAmount,
    }));
  };

  const handleAddProduct = (created: InvestmentProduct) => {
    setProducts((prev) => addInvestmentProduct(prev, created));
  };

  const handleUpdateProduct = (updated: InvestmentProduct) => {
    setProducts((prev) => updateInvestmentProduct(prev, updated));
  };

  const handleDeleteProduct = (productId: string) => {
    setProducts((prev) => deleteInvestmentProduct(prev, productId));
  };

  const handleAddCategory = (input: {
    name: string;
    slug: string;
    description: string;
    status: 'aktif' | 'nonaktif';
  }): string | null => {
    const result = addProductCategory(categories, input);
    if (!result.error) {
      setCategories(result.categories);
    }
    return result.error;
  };

  const handleUpdateCategory = (input: {
    id: string;
    name: string;
    slug: string;
    description: string;
    status: 'aktif' | 'nonaktif';
  }): string | null => {
    const result = updateProductCategory(categories, input);
    if (!result.error) {
      setCategories(result.categories);
      if (
        result.previousName &&
        result.nextName &&
        result.previousName !== result.nextName
      ) {
        const prevNormalized = result.previousName.trim().toLowerCase();
        const nextName = result.nextName;
        setProducts((prev) =>
          prev.map((p) =>
            p.category.trim().toLowerCase() === prevNormalized
              ? { ...p, category: nextName }
              : p
          )
        );
      }
    }
    return result.error;
  };

  const handleDeleteCategory = (
    categoryId: string,
    replacementCategoryName: string
  ) => {
    const result = deleteProductCategory(categories, categoryId);
    setCategories(result.categories);
    if (result.deletedCategory) {
      const deletedNormalized = result.deletedCategory.name.trim().toLowerCase();
      setProducts((prev) =>
        prev.map((p) =>
          p.category.trim().toLowerCase() === deletedNormalized
            ? { ...p, category: replacementCategoryName }
            : p
        )
      );
    }
  };

  const handleAddCashback = (input: CashbackInputPayload): string | null => {
    const result = addCashbackRule(cashbacks, input);
    if (!result.error) {
      setCashbacks(result.rules);
    }
    return result.error;
  };

  const handleUpdateCashback = (
    input: CashbackInputPayload & { id: string }
  ): string | null => {
    const result = updateCashbackRule(cashbacks, input);
    if (!result.error) {
      setCashbacks(result.rules);
    }
    return result.error;
  };

  const handleDeleteCashback = (cashbackId: string) => {
    setCashbacks((prev) => deleteCashbackRule(prev, cashbackId));
  };

  const handleToggleUserStatus = (userId: string, reason?: string) => {
    setUsers((prev) =>
      toggleUserAccountStatus(prev, userId, {
        reason,
        actor: DEFAULT_ADMIN_SESSION.name,
      })
    );
  };

  const handleAddUser = (input: CreateAdminUserInput): string | null => {
    const result = createAdminUser(users, {
      ...input,
      actor: DEFAULT_ADMIN_SESSION.name,
    });
    if (!result.error) {
      setUsers(result.users);
    }
    return result.error;
  };

  const handleSaveUserLevels = (nextRules: UserLevelRule[]): string | null => {
    const result = validateAndSaveUserLevels(nextRules);
    if (!result.error) {
      setUserLevels(result.rules);
    }
    return result.error;
  };

  const handleUploadWithdrawalProof = (
    withdrawalId: string,
    proofUrl: string,
    proofFileName: string
  ) => {
    setWithdrawalPublications((prev) =>
      updateWithdrawalProof(prev, withdrawalId, { proofUrl, proofFileName })
    );
  };

  const handleClearWithdrawalProof = (withdrawalId: string) => {
    setWithdrawalPublications((prev) => clearWithdrawalProof(prev, withdrawalId));
  };

  const handleToggleWithdrawalPublication = (withdrawalId: string): string | null => {
    const result = toggleWithdrawalPublication(withdrawalPublications, withdrawalId);
    if (!result.error) {
      setWithdrawalPublications(result.records);
    }
    return result.error;
  };

  const handleChangeInvestmentStatus = (
    investmentId: string,
    nextStatus: Extract<AdminInvestmentStatus, 'Active' | 'Nonaktif'>,
    reason: string
  ): string | null => {
    const result = changeInvestmentStatus(investments, investmentId, {
      nextStatus,
      reason,
      actor: DEFAULT_ADMIN_SESSION.name,
    });
    if (!result.error) {
      setInvestments(result.records);
    }
    return result.error;
  };

  const handleApproveWithdrawalWithProof = (
    txId: string,
    payload: { proofUrl: string; proofFileName: string; publishImmediately: boolean }
  ) => {
    const targetTx = transactions.find((tx) => tx.id === txId);
    handleProcessTransaction(txId, 'disetujui');
    if (targetTx && targetTx.type === 'withdrawal') {
      setWithdrawalPublications((prev) =>
        upsertWithdrawalPublicationFromQueueTx(prev, targetTx, users, payload)
      );
    }
  };

  const handleResetQueue = () => {
    const queueIds = new Set(INITIAL_QUEUE_TRANSACTIONS.map((tx) => tx.id));
    setTransactions(INITIAL_QUEUE_TRANSACTIONS);
    setWithdrawalPublications((prev) => prev.filter((item) => !queueIds.has(item.id)));
    setPendingDeltas({
      topUpCount: 0,
      topUpAmount: 0,
      withdrawalCount: 0,
      withdrawalAmount: 0,
    });
  };

  const handleExportCsv = () => {
    const csv = buildDashboardCsv(snapshot);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `finvault-ringkasan-${selectedRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const activeNavLabel =
    NAV_ITEMS.find((item) => item.id === activeSection)?.label ?? 'Ringkasan';
  const selectedUser =
    activeSection === 'user' && selectedUserId
      ? (users.find((u) => u.id === selectedUserId) ?? null)
      : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        aria-label="Navigasi Admin"
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              handleNavigate('ringkasan');
            }}
            className="font-display text-lg font-bold tracking-normal text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            FinVault Admin
          </a>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden cursor-pointer"
            aria-label="Tutup menu navigasi"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3" aria-label="Menu Utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap',
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                )}
              >
                <span className="inline-flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'antrean' && (
                  <span
                    className={cn(
                      'font-mono-num text-xs',
                      isActive
                        ? 'text-slate-200'
                        : 'text-amber-700 dark:text-amber-400 font-semibold'
                    )}
                  >
                    {formatNumber(totalPendingCount)}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white dark:bg-blue-600"
              aria-hidden="true"
            >
              AA
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                {DEFAULT_ADMIN_SESSION.name}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {DEFAULT_ADMIN_SESSION.role}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        <header
          id="top"
          className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 sm:px-6 lg:px-8"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800 lg:hidden cursor-pointer shrink-0"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>

            <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-500 dark:text-slate-400 whitespace-nowrap">
                Dashboard Admin
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">
                /
              </span>
              <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                {activeNavLabel}
              </span>
              {selectedUser && (
                <>
                  <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
                    /
                  </span>
                  <span className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    Detail User
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label={darkMode ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
            >
              {darkMode ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </Button>

            <Button variant="default" size="sm" onClick={handleExportCsv}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Ekspor CSV</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {activeSection === 'ringkasan' && (
            <RingkasanView
              snapshot={snapshot}
              selectedRange={selectedRange}
              onSelectRange={setSelectedRange}
              onNavigateSection={handleNavigate}
            />
          )}

          {activeSection === 'antrean' && (
            <AntreanView
              key={queueFilter}
              transactions={transactions}
              operational={snapshot.operational}
              initialTypeFilter={queueFilter}
              onProcessTransaction={handleProcessTransaction}
              onApproveWithdrawalWithProof={handleApproveWithdrawalWithProof}
              onOpenWithdrawalPublication={() => handleNavigate('withdrawal_publication')}
              onResetQueue={handleResetQueue}
            />
          )}

          {activeSection === 'withdrawal_publication' && (
            <WithdrawalPublicationView
              records={withdrawalPublications}
              onUploadProof={handleUploadWithdrawalProof}
              onClearProof={handleClearWithdrawalProof}
              onTogglePublication={handleToggleWithdrawalPublication}
              onSelectUser={(userId) => {
                setActiveSection('user');
                setSelectedUserId(userId);
              }}
            />
          )}

          {activeSection === 'investment' && (
            <InvestmentView
              investments={investments}
              onChangeStatus={handleChangeInvestmentStatus}
              onSelectUser={(userId) => {
                setActiveSection('user');
                setSelectedUserId(userId);
              }}
            />
          )}

          {activeSection === 'produk' && (
            <ProdukView
              products={products}
              categories={categories}
              operational={snapshot.operational}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onDeleteProduct={handleDeleteProduct}
            />
          )}

          {activeSection === 'category' && (
            <CategoryView
              categories={categories}
              products={products}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
            />
          )}

          {activeSection === 'cashback' && (
            <CashbackView
              cashbacks={cashbacks}
              products={products}
              onAddCashback={handleAddCashback}
              onUpdateCashback={handleUpdateCashback}
              onDeleteCashback={handleDeleteCashback}
            />
          )}

          {activeSection === 'komisi_produk' && (
            <ProductCommissionView
              entries={INITIAL_PRODUCT_COMMISSIONS}
              products={products}
              onSelectUser={(userId) => {
                setActiveSection('user');
                setSelectedUserId(userId);
              }}
            />
          )}

          {activeSection === 'user' &&
            (selectedUser ? (
              <UserDetailView
                key={selectedUser.id}
                user={selectedUser}
                allUsers={users}
                productCommissions={INITIAL_PRODUCT_COMMISSIONS}
                products={products}
                onBack={() => setSelectedUserId(null)}
                onToggleAccountStatus={handleToggleUserStatus}
              />
            ) : (
              <DataUserView
                users={users}
                snapshot={{
                  ...snapshot,
                  totalUsers:
                    snapshot.totalUsers + Math.max(0, users.length - ADMIN_USER_RECORDS.length),
                  newUsers30d:
                    snapshot.newUsers30d + Math.max(0, users.length - ADMIN_USER_RECORDS.length),
                  activeBreakdown: {
                    ...snapshot.activeBreakdown,
                    notStartedCount:
                      snapshot.activeBreakdown.notStartedCount +
                      Math.max(0, users.length - ADMIN_USER_RECORDS.length),
                  },
                }}
                onSelectUser={setSelectedUserId}
                onAddUser={handleAddUser}
              />
            ))}

          {activeSection === 'level_user' && (
            <UserLevelView
              rules={userLevels}
              users={users}
              onSaveRules={handleSaveUserLevels}
            />
          )}
        </main>
      </div>
    </div>
  );
}
