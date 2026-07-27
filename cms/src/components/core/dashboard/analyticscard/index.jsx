import React, { useEffect, useMemo, useState } from "react";
import { getData } from "../../../../backend/api";
import EmptyState from "../emptystate";
import { BarChart3 } from "lucide-react";

const FETCH_TIMEOUT_MS = 8000;
const MAX_BARS = 8;
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

// exam-registration's list endpoint returns a populated `district` per record but no
// date field usable for a month trend, so this aggregates real registrations by
// district client-side instead of charting a time series that isn't available.
const buildDistrictCounts = (registrations) => {
  const counts = new Map();
  registrations.forEach((registration) => {
    const label = registration?.district?.district || "Unspecified";
    counts.set(label, (counts.get(label) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
};

const AnalyticsCard = () => {
  const [bars, setBars] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    withTimeout(getData({ skip: 0, limit: 3000 }, "exam-registration"), FETCH_TIMEOUT_MS)
      .then((response) => {
        if (cancelled) return;
        const registrations = response && response.status === 200 ? response.data?.response ?? [] : [];
        setBars(buildDistrictCounts(registrations));
      })
      .catch(() => {
        if (!cancelled) setBars([]);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { visibleBars, otherCount, maxCount } = useMemo(() => {
    const rows = bars ?? [];
    const visible = rows.slice(0, MAX_BARS);
    const rest = rows.slice(MAX_BARS).reduce((sum, row) => sum + row.count, 0);
    const max = Math.max(...visible.map((row) => row.count), 1);
    return { visibleBars: visible, otherCount: rest, maxCount: max };
  }, [bars]);

  return (
    <div className="bg-white border border-stroke-soft rounded-2xl p-5 h-full flex flex-col">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-text-main">Analytics Overview</h3>
        <p className="text-xs text-text-soft mt-0.5">Registrations by district</p>
      </div>

      {!loaded ? (
        <div className="flex-1 space-y-3 animate-pulse py-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-4 rounded bg-bg-weak" style={{ width: `${90 - index * 12}%` }} />
          ))}
        </div>
      ) : visibleBars.length === 0 ? (
        <div className="flex-1 flex items-center justify-center min-h-[200px]">
          <EmptyState icon={BarChart3} title="No analytics data available" description="District breakdown will appear here once registrations exist." />
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 justify-center">
          {visibleBars.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-text-sub truncate" title={row.label}>
                {row.label}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-bg-weak overflow-hidden">
                <div className="h-full rounded-full bg-primary-base" style={{ width: `${Math.max((row.count / maxCount) * 100, 4)}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-medium text-text-main">{row.count}</span>
            </div>
          ))}
          {otherCount > 0 && <p className="text-xs text-text-soft">+{otherCount} more in other districts</p>}
        </div>
      )}
    </div>
  );
};

export default AnalyticsCard;
