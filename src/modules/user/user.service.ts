import UserRepository from "./database/user.repository.js";
import {generateUserKeyPair} from "../common/crypto/user-key.js";
import {DerivedKey} from "../common/crypto/derived-key.js";
import {generateSalt} from "../common/crypto/common.js";
import {hash} from "argon2";
import {User} from "./database/user.entity.js";
import EmailService from "../email/email.service.js";

export interface IUserService {
    getAllUsers(): Promise<User[]>;

    getUserByEmail(email: string): Promise<User | null>;

    getUserByUUID(uuid: string): Promise<User | null>;

    createUser(email: string, password: string): Promise<User | null>;

    verifyUser(uuid: string, code: string): Promise<User | null>;

    // Ajout: créer un utilisateur factice sans envoyer d'email
    createFakeUser(email?: string): Promise<User | null>;
}

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateRandomPassword(length = 24) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_+';
    let res = '';
    for (let i = 0; i < length; i++) {
        res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res;
}

class UserService implements IUserService {
    private repository;

    constructor() {
        this.repository = UserRepository;
    }

    public async getAllUsers() {
        const users = await this.repository.findAll();

        return Promise.all(users);
    }

    public async getUserByEmail(email: string) {
        const user = await this.repository.findOne({
            email
        });

        if (!user) {
            return null;
        }

        return user;
    }

    public async getUserByUUID(uuid: string) {
        const user = await this.repository.findOne({
            uuid
        });

        if (!user) {
            return null;
        }

        return user;
    }

    public async createUser(email: string, password: string) {
        const keyPair = await generateUserKeyPair();
        const salt = await generateSalt();
        const derivedKey = await DerivedKey.derive(password, salt);

        const user = new User();
        user.email = email;
        user._encrypted_private_key = await keyPair.privateKey.encryptWithDerived(derivedKey);
        user.password = await hash(password);
        user._public_key = await keyPair.publicKey.export();
        user.salt = salt;
        user.verification_code = generateVerificationCode();

        await this.repository.getEntityManager().persistAndFlush(user);

        const newUser = await this.getUserByEmail(email);
        if(newUser !== null){
            EmailService.sendMail(email, "Bienvenue sur WishNest - Vérifiez votre adresse e-mail",
                `<p>Bonjour,</p>
                <p>Merci de vous être inscrit sur WishNest ! Pour finaliser votre inscription, veuillez utiliser le code de vérification ci-dessous :</p>
                <h2>${newUser.verification_code}</h2>
                <p>Si vous n'avez pas créé de compte, veuillez ignorer cet e-mail.</p>
                <p>Merci,<br/>
                L'équipe WishNest</p>`
            );
        }

        return user;
    }

    public async verifyUser(uuid: string, code: string) {
        const user = await this.repository.findOne({
            uuid
        });

        if (!user) {
            return null;
        }

        if (user.verification_code !== code) {
            return null;
        }

        user.verification_code = null;
        user.verified = true;

        await this.repository.getEntityManager().persistAndFlush(user);

        return user;
    }

    // Nouvelle méthode: créer un utilisateur factice (fake)
    public async createFakeUser(email?: string): Promise<User | null> {
        // Générer un email unique si pas fourni
        const generatedEmail = email ?? `fake-${Date.now()}-${Math.random().toString(36).slice(2,8)}@fake.wishnest`;
        // S'assurer qu'il n'existe pas déjà
        const existing = await this.getUserByEmail(generatedEmail);
        if (existing !== null) {
            // Très improbable, mais régénérer
            return this.createFakeUser();
        }

        const password = generateRandomPassword();
        const keyPair = await generateUserKeyPair();
        const salt = await generateSalt();
        const derivedKey = await DerivedKey.derive(password, salt);

        const user = new User();
        user.email = generatedEmail;
        // Définir l'utilisateur comme vérifié pour éviter étape de validation
        user.verified = true;
        user.verification_code = null;
        user._encrypted_private_key = await keyPair.privateKey.encryptWithDerived(derivedKey);
        user.password = await hash(password);
        user._public_key = await keyPair.publicKey.export();
        user.salt = salt;
        user.virtual = true;

        await this.repository.getEntityManager().persistAndFlush(user);

        // On ne renvoie pas le mot de passe en clair ici (mais on pourrait le logger si nécessaire)
        return user;
    }
}

export default new UserService();