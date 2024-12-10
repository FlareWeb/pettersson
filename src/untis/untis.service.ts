import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { createHash } from "crypto";
import {
  TimeUnit,
  WebAPITimetable,
  WebUntis,
  WebUntisDay,
  WebUntisElementType,
} from "webuntis";

import { Substitution, UntisCellState } from "./entities/substitution.entity";

// TODO: Add logging
@Injectable()
export class UntisService implements OnModuleInit {
  private untis: WebUntis;
  private readonly logger = new Logger(UntisService.name);
  private readonly substitutions: Map<number, Substitution[]> = new Map();
  private readonly timegrid: Map<WebUntisDay, TimeUnit[]> = new Map(); // TODO: THIS DATA IS ONLY FETCHED ONCE!
  private lastTimetableHash: string = "";
  private lastUpdateTime: number = 0;

  constructor(private configService: ConfigService) {
    this.untis = new WebUntis(
      this.configService.get<string>("UNTIS_SCHOOL"),
      this.configService.get<string>("UNTIS_USERNAME"),
      this.configService.get<string>("UNTIS_PASSWORD"),
      this.configService.get<string>("UNTIS_DOMAIN")
    );
  }

  async onModuleInit() {
    this.logger.debug("App is starting. Running initial timetable fetch...");
    try {
      await this.fetchTimegrid();
      await this.checkForTimetableChanges();
    } catch (error) {
      this.logger.error("Failed during initial timetable fetch:", error);
    }
  }

  private async ensureLogin() {
    if (await this.untis.validateSession()) return;

    try {
      await this.untis.login();
    } catch (error) {
      this.logger.error("Failed to login to WebUntis:", error);
      throw new Error("Failed to connect to WebUntis");
    }
  }

  private async fetchTimegrid() {
    this.logger.debug("Fetching timegrid...");

    await this.ensureLogin();

    const timegrid = await this.untis.getTimegrid();
    for (const day of timegrid) this.timegrid.set(day.day, day.timeUnits);
  }

  private async fetchTimetable(): Promise<WebAPITimetable[]> {
    this.logger.debug("Fetching timetable...");

    await this.ensureLogin();

    const schoolyear = await this.untis.getCurrentSchoolyear();
    const classes = await this.untis.getClasses(false, schoolyear.id);

    const chunkArray = <T>(arr: T[], size: number): T[][] =>
      Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
      );

    const chunks = chunkArray(classes, 10); // Chunks of 10 classes
    const timetable: WebAPITimetable[] = [];

    // Process each chunk with a delay to avoid rate limiting
    for (const chunk of chunks) {
      this.logger.verbose(
        `Fetching timetable for ${chunks.indexOf(chunk) + 1}/${chunks.length}...`
      );
      const chunkLessons = await Promise.all(
        chunk.map((class_) =>
          this.untis.getTimetableForWeek(
            new Date(),
            class_.id,
            WebUntisElementType.CLASS
          )
        )
      );
      timetable.push(...chunkLessons.flat());

      await new Promise((resolve) => setTimeout(resolve, 1000)); // Delay for 1 second
    }

    return timetable;
  }

  private getPeriod(lesson: WebAPITimetable): number {
    const startTime = lesson.startTime;
    const endTime = lesson.endTime;
    const day = WebUntis.convertUntisDate(lesson.date.toString()).getDay() + 1; // TODO: Goofy ahh skibidi performance

    const daySchedule = this.timegrid.get(day);
    if (!daySchedule)
      throw new Error(`No schedule found for day ${WebUntisDay[day]}`);

    const periodName = daySchedule.find(
      (unit) =>
        (startTime >= unit.startTime && startTime < unit.endTime) ||
        (endTime > unit.startTime && endTime <= unit.endTime) ||
        (startTime <= unit.startTime && endTime >= unit.endTime)
    ).name;
    return parseInt(periodName);
  }

  private generateTimetableHash(timetable: WebAPITimetable[]): string {
    const timetableString = JSON.stringify(timetable);
    return createHash("md5").update(timetableString).digest("hex");
  }

  private async processTimetableChanges(timetable: WebAPITimetable[]) {
    const IGNORED_STATUSES = new Set<UntisCellState>([
      "STANDARD",
      "WITHOUTELEM",
      "EXAM",
      "ADDITIONAL",
    ]);

    this.substitutions.clear();

    const lessonGroups = timetable.reduce((groups, lesson) => {
      const status = lesson.cellState as UntisCellState; // TODO: Possibly use lesson.is. ... instead
      if (IGNORED_STATUSES.has(status)) return groups;

      const groupKey = `${lesson.lessonId}_${lesson.date}`;

      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(lesson);

      return groups;
    }, new Map<string, WebAPITimetable[]>());

    for (const lessons of lessonGroups.values()) {
      const lesson = lessons[0];
      const periods = lessons
        .map((lesson) => this.getPeriod(lesson))
        .filter((value, index, self) => self.indexOf(value) === index)
        .sort((a, b) => a - b);

      const substitution = Substitution.from(lesson, periods);

      const date = lesson.date;
      if (!this.substitutions.has(date)) this.substitutions.set(date, []);
      this.substitutions.get(date).push(substitution);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async checkForTimetableChanges() {
    try {
      this.logger.debug("Checking for timetable changes...");
      const newTimetable = await this.fetchTimetable();
      const newHash = this.generateTimetableHash(newTimetable);

      if (newHash === this.lastTimetableHash) {
        this.logger.debug("No timetable changes detected.");
        return;
      }

      this.logger.log("Timetable changes detected, updating cache...");
      this.processTimetableChanges(newTimetable);

      this.lastTimetableHash = newHash;
      this.lastUpdateTime = Date.now();
    } catch (error) {
      this.logger.error("Failed to check for timetable changes:", error);
    }
  }

  // TODO: Maybe use subscriptions to notify clients of changes
  hasChangedSince(timestamp: number): boolean {
    return this.lastUpdateTime > timestamp;
  }

  getTodaySubstitutions(): Substitution[] {
    return this.getSubstitutionsFor(new Date());
  }

  // TODO: Possibly also write an implementation for a range of dates | refetch if date is not in timetable range (=current week)
  getSubstitutionsFor(date: Date): Substitution[] {
    const dateNumber = Number(WebUntis.convertDateToUntis(date));
    return this.substitutions.get(dateNumber) || [];
  }
}
