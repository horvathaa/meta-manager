import * as React from 'react';
import DataController from './DataController/DataController';
// import ChatGptHistory from './ChatGptHistory/ChatGptHistory';

export function App() {
    const [message, setMessage] = React.useState('HELLO!!!');

    return (
        <div>
            {/* <h1>{message}</h1> */}
            <DataController />
            {/* <ChatGptHistory /> */}
        </div>
    );
}
