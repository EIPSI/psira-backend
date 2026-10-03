import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationModule } from '../notification/notification.module';
import { AssignmentRequest } from './models/assignment-request.model';
import { AssignmentRequestResolver } from './resolvers/assignment-request.resolver';
import { AssignmentRequestService } from './services/assignment-request.service';

@Module({
    imports: [NotificationModule, TypeOrmModule.forFeature([AssignmentRequest])],
    providers: [AssignmentRequestResolver, AssignmentRequestService],
    exports: [AssignmentRequestService],
})
export class AssignmentRequestModule {}
