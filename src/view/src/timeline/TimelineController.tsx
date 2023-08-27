import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
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

export interface Payload {
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
    displayName: string;
    prMap: { [k: string]: any };
}
class TimelineController {
    private readonly _ref: Root;
    private readonly _headerRef: Root;
    _graphController: GraphController;
    _gitInformationController: GitInformationController;
    _metaInformationController: MetaInformationController;
    _node: Payload | undefined;
    constructor() {
        console.log('constructing');
        const header =
            document.getElementById('header') || document.createElement('div');
        this._headerRef = createRoot(header);
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

    renderTimelineEventMetadata(k: TimelineEvent) {
        console.log('k!', k);
        switch (k._dataSourceType) {
            case 'git': {
                return this._gitInformationController.render(k);
            }
            case 'meta-past-version': {
                return this._metaInformationController.render(k);
            }
            default: {
                return null;
            }
        }
    }

    renderFirstInstance() {
        if (this._node) {
            const { firstInstance } = this._node;
            console.log('this', this);
            return this.renderTimelineEventMetadata(firstInstance);
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

    renderEvents() {
        return <div></div>;
    }

    renderVersion(k: TimelineEvent) {
        return (
            <div className={styles['m2']}>
                <div>
                    <h2>What happened?</h2>
                    {this.renderTimelineEventMetadata(k)}
                </div>
                <div>
                    <h3>What did it used to look like?</h3>
                    <CodeBlock codeString={k._formattedData.code || ''} />
                </div>
            </div>
        );
    }

    renderNode() {
        console.log('this.node', this._node);
        if (this._node) {
            const { node } = this._node;
            const { content } = node.location;
            return (
                <div className={styles['m2']}>
                    <div>
                        <h3>What has happened to this code?</h3>
                        {this.renderEvents()}
                    </div>
                    <div>
                        <h3>Where did this code come from?</h3>
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
        this._headerRef.render(
            <div className={styles['center']}>
                <h1>{this._node?.displayName}</h1>
            </div>
        );
        this._ref.render(
            <div>{k ? this.renderVersion(k) : this.renderNode()}</div>
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
