import { TYPE_ONE_ON_ONE, TYPE_UNCATEGORIZED } from "./constants.js";

export class CalendarEvent {
    summary: string;
    start: Date;
    end: Date;
    duration: number;
    oneOnOneAttendee: string;
    type: string;
    constructor(
        summary : string,
        start : Date,
        end : Date,
        oneOnOneAttendee : string) {
      this.summary = summary;
      this.start = start;
      this.end = end;
      this.duration = end.getTime() - start.getTime();
      this.oneOnOneAttendee = oneOnOneAttendee;
      this.type = TYPE_UNCATEGORIZED;
      if (this.oneOnOneAttendee)
        this.type = TYPE_ONE_ON_ONE;
    }

    toRow() {
      return [this.summary, this.start.getTime(), this.end.getTime(), this.duration / 60 / 1000, this.oneOnOneAttendee];
    }
  }