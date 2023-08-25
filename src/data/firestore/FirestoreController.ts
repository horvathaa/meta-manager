import {
    AuthenticationSession,
    Disposable,
    Uri,
    EventEmitter,
    window,
} from 'vscode';
import { FirebaseApp, initializeApp } from 'firebase/app';
import {
    CollectionReference,
    Firestore,
    collection,
    getFirestore,
    query,
    where,
    getDocs,
    onSnapshot,
    DocumentData,
    doc,
    setDoc,
    getDoc,
    QuerySnapshot,
} from 'firebase/firestore';
import { Functions, getFunctions } from 'firebase/functions';
import { Auth, User, getAuth } from 'firebase/auth';
import { Container } from '../../container';
import * as dotenv from 'dotenv';
import { getUserGithubData } from './functions/cloudFunctions';
import {
    signInWithEmailAndPassword,
    signInWithGithubCredential,
} from './functions/authFunctions';
import { DataSourceType } from '../timeline/TimelineEvent';
import {
    CopyBuffer,
    SerializedChangeBuffer,
    SerializedDataController,
} from '../../constants/types';
import GitController from '../git/GitController';
import { FirestoreControllerInterface } from '../DataController';
import DocumentWatcher from '../../document/documentWatcher';
import { isBoolean, isNumber } from 'lodash';
// import {
//     credential,
//     initializeApp as initializeAppAdmin,
// } from 'firebase-admin';
// import { applicationDefault, cert } from 'firebase-admin/app';

// GIVEN THE STUPID ISSUES WITH FIRESTORE JUST NOT WORKING WITH
// OUR CREDENTAILS ANYMORE...
// Consider just using the admin sdk instead
// do this by getting the user's uid from the github credential

// note this returns a UserRecord, not a User
// so I think we could then use the admin SDK to write to the database
// since we have the uid so we can associate the activity with them
// even if they aren't technically logged in

// var admin = require('firebase-admin');

// var serviceAccount = require('../../../secrets.json');
// const ok = admin.initializeApp({
//     credential: admin.credential.cert(serviceAccount),
// });

// console.log('ok', ok);

// Code used for getting counts of users and annotations of Adamite and Catseye respectively
// const InvalidUsers = new Set<string>([
//     'hJyV36Xgy8gO67UJVmnQUrRgJih1',
//     '0SylSmbCPfR86fK43hNboY5L8Y53',
//     '32hZmxr9jueVXAKLyU3Q3sZqEi13',
//     '5IYU4EPPANRdDyuyplFrWCQ92sO2',
//     '6m84Ekq7pWT8DVrHrGJ8K2CmKqd2',
//     'AmPkp5HM6QS1RwxGELrvuHRkimj1',
//     'CBaINhdKcRQtrwK1LAmyvAg9Fmj1',
//     'IXXnUJ1fDhSA7MkR1PmCBVIKw9o2',
//     'OauK8Xpx02M7CRZEZGJ9JBa8pFr1',
//     'aeL3LIzxQ2QVuu0jWUt2bQIzLVl1',
//     'b3gQowRBRMezwipcWb7A2t4yxhY2',
//     'bCrwiWVV23awMm7eQuxI',
//     'iZKzal3YxydCTrEazd8tm2yCRnY2',
//     'lZlbnc28uQc0qFnUnHrUav3XFop2',
//     'nEW1uOgNiYUGZd5UDVHlHbSjWQq1',
//     'nOaOlC0TEfX36OfIa76LZnh0FwA2',
//     'pV24BEvX2thVkQA3dAvv1UQY9mG3',
//     'rkckdgdrfzOrv1e263qApVx0wyA2',
//     'uySjhiqllLUFPqZrhT2dL5LOLb92',
//     'xsk048R301fE5wOFrPhccOXEVe32',
// ]);

// private async getCounts() {
//     const webAnnotations = this._refs?.get(DB_COLLECTIONS.WEB_ANNOTATIONS);
//     console.log('web annotations', webAnnotations);
//     if (webAnnotations) {
//         const webAnnotationsCount = getListFromSnapshots(
//             await getDocs(webAnnotations)
//         ).filter((a) => !InvalidUsers.has(a.authorId));
//         console.log(
//             'web annotations count',
//             webAnnotationsCount.length,
//             'web user count',
//             new Set(webAnnotationsCount.map((a) => a.authorId)).size
//         );
//     }
//     const codeAnnotations = this._refs?.get(
//         DB_COLLECTIONS.CODE_ANNOTATIONS
//     );
//     if (codeAnnotations) {
//         const codeAnnotationsCount = getListFromSnapshots(
//             await getDocs(codeAnnotations)
//         ).filter((a) => !InvalidUsers.has(a.authorId));
//         console.log(
//             'code annotations count',
//             codeAnnotationsCount.length,
//             'code user count',
//             new Set(codeAnnotationsCount.map((a) => a.authorId)).size
//         );
//     }
// }

export type DB_REFS =
    | 'users'
    | 'annotations'
    | 'vscode-annotations'
    | 'commits'
    | 'web-meta'
    | 'code-metadata';

export const DB_COLLECTIONS: { [key: string]: DB_REFS } = {
    USERS: 'users',
    WEB_ANNOTATIONS: 'annotations',
    CODE_ANNOTATIONS: 'vscode-annotations',
    COMMITS: 'commits',
    WEB_META: 'web-meta',
    CODE_METADATA: 'code-metadata',
    // PLAY_TOY: 'play-toy',
};

const SUB_COLLECTIONS = {
    FILES: 'files',
    NODES: 'nodes',
    PAST_VERSIONS: 'past-versions',
};

export function getListFromSnapshots(
    snapshots: QuerySnapshot<DocumentData>
): any[] {
    let out: any = [];
    snapshots.forEach((snapshot) => {
        out.push({
            id: snapshot.id,
            ...snapshot.data(),
        });
    });
    return out;
}

// const secret = require('../../../secrets.json');
// console.log('hewwo?', secret);
// const huh = applicationDefault();
// // console.log('huh', huh);
// const certt = cert(secret);
// console.log('cert', certt);
// try {
//     const adminFS = initializeAppAdmin();
//     console.log('hewwo aaa?', adminFS);
// } catch (e) {
//     console.log('error initializing admin', e);
// }

class FirestoreController extends Disposable {
    _disposable: Disposable;
    readonly _firebaseApp: FirebaseApp | undefined;
    readonly _firestore: Firestore | undefined;
    readonly _functions: Functions | undefined;
    readonly _auth: Auth | undefined;
    // readonly _admin: Admin | undefined;
    // private readonly _serviceAccount = adminFS;
    _user: User | undefined;
    readonly _refs: Map<string, CollectionReference> | undefined;
    _onCopy: EventEmitter<CopyBuffer> = new EventEmitter<CopyBuffer>();
    _onRead: EventEmitter<any> = new EventEmitter<any>();
    _projectName: string = '';
    constructor(private readonly container: Container) {
        super(() => this.dispose());
        this._disposable = Disposable.from();
        this._firebaseApp = this.initFirebaseApp();
        // console.log('im scared', this._serviceAccount);
        if (this._firebaseApp) {
            this._firestore = getFirestore(this._firebaseApp);
            this._functions = getFunctions(this._firebaseApp);
            this._auth = getAuth(this._firebaseApp);
            this._refs = this.initRefs();
        }
    }

    get firebaseApp() {
        return this._firebaseApp;
    }

    get functions() {
        return this._functions;
    }

    get auth() {
        return this._auth;
    }

    get onCopy() {
        return this._onCopy.event;
    }

    get onRead() {
        return this._onRead.event;
    }

    private async setUpUser(
        firestoreController: FirestoreController,
        authSession: AuthenticationSession
    ) {
        try {
            firestoreController._user = await signInWithEmailAndPassword(
                firestoreController,
                'ambear9@gmail.com',
                '123456'
            );
            // await firestoreController.initAuth(
            //     authSession
            // );
            if (firestoreController._user) {
                console.log('user', firestoreController._user);
                firestoreController.listenForCopy();
            }
        } catch (e) {
            console.log('error signing in', e);
            // maybe just took too long so try again
            if (authSession) {
                setTimeout(async () => {
                    firestoreController._user =
                        await firestoreController.initAuth(authSession);
                    if (firestoreController._user) {
                        console.log('user', firestoreController._user);
                        firestoreController.listenForCopy();
                    }
                }, 5000);
            }
        }
    }

    async buildSubCollectionRefs() {
        const topLevelCollectionId = this._projectName;
        if (!this._refs) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        // const ref = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        // const topDoc = doc(
        //     this._refs.get(DB_COLLECTIONS.CODE_METADATA)!,
        //     topLevelCollectionId
        // );
        const collectionRef = collection(
            this._firestore!,
            `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}`
        );
        this._refs.set(
            `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}`,
            collectionRef
        );
        const docs = await getDocs(collectionRef);
        docs.forEach((doc) => {
            const subCollectionRef = collection(
                this._firestore!,
                `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}/${doc.id}/${SUB_COLLECTIONS.NODES}`
            );
            this._refs?.set(
                `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}/${doc.id}/${SUB_COLLECTIONS.NODES}`,
                subCollectionRef
            );
        });
    }

    private initProjectName(gitController: GitController) {
        const { gitState } = gitController;
        if (gitState) {
            this._projectName = gitState.projectName.replace(/[\/\\]/g, '-');
        }
    }

    public static async create(container: Container) {
        const firestoreController = new FirestoreController(container);
        const event = firestoreController.container.onInitComplete(
            async (container) => {
                const gitController = container.gitController;
                if (gitController && gitController.authSession) {
                    await firestoreController.setUpUser(
                        firestoreController,
                        gitController.authSession
                    );
                    firestoreController.initProjectName(gitController);
                    await firestoreController.buildSubCollectionRefs();
                    firestoreController.readProject();
                }
            }
        );

        firestoreController._disposable = Disposable.from(event);

        return firestoreController;
    }

    private initFirebaseApp() {
        try {
            if (this.container.workspaceFolder) {
                const path = Uri.joinPath(
                    this.container.context.extensionUri,
                    '.env.local'
                );
                const env = dotenv.config({ path: path.fsPath });
                if (env.error) {
                    throw new Error(
                        'Firestore Controller: .env.local not found'
                    );
                }
                const firebaseConfig = {
                    apiKey: env.parsed?.FB_API_KEY,
                    authDomain: env.parsed?.FB_AUTH_DOMAIN,
                    projectId: env.parsed?.FB_PROJECT_ID,
                    storageBucket: env.parsed?.FB_STORAGE_BUCKET,
                    messagingSenderId: env.parsed?.FB_MESSAGING_SENDER_ID,
                    appId: env.parsed?.FB_APP_ID,
                };
                return initializeApp(firebaseConfig); // consider making event emit so that other classes can listen for this
            }
        } catch (e) {
            throw new Error('Firestore Controller: .env.local not found');
        }
    }

    private initRefs() {
        const refs = new Map<DB_REFS, CollectionReference>();
        if (this._firestore !== undefined) {
            const firestore: Firestore = this._firestore; // stupid typescript
            Object.keys(DB_COLLECTIONS).forEach((key) => {
                const ref = collection(firestore, DB_COLLECTIONS[key]);
                refs.set(DB_COLLECTIONS[key], ref);
            });
        }
        return refs;
    }

    async initAuthWithEmailAndPassword(): Promise<User | undefined> {
        const email = await window.showInputBox({
            prompt: 'Please enter your email',
            placeHolder: 'email',
        });
        if (email) {
            const password = await window.showInputBox({
                prompt: 'Please enter your password',
                placeHolder: 'password',
                password: true,
            });
            if (password) {
                const res = await signInWithEmailAndPassword(
                    this,
                    email,
                    password
                );
                if (res) {
                    return res;
                } else {
                    // consider just creating a new user with email and password
                    // will have to see if this issue with github credential persists
                    // :-(
                    throw new Error(
                        'could not sign in with email and password'
                    );
                }
            }
        }
    }

    private async initAuth(authSession: AuthenticationSession) {
        const { accessToken, account } = authSession;
        const { id } = account;
        try {
            const result = await getUserGithubData(this, {
                id,
                oauth: accessToken,
            });
            console.log('res', result);
            const { data } = result;
            // const user = await ok.auth().getUser(data.uid);
            // console.log('user???', user);
            if (!data) {
                throw new Error(
                    'Firestore Controller: could not retrieve user data'
                );
            } else {
                const res = signInWithGithubCredential(this, data);
                if (res) {
                    return res;
                }
            }
        } catch (e) {
            console.error(
                'could not sign in with firestore github credential -- using email and password instead'
            );
            return this.initAuthWithEmailAndPassword();
        }
    }

    public async query(id: string) {
        if (!this._refs) {
            return [];
        }
        const arr = (
            await Promise.all(
                Array.from(this._refs).map(async (refMap) => {
                    const [refName, ref] = refMap;
                    const docRefs = query(ref, where('codeId', '==', id));
                    const docs = await getDocs(docRefs);
                    const formattedArr = docs.docs.map((doc) => {
                        return {
                            ...doc.data(),
                            refType: refName,
                            refSource: DataSourceType.FIRESTORE,
                        };
                    });
                    return formattedArr;
                })
            )
        ).flat();
        return arr;
    }

    initProject() {
        const topLevelCollectionId = this._projectName;
        if (!this._refs) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        const ref = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!ref) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        const docRef = doc(ref, topLevelCollectionId);
        setDoc(docRef, { projectName: this._projectName });
    }

    async checkProjectExists() {
        const topLevelCollectionId = this._projectName;
        const ref = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!ref) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        const docRef = doc(ref, topLevelCollectionId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            console.log('doc exists', docSnap.data());
            return true;
        } else {
            // await this.write();
            this.container._onNodesComplete.fire(this.container);
            return false;
        }
    }

    listenForCopy() {
        const collectionRef = this._refs?.get(DB_COLLECTIONS.WEB_META);
        if (collectionRef === undefined) {
            throw new Error(
                'FirestoreController: Could not set up listener for copy -- no collection reference'
            );
        }
        if (this._user === undefined) {
            throw new Error(
                'FirestoreController: Could not set up listener for copy -- no user'
            );
        }
        console.log('excuse me', this.container);
        const q = query(
            collectionRef,
            where('user', '==', this._user.uid),
            where('timeCopied', '>', this.container.launchTime)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            console.log('snapshot???', snapshot);
            snapshot.docChanges().forEach((change) => {
                console.log('change????', change);
                if (change.type === 'added') {
                    console.log('New copy: ', change.doc.data());
                    this._onCopy.fire(change.doc.data() as CopyBuffer);
                }
                if (change.type === 'modified') {
                    // console.log('Modified copy: ', change.doc.data());
                }
                if (change.type === 'removed') {
                    // console.log('Removed copy: ', change.doc.data());
                }
            });
        });
        return () => unsubscribe();
    }

    // how to read in data? probably just read in all the files and the most recent
    // ver of each instance we have saved, if any, then use the tree deserialize function
    // curr will have curr version of each node
    // node can then query on its own time for its history maybe on file load or on selection?

    async readProject() {
        const topLevelCollectionId = this._projectName;
        const ref = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!ref) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no collection reference'
            );
        }
        console.log('reading project', topLevelCollectionId, this._user);
        // const docRef = doc(ref, topLevelCollectionId, SUB_COLLECTIONS.FILES);
        // const docRef = doc(ref, 'OFLdwjrdH2xysb0uhLRO');
        // const data = await getDocs(docRef);
        const doesExist = await this.checkProjectExists();
        if (!doesExist) {
            this.initProject();
            console.log('does not exist', this.container.fileParser?.docs);
            await this.initFile(this.container.fileParser?.docs!);
            return;
        }
        const filesRef = this._refs!.get(
            `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}`
        );
        if (!filesRef) {
            throw new Error(
                'FirestoreController: Could not read from firestore -- no files reference'
            );
        }

        const data = await getDocs(filesRef);
        data.forEach(async (doc) => {
            // console.log('doc', doc.data());
            const parentRefPath = `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${SUB_COLLECTIONS.FILES}/${doc.id}/${SUB_COLLECTIONS.NODES}`;
            const res = this._refs?.get(parentRefPath);
            if (!res) {
                console.error('could not find subcollection for', doc.id);
                return;
            }
            const querySnapshot = await getDocs(res);
            const { subData, dataMap } = this.initNodes(
                querySnapshot,
                parentRefPath
            );
            // console.log('got this data', subData, 'for this doc', doc.id);
            this._onRead.fire({
                filename: doc.id.replace(/-/g, '/'),
                collectionPath: parentRefPath,
                data: subData,
                map: dataMap,
            });
        });
    }

    public getFileCollectionPath(filename: string) {
        const topLevelCollectionId = this._projectName;
        return `${DB_COLLECTIONS.CODE_METADATA}/${topLevelCollectionId}/${
            SUB_COLLECTIONS.FILES
        }/${filename.replace(/[\/\\]/g, '-')}/${SUB_COLLECTIONS.NODES}`;
    }

    public createNodeMetadata(
        id: string,
        parentCollectionPath: string
    ): FirestoreControllerInterface {
        const pastVersionsCollection = collection(
            this._firestore!,
            `${parentCollectionPath}/${id}/${SUB_COLLECTIONS.PAST_VERSIONS}`
        );
        const nodePath = `${parentCollectionPath}/${id}`;
        const ref = doc(this._firestore!, `${parentCollectionPath}/${id}`);
        const firestoreMetadata = {
            ref,
            pastVersionsCollection,
            write: async (newNode: any) => {
                // change any to actual interface representing ver -- serialized data controller
                const docRef = doc(this._firestore!, nodePath);
                await setDoc(docRef, newNode);
            },
            logVersion: async (
                versionId: string,
                newNode: SerializedDataController
            ) => {
                console.log('new hewwo', versionId, newNode);
                const docRef = doc(pastVersionsCollection, versionId);
                console.log('SIGH', docRef);
                await setDoc(docRef, newNode);
            },
            readPastVersions: async () => {
                const querySnapshot = await getDocs(pastVersionsCollection);
                const list = getListFromSnapshots(
                    querySnapshot
                ) as SerializedChangeBuffer[];
                return list;
            },
        };
        return firestoreMetadata;
    }

    initNodes(
        nodes: QuerySnapshot<DocumentData>,
        parentCollectionPath: string
    ) {
        const formattedNodes: any[] = [];
        const dataMap: Map<string, any> = new Map(); // switch anys
        nodes.forEach((node) => {
            const firestoreMetadata = this.createNodeMetadata(
                node.id,
                parentCollectionPath
            );
            dataMap.set(node.id, firestoreMetadata);
            formattedNodes.push({
                id: node.id, // i dont think this is necessary
                firestore: firestoreMetadata,
                ...node.data(),
            });
        });
        return { subData: formattedNodes, dataMap };
    }

    async initFile(map: Map<string, DocumentWatcher>) {
        const refCollection = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!refCollection) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no collection reference'
            );
        }
        for (const file of map) {
            const [filename, docWatcher] = file;
            console.log('filename', filename, 'doc', docWatcher);
            const fileName = docWatcher.relativeFilePath.replace(
                /[\/\\]/g,
                '-'
            );

            const fileDocRef = doc(
                refCollection,
                this._projectName,
                SUB_COLLECTIONS.FILES,
                fileName
            );

            await setDoc(
                fileDocRef,
                { filename: fileName } // can put git stuff here
            );
            // const tree = docWatcher.initSerialize();
            const tree = docWatcher.nodesInFile?.toArray().filter(t => t.humanReadableKind !== 'file');
            if (!tree?.length) {
                console.warn('no tree for file', file);
                continue;
            }
            console.log('writing file', fileName, 'to firestore');

            for (const node of tree) {
                node.dataController!._firestoreControllerInterface =
                    this.createNodeMetadata(
                        node.id,
                        `${DB_COLLECTIONS.CODE_METADATA}/${this._projectName}/${SUB_COLLECTIONS.FILES}/${fileName}/${SUB_COLLECTIONS.NODES}`
                    );
                const docRef = doc(
                    refCollection,
                    this._projectName,
                    SUB_COLLECTIONS.FILES,
                    fileName,
                    SUB_COLLECTIONS.NODES,
                    node.id
                );
                setDoc(docRef, node.dataController!.serialize());
            }
        }
    }

    writeFile(tree: SerializedDataController[], filename: string) {
        const topLevelCollectionId = this._projectName;
        if (!this._refs) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no collection reference'
            );
        }
        const refCollection = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!refCollection) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no collection reference'
            );
        }
        const docRef = doc(
            refCollection,
            topLevelCollectionId,
            SUB_COLLECTIONS.FILES,
            filename
        );
        setDoc(
            docRef,
            { filename: filename } // can put git stuff here
        );
        tree.forEach((node) => {
            const docRef = doc(
                refCollection,
                topLevelCollectionId,
                SUB_COLLECTIONS.FILES,
                filename,
                SUB_COLLECTIONS.NODES,
                node.node.id
            );
            setDoc(docRef, node);
        });
    }

    // can probably have a smaller-scale, simpler write
    // for just updating an individual node when ready
    // or file when ready
    async write() {
        if (
            !this.container.gitController ||
            !this.container.gitController.gitState
        ) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no git state'
            );
        }
        if (!this._firestore) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no firestore'
            );
        }
        const topLevelCollectionId = this._projectName.length
            ? this._projectName
            : (this._projectName =
                  this.container.gitController.gitState.projectName.replace(
                      '/',
                      '-'
                  ));
        if (!this.container.fileParser) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no parsed files'
            );
        }

        // mark dirty files and only write those
        const files = this.container.fileParser.docs;
        // const dirtyFiles = files.filter((file) => file.dirty);
        const refCollection = this._refs?.get(DB_COLLECTIONS.CODE_METADATA);
        if (!refCollection) {
            throw new Error(
                'FirestoreController: Could not write to firestore -- no collection reference'
            );
        }
        const docRef = doc(
            refCollection,
            topLevelCollectionId
            // SUB_COLLECTIONS.FILES,
            // fileName,
            // SUB_COLLECTIONS.NODES,
            // node.id
        );
        await setDoc(
            docRef,
            { projectName: this._projectName } // can put git stuff here
        );
        // some async error where not every file is being written
        // probably a stupid forEach not async safe this idk
        // files.forEach((file) => {
        for (const file of files) {
            const [filename, docWatcher] = file;
            console.log('filename', filename, 'doc', docWatcher);
            const fileName = docWatcher.relativeFilePath.replace(
                /[\/\\]/g,
                '-'
            );
            const tree = docWatcher.nodesInFile?.toArray();
            if (!tree) {
                console.warn('no tree for file', file);
                return;
            }
            console.log('writing file', fileName, 'to firestore');
            const fileDocRef = doc(
                refCollection,
                topLevelCollectionId,
                SUB_COLLECTIONS.FILES,
                fileName
            );
            await setDoc(
                fileDocRef,
                { filename: fileName } // can put git stuff here
            );
            for (const node of tree) {
                const docRef = doc(
                    refCollection,
                    topLevelCollectionId,
                    SUB_COLLECTIONS.FILES,
                    fileName,
                    SUB_COLLECTIONS.NODES,
                    node.id
                );
                setDoc(
                    docRef,
                    node.dataController
                        ? node.dataController.serialize()
                        : node.serialize()
                );
            }
        }
        // });
    }

    dispose() {
        this._disposable.dispose();
    }
}

export default FirestoreController;
