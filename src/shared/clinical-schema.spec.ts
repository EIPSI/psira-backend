jest.mock('argon2', () => ({ hash: jest.fn(), verify: jest.fn() }));
import { CRUDResolver } from '@nestjs-query/query-graphql';
import { ClinicalSession } from 'src/modules/clinical-session/models/clinical-session.model';
import { ClinicalSessionResource } from 'src/modules/clinical-session/models/clinical-session-resource.model';
import { Assessment } from 'src/modules/assessment/models/assessment.model';
import { Patient } from 'src/modules/patient/models/patient.model';
import { CalendarOccurrence } from 'src/modules/calendar/models/calendar-occurrence.model';
import { GraphQLSchemaBuilderModule, GraphQLSchemaFactory } from '@nestjs/graphql';
import { NestFactory } from '@nestjs/core';
import { printSchema } from 'graphql';
import { writeFileSync } from 'fs';
import { UserCrudResolver } from 'src/modules/user/resolvers/user-crud.resolver';
import { CalendarEventResolver } from 'src/modules/calendar/resolvers/calendar-event.resolver';
import { ClinicalSessionResolver } from 'src/modules/clinical-session/resolvers/clinical-session.resolver';
import { NotificationConfigurationResolver } from 'src/modules/notification/resolvers/notification-configuration.resolver';
import { InformedConsentResponseResolver } from 'src/modules/informed-consent/resolvers/informed-consent-response.resolver';
import { EvaluationSchemeGenerationResolver } from 'src/modules/evaluation-scheme/resolvers/evaluation-scheme-generation.resolver';

it('exposes the clinical calendar, scoped consents and batch configuration contract', async () => {
    const app = await NestFactory.createApplicationContext(GraphQLSchemaBuilderModule, { logger: false });
    try {
        // Match the relation-only CRUD resolvers registered by the application modules.
        const relationResolvers = ([ClinicalSession, ClinicalSessionResource, Assessment, Patient, CalendarOccurrence] as any[])
            .map(model => CRUDResolver(model, { read: { disabled: true }, create: { disabled: true },
                update: { disabled: true }, delete: { disabled: true } }));
        const schema = await app.get(GraphQLSchemaFactory).create([...relationResolvers, UserCrudResolver, CalendarEventResolver, ClinicalSessionResolver,
            NotificationConfigurationResolver, InformedConsentResponseResolver, EvaluationSchemeGenerationResolver]);
        const text = printSchema(schema);
        expect(text).toContain('calendarTargets: [User!]!');
        expect(text).toContain('saveNotificationConfigurations');
        expect(text).toContain('input SaveNotificationConfigurationsInput');
        expect(schema.getQueryType().getFields().informedConsentResponses.args.map(arg => arg.name).sort()).toEqual(['patientId', 'userId']);
        expect(text).toContain('canEdit: Boolean!');
        if (process.env.PSIRA_CLINICAL_SCHEMA_PATH) writeFileSync(process.env.PSIRA_CLINICAL_SCHEMA_PATH, text);
    } finally { await app.close(); }
}, 30000);
