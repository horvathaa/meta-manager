import CodeBlock from '../components/CodeBlock';
import {
    SerializedChangeBuffer,
    Event,
    CopyBuffer,
    WEB_INFO_SOURCE,
} from '../types/types';
import * as React from 'react';
import GraphController from './GraphController';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Card,
    ThemeProvider,
} from '@mui/material';
import styles from '../styles/timeline.module.css';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { prettyPrintType } from './Scrubber';
import * as Diff from 'diff';
import { cardStyle } from '../styles/globals';
import { theme } from './TimelineController';
import MetaInformationController from './MetaInformationController';
import { get } from 'lodash';

interface Props {
    version: SerializedChangeBuffer;
    context: GraphController;
    highlightLogicProp?: (lineNumber: number) => { style: React.CSSProperties };
    color: string;
    priorVersion?: SerializedChangeBuffer;
    expanded?: boolean;
}

type EventType = Event.WEB | Event.PASTE | Event.COPY | 'search';

export const getHighlightLogic = (
    code: string,
    copyBuffer: CopyBuffer,
    type?: EventType
) => {
    const copiedCodeArr = copyBuffer.code.split('\n').map((c) => c.trim());
    const checkTokenLevel = copiedCodeArr.length === 1;
    const lines = code.split('\n').map((c) => c.trim());
    // console.log(
    //     'copiedCodeArr',
    //     copiedCodeArr,
    //     'lines',
    //     lines,
    //     'copyBuffer',
    //     copyBuffer
    // );
    const set = new Set();
    const maybeSet = new Set();
    lines.forEach((l, i) => {
        copiedCodeArr.includes(l) &&
        (l.length > 1 || set.has(i > 0 ? i - 1 : 0)) // hacky heuristic for "real content" w/o omitting pure symbols contained in range
            ? set.add(i)
            : null;
        if (checkTokenLevel && l.includes(copyBuffer.code)) {
            maybeSet.add(i);
        }
    });
    // .map((l, i) => i);
    return (lineNumber: number) => {
        let style: React.CSSProperties = {};
        if (set.has(lineNumber - 1) || maybeSet.has(lineNumber - 1)) {
            // for token level would be nice to get specific token only highlighted but idk how to do that
            // with this API
            style.backgroundColor =
                type && type === 'search' ? '#d69756a8' : '#519aba80';
        }
        // console.log('is this being called', lineNumber, lineNumbers);
        return { style };
    };
};

const Version: React.FC<Props> = ({
    version,
    priorVersion,
    highlightLogicProp,
    context,
    color,
    expanded = false,
}: Props) => {
    const [shouldExpand, setShouldExpand] = React.useState<boolean>(expanded);
    const getCodeBlock = () => {
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
                highlightLogic={
                    highlightLogicProp ? highlightLogicProp : highlightLogic
                }
            />
        );
    };

    const getSummary = () => {
        const jsx = [];
        const meta = new MetaInformationController(context.timelineController);
        if (version.eventData) {
            switch (Object.keys(version.eventData)[0]) {
                case Event.WEB: {
                    const webEvent = version.eventData[Event.WEB]!;
                    const { copyBuffer } = webEvent;
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
                        <>
                            {meta.renderAdditionalMetadata(
                                copyBuffer,
                                copyBuffer.type
                            )}
                        </>
                    );
                    break;
                }
                case Event.PASTE: {
                    const pasteEvent = version.eventData[Event.PASTE]!;

                    // jsx.push(<div>{meta.render(version.timelineEvent)}</div>);
                    break;
                }
                case Event.COPY: {
                    const copyEvent = version.eventData[Event.COPY]!;
                    jsx.push(
                        <div>
                            At {new Date(version.time).toLocaleString()},{' '}
                            {version.userString} copied{' '}
                            <code>{copyEvent?.copyContent}</code> from{' '}
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
        jsx.push(
            <div>
                Edited by {version.userString} at{' '}
                {new Date(version.time).toLocaleString()}
            </div>
        );
        return jsx;
    };

    return (
        <div>
            <ThemeProvider theme={theme}>
                <Card style={cardStyle}>
                    <Accordion
                        style={{ color: 'white' }}
                        expanded={shouldExpand}
                        onChange={() => setShouldExpand(!shouldExpand)}
                    >
                        <AccordionSummary>
                            <div>
                                <h3
                                    style={{
                                        textAlign: 'left',
                                        backgroundColor: color,
                                    }}
                                >
                                    {version.id.split(':')[0]}
                                </h3>
                                {...getSummary()}
                            </div>
                        </AccordionSummary>
                        <AccordionDetails>{getCodeBlock()}</AccordionDetails>
                    </Accordion>
                </Card>
            </ThemeProvider>
        </div>
    );
};

export default Version;
