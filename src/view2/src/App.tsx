import * as React from 'react';
import ChatGptHistory from './ChatGptHistory/ChatGptHistory';

export function App() {
    const [message, setMessage] = React.useState('HELLO!!!');
    React.useEffect(() => {
        window.addEventListener('message', (e: MessageEvent<any>) => {
            const { command } = e.data;
            if (command === 'hi') {
                setMessage('HI!!!');
            }
        });
    });

    return (
        <div>
            <h1>{message}</h1>
            <ChatGptHistory />
        </div>
    );
}
