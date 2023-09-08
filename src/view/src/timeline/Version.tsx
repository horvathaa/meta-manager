import CodeBlock from '../components/CodeBlock';
import { SerializedChangeBuffer, Event, CopyBuffer } from '../types/types';
import * as React from 'react';
import GraphController from './GraphController';

interface Props {
    version: SerializedChangeBuffer;
    context: GraphController;
    priorVersion?: SerializedChangeBuffer;
}

type EventType = Event.WEB | Event.PASTE | Event.COPY | 'search';

const getHighlightLogic = (
    code: string,
    copyBuffer: CopyBuffer,
    type?: EventType
) => {
    const copiedCodeArr = copyBuffer.code.split('\n').map((c) => c.trim());
    const checkTokenLevel = copiedCodeArr.length === 1;
    const lines = code.split('\n').map((c) => c.trim());
    console.log('copiedCodeArr', copiedCodeArr, 'lines', lines);
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
    context,
}: Props) => {
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
                highlightLogic={highlightLogic}
            />
        );
    };

    return (
        <div>
            <h2 style={{ textAlign: 'center' }}>{version.id.split(':')[0]}</h2>
            <div>
                Edited by {version.userString} at{' '}
                {new Date(version.time).toLocaleString()}
            </div>
            {getCodeBlock()}
        </div>
    );
};

export default Version;
