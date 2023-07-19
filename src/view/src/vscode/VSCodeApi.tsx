// declare const acquireVsCodeApi: Function;

// interface VSCodeApi {
//     getState: () => any;
//     setState: (newState: any) => any;
//     postMessage: (message: any) => void;
// }

// declare global {
//     interface Window {
//         acquireVsCodeApi(): VSCodeApi;
//     }
// }

// class VSCodeWrapper {
//     private readonly vscodeApi: VSCodeApi = acquireVsCodeApi();

//     /**
//      * Send message to the extension framework.
//      * @param message
//      */
//     public postMessage(message: any): void {
//         this.vscodeApi.postMessage(message);
//     }

//     /**
//      * Add listener for messages from extension framework.
//      * @param callback called when the extension sends a message
//      * @returns function to clean up the message eventListener.
//      */
//     public onMessage(callback: (message: any) => void): () => void {
//         // @ts-ignore
//         window.addEventListener('message', callback);
//         // @ts-ignore
//         return () => window.removeEventListener('message', callback);
//     }
// }

// export { VSCodeWrapper };
// // Singleton to prevent multiple fetches of VsCodeAPI.
// export const VS_CODE_API: VSCodeWrapper = new VSCodeWrapper();
