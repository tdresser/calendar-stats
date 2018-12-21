export class CalendarEvent {
    summary: string;
    start: Date;
    end: Date;
    myResponse: string;
    duration: number;
    oneOnOneAttendee: string;
    type: string;
    constructor(
        summary : string,
        start : Date,
        end : Date,
        myResponse : string,
        oneOnOneAttendee : string) {
      this.summary = summary;
      this.start = start;
      this.end = end;
      this.myResponse = myResponse;
      this.duration = end.getTime() - start.getTime();
      this.oneOnOneAttendee = oneOnOneAttendee;
      this.type = "Uncategorized";
      if (this.oneOnOneAttendee)
        this.type = "One on one";
    }

    toRow() {
      return [this.summary, this.start.getTime(), this.end.getTime(), this.duration / 60 / 1000, this.oneOnOneAttendee];
    }
  }