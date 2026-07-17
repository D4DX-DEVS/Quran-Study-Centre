import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Save,
  RefreshCw,
  ImagePlus,
  Trash2,
  Upload,
  Plus,
  PencilLine,
  Users,
  MapPinned,
  Building2,
} from "lucide-react";
import Layout from "../../../core/layout";
import { Container } from "../../../core/layout/styels";
import { getData, postData, putData, deleteData } from "../../../../backend/api";

const CDN = import.meta.env.VITE_APP_CDN || "";

const PHONE_REGEX = /^[0-9]{10}$/;

const STATE_ROLES = [
  { key: "director", label: "Director" },
  { key: "coordinator1", label: "Coordinator 1" },
  { key: "coordinator2", label: "Coordinator 2" },
];

const EMPTY_STATE_FORM = STATE_ROLES.reduce((acc, role) => {
  acc[role.key] = { name: "", position: "", photo: "" };
  return acc;
}, {});

const inputCls =
  "w-full px-3 py-2 text-sm rounded-md border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400";

const TABS = [
  { key: "state", label: "State Leadership", icon: Users },
  { key: "districts", label: "District Coordinators", icon: MapPinned },
  { key: "areas", label: "Area Coordinators", icon: Building2 },
];

const Leadership = (props) => {
  useEffect(() => {
    document.title = "Leadership - QSC Automation";
  }, []);

  const [tab, setTab] = useState("state");
  const [settingsId, setSettingsId] = useState(null);
  const [visibleOnHome, setVisibleOnHome] = useState(true);
  const [visibilityLoading, setVisibilityLoading] = useState(true);
  const [visibilitySaving, setVisibilitySaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getData({}, "floating-menu-settings").then((res) => {
      if (cancelled) return;
      const row = res?.data?.response?.[0];
      setSettingsId(row?._id || null);
      setVisibleOnHome(row ? row.leadership !== false : true);
      setVisibilityLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleVisibility = async () => {
    const next = !visibleOnHome;
    setVisibilitySaving(true);
    try {
      const res = settingsId
        ? await putData({ id: settingsId, leadership: next }, "floating-menu-settings")
        : await postData({ leadership: next }, "floating-menu-settings");
      if (res?.data?.success) {
        setVisibleOnHome(next);
        if (!settingsId) setSettingsId(res?.data?.response?._id || null);
        props.setMessage?.({
          type: 2,
          content: next ? "Leadership is now visible on the home page." : "Leadership is now hidden from the home page.",
          proceed: "Okay",
        });
      } else {
        props.setMessage?.({ type: 1, content: res?.data?.message || "Could not update visibility.", proceed: "Okay" });
      }
    } catch (e) {
      props.setMessage?.({ type: 1, content: "Could not update visibility.", proceed: "Okay" });
    } finally {
      setVisibilitySaving(false);
    }
  };

  return (
    <Container className="noshadow" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
      <div className="p-6 w-full max-w-6xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Leadership</h1>
            <p className="text-sm text-slate-500 max-w-2xl mt-1">
              Manage the public Leadership page — State Leadership, District Coordinators and Area Coordinators.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
            <div>
              <div className="text-xs font-semibold text-slate-700">Visible on home page</div>
              <div className="text-[11px] text-slate-400">
                {visibleOnHome ? "Leadership shows in the public site menu." : "Leadership is hidden from the public site menu."}
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={visibleOnHome}
              onClick={toggleVisibility}
              disabled={visibilityLoading || visibilitySaving}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                visibleOnHome ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  visibleOnHome ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  active ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "state" && <StateLeadershipTab setMessage={props.setMessage} />}
        {tab === "districts" && (
          <CoordinatorTab
            key="districts"
            resource="leadership/districts"
            nameField="districtName"
            nameLabel="District Name"
            entityLabel="District"
            setMessage={props.setMessage}
            addPrivilege={props.addPrivilege}
            updatePrivilege={props.updatePrivilege}
            delPrivilege={props.delPrivilege}
          />
        )}
        {tab === "areas" && (
          <CoordinatorTab
            key="areas"
            resource="leadership/areas"
            nameField="areaName"
            nameLabel="Area Name"
            entityLabel="Area"
            setMessage={props.setMessage}
            addPrivilege={props.addPrivilege}
            updatePrivilege={props.updatePrivilege}
            delPrivilege={props.delPrivilege}
          />
        )}
      </div>
    </Container>
  );
};

// =========================================================
// STATE LEADERSHIP TAB
// =========================================================

const StateLeadershipTab = ({ setMessage }) => {
  const [form, setForm] = useState(EMPTY_STATE_FORM);
  const [files, setFiles] = useState({});
  const [removed, setRemoved] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getData({}, "leadership/state");
      const row = res?.data?.response || {};
      const next = STATE_ROLES.reduce((acc, role) => {
        const value = row[role.key] || {};
        acc[role.key] = { name: value.name || "", position: value.position || "", photo: value.photo || "" };
        return acc;
      }, {});
      setForm(next);
      setFiles({});
      setRemoved({});
    } catch (e) {
      setMessage?.({ type: 1, content: "Could not load State Leadership.", proceed: "Okay" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleField = (roleKey, field) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [roleKey]: { ...f[roleKey], [field]: value } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      STATE_ROLES.forEach((role) => {
        payload[`${role.key}Name`] = form[role.key].name;
        payload[`${role.key}Position`] = form[role.key].position;
        if (files[role.key]) {
          payload[`${role.key}Photo`] = files[role.key];
        } else if (removed[role.key]) {
          const flag = `remove${role.key.charAt(0).toUpperCase() + role.key.slice(1)}Photo`;
          payload[flag] = true;
        }
      });

      const res = await putData(payload, "leadership/state");
      if (res?.data?.success) {
        setMessage?.({ type: 2, content: "State Leadership updated.", proceed: "Okay" });
        await load();
      } else {
        setMessage?.({ type: 1, content: res?.data?.message || "Could not save State Leadership.", proceed: "Okay" });
      }
    } catch (e) {
      setMessage?.({ type: 1, content: e?.response?.data?.message || e.message, proceed: "Okay" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center text-sm text-slate-500 bg-white rounded-lg border border-slate-200">Loading content…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
        >
          <Save size={14} />
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {STATE_ROLES.map((role) => (
        <section key={role.key} className="bg-white rounded-lg border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">{role.label}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageField
              label="Photo"
              existingUrl={form[role.key].photo ? `${CDN}${form[role.key].photo}` : ""}
              file={files[role.key]}
              onChange={(f) => {
                setFiles((prev) => ({ ...prev, [role.key]: f }));
                if (f) setRemoved((prev) => ({ ...prev, [role.key]: false }));
              }}
              removed={!!removed[role.key]}
              onRemove={() => {
                setRemoved((prev) => ({ ...prev, [role.key]: true }));
                setFiles((prev) => ({ ...prev, [role.key]: null }));
              }}
            />
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name</label>
                <input type="text" value={form[role.key].name} onChange={handleField(role.key, "name")} className={inputCls} placeholder="Full name" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Position</label>
                <input
                  type="text"
                  value={form[role.key].position}
                  onChange={handleField(role.key, "position")}
                  className={inputCls}
                  placeholder={role.label}
                />
              </div>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
};

const ImageField = ({ label, existingUrl, file, onChange, removed, onRemove }) => {
  const inputRef = useRef(null);
  const previewUrl = useMemo(() => {
    if (file) return URL.createObjectURL(file);
    if (removed) return "";
    return existingUrl || "";
  }, [file, existingUrl, removed]);

  useEffect(() => {
    return () => {
      if (file && previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
        <ImagePlus size={14} />
        <span>{label}</span>
      </label>
      <div className="flex items-stretch gap-3">
        <div className="w-24 h-24 rounded-full bg-slate-50 border border-dashed border-slate-300 flex items-center justify-center overflow-hidden shrink-0">
          {previewUrl ? <img src={previewUrl} alt={label} className="w-full h-full object-cover" /> : <span className="text-[11px] text-slate-400">No photo</span>}
        </div>
        <div className="flex-1 flex flex-col justify-center min-w-0 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <Upload size={13} />
              {previewUrl ? "Replace" : "Upload"}
            </button>
            {!file && !removed && existingUrl && (
              <button type="button" onClick={() => onRemove?.()} className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] rounded text-rose-600 hover:bg-rose-50">
                <Trash2 size={12} />
                Remove
              </button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onChange(f);
              }}
            />
          </div>
          {removed && !file && <p className="text-[11px] text-rose-500">Photo will be removed on save.</p>}
        </div>
      </div>
    </div>
  );
};

// =========================================================
// DISTRICT / AREA COORDINATOR TAB (shared)
// =========================================================

const EMPTY_COORDINATOR_FORM = {
  id: "",
  name: "",
  coordinator1: { name: "", phone: "" },
  coordinator2: { name: "", phone: "" },
};

const CoordinatorTab = ({ resource, nameField, nameLabel, entityLabel, setMessage, addPrivilege, updatePrivilege, delPrivilege }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [modalMode, setModalMode] = useState(null);
  const [formValues, setFormValues] = useState(EMPTY_COORDINATOR_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getData({ skip: 0, limit: 500 }, resource);
      setRows(res?.data?.response || []);
    } catch (e) {
      setMessage?.({ type: 1, content: `Could not load ${entityLabel} coordinators.`, proceed: "Okay" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [resource]);

  const openCreateModal = () => {
    setFormValues(EMPTY_COORDINATOR_FORM);
    setModalMode("create");
  };

  const openEditModal = (row) => {
    setFormValues({
      id: row._id || "",
      name: row[nameField] || "",
      coordinator1: { name: row.coordinator1?.name || "", phone: row.coordinator1?.phone || "" },
      coordinator2: { name: row.coordinator2?.name || "", phone: row.coordinator2?.phone || "" },
    });
    setModalMode("edit");
  };

  const closeModal = () => {
    if (saving) return;
    setModalMode(null);
    setFormValues(EMPTY_COORDINATOR_FORM);
  };

  const setCoordinatorField = (coordKey, field, value) => {
    setFormValues((prev) => ({ ...prev, [coordKey]: { ...prev[coordKey], [field]: value } }));
  };

  const validate = () => {
    if (!formValues.name.trim()) return `${nameLabel} is required.`;
    for (const coordKey of ["coordinator1", "coordinator2"]) {
      const phone = formValues[coordKey].phone.trim();
      if (phone && !PHONE_REGEX.test(phone)) {
        return `${coordKey === "coordinator1" ? "Coordinator 1" : "Coordinator 2"} phone number must be exactly 10 digits.`;
      }
    }
    return "";
  };

  const submitForm = async (event) => {
    event.preventDefault();
    const error = validate();
    if (error) {
      setMessage?.({ type: 1, content: error, proceed: "Okay" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        [nameField]: formValues.name.trim(),
        coordinator1: { name: formValues.coordinator1.name.trim(), phone: formValues.coordinator1.phone.trim() },
        coordinator2: { name: formValues.coordinator2.name.trim(), phone: formValues.coordinator2.phone.trim() },
      };

      const res = modalMode === "edit" ? await putData({ ...payload, id: formValues.id }, resource) : await postData(payload, resource);

      if (res?.data?.success) {
        setMessage?.({ type: 2, content: `${entityLabel} ${modalMode === "edit" ? "updated" : "added"} successfully.`, proceed: "Okay" });
        setModalMode(null);
        setFormValues(EMPTY_COORDINATOR_FORM);
        await load();
      } else {
        setMessage?.({ type: 1, content: res?.data?.message || `Failed to save ${entityLabel.toLowerCase()}.`, proceed: "Okay" });
      }
    } catch (e) {
      setMessage?.({ type: 1, content: `Failed to save ${entityLabel.toLowerCase()}.`, proceed: "Okay" });
    } finally {
      setSaving(false);
    }
  };

  const submitDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await deleteData({ id: deleteTarget._id }, resource);
      if (res?.data?.success) {
        setMessage?.({ type: 2, content: `${entityLabel} deleted successfully.`, proceed: "Okay" });
        setDeleteTarget(null);
        await load();
      } else {
        setMessage?.({ type: 1, content: res?.data?.message || `Failed to delete ${entityLabel.toLowerCase()}.`, proceed: "Okay" });
      }
    } catch (e) {
      setMessage?.({ type: 1, content: `Failed to delete ${entityLabel.toLowerCase()}.`, proceed: "Okay" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        {addPrivilege !== false && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
          >
            <Plus size={14} />
            Add {entityLabel}
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-slate-500 bg-white rounded-lg border border-slate-200">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500 bg-white rounded-lg border border-dashed border-slate-300">No {entityLabel.toLowerCase()} coordinators added yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((row) => (
            <div key={row._id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="bg-indigo-600 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
                <span>{row[nameField]}</span>
                <div className="flex items-center gap-1">
                  {updatePrivilege !== false && (
                    <button type="button" onClick={() => openEditModal(row)} className="p-1 rounded hover:bg-white/20">
                      <PencilLine size={14} />
                    </button>
                  )}
                  {delPrivilege !== false && (
                    <button type="button" onClick={() => setDeleteTarget(row)} className="p-1 rounded hover:bg-white/20">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="p-4 flex flex-col gap-3 text-sm">
                <div>
                  <div className="text-xs font-medium text-slate-500">Coordinator 1</div>
                  <div className="text-slate-800">{row.coordinator1?.name || "—"}</div>
                  <div className="text-slate-500">{row.coordinator1?.phone || "—"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Coordinator 2</div>
                  <div className="text-slate-800">{row.coordinator2?.name || "—"}</div>
                  <div className="text-slate-500">{row.coordinator2?.phone || "—"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalMode && (
        <div className="fixed inset-0 bg-slate-900/45 flex items-start justify-center z-[2000] p-4 overflow-y-auto" onClick={closeModal}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={submitForm}
            className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-5 mt-10"
          >
            <h3 className="text-lg font-semibold text-slate-800 mb-4">{modalMode === "edit" ? `Edit ${entityLabel}` : `Add ${entityLabel}`}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{nameLabel}</label>
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(e) => setFormValues((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputCls}
                  required
                />
              </div>

              {["coordinator1", "coordinator2"].map((coordKey, index) => (
                <div key={coordKey} className="grid grid-cols-2 gap-3 p-3 rounded-md bg-slate-50 border border-slate-100">
                  <div className="col-span-2 text-xs font-semibold text-slate-600">Coordinator {index + 1}</div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Name</label>
                    <input
                      type="text"
                      value={formValues[coordKey].name}
                      onChange={(e) => setCoordinatorField(coordKey, "name", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formValues[coordKey].phone}
                      onChange={(e) => setCoordinatorField(coordKey, "phone", e.target.value)}
                      className={inputCls}
                      placeholder="10-digit number"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-slate-900/45 flex items-start justify-center z-[2000] p-4 overflow-y-auto" onClick={() => !deleting && setDeleteTarget(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm bg-white rounded-xl border border-slate-200 p-5 mt-10">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Delete {entityLabel}</h3>
            <p className="text-sm text-slate-500 mb-4">
              Are you sure you want to delete <strong>{deleteTarget[nameField]}</strong>? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteTarget(null)} className="px-4 py-2 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                onClick={submitDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout(Leadership);
