import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ShinyApp {
    @Field()
    appName: string;

    @Field()
    title: string;

    @Field()
    url: string;
}
