import {
  TYPE_MEETING_RECURRING,
  TYPE_MEETING_NON_RECURRING,
  TYPE_ONE_ON_ONE_RECURRING,
  TYPE_ONE_ON_ONE_NON_RECURRING,
  TYPE_FOCUS_RECURRING,
  TYPE_FOCUS_NON_RECURRING,
} from "./constants.js";

export class CalendarEvent {
    summary: string;
    start: Date;
    end: Date;
    duration: number;
    attendeeCount: number;
    recurring: boolean;
    type: string;
    constructor(
        summary: string,
        start: Date,
        end: Date,
        attendeeCount: number,
        recurring: boolean) {
      this.summary = summary;
      this.start = start;
      this.end = end;
      this.duration = end.getTime() - start.getTime();
      this.attendeeCount = attendeeCount;
      this.recurring = recurring;

      if (this.attendeeCount == 0) {
        if (this.recurring)
          this.type = TYPE_FOCUS_RECURRING;
        else
          this.type = TYPE_FOCUS_NON_RECURRING;
      }
      else if (this.attendeeCount == 1) {
        if (this.recurring)
          this.type = TYPE_ONE_ON_ONE_RECURRING;
        else
          this.type = TYPE_ONE_ON_ONE_NON_RECURRING;
      } else {
        if (this.recurring)
          this.type = TYPE_MEETING_RECURRING;
        else
          this.type = TYPE_MEETING_NON_RECURRING
      }
    }
  }