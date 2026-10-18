import {FastifyInstance} from "fastify";
import {MikroORM, RequestContext} from "@mikro-orm/core";

export default async function orm_plugin(app: FastifyInstance, options: { orm?: MikroORM } = {}) {
    const orm = options.orm || await MikroORM.init();

    // @ts-ignore
    app.addHook('onRequest', (_, __, done) => {
        RequestContext.create(orm.em, done);
    });

    app.addHook('onClose', async () => {
        await orm.close();
    });

    app.addHook('onReady', async () => {
        console.log("Creating database schema...");
        const generator = orm.getSchemaGenerator();
        await generator.updateSchema();
        console.log("Database schema created.");

        // Migration de l'ordre de priorite : les cadeaux crees avant l'ajout de la
        // colonne `position` valent tous 0. Pour les listes deja garnies (>= 2 cadeaux
        // tous a 0), on fige une seule fois leur ordre d'insertion physique (rowid).
        // Idempotent : une fois la liste ordonnee, la condition ne matche plus.
        try {
            await orm.em.getConnection().execute(`
                update gifts set position = (
                    select count(*) - 1 from gifts g2
                    where g2.user_family_uuid = gifts.user_family_uuid and g2.rowid <= gifts.rowid
                )
                where user_family_uuid in (
                    select user_family_uuid from gifts
                    group by user_family_uuid
                    having count(*) > 1 and max(position) = 0
                )
            `);
        } catch (e) {
            console.log("Backfill des positions de cadeaux ignore :", e);
        }
    })
}