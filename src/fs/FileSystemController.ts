import { Disposable, EventEmitter, Uri, workspace } from 'vscode';
import { v4 as uuidv4 } from 'uuid';

export interface FileParsedEvent {
    filename: string;
    data: any;
}

class FileSystemController extends Disposable {
    readonly _extensionDir: Uri;
    _onFileParsed: EventEmitter<FileParsedEvent> =
        new EventEmitter<FileParsedEvent>();
    constructor(private readonly uri: Uri) {
        super(() => this.dispose());
        this._extensionDir = Uri.joinPath(this.uri, '.metamanager');
    }

    get onFileParsed() {
        return this._onFileParsed.event;
    }

    checkIfOutputExists() {
        if (!this._extensionDir) {
            throw new Error('FileSystemController: No workspace folder found');
        }
        return this._extensionDir;
    }

    public static create(uri: Uri) {
        const fileSystemController = new FileSystemController(uri);
        return fileSystemController;
    }

    public async writeToFile(data: {}, filename: string) {
        if (this.checkIfOutputExists()) {
            const obj = { data, filename };
            const toWrite = JSON.stringify(obj);
            const path = Uri.joinPath(this._extensionDir, `${uuidv4()}.json`);
            await workspace.fs.writeFile(
                path,
                new TextEncoder().encode(toWrite)
            );
        }
    }

    public async readFromFile(filename: string) {
        const path = Uri.joinPath(this._extensionDir, filename);
        return await workspace.fs.readFile(path);
    }

    public async openTextDocument(filename: string) {
        const path = Uri.joinPath(this._extensionDir, filename);
        return await workspace.openTextDocument(path);
    }

    public async openAndReadTextDocument(filename: string) {
        const doc = await this.openTextDocument(filename);
        return doc.getText();
    }

    public async readExtensionDirectory() {
        try {
            const files = await workspace.fs.readDirectory(this._extensionDir);
            for (const file of files) {
                const filename = file[0];
                const content = await this.openAndReadTextDocument(filename);
                const parsed = JSON.parse(content);
                this._onFileParsed.fire({
                    filename: parsed.filename,
                    data: parsed,
                });
            }
        } catch (err: any) {
            if (err.code === 'FileNotFound') {
                // no metamanager directory exists so we will create one
                return;
            } else {
                console.error(
                    'FileSystemController: unable to read directory',
                    err
                );
            }
        }
    }
}

export default FileSystemController;
