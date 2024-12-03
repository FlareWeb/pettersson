import { Field, ObjectType, registerEnumType } from "@nestjs/graphql";

import { WebAPITimetable, WebUntisElementType } from "webuntis";

registerEnumType(WebUntisElementType, {
  name: "WebUntisElementType",
});

export enum SubstitutionStatus {
  SUBSTITUTION = "SUBSTITUTION",
  ROOM_CHANGE = "ROOM_CHANGE",
  RESCHEDULED = "RESCHEDULED",
  CANCELLED = "CANCELLED",
}

registerEnumType(SubstitutionStatus, {
  name: "SubstitutionStatus",
});

@ObjectType()
export class Substitution {
  @Field(() => Number)
  period: number;

  @Field(() => String)
  subject: string;

  @Field(() => String)
  teacher: string;

  @Field(() => String)
  class: string;

  @Field(() => String)
  room: string;

  @Field(() => String, { nullable: true })
  note?: string;

  @Field(() => SubstitutionStatus)
  status: SubstitutionStatus;

  static parse(lesson: WebAPITimetable): Substitution {
    // A const maps for the periods based on the start and end times
    const substitution = new Substitution();

    const toMinutes = (time: number) => {
      const hours = Math.floor(time / 100);
      const minutes = time % 100;
      return hours * 60 + minutes;
    };

    const periodDuration =
      toMinutes(lesson.endTime) - toMinutes(lesson.startTime);
    substitution.period = periodDuration; // TODO: Calculate this using getTimegrid

    // TODO: longName should also be shown when the user clicks on the substitution | preferably alternateName over longName
    // Subjects
    substitution.subject = lesson.subjects[0]?.element.displayname;

    // TODO: THIS IS NOT THE SUBSTITUTE | remove --- and duplicates
    // Teachers
    const lessonTeachers = lesson.teachers;
    substitution.teacher =
      lessonTeachers.length === 1
        ? lessonTeachers[0]?.element.name
        : lessonTeachers.map((t) => t.element.name).join(", ");

    // Classes
    const lessonClasses = lesson.classes;
    substitution.class =
      lesson.studentGroup || lessonClasses.length === 1
        ? lessonClasses[0]?.element.displayname
        : lessonClasses.map((c) => c.element.displayname).join(", "); // TODO: Check if this is good

    // Rooms
    const lessonRooms = lesson.rooms;
    substitution.room =
      lessonRooms.length === 1
        ? lessonRooms[0].element.displayname
        : lessonRooms.map((r) => r.element.displayname).join(", "); // TODO: Check if this is good

    substitution.note = lesson.substText || lesson.periodText || undefined; // Teachers don't know how to use untis bruh

    // TODO: Use lesson.is... instead
    substitution.status = (() => {
      switch (lesson.cellState as UntisCellState) {
        case "SUBSTITUTION":
          return SubstitutionStatus.SUBSTITUTION;
        case "ROOMSUBSTITUTION":
          return SubstitutionStatus.ROOM_CHANGE;
        case "SHIFT":
          return SubstitutionStatus.RESCHEDULED; // TODO: Handle special cases (like send updated times when provided)
        case "CANCEL":
        case "WITHOUTELEMCANCEL":
          return SubstitutionStatus.CANCELLED;
        default:
          throw new Error(`Unknown substitution status: ${lesson.cellState}`);
      }
    })();

    return substitution;
  }
}

export type UntisCellState =
  | "STANDARD"
  | "EXAM" // TODO: We could use this
  | "SUBSTITUTION"
  | "ROOMSUBSTITUTION"
  | "CANCEL"
  | "SHIFT" // TODO: What is this?
  | "ADDITIONAL" // TODO: This too. It's for special events
  | "WITHOUTELEM" // This is just stuff like watching the caffeteria
  | "WITHOUTELEMCANCEL";
