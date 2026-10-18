import { ENV } from "../../config/env.js";
import nodemailer, { Transporter } from "nodemailer";

class EmailService {
    private transporter: Transporter;
    private mailConfig = {
        host: ENV.MAIL_HOST,
        port: ENV.MAIL_PORT,
        secure: ENV.MAIL_SECURE,
        auth: {
            user: ENV.MAIL_USER,
            pass: ENV.MAIL_PASS,
        },
    };

    constructor() {
        this.transporter = nodemailer.createTransport(this.mailConfig);
    }

    public async sendMail(to: string, subject: string, html: string) {
        try {
            const info = await this.transporter.sendMail({
                from: `"WishNest" <${this.mailConfig.auth.user}>`,
                to,
                subject,
                html,
            });
            console.log("✅ Mail envoyé :", info.messageId);
            return info;
        } catch (error) {
            console.error("❌ Erreur d’envoi :", error);
        }
    }
}

export default new EmailService();