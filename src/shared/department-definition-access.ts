import { getRepository } from 'typeorm';
import { projectDepartments, resourceDepartmentIds } from './project-resource-access';

/** Keep shared defaults readable while isolating project-owned definitions. */
export async function departmentDefinitionFilter(model: string, context: any): Promise<any> {
    const userId = context?.req?.user?.id;
    if (!userId) return {};
    const owned = await projectDepartments(userId);
    if (!owned) return {};
    const rows = await getRepository(model).find();
    const ids = rows.filter(row => {
        const departments = resourceDepartmentIds(row);
        return !departments.length || departments.some(id => owned.includes(id));
    }).map((row: any) => row.id);
    return { id: { in: ids.length ? ids : [0] } };
}
