import { CALENDAR_ID, TYPES } from './constants.js'
import { Aggregate } from './aggregate.js'

async function getColors() {
    //@ts-ignore
    let response = await gapi.client.calendar.colors.get({
        calendarId: CALENDAR_ID,
    });
    return response.result.event;
}

function hexToRGB(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgb(${r}, ${g}, ${b})`;
}

export class Charter {
    colors: any;

    async init() {
        this.colors = await getColors();
    }

    async chartData(aggregates: Aggregate[], divId: string) {

        const dates = aggregates.map(day => day.start);

        interface PlotlySeries {
            x: Date[],
            y: number[],
            name: string,
            type: string,
            marker: {
                color: string,
            }
        }
        const data: PlotlySeries[] = [];

        for (let type of TYPES.keys()) {
            const color = hexToRGB(this.colors[TYPES.get(type)!].background);
            const ys = aggregates.map(day => day.minutesPerType.get(type)!);
            data.push({
                x: dates,
                y: ys,
                name: type,
                type: "bar",
                marker: {
                    color: color,
                }
            });
        }

        // @ts-ignore
        Plotly.newPlot(divId, data, { barmode: 'stack' });
    }
}