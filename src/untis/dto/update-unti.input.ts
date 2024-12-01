import { Field, InputType, Int, PartialType } from "@nestjs/graphql";

import { CreateUntiInput } from "./create-unti.input";

@InputType()
export class UpdateUntiInput extends PartialType(CreateUntiInput) {
  @Field(() => Int)
  id: number;
}
