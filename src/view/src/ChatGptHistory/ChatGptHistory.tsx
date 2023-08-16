// import * as React from 'react';
// import DataController from '../DataController/DataController';
// // import {
// //     ThreadPair,
// //     CopyBuffer,
// //     ChatGptCopyBuffer,
// // } from '../../../constants/types';
// // import styles from '../styles/chatGptStyle.module.css';
// // // import ChatGptMessage from './ChatGptMessage';
// // import CodeBlock from '../components/CodeBlock';
// // // import DataController from '../DataController/DataController';

// // const CopyText = {
// //     copy: 'Copy code',
// //     copied: 'Copied!',
// // };

// export function ChatGptHistory() {
//     // const [gptData, setGptData] = React.useState<CopyBuffer>();
//     // React.useEffect(() => {
//     //     window.addEventListener('message', (e: MessageEvent<any>) => {
//     //         const { command } = e.data;
//     //         if (command === 'renderChatGptHistory') {
//     //             const { payload } = e.data;
//     //             setGptData(payload);
//     //         }
//     //     });
//     // });

//     // const formatBotResponse = (threadMessage: ThreadPair) => {
//     //     const { botResponse, codeBlocks } = threadMessage;
//     //     if (!codeBlocks.length) {
//     //         return <div className={styles['message']}>{botResponse}</div>;
//     //     }
//     //     let strCopy = botResponse;
//     //     const jsx: React.ReactElement[] = [];
//     //     codeBlocks.forEach((c) => {
//     //         const temp = strCopy.split(c.code);
//     //         jsx.push(<div className={styles['message']}>{temp[0]}</div>);
//     //         const code = c.code.includes('Copy code') // change to match on CopyText's
//     //             ? c.code.split('Copy code')[1]
//     //             : c.code;
//     //         jsx.push(
//     //             <CodeBlock
//     //                 codeString={code}
//     //                 style={{ backgroundColor: 'blueviolet' }}
//     //             />
//     //         );
//     //         strCopy = temp[1];
//     //     });
//     //     jsx.push(<div className={styles['message']}>{strCopy}</div>);
//     //     return <>{...jsx}</>;
//     // };

//     return <DataController />;
//     // return <></>;
//     // return gptData ? (
//     //     <div>
//     //         <div className={styles['container']}>
//     //             {/* <pre>{gptData.code}</pre>
//     //              */}
//     //             <CodeBlock
//     //                 codeString={gptData.code}
//     //                 style={{ backgroundColor: 'blueviolet' }}
//     //             />
//     //             <div className={styles['message']}>
//     //                 {
//     //                     (gptData.additionalMetadata as ChatGptCopyBuffer)
//     //                         .messageCopied.userMessage
//     //                 }
//     //             </div>
//     //             <div className={styles['message']}>
//     //                 {formatBotResponse(
//     //                     (gptData.additionalMetadata as ChatGptCopyBuffer)
//     //                         .messageCopied
//     //                 )}
//     //             </div>
//     //             {/* <div className={styles['message']}>
//     //                 {gptData.messageCopied.botResponse}
//     //             </div> */}
//     //         </div>
//     //         {/* {gptData.thread._threadItems.map((item) => {
//     //             return <ChatGptMessage gptData={item} />;
//     //         })} */}
//     //     </div>
//     // ) : (
//     //     <div>Paste some code from ChatGPT for it to be tracked</div>
//     // );
// }

// export default ChatGptHistory;
