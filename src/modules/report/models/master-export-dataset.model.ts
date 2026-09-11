import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MasterExportFilter {
    @Field()
    key: string;

    @Field()
    label: string;

    @Field()
    type: string;

    @Field(() => Boolean)
    required: boolean;
}

@ObjectType()
export class MasterExportDataset {
    @Field()
    key: string;

    @Field()
    label: string;

    @Field()
    description: string;

    @Field()
    source: string;

    @Field()
    sensitivity: string;

    @Field(() => [String])
    supportedProcessingModes: string[];

    @Field(() => [MasterExportFilter])
    filters: MasterExportFilter[];

    @Field(() => [String])
    requiredPermissions: string[];

    @Field(() => Boolean)
    available: boolean;
}
