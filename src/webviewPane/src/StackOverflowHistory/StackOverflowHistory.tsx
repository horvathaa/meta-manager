import * as React from 'react';
import {
    ChatGptCopyBuffer,
    CopyBuffer,
    StackOverflowAnswer,
    StackOverflowCopyBuffer,
    StackOverflowPost,
    StackOverflowQuestion,
    ThreadPair,
    isStackOverflowAnswer,
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

export function StackOverflowHistory({
    copyBufferProps,
}: {
    copyBufferProps: CopyBuffer;
}) {
    const [soData, setSoData] = React.useState<CopyBuffer>(copyBufferProps);
    // React.useEffect(() => {
    //     window.addEventListener('message', (e: MessageEvent<any>) => {
    //         const { command } = e.data;
    //         if (command === 'renderChatGptHistory') {
    //             const { payload } = e.data;
    //             setGptData(payload);
    //         }
    //     });
    // });

    const getHighlightLogic = (code: string) => {
        const copiedCodeArr = soData.code.split('\n');
        const lines = code.split('\n');
        const lineNumbers = lines
            .filter((l) => copiedCodeArr.includes(l))
            .map((l, i) => i);
        return (lineNumber: number) => {
            let style: React.CSSProperties = {};
            if (lineNumbers.includes(lineNumber)) {
                style.backgroundColor = '#519aba80';
            }
            // console.log('is this being called', lineNumber, lineNumbers);
            return { style };
        };
    };

    const formatStackOverflowQuestion = (question: StackOverflowQuestion) => {
        const lastViewedStr = question.lastEditDate
            ? ` last
        edited on ${question.lastEditDate.toLocaleString()},`
            : '';
        return (
            <>
                <a href={soData.url} className={styles['title']}>
                    {question.title}
                </a>
                <div>
                    <div className={styles['meta']}>
                        Posted on {question.postDate.toLocaleString()},
                        {lastViewedStr} viewed {question.views} time(s),
                        received {question.votes} vote(s).
                    </div>
                </div>
                {question.formattedQuestionBody.map((p) => {
                    switch (p.type) {
                        default:
                        case 'text': {
                            return (
                                <div className={styles['message']}>
                                    {p.content}
                                </div>
                            );
                        }
                        case 'code': {
                            return (
                                <CodeBlock
                                    codeString={p.content}
                                    highlightLogic={getHighlightLogic(
                                        p.content
                                    )}
                                />
                            );
                        }
                        case 'link': {
                            return (
                                <a href={p.content} className={styles['link']}>
                                    {p.content}
                                </a>
                            );
                        }
                    }
                })}
            </>
        );
    };

    const formatStackOverflowAnswer = (answer: StackOverflowAnswer) => {
        const lastViewedStr = answer.lastEditDate
            ? ` last
        edited on ${answer.lastEditDate.toLocaleString()},`
            : '';
        const isAcceptedStr = answer.isAccepted
            ? ', is accepted'
            : ', is not accepted';
        return (
            <>
                <div>
                    <div className={styles['meta']}>
                        Posted on {answer.postDate.toLocaleString()},
                        {lastViewedStr}
                        {isAcceptedStr} received {answer.votes} vote(s).
                    </div>
                </div>
                {answer.formattedAnswerBody.map((p) => {
                    switch (p.type) {
                        default:
                        case 'text': {
                            return (
                                <div className={styles['message']}>
                                    {p.content}
                                </div>
                            );
                        }
                        case 'code': {
                            return (
                                <CodeBlock
                                    codeString={p.content}
                                    highlightLogic={getHighlightLogic(
                                        p.content
                                    )}
                                />
                            );
                        }
                        case 'link': {
                            return (
                                <a href={p.content} className={styles['link']}>
                                    {p.content}
                                </a>
                            );
                        }
                    }
                })}
            </>
        );
    };

    const formatStackOverflow = (
        threadMessage: StackOverflowQuestion | StackOverflowAnswer | null
    ) => {
        if (null) {
            return <></>;
        }
        if (isStackOverflowAnswer(threadMessage as StackOverflowPost)) {
            return (
                <>
                    {formatStackOverflowQuestion(
                        (soData.additionalMetadata as StackOverflowCopyBuffer)
                            .question
                    )}
                    {formatStackOverflowAnswer(
                        threadMessage as StackOverflowAnswer
                    )}
                </>
            );
        } else {
            return formatStackOverflowQuestion(
                threadMessage as StackOverflowQuestion
            );
        }
    };

    return soData ? (
        <div>
            <div className={styles['container']}>
                {formatStackOverflow(
                    (soData.additionalMetadata as StackOverflowCopyBuffer)
                        .copiedMessage
                )}
            </div>
        </div>
    ) : null;
}

export default StackOverflowHistory;
