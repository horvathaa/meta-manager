import { Disposable, Uri, workspace } from 'vscode';

class FileSystemController extends Disposable {
    readonly _output: Uri;
    constructor(private readonly uri: Uri) {
        super(() => this.dispose());
        this._output = Uri.joinPath(uri, '.metamanager');
    }

    checkIfOutputExists() {
        if (!this._output) {
            throw new Error('FileSystemController: No workspace folder found');
        }
        return this._output;
    }

    public static create(uri: Uri) {
        const fileSystemController = new FileSystemController(uri);
        return fileSystemController;
    }

    public async writeToFile(data: string | {}, filename?: string) {
        if (this.checkIfOutputExists()) {
            const toWrite =
                typeof data === 'string' ? data : JSON.stringify(data);
            console.log('toWrite', toWrite);
            const path = Uri.joinPath(
                this._output,
                filename ? filename : 'output.json'
            );
            console.log('writing to file', path);
            await workspace.fs.writeFile(
                path,
                new TextEncoder().encode(toWrite)
            );
        }
    }

    public async readFromFile(filename: string) {
        const path = Uri.joinPath(this._output, filename);
        console.log('reading from file', path);
        return await workspace.fs.readFile(path);
    }

    public async openTextDocument(filename: string) {
        const path = Uri.joinPath(this._output, filename);
        console.log('opening text document', path);
        return await workspace.openTextDocument(path);
    }

    public async openAndReadTextDocument(filename: string) {
        const doc = await this.openTextDocument(filename);
        return doc.getText();
    }
}

export default FileSystemController;
