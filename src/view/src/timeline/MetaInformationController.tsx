import TimelineEvent, { GitType } from '../../../data/timeline/TimelineEvent';
import TimelineController from './TimelineController';
import styles from '../styles/timeline.module.css';
// import {
//     AdditionalMetadata,
//     ChatGptCopyBuffer,
//     Event,
//     GitHubCopyBuffer,
//     SerializedChangeBuffer,
//     // StackOverflowAnswer,
//     // StackOverflowCopyBuffer,
//     // StackOverflowQuestion,
//     // isStackOverflowAnswer,
//     CopyBuffer,
//     WEB_INFO_SOURCE,
// } from '../../../constants/types';

import CodeBlock from '../components/CodeBlock';
import * as React from 'react';
import {
    SerializedChangeBuffer,
    WEB_INFO_SOURCE,
    Event,
    // AdditionalMetadata,
    GitHubCopyBuffer,
    ChatGptCopyBuffer,
    CopyBuffer,
    StackOverflowCopyBuffer,
    isStackOverflowAnswer,
    StackOverflowAnswer,
    StackOverflowQuestion,
} from '../types/types';
import { VS_CODE_API } from '../VSCodeApi';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';

const prettyPrintType: { [k in WEB_INFO_SOURCE]: string } = {
    [WEB_INFO_SOURCE.CHAT_GPT]: 'Chat GPT',
    [WEB_INFO_SOURCE.VSCODE]: 'VS Code',
    [WEB_INFO_SOURCE.GITHUB]: 'GitHub',
    [WEB_INFO_SOURCE.STACKOVERFLOW]: 'Stack Overflow',
    [WEB_INFO_SOURCE.OTHER]: 'a web page',
};

class MetaInformationController {
    constructor(private readonly timelineController: TimelineController) {}
    render(g: TimelineEvent) {
        const { originalData } = g;
        const data = originalData as SerializedChangeBuffer;
        if (data.eventData) {
            if (data.eventData[Event.WEB]) {
                const { copyBuffer } = data.eventData[Event.WEB];

                return (
                    <div className={styles['git-information']}>
                        <div style={{ alignItems: 'center' }}>
                            Code copied from{' '}
                            <a className={styles['m4px']} href={copyBuffer.url}>
                                {prettyPrintType[copyBuffer.type]}
                            </a>
                            .
                        </div>
                        {this.renderCopyBuffer(copyBuffer)}
                    </div>
                );
            }
            if (data.eventData[Event.PASTE]) {
                const { vscodeMetadata } = data.eventData[Event.PASTE];
                if (!vscodeMetadata) {
                    return (
                        <div className={styles['git-information']}>
                            <div
                                className={styles['flex']}
                                style={{ alignItems: 'center' }}
                            >
                                Code originally copied from{' '}
                                <div className={styles['m4px']}>
                                    {data.eventData[Event.PASTE].nodeId?.split(
                                        ':'
                                    )[0] || 'VS Code'}
                                </div>
                                .
                            </div>
                        </div>
                    );
                }
                const { id, node } = vscodeMetadata;
                const { location } = node;
                return (
                    <div className={styles['git-information']}>
                        <div
                            className={styles['flex']}
                            style={{ alignItems: 'center' }}
                        >
                            Code originally copied from{' '}
                            <a
                                className={styles['m4px']}
                                onClick={() =>
                                    VS_CODE_API.postMessage({
                                        command: 'goToNode',
                                        data: {
                                            nodeId: id,
                                        },
                                    })
                                }
                            >
                                {data.eventData[Event.PASTE].nodeId?.split(
                                    ':'
                                )[0] || 'VS Code'}
                            </a>
                            .
                        </div>
                    </div>
                );
            }
        }
        if (data.changeInfo?.length) {
            return (
                <div className={styles['git-information']}>
                    <div>
                        {data.changeInfo.map((c) => (
                            <div>User added comments to the code: {c.text}</div>
                        ))}
                    </div>
                </div>
            );
        }
        return (
            <div className={styles['git-information']}>User changed code</div>
        );
    }

    renderAdditionalMetadata(
        // additionalMetadata: AdditionalMetadata,
        copyBuffer: CopyBuffer,
        type: WEB_INFO_SOURCE
    ) {
        const { additionalMetadata } = copyBuffer;
        switch (type) {
            case WEB_INFO_SOURCE.GITHUB: {
                const { codeMetadata, repo } =
                    additionalMetadata as GitHubCopyBuffer;
                const star = repo.stars ? `⭐️ ${repo.stars} stars` : ``;
                const version = repo.version
                    ? ` on version ${repo.version}`
                    : ``;
                const line =
                    codeMetadata.startLine && codeMetadata.endLine
                        ? ` from line ${codeMetadata.startLine} to ${codeMetadata.endLine}`
                        : ``;
                return (
                    <div>
                        <div>
                            Copied from GitHub repository {repo.owner}/
                            {repo.name}
                            {version} on branch {repo.branch} at commit{' '}
                            {repo.commit}.{star} Code came from file{' '}
                            {codeMetadata.filename}
                            {line}.
                        </div>
                        {/* <CodeBlock codeString={codeMetadata.code} /> */}

                        {this.seeMore(copyBuffer, type)}
                    </div>
                );
            }
            case WEB_INFO_SOURCE.STACKOVERFLOW: {
                const { question, copiedMessage } =
                    additionalMetadata as StackOverflowCopyBuffer;

                const message = !copiedMessage
                    ? copiedMessage
                    : isStackOverflowAnswer(copiedMessage)
                    ? (copiedMessage as StackOverflowAnswer)
                    : (copiedMessage as StackOverflowQuestion);
                const answer = message && isStackOverflowAnswer(message);
                return (
                    <div>
                        <div>
                            Copied from Stack Overflow question "
                            {question.programmingLanguage}" ({question.views}{' '}
                            views, {question.votes} votes), originally posted on{' '}
                            {new Date(question.postDate).toLocaleString()}.
                            {this.seeMore(copyBuffer, type)}
                        </div>
                    </div>
                );
            }
            case WEB_INFO_SOURCE.CHAT_GPT: {
                const { messageCopied, thread } =
                    additionalMetadata as ChatGptCopyBuffer;

                return (
                    <div>
                        Copied from a Chat GPT thread titled "{thread._title}"
                        on {new Date(messageCopied.time).toString()}.
                        {this.seeMore(copyBuffer, type)}
                    </div>
                );
            }
            default:
                return null;
        }
    }

    seeMore(c: CopyBuffer, type: WEB_INFO_SOURCE) {
        return (
            <div className={`${styles['flex-row']} ${styles['center']}`}>
                <VSCodeButton
                    className={styles['flat-button']}
                    onClick={() => this.timelineController.openView(c, type)}
                >
                    See More
                </VSCodeButton>
            </div>
        );
    }

    renderCopyBuffer(c: CopyBuffer) {
        const { additionalMetadata, searchData, type } = c;
        return (
            <div className={styles['git-information']}>
                {searchData && (
                    <div>
                        <div>
                            User searched "{searchData.query}" and looked at
                            these page(s):{' '}
                            {searchData.selectedPages.map((s, i) => {
                                if (
                                    i === searchData.selectedPages.length - 1 &&
                                    searchData.selectedPages.length > 1
                                ) {
                                    return (
                                        <>
                                            and{' '}
                                            <a
                                                className={styles['m4px']}
                                                href={s}
                                            >
                                                {s}
                                            </a>
                                            .
                                        </>
                                    );
                                } else if (
                                    i === 0 &&
                                    searchData.selectedPages.length === 1
                                ) {
                                    return (
                                        <>
                                            <a
                                                className={styles['m4px']}
                                                href={s}
                                            >
                                                {s}
                                            </a>
                                        </>
                                    );
                                } else {
                                    <>
                                        <a className={styles['m4px']} href={s}>
                                            {s}
                                        </a>
                                        ,
                                    </>;
                                }
                            })}
                        </div>
                    </div>
                )}
                {additionalMetadata && this.renderAdditionalMetadata(c, type)}
            </div>
        );
    }
}

export default MetaInformationController;

// The question was: {question.body}.
//                             {message && (
//                                 <div>
//                                     {answer
//                                         ? `The answer was ${message.body}`
//                                         : `The comment was ${message.body}`}
//                                 </div>
//                             )}
