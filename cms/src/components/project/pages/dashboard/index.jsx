import React from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import withLayout from "../../../core/layout";
import { Container } from "../../../core/layout/styels";
import StatsRow from "../../../core/dashboard/statsrow";
import AnalyticsCard from "../../../core/dashboard/analyticscard";
import QuickActions from "../../../core/dashboard/quickactions";
import RecentSyllabus from "../../../core/dashboard/recentsyllabus";
import RecentActivities from "../../../core/dashboard/recentactivities";
import { findMenuLink, dispatchMenuSelection } from "../../../core/dashboard/menuLinks";
import { useDispatch } from "react-redux";

const Dashboard = (props) => {
  const dispatch = useDispatch();
  const menu = props.user?.menu ?? [];
  const displayName = props.user?.fullName ?? props.user?.username ?? "admin";
  const addSyllabusEntry = findMenuLink(menu, (label) => /syllabus/i.test(label));

  return (
    <Container className="noshadow">
      <div className="w-full bg-bg-weak p-6 flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-text-main">Assalamu Alaikum, {displayName} 👋</h1>
            <p className="text-sm text-text-sub mt-1">Welcome back to Quran Study Centre Kerala</p>
          </div>
          {addSyllabusEntry && (
            <Link
              to={addSyllabusEntry.path}
              onClick={() => dispatchMenuSelection(dispatch, addSyllabusEntry)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary-base text-white text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              <Plus size={16} strokeWidth={2} />
              Add Syllabus
            </Link>
          )}
        </div>

        <StatsRow />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AnalyticsCard />
          <QuickActions menu={menu} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentSyllabus menu={menu} />
          <RecentActivities />
        </div>
      </div>
    </Container>
  );
};

export default withLayout(Dashboard);
