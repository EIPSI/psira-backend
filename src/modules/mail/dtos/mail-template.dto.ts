import { Field, InputType, Int } from "@nestjs/graphql";
import { AssessmentTypeEnum } from "src/modules/assessment/enums/assessment-type.enum";
import { MailTemplatePurposeEnum } from "../enums/mail-template-purpose.enum";



@InputType()
export class CreateEmailTemplate {
    @Field(() => String)
    name: string;

    @Field(() => String)
    subject?: string;

    @Field(() => String)
    body: string;

    @Field(() => AssessmentTypeEnum)
    status: AssessmentTypeEnum;

    @Field(() => MailTemplatePurposeEnum, { nullable: true })
    purpose?: MailTemplatePurposeEnum;

    @Field(() => Boolean, { defaultValue: false })
    isPublic: boolean;

    @Field(() => [Int], { nullable: true })
    departmentIds: number[];
}

@InputType()
export class UpdateEmailTemplate extends CreateEmailTemplate {
    @Field(() => Int)
    id: number
}
