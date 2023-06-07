import { GithubAuthProvider, User, signInWithCredential } from 'firebase/auth';
import FirestoreController from '../FirestoreController';

export const signInWithGithubCredential = async (
    firestoreController: FirestoreController,
    oauth: string
): Promise<User | undefined> => {
    const credential = GithubAuthProvider.credential(oauth);
    try {
        if (!firestoreController.auth) {
            throw new Error('FirestoreController: auth not initialized');
        }
        const { user } = await signInWithCredential(
            firestoreController.auth,
            credential
        );
        return user;
    } catch (e) {
        throw new Error('FirestoreController: could not sign in user');
    }
};
