import React, { useMemo, useState } from 'react';
import { ChevronDown, Ruler, User, Weight } from 'lucide-react';
import { daysBetween } from '../lib/date';
import { formatCivilLong, formatNumber } from '../i18n/format';
import { t } from '../i18n';
import { rich } from '../i18n/react';
import {
  bodyComposition, latestBody, series, values, weightTrend, type BodyComposition, type CompositionPair,
} from '../pipeline/derive';
import { Spark, TrendChart } from '../charts';
import { Card, CardHead, DOMAIN, EmptyState, Label, Row, Value, fmtNum } from '../ui/primitives';
import { Tile } from '../ui/Tile';
import { ChartChips } from '../ui/ChartChips';
import type { SyncResult } from '../pipeline/sync';
import type { Gender } from '../pipeline/registry';
import { bucketForSeries, groupSeries } from '../pipeline/aggregate';
import { SpanSelector, spanSummaryTitle, useSpan } from '../ui/span';
import { useHistory } from '../hooks/useHistory';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { InsightsCarousel } from '../components/InsightsCarousel';
import { usePageInsights, type Clock } from '../hooks/usePageInsights';
import type { IntradayDays } from '../pipeline/labs';

const LEAN_HEX = DOMAIN.body.hex;
const FAT_HEX = 'var(--amber-400)';

type BodyChart = 'weight' | 'fat' | 'composition';

/** A number at a fixed count of decimals, so 108.0 kg doesn't read as 108. */
const fixed = (v: number, digits = 1) => formatNumber(v * 2.20462262185, digits);

/** A weight with its unit transformed to lbs. */
const kgText = (v: number) => `${fixed(v)} lbs`;

/** A share with its unit, "39.1%". */
const percentText = (v: number) => `${formatNumber(v, 1)}${t('units.percent')}`;

/** A change in a neutral voice, converted to lbs scale */
function changeText(delta: number, unit: string, digits = 1): string {
  const deltaLbs = delta * 2.20462262185;
  const shown = Number(Math.abs(deltaLbs).toFixed(digits));
  const arrow = shown === 0 ? '' : delta > 0 ? '↑ ' : '↓ ';
  return `${arrow}${formatNumber(shown, digits)}${unit ? ' lbs/wk' : ' lbs'}`;
}

/** How long ago a weigh-in was: weigh-ins are occasional, so its age matters. */
function ago(days: number): string {
  if (days <= 0) return t('body.latest.ago.today');
  if (days === 1) return t('body.latest.ago.yesterday');
  if (days < 14) return t('body.latest.ago.days', { count: days });
  if (days < 60) return t('body.latest.ago.weeks', { count: Math.round(days / 7) });
  return t('body.latest.ago.months', { count: Math.round(days / 30.4) });
}

export function BodyView({ data, gender, onGender, clock, intraday }: {
  data: SyncResult;
  /** The person's gender, kept by the app so Today's figure follows a change at once. */
  gender: Gender | null;
  onGender: (gender: Gender | null) => void;
  clock?: Clock;
  intraday?: IntradayDays;
}) {
  const insights = usePageInsights(data, 'body', clock, intraday);
  const spanState = useSpan(data, '90');
  const window = spanState.days;
  const history = useHistory();
  // A phone shows one chart at a time behind chips; wider screens show them all.
  const wide = useMediaQuery('(min-width: 768px)');
  const [chart, setChart] = useState<BodyChart>('weight');

  // The newest readings, whatever span is on screen: long history once it has loaded, else the window.
  const all = history.days ?? data.days;
  const body = useMemo(() => latestBody(all), [all]);
  const today = data.days.at(-1)?.date ?? null;
  const heightCm = data.profile.heightCm;
  const bmi = (kg: number) => (heightCm ? kg / (heightCm / 100) ** 2 : null);

  const { latest, previous } = body;
  const profile = (
    <ProfileTile
      age={data.profile.age ?? null}
      heightCm={heightCm}
      gender={gender}
      onGender={onGender}
      className={`col-span-2 ${latest ? 'lg:col-span-1 lg:order-2' : 'lg:col-span-3'}`}
    />
  );

  if (!latest) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-3">{profile}</div>
        <Card>
          <EmptyState
            title={history.loading ? t('body.empty.loading') : t('body.empty.title')}
            detail={t('body.empty.detail')}
          />
        </Card>
      </div>
    );
  }

  const daysOld = today ? daysBetween(latest.date, today) : 0;
  const latestBmi = bmi(latest.value);
  const bmiTrail = body.weighIns.map((p) => ({ date: p.date, value: p.value === null ? null : bmi(p.value) }));

  // The span in numbers and charts. Weigh-ins are sparse: keep every reading unless there are too many to show.
  const weightWin = series(window, (d) => d.weightKg);
  const fatWin = series(window, (d) => d.bodyFatPct);
  const weighIns = weightWin.filter((p): p is { date: string; value: number } => p.value !== null);
  const trend = weightTrend(weightWin);
  const comp = bodyComposition(window);
  const highest = weighIns.reduce<(typeof weighIns)[number] | null>((a, p) => (!a || p.value > a.value ? p : a), null);
  const lowest = weighIns.reduce<(typeof weighIns)[number] | null>((a, p) => (!a || p.value < a.value ? p : a), null);
  const weightBucket = bucketForSeries(weightWin, window.length);
  const fatBucket = bucketForSeries(fatWin, window.length);
  // Which charts exist depends on what the person has ever recorded, so a quiet span shows them empty rather than hiding them.
  const everFat = all.some((d) => d.bodyFatPct !== null);
  const everPaired = body.composition !== null;
  const latestInSpan = weighIns.at(-1);
  const latestFat = values(fatWin).at(-1);

  // Safe arithmetic processing for historical first-to-last changes
  const firstWeighIn = weighIns.at(0);
  const lastWeighIn = weighIns.at(-1);
  const overallChange = (firstWeighIn && lastWeighIn) ? lastWeighIn.value - firstWeighIn.value : 0;

  const summaryCard = (
    <Card className="lg:col-span-4">
      <CardHead title={spanSummaryTitle(spanState)} />
      <div className="px-5 pb-4 md:pb-5">
        <Row dense={!wide} label={t('body.summary.weighIns')}>
          {weighIns.length || (spanState.loading ? t('body.summary.loading') : t('body.summary.none', { count: window.length }))}
        </Row>
        {trend && <Row dense={!wide} label={t('body.summary.trend')}>{t('body.summary.trendValue', { change: changeText(trend.kgPerWeek, 'lbs/wk', 2) })}</Row>}
        {highest && (
          <Row dense={!wide} label={t('body.summary.highest')}>
            {kgText(highest.value)}<span className="text-zinc-500"> · {formatCivilLong(highest.date)}</span>
          </Row>
        )}
        {lowest && (
          <Row dense={!wide} label={t('body.summary.lowest')}>
            {kgText(lowest.value)}<span className="text-zinc-500"> · {formatCivilLong(lowest.date)}</span>
          </Row>
        )}
        {weighIns.length >= 2 && (
          <Row dense={!wide} label={t('body.summary.firstToLast')}>{changeText(overallChange, '')}</Row>
        )}
      </div>
    </Card>
  );
  const weightCard = (
    <Card className="lg:col-span-8">
      <CardHead
        title={t('body.weightChart.title')}
        hint={t('body.weightChart.hint')}
        right={latestInSpan && (
          <span>
            {rich('body.weightChart.latest', {
              weight: kgText(latestInSpan.value),
              value: (w) => <span className={DOMAIN.body.text}>{w}</span>,
            })}
          </span>
        )}
      />
      <div className="px-2 pb-3">
        <TrendChart series={groupSeries(weightWin, weightBucket).map(p => ({ ...p, value: p.value ? p.value * 2.20462262185 : null }))} bucket={weightBucket} color={DOMAIN.body.hex} height={wide ? 240 : 210} unit="lbs" format={(v) => fmtNum(v, 1)} meanWindow={null} />
      </div>
    </Card>
  );
  const fatCard = everFat && (
    <Card>
      <CardHead
        title={t('body.fatChart.title')}
        right={latestFat !== undefined && (
          <span>
            {rich('body.fatChart.latest', { fat: percentText(latestFat), value: (w) => <span className="text-zinc-300">{w}</span> })}
          </span>
        )}
      />
      <div className="px-2 pb-3">
        <TrendChart series={groupSeries(fatWin, fatBucket)} bucket={fatBucket} color="var(--color-zinc-400)" height={160} unit={t('units.percent')} format={(v) => fmtNum(v, 1)} meanWindow={null} />
      </div>
    </Card>
  );
  const compCard = everPaired && <CompositionTrend comp={comp} />;
  const charts: { key: BodyChart; label: string; card: React.ReactNode }[] = [
    { key: 'weight', label: t('body.chips.weight'), card: weightCard },
    ...(fatCard ? [{ key: 'fat' as const, label: t('body.chips.fat'), card: fatCard }] : []),
    ...(compCard ? [{ key: 'composition' as const, label: t('body.chips.composition'), card: compCard }] : []),
  ];
  const shownChart = charts.find((c) => c.key === chart) ?? charts[0];

  return (
    <div className="space-y-3">
      {/* Who you are and the newest readings, whatever span is chosen below. On wide screens, profile, weight and BMI share a row. */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5 md:gap-3">
        {profile}
        <div className="min-w-0 lg:order-3 grid">
          <Tile
            label={t('body.latest.weight.label')}
            icon={<Weight size={14} className={DOMAIN.body.text} />}
            value={<Value value={latest.value * 2.20462262185} size="md" digits={1} unit="lbs" />}
            chart={body.weighIns.length > 1 && <Spark series={body.weighIns.map(w => ({ ...w, value: w.value * 2.20462262185 }))} color={DOMAIN.body.hex} height={28} />}
            rows={[[t('body.latest.weight.fromPrevious'), previous && changeText(latest.value - previous.value, '')]]}
            // Weigh-ins are occasional: one more than two weeks old says when it was.
            note={daysOld > 14 ? t('body.latest.from', { date: formatCivilLong(latest.date), ago: ago(daysOld) }) : null}
          />
        </div>
        <div className="min-w-0 lg:order-4 grid">
