import * as React from 'react';
import { createRoot } from 'react-dom/client';
import * as d3 from 'd3';
import GraphController from './GraphController';
import TimelineEvent from '../../../data/timeline/TimelineEvent';
import CodeBlock from '../components/CodeBlock';
import {
    SerializedChangeBuffer,
    SerializedReadableNode,
    Event,
    AdditionalMetadata,
    WEB_INFO_SOURCE,
} from '../../../constants/types';
import { CopyBuffer, SerializedNodeDataController } from '../types/types';
import GitInformationController from './GitInformationController';
import { VS_CODE_API } from '../VSCodeApi';
import MetaInformationController from './MetaInformationController';
import styles from '../styles/timeline.module.css';

interface Payload {
    pastVersions: SerializedChangeBuffer[];
    formattedPastVersions: TimelineEvent[];
    gitData: TimelineEvent[] | undefined;
    items: TimelineEvent[] | undefined;
    setOfEventIds: string[];
    node: SerializedReadableNode;
    lastUpdatedTime: number;
    lastUpdatedBy: string;
    firstInstance: TimelineEvent;
    parent: SerializedNodeDataController;
    children: SerializedNodeDataController[];
    events: { [k in Event]: any }[];
}
class TimelineController {
    private readonly _ref;
    _graphController: GraphController;
    _gitInformationController: GitInformationController;
    _metaInformationController: MetaInformationController;
    _node: Payload | undefined;
    constructor() {
        console.log('constructing');
        const container =
            document.getElementById('root') || document.createElement('div');
        console.log('container', container);
        this._ref = createRoot(container);
        console.log('ref', this._ref);
        this._graphController = new GraphController(this);
        this._gitInformationController = new GitInformationController(this);
        this._metaInformationController = new MetaInformationController(this);
        console.log('graph', this._graphController);
        this.initListeners();
        // this.constructGraph();
    }

    initListeners() {
        console.log('hewwo!!!!!!!!!!!!!!');
        window.addEventListener('message', (e) =>
            this.handleIncomingMessage(e, this)
        );
        return () =>
            window.removeEventListener('message', (e) =>
                this.handleIncomingMessage(e, this)
            );
    }

    updateTimeline(title: string, data: any[]) {
        this._graphController.constructGraph(data);
        this.renderMetadata();
    }

    renderFirstInstance() {
        if (this._node) {
            const { firstInstance } = this._node;
            switch (firstInstance._dataSourceType) {
                case 'git': {
                    return this._gitInformationController.render(firstInstance);
                }
                case 'meta-past-version': {
                    return this._metaInformationController.render(
                        firstInstance
                    );
                }
                default: {
                    return null;
                }
            }
        }
        return null;
    }

    openView(copyBuffer: CopyBuffer, type: WEB_INFO_SOURCE) {
        VS_CODE_API.postMessage({
            command: 'openView',
            data: {
                copyBuffer,
                type,
                node: this._node,
            },
        });
    }

    renderVersion(k: TimelineEvent) {
        return <CodeBlock codeString={k._formattedData.code || ''} />;
    }

    renderNode() {
        console.log('this.node', this._node);
        if (this._node) {
            const { node } = this._node;
            const { content } = node.location;
            return (
                <div className={styles['m2']}>
                    <div>
                        <h2>Where did this code come from?</h2>
                        {this.renderFirstInstance()}
                    </div>
                    <div>
                        <h3>What did it used to look like?</h3>
                        <CodeBlock
                            codeString={
                                this._node.firstInstance._formattedData.code ||
                                ''
                            }
                        />
                    </div>
                </div>
            );
        }
        return null;
    }

    renderMetadata(k?: TimelineEvent) {
        console.log('k', k);
        this._ref.render(
            <div>
                <h1>{this._node?.node.id.split(':')[0]}</h1>
                {k ? this.renderVersion(k) : this.renderNode()}
            </div>
        );
    }

    handleIncomingMessage(e: MessageEvent<any>, context: TimelineController) {
        const message = e.data; // The JSON data our extension sent
        console.log('hewwo?????', message);
        switch (message.command) {
            case 'updateTimeline': {
                const { data } = message;
                const { id, metadata } = data;
                console.log('stuff', data, id, metadata);
                this._node = metadata as Payload;
                context.updateTimeline(id, metadata);
                break;
            }
            default: {
                console.log('default');
            }
        }
    }
}
// new TimelineController();
export default TimelineController;
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
