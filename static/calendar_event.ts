import {
  TYPE_MEETING_RECURRING,
  TYPE_MEETING_NON_RECURRING,
  TYPE_ONE_ON_ONE_RECURRING,
  TYPE_ONE_ON_ONE_NON_RECURRING,
  TYPE_FOCUS_RECURRING,
  TYPE_FOCUS_NON_RECURRING,
  TYPE_COLORS,
  TYPES,
  CALENDAR_ID,
} from "./constants.js";

export class CalendarEvent {
  eventId: string;
  colorId: number;
  type: string;
  summary: string;
  start: Date;
  end: Date;
  duration: number;
  attendeeCount: number;
  recurringEventId: string;

  static async fetchEventWithId(eventId: string) {
    const response = await gapi.client.calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId: eventId,
    });
    return new CalendarEvent(response.result);
  }

  getTargetColorId() {
    return TYPE_COLORS[TYPES.indexOf(this.type)];
  }

  static parseDate(dateString: string): Date {
    let parts = dateString.split('T');
    parts[0] = parts[0].replace(/-/g, '/');
    return new Date(parts.join(' '));
  }

  constructor(gcalEvent: any) {
    this.eventId = gcalEvent.id;
    this.colorId = gcalEvent.colorId;
    this.summary = gcalEvent.summary;
    this.recurringEventId = gcalEvent.recurringEventId;
    let attendees = gcalEvent.attendees;

    if (!attendees)
      attendees = [];

    attendees = attendees.filter(
      (attendee: any) => !attendee.resource && !attendee.self)

    this.attendeeCount = attendees.length;
    if (this.attendeeCount == 0) {
      if (gcalEvent.recurringEventId !== undefined)
        this.type = TYPE_FOCUS_RECURRING;
      else {
        this.type = TYPE_FOCUS_NON_RECURRING;
      }
    }
    else if (this.attendeeCount == 1) {
      if (gcalEvent.recurringEventId !== undefined)
        this.type = TYPE_ONE_ON_ONE_RECURRING;
      else
        this.type = TYPE_ONE_ON_ONE_NON_RECURRING;
    } else {
      if (gcalEvent.recurringEventId !== undefined)
        this.type = TYPE_MEETING_RECURRING;
      else
        this.type = TYPE_MEETING_NON_RECURRING
    }

    let start = gcalEvent.start.dateTime;
    if (!start)
      start = gcalEvent.start.date;
    this.start = CalendarEvent.parseDate(start);

    let end = gcalEvent.end.dateTime;
    if (!end)
      end = gcalEvent.end.date;
    this.end = CalendarEvent.parseDate(end);

    this.duration = this.end.getTime() - this.start.getTime();
  }

  async setToTargetColor() {
    const targetColorId = this.getTargetColorId();
    if (targetColorId == this.colorId)
      return;

    /*console.log("Target: " + targetColorId)
    console.log("before")
    console.log(await CalendarEvent.fetchEventWithId(this.eventId));*/

    try {
      // @ts-ignore
      const response = await gapi.client.calendar.events.patch({
        calendarId: CALENDAR_ID,
        eventId: this.eventId,
        resource: {
          colorId: targetColorId.toString(),
        }
      });
    } catch (e) {
      console.log("FAILED TO PATCH " + this.eventId);
      console.log(this);
    }

    //console.log("after")
    //console.log(await CalendarEvent.fetchEventWithId(this.eventId));
  }
}