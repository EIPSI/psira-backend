import { MigrationInterface, QueryRunner } from 'typeorm';

const events = [
    {
        event: 'CASE_MANAGER_ASSIGNMENT_REQUEST',
        templateName: 'Solicitud de administrador de caso',
        subject: 'Nueva solicitud para administrar un caso en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>{{assignment.requesterName}} te solicitó aceptar una asignación como administrador de caso.</p><p>Paciente: <strong>{{assignment.targetName}}</strong></p><p>Podés aceptar o rechazar la solicitud desde el panel general.</p><p><a href="{{assignment.link}}">Ir al panel de control</a></p>',
        roles: ['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'THERAPIST'],
        notes: 'Configuración por defecto: email al usuario cuando recibe una solicitud de administración de caso.',
    },
    {
        event: 'CASE_SUPERVISOR_ASSIGNMENT_REQUEST',
        templateName: 'Solicitud de supervisor de terapeuta',
        subject: 'Nueva solicitud de supervisión en PSIRA',
        body: '<p>Hola {{recipient.firstName}},</p><p>{{assignment.requesterName}} te solicitó aceptar una asignación como supervisor.</p><p>Terapeuta: <strong>{{assignment.targetName}}</strong></p><p>Podés aceptar o rechazar la solicitud desde el panel general.</p><p><a href="{{assignment.link}}">Ir al panel de control</a></p>',
        roles: ['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'SUPERVISOR'],
        notes: 'Configuración por defecto: email al usuario cuando recibe una solicitud de supervisión de terapeuta.',
    },
];

export class AssignmentRequests1790700000000 implements MigrationInterface {
    name = 'AssignmentRequests1790700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "assignment_request" (
                "id" SERIAL NOT NULL,
                "kind" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'PENDING',
                "patientId" integer,
                "therapistId" integer,
                "assigneeId" integer NOT NULL,
                "requesterId" integer NOT NULL,
                "respondedAt" TIMESTAMP,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_assignment_request" PRIMARY KEY ("id"),
                CONSTRAINT "CHK_assignment_request_scope" CHECK (
                    ("kind" = 'CASE_MANAGER' AND "patientId" IS NOT NULL AND "therapistId" IS NULL)
                    OR ("kind" = 'SUPERVISOR' AND "therapistId" IS NOT NULL AND "patientId" IS NULL)
                ),
                CONSTRAINT "CHK_assignment_request_status" CHECK ("status" IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
                CONSTRAINT "CHK_assignment_request_kind" CHECK ("kind" IN ('CASE_MANAGER', 'SUPERVISOR'))
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_assignment_request_pending_case_manager"
            ON "assignment_request" ("patientId", "assigneeId")
            WHERE "kind" = 'CASE_MANAGER' AND "status" = 'PENDING'
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "UQ_assignment_request_pending_supervisor"
            ON "assignment_request" ("therapistId", "assigneeId")
            WHERE "kind" = 'SUPERVISOR' AND "status" = 'PENDING'
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "assignment_request"
                ADD CONSTRAINT "FK_assignment_request_patient"
                FOREIGN KEY ("patientId") REFERENCES "patient"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "assignment_request"
                ADD CONSTRAINT "FK_assignment_request_therapist"
                FOREIGN KEY ("therapistId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "assignment_request"
                ADD CONSTRAINT "FK_assignment_request_assignee"
                FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "assignment_request"
                ADD CONSTRAINT "FK_assignment_request_requester"
                FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN null;
            END $$;
        `);

        for (const item of events) {
            await queryRunner.query(`
                DO $$ BEGIN
                    ALTER TYPE "notification_configuration_event_enum" ADD VALUE IF NOT EXISTS '${item.event}';
                EXCEPTION WHEN undefined_object THEN null;
                END $$;
            `);
            await queryRunner.query(`
                DO $$ BEGIN
                    ALTER TYPE "notification_log_event_enum" ADD VALUE IF NOT EXISTS '${item.event}';
                EXCEPTION WHEN undefined_object THEN null;
                END $$;
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "assignment_request"`);
    }
}
