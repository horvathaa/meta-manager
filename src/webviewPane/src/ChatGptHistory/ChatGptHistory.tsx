import * as React from 'react';
import {
    ChatGptCopyBuffer,
    CopyBuffer,
    ThreadPair,
} from '../../../view/src/types/types';
// import DataController from '../DataController/DataController';
// import {
//     ThreadPair,
//     CopyBuffer,
//     ChatGptCopyBuffer,
// } from '../../../constants/types';
import styles from '../../../view/src/styles/chatGptStyle.module.css';
import CodeBlock from '../../../view/src/components/CodeBlock';
// // import ChatGptMessage from './ChatGptMessage';
// import CodeBlock from '../components/CodeBlock';
// // import DataController from '../DataController/DataController';

// const CopyText = {
//     copy: 'Copy code',
//     copied: 'Copied!',
// };

export function ChatGptHistory({
    copyBufferProps,
}: {
    copyBufferProps: CopyBuffer;
}) {
    const [gptData, setGptData] = React.useState<CopyBuffer>(copyBufferProps);
    React.useEffect(() => {
        window.addEventListener('message', (e: MessageEvent<any>) => {
            const { command } = e.data;
            if (command === 'renderChatGptHistory') {
                const { payload } = e.data;
                setGptData(payload);
            }
        });
    });

    const getHighlightLogic = (code: string) => {
        const copiedCodeArr = gptData.code.split('\n');
        const lines = code.split('\n');
        const set = new Set();
        lines.forEach((l, i) =>
            copiedCodeArr.includes(l) ? set.add(i) : null
        );
        // .map((l, i) => i);
        return (lineNumber: number) => {
            let style: React.CSSProperties = {};
            if (set.has(lineNumber)) {
                style.backgroundColor = '#519aba80';
            }
            // console.log('is this being called', lineNumber, lineNumbers);
            return { style };
        };
    };

    const formatBotResponse = (threadMessage: ThreadPair) => {
        const { botResponse, codeBlocks } = threadMessage;
        if (!codeBlocks.length) {
            return <div className={styles['message']}>{botResponse}</div>;
        }
        let strCopy = botResponse;
        const jsx: React.ReactElement[] = [];
        codeBlocks.forEach((c) => {
            const temp = strCopy.split(c.code);
            jsx.push(<div className={styles['message']}>{temp[0]}</div>);
            const code = c.code.includes('Copy code') // change to match on CopyText's
                ? c.code.split('Copy code')[1]
                : c.code;
            if (code.includes(gptData.code)) {
                const highlightLogic = getHighlightLogic(code);
                jsx.push(
                    <CodeBlock
                        codeString={code}
                        highlightLogic={highlightLogic}
                    />
                );
            } else {
                jsx.push(<CodeBlock codeString={code} />);
            }
            // jsx.push(<CodeBlock codeString={code} />);
            strCopy = temp[1];
        });
        jsx.push(<div className={styles['message']}>{strCopy}</div>);
        return <>{...jsx}</>;
    };

    return gptData ? (
        <div>
            <div className={styles['container']}>
                <div className={styles['message']}>
                    {
                        (gptData.additionalMetadata as ChatGptCopyBuffer)
                            .messageCopied.userMessage
                    }
                </div>
                <div className={styles['message']}>
                    {formatBotResponse(
                        (gptData.additionalMetadata as ChatGptCopyBuffer)
                            .messageCopied
                    )}
                </div>
            </div>
        </div>
    ) : null;
}

export default ChatGptHistory;
