"use client";

import { useMemo, useRef, useState } from "react";

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
  riskProfile: RiskProfile | "";
};

type FieldErrors = Partial<Record<keyof FormFields, string>>;

const FIELD_LABELS: Record<keyof FormFields, string> = {
  currentAge: "Âge actuel",
  currentNetWorth: "Patrimoine déjà investi ou prêt à investir",
  monthlyNetIncome: "Revenu net mensuel",
  monthlyExpenses: "Dépenses mensuelles",
  monthlyInvestment: "Investissement mensuel",
  desiredPassiveIncome:
    "Combien souhaitez-vous générer chaque mois avec vos placements ?",
  riskProfile: "Profil de risque",
};

const FIELD_EMPTY_ERRORS: Partial<Record<keyof FormFields, string>> = {
  desiredPassiveIncome:
    "Indiquez le montant mensuel que vous souhaitez générer avec vos placements.",
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
  riskProfile: "",
};

const FIELD_PLACEHOLDERS: Record<
  Exclude<keyof FormFields, "riskProfile">,
  string
> = {
  currentAge: "Exemple : 35",
  currentNetWorth: "Exemple : 50000",
  monthlyNetIncome: "Exemple : 2500",
  monthlyExpenses: "Exemple : 1800",
  monthlyInvestment: "Exemple : 500",
  desiredPassiveIncome: "Exemple : 2500",
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
      errors[key] =
        FIELD_EMPTY_ERRORS[key] ?? `${FIELD_LABELS[key]} est obligatoire.`;
      continue;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      errors[key] = `${FIELD_LABELS[key]} doit être un nombre valide.`;
    }
  }

  if (!fields.riskProfile) {
    errors.riskProfile = `${FIELD_LABELS.riskProfile} est obligatoire.`;
  }

  if (Object.keys(errors).length > 0) {
    return { errors, parsed: null };
  }

  const riskProfile = fields.riskProfile as RiskProfile;

  return {
    errors: {},
    parsed: {
      currentAge: Number(fields.currentAge),
      currentNetWorth: Number(fields.currentNetWorth),
      monthlyNetIncome: Number(fields.monthlyNetIncome),
      monthlyExpenses: Number(fields.monthlyExpenses),
      monthlyInvestment: Number(fields.monthlyInvestment),
      desiredPassiveIncome: Number(fields.desiredPassiveIncome),
      riskProfile,
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

type ProjectionPoint = { year: number; netCapital: number };

function simulateWealthTrajectory(
  initialNetWorth: number,
  monthlyInvestment: number,
  annualReturn: number,
  targetCapital: number,
  startYear: number,
): {
  independenceYear: number | null;
  independenceNetCapital: number | null;
  projection: ProjectionPoint[];
} {
  const mRate = monthlyRate(annualReturn);
  let grossCapital = initialNetWorth;
  let totalContributions = 0;
  const projection: ProjectionPoint[] = [
    { year: startYear, netCapital: initialNetWorth },
  ];

  if (initialNetWorth >= targetCapital) {
    return {
      independenceYear: startYear,
      independenceNetCapital: initialNetWorth,
      projection,
    };
  }

  for (let year = 0; year <= MAX_SIMULATION_YEARS; year++) {
    for (let month = 0; month < 12; month++) {
      grossCapital = grossCapital * (1 + mRate) + monthlyInvestment;
      totalContributions += monthlyInvestment;
    }

    const costBasis = initialNetWorth + totalContributions;
    const gains = Math.max(0, grossCapital - costBasis);
    const netCapital = grossCapital - gains * FLAT_TAX;
    const calendarYear = startYear + year;

    if (netCapital >= targetCapital) {
      if (projection[projection.length - 1].year === calendarYear) {
        projection[projection.length - 1] = { year: calendarYear, netCapital };
      } else {
        projection.push({ year: calendarYear, netCapital });
      }
      return {
        independenceYear: calendarYear,
        independenceNetCapital: netCapital,
        projection,
      };
    }

    if (calendarYear === startYear) {
      projection[0] = { year: calendarYear, netCapital };
    } else {
      projection.push({ year: calendarYear, netCapital });
    }
  }

  return {
    independenceYear: null,
    independenceNetCapital: null,
    projection,
  };
}

function formatCompactEuro(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M€`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString("fr-FR")} k€`;
  }
  return formatEuro(value);
}

function WealthProjectionChart({
  currentSeries,
  optimizedSeries,
  showOptimized,
  targetCapital,
  singleCurveMessage,
}: {
  currentSeries: ProjectionPoint[];
  optimizedSeries: ProjectionPoint[] | null;
  showOptimized: boolean;
  targetCapital: number;
  singleCurveMessage?: string;
}) {
  const width = 800;
  const height = 340;
  const padding = { top: 28, right: 28, bottom: 52, left: 76 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const allSeries = showOptimized && optimizedSeries
    ? [...currentSeries, ...optimizedSeries]
    : currentSeries;

  const minYear = currentSeries[0]?.year ?? 0;
  const maxYear = Math.max(
    currentSeries[currentSeries.length - 1]?.year ?? minYear,
    optimizedSeries?.[optimizedSeries.length - 1]?.year ?? minYear,
  );
  const yearSpan = Math.max(maxYear - minYear, 1);
  const maxCapital =
    Math.max(...allSeries.map((p) => p.netCapital), targetCapital, 1) * 1.08;

  const xScale = (year: number) =>
    padding.left + ((year - minYear) / yearSpan) * plotWidth;
  const yScale = (capital: number) =>
    padding.top + plotHeight - (capital / maxCapital) * plotHeight;

  const toPath = (series: ProjectionPoint[]) =>
    series
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"} ${xScale(point.year).toFixed(2)} ${yScale(point.netCapital).toFixed(2)}`,
      )
      .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => ({
    value: maxCapital * ratio,
    y: yScale(maxCapital * ratio),
  }));

  const xTickYears = Array.from(
    new Set([
      minYear,
      minYear + Math.round(yearSpan / 2),
      maxYear,
    ]),
  ).sort((a, b) => a - b);

  const currentGoal = currentSeries[currentSeries.length - 1];
  const optimizedGoal = optimizedSeries?.[optimizedSeries.length - 1];

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-zinc-400">
        <div className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded-full bg-emerald-400" />
          Scénario actuel
        </div>
        {showOptimized && optimizedSeries && (
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-6 rounded-full border-t-2 border-dashed border-cyan-400" />
            Scénario optimisé
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-zinc-800/80 bg-zinc-950/60 p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full min-w-[280px]"
          role="img"
          aria-label="Projection du patrimoine net année par année"
        >
          {yTicks.map((tick) => (
            <g key={tick.value}>
              <line
                x1={padding.left}
                y1={tick.y}
                x2={width - padding.right}
                y2={tick.y}
                stroke="currentColor"
                className="text-zinc-800"
                strokeDasharray={tick.value === 0 ? undefined : "4 6"}
              />
              <text
                x={padding.left - 10}
                y={tick.y + 4}
                textAnchor="end"
                className="fill-zinc-500 text-[11px]"
              >
                {formatCompactEuro(tick.value)}
              </text>
            </g>
          ))}

          <line
            x1={padding.left}
            y1={yScale(targetCapital)}
            x2={width - padding.right}
            y2={yScale(targetCapital)}
            stroke="#52525b"
            strokeDasharray="5 5"
            strokeWidth={1}
          />

          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={width - padding.right}
            y2={padding.top + plotHeight}
            stroke="currentColor"
            className="text-zinc-700"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + plotHeight}
            stroke="currentColor"
            className="text-zinc-700"
          />

          {xTickYears.map((year) => (
            <text
              key={year}
              x={xScale(year)}
              y={height - 18}
              textAnchor="middle"
              className="fill-zinc-500 text-[11px]"
            >
              {year}
            </text>
          ))}

          <text
            x={width / 2}
            y={height - 4}
            textAnchor="middle"
            className="fill-zinc-500 text-[11px]"
          >
            Années
          </text>

          <path
            d={toPath(currentSeries)}
            fill="none"
            stroke="#34d399"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {showOptimized && optimizedSeries && (
            <path
              d={toPath(optimizedSeries)}
              fill="none"
              stroke="#22d3ee"
              strokeWidth={2.5}
              strokeDasharray="8 5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {currentGoal && (
            <g>
              <circle
                cx={xScale(currentGoal.year)}
                cy={yScale(currentGoal.netCapital)}
                r={6}
                fill="#34d399"
                stroke="#09090b"
                strokeWidth={2}
              />
              <text
                x={xScale(currentGoal.year)}
                y={yScale(currentGoal.netCapital) - 12}
                textAnchor="middle"
                className="fill-emerald-400 text-[10px] font-medium"
              >
                Objectif
              </text>
            </g>
          )}

          {showOptimized && optimizedGoal && (
            <g>
              <circle
                cx={xScale(optimizedGoal.year)}
                cy={yScale(optimizedGoal.netCapital)}
                r={6}
                fill="#22d3ee"
                stroke="#09090b"
                strokeWidth={2}
              />
              {optimizedGoal.year !== currentGoal?.year && (
                <text
                  x={xScale(optimizedGoal.year)}
                  y={yScale(optimizedGoal.netCapital) - 12}
                  textAnchor="middle"
                  className="fill-cyan-400 text-[10px] font-medium"
                >
                  Objectif
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      {singleCurveMessage && (
        <p className="mt-3 text-sm leading-relaxed text-zinc-500">
          {singleCurveMessage}
        </p>
      )}
    </div>
  );
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
    return "Félicitations — votre patrimoine net projeté couvre déjà votre capital cible, compte tenu de la fiscalité sur les plus-values.";
  }

  if (savingsRate < LOW_SAVINGS_THRESHOLD) {
    return "Votre effort d'investissement est trop faible par rapport à vos revenus. Avec moins de 10 % de votre revenu net investi chaque mois, votre horizon d'indépendance reste très lointain.";
  }

  if (savingsRate <= HIGH_SAVINGS_THRESHOLD) {
    return "Votre trajectoire est correcte, mais perfectible. Investir un peu plus chaque mois pourrait avancer sensiblement votre date d'indépendance.";
  }

  return "Votre taux d'épargne est très solide. Vous êtes déjà dans une dynamique favorable — maintenez la régularité pour laisser les intérêts composés faire leur effet.";
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

  const baseSim = simulateWealthTrajectory(
    form.currentNetWorth,
    form.monthlyInvestment,
    annualReturn,
    targetCapital,
    currentYear,
  );

  const optimizedSim =
    scenarioType === "maintain_strong_rate"
      ? baseSim
      : simulateWealthTrajectory(
          form.currentNetWorth,
          optimizedMonthlyInvestment,
          annualReturn,
          targetCapital,
          currentYear,
        );

  const yearsRemaining =
    baseSim.independenceYear !== null
      ? baseSim.independenceYear - currentYear
      : null;

  const optimizedYearsRemaining =
    optimizedSim.independenceYear !== null
      ? optimizedSim.independenceYear - currentYear
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
    baseSim.independenceYear,
  );

  const improvement = getImprovementSuggestion(
    savingsRate,
    optimizedMonthlyInvestment,
    scenarioType,
    baseSim.independenceYear,
    optimizedSim.independenceYear,
    yearsSaved,
  );

  const showOptimizedProjection = scenarioType !== "maintain_strong_rate";

  return {
    savingsRate,
    targetCapital,
    desiredPassiveIncome: form.desiredPassiveIncome,
    riskProfileLabel: RISK_PROFILES[form.riskProfile].label,
    annualReturn: annualReturn,
    independenceYear: baseSim.independenceYear,
    independenceNetCapital: baseSim.independenceNetCapital,
    yearsRemaining,
    independenceAge:
      baseSim.independenceYear !== null
        ? form.currentAge + (baseSim.independenceYear - currentYear)
        : null,
    diagnosis,
    improvementSummary: improvement.summary,
    improvementYearsSavedPhrase: improvement.yearsSavedPhrase,
    optimizedMonthlyInvestment,
    optimizedIndependenceYear: optimizedSim.independenceYear,
    yearsSaved,
    scenarioType,
    currentAge: form.currentAge,
    currentProjection: baseSim.projection,
    optimizedProjection: showOptimizedProjection
      ? optimizedSim.projection
      : null,
    showOptimizedProjection,
  };
}

function NumberField({
  id,
  label,
  value,
  onChange,
  placeholder,
  hint,
  error,
  inputMode = "numeric",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  error?: string;
  inputMode?: "numeric" | "decimal";
}) {
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");

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
        aria-describedby={describedBy || undefined}
        className={`w-full rounded-xl border bg-zinc-900/80 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 outline-none transition focus:ring-2 ${
          error
            ? "border-red-500/60 focus:border-red-500/60 focus:ring-red-500/20"
            : "border-zinc-700/80 focus:border-emerald-500/60 focus:ring-emerald-500/20"
        }`}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-zinc-500">
          {hint}
        </p>
      )}
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
  const formSectionRef = useRef<HTMLElement>(null);
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

  const scrollToForm = () => {
    formSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-16">
        <header className="mb-10">
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
            mensuel, en tenant compte de la fiscalité et de votre profil de
            risque.
          </p>
        </header>

        <div className="flex flex-col gap-8">
          <section
            ref={formSectionRef}
            id="calculator-form"
            className="scroll-mt-8 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8"
          >
            <h2 className="text-lg font-semibold text-zinc-100">
              Vos paramètres
            </h2>
            <p className="mt-2 mb-6 text-sm leading-relaxed text-zinc-500">
              Exemple : utilisez des valeurs proches de votre situation réelle
              pour obtenir une estimation personnalisée.
            </p>

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
                label={FIELD_LABELS.currentNetWorth}
                value={form.currentNetWorth}
                onChange={(v) => update("currentNetWorth", v)}
                placeholder={FIELD_PLACEHOLDERS.currentNetWorth}
                hint="Incluez uniquement l'argent que vous souhaitez réellement prendre en compte dans cette simulation."
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
                label={FIELD_LABELS.desiredPassiveIncome}
                value={form.desiredPassiveIncome}
                onChange={(v) => update("desiredPassiveIncome", v)}
                placeholder={FIELD_PLACEHOLDERS.desiredPassiveIncome}
                hint="Exemple : 2 500 € par mois pour couvrir vos dépenses ou compléter vos revenus."
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
              {fieldErrors.riskProfile && (
                <p className="text-xs text-red-400">{fieldErrors.riskProfile}</p>
              )}
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

          {!results ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800/80 bg-zinc-900/20 p-8 text-center">
              <p className="max-w-md text-sm leading-relaxed text-zinc-500">
                Remplissez le formulaire puis cliquez sur{" "}
                <span className="font-medium text-zinc-400">
                  Calculer mon indépendance financière
                </span>{" "}
                pour afficher vos résultats et la projection de votre patrimoine.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
              <h2 className="mb-6 text-lg font-semibold text-zinc-100">
                Résultats
              </h2>

              <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 p-6">
                {results.yearsRemaining === null ? (
                  <p className="text-2xl font-bold tracking-tight text-emerald-400">
                    Objectif hors de portée sur l&apos;horizon simulé
                  </p>
                ) : results.yearsRemaining <= 0 ? (
                  <>
                    <p className="text-2xl font-bold tracking-tight text-emerald-400">
                      Objectif déjà atteint
                    </p>
                    {results.independenceYear !== null && (
                      <div className="mt-3 space-y-1 text-sm text-zinc-300">
                        <p>Année estimée : {results.independenceYear}</p>
                        {results.independenceAge !== null && (
                          <p>Âge estimé : {results.independenceAge} ans</p>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-2xl font-bold tracking-tight text-emerald-400">
                      Objectif atteint dans environ {results.yearsRemaining}{" "}
                      an{results.yearsRemaining > 1 ? "s" : ""}
                    </p>
                    {results.independenceYear !== null && (
                      <div className="mt-3 space-y-1 text-sm text-zinc-300">
                        <p>Année estimée : {results.independenceYear}</p>
                        {results.independenceAge !== null && (
                          <p>Âge estimé : {results.independenceAge} ans</p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <ResultCard
                label="Capital cible"
                value={formatEuro(results.targetCapital)}
                note="Montant estimé nécessaire pour générer votre revenu passif cible selon la règle des 4 %."
              />

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  Lecture du résultat
                </p>
                <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-zinc-400">
                  <li>
                    Le capital cible ({formatEuro(results.targetCapital)})
                    correspond au patrimoine estimé nécessaire pour retirer{" "}
                    {formatEuro(results.desiredPassiveIncome)} par mois, selon
                    la règle des 4&nbsp;%.
                  </li>
                  <li>
                    Cette projection repose sur un rendement annuel de{" "}
                    {formatPercent(results.annualReturn)} (profil{" "}
                    {results.riskProfileLabel}). Les marchés fluctuent&nbsp;:
                    ce rendement n&apos;est ni garanti ni constant.
                  </li>
                  <li>
                    L&apos;année d&apos;indépendance est la première année où
                    votre patrimoine net projeté atteint ou dépasse ce capital
                    cible. La flat tax (30&nbsp;% sur les plus-values) est
                    intégrée de façon simplifiée.
                  </li>
                </ul>
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

              <button
                type="button"
                onClick={scrollToForm}
                className="mt-6 w-full rounded-xl border border-zinc-700/80 bg-zinc-900/60 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-800/80 focus:outline-none focus:ring-2 focus:ring-zinc-600 focus:ring-offset-2 focus:ring-offset-zinc-900"
              >
                Modifier mes données
              </button>
              </div>

              <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
                <h2 className="text-lg font-semibold text-zinc-100">
                  Projection du patrimoine
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Évolution estimée de votre capital net jusqu&apos;à
                  l&apos;atteinte du capital cible
                  {results.independenceYear !== null
                    ? ` en ${results.independenceYear}`
                    : ""}
                  .
                </p>
                <div className="mt-6">
                  <WealthProjectionChart
                    currentSeries={results.currentProjection}
                    optimizedSeries={results.optimizedProjection}
                    showOptimized={results.showOptimizedProjection}
                    targetCapital={results.targetCapital}
                    singleCurveMessage={
                      !results.showOptimizedProjection
                        ? "Votre taux d'épargne est déjà élevé. Seule votre trajectoire actuelle est affichée — la priorité est de maintenir la régularité de vos investissements et une gestion du risque rigoureuse."
                        : undefined
                    }
                  />
                </div>
              </div>

              <aside className="rounded-2xl border border-zinc-800/60 bg-zinc-900/30 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                Note pédagogique
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Ce simulateur produit un scénario illustratif basé sur des
                hypothèses simplifiées (rendement constant, flat tax à 30 % sur
                les plus-values, règle des 4 %). Il ne
                constitue pas un conseil en investissement ni une recommandation
                personnalisée. Consultez un professionnel agréé pour toute
                décision patrimoniale.
              </p>
              </aside>
            </>
          )}
        </div>

        <footer className="mt-16 border-t border-zinc-800/60 pt-6 text-center text-xs leading-relaxed text-zinc-600">
          Simulation éducative. Les rendements ne sont pas garantis. Ceci ne
          constitue pas un conseil financier.
        </footer>
      </div>
    </div>
  );
}
