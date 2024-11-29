import { NestFactory } from "@nestjs/core";

import { AppModule } from "@/app.module";

// TODO: Sort imports

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
