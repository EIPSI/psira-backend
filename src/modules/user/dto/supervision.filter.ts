import { ArgsType, Field, Int } from '@nestjs/graphql';
import { PaginationArgs } from 'src/shared/pagination/types/pagination.args';

@ArgsType()
export class SupervisionFilter extends PaginationArgs {
    @Field({ nullable: true })
    searchKeyword?: string;

    @Field(() => Int, { nullable: true })
    therapistId?: number;

    @Field(() => Int, { nullable: true })
    supervisorId?: number;
}
