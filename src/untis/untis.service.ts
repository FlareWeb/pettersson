import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { WebUntis, WebUntisElementType } from "webuntis";

import { Substitution } from "./entities/substitution.entity";

@Injectable()
export class UntisService {
  private untis: WebUntis;
  private readonly logger = new Logger(UntisService.name);

  constructor(private configService: ConfigService) {
    this.untis = new WebUntis(
      this.configService.get<string>("UNTIS_SCHOOL"),
      this.configService.get<string>("UNTIS_USERNAME"),
      this.configService.get<string>("UNTIS_PASSWORD"),
      this.configService.get<string>("UNTIS_DOMAIN")
    );
  }

  private async ensureLogin() {
    try {
      await this.untis.login();
    } catch (error) {
      this.logger.error("Failed to login to WebUntis:", error);
      throw new Error("Failed to connect to WebUntis");
    }
  }

  async getTodaySubstitutions(): Promise<string> {
    await this.ensureLogin();

    const teachers = await this.untis.getTeachers();
    const timetables = await Promise.all(
      teachers.map((teacher) =>
        this.untis.getTimetableForToday(teacher.id, WebUntisElementType.TEACHER)
      ), 
    );

    return timetables.toString(); // timetable.map((entry) => Substitution.fromWebUntis(entry));
  }

  // TODO: Possibly write an implementation for a range of dates
  async getSubstitutionsForDate(date: Date): Promise<Substitution[]> {
    await this.ensureLogin();

    const timetable = await this.untis.getTimetableForRange(
      date,
      date,
      0,
      WebUntisElementType.CLASS
    );

    return []; // timetable.map((entry) => Substitution.fromWebUntis(entry));
  }
}
