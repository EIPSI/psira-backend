export function uniqueDepartmentIds(departmentIds?: number[]): number[] {
    return [...new Set((departmentIds || []).filter(id => id !== undefined && id !== null))];
}

export function areDepartmentsCompatible(
    containerDepartmentIds?: number[],
    itemDepartmentIds?: number[],
): boolean {
    const containerIds = uniqueDepartmentIds(containerDepartmentIds);
    const itemIds = uniqueDepartmentIds(itemDepartmentIds);

    if (!containerIds.length || !itemIds.length) return true;
    return itemIds.some(id => containerIds.includes(id));
}

export function coversAllSelectedDepartments(
    selectedDepartmentIds?: number[],
    itemDepartmentIds?: number[],
): boolean {
    const selectedIds = uniqueDepartmentIds(selectedDepartmentIds);
    const itemIds = uniqueDepartmentIds(itemDepartmentIds);

    if (!selectedIds.length || !itemIds.length) return true;
    return selectedIds.every(id => itemIds.includes(id));
}
