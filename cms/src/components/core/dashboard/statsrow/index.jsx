import React, { useEffect, useState } from "react";
import { GraduationCap, ClipboardList, BookOpen, Award, LayoutDashboard } from "lucide-react";
import { getData } from "../../../../backend/api";
import { Count, IconWrapper, Tile, TitleBox, TileContainer, TitleHead } from "../highlitecard/styles";
import EmptyState from "../emptystate";

// Each stat here is backed by a real, already-used list endpoint (read via its totalCount) instead of
// the /dashboard summary endpoint, which only has branches for unrelated legacy roles (Dietician/Admin
// booking-app concepts) and returns nothing usable for this project's roles.
const STATS = [
  { key: "students", title: "Registered Students", api: "exam-registration", icon: GraduationCap, background: "#EFF6FF", color: "#1D4ED8" },
  { key: "exams", title: "Total Exams", api: "exam-type", icon: ClipboardList, background: "#ECFDF5", color: "#059669" },
  { key: "syllabus", title: "Syllabus", api: "syllabus", icon: BookOpen, background: "#F5F3FF", color: "#7C3AED" },
  { key: "certificates", title: "Certificates Issued", api: "certificate-management", icon: Award, background: "#FFF7ED", color: "#EA580C" },
];

const FETCH_TIMEOUT_MS = 8000;
const withTimeout = (promise, ms) => Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(null), ms))]);

const StatsRow = () => {
  const [counts, setCounts] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      STATS.map((stat) =>
        withTimeout(getData({ skip: 0, limit: 1 }, stat.api), FETCH_TIMEOUT_MS)
          .then((response) => (response && response.status === 200 ? response.data?.totalCount ?? 0 : null))
          .catch(() => null)
      )
    ).then((results) => {
      if (cancelled) return;
      setCounts(results);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <TileContainer>
        {STATS.map((stat) => (
          <Tile key={stat.key} className="animate-pulse">
            <IconWrapper />
            <TitleBox>
              <div className="h-3 w-20 rounded bg-bg-weak" />
              <div className="h-5 w-10 rounded bg-bg-weak" />
            </TitleBox>
          </Tile>
        ))}
      </TileContainer>
    );
  }

  if (counts.every((value) => value === null)) {
    return <EmptyState icon={LayoutDashboard} title="No summary data available" description="Key counts will appear here once available." />;
  }

  return (
    <TileContainer>
      {STATS.map((stat, index) => {
        const Icon = stat.icon;
        const value = counts[index];
        return (
          <Tile key={stat.key}>
            <IconWrapper style={{ background: stat.background, color: stat.color }}>
              <Icon size={20} strokeWidth={2} />
            </IconWrapper>
            <TitleBox>
              <TitleHead>{stat.title}</TitleHead>
              <Count>{value ?? "—"}</Count>
            </TitleBox>
          </Tile>
        );
      })}
    </TileContainer>
  );
};

export default StatsRow;
