import React from "react";

const EmptyState = ({ icon: Icon, title, description }) => (
  <div className="flex flex-col items-center justify-center text-center gap-2 py-8">
    <span className="flex items-center justify-center w-12 h-12 rounded-full bg-bg-weak text-icon-soft">{Icon ? <Icon size={20} strokeWidth={2} /> : null}</span>
    <p className="text-sm font-medium text-text-main">{title}</p>
    {description ? <p className="text-xs text-text-soft max-w-[220px]">{description}</p> : null}
  </div>
);

export default EmptyState;
