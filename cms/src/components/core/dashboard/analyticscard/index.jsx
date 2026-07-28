import React, { useEffect, useMemo, useState } from "react";
import { getData } from "../../../../backend/api";
import EmptyState from "../emptystate";
import { BarChart3 } from "lucide-react";

// Generous timeout + full pagination: unlike the /dashboard summary endpoint, exam-registration
// is a normal, working CRUD route, so a timeout firing here means the request is genuinely slow,
// not a permanently broken backend branch. Walking every page (not a single capped fetch) keeps
// this total in agreement with the real "Registered Students" stat card count.
const FETCH_TIMEOUT_MS = 45000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 250; // backstop only (250,000 records) — guards against a bad totalCount, not a real cap
const VISIBLE_BARS = 8;
const TIMED_OUT = Symbol("timed-out");
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(TIMED_OUT), ms))]);

const tallyByDistrict = (tally, rows) => {
  rows.forEach((registration) => {
    const label = registration?.district?.district || "Unspecified";
    tally.set(label, (tally.get(label) || 0) + 1);
  });
};

const fetchAllRegistrationsByDistrict = async () => {
  const first = await getData({ skip: 0, limit: PAGE_SIZE }, "exam-registration");
  if (!first || first.status !== 200) {
    console.error("AnalyticsCard: exam-registration fetch failed", first);
    return null;
  }

  const tally = new Map();
  tallyByDistrict(tally, first.data?.response ?? []);

  const total = first.data?.totalCount ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const pagesToFetch = Math.min(totalPages, MAX_PAGES);
  const truncated = totalPages > MAX_PAGES;

  if (pagesToFetch > 1) {
    const rest = await Promise.all(
      Array.from({ length: pagesToFetch - 1 }, (_, i) => getData({ skip: (i + 1) * PAGE_SIZE, limit: PAGE_SIZE }, "exam-registration"))
    );
    rest.forEach((response) => {
      if (response && response.status === 200) {
        tallyByDistrict(tally, response.data?.response ?? []);
      } else {
        console.error("AnalyticsCard: a page of exam-registration failed to load", response);
      }
    });
  }

  if (truncated) {
    console.warn(`AnalyticsCard: exam-registration has ${total} records, only counted the first ${MAX_PAGES * PAGE_SIZE}`);
  }

  const rows = Array.from(tally.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return { rows, total, truncated };
};

const AnalyticsCard = () => {
  const [result, setResult] = useState(null);
  const [currentYear, setCurrentYear] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Read-only, already-used-elsewhere endpoint (exam-settings) — just labels the card with
    // the real active exam year, no filtering logic depends on it.
    getData({}, "exam-settings")
      .then((response) => {
        if (!cancelled) setCurrentYear(response?.data?.data?.year ?? null);
      })
      .catch(() => {});

    withTimeout(fetchAllRegistrationsByDistrict(), FETCH_TIMEOUT_MS)
      .then((value) => {
        if (cancelled) return;
        if (value === TIMED_OUT) {
          console.error(`AnalyticsCard: district breakdown did not finish within ${FETCH_TIMEOUT_MS}ms`);
          setResult({ rows: [], total: 0, truncated: false });
          return;
        }
        setResult(value ?? { rows: [], total: 0, truncated: false });
      })
      .catch((error) => {
        console.error("AnalyticsCard: district breakdown threw", error);
        if (!cancelled) setResult({ rows: [], total: 0, truncated: false });
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { visibleBars, maxCount, hiddenCount } = useMemo(() => {
    const rows = result?.rows ?? [];
    const visible = expanded ? rows : rows.slice(0, VISIBLE_BARS);
    const max = Math.max(...rows.map((row) => row.count), 1);
    return { visibleBars: visible, maxCount: max, hiddenCount: Math.max(rows.length - VISIBLE_BARS, 0) };
  }, [result, expanded]);

  return (
    <div className="bg-white border border-stroke-soft rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-main">Analytics Overview</h3>
          <p className="text-xs text-text-soft mt-0.5">Registrations by district{result?.total ? ` · ${result.total} total` : ""}</p>
        </div>
        {currentYear && <span className="text-xs font-medium text-text-sub border border-stroke-soft rounded-lg px-2.5 py-1.5 bg-bg-weak">{currentYear}</span>}
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
          <div className={`flex flex-col gap-3 ${expanded ? "max-h-80 overflow-y-auto pr-1" : ""}`}>
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
          </div>
          {hiddenCount > 0 && !expanded && (
            <button type="button" onClick={() => setExpanded(true)} className="text-sm font-medium text-primary-base hover:underline text-left mt-1">
              View All ({hiddenCount} more district{hiddenCount === 1 ? "" : "s"})
            </button>
          )}
          {expanded && (result?.rows?.length ?? 0) > VISIBLE_BARS && (
            <button type="button" onClick={() => setExpanded(false)} className="text-sm font-medium text-primary-base hover:underline text-left mt-1">
              Show less
            </button>
          )}
          {result?.truncated && (
            <p className="text-xs text-text-soft">
              Showing the first {MAX_PAGES * PAGE_SIZE} of {result.total} registrations.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsCard;
