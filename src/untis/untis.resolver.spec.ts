import { Test, TestingModule } from "@nestjs/testing";

import { UntisResolver } from "./untis.resolver";
import { UntisService } from "./untis.service";

describe("UntisResolver", () => {
  let resolver: UntisResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UntisResolver, UntisService],
    }).compile();

    resolver = module.get<UntisResolver>(UntisResolver);
  });

  it("should be defined", () => {
    expect(resolver).toBeDefined();
  });
});
