import * as React from 'react';
import * as d3 from 'd3';
import DataController from './DataController/DataController';
// import ChatGptHistory from './ChatGptHistory/ChatGptHistory';

// export function App() {
//     const [message, setMessage] = React.useState('HELLO!!!');

//     return (
//         <div>
//             {/* <h1>{message}</h1> */}
//             {/* <DataController /> */}
//             {/* <ChatGptHistory /> */}
//         </div>
//     );
// }

import LinePlot from './LinePlot/LinePlot';

export default function App() {
    const [data, setData] = React.useState(() =>
        d3.ticks(-2, 2, 200).map(Math.sin)
    );

    React.useEffect(() => {
        const listenerCallback = (e: MessageEvent<any>) => {
            const message = e.data;
            if (message.command === 'updateTimeline') {
                console.log('updateState', message.state);
            }
        };
        window.addEventListener('message', listenerCallback);
        return () => window.removeEventListener('message', listenerCallback);
    }, []);

    function onMouseMove(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
        const [x, y] = d3.pointer(event);
        setData(data.slice(-200).concat(Math.atan2(x, y)));
    }

    return (
        <div
            onMouseMove={onMouseMove}
            style={{ width: '100vw', height: '400px' }}
        >
            <LinePlot data={data} />
        </div>
    );
}
