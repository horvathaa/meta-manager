// import TimelinesChart, {
//     Group,
//     TS,
//     TimelinesChartInstance,
//     Val,
// } from 'timelines-chart';
// import Range from 'timelines-chart';
// import TimelineEvent from '../../../data/timeline/TimelineEvent';
// import { VSCodeWrapper } from '../vscode/VSCodeApi';

// class TimelineController {
//     _title: string;
//     _data: Map<string, TimelineEvent[]>;
//     _formattedData: Group[];
//     _vscode: VSCodeWrapper;
//     _chart: TimelinesChartInstance;
//     constructor(vscodeApi: VSCodeWrapper) {
//         this._title = '';
//         this._data = new Map();
//         this._formattedData = [{ group: 'currentCode', data: [] }];
//         this._vscode = vscodeApi;
//         this._chart = TimelinesChart().zQualitative(true);
//         // renderTooltip function: The renderTooltip function is declared within the class, but it is not bound to the class instance. As a result, when it's passed to segmentTooltipContent, the this context will be lost. To fix this, you can bind the function in the constructor or use an arrow function to automatically bind it to the class instance.
//         // this._chart.segmentTooltipContent(this.renderTooltip);
//         this.initListeners();
//     }

//     static create(vscodeApi: VSCodeWrapper) {
//         return new TimelineController(vscodeApi);
//     }

//     handleIncomingMessage(e: MessageEvent<any>, context: TimelineController) {
//         const message = e.data; // The JSON data our extension sent
//         switch (message.command) {
//             case 'updateTimeline': {
//                 const { data } = message;
//                 const { id, timelineData } = data;
//                 context.updateTimeline(id, timelineData);
//                 break;
//             }
//             default: {
//                 console.log('default');
//             }
//         }
//     }

//     renderTooltip(segment: {
//         group: string;
//         label: string;
//         val: Val;
//         timeRange: any;
//     }) {
//         return '';
//     }

//     initListeners() {
//         window.addEventListener('message', (e) =>
//             this.handleIncomingMessage(e, this)
//         );
//         return () =>
//             window.removeEventListener('message', (e) =>
//                 this.handleIncomingMessage(e, this)
//             );
//     }

//     formatData() {
//         this._formattedData = [
//             {
//                 group: 'currentCode',
//                 data: Array.from(this._data).map((d) => {
//                     const [title, data] = d;
//                     return {
//                         label: title,
//                         data: data.map((d) => d._formattedData),
//                     };
//                 }),
//             },
//         ];
//     }

//     updateTimeline(title: string, data: TimelineEvent[]) {
//         this._title = title;
//         this._data = this._data.set(title, data);
//         this.formatData();
//         // this.render();
//         if (this._chart.length === 1) {
//             this.render();
//         } else {
//             this._chart.refresh();
//         }
//     }

//     render() {
//         if (typeof window !== 'undefined') {
//             const el = document.getElementById('root');
//             if (el) {
//                 if (el.childElementCount > 0) {
//                     el.childNodes.forEach((child) => {
//                         child.remove();
//                     });
//                 }
//                 this._chart = this._chart.data(this._formattedData)(el);
//             } else {
//                 console.error('No element found');
//             }
//         } else {
//             console.error('No window found');
//         }
//     }
// }

// export default TimelineController;
