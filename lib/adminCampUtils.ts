import { campStatuses, type Camp, type CampStatus } from "./types";

const defaultAdminStatusOptions = [
  "draft",
  "approved",
  "hidden",
  "archived",
] as const satisfies readonly CampStatus[];

export function getAdminStatusOptions(camps: Pick<Camp, "status">[]) {
  const existingStatuses = camps
    .map((camp) => String(camp.status ?? "").trim())
    .filter(Boolean);
  return Array.from(
    new Set([...defaultAdminStatusOptions, ...existingStatuses]),
  ).sort((a, b) => {
    const aIndex = campStatuses.indexOf(a as CampStatus);
    const bIndex = campStatuses.indexOf(b as CampStatus);
    if (aIndex !== -1 || bIndex !== -1)
      return (
        (aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex) -
        (bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex)
      );
    return a.localeCompare(b);
  });
}

export function toggleCampSelection(
  selectedIds: string[],
  campId: string,
  checked: boolean,
) {
  const selected = new Set(selectedIds);
  if (checked) selected.add(campId);
  else selected.delete(campId);
  return Array.from(selected);
}

export function selectAllVisibleCampIds(
  selectedIds: string[],
  visibleCamps: Pick<Camp, "camp_id">[],
  checked: boolean,
) {
  const selected = new Set(selectedIds);
  visibleCamps.forEach((camp) => {
    if (checked) selected.add(camp.camp_id);
    else selected.delete(camp.camp_id);
  });
  return Array.from(selected);
}

export function bulkUpdateCampStatus(
  camps: Camp[],
  selectedIds: string[],
  status: CampStatus,
) {
  const selected = new Set(selectedIds);
  return camps.map((camp) =>
    selected.has(camp.camp_id) ? { ...camp, status } : camp,
  );
}
