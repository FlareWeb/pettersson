import { Args, Int, Mutation, Query, Resolver } from "@nestjs/graphql";

import { CreateTodoInput } from "./dto/create-todo.input";
import { UpdateTodoInput } from "./dto/update-todo.input";
import { Todo } from "./entities/todo.entity";
import { TodoService } from "./todo.service";

@Resolver(() => Todo)
export class TodoResolver {
  constructor(private readonly todoService: TodoService) {}

  @Mutation(() => Todo)
  createTodo(@Args("createTodoInput") createTodoInput: CreateTodoInput) {
    return this.todoService.create(createTodoInput);
  }

  @Query(() => [Todo], { name: "todo" })
  findAll() {
    return this.todoService.findAll();
  }

  @Query(() => Todo, { name: "todo" })
  findOne(@Args("id", { type: () => Int }) id: number) {
    return this.todoService.findOne(id);
  }

  @Mutation(() => Todo)
  updateTodo(@Args("updateTodoInput") updateTodoInput: UpdateTodoInput) {
    return this.todoService.update(updateTodoInput.id, updateTodoInput);
  }

  @Mutation(() => Todo)
  removeTodo(@Args("id", { type: () => Int }) id: number) {
    return this.todoService.remove(id);
  }
}
