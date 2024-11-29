import { Module } from "@nestjs/common";

import { TodoResolver } from "@/todo/todo.resolver";
import { TodoService } from "@/todo/todo.service";

@Module({
  providers: [TodoResolver, TodoService],
})
export class TodoModule {}
