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
        edited on ${new Date(question.postDate).toLocaleString()},`
            : '';
        return (
            <div>
                <div>
                    <a href={soData.url} className={styles['title']}>
                        {question.programmingLanguage}
                    </a>

                    <div className={styles['meta']}>
                        Asked on {new Date(question.postDate).toLocaleString()},
                        {lastViewedStr} viewed {question.views} time(s),
                        received {question.votes} vote(s).
                    </div>
                </div>
                <div className={styles['so-post']}>
                    {question.formattedQuestionBody.map((p, i) => {
                        switch (p.type) {
                            default:
                            case 'text': {
                                return (
                                    <div
                                        key={p.content + i}
                                        className={styles['message']}
                                    >
                                        {p.content}
                                    </div>
                                );
                            }
                            case 'code': {
                                return (
                                    <CodeBlock
                                        key={p.content + i}
                                        codeString={p.content}
                                        highlightLogic={getHighlightLogic(
                                            p.content
                                        )}
                                    />
                                );
                            }
                            case 'link': {
                                return (
                                    <a
                                        key={p.content + i}
                                        href={p.content}
                                        className={styles['link']}
                                    >
                                        {p.content}
                                    </a>
                                );
                            }
                        }
                    })}
                </div>
            </div>
        );
    };

    const formatStackOverflowAnswer = (answer: StackOverflowAnswer) => {
        const lastViewedStr = answer.lastEditDate
            ? ` last
        edited on ${new Date(answer.lastEditDate).toLocaleString()}, `
            : '';
        const isAcceptedStr = answer.isAccepted
            ? ', answer is accepted'
            : ', answer is not accepted';
        return (
            <div>
                <div>
                    <div className={styles['meta']}>
                        Answered on {new Date(answer.postDate).toLocaleString()}
                        {lastViewedStr}
                        {isAcceptedStr}, and received {answer.votes} vote(s).
                    </div>
                </div>
                <div className={styles['so-post']}>
                    {answer.formattedAnswerBody.map((p, i) => {
                        switch (p.type) {
                            default:
                            case 'text': {
                                return (
                                    <div
                                        key={p.content + i}
                                        className={styles['message']}
                                    >
                                        {p.content}
                                    </div>
                                );
                            }
                            case 'code': {
                                return (
                                    <CodeBlock
                                        key={p.content + i}
                                        codeString={p.content}
                                        highlightLogic={getHighlightLogic(
                                            p.content
                                        )}
                                    />
                                );
                            }
                            case 'link': {
                                return (
                                    <a
                                        key={p.content + i}
                                        href={p.content}
                                        className={styles['link']}
                                    >
                                        {p.content}
                                    </a>
                                );
                            }
                        }
                    })}
                </div>
            </div>
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
            <div className={`${styles['container']} ${styles['so']}`}>
                {formatStackOverflow(
                    (soData.additionalMetadata as StackOverflowCopyBuffer)
                        .copiedMessage
                )}
            </div>
        </div>
    ) : null;
}

export default StackOverflowHistory;
