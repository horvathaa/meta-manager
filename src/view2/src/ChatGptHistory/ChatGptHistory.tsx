import * as React from 'react';
import { ThreadPair, VscodeChatGptData } from '../../../constants/types';
import styles from '../styles/chatGptStyle.module.css';
import ChatGptMessage from './ChatGptMessage';
import CodeBlock from './components/CodeBlock';

export function ChatGptHistory() {
    const [gptData, setGptData] = React.useState<VscodeChatGptData>();
    React.useEffect(() => {
        window.addEventListener('message', (e: MessageEvent<any>) => {
            const { command } = e.data;
            if (command === 'renderChatGptHistory') {
                const { payload } = e.data;
                setGptData(payload);
            }
        });
    });

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
            jsx.push(<CodeBlock codeString={c.code} />);
            strCopy = temp[1];
        });
        jsx.push(<div className={styles['message']}>{strCopy}</div>);
        return <>{...jsx}</>;
    };

    return gptData ? (
        <div>
            <div className={styles['container']}>
                {/* <pre>{gptData.code}</pre>
                 */}
                <CodeBlock codeString={gptData.code} />
                <div className={styles['message']}>
                    {gptData.messageCopied.userMessage}
                </div>
                <div className={styles['message']}>
                    {formatBotResponse(gptData.messageCopied)}
                </div>
                {/* <div className={styles['message']}>
                    {gptData.messageCopied.botResponse}
                </div> */}
            </div>
            {/* {gptData.thread._threadItems.map((item) => {
                return <ChatGptMessage gptData={item} />;
            })} */}
        </div>
    ) : null;
}

export default ChatGptHistory;
