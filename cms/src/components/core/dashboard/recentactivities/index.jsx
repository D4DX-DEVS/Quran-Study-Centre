import React from "react";
import { Inbox } from "lucide-react";
import EmptyState from "../emptystate";

const RecentActivities = () => (
  <div className="bg-white border border-stroke-soft rounded-2xl p-5 h-full flex flex-col">
    <h3 className="text-sm font-semibold text-text-main mb-4">Recent Activities</h3>
    <div className="flex-1 flex items-center justify-center">
      <EmptyState icon={Inbox} title="No recent activities available" description="Activity history isn't tracked yet." />
    </div>
  </div>
);

export default RecentActivities;
