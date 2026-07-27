import { currentMenu, menuStatus, openedMenu, selectedMenu, selectedSubMenu } from "../../../store/actions/common";

export const flattenMenu = (menu = []) => {
  const flat = [];
  (menu ?? []).forEach((item) => {
    if (item && item.menuType !== "title" && typeof item.path === "string" && item.path.trim()) {
      flat.push({ label: item.label, path: item.path, _id: item._id, parent: null, raw: item });
    }
    (item?.submenus ?? []).forEach((sub) => {
      if (sub && sub.menuType !== "title" && typeof sub.path === "string" && sub.path.trim()) {
        flat.push({ label: sub.label, path: sub.path, _id: sub._id, parent: item, raw: sub });
      }
    });
  });
  return flat;
};

export const findMenuLink = (menu, test) => {
  const flat = flattenMenu(menu).sort((a, b) => (a.parent ? 1 : 0) - (b.parent ? 1 : 0));
  return flat.find((entry) => test(entry.label ?? "")) ?? null;
};

export const dispatchMenuSelection = (dispatch, entry) => {
  if (!entry) return;
  dispatch(menuStatus(false));
  if (entry.parent) {
    dispatch(selectedSubMenu(entry.parent));
    dispatch(openedMenu(entry.parent._id));
    dispatch(openedMenu(entry._id));
  } else {
    dispatch(selectedSubMenu(null));
  }
  dispatch(selectedMenu(entry.raw));
  dispatch(currentMenu(entry.label));
};
