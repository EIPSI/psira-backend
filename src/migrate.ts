import 'reflect-metadata';
import { createConnection } from 'typeorm';
import { configService } from './config/config.service';

async function runMigrations(): Promise<void> {
    const connection = await createConnection({
        ...configService.getTypeOrmConfig(),
        migrationsRun: false,
    });

    try {
        const migrations = await connection.runMigrations();
        if (migrations.length) {
            console.log(`Applied ${migrations.length} database migration(s).`);
        } else {
            console.log('No pending database migrations.');
        }
    } finally {
        await connection.close();
    }
}

runMigrations().catch(error => {
    console.error('Database migration failed.');
    console.error(error);
    process.exit(1);
});
