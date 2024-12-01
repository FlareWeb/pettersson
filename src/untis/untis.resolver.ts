import { Args, Query, Resolver } from "@nestjs/graphql";

import { Substitution } from "./entities/substitution.entity";
import { UntisService } from "./untis.service";

// TODO: Make this authorized
@Resolver(() => Substitution)
export class UntisResolver {
  constructor(private readonly untisService: UntisService) {}

  @Query(() => [Substitution])
  async todaySubstitutions(): Promise<Substitution[]> {
    return this.untisService.getTodaySubstitutions();
  }

  @Query(() => [Substitution])
  async substitutionsForDate(
    @Args("date", { type: () => Date }) date: Date
  ): Promise<Substitution[]> {
    return this.untisService.getSubstitutionsForDate(date);
  }
}
