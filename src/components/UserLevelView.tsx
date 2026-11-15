import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Award,
  Check,
  Info,
  Lock,
  RotateCcw,
  Save,
} from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import type { AdminUserRecord, UserLevelRule } from '@/src/lib/dashboard-schema';
import {
  cloneDefaultUserLevelRules,
  countUserActiveReferrals,
  evaluateUserLevel,
} from '@/src/lib/user-levels';
import { cn, formatNumber, formatRupiah } from '@/src/lib/utils';

interface UserLevelViewProps {
  rules: UserLevelRule[];
  users: AdminUserRecord[];
  onSaveRules: (nextRules: UserLevelRule[]) => string | null;
}

interface DraftLevelRow {
  level: number;
  label: string;
  isStarterLevel: boolean;
  minActiveReferrals: string;
  minTotalPurchase: string;
}

function toDraftRows(rules: ReadonlyArray<UserLevelRule>): DraftLevelRow[] {
  return [...rules]
    .sort((a, b) => a.level - b.level)
    .map((rule) => ({
      level: rule.level,
      label: rule.label,
      isStarterLevel: rule.isStarterLevel,
      minActiveReferrals: String(rule.minActiveReferrals),
      minTotalPurchase: String(rule.minTotalPurchase),
    }));
}

export function UserLevelView({
  rules,
  users,
  onSaveRules,
}: UserLevelViewProps) {
  const [drafts, setDrafts] = useState<DraftLevelRow[]>(() => toDraftRows(rules));
  const [formError, setFormError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const [simUserId, setSimUserId] = useState<string>(users[1]?.id ?? users[0]?.id ?? 'custom');
  const [simReferralsInput, setSimReferralsInput] = useState<string>(() => {
    const sample = users[1] ?? users[0];
    return sample ? String(countUserActiveReferrals(sample)) : '5';
  });
  const [simPurchaseInput, setSimPurchaseInput] = useState<string>(() => {
    const sample = users[1] ?? users[0];
    return sample ? String(sample.totalInvestmentModal) : '5000000';
  });

  useEffect(() => {
    setDrafts(toDraftRows(rules));
  }, [rules]);

  const hasUnsavedChanges = drafts.some((draft, index) => {
    const saved = rules[index];
    if (!saved) return true;
    return (
      Number(draft.minActiveReferrals) !== saved.minActiveReferrals ||
      Number(draft.minTotalPurchase) !== saved.minTotalPurchase
    );
  });

  const handleFieldChange = (
    level: number,
    field: 'minActiveReferrals' | 'minTotalPurchase',
    value: string
  ) => {
    if (level === 1) return;
    setDrafts((prev) =>
      prev.map((row) => (row.level === level ? { ...row, [field]: value } : row))
    );
    if (formError) setFormError(null);
    if (saveSuccess) setSaveSuccess(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedPayload: UserLevelRule[] = drafts.map((row) => ({
      level: row.level,
      label: row.label,
      isStarterLevel: row.isStarterLevel,
      minActiveReferrals:
        row.level === 1
          ? 0
          : row.minActiveReferrals.trim() === ''
            ? -1
            : Number(row.minActiveReferrals),
      minTotalPurchase:
        row.level === 1
          ? 0
          : row.minTotalPurchase.trim() === ''
            ? -1
            : Number(row.minTotalPurchase),
    }));

    const err = onSaveRules(parsedPayload);
    if (err) {
      setFormError(err);
      setSaveSuccess(null);
      return;
    }

    setFormError(null);
    setSaveSuccess('Pengaturan Level User (Level 1 sampai 8) berhasil disimpan.');
  };

  const handleResetToDefault = () => {
    const defaults = cloneDefaultUserLevelRules();
    setDrafts(toDraftRows(defaults));
    const err = onSaveRules(defaults);
    setFormError(err);
    setSaveSuccess(err ? null : 'Pengaturan dikembalikan ke standar default Level 1–8.');
  };

  const handleSelectSimUser = (userId: string) => {
    setSimUserId(userId);
    if (userId === 'custom') return;
    const found = users.find((u) => u.id === userId);
    if (found) {
      setSimReferralsInput(String(countUserActiveReferrals(found)));
      setSimPurchaseInput(String(found.totalInvestmentModal));
    }
  };

  const simEvaluation = evaluateUserLevel(
    Number(simReferralsInput) || 0,
    Number(simPurchaseInput) || 0,
    rules
  );

  const highestRule = rules[rules.length - 1];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pengaturan Level User
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Atur syarat referral aktif dan total pembelian kumulatif untuk level 1 sampai 8. Level 1 selalu menjadi level awal tanpa syarat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleResetToDefault}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reset Default</span>
          </Button>
          <Button
            type="submit"
            form="user-level-settings-form"
            variant="primary"
            size="sm"
          >
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Simpan Pengaturan</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Jenjang Level Aktif
            </p>
            <p className="mt-2 font-mono-num text-2xl font-bold text-slate-900 dark:text-slate-100">
              Level 1 – {formatNumber(rules.length)}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Level 1 selalu menjadi level awal (0 syarat)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Target Tertinggi (Level 8)
            </p>
            <p className="mt-2 font-mono-num text-xl font-bold text-blue-700 dark:text-blue-400">
              {formatNumber(highestRule?.minActiveReferrals ?? 1000)} referral aktif
            </p>
            <p className="mt-1 font-mono-num text-xs text-slate-500 dark:text-slate-400">
              Min. pembelian {formatRupiah(highestRule?.minTotalPurchase ?? 5_000_000_000)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Mekanisme Kenaikan Level
            </p>
            <p className="mt-2 text-base font-bold text-emerald-700 dark:text-emerald-400">
              Syarat Ganda Kumulatif
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Referral berinvestasi &amp; total investasi user terpenuhi
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Level Configuration Table */}
      <Card>
        <CardHeader className="border-b border-slate-100 py-4 dark:border-slate-800/80">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                <span>Daftar Syarat Level 1 – 8</span>
              </CardTitle>
              <CardDescription className="mt-1">
                Sesuaikan minimum referral aktif dan total pembelian kumulatif untuk setiap jenjang.
              </CardDescription>
            </div>
            {hasUnsavedChanges && (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Ada perubahan belum disimpan
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <form id="user-level-settings-form" onSubmit={handleSubmit} noValidate>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4">Level</TableHead>
                    <TableHead className="px-3">Minimum Referral Aktif</TableHead>
                    <TableHead className="px-4">Minimum Total Pembelian (Rp)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drafts.map((row) => {
                    const numericPurchase = Math.max(0, Number(row.minTotalPurchase) || 0);
                    return (
                      <TableRow key={row.level} data-testid={`level-row-${row.level}`}>
                        <TableCell className="px-4 py-2.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={cn(
                                'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono-num text-xs font-bold',
                                row.isStarterLevel
                                  ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                              )}
                            >
                              {row.level}
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {row.label}
                              </p>
                              {row.isStarterLevel && (
                                <p className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                  <Lock className="h-3 w-3" aria-hidden="true" />
                                  <span>Level awal default (terkunci 0)</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="px-3 py-2.5">
                          <div className="max-w-[200px]">
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              disabled={row.isStarterLevel}
                              value={row.minActiveReferrals}
                              onChange={(e) =>
                                handleFieldChange(
                                  row.level,
                                  'minActiveReferrals',
                                  e.target.value
                                )
                              }
                              aria-label={`Minimum Referral Aktif ${row.label}`}
                              className={cn(
                                'h-9 font-mono-num',
                                row.isStarterLevel && 'bg-slate-100 text-slate-500 dark:bg-slate-900'
                              )}
                            />
                          </div>
                        </TableCell>

                        <TableCell className="px-4 py-2.5">
                          <div className="max-w-[260px]">
                            <Input
                              type="number"
                              min={0}
                              step={100000}
                              disabled={row.isStarterLevel}
                              value={row.minTotalPurchase}
                              onChange={(e) =>
                                handleFieldChange(
                                  row.level,
                                  'minTotalPurchase',
                                  e.target.value
                                )
                              }
                              aria-label={`Minimum Total Pembelian (Rp) ${row.label}`}
                              className={cn(
                                'h-9 font-mono-num',
                                row.isStarterLevel && 'bg-slate-100 text-slate-500 dark:bg-slate-900'
                              )}
                            />
                            <p className="mt-1 font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                              {formatRupiah(numericPurchase)}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="divide-y divide-slate-100 md:hidden dark:divide-slate-800/80">
              {drafts.map((row) => {
                const numericPurchase = Math.max(0, Number(row.minTotalPurchase) || 0);
                return (
                  <div key={row.level} className="space-y-3 p-4">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono-num text-xs font-bold',
                          row.isStarterLevel
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400'
                        )}
                      >
                        {row.level}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {row.label}
                        </p>
                        {row.isStarterLevel && (
                          <p className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                            <Lock className="h-3 w-3" aria-hidden="true" />
                            <span>Level awal default (terkunci 0)</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label
                          htmlFor={`mobile-ref-${row.level}`}
                          className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Minimum Referral Aktif
                        </label>
                        <Input
                          id={`mobile-ref-${row.level}`}
                          type="number"
                          min={0}
                          step={1}
                          disabled={row.isStarterLevel}
                          value={row.minActiveReferrals}
                          onChange={(e) =>
                            handleFieldChange(
                              row.level,
                              'minActiveReferrals',
                              e.target.value
                            )
                          }
                          className={cn(
                            'mt-1 h-9 font-mono-num',
                            row.isStarterLevel && 'bg-slate-100 text-slate-500 dark:bg-slate-900'
                          )}
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`mobile-purchase-${row.level}`}
                          className="block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Minimum Total Pembelian (Rp)
                        </label>
                        <Input
                          id={`mobile-purchase-${row.level}`}
                          type="number"
                          min={0}
                          step={100000}
                          disabled={row.isStarterLevel}
                          value={row.minTotalPurchase}
                          onChange={(e) =>
                            handleFieldChange(
                              row.level,
                              'minTotalPurchase',
                              e.target.value
                            )
                          }
                          className={cn(
                            'mt-1 h-9 font-mono-num',
                            row.isStarterLevel && 'bg-slate-100 text-slate-500 dark:bg-slate-900'
                          )}
                        />
                        <p className="mt-1 font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                          {formatRupiah(numericPurchase)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 border-t border-slate-100 p-5 dark:border-slate-800/80">
              {formError && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{formError}</span>
                </div>
              )}

              {saveSuccess && (
                <div
                  role="status"
                  className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                >
                  <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{saveSuccess}</span>
                </div>
              )}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-xs leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                  <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
                    aria-hidden="true"
                  />
                  <p>
                    Kedua syarat harus terpenuhi untuk mencapai level terkait. Referral aktif dihitung jika user yang diundang sudah memiliki investasi. Total pembelian dihitung dari seluruh investasi user.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 shrink-0">
                  {hasUnsavedChanges && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setDrafts(toDraftRows(rules));
                        setFormError(null);
                        setSaveSuccess(null);
                      }}
                    >
                      Batal
                    </Button>
                  )}
                  <Button type="submit" variant="primary" size="sm">
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Simpan Pengaturan</span>
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Level Evaluation Simulator */}
      <Card>
        <CardHeader className="border-b border-slate-100 dark:border-slate-800/80">
          <CardTitle className="text-base">Simulasi Cek Level User</CardTitle>
          <CardDescription>
            Uji pencapaian level user berdasarkan syarat aktif saat ini (kedua syarat harus terpenuhi).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-4">
              <label
                htmlFor="sim-user-select"
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Pilih Sampel User (atau Input Manual)
              </label>
              <select
                id="sim-user-select"
                value={simUserId}
                onChange={(e) => handleSelectSimUser(e.target.value)}
                className="mt-1.5 flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    #{u.userNumber} · {u.name} ({countUserActiveReferrals(u)} ref aktif)
                  </option>
                ))}
                <option value="custom">Input Angka Simulasi Manual</option>
              </select>
            </div>

            <div className="lg:col-span-2">
              <label
                htmlFor="sim-referrals-input"
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Referral Aktif
              </label>
              <Input
                id="sim-referrals-input"
                type="number"
                min={0}
                value={simReferralsInput}
                onChange={(e) => {
                  setSimUserId('custom');
                  setSimReferralsInput(e.target.value);
                }}
                className="mt-1.5 font-mono-num"
              />
            </div>

            <div className="lg:col-span-3">
              <label
                htmlFor="sim-purchase-input"
                className="block text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                Total Pembelian (Rp)
              </label>
              <Input
                id="sim-purchase-input"
                type="number"
                min={0}
                step={500000}
                value={simPurchaseInput}
                onChange={(e) => {
                  setSimUserId('custom');
                  setSimPurchaseInput(e.target.value);
                }}
                className="mt-1.5 font-mono-num"
              />
            </div>

            <div className="lg:col-span-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Hasil Evaluasi Level
                </p>
                <p
                  className="mt-0.5 font-display text-base font-bold text-blue-700 dark:text-blue-400"
                  data-testid="sim-level-result"
                >
                  {simEvaluation.currentRule.label}
                </p>
                <p className="mt-0.5 font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                  {simEvaluation.nextRule
                    ? `Menuju ${simEvaluation.nextRule.label}: kurang ${formatNumber(
                        simEvaluation.missingReferrals
                      )} ref & ${formatRupiah(simEvaluation.missingPurchase)}`
                    : 'Sudah mencapai level tertinggi'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
