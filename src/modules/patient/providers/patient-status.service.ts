import { BadRequestException } from '@nestjs/common';
import { PatientStatus } from '../models/patient-status.model';

export class PatientStatusService {
    async create(input): Promise<any> {
        const patientStatusInput = this.normalizePatientStatusInput(input?.patientStatus || input?.input?.patientStatus || input?.input || input);
        const newPatientStatus = new PatientStatus();

        newPatientStatus.name = patientStatusInput.name;
        newPatientStatus.description = patientStatusInput.description;

        return newPatientStatus.save();
    }

    private normalizePatientStatusInput(patientStatus?: { name?: string; description?: string }): { name: string; description: string } {
        const name = patientStatus?.name?.trim();
        if (!name) {
            throw new BadRequestException('Patient status name is required');
        }

        return {
            name,
            description: patientStatus.description?.trim() || '',
        };
    }
}
