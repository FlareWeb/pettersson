import { Field, ObjectType, registerEnumType } from "@nestjs/graphql";

import { WebAPITimetable, WebUntisElementType } from "webuntis";

registerEnumType(WebUntisElementType, {
  name: "WebUntisElementType",
});

export enum SubstitutionStatus {
  SUBSTITUTION = "SUBSTITUTION",
  ROOM_CHANGE = "ROOM_CHANGE",
  CANCELLED = "CANCELLED",
  STANDARD = "STANDARD", // TODO: Maybe we should remove this
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
  substitute: string;

  @Field(() => String)
  class: string;

  @Field(() => String)
  room: string;

  @Field(() => String, { nullable: true })
  note?: string;

  @Field(() => SubstitutionStatus)
  status: SubstitutionStatus;

  static fromWebUntis(timetableEntry: WebAPITimetable): Substitution {
    const substitution = new Substitution();

    substitution.period = timetableEntry.lessonNumber;
    substitution.subject =
      timetableEntry.subjects[0]?.element.longName ||
      timetableEntry.subjects[0]?.element.name ||
      "";
    substitution.substitute =
      timetableEntry.teachers[0]?.element.displayname ||
      timetableEntry.teachers[0]?.element.name ||
      "";
    substitution.class = timetableEntry.classes[0]?.element.name || "";
    substitution.room = timetableEntry.rooms[0]?.element.name || "";
    substitution.note =
      timetableEntry.substText || timetableEntry.periodInfo || undefined;

    switch (timetableEntry.cellState) {
      case "SUBSTITUTION":
        substitution.status = SubstitutionStatus.SUBSTITUTION;
        break;
      case "ROOMSUBSTITUTION":
        substitution.status = SubstitutionStatus.ROOM_CHANGE;
        break;
      case "STANDARD":
        substitution.status = SubstitutionStatus.STANDARD;
        break;
      default:
        substitution.status = SubstitutionStatus.STANDARD;
    }

    return substitution;
  }
}
