"use client";

import { useMemo, useState } from "react";

type RiskProfile = "prudent" | "balanced" | "dynamic";

const RISK_PROFILES: Record<
  RiskProfile,
  { label: string; rate: number; description: string }
> = {
  prudent: { label: "Prudent", rate: 0.05, description: "5 % / an" },
  balanced: { label: "Équilibré", rate: 0.07, description: "7 % / an" },
  dynamic: { label: "Dynamique", rate: 0.09, description: "9 % / an" },
};

const FLAT_TAX = 0.3;
const INFLATION = 0.02;
const WITHDRAWAL_RATE = 0.04;
const MAX_SIMULATION_YEARS = 80;
const LOW_SAVINGS_THRESHOLD = 0.1;
const HIGH_SAVINGS_THRESHOLD = 0.25;
const TARGET_SAVINGS_RATE = 0.15;

type OptimizedScenarioType =
  | "target_15_percent"
  | "increase_10_percent"
  | "maintain_strong_rate";

function getOptimizedMonthlyInvestment(
  savingsRate: number,
  monthlyNetIncome: number,
  monthlyInvestment: number,
): { amount: number; type: OptimizedScenarioType } {
  if (savingsRate > HIGH_SAVINGS_THRESHOLD) {
    return { amount: monthlyInvestment, type: "maintain_strong_rate" };
  }

  if (savingsRate < LOW_SAVINGS_THRESHOLD) {
    return {
      amount: monthlyNetIncome * TARGET_SAVINGS_RATE,
      type: "target_15_percent",
    };
  }

  return {
    amount: monthlyInvestment * 1.1,
    type: "increase_10_percent",
  };
}

function getImprovementSuggestion(
  savingsRate: number,
  optimizedMonthlyInvestment: number,
  scenarioType: OptimizedScenarioType,
  baseIndependenceYear: number | null,
  optimizedIndependenceYear: number | null,
  yearsSaved: number | null,
): { summary: string; yearsSavedPhrase: string | null } {
  if (scenarioType === "maintain_strong_rate") {
    return {
      summary: `Félicitations pour votre excellent taux d'épargne (${formatPercent(savingsRate)}). Concentrez-vous sur la régularité de vos investissements et la gestion du risque pour consolider votre trajectoire.`,
      yearsSavedPhrase: null,
    };
  }

  const investmentLine = `Investissement mensuel optimisé : ${formatEuro(optimizedMonthlyInvestment)}.`;

  if (baseIndependenceYear === null && optimizedIndependenceYear === null) {
    return {
      summary: `${investmentLine} Même avec ce scénario, l'objectif reste hors de portée sur l'horizon simulé — un ajustement plus ambitieux serait nécessaire.`,
      yearsSavedPhrase: null,
    };
  }

  if (baseIndependenceYear === null && optimizedIndependenceYear !== null) {
    return {
      summary: `${investmentLine} Vous pourriez atteindre l'indépendance en ${optimizedIndependenceYear}, alors que ce n'est pas le cas avec votre épargne actuelle.`,
      yearsSavedPhrase:
        "Si vous appliquez ce scénario optimisé, vous pourriez atteindre votre objectif là où votre trajectoire actuelle ne le permet pas sur l'horizon simulé.",
    };
  }

  if (yearsSaved !== null && yearsSaved > 0 && optimizedIndependenceYear !== null) {
    return {
      summary: `${investmentLine} Vous pourriez atteindre l'indépendance en ${optimizedIndependenceYear} au lieu de ${baseIndependenceYear}.`,
      yearsSavedPhrase: `Si vous appliquez ce scénario optimisé, vous pourriez atteindre votre objectif environ ${yearsSaved} année${yearsSaved > 1 ? "s" : ""} plus tôt.`,
    };
  }

  return {
    summary: `${investmentLine} L'impact sur votre horizon reste limité avec les paramètres actuels.`,
    yearsSavedPhrase: null,
  };
}

type FormState = {
  currentAge: number;
  currentNetWorth: number;
  monthlyNetIncome: number;
  monthlyExpenses: number;
  monthlyInvestment: number;
  desiredPassiveIncome: number;
  riskProfile: RiskProfile;
};

type FormFields = {
  currentAge: string;
  currentNetWorth: string;
  monthlyNetIncome: string;
  monthlyExpenses: string;
  monthlyInvestment: string;
  desiredPassiveIncome: string;
  riskProfile: RiskProfile;
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

const FIELD_LABELS: Record<keyof FormFields, string> = {
  currentAge: "Âge actuel",
  currentNetWorth: "Patrimoine net actuel",
  monthlyNetIncome: "Revenu net mensuel",
  monthlyExpenses: "Dépenses mensuelles",
  monthlyInvestment: "Investissement mensuel",
  desiredPassiveIncome: "Revenu passif mensuel souhaité",
  riskProfile: "Profil de risque",
};

const NUMERIC_FIELDS: (keyof FormFields)[] = [
  "currentAge",
  "currentNetWorth",
  "monthlyNetIncome",
  "monthlyExpenses",
  "monthlyInvestment",
  "desiredPassiveIncome",
];

const DEFAULT_FORM: FormFields = {
  currentAge: "",
  currentNetWorth: "",
  monthlyNetIncome: "",
  monthlyExpenses: "",
  monthlyInvestment: "",
  desiredPassiveIncome: "",
  riskProfile: "balanced",
};

const FIELD_PLACEHOLDERS: Record<
  Exclude<keyof FormFields, "riskProfile">,
  string
> = {
  currentAge: "Ex : 24",
  currentNetWorth: "Ex : 35 000 €",
  monthlyNetIncome: "Ex : 5 000 €",
  monthlyExpenses: "Ex : 2 500 €",
  monthlyInvestment: "Ex : 2 000 €",
  desiredPassiveIncome: "Ex : 3 000 €",
};

function normalizeNumericInput(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") return "";
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (digitsOnly === "") return "";
  return String(Number.parseInt(digitsOnly, 10));
}

function validateForm(fields: FormFields): {
  errors: FieldErrors;
  parsed: FormState | null;
} {
  const errors: FieldErrors = {};

  for (const key of NUMERIC_FIELDS) {
    const value = fields[key].trim();
    if (value === "") {
      errors[key] = `${FIELD_LABELS[key]} est obligatoire.`;
      continue;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors[key] = `${FIELD_LABELS[key]} doit être un nombre valide.`;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, parsed: null };
  }

  return {
    errors: {},
    parsed: {
      currentAge: Number(fields.currentAge),
      currentNetWorth: Number(fields.currentNetWorth),
      monthlyNetIncome: Number(fields.monthlyNetIncome),
      monthlyExpenses: Number(fields.monthlyExpenses),
      monthlyInvestment: Number(fields.monthlyInvestment),
      desiredPassiveIncome: Number(fields.desiredPassiveIncome),
      riskProfile: fields.riskProfile,
    },
  };
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

function simulateIndependenceYear(
  initialNetWorth: number,
  monthlyInvestment: number,
  annualReturn: number,
  baseTargetCapital: number,
  startYear: number,
): { independenceYear: number | null; projectedNetCapital: number } {
  const mRate = monthlyRate(annualReturn);
  let grossCapital = initialNetWorth;
  let totalContributions = 0;

  for (let year = 0; year <= MAX_SIMULATION_YEARS; year++) {
    for (let month = 0; month < 12; month++) {
      grossCapital = grossCapital * (1 + mRate) + monthlyInvestment;
      totalContributions += monthlyInvestment;
    }

    const costBasis = initialNetWorth + totalContributions;
    const gains = Math.max(0, grossCapital - costBasis);
    const netCapital = grossCapital - gains * FLAT_TAX;
    const inflatedTarget = baseTargetCapital * Math.pow(1 + INFLATION, year);

    if (netCapital >= inflatedTarget) {
      return {
        independenceYear: startYear + year,
        projectedNetCapital: netCapital,
      };
    }
  }

  return { independenceYear: null, projectedNetCapital: grossCapital };
}

function getDiagnosis(
  savingsRate: number,
  yearsRemaining: number | null,
  independenceYear: number | null,
): string {
  if (independenceYear === null) {
    return "Avec vos paramètres actuels, l'objectif semble hors de portée sur l'horizon simulé. Envisagez d'augmenter votre épargne, d'allonger votre horizon ou d'ajuster votre revenu passif cible.";
  }

  if (yearsRemaining !== null && yearsRemaining <= 0) {
    return "Félicitations — votre patrimoine net projeté couvre déjà votre objectif d'indépendance financière, compte tenu de l'inflation et de la fiscalité sur les plus-values.";
  }

  if (savingsRate < LOW_SAVINGS_THRESHOLD) {
    return "Votre taux d'épargne est faible. À ce rythme, votre horizon d'indépendance financière reste lointain. Une augmentation progressive de votre capacité d'investissement pourrait réduire significativement ce délai.";
  }

  if (savingsRate <= HIGH_SAVINGS_THRESHOLD) {
    return "Vous construisez votre patrimoine à un rythme cohérent. Une légère augmentation de votre investissement mensuel pourrait avoir un impact important sur votre date d'indépendance.";
  }

  return "Excellent taux d'épargne. Vous investissez déjà davantage que la majorité des particuliers. Les intérêts composés devraient accélérer fortement votre progression au fil des années.";
}

function computeResults(form: FormState, currentYear: number) {
  const annualReturn = RISK_PROFILES[form.riskProfile].rate;
  const savingsRate =
    form.monthlyNetIncome > 0
      ? form.monthlyInvestment / form.monthlyNetIncome
      : 0;
  const targetCapital = (form.desiredPassiveIncome * 12) / WITHDRAWAL_RATE;

  const { amount: optimizedMonthlyInvestment, type: scenarioType } =
    getOptimizedMonthlyInvestment(
      savingsRate,
      form.monthlyNetIncome,
      form.monthlyInvestment,
    );

  const base = simulateIndependenceYear(
    form.currentNetWorth,
    form.monthlyInvestment,
    annualReturn,
    targetCapital,
    currentYear,
  );

  const optimized =
    scenarioType === "maintain_strong_rate"
      ? base
      : simulateIndependenceYear(
          form.currentNetWorth,
          optimizedMonthlyInvestment,
          annualReturn,
          targetCapital,
          currentYear,
        );

  const yearsRemaining =
    base.independenceYear !== null
      ? base.independenceYear - currentYear
      : null;

  const optimizedYearsRemaining =
    optimized.independenceYear !== null
      ? optimized.independenceYear - currentYear
      : null;

  const yearsSaved =
    scenarioType === "maintain_strong_rate"
      ? null
      : yearsRemaining !== null && optimizedYearsRemaining !== null
        ? yearsRemaining - optimizedYearsRemaining
        : null;

  const diagnosis = getDiagnosis(
    savingsRate,
    yearsRemaining,
    base.independenceYear,
  );

  const improvement = getImprovementSuggestion(
    savingsRate,
    optimizedMonthlyInvestment,
    scenarioType,
    base.independenceYear,
    optimized.independenceYear,
    yearsSaved,
  );

  return {
    savingsRate,
    targetCapital,
    independenceYear: base.independenceYear,
    yearsRemaining,
    diagnosis,
    improvementSummary: improvement.summary,
    improvementYearsSavedPhrase: improvement.yearsSavedPhrase,
    optimizedMonthlyInvestment,
    optimizedIndependenceYear: optimized.independenceYear,
    yearsSaved,
    scenarioType,
    currentAge: form.currentAge,
  };
}

function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  inputMode = "numeric",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <label htmlFor={id} className="block space-y-2">
      <span className="text-sm font-medium text-zinc-300">{label}</span>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(normalizeNumericInput(e.target.value))}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-xl border bg-zinc-900/80 px-4 py-3 text-zinc-50 placeholder:text-zinc-600 outline-none transition focus:ring-2 ${
          error
            ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20"
            : "border-zinc-700/80 focus:border-emerald-500/60 focus:ring-emerald-500/20"
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-400">
          {error}
        </p>
      )}
    </label>
  );
}

function ResultCard({
  label,
  value,
  highlight,
  note,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  note?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        highlight
          ? "border-emerald-500/30 bg-emerald-500/10"
          : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-semibold tracking-tight ${
          highlight ? "text-emerald-400" : "text-zinc-50"
        }`}
      >
        {value}
      </p>
      {note && (
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">{note}</p>
      )}
    </div>
  );
}

export default function Home() {
  const [form, setForm] = useState<FormFields>(DEFAULT_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedForm, setSubmittedForm] = useState<FormState | null>(null);
  const currentYear = new Date().getFullYear();

  const update = <K extends keyof FormFields>(
    key: K,
    value: FormFields[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSubmittedForm(null);
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setFormError(null);
  };

  const handleCalculate = () => {
    const { errors, parsed } = validateForm(form);
    setFieldErrors(errors);

    if (!parsed) {
      setSubmittedForm(null);
      setFormError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    setFormError(null);
    setSubmittedForm(parsed);
  };

  const results = useMemo(() => {
    if (!submittedForm) return null;
    return computeResults(submittedForm, currentYear);
  }, [submittedForm, currentYear]);

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <header className="mb-10 max-w-2xl">
          <p className="mb-3 inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            Indépendance financière
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Calculateur de liberté financière
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Simulation éducative basée sur des hypothèses de rendement et de
            fiscalité. Les résultats sont indicatifs et ne constituent pas un
            conseil financier.
          </p>
          <p className="mt-4 text-base leading-relaxed text-zinc-400 sm:text-lg">
            Estimez quand votre patrimoine pourrait couvrir un revenu passif
            mensuel, en tenant compte de la fiscalité, de l&apos;inflation et de
            votre profil de risque.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
          <section className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
            <h2 className="mb-6 text-lg font-semibold text-zinc-100">
              Vos paramètres
            </h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <NumberField
                id="currentAge"
                label="Âge actuel"
                value={form.currentAge}
                onChange={(v) => update("currentAge", v)}
                placeholder={FIELD_PLACEHOLDERS.currentAge}
                error={fieldErrors.currentAge}
              />
              <NumberField
                id="currentNetWorth"
                label="Patrimoine net actuel"
                value={form.currentNetWorth}
                onChange={(v) => update("currentNetWorth", v)}
                placeholder={FIELD_PLACEHOLDERS.currentNetWorth}
                error={fieldErrors.currentNetWorth}
              />
              <NumberField
                id="monthlyNetIncome"
                label="Revenu net mensuel"
                value={form.monthlyNetIncome}
                onChange={(v) => update("monthlyNetIncome", v)}
                placeholder={FIELD_PLACEHOLDERS.monthlyNetIncome}
                error={fieldErrors.monthlyNetIncome}
              />
              <NumberField
                id="monthlyExpenses"
                label="Dépenses mensuelles"
                value={form.monthlyExpenses}
                onChange={(v) => update("monthlyExpenses", v)}
                placeholder={FIELD_PLACEHOLDERS.monthlyExpenses}
                error={fieldErrors.monthlyExpenses}
              />
              <NumberField
                id="monthlyInvestment"
                label="Investissement mensuel"
                value={form.monthlyInvestment}
                onChange={(v) => update("monthlyInvestment", v)}
                placeholder={FIELD_PLACEHOLDERS.monthlyInvestment}
                error={fieldErrors.monthlyInvestment}
              />
              <NumberField
                id="desiredPassiveIncome"
                label="Revenu passif mensuel souhaité"
                value={form.desiredPassiveIncome}
                onChange={(v) => update("desiredPassiveIncome", v)}
                placeholder={FIELD_PLACEHOLDERS.desiredPassiveIncome}
                error={fieldErrors.desiredPassiveIncome}
              />
            </div>

            <fieldset className="mt-6 space-y-3">
              <legend className="text-sm font-medium text-zinc-300">
                Profil de risque
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {(Object.keys(RISK_PROFILES) as RiskProfile[]).map((key) => {
                  const profile = RISK_PROFILES[key];
                  const selected = form.riskProfile === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => update("riskProfile", key)}
                      className={`rounded-xl border px-4 py-3 text-left transition ${
                        selected
                          ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                          : "border-zinc-700/80 bg-zinc-900/60 hover:border-zinc-600"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-zinc-100">
                        {profile.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-zinc-500">
                        {profile.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {formError && (
              <p
                role="alert"
                className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
              >
                {formError}
              </p>
            )}

            <button
              type="button"
              onClick={handleCalculate}
              className="mt-6 w-full rounded-xl bg-emerald-500 px-6 py-4 text-base font-semibold text-zinc-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-900"
            >
              Calculer mon indépendance financière
            </button>
          </section>

          <section className="space-y-6">
            {!results ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800/80 bg-zinc-900/20 p-8 text-center sm:min-h-[480px]">
                <p className="max-w-sm text-sm leading-relaxed text-zinc-500">
                  Remplissez le formulaire puis cliquez sur{" "}
                  <span className="font-medium text-zinc-400">
                    Calculer mon indépendance financière
                  </span>{" "}
                  pour afficher vos résultats.
                </p>
              </div>
            ) : (
              <>
            <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
              <h2 className="mb-6 text-lg font-semibold text-zinc-100">
                Résultats
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <ResultCard
                  label="Temps restant avant l'objectif"
                  value={
                    results.yearsRemaining !== null
                      ? `${results.yearsRemaining} an${results.yearsRemaining > 1 ? "s" : ""}`
                      : "Hors horizon"
                  }
                  highlight
                />
                <ResultCard
                  label="Année estimée d'atteinte"
                  value={
                    results.independenceYear !== null
                      ? String(results.independenceYear)
                      : "Hors horizon"
                  }
                />
                <ResultCard
                  label="Âge estimé à l'indépendance"
                  value={
                    results.independenceYear !== null
                      ? `${results.currentAge + (results.independenceYear - currentYear)} ans`
                      : "—"
                  }
                />
                <ResultCard
                  label="Capital cible"
                  value={formatEuro(results.targetCapital)}
                  note="Montant estimé nécessaire pour générer votre revenu passif cible selon la règle des 4 %."
                />
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    Diagnostic
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                    {results.diagnosis}
                  </p>
                </div>

                <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-cyan-400">
                    Scénario optimisé
                  </p>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-zinc-500">
                        Taux d&apos;épargne actuel
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-zinc-100">
                        {formatPercent(results.savingsRate)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">
                        Investissement mensuel optimisé
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-zinc-100">
                        {formatEuro(results.optimizedMonthlyInvestment)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-zinc-500">
                        Années gagnées
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-zinc-100">
                        {results.scenarioType === "maintain_strong_rate"
                          ? "—"
                          : results.yearsSaved !== null && results.yearsSaved > 0
                            ? `${results.yearsSaved} an${results.yearsSaved > 1 ? "s" : ""}`
                            : "0 an"}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-4 text-sm leading-relaxed text-zinc-300">
                    {results.improvementSummary}
                  </p>
                  {results.improvementYearsSavedPhrase && (
                    <p className="mt-3 text-sm font-medium leading-relaxed text-cyan-300">
                      {results.improvementYearsSavedPhrase}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <aside className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Note pédagogique
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Ce simulateur produit un scénario illustratif basé sur des
                hypothèses simplifiées (rendement constant, flat tax à 30 % sur
                les plus-values, inflation à 2 %, règle des 4 %). Il ne
                constitue pas un conseil en investissement ni une recommandation
                personnalisée. Consultez un professionnel agréé pour toute
                décision patrimoniale.
              </p>
            </aside>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
