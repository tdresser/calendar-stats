import { TYPES, TYPE_NON_MEETING } from './constants';
import {CalendarEvent} from './calendar_event'

class Day {
    day: Date;
    events: CalendarEvent[];
    minutesPerType: number[];
    constructor(day : Date, events : CalendarEvent[]) {
      this.day = day;
      this.events = events;
     
      this.minutesPerType = [];
      
      this.minutesPerType = new Array(TYPES.length).fill(0);
      
      for (const event of events) {
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
      let response = "?";
      if (this.events.length)
        response = this.events[0].myResponse;
      return [this.day.toDateString()].concat(this.minutesPerType.map(x => x.toString())).concat([response]);
    }
  }