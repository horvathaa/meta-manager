import * as React from 'react';
import { ThreadPair } from '../../../constants/types';

function ChatGptMessage({ gptData }: { gptData: ThreadPair }) {
    const [gptMessage, setGptData] = React.useState<ThreadPair>(gptData);
    React.useEffect(() => {
        setGptData(gptData);
    }, [gptData]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div>{gptMessage.userMessage}</div>
            <div>{gptMessage.botResponse}</div>
        </div>
    );
}

export default ChatGptMessage;
