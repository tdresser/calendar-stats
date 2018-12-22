import { TYPES, TYPE_NON_MEETING } from './constants.js';
import {CalendarEvent} from './calendar_event.js'

export class Day {
    day: Date;
    events: CalendarEvent[];
    minutesPerType: number[];
    constructor(day : Date, events : CalendarEvent[]) {
      this.day = day;
      this.events = events;

      this.minutesPerType = [];

      this.minutesPerType = new Array(TYPES.length).fill(0);
      console.log("Events");
      console.log(events);

      for (const event of events) {
        console.log(event);
        this.minutesPerType[TYPES.indexOf(event.type)] += event.duration / 60 / 1000;
      }

      let totalMeetingTime = 0;
      for (let typeId = 0; typeId < TYPES.length; ++typeId) {
        totalMeetingTime += this.minutesPerType[typeId];
      }

      let totalNonMeetingTime = 8*60 - totalMeetingTime;
      if (totalNonMeetingTime < 0)
        totalNonMeetingTime = 0;

      this.minutesPerType[TYPES.indexOf(TYPE_NON_MEETING)] = totalNonMeetingTime;
    }

    toRow() {
      return [
        this.day.toDateString()].concat(
          this.minutesPerType.map(x => x.toString()));
    }
  }