import { Injectable, NotFoundException } from '@nestjs/common';
import { Disclaimer } from '../models/disclaimer.model';

@Injectable()
export class DisclaimerService {
    async getDisclaimers(departmentId?: number): Promise<Disclaimer[]> {
        const data = await Disclaimer.find();

        if (!departmentId) return data;
        const overrides = await Disclaimer.getRepository().query(
            'SELECT type, description, "updatedAt" FROM department_disclaimer WHERE "departmentId" = $1', [departmentId],
        );
        return data.map(row => Object.assign(row, overrides.find(override => override.type === row.type) || {}));
    }

    async updateDisclaimer(input): Promise<any> {
        const disclaimer = await Disclaimer.findOne({ type: input.type });

        if (!disclaimer)
            throw new NotFoundException('Disclaimer type not found!');

        if (input.departmentId) {
            const rows = await Disclaimer.getRepository().query(
                `INSERT INTO department_disclaimer("departmentId",type,description,"updatedAt") VALUES($1,$2,$3,now())
                 ON CONFLICT("departmentId",type) DO UPDATE SET description=EXCLUDED.description,"updatedAt"=now()
                 RETURNING type,description,"updatedAt"`, [input.departmentId, input.type, input.description],
            );
            return Object.assign(disclaimer, rows[0]);
        }
        disclaimer.description = input.description;

        await disclaimer.save();

        return disclaimer;
    }
}
