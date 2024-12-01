import { Module } from "@nestjs/common";

import { UntisResolver } from "./untis.resolver";
import { UntisService } from "./untis.service";

@Module({
  providers: [UntisResolver, UntisService],
})
export class UntisModule {}
