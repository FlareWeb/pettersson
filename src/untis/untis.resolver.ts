import { Args, Query, Resolver } from "@nestjs/graphql";

import { Substitution } from "./entities/substitution.entity";
import { UntisService } from "./untis.service";

// TODO: Make this authorized
@Resolver()
export class UntisResolver {
  constructor(private readonly untisService: UntisService) {}

  @Query(() => Boolean)
  async hasChangedSince(
    @Args("lastCheck", { type: () => Number }) lastCheck: number
  ): Promise<boolean> {
    return this.untisService.hasChangedSince(lastCheck);
  }

  @Query(() => [Substitution])
  async todaySubstitutions(): Promise<Substitution[]> {
    return this.untisService.getTodaySubstitutions();
  }

  @Query(() => [Substitution])
  async substitutionsFor(
    @Args("date", { type: () => Date }) date: Date
  ): Promise<Substitution[]> {
    return this.untisService.getSubstitutionsFor(date);
  }
}
