import { Field, InputType } from '@nestjs/graphql';
import { IsIn } from 'class-validator';

@InputType()
export class UserRelationSortInput {
    @Field()
    @IsIn(['roles', 'departments'])
    field: string;

    @Field()
    @IsIn(['ASC', 'DESC'])
    direction: 'ASC' | 'DESC';
}
