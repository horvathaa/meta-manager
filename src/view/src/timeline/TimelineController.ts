import TimelinesChart, { Group } from 'timelines-chart';
import TimelineEvent from '../../../data/timeline/TimelineEvent';
import { VSCodeWrapper } from '../vscode/VSCodeApi';

class TimelineController {
    _title: string;
    _data: Map<string, TimelineEvent[]>;
    _formattedData: Group[];
    _vscode: VSCodeWrapper;
    constructor(vscodeApi: VSCodeWrapper) {
        this._title = '';
        this._data = new Map();
        this._formattedData = [{ group: 'currentCode', data: [] }];
        this._vscode = vscodeApi;
        window.addEventListener('message', (event) => {
            const message = event.data; // The JSON data our extension sent
            switch (message.command) {
                case 'updateTimeline': {
                    const { data } = message;
                    const { id, timelineData } = data;
                    this.updateTimeline(id, timelineData);
                    break;
                }
                default: {
                    console.log('default');
                }
            }
        });
    }

    static create(vscodeApi: VSCodeWrapper) {
        // console.log('creating class');
        return new TimelineController(vscodeApi);
    }

    formatData() {
        this._formattedData = [
            {
                group: 'currentCode',
                data: Array.from(this._data).map((d) => {
                    const [title, data] = d;
                    console.log('data', data);
                    return {
                        label: title,
                        data: data.map((d) => d._formattedData),
                    };
                }),
            },
        ];
    }

    updateTimeline(title: string, data: TimelineEvent[]) {
        this._title = title;
        this._data = this._data.set(title, data);
        this.formatData();
        this.render();
    }

    render() {
        if (typeof window !== 'undefined') {
            const el = document.getElementById('root');
            // const el = undefined;
            if (el) {
                const chart = TimelinesChart();
                chart.data(this._formattedData)(el);
                // console.log('chart', chart);
            } else {
                console.error('No element found');
            }
        } else {
            console.error('No window found');
        }
    }
}

export default TimelineController;
