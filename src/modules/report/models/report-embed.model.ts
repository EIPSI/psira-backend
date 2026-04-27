import { Field, ObjectType } from '@nestjs/graphql';
import { Report } from './report.model';

@ObjectType()
export class ReportEmbed {
    @Field(() => Report)
    report: Report;

    @Field()
    embedUrl: string;

    @Field()
    expiresAt: Date;
}
