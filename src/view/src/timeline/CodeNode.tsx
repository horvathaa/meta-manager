import * as React from 'react';
import {
    SerializedReadableNode,
    Event,
    CopyBuffer,
    SerializedChangeBuffer,
    SearchResultSerializedChangeBuffer,
} from '../types/types';
import GraphController, { SearchResult } from './GraphController';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Card,
    ThemeProvider,
} from '@mui/material';
import { theme } from './TimelineController';
import {
    cardStyle,
    META_MANAGER_SEARCH_COLOR,
    META_MANAGER_COLOR,
} from '../styles/globals';
import CodeBlock from '../components/CodeBlock';
import { getHighlightLogic } from './Version';
import MetaInformationController from './MetaInformationController';
import styles from '../styles/timeline.module.css';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { ArrowLeft, ArrowRight } from '@mui/icons-material';
import { getRangeFromSubstring } from '../lib/utils';

interface Props {
    currNode: SerializedReadableNode;
    versions: SearchResultSerializedChangeBuffer[];
    context: GraphController;
    color: string;
}

let defaultFilterObj: { [k: string]: boolean } = {
    filterCopy: false,
    filterPaste: false,
    filterWeb: false,
};

interface SummaryProps {
    version: SerializedChangeBuffer;
    pastVersion?: SerializedChangeBuffer;
    currIdx: number;
    currNode: SerializedReadableNode;
    context: GraphController;
    color: string;
    isSelectingCode?: boolean;
    isInSearch?: boolean;
    filterObj: { [k: string]: boolean };
    setFilter: (filterObj: any) => void;
    jumpToFirstInstance: () => void;
    state: VersionState;
    extraButtons?: React.ReactNode;
}

enum VersionState {
    DEFAULT = 'DEFAULT',
    COPY = 'COPY',
    PASTE = 'PASTE',
    WEB = 'WEB',
    SEARCH_RESULT = 'SEARCH_RESULT',
}

const Summary: React.FC<SummaryProps> = ({
    version,
    pastVersion,
    currIdx,
    currNode,
    context,
    color,
    isSelectingCode,
    filterObj,
    isInSearch = false,
    setFilter,
    jumpToFirstInstance,
    state,
    extraButtons,
}) => {
    console.log('version', version, 'state', state);

    React.useEffect(() => {}, [state]);

    const ButtonRow = () => {
        return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <VSCodeButton
                        appearance="secondary"
                        className={
                            filterObj.filterCopy ? `${styles['active']}` : ''
                        }
                        onClick={(e: any) => {
                            e.stopPropagation();
                            setFilter({
                                ...filterObj,
                                filterCopy: !filterObj.filterCopy,
                            });
                        }}
                    >
                        Show Copied Code
                    </VSCodeButton>
                    <VSCodeButton
                        appearance="secondary"
                        className={
                            filterObj.filterPaste
                                ? `${styles['active']} ${styles['ml4']}`
                                : styles['ml4']
                        }
                        onClick={(e: any) => {
                            e.stopPropagation();
                            setFilter({
                                ...filterObj,
                                filterPaste: !filterObj.filterPaste,
                            });
                        }}
                    >
                        Show Pasted Code
                    </VSCodeButton>
                    <VSCodeButton
                        appearance="secondary"
                        className={
                            filterObj.filterWeb
                                ? `${styles['active']} ${styles['ml4']}`
                                : styles['ml4']
                        }
                        onClick={(e: any) => {
                            e.stopPropagation();
                            setFilter({
                                ...filterObj,
                                filterWeb: !filterObj.filterWeb,
                            });
                        }}
                    >
                        Show Code Pasted From Online
                    </VSCodeButton>
                    <VSCodeButton
                        className={styles['ml4']}
                        // appearance="secondary"
                        // disabled={window.getSelection()?.toString() === ''}
                        onClick={(e: any) => {
                            e.stopPropagation();
                            context.requestLocation(
                                version,
                                window.getSelection()?.toString() || '',
                                version.location.range
                            );
                        }}
                    >
                        Search for Selected Code
                    </VSCodeButton>
                    <div>{extraButtons}</div>
                    {/* {state === VersionState.SEARCH_RESULT ? (
                    
                ) : null} */}
                </div>
            </div>
        );
    };

    const summaryHelper = () => {
        const jsx = [];
        const meta = new MetaInformationController(context.timelineController);
        if (version.eventData) {
            switch (Object.keys(version.eventData)[0]) {
                case Event.WEB: {
                    const webEvent = version.eventData[Event.WEB]!;
                    const { copyBuffer } = webEvent;
                    // setState(VersionState.WEB);
                    // if (webEvent?.copyBuffer.searchData) {
                    //     jsx.push(
                    //         <div>
                    //             At {new Date(version.time).toLocaleString()},{' '}
                    //             {version.userString} searched for
                    //             {webEvent.copyBuffer.searchData.query} and
                    //             visited {webEvent.copyBuffer.searchData.url}
                    //         </div>
                    //     );
                    // }

                    jsx.push(
                        <div>{meta.render((version as any).timelineEvent)}</div>
                    );
                    break;
                }
                case Event.PASTE: {
                    const pasteEvent = version.eventData[Event.PASTE]!;
                    // setState(VersionState.PASTE);
                    jsx.push(
                        <div>{meta.render((version as any).timelineEvent)}</div>
                    );
                    break;
                }
                case Event.COPY: {
                    const copyEvent = version.eventData[Event.COPY]!;
                    // setState(VersionState.COPY);
                    jsx.push(
                        <div>
                            Copied <code>{copyEvent?.copyContent}</code> from{' '}
                            {copyEvent?.nodeId
                                ? copyEvent.nodeId.split(':')[0]
                                : 'VS Code'}{' '}
                        </div>
                    );
                    break;
                }
            }
            // jsx.push(
            //     <Accordion style={{ color: 'white' }}>
            //         <AccordionSummary>See More</AccordionSummary>
            //         <AccordionDetails>
            //             {new MetaInformationController(
            //                 context.timelineController
            //             ).render(version.timelineEvent)}
            //         </AccordionDetails>
            //     </Accordion>
            // );
        }
        // jsx.push(
        //     <div>
        //         Edited by {version.userString} at{' '}
        //         {new Date(version.time).toLocaleString()}
        //     </div>
        // );
        return jsx;
    };

    if (!version.location) {
        return (
            <div>
                <h3
                    style={{
                        textAlign: 'left',
                        backgroundColor: color,
                        padding: '0.5rem',
                    }}
                    className={styles['inactive']}
                >
                    {currNode.id.split(':')[0]}
                </h3>
                <div>
                    Not on current version.{' '}
                    <a
                        onClick={() => {
                            jumpToFirstInstance();
                        }}
                    >
                        Jump to first instance?
                    </a>
                </div>
            </div>
        );
    }

    const getStatus = () => {
        switch (state) {
            case VersionState.COPY:
                return (
                    <div
                        style={{
                            backgroundColor: META_MANAGER_COLOR,
                            padding: '0.5rem',
                        }}
                    >
                        Copied
                    </div>
                );
            case VersionState.PASTE:
                return (
                    <div
                        style={{
                            backgroundColor: META_MANAGER_COLOR,
                            padding: '0.5rem',
                        }}
                    >
                        Pasted
                    </div>
                );
            case VersionState.WEB:
                return (
                    <div
                        style={{
                            backgroundColor: META_MANAGER_COLOR,
                            padding: '0.5rem',
                        }}
                    >
                        Pasted from Online
                    </div>
                );
            case VersionState.SEARCH_RESULT:
                return (
                    <div
                        style={{
                            backgroundColor: META_MANAGER_SEARCH_COLOR,
                            padding: '0.5rem',
                        }}
                    >
                        Search Result
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div style={{ width: '100%' }}>
            <div>
                <div
                    className={styles['flex']}
                    style={{ justifyContent: 'space-between' }}
                >
                    <h3
                        style={{
                            textAlign: 'left',
                            backgroundColor: color,
                            padding: '0.5rem',
                        }}
                    >
                        {currNode.id.split(':')[0]}
                    </h3>
                    <div>{getStatus()}</div>
                </div>
                <ButtonRow></ButtonRow>
            </div>
            <div>
                {/* <div>Version {currIdx}</div> */}
                <div>
                    {summaryHelper()}
                    Edited by {version.userString} at{' '}
                    {new Date(version.time).toLocaleString()}
                </div>
            </div>
        </div>
    );
};

const CodeNode: React.FC<Props> = ({ currNode, versions, context, color }) => {
    const [expanded, setExpanded] = React.useState<boolean>(false);
    const [currIdx, _setCurrIdx] = React.useState<number>(0);
    const currIdxRef = React.useRef<number>(0);
    const setCurrIdx = (idx: number) => {
        currIdxRef.current = idx;
        _setCurrIdx(idx);
    };
    const [filterObj, _setFilter] = React.useState(defaultFilterObj);
    const [searchResult, setSearchResult] = React.useState<SearchResult | null>(
        null
    );
    const [state, setState] = React.useState<VersionState>(
        VersionState.DEFAULT
    );

    const [preview, setPreview] = React.useState<SerializedChangeBuffer | null>(
        null
    );
    // const [copyEvents, setCopyEvents] = React.useState<
    //     SerializedChangeBuffer[]
    // >([]);
    // const [pasteEvents, setPasteEvents] = React.useState<
    //     SerializedChangeBuffer[]
    // >([]);
    // const [webEvents, setWebEvents] = React.useState<SerializedChangeBuffer[]>(
    //     []
    // );

    const setFilter = (filterObj: { [k: string]: boolean }) => {
        const newEvents = versions.filter((v) => {
            if (
                filterObj.filterCopy &&
                v.eventData &&
                v.eventData[Event.COPY]
            ) {
                return true;
            }
            if (
                filterObj.filterPaste &&
                v.eventData &&
                v.eventData[Event.PASTE]
            ) {
                return true;
            }
            if (filterObj.filterWeb && v.eventData && v.eventData[Event.WEB]) {
                return true;
            }
            return false;
        });
        _setFilter(filterObj);
        context.setScrubberEvents(newEvents);
    };

    // React.useEffect(() => {
    //     const copyEvents = versions.filter(
    //         (v) => v.eventData && v.eventData[Event.COPY]
    //     );
    //     const pasteEvents = versions.filter(
    //         (v) => v.eventData && v.eventData[Event.PASTE]
    //     );
    //     const webEvents = versions.filter(
    //         (v) => v.eventData && v.eventData[Event.WEB]
    //     );
    //     setCopyEvents(copyEvents);
    //     setPasteEvents(pasteEvents);
    //     setWebEvents(webEvents);
    // }, [versions]);

    const getExtraButtons = () => {
        if (state === VersionState.DEFAULT) {
            return null;
        } else if (state === VersionState.SEARCH_RESULT) {
            return (
                <div className={styles['flex']}>
                    <VSCodeButton
                        className={styles['ml4']}
                        onClick={(e: any) => {
                            e.stopPropagation();

                            const nextInstance = [
                                ...context._searchResults!.results,
                            ]
                                .reverse()
                                .find((r) => r.idx < currIdx);
                            if (nextInstance) {
                                setCurrIdx(nextInstance.idx);
                                context.setFocusedIndex(nextInstance.idx);
                                context.setScrubberEvents(
                                    context!._searchResults!.results,
                                    nextInstance.idx
                                );
                            } else {
                                setCurrIdx(
                                    context._searchResults?.results[
                                        context._searchResults!.results.length -
                                            1
                                    ].idx || currIdx
                                );
                                context.setFocusedIndex(
                                    context._searchResults?.results[
                                        context._searchResults!.results.length -
                                            1
                                    ].idx || currIdx
                                );
                                context.setScrubberEvents(
                                    context!._searchResults!.results,
                                    context._searchResults?.results[
                                        context._searchResults!.results.length -
                                            1
                                    ].idx || currIdx
                                );
                            }
                        }}
                    >
                        <ArrowLeft />
                    </VSCodeButton>
                    <VSCodeButton
                        className={styles['ml4']}
                        onClick={(e: any) => {
                            e.stopPropagation();
                            const nextInstance =
                                context._searchResults?.results.find(
                                    (r) => r.idx > currIdx
                                );
                            console.log(
                                'nextInstance',
                                nextInstance,
                                'context._searchResults?.results',
                                context._searchResults?.results,
                                'curridx',
                                currIdx
                            );
                            if (nextInstance) {
                                setCurrIdx(nextInstance.idx);
                                context.setFocusedIndex(nextInstance.idx);
                                context.setScrubberEvents(
                                    context!._searchResults!.results,
                                    nextInstance.idx
                                );
                            } else {
                                setCurrIdx(
                                    context._searchResults?.results[0].idx ||
                                        currIdx
                                );
                                context.setFocusedIndex(
                                    context._searchResults?.results[0].idx ||
                                        currIdx
                                );
                                context.setScrubberEvents(
                                    context!._searchResults!.results,
                                    context._searchResults?.results[0].idx ||
                                        currIdx
                                );
                            }
                        }}
                    >
                        <ArrowRight />
                    </VSCodeButton>
                </div>
            );
        } else if (state === VersionState.COPY) {
            return (
                <div className={styles['flex']}>
                    {/* <VSCodeButton
                        onClick={(e: any) => {
                            e.stopPropagation();
                            context.requestLocation(
                                versions[currIdx],
                                versions[currIdx]?.eventData![Event.COPY]
                                    ?.copyContent || '',
                                getRangeFromSubstring(
                                    versions[currIdx].location.range,
                                    versions[currIdx].location.content,
                                    versions[currIdx]?.eventData![Event.COPY]
                                        ?.copyContent || ''
                                )
                            );
                            context.clearRange();
                        }}
                    >
                        See Copy Code Now
                    </VSCodeButton> */}
                    <VSCodeButton
                        className={styles['ml4']}
                        onClick={(e: any) => {
                            e.stopPropagation();
                            context.requestPasteLocations(versions[currIdx]);
                        }}
                    >
                        See All Paste Locations
                    </VSCodeButton>
                </div>
            );
        } else if (state === VersionState.PASTE || state === VersionState.WEB) {
            return (
                <div className={styles['flex']}>
                    {/* <VSCodeButton
                        onClick={(e: any) => {
                            e.stopPropagation();
                            // @ ts-ignore
                            let event;
                            let code = '';
                            if (state === VersionState.PASTE) {
                                event =
                                    versions[currIdx]?.eventData![Event.PASTE];
                                code = event?.pasteContent || '';
                            } else {
                                event =
                                    versions[currIdx]?.eventData![Event.WEB];
                                code = event?.copyBuffer?.code || '';
                            }
                            context.requestLocation(
                                versions[currIdx],
                                code,
                                getRangeFromSubstring(
                                    versions[currIdx].location.range,
                                    versions[currIdx].location.content,
                                    code
                                )
                            );
                            context.clearRange();
                        }}
                    >
                        See Paste Code Now
                    </VSCodeButton> */}
                    {state === VersionState.PASTE ? (
                        <VSCodeButton
                            className={styles['ml4']}
                            onClick={(e: any) => {
                                e.stopPropagation();
                                if (preview) {
                                    setPreview(null);
                                } else {
                                    context.requestCopyLocations(
                                        versions[currIdx]
                                    );
                                }
                            }}
                        >
                            See Corresponding Copy
                        </VSCodeButton>
                    ) : null}
                    <VSCodeButton
                        className={styles['ml4']}
                        onClick={(e: any) => {
                            e.stopPropagation();
                            // className={styles['ml4']}
                            if (preview) {
                                setPreview(null);
                            } else {
                                context.requestPasteLocations(
                                    versions[currIdx]
                                );
                            }
                        }}
                    >
                        See All Other Paste Locations
                    </VSCodeButton>
                </div>
            );
        }
    };

    const checkIdx = (idx: number) => {
        const v = versions.find((v) => v.idx === idx);
        // let state = VersionState.DEFAULT;
        if (v && v.location) {
            if (v.eventData) {
                if (v.eventData[Event.COPY]) {
                    setState(VersionState.COPY);
                    return;
                } else if (v.eventData[Event.PASTE]) {
                    setState(VersionState.PASTE);
                    return;
                } else if (v.eventData[Event.WEB]) {
                    setState(VersionState.WEB);
                    return;
                }
            } else if (searchResult) {
                if (searchResult.results.some((s) => s.idx === idx)) {
                    setState(VersionState.SEARCH_RESULT);
                    return;
                }
            } else if (context._searchTerm.length) {
                v.location.content.includes(context._searchTerm) &&
                    setState(VersionState.SEARCH_RESULT);
                return;
            }
        }
        setState(VersionState.DEFAULT);
        return;
    };

    React.useEffect(() => {
        window.addEventListener('message', (e) => {
            const { command } = e.data;
            if (command === 'foundCopiedCode') {
                const { payload } = e.data;
                const version = versions.find(
                    (v) => v.idx === currIdxRef.current
                );
                if (
                    version &&
                    version.eventData &&
                    version.eventData[Event.PASTE]
                ) {
                    setPreview(payload.copies);
                    // context.setFocusedIndex(payload.idx);
                    // context.setScrubberToIdx(payload.idx);
                }
                // const { payload } = e.data;
                // setCurrIdx(payload.currIdx);
                // setExpanded(payload.expanded);
                // setSearchResult(payload.searchResult);
                // checkIdx(payload.currIdx);
            }
            if (command === 'foundPastedCode') {
                const { payload } = e.data;
                const version = versions.find(
                    (v) => v.idx === currIdxRef.current
                );
                console.log('payload', payload, 'version', version);
                if (
                    version &&
                    version.eventData &&
                    version.eventData[Event.COPY]
                ) {
                    console.log('SETTING PREVIEW');
                    setPreview(payload.pastes);
                    // context.setFocusedIndex(payload.idx);
                    // context.setScrubberToIdx(payload.idx);
                }
                // const { payload } = e.data;
                // setCurrIdx(payload.currIdx);
                // setExpanded(payload.expanded);
                // setSearchResult(payload.searchResult);
                // checkIdx(payload.currIdx);
            }
        });
    }, []);

    React.useEffect(() => {
        // console.log('use effect in code node', context._focusedIndex);
        setCurrIdx(context._focusedIndex);
        checkIdx(context._focusedIndex);
        preview && setPreview(null);
    }, [context._focusedIndex]);

    React.useEffect(() => {
        // console.log(
        //     'use effect in code node search',
        //     context,
        //     'currNode',
        //     currNode
        // );
        if (
            context._searchResults &&
            context._searchResults.node === (currNode as any).parentId
        ) {
            console.log('ITS MEEEE');
            setSearchResult(context._searchResults);
        } else {
            setSearchResult(null);
        }
    }, [context._searchResults]);

    // const [shouldExpand, setShouldExpand] = React.useState<boolean>(expanded);
    const getCodeBlock = () => {
        const version = versions.find((v) => v.idx === currIdx);
        if (!version || !version.location) {
            return null;
        }
        console.log(
            'version',
            version,
            'currIdx',
            currIdx,
            'versions',
            versions,
            'curr',
            currNode
        );
        if (version.eventData) {
            if (version.eventData[Event.WEB]) {
                const copyBuffer = version.eventData[Event.WEB].copyBuffer;
                return (
                    <CodeBlock
                        codeString={version.location.content}
                        highlightLogic={getHighlightLogic(
                            version.location.content,
                            copyBuffer
                        )}
                    />
                );
            }
            if (version.eventData[Event.PASTE]) {
                const eventData = version.eventData[Event.PASTE];
                return (
                    <CodeBlock
                        codeString={version.location.content}
                        highlightLogic={getHighlightLogic(
                            version.location.content,
                            {
                                ...eventData,
                                code: eventData.pasteContent,
                            } as unknown as CopyBuffer
                        )}
                    />
                );
            }
            if (version.eventData[Event.COPY]) {
                const eventData = version.eventData[Event.COPY];
                console.log('versions?', version);
                return (
                    <CodeBlock
                        codeString={version.location.content}
                        highlightLogic={getHighlightLogic(
                            version.location.content,
                            {
                                ...eventData,
                                code: eventData.copyContent,
                            } as unknown as CopyBuffer
                        )}
                    />
                );
            }
        }
        if (searchResult) {
            console.log('search result', searchResult);
            // const { query } = searchResult;
            const { results } = searchResult;
            const match = results.find((c) => c.idx === currIdx);
            if (match) {
                const highlightLogic = getHighlightLogic(
                    version.location.content,
                    {
                        code: match.searchContent,
                    } as unknown as CopyBuffer,
                    'search'
                );
                return (
                    <CodeBlock
                        codeString={version.location.content}
                        highlightLogic={highlightLogic}
                    />
                );
            } else {
                return <CodeBlock codeString={version.location.content} />;
            }
        }
        const highlightLogic = context._searchTerm.length
            ? getHighlightLogic(
                  version.location.content,
                  {
                      code: context._searchTerm,
                  } as unknown as CopyBuffer,
                  'search'
              )
            : undefined;
        return (
            <CodeBlock
                codeString={version.location.content}
                highlightLogic={highlightLogic}
            />
        );
    };

    const jumpToFirstInstance = () => {
        const firstInstance = versions.find((v) => v.location);
        if (firstInstance) {
            goToIdx(firstInstance.idx);
        }
    };

    const formatPreview = () => {
        if (!preview) {
            return null;
        }
        if (preview.eventData && preview.eventData[Event.COPY]) {
            return (
                <div>
                    Showing preview of copy from {preview.id.split(':')[0]} in{' '}
                    {preview.location.fsPath.split(/[\\|\/]/g).pop()}
                    <CodeBlock
                        codeString={preview.location.content}
                        highlightLogic={getHighlightLogic(
                            preview.location.content,
                            {
                                code: preview.eventData[Event.COPY].copyContent,
                            } as unknown as CopyBuffer
                        )}
                    />{' '}
                    <VSCodeButton onClick={() => setPreview(null)}>
                        Clear preview
                    </VSCodeButton>
                </div>
            );
        } else if (preview.eventData && preview.eventData[Event.PASTE]) {
            console.log('ELSE IF????', preview);
            return (
                <div>
                    Showing preview of paste in {preview.id.split(':')[0]} in{' '}
                    {preview.location.fsPath.split(/[\\|\/]/g).pop()}
                    <CodeBlock
                        codeString={preview.location.content}
                        highlightLogic={getHighlightLogic(
                            preview.location.content,
                            {
                                code: preview.eventData[Event.PASTE]
                                    .pasteContent,
                            } as unknown as CopyBuffer
                        )}
                    />
                    <VSCodeButton onClick={() => setPreview(null)}>
                        Clear preview
                    </VSCodeButton>
                </div>
            );
        }
    };

    const goToIdx = (idx: number) => {
        context.setFocusedIndex(idx);
        context.setScrubberToIdx(idx);
    };

    const currVersion = versions.find((v) => v.idx === currIdx);
    const firstEverVersion = versions.find((d) => d.location);
    return (
        <div>
            <ThemeProvider theme={theme}>
                <Card
                    style={{
                        ...cardStyle,
                        marginLeft: `${1 * (firstEverVersion as any).depth}rem`,
                    }}
                >
                    <Accordion
                        style={{
                            color: 'white',
                        }}
                        expanded={expanded}
                        onChange={() => setExpanded(!expanded)}
                        disabled={!currVersion}
                    >
                        <AccordionSummary>
                            {/* <div>{...getSummary()}</div>
                             */}
                            <Summary
                                version={
                                    versions.find((v) => v.idx === currIdx) ||
                                    versions[0]
                                }
                                pastVersion={versions.find(
                                    (v) => v.idx === currIdx - 1
                                )}
                                currIdx={currIdx}
                                currNode={currNode}
                                context={context}
                                color={color}
                                filterObj={filterObj}
                                isInSearch={
                                    searchResult !== null &&
                                    searchResult.results.some(
                                        (s) => s.idx === currIdx
                                    )
                                }
                                setFilter={setFilter}
                                jumpToFirstInstance={jumpToFirstInstance}
                                // state={checkIdx(currIdx)}
                                state={state}
                                extraButtons={getExtraButtons()}
                            />
                        </AccordionSummary>
                        <AccordionDetails>
                            {formatPreview()}
                            {getCodeBlock()}
                        </AccordionDetails>
                    </Accordion>
                </Card>
            </ThemeProvider>
        </div>
    );
};

export default CodeNode;
