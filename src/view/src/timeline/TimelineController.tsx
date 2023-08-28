import * as React from 'react';
import { Root, createRoot } from 'react-dom/client';
import * as d3 from 'd3';
import GraphController from './GraphController';
import TimelineEvent from '../../../data/timeline/TimelineEvent';
import CodeBlock from '../components/CodeBlock';
// import {
//     SerializedChangeBuffer,
//     SerializedReadableNode,
//     Event,
//     AdditionalMetadata,
//     WEB_INFO_SOURCE,
// } from '../../../constants/types';
import {
    CopyBuffer,
    SerializedChangeBuffer,
    SerializedNodeDataController,
    SerializedReadableNode,
    Event,
    WEB_INFO_SOURCE,
} from '../types/types';
import GitInformationController from './GitInformationController';
import { VS_CODE_API } from '../VSCodeApi';
import MetaInformationController from './MetaInformationController';
import styles from '../styles/timeline.module.css';
import { VSCodeButton, VSCodeCheckbox } from '@vscode/webview-ui-toolkit/react';
import * as Diff from 'diff';
import { DiffBlock } from '../components/Diff';

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
    eventsMap: { [k: string]: TimelineEvent[] };
}

const CodeBox: React.FC<{ oldCode: string; newCode: string }> = ({
    oldCode,
    newCode,
}) => {
    const [showDiff, setShowDiff] = React.useState(true);

    return (
        <div>
            <div className={styles['flex']}>
                <VSCodeCheckbox
                    checked={showDiff}
                    onChange={() => setShowDiff(!showDiff)}
                >
                    Show Diff?
                </VSCodeCheckbox>
            </div>
            {showDiff ? (
                <DiffBlock str1={oldCode} str2={newCode} />
            ) : (
                <CodeBlock codeString={oldCode} />
            )}
        </div>
    );
};

const RenderFilterButtons: React.FC<{
    timelineArr: TimelineEvent[];
    context: TimelineController;
}> = ({ timelineArr, context }) => {
    const [showFiltered, setShowFiltered] = React.useState(false);
    return (
        <div className={styles['flex']}>
            <VSCodeButton
                className={styles['m2']}
                onClick={() => {
                    setShowFiltered(true);
                    context._graphController.constructGraph(timelineArr);
                }}
            >
                Show Only These Instances?
            </VSCodeButton>
            {showFiltered && (
                <VSCodeButton
                    appearance="secondary"
                    onClick={() => {
                        setShowFiltered(false);
                        context._graphController.constructGraph(context._node);
                    }}
                    className={styles['m2']}
                >
                    Reset?
                </VSCodeButton>
            )}
        </div>
    );
};

class TimelineController {
    private readonly _ref: Root;
    private readonly _headerRef: Root;
    _graphController: GraphController;
    _gitInformationController: GitInformationController;
    _metaInformationController: MetaInformationController;
    _node: Payload | undefined;
    _lookingAtFiltered: boolean = false;
    _queue: (TimelineEvent | undefined)[] = [];
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
            if (firstInstance) {
                return this.renderTimelineEventMetadata(firstInstance);
            } else {
                return null;
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

    renderSmallEventWeb(e: CopyBuffer[], timelineArr: TimelineEvent[]) {
        console.log('TIMELINE', timelineArr);

        return (
            <div>
                <h4>Some Code Came from Online</h4>
                {e
                    .sort(
                        (a, b) =>
                            new Date(b.timeCopied).getTime() -
                            new Date(a.timeCopied).getTime()
                    )
                    .map((event) => {
                        return (
                            <div
                                key={event.code + event.timeCopied}
                                className={styles['flex']}
                            >
                                <div>
                                    Copied from{' '}
                                    <a href={event.url}>{event.url}</a> on{' '}
                                    {new Date(
                                        event.timeCopied
                                    ).toLocaleString()}
                                    <CodeBlock codeString={event.code} />
                                </div>
                            </div>
                        );
                    })}
                {/* {this.renderFilterButtons(timelineArr)}
                 */}
                <RenderFilterButtons timelineArr={timelineArr} context={this} />
            </div>
        );
    }

    renderPasteEvent(
        originalData: SerializedChangeBuffer[],
        timelineArr: TimelineEvent[]
    ) {
        if (!this._node) return null;
        return (
            <div>
                <h4>Some Code Came from Other Parts of this Code Base</h4>
                {originalData.map((event) => {
                    const eventData = event.eventData![Event.PASTE]!;
                    return (
                        <div
                            key={eventData.pasteContent}
                            className={styles['flex']}
                        >
                            <div>
                                Copied on{' '}
                                {new Date(event.time).toLocaleString()}
                                <CodeBox
                                    oldCode={eventData.pasteContent}
                                    newCode={this._node!.node.location.content}
                                />
                            </div>
                        </div>
                    );
                })}
                <RenderFilterButtons timelineArr={timelineArr} context={this} />
            </div>
        );
    }

    renderEvents() {
        if (!this._node) {
            return null;
        }
        return (
            <div>
                {Object.keys(this._node.eventsMap).map((k) => {
                    const e = this._node!.eventsMap[k];
                    const originalData = e.map(
                        (e) => e.originalData
                    ) as SerializedChangeBuffer[];

                    switch (k) {
                        case Event.WEB: {
                            const formatted = originalData.map(
                                (ee) => ee.eventData![k]!.copyBuffer
                            );
                            return this.renderSmallEventWeb(formatted, e);
                        }

                        case Event.PASTE: {
                            return this.renderPasteEvent(originalData, e);
                        }
                    }
                    // return (
                    //     <div className={styles['m2']}>
                    //         <div>
                    //             <h2>What happened?</h2>
                    //             {/* {this.renderTimelineEventMetadata(e)} */}
                    //         </div>
                    //         <div>
                    //             <h3>What did it used to look like?</h3>
                    //             <CodeBlock
                    //                 // codeString={e._formattedData.code || ''}
                    //                 codeString=""
                    //             />
                    //         </div>
                    //     </div>
                    // );
                })}
            </div>
        );
    }

    renderVersion(k: TimelineEvent) {
        console.log(
            'ver',
            k._formattedData.code,
            'curr',
            this._node!.items![this._node!.items!.length - 1]._formattedData
                .code,
            'diff',
            Diff.diffLines(
                k._formattedData.code || '',
                this._node!.items![this._node!.items!.length - 1]._formattedData
                    .code
            )
        );

        return (
            <div className={styles['m2']}>
                <div>
                    <h2>What happened?</h2>
                    {this.renderTimelineEventMetadata(k)}
                </div>
                <div>
                    <h3>What did it used to look like?</h3>
                    {/* <CodeBlock codeString={k._formattedData.code || ''} />
                     */}
                    <CodeBox
                        oldCode={k._formattedData.code || ''}
                        newCode={
                            this._node!.items![this._node!.items!.length - 1]
                                ._formattedData.code
                        }
                    />
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
                    {this._node.events.length ? (
                        <div>
                            <h3>What has happened to this code?</h3>
                            {this.renderEvents()}
                        </div>
                    ) : null}
                    <div>
                        <h3>Where did this code come from?</h3>
                        {this.renderFirstInstance()}
                    </div>
                    <div>
                        {this._node.firstInstance ? (
                            <>
                                <h3>What did it used to look like?</h3>
                                <CodeBox
                                    oldCode={
                                        this._node.firstInstance._formattedData
                                            .code || ''
                                    }
                                    newCode={content}
                                />
                                {/* <CodeBlock
                                    codeString={
                                        this._node.firstInstance._formattedData
                                            .code || ''
                                    }
                                /> */}
                            </>
                        ) : null}
                    </div>
                </div>
            );
        }
        return null;
    }

    renderMetadata(k?: TimelineEvent) {
        console.log('k', k);
        this._headerRef.render(
            <div className={styles['flex']}>
                <div className={styles['center']} style={{ margin: 'auto' }}>
                    <h1>{this._node?.displayName}</h1>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <VSCodeButton
                        className={styles['m2']}
                        onClick={() => {
                            this._queue.push(undefined);
                            this._ref.render(this.renderNode());
                        }}
                    >
                        Home
                    </VSCodeButton>
                    <VSCodeButton
                        className={styles['m2']}
                        appearance="secondary"
                        disabled={!this._queue.length}
                        onClick={() => this.renderMetadata(this._queue.pop())}
                    >
                        Back
                    </VSCodeButton>
                </div>
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
