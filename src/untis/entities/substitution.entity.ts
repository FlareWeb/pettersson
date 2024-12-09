import { Field, ObjectType, registerEnumType } from "@nestjs/graphql";

import { WebAPITimetable, WebUntisElementType } from "webuntis";

registerEnumType(WebUntisElementType, {
  name: "WebUntisElementType",
});

export enum SubstitutionStatus {
  ROOM_CHANGE = "ROOM_CHANGE",
  SUBSTITUTION = "SUBSTITUTION",
  RESCHEDULED = "RESCHEDULED",
  CANCELLED = "CANCELLED",
}

registerEnumType(SubstitutionStatus, {
  name: "SubstitutionStatus",
});

@ObjectType()
export class Substitution {
  @Field(() => [Number])
  periods: number[];

  @Field(() => String)
  subject: string;

  @Field(() => [String])
  teachers: string[];

  @Field(() => [String])
  classes: string[];

  @Field(() => [String])
  rooms: string[];

  @Field(() => String, { nullable: true })
  note?: string;

  @Field(() => SubstitutionStatus)
  status: SubstitutionStatus;

  static from(lesson: WebAPITimetable, periods: number[]): Substitution {
    const substitution = new Substitution();

    substitution.periods = periods;
    // TODO: longName should also be shown when the user clicks on the substitution | preferably alternateName over longName
    const subject = lesson.subjects[0]?.element;
    substitution.subject =
      subject.longName.length > 16 || subject.longName.split(" ").length > 1 // If has more than one space, show displayname (short)
        ? subject.alternatename || subject.displayname
        : subject.longName;
    // TODO: THIS IS NOT THE SUBSTITUTE | remove ---
    substitution.teachers = lesson.teachers
      .map((t) => t.element.name)
      .filter((t, i, arr) => arr.indexOf(t) === i);
    substitution.classes = lesson.classes.length
      ? lesson.classes.map((c) => c.element.displayname)
      : [lesson.studentGroup];
    substitution.rooms = lesson.rooms.map((r) => r.element.displayname);
    substitution.note = lesson.substText || lesson.periodText || undefined; // Teachers don't know how to use untis bruh

    // TODO: Use lesson.is... instead
    substitution.status = (() => {
      switch (lesson.cellState as UntisCellState) {
        case "ROOMSUBSTITUTION":
          return SubstitutionStatus.ROOM_CHANGE;
        case "SUBSTITUTION":
          return SubstitutionStatus.SUBSTITUTION;
        case "SHIFT":
          return SubstitutionStatus.RESCHEDULED; // TODO: Handle special cases (like send updated times when provided)
        case "CANCEL":
        case "WITHOUTELEMCANCEL":
          return SubstitutionStatus.CANCELLED;
        default:
          throw new Error(`Unknown substitution status: ${lesson.cellState}`);
      }
    })(); // TODO: Technically we should use a map O(1) instead of a switch O(n) but we're gonna use the bool thing anyway

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
