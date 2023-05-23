import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { App } from './App';
// import { useFlatConfigStore } from './store';
// import './vscode.css';
import { VS_CODE_API } from './VSCodeApi';

// TODO: Type the incoming config data
// let config: any = {};
// let workspace = '';
// let gitRepo = '';

const root = document.getElementById('root');

if (root) {
    // workspace = root.getAttribute('data-workspace') || '';
    // gitRepo = root.getAttribute('data-gitrepo') || '';
}

VS_CODE_API.postMessage({
    command: 'refreshFiles',
});

VS_CODE_API.postMessage({
    command: 'refreshState',
});

window.addEventListener('message', (e) => {
    // @ts-ignore
    const message = e.data;
    if (message.command === 'updateState') {
        console.log('updateState', message.state);
    } else if (message.command === 'updateFiles') {
        console.log('updateFiles', message.state);
    }
});

ReactDOM.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
    document.getElementById('root')
);
