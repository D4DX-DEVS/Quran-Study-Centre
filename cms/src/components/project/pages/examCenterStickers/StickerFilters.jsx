import React, { useCallback, useEffect, useState } from "react";
import { getData } from "../../../../backend/api";

// District -> Area -> Exam Center cascading filters. State Admin sees all
// three; District Admin's district is fixed server-side (backend silently
// scopes every response to req.user.districts) so only Area/Exam Center are
// shown, per the "Exam Center Stickers" access-control spec.
const StickerFilters = ({ isDistrictAdmin, filters, onChange }) => {
  const [options, setOptions] = useState({ districts: [], areas: [], examCenters: [] });
  const [loading, setLoading] = useState(false);

  const hasDistrictContext = isDistrictAdmin || Boolean(filters.district);

  const loadOptions = useCallback(async (district, area) => {
    setLoading(true);
    try {
      const res = await getData({ ...(district ? { district } : {}), ...(area ? { area } : {}) }, "exam-center-stickers/select");
      if (res?.data?.success) setOptions(res.data.response);
    } catch (e) {
      // ignore — filters just stay empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions(filters.district, filters.area);
  }, [filters.district, filters.area, loadOptions]);

  // Changing a parent filter resets every dependent filter below it.
  const handleDistrictChange = (e) => onChange({ district: e.target.value, area: "", examCenter: "" });
  const handleAreaChange = (e) => onChange({ ...filters, area: e.target.value, examCenter: "" });
  const handleCenterChange = (e) => onChange({ ...filters, examCenter: e.target.value });

  const selectClass = "min-w-[180px] rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 disabled:bg-gray-100 disabled:text-gray-400";
  const labelClass = "text-xs font-medium text-gray-500";

  return (
    <div className="flex flex-wrap items-end gap-3">
      {!isDistrictAdmin && (
        <div className="flex flex-col gap-1">
          <label className={labelClass}>District</label>
          <select className={selectClass} value={filters.district} onChange={handleDistrictChange}>
            <option value="">All Districts</option>
            {options.districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.value}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Area</label>
        <select className={selectClass} value={filters.area} onChange={handleAreaChange} disabled={!hasDistrictContext}>
          <option value="">All Areas</option>
          {options.areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.value}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label className={labelClass}>Exam Center</label>
        <select className={selectClass} value={filters.examCenter} onChange={handleCenterChange} disabled={!hasDistrictContext}>
          <option value="">All Exam Centers</option>
          {options.examCenters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.value}
              {c.centerCode ? ` (${c.centerCode})` : ""}
            </option>
          ))}
        </select>
      </div>
      {loading && <span className="text-xs text-gray-400">Loading...</span>}
    </div>
  );
};

export default StickerFilters;
