import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Cron, CronExpression } from "@nestjs/schedule";

import { createHash } from "crypto";
import { WebAPITimetable, WebUntis, WebUntisElementType } from "webuntis";

import { Substitution, UntisCellState } from "./entities/substitution.entity";

// TODO: Add logging
@Injectable()
export class UntisService implements OnModuleInit {
  private untis: WebUntis;
  private readonly logger = new Logger(UntisService.name);
  private readonly substitutions: Map<number, Substitution[]> = new Map();
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

    const processedLessonIds = new Set<number>();

    for (const lesson of timetable) {
      const status = lesson.cellState as UntisCellState; // TODO: Possibly use lesson.is. ... instead
      // If is substitution and has not been processed yet -> create substitution
      if (
        IGNORED_STATUSES.has(status) ||
        processedLessonIds.has(lesson.lessonId)
      )
        continue;

      const substitution = Substitution.parse(lesson);

      const dateSubstitutions = this.substitutions.get(lesson.date) || [];
      if (!this.substitutions.has(lesson.date))
        this.substitutions.set(lesson.date, []);

      dateSubstitutions.push(substitution);
      processedLessonIds.add(lesson.lessonId);
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
