import { Field, InputType, Int } from "@nestjs/graphql";

@InputType()
export class CreateUntiInput {
  @Field(() => Int, { description: "Example field (placeholder)" })
  exampleField: number;
}
