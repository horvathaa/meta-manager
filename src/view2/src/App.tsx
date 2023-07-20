import * as React from 'react';
import ChatGptHistory from './ChatGptHistory/ChatGptHistory';

export function App() {
    // const [message, setMessage] = React.useState('HELLO!!!');

    return (
        <div>
            {/* <h1>{message}</h1> */}
            <ChatGptHistory />
        </div>
    );
}
