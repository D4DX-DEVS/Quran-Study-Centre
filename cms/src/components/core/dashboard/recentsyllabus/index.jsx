import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { getData } from "../../../../backend/api";
import { findMenuLink } from "../menuLinks";
import EmptyState from "../emptystate";

const RecentSyllabus = ({ menu = [] }) => {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getData({ skip: 0, limit: 5 }, "syllabus")
      .then((response) => {
        if (!cancelled) setRows(response?.data?.response ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const viewAllPath = findMenuLink(menu, (label) => /syllabus/i.test(label))?.path ?? "/syllabus";

  return (
    <div className="bg-white border border-stroke-soft rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-main">Recent Syllabus</h3>
        <Link to={viewAllPath} className="text-sm font-medium text-primary-base hover:underline">
          View All
        </Link>
      </div>
      {!loaded ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-10 bg-bg-weak rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={BookOpen} title="No syllabus records found" description="Syllabus you add will show up here." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="pb-2 text-xs font-medium uppercase tracking-wide text-text-soft">Syllabus</th>
              <th className="pb-2 text-xs font-medium uppercase tracking-wide text-text-soft">Year</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 5).map((row) => (
              <tr key={row._id} className="border-t border-stroke-soft">
                <td className="py-2.5 text-text-main">{row.syllabus}</td>
                <td className="py-2.5 text-text-sub">{row.year}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default RecentSyllabus;
