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
    SerializedTrackedPasteDetails,
} from '../types/types';
import GitInformationController from './GitInformationController';
import { VS_CODE_API } from '../VSCodeApi';
import MetaInformationController from './MetaInformationController';
import styles from '../styles/timeline.module.css';
import {
    VSCodeButton,
    VSCodeCheckbox,
    VSCodeRadio,
    VSCodeRadioGroup,
    VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import * as Diff from 'diff';
import { DiffBlock } from '../components/Diff';
import { getRangeOfNumbers } from '../lib/utils';
import { first, random } from 'lodash';
import {
    META_MANAGER_COLOR,
    cardStyle,
    editorBackground,
    iconColor,
    vscodeTextColor,
} from '../styles/globals';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Card,
    ThemeProvider,
    createTheme,
} from '@mui/material';

const setOfColors = ['#519aba', '#ba51ab', '#abba51', '#ab5151'];

const theme = createTheme({
    palette: {
        primary: {
            main: `${editorBackground}`,
            // main: `${tryingSomethingNew}`,
        },
        background: {
            paper: `${editorBackground}`,
            // paper: `${tryingSomethingNew}`,
        },
    },
    typography: {
        allVariants: {
            fontSize: 14,
            color: `${vscodeTextColor}`,
            fontFamily: 'Arial',
        },
    },
    components: {
        MuiIconButton: {
            styleOverrides: {
                root: {
                    backgroundColor: editorBackground,
                    color: iconColor,
                },
            },
        },
        MuiCheckbox: {
            styleOverrides: {
                root: {
                    color: `${vscodeTextColor} !important`,
                    '&.Mui-checked': {
                        color: `${vscodeTextColor}`,
                    },
                },
            },
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    // paddingLeft: 12,
                    // paddingRight: 12,
                    padding: 0,
                    ':last-child': {
                        paddingBottom: 0,
                    },
                },
            },
        },
    },
});
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
    pasteLocations: FormattedSerializedTrackedPasteDetails[];
}

interface FormattedSerializedTrackedPasteDetails
    extends SerializedTrackedPasteDetails {
    // style: React.CSSProperties;
    lineNumber: number;
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

interface SearchOpts {
    searchOnlyInPastedCode: boolean;
    searchAcrossAllTime: boolean;
    searchTimeSpan: null | {
        from: string;
        to: string;
    };
    searchScope: {
        onThisNode: boolean;
        onThisFile: boolean;
        onThisProject: boolean;
    };
}

const Search: React.FC<{ context: TimelineController }> = ({ context }) => {
    const [searchOpts, setSearchOpts] = React.useState<SearchOpts>({
        searchOnlyInPastedCode: false,
        searchAcrossAllTime: false,
        searchTimeSpan: null,
        searchScope: {
            onThisNode: true,
            onThisFile: false,
            onThisProject: false,
        },
    });
    const [searchTerm, setSearchTerm] = React.useState('');
    const [showOpts, setShowOpts] = React.useState(false);
    return (
        <div className={styles['flex-col']}>
            <div className={styles['center']}>
                <VSCodeTextField
                    // className={styles['m2']}
                    placeholder="Search for a keyword"
                    onChange={(e: any) => setSearchTerm(e.target.value)}
                    style={{ marginRight: '10px' }}
                />
                <VSCodeButton
                    // className={styles['m2']}
                    // onClick={() => {
                    //     context._queue.push(undefined);
                    //     context._ref.render(context.renderNode());
                    // }}
                    style={{ marginRight: '10px' }}
                >
                    Search
                </VSCodeButton>
                <VSCodeButton
                    appearance="secondary"
                    onClick={(e: any) => setShowOpts(!showOpts)}
                >
                    Options
                </VSCodeButton>
            </div>

            {showOpts ? (
                <div>
                    Options
                    <div className={styles['flex']}>
                        <VSCodeCheckbox
                            checked={false}
                            onChange={(e: any) =>
                                setSearchOpts({
                                    ...searchOpts,
                                    searchOnlyInPastedCode: e.target.value,
                                })
                            }
                            // className={styles['m2']}
                        >
                            Search only in pasted code?
                        </VSCodeCheckbox>
                    </div>
                    <div>
                        Search across all time?
                        <VSCodeCheckbox
                            checked={false}
                            onChange={(e: any) =>
                                setSearchOpts({
                                    ...searchOpts,
                                    searchAcrossAllTime: e.target.value,
                                })
                            }
                            // className={styles['m2']}
                        >
                            Search only in pasted code?
                        </VSCodeCheckbox>
                        {searchOpts.searchAcrossAllTime ? (
                            <div>
                                <div className={styles['flex']}>
                                    {' '}
                                    From{' '}
                                    <input
                                        onChange={(e) => {
                                            setSearchOpts({
                                                ...searchOpts,
                                                searchTimeSpan: {
                                                    ...(searchOpts.searchTimeSpan || {
                                                        from: '',
                                                        to: '',
                                                    }),
                                                    from: e.target.value,
                                                },
                                            });
                                        }}
                                    ></input>
                                    to{' '}
                                    <input
                                        onChange={(e) => {
                                            setSearchOpts({
                                                ...searchOpts,
                                                searchTimeSpan: {
                                                    ...(searchOpts.searchTimeSpan || {
                                                        from: '',
                                                        to: '',
                                                    }),
                                                    from: e.target.value,
                                                },
                                            });
                                        }}
                                    ></input>
                                </div>
                            </div>
                        ) : null}
                    </div>
                    <div>
                        Search scope
                        <div className={styles['flex']}>
                            <VSCodeRadioGroup name="searchScope">
                                <VSCodeRadio
                                    checked={searchOpts.searchScope.onThisNode}
                                    onChange={(e: any) => {
                                        setSearchOpts({
                                            ...searchOpts,
                                            searchScope: {
                                                onThisFile: false,
                                                onThisProject: false,
                                                onThisNode: true,
                                            },
                                        });
                                    }}
                                >
                                    On this node?
                                </VSCodeRadio>
                                <VSCodeRadio
                                    checked={searchOpts.searchScope.onThisFile}
                                    onChange={(e: any) => {
                                        setSearchOpts({
                                            ...searchOpts,
                                            searchScope: {
                                                onThisFile: true,
                                                onThisProject: false,
                                                onThisNode: false,
                                            },
                                        });
                                    }}
                                >
                                    On this file?
                                </VSCodeRadio>
                                <VSCodeRadio
                                    checked={
                                        searchOpts.searchScope.onThisProject
                                    }
                                    onChange={(e: any) => {
                                        setSearchOpts({
                                            ...searchOpts,
                                            searchScope: {
                                                onThisFile: false,
                                                onThisProject: true,
                                                onThisNode: false,
                                            },
                                        });
                                    }}
                                >
                                    On this project?
                                </VSCodeRadio>
                            </VSCodeRadioGroup>
                        </div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

class TimelineController {
    private readonly _ref: Root;
    private readonly _headerRef: Root;
    private readonly _colorGuideRef: Root;
    _graphController: GraphController;
    _gitInformationController: GitInformationController;
    _metaInformationController: MetaInformationController;
    _node: Payload | undefined;
    _lookingAtFiltered: boolean = false;
    _queue: (TimelineEvent | undefined)[] = [];
    constructor() {
        // console.log('constructing');
        const header =
            document.getElementById('header') || document.createElement('div');
        this._headerRef = createRoot(header);
        const container =
            document.getElementById('root') || document.createElement('div');
        this._ref = createRoot(container);
        const colorGuide =
            document.getElementById('color') || document.createElement('div');
        this._colorGuideRef = createRoot(colorGuide);
        this._graphController = new GraphController(this);
        this._gitInformationController = new GitInformationController(this);
        this._metaInformationController = new MetaInformationController(this);
        // console.log('graph', this._graphController);
        this.initListeners();
        // this.constructGraph();
    }

    initListeners() {
        // console.log('hewwo!!!!!!!!!!!!!!');
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
        // console.log('k!', k);
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
            // console.log('this', this);
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
        if (!this._node) {
            return null;
        }
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

    renderCommentOutEvent(
        originalData: SerializedChangeBuffer[],
        timelineArr: TimelineEvent[]
    ) {
        if (!this._node) {
            return null;
        }
        return (
            <div>
                <h4>Comment</h4>
                {originalData.map((event) => {
                    const eventData = event.eventData![Event.COMMENT_OUT]!;
                    return (
                        <div className={styles['flex']}>
                            <div>
                                Code stopped being used on{' '}
                                {new Date(event.time).toLocaleString()}.
                                <CodeBox
                                    oldCode={eventData.location.content}
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

                        case Event.COMMENT_OUT: {
                            return this.renderCommentOutEvent(originalData, e);
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
            <div className={styles['m2']} style={{ color: 'white' }}>
                {this.renderTimelineEventMetadata(k)}
                {/* {this.renderColorGuide()} */}
                {/* <Accordion style={{ color: 'white' }}>
                    <AccordionSummary>
                        <h3>What happened?</h3>
                    </AccordionSummary>
                    <AccordionDetails>
                        {this.renderTimelineEventMetadata(k)}
                    </AccordionDetails>
                </Accordion> */}
                <Accordion style={{ color: 'white' }}>
                    <AccordionSummary>
                        <h3>What did it used to look like?</h3>
                        {/* <CodeBlock codeString={k._formattedData.code || ''} />
                         */}
                    </AccordionSummary>
                    <AccordionDetails>
                        <CodeBox
                            oldCode={k._formattedData.code || ''}
                            newCode={
                                this._node!.items![
                                    this._node!.items!.length - 1
                                ]._formattedData.code
                            }
                        />
                        <RenderFilterButtons
                            timelineArr={this._node!.items!.filter(
                                (t) => t._dataSourceType === k._dataSourceType
                            )}
                            context={this}
                        />
                    </AccordionDetails>
                </Accordion>
            </div>
        );
    }

    getPasteLocationData(
        pasteLocation: SerializedTrackedPasteDetails
    ): FormattedSerializedTrackedPasteDetails[] {
        // const wholeRangeLineNumbers = getRangeOfNumbers(location);
        const { location: pasteLocationLocation } = pasteLocation;
        const thisRange = getRangeOfNumbers(pasteLocationLocation);
        return thisRange.map((l) => {
            return {
                lineNumber: l,
                ...pasteLocation,
            };
        });
    }

    getPasteLocationLogic() {
        if (!this._node) {
            return undefined;
        }
        const { node, items } = this._node;
        const { location } = node;
        const formatted: FormattedSerializedTrackedPasteDetails[] =
            this._node.pasteLocations;
        return (lineNumber: number) => {
            let style: React.CSSProperties = {};
            let className = styles['cursor-default'];
            const pasteLocation = formatted.find(
                (l) => l.lineNumber + 1 === lineNumber
            );

            if (pasteLocation) {
                style.backgroundColor = pasteLocation.style;
                // style.cursor = 'pointer';
                className = styles['cursor-pointer'];
                style.cursor = 'pointer';
            }
            const tl = items?.find(
                (i) => i._formattedData.id === pasteLocation?.id
            );

            return {
                style,
                className: className,
                onClick: () => {
                    pasteLocation &&
                        tl &&
                        this._ref.render(
                            <ThemeProvider theme={theme}>
                                <Card style={cardStyle}>
                                    {this.renderVersion(tl)}
                                </Card>
                            </ThemeProvider>
                            // this.renderVersion(tl)
                        );
                },
                onMouseEnter: () => {
                    pasteLocation &&
                        tl &&
                        this._graphController.highlight(pasteLocation!.id, tl);
                },
                onMouseOut: () => {
                    pasteLocation &&
                        tl &&
                        this._graphController.unhighlight(
                            pasteLocation!.id,
                            tl
                        );
                },
            };
        };
    }

    renderColorGuide() {
        const arr = [
            'Git',
            'VS Code Edit',
            'Chat GPT',
            'Stack Overflow',
            'GitHub',
            'VS Code Paste',
        ];
        return (
            <div className={styles['flex-col']} style={{ fontSize: '11px' }}>
                {[
                    '#4e79a761',
                    META_MANAGER_COLOR,
                    '#CCCCFF61',
                    '#7575CF61',
                    '#5453A661',
                    '#9EA9ED61',
                ].map((c, i) => (
                    <div
                        className={`${styles['flex-col']} ${styles['p2']} ${styles['center']}`}
                    >
                        {arr[i]}
                        <div
                            className={styles['flex']}
                            style={{
                                backgroundColor: c,
                                width: '30px',
                                height: '30px',
                            }}
                        ></div>
                    </div>
                ))}
            </div>
        );
    }

    renderPasteLocations() {
        if (!this._node) {
            return null;
        }
        const { node } = this._node;
        const { location } = node;
        const { content } = location;
        const wholeRangeLineNumbers = getRangeOfNumbers(location);
        const highlightLogic = this.getPasteLocationLogic();
        return (
            <div>
                <CodeBlock
                    codeString={content}
                    highlightLogic={highlightLogic}
                    startingLineNumber={wholeRangeLineNumbers[0] + 1}
                />
            </div>
        );
    }

    getAccordionComponents() {
        console.log('this.node', this._node);
        const accordionComponents = [];
        if (this._node) {
            const { node, events, firstInstance } = this._node;
            const { content } = node.location;
            const { pasteLocations } = this._node;

            if (pasteLocations.length) {
                accordionComponents.push(
                    <Accordion style={{ color: 'white ' }}>
                        <AccordionSummary>
                            Explore Where Code was Pasted from
                        </AccordionSummary>

                        <AccordionDetails>
                            {this.renderPasteLocations()}
                        </AccordionDetails>
                    </Accordion>
                );
            }
            if (events.length) {
                accordionComponents.push(
                    <Accordion style={{ color: 'white ' }}>
                        <AccordionSummary>
                            What has happened to this code?
                        </AccordionSummary>
                        <AccordionDetails>
                            {this.renderEvents()}
                        </AccordionDetails>
                    </Accordion>
                );
            }
            accordionComponents.push(
                <Accordion style={{ color: 'white ' }}>
                    <AccordionSummary>
                        Where did this code come from?
                    </AccordionSummary>
                    <AccordionDetails>
                        {this.renderFirstInstance()}
                    </AccordionDetails>
                </Accordion>
            );

            if (firstInstance) {
                accordionComponents.push(
                    <Accordion style={{ color: 'white ' }}>
                        <AccordionSummary>
                            What did it originally look like?
                        </AccordionSummary>
                        <AccordionDetails>
                            <CodeBox
                                oldCode={
                                    firstInstance._formattedData.code || ''
                                }
                                newCode={content}
                            />
                        </AccordionDetails>
                    </Accordion>
                );
            }
        }
        return accordionComponents;
    }

    renderNode() {
        console.log('this.node', this._node);
        if (this._node) {
            const { node } = this._node;
            const { content } = node.location;
            const { pasteLocations } = this._node;
            const accordionComponents = this.getAccordionComponents();
            return <>{...accordionComponents}</>;
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
                <Search context={this} />
                <div style={{ marginLeft: 'auto' }}>
                    <VSCodeButton
                        className={styles['m2']}
                        onClick={() => {
                            this._queue.push(undefined);
                            this._ref.render(
                                <ThemeProvider theme={theme}>
                                    <Card style={cardStyle}>
                                        {this.renderNode()}
                                    </Card>
                                </ThemeProvider>
                            );
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
        console.log('theme!', theme);
        this._ref.render(
            <ThemeProvider theme={theme}>
                <Card style={cardStyle}>
                    {k ? this.renderVersion(k) : this.renderNode()}
                </Card>
            </ThemeProvider>
        );
        this._colorGuideRef.render(
            <ThemeProvider theme={theme}>
                {this.renderColorGuide()}
            </ThemeProvider>
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
                this._node = {
                    ...(metadata as Payload),
                    pasteLocations: metadata.pasteLocations.flatMap(
                        (p: SerializedTrackedPasteDetails) =>
                            context.getPasteLocationData(p)
                    ),
                };

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
