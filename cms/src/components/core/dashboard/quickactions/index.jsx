import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { useDispatch } from "react-redux";
import { BookPlus, HelpCircle, UserPlus, PencilLine, FilePlus2, BarChart3 } from "lucide-react";
import { findMenuLink, dispatchMenuSelection } from "../menuLinks";

const ACTION_DEFS = [
  { key: "syllabus", label: "Add Syllabus", icon: BookPlus, test: (label) => /syllabus/i.test(label) },
  { key: "question", label: "Add Question", icon: HelpCircle, test: (label) => /question/i.test(label) },
  { key: "student", label: "Register Student", icon: UserPlus, test: (label) => /student/i.test(label) },
  { key: "mark-entry", label: "Mark Entry", icon: PencilLine, test: (label) => /mark\s*entry/i.test(label) },
  {
    key: "exam",
    label: "Create Exam",
    icon: FilePlus2,
    test: (label) => /^exams?$/i.test(label.trim()) || (/exam/i.test(label) && !/center|consolidation|hall|result|history|allocation|registration|attendance|type|score|setting/i.test(label)),
  },
  { key: "report", label: "Generate Report", icon: BarChart3, test: (label) => /consolidation|report/i.test(label) },
];

const QuickActions = ({ menu = [] }) => {
  const dispatch = useDispatch();

  const tiles = useMemo(
    () =>
      ACTION_DEFS.map((def) => {
        const entry = findMenuLink(menu, def.test);
        return entry ? { ...def, entry } : null;
      }).filter(Boolean),
    [menu]
  );

  return (
    <div className="bg-white border border-stroke-soft rounded-2xl p-5 h-full">
      <h3 className="text-sm font-semibold text-text-main mb-4">Quick Actions</h3>
      {tiles.length === 0 ? (
        <p className="text-sm text-text-soft">No quick actions available for your account.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {tiles.map(({ key, label, icon: Icon, entry }) => (
            <Link
              key={key}
              to={entry.path}
              onClick={() => dispatchMenuSelection(dispatch, entry)}
              className="flex flex-col items-start gap-2 p-4 rounded-xl border border-stroke-soft hover:border-primary-light hover:bg-primary-lightest transition-colors"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-lightest text-primary-base">
                <Icon size={18} strokeWidth={2} />
              </span>
              <span className="text-sm font-medium text-text-main">{label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuickActions;
